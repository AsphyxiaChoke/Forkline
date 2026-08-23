"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const source = fs.readFileSync(path.join(root, "public", "js", "panels", "inspector-panel-loader.js"), "utf8");
const tagsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "tags.js"), "utf8");
const workspacesSource = fs.readFileSync(path.join(root, "public", "js", "panels", "workspaces.js"), "utf8");
const recoverySource = fs.readFileSync(path.join(root, "public", "js", "panels", "recovery.js"), "utf8");
const fileInsightsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "file-insights.js"), "utf8");
const authSource = fs.readFileSync(path.join(root, "public", "js", "panels", "auth.js"), "utf8");
const compareSource = fs.readFileSync(path.join(root, "public", "js", "panels", "compare.js"), "utf8");
const logsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "logs.js"), "utf8");

test("secondary inspector panels share one in-flight resource load", async () => {
  const harness = createHarness();
  const first = harness.context.ensureInspectorPanelLoaded("settings");
  const second = harness.context.ensureInspectorPanelLoaded("settings");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "settings");
  const script = harness.resource("script", "settings");
  assert.equal(style.href, "./settings.css");
  assert.equal(script.src, "./js/panels/settings.js");
  harness.context.window.renderSettingsTab = () => {};
  style.onload();
  script.onload();
  await Promise.all([first, second]);

  assert.equal(style.dataset.loaded, "true");
  assert.equal(script.dataset.loaded, "true");
  await harness.context.ensureInspectorPanelLoaded("settings");
  assert.equal(harness.resources.length, 2);
});

test("a failed settings stylesheet retries without reloading its completed script", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureInspectorPanelLoaded("settings");
  const style = harness.resource("style", "settings");
  const script = harness.resource("script", "settings");
  harness.context.window.renderSettingsTab = () => {};
  script.onload();
  style.onerror();
  await assert.rejects(failed, /设置资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureInspectorPanelLoaded("settings");
  const retryStyle = harness.resource("style", "settings");
  assert.notEqual(retryStyle, style);
  assert.equal(harness.resources.length, 2);
  retryStyle.onload();
  await retried;
  assert.equal(script.dataset.loaded, "true");
  assert.equal(retryStyle.dataset.loaded, "true");
});

test("a failed secondary panel script retries while preserving its pending stylesheet", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureInspectorPanelLoaded("stashes");
  const style = harness.resource("style", "repositoryPanels");
  const script = harness.resource("script", "stashes");
  assert.equal(style.href, "./repository-panels.css");
  script.onerror();
  await assert.rejects(failed, /储藏列表资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureInspectorPanelLoaded("stashes");
  assert.equal(harness.resources.length, 2);
  const retryScript = harness.resource("script", "stashes");
  assert.notEqual(retryScript, script);
  harness.context.window.renderStashesTab = () => {};
  style.onload();
  retryScript.onload();
  await retried;
  assert.equal(style.dataset.loaded, "true");
  assert.equal(retryScript.dataset.loaded, "true");
});

test("the tag panel loads on demand before exposing tag actions", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "tags";
  harness.context.renderInspectorPanelLazy("tags");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "repositoryPanels");
  const script = harness.resource("script", "tags");
  assert.equal(style.href, "./repository-panels.css");
  assert.equal(script.src, "./js/panels/tags.js");
  assert.equal(typeof harness.context.window.runTagAction, "undefined");

  let rendered = 0;
  vm.runInContext(tagsSource, harness.context);
  harness.context.window.renderTagsTab = () => {
    rendered += 1;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, 0);
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(rendered, 1);
  assert.equal(typeof harness.context.window.runTagAction, "function");

  let copied = "";
  harness.context.state.data = { tags: [{ name: "v-test" }] };
  harness.context.copyText = async (value) => {
    copied = value;
  };
  harness.context.toast = () => {};
  await harness.context.window.runTagAction("copy", "v-test");
  assert.equal(copied, "v-test");
});

test("repository panels share one in-flight stylesheet across rapid tab switches", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "stashes";
  harness.context.renderInspectorPanelLazy("stashes");
  const style = harness.resource("style", "repositoryPanels");
  const stashScript = harness.resource("script", "stashes");

  harness.context.state.selectedTab = "tags";
  harness.context.renderInspectorPanelLazy("tags");
  const tagScript = harness.resource("script", "tags");
  assert.equal(harness.resources.length, 3);
  assert.equal(harness.resources.filter((element) => element.dataset.inspectorPanelStyle === "repositoryPanels").length, 1);

  let stashRenders = 0;
  let tagRenders = 0;
  harness.context.window.renderStashesTab = () => {
    stashRenders += 1;
  };
  harness.context.window.renderTagsTab = () => {
    tagRenders += 1;
  };
  stashScript.onload();
  tagScript.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stashRenders, 0);
  assert.equal(tagRenders, 0);

  style.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stashRenders, 0);
  assert.equal(tagRenders, 1);

  harness.context.state.selectedTab = "stashes";
  harness.context.renderInspectorPanelLazy("stashes");
  assert.equal(stashRenders, 1);
  assert.equal(harness.resources.length, 3);
});

