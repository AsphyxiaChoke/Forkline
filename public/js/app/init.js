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
    loadRecoveryPolicyForRepo(state.data.repo);
    state.selectedRef = state.data.repo.selectedRef || initialRef;
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
      if (state.openDiffOnInit) openDiffModal();
    }
    await maybeRestoreCheckoutStash(state.data.repo.branch);
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
      body: JSON.stringify({ path: previousRepo.path }),
    });
  } catch {
    return initialData;
  }

  if (initialRef) {
    try {
      restoredData = await api(statePath);
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
    state.appUpdate = {
      status: update?.available ? "available" : update?.latestVersion ? "current" : "unavailable",
      currentVersion: String(update?.currentVersion || ""),
      latestVersion: String(update?.latestVersion || ""),
      url: String(update?.url || ""),
      installSupported: Boolean(update?.installSupported),
      installing: false,
      installError: "",
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
      toast(t("Forkline 已更新到 {version}", { version: `v${String(result.targetVersion || "").replace(/^v/i, "")}` }));
    } else if (result?.state === "error") {
      toast(selfUpdateFailureMessage(result));
    }
    return result;
  } catch {
    return null;
  }
}

function selfUpdateFailureMessage(result) {
  const detail = t(result?.error || result?.message || "未知原因");
  if (!result?.error) return t("Forkline 更新失败：{message}", { message: detail });
  const template = result.rolledBack
    ? "更新失败，已恢复到更新前版本：{message}"
    : "更新失败：{message}";
  return t(template, { message: detail });
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
  while (Date.now() < deadline) {
    let result = null;
    try {
      result = await readSelfUpdateResult(false);
    } catch {}
    if (result?.state === "success" && String(result.targetVersion || "").replace(/^v/i, "") === normalizedTarget) {
      window.location.reload();
      return;
    }
    if (result?.state === "error") {
      await restoreSelfUpdateRepo(result);
      try {
        await readSelfUpdateResult(true);
      } catch {}
      throw new Error(selfUpdateFailureMessage(result));
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(t("更新服务重启超时，请手动重新打开 Forkline。"));
}

function renderAll() {
  cancelScheduledCommitRender();
  applyHistoryState();
  renderRepo();
  renderBranches();
  renderWorkingFiles();
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

