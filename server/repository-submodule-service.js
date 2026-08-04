"use strict";



const fs = require("fs");

const path = require("path");



function createRepositorySubmoduleService(options) {

  const { git, getCurrentRepo, browseService, normalizeRepoFile, parseStatus, readWorkingStatus, sha256Json } = options;

  const { isPathInside, sameFsPath } = browseService;

  let currentRepo = getCurrentRepo();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

  }



  function parseWorktreeBranches(output, repoPath) {
    const info = {};
    let entry = {};
    const flush = () => {
      if (!entry.worktree || !entry.branch) return;
      const branch = entry.branch.replace(/^refs\/heads\//, "");
      if (!branch || sameFsPath(entry.worktree, repoPath)) return;
      info[branch] = {
        worktreePath: entry.worktree,
        prunable: Boolean(entry.prunable),
        reason: typeof entry.prunable === "string" ? entry.prunable : "",
      };
    };
    for (const line of String(output || "").split(/\r?\n/)) {
      if (!line.trim()) {
        flush();
        entry = {};
        continue;
      }
      const space = line.indexOf(" ");
      const key = space === -1 ? line : line.slice(0, space);
      const value = space === -1 ? "" : line.slice(space + 1);
      if (key === "worktree") entry.worktree = value;
      if (key === "branch") entry.branch = value;
      if (key === "prunable") entry.prunable = value || true;
    }
    flush();
    return info;
  }

  function parseWorktreeList(output, repoPath) {
    const rows = [];
    let entry = {};
    const flush = () => {
      if (!entry.worktree) return;
      const branch = entry.branch ? entry.branch.replace(/^refs\/heads\//, "") : "";
      const current = sameFsPath(entry.worktree, repoPath);
      const exists = fs.existsSync(entry.worktree);
      rows.push({
        path: entry.worktree,
        head: entry.head || "",
        shortHead: entry.head ? entry.head.slice(0, 7) : "",
        branch,
        label: branch || (entry.detached ? "detached HEAD" : entry.bare ? "bare" : "未知引用"),
        detached: Boolean(entry.detached || (!branch && !entry.bare)),
        bare: Boolean(entry.bare),
        current,
        locked: Boolean(entry.locked),
        lockReason: typeof entry.locked === "string" ? entry.locked : "",
        prunable: Boolean(entry.prunable),
        pruneReason: typeof entry.prunable === "string" ? entry.prunable : "",
        exists,
        status: exists ? "unknown" : "missing",
        dirtyCount: 0,
        operation: null,
      });
    };
    for (const line of String(output || "").split(/\r?\n/)) {
      if (!line.trim()) {
        flush();
        entry = {};
        continue;
      }
      const space = line.indexOf(" ");
      const key = space === -1 ? line : line.slice(0, space);
      const value = space === -1 ? "" : line.slice(space + 1);
      if (key === "worktree") entry.worktree = value;
      if (key === "HEAD") entry.head = value;
      if (key === "branch") entry.branch = value;
      if (key === "detached") entry.detached = true;
      if (key === "bare") entry.bare = true;
      if (key === "locked") entry.locked = value || true;
      if (key === "prunable") entry.prunable = value || true;
    }
    flush();
    return rows;
  }

  function buildWorktreePruneSnapshot(rows = []) {
    return sha256Json(worktreePruneEntries(rows)
      .map((row) => `${row.path || ""}\0${row.branch || ""}\0${row.head || ""}\0${row.pruneReason || ""}`)
      .sort());
  }

  function worktreePruneEntries(rows = []) {
    return (rows || []).filter((row) => row.prunable);
  }

  async function enrichWorktreeList(rows, options = {}) {
    return Promise.all((rows || []).map(async (row) => {
      if (!row.exists || row.prunable || row.bare) return row;
      const statusPromise = options.statusOutput !== undefined && sameFsPath(row.path, options.repoPath)
        ? Promise.resolve(options.statusOutput)
        : git(row.path, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
      const [statusOutput, operation] = await Promise.all([
        statusPromise,
        Promise.resolve().then(() => detectRepoOperation(row.path)).catch(() => null),
      ]);
      const files = parseStatus(statusOutput);
      return {
        ...row,
        status: files.length ? "dirty" : "clean",
        dirtyCount: files.length,
        operation,
      };
    }));
  }

  function submoduleConfigArgs() {
    return ["config", "-z", "--file", ".gitmodules", "--get-regexp", "^submodule\\..*\\.(path|url|branch)$"];
  }

  function repoHasSubmoduleConfig(repoPath = currentRepo) {
    return Boolean(repoPath && fs.existsSync(path.join(repoPath, ".gitmodules")));
  }

  function parseSubmodules(configOutput, statusOutput) {
    const byName = new Map();
    for (const entry of parseSubmoduleConfigEntries(configOutput)) {
      const { name, key, value } = entry;
      if (!name || !value) continue;
      const item = byName.get(name) || { name, path: "", url: "", branch: "" };
      item[key] = value;
      byName.set(name, item);
    }

    const byPath = new Map([...byName.values()].filter((item) => item.path).map((item) => [normalizePathKey(item.path), item]));
    const configuredPaths = [...byName.values()].map((item) => item.path).filter(Boolean);
    for (const line of String(statusOutput || "").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = parseSubmoduleStatusLine(line, configuredPaths);
      if (!parsed.path) continue;
      const key = normalizePathKey(parsed.path);
      const item = byPath.get(key) || { name: parsed.path, path: parsed.path, url: "", branch: "" };
      Object.assign(item, parsed);
      byPath.set(key, item);
    }

    return [...byPath.values()]
      .filter((item) => item.path)
      .map((item) => ({
        name: item.name || item.path,
        path: normalizeRepoFile(item.path),
        url: item.url || "",
        branch: item.branch || "",
        sha: item.sha || "",
        shortSha: item.sha ? item.sha.slice(0, 7) : "",
        status: item.status || "configured",
        statusLabel: submoduleStatusLabel(item.status || "configured"),
        summary: item.summary || "",
        initialized: item.status ? item.status !== "uninitialized" : false,
        dirtyCount: 0,
        worktreeBranch: "",
        worktreeHead: "",
        exists: false,
      }));
  }

  function parseSubmoduleConfigEntries(output) {
    const text = String(output || "");
    if (text.includes("\0")) {
      return text.split("\0").filter(Boolean).map((record) => {
        const separator = record.indexOf("\n");
        if (separator === -1) return null;
        return submoduleConfigEntry(record.slice(0, separator), record.slice(separator + 1));
      }).filter(Boolean);
    }
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^(submodule\..+\.(?:path|url|branch))\s+(.+)$/);
        if (!match) return null;
        return submoduleConfigEntry(match[1], match[2].trim());
      })
      .filter(Boolean);
  }

  function submoduleConfigEntry(rawKey, rawValue) {
    const match = String(rawKey || "").match(/^submodule\.(.+)\.(path|url|branch)$/);
    if (!match) return null;
    const [, name, key] = match;
    const value = key === "path" ? String(rawValue || "") : String(rawValue || "").trim();
    return { name, key, value };
  }

  function parseSubmoduleStatusLine(line, configuredPaths = []) {
    const prefix = line[0] || " ";
    const rest = line.slice(1).trimEnd();
    const firstSpace = rest.search(/\s/);
    const sha = firstSpace === -1 ? rest : rest.slice(0, firstSpace);
    const tail = firstSpace === -1 ? "" : rest.slice(firstSpace + 1);
    const knownPath = configuredPaths
      .slice()
      .sort((left, right) => right.length - left.length)
      .find((candidate) => tail === candidate || tail.startsWith(`${candidate} `));
    const fallbackParts = knownPath ? [] : tail.trim().split(/\s+/);
    const subPath = knownPath || fallbackParts.shift() || "";
    const summarySource = knownPath ? tail.slice(knownPath.length).trim() : fallbackParts.join(" ");
    const summary = summarySource.replace(/^\((.*)\)$/, "$1");
    const status = prefix === "-" ? "uninitialized" : prefix === "+" ? "changed" : prefix === "U" ? "conflict" : "ok";
    return { sha, path: subPath, summary, status };
  }

  async function enrichSubmodules(submodules, repoPath = currentRepo) {
    return Promise.all((submodules || []).map(async (item) => {
      const absolutePath = path.resolve(repoPath, item.path);
      if (!isPathInside(repoPath, absolutePath) && !sameFsPath(repoPath, absolutePath)) return item;
      const exists = fs.existsSync(absolutePath);
      if (!exists || item.status === "uninitialized") return { ...item, exists, initialized: false };
      const [statusOutput, branchOutput, headOutput] = await Promise.all([
        git(absolutePath, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => ""),
        git(absolutePath, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => ""),
        git(absolutePath, ["rev-parse", "--short", "HEAD"]).catch(() => ""),
      ]);
      const dirtyCount = parseStatus(statusOutput).length;
      return {
        ...item,
        exists,
        initialized: true,
        dirtyCount,
        worktreeBranch: (branchOutput || "").trim(),
        worktreeHead: (headOutput || "").trim(),
        statusLabel: dirtyCount ? "有本地改动" : submoduleStatusLabel(item.status),
      };
    }));
  }

  function submoduleStatusLabel(status) {
    if (status === "uninitialized") return "未初始化";
    if (status === "changed") return "提交不一致";
    if (status === "conflict") return "冲突";
    if (status === "ok") return "已就绪";
    return "已配置";
  }

  function normalizeSubmodulePath(value, submodules = []) {
    const file = normalizeRepoFile(value);
    if (!submodules.some((item) => normalizePathKey(item.path) === normalizePathKey(file))) {
      throw new Error(`子模块不存在：${file}`);
    }
    return file;
  }

  function normalizePathKey(value) {
    return String(value || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  }



  return {

    setCurrentRepo,

    buildWorktreePruneSnapshot,

    enrichSubmodules,

    enrichWorktreeList,

    normalizeSubmodulePath,

    parseSubmodules,

    parseWorktreeBranches,

    parseWorktreeList,

    repoHasSubmoduleConfig,

    submoduleConfigArgs,

    worktreePruneEntries,

  };

}



module.exports = { createRepositorySubmoduleService };
