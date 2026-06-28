// Starts Forkline after shared state, API helpers, and feature code are loaded.
function startForkline() {
  state.recoveryPolicy = defaultRecoveryPolicy();
  initTheme();
  initLayoutResizers();
  initWorktreeAutoRefresh();
  updateAmendMode();
  init();
}

window.Forkline.start = startForkline;
startForkline();
