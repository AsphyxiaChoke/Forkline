"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menu-loader.js"), "utf8");
const implementationSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const contextMenuStylePath = path.join(root, "public", "context-menu.css");
const contextMenuStyles = fs.existsSync(contextMenuStylePath) ? fs.readFileSync(contextMenuStylePath, "utf8") : "";
const baseStyles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

test("context menu implementation and full styles stay out of startup behind a lightweight loader", () => {
  assert.match(indexHtml, /<script src="\.\/js\/features\/context-menu-loader\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/features\/context-menus\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /context-menu\.css/);
  assert.ok(
    indexHtml.indexOf("./js/features/context-menu-loader.js") < indexHtml.indexOf("./js/features/commit-actions-loader.js"),
    "the context menu loader should be ready before actions and event binding"
  );
  assert.match(loaderSource, /const contextMenuStyleResource = "\.\/context-menu\.css";/);
  assert.doesNotMatch(implementationSource, /async function selectCommit\(/);
  assert.doesNotMatch(implementationSource, /function positionContextMenu\(/);
  assert.doesNotMatch(implementationSource, /function hideCommitContextMenu\(/);
  assert.match(baseStyles, /\.context-menu\s*\{[^}]*display:\s*none;/s);
  assert.doesNotMatch(baseStyles, /#commitContextMenu|\.context-menu\.show|\.context-menu button|\.context-separator/);
  assert.match(contextMenuStyles, /#commitContextMenu\s*\{/);
  assert.match(contextMenuStyles, /\.context-menu\.show\s*\{/);
  assert.match(contextMenuStyles, /\.context-menu button\s*\{/);
  assert.match(contextMenuStyles, /\.context-separator\s*\{/);
});

test("all context menu entry points share one in-flight script and stylesheet load", async () => {
  const harness = createHarness();
  const calls = [];
  const first = harness.context.showCommitContextMenuLazy({ clientX: 10, clientY: 20 }, { sha: "abc" });
  const second = harness.context.showBranchContextMenuLazy({ clientX: 30, clientY: 40 }, "main", { local: true });

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style");
  const script = harness.resource("script");
  assert.equal(style.href, "./context-menu.css");
  assert.equal(script.src, "./js/features/context-menus.js");
  installContextMenuImplementation(harness.context, calls);
  script.onload();
  await flushPromises();
  assert.deepEqual(calls, []);

  style.onload();
  await Promise.all([first, second]);

  assert.equal(style.dataset.loaded, "true");
  assert.equal(script.dataset.loaded, "true");
  assert.deepEqual(calls.map((call) => call[0]), ["commit", "branch"]);
  await harness.context.showFileContextMenuLazy({ clientX: 50, clientY: 60 }, "src/main.c", "unstaged");
  await harness.context.showTagContextMenuLazy({ clientX: 70, clientY: 80 }, { name: "v-test" });
  await harness.context.showRemoteContextMenuLazy({ clientX: 90, clientY: 100 }, { name: "origin" });
  await harness.context.showReflogContextMenuLazy({ clientX: 110, clientY: 120 }, { sha: "def" });
  assert.equal(harness.resources.length, 2);
  assert.deepEqual(calls[2], ["file", "src/main.c", "unstaged"]);
  assert.deepEqual(calls.slice(3), [
    ["tag", "v-test"],
    ["remote", "origin"],
    ["reflog", "def"],
  ]);
});

test("a context menu waiting for resources is discarded after repository switch", async () => {
  const harness = createHarness();
  const calls = [];
  const opening = harness.context.showCommitContextMenuLazy({ clientX: 10, clientY: 20 }, { sha: "abc" });

  harness.context.state.data.repo.path = "C:/other-repo";
  const style = harness.resource("style");
  const script = harness.resource("script");
  installContextMenuImplementation(harness.context, calls);
  script.onload();
  style.onload();

  assert.equal(await opening, false);
  assert.deepEqual(calls, []);
});

test("a failed context menu stylesheet retries without reloading the completed script", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureContextMenusLoaded();
  const style = harness.resource("style");
  const script = harness.resource("script");
  installContextMenuImplementation(harness.context, []);
  script.onload();
  style.onerror();
  await assert.rejects(failed, /右键菜单资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureContextMenusLoaded();
  const retryStyle = harness.resource("style");
  assert.notEqual(retryStyle, style);
  assert.equal(harness.resources.length, 2);
  retryStyle.onload();
  await retried;
  assert.equal(script.dataset.loaded, "true");
  assert.equal(retryStyle.dataset.loaded, "true");
});

test("a failed context menu script retries while preserving its pending stylesheet", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureContextMenusLoaded();
  const style = harness.resource("style");
  const script = harness.resource("script");
  script.onerror();
  await assert.rejects(failed, /右键菜单资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureContextMenusLoaded();
  const retryScript = harness.resource("script");
  assert.notEqual(retryScript, script);
  installContextMenuImplementation(harness.context, []);
  retryScript.onload();
  style.onload();
  await retried;
  assert.equal(style.dataset.loaded, "true");
  assert.equal(retryScript.dataset.loaded, "true");
});

test("shared positioning and close helpers work before the menu implementation loads", () => {
  const harness = createHarness();
  const menu = harness.context.els.commitContextMenu;
  menu.offsetWidth = 240;
  menu.offsetHeight = 300;
  harness.context.positionContextMenu(menu, { clientX: 1200, clientY: 850 }, 220);
  assert.equal(menu.style.left, "1032px");
  assert.equal(menu.style.top, "592px");

  harness.context.state.contextCommitSha = "abc";
  menu.classList.add("show");
  harness.context.hideCommitContextMenu();
  assert.equal(menu.classList.contains("show"), false);
  assert.equal(menu.attributes.get("aria-hidden"), "true");
  assert.equal(harness.context.state.contextCommitSha, "");
});

function installContextMenuImplementation(context, calls) {
  context.showCommitContextMenu = (_event, commit) => calls.push(["commit", commit.sha]);
  context.showBranchContextMenu = (_event, branch) => calls.push(["branch", branch]);
  context.showFileContextMenu = (_event, file, scope) => calls.push(["file", file, scope]);
  context.showTagContextMenu = (_event, tag) => calls.push(["tag", tag?.name || ""]);
  context.showRemoteContextMenu = (_event, remote) => calls.push(["remote", remote?.name || ""]);
  context.showReflogContextMenu = (_event, entry) => calls.push(["reflog", entry?.sha || ""]);
  context.runFileContextAction = async () => {};
  context.runBranchContextAction = async () => {};
}

function createHarness() {
  const resources = [];
  const document = {
    querySelector: (selector) => {
      if (selector.includes("data-context-menu-style")) {
        return resources.find((element) => element.dataset.contextMenuStyle) || null;
      }
      if (selector.includes("data-context-menu-resource")) {
        return resources.find((element) => element.dataset.contextMenuResource) || null;
      }
      return null;
    },
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
  const menu = () => {
    const classes = new Set();
    const attributes = new Map();
    return {
      attributes,
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      setAttribute: (name, value) => attributes.set(name, value),
      style: {},
      offsetWidth: 0,
      offsetHeight: 0,
    };
  };
  const context = vm.createContext({
    document,
    state: {
      data: { repo: { path: "C:/repo" } },
      contextCommitSha: "",
      contextBranch: null,
      contextFile: null,
      contextTag: null,
      contextRemote: null,
      contextReflogEntry: null,
    },
    repoPathSnapshot: () => context.state.data.repo.path,
    isCurrentRepoPath: (repoPath) => context.state.data.repo.path === repoPath,
    els: {
      commitContextMenu: menu(),
      branchContextMenu: menu(),
      fileContextMenu: menu(),
      tagContextMenu: menu(),
      remoteContextMenu: menu(),
      reflogContextMenu: menu(),
    },
    clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum)),
    t: (value) => value,
  });
  context.window = context;
  context.window.innerWidth = 1280;
  context.window.innerHeight = 900;
  vm.runInContext(loaderSource, context);
  return {
    context,
    resources,
    resource(type) {
      if (type === "style") return resources.find((element) => element.dataset.contextMenuStyle);
      return resources.find((element) => element.dataset.contextMenuResource);
    },
  };
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
