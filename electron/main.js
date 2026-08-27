const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require("electron");
const electronUpdater = require("electron-updater");
const { fork } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const {
  DEFAULT_ZOOM_FACTOR,
  normalizeZoomFactor,
  readZoomFactor,
  stepZoomFactor,
  writeZoomFactor,
} = require("./desktop-zoom");
const {
  isRendererReloadEnabled,
  watchRendererFiles,
} = require("./renderer-reloader");
const {
  readWindowState,
  writeWindowState,
} = require("./desktop-window-state");
const { createRendererHealthController } = require("./renderer-health");
const { createRendererDraftStore } = require("./renderer-draft-store");
const { createRepositoryOpenCoordinator } = require("./repository-open-coordinator");
const { reportElectronUpdateReady } = require("./self-update-health");
const { createInstallerUpdateController } = require("./installer-update-controller");
const { createForklineAutoUpdater } = require("./installer-update-accelerator");
const { shutdownServerProcess } = require("./server-process-shutdown");
const { findStartupRepository } = require("./startup-repository");
const {
  findLegacyRecentRepositoryOrigins,
  migrateLegacyRecentRepositories,
  readRecentRepositoryStore,
  writeRecentRepositoryStore,
} = require("./recent-repository-store");
const {
  DESKTOP_PREFERENCE_KEYS,
  migrateLegacyDesktopPreferences,
  readDesktopPreferenceStore,
  updateDesktopPreferenceStore,
} = require("./desktop-preference-store");
const {
  fileEditorWindowUrl,
  normalizeFileEditorRequest,
} = require("./file-editor-window");

const LOOPBACK_HOST = "127.0.0.1";
const SERVER_START_TIMEOUT_MS = 15000;
const ELECTRON_TITLEBAR_CSS_HEIGHT = 40;
const WINDOWS_TITLEBAR_COLOR = "#0b0f15";
const WINDOWS_TITLEBAR_SYMBOL_COLOR = "#edf3fb";
const WINDOW_STATE_SAVE_DELAY_MS = 250;
const ELECTRON_SELF_UPDATE_READY_MESSAGE = "forkline:self-update-ready";
const DESKTOP_ICON_PATH = path.join(__dirname, "assets", process.platform === "win32" ? "forkline-icon.ico" : "forkline-icon.png");

let mainWindow = null;
let serverProcess = null;
let serverUrl = "";
let quitting = false;
let quitReady = false;
let stopServerPromise = null;
let desktopZoomFactor = DEFAULT_ZOOM_FACTOR;
let stopRendererReload = null;
let desktopWindowState = { bounds: null, isMaximized: true };
let windowStateSaveTimer = null;
let rendererHealthController = null;
let rendererWasUnresponsive = false;
let rendererRecoveryRiskSignature = "";
let selfUpdateQuitRequested = false;
let installerUpdateController = null;
let recentRepositoryMigrationActive = false;
let fileEditorWindow = null;
let fileEditorWindowReady = false;
let fileEditorWindowCloseAllowed = false;
let pendingFileEditorWindowRequest = null;
const autoUpdater = process.platform === "win32" ? createForklineAutoUpdater() : electronUpdater.autoUpdater;
const rendererDraftStore = createRendererDraftStore();

