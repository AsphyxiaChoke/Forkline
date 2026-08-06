// Shared HTTP wrapper for Forkline API calls.
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
  try {
    const response = await fetch(path, {
      ...options,
      headers,
    });
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

window.Forkline.api = api;
window.Forkline.refreshOperationProgress = refreshOperationProgress;

