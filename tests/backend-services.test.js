"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createGitBranchService } = require("../server/git-branch-service");
const { createGitRecoveryService } = require("../server/git-recovery-service");
const { createRepositoryAuthService } = require("../server/repository-auth-service");
const { createRepositoryBrowseService } = require("../server/repository-browse-service");
const { createRepositoryService } = require("../server/repository-service");
const { createRepositoryStateService } = require("../server/repository-state-service");
const {
  extractSelectedLinePatch,
  extractSingleHunkPatch,
  normalizeDiffLineSelections,
} = require("../server/worktree-patch");

test("worktree patch helpers isolate requested hunks and selected lines", () => {
  const diff = [
    "diff --git a/note.txt b/note.txt",
    "index 1111111..2222222 100644",
    "--- a/note.txt",
    "+++ b/note.txt",
    "@@ -1,3 +1,3 @@",
    " first",
    "-old one",
    "+new one",
    " third",
    "@@ -10,2 +10,2 @@",
    " ten",
    "-old two",
    "+new two",
    "",
  ].join("\n");

  const secondHunk = extractSingleHunkPatch(diff, 1);
  assert.match(secondHunk, /old two/);
  assert.doesNotMatch(secondHunk, /old one/);

  const selections = normalizeDiffLineSelections([
    { hunkIndex: 0, lineIndex: 2 },
    { hunkIndex: 0, lineIndex: 2 },
  ]);
  assert.deepEqual(selections, [{ hunkIndex: 0, lineIndex: 2, key: "0:2" }]);
  const selectedPatch = extractSelectedLinePatch(diff, selections, "stage");
  assert.match(selectedPatch, /\+new one/);
  assert.doesNotMatch(selectedPatch, /old two|new two/);
});

test("repository browse helpers keep paths inside the selected root", () => {
  const browse = createRepositoryBrowseService({ getCurrentRepo: () => "" });
  const root = path.resolve("repository-root");
  const child = path.join(root, "src", "main.c");
  const sibling = path.resolve("repository-other", "main.c");

  assert.equal(browse.isPathInside(root, child), true);
  assert.equal(browse.isPathInside(root, root), false);
  assert.equal(browse.isPathInside(root, sibling), false);
  assert.equal(browse.sameFsPath(root, root.replaceAll(path.sep, "/")), true);
});

test("repository auth helpers normalize remote URLs and encode review links", () => {
  const auth = createRepositoryAuthService({
    getCurrentRepo: () => "",
    authDiagnosticsCache: new Map(),
  });

  assert.equal(auth.remoteWebBase("git@github.com:owner/repo.git"), "https://github.com/owner/repo");
  assert.equal(auth.remoteWebBase("ssh://git@gitlab.com/group/repo.git"), "https://gitlab.com/group/repo");
  assert.equal(auth.remoteWebBase("https://token@example.com/team/repo.git"), "https://example.com/team/repo");
  assert.equal(
    auth.buildPullRequestUrl("https://github.com/owner/repo", "github", "feature/review", "main"),
    "https://github.com/owner/repo/compare/main...feature%2Freview?expand=1"
  );
  assert.equal(
    auth.buildPullRequestUrl("https://gitlab.com/group/repo", "gitlab", "feature/review", "develop"),
    "https://gitlab.com/group/repo/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2Freview&merge_request%5Btarget_branch%5D=develop"
  );
});

test("repository auth helpers expose hosted platform status and safely open system credentials", async () => {
  let launchCount = 0;
  const auth = createRepositoryAuthService({
    getCurrentRepo: () => "C:\\repo",
    authDiagnosticsCache: new Map(),
    extractRemoteHost: () => "github.com",
    platform: "win32",
    launchSystemCredentialManager: async () => {
      launchCount += 1;
    },
  });

  const remote = auth.remoteAuthSummary({
    name: "origin",
    fetchUrl: "https://github.com/example/forkline.git",
    pushUrl: "https://github.com/example/forkline.git",
  });
  assert.equal(remote.kind, "https");
  assert.equal(remote.platform, "github");
  assert.equal(remote.platformLabel, "GitHub");
  assert.equal(remote.statusUrl, "https://www.githubstatus.com/");

  assert.deepEqual(auth.systemCredentialManagerStatus(), {
    available: true,
    canOpen: true,
    name: "Windows 凭据管理器",
    message: "可打开 Windows 凭据管理器查看或更新 Git HTTPS 登录信息。",
  });
  const opened = await auth.openSystemCredentialManager();
  assert.equal(opened.ok, true);
  assert.equal(launchCount, 1);

  const unsupported = createRepositoryAuthService({
    getCurrentRepo: () => "C:\\repo",
    authDiagnosticsCache: new Map(),
    platform: "linux",
  });
  assert.equal(unsupported.systemCredentialManagerStatus().canOpen, false);
  await assert.rejects(() => unsupported.openSystemCredentialManager(), /暂不支持/);
});

