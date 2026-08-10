"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { once } = require("node:events");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const serverPath = path.join(projectRoot, "server.js");
const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const browserExecutable = findChromiumExecutable();
const browserRequired = process.env.FORKLINE_REQUIRE_BROWSER === "1" || process.env.npm_lifecycle_event === "test:browser";
const largeHistoryMainCommits = 2500;
const largeHistoryFeatureGroups = 10;
const largeHistoryFeatureCommits = 50;
const largeWorktreeFileCount = 4000;
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: nullConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
  LC_ALL: "C",
  LANG: "C",
};

test("real Chromium keeps historical file comparison responsive", {
  skip: browserExecutable || browserRequired ? false : "No supported Chromium browser is installed",
  timeout: 120000,
}, async (t) => {
  assert.ok(browserExecutable, "Install Microsoft Edge, Google Chrome, or Chromium, or set FORKLINE_BROWSER_PATH");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-browser-performance-"));
  const repo = path.join(root, "repo");
  const profile = path.join(root, "browser-profile");
  let serverProcess = null;
  let browserProcess = null;
  let cdp = null;
  let serverLog = "";
  let browserLog = "";

  t.after(async () => {
    cdp?.close();
    await stopBrowser(browserProcess);
    await stopProcess(serverProcess);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const head = await createComparisonFixture(repo);
  const alternateRepo = path.join(root, "alternate-repo");
  const alternateHead = await createComparisonFixture(alternateRepo);
  const conflictRepo = path.join(root, "conflict-repo");
  await createConflictEditorFixture(conflictRepo);
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env: {
      ...gitEnv,
      PORT: String(port),
      FORKLINE_NO_OPEN: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", (chunk) => {
    serverLog = appendLog(serverLog, chunk);
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverLog = appendLog(serverLog, chunk);
  });
  await waitForServer(baseUrl, serverProcess, () => serverLog);
  await openRepository(baseUrl, repo);

  browserProcess = spawn(browserExecutable, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--window-size=1280,900",
    "about:blank",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  browserProcess.stdout.on("data", (chunk) => {
    browserLog = appendLog(browserLog, chunk);
  });
  browserProcess.stderr.on("data", (chunk) => {
    browserLog = appendLog(browserLog, chunk);
  });

  const devToolsPort = await waitForDevToolsPort(profile, browserProcess, () => browserLog);
  const target = await waitForPageTarget(devToolsPort, browserProcess, () => browserLog);
  cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: baseUrl });
  await waitForPageReady(cdp);

  const initialEditorResources = await evaluate(cdp, `({
    codeMirror: typeof CodeMirror,
    editor: typeof openFileEditor,
    loadedResources: document.querySelectorAll("[data-file-editor-resource]").length,
  })`);
  assert.equal(initialEditorResources.codeMirror, "undefined");
  assert.equal(initialEditorResources.editor, "undefined");
  assert.equal(initialEditorResources.loadedResources, 0);

  const initialLocaleResources = await evaluate(cdp, `({
    locale: state.locale,
    englishTranslation: window.ForklineI18nCatalog.translateKnown("en", "打开"),
    loadedResources: document.querySelectorAll("[data-i18n-catalog-resource]").length,
  })`);
  assert.equal(initialLocaleResources.locale, "zh-CN");
  assert.equal(initialLocaleResources.englishTranslation, "打开");
  assert.equal(initialLocaleResources.loadedResources, 0);

  const englishLocale = await evaluate(cdp, `(async () => {
    await setLocale("en", false);
    const result = {
      locale: state.locale,
      translated: t("设置"),
      loadedResources: document.querySelectorAll('[data-i18n-catalog-resource][data-loaded="true"]').length,
    };
    await setLocale("zh-CN", false);
    return result;
  })()`);
  assert.equal(englishLocale.locale, "en");
  assert.equal(englishLocale.translated, "Settings");
  assert.equal(englishLocale.loadedResources, 1);

  const baselineResizeListeners = await countWindowListeners(cdp, "resize");
  const complex = await evaluate(cdp, `(async () => {
    let maxDelay = 0;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const openStarted = performance.now();
    const opened = await openCommitFileViewerLazy("complex.c", "", ${JSON.stringify(head)});
    const openMs = performance.now() - openStarted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    const scrollers = Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"));
    const scrollStarted = performance.now();
    scrollers[0].scrollTop = 50000;
    scrollers[0].dispatchEvent(new Event("scroll"));
    const scrollMs = performance.now() - scrollStarted;
    const result = {
      opened,
      openMs,
      maxDelay,
      scrollMs,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
      status: document.querySelector("#fileEditorStatus").textContent,
      loadedResources: document.querySelectorAll('[data-file-editor-resource][data-loaded="true"]').length,
      synchronized: scrollers.length === 2 && Math.abs(scrollers[0].scrollTop - scrollers[1].scrollTop) < 1,
    };
    const closeStarted = performance.now();
    closeFileEditor(true);
    result.closeMs = performance.now() - closeStarted;
    result.remainingCodeMirrors = document.querySelectorAll("#fileEditorMerge .CodeMirror").length;
    return result;
  })()`);

  assert.equal(complex.opened, true);
  assert.equal(complex.mergeViews, 0);
  assert.equal(complex.codeMirrors, 2);
  assert.equal(complex.compareHidden, true);
  assert.match(complex.status, /复杂文件轻量模式 · 行数较多/);
  assert.equal(complex.synchronized, true);
  assert.equal(complex.loadedResources, 35);
  assert.equal(complex.remainingCodeMirrors, 0);
  assert.ok(complex.openMs < 5000, `complex comparison opened in ${complex.openMs.toFixed(1)} ms`);
  assert.ok(complex.maxDelay < 1500, `complex comparison blocked the event loop for ${complex.maxDelay.toFixed(1)} ms`);
  assert.ok(complex.scrollMs < 250, `complex comparison scroll handler took ${complex.scrollMs.toFixed(1)} ms`);
  assert.ok(complex.closeMs < 250, `complex comparison close took ${complex.closeMs.toFixed(1)} ms`);
  const warmedResizeListeners = await countWindowListeners(cdp, "resize");
  assert.ok(
    warmedResizeListeners >= baselineResizeListeners && warmedResizeListeners <= baselineResizeListeners + 1,
    `CodeMirror warm-up changed resize listeners from ${baselineResizeListeners} to ${warmedResizeListeners}`
  );

  const scattered = await evaluate(cdp, `(async () => {
    const opened = await openCommitFileViewerLazy("scattered.c", "", ${JSON.stringify(head)});
    const result = {
      opened,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
      status: document.querySelector("#fileEditorStatus").textContent,
    };
    closeFileEditor(true);
    return result;
  })()`);
  assert.equal(scattered.opened, true);
  assert.equal(scattered.mergeViews, 0);
  assert.equal(scattered.codeMirrors, 2);
  assert.equal(scattered.compareHidden, true);
  assert.match(scattered.status, /复杂文件轻量模式 · 差异较复杂/);
  assert.equal(await countWindowListeners(cdp, "resize"), warmedResizeListeners);

  const smallOpened = await evaluate(cdp, `(async () => {
    const started = performance.now();
    const opened = await openCommitFileViewerLazy("small.c", "", ${JSON.stringify(head)});
    return {
      opened,
      openMs: performance.now() - started,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
    };
  })()`);
  assert.equal(smallOpened.opened, true);
  assert.equal(smallOpened.mergeViews, 1);
  assert.equal(smallOpened.compareHidden, false);
  assert.ok(smallOpened.openMs < 2000, `small comparison opened in ${smallOpened.openMs.toFixed(1)} ms`);
  const smallResizeListeners = await countWindowListeners(cdp, "resize");
  assert.equal(smallResizeListeners, warmedResizeListeners + 1);

  const switches = await evaluate(cdp, `(() => {
    const modes = ["align", "connect", "align", "connect", "align", "connect", "align", "connect"];
    const started = performance.now();
    const results = modes.map((mode) => setFileEditorCompareMode(mode));
    return {
      elapsed: performance.now() - started,
      allSucceeded: results.every(Boolean),
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
    };
  })()`);
  assert.equal(switches.allSucceeded, true);
  assert.equal(switches.mergeViews, 1);
  assert.equal(switches.codeMirrors, 2);
  assert.ok(switches.elapsed < 2000, `eight comparison switches took ${switches.elapsed.toFixed(1)} ms`);
  const switchedResizeListeners = await countWindowListeners(cdp, "resize");
  assert.equal(switchedResizeListeners, warmedResizeListeners + 1);

  const closed = await evaluate(cdp, `(() => {
    const started = performance.now();
    const result = closeFileEditor(true);
    return {
      result,
      elapsed: performance.now() - started,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
    };
  })()`);
  assert.equal(closed.result, true);
  assert.equal(closed.codeMirrors, 0);
  assert.ok(closed.elapsed < 250, `small comparison close took ${closed.elapsed.toFixed(1)} ms`);
  const finalResizeListeners = await countWindowListeners(cdp, "resize");
  assert.equal(finalResizeListeners, warmedResizeListeners);
  t.diagnostic(
    `complex open ${complex.openMs.toFixed(1)} ms, max event-loop delay ${complex.maxDelay.toFixed(1)} ms, scroll ${complex.scrollMs.toFixed(1)} ms, close ${complex.closeMs.toFixed(1)} ms`
  );
  t.diagnostic(
    `small open ${smallOpened.openMs.toFixed(1)} ms, eight switches ${switches.elapsed.toFixed(1)} ms, resize listeners ${baselineResizeListeners} -> ${warmedResizeListeners} -> ${smallResizeListeners} -> ${switchedResizeListeners} -> ${finalResizeListeners}`
  );

  const slowEditorFallback = await evaluate(cdp, `(async () => {
    const originalMergeView = CodeMirror.MergeView;
    CodeMirror.MergeView = function (node, options) {
      const deadline = performance.now() + 300;
      while (performance.now() < deadline) {}
      return originalMergeView(node, options);
    };
    let firstOpened = false;
    try {
      firstOpened = await openCommitFileViewerLazy("small.c", "", ${JSON.stringify(head)});
    } finally {
      CodeMirror.MergeView = originalMergeView;
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const slowEntry = getUiDiagnostics().find((item) => item.type === "editor-slow" && item.context?.editor?.file === "small.c");
    renderLogsTab();
    const first = {
      opened: firstOpened,
      lightweight: state.fileEditor?.lightweightCompare,
      reason: state.fileEditor?.lightweightReason,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      status: document.querySelector("#fileEditorStatus")?.textContent || "",
      slowDuration: slowEntry?.durationMs || 0,
      diagnosticRows: document.querySelectorAll(".ui-diagnostic-item").length,
      copyButton: Boolean(document.querySelector("[data-ui-diagnostics-copy]")),
      clearButton: Boolean(document.querySelector("[data-ui-diagnostics-clear]")),
    };
    closeFileEditor(true);

    const reopenStarted = performance.now();
    const reopened = await openCommitFileViewerLazy("small.c", "", ${JSON.stringify(head)});
    const reopenMs = performance.now() - reopenStarted;
    const second = {
      opened: reopened,
      reopenMs,
      lightweight: state.fileEditor?.lightweightCompare,
      reason: state.fileEditor?.lightweightReason,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
    };
    closeFileEditor(true);
    return {
      first,
      second,
      remainingCodeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      remainingMergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
    };
  })()`);
  assert.equal(slowEditorFallback.first.opened, true);
  assert.equal(slowEditorFallback.first.lightweight, true);
  assert.equal(slowEditorFallback.first.reason, "slow");
  assert.equal(slowEditorFallback.first.mergeViews, 0);
  assert.equal(slowEditorFallback.first.codeMirrors, 2);
  assert.match(slowEditorFallback.first.status, /复杂文件轻量模式 · 响应较慢，已自动切换/);
  assert.ok(slowEditorFallback.first.slowDuration >= 250);
  assert.ok(slowEditorFallback.first.diagnosticRows >= 1);
  assert.equal(slowEditorFallback.first.copyButton, true);
  assert.equal(slowEditorFallback.first.clearButton, true);
  assert.equal(slowEditorFallback.second.opened, true);
  assert.equal(slowEditorFallback.second.lightweight, true);
  assert.equal(slowEditorFallback.second.reason, "slow");
  assert.equal(slowEditorFallback.second.mergeViews, 0);
  assert.equal(slowEditorFallback.second.codeMirrors, 2);
  assert.ok(slowEditorFallback.second.reopenMs < 2000, `remembered slow comparison reopened in ${slowEditorFallback.second.reopenMs.toFixed(1)} ms`);
  assert.equal(slowEditorFallback.remainingCodeMirrors, 0);
  assert.equal(slowEditorFallback.remainingMergeViews, 0);
  assert.equal(await countWindowListeners(cdp, "resize"), warmedResizeListeners);
  t.diagnostic(
    `slow editor fallback ${slowEditorFallback.first.slowDuration.toFixed(1)} ms, remembered reopen ${slowEditorFallback.second.reopenMs.toFixed(1)} ms`
  );

  const conflictMetrics = await evaluate(cdp, `(async () => {
    await openRepo(${JSON.stringify(conflictRepo)});
    let maxDelay = 0;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const smallStarted = performance.now();
    const smallOpened = await openFileEditorLazy("small-conflict.c");
    const smallOpenMs = performance.now() - smallStarted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    const incomingButton = document.querySelector("#fileEditorMerge .CodeMirror-merge-copybuttons-right .CodeMirror-merge-copy");
    let appliedClicks = 0;
    while (state.fileEditor?.codeMirror?.getValue?.() !== "side\\n" && appliedClicks < 8) {
      const button = document.querySelector("#fileEditorMerge .CodeMirror-merge-copybuttons-right .CodeMirror-merge-copy");
      if (!button) break;
      button.click();
      appliedClicks += 1;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const appliedValue = state.fileEditor?.codeMirror?.getValue?.() || "";
    const small = {
      opened: smallOpened,
      openMs: smallOpenMs,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge-3pane").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      currentLabel: document.querySelector("#fileEditorOldLabel")?.textContent || "",
      resultLabel: document.querySelector("#fileEditorResultLabel")?.textContent || "",
      incomingLabel: document.querySelector("#fileEditorNewLabel")?.textContent || "",
      incomingButton: incomingButton?.textContent || "",
      appliedClicks,
      appliedValue,
    };
    await submitFileEditor({ preventDefault() {} });
    small.savedValue = state.fileEditor?.codeMirror?.getValue?.() || "";
    closeFileEditor(true);

    const largeStarted = performance.now();
    const largeOpened = await openFileEditorLazy("large-conflict.c");
    const largeOpenMs = performance.now() - largeStarted;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const panes = [state.fileEditor?.oldCodeMirror, state.fileEditor?.codeMirror, state.fileEditor?.theirsCodeMirror].filter(Boolean);
    panes[0]?.scrollTo(0, 500000);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const visibleLines = panes.map((pane) => {
      const info = pane.getScrollInfo();
      return pane.lineAtHeight(info.top, "local");
    });
    const scrollRatios = panes.map((pane) => {
      const info = pane.getScrollInfo();
      return info.top / Math.max(1, info.height - info.clientHeight);
    });
    const large = {
      opened: largeOpened,
      openMs: largeOpenMs,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      status: document.querySelector("#fileEditorStatus")?.textContent || "",
      visibleLines,
      scrollRatios,
    };
    closeFileEditor(true);

    let reopenFailures = 0;
    const reopenStarted = performance.now();
    for (let index = 0; index < 8; index += 1) {
      if (!await openFileEditorLazy("small-conflict.c")) reopenFailures += 1;
      closeFileEditor(true);
    }
    const reopenMs = performance.now() - reopenStarted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    await openRepo(${JSON.stringify(repo)});
    return {
      small,
      large,
      reopenFailures,
      reopenMs,
      maxDelay,
      remainingCodeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      remainingMergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
    };
  })()`);
  assert.equal(conflictMetrics.small.opened, true);
  assert.equal(conflictMetrics.small.mergeViews, 1);
  assert.equal(conflictMetrics.small.codeMirrors, 3);
  assert.match(conflictMetrics.small.currentLabel, /当前版本/);
  assert.match(conflictMetrics.small.resultLabel, /合并结果/);
  assert.match(conflictMetrics.small.incomingLabel, /对方版本/);
  assert.equal(conflictMetrics.small.incomingButton, "应用");
  assert.ok(conflictMetrics.small.appliedClicks > 0 && conflictMetrics.small.appliedClicks <= 8);
  assert.equal(conflictMetrics.small.appliedValue, "side\n");
  assert.equal(conflictMetrics.small.savedValue, "side\n");
  assert.ok(conflictMetrics.small.openMs < 2000, `small conflict editor opened in ${conflictMetrics.small.openMs.toFixed(1)} ms`);
  assert.equal(conflictMetrics.large.opened, true);
  assert.equal(conflictMetrics.large.mergeViews, 0);
  assert.equal(conflictMetrics.large.codeMirrors, 3);
  assert.match(conflictMetrics.large.status, /复杂文件轻量模式 · 行数较多/);
  assert.ok(Math.max(...conflictMetrics.large.scrollRatios) - Math.min(...conflictMetrics.large.scrollRatios) <= 0.01);
  assert.ok(conflictMetrics.large.openMs < 5000, `large conflict editor opened in ${conflictMetrics.large.openMs.toFixed(1)} ms`);
  assert.equal(conflictMetrics.reopenFailures, 0);
  assert.ok(conflictMetrics.reopenMs < 5000, `eight conflict editor reopen cycles took ${conflictMetrics.reopenMs.toFixed(1)} ms`);
  assert.ok(conflictMetrics.maxDelay < 1500, `conflict editor blocked the event loop for ${conflictMetrics.maxDelay.toFixed(1)} ms`);
  assert.equal(conflictMetrics.remainingCodeMirrors, 0);
  assert.equal(conflictMetrics.remainingMergeViews, 0);
  assert.equal(await countWindowListeners(cdp, "resize"), warmedResizeListeners);
  t.diagnostic(
    `conflict editor small ${conflictMetrics.small.openMs.toFixed(1)} ms, large ${conflictMetrics.large.openMs.toFixed(1)} ms, eight reopen cycles ${conflictMetrics.reopenMs.toFixed(1)} ms, max delay ${conflictMetrics.maxDelay.toFixed(1)} ms`
  );

  const largeHistory = await appendLargeHistoryFixture(repo);
  const historyMetrics = await evaluate(cdp, `(async () => {
    let maxDelay = 0;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const requestStarted = performance.now();
    const data = await api("/api/ref-state?ref=&limit=${largeHistory.commitCount + 20}");
    const apiMs = performance.now() - requestStarted;
    state.data.repo = { ...state.data.repo, ...(data.repo || {}) };
    state.data.commits = data.commits || [];
    state.data.history = data.history || {};
    applyHistoryState(state.data);
    state.selectedRef = "";
    state.selectedSha = state.data.commits[0]?.sha || "";
    const renderStarted = performance.now();
    renderCommits({ inspector: "never" });
    const renderMs = performance.now() - renderStarted;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const searchStarted = performance.now();
    els.searchInput.value = "large-history";
    renderCommits({ inspector: "never" });
    const searchMs = performance.now() - searchStarted;
    els.searchInput.value = "";
    const restoreStarted = performance.now();
    renderCommits({ inspector: "never" });
    const restoreMs = performance.now() - restoreStarted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    return {
      apiMs,
      renderMs,
      searchMs,
      restoreMs,
      maxDelay,
      loadedCommits: state.data.commits.length,
      renderedRows: document.querySelectorAll("#commitGraph .commit-row[data-sha]").length,
      rowParity: Array.from(document.querySelectorAll("#commitGraph .commit-row[data-row-index]"))
        .every((row) => row.classList.contains("row-alt") === (Number(row.dataset.rowIndex) % 2 === 1)),
      graphElements: document.querySelectorAll("#commitGraph .graph-lines *").length,
      graphNodes: document.querySelectorAll("#commitGraph *").length,
      pageNodes: document.querySelectorAll("body *").length,
    };
  })()`);
  assert.equal(historyMetrics.loadedCommits, largeHistory.commitCount);
  assert.equal(historyMetrics.rowParity, true);
  assert.ok(historyMetrics.renderedRows <= 160, `large history kept ${historyMetrics.renderedRows} commit rows in the DOM`);
  assert.ok(historyMetrics.graphElements <= 1000, `large history kept ${historyMetrics.graphElements} SVG elements in the DOM`);
  assert.ok(historyMetrics.pageNodes <= 12000, `large history kept ${historyMetrics.pageNodes} page nodes in the DOM`);
  assert.ok(historyMetrics.restoreMs < 500, `large history restore render took ${historyMetrics.restoreMs.toFixed(1)} ms`);
  assert.ok(historyMetrics.maxDelay < 750, `large history blocked the event loop for ${historyMetrics.maxDelay.toFixed(1)} ms`);
  t.diagnostic(
    `large history ${historyMetrics.loadedCommits} commits: API ${historyMetrics.apiMs.toFixed(1)} ms, render ${historyMetrics.renderMs.toFixed(1)} ms, search ${historyMetrics.searchMs.toFixed(1)} ms, restore ${historyMetrics.restoreMs.toFixed(1)} ms, max delay ${historyMetrics.maxDelay.toFixed(1)} ms, rows ${historyMetrics.renderedRows}, graph elements ${historyMetrics.graphElements}, page nodes ${historyMetrics.pageNodes}`
  );

  const viewportMetrics = await evaluate(cdp, `(async () => {
    const total = state.filtered.length;
    const middleIndex = Math.floor(total / 2);
    els.historyScroll.scrollTop = middleIndex * rowH;
    els.historyScroll.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const middleRows = Array.from(document.querySelectorAll("#commitGraph .commit-row[data-row-index]"));
    const middleFirst = Number(middleRows[0]?.dataset.rowIndex || -1);
    const middleLast = Number(middleRows[middleRows.length - 1]?.dataset.rowIndex || -1);
    const middleGraph = document.querySelector("#commitGraph .graph-lines");
    const nodeCircles = Array.from(middleGraph?.querySelectorAll("circle") || []);
    const alignedRow = middleRows.find((row) => {
      const rowIndex = Number(row.dataset.rowIndex || -1);
      return nodeCircles.some((circle) => Number(circle.getAttribute("cy")) === rowIndex * rowH + rowH / 2);
    });
    const alignedIndex = Number(alignedRow?.dataset.rowIndex || -1);
    const alignedNode = nodeCircles.find((circle) => Number(circle.getAttribute("cy")) === alignedIndex * rowH + rowH / 2);
    const alignedRowCenter = alignedRow ? alignedRow.getBoundingClientRect().top + alignedRow.getBoundingClientRect().height / 2 : -1;
    const alignedNodeCenter = alignedNode ? alignedNode.getBoundingClientRect().top + alignedNode.getBoundingClientRect().height / 2 : -1;

    let maxDelay = 0;
    let lastTick = performance.now();
    let maxRows = middleRows.length;
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const cycleStarted = performance.now();
    for (let index = 0; index < 80; index += 1) {
      const ratio = (index % 10) / 9;
      els.historyScroll.scrollTop = Math.floor((total - 1) * ratio) * rowH;
      els.historyScroll.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      maxRows = Math.max(maxRows, document.querySelectorAll("#commitGraph .commit-row[data-sha]").length);
    }
    const cycleMs = performance.now() - cycleStarted;
    await new Promise((resolve) => setTimeout(resolve, 50));
    clearInterval(timer);

    const targetIndex = Math.floor(total * 0.73);
    const targetSha = state.filtered[targetIndex].sha;
    state.selectedSha = targetSha;
    const selected = updateCommitSelection(targetSha);
    const selectedRow = document.querySelector('#commitGraph .commit-row[data-sha="' + targetSha + '"]');
    return {
      middleIndex,
      middleFirst,
      middleLast,
      middleGraphTop: Number.parseFloat(middleGraph?.style.top || "-1"),
      middleGraphPaths: middleGraph?.querySelectorAll("path").length || 0,
      alignedIndex,
      alignmentOffset: alignedRow && alignedNode ? Math.abs(alignedRowCenter - alignedNodeCenter) : -1,
      cycleMs,
      maxDelay,
      maxRows,
      selected,
      selectedVisible: Boolean(selectedRow?.classList.contains("selected")),
      selectedIndex: Number(selectedRow?.dataset.rowIndex || -1),
      selectedScrollTop: els.historyScroll.scrollTop,
    };
  })()`);
  assert.ok(viewportMetrics.middleFirst <= viewportMetrics.middleIndex && viewportMetrics.middleLast >= viewportMetrics.middleIndex);
  assert.ok(viewportMetrics.middleGraphTop >= 0);
  assert.ok(viewportMetrics.middleGraphPaths > 0);
  assert.ok(viewportMetrics.alignedIndex >= viewportMetrics.middleFirst && viewportMetrics.alignedIndex <= viewportMetrics.middleLast);
  assert.ok(viewportMetrics.alignmentOffset >= 0 && viewportMetrics.alignmentOffset < 1.5, `graph node missed its commit row center by ${viewportMetrics.alignmentOffset.toFixed(2)} px`);
  assert.ok(viewportMetrics.maxRows <= 160, `large history reached ${viewportMetrics.maxRows} rendered rows while scrolling`);
  assert.ok(viewportMetrics.cycleMs < 5000, `80 large-history scroll updates took ${viewportMetrics.cycleMs.toFixed(1)} ms`);
  assert.ok(viewportMetrics.maxDelay < 250, `large-history scrolling blocked the event loop for ${viewportMetrics.maxDelay.toFixed(1)} ms`);
  assert.equal(viewportMetrics.selected, true);
  assert.equal(viewportMetrics.selectedVisible, true);
  assert.equal(viewportMetrics.selectedIndex, Math.floor(historyMetrics.loadedCommits * 0.73));

  const loadMoreMetrics = await evaluate(cdp, `(async () => {
    const data = await api("/api/ref-state?ref=&limit=360");
    state.data.repo = { ...state.data.repo, ...(data.repo || {}) };
    state.data.commits = data.commits || [];
    state.data.history = data.history || {};
    applyHistoryState(state.data);
    state.selectedRef = "";
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderCommits({ inspector: "never" });
    els.historyScroll.scrollTop = 7200;
    els.historyScroll.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const beforeScrollTop = els.historyScroll.scrollTop;
    const beforeLoaded = state.data.commits.length;
    const beforeFooterTop = Number.parseFloat(document.querySelector("#commitGraph .history-load-more")?.style.top || "-1");
    await loadMoreCommits(document.querySelector("#commitGraph [data-load-more-commits]"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      beforeLoaded,
      afterLoaded: state.data.commits.length,
      beforeScrollTop,
      afterScrollTop: els.historyScroll.scrollTop,
      beforeFooterTop,
      afterFooterTop: Number.parseFloat(document.querySelector("#commitGraph .history-load-more")?.style.top || "-1"),
      renderedRows: document.querySelectorAll("#commitGraph .commit-row[data-sha]").length,
    };
  })()`);
  assert.equal(loadMoreMetrics.beforeLoaded, 360);
  assert.equal(loadMoreMetrics.afterLoaded, 480);
  assert.ok(Math.abs(loadMoreMetrics.afterScrollTop - loadMoreMetrics.beforeScrollTop) < 1);
  assert.equal(loadMoreMetrics.beforeFooterTop, 360 * 62);
  assert.equal(loadMoreMetrics.afterFooterTop, 480 * 62);
  assert.ok(loadMoreMetrics.renderedRows <= 160);
  t.diagnostic(
    `large history viewport: middle ${viewportMetrics.middleFirst}-${viewportMetrics.middleLast}, 80 scroll updates ${viewportMetrics.cycleMs.toFixed(1)} ms, max delay ${viewportMetrics.maxDelay.toFixed(1)} ms, max rows ${viewportMetrics.maxRows}; load-more ${loadMoreMetrics.beforeLoaded} -> ${loadMoreMetrics.afterLoaded} with scroll ${loadMoreMetrics.beforeScrollTop.toFixed(1)} -> ${loadMoreMetrics.afterScrollTop.toFixed(1)}`
  );

  await createLargeWorktreeFixture(repo);
  const worktreeMetrics = await evaluate(cdp, `(async () => {
    let maxDelay = 0;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const requestStarted = performance.now();
    const data = await api("/api/worktree");
    const apiMs = performance.now() - requestStarted;
    const warmRequestStarted = performance.now();
    const warmData = await api("/api/worktree");
    const warmApiMs = performance.now() - warmRequestStarted;
    state.data.workingFiles = data.workingFiles || [];
    state.data.worktreeSnapshot = data.worktreeSnapshot || "";
    state.data.repo = { ...state.data.repo, operation: data.operation || null };
    state.selectedFile = "";
    state.selectedChanges.clear();
    state.worktreeFilter = "";
    els.worktreeFilterInput.value = "";
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    let fileTreeListenerAdds = 0;
    EventTarget.prototype.addEventListener = function (...args) {
      if (
        this === els.changeList ||
        this === els.stagedChangeList ||
        els.changeList.contains(this) ||
        els.stagedChangeList.contains(this)
      ) {
        fileTreeListenerAdds += 1;
      }
      return originalAddEventListener.apply(this, args);
    };
    const renderStarted = performance.now();
    let renderMs;
    let filterMs;
    let restoreMs;
    let initialRenderedRows;
    let initialTreeNodes;
    let initialPageNodes;
    let filteredRows;
    let filteredFile;
    let restoredRows;
    let loadPasses = 0;
    let loadAllMs = 0;
    let loadedAllRows;
    try {
      renderStage();
      renderMs = performance.now() - renderStarted;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      initialRenderedRows = document.querySelectorAll("#changeList .file-row[data-file]").length;
      initialTreeNodes = document.querySelectorAll("#changeList *").length;
      initialPageNodes = document.querySelectorAll("body *").length;
      const filterStarted = performance.now();
      state.worktreeFilter = "file-03999";
      els.worktreeFilterInput.value = state.worktreeFilter;
      renderStage();
      filterMs = performance.now() - filterStarted;
      filteredRows = document.querySelectorAll("#changeList .file-row[data-file]").length;
      filteredFile = document.querySelector("#changeList .file-row[data-file]")?.dataset.file || "";
      state.worktreeFilter = "";
      els.worktreeFilterInput.value = "";
      const restoreStarted = performance.now();
      renderStage();
      restoreMs = performance.now() - restoreStarted;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      restoredRows = document.querySelectorAll("#changeList .file-row[data-file]").length;
      const loadAllStarted = performance.now();
      while (document.querySelectorAll("#changeList .file-row[data-file]").length < state.data.workingFiles.length && loadPasses < 10) {
        els.changeList.scrollTop = els.changeList.scrollHeight;
        els.changeList.dispatchEvent(new Event("scroll"));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        loadPasses += 1;
      }
      loadAllMs = performance.now() - loadAllStarted;
      loadedAllRows = document.querySelectorAll("#changeList .file-row[data-file]").length;
    } finally {
      EventTarget.prototype.addEventListener = originalAddEventListener;
    }
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    return {
      apiMs,
      warmApiMs,
      warmLoadedFiles: warmData.workingFiles?.length || 0,
      sameSnapshot: warmData.worktreeSnapshot === data.worktreeSnapshot,
      renderMs,
      filterMs,
      restoreMs,
      initialRenderedRows,
      initialTreeNodes,
      initialPageNodes,
      filteredRows,
      filteredFile,
      restoredRows,
      loadPasses,
      loadAllMs,
      loadedAllRows,
      maxDelay,
      loadedFiles: state.data.workingFiles.length,
      renderedRows: document.querySelectorAll("#changeList .file-row[data-file]").length,
      treeNodes: document.querySelectorAll("#changeList *").length,
      pageNodes: document.querySelectorAll("body *").length,
      fileTreeListenerAdds,
    };
  })()`);
  assert.equal(worktreeMetrics.warmLoadedFiles, worktreeMetrics.loadedFiles);
  assert.equal(worktreeMetrics.sameSnapshot, true);
  assert.ok(worktreeMetrics.initialRenderedRows <= 1000, `large worktree initially rendered ${worktreeMetrics.initialRenderedRows} rows`);
  assert.ok(worktreeMetrics.initialTreeNodes <= 6000, `large worktree initially kept ${worktreeMetrics.initialTreeNodes} tree nodes`);
  assert.equal(worktreeMetrics.filteredRows, 1);
  assert.match(worktreeMetrics.filteredFile, /file-03999\.txt$/);
  assert.ok(worktreeMetrics.restoredRows <= 1000, `large worktree restored ${worktreeMetrics.restoredRows} rows before scrolling`);
  assert.ok(worktreeMetrics.loadPasses > 0 && worktreeMetrics.loadPasses <= 10, `large worktree used ${worktreeMetrics.loadPasses} load passes`);
  assert.equal(worktreeMetrics.loadedAllRows, worktreeMetrics.loadedFiles);
  assert.ok(worktreeMetrics.fileTreeListenerAdds <= 8, `large worktree added ${worktreeMetrics.fileTreeListenerAdds} file-tree listeners while rendering`);
  t.diagnostic(
    `large worktree ${worktreeMetrics.loadedFiles} files: cold API ${worktreeMetrics.apiMs.toFixed(1)} ms, warm API ${worktreeMetrics.warmApiMs.toFixed(1)} ms, render ${worktreeMetrics.renderMs.toFixed(1)} ms, filter ${worktreeMetrics.filterMs.toFixed(1)} ms, restore ${worktreeMetrics.restoreMs.toFixed(1)} ms, load-all ${worktreeMetrics.loadAllMs.toFixed(1)} ms/${worktreeMetrics.loadPasses} passes, max delay ${worktreeMetrics.maxDelay.toFixed(1)} ms, listener adds ${worktreeMetrics.fileTreeListenerAdds}, initial/final rows ${worktreeMetrics.initialRenderedRows}/${worktreeMetrics.loadedAllRows}, initial/final tree nodes ${worktreeMetrics.initialTreeNodes}/${worktreeMetrics.treeNodes}, initial/final page nodes ${worktreeMetrics.initialPageNodes}/${worktreeMetrics.pageNodes}`
  );

  const progressiveOpenMetrics = await evaluate(cdp, `(async () => {
    await openRepo(${JSON.stringify(alternateRepo)});
    const originalRenderAll = renderAll;
    let firstRenderMs = -1;
    let firstProgressive = false;
    let firstLoadedFiles = -1;
    let firstHydrating = false;
    let firstLoadingText = "";
    let targetRenderCalls = 0;
    const started = performance.now();
    renderAll = function (...args) {
      const result = originalRenderAll.apply(this, args);
      if (
        String(state.data?.repo?.path || "").replaceAll("\\\\", "/").toLowerCase() ===
        ${JSON.stringify(repo.replaceAll("\\", "/").toLowerCase())}
      ) {
        targetRenderCalls += 1;
        if (firstRenderMs < 0) {
          firstRenderMs = performance.now() - started;
          firstProgressive = Boolean(state.data?.progressive);
          firstLoadedFiles = state.data?.workingFiles?.length || 0;
          firstHydrating = Boolean(state.repoHydrating);
          firstLoadingText = document.querySelector("#changeList")?.textContent || "";
        }
      }
      return result;
    };
    try {
      await openRepo(${JSON.stringify(repo)});
    } finally {
      renderAll = originalRenderAll;
    }
    return {
      firstRenderMs,
      firstProgressive,
      firstLoadedFiles,
      firstHydrating,
      firstLoadingText,
      totalMs: performance.now() - started,
      targetRenderCalls,
      finalLoadedFiles: state.data?.workingFiles?.length || 0,
      finalProgressive: Boolean(state.data?.progressive),
      finalHydrating: Boolean(state.repoHydrating),
    };
  })()`);
  assert.equal(progressiveOpenMetrics.firstProgressive, true);
  assert.equal(progressiveOpenMetrics.firstLoadedFiles, 0);
  assert.equal(progressiveOpenMetrics.firstHydrating, true);
  assert.match(progressiveOpenMetrics.firstLoadingText, /正在载入工作区和仓库详情/);
  assert.equal(progressiveOpenMetrics.finalLoadedFiles, largeWorktreeFileCount);
  assert.equal(progressiveOpenMetrics.finalProgressive, false);
  assert.equal(progressiveOpenMetrics.finalHydrating, false);
  assert.equal(progressiveOpenMetrics.targetRenderCalls, 1);
  assert.ok(progressiveOpenMetrics.firstRenderMs >= 0 && progressiveOpenMetrics.firstRenderMs < 1500, `progressive first render took ${progressiveOpenMetrics.firstRenderMs.toFixed(1)} ms`);
  assert.ok(progressiveOpenMetrics.firstRenderMs < progressiveOpenMetrics.totalMs, `progressive first render ${progressiveOpenMetrics.firstRenderMs.toFixed(1)} ms should precede full load ${progressiveOpenMetrics.totalMs.toFixed(1)} ms`);
  assert.ok(progressiveOpenMetrics.totalMs < 5000, `progressive full load took ${progressiveOpenMetrics.totalMs.toFixed(1)} ms`);
  t.diagnostic(
    `progressive repository open first render ${progressiveOpenMetrics.firstRenderMs.toFixed(1)} ms, full details ${progressiveOpenMetrics.totalMs.toFixed(1)} ms, files 0 -> ${progressiveOpenMetrics.finalLoadedFiles}`
  );

  const baselineRepoPath = await evaluate(cdp, `(async () => {
    await openRepo(${JSON.stringify(alternateRepo)});
    return state.data?.repo?.path || "";
  })()`);
  assert.equal(path.resolve(baselineRepoPath), path.resolve(alternateRepo));
  const soakResizeListenersBefore = await countWindowListeners(cdp, "resize");
  const soakMemoryBefore = await browserMemorySnapshot(cdp);
  const switchMetrics = await evaluate(cdp, `(async () => {
    const originalApi = api;
    const calls = [];
    api = async (...args) => {
      calls.push(String(args[0] || ""));
      return originalApi(...args);
    };
    const started = performance.now();
    try {
      for (let index = 0; index < 12; index += 1) {
        await openRepo(index % 2 === 0 ? ${JSON.stringify(repo)} : ${JSON.stringify(alternateRepo)});
      }
    } finally {
      api = originalApi;
    }
    return {
      elapsed: performance.now() - started,
      openCalls: calls.filter((url) => url === "/api/open").length,
      stateRefCalls: calls.filter((url) => url.startsWith("/api/state?ref=")).length,
      lightweightRefCalls: calls.filter((url) => url.startsWith("/api/ref-state?ref=")).length,
      commitCalls: calls.filter((url) => url.startsWith("/api/commit?sha=")).length,
      finalRepo: state.data?.repo?.path || "",
      pageNodes: document.querySelectorAll("body *").length,
    };
  })()`);
  assert.equal(switchMetrics.openCalls, 12);
  assert.equal(switchMetrics.stateRefCalls, 12);
  assert.equal(switchMetrics.lightweightRefCalls, 0);
  assert.equal(path.resolve(switchMetrics.finalRepo), path.resolve(alternateRepo));

  const editorSoak = await evaluate(cdp, `(async () => {
    let failures = 0;
    const started = performance.now();
    for (let index = 0; index < 30; index += 1) {
      const opened = await openCommitFileViewerLazy("small.c", "", ${JSON.stringify(alternateHead)});
      if (!opened) failures += 1;
      if (opened && index % 2 === 0) setFileEditorCompareMode("align");
      closeFileEditor(true);
    }
    return {
      elapsed: performance.now() - started,
      failures,
      remainingCodeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      remainingMergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      pageNodes: document.querySelectorAll("body *").length,
    };
  })()`);
  assert.equal(editorSoak.failures, 0);
  assert.equal(editorSoak.remainingCodeMirrors, 0);
  assert.equal(editorSoak.remainingMergeViews, 0);
  await delay(250);
  const soakMemoryAfter = await browserMemorySnapshot(cdp);
  const soakResizeListenersAfter = await countWindowListeners(cdp, "resize");
  assert.equal(soakResizeListenersAfter, soakResizeListenersBefore);
  assert.equal(soakMemoryAfter.documents, soakMemoryBefore.documents);
  assert.ok(soakMemoryAfter.nodes <= soakMemoryBefore.nodes + 250);
  assert.ok(soakMemoryAfter.jsEventListeners <= soakMemoryBefore.jsEventListeners + 10);
  assert.ok(soakMemoryAfter.heapUsed <= soakMemoryBefore.heapUsed + (4 * 1024 * 1024));
  t.diagnostic(
    `soak switches: ${switchMetrics.elapsed.toFixed(1)} ms, API open/state-ref/ref-state/commit ${switchMetrics.openCalls}/${switchMetrics.stateRefCalls}/${switchMetrics.lightweightRefCalls}/${switchMetrics.commitCalls}; editor open-close 30x ${editorSoak.elapsed.toFixed(1)} ms; resize listeners ${soakResizeListenersBefore} -> ${soakResizeListenersAfter}; DOM documents/nodes/listeners ${soakMemoryBefore.documents}/${soakMemoryBefore.nodes}/${soakMemoryBefore.jsEventListeners} -> ${soakMemoryAfter.documents}/${soakMemoryAfter.nodes}/${soakMemoryAfter.jsEventListeners}; heap ${(soakMemoryBefore.heapUsed / 1024 / 1024).toFixed(1)} MiB -> ${(soakMemoryAfter.heapUsed / 1024 / 1024).toFixed(1)} MiB`
  );
});

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () => this.rejectPending(new Error("Chromium DevTools connection closed")));
    socket.addEventListener("error", () => this.rejectPending(new Error("Chromium DevTools connection failed")));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chromium DevTools")), 10000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Unable to connect to Chromium DevTools"));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Chromium DevTools connection is not open"));
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
    if (message.error) pending.reject(new Error(`${message.error.message || "DevTools command failed"} (${message.error.code || "unknown"})`));
    else pending.resolve(message.result || {});
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

