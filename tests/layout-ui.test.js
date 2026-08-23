"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const layoutSource = fs.readFileSync(path.join(root, "public", "js", "app", "layout-utils.js"), "utf8");
const initSource = fs.readFileSync(path.join(root, "public", "js", "app", "init.js"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "public", "js", "api.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "public", "js", "bootstrap.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const inspectorSource = fs.readFileSync(path.join(root, "public", "js", "panels", "inspector.js"), "utf8");
const worktreeSource = fs.readFileSync(path.join(root, "public", "js", "features", "worktree-changes.js"), "utf8");
const contextMenuSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const contextMenuLoaderSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menu-loader.js"), "utf8");
const graphSource = fs.readFileSync(path.join(root, "public", "js", "features", "graph.js"), "utf8");
const repositoriesSource = fs.readFileSync(path.join(root, "public", "js", "features", "repositories.js"), "utf8");
const workspacesSource = fs.readFileSync(path.join(root, "public", "js", "panels", "workspaces.js"), "utf8");
const stashesSource = fs.readFileSync(path.join(root, "public", "js", "panels", "stashes.js"), "utf8");
const authSource = fs.readFileSync(path.join(root, "public", "js", "panels", "auth.js"), "utf8");
const syncSource = fs.readFileSync(path.join(root, "public", "js", "panels", "sync.js"), "utf8");
const compareSource = fs.readFileSync(path.join(root, "public", "js", "panels", "compare.js"), "utf8");
const tagsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "tags.js"), "utf8");
const recoverySource = fs.readFileSync(path.join(root, "public", "js", "panels", "recovery.js"), "utf8");
const recoveryPolicySource = fs.readFileSync(path.join(root, "public", "js", "features", "recovery-policy.js"), "utf8");
const fileInsightsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "file-insights.js"), "utf8");
const logsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "logs.js"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "settings.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const commitActionStyles = fs.readFileSync(path.join(root, "public", "commit-actions.css"), "utf8");
const contextMenuStyles = fs.readFileSync(path.join(root, "public", "context-menu.css"), "utf8");
const diffWorkbenchStyles = fs.readFileSync(path.join(root, "public", "diff-workbench.css"), "utf8");
const fileInsightsStyles = fs.readFileSync(path.join(root, "public", "file-insights.css"), "utf8");
const folderCommandStyles = fs.readFileSync(path.join(root, "public", "folder-command.css"), "utf8");
const logsStyles = fs.readFileSync(path.join(root, "public", "logs.css"), "utf8");
const repositoryPanelStyles = fs.readFileSync(path.join(root, "public", "repository-panels.css"), "utf8");
const settingsStyles = fs.readFileSync(path.join(root, "public", "settings.css"), "utf8");
const workspacesStyles = fs.readFileSync(path.join(root, "public", "workspaces.css"), "utf8");