test("recovery retention policy validates limits and selects expired overflow points", () => {
  const recovery = createGitRecoveryService({
    getCurrentRepo: () => "",
    recoveryRefPrefix: "refs/forkline/recovery",
    zeroOid: "0".repeat(40),
  });
  const policy = recovery.normalizeRecoveryRetentionPolicy({ keepDays: "30", maxPerBranch: "1" });
  assert.deepEqual(policy, { keepDays: 30, maxPerBranch: 1 });
  assert.throws(
    () => recovery.normalizeRecoveryRetentionPolicy({ keepDays: 0, maxPerBranch: 0 }),
    /至少设置一个恢复点保留规则/
  );

  const points = [
    recoveryPoint("main-new", "main", "20260804-110000"),
    recoveryPoint("main-second", "main", "20260803-110000"),
    recoveryPoint("main-old", "main", "20260601-110000"),
    recoveryPoint("feature-new", "feature", "20260802-110000"),
  ];
  const plan = recovery.recoveryRetentionPlan(points, policy, new Date(2026, 7, 4, 12, 0, 0));
  assert.equal(plan.keepCount, 2);
  assert.equal(plan.deleteCount, 2);
  assert.deepEqual(plan.deletePoints.map((point) => point.ref), ["main-second", "main-old"]);
});

test("branch service protects configured trunk names case-insensitively", () => {
  const branches = createGitBranchService({
    getCurrentRepo: () => "",
    recoveryService: {},
    worktreeService: {},
    repositoryService: {},
    protectedBranchNames: new Set(["main", "master", "develop"]),
  });

  assert.equal(branches.isProtectedBranchName("MAIN"), true);
  assert.equal(branches.isProtectedBranchName("develop"), true);
  assert.equal(branches.isProtectedBranchName("feature/main"), false);
});

test("repository branch display reads the worktree HEAD file before spawning Git", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-head-read-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repoPath = path.join(root, "repo");
  await fs.mkdir(path.join(repoPath, ".git"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".git", "HEAD"), "ref: refs/heads/feature/direct-head\n", "utf8");
  let gitReads = 0;
  const repository = createRepositoryServiceForTest({
    repoPath,
    git: async () => {
      gitReads += 1;
      return "fallback";
    },
  });

  assert.equal(await repository.readBranchDisplayName(repoPath), "feature/direct-head");
  assert.equal(gitReads, 0);
});

test("repository state helpers clamp history pages and select graph mode", () => {
  const state = createRepositoryStateService({
    getCurrentRepo: () => null,
    submoduleService: {},
    worktreeService: {},
    defaultHistoryLimit: 120,
    maxHistoryLimit: 5000,
    refCommitLogFormat: "%H",
    laneColors: ["#00aabb"],
    operationLog: [],
    listRunningOperations: () => [],
  });

  assert.equal(state.normalizeHistoryLimit("invalid"), 120);
  assert.equal(state.normalizeHistoryLimit(1), 20);
  assert.equal(state.normalizeHistoryLimit(6000), 5000);
  const page = state.historyPage([{ sha: "a" }, { sha: "b" }, { sha: "c" }], 2);
  assert.deepEqual(page.commits.map((commit) => commit.sha), ["a", "b"]);
  assert.equal(page.history.hasMore, true);
  assert.deepEqual(state.logArgs("main", 120).slice(-2), ["--first-parent", "main"]);
  assert.deepEqual(state.logArgs("", 120).slice(-2), ["--branches", "--remotes"]);
});