async function createComparisonFixture(repo) {
  await fs.mkdir(repo, { recursive: true });
  await git("", ["init", "--initial-branch=main", repo]);
  await git(repo, ["config", "user.name", "Forkline Browser Test"]);
  await git(repo, ["config", "user.email", "forkline-browser@example.invalid"]);
  await git(repo, ["config", "core.autocrlf", "false"]);

  const complex = Array.from({ length: 60000 }, (_, index) => `x${index}`);
  const scattered = Array.from({ length: 240 }, (_, index) => `int item_${index} = ${index};`);
  const small = Array.from({ length: 30 }, (_, index) => `int small_${index} = ${index};`);
  await writeFixtureFiles(repo, complex, scattered, small);
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "add browser performance fixtures"]);

  complex[30000] = "x30000_changed";
  for (let index = 0; index < 40; index += 1) {
    const lineIndex = index * 5 + 1;
    scattered[lineIndex] = `int item_${lineIndex} = ${lineIndex + 1000};`;
  }
  small[10] = "int small_10 = 1000;";
  await writeFixtureFiles(repo, complex, scattered, small);
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "change browser performance fixtures"]);
  return git(repo, ["rev-parse", "HEAD"]);
}

async function createConflictEditorFixture(repo) {
  await fs.mkdir(repo, { recursive: true });
  await git("", ["init", "--initial-branch=main", repo]);
  await git(repo, ["config", "user.name", "Forkline Browser Test"]);
  await git(repo, ["config", "user.email", "forkline-browser@example.invalid"]);
  await git(repo, ["config", "core.autocrlf", "false"]);

  const large = Array.from({ length: 25000 }, (_, index) => `int conflict_${String(index).padStart(5, "0")} = ${index};`);
  await fs.writeFile(path.join(repo, "small-conflict.c"), "base\n", "utf8");
  await fs.writeFile(path.join(repo, "large-conflict.c"), `${large.join("\n")}\n`, "utf8");
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "add conflict editor fixtures"]);

  await git(repo, ["checkout", "-b", "conflict-side"]);
  const sideLarge = [...large];
  sideLarge[12500] = "int conflict_12500 = 30000;";
  await fs.writeFile(path.join(repo, "small-conflict.c"), "side\n", "utf8");
  await fs.writeFile(path.join(repo, "large-conflict.c"), `${sideLarge.join("\n")}\n`, "utf8");
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "change conflict fixtures on side"]);

  await git(repo, ["checkout", "main"]);
  const mainLarge = [...large];
  mainLarge[12500] = "int conflict_12500 = 20000;";
  await fs.writeFile(path.join(repo, "small-conflict.c"), "main\n", "utf8");
  await fs.writeFile(path.join(repo, "large-conflict.c"), `${mainLarge.join("\n")}\n`, "utf8");
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "change conflict fixtures on main"]);
  await assert.rejects(git(repo, ["merge", "conflict-side", "--no-edit"]), /CONFLICT|Automatic merge failed|failed/i);
}