const repositoryOpenCoordinator = createRepositoryOpenCoordinator({
  resolveRepository: findStartupRepository,
  deliver: (repository) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return false;
    mainWindow.webContents.send("forkline:open-repository", repository);
    return true;
  },
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    repositoryOpenCoordinator.request(argv, app.getAppPath());
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, LOOPBACK_HOST, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestJson(url, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : "";
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: options.method || "GET",
      headers: body ? {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      } : undefined,
    }, (response) => {
      let payload = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        payload += chunk;
      });
      response.on("end", () => {
        if ((response.statusCode || 500) >= 400) {
          reject(new Error(payload || `HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(payload ? JSON.parse(payload) : {});
        } catch {
          resolve(payload);
        }
      });
    });
    request.once("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Forkline 后台服务已退出，代码 ${child.exitCode}`);
    }
    try {
      await requestJson(`${url}/api/state?details=core`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw new Error(`Forkline 后台服务启动超时：${lastError?.message || "没有响应"}`);
}

async function startServer() {
  const port = await findAvailablePort();
  const appRoot = app.getAppPath();
  const serverPath = path.join(appRoot, "server.js");
  serverUrl = `http://${LOOPBACK_HOST}:${port}`;

  const child = fork(serverPath, [], {
    cwd: app.isPackaged ? path.dirname(process.execPath) : appRoot,
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      FORKLINE_NO_OPEN: "1",
      FORKLINE_RUNTIME_SHELL: "electron",
      FORKLINE_ELECTRON_PARENT_PID: String(process.pid),
      FORKLINE_ELECTRON_EXEC_PATH: process.execPath,
      FORKLINE_ELECTRON_APP_PATH: appRoot,
      FORKLINE_ELECTRON_PACKAGED: app.isPackaged ? "1" : "0",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  serverProcess = child;

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  child.on("message", (message) => {
    if (serverProcess !== child || message?.type !== ELECTRON_SELF_UPDATE_READY_MESSAGE) return;
    if (selfUpdateQuitRequested) return;
    selfUpdateQuitRequested = true;
    app.quit();
  });
  child.once("exit", (code, signal) => {
    const expected = quitting || code === 0 || signal === "SIGTERM";
    if (serverProcess === child) serverProcess = null;
    if (!expected && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("Forkline 后台服务已停止", `退出代码：${code ?? "-"}\n信号：${signal || "-"}`);
      mainWindow.close();
    }
  });

  await waitForServer(serverUrl, child);
  const repository = findStartupRepository(process.argv, app.getAppPath());
  if (repository) {
    try {
      await requestJson(`${serverUrl}/api/open`, {
        method: "POST",
        body: { path: repository, progressive: true },
      });
    } catch (error) {
      console.warn(`[Forkline desktop] 启动仓库预加载失败，将在页面中重试：${error?.message || error}`);
      repositoryOpenCoordinator.request(process.argv, app.getAppPath());
    }
  }
}

function stopServer(options = {}) {
  const child = serverProcess;
  if (!child) return Promise.resolve({ mode: "already-exited" });
  if (stopServerPromise) return stopServerPromise;
  stopServerPromise = shutdownServerProcess(child, options)
    .catch((error) => {
      console.warn(`[Forkline desktop] 后台服务关闭异常：${error?.message || error}`);
      return { mode: "error" };
    })
    .finally(() => {
      if (serverProcess === child && (child.exitCode !== null || child.signalCode !== null)) serverProcess = null;
      stopServerPromise = null;
    });
  return stopServerPromise;
}

function sendInstallerUpdateState(state) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send("forkline:installer-update:state", state);
}

async function ensureInstallerUpdateIdle() {
  const operations = await requestJson(`${serverUrl}/api/operations`);
  if (operations?.runningOperations?.length) {
    throw new Error("Forkline 还有操作正在执行，请等待完成后再更新。");
  }
}

async function prepareInstallerInstall() {
  await ensureInstallerUpdateIdle();
  quitting = true;
  closeFileEditorWindowForQuit();
  flushDesktopWindowState();
  const result = await stopServer({ allowForce: false });
  if (!["already-exited", "graceful"].includes(result.mode)) {
    quitting = false;
    throw new Error("Forkline 后台服务未能优雅停止，安装已取消。请关闭并重新打开 Forkline 后重试。");
  }
  rendererHealthController?.dispose();
  stopRendererReloadWatcher();
  quitReady = true;
}

function registerInstallerUpdates() {
  installerUpdateController = createInstallerUpdateController({
    updater: autoUpdater,
    supported: app.isPackaged && process.platform === "win32",
    currentVersion: app.getVersion(),
    prepareInstall: prepareInstallerInstall,
    onState: sendInstallerUpdateState,
  });
  ipcMain.handle("forkline:installer-update:get-state", (event) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return null;
    return installerUpdateController.getState();
  });
  ipcMain.handle("forkline:installer-update:check", (event) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return null;
    return installerUpdateController.checkForUpdates();
  });
  ipcMain.handle("forkline:installer-update:install", (event, version) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return null;
    return installerUpdateController.install(String(version || ""));
  });
}

function startRendererReload() {
  if (!isRendererReloadEnabled(process.argv, app.isPackaged)) return;
  try {
    stopRendererReload = watchRendererFiles(app.getAppPath(), (changedFile) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.reloadIgnoringCache();
      console.log(`[Forkline desktop] 页面已热刷新${changedFile ? `：${changedFile}` : ""}`);
    });
    console.log("[Forkline desktop] 已启用 public 页面热刷新");
  } catch (error) {
    console.warn(`[Forkline desktop] 无法启用页面热刷新：${error.message}`);
  }
}

function stopRendererReloadWatcher() {
  if (!stopRendererReload) return;
  stopRendererReload();
  stopRendererReload = null;
}

function attachRendererHealth(window) {
  const webContents = window.webContents;
  rendererHealthController = createRendererHealthController({
    showDialog: (options) => dialog.showMessageBox(window, options),
    clearRecoveryDraft: () => rendererDraftStore.clear(),
    reload: () => {
      if (!window.isDestroyed()) webContents.reloadIgnoringCache();
    },
    close: () => {
      if (!window.isDestroyed()) window.close();
    },
  });
  webContents.on("unresponsive", () => {
    if (quitting) return;
    rendererWasUnresponsive = true;
    console.warn("[Forkline desktop] 页面暂时无响应，正在等待恢复");
    rendererHealthController?.handleUnresponsive();
  });
  webContents.on("responsive", () => {
    if (rendererWasUnresponsive) console.log("[Forkline desktop] 页面已恢复响应");
    rendererWasUnresponsive = false;
    rendererHealthController?.handleResponsive();
  });
  webContents.on("render-process-gone", (_event, details) => {
    if (quitting || details?.reason === "clean-exit") return;
    rendererWasUnresponsive = false;
    console.error(`[Forkline desktop] 页面进程已停止：${details?.reason || "unknown"}，退出代码 ${details?.exitCode ?? "-"}`);
    void rendererHealthController?.handleRenderProcessGone(details);
  });
  webContents.on("did-start-loading", () => {
    repositoryOpenCoordinator.setRendererReady(false);
  });
  webContents.on("did-finish-load", () => {
    rendererHealthController?.handleResponsive();
    repositoryOpenCoordinator.setRendererReady(true);
  });
}

function registerRendererRecoveryState() {
  ipcMain.on("forkline:desktop-recovery-state", (event, value) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
    const riskSignature = `${Boolean(value?.fileEditorDirty)}:${Boolean(value?.commitDraftDirty)}`;
    if (riskSignature !== rendererRecoveryRiskSignature) {
      rendererRecoveryRiskSignature = riskSignature;
      console.log(`[Forkline desktop] 未保存内容保护：文件编辑器${value?.fileEditorDirty ? "有修改" : "干净"}，提交草稿${value?.commitDraftDirty ? "有内容" : "为空"}`);
    }
    rendererHealthController?.updateRecoveryState(value);
  });
  ipcMain.handle("forkline:desktop-recovery-draft:save", (event, value) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
    return rendererDraftStore.write(value);
  });
  ipcMain.handle("forkline:desktop-recovery-draft:read", (event) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return null;
    return rendererDraftStore.read();
  });
}

