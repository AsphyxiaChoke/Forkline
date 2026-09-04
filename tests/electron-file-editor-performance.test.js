"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { once } = require("node:events");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const packagedElectronExecutable = String(process.env.FORKLINE_ELECTRON_EXE || "").trim();
const electronExecutable = packagedElectronExecutable || path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe");
const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const cdpCommandTimeoutMs = 15000;

test("Electron standalone file editor stays responsive during rapid scrolling", {
  skip: process.platform === "win32" ? false : "Windows Electron regression",
  timeout: 120000,
}, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-electron-editor-scroll-"));
  const repo = path.join(root, "repo");
  const appData = path.join(root, "appdata");
  const localAppData = path.join(root, "localappdata");
  const port = await freePort();
  let electronProcess = null;
  let mainCdp = null;
  let editorCdp = null;
  let electronLog = "";

  t.after(async () => {
    editorCdp?.close();
    mainCdp?.close();
    await stopProcessTree(electronProcess);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const fixture = await createFixture(repo);
  await fs.mkdir(appData, { recursive: true });
  await fs.mkdir(localAppData, { recursive: true });

  electronProcess = spawn(electronExecutable, [
    ...(packagedElectronExecutable ? [] : [projectRoot]),
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${localAppData}`,
    repo,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      APPDATA: appData,
      LOCALAPPDATA: localAppData,
      GIT_CONFIG_GLOBAL: nullConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
      ELECTRON_ENABLE_LOGGING: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  electronProcess.stdout.on("data", (chunk) => {
    electronLog = appendLog(electronLog, chunk);
  });
  electronProcess.stderr.on("data", (chunk) => {
    electronLog = appendLog(electronLog, chunk);
  });

  const mainTarget = await waitForTarget(port, electronProcess, () => electronLog, (target) => (
    target.type === "page" && !target.url.includes("fileEditorWindow=1")
  ));
  mainCdp = await CdpClient.connect(mainTarget.webSocketDebuggerUrl);
  await mainCdp.send("Runtime.enable");
  await waitForExpression(mainCdp, `Boolean(
    document.readyState === "complete" &&
    typeof state !== "undefined" &&
    state.data?.repo?.path &&
    typeof refreshWorktree === "function"
  )`);

  const opened = await evaluate(mainCdp, `(async () => {
    await refreshWorktree(false);
    renderStage({ refreshDiff: false });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const row = document.querySelector('#changeList [data-select-file][data-file="ordinary-scroll.c"]');
    row?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    return Boolean(row);
  })()`);
  assert.equal(opened, true, "ordinary worktree file row was not available for double-click");

  const editorTarget = await waitForTarget(port, electronProcess, () => electronLog, (target) => (
    target.type === "page" && target.url.includes("fileEditorWindow=1")
  ));
  editorCdp = await CdpClient.connect(editorTarget.webSocketDebuggerUrl);
  await editorCdp.send("Runtime.enable");
  await waitForExpression(editorCdp, `Boolean(
    document.readyState === "complete" &&
    state.fileEditor?.file === "ordinary-scroll.c" &&
    state.fileEditor?.loading === false &&
    state.fileEditor?.lightweightCompare === false &&
    Boolean(state.fileEditor?.mergeView) &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length === 1 &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length === 2
  )`, 30000);

  const topLevelWindows = await readTopLevelWindows(electronProcess.pid);
  const editorWindow = topLevelWindows.find((window) => (
    window.visible && window.owner === 0 && window.title.startsWith("Forkline") && window.title !== "Forkline Web"
  ));
  t.diagnostic(`Electron 顶层窗口：${JSON.stringify(topLevelWindows)}`);
  assert.ok(editorWindow, "standalone editor did not create a top-level Windows window");
  assert.equal(editorWindow.visible, true, "standalone editor top-level window was not visible");
  assert.equal(editorWindow.owner, 0, "standalone editor still had an owner window");
  assert.equal(editorWindow.toolWindow, false, "standalone editor used the taskbar-hidden tool window style");

  for (let sourceIndex = 0; sourceIndex < 2; sourceIndex += 1) {
    const worktreeMetrics = await measureRapidWheel(editorCdp, sourceIndex);
    assertRapidWheel(t, `普通工作区双栏（来源 ${sourceIndex + 1}）`, worktreeMetrics, 2);
  }

  const unlocked = await evaluate(editorCdp, `(() => {
    document.querySelector("#fileEditorMerge .CodeMirror-merge-scrolllock-enabled")?.click();
    const panes = Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"));
    panes.forEach((pane) => { pane.scrollTop = 0; });
    const rect = panes[0].getBoundingClientRect();
    return {
      enabledLocks: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-scrolllock-enabled").length,
      x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
    };
  })()`);
  assert.equal(unlocked.enabledLocks, 0, "scroll lock did not turn off");
  await dispatchWheel(editorCdp, unlocked, 1, 20);
  await delay(300);
  const unlockedTops = await evaluate(editorCdp, `Array.from(
    document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"),
    (pane) => pane.scrollTop
  )`);
  assert.ok(unlockedTops[0] > 0, "unlocked source pane did not scroll");
  assert.ok(unlockedTops[1] <= 2, "unlocked target pane still followed the source");
  const enabledLocks = await evaluate(editorCdp, `(() => {
    document.querySelector("#fileEditorMerge .CodeMirror-merge-scrolllock")?.click();
    return document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-scrolllock-enabled").length;
  })()`);
  assert.equal(enabledLocks, 1, "scroll lock did not turn back on");

  const lightweightRequested = await evaluate(mainCdp, `window.forklineDesktop.openFileEditorWindow(
    "lightweight-scroll.c", "", "worktree", "", state.theme
  )`);
  assert.equal(lightweightRequested, true, "lightweight editor request was rejected");
  await waitForExpression(editorCdp, `Boolean(
    state.fileEditor?.file === "lightweight-scroll.c" &&
    state.fileEditor?.source === "worktree" &&
    state.fileEditor?.loading === false &&
    state.fileEditor?.largeFile === false &&
    state.fileEditor?.lightweightCompare === true &&
    document.querySelectorAll("#fileEditorMerge .file-editor-large-compare").length === 1 &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length === 2
  )`, 30000);
  for (let sourceIndex = 0; sourceIndex < 2; sourceIndex += 1) {
    const lightweightMetrics = await measureRapidWheel(editorCdp, sourceIndex);
    assertRapidWheel(t, `轻量双栏（来源 ${sourceIndex + 1}）`, lightweightMetrics, 2);
  }

  const historyRequested = await evaluate(mainCdp, `window.forklineDesktop.openFileEditorWindow(
    "ordinary-scroll.c", "", "commit", ${JSON.stringify(fixture.head)}, state.theme
  )`);
  assert.equal(historyRequested, true, "historical editor request was rejected");
  await waitForExpression(editorCdp, `Boolean(
    state.fileEditor?.file === "ordinary-scroll.c" &&
    state.fileEditor?.source === "commit" &&
    state.fileEditor?.commit === ${JSON.stringify(fixture.head)} &&
    state.fileEditor?.loading === false &&
    state.fileEditor?.lightweightCompare === false &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length === 1 &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length === 2 &&
    document.querySelector("#fileEditorFallback")?.hidden === true
  )`, 30000);
  for (let sourceIndex = 0; sourceIndex < 2; sourceIndex += 1) {
    const historyMetrics = await measureRapidWheel(editorCdp, sourceIndex);
    assertRapidWheel(t, `历史 MergeView 双栏（来源 ${sourceIndex + 1}）`, historyMetrics, 2);
  }

  const conflictRequested = await evaluate(mainCdp, `window.forklineDesktop.openFileEditorWindow(
    "conflict-scroll.c", "", "worktree", "", state.theme
  )`);
  assert.equal(conflictRequested, true, "conflict editor request was rejected");
  await waitForExpression(editorCdp, `Boolean(
    state.fileEditor?.file === "conflict-scroll.c" &&
    state.fileEditor?.source === "worktree" &&
    state.fileEditor?.conflict === true &&
    state.fileEditor?.loading === false &&
    state.fileEditor?.lightweightCompare === false &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-3pane").length === 1 &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length === 3 &&
    document.querySelector("#fileEditorFallback")?.hidden === true
  )`, 30000);
  for (let sourceIndex = 0; sourceIndex < 3; sourceIndex += 1) {
    const conflictMetrics = await measureRapidWheel(editorCdp, sourceIndex);
    assertRapidWheel(t, `普通冲突 MergeView 三栏（来源 ${sourceIndex + 1}）`, conflictMetrics, 3);
  }
  const conflictSave = await evaluate(editorCdp, `(async () => {
    const panes = [state.fileEditor.mergeView.leftOriginal(), state.fileEditor.codeMirror, state.fileEditor.mergeView.rightOriginal()];
    const marker = "// Forkline MergeView conflict save regression";
    const permissions = panes.map((pane) => Boolean(pane.getOption("readOnly")));
    state.fileEditor.codeMirror.setValue(state.fileEditor.codeMirror.getValue() + "\\n" + marker + "\\n");
    const dirtyBeforeSave = fileEditorDirty();
    await submitFileEditor();
    return {
      permissions,
      dirtyBeforeSave,
      savedValue: state.fileEditor.codeMirror.getValue(),
      loading: state.fileEditor?.loading,
      saving: state.fileEditor?.saving,
    };
  })()`);
  assert.deepEqual(conflictSave.permissions, [true, false, true], "MergeView conflict pane permissions changed");
  assert.equal(conflictSave.dirtyBeforeSave, true, "MergeView conflict result did not become dirty");
  assert.match(conflictSave.savedValue, /Forkline MergeView conflict save regression/, "MergeView conflict result was not reloaded after save");
  assert.equal(conflictSave.loading, false, "MergeView conflict editor was still loading after save");
  assert.equal(conflictSave.saving, false, "MergeView conflict editor was still saving after save");
  assert.match(
    await fs.readFile(path.join(repo, "conflict-scroll.c"), "utf8"),
    /Forkline MergeView conflict save regression/,
    "MergeView conflict result was not written to disk"
  );
  assert.equal(await evaluate(editorCdp, "document.title"), "Forkline 编辑器");
});

test("Electron standalone history comparison stays responsive and memory-bounded after rapid scrollbar dragging", {
  skip: process.platform === "win32" ? false : "Windows Electron regression",
  timeout: 120000,
}, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-electron-history-memory-"));
  const appData = path.join(root, "appdata");
  const localAppData = path.join(root, "localappdata");
  const port = await freePort();
  const commit = "1f0f3050fc71f1edebd5cbcc03b78de59d56569c";
  const file = "tests/electron-file-editor-performance.test.js";
  let electronProcess = null;
  let mainCdp = null;
  let editorCdp = null;
  let electronLog = "";

  t.after(async () => {
    editorCdp?.close();
    mainCdp?.close();
    await stopProcessTree(electronProcess);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  await fs.mkdir(appData, { recursive: true });
  await fs.mkdir(localAppData, { recursive: true });
  electronProcess = spawn(electronExecutable, [
    ...(packagedElectronExecutable ? [] : [projectRoot]),
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${localAppData}`,
    projectRoot,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      APPDATA: appData,
      LOCALAPPDATA: localAppData,
      GIT_CONFIG_GLOBAL: nullConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
      ELECTRON_ENABLE_LOGGING: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  electronProcess.stdout.on("data", (chunk) => {
    electronLog = appendLog(electronLog, chunk);
  });
  electronProcess.stderr.on("data", (chunk) => {
    electronLog = appendLog(electronLog, chunk);
  });

  const mainTarget = await waitForTarget(port, electronProcess, () => electronLog, (target) => (
    target.type === "page" && !target.url.includes("fileEditorWindow=1")
  ));
  mainCdp = await CdpClient.connect(mainTarget.webSocketDebuggerUrl);
  await mainCdp.send("Runtime.enable");
  await waitForExpression(mainCdp, `Boolean(
    document.readyState === "complete" &&
    typeof state !== "undefined" &&
    state.data?.repo?.path &&
    typeof window.forklineDesktop?.openFileEditorWindow === "function"
  )`);
  const repoReady = await evaluate(mainCdp, `(async () => {
    if (state.data?.repo?.isSample) await openRepo(${JSON.stringify(projectRoot)});
    return { path: state.data?.repo?.path || "", isSample: Boolean(state.data?.repo?.isSample) };
  })()`);
  assert.equal(repoReady.isSample, false, `real repository did not open: ${JSON.stringify(repoReady)}`);
  const theme = await evaluate(mainCdp, `(() => {
    applyTheme("light");
    return { stateTheme: state.theme, domTheme: document.documentElement.dataset.theme };
  })()`);
  assert.deepEqual(theme, { stateTheme: "light", domTheme: "light" });

  const requested = await evaluate(mainCdp, `(async () => {
    await selectCommit(${JSON.stringify(commit)});
    document.querySelector('[data-tab="files"]')?.click();
    const deadline = Date.now() + 10000;
    let row = null;
    while (!(row = document.querySelector('#detailBody [data-select-file][data-file=${JSON.stringify(file)}]')) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!row) return {
      found: false,
      repoPath: state.data?.repo?.path || "",
      selectedSha: state.selectedSha || state.selectedCommit?.sha || "",
      files: Array.from(document.querySelectorAll("#detailBody [data-select-file]"), (item) => item.dataset.file).slice(0, 20),
      detailText: document.querySelector("#detailBody")?.textContent?.slice(0, 500) || "",
    };
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 2 }));
    row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, detail: 2 }));
    return { found: true };
  })()`);
  t.diagnostic(`真实历史双击请求：${JSON.stringify(requested)}`);
  assert.equal(requested.found, true, "real history file row was not available for double-click");

  const editorTarget = await waitForTarget(port, electronProcess, () => electronLog, (target) => (
    target.type === "page" && target.url.includes("fileEditorWindow=1")
  ));
  editorCdp = await CdpClient.connect(editorTarget.webSocketDebuggerUrl);
  await editorCdp.send("Runtime.enable");
  const loadingSnapshots = [];
  let editorReady = false;
  for (let index = 0; index < 20; index += 1) {
    const stateSnapshot = await evaluate(editorCdp, `typeof state === "undefined" ? {
      file: "",
      source: "",
      commit: "",
      loading: null,
      compareMode: "",
      mergeViews: 0,
      lightweightCompares: 0,
      scrollers: 0,
      fallbackPanes: 0,
      fallbackVisible: false,
      compareModeHidden: false,
      syntaxTokens: 0,
      drawingElements: 0,
      resourceScripts: document.querySelectorAll("script[data-file-editor-resource]").length,
      resourcePending: document.querySelectorAll("script[data-file-editor-resource]:not([data-loaded=true])").length,
      mergeTextLength: document.querySelector("#fileEditorMerge")?.textContent?.length || 0,
    } : ({
      file: state.fileEditor?.file || "",
      source: state.fileEditor?.source || "",
      commit: state.fileEditor?.commit || "",
      loading: state.fileEditor?.loading,
      compareMode: state.fileEditor?.compareMode || "",
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      lightweightCompares: document.querySelectorAll("#fileEditorMerge .file-editor-large-compare").length,
      scrollers: document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length,
      fallbackPanes: document.querySelectorAll("#fileEditorFallback .file-editor-text").length,
      fallbackVisible: document.querySelector("#fileEditorFallback")?.hidden === false,
      compareModeHidden: Boolean(document.querySelector("#fileEditorCompareMode")?.hidden),
      syntaxTokens: document.querySelectorAll("#fileEditorMerge .cm-keyword, #fileEditorMerge .cm-def, #fileEditorMerge .cm-variable").length,
      drawingElements: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-gap > svg, #fileEditorMerge .CodeMirror-merge-connect-canvas").length,
      resourceScripts: document.querySelectorAll("script[data-file-editor-resource]").length,
      resourcePending: document.querySelectorAll("script[data-file-editor-resource]:not([data-loaded=true])").length,
      mergeTextLength: document.querySelector("#fileEditorMerge")?.textContent?.length || 0,
    })`);
    const privateBytes = await readRendererPrivateBytes(electronProcess.pid);
    loadingSnapshots.push({ ...stateSnapshot, privateBytes });
    editorReady = stateSnapshot.file === file
      && stateSnapshot.source === "commit"
      && stateSnapshot.commit === commit
      && stateSnapshot.loading === false
      && stateSnapshot.mergeViews === 1
      && stateSnapshot.lightweightCompares === 0
      && stateSnapshot.scrollers === 2
      && stateSnapshot.fallbackPanes === 2
      && !stateSnapshot.fallbackVisible
      && !stateSnapshot.compareModeHidden
      && stateSnapshot.syntaxTokens > 0
      && stateSnapshot.drawingElements > 0;
    if (editorReady || privateBytes >= 1024 * 1024 * 1024) break;
    await delay(500);
  }
  t.diagnostic(`真实历史双击加载快照：${JSON.stringify(loadingSnapshots)}`);
  assert.equal(editorReady, true, "real history editor did not finish loading before the renderer memory limit");
  const readySnapshot = loadingSnapshots.at(-1);
  assert.equal(readySnapshot.mergeViews, 1, "standalone history editor did not create a MergeView");
  assert.equal(readySnapshot.lightweightCompares, 0, "standalone history editor entered lightweight comparison unexpectedly");
  assert.equal(readySnapshot.scrollers, 2, "standalone history editor did not create two CodeMirror scrollers");
  assert.equal(readySnapshot.fallbackVisible, false, "standalone history editor showed the native fallback");
  assert.equal(readySnapshot.compareModeHidden, false, "standalone history editor hid the MergeView mode switch");
  assert.ok(readySnapshot.syntaxTokens > 0, "standalone history editor lost syntax highlighting");
  assert.ok(readySnapshot.drawingElements > 0, "standalone history editor lost connector drawing");

  await editorCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1900,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(500);
  const maximizedLayout = await evaluate(editorCdp, `(() => {
    const rect = els.fileEditorForm.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dialog: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      positioned: els.fileEditorForm.classList.contains("is-positioned"),
      inline: { left: els.fileEditorForm.style.left, top: els.fileEditorForm.style.top, width: els.fileEditorForm.style.width, height: els.fileEditorForm.style.height },
    };
  })()`);
  t.diagnostic(`独立编辑器最大化布局：${JSON.stringify(maximizedLayout)}`);
  assert.ok(Math.abs(maximizedLayout.dialog.left) <= 1 && Math.abs(maximizedLayout.dialog.top) <= 1, "standalone editor content did not start at the maximized viewport origin");
  assert.ok(Math.abs(maximizedLayout.dialog.width - maximizedLayout.viewport.width) <= 1, "standalone editor content did not fill the maximized viewport width");
  assert.ok(Math.abs(maximizedLayout.dialog.height - maximizedLayout.viewport.height) <= 1, "standalone editor content did not fill the maximized viewport height");
  assert.equal(maximizedLayout.positioned, false, "standalone editor retained in-page floating positioning");
  assert.deepEqual(maximizedLayout.inline, { left: "", top: "", width: "", height: "" }, "standalone editor retained fixed inline bounds after maximizing");

  const wheelOwnership = await evaluate(editorCdp, `(async () => {
    const bindings = state.fileEditor?.scrollSyncHandlers || [];
    const source = bindings[0]?.source;
    const element = bindings[0]?.element;
    let sourceScrollToCalls = 0;
    const originalScrollTo = source.scrollTo.bind(source);
    source.scrollTo = (...args) => {
      sourceScrollToCalls += 1;
      return originalScrollTo(...args);
    };
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: 120,
    });
    element.dispatchEvent(wheel);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    source.scrollTo = originalScrollTo;
    return { defaultPrevented: wheel.defaultPrevented, sourceScrollToCalls };
  })()`);
  assert.equal(wheelOwnership.defaultPrevented, true, "standalone history editor did not take ownership of wheel scrolling");
  assert.equal(wheelOwnership.sourceScrollToCalls, 0, "standalone history editor rewrote the active pane during wheel input");

  const scrollbarOwnership = await measureRapidScrollbarDrag(editorCdp);
  t.diagnostic(`历史 MergeView 快速拖动滚动条：来源 ${scrollbarOwnership.tops[0].toFixed(1)}，目标 ${scrollbarOwnership.tops[1].toFixed(1)}，程序滚动 ${scrollbarOwnership.scrollToCalls.join("/")}，坐标 ${JSON.stringify(scrollbarOwnership.point)}，滚动条 ${JSON.stringify(scrollbarOwnership.scrollbar)}`);
  assert.ok(scrollbarOwnership.tops[0] > 0, "standalone history scrollbar drag did not move the active pane");
  assert.ok(scrollbarOwnership.ratioSpread <= 0.02, `standalone history scrollbar drag left panes ${scrollbarOwnership.ratioSpread.toFixed(4)} apart`);
  assert.equal(scrollbarOwnership.scrollToCalls[0], 0, "standalone history editor rewrote the actively dragged pane");
  assert.ok(scrollbarOwnership.scrollToCalls[1] <= 1, `standalone history editor rewrote the target pane ${scrollbarOwnership.scrollToCalls[1]} times during one drag`);

  await evaluate(editorCdp, `document.querySelector('[data-file-editor-compare-mode="align"]')?.click()`);
  await waitForExpression(editorCdp, `Boolean(
    state.fileEditor?.compareMode === "align" &&
    state.fileEditor?.mergeView?.options?.connect === "align" &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-spacer").length > 0
  )`, 10000);
  const alignedSpacers = await evaluate(editorCdp, `document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-spacer").length`);
  assert.ok(alignedSpacers > 0, "standalone history editor lost aligned spacer rows");
  await evaluate(editorCdp, `document.querySelector('[data-file-editor-compare-mode="connect"]')?.click()`);
  await waitForExpression(editorCdp, `Boolean(
    state.fileEditor?.compareMode === "connect" &&
    state.fileEditor?.mergeView?.options?.connect !== "align" &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-gap > svg").length > 0
  )`, 10000);

  const memory = await measureStandaloneHistoryMemoryAfterScroll(editorCdp, electronProcess.pid, 8, (sample) => {
    t.diagnostic(`历史 MergeView 双栏第 ${sample.cycle} 轮：JS ${(sample.usedSize / 1048576).toFixed(1)} MiB，渲染进程 ${(sample.privateBytes / 1048576).toFixed(1)} MiB，DOM ${sample.nodes}，绘制元素 ${sample.drawingElements}`);
  });
  t.diagnostic(`真实历史 MergeView 双栏循环滚动：${memory.samples.map((sample) => `${sample.cycle}:${(sample.usedSize / 1048576).toFixed(1)}/${(sample.privateBytes / 1048576).toFixed(1)}MiB,dom=${sample.nodes},draw=${sample.drawingElements}`).join(" | ")}`);
  t.diagnostic(`真实历史 MergeView 双栏滚动内存：JS 初始 ${(memory.initialUsedSize / 1048576).toFixed(1)} MiB，峰值 ${(memory.maxUsedSize / 1048576).toFixed(1)} MiB，增长 ${(memory.growth / 1048576).toFixed(1)} MiB；渲染进程初始 ${(memory.initialPrivateBytes / 1048576).toFixed(1)} MiB，峰值 ${(memory.maxPrivateBytes / 1048576).toFixed(1)} MiB，停止后 ${(memory.settledPrivateBytes / 1048576).toFixed(1)} MiB；DOM ${memory.initialNodes} -> ${memory.maxNodes}，绘制元素峰值 ${memory.maxDrawingElements}`);
  assert.ok(memory.growth < 64 * 1024 * 1024, `history renderer retained ${(memory.growth / 1048576).toFixed(1)} MiB after scrolling`);
  assert.ok(memory.maxPrivateBytes < 1024 * 1024 * 1024, `history renderer process peaked at ${(memory.maxPrivateBytes / 1048576).toFixed(1)} MiB`);
  assert.ok(memory.settledPrivateGrowth < 256 * 1024 * 1024, `history renderer process retained ${(memory.settledPrivateGrowth / 1048576).toFixed(1)} MiB after scrolling`);
  assert.ok(memory.maxNodes <= memory.initialNodes + 2000, `history renderer DOM grew from ${memory.initialNodes} to ${memory.maxNodes}`);
  assert.ok(memory.maxDrawingElements > 0, "standalone history comparison lost connector drawing during scrolling");
  assert.ok(memory.settledStructure.drawingElements > 0, "standalone history comparison lost its connector drawing layer");
  assert.equal(memory.settledStructure.mergeViews, 1, "standalone history comparison lost its MergeView");
  assert.equal(memory.settledStructure.lightweightCompares, 0, "standalone history comparison restored a CodeMirror comparison");
  assert.equal(memory.settledStructure.scrollers, 2, "standalone history comparison lost a CodeMirror scroller");
  assert.equal(memory.settledStructure.fallbackVisible, false, "standalone history comparison exposed the native fallback");
  assert.equal(memory.settledStructure.compareModeHidden, false, "standalone history comparison hid the MergeView mode switch after scrolling");
});

async function measureStandaloneHistoryMemoryAfterScroll(cdp, browserPid, cycles = 1, onSample = () => {}) {
  const initialRenderer = await evaluate(cdp, `({
    usedSize: performance.memory?.usedJSHeapSize || 0,
    nodes: document.querySelectorAll("*").length,
  })`);
  const initialPrivateBytes = await readRendererPrivateBytes(browserPid);
  let maxUsedSize = initialRenderer.usedSize;
  let maxPrivateBytes = initialPrivateBytes;
  let maxNodes = initialRenderer.nodes;
  let maxDrawingElements = 0;
  const samples = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await evaluate(cdp, `(() => {
      const bindings = state.fileEditor?.scrollSyncHandlers || [];
      bindings.forEach(({ source }) => source.scrollTo(null, 0));
    })()`);
    await delay(100);
    try {
      await dispatchScrollbarDrag(cdp);
    } catch (error) {
      const privateBytes = await readRendererPrivateBytes(browserPid);
      throw new Error(`history scrollbar cycle ${cycle + 1} stopped responding at ${(privateBytes / 1048576).toFixed(1)} MiB renderer private memory; completed samples: ${JSON.stringify(samples)}; ${error.message}`);
    }
    await delay(300);
    const renderer = await evaluate(cdp, `({
      usedSize: performance.memory?.usedJSHeapSize || 0,
      nodes: document.querySelectorAll("*").length,
    })`);
    const privateBytes = await readRendererPrivateBytes(browserPid);
    const drawingElements = await evaluate(cdp, `document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-gap > svg, #fileEditorMerge .CodeMirror-merge-connect-canvas").length`);
    maxUsedSize = Math.max(maxUsedSize, renderer.usedSize);
    maxPrivateBytes = Math.max(maxPrivateBytes, privateBytes);
    maxNodes = Math.max(maxNodes, renderer.nodes);
    maxDrawingElements = Math.max(maxDrawingElements, drawingElements);
    const sample = { cycle: cycle + 1, usedSize: renderer.usedSize, privateBytes, nodes: renderer.nodes, drawingElements };
    samples.push(sample);
    onSample(sample);
    if (privateBytes >= 1024 * 1024 * 1024 || maxUsedSize - initialRenderer.usedSize >= 256 * 1024 * 1024) break;
  }
  await delay(500);
  const settledStructure = await evaluate(cdp, `(() => {
    return {
      drawingElements: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-gap > svg, #fileEditorMerge .CodeMirror-merge-connect-canvas").length,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      lightweightCompares: document.querySelectorAll("#fileEditorMerge .file-editor-large-compare").length,
      scrollers: document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length,
      fallbackPanes: document.querySelectorAll("#fileEditorFallback .file-editor-text").length,
      fallbackVisible: document.querySelector("#fileEditorFallback")?.hidden === false,
      compareModeHidden: Boolean(document.querySelector("#fileEditorCompareMode")?.hidden),
    };
  })()`);
  const settledPrivateBytes = await readRendererPrivateBytes(browserPid);
  return {
    initialUsedSize: initialRenderer.usedSize,
    maxUsedSize,
    growth: maxUsedSize - initialRenderer.usedSize,
    initialPrivateBytes,
    maxPrivateBytes,
    privateGrowth: maxPrivateBytes - initialPrivateBytes,
    settledPrivateBytes,
    settledPrivateGrowth: settledPrivateBytes - initialPrivateBytes,
    initialNodes: initialRenderer.nodes,
    maxNodes,
    maxDrawingElements,
    samples,
    settledStructure,
  };
}

async function readRendererPrivateBytes(browserPid) {
  const command = `$ids=@(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${Number(browserPid)}" | Where-Object {$_.CommandLine -like '*--type=renderer*'} | Select-Object -ExpandProperty ProcessId); if($ids.Count){(Get-Process -Id $ids -ErrorAction SilentlyContinue | Measure-Object -Property PrivateMemorySize64 -Sum).Sum}else{0}`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true });
  return Number(String(stdout || "").trim()) || 0;
}