async function appendLargeHistoryFixture(repo) {
  const initialHead = await git(repo, ["rev-parse", "HEAD"]);
  const stream = [];
  let nextMark = 1;
  let mainParent = initialHead;
  let mainMark = 0;
  let commitCount = 0;
  let timestamp = 1700000000;

  const appendCommit = (ref, parent, message, file, content, merge = "") => {
    const mark = nextMark;
    nextMark += 1;
    timestamp += 1;
    stream.push(`commit ${ref}\n`);
    stream.push(`mark :${mark}\n`);
    stream.push(`author Forkline Browser Test <forkline-browser@example.invalid> ${timestamp} +0000\n`);
    stream.push(`committer Forkline Browser Test <forkline-browser@example.invalid> ${timestamp} +0000\n`);
    stream.push(`data ${Buffer.byteLength(message)}\n${message}\n`);
    stream.push(`from ${parent}\n`);
    if (merge) stream.push(`merge ${merge}\n`);
    stream.push(`M 100644 inline ${file}\n`);
    stream.push(`data ${Buffer.byteLength(content)}\n${content}\n`);
    commitCount += 1;
    return mark;
  };

  for (let group = 0; group < largeHistoryFeatureGroups; group += 1) {
    const branchBase = mainMark ? `:${mainMark}` : mainParent;
    for (let index = 0; index < largeHistoryMainCommits / largeHistoryFeatureGroups; index += 1) {
      const sequence = group * (largeHistoryMainCommits / largeHistoryFeatureGroups) + index + 1;
      const parent = mainMark ? `:${mainMark}` : mainParent;
      mainMark = appendCommit(
        "refs/heads/main",
        parent,
        `large-history main ${String(sequence).padStart(4, "0")}`,
        "history/main.txt",
        `main ${sequence}\n`
      );
    }

    let featureMark = 0;
    const featureRef = `refs/heads/perf-feature-${String(group + 1).padStart(2, "0")}`;
    for (let index = 0; index < largeHistoryFeatureCommits; index += 1) {
      const parent = featureMark ? `:${featureMark}` : branchBase;
      featureMark = appendCommit(
        featureRef,
        parent,
        `large-history feature ${group + 1}-${String(index + 1).padStart(2, "0")}`,
        `history/feature-${String(group + 1).padStart(2, "0")}.txt`,
        `feature ${group + 1} ${index + 1}\n`
      );
    }

    mainMark = appendCommit(
      "refs/heads/main",
      `:${mainMark}`,
      `large-history merge feature ${String(group + 1).padStart(2, "0")}`,
      "history/main.txt",
      `main merge ${group + 1}\n`,
      `:${featureMark}`
    );
    mainParent = `:${mainMark}`;
  }

  stream.push("done\n");
  await fastImport(repo, stream.join(""));
  await git(repo, ["reset", "--hard", "HEAD"]);
  return {
    commitCount: commitCount + 2,
    head: await git(repo, ["rev-parse", "HEAD"]),
  };
}

