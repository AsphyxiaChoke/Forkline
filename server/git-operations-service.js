"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

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
  }

  async function readHistoryRewritePreview(sha, rawMode) {
    const mode = normalizeHistoryRewriteMode(rawMode);
    if (!currentRepo) {
      const sample = sampleState();
      const target = sample.commits.find((item) => item.sha === sha) || sample.commits[0];
      return {
        ok: true,
        mode,
        title: historyRewritePreviewTitle(mode),
        command: historyRewriteCommand(mode),
        effect: historyRewriteEffect(mode),
        branch: sample.repo.branch,
        target,
        parent: sample.commits.find((item) => item.sha === target?.parents?.[0]) || null,
        affectedCount: 3,
        affectedPreview: sample.commits.slice(0, 3),
        blockers: [],
        warnings: ["示例模式不会执行真实 Git 命令"],
        canRun: false,
      };
    }
    const repoPath = currentRepo;
    const targetSha = await resolveCommit(sha, repoPath);
    const target = await repositoryHistoryService.readBasicCommit(targetSha, repoPath);
    const blockers = [];
    const warnings = ["执行前会自动创建恢复点", "执行后目标提交之后的 SHA 会改变"];
    const operation = detectRepoOperation(repoPath);
    if (operation) blockers.push(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);
  
    const statusOutput = await git(repoPath, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
    const dirtyCount = parseStatus(statusOutput).length;
    if (statusOutput.trim()) blockers.push(`当前还有 ${dirtyCount || "未提交"} 个未提交改动。请先提交、储藏或丢弃后再编辑历史。`);
  
    let branch = "";
    try {
      branch = await currentLocalBranchForRewrite(repoPath);
    } catch (error) {
      blockers.push(error.message);
    }
    try {
      await ensureCommitInCurrentHistory(targetSha, repoPath);
    } catch (error) {
      blockers.push(error.message);
    }
  
    const parents = await commitParents(targetSha, repoPath);
    if (parents.length > 1) blockers.push(`暂不支持对 merge 提交执行${historyRewritePreviewTitle(mode)}`);
    if ((mode === "squash" || mode === "fixup") && parents.length === 0) {
      blockers.push("根提交没有父提交，不能压缩或修补进父提交");
    }
  
    const parent = parents[0] ? await repositoryHistoryService.readBasicCommit(parents[0], repoPath).catch(() => null) : null;
    let upstream = "";
    let rebaseStart = "";
    let affectedPreview = [];
    let affectedCount = 0;
    let targetIndex = -1;
    if (!parents.length && (mode === "squash" || mode === "fixup")) {
      affectedPreview = [target];
      affectedCount = 1;
      targetIndex = 0;
    } else {
      const base = mode === "drop" || (mode === "reword" && !parents[0]) ? targetSha : parents[0];
      const baseParents = base ? await commitParents(base, repoPath).catch(() => []) : [];
      upstream = baseParents.length ? `${base}^` : "--root";
      rebaseStart = upstream === "--root" ? "仓库根提交" : `${baseParents[0]?.slice(0, 7) || base.slice(0, 7)} 之后`;
      const affected = await readRewriteRangeCommits(upstream, repoPath).catch(() => []);
      affectedCount = affected.length;
      affectedPreview = affected.slice(0, 12);
      targetIndex = affected.findIndex((item) => item.sha === targetSha);
      const merges = affected.filter((item) => item.parents.length > 1);
      if (merges.length) {
        blockers.push(`这段历史里包含 merge 提交 ${merges[0].short}。为避免破坏分支拓扑，暂不自动执行 ${historyRewriteActionLabel(mode)}。`);
      }
      if (targetIndex === -1) blockers.push("目标提交不在这次历史编辑序列中，请刷新后重试。");
    }
    if (mode === "drop") warnings.push("丢弃提交可能让后续提交产生冲突");
    return {
      ok: true,
      mode,
      title: historyRewritePreviewTitle(mode),
      command: historyRewriteCommand(mode),
      effect: historyRewriteEffect(mode),
      branch,
      target,
      parent,
      upstream,
      rebaseStart,
      affectedCount,
      affectedPreview,
      targetIndex,
      dirtyCount,
      blockers: [...new Set(blockers.filter(Boolean))],
      warnings,
      canRun: blockers.length === 0,
    };
  }
  
  async function readHistoryRewriteQueuePreview(rawItems) {
    const requested = normalizeHistoryRewriteQueueItems(rawItems);
    if (!currentRepo) {
      const sample = sampleState();
      const actions = requested.map((item, index) => {
        const target = sample.commits[index + 1] || sample.commits[index] || sample.commits[0];
        return {
          mode: item.mode,
          modeLabel: historyRewritePreviewTitle(item.mode),
          target,
          parent: sample.commits.find((commit) => commit.sha === target?.parents?.[0]) || null,
        };
      });
      return {
        ok: true,
        mode: "queue",
        title: "历史编辑队列",
        command: "git rebase -i / queue",
        effect: "一次执行多条 squash / fixup / drop / reword 历史编辑动作。",
        branch: sample.repo.branch,
        queueCount: actions.length,
        actions,
        affectedCount: sample.commits.length,
        affectedPreview: sample.commits.map((commit, index) => ({ ...commit, queueAction: index ? requested[index - 1]?.mode || "pick" : "pick" })),
        blockers: [],
        warnings: ["示例模式不会执行真实 Git 命令"],
        canRun: false,
      };
    }
  
    const blockers = [];
    const warnings = ["执行前会自动创建恢复点", "执行后队列影响范围内的 SHA 会改变"];
    const repoPath = currentRepo;
    const operation = detectRepoOperation(repoPath);
    if (operation) blockers.push(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);
  
    const statusOutput = await git(repoPath, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
    const dirtyCount = parseStatus(statusOutput).length;
    if (statusOutput.trim()) blockers.push(`当前还有 ${dirtyCount || "未提交"} 个未提交改动。请先提交、储藏或丢弃后再编辑历史。`);
  
    let branch = "";
    try {
      branch = await currentLocalBranchForRewrite(repoPath);
    } catch (error) {
      blockers.push(error.message);
    }
  
    const resolved = [];
    const seenTargets = new Set();
    for (const item of requested) {
      const targetSha = await resolveCommit(item.sha, repoPath);
      if (seenTargets.has(targetSha)) {
        blockers.push(`提交 ${targetSha.slice(0, 7)} 在队列中重复出现。`);
        continue;
      }
      seenTargets.add(targetSha);
      try {
        await ensureCommitInCurrentHistory(targetSha, repoPath);
      } catch (error) {
        blockers.push(error.message);
      }
      const [target, parents] = await Promise.all([repositoryHistoryService.readBasicCommit(targetSha, repoPath), commitParents(targetSha, repoPath)]);
      if (parents.length > 1) blockers.push(`提交 ${target.short} 是 merge 提交，暂不支持加入历史编辑队列。`);
      if ((item.mode === "squash" || item.mode === "fixup") && parents.length === 0) {
        blockers.push(`提交 ${target.short} 是根提交，不能压缩或修补进父提交。`);
      }
      resolved.push({
        mode: item.mode,
        modeLabel: historyRewritePreviewTitle(item.mode),
        command: historyRewriteCommand(item.mode),
        summary: item.summary || "",
        body: item.body || "",
        target,
        parent: parents[0] ? await repositoryHistoryService.readBasicCommit(parents[0], repoPath).catch(() => null) : null,
        parentSha: parents[0] || "",
      });
    }
  
    const hasReword = resolved.some((item) => item.mode === "reword");
    const hasFold = resolved.some((item) => item.mode === "squash" || item.mode === "fixup");
    if (hasReword && hasFold) {
      blockers.push("批量修改提交信息暂不和压缩/修补混用，请分两次执行。");
    }
  
    const fullRange = await readRewriteRangeCommits("--root", repoPath).catch(() => []);
    const order = new Map(fullRange.map((commit, index) => [commit.sha, index]));
    let earliestBase = "";
    let earliestIndex = Number.POSITIVE_INFINITY;
    for (const item of resolved) {
      const base = item.mode === "drop" || (item.mode === "reword" && !item.parentSha) ? item.target.sha : item.parentSha;
      if (!base) continue;
      const index = order.get(base);
      if (index === undefined) {
        blockers.push(`提交 ${base.slice(0, 7)} 不在当前分支历史编辑范围中。`);
        continue;
      }
      if (index < earliestIndex) {
        earliestIndex = index;
        earliestBase = base;
      }
    }
  
    let upstream = "";
    let rebaseStart = "";
    let affected = [];
    if (earliestBase) {
      const baseParents = await commitParents(earliestBase, repoPath).catch(() => []);
      upstream = baseParents.length ? `${earliestBase}^` : "--root";
      rebaseStart = upstream === "--root" ? "仓库根提交" : `${baseParents[0]?.slice(0, 7) || earliestBase.slice(0, 7)} 之后`;
      affected = await readRewriteRangeCommits(upstream, repoPath).catch(() => []);
      const merges = affected.filter((commit) => commit.parents.length > 1);
      if (merges.length) {
        blockers.push(`这段历史里包含 merge 提交 ${merges[0].short}。为避免破坏分支拓扑，暂不自动执行历史编辑队列。`);
      }
      const affectedShas = new Set(affected.map((commit) => commit.sha));
      for (const item of resolved) {
        if (!affectedShas.has(item.target.sha)) {
          blockers.push(`提交 ${item.target.short} 不在这次历史编辑序列中，请刷新后重试。`);
        }
      }
    } else {
      blockers.push("无法计算历史编辑队列的重放起点。");
    }
  
    const actionBySha = new Map(resolved.map((item) => [item.target.sha, item]));
    for (let index = 0; index < affected.length; index += 1) {
      const commit = affected[index];
      const actionItem = actionBySha.get(commit.sha);
      const action = actionItem?.mode || "pick";
      if (action === "squash" || action === "fixup") {
        const previous = affected[index - 1];
        const previousAction = previous ? actionBySha.get(previous.sha)?.mode || "pick" : "";
        if (!previous) {
          blockers.push(`提交 ${commit.short} 是队列第一条，不能执行 ${historyRewritePreviewTitle(action)}。`);
        } else if (previousAction === "drop") {
          blockers.push(`提交 ${commit.short} 要${historyRewritePreviewTitle(action)}，但它前一条 ${previous.short} 会被丢弃。请调整队列。`);
        }
      }
    }
  
    if (resolved.some((item) => item.mode === "drop")) warnings.push("队列里包含丢弃提交，后续提交可能产生冲突");
    if (resolved.some((item) => item.mode === "reword")) warnings.push("队列里包含修改提交信息，相关提交的 SHA 会改变");
    const affectedPreview = affected.slice(0, 30).map((commit) => {
      const actionItem = actionBySha.get(commit.sha);
      const queueAction = actionItem?.mode || "pick";
      return {
        ...commit,
        queueAction,
        queueActionLabel: queueAction === "pick" ? "保留" : historyRewritePreviewTitle(queueAction),
        queueCommand: queueAction === "pick" ? "pick" : historyRewriteCommand(queueAction),
        queueSummary: actionItem?.summary || "",
      };
    });
    return {
      ok: true,
      mode: "queue",
      title: "历史编辑队列",
      command: "git rebase -i / queue",
      effect: "一次执行多条 squash / fixup / drop / reword 历史编辑动作，然后重新播放后续提交。",
      branch,
      upstream,
      rebaseStart,
      queueCount: resolved.length,
      actions: resolved,
      affectedCount: affected.length,
      affectedPreview,
      dirtyCount,
      blockers: [...new Set(blockers.filter(Boolean))],
      warnings,
      canRun: blockers.length === 0,
    };
  }
  
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
      return commandResult(await git(currentRepo, ["add", "-A"], { timeout: 60000 }));
    }
    if (action === "discardAll") {
      await discardAllWorktreeChanges();
      return { ok: true, output: "已丢弃全部未提交更改" };
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
      const ref = await ensureCurrentStashRef(body);
      await ensureStashHasNoGitlinkChanges(ref);
      return commandResult(await git(currentRepo, ["stash", "apply", ref], { timeout: 120000 }));
    }
    if (action === "popStash") {
      const ref = await ensureCurrentStashRef(body);
      await ensureStashHasNoGitlinkChanges(ref);
      return commandResult(await git(currentRepo, ["stash", "pop", ref], { timeout: 120000 }));
    }
    if (action === "dropStash") {
      const ref = await ensureCurrentStashRef(body);
      return commandResult(await git(currentRepo, ["stash", "drop", ref], { timeout: 120000 }));
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
      const file = normalizeRepoFile(body.file);
      return commandResult(await git(currentRepo, ["add", "--", file], { timeout: 60000 }));
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
      return commandResult(await rewordCommit(body));
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
  
  function ensureCheckoutOperationComplete() {
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再切换分支。`);
  }
  
  async function checkoutBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const mode = normalizeCheckoutMode(body.mode);
    ensureCheckoutOperationComplete();
    const sourceBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    const branchOutput = await git(currentRepo, ["branch", "--format=%(refname:short)"]);
    const branches = branchOutput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!branches.includes(branch)) throw new Error("只能切换到本地分支");
    const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
    if (worktrees[branch]) {
      const info = worktrees[branch];
      const suffix = info.prunable ? "。这个占用记录已经失效，可以清理 worktree 记录后再切换" : "";
      throw new Error(`分支 ${branch} 已在其他工作树签出：${info.worktreePath}${suffix}`);
    }
    if (mode === "stash") {
      await ensureNoDirtySubmodulesForDiscard("储藏并签出");
      const dirty = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
      let stash = null;
      if (dirty.trim()) {
        if (!(await hasHeadCommit(currentRepo))) {
          throw new Error(`当前分支 ${sourceBranch || "HEAD"} 还没有任何提交，不能储藏并签出。请先创建首个提交，或改用“强制签出”丢弃这些改动。`);
        }
        await ensureStashSelectionHasNoSubmoduleChanges([]);
        validateStashFiles(parseStatus(dirty), []);
        const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
        const message = `Forkline: checkout ${branch} ${stamp}`;
        await git(currentRepo, ["stash", "push", "-u", "-m", message], { timeout: 120000 });
        const sha = (await git(currentRepo, ["rev-parse", "--verify", "stash@{0}^{commit}"], { timeout: 60000 }).catch(() => "")).trim();
        stash = { branch: sourceBranch, target: branch, ref: "stash@{0}", message, sha };
      }
      await git(currentRepo, ["switch", branch], { timeout: 60000 });
      return { ok: true, output: "已储藏本地更改并切换分支", stash };
    }
    if (mode === "force") {
      await discardAllWorktreeChanges();
      await git(currentRepo, ["switch", "--force", branch], { timeout: 60000 });
      return { ok: true, output: "已丢弃本地更改并强制切换分支" };
    }
    await git(currentRepo, ["switch", branch], { timeout: 60000 });
    return { ok: true, output: "已切换分支并保留本地更改" };
  }
  
  async function checkoutRemoteBranch(body) {
    const remoteRef = normalizeRefName(body.ref, "远端分支");
    const mode = normalizeCheckoutMode(body.mode);
    ensureCheckoutOperationComplete();
    const sourceBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    const remoteNames = await readRemoteNames();
    const remoteBranches = (await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item && !item.endsWith("/HEAD"));
    if (!remoteBranches.includes(remoteRef)) throw new Error("远端分支不存在，请先抓取远端后再试");
    const parsedRemoteRef = splitRemoteBranchRef(remoteRef, remoteNames);
    await ensureRemoteBranchStillExists(remoteRef, parsedRemoteRef);
    const localBranch = normalizeRemoteCheckoutBranch(remoteRef, remoteNames);
    const localBranches = (await git(currentRepo, ["branch", "--format=%(refname:short)"]))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const localExists = localBranches.includes(localBranch);
    const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
    if (localExists && worktrees[localBranch] && localBranch !== sourceBranch) {
      const info = worktrees[localBranch];
      const suffix = info.prunable ? "。这个占用记录已经失效，可以清理 worktree 记录后再切换" : "";
      throw new Error(`分支 ${localBranch} 已在其他工作树签出：${info.worktreePath}${suffix}`);
    }
  
    const switchArgs = localExists ? ["switch", localBranch] : ["switch", "--track", "-c", localBranch, remoteRef];
    if (mode === "stash") {
      await ensureNoDirtySubmodulesForDiscard("储藏并签出");
      const dirty = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
      let stash = null;
      if (dirty.trim()) {
        if (!(await hasHeadCommit(currentRepo))) {
          throw new Error(`当前分支 ${sourceBranch || "HEAD"} 还没有任何提交，不能储藏并签出。请先创建首个提交，或改用“强制签出”丢弃这些改动。`);
        }
        await ensureStashSelectionHasNoSubmoduleChanges([]);
        validateStashFiles(parseStatus(dirty), []);
        const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
        const message = `Forkline: checkout ${localBranch} ${stamp}`;
        await git(currentRepo, ["stash", "push", "-u", "-m", message], { timeout: 120000 });
        const sha = (await git(currentRepo, ["rev-parse", "--verify", "stash@{0}^{commit}"], { timeout: 60000 }).catch(() => "")).trim();
        stash = { branch: sourceBranch, target: localBranch, ref: "stash@{0}", message, sha };
      }
      await git(currentRepo, switchArgs, { timeout: 60000 });
      const trackingOutput = localExists ? await ensureRemoteCheckoutTracking(localBranch, remoteRef) : "";
      return { ok: true, branch: localBranch, remote: remoteRef, output: [`已从 ${remoteRef} 签出本地分支 ${localBranch}`, trackingOutput].filter(Boolean).join("\n"), stash };
    }
    if (mode === "force") {
      await discardAllWorktreeChanges();
      await git(currentRepo, switchArgs, { timeout: 60000 });
      const trackingOutput = localExists ? await ensureRemoteCheckoutTracking(localBranch, remoteRef) : "";
      return { ok: true, branch: localBranch, remote: remoteRef, output: [`已强制签出本地分支 ${localBranch}`, trackingOutput].filter(Boolean).join("\n") };
    }
    await git(currentRepo, switchArgs, { timeout: 60000 });
    const trackingOutput = localExists ? await ensureRemoteCheckoutTracking(localBranch, remoteRef) : "";
    return { ok: true, branch: localBranch, remote: remoteRef, output: [`已从 ${remoteRef} 签出本地分支 ${localBranch}`, trackingOutput].filter(Boolean).join("\n") };
  }
  
  async function ensureRemoteCheckoutTracking(localBranch, remoteRef) {
    const upstream = (await git(currentRepo, ["for-each-ref", `refs/heads/${localBranch}`, "--format=%(upstream:short)"]).catch(() => "")).trim();
    if (upstream === remoteRef) return "";
    if (upstream) return `本地分支 ${localBranch} 已跟踪 ${upstream}，未自动改为 ${remoteRef}`;
    await git(currentRepo, ["branch", `--set-upstream-to=${remoteRef}`, localBranch], { timeout: 60000 });
    return `已设置 upstream：${localBranch} -> ${remoteRef}`;
  }
  
  async function createBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const start = normalizeBranchStart(body.start);
    const checkout = Boolean(body.checkout);
    await git(currentRepo, ["check-ref-format", "--branch", branch]).catch(() => {
      throw new Error("分支名不合法");
    });
    if (!start && !checkout && !(await hasHeadCommit(currentRepo))) {
      throw new Error("当前分支还没有任何提交，不能创建不切换的新分支。请勾选“创建后切换”，或从已有提交/分支创建。");
    }
    if (start) await ensureLiveRemoteBranchRef(start);
    const args = checkout ? ["switch", "-c", branch] : ["branch", branch];
    if (start) args.push(start);
    await git(currentRepo, args, { timeout: 60000 });
    return {
      ok: true,
      branch,
      checkedOut: checkout,
      output: checkout ? `已创建并切换到 ${branch}` : `已创建分支 ${branch}`,
    };
  }
  
  async function deleteBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    ensureBranchDeletionAllowed(branch, currentBranch);
    await ensureCurrentLocalBranch(branch, normalizeExpectedBranchSha(body.sha));
    await git(currentRepo, ["branch", "-d", branch], { timeout: 60000 });
    return { ok: true, output: `已删除本地分支 ${branch}` };
  }
  
  function ensureBranchDeletionAllowed(branch, currentBranch = "") {
    if (branch === currentBranch) throw new Error("不能删除当前所在分支，请先切换到其他分支");
    if (isProtectedBranchName(branch)) {
      throw new Error(`分支 ${branch} 是主干/长期分支，Forkline 默认保护，不允许从这里删除。`);
    }
  }
  
  function isProtectedBranchName(branch) {
    return PROTECTED_BRANCH_NAMES.has(String(branch || "").toLowerCase());
  }
  
  function normalizeBranchActionEntries(value) {
    const rawItems = Array.isArray(value) ? value : [];
    const seen = new Set();
    const entries = [];
    for (const item of rawItems) {
      const branch = normalizeBranchName(typeof item === "object" && item ? item.branch : item);
      if (seen.has(branch)) continue;
      seen.add(branch);
      entries.push({ branch, sha: typeof item === "object" && item ? item.sha : "" });
    }
    return entries;
  }
  
  async function ensureCurrentLocalBranch(branch, expectedSha) {
    const actualSha = (await git(currentRepo, ["rev-parse", "-q", "--verify", `refs/heads/${branch}^{commit}`], { timeout: 60000 }).catch(() => "")).trim().toLowerCase();
    if (!actualSha) throw new Error(`本地分支 ${branch} 已不存在，请刷新分支列表后重新选择。`);
    if (!actualSha.startsWith(expectedSha)) {
      throw new Error(`本地分支 ${branch} 已经变化。为避免重命名或删除错误分支，请刷新分支列表后重新选择。`);
    }
    return actualSha;
  }
  
  function normalizeExpectedBranchSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("分支列表状态已过期，请刷新分支列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("分支身份不合法，请刷新分支列表后重新选择。");
    return sha;
  }
  
  async function deleteBranches(body) {
    const branches = normalizeBranchActionEntries(body.branches);
    if (!branches.length) throw new Error("请选择要删除的本地分支");
    const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    const deleted = [];
    const failed = [];
    for (const entry of branches) {
      const { branch } = entry;
      try {
        ensureBranchDeletionAllowed(branch, currentBranch);
        await ensureCurrentLocalBranch(branch, normalizeExpectedBranchSha(entry.sha));
        await git(currentRepo, ["branch", "-d", branch], { timeout: 60000 });
        deleted.push(branch);
      } catch (error) {
        failed.push({ branch, error: friendlyErrorMessage(error, { body: { action: "deleteBranch", branch } }) });
      }
    }
    if (!deleted.length && failed.length) {
      throw new Error(`没有删除任何分支。\n${failed.map((item) => `${item.branch}：${item.error}`).join("\n")}`);
    }
    const lines = [`已删除 ${deleted.length} 个本地分支`];
    if (deleted.length) lines.push(`成功：${deleted.join("、")}`);
    if (failed.length) lines.push(`被 Git 阻止：${failed.map((item) => `${item.branch}（${item.error}）`).join("；")}`);
    return { ok: true, deleted, failed, output: lines.join("\n") };
  }
  
  async function pushCurrentBranch(operation) {
    const branch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (!branch || branch === "detached HEAD") {
      throw new Error("当前处于游离 HEAD，不能直接推送分支。请先切换或创建本地分支。");
    }
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${branch} 还没有任何提交，不能推送。请先创建首个提交后再推送。`);
    }
    const before = await readCurrentSyncState();
    const upstream = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "")).trim();
    let output = "";
    if (upstream) {
      ensurePushIsSafe(before);
      await ensureProtectedUpstreamPushAllowed(branch, upstream);
      output = await git(currentRepo, ["push", "--progress"], { timeout: 120000, operation });
    } else {
      const remoteNames = await readRemoteNames();
      const remote = remoteNames.includes("origin") ? "origin" : remoteNames[0];
      if (!remote) throw new Error("当前仓库没有远端。请先添加远端仓库后再推送。");
      output = await git(currentRepo, ["push", "--progress", "-u", remote, branch], { timeout: 120000, operation });
    }
    const after = await readCurrentSyncState();
    return syncCommandResult("push", output, before, after);
  }
  
  function ensurePushIsSafe(state) {
    if (!state?.upstream) return;
    if (state.upstreamGone) {
      throw new Error(`推送被保护：当前分支的 upstream ${state.upstream} 已不存在。请先抓取远端，并重新设置 upstream；如果要重新创建远端分支，请先取消 upstream 后再推送。`);
    }
    if (state.behind > 0) {
      const diverged = state.ahead > 0;
      const stateText = diverged ? `本地领先 ${state.ahead} 个提交，同时落后 ${state.behind} 个提交` : `本地落后 ${state.behind} 个提交`;
      throw new Error(`推送被保护：当前分支 ${state.branch} ${stateText}。普通 git push 会被远端拒绝，或覆盖团队协作风险过高。请先拉取/变基并检查待拉取提交；如果这是改写历史后的预期结果，请使用“安全强推”。`);
    }
  }
  
  async function ensureProtectedUpstreamPushAllowed(branch, upstream) {
    const parsed = splitRemoteBranchRef(upstream, await readRemoteNames());
    if (isProtectedBranchName(parsed.branch) && branch !== parsed.branch) {
      throw new Error(`推送被保护：当前分支 ${branch} 的 upstream 是远端主干/长期分支 ${upstream}。为避免把普通分支推到主干，请先取消 upstream，或切到 ${parsed.branch} 分支后再推送。`);
    }
  }
  
  async function forcePushCurrentBranchWithLease(body = {}, operation) {
    const branch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (!branch || branch === "detached HEAD") {
      throw new Error("当前处于游离 HEAD，不能直接强推。请先切换或创建本地分支。");
    }
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${branch} 还没有任何提交，不能强推。请先创建首个提交后再推送。`);
    }
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      throw new Error("当前分支没有 upstream，不能执行安全强推。请先普通推送一次建立跟踪关系。");
    }
    if (before.upstreamGone) {
      throw new Error("当前分支的 upstream 已不存在，不能执行安全强推。请先抓取远端并确认要推送到哪里。");
    }
    const remoteNames = await readRemoteNames();
    const parsed = splitRemoteBranchRef(before.upstream, remoteNames);
    if (isProtectedBranchName(parsed.branch)) {
      throw new Error(`远端分支 ${before.upstream} 是主干/长期分支，Forkline 默认保护，不允许从这里安全强推。`);
    }
    const leaseSha = normalizeExpectedUpstreamSha(body.expectedUpstreamSha);
    const output = await git(currentRepo, ["push", "--progress", `--force-with-lease=refs/heads/${parsed.branch}:${leaseSha}`, parsed.remote, `HEAD:${parsed.branch}`], { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return syncCommandResult("forcePush", output, before, after);
  }
  
  async function fetchRemotes(operation) {
    const before = await readCurrentSyncState();
    const output = await git(currentRepo, ["fetch", "--progress", "--all", "--prune"], { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return syncCommandResult("fetch", output, before, after);
  }
  
  async function fetchRemote(body, operation) {
    const remote = await ensureRemoteName(body.name);
    const before = await readCurrentSyncState();
    const output = await git(currentRepo, ["fetch", "--progress", remote, "--prune"], { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return syncCommandResult("fetch", output || `已抓取远端 ${remote}`, before, after);
  }
  
  async function testRemote(body) {
    const remote = await ensureRemoteName(body.name);
    const details = (await readRemoteDetails()).find((item) => item.name === remote) || { name: remote, fetchUrl: "", pushUrl: "" };
    let output = "";
    try {
      output = await git(currentRepo, ["ls-remote", "--heads", remote], { timeout: 60000, maxBuffer: 1024 * 1024 * 2 });
    } catch (error) {
      const reason = friendlyErrorMessage(error, { body: { ...body, action: "testRemote" } });
      const remoteError = new Error(reason);
      remoteError.remoteCheck = buildRemoteCheck(remote, details, "error", {
        reason,
        output: reason,
        rawOutput: String(error?.message || error || "").trim(),
      });
      throw remoteError;
    }
    const heads = String(output || "")
      .split(/\r?\n/)
      .filter((line) => line.includes("\trefs/heads/"));
    const lines = [
      `远端 ${remote} 连接正常`,
      `fetch URL：${details.fetchUrl || "未设置"}`,
      `push URL：${details.pushUrl || details.fetchUrl || "未设置"}`,
      `可读取分支：${heads.length} 个`,
      `检查命令：git ls-remote --heads ${remote}`,
    ];
    return {
      ok: true,
      output: lines.join("\n"),
      remoteCheck: buildRemoteCheck(remote, details, "success", {
        heads: heads.length,
        output: lines.join("\n"),
      }),
    };
  }
  
  function buildRemoteCheck(remote, details = {}, status, options = {}) {
    const fetchUrl = details.fetchUrl || "";
    const pushUrl = details.pushUrl || fetchUrl;
    const heads = Number.isFinite(options.heads) ? options.heads : 0;
    const reason = String(options.reason || "").trim();
    const rawOutput = String(options.rawOutput || "").trim();
    const output = String(options.output || reason || "").trim();
    const command = `git ls-remote --heads ${remote}`;
    return {
      remote,
      status,
      heads,
      fetchUrl,
      pushUrl,
      command,
      reason,
      rawOutput,
      output,
      diagnosis: remoteDiagnosis({ remote, fetchUrl, pushUrl, status, heads, reason, output, rawOutput }),
    };
  }
  
  function remoteDiagnosis({ remote, fetchUrl, pushUrl, status, heads, reason, output, rawOutput }) {
    const text = `${reason || ""}\n${output || ""}\n${rawOutput || ""}`.toLowerCase();
    const urlText = `${fetchUrl || ""} ${pushUrl || ""}`.toLowerCase();
    const host = extractRemoteHost(fetchUrl || pushUrl);
    const baseCommands = [`git remote -v`, `git ls-remote --heads ${remote}`];
    if (status === "success") {
      return {
        category: "ok",
        title: "远端读取正常",
        summary: `Forkline 已能读取 ${heads} 个远端分支，URL 和读取权限基本正常。`,
        steps: ["可以继续抓取、拉取或推送。", "如果推送失败，再查看同步页的保护提示和右侧日志。"],
        commands: baseCommands,
      };
    }
    if (text.includes("permission denied (publickey)") || text.includes("publickey") || text.includes("ssh") || urlText.startsWith("git@") || urlText.includes("ssh://")) {
      const commands = host ? [...baseCommands, `ssh -T git@${host}`, `ssh-add -l`, `git remote get-url ${remote}`] : [...baseCommands, `ssh-add -l`, `git remote get-url ${remote}`];
      return {
        category: "ssh",
        title: "SSH 凭据或主机认证",
        summary: "当前远端像是 SSH 连接失败，常见原因是 SSH key 没添加到平台、ssh-agent 没加载 key，或远端 URL 指向了错误账号。",
        steps: [
          "确认这个仓库应该使用 SSH 地址，且远端 URL 没写错。",
          host ? `在终端执行 ssh -T git@${host}，确认当前系统账号能通过平台认证。` : "在终端执行 ssh -T 对应 Git 主机，确认当前系统账号能通过平台认证。",
          "如果 key 不在 ssh-agent 里，先加载 key；如果不想处理 SSH，可以把远端 URL 改成 HTTPS。",
        ],
        commands,
      };
    }
    if (text.includes("authentication failed") || text.includes("could not read username") || text.includes("access denied") || text.includes("token") || (urlText.startsWith("http") && (text.includes("认证") || text.includes("authentication")))) {
      return {
        category: "https",
        title: "HTTPS 凭据或 Token",
        summary: "当前远端像是 HTTPS 登录失败，常见原因是凭据管理器里保存了旧密码，或 Personal Access Token 过期/权限不足。",
        steps: [
          "确认远端 URL 是你要访问的 HTTPS 仓库地址。",
          "检查 Windows 凭据管理器或 Git Credential Manager 中保存的账号和 Token。",
          "GitHub、GitLab 等平台通常要使用 Token，不能把账号密码当作推送密码。",
        ],
        commands: [...baseCommands, `git credential-manager diagnose`, `git remote get-url ${remote}`],
      };
    }
    if (text.includes("could not resolve host") || text.includes("主机名无法解析") || text.includes("dns")) {
      return {
        category: "network",
        title: "DNS 或主机名解析",
        summary: "Git 无法解析远端主机名，通常是 URL 主机写错、DNS、代理或网络环境问题。",
        steps: [
          "检查远端 URL 的主机名有没有拼写错误。",
          "确认当前网络、代理、VPN 或公司网络策略允许访问这个 Git 主机。",
          "修正 URL 或网络环境后重新执行诊断。",
        ],
        commands: [...baseCommands, `git remote get-url ${remote}`, `git config --get http.proxy`],
      };
    }
    if (text.includes("failed to connect") || text.includes("connection timed out") || text.includes("network is unreachable") || text.includes("连接超时") || text.includes("网络不可达")) {
      return {
        category: "network",
        title: "网络连接超时",
        summary: "Git 能识别远端地址，但连接不到服务器，常见原因是代理、VPN、防火墙或远端服务暂时不可达。",
        steps: [
          "确认浏览器或终端能访问对应 Git 平台。",
          "检查代理、VPN、防火墙和公司网络限制。",
          "网络恢复后先重新诊断，再执行抓取或推送。",
        ],
        commands: [...baseCommands, `git config --get http.proxy`, `git config --get https.proxy`],
      };
    }
    if (text.includes("ssl certificate") || text.includes("certificate") || text.includes("证书")) {
      return {
        category: "certificate",
        title: "HTTPS 证书校验",
        summary: "Git 在校验 HTTPS 证书时失败，常见原因是系统时间、公司代理证书或自签证书配置问题。",
        steps: [
          "先确认系统时间和时区正确。",
          "如果在公司网络或代理下，确认代理根证书已被系统和 Git 信任。",
          "不要直接关闭 SSL 校验；优先修复证书链或代理证书配置。",
        ],
        commands: [...baseCommands, `git config --show-origin --get http.sslCAInfo`, `git config --show-origin --get http.sslVerify`],
      };
    }
    if (text.includes("does not appear to be a git repository") || text.includes("no such remote") || text.includes("无法读取") || text.includes("unable to access")) {
      return {
        category: "url",
        title: "远端 URL 或仓库路径",
        summary: "远端地址不可用。可能是本地裸仓库路径不存在、URL 写错，或这个地址不是 Git 仓库。",
        steps: [
          "复制远端 URL 到浏览器或终端确认它真实存在。",
          "如果是本地路径远端，确认磁盘路径仍然存在且是裸仓库或普通 Git 仓库。",
          "在同步页修改 URL 后重新诊断。",
        ],
        commands: [...baseCommands, `git remote get-url ${remote}`],
      };
    }
    if (text.includes("repository not found") || text.includes("not found") || text.includes("仓库不存在") || text.includes("没有访问权限") || text.includes("权限")) {
      return {
        category: "permission",
        title: "仓库地址或访问权限",
        summary: "远端仓库可能不存在、已改名，或当前账号没有私有仓库/组织权限。",
        steps: [
          "先核对远端 URL 中的用户名、组织名和仓库名。",
          "确认当前登录账号有读取这个仓库的权限，私有仓库尤其要检查组织授权。",
          "如果仓库已迁移或改名，在同步页修改 URL 后重新诊断。",
        ],
        commands: [...baseCommands, `git remote get-url ${remote}`],
      };
    }
    return {
      category: "unknown",
      title: "需要继续排查",
      summary: "Forkline 没能把这次失败归到常见类型。先保留 Git 原始输出，再从 URL、网络和认证三条线排查。",
      steps: ["核对远端 URL。", "确认网络和代理可访问 Git 主机。", "确认当前系统账号或 Token 有仓库读取权限。"],
      commands: [...baseCommands, `git remote get-url ${remote}`],
    };
  }
  
  async function pullCurrentBranch(operation) {
    await currentLocalBranch("拉取");
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      throw new Error("当前分支没有 upstream，不能拉取。请先在同步页设置 upstream，或推送一次建立跟踪关系。");
    }
    if (before.upstreamGone) {
      throw new Error(`当前分支的 upstream ${before.upstream} 已不存在，不能拉取。请先抓取远端并重新设置 upstream。`);
    }
    const dirtySubmodules = await readDirtySubmoduleWorktrees();
    const args = ["pull", "--progress", "--ff-only"];
    if (dirtySubmodules.length) args.push("--no-recurse-submodules");
    const output = await git(currentRepo, args, { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return appendSkippedSubmoduleUpdate(syncCommandResult("pull", output, before, after), dirtySubmodules);
  }
  
  async function pullRebaseCurrentBranch(operation) {
    await currentLocalBranch("变基拉取");
    const repoOperation = detectRepoOperation(currentRepo);
    if (repoOperation) throw new Error(`仓库还有未完成操作：${repoOperation.label}。请先继续或中止后再变基拉取。`);
    await ensureCleanWorktree("当前有未提交修改。请先提交或储藏后再执行变基拉取。");
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      throw new Error("当前分支没有 upstream，不能执行变基拉取。请先在同步页设置 upstream。");
    }
    if (before.upstreamGone) {
      throw new Error(`当前分支的 upstream ${before.upstream} 已不存在，不能执行变基拉取。请先抓取远端并重新设置 upstream。`);
    }
    const dirtySubmodules = await readDirtySubmoduleWorktrees();
    const recovery = await createRecoveryPoint("pull-rebase");
    const args = ["pull", "--progress", "--rebase"];
    if (dirtySubmodules.length) args.push("--no-recurse-submodules");
    const output = await git(currentRepo, args, { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return appendRecoveryLine(appendSkippedSubmoduleUpdate(syncCommandResult("pullRebase", output, before, after), dirtySubmodules), recovery);
  }
  
  function appendSkippedSubmoduleUpdate(result, dirtySubmodules) {
    if (!dirtySubmodules.length) return result;
    const details = dirtySubmodules.slice(0, 5).map((item) => `${item.path}（${item.dirtyCount} 个未提交改动）`);
    const remaining = dirtySubmodules.length > details.length ? `；另有 ${dirtySubmodules.length - details.length} 个` : "";
    return {
      ...result,
      output: `${result.output}\n子模块保护：检测到 ${details.join("；")}${remaining}，本次只更新父仓库，没有递归切换子模块。请先处理子模块修改，再在“子模块”页更新。`,
      submoduleUpdateSkipped: true,
    };
  }
  
  async function cloneRepository(body, operation) {
    const source = normalizeRemoteUrl(body.url || body.source);
    const targetPath = normalizeCloneTargetPath(body.targetPath || body.path);
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) throw new Error(`目标文件夹的上级目录不存在：${parent}`);
    if (!fs.statSync(parent).isDirectory()) throw new Error(`目标文件夹的上级路径不是目录：${parent}`);
    if (fs.existsSync(targetPath)) {
      if (!fs.statSync(targetPath).isDirectory()) throw new Error(`目标路径已存在但不是文件夹：${targetPath}`);
      if (fs.readdirSync(targetPath).length) throw new Error(`目标文件夹不是空的：${targetPath}`);
    }
  
    const output = await gitStandalone(["clone", "--progress", "--", source, targetPath], { timeout: 600000, maxBuffer: 1024 * 1024 * 16, operation });
    const lines = [`克隆完成`, `来源：${source}`, `位置：${targetPath}`];
    const result = { ok: true, output: lines.join("\n"), clonedPath: targetPath, gitOutput: shortText(output, 2000) };
    if (body.openAfter !== false) {
      result.state = await openRepo(targetPath);
    }
    return result;
  }
  
  async function initRepository(body) {
    const targetPath = normalizeInitTargetPath(body.targetPath || body.path);
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) throw new Error(`目标文件夹的上级目录不存在：${parent}`);
    if (!fs.statSync(parent).isDirectory()) throw new Error(`目标文件夹的上级路径不是目录：${parent}`);
    if (fs.existsSync(targetPath)) {
      if (!fs.statSync(targetPath).isDirectory()) throw new Error(`目标路径已存在但不是文件夹：${targetPath}`);
    } else {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    const gitPath = path.join(targetPath, ".git");
    if (fs.existsSync(gitPath)) throw new Error(`这个文件夹已经是 Git 仓库：${targetPath}`);
  
    const output = await gitStandalone(["init", targetPath], { timeout: 60000, maxBuffer: 1024 * 1024 * 4 });
    const lines = [`初始化仓库完成`, `位置：${targetPath}`];
    const result = { ok: true, output: lines.join("\n"), initializedPath: targetPath, gitOutput: shortText(output, 2000) };
    if (body.openAfter !== false) {
      result.state = await openRepo(targetPath);
    }
    return result;
  }
  
  async function createWorktree(body) {
    const targetPath = normalizeWorktreeTargetPath(body.targetPath || body.path);
    const ref = normalizeRefName(body.ref || "HEAD", "工作树起点");
    const branch = String(body.branch || "").trim() ? normalizeBranchName(body.branch) : "";
    const currentBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    const usesCurrentHead = ref === "HEAD" || ref === "@" || (currentBranch && (ref === currentBranch || ref === `refs/heads/${currentBranch}`));
    if (usesCurrentHead && !(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${currentBranch || "HEAD"} 还没有任何提交，不能从 ${ref} 创建工作树。请先创建首个提交，或把工作树起点改成已有分支、Tag 或提交 SHA。`);
    }
    await ensureLiveRemoteBranchRef(ref);
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) throw new Error(`工作树上级目录不存在：${parent}`);
    if (!fs.statSync(parent).isDirectory()) throw new Error(`工作树上级路径不是目录：${parent}`);
    if (fs.existsSync(targetPath)) {
      if (!fs.statSync(targetPath).isDirectory()) throw new Error(`目标路径已存在但不是文件夹：${targetPath}`);
      if (fs.readdirSync(targetPath).length) throw new Error(`目标工作树文件夹不是空的：${targetPath}`);
    }
  
    const args = branch ? ["worktree", "add", "-b", branch, targetPath, ref] : ["worktree", "add", targetPath, ref];
    const output = await git(currentRepo, args, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    return {
      ok: true,
      output: [`已创建工作树`, `位置：${targetPath}`, branch ? `新分支：${branch}` : `起点：${ref}`].join("\n"),
      targetPath,
      branch,
      ref,
      gitOutput: shortText(output, 2000),
      state: await readState(),
    };
  }
  
  async function openWorktree(body) {
    const targetPath = normalizeExistingWorktreePath(body.path || body.targetPath);
    const state = await openRepo(targetPath);
    return {
      ok: true,
      output: `已打开工作树：${state.repo.path}`,
      state,
    };
  }
  
  async function pruneAllWorktrees() {
    const output = await git(currentRepo, ["worktree", "prune", "--verbose"], { timeout: 60000 });
    return {
      ok: true,
      output: output.trim() || "已清理失效工作树记录",
      state: await readState(),
    };
  }
  
  async function initSubmodules(operation) {
    const submodules = parseSubmodules(
      await git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      await git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => "")
    );
    if (!submodules.length) throw new Error("当前仓库没有配置子模块。");
    const output = await git(currentRepo, ["submodule", "update", "--progress", "--init", "--recursive"], { timeout: 600000, maxBuffer: 1024 * 1024 * 16, operation });
    return {
      ok: true,
      output: output.trim() || "已初始化并更新所有子模块",
      state: await readState(),
    };
  }
  
  async function updateSubmodules(body, operation) {
    const submodules = parseSubmodules(
      await git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      await git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => "")
    );
    if (!submodules.length) throw new Error("当前仓库没有配置子模块。");
    const submodulePath = body.path === undefined || body.path === null ? "" : String(body.path);
    const args = ["submodule", "update", "--progress", "--init", "--recursive"];
    let label = "所有子模块";
    if (submodulePath) {
      const file = normalizeSubmodulePath(submodulePath, submodules);
      args.push("--", file);
      label = file;
    }
    const output = await git(currentRepo, args, { timeout: 600000, maxBuffer: 1024 * 1024 * 16, operation });
    return {
      ok: true,
      output: output.trim() || `已更新${label}`,
      state: await readState(),
    };
  }
  
  async function syncSubmodules() {
    const submodules = parseSubmodules(
      await git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      await git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => "")
    );
    if (!submodules.length) throw new Error("当前仓库没有配置子模块。");
    const output = await git(currentRepo, ["submodule", "sync", "--recursive"], { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    return {
      ok: true,
      output: output.trim() || "已同步子模块 URL 配置",
      state: await readState(),
    };
  }
  
  async function addRemote(body) {
    const remote = normalizeRemoteName(body.name);
    const url = normalizeRemoteUrl(body.url);
    const remoteNames = await readRemoteNames();
    if (remoteNames.includes(remote)) throw new Error(`远端 ${remote} 已存在`);
    await git(currentRepo, ["remote", "add", remote, url], { timeout: 60000 });
    return { ok: true, output: `已添加远端 ${remote}\nURL：${url}` };
  }
  
  async function setRemoteUrl(body) {
    const remote = await ensureRemoteName(body.name);
    const url = normalizeRemoteUrl(body.url);
    const explicitPushUrls = await readExplicitRemotePushUrls(remote);
    await git(currentRepo, ["remote", "set-url", remote, url], { timeout: 60000 });
    if (explicitPushUrls.length) {
      await replaceRemotePushUrls(remote, [url]);
    }
    return { ok: true, output: `已修改远端 ${remote} 的 URL\nURL：${url}` };
  }
  
  async function deleteRemote(body) {
    const remote = await ensureRemoteName(body.name);
    await git(currentRepo, ["remote", "remove", remote], { timeout: 60000 });
    return { ok: true, output: `已删除远端 ${remote}` };
  }
  
  async function setCurrentBranchUpstream(body) {
    const branch = await currentLocalBranch("设置 upstream");
    const upstream = await ensureRemoteBranchRef(body.ref || body.upstream);
    const before = await readCurrentSyncState();
    if (before.unborn) {
      throw new Error(`当前分支 ${branch} 还没有任何提交，不能设置 upstream。请先创建首个提交后再设置。`);
    }
    if (before.upstream === upstream) {
      return { ok: true, output: `当前分支 ${branch} 已经跟踪 ${upstream}` };
    }
    await git(currentRepo, ["branch", `--set-upstream-to=${upstream}`, branch], { timeout: 60000 });
    const after = await readCurrentSyncState();
    const state = syncStateLine(after);
    return { ok: true, output: [`已设置 upstream：${branch} -> ${upstream}`, state].filter(Boolean).join("\n") };
  }
  
  async function unsetCurrentBranchUpstream() {
    const branch = await currentLocalBranch("取消 upstream");
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      return { ok: true, output: `当前分支 ${branch} 没有 upstream，无需取消` };
    }
    await git(currentRepo, ["branch", "--unset-upstream", branch], { timeout: 60000 });
    return { ok: true, output: `已取消 upstream：${branch}\n原 upstream：${before.upstream}` };
  }
  
  async function deleteRemoteBranch(body) {
    const remoteRef = normalizeRefName(body.ref || body.branch, "远端分支");
    if (remoteRef.endsWith("/HEAD")) throw new Error("不能删除远端 HEAD 引用");
    const remoteBranches = (await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item && !item.endsWith("/HEAD"));
    if (!remoteBranches.includes(remoteRef)) throw new Error("远端分支不存在，请先抓取远端后再试");
    const parsed = splitRemoteBranchRef(remoteRef, await readRemoteNames());
    if (isProtectedBranchName(parsed.branch)) {
      throw new Error(`远端分支 ${remoteRef} 是主干/长期分支，Forkline 默认保护，不允许从这里删除。`);
    }
    const deleteSha = await ensureRemoteBranchDeleteTargetFresh(remoteRef, parsed, normalizeExpectedRemoteBranchSha(body.sha));
    let output = "";
    try {
      output = await git(currentRepo, ["push", `--force-with-lease=refs/heads/${parsed.branch}:${deleteSha}`, parsed.remote, "--delete", parsed.branch], { timeout: 120000 });
    } catch (error) {
      if (!isMissingRemoteBranchDeleteError(error)) throw error;
      const pruneOutput = await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
      return commandResultWithSummary(`远端分支 ${remoteRef} 已不存在，已刷新远端分支列表`, pruneOutput);
    }
    await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
    return commandResultWithSummary(`已删除远端分支 ${remoteRef}`, output);
  }
  
  async function ensureRemoteBranchDeleteTargetFresh(remoteRef, parsed, expectedSha) {
    const localSha = (await git(currentRepo, ["rev-parse", "--verify", `refs/remotes/${remoteRef}^{commit}`], { timeout: 60000 }).catch(() => "")).trim();
    const remoteSha = await readRemoteBranchHeadSha(parsed);
    if (!localSha || !remoteSha) {
      await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
      throw new Error(`远端分支 ${remoteRef} 已不存在或本地列表已过期，已刷新远端分支列表。请刷新后重新选择。`);
    }
    if (!localSha.toLowerCase().startsWith(expectedSha)) {
      throw new Error(`远端分支 ${remoteRef} 的本地跟踪引用已经变化。为避免删除别人新推送的分支，请刷新后重新选择。`);
    }
    if (localSha !== remoteSha) {
      await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
      throw new Error(`远端分支 ${remoteRef} 已经变化，当前页面看到的不是最新远端分支。为避免删除别人新推送的分支，请刷新后重新选择。`);
    }
    return remoteSha;
  }
  
  async function readRemoteBranchHeadSha(parsed) {
    const output = await git(currentRepo, ["ls-remote", "--heads", parsed.remote, parsed.branch], { timeout: 60000, maxBuffer: 1024 * 1024 * 2 });
    const fullRef = `refs/heads/${parsed.branch}`;
    const row = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .find((parts) => parts[1] === fullRef);
    return row?.[0] || "";
  }
  
  function normalizeExpectedRemoteBranchSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("远端分支列表状态已过期，请刷新分支列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("远端分支身份不合法，请刷新分支列表后重新选择。");
    return sha;
  }
  
  function isMissingRemoteBranchDeleteError(error) {
    const lower = String(error?.message || error || "").toLowerCase();
    return (lower.includes("remote ref does not exist") || lower.includes("unable to delete")) && lower.includes("remote");
  }
  
  async function renameBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const newBranch = normalizeBranchName(body.newBranch);
    if (branch === newBranch) return { ok: true, branch, output: "分支名没有变化" };
    if (isProtectedBranchName(branch)) {
      throw new Error(`分支 ${branch} 是主干/长期分支，Forkline 默认保护，不允许从这里重命名。`);
    }
    await ensureCurrentLocalBranch(branch, normalizeExpectedBranchSha(body.sha));
    await git(currentRepo, ["check-ref-format", "--branch", newBranch]).catch(() => {
      throw new Error("分支名不合法");
    });
    const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    const args = branch === currentBranch ? ["branch", "-m", newBranch] : ["branch", "-m", branch, newBranch];
    await git(currentRepo, args, { timeout: 60000 });
    return { ok: true, branch: newBranch, output: `已重命名分支：${branch} -> ${newBranch}` };
  }
  
  async function mergeRef(body) {
    const ref = normalizeRefName(body.ref, "合并目标");
    await ensureLiveRemoteBranchRef(ref);
    const currentBranch = await currentLocalBranch("合并");
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${currentBranch} 还没有任何提交，不能合并分支。请先创建首个提交后再合并。`);
    }
    if (ref === currentBranch) throw new Error("不能把当前分支合并到自己");
    const output = await git(currentRepo, ["merge", "--no-ff", "--no-edit", ref], { timeout: 120000 });
    return commandResult(output || `已合并 ${ref}`);
  }
  
  async function rebaseOntoRef(body) {
    const ref = normalizeRefName(body.ref, "变基目标");
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再变基。`);
    await ensureLiveRemoteBranchRef(ref);
    const currentBranch = await currentLocalBranch("变基");
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${currentBranch} 还没有任何提交，不能变基。请先创建首个提交后再变基。`);
    }
    if (ref === currentBranch) throw new Error("不能把当前分支变基到自己");
    const dirty = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
    if (dirty.trim()) throw new Error("当前有未提交修改。请先提交或储藏后再变基。");
    await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 });
    const recovery = await createRecoveryPoint("rebase-onto");
    const output = await git(currentRepo, ["rebase", ref], { timeout: 120000 });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return appendRecoveryLine(commandResultWithSummary(`已将当前分支 ${currentBranch} 变基到 ${ref}，当前 HEAD 为 ${newHead}`, output), recovery);
  }
  
  async function createTag(body) {
    const name = normalizeTagName(body.name);
    let target = "";
    try {
      target = await resolveCommit(body.target);
    } catch {
      throw new Error("Tag 目标提交不存在或不是有效提交。请刷新提交列表后重新选择。");
    }
    const annotated = Boolean(body.annotated);
    const message = String(body.message || "").trim() || name;
    await git(currentRepo, ["check-ref-format", `refs/tags/${name}`]).catch(() => {
      throw new Error("标签名不合法");
    });
    const args = annotated ? ["tag", "-a", name, target, "-m", message] : ["tag", name, target];
    await git(currentRepo, args, { timeout: 60000 });
    return { ok: true, tag: name, output: `已创建 Tag ${name}` };
  }
  
  async function deleteTag(body) {
    const name = normalizeTagName(body.name);
    await ensureCurrentLocalTag(body);
    const output = await git(currentRepo, ["tag", "-d", name], { timeout: 60000 });
    return commandResultWithSummary(`已删除本地 Tag ${name}`, output);
  }
  
  async function pushTag(body) {
    const name = normalizeTagName(body.name);
    await ensureCurrentLocalTag(body);
    const remote = await defaultRemoteName(body.remote);
    const output = await git(currentRepo, ["push", remote, `refs/tags/${name}:refs/tags/${name}`], { timeout: 120000 });
    if (output.toLowerCase().includes("everything up-to-date")) {
      return commandResultWithSummary(`远端 ${remote} 已有相同 Tag ${name}，无需重复推送`, output);
    }
    return commandResultWithSummary(`已推送 Tag ${name} 到 ${remote}`, output);
  }
  
  async function deleteRemoteTag(body) {
    const name = normalizeTagName(body.name);
    await ensureCurrentLocalTag(body);
    const remote = await defaultRemoteName(body.remote);
    const deleteSha = await ensureRemoteTag(remote, name, normalizeExpectedTagSha(body.sha));
    const output = await git(currentRepo, ["push", `--force-with-lease=refs/tags/${name}:${deleteSha}`, remote, `:refs/tags/${name}`], { timeout: 120000 });
    return commandResultWithSummary(`已删除远端 Tag ${name}`, output);
  }
  
  async function pruneWorktrees(body) {
    const branch = normalizeBranchName(body.branch);
    const rows = parseWorktreeList(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
    const prunable = worktreePruneEntries(rows);
    const info = prunable.find((row) => row.branch === branch);
    if (!info) return { ok: true, output: "没有发现需要清理的失效 worktree 记录" };
    if (prunable.length !== 1) {
      throw new Error(`当前有 ${prunable.length} 条失效 worktree 记录。单项清理会影响其他记录，请刷新后在工作树页使用“清理失效”一次确认全部。`);
    }
    const output = await git(currentRepo, ["worktree", "prune", "--verbose"], { timeout: 60000 });
    return commandResult(output || "已清理失效 worktree 记录");
  }
  
  async function findCheckoutStash(body) {
    const branch = normalizeBranchName(body.branch);
    const stash = await findForklineStash(branch, String(body.message || "").trim());
    return { ok: true, stash };
  }
  
  async function restoreCheckoutStash(body) {
    const branch = normalizeBranchName(body.branch);
    const expectedSha = normalizeExpectedStashSha(body.sha);
    const currentBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (currentBranch !== branch) {
      throw new Error(`当前分支已经切换到 ${currentBranch || "HEAD"}，不能恢复属于 ${branch} 的切换储藏。请切回 ${branch} 后再恢复。`);
    }
    const stash = await findForklineStash(branch, String(body.message || "").trim(), expectedSha);
    if (!stash) throw new Error("这条切换储藏已经不存在或已经变化，请刷新储藏列表后重新选择。");
    await ensureStashHasNoGitlinkChanges(stash.ref);
    await git(currentRepo, ["stash", "pop", stash.ref], { timeout: 120000 });
    return "已恢复储藏的本地更改";
  }
  
  async function createStash(body) {
    const message = normalizeStashMessage(body.message);
    const files = normalizeStashFiles(body.files);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
    if (!statusOutput.trim()) throw new Error("没有可储藏的未提交更改");
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error("当前分支还没有任何提交，不能创建储藏。请先创建首个提交，或使用“丢弃全部”清理这些未跟踪文件。");
    }
    await ensureStashSelectionHasNoSubmoduleChanges(files);
    validateStashFiles(parseStatus(statusOutput), files);
    const args = ["stash", "push", "-u", "-m", message];
    if (files.length) args.push("--", ...files);
    const output = await git(currentRepo, args, { timeout: 120000 });
    return commandResult(output || `已创建储藏：${message}`);
  }
  
  async function ensureStashSelectionHasNoSubmoduleChanges(files = []) {
    const [stagedOutput, worktreeOutput] = await Promise.all([
      git(currentRepo, ["diff", "--cached", "--raw", "--no-abbrev", "-z"]),
      git(currentRepo, ["diff", "--raw", "--no-abbrev", "-z"]),
    ]);
    const selected = new Set(files);
    const changes = uniqueGitlinkChanges([
      ...parseRawGitlinkChanges(stagedOutput),
      ...parseRawGitlinkChanges(worktreeOutput),
    ]).filter((item) => !selected.size || selected.has(item.path) || selected.has(item.previousPath));
    if (!changes.length) return;
    throw new Error(`储藏范围包含子模块改动：${gitlinkChangeSummary(changes)}。Git stash 不能可靠保存或恢复子模块内部内容和 gitlink，弹出时还可能删除储藏但不恢复对应修改。请先进入子模块提交、储藏或还原；如果只是父仓库的子模块指针变化，请先提交该指针或切回父仓库记录的提交。`);
  }
  
  async function ensureStashHasNoGitlinkChanges(ref) {
    const [worktreeOutput, indexOutput] = await Promise.all([
      git(currentRepo, ["diff", "--raw", "--no-abbrev", "-z", `${ref}^1`, ref], { timeout: 60000 }),
      git(currentRepo, ["diff", "--raw", "--no-abbrev", "-z", `${ref}^1`, `${ref}^2`], { timeout: 60000 }),
    ]);
    const changes = uniqueGitlinkChanges([
      ...parseRawGitlinkChanges(worktreeOutput),
      ...parseRawGitlinkChanges(indexOutput),
    ]);
    if (!changes.length) return;
    throw new Error(`这条储藏包含子模块指针变化：${gitlinkChangeSummary(changes)}。Git stash apply/pop 不能可靠恢复这类 gitlink，弹出时还可能删除储藏但不恢复修改。Forkline 已阻止本次操作，原储藏仍保留；请先在子模块中确认目标提交，再手动更新父仓库的子模块指针。`);
  }
  
  function parseRawGitlinkChanges(output) {
    const records = String(output || "").split("\0");
    const changes = [];
    for (let index = 0; index < records.length;) {
      const header = records[index++];
      const match = header.match(/^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/);
      if (!match) continue;
      const previousPath = records[index++] || "";
      const path = match[5] === "R" || match[5] === "C" ? records[index++] || previousPath : previousPath;
      if (match[1] !== "160000" && match[2] !== "160000") continue;
      changes.push({ path, previousPath });
    }
    return changes;
  }
  
  function uniqueGitlinkChanges(changes) {
    const unique = new Map();
    for (const item of changes) {
      const key = `${item.previousPath}\0${item.path}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()];
  }
  
  function gitlinkChangeSummary(changes) {
    const details = changes.slice(0, 5).map((item) => item.previousPath && item.previousPath !== item.path ? `${item.previousPath} -> ${item.path}` : item.path);
    const remaining = changes.length > details.length ? `；另有 ${changes.length - details.length} 个` : "";
    return `${details.join("；")}${remaining}`;
  }
  
  function validateStashFiles(statusFiles, files) {
    const duplicate = findUnsafeStashDuplicatePath(statusFiles, files);
    if (duplicate) {
      throw new Error(`当前路径 ${duplicate.path} 同时存在“已暂存删除/重命名旧路径”和“未跟踪重建”。Git stash -u 会生成无法查看或应用的储藏。请先取消暂存删除，或把重建文件改名后再储藏。`);
    }
    if (!files.length) return;
    if (!selectedStashFilesHaveChanges(statusFiles, files)) {
      throw new Error("所选文件没有可储藏的改动。请刷新工作区后重新选择有改动的文件。");
    }
    for (const file of files) {
      const moved = statusFiles.find((item) => item.previousFile && (item.file === file || item.previousFile === file));
      if (moved) {
        throw new Error(`所选文件包含已暂存重命名：${moved.previousFile} -> ${moved.file}。Git 不支持只储藏这个重命名的一部分，请改用“储藏全部”，或先取消暂存后再选择要储藏的文件。`);
      }
    }
  }
  
  function findUnsafeStashDuplicatePath(statusFiles, files = []) {
    const selected = new Set(files);
    const includesAny = (paths) => !selected.size || paths.some((file) => selected.has(file));
    const untracked = new Set(statusFiles.filter((item) => item.indexStatus === "?").map((item) => item.file));
    for (const item of statusFiles) {
      if (!item.staged) continue;
      const stagedRemovedPaths = [];
      if (item.indexStatus === "D") stagedRemovedPaths.push({ path: item.file, related: [item.file] });
      if (item.previousFile && item.indexStatus === "R") stagedRemovedPaths.push({ path: item.previousFile, related: [item.previousFile, item.file] });
      for (const entry of stagedRemovedPaths) {
        if (untracked.has(entry.path) && includesAny(entry.related)) return { path: entry.path };
      }
    }
    return null;
  }
  
  function selectedStashFilesHaveChanges(statusFiles, files) {
    const selected = new Set(files);
    return statusFiles.some((item) => {
      if (selected.has(item.file)) return true;
      return Boolean(item.previousFile && selected.has(item.previousFile));
    });
  }
  
  async function branchFromStash(body) {
    const ref = await ensureCurrentStashRef(body);
    const branch = normalizeBranchName(body.branch);
    await ensureStashHasNoGitlinkChanges(ref);
    await ensureCleanWorktree("从储藏创建分支前，请先提交、储藏或丢弃当前工作区改动。");
    const existing = (await git(currentRepo, ["show-ref", "--verify", `refs/heads/${branch}`]).catch(() => "")).trim();
    if (existing) throw new Error(`本地分支 ${branch} 已存在，请换一个分支名。`);
    const output = await git(currentRepo, ["stash", "branch", branch, ref], { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    const state = await readState();
    return {
      ok: true,
      branch,
      ref,
      state,
      output: [`已从 ${ref} 创建并切换到分支 ${branch}`, "储藏已应用到新分支，并从储藏列表移除。"].join("\n"),
      gitOutput: shortText(output, 2000),
    };
  }
  
  async function applyPatchText(body) {
    const patch = normalizePatchText(body.patch);
    const stage = Boolean(body.stage);
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再应用补丁。`);
    const filePath = writeTempFile("forkline-apply-patch-", patch, ".patch");
    const checkArgs = ["apply", "--check", "--binary"];
    const applyArgs = ["apply", "--binary"];
    if (stage) {
      checkArgs.push("--index");
      applyArgs.push("--index");
    }
    checkArgs.push(filePath);
    applyArgs.push(filePath);
    try {
      await git(currentRepo, checkArgs, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
      const output = await git(currentRepo, applyArgs, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
      return {
        ok: true,
        output: output.trim() || (stage ? "已应用补丁并暂存改动" : "已应用补丁到工作区"),
        state: await readState(),
      };
    } finally {
      removeQuietly(filePath);
    }
  }
  
  async function ignoreWorktreePath(body) {
    const file = normalizeRepoFile(body.file);
    const mode = normalizeIgnoreMode(body.mode);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const target = selectStatusFile(parseStatus(statusOutput), file, "untracked");
    if (!target || target.indexStatus !== "?" || target.worktreeStatus !== "?") {
      throw new Error("只能把未跟踪文件加入 .gitignore。已跟踪文件需要先从 Git 索引中移除后才能忽略。");
    }
  
    const patternPath = mode === "directory" ? repoDirectoryForIgnore(file) : file;
    if (!patternPath) throw new Error("根目录文件没有可忽略的所在目录，请直接忽略这个文件。");
    const pattern = gitignorePattern(patternPath, mode);
    const gitignorePath = path.join(currentRepo, ".gitignore");
    const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
    const lines = existing.replace(/\r/g, "").split("\n");
    if (lines.includes(pattern)) {
      return `这个规则已经在 .gitignore 中：${pattern}`;
    }
  
    const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(gitignorePath, `${prefix}${pattern}\n`, "utf8");
    return mode === "directory" ? `已加入 .gitignore：${pattern}\n该目录下的未跟踪文件会从工作区列表中隐藏。` : `已加入 .gitignore：${pattern}`;
  }
  
  function normalizeIgnoreMode(value) {
    const mode = String(value || "file").trim().toLowerCase();
    if (mode === "file" || mode === "directory") return mode;
    throw new Error("忽略类型不合法，请刷新后再试。");
  }
  
  function repoDirectoryForIgnore(file) {
    const dir = path.posix.dirname(file);
    return dir && dir !== "." ? dir : "";
  }
  
  function gitignorePattern(patternPath, mode) {
    const normalized = normalizeRepoFile(patternPath);
    const escaped = normalized
      .split("/")
      .map((part) => part.replace(/[\\*?\[\]#!]/g, "\\$&"))
      .join("/");
    return mode === "directory" ? `/${escaped}/` : `/${escaped}`;
  }
  
  async function findForklineStash(branch, message = "", expectedSha = "") {
    const output = await git(currentRepo, ["stash", "list", "--format=%gd%x00%H%x00%s"]).catch(() => "");
    const rows = output
      .split(/\r?\n/)
      .map((line) => {
        const [ref, sha, subject] = line.split(GIT_LOG_FIELD_SEPARATOR);
        return { ref: (ref || "").trim(), sha: (sha || "").trim().toLowerCase(), subject: (subject || "").trim() };
      })
      .filter((item) => item.ref && item.subject);
    const exactMatches = message ? rows.filter((item) => isForklineCheckoutStashForBranch(item.subject, branch, message)) : [];
    const branchMatches = rows.filter((item) => isForklineCheckoutStashForBranch(item.subject, branch));
    const candidates = message ? exactMatches : branchMatches;
    const match = expectedSha
      ? candidates.find((item) => item.sha.startsWith(expectedSha))
      : exactMatches[0] || branchMatches[0];
    if (!match) return null;
    const messagePart = checkoutStashMessagePart(match.subject, branch);
    return { ref: match.ref, sha: match.sha, branch, message: messagePart, label: match.subject };
  }
  
  function isForklineCheckoutStashForBranch(subject, branch, message = "") {
    const messagePart = checkoutStashMessagePart(subject, branch);
    if (!messagePart.startsWith("Forkline: checkout ")) return false;
    return message ? messagePart === message : true;
  }
  
  function checkoutStashMessagePart(subject, branch) {
    const prefix = `On ${branch}: `;
    const text = String(subject || "");
    return text.startsWith(prefix) ? text.slice(prefix.length).trim() : "";
  }
  
  async function discardWorktreeFile(body) {
    const file = normalizeRepoFile(body.file);
    await ensureNotSubmoduleDiscardTarget(file);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const target = selectStatusFile(parseStatus(statusOutput), file, "unstaged");
    if (!target?.unstaged) throw new Error("这个文件没有可丢弃的工作区改动");
    if (target.indexStatus === "?") {
      await git(currentRepo, ["clean", "-f", "--", file], { timeout: 60000 });
    } else {
      await git(currentRepo, ["restore", "--worktree", "--", file], { timeout: 60000 });
    }
    return "工作区改动已丢弃";
  }
  
  async function ensureNotSubmoduleDiscardTarget(file, message = "") {
    const [indexOutput, headOutput] = await Promise.all([
      git(currentRepo, ["ls-files", "-s", "-z", "--", file]).catch(() => ""),
      git(currentRepo, ["ls-tree", "-z", "HEAD", "--", file]).catch(() => ""),
    ]);
    if (![indexOutput, headOutput].some((output) => output.split("\0").some((record) => record.startsWith("160000 ")))) return;
    throw new Error(message || `路径 ${file} 是独立 Git 子模块，不能从父仓库丢弃它的修改。请进入该子模块提交、储藏或还原后再刷新。`);
  }
  
  async function unstageFile(body) {
    const file = normalizeRepoFile(body.file);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
    const target = selectStatusFile(parseStatus(statusOutput), file, "staged");
    if (!target?.staged) throw new Error("这个文件没有可取消暂存的改动");
    const paths = target.previousFile ? [target.previousFile, file] : [file];
    return git(currentRepo, ["reset", "-q", "--", ...paths], { timeout: 60000 });
  }
  
  async function discardStagedFile(body) {
    const file = normalizeRepoFile(body.file);
    await ensureNotSubmoduleDiscardTarget(file, `路径 ${file} 是独立 Git 子模块，不能从父仓库丢弃它的已暂存修改。请使用“取消暂存”仅撤销 gitlink 暂存，或进入子模块处理后再更新父仓库记录。`);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
    const statusFiles = parseStatus(statusOutput);
    const target = selectStatusFile(statusFiles, file, "staged");
    if (!target?.staged) throw new Error("这个文件没有可丢弃的已暂存改动");
    if (target.previousFile && target.worktreeStatus) {
      await git(currentRepo, ["reset", "-q", "--", target.previousFile, file], { timeout: 60000 });
    } else if (target.previousFile) {
      await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--worktree", "--", target.previousFile, file], { timeout: 60000 });
    } else if (target.indexStatus === "A") {
      const args = target.worktreeStatus ? ["rm", "--cached", "-f", "--", file] : ["rm", "-f", "--", file];
      await git(currentRepo, args, { timeout: 60000 });
    } else if (statusFiles.some((item) => item.file === file && item.indexStatus === "?")) {
      await git(currentRepo, ["restore", "--staged", "--", file], { timeout: 60000 });
    } else if (target.worktreeStatus) {
      await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--", file], { timeout: 60000 });
    } else {
      await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--worktree", "--", file], { timeout: 60000 });
    }
    return "已暂存改动已丢弃";
  }
  
  async function resolveConflictFile(body) {
    const file = normalizeRepoFile(body.file);
    const side = normalizeConflictSide(body.side);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const target = selectStatusFile(parseStatus(statusOutput), file, "conflict");
    if (!target?.conflict) throw new Error("这个文件当前没有未解决冲突。");
    await git(currentRepo, ["checkout", `--${side}`, "--", file], { timeout: 60000 });
    await git(currentRepo, ["add", "--", file], { timeout: 60000 });
    return side === "ours" ? "已使用当前版本解决冲突并暂存" : "已使用对方版本解决冲突并暂存";
  }
  
  async function applyWorktreeHunk(body, kind) {
    const file = normalizeRepoFile(body.file);
    const hunkIndex = normalizeHunkIndex(body.hunkIndex);
    const requestedScope = String(body.scope || "unstaged").trim().toLowerCase();
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const target = selectStatusFile(parseStatus(statusOutput), file, worktreeActionTargetScope(kind, requestedScope));
    if (!target) throw new Error("这个文件当前没有可操作的改动。");
    if (target.conflict) throw new Error("冲突文件暂不支持按块操作，请先解决冲突。");
    const isUntracked = target.indexStatus === "?";
    const scope = isUntracked && requestedScope === "untracked" ? "untracked" : normalizeDiffScope(requestedScope);
    if (isUntracked && kind !== "stage") throw new Error("未跟踪文件只支持按块暂存；如果要删除内容，请在编辑器里修改文件。");
    if (kind === "stage" && scope !== "unstaged" && scope !== "untracked") throw new Error("只能暂存未暂存的改动块。");
    if (kind === "discard" && scope !== "unstaged") throw new Error("只能丢弃工作区中的未暂存改动块。");
    if (kind === "unstage" && scope !== "staged") throw new Error("只能取消暂存已暂存的改动块。");
    if ((kind === "stage" || kind === "discard") && !target.unstaged) throw new Error("这个文件没有未暂存改动块。");
    if (kind === "unstage" && !target.staged) throw new Error("这个文件没有已暂存改动块。");
  
    const diffOutput = isUntracked ? readNewFileDiff(file) : await readWorktreeDiffOutput(file, scope, target, currentRepo, body.diffContext);
    const diffContext = normalizeWorktreeDiffContext(body.diffContext);
    const movedFileUnstage = kind === "unstage" && isMovedFileDiffOutput(diffOutput);
    const patch = movedFileUnstage ? extractMovedFileUnstageHunkPatch(diffOutput, hunkIndex) : extractSingleHunkPatch(diffOutput, hunkIndex);
    const patchFile = writeTempFile("forkline-hunk-", patch, ".patch");
    try {
      const args = ["apply", "--whitespace=nowarn"];
      if (!isUntracked && diffContext === FILE_EDITOR_DIFF_CONTEXT) args.push("--unidiff-zero");
      if (kind === "stage") args.push("--cached");
      if (kind === "unstage") {
        args.push("--cached");
        if (!movedFileUnstage) args.push("--reverse");
      }
      if (kind === "discard") args.push("--reverse");
      args.push(patchFile);
      await git(currentRepo, args, { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
      if (kind === "discard") await refreshIndexStatForFile(file);
    } catch (error) {
      throw new Error(`改动块操作失败：${friendlyErrorMessage(error, { body: { action: `${kind}Hunk` } })}`);
    } finally {
      removeQuietly(patchFile);
    }
    if (kind === "stage") return isUntracked ? "已暂存此未跟踪文件改动块" : "已暂存此改动块";
    if (kind === "unstage") return "已取消暂存此改动块";
    return "工作区改动块已丢弃";
  }
  
  async function stageSelectedLines(body) {
    const file = normalizeRepoFile(body.file);
    const selectedLines = normalizeDiffLineSelections(body.lines);
    const requestedScope = String(body.scope || "unstaged").trim().toLowerCase();
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const target = selectStatusFile(parseStatus(statusOutput), file, requestedScope === "untracked" ? "untracked" : "unstaged");
    if (!target) throw new Error("这个文件当前没有可操作的改动。");
    if (target.conflict) throw new Error("冲突文件暂不支持按行暂存，请先解决冲突。");
    if (!target.unstaged) throw new Error("这个文件没有可暂存的工作区改动。");
  
    const isUntracked = target.indexStatus === "?";
    const scope = isUntracked && requestedScope === "untracked" ? "untracked" : normalizeDiffScope(requestedScope);
    if (scope !== "unstaged" && scope !== "untracked") throw new Error("只能暂存工作区中未暂存的行。");
  
    const diffOutput = isUntracked ? readNewFileDiff(file) : await readWorktreeDiffOutput(file, "unstaged");
    const patchMode = isDeletedFileDiffOutput(diffOutput) ? "stage-deleted-file" : "stage";
    const patch = extractSelectedLinePatch(diffOutput, selectedLines, patchMode);
    const patchFile = writeTempFile("forkline-lines-", patch, ".patch");
    try {
      await git(currentRepo, ["apply", "--cached", "--whitespace=nowarn", "--recount", patchFile], { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
    } catch (error) {
      throw new Error(`按行暂存失败：${friendlyErrorMessage(error, { body: { action: "stageSelectedLines" } })}`);
    } finally {
      removeQuietly(patchFile);
    }
    return `已暂存所选 ${selectedLines.length} 行`;
  }
  
  async function unstageSelectedLines(body) {
    const file = normalizeRepoFile(body.file);
    const selectedLines = normalizeDiffLineSelections(body.lines);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
    const target = selectStatusFile(parseStatus(statusOutput), file, "staged");
    if (!target) throw new Error("这个文件当前没有可操作的改动。");
    if (target.conflict) throw new Error("冲突文件暂不支持按行取消暂存，请先解决冲突。");
    if (!target.staged) throw new Error("这个文件没有可取消暂存的已暂存改动。");
    const scope = normalizeDiffScope(body.scope || "staged");
    if (scope !== "staged") throw new Error("只能在已暂存 Diff 中取消暂存所选行。");
  
    const diffOutput = await readWorktreeDiffOutput(file, "staged");
    const patchMode = isNewFileDiffOutput(diffOutput) ? "unstage-new-file" : isMovedFileDiffOutput(diffOutput) ? "unstage-moved-file" : "unstage";
    const patch = extractSelectedLinePatch(diffOutput, selectedLines, patchMode);
    const patchFile = writeTempFile("forkline-lines-", patch, ".patch");
    try {
      const args = ["apply", "--cached", "--whitespace=nowarn", "--recount"];
      if (patchMode === "unstage") args.push("--reverse");
      args.push(patchFile);
      await git(currentRepo, args, { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
    } catch (error) {
      throw new Error(`按行取消暂存失败：${friendlyErrorMessage(error, { body: { action: "unstageSelectedLines" } })}`);
    } finally {
      removeQuietly(patchFile);
    }
    return `已取消暂存所选 ${selectedLines.length} 行`;
  }
  
  function normalizeDiffLineSelections(value) {
    if (!Array.isArray(value) || !value.length) throw new Error("请选择要暂存的 Diff 行。");
    if (value.length > 300) throw new Error("一次最多暂存 300 行，请分批操作。");
    const seen = new Set();
    const lines = [];
    for (const item of value) {
      const hunkIndex = normalizeHunkIndex(item?.hunkIndex);
      const lineIndex = Number.parseInt(String(item?.lineIndex ?? ""), 10);
      if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex > 10000) throw new Error("Diff 行号不合法，请刷新后再试。");
      const key = `${hunkIndex}:${lineIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({ hunkIndex, lineIndex, key });
    }
    if (!lines.length) throw new Error("请选择要暂存的 Diff 行。");
    return lines;
  }
  
  function extractSelectedLinePatch(diffOutput, selectedLines, mode = "stage") {
    const text = String(diffOutput || "");
    if (!text.trim()) throw new Error("没有可操作的 Diff 行。");
    const selectedKeys = new Set(selectedLines.map((line) => line.key));
    const matchedKeys = new Set();
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    const header = [];
    const hunks = [];
    let current = null;
    let hunkIndex = -1;
    for (const line of lines) {
      if (line.startsWith("@@ ")) {
        if (current) hunks.push(current);
        hunkIndex += 1;
        current = { ...parseUnifiedHunkHeader(line), index: hunkIndex, lines: [] };
        continue;
      }
      if (current) {
        current.lines.push(line);
        continue;
      }
      if (line) header.push(line);
    }
    if (current) hunks.push(current);
    if (!header.length || !hunks.length) throw new Error("没有可操作的 Diff 行。");
    if (mode === "stage-deleted-file") {
      return extractDeletedFileStageLinePatch(header, hunks, selectedKeys, matchedKeys);
    }
    if (mode === "unstage-new-file") {
      return extractNewFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys);
    }
    if (mode === "unstage-moved-file") {
      return extractMovedFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys);
    }
    const selectedHunks = hunks
      .map((hunk) => buildSelectedLineHunk(hunk, selectedKeys, matchedKeys, mode))
      .filter(Boolean);
    if (!selectedHunks.length) throw new Error("请选择新增或删除行，普通上下文行不能单独暂存。");
    if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
    return [...header, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
  }
  
  function parseUnifiedHunkHeader(line) {
    const match = String(line || "").match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match) throw new Error("Diff 块头不合法，请刷新后再试。");
    return {
      oldStart: Number(match[1]),
      oldCount: match[2] === undefined ? 1 : Number(match[2]),
      newStart: Number(match[3]),
      newCount: match[4] === undefined ? 1 : Number(match[4]),
    };
  }
  
  function isNewFileDiffOutput(diffOutput) {
    return /(?:^|\n)--- \/dev\/null\n\+\+\+ /.test(String(diffOutput || "").replace(/\r\n/g, "\n"));
  }
  
  function isDeletedFileDiffOutput(diffOutput) {
    return /(?:^|\n)--- .+\n\+\+\+ \/dev\/null/.test(String(diffOutput || "").replace(/\r\n/g, "\n"));
  }
  
  function isMovedFileDiffOutput(diffOutput) {
    return /(?:^|\n)(rename|copy) (from|to) /.test(String(diffOutput || "").replace(/\r\n/g, "\n"));
  }
  
  function extractDeletedFileStageLinePatch(header, hunks, selectedKeys, matchedKeys) {
    const delKeys = collectSelectableDelLineKeys(hunks);
    const selectedDelKeys = delKeys.filter((key) => selectedKeys.has(key));
    if (!selectedDelKeys.length) throw new Error("请选择删除行，普通上下文行不能单独暂存。");
    const allDeletedLinesSelected = selectedDelKeys.length === delKeys.length;
    const patchHeader = deletedFileStagePatchHeader(header, allDeletedLinesSelected);
    const selectedHunks = hunks
      .map((hunk) => buildDeletedFileStageLineHunk(hunk, selectedKeys, matchedKeys, allDeletedLinesSelected))
      .filter(Boolean);
    if (!selectedHunks.length) throw new Error("请选择删除行，普通上下文行不能单独暂存。");
    if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
    return [...patchHeader, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
  }
  
  function extractNewFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys) {
    const addKeys = collectSelectableAddLineKeys(hunks);
    const selectedAddKeys = addKeys.filter((key) => selectedKeys.has(key));
    if (!selectedAddKeys.length) throw new Error("请选择新增行，普通上下文行不能单独取消暂存。");
    const allAddedLinesSelected = selectedAddKeys.length === addKeys.length;
    const patchHeader = newFileUnstagePatchHeader(header, allAddedLinesSelected);
    const selectedHunks = hunks
      .map((hunk) => buildNewFileUnstageLineHunk(hunk, selectedKeys, matchedKeys, allAddedLinesSelected))
      .filter(Boolean);
    if (!selectedHunks.length) throw new Error("请选择新增行，普通上下文行不能单独取消暂存。");
    if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
    return [...patchHeader, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
  }
  
  function extractMovedFileUnstageLinePatch(header, hunks, selectedKeys, matchedKeys) {
    const selectedChangeKeys = collectSelectableAddLineKeys(hunks)
      .concat(collectSelectableDelLineKeys(hunks))
      .filter((key) => selectedKeys.has(key));
    if (!selectedChangeKeys.length) throw new Error("请选择新增或删除行，普通上下文行不能单独取消暂存。");
    const patchHeader = movedFileUnstagePatchHeader(header);
    const selectedHunks = hunks
      .map((hunk) => buildMovedFileUnstageLineHunk(hunk, selectedKeys, matchedKeys))
      .filter(Boolean);
    if (!selectedHunks.length) throw new Error("请选择新增或删除行，普通上下文行不能单独取消暂存。");
    if (matchedKeys.size !== selectedKeys.size) throw new Error("部分 Diff 行已经变化，请刷新后再试。");
    return [...patchHeader, ...selectedHunks].join("\n").replace(/\n*$/, "\n");
  }
  
  function collectSelectableAddLineKeys(hunks) {
    const keys = [];
    hunks.forEach((hunk) => {
      let selectableLineIndex = -1;
      hunk.lines.forEach((line) => {
        if (line.startsWith("\\")) return;
        selectableLineIndex += 1;
        if (line.startsWith("+")) keys.push(`${hunk.index}:${selectableLineIndex}`);
      });
    });
    return keys;
  }
  
  function collectSelectableDelLineKeys(hunks) {
    const keys = [];
    hunks.forEach((hunk) => {
      let selectableLineIndex = -1;
      hunk.lines.forEach((line) => {
        if (line.startsWith("\\")) return;
        selectableLineIndex += 1;
        if (line.startsWith("-")) keys.push(`${hunk.index}:${selectableLineIndex}`);
      });
    });
    return keys;
  }
  
  function deletedFileStagePatchHeader(header, deleteFile = false) {
    const diffLine = header.find((line) => line.startsWith("diff --git ")) || header[0];
    const oldPathLine = header.find((line) => line.startsWith("--- "));
    if (!oldPathLine || oldPathLine === "--- /dev/null") throw new Error("删除文件 Diff 头不完整，请刷新后再试。");
    const oldPath = oldPathLine.slice(4);
    const newPath = oldPath.startsWith("a/") ? `b/${oldPath.slice(2)}` : oldPath;
    const modeLine = header.find((line) => line.startsWith("deleted file mode "));
    if (deleteFile) {
      return [diffLine, modeLine || "", oldPathLine, "+++ /dev/null"].filter(Boolean);
    }
    return [diffLine, oldPathLine, `+++ ${newPath}`];
  }
  
  function newFileUnstagePatchHeader(header, deleteFile = false) {
    const diffLine = header.find((line) => line.startsWith("diff --git ")) || header[0];
    const newPathLine = header.find((line) => line.startsWith("+++ "));
    if (!newPathLine || newPathLine === "+++ /dev/null") throw new Error("新文件 Diff 头不完整，请刷新后再试。");
    const newPath = newPathLine.slice(4);
    const oldPath = newPath.startsWith("b/") ? `a/${newPath.slice(2)}` : newPath;
    const modeLine = header.find((line) => line.startsWith("new file mode "));
    if (deleteFile) {
      return [diffLine, modeLine ? `deleted file mode ${modeLine.slice("new file mode ".length)}` : "", `--- ${oldPath}`, "+++ /dev/null"].filter(Boolean);
    }
    return [diffLine, `--- ${oldPath}`, newPathLine];
  }
  
  function movedFileUnstagePatchHeader(header) {
    const newPathLine = header.find((line) => line.startsWith("+++ "));
    if (!newPathLine || newPathLine === "+++ /dev/null") throw new Error("重命名文件 Diff 头不完整，请刷新后再试。");
    const newPath = stripDiffPathSuffix(newPathLine.slice(4));
    const oldPath = newPath.startsWith("b/") ? `a/${newPath.slice(2)}` : newPath;
    return [`diff --git ${oldPath} ${newPath}`, `--- ${oldPath}`, `+++ ${newPath}`];
  }
  
  function stripDiffPathSuffix(value) {
    return String(value || "").replace(/\t.*$/, "");
  }
  
  function buildDeletedFileStageLineHunk(hunk, selectedKeys, matchedKeys, deleteFile = false) {
    const lines = [];
    let changed = false;
    let selectableLineIndex = -1;
    hunk.lines.forEach((line) => {
      const selectable = !line.startsWith("\\");
      if (selectable) selectableLineIndex += 1;
      const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
      const selected = selectedKeys.has(key);
      if (line.startsWith("-")) {
        if (selected || deleteFile) {
          lines.push(line);
          if (selected) matchedKeys.add(key);
          changed = true;
        } else {
          lines.push(` ${line.slice(1)}`);
        }
        return;
      }
      if (line.startsWith("\\")) lines.push(line);
    });
    if (!changed) return "";
    const counts = countUnifiedHunkLines(lines);
    const newStart = deleteFile ? 0 : hunk.oldStart;
    const newCount = deleteFile ? 0 : counts.newCount;
    return [
      `@@ -${formatUnifiedRange(hunk.oldStart, counts.oldCount)} +${formatUnifiedRange(newStart, newCount)} @@`,
      ...lines,
    ].join("\n");
  }
  
  function buildNewFileUnstageLineHunk(hunk, selectedKeys, matchedKeys, deleteFile = false) {
    const lines = [];
    let changed = false;
    let selectableLineIndex = -1;
    hunk.lines.forEach((line) => {
      const selectable = !line.startsWith("\\");
      if (selectable) selectableLineIndex += 1;
      const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
      const selected = selectedKeys.has(key);
      if (line.startsWith("+")) {
        if (selected || deleteFile) {
          lines.push(`-${line.slice(1)}`);
          if (selected) matchedKeys.add(key);
          changed = true;
        } else {
          lines.push(` ${line.slice(1)}`);
        }
        return;
      }
      if (line.startsWith("\\")) lines.push(line);
    });
    if (!changed) return "";
    const counts = countUnifiedHunkLines(lines);
    const newStart = deleteFile ? 0 : hunk.newStart;
    const newCount = deleteFile ? 0 : counts.newCount;
    return [
      `@@ -${formatUnifiedRange(hunk.newStart, counts.oldCount)} +${formatUnifiedRange(newStart, newCount)} @@`,
      ...lines,
    ].join("\n");
  }
  
  function buildMovedFileUnstageLineHunk(hunk, selectedKeys, matchedKeys) {
    const lines = [];
    let changed = false;
    let selectableLineIndex = -1;
    let previousDiffLineIncluded = false;
    hunk.lines.forEach((line) => {
      if (line.startsWith("\\")) {
        if (previousDiffLineIncluded) lines.push(line);
        return;
      }
      previousDiffLineIncluded = false;
      const selectable = !line.startsWith("\\");
      if (selectable) selectableLineIndex += 1;
      const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
      const selected = selectedKeys.has(key);
      if (line.startsWith("+")) {
        if (selected) {
          lines.push(`-${line.slice(1)}`);
          matchedKeys.add(key);
          changed = true;
          previousDiffLineIncluded = true;
        } else {
          lines.push(` ${line.slice(1)}`);
          previousDiffLineIncluded = true;
        }
        return;
      }
      if (line.startsWith("-")) {
        if (selected) {
          lines.push(`+${line.slice(1)}`);
          matchedKeys.add(key);
          changed = true;
          previousDiffLineIncluded = true;
        }
        return;
      }
      if (selected) matchedKeys.add(key);
      lines.push(line);
      previousDiffLineIncluded = true;
    });
    if (!changed) return "";
    const counts = countUnifiedHunkLines(lines);
    return [
      `@@ -${formatUnifiedRange(hunk.newStart, counts.oldCount)} +${formatUnifiedRange(hunk.newStart, counts.newCount)} @@`,
      ...lines,
    ].join("\n");
  }
  
  function buildSelectedLineHunk(hunk, selectedKeys, matchedKeys, mode = "stage") {
    const lines = [];
    let changed = false;
    let selectableLineIndex = -1;
    let previousDiffLineIncluded = false;
    hunk.lines.forEach((line) => {
      if (line.startsWith("\\")) {
        if (previousDiffLineIncluded) lines.push(line);
        return;
      }
      previousDiffLineIncluded = false;
      const selectable = !line.startsWith("\\");
      if (selectable) selectableLineIndex += 1;
      const key = selectable ? `${hunk.index}:${selectableLineIndex}` : "";
      const selected = selectedKeys.has(key);
      if (line.startsWith("+")) {
        if (selected) {
          lines.push(line);
          matchedKeys.add(key);
          changed = true;
          previousDiffLineIncluded = true;
        } else if (mode === "unstage") {
          lines.push(` ${line.slice(1)}`);
          previousDiffLineIncluded = true;
        }
        return;
      }
      if (line.startsWith("-")) {
        if (selected) {
          lines.push(line);
          matchedKeys.add(key);
          changed = true;
          previousDiffLineIncluded = true;
        } else {
          if (mode === "stage") {
            lines.push(` ${line.slice(1)}`);
            previousDiffLineIncluded = true;
          }
        }
        return;
      }
      if (selected) matchedKeys.add(key);
      lines.push(line);
      previousDiffLineIncluded = true;
    });
    if (!changed) return "";
    const counts = countUnifiedHunkLines(lines);
    const newStart = hunk.oldStart === 0 ? hunk.newStart : hunk.oldStart;
    return [
      `@@ -${formatUnifiedRange(hunk.oldStart, counts.oldCount)} +${formatUnifiedRange(newStart, counts.newCount)} @@`,
      ...lines,
    ].join("\n");
  }
  
  function countUnifiedHunkLines(lines) {
    return lines.reduce((counts, line) => {
      if (line.startsWith("\\")) return counts;
      if (line.startsWith("+")) counts.newCount += 1;
      else if (line.startsWith("-")) counts.oldCount += 1;
      else {
        counts.oldCount += 1;
        counts.newCount += 1;
      }
      return counts;
    }, { oldCount: 0, newCount: 0 });
  }
  
  function formatUnifiedRange(start, count) {
    return count === 1 ? String(start) : `${start},${count}`;
  }
  
  async function refreshIndexStatForFile(file) {
    await git(currentRepo, ["update-index", "--refresh", "--", file], { timeout: 60000 }).catch(() => "");
  }
  
  function extractSingleHunkPatch(diffOutput, targetHunkIndex) {
    const lines = String(diffOutput || "").split("\n");
    if (!lines.length || !String(diffOutput || "").trim()) throw new Error("没有可操作的 Diff 块。");
    const header = [];
    const hunk = [];
    let currentHunk = -1;
    let collecting = false;
    for (const line of lines) {
      if (line.startsWith("diff --git ") && currentHunk >= 0) break;
      if (line.startsWith("@@ ")) {
        currentHunk += 1;
        collecting = currentHunk === targetHunkIndex;
        if (collecting) hunk.push(line);
        continue;
      }
      if (currentHunk < 0) {
        if (line !== "") header.push(line);
        continue;
      }
      if (collecting) hunk.push(line);
    }
    if (!hunk.length) throw new Error("找不到这个改动块，请刷新后再试。");
    return [...header, ...hunk].join("\n").replace(/\n*$/, "\n");
  }
  
  function extractMovedFileUnstageHunkPatch(diffOutput, targetHunkIndex) {
    const lines = String(diffOutput || "").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    if (!lines.length || !String(diffOutput || "").trim()) throw new Error("没有可操作的 Diff 块。");
    const header = [];
    const hunk = [];
    let hunkHeader = "";
    let currentHunk = -1;
    let collecting = false;
    for (const line of lines) {
      if (line.startsWith("diff --git ") && currentHunk >= 0) break;
      if (line.startsWith("@@ ")) {
        currentHunk += 1;
        collecting = currentHunk === targetHunkIndex;
        if (collecting) hunkHeader = line;
        continue;
      }
      if (currentHunk < 0) {
        if (line !== "") header.push(line);
        continue;
      }
      if (collecting) hunk.push(line);
    }
    if (!hunkHeader) throw new Error("找不到这个改动块，请刷新后再试。");
    const parsed = parseUnifiedHunkHeader(hunkHeader);
    const linesForNewPath = [];
    let changed = false;
    hunk.forEach((line) => {
      if (line.startsWith("+")) {
        linesForNewPath.push(`-${line.slice(1)}`);
        changed = true;
        return;
      }
      if (line.startsWith("-")) {
        linesForNewPath.push(`+${line.slice(1)}`);
        changed = true;
        return;
      }
      linesForNewPath.push(line);
    });
    if (!changed) throw new Error("这个改动块没有可取消暂存的内容行。");
    const counts = countUnifiedHunkLines(linesForNewPath);
    return [
      ...movedFileUnstagePatchHeader(header),
      `@@ -${formatUnifiedRange(parsed.newStart, counts.oldCount)} +${formatUnifiedRange(parsed.newStart, counts.newCount)} @@`,
      ...linesForNewPath,
    ].join("\n").replace(/\n*$/, "\n");
  }
  
  async function rewordCommit(body) {
    const sha = normalizeSha(body.sha);
    const { summary, body: detail } = normalizeCommitMessageInput(body.summary, body.body);
    const statusOutput = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
    if (statusOutput.trim()) throw new Error("修改历史提交信息前，请先提交、暂存或还原工作区改动");
    const target = (await git(currentRepo, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
    await git(currentRepo, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
      throw new Error("只能修改当前分支历史中的提交信息");
    });
    const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
    const parents = parentLine.split(/\s+/).slice(1);
    if (parents.length > 1) throw new Error("暂不支持自动修改 merge 提交信息");
    if ((await git(currentRepo, ["rev-parse", "HEAD"])).trim() !== target) {
      await ensureLinearRewriteRange(parents.length ? `${target}^` : "--root", "reword");
    }
    const messageFile = writeTempFile("forkline-message-", `${summary}${detail ? `\n\n${detail}` : ""}\n`);
    const recovery = await createRecoveryPoint("reword");
    try {
      if ((await git(currentRepo, ["rev-parse", "HEAD"])).trim() === target) {
        await git(currentRepo, ["commit", "--amend", "-F", messageFile], { timeout: 120000 });
      } else {
        const editorFile = writeTempFile("forkline-sequence-", sequenceEditorScript(target), ".cjs");
        const messageEditorFile = writeTempFile("forkline-message-editor-", messageEditorScript(messageFile), ".cjs");
        try {
          const args = parents.length ? ["rebase", "-i", `${target}^`] : ["rebase", "-i", "--root"];
          await git(currentRepo, args, {
            timeout: 180000,
            env: {
              GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${editorFile}"`,
              GIT_EDITOR: `"${process.execPath}" "${messageEditorFile}"`,
            },
          });
        } finally {
          removeQuietly(editorFile);
          removeQuietly(messageEditorFile);
        }
      }
    } catch (error) {
      await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
      throw error;
    } finally {
      removeQuietly(messageFile);
    }
    return ["提交信息已修改，历史 SHA 已重写", recoveryPointLine(recovery)].filter(Boolean).join("\n");
  }
  
  async function rewriteHistoryCommit(body) {
    const mode = normalizeHistoryRewriteMode(body.mode);
    if (mode === "reword") throw new Error("请使用“修改提交信息”或历史编辑队列里的“改信息”。");
    const target = await resolveCommit(body.sha);
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);
    await ensureCleanWorktree("编辑历史提交前，请先提交、暂存或还原工作区改动");
    const currentBranch = await currentLocalBranchForRewrite();
    await ensureCommitInCurrentHistory(target);
    const parents = await commitParents(target);
    if (parents.length > 1) throw new Error("暂不支持对 merge 提交执行压缩、修补或丢弃");
    if ((mode === "squash" || mode === "fixup") && parents.length === 0) {
      throw new Error("根提交没有父提交，不能压缩或修补进父提交");
    }
  
    const base = mode === "drop" ? target : parents[0];
    const baseParents = base ? await commitParents(base) : [];
    const rebaseArgs = baseParents.length ? ["rebase", "-i", `${base}^`] : ["rebase", "-i", "--root"];
    await ensureLinearRewriteRange(baseParents.length ? `${base}^` : "--root", mode);
  
    const sequenceFile = writeTempFile("forkline-history-sequence-", sequenceEditorScript(target, mode), ".cjs");
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    const recovery = await createRecoveryPoint(`history-${mode}`);
    try {
      const output = await git(currentRepo, rebaseArgs, {
        timeout: 180000,
        env: {
          GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${sequenceFile}"`,
          GIT_EDITOR: `"${process.execPath}" "${editorFile}"`,
        },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return appendRecoveryLine(commandResultWithSummary(`${historyRewriteResultLabel(mode)} ${target.slice(0, 7)}，当前分支 ${currentBranch} 的 HEAD 为 ${newHead}`, output), recovery);
    } catch (error) {
      if (detectRepoOperation(currentRepo)?.type !== "rebase") {
        await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
      }
      throw error;
    } finally {
      removeQuietly(sequenceFile);
      removeQuietly(editorFile);
    }
  }
  
  async function rewriteHistoryQueue(body) {
    const preview = await readHistoryRewriteQueuePreview(body.items);
    if (!preview.canRun) {
      throw new Error((preview.blockers || []).join("\n") || "历史编辑队列还不能执行。请重新预检后再试。");
    }
    const currentBranch = preview.branch || (await currentLocalBranchForRewrite());
    const actions = (preview.actions || []).map((item) => ({ sha: item.target.sha, mode: item.mode, summary: item.summary || "", body: item.body || "" }));
    const actionBySha = new Map(actions.map((item) => [item.sha, item]));
    const affected = await readRewriteRangeCommits(preview.upstream || "--root").catch(() => []);
    const rewordMessages = affected
      .map((commit) => actionBySha.get(commit.sha))
      .filter((item) => item?.mode === "reword")
      .map((item) => `${item.summary}${item.body ? `\n\n${item.body}` : ""}\n`);
    const rebaseArgs = preview.upstream === "--root" ? ["rebase", "-i", "--root"] : ["rebase", "-i", preview.upstream];
    const sequenceFile = writeTempFile("forkline-history-queue-", sequenceEditorQueueScript(actions), ".cjs");
    const editorStateFile = rewordMessages.length ? writeTempFile("forkline-history-queue-editor-state-", "0\n") : "";
    const editorFile = rewordMessages.length
      ? writeTempFile("forkline-history-queue-message-editor-", messageEditorQueueScript(rewordMessages, editorStateFile), ".cjs")
      : writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    const recovery = await createRecoveryPoint("history-queue");
    try {
      const output = await git(currentRepo, rebaseArgs, {
        timeout: 240000,
        env: {
          GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${sequenceFile}"`,
          GIT_EDITOR: `"${process.execPath}" "${editorFile}"`,
        },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return appendRecoveryLine(commandResultWithSummary(`已执行历史编辑队列 ${actions.length} 项，当前分支 ${currentBranch} 的 HEAD 为 ${newHead}`, output), recovery);
    } catch (error) {
      if (detectRepoOperation(currentRepo)?.type !== "rebase") {
        await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
      }
      throw error;
    } finally {
      removeQuietly(sequenceFile);
      removeQuietly(editorFile);
      if (editorStateFile) removeQuietly(editorStateFile);
    }
  }
  
  async function revertCommit(body) {
    const target = await resolveCommit(body.sha);
    const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
    const parents = parentLine.split(/\s+/).slice(1);
    const args = ["revert"];
    if (parents.length > 1) {
      args.push("-m", String(normalizeMainline(body.mainline, parents.length)));
    }
    args.push("--no-edit", target);
    await git(currentRepo, args, { timeout: 120000 });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已还原提交 ${target.slice(0, 7)}，新建反向提交 ${newHead}` };
  }
  
  async function cherryPickCommit(body) {
    const target = await resolveCommit(body.sha);
    const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
    const parents = parentLine.split(/\s+/).slice(1);
    const args = ["cherry-pick"];
    if (parents.length > 1) {
      args.push("-m", String(normalizeMainline(body.mainline, parents.length)));
    }
    args.push(target);
    await git(currentRepo, args, { timeout: 120000 });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已挑选提交 ${target.slice(0, 7)}，当前分支新建提交 ${newHead}` };
  }
  
  async function resetToCommit(body) {
    const target = await resolveCommit(body.sha);
    const mode = normalizeResetMode(body.mode);
    const args = mode === "mixed" ? ["reset", target] : ["reset", `--${mode}`, target];
    if (mode === "hard") await ensureNoDirtySubmodulesForDiscard("执行硬重置");
    const hasCurrentHead = await hasHeadCommit(currentRepo);
    const recovery = hasCurrentHead ? await createRecoveryPoint(`reset-${mode}`) : null;
    await git(currentRepo, args, { timeout: 120000 });
    const output = [`已${resetModeLabel(mode)}到 ${target.slice(0, 7)}`];
    if (!hasCurrentHead) output.push("当前分支原本还没有提交，无法创建重置前恢复点。");
    return appendRecoveryLine({ ok: true, output: output.join("\n") }, recovery);
  }
  
  async function continueRevert() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "revert") {
      return { ok: true, output: "当前没有正在进行的还原，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["revert", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续还原并创建反向提交 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }
  
  async function continueCherryPick() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "cherryPick") {
      return { ok: true, output: "当前没有正在进行的挑选，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["cherry-pick", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续挑选并创建提交 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }
  
  async function continueMerge() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "merge") {
      return { ok: true, output: "当前没有正在进行的合并，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["merge", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续合并并创建合并提交 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }
  
  async function abortMerge() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "merge") {
      return { ok: true, output: "当前没有正在进行的合并，工作区已经干净。" };
    }
    await git(currentRepo, ["merge", "--abort"], { timeout: 120000 });
    return { ok: true, output: "已中止合并，工作区已回到合并前状态" };
  }
  
  async function continueRebase() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "rebase") {
      return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["rebase", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续变基，当前 HEAD 为 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }
  
  async function skipRebase() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "rebase") {
      return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
    }
    const output = await git(currentRepo, ["rebase", "--skip"], { timeout: 120000 });
    return commandResultWithSummary("已跳过当前变基提交", output);
  }
  
  async function abortRebase() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "rebase") {
      return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
    }
    await git(currentRepo, ["rebase", "--abort"], { timeout: 120000 });
    return { ok: true, output: "已中止变基，工作区已回到变基前状态" };
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
  
  async function ensureCommitInCurrentHistory(target, repoPath = currentRepo) {
    await git(repoPath, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
      throw new Error("只能编辑当前分支历史中的提交");
    });
  }
  
  async function commitParents(target, repoPath = currentRepo) {
    const line = (await git(repoPath, ["rev-list", "--parents", "-n", "1", target])).trim();
    return line.split(/\s+/).slice(1);
  }
  
  async function ensureLinearRewriteRange(upstream, mode, repoPath = currentRepo) {
    const merges = await readRewriteRangeMerges(upstream, repoPath);
    if (merges.length) {
      const first = merges[0]?.short || "";
      throw new Error(`这段历史里包含 merge 提交 ${first}。为避免破坏分支拓扑，暂不自动执行 ${historyRewriteActionLabel(mode)}。`);
    }
  }
  
  async function readRewriteRangeMerges(upstream, repoPath = currentRepo) {
    const args = upstream === "--root" ? ["rev-list", "--parents", "HEAD"] : ["rev-list", "--parents", `${upstream}..HEAD`];
    return (await git(repoPath, args))
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/).filter(Boolean))
      .filter((parts) => parts.length > 2)
      .map((parts) => ({ sha: parts[0], short: parts[0]?.slice(0, 7) || "", parents: parts.slice(1) }));
  }
  
  async function readRewriteRangeCommits(upstream, repoPath = currentRepo) {
    const args = [
      "log",
      "--reverse",
      "--topo-order",
      "--date=relative",
      `--format=${BASIC_COMMIT_LOG_FORMAT}`,
    ];
    args.push(upstream === "--root" ? "HEAD" : `${upstream}..HEAD`);
    return repositoryHistoryService.parseBasicCommits(await git(repoPath, args, { maxBuffer: 1024 * 1024 * 2 }));
  }
  
  function normalizeResetMode(value) {
    const mode = String(value || "mixed").trim().toLowerCase();
    if (["soft", "mixed", "hard"].includes(mode)) return mode;
    throw new Error("Reset 类型不合法");
  }
  
  function normalizeHistoryRewriteMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (["squash", "fixup", "drop", "reword"].includes(mode)) return mode;
    throw new Error("历史编辑类型不合法");
  }
  
  function normalizeHistoryRewriteQueueItems(value) {
    const rawItems = Array.isArray(value) ? value : [];
    if (!rawItems.length) throw new Error("请先把要编辑的提交加入历史编辑队列");
    if (rawItems.length > 12) throw new Error("一次最多执行 12 条历史编辑动作，请拆成多次操作。");
    const seen = new Set();
    return rawItems.map((item) => {
      const sha = normalizeSha(item?.sha);
      if (seen.has(sha)) throw new Error(`提交 ${sha.slice(0, 7)} 在队列中重复出现。`);
      seen.add(sha);
      const mode = normalizeHistoryRewriteMode(item?.mode);
      if (mode !== "reword") return { sha, mode };
      return { sha, mode, ...normalizeCommitMessageInput(item?.summary, item?.body) };
    });
  }
  
  function normalizeCommitMessageInput(summaryValue, bodyValue) {
    const summary = String(summaryValue || "").replace(/\0/g, "").trim();
    const body = String(bodyValue || "").replace(/\0/g, "").replace(/\r\n/g, "\n").trim();
    if (!summary) throw new Error("请填写新的提交摘要");
    if (summary.length > 300) throw new Error("提交摘要太长，请控制在 300 个字符以内。");
    if (body.length > 10000) throw new Error("提交正文太长，请控制在 10000 个字符以内。");
    return { summary, body };
  }
  
  function historyRewriteResultLabel(mode) {
    if (mode === "squash") return "已将提交压缩进父提交";
    if (mode === "fixup") return "已将提交修补进父提交";
    if (mode === "drop") return "已丢弃提交";
    if (mode === "reword") return "已修改提交信息";
    return "已编辑提交";
  }
  
  function historyRewritePreviewTitle(mode) {
    if (mode === "squash") return "压缩进父提交";
    if (mode === "fixup") return "修补进父提交";
    if (mode === "drop") return "丢弃此提交";
    if (mode === "reword") return "修改提交信息";
    return "编辑历史";
  }
  
  function historyRewriteCommand(mode) {
    if (mode === "squash") return "git rebase -i / squash";
    if (mode === "fixup") return "git rebase -i / fixup";
    if (mode === "drop") return "git rebase -i / drop";
    if (mode === "reword") return "git rebase -i / reword";
    return "git rebase -i";
  }
  
  function historyRewriteEffect(mode) {
    if (mode === "squash") return "把此提交的改动和提交信息合并进父提交，然后重新播放后续提交。";
    if (mode === "fixup") return "把此提交的改动合并进父提交，丢弃此提交信息，然后重新播放后续提交。";
    if (mode === "drop") return "从当前分支历史中删除此提交，然后重新播放后续提交。";
    if (mode === "reword") return "只修改此提交的提交信息，然后重新播放后续提交。";
    return "重写当前分支历史。";
  }
  
  function normalizeMainline(value, parentCount) {
    const mainline = Number.parseInt(String(value || ""), 10);
    if (!Number.isInteger(mainline) || mainline < 1 || mainline > parentCount) {
      throw new Error(`请选择 merge 提交主线：1-${parentCount}`);
    }
    return mainline;
  }
  
  function normalizePatchText(value) {
    const text = String(value || "").replace(/\r\n/g, "\n").trimEnd();
    if (!text.trim()) throw new Error("请粘贴补丁内容");
    if (Buffer.byteLength(text, "utf8") > 1024 * 1024 * 8) throw new Error("补丁太大，请拆分后再应用。");
    if (!text.includes("diff --git ") && !text.includes("--- ") && !text.includes("+++ ")) {
      throw new Error("补丁内容不像 git patch / diff。请确认粘贴的是完整补丁。");
    }
    return `${text}\n`;
  }
  
  function writeTempFile(prefix, content, extension = ".tmp") {
    const name = `${prefix}${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
    const filePath = path.join(os.tmpdir(), name);
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  }
  
  function sequenceEditorScript(targetSha, action = "reword") {
    return `
  const fs = require("fs");
  const todoPath = process.argv[2];
  const target = ${JSON.stringify(targetSha)};
  const action = ${JSON.stringify(action)};
  const text = fs.readFileSync(todoPath, "utf8");
  const lines = text.split(/\\r?\\n/).map((line) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("pick ")) return line;
    const hash = trimmed.split(/\\s+/)[1] || "";
    return target.startsWith(hash) ? line.replace(/^(\\s*)pick(\\s+)/, "$1" + action + "$2") : line;
  });
  fs.writeFileSync(todoPath, lines.join("\\n"), "utf8");
  `;
  }
  
  function sequenceEditorQueueScript(actions) {
    return `
  const fs = require("fs");
  const todoPath = process.argv[2];
  const actions = ${JSON.stringify(actions)};
  const text = fs.readFileSync(todoPath, "utf8");
  let changed = 0;
  function actionFor(hash) {
    for (const item of actions) {
      if (item.sha.startsWith(hash)) return item.mode;
    }
    return "";
  }
  const lines = text.split(/\\r?\\n/).map((line) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("pick ")) return line;
    const hash = trimmed.split(/\\s+/)[1] || "";
    const action = actionFor(hash);
    if (!action) return line;
    changed += 1;
    return line.replace(/^(\\s*)pick(\\s+)/, "$1" + action + "$2");
  });
  if (changed !== actions.length) {
    throw new Error("Forkline history queue expected " + actions.length + " actions, changed " + changed + " todo lines");
  }
  fs.writeFileSync(todoPath, lines.join("\\n"), "utf8");
  `;
  }
  
  function messageEditorScript(messageFile) {
    return `
  const fs = require("fs");
  fs.copyFileSync(${JSON.stringify(messageFile)}, process.argv[2]);
  `;
  }
  
  function messageEditorQueueScript(messages, stateFile) {
    return `
  const fs = require("fs");
  const messages = ${JSON.stringify(messages)};
  const stateFile = ${JSON.stringify(stateFile)};
  const messagePath = process.argv[2];
  let index = 0;
  try {
    index = Number.parseInt(fs.readFileSync(stateFile, "utf8"), 10) || 0;
  } catch {
    index = 0;
  }
  if (index < messages.length) {
    fs.writeFileSync(messagePath, messages[index], "utf8");
    fs.writeFileSync(stateFile, String(index + 1), "utf8");
  }
  `;
  }
  
  function removeQuietly(filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch {
    }
  }
  
  function normalizeHunkIndex(value) {
    const index = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isInteger(index) || index < 0 || index > 200) throw new Error("改动块序号不合法，请刷新后再试。");
    return index;
  }
  
  function normalizeConflictSide(value) {
    const side = String(value || "").trim().toLowerCase();
    if (side === "ours" || side === "theirs") return side;
    throw new Error("请选择要保留的冲突版本。");
  }
  
  function normalizeCheckoutMode(value) {
    const mode = String(value || "keep").trim();
    if (["keep", "stash", "force"].includes(mode)) return mode;
    throw new Error("切换分支方式不合法");
  }
  
  function normalizeBranchStart(value) {
    const start = String(value || "").trim();
    if (!start) return "";
    if (/^[0-9a-f]{7,40}$/i.test(start)) return start;
    return normalizeRefName(start);
  }
  
  function normalizeRemoteUrl(value) {
    const url = String(value || "").trim();
    if (!url || url.includes("\0") || /[\r\n]/.test(url)) throw new Error("远端 URL 不合法");
    return url;
  }
  
  function normalizeCloneTargetPath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("目标文件夹不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("目标文件夹必须是本机绝对路径");
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) throw new Error("目标文件夹不能是磁盘根目录");
    return resolved;
  }
  
  function normalizeInitTargetPath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("初始化文件夹不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("初始化文件夹必须是本机绝对路径");
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) throw new Error("初始化文件夹不能是磁盘根目录");
    return resolved;
  }
  
  function normalizeWorktreeTargetPath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("工作树文件夹不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("工作树文件夹必须是本机绝对路径");
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) throw new Error("工作树文件夹不能是磁盘根目录");
    if (sameFsPath(resolved, currentRepo)) throw new Error("新工作树不能和当前仓库路径相同");
    return resolved;
  }
  
  function normalizeExistingWorktreePath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("工作树路径不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("工作树路径必须是本机绝对路径");
    if (!fs.existsSync(resolved)) throw new Error(`工作树路径不存在：${resolved}`);
    if (!fs.statSync(resolved).isDirectory()) throw new Error(`工作树路径不是文件夹：${resolved}`);
    return resolved;
  }
  
  function normalizeRemoteCheckoutBranch(remoteRef, remoteNames = []) {
    return splitRemoteBranchRef(remoteRef, remoteNames).branch;
  }
  
  async function ensureRemoteName(value) {
    const remote = normalizeRemoteName(value);
    const remoteNames = await readRemoteNames();
    if (!remoteNames.includes(remote)) throw new Error(`远端 ${remote} 不存在`);
    return remote;
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
      const currentHead = (await git(currentRepo, ["rev-parse", "--verify", "HEAD^{commit}"], { timeout: 60000 }).catch(() => "")).trim().toLowerCase();
      if (currentHead && currentHead !== expectedHead) {
        throw new Error(`当前分支 ${currentBranch} 的 HEAD 已经变化。为避免把操作执行到旧页面之外的提交上，请刷新页面后重新操作。`);
      }
    }
    await ensureUpstreamSnapshot(body);
    await ensureCurrentOperationContextSnapshot(body);
  }
  
  async function ensureUpstreamSnapshot(body = {}) {
    const action = String(body.action || "");
    if (!UPSTREAM_SNAPSHOT_ACTIONS.has(action)) return;
    const hasExpectedUpstream = Object.prototype.hasOwnProperty.call(body, "expectedUpstream");
    if (!hasExpectedUpstream) throw new Error("页面 upstream 状态已过期，请刷新后重新执行这个操作。");
    const expectedUpstream = String(body.expectedUpstream || "").trim();
    const currentUpstream = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { timeout: 60000 }).catch(() => "")).trim();
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
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
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
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]).catch(() => "");
    const working = await readWorkingStatus(currentRepo, statusOutput);
    let target = selectStatusFile(working.files, file, fileSnapshotScope(body));
    if (!target || target.snapshot !== expected) {
      const fullStatusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
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
    const output = await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => "");
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
  
  async function readSubmodulesForSafety() {
    if (!repoHasSubmoduleConfig(currentRepo)) return [];
    const [configOutput, statusOutput] = await Promise.all([
      git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => ""),
    ]);
    return enrichSubmodules(parseSubmodules(configOutput, statusOutput));
  }
  
  async function readDirtySubmoduleWorktrees() {
    const submodules = await readSubmodulesForSafety();
    return submodules.filter((item) => item.initialized && item.dirtyCount);
  }
  
  async function ensureNoDirtySubmodulesForDiscard(actionText = "直接丢弃父仓库全部更改") {
    const submodules = await readSubmodulesForSafety();
    const dirty = submodules.filter((item) => item.initialized && (item.dirtyCount || item.status === "changed" || item.status === "conflict"));
    if (!dirty.length) return;
    const details = dirty.slice(0, 5).map((item) => {
      const mismatch = item.status === "changed" ? "，提交与父仓库记录不一致" : item.status === "conflict" ? "，存在冲突" : "";
      return `${item.path}（${item.dirtyCount ? `${item.dirtyCount} 个未提交改动` : "独立提交状态"}${mismatch}）`;
    });
    const remaining = dirty.length > details.length ? `；另有 ${dirty.length - details.length} 个` : "";
    throw new Error(`子模块包含独立仓库改动，不能${actionText}：${details.join("；")}${remaining}。请先进入子模块提交、储藏或还原，再重新操作。`);
  }
  
  async function discardAllWorktreeChanges() {
    await ensureNoDirtySubmodulesForDiscard();
    if (await hasHeadCommit(currentRepo)) {
      await git(currentRepo, ["reset", "--hard", "HEAD"], { timeout: 60000 });
    } else {
      await git(currentRepo, ["rm", "-r", "--cached", "--ignore-unmatch", "--", "."], { timeout: 60000 }).catch(() => "");
    }
    await git(currentRepo, ["clean", "-fd"], { timeout: 60000 });
  }
  
  async function createRecoveryPoint(actionKey) {
    return createRecoveryPointForCommit(actionKey, "HEAD");
  }
  
  async function createRecoveryPointForCommit(actionKey, targetRef = "HEAD", branchOverride = "") {
    const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "HEAD")).trim() || "HEAD";
    const sha = (await git(currentRepo, ["rev-parse", "--verify", `${targetRef}^{commit}`])).trim();
    const short = (await git(currentRepo, ["rev-parse", "--short", sha])).trim();
    const timestamp = recoveryTimestamp();
    const baseRef = `${RECOVERY_REF_PREFIX}/${timestamp}/${recoverySlug(branchOverride || branch, "HEAD")}/${recoverySlug(actionKey, "operation")}`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ref = attempt ? `${baseRef}-${attempt + 1}` : baseRef;
      await git(currentRepo, ["check-ref-format", ref], { timeout: 60000 });
      try {
        await git(currentRepo, ["update-ref", ref, sha, ZERO_OID], { timeout: 60000 });
        return recoveryPointFromParts(ref, sha, short);
      } catch (error) {
        const exists = await git(currentRepo, ["rev-parse", "--verify", ref], { timeout: 60000 }).then(() => true).catch(() => false);
        if (exists) continue;
        throw error;
      }
    }
    throw new Error("同一秒内恢复点过多，请稍后重试。");
  }
  
  function appendRecoveryLine(result, recovery) {
    if (!recovery) return result;
    return {
      ...result,
      recovery,
      output: [result.output, recoveryPointLine(recovery)].filter(Boolean).join("\n"),
    };
  }
  
  function recoveryPointLine(recovery) {
    if (!recovery) return "";
    return `恢复点：${recovery.shortRef}（${recovery.short}）。可在右侧“恢复点”页恢复，或执行 git reset --hard ${recovery.ref}`;
  }
  
  async function restoreRecoveryPoint(body) {
    const ref = await ensureRecoveryRef(body.ref, normalizeExpectedRecoverySha(body.sha));
    await currentLocalBranch("恢复恢复点");
    await ensureCleanWorktree("恢复到恢复点前，请先提交、储藏或还原当前工作区改动。");
    await ensureNoDirtySubmodulesForDiscard("恢复到恢复点");
    const target = (await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
    const hasCurrentHead = await hasHeadCommit(currentRepo);
    const before = hasCurrentHead ? await createRecoveryPoint("restore-recovery") : null;
    await git(currentRepo, ["reset", "--hard", target], { timeout: 120000 });
    const short = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    const output = [`已恢复到 ${short}`];
    if (!hasCurrentHead) output.push("当前分支原本还没有提交，无法创建恢复前恢复点。");
    return appendRecoveryLine({ ok: true, output: output.join("\n") }, before);
  }
  
  async function createRecoveryPointFromReflog(body) {
    const entry = await ensureReflogEntry(body);
    const recovery = await createRecoveryPointForCommit(`reflog-${entry.short}`, entry.sha);
    return {
      ok: true,
      recovery,
      output: `已从引用日志 ${entry.selector} 创建恢复点 ${recovery.shortRef}（${recovery.short}）`,
    };
  }
  
  async function restoreReflogEntry(body) {
    const entry = await ensureReflogEntry(body);
    await currentLocalBranch("恢复引用日志记录");
    await ensureCleanWorktree("恢复到引用日志记录前，请先提交、储藏或还原当前工作区改动。");
    await ensureNoDirtySubmodulesForDiscard("恢复引用日志记录");
    const before = await createRecoveryPoint("restore-reflog");
    await git(currentRepo, ["reset", "--hard", entry.sha], { timeout: 120000 });
    const short = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return appendRecoveryLine({ ok: true, output: `已恢复到引用日志 ${entry.selector}：${short}` }, before);
  }
  
  async function deleteRecoveryPoint(body) {
    const ref = await ensureRecoveryRef(body.ref, normalizeExpectedRecoverySha(body.sha));
    await git(currentRepo, ["update-ref", "-d", ref], { timeout: 60000 });
    return { ok: true, output: `已删除恢复点 ${shortRecoveryRef(ref)}` };
  }
  
  async function deleteRecoveryPoints(body) {
    const entries = normalizeRecoveryRefEntries(body.refs);
    if (!entries.length) throw new Error("请选择要删除的恢复点");
    if (entries.length > 80) throw new Error("一次最多删除 80 个恢复点，请先缩小筛选范围。");
    const safeRefs = [];
    for (const entry of entries) {
      safeRefs.push(await ensureRecoveryRef(entry.ref, normalizeExpectedRecoverySha(entry.sha)));
    }
    for (const ref of safeRefs) {
      await git(currentRepo, ["update-ref", "-d", ref], { timeout: 60000 });
    }
    return { ok: true, output: `已删除 ${safeRefs.length} 个恢复点` };
  }
  
  function normalizeRecoveryRefEntries(value) {
    const rawItems = Array.isArray(value) ? value : [];
    const seen = new Set();
    const entries = [];
    for (const item of rawItems) {
      const ref = typeof item === "object" && item ? String(item.ref || "").trim() : String(item || "").trim();
      const sha = typeof item === "object" && item ? String(item.sha || "").trim() : "";
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      entries.push({ ref, sha });
    }
    return entries;
  }
  
  async function pruneRecoveryPoints(body) {
    const policy = normalizeRecoveryRetentionPolicy(body);
    const points = await readRecoveryPointsFromGit();
    const plan = recoveryRetentionPlan(points, policy);
    const expectedEntries = normalizeRecoveryRefEntries(body.deleteRefs);
    if (!plan.deletePoints.length) {
      if (expectedEntries.length) {
        throw new Error("恢复点清理预览已经变化，请刷新恢复点列表后重新清理。");
      }
      return {
        ok: true,
        output: `没有需要清理的恢复点。当前保留 ${points.length} 个恢复点。`,
        deleted: 0,
        plan,
      };
    }
    if (!expectedEntries.length) {
      throw new Error("恢复点清理预览已过期，请刷新恢复点列表后重新清理。");
    }
    if (expectedEntries.length > 120) {
      throw new Error(`本次策略会删除 ${expectedEntries.length} 个恢复点。为避免误删，请先缩小策略范围或使用筛选删除。`);
    }
    const plannedRefs = new Set(plan.deletePoints.map((point) => point.ref));
    const expectedRefs = new Set(expectedEntries.map((entry) => entry.ref));
    if (plannedRefs.size !== expectedRefs.size || [...plannedRefs].some((ref) => !expectedRefs.has(ref))) {
      throw new Error("恢复点清理预览已经变化，请刷新恢复点列表后重新清理。");
    }
    const safeRefs = [];
    for (const entry of expectedEntries) {
      const ref = await ensureRecoveryRef(entry.ref, normalizeExpectedRecoverySha(entry.sha));
      if (!plannedRefs.has(ref)) throw new Error("恢复点清理预览已经变化，请刷新恢复点列表后重新清理。");
      safeRefs.push(ref);
    }
    for (const ref of safeRefs) {
      await git(currentRepo, ["update-ref", "-d", ref], { timeout: 60000 });
    }
    return {
      ok: true,
      output: `已按保留策略清理 ${safeRefs.length} 个恢复点，保留 ${plan.keepCount} 个。${recoveryRetentionPolicyLabel(policy)}`,
      deleted: safeRefs.length,
      plan,
    };
  }
  
  async function readRecoveryPointsFromGit() {
    const output = await git(currentRepo, ["for-each-ref", RECOVERY_REF_PREFIX, "--sort=-refname", "--format=%(refname)\t%(objectname)\t%(objectname:short)\t%(subject)"]).catch(() => "");
    return parseRecoveryPoints(output);
  }
  
  async function ensureReflogEntry(body) {
    const requestedSha = normalizeSha(body.sha);
    const sha = await resolveCommit(requestedSha);
    const selector = String(body.selector || "").trim();
    const entries = parseReflogEntries(await readReflogOutput(120).catch(() => ""));
    const entry = entries.find((item) => item.sha === sha && (!selector || item.selector === selector)) || entries.find((item) => item.sha === sha);
    if (!entry) throw new Error("引用日志中没有这条记录，请刷新后再试。");
    return { ...entry, sha };
  }
  
  function normalizeRecoveryRetentionPolicy(body) {
    const keepDays = normalizeRetentionNumber(body.keepDays, "保留天数", 3650);
    const maxPerBranch = normalizeRetentionNumber(body.maxPerBranch, "每个分支保留数量", 500);
    if (!keepDays && !maxPerBranch) throw new Error("请至少设置一个恢复点保留规则。");
    return { keepDays, maxPerBranch };
  }
  
  function normalizeRetentionNumber(value, label, max) {
    if (value === undefined || value === null || value === "") return 0;
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) throw new Error(`${label}必须是 0 到 ${max} 之间的整数。`);
    const number = Number.parseInt(text, 10);
    if (number < 0 || number > max) throw new Error(`${label}必须是 0 到 ${max} 之间的整数。`);
    return number;
  }
  
  function recoveryRetentionPlan(points, policy, now = new Date()) {
    const deleteRefs = new Set();
    const nowMs = now.getTime();
    if (policy.keepDays) {
      const threshold = nowMs - policy.keepDays * 24 * 60 * 60 * 1000;
      for (const point of points) {
        const timeMs = recoveryPointTimeMs(point);
        if (timeMs && timeMs < threshold) deleteRefs.add(point.ref);
      }
    }
    if (policy.maxPerBranch) {
      const groups = new Map();
      for (const point of points) {
        const branch = point.branch || "HEAD";
        groups.set(branch, [...(groups.get(branch) || []), point]);
      }
      for (const group of groups.values()) {
        group
          .sort((a, b) => recoveryPointTimeMs(b) - recoveryPointTimeMs(a) || String(b.ref).localeCompare(String(a.ref)))
          .slice(policy.maxPerBranch)
          .forEach((point) => deleteRefs.add(point.ref));
      }
    }
    const deletePoints = points.filter((point) => deleteRefs.has(point.ref));
    return {
      keepDays: policy.keepDays,
      maxPerBranch: policy.maxPerBranch,
      keepCount: Math.max(0, points.length - deletePoints.length),
      deleteCount: deletePoints.length,
        deletePoints: deletePoints.map((point) => ({
          ref: point.ref,
          shortRef: point.shortRef,
          sha: point.sha,
          short: point.short,
          branch: point.branch,
          actionLabel: point.actionLabel,
        time: point.time,
      })),
    };
  }
  
  function recoveryPointTimeMs(point) {
    return recoveryTimestampToMs(point?.timestamp || String(point?.shortRef || "").split("/")[0]);
  }
  
  function recoveryTimestampToMs(timestamp) {
    const match = String(timestamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
    if (!match) return 0;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).getTime();
  }
  
  function recoveryRetentionPolicyLabel(policy) {
    return [
      policy.keepDays ? `保留最近 ${policy.keepDays} 天` : "",
      policy.maxPerBranch ? `每个分支保留 ${policy.maxPerBranch} 个` : "",
    ]
      .filter(Boolean)
      .join("；");
  }
  
  async function ensureRecoveryRef(value, expectedSha = "") {
    const input = String(value || "").trim().replace(/^\/+/, "");
    if (!input) throw new Error("请选择恢复点");
    const ref = input.startsWith(`${RECOVERY_REF_PREFIX}/`) ? input : `${RECOVERY_REF_PREFIX}/${input}`;
    normalizeRefName(ref, "恢复点");
    if (!ref.startsWith(`${RECOVERY_REF_PREFIX}/`)) throw new Error("恢复点不属于 Forkline 管理范围");
    const actualSha = (await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 }).catch(() => {
      throw new Error("恢复点不存在或已经被删除");
    })).trim().toLowerCase();
    if (expectedSha && !actualSha.startsWith(expectedSha)) {
      throw new Error("恢复点已经变化。为避免恢复或删除错误提交，请刷新恢复点列表后重新选择。");
    }
    return ref;
  }
  
  function normalizeExpectedRecoverySha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("恢复点状态已过期，请刷新恢复点列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("恢复点身份不合法，请刷新恢复点列表后重新选择。");
    return sha;
  }
  
  function recoveryTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }
  
  function recoverySlug(value, fallback) {
    const slug = String(value || "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^\.+|\.+$/g, "")
      .replace(/_+/g, "_")
      .slice(0, 64);
    return slug || fallback;
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