test("right inspector panels keep separate modules before event binding", () => {
  const scripts = [
    "./js/panels/sync.js",
    "./js/panels/inspector-panel-loader.js",
    "./js/features/recovery-policy.js",
    "./js/features/recovery-undo.js",
    "./js/app/events.js",
  ];
  let previous = -1;
  for (const script of scripts) {
    const position = indexHtml.indexOf(`<script src="${script}"></script>`);
    assert.ok(position > previous, `${script} should load after the previous inspector module`);
    previous = position;
  }
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/stashes\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/tags\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/settings\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/workspaces\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/recovery\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/file-insights\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/auth\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/compare\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/panels\/logs\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<link[^>]+href="\.\/workspaces\.css"/);
  assert.doesNotMatch(indexHtml, /recovery-settings\.js/);
  assert.match(stashesSource, /function renderStashesTab\(\)/);
  assert.match(authSource, /function renderSyncTab\(\)/);
  assert.match(authSource, /function syncCommitPreviewHtml\(commit, detail, model\)/);
  assert.match(authSource, /async function loadAuthDiagnostics\(/);
  assert.doesNotMatch(syncSource, /function renderSyncTab\(\)/);
  assert.doesNotMatch(syncSource, /function syncCommitPreviewHtml\(commit, detail, model\)/);
  assert.match(syncSource, /async function refreshSyncState\(\)/);
  assert.match(syncSource, /function syncPushGuard\(sync\)/);
  assert.match(compareSource, /function renderCompareTab\(\)/);
  assert.doesNotMatch(syncSource, /renderStashesTab|renderCompareTab|loadAuthDiagnostics/);
  assert.match(tagsSource, /function renderTagsTab\(\)/);
  assert.match(recoverySource, /function renderRecoveryTab\(\)/);
  assert.doesNotMatch(recoverySource, /function defaultRecoveryPolicy\(repoPath/);
  assert.match(recoveryPolicySource, /function defaultRecoveryPolicy\(repoPath/);
  assert.match(recoveryPolicySource, /async function maybeOfferRecoveryPolicyCleanup\(result\)/);
  assert.match(inspectorSource, /renderInspectorPanelLazy\("fileInsights"\)/);
  assert.match(inspectorSource, /renderInspectorPanelLazy\("sync"\)/);
  assert.match(inspectorSource, /renderInspectorPanelLazy\("compare"\)/);
  assert.match(inspectorSource, /renderInspectorPanelLazy\("logs"\)/);
  assert.doesNotMatch(inspectorSource, /function renderFileHistoryTab\(\)/);
  assert.doesNotMatch(inspectorSource, /function renderFileBlameTab\(\)/);
  assert.match(fileInsightsSource, /function renderFileInsightsTab\(\)/);
  assert.match(fileInsightsSource, /function loadFileHistoryPanel\(filePath, targetRef\)/);
  assert.match(fileInsightsSource, /function loadFileBlamePanel\(filePath, targetRef\)/);
  assert.match(logsSource, /function renderLogsTab\(\)/);
  assert.match(settingsSource, /function renderSettingsTab\(\)/);
  assert.match(workspacesSource, /function renderWorkspaceTab\(\)/);
  assert.match(workspacesStyles, /\.branch-cleanup-layout\s*\{[^}]*display:\s*grid;/s);
  assert.match(workspacesStyles, /\.worktree-dashboard\s*\{[^}]*display:\s*grid;/s);
  assert.match(workspacesStyles, /\.submodule-dashboard\s*\{[^}]*display:\s*grid;/s);
  assert.doesNotMatch(styles, /\.branch-cleanup-layout|\.worktree-dashboard|\.submodule-dashboard/);
});

test("context menus load on first use while positioning helpers stay eager", () => {
  assert.match(indexHtml, /<script src="\.\/js\/features\/context-menu-loader\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /<script src="\.\/js\/features\/context-menus\.js"><\/script>/);
  assert.match(contextMenuLoaderSource, /async function ensureContextMenusLoaded\(\)/);
  assert.match(contextMenuLoaderSource, /function positionContextMenu\(menu, event, fallbackHeight = 220\)/);
  assert.match(contextMenuLoaderSource, /async function showCommitContextMenuLazy\(event, commit\)/);
  assert.match(contextMenuSource, /function showCommitContextMenu\(event, commit\)/);
  assert.doesNotMatch(contextMenuSource, /function positionContextMenu\(/);
  assert.match(eventsSource, /showCommitContextMenuLazy\(event, commit\)/);
});

test("ordinary command hints become hover titles without duplicate text", () => {
  const context = vm.createContext({});
  vm.runInContext(layoutSource, context);

  const first = commandButton("git fetch");
  context.decorateCommandHints(first.root);
  assert.equal(first.button.getAttribute("title"), "git fetch");

  const second = commandButton("git reset --soft", "移动当前分支");
  context.decorateCommandHints(second.root);
  context.decorateCommandHints(second.root);
  assert.equal(second.button.getAttribute("title"), "移动当前分支\ngit reset --soft");
});

test("long operation toasts expose an immediate dismiss control", () => {
  assert.match(indexHtml, /id="toastMessage"/);
  assert.match(indexHtml, /id="toastClose"/);
  assert.match(layoutSource, /function dismissToast\(\)/);
  assert.match(layoutSource, /toastMessage\.textContent/);
  assert.match(eventsSource, /toastClose\?\.addEventListener\("click", dismissToast\)/);
  assert.match(styles, /\.toast\.show[\s\S]*pointer-events:\s*auto/);
});

test("topbar sync actions expose their Git commands on hover", () => {
  assert.match(indexHtml, /data-action="fetch" title="git fetch --all --prune"/);
  assert.match(indexHtml, /data-action="pull" title="git pull --ff-only"/);
  assert.match(indexHtml, /data-action="push" title="git push"/);
  assert.match(indexHtml, /data-action="forcePushLease" title="git push --force-with-lease"/);
});

test("app update indicator stays hidden until a newer release is returned", async () => {
  const attributes = new Map();
  const indicator = {
    hidden: false,
    href: "#",
    title: "",
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "href") this.href = "";
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
  const state = { data: {}, selectedTab: "details", appUpdate: {} };
  let response = { available: false, currentVersion: "0.2.0", latestVersion: "0.2.0", installSupported: true, url: "" };
  const context = vm.createContext({
    els: { appUpdateIndicator: indicator },
    state,
    api: async () => response,
    renderInspector: () => {},
    t: (message, values = {}) => message.replace("{version}", values.version || ""),
  });
  vm.runInContext(initSource, context);

  await context.checkForAppUpdate();
  assert.equal(indicator.hidden, true);
  assert.equal(indicator.href, "");
  assert.equal(state.appUpdate.status, "current");
  assert.equal(state.appUpdate.currentVersion, "0.2.0");

  response = {
    available: true,
    currentVersion: "0.2.0",
    latestVersion: "0.3.0",
    installSupported: true,
    url: "https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.3.0",
  };
  await context.checkForAppUpdate();
  assert.equal(indicator.hidden, false);
  assert.equal(indicator.href, response.url);
  assert.equal(state.appUpdate.status, "available");
  assert.equal(state.appUpdate.installSupported, true);
  assert.match(indicator.title, /0\.3\.0/);
  assert.match(attributes.get("aria-label"), /0\.3\.0/);
});

test("app update indicator is absent from layout when no update exists", () => {
  assert.match(indexHtml, /id="appUpdateIndicator"[\s\S]*?hidden/);
  assert.match(styles, /\.app-update-indicator\[hidden\]\s*{\s*display:\s*none;/);
});

test("settings makes the current update state explicit", () => {
  const state = {
    appUpdate: { status: "current", currentVersion: "0.2.0", latestVersion: "0.2.0", url: "" },
  };
  const context = vm.createContext({
    state,
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
  });
  vm.runInContext(initSource, context);
  vm.runInContext(settingsSource, context);

  let view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.currentVersion, "v0.2.0");
  assert.equal(view.latestVersion, "v0.2.0");
  assert.equal(view.statusText, "已是最新版本");

  state.appUpdate = { status: "available", currentVersion: "0.2.0", latestVersion: "0.3.0", url: "https://example.test", installSupported: true };
  view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.statusClass, "available");
  assert.equal(view.showInstallAction, true);
  assert.match(view.statusText, /v0\.3\.0/);

  state.appUpdate.installSupported = false;
  view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.showInstallAction, false);
  assert.match(view.installNote, /不支持一键更新/);

  state.appUpdate.installing = true;
  state.appUpdate.installState = "verifying";
  state.appUpdate.installMessage = "正在重新校验更新条件";
  state.appUpdate.installStep = 3;
  state.appUpdate.installTotal = 6;
  view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.statusText, "正在重新校验更新条件");
  assert.equal(view.installing, true);
  assert.equal(view.installProgress, 50);

  state.appUpdate = {
    status: "available",
    currentVersion: "0.4.0",
    latestVersion: "0.4.1",
    installSupported: true,
    installMode: "nsis",
    installing: true,
    installState: "downloading",
    installMessage: "正在下载安装版更新",
    installStep: 2,
    installTotal: 4,
    downloadPercent: 73.6,
  };
  view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.statusText, "正在下载安装版更新");
  assert.equal(view.installProgress, 74);

  state.appUpdate = {
    status: "available",
    currentVersion: "0.2.0",
    latestVersion: "0.3.0",
    installSupported: true,
    lastResult: {
      state: "error",
      failedStage: "preflight",
      rollbackState: "not-needed",
      serviceState: "unchanged",
      error: "Forkline 自身目录有未提交修改",
    },
  };
  view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.statusText, "更新前检查未通过");
  assert.match(view.installError, /未提交修改/);
  assert.match(view.recoveryText, /没有修改|原版本仍在运行/);

  state.appUpdate = { status: "unavailable", currentVersion: "0.2.0", latestVersion: "", url: "" };
  view = vm.runInContext("settingsAppUpdateView()", context);
  assert.equal(view.currentVersion, "v0.2.0");
  assert.equal(view.latestVersion, "未知");
  assert.equal(view.statusText, "暂时无法检查更新");

  assert.match(settingsSource, /关于 Forkline/);
  assert.match(settingsSource, /settings-version-grid/);
  assert.match(settingsSource, /settings-update-progress-track/);
  assert.match(settingsSource, /settings-update-recovery/);
  assert.match(settingsSource, /data-settings-action="installUpdate"/);
  assert.match(eventsSource, /action === "installUpdate"[\s\S]*?installAppUpdate\(\)/);
  assert.match(settingsStyles, /\.settings-update-status\.current/);
  assert.match(settingsStyles, /\.settings-update-status\.available/);
  assert.match(settingsStyles, /\.settings-update-progress\s*\{/);
  assert.match(settingsStyles, /\.settings-update-recovery\.danger/);
});

