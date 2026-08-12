// Worktree signatures, lightweight refresh, and focus-aware polling.
const WORKTREE_AUTO_REFRESH_MIN_MS = 5000;
const WORKTREE_AUTO_REFRESH_MAX_MS = 30000;
const WORKTREE_AUTO_REFRESH_LARGE_FILE_COUNT = 800;

function nextWorktreeAutoRefreshDelay(currentDelay, result, fileCount) {
  if (result !== "unchanged" || Number(fileCount || 0) < WORKTREE_AUTO_REFRESH_LARGE_FILE_COUNT) {
    return WORKTREE_AUTO_REFRESH_MIN_MS;
  }
  const delay = Math.max(WORKTREE_AUTO_REFRESH_MIN_MS, Number(currentDelay || 0));
  return Math.min(WORKTREE_AUTO_REFRESH_MAX_MS, delay * 2);
}

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

function worktreeStateSignature(files, operation, worktreeSnapshot = "") {
  const fileState = worktreeSnapshot || worktreeSignature(files);
  return `${fileState}|op:${operation?.type || ""}:${operation?.snapshot || ""}`;
}

async function refreshWorktree(silent = false) {
  if (!state.data || state.refreshingWorktree) return "skipped";
  const repoPath = state.data.repo?.path || "";
  state.refreshingWorktree = true;
  els.refreshChanges.disabled = true;
  try {
    const currentSnapshot = silent ? state.data.worktreeSnapshot || "" : "";
    const requestPath = currentSnapshot
      ? `/api/worktree?expectedSnapshot=${encodeURIComponent(currentSnapshot)}`
      : "/api/worktree";
    const data = await api(requestPath);
    if ((state.data?.repo?.path || "") !== repoPath) return "skipped";
    const nextSnapshot = data.worktreeSnapshot || state.data.worktreeSnapshot || "";
    const nextOperation = data.operation || null;
    if (data.unchanged) {
      const nextSignature = worktreeStateSignature(state.data.workingFiles, nextOperation, nextSnapshot);
      const operationChanged = nextSignature !== state.worktreeSignature;
      state.data.worktreeSnapshot = nextSnapshot;
      state.data.repo = { ...(state.data.repo || {}), operation: nextOperation };
      state.worktreeSignature = nextSignature;
      if (operationChanged) refreshRepoOperationBanner(state.data.workingFiles);
      if (!silent) toast(t("未提交修改已是最新"));
      return operationChanged ? "changed" : "unchanged";
    }
    const nextFiles = data.workingFiles || [];
    const nextSignature = worktreeStateSignature(nextFiles, nextOperation, nextSnapshot);
    if (nextSignature !== state.worktreeSignature) {
      mergeWorktreeState(data);
      renderStage();
      if (!silent) toast(t("未提交修改已刷新"));
      return "changed";
    } else if (!silent) {
      state.data.worktreeSnapshot = nextSnapshot;
      toast(t("未提交修改已是最新"));
    } else {
      state.data.worktreeSnapshot = nextSnapshot;
    }
    return "unchanged";
  } catch (error) {
    if ((state.data?.repo?.path || "") !== repoPath) return "skipped";
    if (!silent) toast(error.message);
    return "error";
  } finally {
    state.refreshingWorktree = false;
    els.refreshChanges.disabled = false;
  }
}

function initWorktreeAutoRefresh() {
  let timer = 0;
  let delay = WORKTREE_AUTO_REFRESH_MIN_MS;
  const pageIsActive = () => {
    const focused = typeof document.hasFocus !== "function" || document.hasFocus();
    return !document.hidden && focused;
  };
  const schedule = (wait = delay) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, wait);
  };
  const run = async () => {
    timer = 0;
    if (!pageIsActive()) {
      schedule(WORKTREE_AUTO_REFRESH_MAX_MS);
      return;
    }
    const result = await refreshWorktree(true);
    delay = nextWorktreeAutoRefreshDelay(delay, result, state.data?.workingFiles?.length || 0);
    schedule(delay);
  };
  const refreshWhenActive = () => {
    if (!pageIsActive()) return;
    delay = WORKTREE_AUTO_REFRESH_MIN_MS;
    schedule(0);
  };
  window.addEventListener("focus", refreshWhenActive);
  document.addEventListener("visibilitychange", refreshWhenActive);
  schedule(WORKTREE_AUTO_REFRESH_MIN_MS);
}