async function createLargeWorktreeFixture(repo) {
  const batchSize = 200;
  for (let start = 0; start < largeWorktreeFileCount; start += batchSize) {
    const writes = [];
    const end = Math.min(largeWorktreeFileCount, start + batchSize);
    for (let index = start; index < end; index += 1) {
      const directory = path.join(repo, "worktree", `group-${String(Math.floor(index / 40)).padStart(3, "0")}`);
      const file = path.join(directory, `file-${String(index).padStart(5, "0")}.txt`);
      writes.push(fs.mkdir(directory, { recursive: true }).then(() => fs.writeFile(file, `worktree ${index}\n`, "utf8")));
    }
    await Promise.all(writes);
  }
}

async function fastImport(repo, stream) {
  const child = spawn("git", ["-C", repo, "fast-import", "--quiet"], {
    env: gitEnv,
    stdio: ["pipe", "ignore", "pipe"],
    windowsHide: true,
  });
  let errorOutput = "";
  child.stderr.on("data", (chunk) => {
    errorOutput = appendLog(errorOutput, chunk);
  });
  child.stdin.end(stream);
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`git fast-import failed (${code}):\n${errorOutput}`);
}

async function writeFixtureFiles(repo, complex, scattered, small) {
  await Promise.all([
    fs.writeFile(path.join(repo, "complex.c"), `${complex.join("\n")}\n`, "utf8"),
    fs.writeFile(path.join(repo, "scattered.c"), `${scattered.join("\n")}\n`, "utf8"),
    fs.writeFile(path.join(repo, "small.c"), `${small.join("\n")}\n`, "utf8"),
  ]);
}