test("operation log shows live Git output and exposes real cancellation", () => {
  const context = vm.createContext({
    state: { data: { runningOperations: [] } },
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
    tt: (strings, ...values) => strings.reduce((output, text, index) => `${output}${text}${values[index] ?? ""}`, ""),
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value),
  });
  vm.runInContext(logsSource, context);

  const runningMarkup = context.renderRunningOperationItem({
    id: "7",
    action: "fetch",
    label: "抓取远端",
    elapsed: "3 秒",
    startedTime: "2026-08-04 10:00:00",
    phase: "running",
    command: "git -C D:/repo fetch --progress --all --prune",
    outputTail: "Receiving objects: 42%",
    cancelSupported: true,
    cancellable: true,
    cancelRequested: false,
  });
  assert.match(runningMarkup, /data-operation-cancel="7"/);
  assert.match(runningMarkup, /git -C D:\/repo fetch --progress --all --prune/);
  assert.match(runningMarkup, /Receiving objects: 42%/);

  const cancelledMarkup = context.renderOperationLogItem({
    action: "fetch",
    label: "抓取远端",
    status: "cancelled",
    durationMs: 1200,
    command: "git fetch --progress --all --prune",
    summary: "操作已取消",
    outputTail: "Receiving objects: 42%",
  });
  assert.match(cancelledMarkup, /operation-log-item cancelled/);
  assert.match(cancelledMarkup, /已取消/);
  assert.match(apiSource, /startOperationPolling\(\);/);
  assert.match(apiSource, /fetch\("\/api\/operations"/);
  assert.match(apiSource, /async function cancelRunningOperation\(id, options = \{\}\)/);
  assert.doesNotMatch(logsSource, /async function cancelRunningOperation\(/);
  assert.match(eventsSource, /data-operation-cancel/);
  assert.match(repositoriesSource, /cancelCloneOrClose[\s\S]*?cancelRunningOperation/);
  assert.match(logsStyles, /\.operation-log-command\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  assert.doesNotMatch(styles, /\.logs-toolbar|\.operation-log-item|\.log-empty/);
});

test("file insights keep their panel-only styles out of the startup stylesheet", () => {
  assert.match(fileInsightsStyles, /\.file-history-head\s*\{/);
  assert.match(fileInsightsStyles, /\.file-blame-list\s*\{/);
  assert.match(fileInsightsStyles, /\.state-pill\.renamed\s*\{/);
  assert.doesNotMatch(styles, /\.file-history-head|\.file-blame-list|\.state-pill/);
});

test("self update results restore the previous repository and distinguish rollback failures", async () => {
  const calls = [];
  const state = { appUpdate: {}, data: {}, selectedTab: "details" };
  const context = vm.createContext({
    state,
    api: async (url, options) => {
      calls.push({ url, options });
      return {};
    },
    renderInspector: () => {},
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
  });
  vm.runInContext(initSource, context);

  const message = context.selfUpdateFailureMessage({ error: "更新后的 Forkline 服务没有正常启动。", rolledBack: true });
  assert.match(message, /已恢复到更新前版本/);
  const preflight = context.selfUpdateFailureMessage({
    error: "Forkline 自身目录有未提交修改",
    failedStage: "preflight",
    rollbackState: "not-needed",
    serviceState: "unchanged",
  });
  assert.match(preflight, /更新前检查未通过/);
  assert.match(preflight, /没有修改|原版本仍在运行/);
  const rollbackFailed = context.selfUpdateFailureMessage({
    error: "更新后的 Forkline 服务没有正常启动。",
    failedStage: "checking",
    rollbackState: "failed",
    serviceState: "unavailable",
  });
  assert.match(rollbackFailed, /自动回退未完成/);
  assert.match(rollbackFailed, /服务没有恢复/);
  context.applySelfUpdateProgress({ phase: "checking", step: 6, totalSteps: 6 });
  assert.equal(state.appUpdate.installState, "checking");
  assert.equal(state.appUpdate.installMessage, "正在确认新版本可以正常使用");
  assert.equal(state.appUpdate.installStep, 6);
  context.applySelfUpdateProgress({
    phase: "preparing",
    step: 1,
    totalSteps: 6,
    downloadStage: "receiving",
    downloadPercent: 42,
    downloadBytes: 1572864,
  });
  assert.match(state.appUpdate.installMessage, /42%/);
  assert.match(state.appUpdate.installMessage, /1\.5 MiB/);
  assert.match(settingsSource, /watchSelfUpdatePreparation[\s\S]*?api\("\/api\/app-update\/install"/);
  await context.restoreSelfUpdateRepo({ repoPath: "D:\\GitTest" });
  assert.equal(calls[0].url, "/api/open");
  assert.deepEqual(JSON.parse(calls[0].options.body), { path: "D:\\GitTest" });
});

test("startup keeps a repository already restored by the server", async () => {
  const calls = [];
  const saved = [];
  const serverRepo = { repo: { path: "D:\\GitTest", name: "GitTest", branch: "main", isSample: false } };
  const context = vm.createContext({
    api: async (url) => {
      calls.push(url);
      return serverRepo;
    },
    recentRepos: () => [{ path: "D:\\OlderRepo" }],
    saveRecentRepo: (repo) => saved.push(repo),
  });
  vm.runInContext(initSource, context);

  const result = await context.loadInitialRepoState("");
  assert.strictEqual(result, serverRepo);
  assert.deepEqual(calls, ["/api/state?ref=&details=core"]);
  assert.deepEqual(saved, [serverRepo.repo]);
  assert.match(initSource, /state\.data = await loadInitialRepoState\(initialRef\)/);
});

test("startup restores the latest recent repository", async () => {
  const calls = [];
  const saved = [];
  const sample = { repo: { path: "示例仓库", isSample: true } };
  const restored = { repo: { path: "D:\\GitTest", name: "GitTest", branch: "main", isSample: false } };
  const context = vm.createContext({
    api: async (url, options) => {
      calls.push({ url, options });
      return url === "/api/open" ? restored : sample;
    },
    recentRepos: () => [{ path: "D:\\GitTest" }, { path: "D:\\OlderRepo" }],
    saveRecentRepo: (repo) => saved.push(repo),
  });
  vm.runInContext(initSource, context);

  const result = await context.loadInitialRepoState("");
  assert.strictEqual(result, restored);
  assert.deepEqual(calls.map((item) => item.url), ["/api/state?ref=&details=core", "/api/open"]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { path: "D:\\GitTest", progressive: true });
  assert.deepEqual(saved, [restored.repo]);
});

test("startup stays on the sample repository when there is no recent repository", async () => {
  const calls = [];
  const sample = { repo: { path: "示例仓库", isSample: true } };
  const context = vm.createContext({
    api: async (url) => {
      calls.push(url);
      return sample;
    },
    recentRepos: () => [],
    saveRecentRepo: () => assert.fail("示例仓库不应写入最近仓库"),
  });
  vm.runInContext(initSource, context);

  const result = await context.loadInitialRepoState("");
  assert.strictEqual(result, sample);
  assert.deepEqual(calls, ["/api/state?ref=&details=core"]);
});

test("startup falls back to the sample repository when the saved path is unavailable", async () => {
  const calls = [];
  const sample = { repo: { path: "示例仓库", isSample: true } };
  const context = vm.createContext({
    api: async (url) => {
      calls.push(url);
      if (url === "/api/open") throw new Error("仓库不存在");
      return sample;
    },
    recentRepos: () => [{ path: "D:\\MissingRepo" }],
    saveRecentRepo: () => assert.fail("失效路径不应保存为最近仓库"),
  });
  vm.runInContext(initSource, context);

  const result = await context.loadInitialRepoState("");
  assert.strictEqual(result, sample);
  assert.deepEqual(calls, ["/api/state?ref=&details=core", "/api/open"]);
});

test("startup reapplies a requested ref after restoring the repository", async () => {
  const calls = [];
  const saved = [];
  const sample = { repo: { path: "示例仓库", isSample: true } };
  const restored = { repo: { path: "D:\\GitTest", branch: "main", isSample: false } };
  const selected = {
    repo: { path: "D:\\GitTest", branch: "main", selectedRef: "feature/test", isSample: false },
    commits: [{ sha: "feature-head" }],
    history: { limit: 120, loaded: 1, hasMore: false },
  };
  const responses = [sample, restored, selected];
  const context = vm.createContext({
    api: async (url) => {
      calls.push(url);
      return responses.shift();
    },
    recentRepos: () => [{ path: "D:\\GitTest" }],
    saveRecentRepo: (repo) => saved.push(repo),
  });
  vm.runInContext(initSource, context);

  const result = await context.loadInitialRepoState("feature/test");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), selected);
  assert.deepEqual(calls, ["/api/state?ref=feature%2Ftest&details=core", "/api/open", "/api/ref-state?ref=feature%2Ftest"]);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), [selected.repo]);
});

test("desktop repository handoff waits for startup and keeps the latest pending path", async () => {
  let openRepositoryHandler = null;
  let resolveInit;
  const opened = [];
  const initPromise = new Promise((resolve) => { resolveInit = resolve; });
  const context = vm.createContext({
    window: {
      Forkline: {},
      forklineDesktop: {
        onOpenRepository(handler) {
          openRepositoryHandler = handler;
          return () => {};
        },
      },
    },
    state: {},
    defaultRecoveryPolicy: () => ({}),
    initializeUiDiagnostics: () => {},
    initLocale: async () => {},
    initRecentRepoStorage: async () => {},
    initTheme: () => {},
    initLayoutResizers: () => {},
    initCommandHints: () => {},
    initWorktreeAutoRefresh: () => {},
    updateAmendMode: () => {},
    reportDesktopRecoveryState: () => {},
    init: () => initPromise,
    restoreDesktopRecoveryDraft: async () => false,
    openRepo: async (repository) => { opened.push(repository); return true; },
    toast: (message) => { throw new Error(message); },
  });
  vm.runInContext(bootstrapSource, context);

  assert.equal(typeof openRepositoryHandler, "function");
  openRepositoryHandler("D:\\RepoA");
  openRepositoryHandler("D:\\RepoB");
  await Promise.resolve();
  assert.deepEqual(opened, []);

  resolveInit();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, ["D:\\RepoB"]);

  openRepositoryHandler("D:\\RepoC");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, ["D:\\RepoB", "D:\\RepoC"]);
});

