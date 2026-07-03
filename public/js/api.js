// Shared HTTP wrapper for Forkline API calls.
async function api(path, options = {}) {
  const requestRepoPath = repoPathSnapshot();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (requestRepoPath && !state.data?.repo?.isSample) headers["X-Forkline-Repo-Path"] = requestRepoPath;
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const data = await response.json();
  if (state.data && isCurrentRepoPath(requestRepoPath)) {
    if (data.operationLog) state.data.operationLog = data.operationLog;
    if (data.runningOperations) state.data.runningOperations = data.runningOperations;
  }
  if (!response.ok || data.error) {
    const error = new Error(data.error || "请求失败");
    error.data = data;
    if (data.remoteCheck) error.remoteCheck = data.remoteCheck;
    throw error;
  }
  return data;
}

window.Forkline.api = api;

