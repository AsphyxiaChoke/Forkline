"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRepositoryWorktreeService } = require("../server/repository-worktree-service");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "js", "features", "worktree-refresh.js"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const gitActionsSource = fs.readFileSync(path.join(root, "public", "js", "features", "git-actions.js"), "utf8");
const stashesSource = fs.readFileSync(path.join(root, "public", "js", "panels", "stashes.js"), "utf8");
const repositoryWorktreeSource = fs.readFileSync(path.join(root, "server", "repository-worktree-service.js"), "utf8");

function createWorktreeService(git) {
  return createRepositoryWorktreeService({
    git,
    getCurrentRepo: () => "C:/repo",
    browseService: {
      isPathInside: () => true,
      sameFsPath: () => true,
    },
    authService: { readPullRequestLink: () => "" },
    readBranchDisplayName: async () => "main",
    hasHeadCommit: async () => true,
    readRemoteDetails: async () => [],
    normalizeStashRef: (value) => value,
    sampleState: () => ({ workingFiles: [], stashes: [] }),
    detectRepoOperation: () => null,
    worktreeDiffContext: 8,
    fileEditorDiffContext: 0,
    worktreeSnapshotCacheLimit: 8,
    untrackedDiffHunkSize: 200,
    gitLogFieldSeparator: "\u001f",
    refCommitLogFormat: "%H",
    laneColors: ["#000"],
    worktreeFileSnapshotCache: new Map(),
  });
}

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

test("worktree file snapshots reuse hashes until file metadata changes", async () => {
  const snapshotSource = repositoryWorktreeSource.slice(
    repositoryWorktreeSource.indexOf("async function worktreeFileSnapshot"),
    repositoryWorktreeSource.indexOf("function sha256Json")
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
      promises: {
        stat: async () => ({
          dev: 1n,
          ino: 2n,
          size: BigInt(Buffer.byteLength(content)),
          mtimeNs,
          ctimeNs: mtimeNs,
          isFile: () => true,
          isDirectory: () => false,
        }),
        readFile: async () => {
          reads += 1;
          return Buffer.from(content);
        },
      },
    },
  });
  vm.runInContext(snapshotSource, context);

  const first = await context.worktreeFileSnapshot("C:/repo", "note.txt");
  const second = await context.worktreeFileSnapshot("C:/repo", "note.txt");
  assert.equal(second, first);
  assert.equal(reads, 1);

  content = "other";
  mtimeNs = 2n;
  const changed = await context.worktreeFileSnapshot("C:/repo", "note.txt");
  assert.notEqual(changed, first);
  assert.equal(reads, 2);
});

test("worktree index snapshots skip untracked paths", async () => {
  const calls = [];
  const service = createWorktreeService(async (_repo, args) => {
    calls.push(args);
    return "";
  });

  await service.readWorkingStatus("C:/repo", "?? untracked-a.txt\0?? folder/untracked-b.txt\0");
  assert.deepEqual(calls, []);
});

test("worktree index snapshot queries keep large path lists below the Windows command limit", async () => {
  const calls = [];
  const service = createWorktreeService(async (_repo, args) => {
    calls.push(args);
    return "";
  });
  const status = Array.from(
    { length: 1600 },
    (_value, index) => ` M folder-${String(index).padStart(4, "0")}/tracked-file-${String(index).padStart(5, "0")}.txt\0`
  ).join("");

  await service.readWorkingStatus("C:/repo", status);
  assert.ok(calls.length > 1);
  assert.ok(calls.every((args) => args.join("\0").length <= 24 * 1024));
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
  const runStashSource = stashesSource.slice(
    stashesSource.indexOf("async function runStashAction"),
    stashesSource.indexOf("async function branchFromStash")
  );

  assert.match(runActionSource, /const worktreeOnly = action === "stageAll" \|\| action === "discardAll"/);
  assert.match(runActionSource, /if \(worktreeOnly\) \{[\s\S]*?api\("\/api\/worktree"\)[\s\S]*?renderWorkingFiles\(\);[\s\S]*?renderStage\(\);[\s\S]*?return;/);
  assert.match(createStashSource, /api\("\/api\/worktree\?stashes=1"\)/);
  assert.doesNotMatch(createStashSource, /loadStateForRepoPath/);
  assert.match(runStashSource, /api\("\/api\/worktree\?stashes=1"\)/);
  assert.doesNotMatch(runStashSource, /api\(`\/api\/state/);
});