test("desktop preference persistence failures show a user-facing warning", async () => {
  let failureHandler = null;
  let beforeUnloadHandler = null;
  let stopped = false;
  const messages = [];
  const context = vm.createContext({
    window: {
      Forkline: {},
      ForklinePreferenceStorage: {
        init: async () => true,
        onPersistenceFailure(handler) {
          failureHandler = handler;
          return () => { stopped = true; };
        },
      },
      addEventListener(type, handler) {
        if (type === "beforeunload") beforeUnloadHandler = handler;
      },
    },
    state: {},
    defaultRecoveryPolicy: () => ({}),
    initializeUiDiagnostics: () => {},
    initLocale: async () => {},
    initRecentRepoStorage: async () => {},
    initTheme: () => {},
    initLayoutResizers: () => {},
    initCommandHints: () => {},
    initWorktreeAutoRefresh: () => {},
    updateAmendMode: () => {},
    init: async () => {},
    restoreDesktopRecoveryDraft: async () => false,
    toast: (message) => messages.push(message),
    t: (message) => message,
  });

  vm.runInContext(bootstrapSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof failureHandler, "function");
  failureHandler({ key: "forkline-theme", operation: "write" });
  assert.deepEqual(messages, ["本机偏好保存失败，本次更改不会在重启后保留。"]);

  beforeUnloadHandler();
  assert.equal(stopped, true);
});

test("opening a repository refreshes only selected branch history", async () => {
  const start = repositoriesSource.indexOf("async function applyOpenedRepoData");
  const end = repositoriesSource.indexOf("\nfunction clearOpenedRepoState", start);
  const applyOpenedRepoDataSource = repositoriesSource.slice(start, end);
  const calls = [];
  const openedState = {
    repo: { path: "D:\\Repo", name: "Repo", branch: "main", selectedRef: "", isSample: false },
    branches: ["main", "feature/test"],
    remotes: ["origin/main"],
    tags: [{ name: "v1.0.0" }],
    workingFiles: [{ path: "src/main.c", status: "M" }],
    commits: [{ sha: "all-branches" }],
    history: { limit: 120, loaded: 1, hasMore: false },
  };
  const selectedHistory = {
    repo: { path: "D:\\Repo", name: "Repo", branch: "main", selectedRef: "main", isSample: false },
    commits: [{ sha: "main-only" }],
    history: { limit: 120, loaded: 1, hasMore: true },
  };
  const state = { openRepoRequestId: 7 };
  let loadedSha = "";
  const context = vm.createContext({
    state,
    els: { searchInput: { value: "old search" } },
    api: async (url) => {
      calls.push(url);
      return selectedHistory;
    },
    clearOpenedRepoState: () => {},
    loadRecoveryPolicyForRepo: () => {},
    renderAll: () => {},
    loadCommit: async (sha) => { loadedSha = sha; },
    renderInspector: () => {},
  });
  vm.runInContext(applyOpenedRepoDataSource, context);

  const applied = await context.applyOpenedRepoData(openedState, 7);

  assert.equal(applied, true);
  assert.deepEqual(calls, ["/api/ref-state?ref=main"]);
  assert.strictEqual(state.data.branches, openedState.branches);
  assert.strictEqual(state.data.remotes, openedState.remotes);
  assert.strictEqual(state.data.tags, openedState.tags);
  assert.strictEqual(state.data.workingFiles, openedState.workingFiles);
  assert.strictEqual(state.data.commits, selectedHistory.commits);
  assert.strictEqual(state.data.history, selectedHistory.history);
  assert.equal(state.data.repo.selectedRef, "main");
  assert.equal(state.selectedRef, "main");
  assert.equal(state.selectedSha, "main-only");
  assert.equal(loadedSha, "main-only");
  assert.equal(context.els.searchInput.value, "");
});

test("repository switch state cleanup works before the lazy file editor search module loads", () => {
  const start = repositoriesSource.indexOf("function clearRepoScopedActionState");
  const end = repositoriesSource.indexOf("\nfunction repositorySwitchUnsavedItems", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ state: {}, els: {} });
  vm.runInContext(repositoriesSource.slice(start, end), context);

  assert.doesNotThrow(() => context.clearRepoScopedActionState());
  assert.equal(context.state.fileEditor, null);
});

test("repository switches protect unsaved editor and commit drafts", () => {
  assert.match(repositoriesSource, /function confirmRepositorySwitch\(repoPath\)/);
  assert.match(repositoriesSource, /if \(!confirmRepositorySwitch\(repoPath\)\) return false;/);
  assert.equal(
    (repositoriesSource.match(/openAfter && !confirmRepositorySwitch\(targetPath\)/g) || []).length,
    2
  );
});

test("repository switch confirmation names every unsaved item and skips the current repository", () => {
  const start = repositoriesSource.indexOf("function repositorySwitchUnsavedItems");
  const end = repositoriesSource.indexOf("\nasync function openRepo", start);
  assert.ok(start >= 0 && end > start);
  const prompts = [];
  const state = {
    data: { repo: { path: "D:\\RepoA" } },
    fileEditor: { file: "src/main.c" },
  };
  const els = {
    commitSummary: { value: "修复显示" },
    commitBody: { value: "" },
  };
  let editorDirty = true;
  const context = vm.createContext({
    state,
    els,
    fileEditorDirty: () => editorDirty,
    repoPathSnapshot: () => state.data.repo.path,
    normalizeRecentRepoPath: (value) => String(value).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase(),
    isCurrentRepoPath: (value) => value === state.data.repo.path,
    confirm: (message) => { prompts.push(message); return false; },
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
  });
  vm.runInContext(repositoriesSource.slice(start, end), context);

  assert.equal(context.confirmRepositorySwitch("D:\\RepoB"), false);
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /D:\\RepoB/);
  assert.match(prompts[0], /src\/main\.c/);
  assert.match(prompts[0], /提交信息草稿/);

  assert.equal(context.confirmRepositorySwitch("D:\\RepoA"), true);
  assert.equal(context.confirmRepositorySwitch("d:/repoa/"), true);
  assert.equal(prompts.length, 1);

  editorDirty = false;
  state.fileEditor.recoverySnapshotChanged = true;
  els.commitSummary.value = "";
  assert.equal(context.confirmRepositorySwitch("D:\\RepoB"), false);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /src\/main\.c/);
});

