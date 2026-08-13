"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const {
  findLegacyRecentRepositoryOrigins,
  migrateLegacyRecentRepositories,
  normalizeRecentRepositories,
  readRecentRepositoryStore,
  writeRecentRepositoryStore,
} = require("../electron/recent-repository-store");

const root = path.resolve(__dirname, "..");
const repositoriesSource = fs.readFileSync(path.join(root, "public", "js", "features", "repositories.js"), "utf8");
const recentRepositorySource = repositoriesSource.slice(0, repositoriesSource.indexOf("function openCloneModal"));

test("desktop recent repositories survive changing loopback ports", async () => {
  const browserStorage = new Map([
    ["forkline-recent-repos", JSON.stringify([{ path: "D:/OldPort", name: "OldPort" }])],
  ]);
  const writes = [];
  const context = vm.createContext({
    window: {
      forklineDesktop: {
        readRecentRepositories: async () => [
          { path: "D:/Stable", name: "Stable", branch: "main", lastOpened: "2026-08-13T08:00:00.000Z" },
        ],
        writeRecentRepositories: (records) => writes.push(records),
      },
    },
    localStorage: {
      getItem: (key) => browserStorage.get(key) ?? null,
      setItem: (key, value) => browserStorage.set(key, String(value)),
      removeItem: (key) => browserStorage.delete(key),
    },
    recentRepoStorageKey: "forkline-recent-repos",
    els: {
      recentRepoSelect: { innerHTML: "", disabled: false },
      clearRecentRepos: { disabled: false },
    },
    t: (value) => value,
    escapeAttr: (value) => String(value),
    escapeHtml: (value) => String(value),
    confirm: () => true,
    toast: () => {},
  });
  vm.runInContext(recentRepositorySource, context);

  await context.initRecentRepoStorage();
  assert.deepEqual(JSON.parse(JSON.stringify(context.recentRepos())), [
    { path: "D:/Stable", name: "Stable", branch: "main", lastOpened: "2026-08-13T08:00:00.000Z" },
  ]);

  context.saveRecentRepo({ path: "D:/New", name: "New", branch: "feature" });
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].map(({ path, name, branch }) => ({ path, name, branch })))), [
    { path: "D:/New", name: "New", branch: "feature" },
    { path: "D:/Stable", name: "Stable", branch: "main" },
  ]);
  assert.equal(JSON.parse(browserStorage.get("forkline-recent-repos"))[0].path, "D:/OldPort");
});

test("web recent repositories keep using browser localStorage", async () => {
  const browserStorage = new Map();
  const context = vm.createContext({
    window: {},
    localStorage: {
      getItem: (key) => browserStorage.get(key) ?? null,
      setItem: (key, value) => browserStorage.set(key, String(value)),
      removeItem: (key) => browserStorage.delete(key),
    },
    recentRepoStorageKey: "forkline-recent-repos",
    els: {
      recentRepoSelect: { innerHTML: "", disabled: false },
      clearRecentRepos: { disabled: false },
    },
    t: (value) => value,
    escapeAttr: (value) => String(value),
    escapeHtml: (value) => String(value),
    confirm: () => true,
    toast: () => {},
  });
  vm.runInContext(recentRepositorySource, context);

  await context.initRecentRepoStorage();
  context.saveRecentRepo({ path: "D:/Web", name: "Web", branch: "main" });

  assert.equal(JSON.parse(browserStorage.get("forkline-recent-repos"))[0].path, "D:/Web");
});

test("desktop recent repository store normalizes and persists bounded records", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-recent-store-"));
  const filePath = path.join(tempRoot, "desktop-recent-repositories.json");
  try {
    const records = normalizeRecentRepositories([
      { path: "D:\\GitTest\\", name: "GitTest", branch: "main", lastOpened: "2026-08-13T08:00:00.000Z" },
      { path: "d:/gittest", name: "duplicate", branch: "old", lastOpened: "2026-08-12T08:00:00.000Z" },
      { path: "", name: "invalid" },
    ]);
    assert.equal(records.length, 1);
    assert.equal(records[0].name, "GitTest");

    writeRecentRepositoryStore(filePath, records);
    const stored = readRecentRepositoryStore(filePath);
    assert.equal(stored.valid, true);
    assert.deepEqual(stored.records, records);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("legacy random-port repositories migrate once into the stable desktop store", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-recent-migration-"));
  const leveldbPath = path.join(tempRoot, "Local Storage", "leveldb");
  const filePath = path.join(tempRoot, "desktop-recent-repositories.json");
  fs.mkdirSync(leveldbPath, { recursive: true });
  fs.writeFileSync(path.join(leveldbPath, "000003.log"), "_http://127.0.0.1:50101\0_http://127.0.0.1:50202\0", "latin1");
  fs.writeFileSync(path.join(leveldbPath, "000004.ldb"), "http://127.0.0.1:50101", "latin1");

  const calls = [];
  const recordsByOrigin = new Map([
    ["http://127.0.0.1:50101", [
      { path: "D:/First", name: "First", branch: "main", lastOpened: "2026-08-12T08:00:00.000Z" },
      { path: "D:/Shared", name: "Shared old", branch: "old", lastOpened: "2026-08-11T08:00:00.000Z" },
    ]],
    ["http://127.0.0.1:50202", [
      { path: "d:\\shared", name: "Shared new", branch: "new", lastOpened: "2026-08-13T08:00:00.000Z" },
      { path: "D:/Second", name: "Second", branch: "dev", lastOpened: "2026-08-10T08:00:00.000Z" },
    ]],
  ]);

  try {
    assert.deepEqual(findLegacyRecentRepositoryOrigins(leveldbPath), [
      "http://127.0.0.1:50101",
      "http://127.0.0.1:50202",
    ]);

    const migrated = await migrateLegacyRecentRepositories({
      filePath,
      leveldbPath,
      readOriginRecords: async (origin) => {
        calls.push(origin);
        return recordsByOrigin.get(origin) || [];
      },
    });
    assert.equal(migrated.migrated, true);
    assert.deepEqual(migrated.records.map(({ path, name }) => ({ path, name })), [
      { path: "d:\\shared", name: "Shared new" },
      { path: "D:/First", name: "First" },
      { path: "D:/Second", name: "Second" },
    ]);
    assert.deepEqual(calls, ["http://127.0.0.1:50101", "http://127.0.0.1:50202"]);

    calls.length = 0;
    const reused = await migrateLegacyRecentRepositories({
      filePath,
      leveldbPath,
      readOriginRecords: async (origin) => {
        calls.push(origin);
        return [];
      },
    });
    assert.equal(reused.migrated, false);
    assert.deepEqual(reused.records, migrated.records);
    assert.deepEqual(calls, []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