async function git(repo, args) {
  const fullArgs = repo ? ["-C", repo, ...args] : args;
  const { stdout } = await execFileAsync("git", fullArgs, {
    env: gitEnv,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return String(stdout || "").trim();
}

async function openRepository(baseUrl, repo) {
  const response = await fetch(`${baseUrl}/api/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: repo }),
  });
  if (!response.ok) throw new Error(`Unable to open browser performance fixture: ${await response.text()}`);
}

async function waitForServer(baseUrl, processHandle, readLog) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Forkline server exited early:\n${readLog()}`);
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Forkline server:\n${readLog()}`);
}

async function waitForDevToolsPort(profile, processHandle, readLog) {
  const activePortFile = path.join(profile, "DevToolsActivePort");
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Chromium exited before DevTools was ready:\n${readLog()}`);
    try {
      const [port] = (await fs.readFile(activePortFile, "utf8")).trim().split(/\r?\n/);
      if (Number(port) > 0) return Number(port);
    } catch {
      // Chromium is still creating its profile.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chromium DevTools port:\n${readLog()}`);
}

async function waitForPageTarget(port, processHandle, readLog) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Chromium exited before a page target was ready:\n${readLog()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
      // DevTools HTTP endpoint is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chromium page target:\n${readLog()}`);
}

async function waitForPageReady(cdp) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const ready = await evaluate(cdp, `Boolean(
        document.readyState === "complete" &&
        typeof state !== "undefined" &&
        state.data?.repo &&
        !state.data.repo.isSample &&
        typeof ensureFileEditorLoaded === "function" &&
        typeof openCommitFileViewerLazy === "function"
      )`);
      if (ready) return;
    } catch {
      // Navigation may still be replacing the execution context.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for the Forkline browser application");
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Browser evaluation failed";
    throw new Error(detail);
  }
  return response.result?.value;
}

