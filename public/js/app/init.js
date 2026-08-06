// App initialization and top-level rendering.
async function init() {
  const selfUpdateResult = await checkForSelfUpdateResult();
  await restoreSelfUpdateRepo(selfUpdateResult);
  checkForAppUpdate();
  try {
    renderRecentRepos();
    const params = new URLSearchParams(window.location.search);
    const initialRef = params.get("ref") || "";
    const initialTab = params.get("tab") || "";
    state.openDiffOnInit = params.get("diff") === "max";
    if (["details", "files", "fileHistory", "fileBlame", "branches", "worktrees", "submodules", "sync", "compare", "stashes", "tags", "recovery", "logs", "settings"].includes(initialTab)) state.selectedTab = initialTab;
    state.selectedRef = initialRef;
    state.data = await loadInitialRepoState(initialRef);
    state.repoHydrating = Boolean(state.data.progressive);
    loadRecoveryPolicyForRepo(state.data.repo);
    state.selectedRef = state.data.repo.selectedRef || initialRef;
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    const hydrationPromise = state.data.progressive
      ? hydrateOpenedRepoData(state.openRepoRequestId, state.data.repo.path, state.selectedRef)
      : null;
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
    }
    if (hydrationPromise && !(await hydrationPromise)) return;
    renderInspector();
    if (state.selectedSha && state.openDiffOnInit) openDiffModal();
    if (!state.data.progressiveError) await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  }
}

async function loadInitialRepoState(initialRef = "") {
  const statePath = `/api/state?ref=${encodeURIComponent(initialRef)}`;
  const initialData = await api(statePath);
  if (!initialData?.repo?.isSample) {
    saveRecentRepo(initialData.repo);
    return initialData;
  }

  const previousRepo = recentRepos()[0];
  if (!previousRepo?.path) return initialData;

  let restoredData;
  try {
    restoredData = await api("/api/open", {
      method: "POST",
      body: JSON.stringify({ path: previousRepo.path, progressive: true }),
    });
  } catch {
    return initialData;
  }

  if (initialRef) {
    try {
      const refData = await api(`/api/ref-state?ref=${encodeURIComponent(initialRef)}`);
      restoredData = {
        ...restoredData,
        repo: { ...(restoredData.repo || {}), ...(refData.repo || {}), selectedRef: initialRef },
        commits: refData.commits || [],
        history: refData.history || restoredData.history,
      };
    } catch {}
  }
  saveRecentRepo(restoredData.repo);
  return restoredData;
}

async function checkForAppUpdate() {
  const indicator = els.appUpdateIndicator;
  state.appUpdate = { ...state.appUpdate, status: "loading" };
  if (indicator) {
    indicator.hidden = true;
    indicator.removeAttribute("href");
  }
  try {
    const update = await api("/api/app-update");
    const lastResult = state.appUpdate?.lastResult || null;
    state.appUpdate = {
      status: update?.available ? "available" : update?.latestVersion ? "current" : "unavailable",
      currentVersion: String(update?.currentVersion || ""),
      latestVersion: String(update?.latestVersion || ""),
      url: String(update?.url || ""),
      installSupported: Boolean(update?.installSupported),
      installing: false,
      installError: "",
      installState: "",
      installMessage: "",
      installStep: 0,
      installTotal: 6,
      lastResult,
    };
    if (!indicator || !update?.available || !update.url) return;
    const label = t("发现 Forkline 新版本 {version}，点击查看", { version: update.latestVersion });
    indicator.href = update.url;
    indicator.title = label;
    indicator.setAttribute("aria-label", label);
    indicator.hidden = false;
  } catch {
    state.appUpdate = { ...state.appUpdate, status: "unavailable", latestVersion: "", url: "" };
    if (indicator) indicator.hidden = true;
  } finally {
    if (state.data && state.selectedTab === "settings") renderInspector();
  }
}

async function readSelfUpdateResult(consume = false) {
  const response = await fetch(`/api/app-update/status${consume ? "?consume=1" : ""}`, {
    cache: "no-store",
    headers: { "X-Forkline-Locale": currentLocale() },
  });
  if (!response.ok) throw new Error(t("无法读取 Forkline 更新状态"));
  return response.json();
}

