// App initialization and top-level rendering.
async function init() {
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

function renderAll() {
  cancelScheduledCommitRender();
  renderRepo();
  renderBranches();
  renderWorkingFiles();
  renderStage();
  renderCommits({ inspector: "never" });
  renderInspector();
}

function renderRepo() {
  const repo = state.data.repo;
  els.repoName.textContent = repo.name;
  els.repoPath.textContent = state.selectedRef ? `${repo.path} · ${state.selectedRef}` : repo.path;
  els.sideRepoName.textContent = repo.name;
  els.sideRepoBranch.textContent = state.selectedRef || repo.branch;
  if (!repo.isSample) els.repoInput.value = repo.path;
}