test("progressive repository open renders history before hydrating deferred details", async () => {
  const start = repositoriesSource.indexOf("async function applyOpenedRepoData");
  const end = repositoriesSource.indexOf("\nfunction clearOpenedRepoState", start);
  const source = repositoriesSource.slice(start, end);
  const calls = [];
  let resolveOpenDetails;
  const openDetailsPromise = new Promise((resolve) => { resolveOpenDetails = resolve; });
  const progressive = {
    progressive: true,
    repo: { path: "D:\\Repo", name: "Repo", branch: "main", selectedRef: "main", isSample: false },
    branches: ["main", "feature/test"],
    branchInfo: { main: {} },
    remotes: [],
    remoteInfo: {},
    sync: { branch: "main", unborn: false, remotes: [] },
    branchCleanup: [],
    worktrees: [],
    submodules: [],
    workingFiles: [],
    stashes: [],
    recoveryPoints: [],
    tags: [],
    commits: [{ sha: "core-main" }],
    history: { limit: 120, loaded: 1, hasMore: false },
  };
  const openDetails = {
    repo: { operation: null },
    branchInfo: { main: { upstream: "origin/main" }, "feature/test": {} },
    workingFiles: [{ file: "draft.txt", state: "M" }],
    tags: [{ name: "v1.0.0" }],
  };
  const state = { openRepoRequestId: 9, repoHydrating: false };
  let renderAllCount = 0;
  let renderStageCount = 0;
  let loadedSha = "";
  const context = vm.createContext({
    state,
    els: { searchInput: { value: "old search" } },
    api: async (url) => {
      calls.push(url);
      return openDetailsPromise;
    },
    clearOpenedRepoState: () => {},
    loadRecoveryPolicyForRepo: () => {},
    renderAll: () => { renderAllCount += 1; },
    loadCommit: async (sha) => { loadedSha = sha; },
    renderInspector: () => {},
    renderRepo: () => {},
    renderBranches: () => {},
    renderStage: () => { renderStageCount += 1; },
    updateAmendMode: () => {},
    isCurrentRepoPath: (repoPath) => state.data?.repo?.path === repoPath,
    toast: () => {},
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
  });
  vm.runInContext(source, context);

  const applying = context.applyOpenedRepoData(progressive, 9);
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ["/api/open-details"]);
  assert.equal(renderAllCount, 1);
  assert.equal(state.repoHydrating, true);
  assert.equal(state.data.commits[0].sha, "core-main");
  assert.equal(loadedSha, "core-main");

  state.selectedRef = "feature/test";
  state.selectedSha = "feature-head";
  state.data.repo.selectedRef = "feature/test";
  state.data.commits = [{ sha: "feature-head" }];
  state.data.history = { limit: 120, loaded: 1, hasMore: true };
  resolveOpenDetails(openDetails);
  assert.equal(await applying, true);

  assert.equal(state.repoHydrating, false);
  assert.equal(state.data.progressive, false);
  assert.equal(state.data.workingFiles[0].file, "draft.txt");
  assert.equal(state.data.tags[0].name, "v1.0.0");
  assert.deepEqual(state.data.branches, ["main", "feature/test"]);
  assert.equal(state.data.sync.branch, "main");
  assert.equal(state.data.branchCleanup, undefined);
  assert.equal(state.data.worktrees, undefined);
  assert.equal(state.data.submodules, undefined);
  assert.equal(state.data.stashes, undefined);
  assert.equal(state.data.recoveryPoints, undefined);
  assert.equal(state.selectedRef, "feature/test");
  assert.equal(state.selectedSha, "feature-head");
  assert.equal(state.data.commits[0].sha, "feature-head");
  assert.equal(renderStageCount, 1);
});

test("repository open falls back to local core state when detail fetch fails", async () => {
  const start = repositoriesSource.indexOf("async function applyOpenedRepoData");
  const end = repositoriesSource.indexOf("\nfunction clearOpenedRepoState", start);
  const source = repositoriesSource.slice(start, end);
  const calls = [];
  const messages = [];
  const progressive = {
    progressive: true,
    repo: { path: "D:\\Repo", name: "Repo", branch: "main", selectedRef: "main", isSample: false },
    branches: ["main"],
    branchInfo: { main: {} },
    remotes: ["origin/main"],
    remoteInfo: {},
    sync: { branch: "main", unborn: false, remotes: ["origin"] },
    workingFiles: [],
    tags: [],
    commits: [{ sha: "initial-main" }],
    history: { limit: 120, loaded: 1, hasMore: false },
  };
  const localCore = {
    repo: { path: "D:\\Repo", name: "Repo", branch: "main", selectedRef: "main", isSample: false },
    branches: ["main"],
    branchInfo: { main: { upstream: "origin/main" } },
    remotes: ["origin/main"],
    remoteInfo: {},
    sync: { branch: "main", unborn: false, remotes: ["origin"] },
    workingFiles: [{ file: "local-draft.txt", state: "M" }],
    tags: [{ name: "local-v1" }],
    commits: [{ sha: "fallback-main" }],
    history: { limit: 120, loaded: 1, hasMore: false },
  };
  const state = { openRepoRequestId: 12, repoHydrating: false };
  const context = vm.createContext({
    state,
    els: { searchInput: { value: "" } },
    api: async (url) => {
      calls.push(url);
      if (url === "/api/open-details") throw new Error("Failed to fetch");
      return localCore;
    },
    clearOpenedRepoState: () => {},
    loadRecoveryPolicyForRepo: () => {},
    renderAll: () => {},
    loadCommit: async () => {},
    renderInspector: () => {},
    renderRepo: () => {},
    renderBranches: () => {},
    renderStage: () => {},
    updateAmendMode: () => {},
    isCurrentRepoPath: (repoPath) => state.data?.repo?.path === repoPath,
    toast: (message) => messages.push(message),
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
  });
  vm.runInContext(source, context);

  assert.equal(await context.applyOpenedRepoData(progressive, 12), true);

  assert.deepEqual(calls, ["/api/open-details", "/api/state?ref=main&details=core"]);
  assert.equal(state.repoHydrating, false);
  assert.equal(state.data.progressive, false);
  assert.equal(state.data.progressiveError, "");
  assert.equal(state.data.progressiveWarning, "详情请求暂时失败，已使用本地 Git 数据打开仓库");
  assert.equal(state.data.workingFiles[0].file, "local-draft.txt");
  assert.equal(state.data.tags[0].name, "local-v1");
  assert.equal(state.data.commits[0].sha, "initial-main");
  assert.match(messages.join("\n"), /本地 Git 数据/);
});

test("repository open keeps local history readable when detail and fallback requests both fail", async () => {
  const start = repositoriesSource.indexOf("async function applyOpenedRepoData");
  const end = repositoriesSource.indexOf("\nfunction clearOpenedRepoState", start);
  const source = repositoriesSource.slice(start, end);
  const calls = [];
  const messages = [];
  const progressive = {
    progressive: true,
    repo: { path: "D:\\Repo", name: "Repo", branch: "main", selectedRef: "main", isSample: false },
    branches: ["main"],
    branchInfo: { main: {} },
    remotes: ["origin/main"],
    remoteInfo: {},
    sync: { branch: "main", unborn: false, remotes: ["origin"] },
    workingFiles: [],
    tags: [],
    commits: [{ sha: "local-main" }],
    history: { limit: 120, loaded: 1, hasMore: false },
  };
  const state = { openRepoRequestId: 13, repoHydrating: false };
  const context = vm.createContext({
    state,
    els: { searchInput: { value: "" } },
    api: async (url) => {
      calls.push(url);
      throw new Error("Failed to fetch");
    },
    clearOpenedRepoState: () => {},
    loadRecoveryPolicyForRepo: () => {},
    renderAll: () => {},
    loadCommit: async () => {},
    renderInspector: () => {},
    renderRepo: () => {},
    renderBranches: () => {},
    renderStage: () => {},
    updateAmendMode: () => {},
    isCurrentRepoPath: (repoPath) => state.data?.repo?.path === repoPath,
    toast: (message) => messages.push(message),
    t: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? "")),
  });
  vm.runInContext(source, context);

  assert.equal(await context.applyOpenedRepoData(progressive, 13), true);

  assert.deepEqual(calls, ["/api/open-details", "/api/state?ref=main&details=core"]);
  assert.equal(state.repoHydrating, true);
  assert.equal(state.data.progressive, false);
  assert.equal(state.data.progressiveError, "无法连接 Forkline 本地服务");
  assert.equal(state.data.commits[0].sha, "local-main");
  assert.match(messages.join("\n"), /提交历史已打开/);
});