test("workspace tabs share one lazy module and render the tab selected during loading", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "branches";
  harness.context.renderInspectorPanelLazy("workspaces");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "workspaces");
  const script = harness.resource("script", "workspaces");
  assert.equal(style.href, "./workspaces.css");
  assert.equal(script.src, "./js/panels/workspaces.js");
  assert.equal(typeof harness.context.window.renderWorkspaceTab, "undefined");

  harness.context.state.selectedTab = "worktrees";
  vm.runInContext(workspacesSource, harness.context);
  let renderedTab = "";
  harness.context.window.renderWorkspaceTab = () => {
    renderedTab = harness.context.state.selectedTab;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renderedTab, "");
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(renderedTab, "worktrees");
  assert.equal(typeof harness.context.window.runBranchCleanupAction, "function");
  assert.equal(typeof harness.context.window.runWorktreeAction, "function");
  assert.equal(typeof harness.context.window.runSubmoduleAction, "function");
  await harness.context.ensureInspectorPanelLoaded("workspaces");
  assert.equal(harness.resources.length, 2);
});

test("workspace renderer does not depend on the compare panel lazy module", () => {
  assert.match(coreSource, /function repositoryRefOptions\(extraRefs = \[\]\)/);
  assert.doesNotMatch(workspacesSource, /\bcompareRefOptions\b/);
  const context = vm.createContext({
    state: {
      selectedRef: "main",
      data: {
        repo: { branch: "main", name: "repo", path: "C:\\repo" },
        branches: [],
        remotes: [],
        tags: [],
      },
    },
    repositoryRefOptions: () => [{ ref: "main", label: "当前分支" }],
    repoParentPath: () => "C:\\",
    joinLocalPath: (...parts) => parts.join("\\"),
    escapeAttr: (value) => String(value || ""),
    t: (value) => value,
    tt(strings, ...values) {
      return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
    },
  });

  vm.runInContext(workspacesSource, context);
  assert.doesNotThrow(() => context.worktreeCreateHtml(true));
  assert.match(context.worktreeCreateHtml(true), /worktreeRefOptions/);
});

test("opening a worktree reuses the guarded repository switch flow", async () => {
  const opened = [];
  const context = vm.createContext({
    state: { data: { repo: { path: "C:\\repo" } } },
    openRepo: async (repoPath) => {
      opened.push(repoPath);
      return true;
    },
    api: async () => {
      throw new Error("unguarded worktree API path used");
    },
    toast: () => {},
    t: (value) => value,
  });
  const button = { disabled: false };

  vm.runInContext(workspacesSource, context);
  await context.openWorktreePath("C:\\repo-feature", button);

  assert.deepEqual(opened, ["C:\\repo-feature"]);
  assert.equal(button.disabled, false);
});

test("the recovery dashboard loads on demand while recovery actions stay inside its module", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "recovery";
  harness.context.renderInspectorPanelLazy("recovery");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "repositoryPanels");
  const script = harness.resource("script", "recovery");
  assert.equal(style.href, "./repository-panels.css");
  assert.equal(script.src, "./js/panels/recovery.js");
  assert.equal(typeof harness.context.window.renderRecoveryTab, "undefined");

  vm.runInContext(recoverySource, harness.context);
  let rendered = 0;
  harness.context.window.renderRecoveryTab = () => {
    rendered += 1;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, 0);
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(rendered, 1);
  assert.equal(typeof harness.context.window.loadReflogEntries, "function");
  assert.equal(typeof harness.context.window.runRecoveryAction, "function");
  assert.equal(typeof harness.context.window.runReflogAction, "function");
});

test("file history and blame share one lazy inspector module", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "fileHistory";
  harness.context.renderInspectorPanelLazy("fileInsights");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "fileInsights");
  const script = harness.resource("script", "fileInsights");
  assert.equal(style.href, "./file-insights.css");
  assert.equal(script.src, "./js/panels/file-insights.js");
  assert.equal(typeof harness.context.window.renderFileInsightsTab, "undefined");

  vm.runInContext(fileInsightsSource, harness.context);
  let renderedTab = "";
  harness.context.window.renderFileInsightsTab = () => {
    renderedTab = harness.context.state.selectedTab;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renderedTab, "");
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(renderedTab, "fileHistory");
  assert.equal(typeof harness.context.window.loadFileHistoryPanel, "function");
  assert.equal(typeof harness.context.window.loadFileBlamePanel, "function");
  assert.equal(typeof harness.context.window.runFileHistoryAction, "function");
  assert.equal(typeof harness.context.window.runFileBlameAction, "function");

  harness.context.state.selectedTab = "fileBlame";
  harness.context.renderInspectorPanelLazy("fileInsights");
  assert.equal(harness.resources.length, 2);
  assert.equal(renderedTab, "fileBlame");
});

