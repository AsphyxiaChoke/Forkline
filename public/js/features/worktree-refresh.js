// Worktree signatures, lightweight refresh, and focus-aware polling.
function worktreeSignature(files) {
  return (files || [])
    .map((file) =>
      [
        file.state,
        file.file,
        file.extra || "",
        file.indexStatus || "",
        file.worktreeStatus || "",
        file.staged ? "staged" : "",
        file.unstaged ? "unstaged" : "",
        file.conflict ? "conflict" : "",
        file.snapshot || "",
      ].join(":")
    )
    .join("|");
}

function worktreeStateSignature(files, operation) {
  return `${worktreeSignature(files)}|op:${operation?.type || ""}`;
}

async function refreshWorktree(silent = false) {
  if (!state.data || state.refreshingWorktree) return;
  const repoPath = state.data.repo?.path || "";
  state.refreshingWorktree = true;
  els.refreshChanges.disabled = true;
  try {
    const data = await api("/api/worktree");
    if ((state.data?.repo?.path || "") !== repoPath) return;
    const nextFiles = data.workingFiles || [];
    const nextOperation = data.operation || null;
    const nextSignature = worktreeStateSignature(nextFiles, nextOperation);
    if (nextSignature !== state.worktreeSignature) {
      mergeWorktreeState(data);
      renderWorkingFiles();
      renderStage();
      if (!silent) toast(t("未提交修改已刷新"));
    } else if (!silent) {
      state.data.worktreeSnapshot = data.worktreeSnapshot || state.data.worktreeSnapshot || "";
      toast(t("未提交修改已是最新"));
    } else {
      state.data.worktreeSnapshot = data.worktreeSnapshot || state.data.worktreeSnapshot || "";
    }
  } catch (error) {
    if ((state.data?.repo?.path || "") !== repoPath) return;
    if (!silent) toast(error.message);
  } finally {
    state.refreshingWorktree = false;
    els.refreshChanges.disabled = false;
  }
}

function initWorktreeAutoRefresh() {
  const refreshWhenActive = () => {
    const focused = typeof document.hasFocus !== "function" || document.hasFocus();
    if (!document.hidden && focused) refreshWorktree(true);
  };
  window.addEventListener("focus", refreshWhenActive);
  document.addEventListener("visibilitychange", refreshWhenActive);
  setInterval(refreshWhenActive, 5000);
}
