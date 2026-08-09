"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createGitOperationsService } = require("../server/git-operations-service");

const SNAPSHOT = "a".repeat(64);

test("current HEAD snapshot failures stop the write action", async () => {
  let writeCalled = false;
  const service = createService(async (_repo, args) => {
    if (args[0] === "rev-parse" && args.includes("HEAD^{commit}")) throw new Error("HEAD read failed");
    if (args[0] === "add") writeCalled = true;
    return "";
  });

  await assert.rejects(
    () => service.runAction({
      action: "stageAll",
      expectedBranch: "main",
      expectedHead: "1".repeat(40),
      expectedWorktreeSnapshot: SNAPSHOT,
    }),
    /HEAD read failed/
  );
  assert.equal(writeCalled, false);
});

test("upstream snapshot failures are not treated as an unset upstream", async () => {
  const service = createService(async (_repo, args) => {
    if (args[0] === "for-each-ref" || args.includes("@{u}")) throw new Error("upstream read failed");
    return "";
  });

  await assert.rejects(
    () => service.runAction({ action: "unsetUpstream", expectedBranch: "main", expectedUpstream: "" }),
    /upstream read failed/
  );
});

test("worktree snapshot failures stop whole-worktree actions", async () => {
  let writeCalled = false;
  const service = createService(async (_repo, args) => {
    if (args[0] === "status") throw new Error("worktree status failed");
    if (args[0] === "add") writeCalled = true;
    return "";
  });

  await assert.rejects(
    () => service.runAction({ action: "stageAll", expectedBranch: "main", expectedWorktreeSnapshot: SNAPSHOT }),
    /worktree status failed/
  );
  assert.equal(writeCalled, false);
});

test("file snapshot failures stop file actions", async () => {
  let writeCalled = false;
  const service = createService(async (_repo, args) => {
    if (args[0] === "status") throw new Error("file status failed");
    if (args[0] === "add") writeCalled = true;
    return "";
  });

  await assert.rejects(
    () => service.runAction({ action: "stageFile", file: "note.txt", expectedFileSnapshot: SNAPSHOT }),
    /file status failed/
  );
  assert.equal(writeCalled, false);
});

test("full status fallback failures stop file actions", async () => {
  let statusCalls = 0;
  let writeCalled = false;
  const service = createService(async (_repo, args) => {
    if (args[0] === "status") {
      statusCalls += 1;
      if (statusCalls === 1) return "partial";
      throw new Error("full status failed");
    }
    if (args[0] === "add") writeCalled = true;
    return "";
  });

  await assert.rejects(
    () => service.runAction({ action: "stageFile", file: "note.txt", expectedFileSnapshot: SNAPSHOT }),
    /full status failed/
  );
  assert.equal(writeCalled, false);
});

test("worktree prune snapshot failures stop cleanup", async () => {
  let listCalls = 0;
  const service = createService(async (_repo, args) => {
    if (args[0] === "worktree" && args[1] === "list") {
      listCalls += 1;
      if (listCalls === 1) throw new Error("worktree list failed");
    }
    return "";
  });

  await assert.rejects(
    () => service.runAction({
      action: "pruneWorktrees",
      branch: "feature/test",
      expectedWorktreePruneSnapshot: SNAPSHOT,
    }),
    /worktree list failed/
  );
  assert.equal(listCalls, 1);
});

function createService(git) {
  const repositoryService = {
    buildWorktreePruneSnapshot: () => SNAPSHOT,
    commandResult: (output) => ({ ok: true, output: String(output || "") }),
    commandResultWithSummary: (summary, output) => ({ ok: true, output: [summary, output].filter(Boolean).join("\n") }),
    detectRepoOperation: () => null,
    normalizeBranchName: (value) => String(value || ""),
    normalizeRepoFile: (value) => String(value || ""),
    parseSimpleLines: (value) => String(value || "").split(/\r?\n/).filter(Boolean),
    parseStatus: () => [],
    parseWorktreeList: () => [],
    readBranchDisplayName: async () => "main",
    readCurrentSyncState: async () => ({ upstream: "" }),
    readWorkingStatus: async (_repo, statusOutput) => ({
      files: statusOutput === "partial" ? [] : [{ file: "note.txt", snapshot: SNAPSHOT }],
      snapshot: SNAPSHOT,
    }),
    selectStatusFile: (files, file) => files.find((item) => item.file === file) || null,
    worktreePruneEntries: () => [],
  };

  return createGitOperationsService({
    git,
    gitStandalone: git,
    getCurrentRepo: () => "C:\\repo",
    getRepoSwitchInProgress: () => false,
    activeOperations: new Map(),
    operationLog: [],
    repositoryService,
    repositoryHistoryService: {},
    terminateOperationProcess: async () => 0,
    friendlyErrorMessage: (error) => error.message,
    formatDuration: () => "0 秒",
    shortText: (value) => String(value || ""),
    cancellableActions: new Set(),
    repoSwitchingActions: new Set(),
    remoteConfigSnapshotActions: new Set(),
    tagRemoteSnapshotActions: new Set(),
    remoteBranchSnapshotActions: new Set(),
    targetRefSnapshotActions: new Set(),
    fileSnapshotActions: new Set(["stageFile"]),
    worktreeSnapshotActions: new Set(["stageAll"]),
    operationSnapshotActions: new Set(),
    worktreePruneSnapshotActions: new Set(["pruneWorktrees"]),
    allRemoteConfigSnapshotActions: new Set(),
    upstreamSnapshotActions: new Set(["unsetUpstream"]),
    currentBranchSnapshotActions: new Set(["stageAll", "unsetUpstream"]),
    operationOutputLimit: 24 * 1024,
    protectedBranchNames: new Set(["main", "master", "develop"]),
    recoveryRefPrefix: "refs/forkline/recovery",
    zeroOid: "0".repeat(40),
    fileEditorDiffContext: 0,
    basicCommitLogFormat: "%H",
    gitLogFieldSeparator: "\x1f",
  });
}
