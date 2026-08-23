"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "api.js"), "utf8");

test("API encodes non-Latin repository paths before creating request headers", async () => {
  const repoPath = "D:\\桌面\\GitTest";
  let requestHeaders = null;
  const state = {
    data: {
      repo: { path: repoPath, isSample: false },
    },
  };
  const context = vm.createContext({
    Headers,
    state,
    window: { Forkline: {} },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => repoPath,
    isCurrentRepoPath: (candidate) => candidate === repoPath,
    fetch: async (_pathname, options) => {
      requestHeaders = new Headers(options.headers);
      return {
        ok: true,
        json: async () => ({}),
      };
    },
  });

  vm.runInContext(source, context);
  await context.api("/api/worktree");

  assert.equal(requestHeaders.get("X-Forkline-Repo-Path"), `v1:${encodeURIComponent(repoPath)}`);
  assert.equal(requestHeaders.get("X-Forkline-Locale"), "zh-CN");
});

test("API sends the active English locale", async () => {
  let requestHeaders = null;
  const context = vm.createContext({
    Headers,
    state: { data: null },
    window: { Forkline: {} },
    currentLocale: () => "en",
    t: (value) => value,
    repoPathSnapshot: () => "",
    isCurrentRepoPath: () => true,
    fetch: async (_pathname, options) => {
      requestHeaders = new Headers(options.headers);
      return {
        ok: true,
        json: async () => ({}),
      };
    },
  });

  vm.runInContext(source, context);
  await context.api("/api/state");

  assert.equal(requestHeaders.get("X-Forkline-Locale"), "en");
});

test("API translates browser network failures into a local service message", async () => {
  const context = vm.createContext({
    Headers,
    state: { data: null },
    window: { Forkline: {} },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => "",
    isCurrentRepoPath: () => true,
    fetch: async () => { throw new TypeError("Failed to fetch"); },
  });

  vm.runInContext(source, context);

  await assert.rejects(context.api("/api/state"), /无法连接 Forkline 本地服务/);
});

test("API retries one transient repository open network failure", async () => {
  let attempts = 0;
  const context = vm.createContext({
    Headers,
    state: { data: null },
    window: { Forkline: {} },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => "",
    isCurrentRepoPath: () => true,
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return { ok: true, json: async () => ({ repo: { path: "D:\\Repo" } }) };
    },
  });

  vm.runInContext(source, context);
  const result = await context.api("/api/open", { method: "POST", body: JSON.stringify({ path: "D:\\Repo" }) });

  assert.equal(attempts, 2);
  assert.equal(result.repo.path, "D:\\Repo");
});

test("API blocks repository writes while progressive details are loading", async () => {
  let fetchCount = 0;
  const context = vm.createContext({
    Headers,
    state: { data: { repo: { path: "D:\\Repo", isSample: false } }, repoHydrating: true },
    window: { Forkline: {} },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => "D:\\Repo",
    isCurrentRepoPath: () => true,
    fetch: async () => {
      fetchCount += 1;
      return { ok: true, json: async () => ({}) };
    },
  });

  vm.runInContext(source, context);
  await assert.rejects(
    context.api("/api/action", { method: "POST", body: "{}" }),
    /仓库详情正在载入/
  );
  assert.equal(fetchCount, 0);

  await context.api("/api/state");
  await context.api("/api/open", { method: "POST", body: "{}" });
  assert.equal(fetchCount, 2);
});

test("operation cancellation stays available without loading the logs panel", async () => {
  let request = null;
  let toastMessage = "";
  const state = {
    selectedTab: "details",
    data: {
      repo: { path: "D:\\Repo", isSample: false },
      runningOperations: [{ id: "7", action: "cloneRepository", label: "克隆仓库", cancellable: true }],
    },
  };
  const context = vm.createContext({
    Headers,
    state,
    window: { Forkline: {} },
    currentLocale: () => "zh-CN",
    t: (value, values = {}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? ""),
    repoPathSnapshot: () => "D:\\Repo",
    isCurrentRepoPath: () => true,
    toast: (message) => {
      toastMessage = message;
    },
    fetch: async (pathname, options) => {
      request = { pathname, options };
      return { ok: true, json: async () => ({ output: "正在取消操作" }) };
    },
  });

  vm.runInContext(source, context);
  assert.equal(typeof context.renderLogsTab, "undefined");
  assert.equal(typeof context.cancelRunningOperation, "function");
  await context.cancelRunningOperation("7", { confirm: false });

  assert.equal(request.pathname, "/api/operations/cancel");
  assert.deepEqual(JSON.parse(request.options.body), { id: "7" });
  assert.equal(toastMessage, "正在取消操作");
});

