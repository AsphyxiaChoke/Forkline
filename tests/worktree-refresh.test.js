"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRepositoryWorktreeService } = require("../server/repository-worktree-service");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "js", "features", "worktree-refresh.js"), "utf8");
const coreSource = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const gitActionsSource = fs.readFileSync(path.join(root, "public", "js", "features", "git-actions.js"), "utf8");
const stashesSource = fs.readFileSync(path.join(root, "public", "js", "panels", "stashes.js"), "utf8");
const repositoryWorktreeSource = fs.readFileSync(path.join(root, "server", "repository-worktree-service.js"), "utf8");

function createWorktreeService(git, overrides = {}) {
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
    ...overrides,
  });
}

test("sync state reuses complete branch tracking snapshots without extra Git reads", async () => {
  const calls = [];
  const service = createWorktreeService(async (_repoPath, args) => {
    calls.push(args);
    return "";
  });
  const upstreamSha = "b".repeat(40);

  const state = await service.readCurrentSyncState("C:/repo", {
    branch: "main",
    upstream: "origin/main",
    upstreamSha,
    upstreamGone: false,
    ahead: 3,
    behind: 2,
    hasCommit: true,
  });

  assert.equal(state.upstreamSha, upstreamSha);
  assert.equal(state.ahead, 3);
  assert.equal(state.behind, 2);
  const gone = await service.readCurrentSyncState("C:/repo", {
    branch: "main",
    upstream: "origin/main",
    upstreamGone: true,
    hasCommit: false,
  });
  assert.equal(gone.upstreamGone, true);
  assert.equal(gone.upstreamSha, "");
  assert.deepEqual(calls, []);
});

test("worktree signatures include file snapshots", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const first = context.worktreeStateSignature([{ state: "M", file: "note.txt", snapshot: "content-a" }], null);
  const second = context.worktreeStateSignature([{ state: "M", file: "note.txt", snapshot: "content-b" }], null);
  assert.notEqual(first, second);
});

test("worktree signatures prefer the server snapshot and include operation changes", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const files = [{ state: "M", file: "note.txt", snapshot: "content-a" }];
  const sameWorktree = context.worktreeStateSignature(files, null, "worktree-a");
  const changedFileDetail = context.worktreeStateSignature(
    [{ state: "M", file: "note.txt", snapshot: "content-b" }],
    null,
    "worktree-a"
  );
  const changedOperation = context.worktreeStateSignature(
    files,
    { type: "merge", snapshot: "operation-a" },
    "worktree-a"
  );

  assert.equal(changedFileDetail, sameWorktree);
  assert.notEqual(changedOperation, sameWorktree);
});

test("silent worktree refresh sends the current snapshot and skips unchanged rendering", async () => {
  let requestedPath = "";
  let renders = 0;
  let merges = 0;
  const state = {
    data: {
      repo: { path: "D:/repo", operation: null },
      workingFiles: [{ state: "M", file: "note.txt", snapshot: "file-a" }],
      worktreeSnapshot: "worktree-a",
    },
    refreshingWorktree: false,
    worktreeSignature: "",
  };
  const context = vm.createContext({
    state,
    els: { refreshChanges: { disabled: false } },
    api: async (path) => {
      requestedPath = path;
      return { unchanged: true, worktreeSnapshot: "worktree-a", operation: null };
    },
    mergeWorktreeState: () => {
      merges += 1;
    },
    renderStage: () => {
      renders += 1;
    },
    toast: () => {},
    t: (value) => value,
  });
  vm.runInContext(source, context);
  state.worktreeSignature = context.worktreeStateSignature(
    state.data.workingFiles,
    state.data.repo.operation,
    state.data.worktreeSnapshot
  );

  const result = await context.refreshWorktree(true);

  assert.equal(result, "unchanged");
  assert.equal(requestedPath, "/api/worktree?expectedSnapshot=worktree-a");
  assert.equal(renders, 0);
  assert.equal(merges, 0);
  assert.equal(state.data.workingFiles[0].file, "note.txt");
});

