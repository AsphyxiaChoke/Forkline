"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_DESKTOP_PREFERENCE_VALUE_LENGTH = 128 * 1024;
const DESKTOP_PREFERENCE_KEYS = Object.freeze([
  "forkline-checkout-stashes",
  "forkline-history-columns",
  "forkline-inspector-w",
  "forkline-locale",
  "forkline-recovery-policy",
  "forkline-sidebar-w",
  "forkline-stage-h",
  "forkline-theme",
  "forkline-ui-diagnostics-v1",
]);
const desktopPreferenceKeySet = new Set(DESKTOP_PREFERENCE_KEYS);
const UI_DIAGNOSTIC_STORAGE_KEY = "forkline-ui-diagnostics-v1";
const UI_DIAGNOSTIC_LIMIT = 40;

function normalizeDesktopPreferenceValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const preferences = {};
  for (const key of DESKTOP_PREFERENCE_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const storedValue = value[key];
    if (typeof storedValue !== "string" || Buffer.byteLength(storedValue, "utf8") > MAX_DESKTOP_PREFERENCE_VALUE_LENGTH) continue;
    preferences[key] = storedValue;
  }
  return preferences;
}

function readDesktopPreferenceStore(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const preferences = value?.preferences;
    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
      return { valid: false, preferences: {} };
    }
    return { valid: true, preferences: normalizeDesktopPreferenceValues(preferences) };
  } catch {
    return { valid: false, preferences: {} };
  }
}

function writeDesktopPreferenceStore(filePath, value) {
  const preferences = normalizeDesktopPreferenceValues(value);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, preferences }, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, filePath);
  } finally {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
  }
  return preferences;
}

function updateDesktopPreferenceStore(filePath, key, value) {
  if (!desktopPreferenceKeySet.has(key)) return false;
  const stored = readDesktopPreferenceStore(filePath);
  const preferences = { ...stored.preferences };
  if (value === null) {
    delete preferences[key];
  } else if (typeof value === "string" && Buffer.byteLength(value, "utf8") <= MAX_DESKTOP_PREFERENCE_VALUE_LENGTH) {
    preferences[key] = value;
  } else {
    return false;
  }
  writeDesktopPreferenceStore(filePath, preferences);
  return true;
}

function legacySnapshotTime(snapshot) {
  let latest = 0;
  const repositories = Array.isArray(snapshot?.recentRepositories) ? snapshot.recentRepositories : [];
  for (const repository of repositories) {
    const time = Date.parse(repository?.lastOpened);
    if (Number.isFinite(time)) latest = Math.max(latest, time);
  }
  for (const diagnostic of parseLegacyDiagnostics(snapshot?.preferences?.[UI_DIAGNOSTIC_STORAGE_KEY])) {
    const time = Date.parse(diagnostic?.time);
    if (Number.isFinite(time)) latest = Math.max(latest, time);
  }
  return latest;
}

function parseLegacyDiagnostics(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) : [];
  } catch {
    return [];
  }
}

function mergeLegacyDiagnostics(snapshots) {
  const diagnostics = [];
  const identities = new Set();
  for (const snapshot of snapshots) {
    for (const entry of parseLegacyDiagnostics(snapshot.preferences[UI_DIAGNOSTIC_STORAGE_KEY])) {
      const time = Date.parse(entry.time);
      if (!Number.isFinite(time)) continue;
      const identity = typeof entry.id === "string" && entry.id
        ? `id:${entry.id}`
        : `entry:${JSON.stringify(entry)}`;
      if (identities.has(identity)) continue;
      identities.add(identity);
      diagnostics.push({ entry, time });
    }
  }
  diagnostics.sort((left, right) => right.time - left.time);
  const merged = diagnostics.slice(0, UI_DIAGNOSTIC_LIMIT).map(({ entry }) => entry);
  while (merged.length && Buffer.byteLength(JSON.stringify(merged), "utf8") > MAX_DESKTOP_PREFERENCE_VALUE_LENGTH) merged.pop();
  return merged;
}

async function migrateLegacyDesktopPreferences(options) {
  const stored = readDesktopPreferenceStore(options.filePath);
  if (stored.valid) return { migrated: false, preferences: stored.preferences };

  const snapshots = [];
  for (const origin of [...new Set(options.origins || [])]) {
    let snapshot;
    try {
      snapshot = await options.readOriginSnapshot(origin);
    } catch (error) {
      throw new Error(`无法读取旧偏好来源 ${origin}：${error?.message || error}`);
    }
    snapshots.push({
      origin,
      preferences: normalizeDesktopPreferenceValues(snapshot?.preferences),
      recentRepositories: Array.isArray(snapshot?.recentRepositories) ? snapshot.recentRepositories : [],
    });
  }

  const timedSnapshots = snapshots
    .map((snapshot) => ({ snapshot, time: legacySnapshotTime(snapshot) }))
    .filter(({ time }) => time > 0)
    .sort((left, right) => right.time - left.time);
  const selected = timedSnapshots.length && timedSnapshots[0].time !== timedSnapshots[1]?.time
    ? timedSnapshots[0].snapshot
    : null;
  const preferences = selected ? { ...selected.preferences } : {};
  const diagnostics = mergeLegacyDiagnostics(snapshots);
  if (diagnostics.length) preferences[UI_DIAGNOSTIC_STORAGE_KEY] = JSON.stringify(diagnostics);
  return {
    migrated: true,
    preferences: writeDesktopPreferenceStore(options.filePath, preferences),
    selectedOrigin: selected?.origin || "",
  };
}

module.exports = {
  DESKTOP_PREFERENCE_KEYS,
  MAX_DESKTOP_PREFERENCE_VALUE_LENGTH,
  migrateLegacyDesktopPreferences,
  normalizeDesktopPreferenceValues,
  readDesktopPreferenceStore,
  updateDesktopPreferenceStore,
  writeDesktopPreferenceStore,
};
