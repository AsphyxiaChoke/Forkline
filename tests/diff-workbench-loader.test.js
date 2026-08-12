"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderPath = path.join(root, "public", "js", "features", "diff-workbench-loader.js");
const loaderSource = fs.existsSync(loaderPath) ? fs.readFileSync(loaderPath, "utf8") : "";
const implementationSource = fs.readFileSync(path.join(root, "public", "js", "features", "diff-workbench.js"), "utf8");
const selectionSource = fs.readFileSync(path.join(root, "public", "js", "features", "diff-selection.js"), "utf8");
const workbenchStylePath = path.join(root, "public", "diff-workbench.css");
const workbenchStyles = fs.existsSync(workbenchStylePath) ? fs.readFileSync(workbenchStylePath, "utf8") : "";
const baseStyles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

test("diff workbench implementation and full styles stay out of startup behind a lightweight loader", () => {
  assert.match(indexHtml, /<script src="\.\/js\/features\/diff-workbench-loader\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/features\/diff-workbench\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/features\/diff-selection\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /diff-workbench\.css/);
  assert.ok(
    indexHtml.indexOf("./js/features/diff-workbench-loader.js") < indexHtml.indexOf("./js/features/file-tree.js"),
    "the diff loader should be ready before file-tree rendering"
  );
  assert.match(loaderSource, /async function ensureDiffWorkbenchLoaded\(\)/);
  assert.match(loaderSource, /const diffWorkbenchStyleResource = "\.\/diff-workbench\.css";/);
  assert.match(loaderSource, /function renderWorkDiffEmpty\(message\)/);
  assert.match(loaderSource, /function setActiveDiff\(payload\)/);
  assert.match(loaderSource, /function selectedWorkingFileInfo\(filePath = state\.selectedFile/);
  assert.match(loaderSource, /function normalizeWorkDiffScopeChoice\(scope, fileInfo\)/);
  assert.match(loaderSource, /function closeDiffModal\(\)/);
  assert.match(implementationSource, /async function loadWorkingDiff\(filePath\)/);
  assert.match(selectionSource, /async function runWorkDiffLineAction\(button\)/);
  assert.doesNotMatch(implementationSource, /function setActiveDiff\(payload\)/);
  assert.doesNotMatch(implementationSource, /function selectedWorkingFileInfo\(/);
  assert.match(eventsSource, /openDiffModalLazy\(\)/);
  assert.match(eventsSource, /runWorkDiffLineActionLazy\(lineButton\)/);
  assert.match(eventsSource, /runWorkDiffHunkActionLazy\(button\.dataset\.hunkAction, button\)/);
  assert.match(baseStyles, /\.diff-modal\s*\{[^}]*display:\s*none;/s);
  assert.doesNotMatch(baseStyles, /\.diff-modal-head|\.work-diff-feedback|\.diff-line-toolbar|\.hunk-actions|\.diff-line-selectable/);
  assert.match(workbenchStyles, /\.diff-modal-head\s*\{/);
  assert.match(workbenchStyles, /\.work-diff-feedback\s*\{/);
  assert.match(workbenchStyles, /\.diff-line-toolbar\s*\{/);
  assert.match(workbenchStyles, /\.hunk-actions\s*\{/);
  assert.match(workbenchStyles, /\.side-row\.diff-line-selectable\s*\{/);
});

test("diff entry points share one ordered script chain and stylesheet load", async () => {
  const harness = createHarness();
  const calls = [];
  const diff = harness.context.loadWorkingDiffLazy("src/main.c");
  const modal = harness.context.openDiffModalLazy();

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style");
  const selection = harness.resource("selection");
  assert.equal(style.href, "./diff-workbench.css");
  assert.equal(selection.src, "./js/features/diff-selection.js");
  installSelection(harness.context, calls);
  selection.onload();
  await flushPromises();

  assert.equal(harness.resources.length, 3);
  const workbench = harness.resource("workbench");
  assert.equal(workbench.src, "./js/features/diff-workbench.js");
  installWorkbench(harness.context, calls);
  workbench.onload();
  await flushPromises();
  assert.deepEqual(calls, []);

  style.onload();
  await Promise.all([diff, modal]);

  assert.deepEqual(calls.slice(0, 2), [["load", "src/main.c"], ["open"]]);
  await harness.context.runWorkDiffLineActionLazy({ id: "line" });
  await harness.context.runWorkDiffHunkActionLazy("stageHunk", { id: "hunk" });
  assert.equal(harness.resources.length, 3);
  assert.deepEqual(calls.slice(2), [["line", "line"], ["hunk", "stageHunk", "hunk"]]);
});

test("a Diff load waiting for resources is discarded after repository switch", async () => {
  const harness = createHarness();
  const calls = [];
  const loading = harness.context.loadWorkingDiffLazy("src/main.c");

  harness.context.state.data.repo.path = "C:/other-repo";
  const style = harness.resource("style");
  const selection = harness.resource("selection");
  installSelection(harness.context, calls);
  selection.onload();
  await flushPromises();
  const workbench = harness.resource("workbench");
  installWorkbench(harness.context, calls);
  workbench.onload();
  style.onload();

  assert.equal(await loading, false);
  assert.deepEqual(calls, []);
});

test("a failed diff workbench stylesheet retries without reloading completed scripts", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureDiffWorkbenchLoaded();
  const style = harness.resource("style");
  const selection = harness.resource("selection");
  installSelection(harness.context, []);
  selection.onload();
  await flushPromises();
  const workbench = harness.resource("workbench");
  installWorkbench(harness.context, []);
  workbench.onload();
  style.onerror();
  await assert.rejects(failed, /Diff 工作台资源加载失败/);
  assert.equal(harness.resources.length, 2);

  const retried = harness.context.ensureDiffWorkbenchLoaded();
  const retryStyle = harness.resource("style");
  assert.notEqual(retryStyle, style);
  assert.equal(harness.resources.length, 3);
  retryStyle.onload();
  await retried;
  assert.equal(selection.dataset.loaded, "true");
  assert.equal(workbench.dataset.loaded, "true");
  assert.equal(retryStyle.dataset.loaded, "true");
});

test("a failed diff workbench script retries while preserving its pending stylesheet", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureDiffWorkbenchLoaded();
  const style = harness.resource("style");
  const selection = harness.resource("selection");
  selection.onerror();
  await assert.rejects(failed, /Diff 工作台资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureDiffWorkbenchLoaded();
  const retrySelection = harness.resource("selection");
  assert.notEqual(retrySelection, selection);
  installSelection(harness.context, []);
  retrySelection.onload();
  await flushPromises();
  const workbench = harness.resource("workbench");
  installWorkbench(harness.context, []);
  workbench.onload();
  style.onload();
  await retried;
  assert.equal(style.dataset.loaded, "true");
  assert.equal(retrySelection.dataset.loaded, "true");
  assert.equal(workbench.dataset.loaded, "true");
});

test("diff state cleanup works before the implementation loads", () => {
  const harness = createHarness();
  harness.context.state.selectedDiffLines.add("0:1");
  harness.context.state.lastDiffLineKey = "0:1";
  harness.context.setActiveDiff({ source: "worktree", path: "src/main.c", diff: [{ type: "add" }] });
  assert.equal(harness.context.els.maximizeDiff.disabled, false);

  harness.context.renderWorkDiffEmpty("未选择文件");
  assert.equal(harness.context.state.activeDiff, null);
  assert.equal(harness.context.state.selectedDiffLines.size, 0);
  assert.equal(harness.context.state.lastDiffLineKey, "");
  assert.equal(harness.context.els.workDiffView.textContent, "未选择文件");

  harness.context.els.diffModal.classList.add("show");
  harness.context.closeDiffModal();
  assert.equal(harness.context.els.diffModal.classList.contains("show"), false);
  assert.equal(harness.context.els.diffModalBody.replaced, true);
  assert.equal(typeof harness.context.loadWorkingDiff, "undefined");
});

function installSelection(context, calls) {
  context.runWorkDiffLineAction = async (button) => calls.push(["line", button?.id || ""]);
  context.handleDiffLineSelection = () => calls.push(["select"]);
}

function installWorkbench(context, calls) {
  context.loadWorkingDiff = async (file) => calls.push(["load", file]);
  context.openDiffModal = () => calls.push(["open"]);
  context.runWorkDiffHunkAction = async (action, button) => calls.push(["hunk", action, button?.id || ""]);
}

function createHarness() {
  assert.ok(loaderSource, "diff workbench loader source should exist");
  const resources = [];
  const classes = () => {
    const values = new Set();
    return {
      add: (name) => values.add(name),
      remove: (name) => values.delete(name),
      contains: (name) => values.has(name),
    };
  };
  const document = {
    body: { classList: classes() },
    querySelector: (selector) => {
      if (selector.includes("data-diff-workbench-style")) {
        return resources.find((element) => element.dataset.diffWorkbenchStyle) || null;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector.includes("data-diff-workbench-resource")) {
        return resources.filter((element) => element.dataset.diffWorkbenchResource);
      }
      return resources;
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
    head: { appendChild: (element) => resources.push(element) },
  };
  const textNode = () => ({ textContent: "", className: "" });
  const diffModalBody = {
    replaced: false,
    replaceChildren() {
      this.replaced = true;
    },
  };
  const context = vm.createContext({
    document,
    t: (value) => value,
    state: {
      activeDiff: null,
      data: { repo: { isSample: false, path: "C:/repo" } },
      diffModalRenderLimit: 0,
      lastDiffLineKey: "",
      selectedDiffLines: new Set(),
    },
    repoPathSnapshot: () => context.state.data.repo.path,
    isCurrentRepoPath: (repoPath) => context.state.data.repo.path === repoPath,
    els: {
      diffModal: { classList: classes(), setAttribute() {} },
      diffModalBody,
      editWorktreeFile: { disabled: true },
      maximizeDiff: { disabled: true },
      workDiffPath: textNode(),
      workDiffTitle: textNode(),
      workDiffView: textNode(),
    },
    SIDE_DIFF_INITIAL_RENDER_LINES: 1000,
  });
  context.window = context;
  vm.runInContext(loaderSource, context);
  return {
    context,
    resources,
    resource(type) {
      if (type === "style") {
        return resources.find((element) => element.dataset.diffWorkbenchStyle);
      }
      const resource = type === "selection"
        ? "./js/features/diff-selection.js"
        : "./js/features/diff-workbench.js";
      return resources.find((element) => element.dataset.diffWorkbenchResource === resource);
    },
  };
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
