// App initialization and top-level rendering.
async function init() {
  checkForAppUpdate();
  try {
    renderRecentRepos();
    const params = new URLSearchParams(window.location.search);
    const initialRef = params.get("ref") || "";
    const initialTab = params.get("tab") || "";
    state.openDiffOnInit = params.get("diff") === "max";
    if (["details", "files", "fileHistory", "fileBlame", "branches", "worktrees", "submodules", "sync", "compare", "stashes", "tags", "recovery", "logs", "settings"].includes(initialTab)) state.selectedTab = initialTab;
    state.selectedRef = initialRef;
    state.data = await api(`/api/state?ref=${encodeURIComponent(initialRef)}`);
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

async function checkForAppUpdate() {
  const indicator = els.appUpdateIndicator;
  if (!indicator) return;
  indicator.hidden = true;
  indicator.removeAttribute("href");
  try {
    const update = await api("/api/app-update");
    if (!update?.available || !update.url) return;
    const label = t("发现 Forkline 新版本 {version}，点击查看", { version: update.latestVersion });
    indicator.href = update.url;
    indicator.title = label;
    indicator.setAttribute("aria-label", label);
    indicator.hidden = false;
  } catch {
    indicator.hidden = true;
  }
}

function renderAll() {
  cancelScheduledCommitRender();
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