async function checkForSelfUpdateResult() {
  try {
    const result = await readSelfUpdateResult(true);
    if (result?.state === "success") {
      state.appUpdate = { ...state.appUpdate, lastResult: null, installError: "" };
      toast(t("Forkline 已更新到 {version}", { version: `v${String(result.targetVersion || "").replace(/^v/i, "")}` }));
    } else if (result?.state === "error") {
      state.appUpdate = {
        ...state.appUpdate,
        lastResult: result,
        installError: String(result.error || result.message || ""),
      };
      toast(selfUpdateFailureMessage(result));
    }
    return result;
  } catch {
    return null;
  }
}

function selfUpdateFailureMessage(result) {
  const detail = t(result?.error || result?.message || "未知原因");
  const failedStage = String(result?.failedStage || "");
  let message = "";
  if (failedStage === "preflight") {
    message = t("更新前检查未通过：{message}", { message: detail });
  } else if (!result?.rollbackState && result?.rolledBack) {
    message = t("更新失败，已恢复到更新前版本：{message}", { message: detail });
  } else {
    message = t(result?.error ? "更新失败：{message}" : "Forkline 更新失败：{message}", { message: detail });
  }
  const recovery = selfUpdateRecoveryText(result);
  return [message, recovery].filter(Boolean).join("\n");
}

function selfUpdateRecoveryText(result = {}) {
  const rollbackState = String(result.rollbackState || (result.rolledBack ? "complete" : ""));
  const serviceState = String(result.serviceState || "");
  if (rollbackState === "not-needed") {
    if (serviceState === "unchanged") return t("更新文件没有修改，原版本仍在运行。");
    if (serviceState === "restored") return t("更新文件没有修改，原版本已重新启动。");
    return t("更新文件没有修改，不需要回退。");
  }
  if (rollbackState === "complete") {
    if (serviceState === "restored") return t("已恢复到更新前版本，原版本服务已重新启动。");
    if (serviceState === "unavailable") return t("已恢复到更新前版本，但 Forkline 服务没有恢复。");
    return t("已恢复到更新前版本。");
  }
  if (rollbackState === "failed") {
    return [
      t("自动回退未完成，当前 Forkline 文件状态需要人工检查。"),
      serviceState === "unavailable" ? t("Forkline 服务没有恢复，请重新运行 start.cmd。") : "",
    ].filter(Boolean).join(" ");
  }
  if (rollbackState === "blocked") {
    return [
      t("检测到 Forkline 自身提交位置发生额外变化，为避免覆盖修改，未自动回退。"),
      serviceState === "unavailable" ? t("Forkline 服务没有恢复，请重新运行 start.cmd。") : "",
    ].filter(Boolean).join(" ");
  }
  if (rollbackState === "unknown") {
    return [
      t("无法确认自动回退结果，请检查 Forkline 自身仓库。"),
      serviceState === "unavailable" ? t("Forkline 服务没有恢复，请重新运行 start.cmd。") : "",
    ].filter(Boolean).join(" ");
  }
  return result.recoveryMessage ? t(result.recoveryMessage) : "";
}

function selfUpdateStageMessage(result = {}) {
  const phase = String(result.phase || result.state || "");
  if (phase === "preparing") {
    const preparationMessage = selfUpdatePreparationMessage(result);
    if (preparationMessage) return preparationMessage;
  }
  const messages = {
    preparing: "正在检查版本和本地更新条件",
    starting: "更新前检查已通过，正在启动更新器",
    stopping: "正在关闭旧版本服务",
    verifying: "正在重新校验更新条件",
    updating: "正在写入新版本",
    restarting: "正在启动新版本",
    checking: "正在确认新版本可以正常使用",
    recovering: "更新失败，正在恢复更新前版本",
    reconnecting: "服务正在重启，正在重新连接",
    complete: "更新完成",
    success: "更新完成",
  };
  return t(messages[phase] || result.message || "正在更新并重启");
}