async function countWindowListeners(cdp, type) {
  const objectGroup = `forkline-listeners-${Date.now()}-${Math.random()}`;
  const evaluated = await cdp.send("Runtime.evaluate", {
    expression: "window",
    objectGroup,
  });
  try {
    const objectId = evaluated.result?.objectId;
    if (!objectId) throw new Error("Unable to inspect Chromium window listeners");
    const response = await cdp.send("DOMDebugger.getEventListeners", { objectId });
    return response.listeners.filter((listener) => listener.type === type).length;
  } finally {
    await cdp.send("Runtime.releaseObjectGroup", { objectGroup }).catch(() => {});
  }
}

async function browserMemorySnapshot(cdp) {
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const [heap, dom] = await Promise.all([
    cdp.send("Runtime.getHeapUsage"),
    cdp.send("Memory.getDOMCounters"),
  ]);
  return {
    heapUsed: heap.usedSize || 0,
    documents: dom.documents || 0,
    nodes: dom.nodes || 0,
    jsEventListeners: dom.jsEventListeners || 0,
  };
}

async function freePort() {
  const socket = net.createServer();
  socket.unref();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function stopProcess(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  const exited = once(processHandle, "exit");
  processHandle.kill();
  await Promise.race([exited, delay(3000)]);
  if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
}

async function stopBrowser(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(processHandle.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    return;
  }
  await stopProcess(processHandle);
}

function findChromiumExecutable() {
  const candidates = [
    process.env.FORKLINE_BROWSER_PATH,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "",
    process.platform === "win32" ? "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" : "",
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
    process.platform === "darwin" ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" : "",
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "",
    process.platform === "linux" ? "/usr/bin/microsoft-edge" : "",
    process.platform === "linux" ? "/usr/bin/google-chrome" : "",
    process.platform === "linux" ? "/usr/bin/chromium" : "",
    process.platform === "linux" ? "/usr/bin/chromium-browser" : "",
  ].filter(Boolean);
  return candidates.find((candidate) => fsSync.existsSync(candidate)) || "";
}

function appendLog(current, chunk) {
  return `${current}${String(chunk || "")}`.slice(-16000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