test("Git action requests immediately lock action controls and restore their original state", async () => {
  let resolveAction;
  const createControl = (name, disabled) => {
    const attributes = new Map();
    return {
      name,
      disabled,
      id: name,
      type: name === "commitSubmit" ? "submit" : "button",
      dataset: {},
      hasAttribute: (key) => attributes.has(key),
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, String(value)),
      removeAttribute: (key) => attributes.delete(key),
    };
  };
  const controls = [
    createControl("stageAll", false),
    createControl("commitSubmit", true),
    { ...createControl("dynamicAction", false), dataset: { action: "stageAll" } },
  ];
  controls[0].setAttribute("title", "暂存全部更改");
  controls[0].setAttribute("aria-disabled", "false");
  const status = {
    hidden: true,
    textContent: "",
    setAttribute: () => {},
  };
  const classList = {
    toggle() {},
  };
  const context = vm.createContext({
    Headers,
    state: {
      selectedTab: "details",
      data: { repo: { path: "D:\\Repo", isSample: false } },
      repoHydrating: false,
    },
    document: {
      querySelectorAll: () => controls,
      querySelector: (selector) => selector === "#gitActionStatus" ? status : null,
      documentElement: { classList },
    },
    window: {
      Forkline: {},
      setInterval: () => 1,
      clearInterval: () => {},
    },
    currentLocale: () => "zh-CN",
    t: (value, values = {}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? ""),
    repoPathSnapshot: () => "D:\\Repo",
    isCurrentRepoPath: () => true,
    fetch: (pathname) => {
      if (pathname === "/api/action") {
        return new Promise((resolve) => {
          resolveAction = resolve;
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ runningOperations: [] }) });
    },
  });

  vm.runInContext(source, context);
  const pending = context.api("/api/action", {
    method: "POST",
    body: JSON.stringify({ action: "stageAll" }),
  });

  assert.equal(typeof resolveAction, "function");
  assert.equal(controls[0].disabled, true);
  assert.equal(controls[1].disabled, true);
  assert.equal(controls[2].disabled, true);
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /stageAll/);

  resolveAction({ ok: true, json: async () => ({}) });
  await pending;

  assert.equal(controls[0].disabled, false);
  assert.equal(controls[1].disabled, true);
  assert.equal(controls[2].disabled, false);
  assert.equal(controls[0].getAttribute("title"), "暂存全部更改");
  assert.equal(controls[0].getAttribute("aria-disabled"), "false");
  assert.equal(status.hidden, true);
});

test("an operation restored during refresh keeps Git controls locked until it ends", () => {
  const attributes = new Map();
  const control = {
    id: "stageAll",
    type: "button",
    disabled: false,
    dataset: {},
    hasAttribute: (key) => attributes.has(key),
    getAttribute: (key) => attributes.get(key) ?? null,
    setAttribute: (key, value) => attributes.set(key, String(value)),
    removeAttribute: (key) => attributes.delete(key),
  };
  const status = {
    hidden: true,
    textContent: "",
    setAttribute: () => {},
  };
  const context = vm.createContext({
    Headers,
    state: {
      selectedTab: "details",
      data: { repo: { path: "D:\\Repo", isSample: false }, runningOperations: [] },
    },
    document: {
      querySelectorAll: () => [control],
      querySelector: (selector) => selector === "#gitActionStatus" ? status : null,
      documentElement: { classList: { toggle() {} } },
    },
    window: {
      Forkline: {},
      setInterval: () => 1,
      clearInterval: () => {},
    },
    currentLocale: () => "zh-CN",
    t: (value, values = {}) => String(value).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? ""),
    repoPathSnapshot: () => "D:\\Repo",
    isCurrentRepoPath: () => true,
    fetch: async () => ({ ok: true, json: async () => ({ runningOperations: [] }) }),
  });

  vm.runInContext(source, context);
  context.mergeOperationState({
    runningOperations: [{ id: "9", action: "fetchRemote", label: "抓取", cancellable: true }],
  });

  assert.equal(control.disabled, true);
  assert.equal(status.hidden, false);
  assert.equal(context.window.Forkline.isGitActionBusy(), true);

  context.mergeOperationState({ runningOperations: [] });
  assert.equal(control.disabled, false);
  assert.equal(status.hidden, true);
  assert.equal(context.window.Forkline.isGitActionBusy(), false);
});

