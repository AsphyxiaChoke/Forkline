// Immediate undo for operations that returned an automatic recovery point.
function offerRecoveryUndo(result) {
  const recovery = result?.recovery;
  const repo = state.data?.repo;
  if (!recovery?.ref || !recovery?.sha || !repo || repo.isSample || !repo.headSha) return false;
  state.recoveryUndo = {
    repoPath: repo.path || "",
    branch: repo.branch || "",
    head: repo.headSha,
    ref: recovery.ref,
    sha: recovery.sha,
    short: recovery.short || String(recovery.sha).slice(0, 7),
    label: recovery.actionLabel || "危险操作前",
    running: false,
  };
  renderRecoveryUndoButton();
  return true;
}

function clearRecoveryUndo() {
  state.recoveryUndo = null;
  renderRecoveryUndoButton();
}

function recoveryUndoMatchesCurrentState(undo = state.recoveryUndo) {
  const repo = state.data?.repo;
  if (!undo || !repo || repo.isSample) return false;
  return normalizeRecoveryUndoPath(undo.repoPath) === normalizeRecoveryUndoPath(repo.path)
    && undo.branch === (repo.branch || "")
    && undo.head === (repo.headSha || "");
}

function normalizeRecoveryUndoPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

function renderRecoveryUndoButton() {
  const button = els.undoRecovery;
  if (!button) return;
  const undo = state.recoveryUndo;
  if (!undo) {
    button.hidden = true;
    button.disabled = false;
    return;
  }
  if (!recoveryUndoMatchesCurrentState(undo)) {
    state.recoveryUndo = null;
    button.hidden = true;
    button.disabled = false;
    return;
  }
  const dirtyCount = (state.data?.workingFiles || []).length;
  const operation = state.data?.repo?.operation;
  const blocked = dirtyCount > 0 || Boolean(operation);
  button.hidden = false;
  button.disabled = blocked || undo.running;
  button.textContent = t(undo.running ? "撤销中" : "撤销");
  const action = t(undo.label);
  const command = `git reset --hard ${undo.ref}`;
  if (dirtyCount > 0) {
    button.title = t("当前有 {count} 个未提交改动。请先提交、储藏或还原，再撤销刚才操作。\n恢复点仍保留在“恢复点”页。", { count: dirtyCount });
  } else if (operation) {
    button.title = t("仓库还有未完成操作，请先继续或中止，再撤销刚才操作。\n恢复点仍保留在“恢复点”页。");
  } else {
    button.title = t("撤销刚才操作：{action}\n恢复到：{sha}\n命令：{command}\n只恢复提交位置，不包含未提交文件。", {
      action,
      sha: undo.short,
      command,
    });
  }
  button.setAttribute("aria-label", button.title);
}

async function runRecoveryUndo(button = els.undoRecovery) {
  const undo = state.recoveryUndo;
  if (!undo) return;
  if (!recoveryUndoMatchesCurrentState(undo)) {
    clearRecoveryUndo();
    toast(t("当前仓库、分支或 HEAD 已变化，不能再一键撤销。恢复点仍保留在“恢复点”页。"));
    return;
  }
  if ((state.data?.workingFiles || []).length || state.data?.repo?.operation) {
    renderRecoveryUndoButton();
    toast(t("请先处理未提交改动或未完成操作，再撤销刚才操作。恢复点不会丢失。"));
    return;
  }
  const repoPath = undo.repoPath;
  undo.running = true;
  renderRecoveryUndoButton();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "restoreRecoveryPoint",
        ref: undo.ref,
        sha: undo.sha,
        ...currentBranchSnapshotPayload(),
      }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    state.recoveryUndo = null;
    if (result.recovery?.ref) state.selectedRecoveryRef = result.recovery.ref;
    await reloadAfterHistoryAction(repoPath);
    renderRecoveryUndoButton();
    toast(result.output || t("已撤销刚才操作"));
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    undo.running = false;
    renderRecoveryUndoButton();
    toast(error.message);
  } finally {
    if (button && state.recoveryUndo === undo) button.disabled = false;
  }
}
