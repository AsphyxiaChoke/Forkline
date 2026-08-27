// Page-level undo/redo for safe index and commit operations.
function offerRecoveryUndo(result) {
  const recovery = result?.recovery;
  const repo = state.data?.repo;
  if (!recovery?.ref || !recovery?.sha || !repo || repo.isSample || !repo.headSha) return false;
  state.recoveryUndo = {
    type: "commit",
    repoPath: repo.path || "",
    branch: repo.branch || "",
    head: repo.headSha,
    worktreeSnapshot: state.data?.worktreeSnapshot || "",
    ref: recovery.ref,
    sha: recovery.sha,
    short: recovery.short || String(recovery.sha).slice(0, 7),
    label: recovery.actionLabel || "危险操作前",
    running: false,
  };
  state.recoveryRedo = null;
  renderRecoveryButtons();
  if (typeof maybeOfferRecoveryPolicyCleanup === "function") maybeOfferRecoveryPolicyCleanup(result);
  return true;
}

function offerIndexUndo(result, label = "暂存区操作") {
  const history = result?.indexHistory;
  const repo = state.data?.repo;
  const before = String(history?.before || "").trim().toLowerCase();
  const after = String(history?.after || "").trim().toLowerCase();
  if (!repo || repo.isSample || !repo.headSha || !/^[0-9a-f]{40}$/.test(before) || !/^[0-9a-f]{40}$/.test(after) || before === after) return false;
  state.recoveryUndo = {
    type: "index",
    repoPath: repo.path || "",
    branch: repo.branch || "",
    head: repo.headSha,
    worktreeSnapshot: state.data?.worktreeSnapshot || "",
    targetTree: before,
    expectedIndexTree: after,
    label,
    running: false,
  };
  state.recoveryRedo = null;
  renderRecoveryButtons();
  return true;
}

function clearRecoveryUndo() {
  state.recoveryUndo = null;
  renderRecoveryButtons();
}

function clearRecoveryRedo() {
  state.recoveryRedo = null;
  renderRecoveryButtons();
}

function recoveryUndoMatchesCurrentState(undo = state.recoveryUndo) {
  return historyRecordMatchesCurrentState(undo);
}

function historyRecordMatchesCurrentState(record) {
  const repo = state.data?.repo;
  if (!record || !repo || repo.isSample) return false;
  if (normalizeRecoveryUndoPath(record.repoPath) !== normalizeRecoveryUndoPath(repo.path)) return false;
  if (record.branch !== (repo.branch || "") || record.head !== (repo.headSha || "")) return false;
  if (record.type === "index" && record.worktreeSnapshot !== (state.data?.worktreeSnapshot || "")) return false;
  return true;
}

function normalizeRecoveryUndoPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

function renderRecoveryButtons() {
  renderRecoveryUndoButton();
  renderRecoveryRedoButton();
}

function renderRecoveryUndoButton() {
  renderRecoveryHistoryButton("undo");
}

function renderRecoveryRedoButton() {
  renderRecoveryHistoryButton("redo");
}

function renderRecoveryHistoryButton(direction) {
  const slot = direction === "redo" ? "recoveryRedo" : "recoveryUndo";
  const button = direction === "redo" ? els.redoRecovery : els.undoRecovery;
  if (!button) return;
  const record = state[slot];
  if (!record) {
    button.hidden = true;
    button.disabled = false;
    return;
  }
  if (!historyRecordMatchesCurrentState(record)) {
    state[slot] = null;
    button.hidden = true;
    button.disabled = false;
    return;
  }
  const isIndex = record.type === "index";
  const dirtyCount = (state.data?.workingFiles || []).length;
  const operation = state.data?.repo?.operation;
  const blocked = Boolean(operation) || record.running || (!isIndex && dirtyCount > 0);
  button.hidden = false;
  button.disabled = blocked;
  button.textContent = t(record.running ? (direction === "redo" ? "恢复中" : "撤销中") : (direction === "redo" ? "恢复" : "撤销"));
  if (isIndex) {
    const action = t(record.label || "暂存区操作");
    const command = `git read-tree --reset ${record.targetTree}`;
    button.title = t(direction === "redo" ? "恢复刚才撤销的{action}" : "撤销刚才的{action}", { action })
      + `\n${t("只恢复暂存区，不修改工作区文件。")}`
      + `\n${t("命令：{command}", { command })}`;
  } else if (dirtyCount > 0) {
    button.title = t("当前有 {count} 个未提交改动。请先提交、储藏或还原，再{action}刚才操作。\n恢复点仍保留在“恢复点”页。", {
      count: dirtyCount,
      action: direction === "redo" ? "恢复" : "撤销",
    });
  } else if (operation) {
    button.title = t("仓库还有未完成操作，请先继续或中止，再{action}刚才操作。\n恢复点仍保留在“恢复点”页。", {
      action: direction === "redo" ? "恢复" : "撤销",
    });
  } else {
    const action = t(record.label || "危险操作前");
    const command = `git reset --hard ${record.ref}`;
    button.title = direction === "redo"
      ? t("恢复刚才撤销的操作：{action}\n恢复到：{sha}\n命令：{command}", { action, sha: record.short, command })
      : t("撤销刚才操作：{action}\n恢复到：{sha}\n命令：{command}\n只恢复提交位置，不包含未提交文件。", {
        action,
        sha: record.short,
        command,
      });
  }
  button.setAttribute("aria-label", button.title);
}