test("repository detail loading discards superseded and switched-repository responses", async () => {
  const start = repositoriesSource.indexOf("const repoDetailFields");
  const end = repositoriesSource.indexOf("\nfunction clearOpenedRepoState", start);
  const source = repositoriesSource.slice(start, end);
  const pending = [];
  const state = {
    data: { repo: { path: "D:\\RepoA", isSample: false } },
    selectedTab: "details",
    repoDetailRequestId: 0,
    repoDetailLoads: {},
  };
  const context = vm.createContext({
    state,
    api: (url) => new Promise((resolve, reject) => pending.push({ url, resolve, reject })),
    repoPathSnapshot: () => state.data?.repo?.path || "",
    isCurrentRepoPath: (repoPath) => state.data?.repo?.path === repoPath,
    renderBranches: () => {},
    renderInspector: () => {},
    t: (message) => message,
    els: {},
    setActiveDiff: () => {},
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value),
  });
  vm.runInContext(source, context);

  const first = context.loadRepoDetailSection("stashes", { refresh: true });
  const second = context.loadRepoDetailSection("stashes", { refresh: true });
  assert.deepEqual(pending.map((item) => item.url), [
    "/api/state-details?section=stashes",
    "/api/state-details?section=stashes",
  ]);
  pending[1].resolve({ section: "stashes", stashes: [{ ref: "stash@{0}", message: "new" }] });
  assert.equal(await second, true);
  pending[0].resolve({ section: "stashes", stashes: [{ ref: "stash@{0}", message: "old" }] });
  assert.equal(await first, false);
  assert.equal(state.data.stashes[0].message, "new");

  const switched = context.loadRepoDetailSection("recoveryPoints", { refresh: true });
  state.data = { repo: { path: "D:\\RepoB", isSample: false } };
  pending[2].resolve({ section: "recoveryPoints", recoveryPoints: [{ ref: "old-repo" }] });
  assert.equal(await switched, false);
  assert.equal(state.data.recoveryPoints, undefined);

  state.data.branchInfo = {
    main: { upstream: "origin/main" },
    feature: { worktreePath: "D:\\OldWorktree", prunable: true, reason: "missing" },
  };
  context.mergeRepoDetailSection("worktrees", {
    worktrees: [],
    worktreePruneSnapshot: "fresh-snapshot",
    worktreeBranchInfo: { topic: { worktreePath: "D:\\TopicWorktree", prunable: false } },
  });
  assert.equal(state.data.branchInfo.feature.worktreePath, undefined);
  assert.equal(state.data.branchInfo.feature.prunable, undefined);
  assert.equal(state.data.branchInfo.topic.worktreePath, "D:\\TopicWorktree");
});

test("command hint observer starts before the app renders dynamic panels", () => {
  assert.match(bootstrapSource, /initCommandHints\(\);[\s\S]*?init\(\);/);
});

test("missing layout preferences keep the CSS defaults", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const context = vm.createContext({
    document: {
      body: { classList: { add: () => {}, remove: () => {} } },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: { getItem: () => null },
    window: { addEventListener: () => {}, innerHeight: 900, innerWidth: 1600 },
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();
  assert.equal(values.get("--sidebar-w"), "240px");
  assert.equal(values.get("--inspector-w"), "340px");
  assert.equal(values.get("--stage-h"), "300px");
});

test("temporarily constrained side panels recover their preferred widths", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const stored = new Map([
    ["forkline-sidebar-w", "280"],
    ["forkline-inspector-w", "380"],
  ]);
  const listeners = new Map();
  const windowMock = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    innerHeight: 900,
    innerWidth: 1600,
  };
  const context = vm.createContext({
    document: {
      body: { classList: { add: () => {}, remove: () => {} } },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: {
      getItem: (name) => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, String(value)),
    },
    window: windowMock,
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();
  assert.equal(values.get("--sidebar-w"), "280px");
  assert.equal(values.get("--inspector-w"), "380px");

  windowMock.innerWidth = 800;
  listeners.get("resize")();
  assert.equal(values.get("--sidebar-w"), "160px");
  assert.equal(values.get("--inspector-w"), "266px");

  windowMock.innerWidth = 1600;
  listeners.get("resize")();
  assert.equal(values.get("--sidebar-w"), "280px");
  assert.equal(values.get("--inspector-w"), "380px");
});

test("bottom panel resizer updates and saves the stage height", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const stored = new Map();
  const handleListeners = new Map();
  const documentListeners = new Map();
  const bodyClasses = new Set();
  const handle = {
    dataset: { resizer: "stage" },
    addEventListener: (name, listener) => handleListeners.set(name, listener),
    setPointerCapture: () => {},
  };
  const context = vm.createContext({
    document: {
      body: {
        classList: {
          add: (name) => bodyClasses.add(name),
          remove: (name) => bodyClasses.delete(name),
        },
      },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [handle],
      addEventListener: (name, listener) => documentListeners.set(name, listener),
      removeEventListener: (name) => documentListeners.delete(name),
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: {
      getItem: (name) => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, String(value)),
    },
    window: { addEventListener: () => {}, innerHeight: 900, innerWidth: 1600 },
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();

  handleListeners.get("pointerdown")({ clientY: 500, pointerId: 1, preventDefault: () => {} });
  documentListeners.get("pointermove")({ clientY: 420 });
  assert.equal(values.get("--stage-h"), "380px");
  assert.equal(bodyClasses.has("resizing"), true);

  documentListeners.get("pointerup")();
  assert.equal(stored.get("forkline-stage-h"), "380");
  assert.equal(bodyClasses.has("resizing"), false);
});

test("history header resizer updates the graph column and saves all visible widths", () => {
  const values = new Map([["--graph-w", "176px"]]);
  const stored = new Map();
  const handleListeners = new Map();
  const documentListeners = new Map();
  const bodyClasses = new Set();
  let graphResizeRequests = 0;
  const cell = (name, width) => ({
    dataset: { historyColumn: name },
    getBoundingClientRect: () => ({ width: name === "graph" ? Number.parseFloat(values.get("--history-graph-col-w")) || width : width }),
  });
  const cells = [cell("graph", 176), cell("message", 300), cell("author", 140), cell("time", 90), cell("sha", 82)];
  const handle = {
    dataset: { historyResizer: "graph" },
    addEventListener: (name, listener) => handleListeners.set(name, listener),
    closest: () => cells[0],
    setPointerCapture: () => {},
  };
  const history = {};
  const head = { clientWidth: 788 };
  const documentElement = {
    style: {
      setProperty: (name, value) => values.set(name, value),
      removeProperty: (name) => values.delete(name),
    },
  };
  const context = vm.createContext({
    document: {
      body: {
        classList: {
          add: (name) => bodyClasses.add(name),
          remove: (name) => bodyClasses.delete(name),
        },
      },
      documentElement,
      querySelector: (selector) => selector === ".history" ? history : selector === ".history-head" ? head : null,
      querySelectorAll: (selector) => selector === "[data-history-resizer]" ? [handle] : selector === ".history-head > [data-history-column]" ? cells : [],
      addEventListener: (name, listener) => documentListeners.set(name, listener),
      removeEventListener: (name) => documentListeners.delete(name),
    },
    getComputedStyle: (target) => ({
      display: target === documentElement || target === history ? "block" : "grid",
      getPropertyValue: (name) => name === "--graph-w" ? "176px" : values.get(name) || "",
    }),
    localStorage: {
      getItem: (name) => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, String(value)),
    },
    scheduleCommitGraphResize: () => {
      graphResizeRequests += 1;
    },
    window: { addEventListener: () => {}, innerWidth: 1600 },
  });
  vm.runInContext(layoutSource, context);
  context.initHistoryColumnResizers();

  handleListeners.get("pointerdown")({ clientX: 200, pointerId: 1, preventDefault: () => {} });
  graphResizeRequests = 0;
  documentListeners.get("pointermove")({ clientX: 240 });
  assert.equal(values.get("--history-graph-col-w"), "216px");
  assert.equal(graphResizeRequests, 1);
  assert.equal(bodyClasses.has("resizing"), true);

  documentListeners.get("pointerup")();
  const saved = JSON.parse(stored.get("forkline-history-columns"));
  assert.equal(saved.graph, 216);
  assert.equal(saved.author, 140);
  assert.equal(saved.time, 90);
  assert.equal(saved.sha, 82);
  assert.equal(bodyClasses.has("resizing"), false);
});

test("transition-width topbar uses compact repository path columns", () => {
  assert.match(styles, /@media\s*\(max-width:\s*1040px\)[\s\S]*?\.path-open\s*\{[^}]*grid-template-columns:\s*minmax\(96px,\s*1fr\)\s+minmax\(96px,\s*116px\)\s+max-content;/s);
});

test("phone-width topbar moves repository actions onto a contained second row", () => {
  assert.match(styles, /@media\s*\(max-width:\s*600px\)[\s\S]*?:root\s*\{[^}]*--header-h:\s*224px;/s);
  assert.match(styles, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.path-open\s*\{[^}]*height:\s*72px;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(104px,\s*128px\);[^}]*grid-template-rows:\s*30px\s+30px;/s);
  assert.match(styles, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.path-actions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*min-width:\s*0;/s);
  assert.match(styles, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.path-actions\s+\.btn\s*\{[^}]*min-width:\s*0;[^}]*flex:\s*1\s+1\s+0;/s);
});

