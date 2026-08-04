"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { createGitBranchService } = require("../server/git-branch-service");
const { createGitRecoveryService } = require("../server/git-recovery-service");
const { createRepositoryAuthService } = require("../server/repository-auth-service");
const { createRepositoryBrowseService } = require("../server/repository-browse-service");
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
