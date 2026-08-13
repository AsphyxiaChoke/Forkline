"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_RECENT_REPOSITORIES = 10;
const MAX_REPOSITORY_PATH_LENGTH = 4096;
const MAX_REPOSITORY_NAME_LENGTH = 512;
const MAX_BRANCH_NAME_LENGTH = 1024;
const LOOPBACK_ORIGIN_PATTERN = /http:\/\/127\.0\.0\.1:(\d{1,5})/g;

function boundedString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeRepositoryPath(value) {
  return boundedString(value, MAX_REPOSITORY_PATH_LENGTH)
    .replaceAll("\\", "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function normalizeRecentRepository(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const repositoryPath = boundedString(value.path, MAX_REPOSITORY_PATH_LENGTH);
  if (!repositoryPath) return null;
  const name = boundedString(value.name, MAX_REPOSITORY_NAME_LENGTH) || repositoryPath;
  const branch = boundedString(value.branch, MAX_BRANCH_NAME_LENGTH);
  const parsedTime = Date.parse(value.lastOpened);
  return {
    record: {
      path: repositoryPath,
      name,
      branch,
      lastOpened: Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : "",
    },
    key: normalizeRepositoryPath(repositoryPath),
    time: Number.isFinite(parsedTime) ? parsedTime : 0,
    index,
  };
}

function normalizeRecentRepositories(value) {
  if (!Array.isArray(value)) return [];
  const repositories = new Map();
  value.forEach((item, index) => {
    const normalized = normalizeRecentRepository(item, index);
    if (!normalized?.key) return;
    const previous = repositories.get(normalized.key);
    if (!previous || normalized.time > previous.time) repositories.set(normalized.key, normalized);
  });
  return [...repositories.values()]
    .sort((left, right) => right.time - left.time || left.index - right.index)
    .slice(0, MAX_RECENT_REPOSITORIES)
    .map(({ record }) => record);
}

function readRecentRepositoryStore(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const records = Array.isArray(value) ? value : value?.repositories;
    if (!Array.isArray(records)) return { valid: false, records: [] };
    return { valid: true, records: normalizeRecentRepositories(records) };
  } catch {
    return { valid: false, records: [] };
  }
}

function writeRecentRepositoryStore(filePath, records) {
  const repositories = normalizeRecentRepositories(records);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ version: 1, repositories }, null, 2)}\n`, "utf8");
  return repositories;
}

function findLegacyRecentRepositoryOrigins(leveldbPath) {
  let entries;
  try {
    entries = fs.readdirSync(leveldbPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const ports = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    let contents;
    try {
      contents = fs.readFileSync(path.join(leveldbPath, entry.name), "latin1");
    } catch {
      continue;
    }
    for (const match of contents.matchAll(LOOPBACK_ORIGIN_PATTERN)) {
      const port = Number(match[1]);
      if (port > 0 && port <= 65535) ports.add(port);
    }
  }
  return [...ports]
    .sort((left, right) => left - right)
    .map((port) => `http://127.0.0.1:${port}`);
}

async function migrateLegacyRecentRepositories(options) {
  const stored = readRecentRepositoryStore(options.filePath);
  if (stored.valid) return { migrated: false, records: stored.records };

  const records = [];
  for (const origin of findLegacyRecentRepositoryOrigins(options.leveldbPath)) {
    try {
      records.push(...await options.readOriginRecords(origin));
    } catch {
      // A historical random port may now be occupied; continue with the remaining origins.
    }
  }
  return {
    migrated: true,
    records: writeRecentRepositoryStore(options.filePath, records),
  };
}

module.exports = {
  MAX_RECENT_REPOSITORIES,
  findLegacyRecentRepositoryOrigins,
  migrateLegacyRecentRepositories,
  normalizeRecentRepositories,
  readRecentRepositoryStore,
  writeRecentRepositoryStore,
};
