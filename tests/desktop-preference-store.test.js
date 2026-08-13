"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_DESKTOP_PREFERENCE_VALUE_LENGTH,
  migrateLegacyDesktopPreferences,
  normalizeDesktopPreferenceValues,
  readDesktopPreferenceStore,
  updateDesktopPreferenceStore,
  writeDesktopPreferenceStore,
} = require("../electron/desktop-preference-store");

test("desktop preference store keeps only bounded allowlisted string values", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-desktop-preferences-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const filePath = path.join(tempRoot, "desktop-ui-preferences.json");

  assert.deepEqual(normalizeDesktopPreferenceValues({
    "forkline-theme": "forest",
    "forkline-sidebar-w": 280,
    "forkline-unknown": "ignored",
    "forkline-locale": "x".repeat(MAX_DESKTOP_PREFERENCE_VALUE_LENGTH + 1),
  }), { "forkline-theme": "forest" });

  assert.deepEqual(normalizeDesktopPreferenceValues({
    "forkline-theme": "forest",
    "forkline-locale": "中".repeat(MAX_DESKTOP_PREFERENCE_VALUE_LENGTH),
  }), { "forkline-theme": "forest" });

  writeDesktopPreferenceStore(filePath, {
    "forkline-theme": "forest",
    "forkline-locale": "en",
  });
  assert.deepEqual(readDesktopPreferenceStore(filePath), {
    valid: true,
    preferences: {
      "forkline-locale": "en",
      "forkline-theme": "forest",
    },
  });

  assert.equal(updateDesktopPreferenceStore(filePath, "forkline-theme", "graphite"), true);
  assert.equal(updateDesktopPreferenceStore(filePath, "forkline-unknown", "value"), false);
  assert.equal(updateDesktopPreferenceStore(filePath, "forkline-locale", null), true);
  assert.deepEqual(readDesktopPreferenceStore(filePath).preferences, {
    "forkline-theme": "graphite",
  });
});

test("legacy desktop preferences choose the uniquely newest business-time snapshot", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-desktop-preference-migration-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const filePath = path.join(tempRoot, "desktop-ui-preferences.json");
  const origins = ["http://127.0.0.1:50101", "http://127.0.0.1:50202"];
  const snapshots = new Map([
    [origins[0], {
      preferences: {
        "forkline-theme": "forest",
        "forkline-locale": "en",
        "forkline-ui-diagnostics-v1": JSON.stringify([
          { id: "older", time: "2026-08-11T08:00:00.000Z", type: "error" },
        ]),
      },
      recentRepositories: [
        { path: "D:/Older", lastOpened: "2026-08-12T08:00:00.000Z" },
      ],
    }],
    [origins[1], {
      preferences: {
        "forkline-theme": "graphite",
        "forkline-locale": "zh-CN",
        "forkline-sidebar-w": "280",
        "forkline-ui-diagnostics-v1": JSON.stringify([
          { id: "newer", time: "2026-08-13T08:00:00.000Z", type: "rejection" },
        ]),
      },
      recentRepositories: [],
    }],
  ]);
  const calls = [];

  const migrated = await migrateLegacyDesktopPreferences({
    filePath,
    origins,
    readOriginSnapshot: async (origin) => {
      calls.push(origin);
      return snapshots.get(origin);
    },
  });

  assert.equal(migrated.migrated, true);
  assert.deepEqual(calls, origins);
  assert.equal(migrated.preferences["forkline-theme"], "graphite");
  assert.equal(migrated.preferences["forkline-locale"], "zh-CN");
  assert.equal(migrated.preferences["forkline-sidebar-w"], "280");
  assert.deepEqual(
    JSON.parse(migrated.preferences["forkline-ui-diagnostics-v1"]).map((entry) => entry.id),
    ["newer", "older"]
  );

  calls.length = 0;
  const reused = await migrateLegacyDesktopPreferences({
    filePath,
    origins,
    readOriginSnapshot: async (origin) => {
      calls.push(origin);
      return {};
    },
  });
  assert.equal(reused.migrated, false);
  assert.deepEqual(reused.preferences, migrated.preferences);
  assert.deepEqual(calls, []);
});

test("legacy desktop preferences do not guess from port order without time evidence", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-desktop-preference-no-evidence-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const filePath = path.join(tempRoot, "desktop-ui-preferences.json");

  const migrated = await migrateLegacyDesktopPreferences({
    filePath,
    origins: ["http://127.0.0.1:61778", "http://127.0.0.1:49345"],
    readOriginSnapshot: async (origin) => ({
      preferences: { "forkline-theme": origin.endsWith("61778") ? "light" : "dark" },
      recentRepositories: [],
    }),
  });

  assert.equal(migrated.migrated, true);
  assert.deepEqual(migrated.preferences, {});
  assert.deepEqual(readDesktopPreferenceStore(filePath), { valid: true, preferences: {} });
});

test("legacy desktop preference migration retries instead of freezing a partial read", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-desktop-preference-retry-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const filePath = path.join(tempRoot, "desktop-ui-preferences.json");

  await assert.rejects(() => migrateLegacyDesktopPreferences({
    filePath,
    origins: ["http://127.0.0.1:50101", "http://127.0.0.1:50202"],
    readOriginSnapshot: async (origin) => {
      if (origin.endsWith("50202")) throw new Error("port occupied");
      return {
        preferences: { "forkline-theme": "forest" },
        recentRepositories: [{ lastOpened: "2026-08-13T08:00:00.000Z" }],
      };
    },
  }), /50202|port occupied/);
  assert.equal(fs.existsSync(filePath), false);
});
