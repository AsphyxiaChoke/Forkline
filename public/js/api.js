// Shared HTTP wrapper and long-running Git operation control.
const OPERATION_POLL_INTERVAL_MS = 700;
let operationPollTimer = 0;
let operationPollRequest = null;
let pendingActionRequestCount = 0;
let activeGitActionLabel = "";

const GIT_ACTION_DISABLED_ATTRIBUTE = "data-forkline-action-disabled";
const GIT_ACTION_TITLE_ATTRIBUTE = "data-forkline-action-title";
const GIT_ACTION_TITLE_PRESENT_ATTRIBUTE = "data-forkline-action-title-present";
const GIT_ACTION_ARIA_ATTRIBUTE = "data-forkline-action-aria-disabled";
const GIT_ACTION_ARIA_PRESENT_ATTRIBUTE = "data-forkline-action-aria-present";
const GIT_ACTION_IDS = new Set([
  "openRepo",
  "browseRepo",
  "cloneRepo",
  "initRepo",
  "newBranch",
  "undoRecovery",
  "refreshChanges",
  "stashChanges",
  "stageAll",
  "discardAll",
  "commitSubmit",
  "cloneSubmit",
  "initSubmit",
  "patchSubmit",
  "branchSubmit",
  "tagSubmit",
  "mainlineSubmit",
  "fileEditorSave",
]);
const GIT_ACTION_FORM_IDS = new Set([
  "commitForm",
  "cloneForm",
  "initForm",
  "patchForm",
  "branchForm",
  "tagForm",
  "mainlineForm",
  "fileEditorForm",
]);
const GIT_ACTION_DATA_KEYS = new Set([
  "action",
  "syncAction",
  "upstreamAction",
  "remoteAction",
  "remoteMenuAction",
  "branchAction",
  "commitAction",
  "commitTool",
  "fileAction",
  "fileEditorAction",
  "fileHistoryAction",
  "fileBlameAction",
  "tagAction",
  "tagMenuAction",
  "reflogAction",
  "reflogMenuAction",
  "stashAction",
  "bulkFileAction",
  "repoOperation",
  "conflictChoice",
  "worktreeAction",
  "submoduleAction",
  "recoveryAction",
  "recoveryPrune",
  "recoveryBulkDelete",
  "historyPlanAction",
  "historyQueueAction",
  "branchCleanupAction",
  "lineAction",
  "hunkAction",
]);
const GIT_ACTION_READONLY_VALUES = new Map([
  ["remoteAction", new Set(["test"])],
  ["remoteMenuAction", new Set(["test", "copyCheckCommand", "copyFetch", "copyPush"])],
  ["branchAction", new Set(["view", "compare", "cleanupView", "openPullRequest", "copyPullRequest", "copy"])],
  ["commitAction", new Set(["details", "copySha", "copyMessage", "copyPatch", "downloadPatch", "openRemote"])],
  ["commitTool", new Set(["copyPatch", "downloadPatch", "openRemote"])],
  ["fileAction", new Set(["edit", "diff", "history", "blame"])],
  ["fileHistoryAction", new Set(["file", "view"])],
  ["fileBlameAction", new Set(["view"])],
  ["tagAction", new Set(["view", "copy"])],
  ["tagMenuAction", new Set(["view", "copy"])],
  ["reflogAction", new Set(["view", "copy"])],
  ["reflogMenuAction", new Set(["view", "copy"])],
  ["worktreeAction", new Set(["copyPath", "refresh"])],
  ["submoduleAction", new Set(["copyPath", "copyUrl", "refresh"])],
  ["historyPlanAction", new Set(["cancel", "refresh"])],
  ["historyQueueAction", new Set(["changeMode", "clear", "moveDown", "moveUp", "refresh", "remove"])],
  ["branchCleanupAction", new Set(["view", "compare", "refresh"])],
]);
const GIT_ACTION_DISPLAY_NAMES = new Map([
  ["fetch", "抓取"],
  ["fetchRemote", "抓取"],
  ["pull", "拉取"],
  ["pullRebase", "变基拉取"],
  ["push", "推送"],
  ["forcePushLease", "安全强推"],
  ["stageAll", "暂存全部"],
  ["discardAll", "丢弃全部"],
  ["commit", "创建提交"],
  ["amendCommit", "追加提交"],
  ["cloneRepository", "克隆仓库"],
  ["initRepository", "初始化仓库"],
]);