function registerDesktopTitleBarTheme() {
  ipcMain.on("forkline:desktop-titlebar-theme", (event, value) => {
    const target = event.sender === mainWindow?.webContents
      ? mainWindow
      : event.sender === fileEditorWindow?.webContents
        ? fileEditorWindow
        : null;
    if (!target || target.isDestroyed()) return;
    if (process.platform !== "win32" || typeof target.setTitleBarOverlay !== "function") return;
    const color = normalizeTitleBarColor(value?.color, WINDOWS_TITLEBAR_COLOR);
    const symbolColor = normalizeTitleBarColor(value?.symbolColor, WINDOWS_TITLEBAR_SYMBOL_COLOR);
    target.setTitleBarOverlay({
      color,
      symbolColor,
      height: ELECTRON_TITLEBAR_CSS_HEIGHT,
    });
  });
}

function registerFileEditorWindow() {
  ipcMain.handle("forkline:file-editor:open", (event, value) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
    return openFileEditorWindow(value);
  });
  ipcMain.handle("forkline:file-editor:close", (event) => {
    if (!fileEditorWindow || fileEditorWindow.isDestroyed() || event.sender !== fileEditorWindow.webContents) return false;
    fileEditorWindowCloseAllowed = true;
    fileEditorWindow.close();
    return true;
  });
}

function normalizeTitleBarColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function isInternalUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === serverUrl;
  } catch {
    return false;
  }
}

function desktopWindowChromeOptions() {
  return process.platform === "win32" ? {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: WINDOWS_TITLEBAR_COLOR,
      symbolColor: WINDOWS_TITLEBAR_SYMBOL_COLOR,
      height: ELECTRON_TITLEBAR_CSS_HEIGHT,
    },
  } : {};
}