test("worktree, index, and commit editor share one parallel bottom row", () => {
  const stageStart = indexHtml.indexOf('<section class="stage">');
  const stageEnd = indexHtml.indexOf("</section>", stageStart);
  const stageMarkup = indexHtml.slice(stageStart, stageEnd);
  const worktreeIndex = stageMarkup.indexOf('id="changeList"');
  const stagedIndex = stageMarkup.indexOf('id="stagedChangeList"');
  const commitIndex = stageMarkup.indexOf('id="commitForm"');

  assert.ok(stageStart >= 0 && stageEnd > stageStart);
  assert.ok(worktreeIndex >= 0 && stagedIndex > worktreeIndex && commitIndex > stagedIndex);
  assert.doesNotMatch(stageMarkup, /class="work-diff"/);
  assert.match(styles, /\.stage\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(styles, /@container\s+main-workspace\s*\(max-width:\s*700px\)[\s\S]*?\.stage\s*\{[^}]*grid-template-columns:\s*220px\s+220px\s+minmax\(240px,\s*1fr\);/s);
  assert.match(worktreeSource, /els\.changeList\.innerHTML\s*=\s*`[\s\S]*?renderChangeSection\("unstaged"/s);
  assert.match(worktreeSource, /els\.stagedChangeList\.innerHTML\s*=\s*`[\s\S]*?renderChangeSection\("staged"/s);
  assert.match(contextMenuSource, /action\s*===\s*"diff"[\s\S]*?await loadWorkingDiffLazy\(context\.file\);[\s\S]*?await openDiffModalLazy\(\);/s);
});

test("narrow layout preserves commit messages and contains the commit form", () => {
  assert.match(styles, /\.main\s*\{[^}]*container-name:\s*main-workspace;/s);
  assert.match(styles, /@container\s+main-workspace\s*\(max-width:\s*700px\)/);
  assert.match(styles, /@container\s+main-workspace\s*\(max-width:\s*500px\)[\s\S]*?grid-template-columns:\s*var\(--history-graph-col-w,\s*var\(--graph-w\)\)\s+minmax\(96px,\s*1fr\)\s+var\(--history-time-w,\s*minmax\(66px,\s*72px\)\);/);
  assert.match(styles, /\.commit-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.mini-btn\s*>\s*\.command-hint\s*\{[^}]*display:\s*none;/s);
});

test("portrait layout docks the inspector below the graph without disabling the sidebar resizer", () => {
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*1600px\)/);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.workspace\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-w\)\s+7px\s+minmax\(0,\s*1fr\);[^}]*grid-template-rows:\s*minmax\(500px,\s*70%\)\s+minmax\(280px,\s*30%\);/s);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.workspace-resizer\[data-resizer="sidebar"\]\s*\{[^}]*display:\s*block;[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.workspace-resizer\[data-resizer="inspector"\]\s*\{[^}]*display:\s*none;/s);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.inspector\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*border-top:\s*1px\s+solid\s+var\(--line-strong\);/s);
});

test("portrait width calculation leaves room for the graph instead of the docked inspector", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const context = vm.createContext({
    document: {
      body: { classList: { add: () => {}, remove: () => {} } },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: { getItem: () => null },
    window: {
      addEventListener: () => {},
      innerHeight: 1279,
      innerWidth: 716,
      matchMedia: () => ({ matches: true }),
    },
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();
  assert.equal(values.get("--sidebar-w"), "240px");
  assert.equal(values.get("--inspector-w"), "340px");
});

test("graph labels expand with the resized graph column and stay inside it", () => {
  let graphColumnWidth = 176;
  const history = {};
  const context = vm.createContext({
    graphWidth: 176,
    rowH: 62,
    laneX: [28, 54, 80, 106, 132, 154, 166],
    state: { data: { branches: ["feature/complete-portrait-layout"], remotes: [], repo: { remoteNames: [] } } },
    els: { commitGraph: { closest: () => history } },
    document: { documentElement: {} },
    getComputedStyle: () => ({
      getPropertyValue: (name) => name === "--history-graph-col-w" ? `${graphColumnWidth}px` : "",
    }),
    escapeHtml: (value) => String(value),
    laneColor: () => "#23c7b7",
  });
  vm.runInContext(graphSource, context);

  const branch = "feature/complete-portrait-layout";
  const commits = [{ sha: "a", short: "a", lane: 2, refs: branch, parents: [], color: "#23c7b7" }];
  const narrowWidth = context.graphRenderWidth(commits, "");
  const narrowMarkup = context.graphLabel(80, 31, branch, "#23c7b7", narrowWidth);
  const narrowText = narrowMarkup.match(/<text[^>]*>([^<]*)<\/text>/)?.[1] || "";

  graphColumnWidth = 360;
  const wideWidth = context.graphRenderWidth(commits, "");
  const wideMarkup = context.graphLabel(80, 31, branch, "#23c7b7", wideWidth);
  const wideText = wideMarkup.match(/<text[^>]*>([^<]*)<\/text>/)?.[1] || "";
  const wideRect = Number(wideMarkup.match(/<rect[^>]*width="([^"]+)"/)?.[1] || 0);
  const svgMarkup = context.renderGraphSvg(commits, 62, "", wideWidth);
  const veryLongBranch = "forkline/portrait-very-long-branch-name-for-layout-test";
  const expandedMarkup = context.graphLabel(28, 31, veryLongBranch, "#23c7b7", 420);
  const expandedText = expandedMarkup.match(/<text[^>]*>([^<]*)<\/text>/)?.[1] || "";

  assert.equal(narrowWidth, 176);
  assert.ok(narrowText.endsWith("..."));
  assert.equal(wideWidth, 360);
  assert.equal(wideText, branch);
  assert.ok(wideRect <= wideWidth - 6 - (80 + 12));
  assert.match(svgMarkup, /style="width:360px(?:;[^"]*)?"/);
  assert.equal(expandedText, veryLongBranch);
});

test("graph mode badge keeps the complete scope name instead of shrinking", () => {
  assert.match(styles, /\.graph-head\s+em\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*overflow:\s*visible;[^}]*max-width:\s*none;[^}]*text-overflow:\s*clip;/s);
});

test("history header exposes four draggable column separators", () => {
  assert.equal((indexHtml.match(/data-history-resizer=/g) || []).length, 4);
  assert.match(styles, /--history-cols:\s*var\(--history-graph-col-w,\s*var\(--graph-w\)\)[^;]*var\(--history-author-w,[^;]*var\(--history-time-w,[^;]*var\(--history-sha-w,/s);
  assert.match(styles, /\.history-column-resizer\s*\{[^}]*width:\s*14px;[^}]*cursor:\s*col-resize;[^}]*touch-action:\s*none;/s);
  assert.match(styles, /\.history-column-resizer::before\s*\{[^}]*right:\s*0;[^}]*width:\s*2px;[^}]*background:\s*color-mix\(in srgb,\s*var\(--quiet\)\s*68%,\s*var\(--teal\)\s*32%\);/s);
  assert.doesNotMatch(styles, /\.history-column-resizer::after\s*\{/);
  assert.match(styles, /\.history-column-resizer:hover::before,[\s\S]*?width:\s*3px;[\s\S]*?background:\s*var\(--teal\);/s);
  assert.match(styles, /\.commit-row\s*\{[^}]*padding:\s*0;/s);
});

test("minimum inspector width wraps controls instead of clipping labels", () => {
  assert.match(styles, /\.inspector\s*\{[^}]*container-name:\s*inspector-panel;/s);
  assert.match(styles, /@container\s+inspector-panel\s*\(max-width:\s*300px\)/);
  assert.match(repositoryPanelStyles, /@container\s+inspector-panel\s*\(max-width:\s*300px\)[\s\S]*?\.upstream-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(settingsStyles, /\.settings-card-head\s*>\s*\.mini-btn\s*\{[^}]*width:\s*100%;/s);
});

test("sync panel grid buttons center their labels in both axes", () => {
  assert.match(repositoryPanelStyles, /\.sync-actions \.mini-btn,\s*\.sync-section-head \.mini-btn,\s*\.upstream-actions \.mini-btn,\s*\.remote-actions \.mini-btn\s*\{[^}]*place-items:\s*center;[^}]*text-align:\s*center;/s);
});

