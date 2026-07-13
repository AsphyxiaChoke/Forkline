"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "features", "git-actions.js"), "utf8");

function checkoutStashContext() {
  let resolveFind;
  let promptCount = 0;
  const actions = [];
  const findResponse = new Promise((resolve) => {
    resolveFind = resolve;
  });
  const state = {
    data: { repo: { path: "C:/repo-a", branch: "main", isSample: false } },
    selectedRef: "main",
    ignoredCheckoutStashes: new Set(),
    commitDetails: new Map(),
  };
  const storage = new Map();
  const context = vm.createContext({
    state,
    api: async (pathname, options) => {
      assert.equal(pathname, "/api/action");
      const action = JSON.parse(options.body).action;
      actions.push(action);
      if (action === "findCheckoutStash") return findResponse;
      assert.equal(action, "restoreCheckoutStash");
      return { output: "restored" };
    },
    repoPathSnapshot: () => state.data?.repo?.path || "",
    isCurrentRepoPath: (repoPath) => (state.data?.repo?.path || "") === repoPath,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    loadStateForRepoPath: async () => state.data,
    renderAll: () => {},
    toast: () => {},
    t: (text) => text,
  });
  vm.runInContext(source, context);
  context.currentBranchSnapshotPayload = () => ({ expectedBranch: state.data.repo.branch });
  context.chooseStashRestore = async () => {
    promptCount += 1;
    return false;
  };
  return {
    context,
    state,
    resolveFind,
    promptCount: () => promptCount,
    actions,
    remember: (record) => storage.set("forkline-checkout-stashes", JSON.stringify([record])),
  };
}

const stash = {
  message: "Forkline: checkout feature 2026-06-11 04:39:27",
  label: "On main: Forkline: checkout feature 2026-06-11 04:39:27",
  branch: "main",
  sha: "aaaa",
};

test("checkout stash prompt is discarded after the checked-out branch changes", async () => {
  const harness = checkoutStashContext();
  const pending = harness.context.maybeRestoreCheckoutStash("main");

  harness.state.data.repo.branch = "dev";
  harness.state.selectedRef = "dev";
  harness.resolveFind({ stash });
  await pending;

  assert.equal(harness.promptCount(), 0);
});

test("checkout stash prompt is discarded while another branch is being viewed", async () => {
  const harness = checkoutStashContext();
  const pending = harness.context.maybeRestoreCheckoutStash("main");

  harness.state.selectedRef = "feature";
  harness.resolveFind({ stash });
  await pending;

  assert.equal(harness.promptCount(), 0);
});

test("cached checkout stash does not prompt while another branch is being viewed", async () => {
  const harness = checkoutStashContext();
  harness.state.selectedRef = "feature";
  harness.remember({ ...stash, repoPath: "C:/repo-a" });

  await harness.context.maybeRestoreCheckoutStash("main");

  assert.equal(harness.promptCount(), 0);
});

test("checkout stash prompt remains available on the checked-out branch overview", async () => {
  const harness = checkoutStashContext();
  harness.state.selectedRef = "";
  const pending = harness.context.maybeRestoreCheckoutStash("main");

  harness.resolveFind({ stash });
  await pending;

  assert.equal(harness.promptCount(), 1);
});

test("checkout-triggered stash restore runs automatically without prompting", async () => {
  const harness = checkoutStashContext();
  harness.remember({ ...stash, repoPath: "C:/repo-a" });

  await harness.context.maybeRestoreCheckoutStash("main", { autoRestore: true });

  assert.equal(harness.promptCount(), 0);
  assert.deepEqual(harness.actions, ["restoreCheckoutStash"]);
});
