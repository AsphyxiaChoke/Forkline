// Starts Forkline after shared state, API helpers, and feature code are loaded.
let desktopRepositoryOpenReady = false;
let desktopRepositoryOpenBusy = false;
let pendingDesktopRepository = "";

async function flushDesktopRepositoryOpen() {
  if (!desktopRepositoryOpenReady || desktopRepositoryOpenBusy || !pendingDesktopRepository) return;
  desktopRepositoryOpenBusy = true;
  try {
    while (desktopRepositoryOpenReady && pendingDesktopRepository) {
      const repository = pendingDesktopRepository;
      pendingDesktopRepository = "";
      await openRepo(repository);
    }
  } finally {
    desktopRepositoryOpenBusy = false;
  }
}

function initDesktopRepositoryOpen() {
  const bridge = window.forklineDesktop;
  if (typeof bridge?.onOpenRepository !== "function") return;
  bridge.onOpenRepository((repository) => {
    const target = String(repository || "").trim();
    if (!target) return;
    pendingDesktopRepository = target;
    flushDesktopRepositoryOpen().catch((error) => toast(error.message));
  });
}

async function startForkline() {
  state.recoveryPolicy = defaultRecoveryPolicy();
  await initLocale();
  initTheme();
  initLayoutResizers();
  initCommandHints();
  initWorktreeAutoRefresh();
  updateAmendMode();
  await init();
  await restoreDesktopRecoveryDraft();
  desktopRepositoryOpenReady = true;
  await flushDesktopRepositoryOpen();
}

initDesktopRepositoryOpen();
window.Forkline.start = startForkline;
startForkline().catch((error) => toast(error.message));
