const fs = require("node:fs");
const path = require("node:path");

function normalizeArgument(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function findStartupRepository(argv, appRoot) {
  const resolvedAppRoot = path.resolve(appRoot);
  return argv
    .slice(1)
    .map(normalizeArgument)
    .filter(Boolean)
    .map((value) => path.resolve(value))
    .find((value) => value !== resolvedAppRoot && fs.existsSync(value) && fs.statSync(value).isDirectory()) || "";
}

module.exports = { findStartupRepository, normalizeArgument };
