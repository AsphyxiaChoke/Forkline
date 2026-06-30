// DOM event bindings. Load after all feature functions.
els.openRepo.addEventListener("click", openRepo);
els.browseRepo.addEventListener("click", () => openFolderModal().catch((error) => toast(error.message)));
els.cloneRepo.addEventListener("click", openCloneModal);
els.initRepo.addEventListener("click", openInitModal);
els.openCommandPalette.addEventListener("click", openCommandPalette);
els.repoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openRepo();
});
els.recentRepoSelect.addEventListener("change", () => {
  openRecentRepo().catch((error) => toast(error.message));
});
els.clearRecentRepos.addEventListener("click", clearRecentRepos);
els.folderClose.addEventListener("click", closeFolderModal);
els.folderModal.addEventListener("click", (event) => {
  if (event.target === els.folderModal) closeFolderModal();
});
els.folderGo.addEventListener("click", () => loadFolder(els.folderPathInput.value.trim()));
els.folderPathInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadFolder(els.folderPathInput.value.trim());
});
els.folderParent.addEventListener("click", () => {
  if (state.folderBrowse?.parent) loadFolder(state.folderBrowse.parent);
});
els.folderOpen.addEventListener("click", () => openSelectedFolder().catch((error) => toast(error.message)));
els.folderRoots.addEventListener("click", (event) => {
  const button = event.target.closest("[data-folder-path]");
  if (button) loadFolder(button.dataset.folderPath || "");
});
els.folderList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-folder-path]");
  if (row) loadFolder(row.dataset.folderPath || "");
});
els.cloneForm.addEventListener("submit", submitCloneForm);
els.cloneCancel.addEventListener("click", closeCloneModal);
els.cloneUrlInput.addEventListener("input", syncCloneTargetSuggestion);
els.cloneTargetInput.addEventListener("input", () => {
  state.cloneTargetAuto = !els.cloneTargetInput.value.trim();
});
els.initForm.addEventListener("submit", submitInitForm);
els.initCancel.addEventListener("click", closeInitModal);
els.patchForm.addEventListener("submit", submitPatchForm);
els.patchCancel.addEventListener("click", closePatchModal);
els.commandClose.addEventListener("click", closeCommandPalette);
els.commandPalette.addEventListener("click", (event) => {
  if (event.target === els.commandPalette) closeCommandPalette();
});
els.commandInput.addEventListener("input", () => {
  state.commandPaletteIndex = 0;
  renderCommandPalette();
});
els.commandInput.addEventListener("keydown", handleCommandPaletteKeydown);
els.commandList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-command-id]");
  if (!button || button.disabled) return;
  executeCommandPaletteItem(button.dataset.commandId).catch((error) => toast(error.message));
});
els.branchFilterInput.addEventListener("input", () => updateBranchFilter(els.branchFilterInput.value));
els.clearBranchFilter.addEventListener("click", clearBranchFilter);
els.worktreeFilterInput.addEventListener("input", () => updateWorktreeFilter(els.worktreeFilterInput.value));
els.clearWorktreeFilter.addEventListener("click", clearWorktreeFilter);
els.searchInput.addEventListener("input", () => scheduleCommitRender());
els.clearSearch.addEventListener("click", clearCommitSearch);
els.themeToggle.addEventListener("click", toggleTheme);
els.newBranch.addEventListener("click", openBranchModal);
els.branchForm.addEventListener("submit", submitBranchForm);
els.branchCancel.addEventListener("click", closeBranchModal);
els.branchModal.addEventListener("click", (event) => {
  if (event.target === els.branchModal) closeBranchModal();
});
els.tagForm.addEventListener("submit", createTagFromForm);
els.tagCancel.addEventListener("click", closeTagModal);
els.tagModal.addEventListener("click", (event) => {
  if (event.target === els.tagModal) closeTagModal();
});
els.cloneModal.addEventListener("click", (event) => {
  if (event.target === els.cloneModal) closeCloneModal();
});
els.initModal.addEventListener("click", (event) => {
  if (event.target === els.initModal) closeInitModal();
});
els.patchModal.addEventListener("click", (event) => {
  if (event.target === els.patchModal) closePatchModal();
});
els.mainlineForm.addEventListener("submit", (event) => {
  submitMainlineForm(event).catch((error) => toast(error.message));
});
els.mainlineCancel.addEventListener("click", closeMainlineModal);
els.mainlineModal.addEventListener("click", (event) => {
  if (event.target === els.mainlineModal) closeMainlineModal();
});
els.refreshChanges.addEventListener("click", () => refreshWorktree(false));
els.maximizeDiff.addEventListener("click", openDiffModal);
els.workDiffView.addEventListener("click", (event) => {
  const lineButton = event.target.closest("[data-line-action]");
  if (lineButton) {
    event.preventDefault();
    if (!lineButton.disabled) runWorkDiffLineAction(lineButton).catch((error) => toast(error.message));
    return;
  }
  const button = event.target.closest("[data-hunk-action]");
  if (button) {
    event.preventDefault();
    if (!button.disabled) runWorkDiffHunkAction(button.dataset.hunkAction, button).catch((error) => toast(error.message));
    return;
  }
  const lineRow = event.target.closest("[data-diff-line-keys]");
  if (lineRow) {
    event.preventDefault();
    handleDiffLineSelection(lineRow, event);
  }
});
els.closeDiffModal.addEventListener("click", closeDiffModal);
els.diffModal.addEventListener("click", (event) => {
  if (event.target === els.diffModal) closeDiffModal();
});
els.diffModalBody.addEventListener("click", (event) => {
  const lineButton = event.target.closest("[data-line-action]");
  if (lineButton) {
    event.preventDefault();
    if (!lineButton.disabled) runWorkDiffLineAction(lineButton).catch((error) => toast(error.message));
    return;
  }
  const button = event.target.closest("[data-hunk-action]");
  if (button) {
    event.preventDefault();
    if (!button.disabled) runWorkDiffHunkAction(button.dataset.hunkAction, button).catch((error) => toast(error.message));
    return;
  }
  const lineRow = event.target.closest("[data-diff-line-keys]");
  if (lineRow) {
    event.preventDefault();
    handleDiffLineSelection(lineRow, event, els.diffModalBody);
  }
});
els.stashChanges.addEventListener("click", () => createStashFromSelection(null));
els.stageAll.addEventListener("click", () => runAction("stageAll"));
els.discardAll.addEventListener("click", () => runAction("discardAll"));
els.amendToggle.addEventListener("change", () => {
  updateAmendMode();
  if (els.amendToggle.checked) fillLatestCommitMessage();
});
els.commitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(els.amendToggle.checked ? "amendCommit" : "commit");
});
els.detailBody.addEventListener("submit", (event) => {
  const worktreeForm = event.target.closest("[data-worktree-form]");
  if (worktreeForm) {
    event.preventDefault();
    submitWorktreeForm(worktreeForm).catch((error) => toast(error.message));
    return;
  }
  const form = event.target.closest("[data-reword-form]");
  if (!form) return;
  event.preventDefault();
  rewordSelectedCommit(form);
});
els.detailBody.addEventListener("input", (event) => {
  const compareRef = event.target.closest("[data-compare-ref]");
  if (compareRef && state.selectedTab === "compare") {
    updateComparePickerState();
    return;
  }
  const historyQueueField = event.target.closest("[data-history-queue-field]");
  if (historyQueueField) {
    updateHistoryQueueField(historyQueueField);
    return;
  }
  const filter = event.target.closest("[data-recovery-filter]");
  if (filter && state.selectedTab === "recovery") {
    updateRecoveryFilter(filter.dataset.recoveryFilter, filter.value, filter);
    return;
  }
  const policy = event.target.closest("[data-recovery-policy]");
  if (policy && (state.selectedTab === "recovery" || state.selectedTab === "settings")) {
    updateRecoveryPolicy(policy.dataset.recoveryPolicy, policy.value, policy);
  }
});
els.detailBody.addEventListener("keydown", (event) => {
  const compareRef = event.target.closest("[data-compare-ref]");
  if (!compareRef || state.selectedTab !== "compare" || event.key !== "Enter") return;
  event.preventDefault();
  runCompareFromPicker().catch((error) => toast(error.message));
});
els.detailBody.addEventListener("change", (event) => {
  const historyQueueMode = event.target.closest('select[data-history-queue-action="changeMode"]');
  if (historyQueueMode) {
    event.preventDefault();
    runHistoryRewriteQueue("changeMode", historyQueueMode).catch((error) => toast(error.message));
    return;
  }
  const filter = event.target.closest("[data-recovery-filter]");
  if (filter && state.selectedTab === "recovery") {
    updateRecoveryFilter(filter.dataset.recoveryFilter, filter.value, filter);
    return;
  }
  const policy = event.target.closest("[data-recovery-policy]");
  if (policy && (state.selectedTab === "recovery" || state.selectedTab === "settings")) {
    updateRecoveryPolicy(policy.dataset.recoveryPolicy, policy.value, policy);
  }
});
els.detailBody.addEventListener("click", (event) => {
  const branchCleanupAction = event.target.closest("[data-branch-cleanup-action]");
  if (branchCleanupAction) {
    event.preventDefault();
    if (!branchCleanupAction.disabled) {
      runBranchCleanupAction(branchCleanupAction.dataset.branchCleanupAction, branchCleanupAction).catch((error) => toast(error.message));
    }
    return;
  }
  const worktreeAction = event.target.closest("[data-worktree-action]");
  if (worktreeAction) {
    event.preventDefault();
    if (!worktreeAction.disabled) {
      runWorktreeAction(worktreeAction.dataset.worktreeAction, worktreeAction).catch((error) => toast(error.message));
    }
    return;
  }
  const submoduleAction = event.target.closest("[data-submodule-action]");
  if (submoduleAction) {
    event.preventDefault();
    if (!submoduleAction.disabled) {
      runSubmoduleAction(submoduleAction.dataset.submoduleAction, submoduleAction).catch((error) => toast(error.message));
    }
    return;
  }
  const compareRun = event.target.closest("[data-compare-run]");
  if (compareRun) {
    event.preventDefault();
    if (!compareRun.disabled) runCompareFromPicker().catch((error) => toast(error.message));
    return;
  }
  const compareSwap = event.target.closest("[data-compare-swap]");
  if (compareSwap) {
    event.preventDefault();
    if (!compareSwap.disabled) swapCompareRefs().catch((error) => toast(error.message));
    return;
  }
  const syncAction = event.target.closest("[data-sync-action]");
  if (syncAction) {
    event.preventDefault();
    if (!syncAction.disabled) runAction(syncAction.dataset.syncAction).catch((error) => toast(error.message));
    return;
  }
  const syncPrAction = event.target.closest("[data-sync-pr-action]");
  if (syncPrAction) {
    event.preventDefault();
    if (!syncPrAction.disabled) runSyncPullRequestAction(syncPrAction.dataset.syncPrAction).catch((error) => toast(error.message));
    return;
  }
  const remoteCommandCopy = event.target.closest("[data-copy-remote-command]");
  if (remoteCommandCopy) {
    event.preventDefault();
    copyText(remoteCommandCopy.dataset.copyRemoteCommand || "").then(() => toast("已复制诊断命令")).catch((error) => toast(error.message));
    return;
  }
  const remoteAction = event.target.closest("[data-remote-action]");
  if (remoteAction) {
    event.preventDefault();
    if (!remoteAction.disabled) {
      runRemoteAction(remoteAction.dataset.remoteAction, remoteAction.dataset.remoteName || "", remoteAction).catch((error) => toast(error.message));
    }
    return;
  }
  const upstreamAction = event.target.closest("[data-upstream-action]");
  if (upstreamAction) {
    event.preventDefault();
    if (!upstreamAction.disabled) {
      runUpstreamAction(upstreamAction.dataset.upstreamAction, "", upstreamAction).catch((error) => toast(error.message));
    }
    return;
  }
  const syncCommit = event.target.closest("[data-sync-commit]");
  if (syncCommit) {
    event.preventDefault();
    const sha = syncCommit.dataset.syncCommit;
    selectSyncCommit(sha).catch((error) => toast(error.message));
    return;
  }
  const compareRefresh = event.target.closest("[data-compare-refresh]");
  if (compareRefresh) {
    event.preventDefault();
    refreshCompare().catch((error) => toast(error.message));
    return;
  }
  const compareTarget = event.target.closest("[data-compare-view-target]");
  if (compareTarget) {
    event.preventDefault();
    const head = state.compare?.data?.head || state.compare?.head || "";
    if (head) {
      state.selectedTab = "details";
      selectRef(head).catch((error) => toast(error.message));
    }
    return;
  }
  const compareCommit = event.target.closest("[data-compare-commit]");
  if (compareCommit) {
    event.preventDefault();
    const sha = compareCommit.dataset.compareCommit || "";
    if (sha) {
      state.selectedTab = "details";
      selectCommit(sha).catch((error) => toast(error.message));
    }
    return;
  }
  const recoveryAction = event.target.closest("[data-recovery-action]");
  if (recoveryAction) {
    event.preventDefault();
    if (!recoveryAction.disabled) {
      runRecoveryAction(recoveryAction.dataset.recoveryAction, recoveryAction.dataset.recoveryRef || state.selectedRecoveryRef || "", recoveryAction).catch((error) => toast(error.message));
    }
    return;
  }
  const recoveryFilterReset = event.target.closest("[data-recovery-filter-reset]");
  if (recoveryFilterReset) {
    event.preventDefault();
    resetRecoveryFilter();
    return;
  }
  const recoveryPrune = event.target.closest("[data-recovery-prune]");
  if (recoveryPrune) {
    event.preventDefault();
    if (!recoveryPrune.disabled) pruneRecoveryPointsByPolicy(recoveryPrune).catch((error) => toast(error.message));
    return;
  }
  const recoveryBulkDelete = event.target.closest("[data-recovery-bulk-delete]");
  if (recoveryBulkDelete) {
    event.preventDefault();
    if (!recoveryBulkDelete.disabled) deleteFilteredRecoveryPoints(recoveryBulkDelete).catch((error) => toast(error.message));
    return;
  }
  const recoveryRow = event.target.closest(".recovery-row[data-recovery-ref]");
  if (recoveryRow) {
    event.preventDefault();
    selectRecoveryPoint(recoveryRow.dataset.recoveryRef || "");
    return;
  }
  const reflogAction = event.target.closest("[data-reflog-action]");
  if (reflogAction) {
    event.preventDefault();
    if (!reflogAction.disabled) {
      runReflogAction(reflogAction.dataset.reflogAction, reflogAction.dataset.reflogSelector || state.selectedReflogSelector || "", reflogAction).catch((error) => toast(error.message));
    }
    return;
  }
  const reflogRow = event.target.closest(".reflog-row[data-reflog-selector]");
  if (reflogRow) {
    event.preventDefault();
    selectReflogEntry(reflogRow.dataset.reflogSelector || "");
    return;
  }
  const logRefresh = event.target.closest("[data-log-refresh]");
  if (logRefresh) {
    event.preventDefault();
    refreshLogsTab().catch((error) => toast(error.message));
    return;
  }
  const settingsTheme = event.target.closest("[data-settings-theme]");
  if (settingsTheme) {
    event.preventDefault();
    const theme = normalizeTheme(settingsTheme.dataset.settingsTheme);
    if (theme) {
      applyTheme(theme);
      renderInspector();
    }
    return;
  }
  const settingsAction = event.target.closest("[data-settings-action]");
  if (settingsAction) {
    event.preventDefault();
    if (settingsAction.disabled) return;
    const action = settingsAction.dataset.settingsAction;
    if (action === "chooseRepo") {
      openFolderModal().catch((error) => toast(error.message));
      return;
    }
    if (action === "clearRecentRepos") {
      clearRecentRepos();
      if (state.selectedTab === "settings") renderInspector();
      return;
    }
    if (action === "resetLayout") {
      resetLayoutPreferences();
    }
    return;
  }
  const fileHistoryOpen = event.target.closest("[data-file-history-open]");
  if (fileHistoryOpen) {
    event.preventDefault();
    if (!fileHistoryOpen.disabled) {
      openFileHistory(fileHistoryOpen.dataset.file || "", fileHistoryOpen.dataset.ref || "").catch((error) => toast(error.message));
    }
    return;
  }
  const fileHistoryRefresh = event.target.closest("[data-file-history-refresh]");
  if (fileHistoryRefresh) {
    event.preventDefault();
    openFileHistory(state.fileHistory.file, state.fileHistory.ref).catch((error) => toast(error.message));
    return;
  }
  const fileHistoryAction = event.target.closest("[data-file-history-action]");
  if (fileHistoryAction) {
    event.preventDefault();
    runFileHistoryAction(fileHistoryAction.dataset.fileHistoryAction, fileHistoryAction).catch((error) => toast(error.message));
    return;
  }
  const fileBlameOpen = event.target.closest("[data-file-blame-open]");
  if (fileBlameOpen) {
    event.preventDefault();
    if (!fileBlameOpen.disabled) {
      openFileBlame(fileBlameOpen.dataset.file || "", fileBlameOpen.dataset.ref || "").catch((error) => toast(error.message));
    }
    return;
  }
  const fileBlameRefresh = event.target.closest("[data-file-blame-refresh]");
  if (fileBlameRefresh) {
    event.preventDefault();
    openFileBlame(state.fileBlame.file, state.fileBlame.ref).catch((error) => toast(error.message));
    return;
  }
  const fileBlameAction = event.target.closest("[data-file-blame-action]");
  if (fileBlameAction) {
    event.preventDefault();
    runFileBlameAction(fileBlameAction.dataset.fileBlameAction, fileBlameAction).catch((error) => toast(error.message));
    return;
  }
  const historyPlanAction = event.target.closest("[data-history-plan-action]");
  if (historyPlanAction) {
    event.preventDefault();
    if (!historyPlanAction.disabled) {
      runHistoryRewritePlan(historyPlanAction.dataset.historyPlanAction, historyPlanAction).catch((error) => toast(error.message));
    }
    return;
  }
  const historyQueueAction = event.target.closest("[data-history-queue-action]");
  if (historyQueueAction) {
    event.preventDefault();
    if (historyQueueAction.tagName === "SELECT") return;
    if (!historyQueueAction.disabled) {
      runHistoryRewriteQueue(historyQueueAction.dataset.historyQueueAction, historyQueueAction).catch((error) => toast(error.message));
    }
    return;
  }
  const button = event.target.closest("[data-commit-tool]");
  if (!button) return;
  event.preventDefault();
  if (button.disabled) return;
  runCommitToolAction(button.dataset.commitTool, button.dataset.sha).catch((error) => toast(error.message));
});
els.detailBody.addEventListener("contextmenu", (event) => {
  const cleanupRow = event.target.closest(".branch-cleanup-row[data-branch-name]");
  if (cleanupRow) {
    event.preventDefault();
    event.stopPropagation();
    const branch = cleanupRow.dataset.branchName || "";
    if (branch) showBranchContextMenu(event, branch, branchCleanupContextOptions(branch));
    return;
  }
  const remoteRow = event.target.closest(".remote-row[data-remote-name]");
  if (remoteRow) {
    event.preventDefault();
    event.stopPropagation();
    const remote = findRemote(remoteRow.dataset.remoteName || "");
    if (remote) showRemoteContextMenu(event, remote);
    return;
  }
  const reflogRow = event.target.closest(".reflog-row[data-reflog-selector]");
  if (reflogRow) {
    event.preventDefault();
    event.stopPropagation();
    const selector = reflogRow.dataset.reflogSelector || "";
    state.selectedReflogSelector = selector;
    renderInspector();
    const entry = findReflogEntry(selector);
    if (entry) showReflogContextMenu(event, entry);
    return;
  }
  const tagRow = event.target.closest(".tag-row[data-tag-name]");
  if (!tagRow) return;
  event.preventDefault();
  event.stopPropagation();
  const tag = (state.data?.tags || []).find((item) => item.name === tagRow.dataset.tagName);
  if (tag) {
    state.selectedTag = tag.name;
    renderInspector();
    showTagContextMenu(event, tag);
  }
});
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    switchInspectorTab(tab.dataset.tab);
  });
});
els.moreInspectorSelect?.addEventListener("change", () => {
  const tab = els.moreInspectorSelect.value;
  if (!tab) return;
  switchInspectorTab(tab);
});
document.addEventListener("click", (event) => {
  const commitMenuAction = event.target.closest("[data-commit-action]");
  if (commitMenuAction) {
    event.stopPropagation();
    if (!commitMenuAction.disabled) {
      runCommitContextAction(commitMenuAction.dataset.commitAction).catch((error) => toast(error.message));
    }
    return;
  }
  const branchMenuAction = event.target.closest("[data-branch-action]");
  if (branchMenuAction) {
    event.stopPropagation();
    if (!branchMenuAction.disabled) {
      runBranchContextAction(branchMenuAction.dataset.branchAction).catch((error) => toast(error.message));
    }
    return;
  }
  const fileMenuAction = event.target.closest("[data-file-action]");
  if (fileMenuAction) {
    event.stopPropagation();
    if (!fileMenuAction.disabled) {
      runFileContextAction(fileMenuAction.dataset.fileAction).catch((error) => toast(error.message));
    }
    return;
  }
  const tagMenuAction = event.target.closest("#tagContextMenu [data-tag-action]");
  if (tagMenuAction) {
    event.stopPropagation();
    const tagName = state.contextTag?.name || "";
    hideTagContextMenu();
    if (!tagMenuAction.disabled) {
      runTagAction(tagMenuAction.dataset.tagAction, tagName, tagMenuAction).catch((error) => toast(error.message));
    }
    return;
  }
  const remoteMenuAction = event.target.closest("#remoteContextMenu [data-remote-menu-action]");
  if (remoteMenuAction) {
    event.stopPropagation();
    if (!remoteMenuAction.disabled) {
      runRemoteMenuAction(remoteMenuAction.dataset.remoteMenuAction).catch((error) => toast(error.message));
    }
    return;
  }
  const reflogMenuAction = event.target.closest("#reflogContextMenu [data-reflog-menu-action]");
  if (reflogMenuAction) {
    event.stopPropagation();
    if (!reflogMenuAction.disabled) {
      runReflogMenuAction(reflogMenuAction.dataset.reflogMenuAction).catch((error) => toast(error.message));
    }
    return;
  }
  if (!event.target.closest("#commitContextMenu")) hideCommitContextMenu();
  if (!event.target.closest("#branchContextMenu")) hideBranchContextMenu();
  if (!event.target.closest("#fileContextMenu")) hideFileContextMenu();
  if (!event.target.closest("#tagContextMenu")) hideTagContextMenu();
  if (!event.target.closest("#remoteContextMenu")) hideRemoteContextMenu();
  if (!event.target.closest("#reflogContextMenu")) hideReflogContextMenu();
  const stashAction = event.target.closest("[data-stash-action]");
  if (stashAction) {
    event.stopPropagation();
    runStashAction(stashAction.dataset.stashAction, stashAction.dataset.stashRef || "", stashAction);
    return;
  }
  const stashRow = event.target.closest("[data-stash-ref]");
  if (stashRow && stashRow.classList.contains("stash-row")) {
    event.stopPropagation();
    selectStash(stashRow.dataset.stashRef || "");
    return;
  }
  const tagAction = event.target.closest("[data-tag-action]");
  if (tagAction) {
    event.stopPropagation();
    runTagAction(tagAction.dataset.tagAction, tagAction.dataset.tagName || state.selectedTag || "", tagAction).catch((error) => toast(error.message));
    return;
  }
  const tagRow = event.target.closest("[data-tag-name]");
  if (tagRow && tagRow.classList.contains("tag-row")) {
    event.stopPropagation();
    selectTag(tagRow.dataset.tagName || "");
    return;
  }
  const bulkAction = event.target.closest("[data-bulk-file-action]");
  if (bulkAction) {
    event.stopPropagation();
    runFileBatchAction(bulkAction.dataset.bulkFileAction, bulkAction.dataset.scope || "", bulkAction);
    return;
  }
  const repoOperation = event.target.closest("[data-repo-operation]");
  if (repoOperation) {
    event.stopPropagation();
    runRepoOperation(repoOperation.dataset.repoOperation, repoOperation);
    return;
  }
  const conflictChoice = event.target.closest("[data-conflict-choice]");
  if (conflictChoice) {
    event.stopPropagation();
    if (!conflictChoice.disabled) {
      runSingleFileAction(conflictChoice.dataset.conflictChoice, conflictChoice.dataset.file || "").catch((error) => toast(error.message));
    }
    return;
  }
  if (event.target.closest("[data-open-diff-modal]")) openDiffModal();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }
  if (event.key === "Escape" && els.commandPalette.classList.contains("show")) {
    closeCommandPalette();
    return;
  }
  if (event.key === "Escape" && els.diffModal.classList.contains("show")) closeDiffModal();
  if (event.key === "Escape" && els.cloneModal.classList.contains("show")) closeCloneModal();
  if (event.key === "Escape" && els.initModal.classList.contains("show")) closeInitModal();
  if (event.key === "Escape" && els.patchModal.classList.contains("show")) closePatchModal();
  if (event.key === "Escape" && els.folderModal.classList.contains("show")) closeFolderModal();
  if (event.key === "Escape" && els.branchModal.classList.contains("show")) closeBranchModal();
  if (event.key === "Escape" && els.tagModal.classList.contains("show")) closeTagModal();
  if (event.key === "Escape" && els.mainlineModal.classList.contains("show")) closeMainlineModal();
  if (event.key === "Escape" && els.commitContextMenu.classList.contains("show")) hideCommitContextMenu();
  if (event.key === "Escape" && els.branchContextMenu.classList.contains("show")) hideBranchContextMenu();
  if (event.key === "Escape" && els.fileContextMenu.classList.contains("show")) hideFileContextMenu();
  if (event.key === "Escape" && els.tagContextMenu.classList.contains("show")) hideTagContextMenu();
  if (event.key === "Escape" && els.remoteContextMenu.classList.contains("show")) hideRemoteContextMenu();
  if (event.key === "Escape" && els.reflogContextMenu.classList.contains("show")) hideReflogContextMenu();
});
document.addEventListener("scroll", () => {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  hideReflogContextMenu();
}, true);
window.addEventListener("resize", () => {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  hideReflogContextMenu();
});