test("unchanged worktree refresh still updates the repository operation banner", async () => {
  let bannerFiles = null;
  const state = {
    data: {
      repo: { path: "D:/repo", operation: null },
      workingFiles: [{ state: "M", file: "note.txt", snapshot: "file-a" }],
      worktreeSnapshot: "worktree-a",
    },
    refreshingWorktree: false,
    worktreeSignature: "",
  };
  const context = vm.createContext({
    state,
    els: { refreshChanges: { disabled: false } },
    api: async () => ({
      unchanged: true,
      worktreeSnapshot: "worktree-a",
      operation: { type: "merge", snapshot: "operation-a" },
    }),
    mergeWorktreeState: () => {
      throw new Error("unchanged responses must not replace working files");
    },
    renderStage: () => {
      throw new Error("operation-only changes must not rebuild the file tree");
    },
    refreshRepoOperationBanner: (files) => {
      bannerFiles = files;
    },
    toast: () => {},
    t: (value) => value,
  });
  vm.runInContext(source, context);
  state.worktreeSignature = context.worktreeStateSignature(
    state.data.workingFiles,
    state.data.repo.operation,
    state.data.worktreeSnapshot
  );

  const result = await context.refreshWorktree(true);

  assert.equal(result, "changed");
  assert.equal(state.data.repo.operation.type, "merge");
  assert.equal(bannerFiles, state.data.workingFiles);
});

test("worktree service omits file details only when the expected snapshot still matches", async () => {
  let status = "?? first.txt\0";
  const operation = { type: "merge", snapshot: "operation-a" };
  const service = createWorktreeService(async (_repo, args) => {
    if (args[0] === "status") return status;
    return "";
  }, {
    detectRepoOperation: () => operation,
  });

  const first = await service.readWorktree();
  const unchanged = await service.readWorktree({ expectedSnapshot: first.worktreeSnapshot });
  assert.deepEqual(unchanged, {
    unchanged: true,
    worktreeSnapshot: first.worktreeSnapshot,
    operation,
  });

  const withStashes = await service.readWorktree({
    includeStashes: true,
    expectedSnapshot: first.worktreeSnapshot,
  });
  assert.equal(withStashes.unchanged, undefined);
  assert.equal(withStashes.workingFiles.length, 1);
  assert.deepEqual(withStashes.stashes, []);

  status = "?? second.txt\0";
  const changed = await service.readWorktree({ expectedSnapshot: first.worktreeSnapshot });
  assert.equal(changed.unchanged, undefined);
  assert.notEqual(changed.worktreeSnapshot, first.worktreeSnapshot);
  assert.deepEqual(changed.workingFiles.map((file) => file.file), ["second.txt"]);
});

test("worktree watcher reuses snapshots until a file event or safety rescan", async (t) => {
  const repo = await fs.promises.mkdtemp(path.join(os.tmpdir(), "forkline-worktree-watch-"));
  t.after(() => fs.promises.rm(repo, { recursive: true, force: true }));
  const filePath = path.join(repo, "note.txt");
  await fs.promises.writeFile(filePath, "first\n", "utf8");
  let now = 1000;
  let watchListener = null;
  let watcherClosed = 0;
  let statusOptions = null;
  const service = createWorktreeService(async (_repo, args, commandOptions) => {
    if (args[0] === "status") statusOptions = commandOptions;
    if (args[0] === "status") return "?? note.txt\0";
    return "";
  }, {
    getCurrentRepo: () => repo,
    now: () => now,
    watchWorktree: (_repo, listener) => {
      watchListener = listener;
      return {
        close: () => { watcherClosed += 1; },
        on: () => {},
      };
    },
  });

  const first = await service.readWorktree();
  assert.ok(watchListener);
  assert.deepEqual(statusOptions, {
    stdoutOnly: true,
    env: { GIT_OPTIONAL_LOCKS: "0" },
  });
  await fs.promises.writeFile(filePath, "second content\n", "utf8");

  const reused = await service.readWorktree({ expectedSnapshot: first.worktreeSnapshot });
  assert.equal(reused.unchanged, true);
  assert.equal(reused.worktreeSnapshot, first.worktreeSnapshot);

  watchListener("change", "note.txt");
  const watched = await service.readWorktree({ expectedSnapshot: first.worktreeSnapshot });
  assert.equal(watched.unchanged, undefined);
  assert.notEqual(watched.worktreeSnapshot, first.worktreeSnapshot);

  await fs.promises.writeFile(filePath, "third content is longer\n", "utf8");
  now += 60001;
  const rescanned = await service.readWorktree({ expectedSnapshot: watched.worktreeSnapshot });
  assert.equal(rescanned.unchanged, undefined);
  assert.notEqual(rescanned.worktreeSnapshot, watched.worktreeSnapshot);

  service.setCurrentRepo(null);
  assert.equal(watcherClosed, 1);
});

