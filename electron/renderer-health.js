const MAX_DIAGNOSTIC_TEXT = 260;
const UNRESPONSIVE_DIALOG_DELAY_MS = 2500;

function boundedText(value) {
  return String(value || "").trim().slice(0, MAX_DIAGNOSTIC_TEXT);
}

function normalizeRendererRecoveryState(value = {}) {
  return {
    repoPath: boundedText(value.repoPath),
    fileEditorDirty: Boolean(value.fileEditorDirty),
    fileEditorFile: boundedText(value.fileEditorFile),
    commitDraftDirty: Boolean(value.commitDraftDirty),
  };
}

function recoveryItems(value) {
  const state = normalizeRendererRecoveryState(value);
  const items = [];
  if (state.fileEditorDirty) {
    items.push(state.fileEditorFile ? `文件编辑器“${state.fileEditorFile}”` : "文件编辑器");
  }
  if (state.commitDraftDirty) items.push("提交信息框");
  return { state, items };
}

function repositoryDetail(state) {
  return state.repoPath ? `\n当前仓库：${state.repoPath}` : "";
}

function unresponsiveDialogOptions(value) {
  const { state, items } = recoveryItems(value);
  const risk = items.length
    ? `检测到以下未保存内容：${items.join("、")}。重新加载会丢失这些内容，建议先继续等待。`
    : "重新加载只会重建界面，后台 Git 服务和当前仓库会继续保留。";
  return {
    type: "warning",
    title: "Forkline 页面无响应",
    message: "界面暂时没有响应",
    detail: `${risk}\n如果刚打开大文件或正在计算差异，可以先继续等待。${repositoryDetail(state)}`,
    buttons: ["继续等待", items.length ? "放弃未保存内容并重新加载" : "重新加载页面"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  };
}

function rendererGoneReason(details = {}) {
  const reasons = {
    crashed: "页面进程发生崩溃",
    killed: "页面进程被系统或其他程序结束",
    oom: "页面进程内存不足",
    "launch-failed": "页面进程启动失败",
    "integrity-failure": "页面进程完整性检查失败",
  };
  return reasons[String(details.reason || "")] || "页面进程意外停止";
}

function rendererGoneDialogOptions(details, value) {
  const { state, items } = recoveryItems(value);
  const exitCode = Number.isInteger(details?.exitCode) ? `。退出代码：${details.exitCode}` : "";
  const recovery = items.length
    ? `页面停止前检测到以下未保存内容：${items.join("、")}。重新加载后会尝试恢复这些内容。`
    : "后台 Git 服务和当前仓库仍然保留，可以重新加载页面继续使用。";
  return {
    type: "error",
    title: "Forkline 页面进程已停止",
    message: "Forkline 界面无法继续运行",
    detail: `原因：${rendererGoneReason(details)}${exitCode}。\n${recovery}${repositoryDetail(state)}`,
    buttons: ["重新加载页面", "退出 Forkline"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
}

function createRendererHealthController(options = {}) {
  const showDialog = options.showDialog;
  const reload = options.reload;
  const close = options.close;
  const clearRecoveryDraft = typeof options.clearRecoveryDraft === "function"
    ? options.clearRecoveryDraft
    : () => {};
  const setTimer = options.setTimer || setTimeout;
  const clearTimer = options.clearTimer || clearTimeout;
  const delayMs = Number.isFinite(options.delayMs)
    ? Math.max(0, options.delayMs)
    : UNRESPONSIVE_DIALOG_DELAY_MS;
  if (typeof showDialog !== "function" || typeof reload !== "function" || typeof close !== "function") {
    throw new TypeError("Renderer health controller requires dialog, reload, and close handlers");
  }

  let recoveryState = normalizeRendererRecoveryState();
  let unresponsive = false;
  let dialogOpen = false;
  let disposed = false;
  let warningTimer = null;
  let pendingGoneDetails = null;

  function discardRecoveryAndReload() {
    try {
      clearRecoveryDraft();
    } finally {
      reload();
    }
  }

  function clearWarningTimer() {
    if (warningTimer !== null) clearTimer(warningTimer);
    warningTimer = null;
  }

  async function showGoneDialog() {
    if (disposed || dialogOpen || !pendingGoneDetails) return;
    const details = pendingGoneDetails;
    pendingGoneDetails = null;
    dialogOpen = true;
    try {
      const result = await showDialog(rendererGoneDialogOptions(details, recoveryState));
      if (disposed) return;
      if (Number(result?.response) === 0) reload();
      else close();
    } catch {
      if (!disposed) reload();
    } finally {
      dialogOpen = false;
    }
    if (pendingGoneDetails && !disposed) await showGoneDialog();
  }

  async function showUnresponsiveDialog() {
    warningTimer = null;
    if (disposed || dialogOpen || !unresponsive) return;
    dialogOpen = true;
    try {
      const result = await showDialog(unresponsiveDialogOptions(recoveryState));
      if (!disposed && unresponsive && !pendingGoneDetails && Number(result?.response) === 1) {
        discardRecoveryAndReload();
      }
    } catch {
      // Keep waiting when the warning itself cannot be displayed.
    } finally {
      dialogOpen = false;
    }
    if (pendingGoneDetails && !disposed) await showGoneDialog();
  }

  function updateRecoveryState(value) {
    recoveryState = normalizeRendererRecoveryState(value);
  }

  function handleUnresponsive() {
    if (disposed) return;
    unresponsive = true;
    clearWarningTimer();
    warningTimer = setTimer(showUnresponsiveDialog, delayMs);
  }

  function handleResponsive() {
    unresponsive = false;
    clearWarningTimer();
  }

  function handleRenderProcessGone(details = {}) {
    if (disposed) return Promise.resolve();
    handleResponsive();
    pendingGoneDetails = details;
    return dialogOpen ? Promise.resolve() : showGoneDialog();
  }

  function dispose() {
    disposed = true;
    unresponsive = false;
    pendingGoneDetails = null;
    clearWarningTimer();
  }

  return {
    dispose,
    handleRenderProcessGone,
    handleResponsive,
    handleUnresponsive,
    updateRecoveryState,
  };
}

module.exports = {
  MAX_DIAGNOSTIC_TEXT,
  UNRESPONSIVE_DIALOG_DELAY_MS,
  createRendererHealthController,
  normalizeRendererRecoveryState,
  rendererGoneDialogOptions,
  rendererGoneReason,
  unresponsiveDialogOptions,
};
