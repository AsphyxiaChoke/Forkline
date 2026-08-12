// Shared HTTP wrapper and long-running Git operation control.
const OPERATION_POLL_INTERVAL_MS = 700;
let operationPollTimer = 0;
let operationPollRequest = null;
let pendingActionRequestCount = 0;

function encodeRepoPathHeader(repoPath) {
  return `v1:${encodeURIComponent(String(repoPath || ""))}`;
}

async function api(path, options = {}) {
  const requestRepoPath = repoPathSnapshot();
  const method = String(options.method || "GET").toUpperCase();
  if (state.repoHydrating && method !== "GET" && path !== "/api/open") {
    throw new Error(t(state.data?.progressiveError
      ? "工作区详情加载失败，请重新打开仓库"
      : "仓库详情正在载入，完成后再执行操作"));
  }
  const tracksOperation = path === "/api/action" && method === "POST";
  if (tracksOperation) {
    pendingActionRequestCount += 1;
    startOperationPolling();
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  headers["X-Forkline-Locale"] = currentLocale();
  if (requestRepoPath && !state.data?.repo?.isSample) {
    headers["X-Forkline-Repo-Path"] = encodeRepoPathHeader(requestRepoPath);
  }
  const requestOptions = { ...options, headers };
  try {
    let response;
    try {
      response = await fetch(path, requestOptions);
    } catch (error) {
      if (path === "/api/open" && isFetchNetworkError(error)) {
        try {
          response = await fetch(path, requestOptions);
        } catch (retryError) {
          throw normalizeFetchNetworkError(retryError);
        }
      } else {
        throw normalizeFetchNetworkError(error);
      }
    }
    const data = await response.json();
    mergeOperationState(data, requestRepoPath);
    if (!response.ok || data.error) {
      const error = new Error(data.error || t("请求失败"));
      error.data = data;
      if (data.remoteCheck) error.remoteCheck = data.remoteCheck;
      throw error;
    }
    return data;
  } finally {
    if (tracksOperation) {
      pendingActionRequestCount = Math.max(0, pendingActionRequestCount - 1);
      refreshOperationProgress();
    }
  }
}

function isFetchNetworkError(error) {
  return /failed to fetch|networkerror|network request failed|load failed/i.test(String(error?.message || error || ""));
}

function normalizeFetchNetworkError(error) {
  return isFetchNetworkError(error) ? new Error(t("无法连接 Forkline 本地服务")) : error;
}

function mergeOperationState(data, requestRepoPath = "") {
  if (!state.data || (requestRepoPath && !isCurrentRepoPath(requestRepoPath))) return;
  if (data.operationLog) state.data.operationLog = data.operationLog;
  if (data.runningOperations) state.data.runningOperations = data.runningOperations;
  renderOperationProgressIfVisible();
}

function startOperationPolling() {
  if (!operationPollTimer) {
    operationPollTimer = window.setInterval(refreshOperationProgress, OPERATION_POLL_INTERVAL_MS);
  }
  refreshOperationProgress();
}

function stopOperationPolling() {
  if (!operationPollTimer) return;
  window.clearInterval(operationPollTimer);
  operationPollTimer = 0;
}

function refreshOperationProgress() {
  if (operationPollRequest) return operationPollRequest;
  operationPollRequest = fetch("/api/operations", {
    headers: { "X-Forkline-Locale": currentLocale() },
  })
    .then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      mergeOperationState(data);
      if (!data.runningOperations?.length && pendingActionRequestCount === 0) stopOperationPolling();
    })
    .catch(() => {
      if (pendingActionRequestCount === 0) stopOperationPolling();
    })
    .finally(() => {
      operationPollRequest = null;
    });
  return operationPollRequest;
}

function renderOperationProgressIfVisible() {
  if (state.selectedTab !== "logs" || typeof renderInspector !== "function" || !els?.detailBody) return;
  const panel = els.detailBody;
  const previousTop = panel.scrollTop;
  const followsBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 36;
  renderInspector();
  panel.scrollTop = followsBottom ? panel.scrollHeight : Math.min(previousTop, panel.scrollHeight);
  panel.querySelectorAll(".operation-log-item.running pre").forEach((output) => {
    output.scrollTop = output.scrollHeight;
  });
}

async function cancelRunningOperation(id, options = {}) {
  let operation = (state.data?.runningOperations || []).find((item) => String(item.id) === String(id));
  if (!operation) {
    await refreshOperationProgress();
    operation = (state.data?.runningOperations || []).find((item) => String(item.id) === String(id));
  }
  if (!operation) throw new Error(t("这个 Git 操作已经结束，请刷新操作日志查看结果。"));
  if (!operation.cancellable && !operation.cancelRequested) throw new Error(t("这个 Git 操作当前不能取消。"));
  if (operation.cancelRequested) return;
  if (options.confirm !== false) {
    const command = operation.command ? `\n\n${operation.command}` : "";
    if (!confirm(t("确认取消“{label}”？{command}\n\nGit 会停止当前命令，已经完成的远端传输不会自动回退。", { label: t(operation.label || "Git 操作"), command }))) return;
  }
  if (options.button) options.button.disabled = true;
  const result = await api("/api/operations/cancel", {
    method: "POST",
    body: JSON.stringify({ id: operation.id }),
  });
  renderOperationProgressIfVisible();
  toast(result.output || t("正在取消操作"));
  return result;
}

window.Forkline.api = api;
window.Forkline.refreshOperationProgress = refreshOperationProgress;

