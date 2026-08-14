"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "desktop-preference-storage.js"), "utf8");

test("desktop preference storage survives changing loopback origins", async () => {
  const stableValues = new Map([
    ["forkline-theme", "forest"],
    ["forkline-locale", "en"],
  ]);
  const bridge = {
    readPreferences: async () => Object.fromEntries(stableValues),
    writePreference: async (key, value) => {
      stableValues.set(key, String(value));
      return true;
    },
    removePreference: async (key) => {
      stableValues.delete(key);
      return true;
    },
  };
  const firstBrowserValues = new Map([["forkline-theme", "light"]]);
  const first = createContext(firstBrowserValues, bridge);
  assert.equal(first.window.ForklinePreferenceStorage.storage.getItem("forkline-theme"), "light");
  assert.equal(await first.window.ForklinePreferenceStorage.init(), true);
  assert.equal(first.window.ForklinePreferenceStorage.storage.getItem("forkline-theme"), "forest");
  first.window.ForklinePreferenceStorage.storage.setItem("forkline-theme", "graphite");
  first.window.ForklinePreferenceStorage.storage.removeItem("forkline-locale");
  await Promise.resolve();

  const secondBrowserValues = new Map([["forkline-theme", "rose"]]);
  const second = createContext(secondBrowserValues, bridge);
  assert.equal(await second.window.ForklinePreferenceStorage.init(), true);
  assert.equal(second.window.ForklinePreferenceStorage.storage.getItem("forkline-theme"), "graphite");
  assert.equal(second.window.ForklinePreferenceStorage.storage.getItem("forkline-locale"), null);
  assert.equal(firstBrowserValues.get("forkline-theme"), "light");
  assert.equal(secondBrowserValues.get("forkline-theme"), "rose");
});

test("web preference storage keeps using the current origin localStorage", async () => {
  const browserValues = new Map([["forkline-theme", "light"]]);
  const context = createContext(browserValues);

  assert.equal(await context.window.ForklinePreferenceStorage.init(), false);
  assert.equal(context.window.ForklinePreferenceStorage.storage.getItem("forkline-theme"), "light");
  context.window.ForklinePreferenceStorage.storage.setItem("forkline-theme", "contrast");
  assert.equal(browserValues.get("forkline-theme"), "contrast");
});

test("desktop preference storage rolls back changes rejected by persistent storage", async () => {
  const bridge = {
    readPreferences: async () => ({
      "forkline-theme": "forest",
      "forkline-locale": "en",
    }),
    writePreference: async () => false,
    removePreference: async () => {
      throw new Error("disk unavailable");
    },
  };
  const context = createContext(new Map(), bridge);
  const storage = context.window.ForklinePreferenceStorage.storage;

  assert.equal(await context.window.ForklinePreferenceStorage.init(), true);
  storage.setItem("forkline-theme", "graphite");
  storage.removeItem("forkline-locale");
  assert.equal(storage.getItem("forkline-theme"), "graphite");
  assert.equal(storage.getItem("forkline-locale"), null);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.getItem("forkline-theme"), "forest");
  assert.equal(storage.getItem("forkline-locale"), "en");
});

test("a stale desktop write failure cannot undo a newer saved value", async () => {
  let rejectFirstWrite;
  const stableValues = new Map([["forkline-theme", "forest"]]);
  const bridge = {
    readPreferences: async () => Object.fromEntries(stableValues),
    writePreference: async (key, value) => {
      if (value === "graphite") {
        await new Promise((_resolve, reject) => { rejectFirstWrite = reject; });
        return false;
      }
      stableValues.set(key, value);
      return true;
    },
  };
  const context = createContext(new Map(), bridge);
  const storage = context.window.ForklinePreferenceStorage.storage;

  assert.equal(await context.window.ForklinePreferenceStorage.init(), true);
  storage.setItem("forkline-theme", "graphite");
  await Promise.resolve();
  storage.setItem("forkline-theme", "rose");
  rejectFirstWrite(new Error("late failure"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.getItem("forkline-theme"), "rose");
  assert.equal(stableValues.get("forkline-theme"), "rose");
});

test("consecutive desktop write failures restore the last confirmed value", async () => {
  const bridge = {
    readPreferences: async () => ({ "forkline-theme": "forest" }),
    writePreference: async () => false,
  };
  const context = createContext(new Map(), bridge);
  const storage = context.window.ForklinePreferenceStorage.storage;

  assert.equal(await context.window.ForklinePreferenceStorage.init(), true);
  storage.setItem("forkline-theme", "graphite");
  storage.setItem("forkline-theme", "rose");
  assert.equal(storage.getItem("forkline-theme"), "rose");

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.getItem("forkline-theme"), "forest");
});

test("desktop preference storage reports the latest persistence failure", async () => {
  const failures = [];
  const bridge = {
    readPreferences: async () => ({ "forkline-theme": "forest" }),
    writePreference: async () => false,
  };
  const context = createContext(new Map(), bridge);
  const preferenceStorage = context.window.ForklinePreferenceStorage;
  const stop = preferenceStorage.onPersistenceFailure((failure) => failures.push(failure));

  assert.equal(await preferenceStorage.init(), true);
  preferenceStorage.storage.setItem("forkline-theme", "graphite");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failures.length, 1);
  assert.equal(failures[0].key, "forkline-theme");
  assert.equal(failures[0].operation, "write");

  stop();
  preferenceStorage.storage.setItem("forkline-theme", "rose");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failures.length, 1);
});

function createContext(browserValues, bridge = null) {
  const localStorage = {
    getItem: (key) => browserValues.get(key) ?? null,
    setItem: (key, value) => browserValues.set(key, String(value)),
    removeItem: (key) => browserValues.delete(key),
  };
  const window = { localStorage, ...(bridge ? { forklineDesktop: bridge } : {}) };
  const context = vm.createContext({ window, localStorage, Object, Promise, String });
  vm.runInContext(source, context);
  return context;
}