test("worktree watcher cache survives one repository switch and evicts the least-recent third repository", async () => {
  const repoA = "C:/repo-a";
  const repoB = "C:/repo-b";
  const repoC = "C:/repo-c";
  const scans = new Map();
  const closed = new Map();
  const listeners = new Map();
  const service = createWorktreeService(async (_repo, args) => {
    if (args[0] === "status") return "?? note.txt\0";
    return "";
  }, {
    getCurrentRepo: () => repoA,
    statusFileSnapshot: async (repoPath, file) => {
      const count = (scans.get(repoPath) || 0) + 1;
      scans.set(repoPath, count);
      return `${repoPath}:${file.file}:snapshot-${count}`;
    },
    watchWorktree: (repoPath, listener) => {
      listeners.set(repoPath, listener);
      return {
        close: () => closed.set(repoPath, (closed.get(repoPath) || 0) + 1),
        on: () => {},
      };
    },
  });

  const firstA = await service.readWorktree();
  service.setCurrentRepo(repoB);
  await service.readWorktree();
  service.setCurrentRepo(repoA);
  const secondA = await service.readWorktree({ expectedSnapshot: firstA.worktreeSnapshot });

  assert.equal(secondA.unchanged, true);
  assert.equal(scans.get(repoA), 1);
  assert.equal(closed.get(repoA) || 0, 0);

  service.setCurrentRepo(repoB);
  listeners.get(repoA)("change", "note.txt");
  service.setCurrentRepo(repoA);
  const changedA = await service.readWorktree({ expectedSnapshot: firstA.worktreeSnapshot });
  assert.equal(changedA.unchanged, undefined);
  assert.equal(scans.get(repoA), 2);

  service.setCurrentRepo(repoC);
  await service.readWorktree();
  assert.equal(closed.get(repoB), 1);
  assert.equal(closed.get(repoA) || 0, 0);

  service.setCurrentRepo(null);
  assert.equal(closed.get(repoA), 1);
  assert.equal(closed.get(repoC), 1);
});

test("worktree watcher refreshes affected paths and fully rescans index changes", async () => {
  const status = [
    "?? group/a.txt",
    "?? group/b.txt",
    "?? other/c.txt",
  ].join("\0") + "\0";
  const snapshots = new Map([
    ["group/a.txt", "a-1"],
    ["group/b.txt", "b-1"],
    ["other/c.txt", "c-1"],
  ]);
  const calls = [];
  let watchListener = null;
  const service = createWorktreeService(async (_repo, args) => {
    if (args[0] === "status") return status;
    return "";
  }, {
    watchWorktree: (_repo, listener) => {
      watchListener = listener;
      return { close: () => {}, on: () => {} };
    },
    statusFileSnapshot: async (_repo, file) => {
      calls.push(file.file);
      return snapshots.get(file.file) || "missing";
    },
  });

  const first = await service.readWorktree();
  assert.deepEqual([...calls].sort(), ["group/a.txt", "group/b.txt", "other/c.txt"]);

  calls.length = 0;
  snapshots.set("group/a.txt", "a-2");
  watchListener("change", "group");
  watchListener("change", "group\\a.txt");
  watchListener("change", "group\\a.txt");
  const fileChanged = await service.readWorktree({ expectedSnapshot: first.worktreeSnapshot });
  assert.deepEqual(calls, ["group/a.txt"]);
  assert.notEqual(fileChanged.worktreeSnapshot, first.worktreeSnapshot);

  calls.length = 0;
  snapshots.set("group/b.txt", "b-2");
  watchListener("change", "group");
  const directoryChanged = await service.readWorktree({ expectedSnapshot: fileChanged.worktreeSnapshot });
  assert.deepEqual([...calls].sort(), ["group/a.txt", "group/b.txt"]);
  assert.notEqual(directoryChanged.worktreeSnapshot, fileChanged.worktreeSnapshot);

  calls.length = 0;
  watchListener("rename", ".git\\index.lock");
  await service.readWorktree({ expectedSnapshot: directoryChanged.worktreeSnapshot });
  assert.deepEqual([...calls].sort(), ["group/a.txt", "group/b.txt", "other/c.txt"]);
});

