"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderSource = read("public/js/features/folder-command.js");
const implementationSource = read("public/js/features/folder-command-implementation.js");
const eventsSource = read("public/js/app/events.js");
const indexHtml = read("public/index.html");

test("folder picker and command palette stay out of startup while inspector context remains eager", () => {
  assert.match(indexHtml, /<script src="\.\/js\/features\/folder-command\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /folder-command-implementation\.js/);
  assert.doesNotMatch(indexHtml, /folder-command\.css/);
  assert.match(loaderSource, /async function ensureFolderCommandLoaded\(\)/);
  assert.match(loaderSource, /const folderCommandStyleResource = "\.\/folder-command\.css";/);
  assert.match(loaderSource, /function switchInspectorTab\(tab\)/);
  assert.match(loaderSource, /function setInspectorContext\(context, preferredTab = ""\)/);
  assert.match(implementationSource, /async function openFolderModal\(\)/);
  assert.match(implementationSource, /function openCommandPalette\(\)/);
  assert.doesNotMatch(implementationSource, /function switchInspectorTab\(tab\)/);
  assert.match(eventsSource, /openFolderModalLazy\(\)/);
  assert.match(eventsSource, /openCommandPaletteLazy\(\)/);
  assert.doesNotMatch(eventsSource, /addEventListener\("click", openCommandPalette\)/);
});

test("folder and command entry points share one in-flight script and stylesheet load", async () => {
  const harness = createHarness();
  const calls = [];
  const command = harness.context.openCommandPaletteLazy();
  const folder = harness.context.openFolderModalLazy();

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style");
  const script = harness.resource("script");
  assert.equal(style.href, "./folder-command.css");
  assert.equal(script.src, "./js/features/folder-command-implementation.js");
  installImplementation(harness.context, calls);
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, []);

  style.onload();
  await Promise.all([command, folder]);

  assert.equal(style.dataset.loaded, "true");
  assert.equal(script.dataset.loaded, "true");
  assert.deepEqual(calls.slice(0, 2), [["command"], ["folder"]]);
  await harness.context.loadFolderLazy("C:/repo");
  await harness.context.openSelectedFolderLazy();
  await harness.context.executeCommandPaletteItemLazy("fetch");
  assert.equal(harness.resources.length, 2);
  assert.deepEqual(calls.slice(2), [["load", "C:/repo"], ["open"], ["execute", "fetch"]]);
});

test("a failed folder-command stylesheet retries without reloading its completed script", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureFolderCommandLoaded();
  const style = harness.resource("style");
  const script = harness.resource("script");
  installImplementation(harness.context, []);
  script.onload();
  style.onerror();
  await assert.rejects(failed, /目录选择和命令面板资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureFolderCommandLoaded();
  const retryStyle = harness.resource("style");
  assert.notEqual(retryStyle, style);
  assert.equal(harness.resources.length, 2);
  retryStyle.onload();
  await retried;
  assert.equal(script.dataset.loaded, "true");
  assert.equal(retryStyle.dataset.loaded, "true");
});

test("a failed folder-command script retries while preserving its pending stylesheet", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureFolderCommandLoaded();
  const style = harness.resource("style");
  const script = harness.resource("script");
  script.onerror();
  await assert.rejects(failed, /目录选择和命令面板资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureFolderCommandLoaded();
  const retryScript = harness.resource("script");
  assert.notEqual(retryScript, script);
  assert.equal(harness.resources.length, 2);
  installImplementation(harness.context, []);
  style.onload();
  retryScript.onload();
  await retried;
  assert.equal(style.dataset.loaded, "true");
  assert.equal(retryScript.dataset.loaded, "true");
});

test("inspector context switching works before the folder-command implementation loads", () => {
  const harness = createHarness();
  harness.context.setInspectorContext("branch", "branches");
  assert.equal(harness.context.state.inspectorContext, "branch");
  assert.equal(harness.context.state.selectedTab, "branches");
  assert.equal(typeof harness.context.openFolderModal, "undefined");
});

function installImplementation(context, calls) {
  context.openFolderModal = async () => calls.push(["folder"]);
  context.closeFolderModal = () => calls.push(["close-folder"]);
  context.loadFolder = async (pathValue) => calls.push(["load", pathValue]);
  context.openSelectedFolder = async () => calls.push(["open"]);
  context.openCommandPalette = () => calls.push(["command"]);
  context.closeCommandPalette = () => calls.push(["close-command"]);
  context.renderCommandPalette = () => calls.push(["render"]);
  context.executeCommandPaletteItem = async (id) => calls.push(["execute", id]);
  context.handleCommandPaletteKeydown = () => calls.push(["keydown"]);
}

function createHarness() {
  const resources = [];
  const document = {
    querySelector: (selector) => {
      if (selector.includes("data-folder-command-style")) {
        return resources.find((element) => element.dataset.folderCommandStyle) || null;
      }
      if (selector.includes("data-folder-command-resource")) {
        return resources.find((element) => element.dataset.folderCommandResource) || null;
      }
      return null;
    },
    querySelectorAll: () => [],
    createElement: (tagName) => {
      const element = {
        tagName: String(tagName || "").toUpperCase(),
        dataset: {},
        remove() {
          const index = resources.indexOf(element);
          if (index >= 0) resources.splice(index, 1);
        },
      };
      return element;
    },
    head: {
      appendChild: (element) => resources.push(element),
    },
  };
  const context = vm.createContext({
    document,
    state: {
      inspectorContext: "commit",
      selectedTab: "details",
      selectedFile: "",
      fileHistory: {},
      fileBlame: {},
    },
    inspectorTabs: {
      commit: ["details", "files"],
      file: ["fileHistory", "fileBlame"],
      branch: ["branches", "sync", "compare"],
      more: ["stashes", "tags", "recovery", "logs", "settings"],
    },
    els: { inspector: null, moreInspectorSelect: null },
    repoDetailSectionForTab: () => "",
    loadRepoDetailSection: () => {},
    refreshSyncState: async () => {},
    openFileHistory: async () => {},
    openFileBlame: async () => {},
    renderInspector: () => {},
    toast: () => {},
    t: (value) => value,
  });
  context.window = context;
  vm.runInContext(loaderSource, context);
  return {
    context,
    resources,
    resource(type) {
      const key = type === "style" ? "folderCommandStyle" : "folderCommandResource";
      return resources.find((element) => element.dataset[key]);
    },
  };
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
