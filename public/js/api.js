// Shared HTTP wrapper for Forkline API calls.
async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (data.operationLog && state.data) state.data.operationLog = data.operationLog;
  if (data.runningOperations && state.data) state.data.runningOperations = data.runningOperations;
  if (!response.ok || data.error) {
    const error = new Error(data.error || "请求失败");
    error.data = data;
    if (data.remoteCheck) error.remoteCheck = data.remoteCheck;
    throw error;
  }
  return data;
}

window.Forkline.api = api;