test("repository core state skips deferred Git readers and enrichers", async () => {
  const gitCalls = [];
  const headSha = "a".repeat(40);
  const remoteSha = "b".repeat(40);
  const combinedBranchOutput = [
    `refs/heads/main\tmain\t${headSha}\t${headSha.slice(0, 7)}\t2 hours ago\t1730000000\t2 hours ago\tcommit\torigin/main\t\tlatest`,
    `refs/heads/feature/test\tfeature/test\t${headSha}\t${headSha.slice(0, 7)}\t3 hours ago\t1729990000\t3 hours ago\tcommit\t\t\tfeature`,
    `refs/remotes/origin/main\torigin/main\t${remoteSha}\t${remoteSha.slice(0, 7)}\t4 hours ago\t1729980000\t4 hours ago\tcommit\t\t\tremote`,
  ].join("\n");
  let submoduleConfigChecks = 0;
  let worktreeEnrichCalls = 0;
  let submoduleEnrichCalls = 0;
  const repoPath = path.resolve("repository-root");
  const state = createRepositoryStateService({
    git: async (_repoPath, args) => {
      gitCalls.push(args);
      if (args[0] === "rev-parse") return headSha;
      if (args[0] === "branch" && args.includes("--all")) return combinedBranchOutput;
      if (args[0] === "remote" && args.length === 1) return "origin";
      if (args[0] === "worktree") return `worktree ${repoPath}\nHEAD ${"a".repeat(40)}\nbranch refs/heads/main\n`;
      return "";
    },
    getCurrentRepo: () => repoPath,
    submoduleService: {
      buildWorktreePruneSnapshot: () => "prune-snapshot",
      enrichSubmodules: async () => { submoduleEnrichCalls += 1; return []; },
      enrichWorktreeList: async () => { worktreeEnrichCalls += 1; return []; },
      parseSubmodules: () => [],
      parseWorktreeBranches: () => ({}),
      parseWorktreeList: () => [],
      repoHasSubmoduleConfig: () => { submoduleConfigChecks += 1; return true; },
      submoduleConfigArgs: () => ["config", "--file", ".gitmodules", "--get-regexp", "path"],
    },
    worktreeService: {
      parseLog: () => [],
      parseStashList: () => [],
      readCurrentSyncDetails: async () => ({ branch: "main" }),
      readWorkingStatus: async () => ({ files: [], snapshot: "worktree-snapshot" }),
      sha256Json: () => "snapshot",
    },
    readBranchDisplayName: async () => "main",
    parseRemoteNames: () => ["origin"],
    parseRemoteDetails: () => [],
    isKnownRemoteBranch: (value) => value === "origin/main",
    parseBranchTracking: () => ({ main: {} }),
    mergeBranchInfo: (...sources) => Object.assign({}, ...sources),
    parseBranchCleanupMeta: () => ({}),
    parseRemoteBranchInfo: () => ({ "origin/main": { sha: remoteSha, short: remoteSha.slice(0, 7) } }),
    parseSimpleLines: () => [],
    buildBranchCleanup: () => [],
    parseTags: () => [],
    parseRecoveryPoints: () => [],
    detectRepoOperation: () => null,
    recoveryRefPrefix: "refs/forkline/recovery",
    defaultHistoryLimit: 120,
    maxHistoryLimit: 5000,
    refCommitLogFormat: "%H",
    laneColors: ["#00aabb"],
    operationLog: [],
    listRunningOperations: () => [],
  });

  const core = await state.readState("", 120, { details: "core" });

  assert.equal(core.worktreePruneSnapshot, "prune-snapshot");
  assert.equal(core.worktrees, undefined);
  assert.equal(core.submodules, undefined);
  assert.equal(core.stashes, undefined);
  assert.equal(core.recoveryPoints, undefined);
  assert.deepEqual(core.branches, ["main", "feature/test"]);
  assert.deepEqual(core.remotes, ["origin/main"]);
  assert.equal(core.remoteInfo["origin/main"].sha, remoteSha);
  assert.equal(submoduleConfigChecks, 0);
  assert.equal(worktreeEnrichCalls, 0);
  assert.equal(submoduleEnrichCalls, 0);
  assert.equal(gitCalls.some((args) => args[0] === "stash"), false);
  assert.equal(gitCalls.some((args) => args[0] === "submodule"), false);
  assert.equal(gitCalls.some((args) => args[0] === "branch" && args.includes("--merged")), false);
  assert.equal(gitCalls.filter((args) => args[0] === "branch" && args.includes("--all")).length, 1);
  assert.equal(gitCalls.some((args) => args[0] === "for-each-ref" && ["refs/heads", "refs/remotes"].includes(args[1])), false);
  assert.equal(gitCalls.some((args) => args[0] === "for-each-ref" && args[1] === "refs/forkline/recovery"), false);
});

