"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ELECTRON_UPDATE_HEALTH_PREFIX = "forkline-electron-update-";

function validHealthFile(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolved);
  return Boolean(relative)
    && !relative.startsWith("..")
    && !path.isAbsolute(relative)
    && path.basename(resolved).startsWith(ELECTRON_UPDATE_HEALTH_PREFIX)
    && path.extname(resolved).toLowerCase() === ".json";
}

function reportElectronUpdateReady(env = process.env, options = {}) {
  const healthFile = String(env.FORKLINE_ELECTRON_UPDATE_HEALTH_FILE || "");
  const targetVersion = String(env.FORKLINE_ELECTRON_UPDATE_TARGET_VERSION || "").trim();
  if (!targetVersion || !validHealthFile(healthFile)) return false;
  const payload = {
    ready: true,
    targetVersion,
    pid: Number(options.pid || process.pid),
  };
  try {
    (options.writeFileSync || fs.writeFileSync)(healthFile, JSON.stringify(payload), "utf8");
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ELECTRON_UPDATE_HEALTH_PREFIX,
  reportElectronUpdateReady,
  validHealthFile,
};
