"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "js", "features", "recovery-undo.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

function createHarness(apiResult = { ok: true, output: "已恢复", recovery: { ref: "refs/forkline/recovery/after", sha: "after" } }) {
  const calls = { api: [], reload: [], toast: [], cleanup: [] };
  const attributes = new Map();
  const button = {
    hidden: true,
    disabled: false,
    textContent: "",
    title: "",
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
  const state = {
    data: {
      repo: {
        path: "C:\\repo",
        branch: "main",
        headSha: "after-operation",
        isSample: false,
        operation: null,
      },
      workingFiles: [],
    },
    recoveryUndo: null,
    selectedRecoveryRef: "",
  };
  const context = vm.createContext({
    state,
    els: { undoRecovery: button },
    t: (message, values = {}) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), message),
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => repoPath === state.data.repo.path,
    currentBranchSnapshotPayload: () => ({ expectedBranch: state.data.repo.branch, expectedHead: state.data.repo.headSha, expectedWorktreeSnapshot: "clean" }),
    maybeOfferRecoveryPolicyCleanup: (result) => calls.cleanup.push(result.recovery.ref),
    api: async (requestPath, options) => {
      calls.api.push({ path: requestPath, options });
      return apiResult;
    },
    reloadAfterHistoryAction: async (repoPath) => {
      calls.reload.push(repoPath);
    },
    toast: (message) => calls.toast.push(message),
  });
  vm.runInContext(source, context);
  return { attributes, button, calls, context, state };
}

test("one-click recovery button is only shown for the matching repository, branch, and HEAD", () => {
  assert.match(indexHtml, /id="undoRecovery"[^>]*hidden/);
  assert.match(styles, /\.recovery-undo-btn\[hidden\]\s*{[^}]*display:\s*none;/s);

  const harness = createHarness();
  const offered = harness.context.offerRecoveryUndo({
    recovery: {
      ref: "refs/forkline/recovery/20260806/main/reset-hard",
      sha: "before-operation",
      short: "before1",
      actionLabel: "硬重置前",
    },
  });

  assert.equal(offered, true);
  assert.equal(harness.button.hidden, false);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.button.textContent, "撤销");
  assert.deepEqual(harness.calls.cleanup, ["refs/forkline/recovery/20260806/main/reset-hard"]);
  assert.match(harness.button.title, /git reset --hard refs\/forkline\/recovery/);
  assert.match(harness.attributes.get("aria-label"), /不包含未提交文件/);

  harness.state.data.workingFiles = [{ file: "dirty.txt" }];
  harness.context.renderRecoveryUndoButton();
  assert.equal(harness.button.hidden, false);
  assert.equal(harness.button.disabled, true);
  assert.match(harness.button.title, /1 个未提交改动/);

  harness.state.data.workingFiles = [];
  harness.state.data.repo.headSha = "external-change";
  harness.context.renderRecoveryUndoButton();
  assert.equal(harness.button.hidden, true);
  assert.equal(harness.state.recoveryUndo, null);
});

test("one-click recovery restores the returned point with current snapshots", async () => {
  const harness = createHarness();
  harness.context.offerRecoveryUndo({
    recovery: {
      ref: "refs/forkline/recovery/20260806/main/amend",
      sha: "before-amend",
      short: "before2",
      actionLabel: "追加提交前",
    },
  });

  await harness.context.runRecoveryUndo(harness.button);

  assert.equal(harness.calls.api.length, 1);
  assert.equal(harness.calls.api[0].path, "/api/action");
  const body = JSON.parse(harness.calls.api[0].options.body);
  assert.deepEqual(body, {
    action: "restoreRecoveryPoint",
    ref: "refs/forkline/recovery/20260806/main/amend",
    sha: "before-amend",
    expectedBranch: "main",
    expectedHead: "after-operation",
    expectedWorktreeSnapshot: "clean",
  });
  assert.deepEqual(harness.calls.reload, ["C:\\repo"]);
  assert.equal(harness.state.selectedRecoveryRef, "refs/forkline/recovery/after");
  assert.equal(harness.state.recoveryUndo, null);
  assert.equal(harness.button.hidden, true);
  assert.deepEqual(harness.calls.toast, ["已恢复"]);
});