test("progressive repository open reuses branch and remote snapshots", async () => {
  const headSha = "a".repeat(40);
  const upstreamSha = "b".repeat(40);
  const combinedBranchOutput = [
    `refs/heads/main\tmain\t${headSha}\t${headSha.slice(0, 7)}\t2 hours ago\t1730000000\t2 hours ago\tcommit\torigin/main\t[ahead 2, behind 1]\tlatest`,
    `refs/remotes/origin/main\torigin/main\t${upstreamSha}\t${upstreamSha.slice(0, 7)}\t3 hours ago\t1729990000\t3 hours ago\tcommit\t\t\tremote latest`,
  ].join("\n");
  const repoPath = path.resolve("repository-root");
  const gitCalls = [];
  let branchReads = 0;
  let syncOptions = null;
  let trackingInput = "";
  let remoteMetaInput = "";
  const state = createRepositoryStateService({
    git: async (_repoPath, args) => {
      gitCalls.push(args);
      if (args[0] === "rev-parse") return headSha;
      if (args[0] === "branch") return combinedBranchOutput;
      if (args[0] === "remote" && args.length === 1) return "origin";
      if (args[0] === "remote") return "origin\thttps://example.invalid/repo.git (fetch)\norigin\thttps://example.invalid/repo.git (push)";
      return "";
    },
    getCurrentRepo: () => repoPath,
    submoduleService: {
      buildWorktreePruneSnapshot: () => "",
      enrichSubmodules: async () => [],
      enrichWorktreeList: async () => [],
      parseSubmodules: () => [],
      parseWorktreeBranches: () => ({}),
      parseWorktreeList: () => [],
      repoHasSubmoduleConfig: () => false,
      submoduleConfigArgs: () => [],
    },
    worktreeService: {
      parseLog: () => [],
      parseStashList: () => [],
      readCachedWorkingStatus: async () => ({ files: [], snapshot: "" }),
      readCurrentSyncDetails: async (_repoPath, options) => {
        syncOptions = options;
        return { upstream: options.upstream, upstreamSha: options.upstreamSha, ahead: 0, behind: 0 };
      },
      readWorkingStatus: async () => ({ files: [], snapshot: "" }),
      sha256Json: () => "",
    },
    readBranchDisplayName: async () => {
      branchReads += 1;
      return "main";
    },
    parseRemoteNames: () => ["origin"],
    parseRemoteDetails: () => [],
    isKnownRemoteBranch: (value) => value === "origin/main",
    parseBranchTracking: (output) => {
      trackingInput = output;
      return { main: { upstream: "origin/main", ahead: 2, behind: 1, upstreamGone: false } };
    },
    mergeBranchInfo: (...sources) => Object.assign({}, ...sources),
    parseBranchCleanupMeta: () => ({}),
    parseRemoteBranchInfo: (output) => {
      remoteMetaInput = output;
      return { "origin/main": { sha: upstreamSha, short: upstreamSha.slice(0, 7) } };
    },
    parseSimpleLines: () => [],
    buildBranchCleanup: () => [],
    parseTags: () => [],
    parseRecoveryPoints: () => [],
    detectRepoOperation: () => null,
    recoveryRefPrefix: "refs/forkline/recovery",
    defaultHistoryLimit: 120,
    maxHistoryLimit: 5000,
    refCommitLogFormat: "%H",
    laneColors: ["#00aabb"],
    operationLog: [],
    listRunningOperations: () => [],
  });

  const opened = await state.readOpenState();

  assert.equal(branchReads, 1);
  assert.equal(opened.repo.branch, "main");
  assert.equal(opened.repo.selectedRef, "main");
  assert.deepEqual(opened.branches, ["main"]);
  assert.deepEqual(opened.remotes, ["origin/main"]);
  assert.equal(syncOptions.branch, "main");
  assert.equal(syncOptions.upstream, "origin/main");
  assert.equal(syncOptions.upstreamSha, upstreamSha);
  assert.equal(syncOptions.ahead, 2);
  assert.equal(syncOptions.behind, 1);
  assert.equal(syncOptions.upstreamGone, false);
  assert.equal(trackingInput, "main\torigin/main\t[ahead 2, behind 1]");
  assert.equal(remoteMetaInput, `origin/main\t${upstreamSha}\t${upstreamSha.slice(0, 7)}`);
  assert.equal(gitCalls.filter((args) => args[0] === "branch").length, 1);
  assert.equal(gitCalls.some((args) => args[0] === "for-each-ref"), false);
});