test("repository tool panels keep their shared styles out of the startup stylesheet", () => {
  assert.match(repositoryPanelStyles, /\.stash-layout,/);
  assert.match(repositoryPanelStyles, /\.recovery-retention\s*\{/);
  assert.match(repositoryPanelStyles, /\.auth-card\s*\{/);
  assert.match(repositoryPanelStyles, /\.compare-picker\s*\{/);
  assert.doesNotMatch(styles, /\.stash-layout|\.recovery-retention|\.auth-card|\.compare-picker/);
});

test("folder picker and command palette keep dedicated styles out of the startup stylesheet", () => {
  assert.match(folderCommandStyles, /\.folder-dialog\s*\{[^}]*display:\s*grid;/s);
  assert.match(folderCommandStyles, /\.folder-row\s*\{[^}]*grid-template-columns:\s*42px\s+minmax\(0,\s*1fr\)\s+auto;/s);
  assert.match(folderCommandStyles, /\.command-dialog\s*\{[^}]*width:\s*min\(680px,/s);
  assert.match(folderCommandStyles, /\.command-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  assert.doesNotMatch(styles, /\.folder-dialog|\.folder-head|\.folder-row|\.command-dialog|\.command-body|\.command-row/);
  assert.match(styles, /\.checkout-modal\s*\{[^}]*display:\s*none;/s);
  assert.match(styles, /\.checkout-dialog\s*\{/);
  assert.match(styles, /\.command-hint\s*\{/);
});

test("diff workbench keeps interactive layout out of the startup stylesheet", () => {
  assert.match(styles, /\.diff-modal\s*\{[^}]*display:\s*none;/s);
  assert.match(diffWorkbenchStyles, /\.diff-modal-head\s*\{[^}]*display:\s*flex;/s);
  assert.match(diffWorkbenchStyles, /\.work-diff-feedback\s*\{[^}]*position:\s*sticky;/s);
  assert.match(diffWorkbenchStyles, /\.diff-line-toolbar\s*\{[^}]*justify-content:\s*flex-end;/s);
  assert.match(diffWorkbenchStyles, /\.side-row\.diff-line-selectable\s*\{[^}]*cursor:\s*pointer;/s);
  assert.match(diffWorkbenchStyles, /\.hunk-actions\s*\{[^}]*position:\s*sticky;/s);
  assert.doesNotMatch(styles, /\.diff-modal-head|\.work-diff-feedback|\.diff-line-toolbar|\.diff-line-selectable|\.hunk-actions|work-diff-target/);
});

test("minimum sidebar width contains branch rows and actions", () => {
  assert.match(styles, /\.sidebar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.side-section\s*\{[^}]*min-width:\s*0;/s);
});

test("commit operation sections center without changing other detail headings", () => {
  assert.equal((inspectorSource.match(/class="detail-section-title commit-action-section-title"/g) || []).length, 3);
  assert.equal((inspectorSource.match(/class="commit-tools commit-action-tools"/g) || []).length, 3);
  assert.match(styles, /\.commit-action-section-title,[\s\S]*?\.history-queue-empty\s*\{[^}]*text-align:\s*center;/s);
  assert.doesNotMatch(styles, /\.detail-section-title\s*\{[^}]*text-align:\s*center;/s);
});

test("history editing controls are collapsed until a plan or queue needs attention", () => {
  assert.equal((inspectorSource.match(/<details class="commit-action-disclosure"/g) || []).length, 2);
  assert.match(inspectorSource, /const historyPlanOpen = state\.historyPlan\?\.sha === commit\.sha/);
  assert.match(inspectorSource, /const historyQueueOpen = Boolean\([\s\S]*?state\.historyQueue\.items\?\.length[\s\S]*?state\.historyQueue\.error[\s\S]*?\)/);
  assert.match(inspectorSource, /<details class="commit-action-disclosure" \$\{historyPlanOpen \? "open" : ""\}>/);
  assert.match(inspectorSource, /<details class="commit-action-disclosure" \$\{historyQueueOpen \? "open" : ""\}>/);
  assert.match(styles, /\.commit-action-disclosure > summary\s*\{[^}]*justify-content:\s*center;[^}]*cursor:\s*pointer;/s);
});

test("history rewrite plan and queue keep full styles out of the startup stylesheet", () => {
  assert.match(commitActionStyles, /\.history-plan-head\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  assert.match(commitActionStyles, /\.history-plan-commit\s*\{[^}]*grid-template-columns:\s*42px\s+minmax\(0,\s*1fr\);/s);
  assert.match(commitActionStyles, /\.history-queue-item\s*\{[^}]*grid-template-columns:\s*minmax\(108px,\s*0\.42fr\)\s+minmax\(0,\s*1fr\);/s);
  assert.match(commitActionStyles, /\.history-queue-reword textarea\s*\{[^}]*resize:\s*vertical;/s);
  assert.doesNotMatch(styles, /\.history-plan-head|\.history-plan-grid|\.history-plan-commit|\.history-queue-item|\.history-queue-reword|\.history-queue-preview-title/);
  assert.match(styles, /\.history-plan\s*\{/);
  assert.match(styles, /\.history-plan-empty\s*\{/);
  assert.match(styles, /\.history-queue-empty\s*\{/);
});

test("commit operation buttons use a compact responsive grid", () => {
  assert.match(styles, /\.commit-action-tools\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*6px;/s);
  assert.match(styles, /\.commit-action-tools \.mini-btn\s*\{[^}]*white-space:\s*normal;/s);
  assert.match(styles, /\[data-commit-tool="resetHard"\],[\s\S]*?\[data-commit-tool="drop"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
  assert.match(styles, /@container\s+inspector-panel\s*\(max-width:\s*300px\)[\s\S]*?\.commit-action-tools\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
});

test("commit message body editor keeps a practical minimum while expanding to full content", () => {
  assert.match(styles, /\.reword-form \.edit-field textarea\s*\{[^}]*min-height:\s*132px;/s);
  assert.match(styles, /\.reword-form \.edit-field textarea\s*\{[^}]*max-height:\s*none;/s);
  assert.match(styles, /\.reword-form \.edit-field textarea\s*\{[^}]*field-sizing:\s*content;/s);
  assert.match(styles, /\.reword-form \.edit-field textarea\s*\{[^}]*overflow-y:\s*auto;/s);
});

test("conflict choice buttons form an equal centered row", () => {
  assert.match(styles, /\.conflict-choice-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.conflict-choice-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*width:\s*100%;/s);
  assert.match(styles, /\.conflict-choice-actions \.mini-btn\s*\{[^}]*display:\s*grid;[^}]*width:\s*100%;[^}]*place-items:\s*center;[^}]*text-align:\s*center;/s);
  assert.match(styles, /\.conflict-choice-actions \.mini-btn\s*>\s*span:not\(\.command-hint\)\s*\{[^}]*width:\s*100%;[^}]*text-align:\s*center;/s);
});

test("context menus stay accessible within short viewports", () => {
  assert.match(contextMenuStyles, /\.context-menu\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*16px\);/s);
  assert.match(contextMenuStyles, /\.context-menu\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(eventsSource, /document\.addEventListener\("scroll",\s*\(event\)\s*=>\s*\{\s*if\s*\(event\.target instanceof Element && event\.target\.closest\("\.context-menu"\)\) return;/s);
});

function commandButton(command, title = "") {
  const attributes = new Map();
  if (title) attributes.set("title", title);
  const button = {
    classList: { contains: (name) => name === "mini-btn" },
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
  };
  const hint = { parentElement: button, textContent: command };
  const root = { querySelectorAll: () => [hint] };
  return { button, root };
}