test("worktree watcher failures keep full snapshot scans", async (t) => {
  const repo = await fs.promises.mkdtemp(path.join(os.tmpdir(), "forkline-worktree-watch-fallback-"));
  t.after(() => fs.promises.rm(repo, { recursive: true, force: true }));
  const filePath = path.join(repo, "note.txt");
  await fs.promises.writeFile(filePath, "first\n", "utf8");
  const service = createWorktreeService(async (_repo, args) => {
    if (args[0] === "status") return "?? note.txt\0";
    return "";
  }, {
    getCurrentRepo: () => repo,
    watchWorktree: () => { throw new Error("watch unavailable"); },
  });

  const first = await service.readWorktree();
  await fs.promises.writeFile(filePath, "second content\n", "utf8");
  const changed = await service.readWorktree({ expectedSnapshot: first.worktreeSnapshot });

  assert.equal(changed.unchanged, undefined);
  assert.notEqual(changed.worktreeSnapshot, first.worktreeSnapshot);
});

test("large unchanged worktrees back off polling while small worktrees stay responsive", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);

  assert.equal(context.nextWorktreeAutoRefreshDelay(5000, "unchanged", 799), 5000);
  assert.equal(context.nextWorktreeAutoRefreshDelay(5000, "changed", 4000), 5000);
  assert.equal(context.nextWorktreeAutoRefreshDelay(5000, "unchanged", 4000), 10000);
  assert.equal(context.nextWorktreeAutoRefreshDelay(10000, "unchanged", 4000), 20000);
  assert.equal(context.nextWorktreeAutoRefreshDelay(20000, "unchanged", 4000), 30000);
  assert.equal(context.nextWorktreeAutoRefreshDelay(30000, "unchanged", 4000), 30000);
});

test("worktree polling backs off only while a large visible worktree stays unchanged", async () => {
  let focusHandler = null;
  let visibilityHandler = null;
  let timerHandler = null;
  let timerMs = 0;
  let timerId = 0;
  let focused = false;
  const calls = [];
  const results = ["unchanged", "unchanged", "unchanged", "changed", "unchanged"];
  const context = vm.createContext({
    __calls: calls,
    __results: results,
    state: { data: { workingFiles: Array.from({ length: 4000 }, () => ({})) } },
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
    setTimeout: (handler, ms) => {
      timerHandler = handler;
      timerMs = ms;
      timerId += 1;
      return timerId;
    },
    clearTimeout: () => {},
  });
  vm.runInContext(source, context);
  vm.runInContext("refreshWorktree = (silent) => { __calls.push(silent); return Promise.resolve(__results.shift()) }", context);
  context.initWorktreeAutoRefresh();

  assert.equal(timerMs, 5000);
  assert.ok(focusHandler);
  assert.ok(visibilityHandler);
  assert.ok(timerHandler);
  await timerHandler();
  assert.deepEqual(calls, []);
  assert.equal(timerMs, 30000);

  focused = true;
  focusHandler();
  assert.equal(timerMs, 0);
  await timerHandler();
  assert.deepEqual(calls, [true]);
  assert.equal(timerMs, 10000);

  await timerHandler();
  assert.equal(timerMs, 20000);
  await timerHandler();
  assert.equal(timerMs, 30000);
  await timerHandler();
  assert.equal(timerMs, 5000);

  context.document.hidden = true;
  focusHandler();
  assert.deepEqual(calls, [true, true, true, true]);

  context.document.hidden = false;
  visibilityHandler();
  assert.equal(timerMs, 0);
  await timerHandler();
  assert.deepEqual(calls, [true, true, true, true, true]);
  assert.equal(timerMs, 10000);
});

