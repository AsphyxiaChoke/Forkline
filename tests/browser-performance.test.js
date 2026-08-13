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
const cdpCommandTimeoutMs = 30000;
const performanceBudgetScale = process.env.FORKLINE_BROWSER_PERFORMANCE_SCALE === "3" ? 3 : 1;
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: nullConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  XDG_CONFIG_HOME: path.join(os.tmpdir(), "forkline-git-test-config"),
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
    if (cdp) {
      await cdp.send("Browser.close").catch(() => {});
      cdp.close();
    }
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

  browserProcess = spawn(browserExecutable, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
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
  try {
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
  } catch (error) {
    throw new Error(
      `${error.message}\nDevTools target: ${target.webSocketDebuggerUrl}\nChromium exit code: ${browserProcess.exitCode ?? "running"}\n${browserLog}`,
      { cause: error }
    );
  }
  await cdp.send("Page.navigate", { url: baseUrl });
  await waitForPageReady(cdp);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 476,
    height: 1043,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const narrowPortraitLayout = await evaluate(cdp, `(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const viewportWidth = document.documentElement.clientWidth;
    const pathActions = document.querySelector(".path-actions")?.getBoundingClientRect();
    return {
      viewportWidth,
      shellScrollWidth: document.querySelector(".app-shell")?.scrollWidth || 0,
      topbarScrollWidth: document.querySelector(".topbar")?.scrollWidth || 0,
      pathActionsRight: pathActions?.right || 0,
    };
  })()`);
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  assert.ok(
    narrowPortraitLayout.shellScrollWidth <= narrowPortraitLayout.viewportWidth + 1,
    `476px portrait shell overflowed to ${narrowPortraitLayout.shellScrollWidth}px`
  );
  assert.ok(
    narrowPortraitLayout.topbarScrollWidth <= narrowPortraitLayout.viewportWidth + 1,
    `476px portrait topbar overflowed to ${narrowPortraitLayout.topbarScrollWidth}px`
  );
  assert.ok(
    narrowPortraitLayout.pathActionsRight <= narrowPortraitLayout.viewportWidth + 1,
    `476px portrait repository actions reached ${narrowPortraitLayout.pathActionsRight.toFixed(1)}px`
  );

  const initialEditorResources = await evaluate(cdp, `({
    isSample: Boolean(state.data?.repo?.isSample),
    codeMirror: typeof CodeMirror,
    editor: typeof openFileEditor,
    loadedResources: document.querySelectorAll("[data-file-editor-resource]").length,
  })`);
  assert.equal(initialEditorResources.isSample, true);
  assert.equal(initialEditorResources.codeMirror, "undefined");
  assert.equal(initialEditorResources.editor, "undefined");
  assert.equal(initialEditorResources.loadedResources, 0);

  const coldRepositoryOpen = await evaluate(cdp, `(async () => {
    const expectedPath = ${JSON.stringify(repo)};
    const normalizePath = (value) => String(value || "").replaceAll("\\\\", "/").replace(/\\/+$/, "").toLowerCase();
    const expected = normalizePath(expectedPath);
    const input = document.querySelector("#repoInput");
    input.value = expectedPath;
    document.querySelector("#openRepo").click();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (!state.repoHydrating && normalizePath(state.data?.repo?.path) === expected && !document.querySelector("#openRepo")?.disabled) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const serverState = await fetch("/api/state").then((response) => response.json());
    return {
      frontMatches: normalizePath(state.data?.repo?.path) === expected,
      serverMatches: normalizePath(serverState.repo?.path) === expected,
      isSample: Boolean(state.data?.repo?.isSample),
      repoHydrating: Boolean(state.repoHydrating),
      commitRows: document.querySelectorAll(".commit-row").length,
      editorSearchReset: typeof resetFileEditorSearchUi,
      editorResources: document.querySelectorAll("[data-file-editor-resource]").length,
      openButtonDisabled: Boolean(document.querySelector("#openRepo")?.disabled),
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
    };
  })()`);
  assert.equal(coldRepositoryOpen.frontMatches, true);
  assert.equal(coldRepositoryOpen.serverMatches, true);
  assert.equal(coldRepositoryOpen.isSample, false);
  assert.equal(coldRepositoryOpen.repoHydrating, false);
  assert.ok(coldRepositoryOpen.commitRows > 0, "cold repository open should render commit history");
  assert.equal(coldRepositoryOpen.editorSearchReset, "undefined");
  assert.equal(coldRepositoryOpen.editorResources, 0);
  assert.equal(coldRepositoryOpen.openButtonDisabled, false);
  assert.doesNotMatch(coldRepositoryOpen.toast, /is not defined/i);

  const initialContextMenuResources = await evaluate(cdp, `({
    implementation: typeof showCommitContextMenu,
    loader: typeof showCommitContextMenuLazy,
    loadedResources: document.querySelectorAll("[data-context-menu-resource]").length,
    loadedStyles: document.querySelectorAll("[data-context-menu-style]").length,
  })`);
  assert.equal(initialContextMenuResources.implementation, "undefined");
  assert.equal(initialContextMenuResources.loader, "function");
  assert.equal(initialContextMenuResources.loadedResources, 0);
  assert.equal(initialContextMenuResources.loadedStyles, 0);

  const initialFolderCommandResources = await evaluate(cdp, `({
    folderImplementation: typeof window.openFolderModal === "function",
    commandImplementation: typeof window.openCommandPalette === "function",
    loader: typeof openCommandPaletteLazy,
    inspectorContext: typeof switchInspectorTab,
    loadedScripts: document.querySelectorAll("[data-folder-command-resource]").length,
    loadedStyles: document.querySelectorAll("[data-folder-command-style]").length,
  })`);
  assert.equal(initialFolderCommandResources.folderImplementation, false);
  assert.equal(initialFolderCommandResources.commandImplementation, false);
  assert.equal(initialFolderCommandResources.loader, "function");
  assert.equal(initialFolderCommandResources.inspectorContext, "function");
  assert.equal(initialFolderCommandResources.loadedScripts, 0);
  assert.equal(initialFolderCommandResources.loadedStyles, 0);

  const initialDiffWorkbenchResources = await evaluate(cdp, `({
    implementation: typeof loadWorkingDiff,
    lineActions: typeof runWorkDiffLineAction,
    loader: typeof loadWorkingDiffLazy,
    stateHelpers: typeof setActiveDiff,
    loadedResources: document.querySelectorAll("[data-diff-workbench-resource]").length,
  })`);
  assert.equal(initialDiffWorkbenchResources.implementation, "undefined");
  assert.equal(initialDiffWorkbenchResources.lineActions, "undefined");
  assert.equal(initialDiffWorkbenchResources.loader, "function");
  assert.equal(initialDiffWorkbenchResources.stateHelpers, "function");
  assert.equal(initialDiffWorkbenchResources.loadedResources, 0);

  const initialGitActionResources = await evaluate(cdp, `({
    implementation: typeof window.ForklineGitActions,
    loader: typeof ensureGitActionsLoaded,
    snapshotHelper: typeof currentBranchSnapshotPayload,
    amendHelper: typeof updateAmendMode,
    loadedResources: document.querySelectorAll("[data-git-actions-resource]").length,
  })`);
  assert.equal(initialGitActionResources.implementation, "undefined");
  assert.equal(initialGitActionResources.loader, "function");
  assert.equal(initialGitActionResources.snapshotHelper, "function");
  assert.equal(initialGitActionResources.amendHelper, "function");
  assert.equal(initialGitActionResources.loadedResources, 0);

  const lazyGitActions = await evaluate(cdp, `(async () => {
    const started = performance.now();
    await Promise.all([ensureGitActionsLoaded(), ensureGitActionsLoaded()]);
    return {
      implementation: typeof window.ForklineGitActions?.runAction,
      resources: document.querySelectorAll('[data-git-actions-resource][data-loaded="true"]').length,
      loadMs: performance.now() - started,
    };
  })()`);
  assert.equal(lazyGitActions.implementation, "function");
  assert.equal(lazyGitActions.resources, 1);
  assert.ok(lazyGitActions.loadMs < 3000, `Git actions loaded in ${lazyGitActions.loadMs.toFixed(1)} ms`);
  t.diagnostic(`Git actions first loaded in ${lazyGitActions.loadMs.toFixed(1)} ms with ${lazyGitActions.resources} resource`);

  const actionStateRefresh = await evaluate(cdp, `(async () => {
    const repoPath = repoPathSnapshot();
    const originalFetch = window.fetch.bind(window);
    const previousRequestId = state.repoDetailRequestId;
    const previousLoads = state.repoDetailLoads;
    const requests = [];
    state.repoDetailLoads = {
      stashes: { repoPath, requestId: previousRequestId, status: "loaded", error: "" },
    };
    window.fetch = (input, init) => {
      const requestUrl = typeof input === "string" ? input : input?.url || "";
      if (requestUrl.startsWith("/api/state?ref=")) requests.push(requestUrl);
      return originalFetch(input, init);
    };
    try {
      const started = performance.now();
      const data = await loadStateForRepoPath(repoPath, state.selectedRef);
      return {
        requests,
        elapsed: performance.now() - started,
        repoPath: data?.repo?.path || "",
        requestIdBefore: previousRequestId,
        requestIdAfter: state.repoDetailRequestId,
        detailKeys: Object.keys(state.repoDetailLoads),
      };
    } finally {
      window.fetch = originalFetch;
      state.repoDetailRequestId = previousRequestId;
      state.repoDetailLoads = previousLoads;
    }
  })()`);
  assert.equal(actionStateRefresh.requests.length, 1);
  assert.match(actionStateRefresh.requests[0], /^\/api\/state\?ref=.*&details=core$/);
  assert.equal(path.normalize(actionStateRefresh.repoPath), path.normalize(repo));
  assert.equal(actionStateRefresh.requestIdAfter, actionStateRefresh.requestIdBefore + 1);
  assert.deepEqual(actionStateRefresh.detailKeys, []);
  t.diagnostic(`action state refresh ${actionStateRefresh.elapsed.toFixed(1)} ms via ${actionStateRefresh.requests[0]}`);

  const initialCommitActionResources = await evaluate(cdp, `({
    implementation: typeof window.ForklineCommitActions,
    loader: typeof ensureCommitActionsLoaded,
    historyConfig: typeof historyRewriteConfig,
    remoteUrl: typeof commitRemoteUrl,
    emptyQueueVisible: document.querySelector(".history-queue-empty")?.textContent.includes("队列为空") || false,
    emptyQueueBorder: getComputedStyle(document.querySelector(".history-queue-empty")).borderTopStyle,
    loadedScripts: document.querySelectorAll("[data-commit-actions-resource]").length,
    loadedStyles: document.querySelectorAll("[data-commit-actions-style]").length,
  })`);
  assert.equal(initialCommitActionResources.implementation, "undefined");
  assert.equal(initialCommitActionResources.loader, "function");
  assert.equal(initialCommitActionResources.historyConfig, "function");
  assert.equal(initialCommitActionResources.remoteUrl, "function");
  assert.equal(initialCommitActionResources.emptyQueueVisible, true);
  assert.equal(initialCommitActionResources.emptyQueueBorder, "dashed");
  assert.equal(initialCommitActionResources.loadedScripts, 0);
  assert.equal(initialCommitActionResources.loadedStyles, 0);

  const lazyCommitActions = await evaluate(cdp, `(async () => {
    const started = performance.now();
    await Promise.all([ensureCommitActionsLoaded(), ensureCommitActionsLoaded()]);
    const originalQueue = state.historyQueue;
    const commit = commitRecordForSha(state.selectedSha);
    state.historyQueue = {
      items: [{
        sha: commit.sha,
        short: commit.short,
        message: commit.message,
        mode: "reword",
        summary: commit.message,
        body: "",
      }],
      loading: false,
      preview: { canRun: false, actions: [], affectedPreview: [] },
      error: "",
    };
    renderInspector();
    const result = {
      implementation: typeof window.ForklineCommitActions?.runCommitToolAction,
      historyRenderer: typeof window.ForklineCommitActions?.renderHistoryRewriteQueue,
      historyQueueRows: document.querySelectorAll(".history-queue-item").length,
      historyQueueDisplay: getComputedStyle(document.querySelector(".history-queue-item")).display,
      scripts: document.querySelectorAll('[data-commit-actions-resource][data-loaded="true"]').length,
      styles: document.querySelectorAll('[data-commit-actions-style][data-loaded="true"]').length,
      loadMs: performance.now() - started,
    };
    state.historyQueue = originalQueue;
    renderInspector();
    return result;
  })()`);
  assert.equal(lazyCommitActions.implementation, "function");
  assert.equal(lazyCommitActions.historyRenderer, "function");
  assert.equal(lazyCommitActions.historyQueueRows, 1);
  assert.equal(lazyCommitActions.historyQueueDisplay, "grid");
  assert.equal(lazyCommitActions.scripts, 1);
  assert.equal(lazyCommitActions.styles, 1);
  assert.ok(lazyCommitActions.loadMs < 3000, `commit actions loaded in ${lazyCommitActions.loadMs.toFixed(1)} ms`);
  t.diagnostic(`commit actions first loaded in ${lazyCommitActions.loadMs.toFixed(1)} ms with ${lazyCommitActions.scripts + lazyCommitActions.styles} resources`);

  const worktreeDiffLines = Array.from({ length: 2500 }, (_, index) => `int worktree_diff_loader_${index} = ${index};`).join("\n");
  await fs.appendFile(path.join(repo, "small.c"), `${worktreeDiffLines}\n`, "utf8");
  const lazyDiffWorkbench = await evaluate(cdp, `(async () => {
    const originalFetch = window.fetch.bind(window);
    const originalOpenSelectedFileInspector = window.openSelectedFileInspector;
    let diffRequests = 0;
    window.fetch = (input, init) => {
      const requestUrl = typeof input === "string" ? input : input?.url || "";
      if (requestUrl.includes("/api/worktree-diff")) diffRequests += 1;
      return originalFetch(input, init);
    };
    try {
      window.openSelectedFileInspector = () => {};
      const refreshResult = await refreshWorktree(false);
      const row = document.querySelector('[data-select-file][data-file="small.c"]');
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const afterSelection = {
        row: Boolean(row),
        refreshResult,
        files: (state.data?.workingFiles || []).map((file) => file.file),
        repoPath: state.data?.repo?.path || "",
        diffRequests,
        scripts: document.querySelectorAll("[data-diff-workbench-resource]").length,
        styles: document.querySelectorAll("[data-diff-workbench-style]").length,
        activeDiff: state.activeDiff,
      };
      const started = performance.now();
      await loadWorkingDiffLazy("small.c");
      const inlineRows = document.querySelectorAll("#workDiffView .side-row").length;
      const activeDiffRows = state.activeDiff?.diff?.length || 0;
      await openDiffModalLazy();
      const toolbar = document.querySelector("#diffModalBody .diff-line-toolbar");
      const result = {
        afterSelection,
        implementation: typeof loadWorkingDiff,
        lineActions: typeof runWorkDiffLineAction,
        scripts: document.querySelectorAll('[data-diff-workbench-resource][data-loaded="true"]').length,
        styles: document.querySelectorAll('[data-diff-workbench-style][data-loaded="true"]').length,
        modalVisible: document.querySelector("#diffModal")?.classList.contains("show") || false,
        modalDisplay: getComputedStyle(document.querySelector("#diffModal")).display,
        toolbarPosition: toolbar ? getComputedStyle(toolbar).position : "",
        inlineRows,
        activeDiffRows,
        renderedRows: document.querySelectorAll("#diffModalBody .side-row").length,
        diffRequests,
        loadMs: performance.now() - started,
      };
      closeDiffModal();
      result.closed = !document.querySelector("#diffModal")?.classList.contains("show");
      return result;
    } finally {
      window.fetch = originalFetch;
      window.openSelectedFileInspector = originalOpenSelectedFileInspector;
    }
  })()`);
  assert.ok(lazyDiffWorkbench.afterSelection.row, JSON.stringify(lazyDiffWorkbench.afterSelection));
  assert.equal(lazyDiffWorkbench.afterSelection.diffRequests, 0);
  assert.equal(lazyDiffWorkbench.afterSelection.scripts, 0);
  assert.equal(lazyDiffWorkbench.afterSelection.styles, 0);
  assert.equal(lazyDiffWorkbench.afterSelection.activeDiff, null);
  assert.equal(lazyDiffWorkbench.implementation, "function");
  assert.equal(lazyDiffWorkbench.lineActions, "function");
  assert.equal(lazyDiffWorkbench.scripts, 2);
  assert.equal(lazyDiffWorkbench.styles, 1);
  assert.equal(lazyDiffWorkbench.modalVisible, true);
  assert.equal(lazyDiffWorkbench.modalDisplay, "grid");
  assert.equal(lazyDiffWorkbench.toolbarPosition, "sticky");
  assert.equal(lazyDiffWorkbench.closed, true);
  assert.ok(lazyDiffWorkbench.activeDiffRows > 2000);
  assert.equal(lazyDiffWorkbench.inlineRows, 0);
  assert.ok(lazyDiffWorkbench.renderedRows > 0);
  assert.ok(lazyDiffWorkbench.renderedRows <= 1000);
  assert.equal(lazyDiffWorkbench.diffRequests, 1);
  assert.ok(lazyDiffWorkbench.loadMs < 3000, `Diff workbench loaded in ${lazyDiffWorkbench.loadMs.toFixed(1)} ms`);
  t.diagnostic(`Diff workbench first loaded in ${lazyDiffWorkbench.loadMs.toFixed(1)} ms with ${lazyDiffWorkbench.scripts + lazyDiffWorkbench.styles} resources; source/hidden/modal rows ${lazyDiffWorkbench.activeDiffRows}/${lazyDiffWorkbench.inlineRows}/${lazyDiffWorkbench.renderedRows}`);
  await git(repo, ["checkout", "--", "small.c"]);
  await evaluate(cdp, `(async () => {
    state.selectedFile = "";
    state.selectedChanges.clear();
    setActiveDiff(null);
    await refreshWorktree(false);
  })()`);

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

  const lazyFolderCommand = await evaluate(cdp, `(async () => {
    const started = performance.now();
    await openCommandPaletteLazy();
    const result = {
      folderImplementation: typeof window.openFolderModal === "function",
      commandImplementation: typeof window.openCommandPalette === "function",
      scripts: document.querySelectorAll('[data-folder-command-resource][data-loaded="true"]').length,
      styles: document.querySelectorAll('[data-folder-command-style][data-loaded="true"]').length,
      visible: document.querySelector("#commandPalette")?.classList.contains("show") || false,
      rows: document.querySelectorAll("#commandList [data-command-id]").length,
      dialogWidth: document.querySelector(".command-dialog")?.getBoundingClientRect().width || 0,
      loadMs: performance.now() - started,
    };
    closeCommandPaletteLazy();
    result.closed = !document.querySelector("#commandPalette")?.classList.contains("show");
    await openFolderModalLazy();
    result.folderVisible = document.querySelector("#folderModal")?.classList.contains("show") || false;
    result.folderDisplay = getComputedStyle(document.querySelector(".folder-dialog")).display;
    closeFolderModalLazy();
    result.folderClosed = !document.querySelector("#folderModal")?.classList.contains("show");
    return result;
  })()`);
  assert.equal(lazyFolderCommand.folderImplementation, true);
  assert.equal(lazyFolderCommand.commandImplementation, true);
  assert.equal(lazyFolderCommand.scripts, 1);
  assert.equal(lazyFolderCommand.styles, 1);
  assert.equal(lazyFolderCommand.visible, true);
  assert.equal(lazyFolderCommand.closed, true);
  assert.equal(lazyFolderCommand.folderVisible, true);
  assert.equal(lazyFolderCommand.folderDisplay, "grid");
  assert.equal(lazyFolderCommand.folderClosed, true);
  assert.ok(lazyFolderCommand.rows > 0);
  assert.ok(lazyFolderCommand.dialogWidth > 0);
  assert.ok(lazyFolderCommand.loadMs < 3000, `folder-command UI loaded in ${lazyFolderCommand.loadMs.toFixed(1)} ms`);
  t.diagnostic(`folder picker and command palette first loaded in ${lazyFolderCommand.loadMs.toFixed(1)} ms with ${lazyFolderCommand.scripts + lazyFolderCommand.styles} resources`);

  const lazySettings = await evaluate(cdp, `(async () => {
    const before = {
      settingsRenderer: typeof renderSettingsTab,
      stashesRenderer: typeof renderStashesTab,
      tagsRenderer: typeof renderTagsTab,
      workspaceRenderer: typeof renderWorkspaceTab,
      recoveryRenderer: typeof renderRecoveryTab,
      recoveryPolicy: typeof loadRecoveryPolicyForRepo,
      fileHistoryRenderer: typeof renderFileHistoryTab,
      fileBlameRenderer: typeof renderFileBlameTab,
      fileInsightsRenderer: typeof renderFileInsightsTab,
      syncRenderer: typeof renderSyncTab,
      authDiagnostics: typeof loadAuthDiagnostics,
      compareRenderer: typeof renderCompareTab,
      logsRenderer: typeof renderLogsTab,
      cancelOperation: typeof cancelRunningOperation,
      contextMenuImplementation: typeof showCommitContextMenu,
      contextMenuLoader: typeof showCommitContextMenuLazy,
      contextMenuResources: document.querySelectorAll("[data-context-menu-resource]").length,
      contextMenuStyles: document.querySelectorAll('[data-context-menu-style][data-loaded="true"]').length,
      resources: document.querySelectorAll("[data-inspector-panel-resource]").length,
      styles: document.querySelectorAll("[data-inspector-panel-style]").length,
    };
    state.selectedTab = "settings";
    const settingsStarted = performance.now();
    renderInspector();
    renderInspector();
    const deadline = performance.now() + 3000;
    while (!document.querySelector(".settings-layout") && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const result = {
      before,
      settingsRenderer: typeof renderSettingsTab,
      settingsResources: document.querySelectorAll('[data-inspector-panel-resource="settings"][data-loaded="true"]').length,
      settingsStyles: document.querySelectorAll('[data-inspector-panel-style="settings"][data-loaded="true"]').length,
      settingsRendered: Boolean(document.querySelector(".settings-layout")),
      settingsDisplay: getComputedStyle(document.querySelector(".settings-card")).display,
      settingsLoadMs: performance.now() - settingsStarted,
    };
    state.selectedTab = "stashes";
    const browserStashRef = "stash@{browser-test}";
    const originalStashes = state.data.stashes;
    const originalSelectedStash = state.selectedStash;
    const originalStashDetail = state.stashDetails.get(browserStashRef);
    state.data.stashes = [{
      ref: browserStashRef,
      short: "browser-test",
      time: "now",
      message: "browser style test",
      branch: "main",
      subject: "browser style test",
    }];
    state.selectedStash = browserStashRef;
    state.stashDetails.set(browserStashRef, { files: [], diff: [] });
    const stashesStarted = performance.now();
    renderInspector();
    renderInspector();
    const stashesDeadline = performance.now() + 3000;
    while (!document.querySelector(".stash-layout") && performance.now() < stashesDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.stashesRenderer = typeof renderStashesTab;
    result.stashesResources = document.querySelectorAll('[data-inspector-panel-resource="stashes"][data-loaded="true"]').length;
    result.repositoryPanelStylesAfterStashes = document.querySelectorAll('[data-inspector-panel-style="repositoryPanels"][data-loaded="true"]').length;
    result.stashesDisplay = getComputedStyle(document.querySelector(".stash-layout")).display;
    result.stashesLoadMs = performance.now() - stashesStarted;
    state.data.stashes = originalStashes;
    state.selectedStash = originalSelectedStash;
    if (originalStashDetail === undefined) state.stashDetails.delete(browserStashRef);
    else state.stashDetails.set(browserStashRef, originalStashDetail);
    state.selectedTab = "tags";
    const tagsStarted = performance.now();
    renderInspector();
    renderInspector();
    const tagsDeadline = performance.now() + 3000;
    while (typeof renderTagsTab !== "function" && performance.now() < tagsDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const originalTags = state.data.tags;
    state.data.tags = [{ name: "v-browser-test", short: "1234567", object: "1234567890", type: "commit", subject: "browser test", time: "now" }];
    renderInspector();
    const tagRow = document.querySelector('.tag-row[data-tag-name="v-browser-test"]');
    const contextMenuStarted = performance.now();
    tagRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 24, clientY: 24 }));
    const contextMenuDeadline = performance.now() + 3000;
    while (!document.querySelector("#tagContextMenu")?.classList.contains("show") && performance.now() < contextMenuDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.tagsRenderer = typeof renderTagsTab;
    result.tagActions = typeof runTagAction;
    result.tagsResources = document.querySelectorAll('[data-inspector-panel-resource="tags"][data-loaded="true"]').length;
    result.repositoryPanelStylesAfterTags = document.querySelectorAll('[data-inspector-panel-style="repositoryPanels"][data-loaded="true"]').length;
    result.tagsRendered = Boolean(tagRow);
    result.tagContextMenu = document.querySelector("#tagContextMenu")?.classList.contains("show") || false;
    result.tagContextMenuDisplay = getComputedStyle(document.querySelector("#tagContextMenu")).display;
    result.tagContextMenuWidth = document.querySelector("#tagContextMenu")?.getBoundingClientRect().width || 0;
    result.contextMenuImplementation = typeof showCommitContextMenu;
    result.contextMenuResources = document.querySelectorAll('[data-context-menu-resource][data-loaded="true"]').length;
    result.contextMenuStyles = document.querySelectorAll('[data-context-menu-style][data-loaded="true"]').length;
    result.contextMenuLoadMs = performance.now() - contextMenuStarted;
    result.tagsLoadMs = performance.now() - tagsStarted;
    hideTagContextMenu();
    state.data.tags = originalTags;
    state.selectedTab = "branches";
    const workspacesStarted = performance.now();
    renderInspector();
    renderInspector();
    const workspacesDeadline = performance.now() + 3000;
    while (!document.querySelector(".branch-cleanup-layout") && performance.now() < workspacesDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.workspaceRenderer = typeof renderWorkspaceTab;
    result.branchesRenderer = typeof renderBranchesTab;
    result.worktreeRenderer = typeof renderWorktreesTab;
    result.submoduleRenderer = typeof renderSubmodulesTab;
    result.workspaceResources = document.querySelectorAll('[data-inspector-panel-resource="workspaces"][data-loaded="true"]').length;
    result.workspaceStyles = document.querySelectorAll('[data-inspector-panel-style="workspaces"][data-loaded="true"]').length;
    result.workspaceDisplay = getComputedStyle(document.querySelector(".branch-cleanup-layout")).display;
    result.workspacesLoadMs = performance.now() - workspacesStarted;
    state.selectedTab = "worktrees";
    renderInspector();
    result.worktreeTitle = document.querySelector("#detailTitle")?.textContent || "";
    state.selectedTab = "submodules";
    renderInspector();
    result.submoduleTitle = document.querySelector("#detailTitle")?.textContent || "";
    result.workspaceResourcesAfterReuse = document.querySelectorAll('[data-inspector-panel-resource="workspaces"][data-loaded="true"]').length;
    result.workspaceStylesAfterReuse = document.querySelectorAll('[data-inspector-panel-style="workspaces"][data-loaded="true"]').length;
    state.selectedTab = "sync";
    const syncStarted = performance.now();
    renderInspector();
    renderInspector();
    const syncDeadline = performance.now() + 3000;
    while (!document.querySelector(".sync-actions") && performance.now() < syncDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.syncRenderer = typeof renderSyncTab;
    result.authDiagnostics = typeof loadAuthDiagnostics;
    result.syncResources = document.querySelectorAll('[data-inspector-panel-resource="sync"][data-loaded="true"]').length;
    result.repositoryPanelStylesAfterSync = document.querySelectorAll('[data-inspector-panel-style="repositoryPanels"][data-loaded="true"]').length;
    result.syncRendered = Boolean(document.querySelector(".sync-actions"));
    result.syncDisplay = getComputedStyle(document.querySelector(".sync-actions")).display;
    result.syncLoadMs = performance.now() - syncStarted;
    const compareStarted = performance.now();
    await openCompareBranch("HEAD", "HEAD~1");
    const compareDeadline = performance.now() + 3000;
    while (!document.querySelector(".compare-summary") && performance.now() < compareDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.compareRenderer = typeof renderCompareTab;
    result.compareActions = typeof runCompareFromPicker;
    result.compareResources = document.querySelectorAll('[data-inspector-panel-resource="compare"][data-loaded="true"]').length;
    result.repositoryPanelStylesAfterCompare = document.querySelectorAll('[data-inspector-panel-style="repositoryPanels"][data-loaded="true"]').length;
    result.compareRendered = Boolean(document.querySelector(".compare-summary"));
    result.compareDisplay = getComputedStyle(document.querySelector(".compare-summary")).display;
    result.compareLoadMs = performance.now() - compareStarted;
    state.selectedTab = "logs";
    const logsStarted = performance.now();
    renderInspector();
    renderInspector();
    const logsDeadline = performance.now() + 3000;
    while (!document.querySelector(".logs-toolbar") && performance.now() < logsDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.logsRenderer = typeof renderLogsTab;
    result.logsRefresh = typeof refreshLogsTab;
    result.cancelOperation = typeof cancelRunningOperation;
    result.logsResources = document.querySelectorAll('[data-inspector-panel-resource="logs"][data-loaded="true"]').length;
    result.logsStyles = document.querySelectorAll('[data-inspector-panel-style="logs"][data-loaded="true"]').length;
    result.logsRendered = Boolean(document.querySelector(".logs-toolbar"));
    result.logsDisplay = getComputedStyle(document.querySelector(".logs-toolbar")).display;
    result.logsLoadMs = performance.now() - logsStarted;
    state.selectedTab = "recovery";
    const recoveryStarted = performance.now();
    renderInspector();
    renderInspector();
    const recoveryDeadline = performance.now() + 3000;
    while (!document.querySelector(".recovery-layout") && performance.now() < recoveryDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    result.recoveryRenderer = typeof renderRecoveryTab;
    result.recoveryActions = typeof runRecoveryAction;
    result.recoveryResources = document.querySelectorAll('[data-inspector-panel-resource="recovery"][data-loaded="true"]').length;
    result.repositoryPanelStylesAfterRecovery = document.querySelectorAll('[data-inspector-panel-style="repositoryPanels"][data-loaded="true"]').length;
    result.recoveryRendered = Boolean(document.querySelector(".recovery-layout"));
    result.recoveryDisplay = getComputedStyle(document.querySelector(".recovery-layout")).display;
    result.recoveryLoadMs = performance.now() - recoveryStarted;
    const fileInsightsStarted = performance.now();
    await openFileHistory("small.c", state.selectedRef || "HEAD");
    result.fileHistoryRows = document.querySelectorAll(".file-history-row").length;
    result.fileHistoryDisplay = getComputedStyle(document.querySelector(".file-history-list")).display;
    await openFileBlame("small.c", state.selectedRef || "HEAD");
    result.fileBlameRows = document.querySelectorAll(".file-blame-row").length;
    result.fileBlameDisplay = getComputedStyle(document.querySelector(".file-blame-row")).display;
    result.fileHistoryRenderer = typeof renderFileHistoryTab;
    result.fileBlameRenderer = typeof renderFileBlameTab;
    result.fileInsightsRenderer = typeof renderFileInsightsTab;
    result.fileInsightsResources = document.querySelectorAll('[data-inspector-panel-resource="fileInsights"][data-loaded="true"]').length;
    result.fileInsightsStyles = document.querySelectorAll('[data-inspector-panel-style="fileInsights"][data-loaded="true"]').length;
    result.fileInsightsLoadMs = performance.now() - fileInsightsStarted;
    result.totalResources = document.querySelectorAll('[data-inspector-panel-resource][data-loaded="true"]').length;
    result.totalStyles = document.querySelectorAll('[data-inspector-panel-style][data-loaded="true"]').length;
    state.selectedTab = "details";
    renderInspector();
    return result;
  })()`);
  assert.equal(lazySettings.before.settingsRenderer, "undefined");
  assert.equal(lazySettings.before.stashesRenderer, "undefined");
  assert.equal(lazySettings.before.tagsRenderer, "undefined");
  assert.equal(lazySettings.before.workspaceRenderer, "undefined");
  assert.equal(lazySettings.before.recoveryRenderer, "undefined");
  assert.equal(lazySettings.before.recoveryPolicy, "function");
  assert.equal(lazySettings.before.fileHistoryRenderer, "undefined");
  assert.equal(lazySettings.before.fileBlameRenderer, "undefined");
  assert.equal(lazySettings.before.fileInsightsRenderer, "undefined");
  assert.equal(lazySettings.before.syncRenderer, "undefined");
  assert.equal(lazySettings.before.authDiagnostics, "undefined");
  assert.equal(lazySettings.before.compareRenderer, "undefined");
  assert.equal(lazySettings.before.logsRenderer, "undefined");
  assert.equal(lazySettings.before.cancelOperation, "function");
  assert.equal(lazySettings.before.contextMenuImplementation, "undefined");
  assert.equal(lazySettings.before.contextMenuLoader, "function");
  assert.equal(lazySettings.before.contextMenuResources, 0);
  assert.equal(lazySettings.before.contextMenuStyles, 0);
  assert.equal(lazySettings.before.resources, 0);
  assert.equal(lazySettings.before.styles, 0);
  assert.equal(lazySettings.settingsRenderer, "function");
  assert.equal(lazySettings.settingsResources, 1);
  assert.equal(lazySettings.settingsStyles, 1);
  assert.equal(lazySettings.settingsRendered, true);
  assert.equal(lazySettings.settingsDisplay, "grid");
  assert.equal(lazySettings.stashesRenderer, "function");
  assert.equal(lazySettings.stashesResources, 1);
  assert.equal(lazySettings.repositoryPanelStylesAfterStashes, 1);
  assert.equal(lazySettings.stashesDisplay, "grid");
  assert.equal(lazySettings.tagsRenderer, "function");
  assert.equal(lazySettings.tagActions, "function");
  assert.equal(lazySettings.tagsResources, 1);
  assert.equal(lazySettings.repositoryPanelStylesAfterTags, 1);
  assert.equal(lazySettings.tagsRendered, true);
  assert.equal(lazySettings.tagContextMenu, true);
  assert.equal(lazySettings.tagContextMenuDisplay, "grid");
  assert.ok(lazySettings.tagContextMenuWidth > 0);
  assert.equal(lazySettings.contextMenuImplementation, "function");
  assert.equal(lazySettings.contextMenuResources, 1);
  assert.equal(lazySettings.contextMenuStyles, 1);
  assert.equal(lazySettings.workspaceRenderer, "function");
  assert.equal(lazySettings.branchesRenderer, "function");
  assert.equal(lazySettings.worktreeRenderer, "function");
  assert.equal(lazySettings.submoduleRenderer, "function");
  assert.equal(lazySettings.workspaceResources, 1);
  assert.equal(lazySettings.workspaceStyles, 1);
  assert.equal(lazySettings.workspaceDisplay, "grid");
  assert.equal(lazySettings.workspaceResourcesAfterReuse, 1);
  assert.equal(lazySettings.workspaceStylesAfterReuse, 1);
  assert.equal(lazySettings.syncRenderer, "function");
  assert.equal(lazySettings.authDiagnostics, "function");
  assert.equal(lazySettings.syncResources, 1);
  assert.equal(lazySettings.repositoryPanelStylesAfterSync, 1);
  assert.equal(lazySettings.syncRendered, true);
  assert.equal(lazySettings.syncDisplay, "flex");
  assert.equal(lazySettings.compareRenderer, "function");
  assert.equal(lazySettings.compareActions, "function");
  assert.equal(lazySettings.compareResources, 1);
  assert.equal(lazySettings.repositoryPanelStylesAfterCompare, 1);
  assert.equal(lazySettings.compareRendered, true);
  assert.equal(lazySettings.compareDisplay, "grid");
  assert.equal(lazySettings.logsRenderer, "function");
  assert.equal(lazySettings.logsRefresh, "function");
  assert.equal(lazySettings.cancelOperation, "function");
  assert.equal(lazySettings.logsResources, 1);
  assert.equal(lazySettings.logsStyles, 1);
  assert.equal(lazySettings.logsRendered, true);
  assert.equal(lazySettings.logsDisplay, "flex");
  assert.match(lazySettings.worktreeTitle, /工作树/);
  assert.match(lazySettings.submoduleTitle, /子模块/);
  assert.equal(lazySettings.recoveryRenderer, "function");
  assert.equal(lazySettings.recoveryActions, "function");
  assert.equal(lazySettings.recoveryResources, 1);
  assert.equal(lazySettings.repositoryPanelStylesAfterRecovery, 1);
  assert.equal(lazySettings.recoveryRendered, true);
  assert.equal(lazySettings.recoveryDisplay, "grid");
  assert.equal(lazySettings.fileHistoryRenderer, "function");
  assert.equal(lazySettings.fileBlameRenderer, "function");
  assert.equal(lazySettings.fileInsightsRenderer, "function");
  assert.equal(lazySettings.fileInsightsResources, 1);
  assert.equal(lazySettings.fileInsightsStyles, 1);
  assert.ok(lazySettings.fileHistoryRows > 0);
  assert.ok(lazySettings.fileBlameRows > 0);
  assert.equal(lazySettings.fileHistoryDisplay, "grid");
  assert.equal(lazySettings.fileBlameDisplay, "grid");
  assert.equal(lazySettings.totalResources, 9);
  assert.equal(lazySettings.totalStyles, 5);
  assert.ok(lazySettings.settingsLoadMs < 3000, `settings panel loaded in ${lazySettings.settingsLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.stashesLoadMs < 3000, `stashes panel loaded in ${lazySettings.stashesLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.tagsLoadMs < 3000, `tags panel loaded in ${lazySettings.tagsLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.contextMenuLoadMs < 3000, `context menus loaded in ${lazySettings.contextMenuLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.workspacesLoadMs < 3000, `workspace panels loaded in ${lazySettings.workspacesLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.syncLoadMs < 3000, `sync authentication loaded in ${lazySettings.syncLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.compareLoadMs < 3000, `comparison panel loaded in ${lazySettings.compareLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.logsLoadMs < 3000, `operation logs loaded in ${lazySettings.logsLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.recoveryLoadMs < 3000, `recovery panel loaded in ${lazySettings.recoveryLoadMs.toFixed(1)} ms`);
  assert.ok(lazySettings.fileInsightsLoadMs < 3000, `file insights loaded in ${lazySettings.fileInsightsLoadMs.toFixed(1)} ms`);
  t.diagnostic(`lazy panels loaded settings/stashes/tags/workspaces/sync/compare/logs/recovery/file-insights in ${lazySettings.settingsLoadMs.toFixed(1)}/${lazySettings.stashesLoadMs.toFixed(1)}/${lazySettings.tagsLoadMs.toFixed(1)}/${lazySettings.workspacesLoadMs.toFixed(1)}/${lazySettings.syncLoadMs.toFixed(1)}/${lazySettings.compareLoadMs.toFixed(1)}/${lazySettings.logsLoadMs.toFixed(1)}/${lazySettings.recoveryLoadMs.toFixed(1)}/${lazySettings.fileInsightsLoadMs.toFixed(1)} ms with ${lazySettings.totalResources} scripts and ${lazySettings.totalStyles} panel styles`);
  t.diagnostic(`context menus first loaded in ${lazySettings.contextMenuLoadMs.toFixed(1)} ms with ${lazySettings.contextMenuResources} script and ${lazySettings.contextMenuStyles} style`);

  const baselineResizeListeners = await countWindowListeners(cdp, "resize");
  const complex = await evaluate(cdp, `(async () => {
    await selectCommit(${JSON.stringify(head)});
    switchInspectorTab("files");
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fileRow = document.querySelector('.commit-file-tree [data-select-file][data-file="complex.c"]');
    let maxDelay = 0;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const resourceEntryStart = performance.getEntriesByType("resource").length;
    const openStarted = performance.now();
    fileRow?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    const openDeadline = performance.now() + 5000;
    while (performance.now() < openDeadline) {
      if (
        state.fileEditor?.file === "complex.c" &&
        state.fileEditor?.commit === ${JSON.stringify(head)} &&
        state.fileEditor?.loading === false &&
        document.querySelector("#fileEditorModal").classList.contains("show") &&
        !document.querySelector("#fileEditorModal").classList.contains("is-preparing")
      ) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const opened = Boolean(
      state.fileEditor?.file === "complex.c" &&
      state.fileEditor?.commit === ${JSON.stringify(head)} &&
      state.fileEditor?.loading === false &&
      document.querySelector("#fileEditorModal").classList.contains("show")
    );
    const openMs = performance.now() - openStarted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    const scrollers = Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"));
    const scrollStarted = performance.now();
    if (scrollers[0]) {
      scrollers[0].scrollTop = 50000;
      scrollers[0].dispatchEvent(new Event("scroll"));
    }
    const scrollMs = performance.now() - scrollStarted;
    const editorResourceNames = new Set(Array.from(document.querySelectorAll("[data-file-editor-resource]"), (element) => element.src || element.href).filter(Boolean));
    const resourceEntries = performance.getEntriesByType("resource").slice(resourceEntryStart);
    const editorEntries = resourceEntries.filter((entry) => editorResourceNames.has(entry.name));
    const resourceStart = editorEntries.length ? Math.min(...editorEntries.map((entry) => entry.startTime)) : 0;
    const resourceEnd = editorEntries.length ? Math.max(...editorEntries.map((entry) => entry.responseEnd)) : 0;
    const commitEntry = resourceEntries.find((entry) => entry.name.includes("/api/commit-file?"));
    const resourceLoadMs = Math.max(0, resourceEnd - resourceStart);
    const commitApiMs = commitEntry?.duration || 0;
    const result = {
      opened,
      fileListRowFound: Boolean(fileRow),
      selectedTab: state.selectedTab,
      openMs,
      resourceLoadMs,
      commitApiMs,
      estimatedBuildMs: Math.max(0, openMs - resourceLoadMs - commitApiMs),
      editorRequests: editorEntries.length,
      maxDelay,
      scrollMs,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
      status: document.querySelector("#fileEditorStatus").textContent,
      loadedResources: document.querySelectorAll('[data-file-editor-resource][data-loaded="true"]').length,
      projectStyles: document.querySelectorAll('[data-file-editor-resource="./file-editor.css"][data-loaded="true"]').length,
      contextMenuStyles: document.querySelectorAll('[data-context-menu-style][data-loaded="true"]').length,
      dialogDisplay: getComputedStyle(document.querySelector("#fileEditorForm")).display,
      dialogPosition: getComputedStyle(document.querySelector("#fileEditorForm")).position,
      bodyHeight: document.querySelector("#fileEditorMerge").getBoundingClientRect().height,
      synchronized: scrollers.length === 2 && Math.abs(scrollers[0].scrollTop - scrollers[1].scrollTop) < 1,
    };
    const closeStarted = performance.now();
    closeFileEditor(true);
    result.closeMs = performance.now() - closeStarted;
    result.remainingCodeMirrors = document.querySelectorAll("#fileEditorMerge .CodeMirror").length;
    return result;
  })()`);

  assert.equal(complex.opened, true);
  assert.equal(complex.fileListRowFound, true);
  assert.equal(complex.selectedTab, "files");
  assert.equal(complex.mergeViews, 0);
  assert.equal(complex.codeMirrors, 2);
  assert.equal(complex.compareHidden, true);
  assert.match(complex.status, /复杂文件轻量模式 · 行数较多/);
  assert.equal(complex.synchronized, true);
  assert.equal(complex.loadedResources, 36);
  assert.equal(complex.projectStyles, 1);
  assert.equal(complex.contextMenuStyles, 1);
  assert.equal(complex.dialogDisplay, "grid");
  assert.equal(complex.dialogPosition, "absolute");
  assert.ok(complex.bodyHeight > 200, `file editor body height was ${complex.bodyHeight.toFixed(1)} px`);
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

  await evaluate(cdp, `(() => {
    globalThis.__forklineBrowserTestPerformanceGuard = createFileEditorWithPerformanceGuard;
    createFileEditorWithPerformanceGuard = createFileEditorInstance;
  })()`);
  const preparedOpen = await evaluate(cdp, `(async () => {
    const originalFetch = window.fetch;
    let releaseRequest;
    window.fetch = (...args) => {
      if (!String(args[0] || "").includes("/api/commit-file")) return originalFetch(...args);
      return new Promise((resolve, reject) => {
        releaseRequest = () => originalFetch(...args).then(resolve, reject);
      });
    };
    try {
      const opening = openCommitFileViewer("small.c", "", ${JSON.stringify(head)});
      await Promise.resolve();
      const visibleWhileLoading = document.querySelector("#fileEditorModal").classList.contains("show");
      const editorsWhileLoading = document.querySelectorAll("#fileEditorMerge .CodeMirror").length;
      releaseRequest();
      const opened = await opening;
      const visibleAfterLoad = document.querySelector("#fileEditorModal").classList.contains("show");
      closeFileEditor(true);
      return { opened, visibleWhileLoading, visibleAfterLoad, editorsWhileLoading };
    } finally {
      window.fetch = originalFetch;
    }
  })()`);
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

  const smallMarkers = await evaluate(cdp, `(async () => {
    const dialog = document.querySelector("#fileEditorForm");
    dialog.style.height = "360px";
    await new Promise((resolve) => setTimeout(resolve, 80));
    const oldRail = document.querySelector("#fileEditorMerge .file-editor-change-rail.is-old");
    const newRail = document.querySelector("#fileEditorMerge .file-editor-change-rail.is-new");
    const oldMarkers = Array.from(oldRail?.querySelectorAll(".file-editor-change-marker") || []);
    const newMarkers = Array.from(newRail?.querySelectorAll(".file-editor-change-marker") || []);
    const markerInsideRail = (marker, rail) => {
      const markerRect = marker.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      return markerRect.top >= railRect.top - 1 && markerRect.bottom <= railRect.bottom + 1;
    };
    oldMarkers[0]?.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const oldMarkerRect = oldMarkers[0]?.getBoundingClientRect();
    const oldRailRect = oldRail?.getBoundingClientRect();
    const oldScrollInfo = state.fileEditor?.mergeView?.leftOriginal?.()?.getScrollInfo?.();
    const markerRatio = oldMarkerRect && oldRailRect
      ? (oldMarkerRect.top - oldRailRect.top) / Math.max(1, oldRailRect.height - oldMarkerRect.height)
      : -1;
    const scrollRatio = oldScrollInfo
      ? oldScrollInfo.top / Math.max(1, oldScrollInfo.height - oldScrollInfo.clientHeight)
      : -1;
    return {
      oldCount: oldMarkers.length,
      newCount: newMarkers.length,
      oldInside: oldMarkers.every((marker) => markerInsideRail(marker, oldRail)),
      newInside: newMarkers.every((marker) => markerInsideRail(marker, newRail)),
      oldTitle: oldMarkers[0]?.title || "",
      oldScrollTop: oldScrollInfo?.top || 0,
      markerRatio,
      scrollRatio,
    };
  })()`);
  assert.equal(smallMarkers.oldCount, 1);
  assert.equal(smallMarkers.newCount, 1);
  assert.equal(smallMarkers.oldInside, true);
  assert.equal(smallMarkers.newInside, true);
  assert.match(smallMarkers.oldTitle, /改动位置/);
  assert.ok(smallMarkers.oldScrollTop > 0);
  assert.ok(
    Math.abs(smallMarkers.markerRatio - smallMarkers.scrollRatio) < 0.03,
    `change marker ratio ${smallMarkers.markerRatio.toFixed(3)} did not match scroll ratio ${smallMarkers.scrollRatio.toFixed(3)}`
  );
  assert.equal(preparedOpen.opened, true);
  assert.equal(preparedOpen.visibleWhileLoading, false);
  assert.equal(preparedOpen.editorsWhileLoading, 0);
  assert.equal(preparedOpen.visibleAfterLoad, true);

  const smallResize = await evaluate(cdp, `(async () => {
    const dialog = document.querySelector("#fileEditorForm");
    const measure = () => ({
      dialog: dialog.getBoundingClientRect().height,
      body: document.querySelector(".file-editor-body").getBoundingClientRect().height,
      merge: document.querySelector("#fileEditorMerge").getBoundingClientRect().height,
      mergeView: document.querySelector("#fileEditorMerge .CodeMirror-merge")?.getBoundingClientRect().height || 0,
      codeMirrors: Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror"), (node) => node.getBoundingClientRect().height),
      scrollers: Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"), (node) => node.clientHeight),
    });
    prepareFileEditorWindow();
    dialog.style.height = "520px";
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const shrunken = measure();
    dialog.style.height = "780px";
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { shrunken, expanded: measure() };
  })()`);
  assert.ok(smallResize.expanded.body >= smallResize.shrunken.body + 200);
  assert.ok(Math.abs(smallResize.expanded.mergeView - smallResize.expanded.body) <= 1);
  smallResize.expanded.codeMirrors.forEach((height) => {
    assert.ok(
      Math.abs(height - smallResize.expanded.body) <= 1,
      `expanded historical editor height ${height}px did not fill ${smallResize.expanded.body}px body`
    );
  });

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
    `complex open ${complex.openMs.toFixed(1)} ms: resources ${complex.resourceLoadMs.toFixed(1)} ms/${complex.editorRequests} requests, commit API ${complex.commitApiMs.toFixed(1)} ms, estimated build ${complex.estimatedBuildMs.toFixed(1)} ms; max event-loop delay ${complex.maxDelay.toFixed(1)} ms, scroll ${complex.scrollMs.toFixed(1)} ms, close ${complex.closeMs.toFixed(1)} ms`
  );
  t.diagnostic(
    `small open ${smallOpened.openMs.toFixed(1)} ms, eight switches ${switches.elapsed.toFixed(1)} ms, resize listeners ${baselineResizeListeners} -> ${warmedResizeListeners} -> ${smallResizeListeners} -> ${switchedResizeListeners} -> ${finalResizeListeners}`
  );

  await evaluate(cdp, `(() => {
    createFileEditorWithPerformanceGuard = globalThis.__forklineBrowserTestPerformanceGuard;
    delete globalThis.__forklineBrowserTestPerformanceGuard;
  })()`);
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
    const warmApiSamples = [];
    const warmResponses = [];
    for (let sample = 0; sample < 5; sample += 1) {
      const warmRequestStarted = performance.now();
      warmResponses.push(await api("/api/worktree?expectedSnapshot=" + encodeURIComponent(data.worktreeSnapshot || "")));
      warmApiSamples.push(performance.now() - warmRequestStarted);
    }
    const warmData = warmResponses[warmResponses.length - 1];
    const warmApiMs = [...warmApiSamples].sort((left, right) => left - right)[Math.floor(warmApiSamples.length / 2)];
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
    const loadPassMetrics = [];
    let loadMaxDelay = 0;
    let rowContentVisibility = "";
    let groupContentVisibility = "";
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
      const maxDelayBeforeLoad = maxDelay;
      await new Promise((resolve) => setTimeout(resolve, 50));
      maxDelay = 0;
      lastTick = performance.now();
      const loadAllStarted = performance.now();
      while (document.querySelectorAll("#changeList .file-row[data-file]").length < state.data.workingFiles.length && loadPasses < 10) {
        els.changeList.scrollTop = els.changeList.scrollHeight;
        const passStarted = performance.now();
        els.changeList.dispatchEvent(new Event("scroll"));
        const dispatchMs = performance.now() - passStarted;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        loadPassMetrics.push({
          dispatchMs,
          frameMs: performance.now() - passStarted,
          rows: document.querySelectorAll("#changeList .file-row[data-file]").length,
        });
        loadPasses += 1;
      }
      loadAllMs = performance.now() - loadAllStarted;
      loadMaxDelay = maxDelay;
      maxDelay = Math.max(maxDelayBeforeLoad, loadMaxDelay);
      loadedAllRows = document.querySelectorAll("#changeList .file-row[data-file]").length;
      const firstWorktreeRow = document.querySelector("#changeList .file-row[data-file]");
      rowContentVisibility = firstWorktreeRow ? getComputedStyle(firstWorktreeRow).contentVisibility : "";
      const firstNestedGroup = document.querySelector("#changeList .file-tree .tree-group .tree-group");
      groupContentVisibility = firstNestedGroup ? getComputedStyle(firstNestedGroup).contentVisibility : "";
    } finally {
      EventTarget.prototype.addEventListener = originalAddEventListener;
    }
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    return {
      apiMs,
      warmApiMs,
      warmApiSamples,
      warmLoadedFiles: warmData.workingFiles?.length || 0,
      warmUnchanged: warmResponses.every((response) => response.unchanged === true),
      coldPayloadBytes: JSON.stringify(data).length,
      warmPayloadBytes: JSON.stringify(warmData).length,
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
      loadPassMetrics,
      loadMaxDelay,
      rowContentVisibility,
      groupContentVisibility,
      loadedAllRows,
      maxDelay,
      loadedFiles: state.data.workingFiles.length,
      worktreeSnapshot: data.worktreeSnapshot,
      watchedFileSnapshot: data.workingFiles.find((file) => /file-00000\.txt$/.test(file.file))?.snapshot || "",
      renderedRows: document.querySelectorAll("#changeList .file-row[data-file]").length,
      treeNodes: document.querySelectorAll("#changeList *").length,
      pageNodes: document.querySelectorAll("body *").length,
      fileTreeListenerAdds,
    };
  })()`);
  assert.ok(worktreeMetrics.apiMs < performanceBudget(350), `large worktree cold API took ${worktreeMetrics.apiMs.toFixed(1)} ms`);
  assert.equal(worktreeMetrics.warmLoadedFiles, 0);
  assert.equal(worktreeMetrics.warmUnchanged, true);
  assert.equal(worktreeMetrics.sameSnapshot, true);
  assert.ok(worktreeMetrics.warmPayloadBytes < 1000, `unchanged worktree response used ${worktreeMetrics.warmPayloadBytes} bytes`);
  assert.ok(worktreeMetrics.warmPayloadBytes * 20 < worktreeMetrics.coldPayloadBytes, `unchanged worktree response was not compact: ${worktreeMetrics.warmPayloadBytes}/${worktreeMetrics.coldPayloadBytes} bytes`);
  assert.ok(worktreeMetrics.initialRenderedRows <= 1000, `large worktree initially rendered ${worktreeMetrics.initialRenderedRows} rows`);
  assert.ok(worktreeMetrics.initialTreeNodes <= 6000, `large worktree initially kept ${worktreeMetrics.initialTreeNodes} tree nodes`);
  assert.equal(worktreeMetrics.filteredRows, 1);
  assert.match(worktreeMetrics.filteredFile, /file-03999\.txt$/);
  assert.ok(worktreeMetrics.restoredRows <= 1000, `large worktree restored ${worktreeMetrics.restoredRows} rows before scrolling`);
  assert.ok(worktreeMetrics.loadPasses > 0 && worktreeMetrics.loadPasses <= 10, `large worktree used ${worktreeMetrics.loadPasses} load passes`);
  assert.equal(worktreeMetrics.loadedAllRows, worktreeMetrics.loadedFiles);
  assert.ok(worktreeMetrics.fileTreeListenerAdds <= 8, `large worktree added ${worktreeMetrics.fileTreeListenerAdds} file-tree listeners while rendering`);
  assert.equal(worktreeMetrics.loadPassMetrics.length, worktreeMetrics.loadPasses);
  assert.equal(worktreeMetrics.rowContentVisibility, "auto");
  let previousLoadedRows = worktreeMetrics.restoredRows;
  const maxLoadBatchRows = worktreeMetrics.loadPassMetrics.reduce((maximum, item) => {
    const added = item.rows - previousLoadedRows;
    previousLoadedRows = item.rows;
    return Math.max(maximum, added);
  }, 0);
  assert.ok(maxLoadBatchRows <= 400, `large worktree appended ${maxLoadBatchRows} rows in one frame`);
  assert.equal(worktreeMetrics.groupContentVisibility, "auto");
  const watchedFilePath = path.join(repo, "worktree", "group-000", "file-00000.txt");
  await fs.writeFile(watchedFilePath, "worktree watcher changed content\n", "utf8");
  const watchedWorktreeChange = await evaluate(cdp, `(async () => {
    let result = null;
    let apiMs = 0;
    let attempts = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const requestStarted = performance.now();
      result = await api("/api/worktree?expectedSnapshot=" + encodeURIComponent(${JSON.stringify(worktreeMetrics.worktreeSnapshot)}));
      const requestMs = performance.now() - requestStarted;
      attempts = attempt + 1;
      if (!result.unchanged) apiMs = requestMs;
      if (!result.unchanged) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const file = result?.workingFiles?.find((item) => /file-00000\\.txt$/.test(item.file));
    return {
      unchanged: result?.unchanged === true,
      snapshot: result?.worktreeSnapshot || "",
      fileSnapshot: file?.snapshot || "",
      fileCount: result?.workingFiles?.length || 0,
      apiMs,
      attempts,
    };
  })()`);
  assert.equal(watchedWorktreeChange.unchanged, false);
  assert.equal(watchedWorktreeChange.fileCount, largeWorktreeFileCount);
  assert.notEqual(watchedWorktreeChange.snapshot, worktreeMetrics.worktreeSnapshot);
  assert.notEqual(watchedWorktreeChange.fileSnapshot, worktreeMetrics.watchedFileSnapshot);
  assert.ok(watchedWorktreeChange.apiMs < performanceBudget(300), `single-file worktree refresh took ${watchedWorktreeChange.apiMs.toFixed(1)} ms after ${watchedWorktreeChange.attempts} attempts`);
  t.diagnostic(
    `large worktree ${worktreeMetrics.loadedFiles} files: cold API ${worktreeMetrics.apiMs.toFixed(1)} ms/${worktreeMetrics.coldPayloadBytes} bytes, unchanged API median ${worktreeMetrics.warmApiMs.toFixed(1)} ms [${worktreeMetrics.warmApiSamples.map((value) => value.toFixed(1)).join(", ")}]/${worktreeMetrics.warmPayloadBytes} bytes, changed API ${watchedWorktreeChange.apiMs.toFixed(1)} ms/${watchedWorktreeChange.attempts} attempts, render ${worktreeMetrics.renderMs.toFixed(1)} ms, filter ${worktreeMetrics.filterMs.toFixed(1)} ms, restore ${worktreeMetrics.restoreMs.toFixed(1)} ms, load-all ${worktreeMetrics.loadAllMs.toFixed(1)} ms/${worktreeMetrics.loadPasses} passes, load delay ${worktreeMetrics.loadMaxDelay.toFixed(1)} ms, pass ${worktreeMetrics.loadPassMetrics.map((item) => `${item.rows}:${item.dispatchMs.toFixed(1)}/${item.frameMs.toFixed(1)}`).join(", ")}, max delay ${worktreeMetrics.maxDelay.toFixed(1)} ms, listener adds ${worktreeMetrics.fileTreeListenerAdds}, initial/final rows ${worktreeMetrics.initialRenderedRows}/${worktreeMetrics.loadedAllRows}, initial/final tree nodes ${worktreeMetrics.initialTreeNodes}/${worktreeMetrics.treeNodes}, initial/final page nodes ${worktreeMetrics.initialPageNodes}/${worktreeMetrics.pageNodes}`
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
  assert.equal(progressiveOpenMetrics.finalLoadedFiles, worktreeMetrics.loadedFiles);
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
      const url = String(args[0] || "");
      const started = performance.now();
      try {
        return await originalApi(...args);
      } finally {
        calls.push({ url, durationMs: performance.now() - started });
      }
    };
    const started = performance.now();
    try {
      for (let index = 0; index < 12; index += 1) {
        await openRepo(index % 2 === 0 ? ${JSON.stringify(repo)} : ${JSON.stringify(alternateRepo)});
      }
    } finally {
      api = originalApi;
    }
    const summarize = (predicate) => {
      const samples = calls.filter((item) => predicate(item.url)).map((item) => item.durationMs).sort((left, right) => left - right);
      return {
        count: samples.length,
        medianMs: samples.length ? samples[Math.floor(samples.length / 2)] : 0,
        minMs: samples[0] || 0,
        maxMs: samples.at(-1) || 0,
      };
    };
    return {
      elapsed: performance.now() - started,
      open: summarize((url) => url === "/api/open"),
      openDetails: summarize((url) => url === "/api/open-details"),
      stateRef: summarize((url) => url.startsWith("/api/state?ref=")),
      lightweightRef: summarize((url) => url.startsWith("/api/ref-state?ref=")),
      commit: summarize((url) => url.startsWith("/api/commit?sha=")),
      finalRepo: state.data?.repo?.path || "",
      pageNodes: document.querySelectorAll("body *").length,
    };
  })()`);
  assert.equal(switchMetrics.open.count, 12);
  assert.equal(switchMetrics.openDetails.count, 12);
  assert.equal(switchMetrics.commit.count, 12);
  assert.equal(switchMetrics.stateRef.count, 0);
  assert.equal(switchMetrics.lightweightRef.count, 0);
  assert.ok(switchMetrics.open.medianMs < performanceBudget(130), `repository switch open median took ${switchMetrics.open.medianMs.toFixed(1)} ms`);
  assert.ok(switchMetrics.openDetails.medianMs < performanceBudget(150), `repository switch details median took ${switchMetrics.openDetails.medianMs.toFixed(1)} ms`);
  assert.ok(switchMetrics.commit.medianMs < performanceBudget(100), `repository switch commit median took ${switchMetrics.commit.medianMs.toFixed(1)} ms`);
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
    `soak switches: ${switchMetrics.elapsed.toFixed(1)} ms; API median/min/max open ${switchMetrics.open.medianMs.toFixed(1)}/${switchMetrics.open.minMs.toFixed(1)}/${switchMetrics.open.maxMs.toFixed(1)} ms, details ${switchMetrics.openDetails.medianMs.toFixed(1)}/${switchMetrics.openDetails.minMs.toFixed(1)}/${switchMetrics.openDetails.maxMs.toFixed(1)} ms, commit ${switchMetrics.commit.medianMs.toFixed(1)}/${switchMetrics.commit.minMs.toFixed(1)}/${switchMetrics.commit.maxMs.toFixed(1)} ms; calls ${switchMetrics.open.count}/${switchMetrics.openDetails.count}/${switchMetrics.stateRef.count}/${switchMetrics.lightweightRef.count}/${switchMetrics.commit.count}; editor open-close 30x ${editorSoak.elapsed.toFixed(1)} ms; resize listeners ${soakResizeListenersBefore} -> ${soakResizeListenersAfter}; DOM documents/nodes/listeners ${soakMemoryBefore.documents}/${soakMemoryBefore.nodes}/${soakMemoryBefore.jsEventListeners} -> ${soakMemoryAfter.documents}/${soakMemoryAfter.nodes}/${soakMemoryAfter.jsEventListeners}; heap ${(soakMemoryBefore.heapUsed / 1024 / 1024).toFixed(1)} MiB -> ${(soakMemoryAfter.heapUsed / 1024 / 1024).toFixed(1)} MiB`
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
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`Timed out waiting for Chromium DevTools command: ${method}`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
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

function performanceBudget(milliseconds) {
  return milliseconds * performanceBudgetScale;
}
