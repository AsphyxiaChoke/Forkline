// Starts Forkline after shared state, API helpers, and feature code are loaded.
async function startForkline() {
  state.recoveryPolicy = defaultRecoveryPolicy();
  await initLocale();
  initTheme();
  initLayoutResizers();
  initCommandHints();
  initWorktreeAutoRefresh();
  updateAmendMode();
  init();
}

window.Forkline.start = startForkline;
startForkline().catch((error) => toast(error.message));