function runningGitOperations() {
  if (typeof state === "object" && state.data?.repo?.isSample) return [];
  return typeof state === "object" && Array.isArray(state.data?.runningOperations)
    ? state.data.runningOperations
    : [];
}

function gitActionBusy() {
  return pendingActionRequestCount > 0 || runningGitOperations().length > 0;
}

function gitActionForm(form) {
  if (!form || typeof form !== "object") return false;
  if (GIT_ACTION_FORM_IDS.has(String(form.id || ""))) return true;
  return typeof form.matches === "function" && form.matches("[data-worktree-form],[data-reword-form]");
}

function isGitActionControl(control) {
  if (!control || typeof control !== "object") return false;
  if (GIT_ACTION_IDS.has(String(control.id || ""))) return true;
  const type = String(control.type || "").toLowerCase();
  const form = control.form || (typeof control.closest === "function" ? control.closest("form") : null);
  if (type === "submit" && gitActionForm(form)) return true;
  if (typeof control.closest === "function" && type === "submit" && control.closest("[data-worktree-form],[data-reword-form]")) return true;
  for (const key of Object.keys(control.dataset || {})) {
    if (!GIT_ACTION_DATA_KEYS.has(key)) continue;
    if (!GIT_ACTION_READONLY_VALUES.get(key)?.has(String(control.dataset[key] || ""))) return true;
  }
  return false;
}

function currentGitActionControls() {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return [];
  return Array.from(document.querySelectorAll("button,select,input[type='submit']")).filter(isGitActionControl);
}

function allTrackedGitActionControls() {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return [];
  const current = currentGitActionControls();
  const tracked = Array.from(document.querySelectorAll(`[${GIT_ACTION_DISABLED_ATTRIBUTE}]`));
  return [...new Set([...current, ...tracked])];
}

