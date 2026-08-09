"use strict";

const fs = require("fs");
const path = require("path");
const { createGitWorktreeService } = require("./git-worktree-service");
const { createGitRecoveryService } = require("./git-recovery-service");
const { createGitHistoryService } = require("./git-history-service");
const { createGitBranchService } = require("./git-branch-service");

function createGitOperationsService(options) {
  const {
    git,
    gitStandalone,
    getCurrentRepo,
    getRepoSwitchInProgress,
    activeOperations,
    operationLog,
    repositoryService,
    repositoryHistoryService,
    terminateOperationProcess,
    friendlyErrorMessage,
    formatDuration,
    shortText,
    cancellableActions: CANCELLABLE_ACTIONS,
    repoSwitchingActions: REPO_SWITCHING_ACTIONS,
    remoteConfigSnapshotActions: REMOTE_CONFIG_SNAPSHOT_ACTIONS,
    tagRemoteSnapshotActions: TAG_REMOTE_SNAPSHOT_ACTIONS,
    remoteBranchSnapshotActions: REMOTE_BRANCH_REMOTE_SNAPSHOT_ACTIONS,
    targetRefSnapshotActions: TARGET_REF_SNAPSHOT_ACTIONS,
    fileSnapshotActions: FILE_SNAPSHOT_ACTIONS,
    worktreeSnapshotActions: WORKTREE_SNAPSHOT_ACTIONS,
    operationSnapshotActions: OPERATION_SNAPSHOT_ACTIONS,
    worktreePruneSnapshotActions: WORKTREE_PRUNE_SNAPSHOT_ACTIONS,
    allRemoteConfigSnapshotActions: ALL_REMOTE_CONFIG_SNAPSHOT_ACTIONS,
    upstreamSnapshotActions: UPSTREAM_SNAPSHOT_ACTIONS,
    currentBranchSnapshotActions: CURRENT_BRANCH_SNAPSHOT_ACTIONS,
    operationOutputLimit: OPERATION_OUTPUT_LIMIT,
    protectedBranchNames: PROTECTED_BRANCH_NAMES,
    recoveryRefPrefix: RECOVERY_REF_PREFIX,
    zeroOid: ZERO_OID,
    fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,
    basicCommitLogFormat: BASIC_COMMIT_LOG_FORMAT,
    gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,
  } = options;
  const {
    extractRemoteHost,
    normalizeSha,
    detectRepoOperation,
    formatLocalTime,
    openRepo,
    readBranchDisplayName,
    readState,
    ensureRemoteBranchStillExists,
    ensureLiveRemoteBranchRef,
    readWorktreeDiffOutput,
    normalizeRepoFile,
    normalizeDiffScope,
    normalizeWorktreeDiffContext,
    normalizeBranchName,
    normalizeRefName,
    normalizeRemoteName,
    readRemoteNames,
    hasHeadCommit,
    readReflogOutput,
    parseRecoveryPoints,
    parseReflogEntries,
    recoveryPointFromParts,
    shortRecoveryRef,
    readRemoteBranchNames,
    ensureRemoteBranchRef,
    readRemoteDetails,
    readExplicitRemotePushUrls,
    replaceRemotePushUrls,
    defaultRemoteName,
    isKnownRemoteBranch,
    splitRemoteBranchRef,
    ensureCurrentStashRef,
    normalizeExpectedStashSha,
    normalizeStashMessage,
    normalizeStashFiles,
    normalizeTagName,
    parseWorktreeBranches,
    parseWorktreeList,
    buildWorktreePruneSnapshot,
    worktreePruneEntries,
    submoduleConfigArgs,
    repoHasSubmoduleConfig,
    parseSubmodules,
    enrichSubmodules,
    normalizeSubmodulePath,
    parseSimpleLines,
    ensureCurrentLocalTag,
    normalizeExpectedTagSha,
    ensureRemoteTag,
    sameFsPath,
    readNewFileDiff,
    commandResult,
    commandResultWithSummary,
    readCurrentSyncState,
    syncCommandResult,
    syncStateLine,
    parseStatus,
    readWorkingStatus,
    selectStatusFile,
    worktreeActionTargetScope,
    sampleState,
  } = repositoryService;
  let currentRepo = getCurrentRepo();
  let nextOperationId = 1;

  function setCurrentRepo(repoPath) {
    currentRepo = repoPath || null;
    worktreeService.setCurrentRepo(repoPath);
    recoveryService.setCurrentRepo(repoPath);
    historyService.setCurrentRepo(repoPath);
    branchService.setCurrentRepo(repoPath);
  }

  const worktreeService = createGitWorktreeService({
    git,
    getCurrentRepo: () => currentRepo,
    repositoryService,
    friendlyErrorMessage,
    shortText,
    ensureCleanWorktree: (...args) => ensureCleanWorktree(...args),
    fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,
    gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,
  });
  const {
    applyPatchText,
    applyStash,
    branchFromStash,
    createStash,
    discardAll,
    discardAllWorktreeChanges,
    discardStagedFile,
    discardWorktreeFile,
    dropStash,
    findCheckoutStash,
    ensureNoDirtySubmodulesForDiscard,
    ensureStashSelectionHasNoSubmoduleChanges,
    ignoreWorktreePath,
    popStash,
    resolveConflictFile,
    restoreCheckoutStash,
    stageAll,
    stageFile,
    stageSelectedLines,
    unstageFile,
    unstageSelectedLines,
    applyWorktreeHunk,
    validateStashFiles,
  } = worktreeService;
  const recoveryService = createGitRecoveryService({
    git,
    getCurrentRepo: () => currentRepo,
    recoveryRefPrefix: RECOVERY_REF_PREFIX,
    zeroOid: ZERO_OID,
    recoveryPointFromParts,
    shortRecoveryRef,
    parseRecoveryPoints,
    parseReflogEntries,
    readReflogOutput,
    normalizeSha,
    normalizeRefName,
    hasHeadCommit,
    resolveCommit: (...args) => resolveCommit(...args),
    currentLocalBranch: (...args) => currentLocalBranch(...args),
    ensureCleanWorktree: (...args) => ensureCleanWorktree(...args),
    ensureNoDirtySubmodulesForDiscard: (...args) => worktreeService.ensureNoDirtySubmodulesForDiscard(...args),
  });
  const {
    appendRecoveryLine,
    createRecoveryPoint,
    createRecoveryPointForCommit,
    createRecoveryPointFromReflog,
    deleteRecoveryPoint,
    deleteRecoveryPoints,
    pruneRecoveryPoints,
    recoveryPointLine,
    restoreRecoveryPoint,
    restoreReflogEntry,
  } = recoveryService;


  const historyService = createGitHistoryService({
    git,
    getCurrentRepo: () => currentRepo,
    repositoryHistoryService,
    sampleState,
    parseStatus,
    detectRepoOperation,
    normalizeSha,
    basicCommitLogFormat: BASIC_COMMIT_LOG_FORMAT,
    historyRewriteActionLabel,
    resetModeLabel,
    resolveCommit: (...args) => resolveCommit(...args),
    currentLocalBranchForRewrite: (...args) => currentLocalBranchForRewrite(...args),
    ensureCleanWorktree: (...args) => ensureCleanWorktree(...args),
    ensureNoDirtySubmodulesForDiscard: (...args) => worktreeService.ensureNoDirtySubmodulesForDiscard(...args),
    hasHeadCommit,
    commandResultWithSummary,
    recoveryService,
  });
  const {
    abortMerge,
    abortRebase,
    cherryPickCommit,
    continueCherryPick,
    continueMerge,
    continueRebase,
    continueRevert,
    readHistoryRewritePreview,
    readHistoryRewriteQueuePreview,
    resetToCommit,
    revertCommit,
    rewordCommit,
    rewriteHistoryCommit,
    rewriteHistoryQueue,
    skipRebase,
  } = historyService;
  const branchService = createGitBranchService({
    git,
    gitStandalone,
    getCurrentRepo: () => currentRepo,
    repositoryService,
    recoveryService,
    worktreeService,
    friendlyErrorMessage,
    shortText,
    protectedBranchNames: PROTECTED_BRANCH_NAMES,
    resolveCommit: (...args) => resolveCommit(...args),
    currentLocalBranch: (...args) => currentLocalBranch(...args),
    ensureCleanWorktree: (...args) => ensureCleanWorktree(...args),
    normalizeExpectedUpstreamSha: (...args) => normalizeExpectedUpstreamSha(...args),
  });
  const {
    addRemote,
    checkoutBranch,
    checkoutRemoteBranch,
    cloneRepository,
    createBranch,
    createTag,
    createWorktree,
    deleteBranch,
    deleteBranches,
    deleteRemote,
    deleteRemoteBranch,
    deleteRemoteTag,
    deleteTag,
    fetchRemote,
    fetchRemotes,
    forcePushCurrentBranchWithLease,
    initRepository,
    initSubmodules,
    mergeRef,
    openWorktree,
    pruneAllWorktrees,
    pruneWorktrees,
    pullCurrentBranch,
    pullRebaseCurrentBranch,
    pushCurrentBranch,
    pushTag,
    rebaseOntoRef,
    renameBranch,
    setCurrentBranchUpstream,
    setRemoteUrl,
    syncSubmodules,
    testRemote,
    unsetCurrentBranchUpstream,
    updateSubmodules,
  } = branchService;
  async function runAction(body, operation) {
    const action = body.action;
    if (action === "cloneRepository") {
      return cloneRepository(body, operation);
    }
    if (action === "initRepository") {
      return initRepository(body);
    }
    if (!currentRepo) {
      return { ok: true, sample: true, output: "示例模式不会执行真实 Git 命令" };
    }
    await ensureRemoteConfigSnapshot(body);
    await ensureCurrentBranchSnapshot(body);
    await ensureTargetRefSnapshot(body);
    await ensureWorktreeSnapshot(body);
    await ensureFileSnapshot(body);
    await ensureOperationSnapshot(body);
    await ensureWorktreePruneSnapshot(body);
    if (action === "createWorktree") {
      return createWorktree(body);
    }
    if (action === "openWorktree") {
      return openWorktree(body);
    }
    if (action === "pruneAllWorktrees") {
      return pruneAllWorktrees();
    }
    if (action === "initSubmodules") {
      return initSubmodules(operation);
    }
    if (action === "updateSubmodules") {
      return updateSubmodules(body, operation);
    }
    if (action === "syncSubmodules") {
      return syncSubmodules();
    }
    if (action === "fetch") {
      return fetchRemotes(operation);
    }
    if (action === "pull") {
      return pullCurrentBranch(operation);
    }
    if (action === "pullRebase") {
      return pullRebaseCurrentBranch(operation);
    }
    if (action === "push") {
      return pushCurrentBranch(operation);
    }
    if (action === "forcePushLease") {
      return forcePushCurrentBranchWithLease(body, operation);
    }
    if (action === "fetchRemote") {
      return fetchRemote(body, operation);
    }
    if (action === "testRemote") {
      return testRemote(body);
    }
    if (action === "addRemote") {
      return addRemote(body);
    }
    if (action === "setRemoteUrl") {
      return setRemoteUrl(body);
    }
    if (action === "deleteRemote") {
      return deleteRemote(body);
    }
    if (action === "setUpstream") {
      return setCurrentBranchUpstream(body);
    }
    if (action === "unsetUpstream") {
      return unsetCurrentBranchUpstream();
    }
    if (action === "stageAll") {
      return stageAll();
    }
    if (action === "discardAll") {
      return discardAll();
    }
    if (action === "continueRevert") {
      return continueRevert();
    }
    if (action === "abortRevert") {
      return commandResult(await git(currentRepo, ["revert", "--abort"], { timeout: 120000 }) || "已中止还原，工作区已回到还原前状态");
    }
    if (action === "continueCherryPick") {
      return continueCherryPick();
    }
    if (action === "skipCherryPick") {
      return commandResult(await git(currentRepo, ["cherry-pick", "--skip"], { timeout: 120000 }) || "已跳过当前挑选提交");
    }
    if (action === "abortCherryPick") {
      return commandResult(await git(currentRepo, ["cherry-pick", "--abort"], { timeout: 120000 }) || "已中止挑选，工作区已回到挑选前状态");
    }
    if (action === "continueMerge") {
      return continueMerge();
    }
    if (action === "abortMerge") {
      return abortMerge();
    }
    if (action === "continueRebase") {
      return continueRebase();
    }
    if (action === "skipRebase") {
      return skipRebase();
    }
    if (action === "abortRebase") {
      return abortRebase();
    }
    if (action === "checkoutBranch") {
      return checkoutBranch(body);
    }
    if (action === "checkoutRemoteBranch") {
      return checkoutRemoteBranch(body);
    }
    if (action === "createBranch") {
      return createBranch(body);
    }
    if (action === "renameBranch") {
      return renameBranch(body);
    }
    if (action === "deleteBranch") {
      return deleteBranch(body);
    }
    if (action === "deleteBranches") {
      return deleteBranches(body);
    }
    if (action === "deleteRemoteBranch") {
      return deleteRemoteBranch(body);
    }
    if (action === "mergeRef") {
      return mergeRef(body);
    }
    if (action === "rebaseOntoRef") {
      return rebaseOntoRef(body);
    }
    if (action === "createTag") {
      return createTag(body);
    }
    if (action === "deleteTag") {
      return deleteTag(body);
    }
    if (action === "pushTag") {
      return pushTag(body);
    }
    if (action === "deleteRemoteTag") {
      return deleteRemoteTag(body);
    }
    if (action === "pruneWorktrees") {
      return pruneWorktrees(body);
    }
    if (action === "findCheckoutStash") {
      return findCheckoutStash(body);
    }
    if (action === "restoreCheckoutStash") {
      return commandResult(await restoreCheckoutStash(body));
    }
    if (action === "createStash") {
      return createStash(body);
    }
    if (action === "applyStash") {
      return applyStash(body);
    }
    if (action === "popStash") {
      return popStash(body);
    }
    if (action === "dropStash") {
      return dropStash(body);
    }
    if (action === "branchFromStash") {
      return branchFromStash(body);
    }
    if (action === "applyPatch") {
      return applyPatchText(body);
    }
    if (action === "restoreRecoveryPoint") {
      return restoreRecoveryPoint(body);
    }
    if (action === "createRecoveryPointFromReflog") {
      return createRecoveryPointFromReflog(body);
    }
    if (action === "restoreReflogEntry") {
      return restoreReflogEntry(body);
    }
    if (action === "deleteRecoveryPoint") {
      return deleteRecoveryPoint(body);
    }
    if (action === "deleteRecoveryPoints") {
      return deleteRecoveryPoints(body);
    }
    if (action === "pruneRecoveryPoints") {
      return pruneRecoveryPoints(body);
    }
    if (action === "stageFile") {
      return stageFile(body);
    }
    if (action === "ignoreWorktreePath") {
      return commandResult(await ignoreWorktreePath(body));
    }
    if (action === "unstageFile") {
      return commandResult(await unstageFile(body));
    }
    if (action === "resolveConflictFile") {
      return commandResult(await resolveConflictFile(body));
    }
    if (action === "stageHunk") {
      return commandResult(await applyWorktreeHunk(body, "stage"));
    }
    if (action === "stageSelectedLines") {
      return commandResult(await stageSelectedLines(body));
    }
    if (action === "unstageSelectedLines") {
      return commandResult(await unstageSelectedLines(body));
    }
    if (action === "unstageHunk") {
      return commandResult(await applyWorktreeHunk(body, "unstage"));
    }
    if (action === "discardWorktreeHunk") {
      return commandResult(await applyWorktreeHunk(body, "discard"));
    }
    if (action === "discardWorktreeFile") {
      return commandResult(await discardWorktreeFile(body));
    }
    if (action === "discardStagedFile") {
      return commandResult(await discardStagedFile(body));
    }
    if (action === "commit") {
      const summary = String(body.summary || "").trim();
      const detail = String(body.body || "").trim();
      if (!summary) throw new Error("请填写提交摘要");
      const args = ["commit", "-m", summary];
      if (detail) args.push("-m", detail);
      return commandResult(await git(currentRepo, args, { timeout: 120000 }));
    }
    if (action === "amendCommit") {
      if (!(await hasHeadCommit(currentRepo))) {
        const branch = (await readBranchDisplayName(currentRepo).catch(() => "当前分支")).trim() || "当前分支";
        throw new Error(`${branch} 还没有上一次提交，不能追加提交。请先创建首个提交。`);
      }
      const summary = String(body.summary || "").trim();
      const detail = String(body.body || "").trim();
      const args = ["commit", "--amend"];
      if (!summary && !detail) {
        args.push("--no-edit");
      } else {
        if (!summary) throw new Error("覆盖上一次提交信息时，请填写提交摘要");
        args.push("-m", summary);
        if (detail) args.push("-m", detail);
      }
      const recovery = await createRecoveryPoint("amend");
      return appendRecoveryLine(commandResult(await git(currentRepo, args, { timeout: 120000 })), recovery);
    }
    if (action === "rewordCommit") {
      return rewordCommit(body);
    }
    if (action === "rewriteHistoryCommit") {
      return rewriteHistoryCommit(body);
    }
    if (action === "rewriteHistoryQueue") {
      return rewriteHistoryQueue(body);
    }
    if (action === "cherryPickCommit") {
      return cherryPickCommit(body);
    }
    if (action === "revertCommit") {
      return revertCommit(body);
    }
    if (action === "resetToCommit") {
      return resetToCommit(body);
    }
    throw new Error("未知操作");
  }

  function actionChangesRepo(body = {}) {
    const action = String(body.action || "");
    if (!REPO_SWITCHING_ACTIONS.has(action)) return false;
    if (action === "cloneRepository" || action === "initRepository") return body.openAfter !== false;
    return true;
  }

  function hasRunningOperation(excludeId = 0) {
    return [...activeOperations.keys()].some((id) => id !== excludeId);
  }

  function hasRunningRepoSwitchOperation(excludeId = 0) {
    return [...activeOperations.values()].some((operation) => operation.id !== excludeId && operation.repoSwitching);
  }

  function ensureCanSwitchRepo(excludeId = 0) {
    if (getRepoSwitchInProgress() || hasRunningOperation(excludeId)) {
      throw new Error("当前还有 Git 操作正在执行，暂不能切换仓库。请等待右侧操作日志中的任务完成后再切换，避免命令执行到错误仓库。");
    }
  }

  function ensureCanStartAction(body = {}, operation = {}) {
    if (getRepoSwitchInProgress()) {
      throw new Error("正在切换仓库，暂不能执行新的 Git 操作。请稍后重试。");
    }
    if (hasRunningRepoSwitchOperation(operation.id)) {
      throw new Error("正在切换仓库，暂不能执行新的 Git 操作。请稍后重试。");
    }
    if (hasRunningOperation(operation.id)) {
      if (actionChangesRepo(body)) {
        throw new Error("当前还有 Git 操作正在执行，暂不能切换仓库。请等待右侧操作日志中的任务完成后再切换，避免命令执行到错误仓库。");
      }
      throw new Error("当前还有 Git 操作正在执行，暂不能执行新的 Git 操作。请等待右侧操作日志中的任务完成后再继续，避免多个命令同时修改仓库状态。");
    }
  }

  function beginOperation(body = {}) {
    const action = String(body.action || "");
    const operation = {
      id: nextOperationId++,
      action,
      label: actionLabel(body),
      repoSwitching: actionChangesRepo(body),
      startedAt: Date.now(),
      cancelSupported: CANCELLABLE_ACTIONS.has(action),
      cancelRequested: false,
      command: "",
      outputTail: "",
      processes: new Set(),
      pid: 0,
    };
    activeOperations.set(operation.id, operation);
    return operation;
  }

  function recordOperation(operation, body, status, detail) {
    const finishedAt = Date.now();
    operationLog.unshift({
      id: `${finishedAt}-${operation?.id || nextOperationId}`,
      status,
      action: String(body?.action || ""),
      label: operation?.label || actionLabel(body),
      startedAt: operation?.startedAt || finishedAt,
      finishedAt,
      durationMs: Math.max(0, finishedAt - (operation?.startedAt || finishedAt)),
      time: formatLocalTime(new Date(finishedAt)),
      summary: shortText(detail, 700),
      command: operation?.command || "",
      outputTail: String(operation?.outputTail || detail || "").trim().slice(-OPERATION_OUTPUT_LIMIT),
    });
    if (operationLog.length > 40) operationLog.length = 40;
  }

  function actionOutputSummary(result) {
    if (typeof result === "string") return result;
    if (!result || typeof result !== "object") return "";
    return result.output || result.message || result.error || "";
  }

  function listRunningOperations(excludeId) {
    const now = Date.now();
    return [...activeOperations.values()]
      .filter((operation) => operation.id !== excludeId)
      .slice(0, 8)
      .map((operation) => ({
        id: String(operation.id),
        action: operation.action || "",
        label: operation.label,
        startedAt: operation.startedAt,
        startedTime: formatLocalTime(new Date(operation.startedAt)),
        durationMs: Math.max(0, now - operation.startedAt),
        elapsed: formatDuration(now - operation.startedAt),
        command: operation.command || "",
        outputTail: String(operation.outputTail || "").trim(),
        phase: operationPhase(operation),
        cancelSupported: operation.cancelSupported,
        cancelRequested: operation.cancelRequested,
        cancellable: operationCanCancel(operation),
      }));
  }

  function operationPhase(operation) {
    if (operation.cancelRequested) return "cancelling";
    if (!operation.command) return "preparing";
    if (operation.processes.size) return "running";
    return "finishing";
  }

  function operationCanCancel(operation) {
    if (!operation.cancelSupported || operation.cancelRequested) return false;
    return !operation.command || operation.processes.size > 0;
  }

  async function cancelActiveOperation(rawId) {
    const id = Number.parseInt(String(rawId || ""), 10);
    const operation = activeOperations.get(id);
    if (!operation) throw new Error("这个 Git 操作已经结束，请刷新操作日志查看结果。");
    if (!operation.cancelSupported) throw new Error("这个 Git 操作不支持取消，请等待执行完成。");
    if (operation.cancelRequested) return operation;
    if (!operationCanCancel(operation)) throw new Error("Git 命令已经执行完成，正在整理结果，不能再取消。");

    operation.cancelRequested = true;
    operation.cancelRequestedAt = Date.now();
    operation.cancelledProcessCount = operation.processes.size;
    await Promise.all([...operation.processes].map((child) => terminateOperationProcess(child)));
    return operation;
  }

  function actionLabel(body = {}) {
    const action = String(body.action || "");
    const file = body.file ? shortText(body.file, 72) : "";
    const ref = body.ref ? shortText(body.ref, 72) : "";
    const branch = body.branch ? shortText(body.branch, 72) : "";
    const labels = {
      fetch: "抓取远端",
      pull: "拉取远端",
      pullRebase: "变基拉取远端",
      push: "推送到远端",
      forcePushLease: "安全强推到远端",
      cloneRepository: body.targetPath ? `克隆仓库到 ${shortText(body.targetPath, 72)}` : "克隆仓库",
      initRepository: body.targetPath ? `初始化仓库到 ${shortText(body.targetPath, 72)}` : "初始化仓库",
      createWorktree: body.targetPath ? `创建工作树 ${shortText(body.targetPath, 72)}` : "创建工作树",
      openWorktree: body.path ? `打开工作树 ${shortText(body.path, 72)}` : "打开工作树",
      pruneAllWorktrees: "清理失效工作树记录",
      initSubmodules: "初始化子模块",
      updateSubmodules: body.path ? `更新子模块 ${shortText(body.path, 72)}` : "更新子模块",
      syncSubmodules: "同步子模块 URL",
      fetchRemote: body.name ? `抓取远端 ${shortText(body.name, 72)}` : "抓取指定远端",
      testRemote: body.name ? `检查远端 ${shortText(body.name, 72)}` : "检查远端连接",
      addRemote: body.name ? `添加远端 ${shortText(body.name, 72)}` : "添加远端",
      setRemoteUrl: body.name ? `修改远端 ${shortText(body.name, 72)} URL` : "修改远端 URL",
      deleteRemote: body.name ? `删除远端 ${shortText(body.name, 72)}` : "删除远端",
      setUpstream: body.ref ? `设置 upstream ${shortText(body.ref, 72)}` : "设置 upstream",
      unsetUpstream: "取消 upstream",
      stageAll: "暂存全部更改",
      discardAll: "丢弃全部未提交更改",
      continueRevert: "继续还原",
      abortRevert: "中止还原",
      continueCherryPick: "继续挑选提交",
      skipCherryPick: "跳过挑选提交",
      abortCherryPick: "中止挑选提交",
      continueMerge: "继续合并",
      abortMerge: "中止合并",
      continueRebase: "继续变基",
      skipRebase: "跳过变基提交",
      abortRebase: "中止变基",
      createBranch: branch ? `创建分支 ${branch}` : "创建分支",
      renameBranch: branch ? `重命名分支 ${branch}` : "重命名分支",
      deleteBranch: branch ? `删除分支 ${branch}` : "删除分支",
      deleteBranches: Array.isArray(body.branches) ? `批量删除 ${body.branches.length} 个分支` : "批量删除分支",
      deleteRemoteBranch: body.ref ? `删除远端分支 ${shortText(body.ref, 72)}` : "删除远端分支",
      mergeRef: ref ? `合并分支 ${ref}` : "合并分支",
      rebaseOntoRef: ref ? `变基到 ${ref}` : "变基当前分支",
      createTag: body.name ? `创建 Tag ${shortText(body.name, 72)}` : "创建 Tag",
      deleteTag: body.name ? `删除本地 Tag ${shortText(body.name, 72)}` : "删除本地 Tag",
      pushTag: body.name ? `推送 Tag ${shortText(body.name, 72)}` : "推送 Tag",
      deleteRemoteTag: body.name ? `删除远端 Tag ${shortText(body.name, 72)}` : "删除远端 Tag",
      pruneWorktrees: branch ? `清理 ${branch} 的 worktree 记录` : "清理 worktree 记录",
      findCheckoutStash: branch ? `查找 ${branch} 的签出储藏` : "查找签出储藏",
      restoreCheckoutStash: branch ? `恢复 ${branch} 的签出储藏` : "恢复签出储藏",
      createStash: "创建储藏",
      applyStash: ref ? `应用储藏 ${ref}` : "应用储藏",
      popStash: ref ? `弹出储藏 ${ref}` : "弹出储藏",
      dropStash: ref ? `删除储藏 ${ref}` : "删除储藏",
      branchFromStash: branch && ref ? `从储藏 ${ref} 创建分支 ${branch}` : "从储藏创建分支",
      applyPatch: body.stage ? "应用补丁并暂存" : "应用补丁到工作区",
      restoreRecoveryPoint: ref ? `恢复到恢复点 ${ref}` : "恢复到恢复点",
      createRecoveryPointFromReflog: body.sha ? `从引用日志创建恢复点 ${shortText(body.sha, 12)}` : "从引用日志创建恢复点",
      restoreReflogEntry: body.sha ? `恢复到引用日志 ${shortText(body.sha, 12)}` : "恢复到引用日志",
      deleteRecoveryPoint: ref ? `删除恢复点 ${ref}` : "删除恢复点",
      deleteRecoveryPoints: Array.isArray(body.refs) ? `批量删除 ${body.refs.length} 个恢复点` : "批量删除恢复点",
      pruneRecoveryPoints: "按保留策略清理恢复点",
      stageFile: file ? `暂存文件 ${file}` : "暂存文件",
      ignoreWorktreePath: file ? `加入 .gitignore ${file}` : "加入 .gitignore",
      unstageFile: file ? `取消暂存文件 ${file}` : "取消暂存文件",
      resolveConflictFile: file ? `解决冲突文件 ${file}` : "解决冲突文件",
      stageHunk: file ? `暂存改动块 ${file}` : "暂存改动块",
      stageSelectedLines: file ? `暂存所选行 ${file}` : "暂存所选行",
      unstageSelectedLines: file ? `取消暂存所选行 ${file}` : "取消暂存所选行",
      unstageHunk: file ? `取消暂存改动块 ${file}` : "取消暂存改动块",
      discardWorktreeHunk: file ? `丢弃改动块 ${file}` : "丢弃改动块",
      discardWorktreeFile: file ? `丢弃工作区文件 ${file}` : "丢弃工作区文件",
      discardStagedFile: file ? `丢弃已暂存文件 ${file}` : "丢弃已暂存文件",
      commit: "创建提交",
      amendCommit: "追加到上一次提交",
      rewordCommit: body.sha ? `修改提交信息 ${shortText(body.sha, 12)}` : "修改历史提交信息",
      rewriteHistoryCommit: body.sha ? `${historyRewriteActionLabel(body.mode)} ${shortText(body.sha, 12)}` : "编辑历史提交",
      rewriteHistoryQueue: Array.isArray(body.items) ? `执行历史编辑队列 ${body.items.length} 项` : "执行历史编辑队列",
      cherryPickCommit: body.sha ? `挑选提交 ${shortText(body.sha, 12)}` : "挑选提交",
      revertCommit: body.sha ? `还原提交 ${shortText(body.sha, 12)}` : "还原提交",
      resetToCommit: body.sha ? `${resetModeLabel(body.mode)}到 ${shortText(body.sha, 12)}` : "重置到提交",
      checkoutBranch: branch ? `切换分支 ${branch}${checkoutModeText(body.mode)}` : "切换分支",
      checkoutRemoteBranch: ref ? `签出远端分支 ${ref}${checkoutModeText(body.mode)}` : "签出远端分支",
    };
    return labels[action] || `Git 操作 ${action || "未知"}`;
  }

  function historyRewriteActionLabel(mode) {
    if (mode === "squash") return "压缩提交";
    if (mode === "fixup") return "修补提交";
    if (mode === "drop") return "丢弃提交";
    return "编辑提交";
  }

  function resetModeLabel(mode) {
    if (mode === "soft") return "软重置";
    if (mode === "hard") return "硬重置";
    return "混合重置";
  }

  function checkoutModeText(mode) {
    if (mode === "stash") return "（储藏并签出）";
    if (mode === "force") return "（强制签出）";
    return "";
  }

  async function resolveCommit(value, repoPath = currentRepo) {
    const sha = normalizeSha(value);
    return (await git(repoPath, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
  }

  async function currentLocalBranchForRewrite(repoPath = currentRepo) {
    const branch = (await git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    if (!branch || branch === "HEAD" || branch === "detached HEAD") {
      throw new Error("当前处于游离 HEAD，不能编辑分支历史。请先切换到本地分支。");
    }
    return branch;
  }

  async function ensureCleanWorktree(message) {
    const statusOutput = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
    if (statusOutput.trim()) throw new Error(message);
  }















  async function currentLocalBranch(actionText = "执行操作") {
    const branch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (!branch || branch === "detached HEAD") {
      throw new Error(`当前处于游离 HEAD，不能${actionText}。请先切换到本地分支。`);
    }
    return branch;
  }

  async function ensureCurrentBranchSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!CURRENT_BRANCH_SNAPSHOT_ACTIONS.has(action)) return;
    const expectedBranch = String(body.expectedBranch || "").trim();
    const expectedHead = String(body.expectedHead || "").trim().toLowerCase();
    if (!expectedBranch) throw new Error("页面分支状态已过期，请刷新后重新执行这个操作。");
    const currentBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (currentBranch !== expectedBranch) {
      throw new Error(`当前分支已经从 ${expectedBranch} 切换到 ${currentBranch || "HEAD"}。为避免把操作执行到错误分支，请刷新页面后重新操作。`);
    }
    if (expectedHead) {
      const currentHead = (await git(currentRepo, ["rev-parse", "--verify", "HEAD^{commit}"], { timeout: 60000 })).trim().toLowerCase();
      if (currentHead && currentHead !== expectedHead) {
        throw new Error(`当前分支 ${currentBranch} 的 HEAD 已经变化。为避免把操作执行到旧页面之外的提交上，请刷新页面后重新操作。`);
      }
    }
    await ensureUpstreamSnapshot(body, currentBranch);
    await ensureCurrentOperationContextSnapshot(body);
  }

  async function ensureUpstreamSnapshot(body = {}, currentBranch = "") {
    const action = String(body.action || "");
    if (!UPSTREAM_SNAPSHOT_ACTIONS.has(action)) return;
    const hasExpectedUpstream = Object.prototype.hasOwnProperty.call(body, "expectedUpstream");
    if (!hasExpectedUpstream) throw new Error("页面 upstream 状态已过期，请刷新后重新执行这个操作。");
    const expectedUpstream = String(body.expectedUpstream || "").trim();
    const currentUpstream = (await git(currentRepo, ["for-each-ref", `refs/heads/${currentBranch}`, "--format=%(upstream:short)"], { timeout: 60000 })).trim();
    if (currentUpstream !== expectedUpstream) {
      const before = expectedUpstream || "未设置 upstream";
      const after = currentUpstream || "未设置 upstream";
      throw new Error(`当前分支 upstream 已经从 ${before} 变为 ${after}。为避免把操作执行到错误远端，请刷新页面后重新操作。`);
    }
    if (expectedUpstream) {
      const remoteName = normalizeRemoteName(body.expectedUpstreamRemote || splitRemoteBranchRef(expectedUpstream, await readRemoteNames()).remote);
      await ensureRemoteSnapshotForUpstream(remoteName, body, "upstream 远端");
    } else if (action === "push") {
      const hasExpectedDefaultRemote = Object.prototype.hasOwnProperty.call(body, "expectedDefaultRemote");
      if (!hasExpectedDefaultRemote) throw new Error("页面默认推送远端状态已过期，请刷新后重新执行这个操作。");
      const expectedDefaultRemote = String(body.expectedDefaultRemote || "").trim();
      const remoteNames = await readRemoteNames();
      const currentDefaultRemote = remoteNames.includes("origin") ? "origin" : remoteNames[0] || "";
      if (currentDefaultRemote !== expectedDefaultRemote) {
        throw new Error(`默认推送远端已经从 ${expectedDefaultRemote || "无远端"} 变为 ${currentDefaultRemote || "无远端"}。为避免把操作执行到错误远端，请刷新页面后重新操作。`);
      }
      if (expectedDefaultRemote) await ensureRemoteSnapshotForUpstream(expectedDefaultRemote, body, "默认推送远端", "expectedDefaultRemoteFetchUrl", "expectedDefaultRemotePushUrl");
    }
    if (action === "forcePushLease") {
      await ensureForcePushLeaseUpstreamSnapshot(body, currentUpstream);
    }
  }

  async function ensureForcePushLeaseUpstreamSnapshot(body = {}, upstream = "") {
    const expectedSha = normalizeExpectedUpstreamSha(body.expectedUpstreamSha);
    const currentSha = (await git(currentRepo, ["rev-parse", "--verify", `${upstream}^{commit}`], { timeout: 60000 }).catch(() => "")).trim().toLowerCase();
    if (!currentSha) {
      throw new Error("页面 upstream 提交状态已过期，请刷新后重新执行安全强推。");
    }
    if (!currentSha.startsWith(expectedSha)) {
      throw new Error(`upstream ${upstream} 的提交已经变化。为避免安全强推覆盖外部新提交，请刷新后重新操作。`);
    }
    return currentSha;
  }

  function normalizeExpectedUpstreamSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("页面 upstream 提交状态已过期，请刷新后重新执行安全强推。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("upstream 提交身份不合法，请刷新后重新执行安全强推。");
    return sha;
  }

  async function ensureRemoteSnapshotForUpstream(remoteName, body = {}, label = "远端", fetchField = "expectedUpstreamFetchUrl", pushField = "expectedUpstreamPushUrl") {
    const hasExpectedFetch = Object.prototype.hasOwnProperty.call(body, fetchField);
    const hasExpectedPush = Object.prototype.hasOwnProperty.call(body, pushField);
    const pushUrlsField = `${pushField}s`;
    const hasExpectedPushUrls = Object.prototype.hasOwnProperty.call(body, pushUrlsField);
    if (!hasExpectedFetch && !hasExpectedPush && !hasExpectedPushUrls) throw new Error(`页面${label}配置已过期，请刷新后重新执行这个操作。`);
    const expectedFetchUrl = String(body[fetchField] || "");
    const expectedPushUrls = expectedRemotePushUrls(body, pushField, pushUrlsField);
    const current = (await readRemoteDetails()).find((remote) => remote.name === remoteName);
    if (!current) throw new Error(`${label} ${remoteName} 已不存在。请刷新后重新操作。`);
    const currentFetchUrl = current.fetchUrl || "";
    if (currentFetchUrl !== expectedFetchUrl || !sameStringList(remotePushUrls(current), expectedPushUrls)) {
      throw new Error(`${label} ${remoteName} 的 URL 已经变化。为避免把操作执行到错误远端，请刷新后重新操作。`);
    }
  }

  async function ensureCurrentOperationContextSnapshot(body = {}) {
    const operation = detectRepoOperation(currentRepo);
    if (!operation) return;
    const receivedType = String(body.expectedOperationType || "").trim();
    const expectedSnapshot = normalizeExpectedSnapshot(body.expectedOperationSnapshot, "进行中的 Git 操作状态已过期，请刷新后重新执行这个操作。");
    if (receivedType !== operation.type) {
      throw new Error(`正在进行的${operationTypeLabel(operation.type)}已经变化。为避免旧页面操作到新的 Git 状态，请刷新后重新操作。`);
    }
    if (operation.snapshot !== expectedSnapshot) {
      throw new Error(`正在进行的${operationTypeLabel(operation.type)}已经变化。为避免旧页面操作到新的 Git 状态，请刷新后重新操作。`);
    }
  }

  async function ensureRemoteConfigSnapshot(body = {}) {
    const action = String(body.action || "");
    if (ALL_REMOTE_CONFIG_SNAPSHOT_ACTIONS.has(action)) {
      await ensureAllRemoteConfigSnapshot(body);
      return;
    }
    const tagRemoteAction = TAG_REMOTE_SNAPSHOT_ACTIONS.has(action);
    const remoteBranchAction = await remoteNameForRemoteBranchSnapshot(body);
    if (!REMOTE_CONFIG_SNAPSHOT_ACTIONS.has(action) && !tagRemoteAction && !remoteBranchAction) return;
    if (tagRemoteAction && !String(body.remote || "").trim()) {
      throw new Error("页面 Tag 远端状态已过期，请刷新 Tag 列表后重新操作。");
    }
    const remoteName = remoteBranchAction
      ? remoteBranchAction
      : normalizeRemoteName(tagRemoteAction ? body.remote : body.name);
    const hasExpectedFetch = Object.prototype.hasOwnProperty.call(body, "expectedFetchUrl");
    const hasExpectedPush = Object.prototype.hasOwnProperty.call(body, "expectedPushUrl");
    const hasExpectedPushUrls = Object.prototype.hasOwnProperty.call(body, "expectedPushUrls");
    if (!hasExpectedFetch && !hasExpectedPush && !hasExpectedPushUrls) {
      throw new Error("页面远端配置已过期，请刷新后重新执行这个操作。");
    }
    const expectedFetchUrl = String(body.expectedFetchUrl || "");
    const expectedPushUrls = expectedRemotePushUrls(body, "expectedPushUrl", "expectedPushUrls");
    const current = (await readRemoteDetails()).find((remote) => remote.name === remoteName);
    if (!current) {
      throw new Error(`远端 ${remoteName} 已不存在。请刷新远端列表后重新操作。`);
    }
    const currentFetchUrl = current.fetchUrl || "";
    if (currentFetchUrl !== expectedFetchUrl || !sameStringList(remotePushUrls(current), expectedPushUrls)) {
      if (remoteBranchAction) {
        if (action === "setUpstream") {
          throw new Error(`远端 ${remoteName} 的 URL 已经变化。为避免旧页面设置错误 upstream，请刷新后重新操作。`);
        }
        if (action === "deleteRemoteBranch") {
          throw new Error(`远端 ${remoteName} 的 URL 已经变化。为避免旧页面删除错误远端分支，请刷新后重新操作。`);
        }
        throw new Error(`远端 ${remoteName} 的 URL 已经变化。为避免旧页面使用错误远端分支，请刷新后重新操作。`);
      }
      if (tagRemoteAction) {
        throw new Error(`远端 ${remoteName} 的 URL 已经变化。为避免旧页面操作错误远端 Tag，请刷新后重新操作。`);
      }
      throw new Error(`远端 ${remoteName} 的 URL 已经变化。为避免旧页面覆盖或删除新的远端配置，请刷新后重新操作。`);
    }
  }

  async function remoteNameForRemoteBranchSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!REMOTE_BRANCH_REMOTE_SNAPSHOT_ACTIONS.has(action)) return "";
    const refValue = action === "createBranch" ? body.start : body.ref || body.branch || body.upstream;
    const refText = String(refValue || "").trim();
    if (!refText) return "";
    const remoteNames = await readRemoteNames();
    const ref = normalizeRefName(refText, "远端分支");
    const alwaysRemote = action === "deleteRemoteBranch" || action === "setUpstream" || action === "checkoutRemoteBranch";
    if (!alwaysRemote) {
      const remoteBranches = await readRemoteBranchNames();
      if (!remoteBranches.includes(ref)) return "";
    }
    return splitRemoteBranchRef(ref, remoteNames).remote;
  }

  async function ensureAllRemoteConfigSnapshot(body = {}) {
    if (!Object.prototype.hasOwnProperty.call(body, "expectedRemotes")) {
      throw new Error("页面远端配置已过期，请刷新后重新执行这个操作。");
    }
    const expected = normalizeRemoteSnapshotEntries(body.expectedRemotes);
    const current = await readRemoteDetails();
    if (current.length !== expected.length) {
      throw new Error("远端列表已经变化。为避免旧页面抓取错误远端，请刷新后重新操作。");
    }
    const currentByName = new Map(current.map((remote) => [remote.name, remote]));
    for (const remote of expected) {
      const actual = currentByName.get(remote.name);
      if (!actual) throw new Error(`远端 ${remote.name} 已不存在。请刷新远端列表后重新操作。`);
      if ((actual.fetchUrl || "") !== remote.fetchUrl || !sameStringList(remotePushUrls(actual), remote.pushUrls)) {
        throw new Error(`远端 ${remote.name} 的 URL 已经变化。为避免旧页面抓取错误远端，请刷新后重新操作。`);
      }
    }
  }

  function normalizeRemoteSnapshotEntries(value) {
    if (!Array.isArray(value)) throw new Error("页面远端配置已过期，请刷新后重新执行这个操作。");
    const seen = new Set();
    return value.map((item) => {
      const remote = normalizeRemoteName(item?.name);
      if (seen.has(remote)) throw new Error("页面远端配置重复，请刷新后重新执行这个操作。");
      seen.add(remote);
      return {
        name: remote,
        fetchUrl: String(item?.fetchUrl || ""),
        pushUrl: String(item?.pushUrl || ""),
        pushUrls: Object.prototype.hasOwnProperty.call(item || {}, "pushUrls")
          ? normalizeRemotePushUrls(item.pushUrls)
          : [String(item?.pushUrl || "")],
      };
    });
  }

  function expectedRemotePushUrls(body = {}, pushField = "expectedPushUrl", pushUrlsField = "expectedPushUrls") {
    if (Object.prototype.hasOwnProperty.call(body, pushUrlsField)) {
      return normalizeRemotePushUrls(body[pushUrlsField]);
    }
    return [String(body[pushField] || "")];
  }

  function normalizeRemotePushUrls(value) {
    if (!Array.isArray(value)) throw new Error("页面远端配置已过期，请刷新后重新执行这个操作。");
    return value.map((item) => String(item || ""));
  }

  function remotePushUrls(remote = {}) {
    const urls = Array.isArray(remote.pushUrls) ? remote.pushUrls.map((item) => String(item || "")) : [];
    return urls.length ? urls : [String(remote.pushUrl || "")];
  }

  function sameStringList(left = [], right = []) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item === right[index]);
  }

  async function ensureTargetRefSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!TARGET_REF_SNAPSHOT_ACTIONS.has(action)) return;
    const target = await targetRefSnapshotRef(body);
    if (!target) return;
    const expectedSha = normalizeExpectedTargetRefSha(body.expectedTargetSha);
    const actualRef = target.peel === false ? target.ref : `${target.ref}^{commit}`;
    const actualSha = (await git(currentRepo, ["rev-parse", "--verify", actualRef], { timeout: 60000 }).catch(() => "")).trim().toLowerCase();
    if (!actualSha) throw new Error(`${target.label} 已经不存在。请刷新后重新操作。`);
    if (!actualSha.startsWith(expectedSha)) {
      throw new Error(`${target.label} 已经变化。为避免旧页面使用错误提交，请刷新后重新操作。`);
    }
    if (target.remoteBranch) {
      const remoteSha = (await readRemoteBranchHeadSha(target.parsedRemote)).trim().toLowerCase();
      if (!remoteSha) {
        await git(currentRepo, ["fetch", target.parsedRemote.remote, "--prune"], { timeout: 120000 }).catch(() => "");
        throw new Error(`${target.label} 已不存在，已刷新远端分支列表。请刷新后重新操作。`);
      }
      if (!remoteSha.startsWith(expectedSha)) {
        await git(currentRepo, ["fetch", target.parsedRemote.remote, "--prune"], { timeout: 120000 }).catch(() => "");
        throw new Error(`${target.label} 已经变化，当前页面看到的不是最新远端分支。为避免旧页面使用错误提交，请刷新后重新操作。`);
      }
    }
  }

  async function targetRefSnapshotRef(body = {}) {
    const action = String(body.action || "");
    const rawRef = action === "createBranch" ? body.start : action === "createWorktree" ? body.ref || "HEAD" : body.ref || body.branch;
    const refText = String(rawRef || "").trim();
    if (!refText || refText === "HEAD" || refText === "@") return null;
    const remoteNames = await readRemoteNames();
    const remoteBranches = await readRemoteBranchNames();
    const localBranches = parseSimpleLines(await git(currentRepo, ["branch", "--format=%(refname:short)"]).catch(() => ""));
    if ((action === "checkoutRemoteBranch" || remoteBranches.includes(refText)) && isKnownRemoteBranch(refText, remoteNames)) {
      const ref = normalizeRefName(refText, "远端分支");
      return { ref: `refs/remotes/${ref}`, label: `远端分支 ${ref}`, remoteBranch: ref, parsedRemote: splitRemoteBranchRef(ref, remoteNames) };
    }
    if (action === "checkoutBranch" || localBranches.includes(refText)) {
      const branch = normalizeBranchName(refText);
      return { ref: `refs/heads/${branch}`, label: `本地分支 ${branch}` };
    }
    const tagName = refText.startsWith("refs/tags/") ? refText.slice("refs/tags/".length) : refText;
    const tags = parseSimpleLines(await git(currentRepo, ["tag", "--list"]).catch(() => ""));
    if (tags.includes(tagName)) {
      const tag = normalizeTagName(tagName);
      return { ref: `refs/tags/${tag}`, label: `Tag ${tag}`, peel: false };
    }
    return null;
  }

  function normalizeExpectedTargetRefSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("目标分支状态已过期，请刷新后重新执行这个操作。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("目标分支身份不合法，请刷新后重新执行这个操作。");
    return sha;
  }

  async function ensureWorktreeSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!WORKTREE_SNAPSHOT_ACTIONS.has(action)) return;
    const expected = normalizeExpectedSnapshot(body.expectedWorktreeSnapshot, "工作区状态已过期，请刷新后重新执行这个操作。");
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
    const working = await readWorkingStatus(currentRepo, statusOutput);
    if (working.snapshot !== expected) {
      throw new Error("工作区状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。");
    }
  }

  async function ensureFileSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!FILE_SNAPSHOT_ACTIONS.has(action)) return;
    const file = normalizeRepoFile(body.file);
    const expected = normalizeExpectedSnapshot(body.expectedFileSnapshot, "文件状态已过期，请刷新后重新执行这个操作。");
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const working = await readWorkingStatus(currentRepo, statusOutput);
    let target = selectStatusFile(working.files, file, fileSnapshotScope(body));
    if (!target || target.snapshot !== expected) {
      const fullStatusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
      const fullWorking = await readWorkingStatus(currentRepo, fullStatusOutput);
      target = selectStatusFile(fullWorking.files, file, fileSnapshotScope(body));
    }
    if (!target) throw new Error("这个文件状态已经变化。请刷新后重新选择。");
    if (target.snapshot !== expected) {
      throw new Error(`文件 ${file} 的内容或暂存状态已经变化。为避免旧页面操作到新的文件内容，请刷新后重新操作。`);
    }
  }

  function fileSnapshotScope(body = {}) {
    const action = String(body.action || "");
    if (action === "resolveConflictFile") return "conflict";
    if (action === "unstageFile" || action === "discardStagedFile" || action === "unstageHunk" || action === "unstageSelectedLines") return "staged";
    if (String(body.scope || "").trim().toLowerCase() === "untracked") return "untracked";
    return "unstaged";
  }

  function normalizeExpectedSnapshot(value, message) {
    const snapshot = String(value || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(snapshot)) throw new Error(message);
    return snapshot;
  }

  async function ensureOperationSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!OPERATION_SNAPSHOT_ACTIONS.has(action)) return;
    const expectedType = operationActionType(action);
    const receivedType = String(body.expectedOperationType || "").trim();
    const expectedSnapshot = normalizeExpectedSnapshot(body.expectedOperationSnapshot, "进行中的 Git 操作状态已过期，请刷新后重新执行这个操作。");
    if (receivedType !== expectedType) {
      throw new Error("进行中的 Git 操作类型已过期，请刷新后重新执行这个操作。");
    }
    const operation = detectRepoOperation(currentRepo);
    if (!operation || operation.type !== expectedType) {
      throw new Error(`当前没有正在进行的${operationTypeLabel(expectedType)}，请刷新后重新操作。`);
    }
    if (operation.snapshot !== expectedSnapshot) {
      throw new Error(`正在进行的${operationTypeLabel(expectedType)}已经变化。为避免旧页面操作到新的 Git 状态，请刷新后重新操作。`);
    }
  }

  async function ensureWorktreePruneSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!WORKTREE_PRUNE_SNAPSHOT_ACTIONS.has(action)) return;
    const expected = normalizeExpectedSnapshot(body.expectedWorktreePruneSnapshot, "失效 worktree 列表已过期，请刷新后重新清理。");
    const output = await git(currentRepo, ["worktree", "list", "--porcelain"]);
    const current = buildWorktreePruneSnapshot(parseWorktreeList(output, currentRepo));
    if (current !== expected) {
      throw new Error("失效 worktree 列表已经变化。为避免旧页面清理到未确认的记录，请刷新后重新操作。");
    }
  }

  function operationActionType(action) {
    if (action.endsWith("Revert")) return "revert";
    if (action.endsWith("CherryPick")) return "cherryPick";
    if (action.endsWith("Merge")) return "merge";
    if (action.endsWith("Rebase")) return "rebase";
    return "";
  }

  function operationTypeLabel(type) {
    return {
      revert: "还原",
      cherryPick: "挑选",
      merge: "合并",
      rebase: "变基",
    }[type] || "Git 操作";
  }

  return {
    setCurrentRepo,
    readHistoryRewritePreview,
    readHistoryRewriteQueuePreview,
    runAction,
    actionChangesRepo,
    ensureCanSwitchRepo,
    ensureCanStartAction,
    beginOperation,
    recordOperation,
    actionOutputSummary,
    listRunningOperations,
    cancelActiveOperation,
    actionLabel,
  };
}

module.exports = { createGitOperationsService };
