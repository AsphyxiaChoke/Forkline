"use strict";



const fs = require("fs");

const os = require("os");

const path = require("path");



function createRepositoryBrowseService(options = {}) {

  const getCurrentRepo = options.getCurrentRepo || (() => null);

  let currentRepo = getCurrentRepo();

  function setCurrentRepo(repoPath) {
    currentRepo = repoPath || null;
  }

function readDirectory(pathValue = "") {
  const current = normalizeBrowseDirectory(pathValue);
  const parent = parentDirectory(current);
  const entries = fs
    .readdirSync(current, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git")
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => directoryEntry(current, entry.name))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }))
    .slice(0, 300);

  return {
    current,
    parent,
    shortcuts: browseShortcuts(),
    roots: browseRoots(),
    isGit: hasGitMetadata(current),
    entries,
  };
}

function normalizeBrowseDirectory(pathValue) {
  const raw = String(pathValue || "").trim();
  const target = raw ? expandHomePath(raw) : currentRepo || os.homedir() || process.cwd();
  const resolved = path.resolve(target);
  const stats = fs.statSync(resolved);
  if (!stats.isDirectory()) throw new Error("请选择文件夹");
  return resolved;
}

function expandHomePath(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function parentDirectory(dirPath) {
  const parent = path.dirname(dirPath);
  return parent && parent !== dirPath ? parent : "";
}

function browseRoots() {
  if (process.platform !== "win32") return [{ name: "/", path: "/" }];
  const roots = [];
  for (let code = 65; code <= 90; code += 1) {
    const drive = `${String.fromCharCode(code)}:\\`;
    if (fs.existsSync(drive)) roots.push({ name: drive, path: drive });
  }
  return roots;
}

function browseShortcuts() {
  const home = os.homedir();
  const currentParent = currentRepo ? parentDirectory(currentRepo) : "";
  const cwdParent = parentDirectory(process.cwd());
  const desktopParents = [currentParent, cwdParent].filter((item) => /^(desktop|桌面)$/i.test(path.basename(item || "")));
  const definitions = [
    { name: "当前仓库", paths: [currentRepo] },
    { name: "桌面", paths: [...desktopParents, process.env.DESKTOP, path.join(home, "Desktop"), path.join(home, "桌面")] },
    { name: "下载", paths: [process.env.DOWNLOADS, path.join(home, "Downloads"), path.join(home, "下载")] },
    { name: "文档", paths: [process.env.DOCUMENTS, path.join(home, "Documents"), path.join(home, "文档")] },
    { name: "用户目录", paths: [home] },
  ];
  const seen = new Set();
  const shortcuts = [];
  for (const definition of definitions) {
    const found = firstExistingDirectory(definition.paths);
    if (!found) continue;
    const key = normalizeBrowseKey(found);
    if (seen.has(key)) continue;
    seen.add(key);
    shortcuts.push({ name: definition.name, path: found });
  }
  return shortcuts;
}

function firstExistingDirectory(paths) {
  for (const item of paths || []) {
    if (!item) continue;
    try {
      const resolved = path.resolve(String(item));
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;
    } catch {
      // Ignore inaccessible shortcut candidates.
    }
  }
  return "";
}

function normalizeBrowseKey(value) {
  return path.resolve(String(value || "")).replace(/[\\/]+/g, path.sep).toLowerCase();
}

function directoryEntry(parent, name) {
  const fullPath = path.join(parent, name);
  try {
    if (!fs.statSync(fullPath).isDirectory()) return null;
    return { name, path: fullPath, isGit: hasGitMetadata(fullPath) };
  } catch {
    return null;
  }
}

function hasGitMetadata(dirPath) {
  try {
    return fs.existsSync(path.join(dirPath, ".git"));
  } catch {
    return false;
  }
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function sameFsPath(left, right) {
  if (!left || !right) return false;
  const normalize = (value) => path.resolve(String(value).replaceAll("/", path.sep)).replace(/[\\/]+/g, "\\").toLowerCase();
  return normalize(left) === normalize(right);
}



  return {

    setCurrentRepo,

    isPathInside,

    sameFsPath,

    readDirectory,

  };

}



module.exports = { createRepositoryBrowseService };
