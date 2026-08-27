const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  DEFAULT_ZOOM_FACTOR,
  normalizeZoomFactor,
  readZoomFactor,
  stepZoomFactor,
  writeZoomFactor,
} = require("../electron/desktop-zoom");
const {
  isRendererReloadEnabled,
  watchRendererFiles,
} = require("../electron/renderer-reloader");
const { findStartupRepository } = require("../electron/startup-repository");
const {
  normalizeWindowState,
  readWindowState,
  writeWindowState,
} = require("../electron/desktop-window-state");
const {
  createRendererHealthController,
  normalizeRendererRecoveryState,
  rendererGoneDialogOptions,
  unresponsiveDialogOptions,
} = require("../electron/renderer-health");
const {
  MAX_RENDERER_DRAFT_BYTES,
  createRendererDraftStore,
  normalizeRendererDraft,
} = require("../electron/renderer-draft-store");
const { createRepositoryOpenCoordinator } = require("../electron/repository-open-coordinator");
const { reportElectronUpdateReady } = require("../electron/self-update-health");
const { createInstallerUpdateController } = require("../electron/installer-update-controller");
const { shutdownServerProcess } = require("../electron/server-process-shutdown");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Electron reuses the web app behind an isolated desktop shell", () => {
  const pkg = JSON.parse(read("package.json"));
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");

  assert.equal(pkg.main, "electron/main.js");
  assert.equal(pkg.scripts.desktop, "electron .");
  assert.equal(pkg.scripts["desktop:dev"], "electron . --watch-renderer");
  assert.match(pkg.devDependencies.electron, /^\^?\d+\.\d+\.\d+$/);
  assert.match(main, /ELECTRON_RUN_AS_NODE:\s*"1"/);
  assert.match(main, /FORKLINE_NO_OPEN:\s*"1"/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /shutdownServerProcess/);
  assert.match(main, /启动仓库预加载失败，将在页面中重试/);
  assert.match(main, /repositoryOpenCoordinator\.request\(process\.argv, app\.getAppPath\(\)\)/);
  assert.match(main, /event\.preventDefault\(\)/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(preload, /dataset\.shell\s*=\s*"electron"/);
});

