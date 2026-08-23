"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const gitActionsSource = fs.readFileSync(path.join(root, "public", "js", "features", "git-actions.js"), "utf8");
const coreRefreshSource = coreSource.slice(
  coreSource.indexOf("function repoPathSnapshot"),
  coreSource.indexOf("async function renderSelectedCommitForRepoPath")
);

test("repository action refresh reads core state and expires deferred detail requests", async () => {
  const calls = [];
  const state = {
    data: { repo: { path: "C:/repo", branch: "main" } },
    selectedRef: "feature/test",
    repoDetailRequestId: 4,
    repoDetailLoads: {
      stashes: { repoPath: "C:/repo", requestId: 4, status: "loading", error: "" },
    },
  };
  const context = vm.createContext({
    state,
    api: async (url) => {
      calls.push(url);
      return { repo: { path: "C:/repo", branch: "main", selectedRef: "feature/test" }, commits: [] };
    },
  });
  vm.runInContext(coreRefreshSource, context);

  const data = await context.loadStateForRepoPath("C:/repo", "feature/test");

  assert.deepEqual(calls, ["/api/state?ref=feature%2Ftest&details=core"]);
  assert.equal(data.repo.selectedRef, "feature/test");
  assert.equal(state.repoDetailRequestId, 5);
  assert.equal(Object.keys(state.repoDetailLoads).length, 0);
});

test("repository action refresh leaves the new repository detail state untouched", async () => {
  let resolveState;
  const state = {
    data: { repo: { path: "C:/repo-a", branch: "main" } },
    selectedRef: "main",
    repoDetailRequestId: 7,
    repoDetailLoads: {
      worktrees: { repoPath: "C:/repo-a", requestId: 7, status: "loading", error: "" },
    },
  };
  const context = vm.createContext({
    state,
    api: () => new Promise((resolve) => { resolveState = resolve; }),
  });
  vm.runInContext(coreRefreshSource, context);

  const pending = context.loadStateForRepoPath("C:/repo-a", "main");
  state.data = { repo: { path: "C:/repo-b", branch: "main" } };
  state.repoDetailLoads = {
    stashes: { repoPath: "C:/repo-b", requestId: 8, status: "loaded", error: "" },
  };
  resolveState({ repo: { path: "C:/repo-a", branch: "main" }, commits: [] });

  assert.equal(await pending, null);
  assert.equal(state.repoDetailRequestId, 7);
  assert.equal(state.repoDetailLoads.stashes.repoPath, "C:/repo-b");
});

test("a newer core state refresh expires an older refresh in the same repository", async () => {
  let resolveFirst;
  let resolveSecond;
  const state = {
    data: { repo: { path: "C:/repo", branch: "main" } },
    selectedRef: "main",
    stateRequestId: 0,
    repoDetailRequestId: 2,
    repoDetailLoads: {},
  };
  const context = vm.createContext({
    state,
    api: (url) => new Promise((resolve) => {
      if (url.includes("main")) resolveFirst = resolve;
      else resolveSecond = resolve;
    }),
  });
  vm.runInContext(coreRefreshSource, context);

  const first = context.loadStateForRepoPath("C:/repo", "main");
  const second = context.loadStateForRepoPath("C:/repo", "feature/test");
  resolveFirst({ repo: { path: "C:/repo", selectedRef: "main" }, commits: [] });
  resolveSecond({ repo: { path: "C:/repo", selectedRef: "feature/test" }, commits: [] });

  assert.equal(await first, null);
  assert.equal((await second).repo.selectedRef, "feature/test");
  assert.equal(state.repoDetailRequestId, 3);
});

test("common Git actions delegate state refill instead of reading full repository state", () => {
  for (const [startName, endName] of [
    ["async function runAction", "function currentBranchSnapshotPayload"],
    ["async function runRepoOperation", "async function fillLatestCommitMessage"],
    ["async function runRemoteAction", "async function runRemoteMenuAction"],
  ]) {
    const start = gitActionsSource.indexOf(startName);
    const end = gitActionsSource.indexOf(endName, start);
    const source = gitActionsSource.slice(start, end);
    assert.ok(start >= 0 && end > start, `${startName} source should be available`);
    assert.doesNotMatch(source, /api\(`\/api\/state\?ref=/);
    assert.match(source, /loadStateForRepoPath\(repoPath/);
  }
});