function configureExternalNavigation(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) && !isInternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
}

function closeFileEditorWindowForQuit() {
  if (!fileEditorWindow || fileEditorWindow.isDestroyed()) return;
  fileEditorWindowCloseAllowed = true;
  fileEditorWindow.close();
}

function sendPendingFileEditorWindowRequest() {
  if (!pendingFileEditorWindowRequest || !fileEditorWindowReady) return;
  if (!fileEditorWindow || fileEditorWindow.isDestroyed() || fileEditorWindow.webContents.isDestroyed()) return;
  fileEditorWindow.webContents.send("forkline:file-editor:open-context", pendingFileEditorWindowRequest);
  pendingFileEditorWindowRequest = null;
}

function createFileEditorWindow(request) {
  const editorWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 800,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0e1117",
    title: "Forkline 编辑器",
    icon: DESKTOP_ICON_PATH,
    parent: mainWindow,
    ...desktopWindowChromeOptions(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  fileEditorWindow = editorWindow;
  fileEditorWindowReady = false;
  fileEditorWindowCloseAllowed = false;
  configureExternalNavigation(editorWindow);
  editorWindow.webContents.setZoomFactor(desktopZoomFactor);
  editorWindow.webContents.on("before-input-event", (event, input) => {
    if (handleDesktopZoomShortcut(event, input)) return;
    if (input.key === "F12" && !process.argv.includes("--devtools")) event.preventDefault();
  });
  editorWindow.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    dialog.showErrorBox("Forkline 编辑器加载失败", `${description}\n${url}`);
  });
  editorWindow.webContents.on("did-finish-load", () => {
    fileEditorWindowReady = true;
    sendPendingFileEditorWindowRequest();
  });
  editorWindow.once("ready-to-show", () => editorWindow.show());
  editorWindow.on("close", (event) => {
    if (quitting || fileEditorWindowCloseAllowed) return;
    event.preventDefault();
    if (!editorWindow.webContents.isDestroyed()) editorWindow.webContents.send("forkline:file-editor:close-requested");
  });
  editorWindow.on("closed", () => {
    if (fileEditorWindow === editorWindow) fileEditorWindow = null;
    fileEditorWindowReady = false;
    fileEditorWindowCloseAllowed = false;
    pendingFileEditorWindowRequest = null;
  });
  const url = fileEditorWindowUrl(serverUrl, request);
  if (!url) {
    editorWindow.destroy();
    return false;
  }
  void editorWindow.loadURL(url);
  return true;
}

function openFileEditorWindow(request) {
  const normalized = normalizeFileEditorRequest(request);
  if (!normalized || !serverUrl || !mainWindow || mainWindow.isDestroyed()) return false;
  if (fileEditorWindow && !fileEditorWindow.isDestroyed()) {
    pendingFileEditorWindowRequest = normalized;
    if (fileEditorWindow.isMinimized()) fileEditorWindow.restore();
    fileEditorWindow.show();
    fileEditorWindow.focus();
    sendPendingFileEditorWindowRequest();
    return true;
  }
  return createFileEditorWindow(normalized);
}

function desktopZoomPreferencePath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function desktopWindowStatePath() {
  return path.join(app.getPath("userData"), "desktop-window-state.json");
}

function desktopRecentRepositoryPath() {
  return path.join(app.getPath("userData"), "desktop-recent-repositories.json");
}

function desktopPreferenceStorePath() {
  return path.join(app.getPath("userData"), "desktop-ui-preferences.json");
}

function registerDesktopPreferences() {
  ipcMain.handle("forkline:desktop-preferences:read", (event) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return {};
    return readDesktopPreferenceStore(desktopPreferenceStorePath()).preferences;
  });
  ipcMain.handle("forkline:desktop-preferences:write", (event, key, value) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
    return updateDesktopPreferenceStore(desktopPreferenceStorePath(), String(key || ""), value);
  });
  ipcMain.handle("forkline:desktop-preferences:remove", (event, key) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
    return updateDesktopPreferenceStore(desktopPreferenceStorePath(), String(key || ""), null);
  });
}

function legacyLocalStoragePath() {
  return path.join(app.getPath("userData"), "Local Storage", "leveldb");
}