function actionRequestBody(options = {}) {
  if (typeof options.body !== "string") return {};
  try {
    const body = JSON.parse(options.body);
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

function actionRequestLabel(options = {}) {
  const action = String(actionRequestBody(options).action || "").trim();
  if (!action) return typeof t === "function" ? t("Git 操作") : "Git 操作";
  const displayName = GIT_ACTION_DISPLAY_NAMES.get(action);
  if (displayName) return typeof t === "function" ? t(displayName) : displayName;
  return typeof t === "function" ? t("Git 操作 {action}", { action }) : `Git 操作 ${action}`;
}

function updateGitActionStatus(busy, label = activeGitActionLabel) {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
  const status = document.querySelector("#gitActionStatus");
  if (!status) return;
  const message = busy
    ? (typeof t === "function" ? t("正在执行：{action}，请等待", { action: label || "Git 操作" }) : `正在执行：${label || "Git 操作"}，请等待`)
    : "";
  status.hidden = !busy;
  status.textContent = message;
  status.setAttribute("aria-busy", busy ? "true" : "false");
  status.setAttribute("title", message);
}

function syncGitActionBusyState(label = "") {
  const runningOperations = runningGitOperations();
  const busy = gitActionBusy();
  if (busy && label && !activeGitActionLabel) activeGitActionLabel = label;
  if (busy && !activeGitActionLabel && runningOperations[0]?.label) activeGitActionLabel = String(runningOperations[0].label);
  if (!busy) activeGitActionLabel = "";
  const busyTitle = typeof t === "function" ? t("Git 操作正在执行，请等待") : "Git 操作正在执行，请等待";
  for (const control of allTrackedGitActionControls()) {
    if (busy) {
      if (!control.hasAttribute(GIT_ACTION_DISABLED_ATTRIBUTE)) {
        control.setAttribute(GIT_ACTION_DISABLED_ATTRIBUTE, control.disabled ? "1" : "0");
        control.setAttribute(GIT_ACTION_TITLE_PRESENT_ATTRIBUTE, control.hasAttribute("title") ? "1" : "0");
        if (control.hasAttribute("title")) control.setAttribute(GIT_ACTION_TITLE_ATTRIBUTE, control.getAttribute("title") || "");
        control.setAttribute(GIT_ACTION_ARIA_PRESENT_ATTRIBUTE, control.hasAttribute("aria-disabled") ? "1" : "0");
        if (control.hasAttribute("aria-disabled")) control.setAttribute(GIT_ACTION_ARIA_ATTRIBUTE, control.getAttribute("aria-disabled") || "");
      }
      control.disabled = true;
      control.setAttribute("aria-disabled", "true");
      control.setAttribute("title", busyTitle);
      continue;
    }
    if (!control.hasAttribute(GIT_ACTION_DISABLED_ATTRIBUTE)) continue;
    control.disabled = control.getAttribute(GIT_ACTION_DISABLED_ATTRIBUTE) === "1";
    if (control.getAttribute(GIT_ACTION_TITLE_PRESENT_ATTRIBUTE) === "1") {
      control.setAttribute("title", control.getAttribute(GIT_ACTION_TITLE_ATTRIBUTE) || "");
    } else {
      control.removeAttribute("title");
    }
    if (control.getAttribute(GIT_ACTION_ARIA_PRESENT_ATTRIBUTE) === "1") {
      control.setAttribute("aria-disabled", control.getAttribute(GIT_ACTION_ARIA_ATTRIBUTE) || "");
    } else {
      control.removeAttribute("aria-disabled");
    }
    control.removeAttribute(GIT_ACTION_DISABLED_ATTRIBUTE);
    control.removeAttribute(GIT_ACTION_TITLE_ATTRIBUTE);
    control.removeAttribute(GIT_ACTION_TITLE_PRESENT_ATTRIBUTE);
    control.removeAttribute(GIT_ACTION_ARIA_ATTRIBUTE);
    control.removeAttribute(GIT_ACTION_ARIA_PRESENT_ATTRIBUTE);
  }
  updateGitActionStatus(busy);
  if (typeof document !== "undefined" && document.documentElement?.classList) {
    document.documentElement.classList.toggle("git-action-busy", busy);
  }
}

function installGitActionGuard() {
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  document.addEventListener("click", (event) => {
    if (!gitActionBusy()) return;
    const target = event.target;
    if (typeof target?.closest === "function" && target.closest("[data-operation-cancel]")) return;
    const control = typeof target?.closest === "function" ? target.closest("button,select,input[type='submit']") : target;
    if (!isGitActionControl(control)) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
  }, true);
  document.addEventListener("submit", (event) => {
    if (!gitActionBusy() || !gitActionForm(event.target)) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!gitActionBusy()) return;
    if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "s") {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }
  }, true);
}

installGitActionGuard();

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
    syncGitActionBusyState(actionRequestLabel(options));
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
      syncGitActionBusyState();
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
  syncGitActionBusyState();
  if (state.data.runningOperations?.length) ensureOperationPolling();
  renderOperationProgressIfVisible();
}

function ensureOperationPolling() {
  if (operationPollTimer || typeof window === "undefined" || typeof window.setInterval !== "function") return;
  operationPollTimer = window.setInterval(refreshOperationProgress, OPERATION_POLL_INTERVAL_MS);
}

function startOperationPolling() {
  ensureOperationPolling();
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
      if (!gitActionBusy()) stopOperationPolling();
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
window.Forkline.isGitActionBusy = gitActionBusy;