function selfUpdatePreparationMessage(result = {}) {
  const stage = String(result.downloadStage || "");
  const percent = Math.min(100, Math.max(0, Number(result.downloadPercent) || 0));
  const attempt = Math.max(1, Number(result.fetchAttempt) || 1);
  const attempts = Math.max(attempt, Number(result.fetchAttempts) || attempt);
  if (stage === "retrying") return t("下载连接中断，正在重试（{attempt}/{attempts}）", { attempt, attempts });
  if (stage === "connecting") return t("正在连接 GitHub 下载正式版本（{attempt}/{attempts}）", { attempt, attempts });
  if (["counting", "compressing"].includes(stage)) return t("正在准备下载正式版本：{percent}%", { percent });
  if (stage === "receiving") {
    const size = formatSelfUpdateBytes(result.downloadBytes);
    if (size) return t("正在下载正式版本：{percent}%（已接收 {size}）", { percent, size });
    const objects = Math.max(0, Number(result.downloadObjects) || 0);
    const total = Math.max(0, Number(result.downloadTotalObjects) || 0);
    if (total) return t("正在下载正式版本：{percent}%（{objects}/{total} 个对象）", { percent, objects, total });
    return t("正在下载正式版本：{percent}%", { percent });
  }
  if (stage === "resolving") return t("正在处理下载内容：{percent}%", { percent });
  if (stage === "complete") return t("正式版本下载完成，正在校验");
  return "";
}

function formatSelfUpdateBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MiB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GiB`;
}

function applySelfUpdateProgress(result = {}) {
  const installState = String(result.phase || result.state || "");
  const installStep = Math.max(0, Number(result.step) || 0);
  const installTotal = Math.max(1, Number(result.totalSteps) || 6);
  const installMessage = selfUpdateStageMessage(result);
  const update = state.appUpdate || {};
  const changed = update.installState !== installState
    || update.installStep !== installStep
    || update.installTotal !== installTotal
    || update.installMessage !== installMessage;
  state.appUpdate = { ...update, installState, installStep, installTotal, installMessage };
  if (changed && state.data && state.selectedTab === "settings") renderInspector();
}

async function restoreSelfUpdateRepo(result) {
  const repoPath = String(result?.repoPath || "").trim();
  if (!repoPath) return;
  try {
    await api("/api/open", { method: "POST", body: JSON.stringify({ path: repoPath }) });
  } catch {}
}

async function waitForSelfUpdateRestart(targetVersion) {
  const normalizedTarget = String(targetVersion || "").replace(/^v/i, "");
  const deadline = Date.now() + 120000;
  let reconnecting = false;
  while (Date.now() < deadline) {
    let result = null;
    try {
      result = await readSelfUpdateResult(false);
      reconnecting = false;
      if (result?.state && result.state !== "idle") applySelfUpdateProgress(result);
    } catch {
      if (!reconnecting) {
        reconnecting = true;
        applySelfUpdateProgress({ phase: "reconnecting", step: 5, totalSteps: 6 });
      }
    }
    if (result?.state === "success" && String(result.targetVersion || "").replace(/^v/i, "") === normalizedTarget) {
      window.location.reload();
      return;
    }
    if (result?.state === "error") {
      await restoreSelfUpdateRepo(result);
      try {
        await readSelfUpdateResult(true);
      } catch {}
      const failure = new Error(selfUpdateFailureMessage(result));
      failure.updateResult = result;
      throw failure;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  const timeoutResult = {
    state: "error",
    phase: "failed",
    failedStage: "reconnecting",
    rollbackState: "unknown",
    serviceState: "unknown",
    error: t("更新服务重启超时，请手动重新打开 Forkline。"),
  };
  const failure = new Error(selfUpdateFailureMessage(timeoutResult));
  failure.updateResult = timeoutResult;
  throw failure;
}

function renderAll() {
  cancelScheduledCommitRender();
  applyHistoryState();
  renderRepo();
  renderBranches();
  renderStage();
  updateAmendMode();
  renderCommits({ inspector: "never" });
  renderInspector();
}

function renderRepo() {
  const repo = state.data.repo;
  els.repoName.textContent = repo.name;
  const repoPath = repo.isSample ? t(repo.path) : repo.path;
  els.repoPath.textContent = state.selectedRef ? `${repoPath} · ${state.selectedRef}` : repoPath;
  els.sideRepoName.textContent = repo.name;
  els.sideRepoBranch.textContent = state.selectedRef || repo.branch;
  if (!repo.isSample) els.repoInput.value = repo.path;
}