test("sync authentication helpers load only when the sync inspector opens", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "sync";
  let rendered = 0;
  harness.context.renderInspectorPanelLazy("sync");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "repositoryPanels");
  const script = harness.resource("script", "sync");
  assert.equal(style.href, "./repository-panels.css");
  assert.equal(script.src, "./js/panels/auth.js");
  assert.equal(typeof harness.context.window.renderSyncTab, "undefined");
  assert.equal(typeof harness.context.window.loadAuthDiagnostics, "undefined");

  vm.runInContext(authSource, harness.context);
  harness.context.renderSyncTab = () => {
    rendered += 1;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, 0);
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(rendered, 1);
  assert.equal(typeof harness.context.window.renderSyncTab, "function");
  assert.equal(typeof harness.context.window.loadAuthDiagnostics, "function");
  assert.equal(typeof harness.context.window.openSystemCredentialManagerFromSync, "function");

  harness.context.renderInspectorPanelLazy("sync");
  assert.equal(harness.resources.length, 2);
  assert.equal(rendered, 2);
});

test("the comparison panel loads on demand and exposes its page actions", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "compare";
  let rendered = 0;
  harness.context.renderInspectorPanelLazy("compare");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "repositoryPanels");
  const script = harness.resource("script", "compare");
  assert.equal(style.href, "./repository-panels.css");
  assert.equal(script.src, "./js/panels/compare.js");
  assert.equal(typeof harness.context.window.renderCompareTab, "undefined");

  vm.runInContext(compareSource, harness.context);
  harness.context.renderCompareTab = () => {
    rendered += 1;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, 0);
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(rendered, 1);
  assert.equal(typeof harness.context.window.renderCompareTab, "function");
  assert.equal(typeof harness.context.window.runCompareFromPicker, "function");
  assert.equal(typeof harness.context.window.swapCompareRefs, "function");

  harness.context.renderInspectorPanelLazy("compare");
  assert.equal(harness.resources.length, 2);
  assert.equal(rendered, 2);
});

test("the operation log panel loads on demand after cancellation stays eager", async () => {
  const harness = createHarness();
  harness.context.state.selectedTab = "logs";
  let rendered = 0;
  harness.context.renderInspectorPanelLazy("logs");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style", "logs");
  const script = harness.resource("script", "logs");
  assert.equal(style.href, "./logs.css");
  assert.equal(script.src, "./js/panels/logs.js");
  assert.equal(typeof harness.context.window.renderLogsTab, "undefined");

  vm.runInContext(logsSource, harness.context);
  harness.context.renderLogsTab = () => {
    rendered += 1;
  };
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rendered, 0);
  style.onload();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(rendered, 1);
  assert.equal(typeof harness.context.window.renderLogsTab, "function");
  assert.equal(typeof harness.context.window.refreshLogsTab, "function");
  assert.equal(typeof harness.context.window.cancelRunningOperation, "undefined");

  harness.context.renderInspectorPanelLazy("logs");
  assert.equal(harness.resources.length, 2);
  assert.equal(rendered, 2);
});

function createHarness() {
  const resources = [];
  const document = {
    querySelectorAll: (selector) => resources.filter((element) => {
      if (selector.includes("data-inspector-panel-style")) return Boolean(element.dataset.inspectorPanelStyle);
      if (selector.includes("data-inspector-panel-resource")) return Boolean(element.dataset.inspectorPanelResource);
      return true;
    }),
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
    state: { selectedTab: "details" },
    els: {
      detailTitle: { textContent: "" },
      detailSub: { textContent: "" },
      detailNode: { style: {} },
      detailBody: { innerHTML: "" },
    },
    setActiveDiff: () => {},
    escapeHtml: (value) => String(value || ""),
    escapeAttr: (value) => String(value || ""),
    t: (value, values = {}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? ""),
  });
  context.window = context;
  vm.runInContext(source, context);
  return {
    context,
    resources,
    resource(type, panel) {
      const key = type === "style" ? "inspectorPanelStyle" : "inspectorPanelResource";
      return resources.find((element) => element.dataset[key] === panel);
    },
  };
}
