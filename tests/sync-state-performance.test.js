"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const serverSource = read("server.js");
const syncSource = read("public/js/panels/sync.js");
const folderCommandSource = read("public/js/features/folder-command.js");
const gitActionsSource = read("public/js/features/git-actions.js");

test("sync inspector refresh uses the lightweight endpoint and upstream changes stay local", () => {
  assert.match(serverSource, /parsed\.pathname === "\/api\/sync-state"[\s\S]*?readSyncState\(\)/);
  assert.match(folderCommandSource, /if \(tab === "sync"\)[\s\S]*?refreshSyncState\(\)/);

  const upstreamStart = gitActionsSource.indexOf("async function runUpstreamAction");
  const upstreamEnd = gitActionsSource.indexOf("async function runRemoteAction", upstreamStart);
  const upstreamSource = gitActionsSource.slice(upstreamStart, upstreamEnd);
  assert.match(upstreamSource, /await refreshSyncState\(\)/);
  assert.doesNotMatch(upstreamSource, /\/api\/state|renderAll\(|commitDetails\.clear\(/);
});

test("lightweight sync refresh preserves graph, worktree, and commit detail state", async () => {
  const commits = [{ sha: "a".repeat(40) }];
  const workingFiles = [{ file: "note.txt", state: "M" }];
  const commitDetails = new Map([[commits[0].sha, { message: "loaded" }]]);
  const state = createState({ commits, workingFiles, commitDetails });
  let branchRenderCount = 0;
  let inspectorRenderCount = 0;
  const context = createContext(state, async (url) => {
    assert.equal(url, "/api/sync-state");
    return syncResponse({ ahead: 2, upstream: "origin/main" });
  }, {
    renderBranches: () => { branchRenderCount += 1; },
    renderInspector: () => { inspectorRenderCount += 1; },
  });

  vm.runInContext(syncSource, context);
  const refreshed = await context.refreshSyncState();

  assert.equal(refreshed, true);
  assert.equal(state.data.commits, commits);
  assert.equal(state.data.workingFiles, workingFiles);
  assert.equal(state.commitDetails, commitDetails);
  assert.equal(state.selectedSha, commits[0].sha);
  assert.equal(state.data.branchInfo.main.sha, "a".repeat(40));
  assert.equal(state.data.branchInfo.main.upstream, "origin/main");
  assert.equal(state.data.sync.ahead, 2);
  assert.equal(branchRenderCount, 1);
  assert.equal(inspectorRenderCount, 1);
});

test("lightweight sync refresh rejects a result for a changed HEAD", async () => {
  const state = createState();
  const messages = [];
  let branchRenderCount = 0;
  const context = createContext(state, async () => ({
    ...syncResponse({ ahead: 9 }),
    repo: { ...syncResponse().repo, headSha: "b".repeat(40) },
  }), {
    renderBranches: () => { branchRenderCount += 1; },
    toast: (message) => messages.push(message),
  });

  vm.runInContext(syncSource, context);
  const refreshed = await context.refreshSyncState();

  assert.equal(refreshed, false);
  assert.equal(state.data.sync.ahead, 0);
  assert.equal(branchRenderCount, 0);
  assert.match(messages[0], /分支或最新提交已经变化/);
});

function createState(overrides = {}) {
  const headSha = "a".repeat(40);
  return {
    data: {
      repo: { path: "C:/repo", branch: "main", headSha, remoteNames: ["origin"], isSample: false },
      commits: overrides.commits || [{ sha: headSha }],
      workingFiles: overrides.workingFiles || [],
      branchInfo: { main: { sha: headSha, upstream: "", ahead: 0, behind: 0 } },
      remotes: ["origin/main"],
      remoteInfo: { "origin/main": { sha: headSha, short: headSha.slice(0, 7) } },
      sync: { branch: "main", upstream: "", ahead: 0, behind: 0, remotes: [] },
    },
    selectedTab: "sync",
    selectedSha: headSha,
    selectedSyncSha: "",
    selectedSyncFile: "",
    syncRequestId: 0,
    commitDetails: overrides.commitDetails || new Map(),
  };
}

function createContext(state, api, overrides = {}) {
  return vm.createContext({
    state,
    api,
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => repoPath === state.data.repo.path,
    renderBranches: overrides.renderBranches || (() => {}),
    renderInspector: overrides.renderInspector || (() => {}),
    toast: overrides.toast || (() => {}),
    t: (value) => value,
  });
}

function syncResponse(overrides = {}) {
  const headSha = "a".repeat(40);
  return {
    repo: { path: "C:/repo", branch: "main", headSha, remoteNames: ["origin"], isSample: false },
    branchInfo: { main: { upstream: overrides.upstream || "", ahead: overrides.ahead || 0, behind: 0, upstreamGone: false } },
    remotes: ["origin/main"],
    remoteInfo: { "origin/main": { sha: headSha, short: headSha.slice(0, 7) } },
    sync: {
      branch: "main",
      upstream: overrides.upstream || "",
      ahead: overrides.ahead || 0,
      behind: 0,
      upstreamGone: false,
      incoming: [],
      outgoing: [],
      remotes: [{ name: "origin", fetchUrl: "https://example.com/repo.git", pushUrl: "https://example.com/repo.git", pushUrls: ["https://example.com/repo.git"] }],
    },
  };
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