test("repository open details only read data missing from the progressive response", async () => {
  const gitCalls = [];
  const branchSha = "a".repeat(40);
  const tagSha = "b".repeat(40);
  const combinedRefOutput = [
    `refs/heads/main\tmain\t${branchSha}\t${branchSha.slice(0, 7)}\t2 hours ago\t1730000000\t2 hours ago\tcommit\torigin/main\t[ahead 2, behind 1]\tlatest\tmessage`,
    `refs/tags/v1.0.0\tv1.0.0\t${tagSha}\t${tagSha.slice(0, 7)}\t\t0\t3 days ago\ttag\t\t\tRelease\tv1`,
  ].join("\n");
  let statusOptions = null;
  let branchReads = 0;
  let cachedWorkingReads = 0;
  let directWorkingReads = 0;
  let syncReads = 0;
  let trackingInput = "";
  let branchMetaInput = "";
  let tagInput = "";
  const repoPath = path.resolve("repository-root");
  const state = createRepositoryStateService({
    git: async (_repoPath, args, commandOptions) => {
      gitCalls.push(args);
      if (args[0] === "for-each-ref") return combinedRefOutput;
      if (args[0] === "worktree") return `worktree ${repoPath}\nHEAD ${"a".repeat(40)}\nbranch refs/heads/main\n`;
      if (args[0] === "status") statusOptions = commandOptions;
      return "";
    },
    getCurrentRepo: () => repoPath,
    submoduleService: {
      buildWorktreePruneSnapshot: () => "prune-snapshot",
      enrichSubmodules: async () => [],
      enrichWorktreeList: async () => [],
      parseSubmodules: () => [],
      parseWorktreeBranches: () => ({ main: { worktreePath: repoPath } }),
      parseWorktreeList: () => [],
      repoHasSubmoduleConfig: () => false,
      submoduleConfigArgs: () => [],
    },
    worktreeService: {
      parseLog: () => [],
      parseStashList: () => [],
      readCachedWorkingStatus: async () => {
        cachedWorkingReads += 1;
        return { files: [{ file: "draft.txt" }], snapshot: "worktree-snapshot" };
      },
      readCurrentSyncDetails: async () => { syncReads += 1; return {}; },
      readWorkingStatus: async () => {
        directWorkingReads += 1;
        return { files: [{ file: "draft.txt" }], snapshot: "worktree-snapshot" };
      },
      sha256Json: () => "snapshot",
    },
    readBranchDisplayName: async () => { branchReads += 1; return "main"; },
    parseRemoteNames: () => [],
    parseRemoteDetails: () => [],
    isKnownRemoteBranch: () => false,
    parseBranchTracking: (output) => {
      trackingInput = output;
      return { main: { upstream: "origin/main" } };
    },
    mergeBranchInfo: (...sources) => sources.reduce((merged, source) => {
      for (const [branch, info] of Object.entries(source || {})) {
        merged[branch] = { ...(merged[branch] || {}), ...info };
      }
      return merged;
    }, {}),
    parseBranchCleanupMeta: (output) => {
      branchMetaInput = output;
      return { main: { message: "latest" } };
    },
    parseRemoteBranchInfo: () => ({}),
    parseSimpleLines: () => [],
    buildBranchCleanup: () => [],
    parseTags: (output) => {
      tagInput = output;
      return [{ name: "v1.0.0" }];
    },
    parseRecoveryPoints: () => [],
    detectRepoOperation: () => null,
    recoveryRefPrefix: "refs/forkline/recovery",
    defaultHistoryLimit: 120,
    maxHistoryLimit: 5000,
    refCommitLogFormat: "%H",
    laneColors: ["#00aabb"],
    operationLog: [],
    listRunningOperations: () => [],
  });

  const details = await state.readOpenDetails();

  assert.deepEqual(details.repo, { operation: null });
  assert.deepEqual(details.workingFiles, [{ file: "draft.txt" }]);
  assert.equal(details.worktreeSnapshot, "worktree-snapshot");
  assert.equal(details.worktreePruneSnapshot, "prune-snapshot");
  assert.deepEqual(details.tags, [{ name: "v1.0.0" }]);
  assert.equal(details.branchInfo.main.upstream, "origin/main");
  assert.equal(details.branchInfo.main.message, "latest");
  assert.equal(branchReads, 0);
  assert.equal(cachedWorkingReads, 1);
  assert.equal(directWorkingReads, 0);
  assert.equal(syncReads, 0);
  assert.equal(gitCalls.some((args) => args[0] === "rev-parse"), false);
  assert.equal(gitCalls.some((args) => args[0] === "branch"), false);
  assert.equal(gitCalls.some((args) => args[0] === "remote"), false);
  assert.equal(gitCalls.some((args) => args[0] === "log"), false);
  assert.deepEqual(gitCalls.map((args) => args[0]), ["for-each-ref", "worktree", "status"]);
  assert.equal(trackingInput, "main\torigin/main\t[ahead 2, behind 1]");
  assert.equal(branchMetaInput, `main\t${branchSha}\t${branchSha.slice(0, 7)}\t2 hours ago\t1730000000\tlatest\tmessage`);
  assert.equal(tagInput, `v1.0.0\t${tagSha}\t${tagSha.slice(0, 7)}\t3 days ago\tRelease\tv1\ttag`);
  assert.deepEqual(statusOptions, {
    stdoutOnly: true,
    env: { GIT_OPTIONAL_LOCKS: "0" },
  });
});

