"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "js", "features", "diff-workbench.js"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const gitActionsSource = fs.readFileSync(path.join(root, "public", "js", "features", "git-actions.js"), "utf8");
const syncSource = fs.readFileSync(path.join(root, "public", "js", "panels", "sync.js"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");

test("worktree signatures include file snapshots", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const first = context.worktreeStateSignature([{ state: "M", file: "note.txt", snapshot: "content-a" }], null);
  const second = context.worktreeStateSignature([{ state: "M", file: "note.txt", snapshot: "content-b" }], null);
  assert.notEqual(first, second);
});

test("worktree polling runs only while the page is visible and focused", () => {
  let focusHandler = null;
  let visibilityHandler = null;
  let intervalHandler = null;
  let intervalMs = 0;
  let focused = false;
  const calls = [];
  const context = vm.createContext({
    __calls: calls,
    window: {
      addEventListener: (name, handler) => {
        if (name === "focus") focusHandler = handler;
      },
    },
    document: {
      hidden: false,
      hasFocus: () => focused,
      addEventListener: (name, handler) => {
        if (name === "visibilitychange") visibilityHandler = handler;
      },
    },
    setInterval: (handler, ms) => {
      intervalHandler = handler;
      intervalMs = ms;
      return 1;
    },
  });
  vm.runInContext(source, context);
  vm.runInContext("refreshWorktree = (silent) => __calls.push(silent)", context);
  context.initWorktreeAutoRefresh();

  assert.equal(intervalMs, 5000);
  assert.ok(focusHandler);
  assert.ok(visibilityHandler);
  assert.ok(intervalHandler);
  intervalHandler();
  assert.deepEqual(calls, []);

  focused = true;
  intervalHandler();
  assert.deepEqual(calls, [true]);

  context.document.hidden = true;
  focusHandler();
  assert.deepEqual(calls, [true]);

  context.document.hidden = false;
  visibilityHandler();
  focusHandler();
  assert.deepEqual(calls, [true, true, true]);
});

test("worktree file snapshots reuse hashes until file metadata changes", () => {
  const snapshotSource = serverSource.slice(
    serverSource.indexOf("function worktreeFileSnapshot"),
    serverSource.indexOf("function sha256Json")
  );
  let reads = 0;
  let content = "first";
  let mtimeNs = 1n;
  const context = vm.createContext({
    path,
    process,
    crypto: require("node:crypto"),
    WORKTREE_SNAPSHOT_CACHE_LIMIT: 8,
    worktreeFileSnapshotCache: new Map(),
    normalizeRepoFile: (file) => file,
    sameFsPath: () => true,
    isPathInside: () => true,
    fs: {
      statSync: () => ({
        dev: 1n,
        ino: 2n,
        size: BigInt(Buffer.byteLength(content)),
        mtimeNs,
        ctimeNs: mtimeNs,
        isFile: () => true,
        isDirectory: () => false,
      }),
      readFileSync: () => {
        reads += 1;
        return Buffer.from(content);
      },
    },
  });
  vm.runInContext(snapshotSource, context);

  const first = context.worktreeFileSnapshot("C:/repo", "note.txt");
  const second = context.worktreeFileSnapshot("C:/repo", "note.txt");
  assert.equal(second, first);
  assert.equal(reads, 1);

  content = "other";
  mtimeNs = 2n;
  const changed = context.worktreeFileSnapshot("C:/repo", "note.txt");
  assert.notEqual(changed, first);
  assert.equal(reads, 2);
});

test("lightweight worktree merges preserve commit and branch state", () => {
  const mergeSource = coreSource.match(/function mergeWorktreeState[\s\S]*?\n}/)?.[0] || "";
  const state = {
    data: {
      commits: [{ sha: "keep-commit" }],
      branches: [{ name: "keep-branch" }],
      stashes: [{ ref: "stash@{0}" }],
      repo: { path: "D:/repo", branch: "main", operation: { type: "merge" } },
      workingFiles: [{ file: "old.txt" }],
      worktreeSnapshot: "old",
    },
  };
  const context = vm.createContext({ state });
  vm.runInContext(mergeSource, context);

  context.mergeWorktreeState({
    workingFiles: [{ file: "new.txt" }],
    worktreeSnapshot: "new",
    operation: null,
  });
  assert.deepEqual(state.data.commits, [{ sha: "keep-commit" }]);
  assert.deepEqual(state.data.branches, [{ name: "keep-branch" }]);
  assert.deepEqual(state.data.stashes, [{ ref: "stash@{0}" }]);
  assert.deepEqual(state.data.workingFiles, [{ file: "new.txt" }]);
  assert.equal(state.data.worktreeSnapshot, "new");
  assert.equal(state.data.repo.branch, "main");
  assert.equal(state.data.repo.operation, null);

  context.mergeWorktreeState({ workingFiles: [], stashes: [{ ref: "stash@{1}" }] }, { stashes: true });
  assert.deepEqual(state.data.stashes, [{ ref: "stash@{1}" }]);
});

test("stage-all and stash actions use lightweight worktree refreshes", () => {
  const runActionSource = gitActionsSource.slice(
    gitActionsSource.indexOf("async function runAction"),
    gitActionsSource.indexOf("function currentBranchSnapshotPayload")
  );
  const createStashSource = gitActionsSource.slice(
    gitActionsSource.indexOf("async function createStashFromSelection"),
    gitActionsSource.indexOf("async function ignoreWorktreePath")
  );
  const runStashSource = syncSource.slice(
    syncSource.indexOf("async function runStashAction"),
    syncSource.indexOf("async function branchFromStash")
  );

  assert.match(runActionSource, /const worktreeOnly = action === "stageAll" \|\| action === "discardAll"/);
  assert.match(runActionSource, /if \(worktreeOnly\) \{[\s\S]*?api\("\/api\/worktree"\)[\s\S]*?renderWorkingFiles\(\);[\s\S]*?renderStage\(\);[\s\S]*?return;/);
  assert.match(createStashSource, /api\("\/api\/worktree\?stashes=1"\)/);
  assert.doesNotMatch(createStashSource, /loadStateForRepoPath/);
  assert.match(runStashSource, /api\("\/api\/worktree\?stashes=1"\)/);
  assert.doesNotMatch(runStashSource, /api\(`\/api\/state/);
});