function registerDesktopRecentRepositories() {
  ipcMain.handle("forkline:desktop-recent-repositories:read", (event) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return [];
    return readRecentRepositoryStore(desktopRecentRepositoryPath()).records;
  });
  ipcMain.handle("forkline:desktop-recent-repositories:write", (event, value) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return [];
    return writeRecentRepositoryStore(desktopRecentRepositoryPath(), value);
  });
}

async function readLegacyLocalStorage(window, origin, expression) {
  const port = Number(new URL(origin).port);
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end("<!doctype html><title>Forkline migration</title>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK_HOST, resolve);
  });
  try {
    await window.loadURL(`${origin}/`);
    return await window.webContents.executeJavaScript(expression);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function readLegacyRecentRepositories(window, origin) {
  const value = await readLegacyLocalStorage(window, origin, 'localStorage.getItem("forkline-recent-repos")');
  return value ? JSON.parse(value) : [];
}

async function readLegacyDesktopPreferenceSnapshot(window, origin) {
  const value = await readLegacyLocalStorage(window, origin, `(() => {
    const preferences = {};
    for (const key of ${JSON.stringify(DESKTOP_PREFERENCE_KEYS)}) {
      const stored = localStorage.getItem(key);
      if (stored !== null) preferences[key] = stored;
    }
    return { preferences, recentRepositories: localStorage.getItem("forkline-recent-repos") };
  })()`);
  let recentRepositories = [];
  try {
    const parsed = JSON.parse(value?.recentRepositories || "[]");
    if (Array.isArray(parsed)) recentRepositories = parsed;
  } catch {
  }
  return { preferences: value?.preferences || {}, recentRepositories };
}

async function migrateDesktopRecentRepositories() {
  let migrationWindow = null;
  recentRepositoryMigrationActive = true;
  try {
    const result = await migrateLegacyRecentRepositories({
      filePath: desktopRecentRepositoryPath(),
      leveldbPath: legacyLocalStoragePath(),
      readOriginRecords: async (origin) => {
        migrationWindow ||= new BrowserWindow({
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        return readLegacyRecentRepositories(migrationWindow, origin);
      },
    });
    if (result.migrated) {
      console.log(`[Forkline desktop] 已迁移 ${result.records.length} 条最近仓库记录`);
    }
  } catch (error) {
    console.warn(`[Forkline desktop] 无法迁移最近仓库记录：${error.message}`);
  } finally {
    if (migrationWindow && !migrationWindow.isDestroyed()) migrationWindow.destroy();
  }
}

async function migrateDesktopPreferences() {
  let migrationWindow = null;
  try {
    const result = await migrateLegacyDesktopPreferences({
      filePath: desktopPreferenceStorePath(),
      origins: findLegacyRecentRepositoryOrigins(legacyLocalStoragePath()),
      readOriginSnapshot: async (origin) => {
        migrationWindow ||= new BrowserWindow({
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        return readLegacyDesktopPreferenceSnapshot(migrationWindow, origin);
      },
    });
    if (result.migrated) {
      const selected = result.selectedOrigin ? `，来源 ${result.selectedOrigin}` : "";
      console.log(`[Forkline desktop] 已迁移 ${Object.keys(result.preferences).length} 项界面偏好${selected}`);
    }
  } catch (error) {
    console.warn(`[Forkline desktop] 无法迁移界面偏好：${error.message}`);
  } finally {
    if (migrationWindow && !migrationWindow.isDestroyed()) migrationWindow.destroy();
  }
}

function saveDesktopWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  desktopWindowState = {
    bounds: mainWindow.getNormalBounds(),
    isMaximized: mainWindow.isMinimized()
      ? desktopWindowState.isMaximized
      : mainWindow.isMaximized(),
  };
  try {
    writeWindowState(desktopWindowStatePath(), desktopWindowState);
  } catch (error) {
    console.warn(`[Forkline desktop] 无法保存窗口位置：${error.message}`);
  }
}

function scheduleDesktopWindowStateSave() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    desktopWindowState = {
      bounds: mainWindow.getNormalBounds(),
      isMaximized: mainWindow.isMinimized()
        ? desktopWindowState.isMaximized
        : mainWindow.isMaximized(),
    };
  }
  if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    saveDesktopWindowState();
  }, WINDOW_STATE_SAVE_DELAY_MS);
}

function flushDesktopWindowState() {
  if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = null;
  saveDesktopWindowState();
}