test("Git action busy state keeps read-only commit tools available", () => {
  const createControl = (action) => {
    const attributes = new Map();
    return {
      id: "",
      type: "button",
      disabled: false,
      dataset: { commitAction: action },
      hasAttribute: (key) => attributes.has(key),
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, String(value)),
      removeAttribute: (key) => attributes.delete(key),
    };
  };
  const copyButton = createControl("copySha");
  const revertButton = createControl("revert");
  const status = {
    hidden: true,
    textContent: "",
    setAttribute: () => {},
  };
  const context = vm.createContext({
    Headers,
    state: {
      selectedTab: "details",
      data: { repo: { path: "D:\\Repo", isSample: false }, runningOperations: [] },
    },
    document: {
      querySelectorAll: (selector) => selector.startsWith("[")
        ? [copyButton, revertButton].filter((control) => control.hasAttribute("data-forkline-action-disabled"))
        : [copyButton, revertButton],
      querySelector: (selector) => selector === "#gitActionStatus" ? status : null,
      documentElement: { classList: { toggle() {} } },
    },
    window: {
      Forkline: {},
      setInterval: () => 1,
      clearInterval: () => {},
    },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => "D:\\Repo",
    isCurrentRepoPath: () => true,
    fetch: async () => ({ ok: true, json: async () => ({ runningOperations: [] }) }),
  });

  vm.runInContext(source, context);
  context.mergeOperationState({
    runningOperations: [{ id: "10", action: "fetchRemote", label: "抓取", cancellable: true }],
  });

  assert.equal(copyButton.disabled, false);
  assert.equal(revertButton.disabled, true);

  context.mergeOperationState({ runningOperations: [] });
  assert.equal(copyButton.disabled, false);
  assert.equal(revertButton.disabled, false);
});

test("running operation polling survives one transient refresh failure", async () => {
  let clearedTimer = 0;
  const context = vm.createContext({
    Headers,
    state: {
      selectedTab: "details",
      data: { repo: { path: "D:\\Repo", isSample: false }, runningOperations: [] },
    },
    document: {
      querySelectorAll: () => [],
      querySelector: () => null,
      documentElement: { classList: { toggle() {} } },
    },
    window: {
      Forkline: {},
      setInterval: () => 7,
      clearInterval: (timer) => { clearedTimer = timer; },
    },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => "D:\\Repo",
    isCurrentRepoPath: () => true,
    fetch: async () => { throw new TypeError("Failed to fetch"); },
  });

  vm.runInContext(source, context);
  context.mergeOperationState({
    runningOperations: [{ id: "11", action: "pull", label: "拉取", cancellable: true }],
  });
  await context.refreshOperationProgress();

  assert.equal(clearedTimer, 0);
  assert.equal(context.window.Forkline.isGitActionBusy(), true);
});

test("sample operation history does not lock the sample repository", () => {
  const control = {
    id: "stageAll",
    type: "button",
    disabled: false,
    dataset: {},
    hasAttribute: () => false,
    getAttribute: () => null,
    setAttribute: () => {},
    removeAttribute: () => {},
  };
  const context = vm.createContext({
    Headers,
    state: {
      selectedTab: "details",
      data: {
        repo: { path: "", isSample: true },
        runningOperations: [{ id: "sample-running", action: "fetch", label: "示例抓取" }],
      },
    },
    document: {
      querySelectorAll: () => [control],
      querySelector: () => null,
      documentElement: { classList: { toggle() {} } },
    },
    window: { Forkline: {}, setInterval: () => 1, clearInterval: () => {} },
    currentLocale: () => "zh-CN",
    t: (value) => value,
    repoPathSnapshot: () => "",
    isCurrentRepoPath: () => true,
    fetch: async () => ({ ok: true, json: async () => ({ runningOperations: [] }) }),
  });

  vm.runInContext(source, context);
  context.mergeOperationState({
    runningOperations: [{ id: "sample-running", action: "fetch", label: "示例抓取" }],
  });

  assert.equal(control.disabled, false);
  assert.equal(context.window.Forkline.isGitActionBusy(), false);
});
