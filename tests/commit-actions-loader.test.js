"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderPath = path.join(root, "public", "js", "features", "commit-actions-loader.js");
const loaderSource = fs.existsSync(loaderPath) ? fs.readFileSync(loaderPath, "utf8") : "";
const implementationSource = fs.readFileSync(path.join(root, "public", "js", "features", "commit-actions.js"), "utf8");
const inspectorSource = fs.readFileSync(path.join(root, "public", "js", "panels", "inspector.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

test("commit action implementation and history styles stay out of startup behind eager display helpers", () => {
  assert.match(indexHtml, /<script src="\.\/js\/features\/commit-actions-loader\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/features\/commit-actions\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /commit-actions\.css/);
  assert.match(loaderSource, /async function ensureCommitActionsLoaded\(\)/);
  assert.match(loaderSource, /const commitActionsStyleResource = "\.\/commit-actions\.css";/);
  assert.match(loaderSource, /function currentCompareBaseRef\(\)/);
  assert.match(loaderSource, /function historyRewriteConfig\(mode\)/);
  assert.match(loaderSource, /function historyQueueItemWithMode\(item, mode\)/);
  assert.match(loaderSource, /async function copyText\(text\)/);
  assert.match(loaderSource, /function commitRemoteUrl\(sha\)/);
  assert.match(loaderSource, /function renderHistoryRewritePlan\(commit\)/);
  assert.match(loaderSource, /function renderHistoryRewriteQueue\(\)/);
  assert.match(implementationSource, /globalThis\.ForklineCommitActions\s*=\s*\{/);
  assert.match(implementationSource, /function renderHistoryPlanCommit\(commit, targetSha\)/);
  assert.match(implementationSource, /function renderHistoryQueueItem\(item, index, detail\)/);
  assert.doesNotMatch(inspectorSource, /function renderHistoryRewritePlan\(commit\)/);
  assert.doesNotMatch(inspectorSource, /function renderHistoryRewriteQueue\(\)/);
});

test("commit action entry points share one in-flight script and stylesheet load", async () => {
  const harness = createHarness();
  const calls = [];
  const compare = harness.context.openCompareBranch("feature", "main");
  const action = harness.context.runCommitToolAction("copyPatch", "abc123");

  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style");
  const script = harness.resource("script");
  assert.equal(style.href, "./commit-actions.css");
  assert.equal(script.src, "./js/features/commit-actions.js");
  installImplementation(harness.context, calls);
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, []);

  style.onload();
  await Promise.all([compare, action]);

  assert.deepEqual(calls, [
    ["openCompareBranch", "feature", "main"],
    ["runCommitToolAction", "copyPatch", "abc123"],
  ]);
  await harness.context.runSyncPullRequestAction("copy");
  assert.equal(harness.resources.length, 2);
  assert.deepEqual(calls[2], ["runSyncPullRequestAction", "copy"]);
});

test("a commit action waiting for its resources is discarded after repository switch", async () => {
  const harness = createHarness();
  const calls = [];
  const action = harness.context.runCommitToolAction("resetSoft", "abc123");

  harness.context.state.data.repo.path = "C:/other-repo";
  const style = harness.resource("style");
  const script = harness.resource("script");
  installImplementation(harness.context, calls);
  script.onload();
  style.onload();

  assert.equal(await action, false);
  assert.deepEqual(calls, []);
});

test("a failed commit action stylesheet retries without reloading its completed script", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureCommitActionsLoaded();
  const style = harness.resource("style");
  const script = harness.resource("script");
  installImplementation(harness.context, []);
  script.onload();
  style.onerror();
  await assert.rejects(failed, /提交操作资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureCommitActionsLoaded();
  const retryStyle = harness.resource("style");
  assert.notEqual(retryStyle, style);
  assert.equal(harness.resources.length, 2);
  retryStyle.onload();
  await retried;
  assert.equal(script.dataset.loaded, "true");
  assert.equal(retryStyle.dataset.loaded, "true");
});

test("a failed commit action script retries while preserving its pending stylesheet", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureCommitActionsLoaded();
  const style = harness.resource("style");
  const script = harness.resource("script");
  script.onerror();
  await assert.rejects(failed, /提交操作资源加载失败/);
  assert.equal(harness.resources.length, 1);

  const retried = harness.context.ensureCommitActionsLoaded();
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

test("display, clipboard, remote URL, and modal close helpers work before implementation load", async () => {
  const harness = createHarness();
  const { context } = harness;

  assert.equal(context.currentCompareBaseRef(), "main");
  assert.equal(context.historyRewriteConfig("fixup").command, "git rebase -i / fixup");
  assert.deepEqual(JSON.parse(JSON.stringify(context.historyQueueItemWithMode({ sha: "abc", message: "summary\n\nbody" }, "reword"))), {
    sha: "abc",
    message: "summary\n\nbody",
    mode: "reword",
    summary: "summary",
    body: "body",
  });
  assert.equal(context.commitRemoteUrl("abc123"), "https://github.com/example/repo/commit/abc123");
  await context.copyText("copied");
  assert.equal(harness.clipboard[0], "copied");

  context.state.mainlineAction = "revert";
  context.state.mainlineCommitSha = "abc123";
  context.els.mainlineModal.classList.add("show");
  context.closeMainlineModal();
  assert.equal(context.els.mainlineModal.classList.contains("show"), false);
  assert.equal(context.state.mainlineAction, "");

  context.state.tagTargetSha = "abc123";
  context.els.tagModal.classList.add("show");
  context.closeTagModal();
  assert.equal(context.els.tagModal.classList.contains("show"), false);
  assert.equal(context.state.tagTargetSha, "");
  assert.match(context.renderHistoryRewriteQueue(), /队列为空/);
  assert.equal(harness.resources.length, 0);
});

test("existing history edit state requests the lazy renderer and rerenders after load", async () => {
  const harness = createHarness();
  harness.context.state.historyPlan = { sha: "abc123", mode: "squash", loading: true };
  const placeholder = harness.context.renderHistoryRewritePlan({ sha: "abc123" });

  assert.match(placeholder, /正在载入历史编辑界面/);
  assert.equal(harness.resources.length, 2);
  const style = harness.resource("style");
  const script = harness.resource("script");
  installImplementation(harness.context, []);
  script.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.renderCount(), 0);
  assert.match(harness.context.renderHistoryRewritePlan({ sha: "abc123" }), /正在载入历史编辑界面/);

  style.onload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.renderCount(), 1);
});

function createHarness() {
  assert.ok(loaderSource, "commit action loader source should exist");
  const resources = [];
  const clipboard = [];
  let renders = 0;
  const classes = () => {
    const values = new Set();
    return {
      add: (name) => values.add(name),
      remove: (name) => values.delete(name),
      contains: (name) => values.has(name),
    };
  };
  const modal = () => ({ classList: classes(), setAttribute() {} });
  const document = {
    querySelector: (selector) => {
      if (selector.includes("data-commit-actions-style")) {
        return resources.find((element) => element.dataset.commitActionsStyle) || null;
      }
      if (selector.includes("data-commit-actions-resource")) {
        return resources.find((element) => element.dataset.commitActionsResource) || null;
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
    head: { appendChild: (element) => resources.push(element) },
    body: { classList: classes() },
  };
  const state = {
    data: {
      repo: { branch: "main", path: "C:/repo" },
      sync: { remotes: [{ name: "origin", fetchUrl: "git@github.com:example/repo.git", pushUrl: "" }] },
    },
    commitDetails: new Map(),
    mainlineAction: "",
    mainlineCommitSha: "",
    tagTargetSha: "",
  };
  const context = vm.createContext({
    URL,
    document,
    navigator: { clipboard: { writeText: async (value) => clipboard.push(value) } },
    state,
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => state.data.repo.path === repoPath,
    renderInspector: () => {
      renders += 1;
    },
    commitMessageParts: (item) => {
      const [summary = "", ...body] = String(item?.message || "").split(/\r?\n/);
      return { summary, body: body.join("\n").trim() };
    },
    t: (value) => value,
    els: {
      mainlineModal: modal(),
      mainlineOptions: { innerHTML: "" },
      tagModal: modal(),
    },
  });
  context.window = context;
  vm.runInContext(loaderSource, context);
  return {
    context,
    resources,
    clipboard,
    renderCount: () => renders,
    resource(type) {
      const key = type === "style" ? "commitActionsStyle" : "commitActionsResource";
      return resources.find((element) => element.dataset[key]);
    },
  };
}

function installImplementation(context, calls) {
  const method = (name) => async (...args) => calls.push([name, ...args]);
  context.ForklineCommitActions = {
    openCompareBranch: method("openCompareBranch"),
    refreshCompare: method("refreshCompare"),
    runCommitContextAction: method("runCommitContextAction"),
    runCommitToolAction: method("runCommitToolAction"),
    updateHistoryQueueField: method("updateHistoryQueueField"),
    runHistoryRewriteQueue: method("runHistoryRewriteQueue"),
    runHistoryRewritePlan: method("runHistoryRewritePlan"),
    reloadAfterHistoryAction: method("reloadAfterHistoryAction"),
    openRemoteCommit: method("openRemoteCommit"),
    copyCommitPatch: method("copyCommitPatch"),
    downloadCommitPatch: method("downloadCommitPatch"),
    runSyncPullRequestAction: method("runSyncPullRequestAction"),
    openTagModal: method("openTagModal"),
    createTagFromForm: method("createTagFromForm"),
    submitMainlineForm: method("submitMainlineForm"),
    renderHistoryRewritePlan: () => "plan",
    renderHistoryRewriteQueue: () => "queue",
  };
}
