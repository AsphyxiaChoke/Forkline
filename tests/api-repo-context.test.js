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