async function runShortcutHistory(direction = "undo", button) {
  const normalizedDirection = direction === "redo" ? "redo" : "undo";
  const slot = normalizedDirection === "redo" ? "recoveryRedo" : "recoveryUndo";
  const oppositeSlot = normalizedDirection === "redo" ? "recoveryUndo" : "recoveryRedo";
  const record = state[slot];
  if (!record) return false;
  if (!historyRecordMatchesCurrentState(record)) {
    state[slot] = null;
    renderRecoveryButtons();
    toast(t("当前仓库、分支或 HEAD 已变化，不能再一键撤销。恢复点仍保留在“恢复点”页。"));
    return false;
  }
  const dirtyCount = (state.data?.workingFiles || []).length;
  if (state.data?.repo?.operation || (record.type !== "index" && dirtyCount > 0)) {
    renderRecoveryButtons();
    toast(state.data?.repo?.operation
      ? t("仓库还有未完成操作，请先继续或中止，再{action}刚才操作。\n恢复点仍保留在“恢复点”页。", { action: normalizedDirection === "redo" ? "恢复" : "撤销" })
      : t("当前有 {count} 个未提交改动。请先提交、储藏或还原，再{action}刚才操作。\n恢复点仍保留在“恢复点”页。", { count: dirtyCount, action: normalizedDirection === "redo" ? "恢复" : "撤销" }));
    return false;
  }
  if (record.type === "index") return runIndexHistory(normalizedDirection, slot, oppositeSlot, record, button);
  return runCommitHistory(normalizedDirection, slot, oppositeSlot, record, button);
}

async function runIndexHistory(direction, slot, oppositeSlot, record, button) {
  const repoPath = record.repoPath;
  record.running = true;
  renderRecoveryButtons();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "restoreIndexTree",
        tree: record.targetTree,
        expectedIndexTree: record.expectedIndexTree,
        ...currentBranchSnapshotPayload(),
      }),
    });
    if (!isCurrentRepoPath(repoPath)) return false;
    const data = await api("/api/worktree");
    if (!isCurrentRepoPath(repoPath)) return false;
    mergeWorktreeState(data);
    state[slot] = null;
    state[oppositeSlot] = {
      ...record,
      repoPath: state.data?.repo?.path || repoPath,
      branch: state.data?.repo?.branch || record.branch,
      head: state.data?.repo?.headSha || record.head,
      worktreeSnapshot: state.data?.worktreeSnapshot || "",
      targetTree: record.expectedIndexTree,
      expectedIndexTree: record.targetTree,
      running: false,
    };
    renderStage();
    renderRecoveryButtons();
    toast(result.output || t("已恢复暂存区"));
    return true;
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return false;
    record.running = false;
    renderRecoveryButtons();
    toast(error.message);
    return false;
  } finally {
    if (button && state[slot] === record) button.disabled = false;
  }
}

async function runCommitHistory(direction, slot, oppositeSlot, record, button) {
  const repoPath = record.repoPath;
  record.running = true;
  renderRecoveryButtons();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "restoreRecoveryPoint",
        ref: record.ref,
        sha: record.sha,
        ...currentBranchSnapshotPayload(),
      }),
    });
    if (!isCurrentRepoPath(repoPath)) return false;
    state[slot] = null;
    if (result.recovery?.ref) state.selectedRecoveryRef = result.recovery.ref;
    await reloadAfterHistoryAction(repoPath);
    if (!isCurrentRepoPath(repoPath)) return false;
    state[oppositeSlot] = result.recovery?.ref ? {
      ...record,
      repoPath: state.data?.repo?.path || repoPath,
      branch: state.data?.repo?.branch || record.branch,
      head: state.data?.repo?.headSha || record.head,
      worktreeSnapshot: state.data?.worktreeSnapshot || "",
      ref: result.recovery.ref,
      sha: result.recovery.sha,
      short: result.recovery.short || String(result.recovery.sha || "").slice(0, 7),
      running: false,
    } : null;
    renderRecoveryButtons();
    toast(result.output || t(normalizedHistoryActionText(direction)));
    return true;
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return false;
    if (!state[slot]) state[slot] = record;
    record.running = false;
    renderRecoveryButtons();
    toast(error.message);
    return false;
  } finally {
    if (button && state[slot] === record) button.disabled = false;
  }
}

function normalizedHistoryActionText(direction) {
  return direction === "redo" ? "恢复" : "撤销";
}

async function runRecoveryUndo(button = els.undoRecovery) {
  return runShortcutHistory("undo", button);
}
