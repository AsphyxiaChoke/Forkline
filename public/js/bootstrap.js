// Starts Forkline after shared state, API helpers, and feature code are loaded.
let desktopRepositoryOpenReady = false;
let desktopRepositoryOpenBusy = false;
let pendingDesktopRepository = "";
let stopInstallerUpdateState = null;
let stopDesktopPreferenceFailures = null;
let stopStandaloneFileEditorOpen = null;
let stopStandaloneFileEditorClose = null;
let standaloneFileEditorReady = false;
let pendingStandaloneFileEditor = null;

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

function initDesktopInstallerUpdates() {
  const bridge = window.forklineDesktop;
  if (typeof bridge?.onInstallerUpdateState !== "function") return;
  stopInstallerUpdateState = bridge.onInstallerUpdateState(applyInstallerUpdateState);
  window.addEventListener("beforeunload", () => stopInstallerUpdateState?.(), { once: true });
}

function initDesktopPreferenceFailures() {
  const preferenceStorage = window.ForklinePreferenceStorage;
  if (typeof preferenceStorage?.onPersistenceFailure !== "function") return;
  stopDesktopPreferenceFailures = preferenceStorage.onPersistenceFailure(() => {
    toast(t("本机偏好保存失败，本次更改不会在重启后保留。"));
  });
  window.addEventListener("beforeunload", () => stopDesktopPreferenceFailures?.(), { once: true });
}

async function flushStandaloneFileEditor() {
  if (!standaloneFileEditorReady || !pendingStandaloneFileEditor || !state.data) return;
  const context = pendingStandaloneFileEditor;
  pendingStandaloneFileEditor = null;
  await openFileEditorLazy(
    context.file,
    context.previousFile,
    context.source === "commit" ? { source: "commit", commit: context.commit } : {}
  );
}

function initStandaloneFileEditor() {
  if (typeof isStandaloneFileEditorWindow !== "function" || !isStandaloneFileEditorWindow()) return;
  const bridge = window.forklineDesktop;
  if (typeof bridge?.onOpenFileEditor === "function") {
    stopStandaloneFileEditorOpen = bridge.onOpenFileEditor((context) => {
      pendingStandaloneFileEditor = context;
      flushStandaloneFileEditor().catch((error) => toast(error.message));
    });
  }
  if (typeof bridge?.onFileEditorCloseRequested === "function") {
    stopStandaloneFileEditorClose = bridge.onFileEditorCloseRequested(() => closeFileEditor());
  }
  window.addEventListener("beforeunload", () => {
    stopStandaloneFileEditorOpen?.();
    stopStandaloneFileEditorClose?.();
  }, { once: true });
}

async function startForkline() {
  initStandaloneFileEditor();
  await window.ForklinePreferenceStorage?.init?.();
  initializeUiDiagnostics();
  state.recoveryPolicy = defaultRecoveryPolicy();
  await initLocale();
  await initRecentRepoStorage();
  initTheme();
  initLayoutResizers();
  initCommandHints();
  initWorktreeAutoRefresh();
  updateAmendMode();
  await init();
  await restoreDesktopRecoveryDraft();
  standaloneFileEditorReady = true;
  await flushStandaloneFileEditor();
  desktopRepositoryOpenReady = true;
  await flushDesktopRepositoryOpen();
}

initDesktopRepositoryOpen();
initDesktopInstallerUpdates();
initDesktopPreferenceFailures();
window.Forkline.start = startForkline;
startForkline().catch((error) => toast(error.message));