function applyDesktopZoom(value, persist = true) {
  desktopZoomFactor = normalizeZoomFactor(value);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(desktopZoomFactor);
  }
  if (fileEditorWindow && !fileEditorWindow.isDestroyed()) {
    fileEditorWindow.webContents.setZoomFactor(desktopZoomFactor);
  }
  if (persist) {
    try {
      writeZoomFactor(desktopZoomPreferencePath(), desktopZoomFactor);
    } catch (error) {
      console.warn(`Unable to save desktop zoom: ${error.message}`);
    }
  }
  return desktopZoomFactor;
}

function registerDesktopZoom() {
  desktopZoomFactor = readZoomFactor(desktopZoomPreferencePath());
  ipcMain.handle("forkline:desktop-zoom:get", () => desktopZoomFactor);
  ipcMain.handle("forkline:desktop-zoom:set", (_event, value) => applyDesktopZoom(value));
}

function handleDesktopZoomShortcut(event, input) {
  if (input.type !== "keyDown") return false;
  const primaryModifier = process.platform === "darwin" ? input.meta : input.control;
  if (!primaryModifier || input.alt) return false;
  const key = String(input.key || "").toLowerCase();
  if (["-", "subtract"].includes(key)) {
    event.preventDefault();
    applyDesktopZoom(stepZoomFactor(desktopZoomFactor, -1));
    return true;
  }
  if (["=", "+", "add"].includes(key)) {
    event.preventDefault();
    applyDesktopZoom(stepZoomFactor(desktopZoomFactor, 1));
    return true;
  }
  if (key === "0") {
    event.preventDefault();
    applyDesktopZoom(DEFAULT_ZOOM_FACTOR);
    return true;
  }
  return false;
}

function createWindow() {
  desktopWindowState = readWindowState(desktopWindowStatePath(), screen.getAllDisplays());
  const initialBounds = desktopWindowState.bounds || { width: 1450, height: 900 };

  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 800,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0e1117",
    title: "Forkline",
    icon: DESKTOP_ICON_PATH,
    ...desktopWindowChromeOptions(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  attachRendererHealth(mainWindow);
  mainWindow.webContents.setZoomFactor(desktopZoomFactor);
  configureExternalNavigation(mainWindow);
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (handleDesktopZoomShortcut(event, input)) return;
    if (input.key === "F12" && !process.argv.includes("--devtools")) event.preventDefault();
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    dialog.showErrorBox("Forkline 页面加载失败", `${description}\n${url}`);
  });
  mainWindow.once("ready-to-show", () => {
    if (desktopWindowState.isMaximized) mainWindow.maximize();
    mainWindow.show();
    reportElectronUpdateReady();
    void installerUpdateController?.checkForUpdates();
  });
  mainWindow.on("move", scheduleDesktopWindowStateSave);
  mainWindow.on("resize", scheduleDesktopWindowStateSave);
  mainWindow.on("maximize", scheduleDesktopWindowStateSave);
  mainWindow.on("unmaximize", scheduleDesktopWindowStateSave);
  mainWindow.on("close", flushDesktopWindowState);
  mainWindow.on("closed", () => {
    if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
    rendererHealthController?.dispose();
    rendererHealthController = null;
    rendererWasUnresponsive = false;
    rendererRecoveryRiskSignature = "";
    repositoryOpenCoordinator.setRendererReady(false);
    mainWindow = null;
  });
  void mainWindow.loadURL(serverUrl);
}

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    try {
      registerDesktopZoom();
      registerDesktopTitleBarTheme();
      registerRendererRecoveryState();
      registerDesktopPreferences();
      registerDesktopRecentRepositories();
      registerFileEditorWindow();
      registerInstallerUpdates();
      await migrateDesktopRecentRepositories();
      await migrateDesktopPreferences();
      await startServer();
      createWindow();
      recentRepositoryMigrationActive = false;
      startRendererReload();
    } catch (error) {
      dialog.showErrorBox("Forkline Electron 启动失败", error?.stack || error?.message || String(error));
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (recentRepositoryMigrationActive) return;
    app.quit();
  });
  app.on("before-quit", (event) => {
    if (quitReady) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    closeFileEditorWindowForQuit();
    flushDesktopWindowState();
    rendererHealthController?.dispose();
    stopRendererReloadWatcher();
    void stopServer().finally(() => {
      quitReady = true;
      app.quit();
    });
  });
}