test("repository switches preserve the bounded absolute-path file snapshot cache", async () => {
  const repoA = path.resolve("repository-a");
  const repoB = path.resolve("repository-b");
  let currentRepo = repoA;
  const worktreeFileSnapshotCache = new Map([
    [path.join(repoA, "draft.txt"), { fingerprint: "a", snapshot: "snapshot-a" }],
    [path.join(repoB, "draft.txt"), { fingerprint: "b", snapshot: "snapshot-b" }],
  ]);
  const git = async (repoPath, args) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return path.resolve(repoPath);
    if (args[0] === "symbolic-ref") return "main";
    if (args[0] === "rev-parse" && args.includes("--verify")) return "a".repeat(40);
    if (args[0] === "branch" && args.includes("--all")) return "refs/heads/main";
    return "";
  };
  const repository = createRepositoryService({
    git,
    gitStandalone: git,
    getCurrentRepo: () => currentRepo,
    setManagedRepo: (repoPath) => { currentRepo = repoPath; },
    operationLog: [],
    listRunningOperations: () => [],
    recoveryRefPrefix: "refs/forkline/recovery",
    worktreeDiffContext: 8,
    fileEditorDiffContext: 0,
    defaultHistoryLimit: 120,
    maxHistoryLimit: 5000,
    protectedBranchNames: new Set(["main"]),
    branchStaleDays: 30,
    worktreeSnapshotCacheLimit: 8192,
    untrackedDiffHunkSize: 200,
    gitLogFieldSeparator: "\u001f",
    refCommitLogFormat: "%H",
    laneColors: ["#00aabb"],
    authDiagnosticsCacheTtlMs: 60000,
    authDiagnosticsCacheLimit: 12,
    authDiagnosticsCache: new Map(),
    registerOwnedProcess: () => () => {},
    worktreeFileSnapshotCache,
  });

  await repository.openRepo(repoB, { progressive: true });

  assert.equal(currentRepo, repoB);
  assert.deepEqual([...worktreeFileSnapshotCache.keys()], [
    path.join(repoA, "draft.txt"),
    path.join(repoB, "draft.txt"),
  ]);
});

function recoveryPoint(ref, branch, timestamp) {
  return {
    ref,
    shortRef: `${timestamp}/${branch}/operation`,
    timestamp,
    sha: "a".repeat(40),
    short: "aaaaaaa",
    branch,
    actionLabel: "测试",
    time: timestamp,
  };
}

function createRepositoryServiceForTest(overrides = {}) {
  let currentRepo = overrides.repoPath || null;
  const git = overrides.git || (async () => "");
  return createRepositoryService({
    git,
    gitStandalone: git,
    getCurrentRepo: () => currentRepo,
    setManagedRepo: (repoPath) => { currentRepo = repoPath; },
    operationLog: [],
    listRunningOperations: () => [],
    recoveryRefPrefix: "refs/forkline/recovery",
    worktreeDiffContext: 8,
    fileEditorDiffContext: 0,
    defaultHistoryLimit: 120,
    maxHistoryLimit: 5000,
    protectedBranchNames: new Set(["main"]),
    branchStaleDays: 30,
    worktreeSnapshotCacheLimit: 8192,
    untrackedDiffHunkSize: 200,
    gitLogFieldSeparator: "\u001f",
    refCommitLogFormat: "%H",
    laneColors: ["#00aabb"],
    authDiagnosticsCacheTtlMs: 60000,
    authDiagnosticsCacheLimit: 12,
    authDiagnosticsCache: new Map(),
    registerOwnedProcess: () => () => {},
    worktreeFileSnapshotCache: new Map(),
  });
}