async function readTopLevelWindows(browserPid) {
  const command = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ForklineWindowProbe {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint command);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@
$windows = [Collections.Generic.List[object]]::new()
$callback = [ForklineWindowProbe+EnumWindowsProc]{
  param([IntPtr]$handle, [IntPtr]$state)
  [uint32]$windowProcessId = 0
  [ForklineWindowProbe]::GetWindowThreadProcessId($handle, [ref]$windowProcessId) | Out-Null
  if ($windowProcessId -eq ${Number(browserPid)}) {
    $length = [ForklineWindowProbe]::GetWindowTextLength($handle)
    $builder = [Text.StringBuilder]::new($length + 1)
    [ForklineWindowProbe]::GetWindowText($handle, $builder, $builder.Capacity) | Out-Null
    $extendedStyle = [ForklineWindowProbe]::GetWindowLongPtr($handle, -20).ToInt64()
    $windows.Add([pscustomobject]@{
      title = $builder.ToString()
      visible = [ForklineWindowProbe]::IsWindowVisible($handle)
      owner = [ForklineWindowProbe]::GetWindow($handle, 4).ToInt64()
      toolWindow = (($extendedStyle -band 0x80) -ne 0)
      appWindow = (($extendedStyle -band 0x40000) -ne 0)
    })
  }
  return $true
}
[ForklineWindowProbe]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
ConvertTo-Json -Compress -InputObject @($windows)
`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true });
  const parsed = JSON.parse(String(stdout || "[]").trim() || "[]");
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function measureRapidWheel(cdp, sourceIndex, paneSelector = "#fileEditorMerge .CodeMirror-scroll") {
  const selector = JSON.stringify(paneSelector);
  await evaluate(cdp, `(async () => {
    const panes = Array.from(document.querySelectorAll(${selector}));
    panes.forEach((pane) => { pane.scrollTop = 0; });
    await new Promise((resolve) => setTimeout(resolve, 350));
    return panes.map((pane) => pane.scrollTop);
  })()`);
  const prepared = await evaluate(cdp, `(() => {
    const panes = Array.from(document.querySelectorAll(${selector}));
    const traces = panes.map(() => []);
    const handlers = panes.map((pane, index) => () => traces[index].push(pane.scrollTop));
    panes.forEach((pane, index) => pane.addEventListener("scroll", handlers[index], { passive: true }));
    const heartbeat = { ticks: 0, maxDelay: 0, last: performance.now() };
    const timer = setInterval(() => {
      const now = performance.now();
      heartbeat.maxDelay = Math.max(heartbeat.maxDelay, now - heartbeat.last - 16);
      heartbeat.last = now;
      heartbeat.ticks += 1;
    }, 16);
    const longTasks = [];
    const observer = typeof PerformanceObserver === "function"
      ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
      : null;
    observer?.observe({ type: "longtask" });
    window.__forklineElectronScrollTest = { panes, traces, handlers, heartbeat, timer, longTasks, observer };
    const rect = panes[${sourceIndex}].getBoundingClientRect();
    return {
      x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
      paneCount: panes.length,
    };
  })()`);
  await dispatchWheel(cdp, prepared);
  return evaluate(cdp, `(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const session = window.__forklineElectronScrollTest;
    clearInterval(session.timer);
    session.observer?.disconnect();
    session.panes.forEach((pane, index) => pane.removeEventListener("scroll", session.handlers[index]));
    const upwardJumps = session.traces.map((trace) => trace.reduce(
      (maximum, top, index) => Math.max(maximum, index ? trace[index - 1] - top : 0),
      0
    ));
    const ratios = session.panes.map((pane) => pane.scrollTop / Math.max(1, pane.scrollHeight - pane.clientHeight));
    const tops = session.panes.map((pane) => pane.scrollTop);
    const result = {
      paneCount: session.panes.length,
      tops,
      topSpread: Math.max(...tops) - Math.min(...tops),
      traceLengths: session.traces.map((trace) => trace.length),
      upwardJumps,
      ratioSpread: Math.max(...ratios) - Math.min(...ratios),
      heartbeatTicks: session.heartbeat.ticks,
      maxHeartbeatDelay: session.heartbeat.maxDelay,
      maxLongTask: Math.max(0, ...session.longTasks),
      longTaskCount: session.longTasks.length,
    };
    delete window.__forklineElectronScrollTest;
    return result;
  })()`);
}

async function dispatchWheel(cdp, point, bursts = 4, eventsPerBurst = 20) {
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    buttons: 0,
  });
  for (let burst = 0; burst < bursts; burst += 1) {
    for (let index = 0; index < eventsPerBurst; index += 1) {
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: point.x,
        y: point.y,
        deltaX: 0,
        deltaY: 120,
      });
      await delay(3);
    }
    await delay(120);
  }
}

async function measureRapidScrollbarDrag(cdp) {
  const point = await evaluate(cdp, `(() => {
    const bindings = state.fileEditor?.scrollSyncHandlers || [];
    const scrollToCalls = bindings.map(() => 0);
    const originals = bindings.map(({ source }, index) => {
      const original = source.scrollTo.bind(source);
      source.scrollTo = (...args) => {
        scrollToCalls[index] += 1;
        return original(...args);
      };
      return original;
    });
    bindings.forEach(({ source }) => source.scrollTo(null, 0));
    scrollToCalls.fill(0);
    const scrollbar = bindings[0]?.source?.getWrapperElement?.().querySelector(".CodeMirror-vscrollbar");
    const rect = scrollbar.getBoundingClientRect();
    const thumbHeight = Math.max(20, rect.height * (rect.height / Math.max(rect.height, scrollbar.scrollHeight)));
    window.__forklineScrollbarDragProbe = { bindings, originals, scrollToCalls };
    return {
      x: rect.left + rect.width / 2,
      startY: rect.top + thumbHeight / 2,
      endY: rect.bottom - thumbHeight / 2,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      clientHeight: scrollbar.clientHeight,
      scrollHeight: scrollbar.scrollHeight,
    };
  })()`);
  await delay(100);
  await dispatchScrollbarDrag(cdp);
  await delay(350);
  return evaluate(cdp, `(() => {
    const probe = window.__forklineScrollbarDragProbe;
    const tops = probe.bindings.map(({ source }) => source.getScrollInfo().top);
    const ratios = probe.bindings.map(({ source }) => {
      const info = source.getScrollInfo();
      return info.top / Math.max(1, info.height - info.clientHeight);
    });
    probe.bindings.forEach(({ source }, index) => { source.scrollTo = probe.originals[index]; });
    delete window.__forklineScrollbarDragProbe;
    return {
      tops,
      topSpread: Math.max(...tops) - Math.min(...tops),
      ratioSpread: Math.max(...ratios) - Math.min(...ratios),
      scrollToCalls: probe.scrollToCalls,
      point: ${JSON.stringify(point)},
      scrollbar: (() => {
        const bar = probe.bindings[0]?.source?.getWrapperElement?.().querySelector(".CodeMirror-vscrollbar");
        return { top: bar?.scrollTop || 0, clientHeight: bar?.clientHeight || 0, scrollHeight: bar?.scrollHeight || 0 };
      })(),
    };
  })()`);
}

async function dispatchScrollbarDrag(cdp, steps = 36) {
  await evaluate(cdp, `(() => {
    const binding = state.fileEditor?.scrollSyncHandlers?.[0];
    const scrollbar = binding?.source?.getWrapperElement?.().querySelector(".CodeMirror-vscrollbar");
    const maximum = Math.max(0, scrollbar.scrollHeight - scrollbar.clientHeight);
    for (let step = 1; step <= ${Number(steps)}; step += 1) {
      scrollbar.scrollTop = maximum * (step / ${Number(steps)});
      scrollbar.dispatchEvent(new Event("scroll"));
    }
  })()`);
}

function assertRapidWheel(t, label, metrics, paneCount, { exactTop = true } = {}) {
  t.diagnostic(
    `${label}: traces ${metrics.traceLengths.join("/")}, tops ${metrics.tops.map((top) => top.toFixed(1)).join("/")}, upward ${metrics.upwardJumps.map((jump) => jump.toFixed(1)).join("/")}, top spread ${metrics.topSpread.toFixed(1)}, ratio spread ${metrics.ratioSpread.toFixed(4)}, heartbeat ${metrics.heartbeatTicks} ticks / ${metrics.maxHeartbeatDelay.toFixed(1)} ms max delay, long tasks ${metrics.longTaskCount} / ${metrics.maxLongTask.toFixed(1)} ms max`
  );
  assert.equal(metrics.paneCount, paneCount, `${label} pane count`);
  assert.ok(metrics.traceLengths.every((length) => length > 0), `${label} did not produce scroll events in every pane`);
  assert.ok(metrics.tops.every((top) => top > 0), `${label} did not move every pane downward`);
  assert.ok(Math.max(...metrics.upwardJumps) <= 3, `${label} moved a pane upward`);
  if (exactTop) {
    assert.ok(metrics.topSpread <= 1, `${label} stopped with panes ${metrics.topSpread.toFixed(1)} px apart`);
  }
  assert.ok(metrics.ratioSpread <= 0.02, `${label} left panes ${metrics.ratioSpread.toFixed(4)} apart`);
  assert.ok(metrics.heartbeatTicks >= 10, `${label} heartbeat stopped during wheel scrolling`);
  assert.ok(metrics.maxHeartbeatDelay < 500, `${label} blocked for ${metrics.maxHeartbeatDelay.toFixed(1)} ms`);
  assert.ok(metrics.maxLongTask < 500, `${label} produced a ${metrics.maxLongTask.toFixed(1)} ms long task`);
}

async function createFixture(repo) {
  await fs.mkdir(repo, { recursive: true });
  await git("", ["init", "--initial-branch=main", repo]);
  await git(repo, ["config", "user.name", "Forkline Electron Test"]);
  await git(repo, ["config", "user.email", "forkline-electron@example.invalid"]);
  await git(repo, ["config", "core.autocrlf", "false"]);
  const ordinaryBase = Array.from({ length: 8000 }, (_, index) => `int scroll_${String(index).padStart(5, "0")} = ${index};`);
  const lightweightBase = Array.from({ length: 21000 }, (_, index) => `int light_${String(index).padStart(5, "0")} = ${index};`);
  const conflictBase = Array.from({ length: 4000 }, (_, index) => `int conflict_${String(index).padStart(5, "0")} = ${index};`);
  await fs.writeFile(path.join(repo, "ordinary-scroll.c"), `${ordinaryBase.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(repo, "lightweight-scroll.c"), `${lightweightBase.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(repo, "conflict-scroll.c"), `${conflictBase.join("\n")}\n`, "utf8");
  await git(repo, ["add", "ordinary-scroll.c", "lightweight-scroll.c", "conflict-scroll.c"]);
  await git(repo, ["commit", "-m", "add scroll fixtures"]);

  await git(repo, ["checkout", "-b", "conflict-side"]);
  const conflictSide = [...conflictBase];
  for (let index = 0; index < conflictSide.length; index += 500) conflictSide[index] += " // side";
  await fs.writeFile(path.join(repo, "conflict-scroll.c"), `${conflictSide.join("\n")}\n`, "utf8");
  await git(repo, ["add", "conflict-scroll.c"]);
  await git(repo, ["commit", "-m", "change conflict fixture on side"]);

  await git(repo, ["checkout", "main"]);
  const ordinaryHead = [...ordinaryBase];
  const lightweightHead = [...lightweightBase];
  const conflictMain = [...conflictBase];
  for (let index = 0; index < ordinaryHead.length; index += 600) ordinaryHead[index] += " // committed";
  for (let index = 0; index < lightweightHead.length; index += 1500) lightweightHead[index] += " // committed";
  for (let index = 0; index < conflictMain.length; index += 500) conflictMain[index] += " // main";
  await fs.writeFile(path.join(repo, "ordinary-scroll.c"), `${ordinaryHead.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(repo, "lightweight-scroll.c"), `${lightweightHead.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(repo, "conflict-scroll.c"), `${conflictMain.join("\n")}\n`, "utf8");
  await git(repo, ["add", "ordinary-scroll.c", "lightweight-scroll.c", "conflict-scroll.c"]);
  await git(repo, ["commit", "-m", "change scroll fixtures on main"]);
  const head = await git(repo, ["rev-parse", "HEAD"]);
  await assert.rejects(git(repo, ["merge", "conflict-side", "--no-edit"]), /CONFLICT|Automatic merge failed|failed/i);

  const ordinaryWorktree = [...ordinaryHead];
  const lightweightWorktree = [...lightweightHead];
  for (let index = 300; index < ordinaryWorktree.length; index += 600) ordinaryWorktree[index] += " // working";
  for (let index = 750; index < lightweightWorktree.length; index += 1500) lightweightWorktree[index] += " // working";
  await fs.writeFile(path.join(repo, "ordinary-scroll.c"), `${ordinaryWorktree.join("\n")}\n`, "utf8");
  await fs.writeFile(path.join(repo, "lightweight-scroll.c"), `${lightweightWorktree.join("\n")}\n`, "utf8");
  return { head };
}

async function git(repo, args) {
  const fullArgs = repo ? ["-C", repo, ...args] : args;
  const { stdout } = await execFileAsync("git", fullArgs, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: nullConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
    },
  });
  return String(stdout || "").trim();
}

async function freePort() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForTarget(port, processHandle, readLog, predicate) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Electron exited early:\n${readLog()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.webSocketDebuggerUrl && predicate(item));
      if (target) return target;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for Electron DevTools target:\n${readLog()}`);
}

async function waitForExpression(cdp, expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for Electron expression: ${expression}`);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Electron evaluation failed";
    throw new Error(detail);
  }
  return response.result?.value;
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () => this.rejectPending(new Error("Electron DevTools connection closed")));
    socket.addEventListener("error", () => this.rejectPending(new Error("Electron DevTools connection failed")));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Electron DevTools")), 10000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Unable to connect to Electron DevTools"));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Electron DevTools connection is not open"));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`Timed out waiting for Electron DevTools command: ${method}`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
  }

  handleMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data || ""));
    } catch {
      return;
    }
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(`${message.error.message || "DevTools command failed"} (${message.error.code || "unknown"})`));
    else pending.resolve(message.result || {});
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function stopProcessTree(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(processHandle.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    return;
  }
  const exited = once(processHandle, "exit");
  processHandle.kill();
  await Promise.race([exited, delay(3000)]);
  if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
}

function appendLog(current, chunk) {
  return `${current}${String(chunk || "")}`.slice(-20000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
