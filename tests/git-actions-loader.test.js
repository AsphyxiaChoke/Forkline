"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const loaderPath = path.join(root, "public", "js", "features", "git-actions-loader.js");
const loaderSource = fs.existsSync(loaderPath) ? fs.readFileSync(loaderPath, "utf8") : "";
const implementationSource = fs.readFileSync(path.join(root, "public", "js", "features", "git-actions.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

test("Git action implementation stays out of startup behind an eager state facade", () => {
  assert.match(indexHtml, /<script src="\.\/js\/features\/git-actions-loader\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/features\/git-actions\.js"><\/script>/);
  assert.match(loaderSource, /async function ensureGitActionsLoaded\(\)/);
  assert.match(loaderSource, /function currentBranchSnapshotPayload\(\)/);
  assert.match(loaderSource, /async function maybeRestoreCheckoutStash\(branch\)/);
  assert.match(loaderSource, /function updateAmendMode\(\)/);
  assert.match(loaderSource, /function countFiles\(files\)/);
  assert.match(implementationSource, /globalThis\.ForklineGitActions\s*=\s*\{/);
});

test("Git action entry points share one in-flight implementation load", async () => {
  const harness = createHarness();
  const calls = [];
  const select = harness.context.selectRef("feature");
  const action = harness.context.runAction("fetch");

  assert.equal(harness.resources.length, 1);
  assert.equal(harness.resources[0].src, "./js/features/git-actions.js");
  installImplementation(harness.context, calls);
  harness.resources[0].onload();
  await Promise.all([select, action]);

  assert.deepEqual(calls, [["selectRef", "feature"], ["runAction", "fetch"]]);
  await harness.context.checkoutBranch("main", { id: "checkout" });
  assert.equal(harness.resources.length, 1);
  assert.deepEqual(calls[2], ["checkoutBranch", "main", "checkout"]);
});

test("a Git action waiting for its implementation is discarded after repository switch", async () => {
  const harness = createHarness();
  const calls = [];
  const action = harness.context.runAction("stageAll");

  harness.context.state.data.repo.path = "C:/other-repo";
  installImplementation(harness.context, calls);
  harness.resources[0].onload();

  assert.equal(await action, false);
  assert.deepEqual(calls, []);
});

test("a failed Git action implementation is removed and can retry", async () => {
  const harness = createHarness();
  const failed = harness.context.ensureGitActionsLoaded();
  harness.resources[0].onerror();
  await assert.rejects(failed, /Git 操作资源加载失败/);
  assert.equal(harness.resources.length, 0);

  const retried = harness.context.ensureGitActionsLoaded();
  installImplementation(harness.context, []);
  harness.resources[0].onload();
  await retried;
  assert.equal(harness.resources.length, 1);
  assert.equal(harness.resources[0].dataset.loaded, "true");
});

test("startup helpers work without loading the Git action implementation", async () => {
  const harness = createHarness();
  const { context } = harness;

  assert.deepEqual(JSON.parse(JSON.stringify(context.countFiles([
    { state: "M" },
    { state: "M" },
    { state: "A" },
  ]))), { M: 2, A: 1, D: 0, R: 0, C: 0 });
  assert.equal(context.findRemote("origin").fetchUrl, "https://example.invalid/repo.git");
  assert.equal(context.currentBranchSnapshotPayload().expectedDefaultRemote, "origin");
  context.updateAmendMode();
  assert.equal(context.els.commitSubmit.textContent, "创建提交");
  await context.maybeRestoreCheckoutStash("main");
  assert.equal(harness.resources.length, 0);
});

function createHarness() {
  assert.ok(loaderSource, "Git action loader source should exist");
  const resources = [];
  const document = {
    querySelector: () => resources[0] || null,
    createElement: () => {
      const element = {
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
  const state = {
    data: {
      repo: { isSample: true, branch: "main", headSha: "", operation: null, path: "C:/repo" },
      sync: {
        unborn: true,
        upstream: "",
        upstreamSha: "",
        remotes: [{ name: "origin", fetchUrl: "https://example.invalid/repo.git", pushUrl: "", pushUrls: [] }],
      },
      commits: [],
    },
    selectedChanges: new Set(),
  };
  const context = vm.createContext({
    document,
    state,
    localStorage: { getItem: () => "[]", setItem() {} },
    api: async () => ({ stash: null }),
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => state.data.repo.path === repoPath,
    loadStateForRepoPath: async () => state.data,
    renderAll() {},
    toast() {},
    t: (value) => value,
    splitRemoteBranchRef: (value) => ({ remote: String(value || "").split("/")[0] }),
    worktreeSnapshotPayload: () => ({ expectedWorktreeSnapshot: "snapshot" }),
    els: {
      amendToggle: { checked: false, disabled: false, title: "" },
      commitSubmit: { textContent: "", title: "" },
    },
  });
  context.window = context;
  vm.runInContext(loaderSource, context);
  return { context, resources };
}

function installImplementation(context, calls) {
  const method = (name) => async (...args) => calls.push([name, ...args.map((value) => value?.id || value)]);
  context.ForklineGitActions = {
    selectRef: method("selectRef"),
    checkoutBranch: method("checkoutBranch"),
    checkoutRemoteBranch: method("checkoutRemoteBranch"),
    mergeBranchRef: method("mergeBranchRef"),
    rebaseOntoRef: method("rebaseOntoRef"),
    runAction: method("runAction"),
    runRepoOperation: method("runRepoOperation"),
    fillLatestCommitMessage: method("fillLatestCommitMessage"),
    runUpstreamAction: method("runUpstreamAction"),
    runRemoteAction: method("runRemoteAction"),
    runRemoteMenuAction: method("runRemoteMenuAction"),
    createStashFromSelection: method("createStashFromSelection"),
    ignoreWorktreePath: method("ignoreWorktreePath"),
    runSingleFileAction: method("runSingleFileAction"),
    runFileBatchAction: method("runFileBatchAction"),
    rewordSelectedCommit: method("rewordSelectedCommit"),
  };
}