test("Electron opens file editors in a separate restricted child window", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const bootstrap = read("public/js/bootstrap.js");
  const init = read("public/js/app/init.js");

  assert.match(main, /fileEditorWindow/);
  assert.match(main, /forkline:file-editor:open/);
  assert.match(main, /new BrowserWindow\(\{[\s\S]*parent:\s*mainWindow/);
  assert.match(main, /event\.sender !== mainWindow\.webContents/);
  assert.match(main, /forkline:file-editor:close/);
  assert.match(preload, /openFileEditorWindow/);
  assert.match(preload, /closeFileEditorWindow/);
  assert.match(preload, /onOpenFileEditor/);
  assert.match(preload, /onFileEditorCloseRequested/);
  assert.match(bootstrap, /isStandaloneFileEditorWindow/);
  assert.match(bootstrap, /onOpenFileEditor/);
  assert.match(init, /standaloneFileEditorContext/);
  assert.match(init, /openFileEditorLazy\(/);
});

test("Electron exposes only fixed installer-update IPC and preserves source updates", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const init = read("public/js/app/init.js");
  const settings = read("public/js/panels/settings.js");

  assert.equal(typeof createInstallerUpdateController, "function");
  assert.match(main, /createForklineAutoUpdater/);
  assert.match(main, /supported:\s*app\.isPackaged && process\.platform === "win32"/);
  assert.match(main, /prepareInstall:\s*prepareInstallerInstall/);
  assert.match(main, /requestJson\(`\$\{serverUrl\}\/api\/operations`\)[\s\S]*?runningOperations\?\.length[\s\S]*?Forkline 还有操作正在执行，请等待完成后再更新。/);
  assert.match(main, /await ensureInstallerUpdateIdle\(\)[\s\S]*?quitting = true[\s\S]*?const result = await stopServer\(\{ allowForce: false \}\)[\s\S]*?\["already-exited", "graceful"\][\s\S]*?rendererHealthController\?\.dispose\(\)[\s\S]*?quitReady = true/);
  assert.match(main, /forkline:installer-update:get-state/);
  assert.match(main, /forkline:installer-update:check/);
  assert.match(main, /forkline:installer-update:install/);
  assert.match(preload, /getInstallerUpdateState/);
  assert.match(preload, /checkInstallerUpdate/);
  assert.match(preload, /installInstallerUpdate/);
  assert.match(preload, /onInstallerUpdateState/);
  assert.doesNotMatch(preload, /ipcRenderer\.invoke\([^"']/);
  assert.match(init, /const installerUpdate = await checkForInstallerUpdate\(\)/);
  assert.match(init, /const update = installerUpdate \|\| await api\("\/api\/app-update"\)/);
  assert.match(settings, /update\.installMode === "nsis"/);
  assert.match(settings, /api\("\/api\/app-update\/install"/);
});

test("Electron keeps recent repositories outside random-port browser storage", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const repositories = read("public/js/features/repositories.js");
  const bootstrap = read("public/js/bootstrap.js");

  assert.match(main, /desktop-recent-repositories\.json/);
  assert.match(main, /forkline:desktop-recent-repositories:read/);
  assert.match(main, /forkline:desktop-recent-repositories:write/);
  assert.match(main, /event\.sender !== mainWindow\.webContents/);
  assert.match(main, /migrateDesktopRecentRepositories/);
  assert.match(main, /recentRepositoryMigrationActive = true/);
  assert.match(main, /if \(recentRepositoryMigrationActive\) return;[\s\S]*app\.quit\(\)/);
  assert.match(main, /createWindow\(\);[\s\S]*recentRepositoryMigrationActive = false/);
  assert.match(preload, /readRecentRepositories/);
  assert.match(preload, /writeRecentRepositories/);
  assert.doesNotMatch(preload, /ipcRenderer\.invoke\([^"']/);
  assert.match(repositories, /desktopRecentRepoRecords/);
  assert.match(repositories, /window\.forklineDesktop\?\.readRecentRepositories/);
  assert.match(bootstrap, /await initRecentRepoStorage\(\)[\s\S]*await init\(\)/);
});

test("Electron keeps UI preferences outside random-port browser storage", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const bootstrap = read("public/js/bootstrap.js");

  assert.match(main, /desktop-ui-preferences\.json/);
  assert.match(main, /forkline:desktop-preferences:read/);
  assert.match(main, /forkline:desktop-preferences:write/);
  assert.match(main, /forkline:desktop-preferences:remove/);
  assert.match(main, /migrateDesktopPreferences/);
  assert.match(main, /event\.sender !== mainWindow\.webContents/);
  assert.match(preload, /readPreferences/);
  assert.match(preload, /writePreference/);
  assert.match(preload, /removePreference/);
  assert.doesNotMatch(preload, /ipcRenderer\.invoke\([^"']/);
  assert.match(bootstrap, /await window\.ForklinePreferenceStorage\?\.init\?\.\(\)[\s\S]*initLocale\(\)[\s\S]*initTheme\(\)/);
});

test("Electron uses the Forkline brand mark for its desktop icon", () => {
  const main = read("electron/main.js");
  const styles = read("public/styles.css");
  const svg = read("electron/assets/forkline-icon.svg");
  const png = fs.readFileSync(path.join(root, "electron/assets/forkline-icon.png"));
  const ico = fs.readFileSync(path.join(root, "electron/assets/forkline-icon.ico"));
  const html = read("public/index.html");
  const favicon = read("public/favicon.svg");

  assert.match(main, /const DESKTOP_ICON_PATH = path\.join\(__dirname, "assets", process\.platform === "win32" \? "forkline-icon\.ico" : "forkline-icon\.png"\)/);
  assert.match(main, /icon:\s*DESKTOP_ICON_PATH/);
  assert.equal((svg.match(/<circle\b/g) || []).length, 3);
  assert.equal((svg.match(/<path\b/g) || []).length, 2);
  assert.match(styles, /\.brand-mark::before\s*\{[\s\S]*clip-path:\s*polygon/);
  const brandNodeBlocks = Array.from(styles.matchAll(/\.brand-mark::after\s*\{([\s\S]*?)\r?\n\}/g));
  const brandNodes = brandNodeBlocks.at(-1)?.[1] || "";
  assert.equal((brandNodes.match(/radial-gradient\(/g) || []).length, 3);
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 9);
  assert.match(html, /<link rel="icon" href="\.\/favicon\.svg" type="image\/svg\+xml" \/>/);
  assert.match(favicon, /aria-label="Forkline"/);
  assert.deepEqual(Array.from({ length: 9 }, (_, index) => {
    const size = ico[6 + (index * 16)];
    return size || 256;
  }), [16, 20, 24, 32, 40, 48, 64, 128, 256]);
});

test("Electron asks the server to stop gracefully before using the owned-process fallback", async () => {
  const child = new (require("node:events").EventEmitter)();
  const messages = [];
  let fallbacks = 0;
  child.pid = 6100;
  child.exitCode = null;
  child.signalCode = null;
  child.connected = true;
  child.send = (message) => {
    messages.push(message);
    queueMicrotask(() => {
      child.exitCode = 0;
      child.emit("exit", 0, null);
    });
    return true;
  };

  const result = await shutdownServerProcess(child, {
    gracefulTimeoutMs: 30,
    terminateProcess: async () => { fallbacks += 1; },
  });

  assert.deepEqual(messages, [{ type: "forkline:shutdown" }]);
  assert.equal(fallbacks, 0);
  assert.equal(result.mode, "graceful");
});

test("Electron passes supervised update metadata and exits only after the updater is ready", () => {
  const main = read("electron/main.js");
  const server = read("server.js");
  assert.match(main, /FORKLINE_RUNTIME_SHELL:\s*"electron"/);
  assert.match(main, /FORKLINE_ELECTRON_PARENT_PID/);
  assert.match(main, /forkline:self-update-ready/);
  assert.match(main, /reportElectronUpdateReady/);
  assert.match(server, /restartMode:\s*"electron"/);
  assert.match(server, /forkline:self-update-ready/);
});

test("Electron reports a supervised update healthy only through a bounded temp marker", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-electron-update-test-"));
  const healthFile = path.join(tempRoot, "forkline-electron-update-health.json");
  try {
    assert.equal(reportElectronUpdateReady({
      FORKLINE_ELECTRON_UPDATE_HEALTH_FILE: healthFile,
      FORKLINE_ELECTRON_UPDATE_TARGET_VERSION: "0.4.0",
    }, { pid: 7300 }), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(healthFile, "utf8")), {
      ready: true,
      targetVersion: "0.4.0",
      pid: 7300,
    });
    assert.equal(reportElectronUpdateReady({
      FORKLINE_ELECTRON_UPDATE_HEALTH_FILE: path.join(root, "not-temp.json"),
      FORKLINE_ELECTRON_UPDATE_TARGET_VERSION: "0.4.0",
    }), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Electron falls back only to its owned server process when graceful shutdown stalls", async () => {
  const child = new (require("node:events").EventEmitter)();
  const terminated = [];
  child.pid = 6200;
  child.exitCode = null;
  child.signalCode = null;
  child.connected = true;
  child.send = () => true;

  const result = await shutdownServerProcess(child, {
    gracefulTimeoutMs: 5,
    forceTimeoutMs: 20,
    async terminateProcess(target) {
      terminated.push(target.pid);
      target.exitCode = 0;
      target.emit("exit", 0, null);
    },
  });

  assert.deepEqual(terminated, [6200]);
  assert.equal(result.mode, "terminated");
});

test("installer shutdown never force-kills the server when graceful shutdown times out", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.connected = true;
  child.send = () => {};
  let terminateCalls = 0;
  let killCalls = 0;
  child.kill = () => { killCalls += 1; };

  const result = await shutdownServerProcess(child, {
    allowForce: false,
    gracefulTimeoutMs: 5,
    forceTimeoutMs: 5,
    terminateProcess: async () => { terminateCalls += 1; },
  });

  assert.deepEqual(result, { mode: "timeout" });
  assert.equal(terminateCalls, 0);
  assert.equal(killCalls, 0);
  assert.equal(child.exitCode, null);
  assert.equal(child.signalCode, null);
});

test("Electron enables renderer reload only for the unpackaged development command", () => {
  assert.equal(isRendererReloadEnabled(["electron", ".", "--watch-renderer"], false), true);
  assert.equal(isRendererReloadEnabled(["electron", "."], false), false);
  assert.equal(isRendererReloadEnabled(["Forkline.exe", "--watch-renderer"], true), false);
});

test("Electron renderer reload batches public file changes without recreating the watcher", async () => {
  let listener = null;
  let watchedDirectory = "";
  let watchedOptions = null;
  let closed = false;
  const reloadedFiles = [];
  const stop = watchRendererFiles(root, (filename) => reloadedFiles.push(filename), {
    debounceMs: 10,
    watch(directory, options, callback) {
      watchedDirectory = directory;
      watchedOptions = options;
      listener = callback;
      return { close: () => { closed = true; } };
    },
  });

  assert.equal(watchedDirectory, path.join(root, "public"));
  assert.deepEqual(watchedOptions, { recursive: true });
  listener("change", "styles.css");
  listener("change", path.join("js", "app.js"));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(reloadedFiles, [path.join("js", "app.js")]);

  stop();
  assert.equal(closed, true);
  listener("change", "index.html");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(reloadedFiles.length, 1);
});

test("Electron places native window controls in a dedicated title bar", () => {
  const main = read("electron/main.js");
  const styles = read("public/styles.css");
  assert.match(main, /ELECTRON_TITLEBAR_CSS_HEIGHT\s*=\s*40/);
  assert.match(main, /height:\s*ELECTRON_TITLEBAR_CSS_HEIGHT/);
  assert.doesNotMatch(main, /titleBarOverlayHeight/);
  assert.match(styles, /--electron-titlebar-h:\s*env\(titlebar-area-height,\s*40px\)/);
  assert.match(styles, /html\[data-shell="electron"\] \.app-shell[\s\S]*grid-template-rows:\s*var\(--electron-titlebar-h\) var\(--header-h\) minmax\(0, 1fr\)/);
  assert.match(styles, /html\[data-shell="electron"\] \.app-shell::before[\s\S]*-webkit-app-region:\s*drag/);
  assert.match(styles, /html\[data-shell="electron"\] \.topbar[\s\S]*grid-row:\s*2[\s\S]*-webkit-app-region:\s*no-drag/);
  assert.match(styles, /html\[data-shell="electron"\] \.workspace[\s\S]*grid-row:\s*3/);
  assert.doesNotMatch(styles, /html\[data-shell="electron"\] \.actions[\s\S]*padding-right:\s*150px/);
  assert.doesNotMatch(styles, /html\[data-shell="electron"\] \.repo-bar[\s\S]*padding-right:\s*160px/);
  assert.doesNotMatch(styles, /html\[data-shell="electron"\] \.brand[\s\S]*padding-right:\s*150px/);
});

test("Electron native window controls follow the active Forkline theme", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const layout = read("public/js/app/layout-utils.js");

  assert.match(preload, /setTitleBarTheme/);
  assert.match(preload, /forkline:desktop-titlebar-theme/);
  assert.match(main, /ipcMain\.on\("forkline:desktop-titlebar-theme"/);
  assert.match(main, /event\.sender !== mainWindow\.webContents/);
  assert.match(main, /setTitleBarOverlay\(\{[\s\S]*color[\s\S]*symbolColor[\s\S]*height:\s*ELECTRON_TITLEBAR_CSS_HEIGHT/);
  assert.match(main, /\^#\[0-9a-f\]\{6\}\$/i);
  assert.match(layout, /getComputedStyle\(document\.documentElement\)/);
  assert.match(layout, /getPropertyValue\("--topbar"\)/);
  assert.match(layout, /getPropertyValue\("--text"\)/);
  assert.match(layout, /setTitleBarTheme/);
});

test("Electron restores the previous display and window state without forcing every launch maximized", () => {
  const main = read("electron/main.js");
  assert.match(main, /desktop-window-state\.json/);
  assert.match(main, /readWindowState\(desktopWindowStatePath\(\), screen\.getAllDisplays\(\)\)/);
  assert.match(main, /getNormalBounds\(\)/);
  assert.match(main, /if \(desktopWindowState\.isMaximized\) mainWindow\.maximize\(\)/);
  assert.match(main, /mainWindow\.on\("move", scheduleDesktopWindowStateSave\)/);
  assert.match(main, /mainWindow\.on\("resize", scheduleDesktopWindowStateSave\)/);
  assert.match(main, /mainWindow\.on\("close", flushDesktopWindowState\)/);
});

test("Electron accepts a quoted Windows repository argument", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-electron-"));
  const repository = path.join(tempRoot, "Git 测试");
  fs.mkdirSync(repository);
  try {
    assert.equal(
      findStartupRepository(["electron.exe", tempRoot, `"${repository}"`], tempRoot),
      repository
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Electron forwards repository arguments from later launches to the renderer", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const bootstrap = read("public/js/bootstrap.js");

  assert.match(main, /app\.on\("second-instance", \(_event, argv\) =>/);
  assert.match(main, /repositoryOpenCoordinator\.request\(argv, app\.getAppPath\(\)\)/);
  assert.match(main, /webContents\.send\("forkline:open-repository", repository\)/);
  assert.match(preload, /onOpenRepository/);
  assert.match(bootstrap, /initDesktopRepositoryOpen\(\)/);
});

test("Electron keeps the latest repository request until the renderer is ready", () => {
  const delivered = [];
  const coordinator = createRepositoryOpenCoordinator({
    resolveRepository: (argv) => argv.at(-1) || "",
    deliver: (repository) => {
      delivered.push(repository);
      return true;
    },
  });

  coordinator.request(["Forkline.exe", "D:\\RepoA"], "D:\\Forkline");
  coordinator.request(["Forkline.exe", "D:\\RepoB"], "D:\\Forkline");
  assert.equal(coordinator.getPendingRepository(), "D:\\RepoB");
  assert.deepEqual(delivered, []);

  assert.equal(coordinator.setRendererReady(true), "D:\\RepoB");
  assert.deepEqual(delivered, ["D:\\RepoB"]);
  assert.equal(coordinator.getPendingRepository(), "");

  coordinator.request(["Forkline.exe", "D:\\RepoC"], "D:\\Forkline");
  assert.deepEqual(delivered, ["D:\\RepoB", "D:\\RepoC"]);
});

test("Electron Windows launcher uses cmd-compatible UTF-8 CRLF", () => {
  const launcher = fs.readFileSync(path.join(root, "start-electron.cmd"));
  const text = launcher.toString("utf8");
  assert.notDeepEqual([...launcher.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(text, /^@echo off\r\nsetlocal\r\nchcp 65001 >nul\r\n/);
  assert.doesNotMatch(text, /(^|[^\r])\n/);
});

test("Electron provides persistent desktop zoom without collapsing the topbar", () => {
  const main = read("electron/main.js");
  const zoom = read("electron/desktop-zoom.js");
  const preload = read("electron/preload.js");
  const settings = read("public/js/panels/settings.js");
  const events = read("public/js/app/events.js");
  const styles = read("public/styles.css");

  assert.match(zoom, /DEFAULT_ZOOM_FACTOR\s*=\s*0\.9/);
  assert.match(main, /setZoomFactor\(desktopZoomFactor\)/);
  assert.match(main, /forkline:desktop-zoom:get/);
  assert.match(main, /forkline:desktop-zoom:set/);
  assert.match(preload, /forklineDesktop/);
  assert.match(preload, /getZoomFactor/);
  assert.match(preload, /setZoomFactor/);
  assert.match(settings, /data-settings-zoom/);
  assert.match(events, /data-settings-zoom/);
  assert.match(styles, /@media \(min-width:\s*1501px\) and \(max-width:\s*2000px\)[\s\S]*html\[data-shell="electron"\] \.topbar/);
});

test("Electron desktop zoom snaps, steps, and persists", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-zoom-"));
  const preferenceFile = path.join(tempRoot, "desktop-preferences.json");
  try {
    assert.equal(DEFAULT_ZOOM_FACTOR, 0.9);
    assert.equal(normalizeZoomFactor(0.83), 0.8);
    assert.equal(normalizeZoomFactor("bad"), 0.9);
    assert.equal(stepZoomFactor(0.9, -1), 0.8);
    assert.equal(stepZoomFactor(0.9, 1), 1);
    writeZoomFactor(preferenceFile, 0.75);
    assert.equal(readZoomFactor(preferenceFile), 0.75);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Electron restores a visible window to the previous display work area", () => {
  const displays = [
    { workArea: { x: 0, y: 0, width: 1440, height: 860 } },
    { workArea: { x: 1440, y: -120, width: 864, height: 1536 } },
  ];
  assert.deepEqual(normalizeWindowState({
    bounds: { x: 1500, y: -60, width: 1200, height: 1000 },
    isMaximized: false,
  }, displays), {
    bounds: { x: 1440, y: -60, width: 864, height: 1000 },
    isMaximized: false,
  });
});

test("Electron discards window bounds when the previous display is unavailable", () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1440, height: 860 } }];
  assert.deepEqual(normalizeWindowState({
    bounds: { x: 1800, y: 100, width: 800, height: 700 },
    isMaximized: false,
  }, displays), {
    bounds: null,
    isMaximized: true,
  });
});

test("Electron window state persists normal bounds and maximized state", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-window-state-"));
  const preferenceFile = path.join(tempRoot, "desktop-window-state.json");
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];
  try {
    writeWindowState(preferenceFile, {
      bounds: { x: 80, y: 40, width: 1450, height: 900 },
      isMaximized: true,
    });
    assert.deepEqual(readWindowState(preferenceFile, displays), {
      bounds: { x: 80, y: 40, width: 1450, height: 900 },
      isMaximized: true,
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Electron renderer recovery state keeps only bounded diagnostic fields", () => {
  assert.deepEqual(normalizeRendererRecoveryState({
    repoPath: `D:/${"repo".repeat(100)}`,
    fileEditorDirty: 1,
    fileEditorFile: `${"nested/".repeat(80)}main.c`,
    commitDraftDirty: true,
  }), {
    repoPath: `D:/${"repo".repeat(100)}`.slice(0, 260),
    fileEditorDirty: true,
    fileEditorFile: `${"nested/".repeat(80)}main.c`.slice(0, 260),
    commitDraftDirty: true,
  });
});

test("Electron renderer draft store keeps only the current repository draft and returns copies", () => {
  const store = createRendererDraftStore();
  const input = {
    repoPath: "D:/桌面/GitTest",
    commit: {
      summary: "恢复提交摘要",
      body: "恢复提交正文",
      amend: true,
      ignored: "not exposed",
    },
    fileEditor: {
      file: "src/main.c",
      previousFile: "src/old-main.c",
      snapshot: "a".repeat(64),
      content: "int main(void) {\n  return 0;\n}\n",
      view: { line: 24, left: 8, oldLine: 21, oldLeft: 4, ignored: 1 },
      ignored: "not exposed",
    },
    ignored: "not exposed",
  };

  assert.equal(store.write(input), true);
  assert.deepEqual(store.read(), normalizeRendererDraft(input));
  const firstRead = store.read();
  firstRead.commit.summary = "changed outside the store";
  firstRead.fileEditor.view.line = 999;
  assert.equal(store.read().commit.summary, "恢复提交摘要");
  assert.equal(store.read().fileEditor.view.line, 24);

  assert.equal(store.write({ repoPath: "D:/桌面/GitTest", commit: {}, fileEditor: null }), true);
  assert.equal(store.read(), null);
});

test("Electron renderer draft store rejects invalid or oversized drafts without replacing the last good copy", () => {
  const store = createRendererDraftStore();
  const valid = {
    repoPath: "D:/桌面/GitTest",
    commit: { summary: "keep this", body: "", amend: false },
  };
  store.write(valid);

  assert.throws(() => store.write({
    repoPath: "D:/桌面/GitTest",
    fileEditor: {
      file: "src/main.c",
      snapshot: "invalid",
      content: "draft",
    },
  }), /snapshot/i);
  assert.throws(() => store.write({
    repoPath: "D:/桌面/GitTest",
    fileEditor: {
      file: "src/main.c",
      snapshot: "b".repeat(64),
      content: "x".repeat(MAX_RENDERER_DRAFT_BYTES),
    },
  }), /8 MiB/);
  assert.deepEqual(store.read(), normalizeRendererDraft(valid));
});

test("Electron restores commit fields and reopens the worktree editor after repository initialization", async () => {
  const core = read("public/js/core.js");
  const recoverySource = core.slice(core.indexOf("const DESKTOP_RECOVERY_DRAFT_SAVE_DELAY_MS"));
  const opened = [];
  const reports = [];
  let amendUpdates = 0;
  const draft = {
    repoPath: "D:/桌面/GitTest",
    commit: { summary: "恢复摘要", body: "恢复正文", amend: true },
    fileEditor: {
      file: "src/main.c",
      previousFile: "src/old-main.c",
      snapshot: "c".repeat(64),
      content: "restored file\n",
      view: { line: 18, left: 6 },
    },
  };
  const sandbox = {
    window: {
      forklineDesktop: {
        readRecoveryDraft: async () => draft,
        saveRecoveryDraft: async () => true,
        reportRecoveryState: (value) => reports.push(value),
      },
    },
    state: { data: { repo: { path: draft.repoPath, isSample: false } }, fileEditor: null },
    els: {
      commitSummary: { value: "" },
      commitBody: { value: "" },
      amendToggle: { checked: false },
      fileEditorText: { value: "" },
    },
    repoPathSnapshot: () => draft.repoPath,
    updateAmendMode: () => { amendUpdates += 1; },
    openFileEditorLazy: async (...args) => { opened.push(args); return true; },
    toast: () => {},
    t: (value) => value,
    setTimeout: () => 1,
  };
  vm.runInNewContext(recoverySource, sandbox);

  assert.equal(await sandbox.restoreDesktopRecoveryDraft(), true);
  assert.equal(sandbox.els.commitSummary.value, "恢复摘要");
  assert.equal(sandbox.els.commitBody.value, "恢复正文");
  assert.equal(sandbox.els.amendToggle.checked, true);
  assert.equal(amendUpdates, 1);
  assert.equal(opened.length, 1);
  assert.equal(opened[0][0], "src/main.c");
  assert.equal(opened[0][1], "src/old-main.c");
  assert.equal(opened[0][2].recoveryDraft, draft.fileEditor);
  assert.equal(opened[0][2].restoreView, draft.fileEditor.view);
  assert.equal(reports.at(-1).commitDraftDirty, true);
});

test("Electron file recovery stays editable only when the disk snapshot still matches", () => {
  const editorSource = read("public/js/features/file-editor.js");
  const sandbox = {
    normalizeFileEditorContent: (value) => String(value || "").replaceAll("\r\n", "\n"),
    normalizeFileEditorConflictVersions: () => ({ ours: {}, theirs: {} }),
  };
  vm.runInNewContext(editorSource, sandbox);

  const matching = {
    snapshot: "d".repeat(64),
    originalContent: "disk\n",
    initialContent: "disk\n",
    oldContent: "index\n",
    readOnly: false,
    canStage: true,
    recoverySnapshotChanged: false,
  };
  sandbox.applyFileEditorRecoveryDraft(matching, {
    snapshot: "d".repeat(64),
    content: "draft\r\n",
  });
  assert.equal(matching.initialContent, "draft\n");
  assert.equal(matching.readOnly, false);
  assert.equal(matching.recoverySnapshotChanged, false);
  assert.equal(matching.canStage, false);

  const changed = {
    snapshot: "e".repeat(64),
    originalContent: "new disk\n",
    initialContent: "new disk\n",
    oldContent: "index\n",
    readOnly: false,
    canStage: true,
    conflict: true,
    diffScope: "unstaged",
    diff: [{ type: "add" }],
    recoverySnapshotChanged: false,
  };
  sandbox.applyFileEditorRecoveryDraft(changed, {
    snapshot: "f".repeat(64),
    content: "old draft\n",
  });
  assert.equal(changed.initialContent, "old draft\n");
  assert.equal(changed.oldContent, "new disk\n");
  assert.equal(changed.recoveryDraftSnapshot, "f".repeat(64));
  assert.equal(changed.readOnly, true);
  assert.equal(changed.recoverySnapshotChanged, true);
  assert.equal(changed.conflict, false);
  assert.equal(changed.diffScope, "");
  assert.equal(changed.diff.length, 0);
});

test("Electron unresponsive dialog defaults to waiting and names unsaved work", () => {
  const options = unresponsiveDialogOptions({
    repoPath: "D:/桌面/GitTest",
    fileEditorDirty: true,
    fileEditorFile: "src/main.c",
    commitDraftDirty: true,
  });
  assert.equal(options.title, "Forkline 页面无响应");
  assert.equal(options.defaultId, 0);
  assert.equal(options.cancelId, 0);
  assert.deepEqual(options.buttons, ["继续等待", "放弃未保存内容并重新加载"]);
  assert.match(options.detail, /src\/main\.c/);
  assert.match(options.detail, /提交信息框/);
  assert.match(options.detail, /D:\/桌面\/GitTest/);
});

test("Electron renderer crash dialog explains the reason and keeps reload explicit", () => {
  const options = rendererGoneDialogOptions({ reason: "oom", exitCode: 9 }, {
    fileEditorDirty: false,
    commitDraftDirty: false,
  });
  assert.equal(options.title, "Forkline 页面进程已停止");
  assert.deepEqual(options.buttons, ["重新加载页面", "退出 Forkline"]);
  assert.equal(options.defaultId, 0);
  assert.match(options.detail, /内存不足/);
  assert.match(options.detail, /退出代码：9/);
});

test("Electron renderer health cancels a pending warning after the page responds", async () => {
  let scheduled = null;
  let dialogs = 0;
  const controller = createRendererHealthController({
    showDialog: async () => { dialogs += 1; return { response: 0 }; },
    reload: () => assert.fail("responsive page must not reload"),
    close: () => assert.fail("responsive page must not close"),
    setTimer: (callback) => { scheduled = callback; return 1; },
    clearTimer: () => {},
  });
  controller.handleUnresponsive();
  controller.handleResponsive();
  await scheduled();
  assert.equal(dialogs, 0);
});

test("Electron renderer health reloads only after an explicit unresponsive choice", async () => {
  let scheduled = null;
  let shownOptions = null;
  const actions = [];
  const controller = createRendererHealthController({
    showDialog: async (options) => { shownOptions = options; return { response: 1 }; },
    clearRecoveryDraft: () => actions.push("clear"),
    reload: () => actions.push("reload"),
    close: () => assert.fail("unresponsive reload must not close the app"),
    setTimer: (callback) => { scheduled = callback; return 1; },
    clearTimer: () => {},
  });
  controller.updateRecoveryState({ fileEditorDirty: true, fileEditorFile: "main.c" });
  controller.handleUnresponsive();
  await scheduled();
  assert.deepEqual(actions, ["clear", "reload"]);
  assert.deepEqual(shownOptions.buttons, ["继续等待", "放弃未保存内容并重新加载"]);
});

test("Electron renderer health reloads or exits after a renderer crash choice", async () => {
  const actions = [];
  const responses = [0, 1];
  const controller = createRendererHealthController({
    showDialog: async () => ({ response: responses.shift() }),
    reload: () => actions.push("reload"),
    close: () => actions.push("close"),
    clearRecoveryDraft: () => actions.push("clear"),
  });
  await controller.handleRenderProcessGone({ reason: "crashed", exitCode: -1 });
  await controller.handleRenderProcessGone({ reason: "killed", exitCode: 0 });
  assert.deepEqual(actions, ["reload", "close"]);
});

test("Electron wires renderer health events and recovery-state reporting", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const core = read("public/js/core.js");
  const bootstrap = read("public/js/bootstrap.js");
  const events = read("public/js/app/events.js");
  const editor = read("public/js/features/file-editor.js");
  const editorWindow = read("public/js/features/file-editor-window.js");

  assert.match(main, /webContents\.on\("unresponsive"/);
  assert.match(main, /webContents\.on\("responsive"/);
  assert.match(main, /webContents\.on\("render-process-gone"/);
  assert.match(main, /forkline:desktop-recovery-state/);
  assert.match(main, /forkline:desktop-recovery-draft:save/);
  assert.match(main, /forkline:desktop-recovery-draft:read/);
  assert.match(main, /event\.sender !== mainWindow\.webContents/);
  assert.match(preload, /reportRecoveryState/);
  assert.match(preload, /saveRecoveryDraft/);
  assert.match(preload, /readRecoveryDraft/);
  assert.match(core, /function reportDesktopRecoveryState/);
  assert.match(core, /function scheduleDesktopRecoveryDraftSave/);
  assert.match(core, /async function restoreDesktopRecoveryDraft/);
  assert.match(bootstrap, /await init\(\)[\s\S]*await restoreDesktopRecoveryDraft\(\)/);
  assert.match(events, /commitSummary\.addEventListener\("input", reportDesktopRecoveryState\)/);
  assert.match(events, /commitBody\.addEventListener\("input", reportDesktopRecoveryState\)/);
  assert.match(editor, /options\.recoveryDraft/);
  assert.match(editor, /editor\.snapshot === recoveryDraft\.snapshot/);
  assert.match(editor, /recoverySnapshotChanged/);
  assert.match(editorWindow, /reportDesktopRecoveryState\(\)/);
});