test("worktree file snapshots reuse hashes until file metadata changes", async () => {
  const snapshotSource = repositoryWorktreeSource.slice(
    repositoryWorktreeSource.indexOf("async function worktreeFileSnapshot"),
    repositoryWorktreeSource.indexOf("function sha256Json")
  );
  let opens = 0;
  let closes = 0;
  let handleReads = 0;
  let pathStats = 0;
  let pathReads = 0;
  let content = "first";
  let mtimeNs = 1n;
  const stat = () => ({
    dev: 1n,
    ino: 2n,
    size: BigInt(Buffer.byteLength(content)),
    mtimeNs,
    ctimeNs: mtimeNs,
    isFile: () => true,
    isDirectory: () => false,
  });
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
        open: async () => {
          opens += 1;
          return {
            stat: async () => stat(),
            readFile: async () => {
              handleReads += 1;
              return Buffer.from(content);
            },
            close: async () => { closes += 1; },
          };
        },
        stat: async () => {
          pathStats += 1;
          return stat();
        },
        readFile: async () => {
          pathReads += 1;
          return Buffer.from(content);
        },
      },
    },
  });
  vm.runInContext(snapshotSource, context);

  const first = await context.worktreeFileSnapshot("C:/repo", "note.txt");
  const second = await context.worktreeFileSnapshot("C:/repo", "note.txt");
  assert.equal(second, first);
  assert.equal(opens, 1);
  assert.equal(closes, 1);
  assert.equal(handleReads, 1);
  assert.equal(pathStats, 1);
  assert.equal(pathReads, 0);

  content = "other";
  mtimeNs = 2n;
  const changed = await context.worktreeFileSnapshot("C:/repo", "note.txt");
  assert.notEqual(changed, first);
  assert.equal(opens, 1);
  assert.equal(closes, 1);
  assert.equal(handleReads, 1);
  assert.equal(pathStats, 2);
  assert.equal(pathReads, 1);
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
    stashesSource.indexOf("function stashActionListSignature"),
    stashesSource.indexOf("function defaultStashBranchName")
  );

  assert.match(runActionSource, /const worktreeOnly = action === "stageAll" \|\| action === "discardAll"/);
  assert.match(runActionSource, /if \(worktreeOnly\) \{[\s\S]*?api\("\/api\/worktree"\)[\s\S]*?renderStage\(\);[\s\S]*?return;/);
  assert.doesNotMatch(runActionSource, /renderWorkingFiles\(\)/);
  assert.match(createStashSource, /api\("\/api\/worktree\?stashes=1"\)/);
  assert.doesNotMatch(createStashSource, /loadStateForRepoPath/);
  assert.match(runStashSource, /api\("\/api\/worktree\?stashes=1"\)/);
  assert.doesNotMatch(runStashSource, /api\(`\/api\/state/);
});

function createStashActionHarness(options = {}) {
  const repoPath = options.repoPath || "C:/repo";
  const requests = [];
  const actionResolvers = [];
  const actionRejectors = [];
  const toasts = [];
  const state = {
    data: {
      repo: { path: repoPath, branch: "main", headSha: "head", isSample: false },
      workingFiles: [],
      worktreeSnapshot: "before",
      stashes: [
        { ref: "stash@{0}", sha: "stash-sha-0", message: "first", branch: "main" },
        { ref: "stash@{1}", sha: "stash-sha-1", message: "second", branch: "main" },
      ],
      commits: [{ sha: "head" }],
    },
    selectedStash: "stash@{0}",
    selectedTab: "stashes",
    selectedSha: "",
    selectedRef: "main",
    stashDetails: new Map(),
    stateRequestId: 1,
    openRepoRequestId: 1,
  };
  const button = { disabled: false };
  const document = { querySelectorAll: () => [button] };
  const context = vm.createContext({
    state,
    document,
    confirm: () => options.confirmResult !== false,
    prompt: () => options.promptResult || "stash/new",
    repoPathSnapshot: () => state.data?.repo?.path || "",
    isCurrentRepoPath: (candidate) => candidate === (state.data?.repo?.path || ""),
    currentBranchSnapshotPayload: () => ({}),
    api: async (url) => {
      requests.push(url);
      if (url === "/api/action") {
        return new Promise((resolve, reject) => {
          actionResolvers.push(resolve);
          actionRejectors.push(reject);
        });
      }
      return { workingFiles: [], worktreeSnapshot: "after", operation: null, stashes: state.data.stashes };
    },
    mergeWorktreeState: (data) => {
      state.data.workingFiles = data.workingFiles || [];
      state.data.worktreeSnapshot = data.worktreeSnapshot || "";
      state.data.repo = { ...state.data.repo, operation: data.operation || null };
      state.data.stashes = data.stashes || [];
    },
    renderStage: () => {},
    renderInspector: () => {},
    renderAll: () => {},
    loadCommit: async () => {},
    toast: (message) => toasts.push(message),
    stashActionConfirmMessage: () => "confirm",
    t: (value) => value,
  });
  const sourceStart = stashesSource.indexOf("function stashActionListSignature");
  const sourceEnd = stashesSource.length;
  vm.runInContext(stashesSource.slice(sourceStart, sourceEnd), context);
  return { context, state, button, requests, actionResolvers, actionRejectors, toasts };
}

test("rapid duplicate stash actions do not start a second Git request", async () => {
  const harness = createStashActionHarness();
  const first = harness.context.runStashAction("apply", "stash@{0}", harness.button);
  await Promise.resolve();
  const second = harness.context.runStashAction("apply", "stash@{0}", harness.button);
  await Promise.resolve();

  assert.equal(harness.requests.filter((url) => url === "/api/action").length, 1);
  assert.equal(harness.button.disabled, true);
  harness.actionResolvers[0]({ output: "应用完成" });
  await Promise.all([first, second]);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.state.stashActionLocks.size, 0);
});

test("different stash actions in the same repository are mutually exclusive", async () => {
  const harness = createStashActionHarness();
  const secondButton = { disabled: false };
  const first = harness.context.runStashAction("apply", "stash@{0}", harness.button);
  await Promise.resolve();
  const second = harness.context.runStashAction("drop", "stash@{1}", secondButton);
  await Promise.resolve();

  assert.equal(harness.requests.filter((url) => url === "/api/action").length, 1);
  assert.equal(secondButton.disabled, false);
  harness.actionResolvers[0]({ output: "应用完成" });
  await first;
  await second;
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.state.stashActionLocks.size, 0);
});

test("branch stash actions use the same in-flight lock", async () => {
  const harness = createStashActionHarness({ promptResult: "stash/new" });
  const first = harness.context.runStashAction("branch", "stash@{0}", harness.button);
  await Promise.resolve();
  const second = harness.context.runStashAction("branch", "stash@{0}", { disabled: false });
  await Promise.resolve();

  assert.equal(harness.requests.filter((url) => url === "/api/action").length, 1);
  harness.actionResolvers[0]({
    output: "已创建分支",
    state: {
      repo: { path: "C:/repo", branch: "stash/new", headSha: "new-head", isSample: false },
      workingFiles: [],
      worktreeSnapshot: "after-branch",
      stashes: [{ ref: "stash@{1}", sha: "stash-sha-1" }],
      commits: [{ sha: "new-head" }],
    },
  });
  await first;
  await second;
  assert.equal(harness.state.stashActionLocks.size, 0);
});

test("stash locks remain exclusive when switching away and back to a repository", async () => {
  const harness = createStashActionHarness();
  const repoA = harness.state.data;
  const first = harness.context.runStashAction("apply", "stash@{0}", harness.button);
  await Promise.resolve();

  harness.state.data = {
    repo: { path: "C:/repo-b", branch: "main", headSha: "b-head", isSample: false },
    workingFiles: [],
    worktreeSnapshot: "b-before",
    stashes: [{ ref: "stash@{0}", sha: "b-stash" }],
    commits: [{ sha: "b-head" }],
  };
  harness.state.stateRequestId += 1;
  const second = harness.context.runStashAction("apply", "stash@{0}", { disabled: false });
  await Promise.resolve();
  assert.equal(harness.requests.filter((url) => url === "/api/action").length, 2);

  harness.actionResolvers[1]({ output: "B 完成" });
  await second;
  harness.state.data = repoA;
  harness.state.stateRequestId += 1;
  await harness.context.runStashAction("drop", "stash@{0}", { disabled: false });
  assert.equal(harness.requests.filter((url) => url === "/api/action").length, 2);

  harness.actionResolvers[0]({ output: "A 完成" });
  await first;
  assert.equal(harness.state.stashActionLocks.size, 0);

  const uiHarness = createStashActionHarness();
  const uiFirst = uiHarness.context.runStashAction("apply", "stash@{0}", uiHarness.button);
  await Promise.resolve();
  uiHarness.state.data = {
    repo: { path: "C:/repo-b", branch: "main", headSha: "b-head", isSample: false },
    workingFiles: [],
    worktreeSnapshot: "b-before",
    stashes: [{ ref: "stash@{0}", sha: "b-stash" }],
    commits: [{ sha: "b-head" }],
  };
  uiHarness.state.stateRequestId += 1;
  const uiSecond = uiHarness.context.runStashAction("apply", "stash@{0}", { disabled: false });
  await Promise.resolve();
  uiHarness.actionResolvers[0]({ output: "A 完成" });
  await uiFirst;
  assert.equal(uiHarness.button.disabled, true);
  uiHarness.actionResolvers[1]({ output: "B 完成" });
  await uiSecond;
  assert.equal(uiHarness.button.disabled, false);
});

test("stale stash action responses cannot overwrite a switched or refreshed repository", async () => {
  const switched = createStashActionHarness();
  const switchedAction = switched.context.runStashAction("apply", "stash@{0}", switched.button);
  await Promise.resolve();
  switched.state.data = {
    repo: { path: "C:/other", branch: "dev", headSha: "other-head", isSample: false },
    workingFiles: [{ file: "other.txt" }],
    worktreeSnapshot: "other",
    stashes: [],
    commits: [{ sha: "other-head" }],
  };
  switched.state.stateRequestId += 1;
  switched.actionResolvers[0]({ output: "旧仓库完成" });
  await switchedAction;
  assert.equal(switched.requests.filter((url) => url === "/api/worktree?stashes=1").length, 0);
  assert.equal(switched.state.data.repo.path, "C:/other");
  assert.equal(switched.button.disabled, false);
  assert.equal(switched.state.stashActionLocks.size, 0);

  const refreshed = createStashActionHarness();
  const refreshedAction = refreshed.context.runStashAction("apply", "stash@{0}", refreshed.button);
  await Promise.resolve();
  refreshed.state.data.worktreeSnapshot = "newer-refresh";
  refreshed.state.data.workingFiles = [{ file: "newer.txt" }];
  refreshed.actionResolvers[0]({ output: "旧快照完成" });
  await refreshedAction;
  assert.equal(refreshed.requests.filter((url) => url === "/api/worktree?stashes=1").length, 0);
  assert.equal(refreshed.state.data.worktreeSnapshot, "newer-refresh");
  assert.equal(refreshed.button.disabled, false);
});

test("stash action buttons recover after a Git failure", async () => {
  const harness = createStashActionHarness();
  const action = harness.context.runStashAction("drop", "stash@{0}", harness.button);
  await Promise.resolve();
  harness.actionRejectors[0](new Error("drop failed"));
  await action;

  assert.equal(harness.button.disabled, false);
  assert.equal(harness.state.stashActionLocks.size, 0);
  assert.deepEqual(harness.toasts, ["drop failed"]);
});

test("commit can push the current branch after refreshing the new HEAD", async () => {
  const runActionSource = gitActionsSource.slice(
    gitActionsSource.indexOf("async function runAction"),
    gitActionsSource.indexOf("function currentBranchSnapshotPayload")
  );
  const actions = [];
  const confirmations = [];
  const state = {
    data: {
      repo: { path: "C:/repo", branch: "main", headSha: "a", selectedRef: "main", isSample: false },
      sync: { upstream: "origin/main", upstreamSha: "a", remotes: [] },
      workingFiles: [],
      commits: [{ sha: "a" }],
    },
    selectedRef: "main",
    selectedSha: "a",
    commitDetails: { clear() {} },
  };
  const els = {
    commitSummary: { value: "new commit" },
    commitBody: { value: "" },
    commitPushToggle: { checked: true },
  };
  const context = vm.createContext({
    state,
    els,
    confirm: (message) => {
      confirmations.push(message);
      return true;
    },
    actionConfirmMessage: () => "confirm",
    repoPathSnapshot: () => state.data.repo.path,
    currentBranchSnapshotPayload: () => ({ expectedHead: state.data.repo.headSha }),
    isCurrentRepoPath: () => true,
    api: async (_path, options) => {
      const payload = JSON.parse(options.body);
      actions.push(payload);
      return { output: payload.action === "commit" ? "committed" : "pushed" };
    },
    loadStateForRepoPath: async () => ({
      ...state.data,
      repo: { ...state.data.repo, headSha: "b" },
      commits: [{ sha: "b" }],
      sync: { ...state.data.sync, upstreamSha: "b" },
    }),
    renderAll() {},
    loadCommit: async () => {},
    renderInspector() {},
    reportDesktopRecoveryState() {},
    offerRecoveryUndo() {},
    toast() {},
    t: (value) => value,
  });
  vm.runInContext(runActionSource, context);

  await context.runAction("commit");

  assert.deepEqual(actions.map((item) => item.action), ["commit", "push"]);
  assert.equal(actions[0].expectedHead, "a");
  assert.equal(actions[1].expectedHead, "b");
  assert.equal(confirmations.length, 1);
});
