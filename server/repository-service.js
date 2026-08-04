"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

function createRepositoryService(options) {
  const {
    git,
    gitStandalone,
    getCurrentRepo,
    setManagedRepo,
    operationLog,
    listRunningOperations,
    recoveryRefPrefix: RECOVERY_REF_PREFIX,
    worktreeDiffContext: WORKTREE_DIFF_CONTEXT,
    fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,
    defaultHistoryLimit: DEFAULT_HISTORY_LIMIT,
    maxHistoryLimit: MAX_HISTORY_LIMIT,
    protectedBranchNames: PROTECTED_BRANCH_NAMES,
    branchStaleDays: BRANCH_STALE_DAYS,
    worktreeSnapshotCacheLimit: WORKTREE_SNAPSHOT_CACHE_LIMIT,
    untrackedDiffHunkSize: UNTRACKED_DIFF_HUNK_SIZE,
    gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,
    refCommitLogFormat: REF_COMMIT_LOG_FORMAT,
    laneColors,
    authDiagnosticsCacheTtlMs: AUTH_DIAGNOSTICS_CACHE_TTL_MS,
    authDiagnosticsCacheLimit: AUTH_DIAGNOSTICS_CACHE_LIMIT,
    authDiagnosticsCache,
    worktreeFileSnapshotCache,
  } = options;
  let currentRepo = getCurrentRepo();

  function setCurrentRepo(repoPath) {
    currentRepo = repoPath || null;
    setManagedRepo(currentRepo);
  }

  async function readRemoteBranchNames(repoPath = currentRepo) {
    const remoteNames = await readRemoteNames(repoPath);
    const output = await git(repoPath, ["branch", "--remotes", "--format=%(refname:short)"]).catch(() => "");
    return String(output || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item && !item.endsWith("/HEAD") && isKnownRemoteBranch(item, remoteNames));
  }
  
  async function ensureRemoteBranchRef(value) {
    const ref = normalizeRefName(value, "远端分支");
    if (ref.endsWith("/HEAD")) throw new Error("不能把远端 HEAD 设为 upstream");
    const branches = await readRemoteBranchNames();
    if (!branches.includes(ref)) throw new Error(`远端分支 ${ref} 不存在。请先抓取远端后再试。`);
    await ensureRemoteBranchStillExists(ref, splitRemoteBranchRef(ref, await readRemoteNames()));
    return ref;
  }
  
  async function readRemoteDetails(repoPath = currentRepo) {
    const [names, verboseOutput] = await Promise.all([readRemoteNames(repoPath), git(repoPath, ["remote", "-v"]).catch(() => "")]);
    return parseRemoteDetails(verboseOutput, names);
  }
  
  async function readExplicitRemotePushUrls(remote, repoPath = currentRepo) {
    return parseSimpleLines(await git(repoPath, ["config", "--get-all", `remote.${remote}.pushurl`]).catch(() => ""));
  }
  
  async function replaceRemotePushUrls(remote, urls, repoPath = currentRepo) {
    await git(repoPath, ["config", "--unset-all", `remote.${remote}.pushurl`]).catch(() => "");
    for (const url of urls) {
      await git(repoPath, ["config", "--add", `remote.${remote}.pushurl`, url], { timeout: 60000 });
    }
  }
  
  async function defaultRemoteName(value = "") {
    const requested = String(value || "").trim();
    const remoteNames = await readRemoteNames();
    if (requested) {
      const remote = normalizeRefName(requested, "远端名");
      if (!remoteNames.includes(remote)) throw new Error(`远端 ${remote} 不存在`);
      return remote;
    }
    const remote = remoteNames.includes("origin") ? "origin" : remoteNames[0];
    if (!remote) throw new Error("当前仓库没有远端。请先添加远端仓库后再操作。");
    return remote;
  }
  
  function parseRemoteNames(output) {
    return String(output || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  
  function parseRemoteDetails(output, remoteNames = []) {
    const order = new Map(remoteNames.map((name, index) => [name, index]));
    const remotes = new Map(remoteNames.map((name) => [name, { name, fetchUrl: "", pushUrl: "", pushUrls: [] }]));
    for (const rawLine of String(output || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const match = line.match(/^(\S+)\s+(.+)\s+\((fetch|push)\)$/);
      if (!match) continue;
      const [, name, url, kind] = match;
      if (!remotes.has(name)) remotes.set(name, { name, fetchUrl: "", pushUrl: "", pushUrls: [] });
      const remote = remotes.get(name);
      if (kind === "fetch") remote.fetchUrl = url.trim();
      else {
        const pushUrl = url.trim();
        remote.pushUrls.push(pushUrl);
        if (!remote.pushUrl) remote.pushUrl = pushUrl;
      }
    }
    return [...remotes.values()].sort((left, right) => {
      const leftIndex = order.has(left.name) ? order.get(left.name) : Number.MAX_SAFE_INTEGER;
      const rightIndex = order.has(right.name) ? order.get(right.name) : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.name.localeCompare(right.name);
    });
  }
  
  function isKnownRemoteBranch(remoteRef, remoteNames = []) {
    const ref = String(remoteRef || "").trim();
    if (!ref || ref.endsWith("/HEAD")) return false;
    return remoteNames.some((remote) => {
      const prefix = `${remote}/`;
      return ref.startsWith(prefix) && ref.length > prefix.length;
    });
  }
  
  function splitRemoteBranchRef(remoteRef, remoteNames = []) {
    const ref = normalizeRefName(remoteRef, "远端分支");
    const remotes = [...remoteNames].sort((left, right) => right.length - left.length);
    for (const remote of remotes) {
      const prefix = `${remote}/`;
      if (ref.startsWith(prefix)) {
        const branch = normalizeBranchName(ref.slice(prefix.length));
        return { remote, branch };
      }
    }
    const slash = ref.indexOf("/");
    if (slash <= 0 || slash === ref.length - 1) throw new Error("远端分支不合法");
    return {
      remote: normalizeRefName(ref.slice(0, slash), "远端名"),
      branch: normalizeBranchName(ref.slice(slash + 1)),
    };
  }
  
  function normalizeStashRef(value) {
    const ref = String(value || "").trim();
    if (/^stash@\{\d+\}$/.test(ref)) return ref;
    throw new Error("储藏引用不合法");
  }
  
  async function ensureCurrentStashRef(body) {
    const ref = normalizeStashRef(body.ref);
    const expectedSha = normalizeExpectedStashSha(body.sha);
    const actualSha = (await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 }).catch(() => "")).trim().toLowerCase();
    if (!actualSha) throw new Error("这条储藏已经不存在，请刷新储藏列表后重新选择。");
    if (!actualSha.startsWith(expectedSha)) {
      throw new Error("储藏列表已经变化，这个引用现在指向了另一条储藏。为避免操作错储藏，请刷新储藏列表后重新选择。");
    }
    return ref;
  }
  
  function normalizeExpectedStashSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("储藏列表状态已过期，请刷新储藏列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("储藏身份不合法，请刷新储藏列表后重新选择。");
    return sha;
  }
  
  function normalizeStashMessage(value) {
    const message = String(value || "").replace(/\0/g, "").trim();
    return message || `Forkline: 手动储藏 ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
  }
  
  function normalizeStashFiles(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((file) => normalizeRepoFile(file)))];
  }
  
  function normalizeTagName(value) {
    const name = String(value || "").trim();
    if (!name || name.includes("\0")) throw new Error("请输入标签名");
    if (name.startsWith("-") || name.includes("\\") || name.includes("..") || name.includes("@{")) {
      throw new Error("标签名不合法");
    }
    if (name.endsWith(".lock") || name.endsWith(".") || name.split("/").some((part) => !part || part.endsWith("."))) {
      throw new Error("标签名不合法");
    }
    return name;
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
  
  function parseBranchTracking(output) {
    const info = {};
    for (const line of String(output || "").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [branch, upstream = "", tracking = ""] = line.split("\t");
      if (!branch) continue;
      const track = parseAheadBehind(tracking);
      info[branch] = {
        upstream: upstream.trim(),
        ahead: track.ahead,
        behind: track.behind,
        upstreamGone: track.gone,
        trackingLabel: tracking.trim(),
      };
    }
    return info;
  }
  
  function parseAheadBehind(value) {
    const text = String(value || "").toLowerCase();
    return {
      ahead: Number(text.match(/ahead\s+(\d+)/)?.[1] || 0),
      behind: Number(text.match(/behind\s+(\d+)/)?.[1] || 0),
      gone: text.includes("gone"),
    };
  }
  
  function mergeBranchInfo(...sources) {
    const merged = {};
    for (const source of sources) {
      for (const [branch, info] of Object.entries(source || {})) {
        merged[branch] = { ...(merged[branch] || {}), ...info };
      }
    }
    return merged;
  }
  
  function parseBranchCleanupMeta(output) {
    const meta = {};
    for (const line of String(output || "").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      const branch = parts[0]?.trim();
      if (!branch) continue;
      meta[branch] = {
        sha: parts[1] || "",
        short: parts[2] || "",
        updated: parts[3] || "",
        updatedUnix: Number(parts[4]) || 0,
        subject: parts.slice(5).join("\t").trim(),
      };
    }
    return meta;
  }
  
  function parseRemoteBranchInfo(output, remoteNames = []) {
    const info = {};
    for (const line of String(output || "").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [ref = "", sha = "", short = ""] = line.split("\t");
      const remoteRef = ref.trim();
      if (!remoteRef || remoteRef.endsWith("/HEAD")) continue;
      if (!isKnownRemoteBranch(remoteRef, remoteNames)) continue;
      info[remoteRef] = { sha: sha.trim(), short: short.trim() };
    }
    return info;
  }
  
  function parseSimpleLines(output) {
    return String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  
  function buildBranchCleanup({ branches, branchInfo, branchMeta, mergedBranches, currentBranch }) {
    const mergedSet = new Set(mergedBranches || []);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return (branches || []).map((branch) => {
      const info = branchInfo?.[branch] || {};
      const meta = branchMeta?.[branch] || {};
      const current = Boolean(branch && branch === currentBranch);
      const protectedName = PROTECTED_BRANCH_NAMES.has(String(branch || "").toLowerCase());
      const occupied = Boolean(info.worktreePath);
      const mergedIntoCurrent = mergedSet.has(branch);
      const ageDays = meta.updatedUnix ? Math.max(0, Math.floor((nowSeconds - meta.updatedUnix) / 86400)) : 0;
      const stale = Boolean(ageDays >= BRANCH_STALE_DAYS);
      const deleteBlockedReason = current
        ? "当前分支"
        : protectedName
          ? "主干/长期分支"
          : occupied
            ? "被其他工作树占用"
            : "";
      const canDelete = !deleteBlockedReason;
      const recommended = Boolean(canDelete && mergedIntoCurrent);
      const attention = Boolean(canDelete && !mergedIntoCurrent && (info.upstreamGone || stale));
      const statusLabel = branchCleanupStatus({ current, protectedName, occupied, mergedIntoCurrent, upstreamGone: info.upstreamGone, stale });
      return {
        branch,
        current,
        protected: Boolean(current || protectedName),
        protectedReason: current ? "当前分支" : protectedName ? "主干/长期分支" : "",
        occupied,
        worktreePath: info.worktreePath || "",
        upstream: info.upstream || "",
        upstreamGone: Boolean(info.upstreamGone),
        ahead: Number(info.ahead) || 0,
        behind: Number(info.behind) || 0,
        mergedIntoCurrent,
        stale,
        staleDays: ageDays,
        lastCommit: meta.sha || "",
        lastCommitShort: meta.short || "",
        lastSubject: meta.subject || "",
        lastUpdated: meta.updated || "",
        lastUpdatedUnix: meta.updatedUnix || 0,
        canDelete,
        deleteBlockedReason,
        recommended,
        attention,
        statusLabel,
        reason: branchCleanupReason({ current, protectedName, occupied, mergedIntoCurrent, upstreamGone: info.upstreamGone, stale, ageDays, worktreePath: info.worktreePath }),
      };
    });
  }
  
  function branchCleanupStatus({ current, protectedName, occupied, mergedIntoCurrent, upstreamGone, stale }) {
    if (current) return "当前";
    if (protectedName) return "保护";
    if (occupied) return "占用";
    if (mergedIntoCurrent) return "已合并";
    if (upstreamGone) return "上游丢失";
    if (stale) return "长期未动";
    return "活跃";
  }
  
  function branchCleanupReason({ current, protectedName, occupied, mergedIntoCurrent, upstreamGone, stale, ageDays, worktreePath }) {
    if (current) return "当前所在分支不能删除";
    if (protectedName) return "主干或长期分支默认保留";
    if (occupied) return `其他 worktree 正在使用：${worktreePath || "未知路径"}`;
    if (mergedIntoCurrent) return "已合并到当前 HEAD，可用安全删除清理";
    if (upstreamGone) return "上游分支已经不存在，删除前先确认本地提交是否还需要";
    if (stale) return `${ageDays} 天没有新提交，建议复查是否仍需要`;
    return "近期仍在活动或尚未合并";
  }
  
  function parseTags(output) {
    return String(output || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\t");
        const [name = "", object = "", maybeShort = "", maybeTime = ""] = parts;
        const hasFullObject = /^[0-9a-f]{40}$/i.test(object) && /^[0-9a-f]{7,40}$/i.test(maybeShort);
        const short = hasFullObject ? maybeShort : object;
        const time = hasFullObject ? maybeTime : maybeShort;
        const type = parts.length > (hasFullObject ? 5 : 4) ? parts[parts.length - 1] : "";
        const subject = parts.length > (hasFullObject ? 5 : 4)
          ? parts.slice(hasFullObject ? 4 : 3, -1).join("\t")
          : parts[hasFullObject ? 4 : 3] || "";
        return {
          name: name.trim(),
          object: object.trim(),
          short: short.trim(),
          time: time.trim(),
          subject: subject.trim(),
          type: type.trim() || "commit",
        };
      })
      .filter((tag) => tag.name);
  }
  
  async function ensureCurrentLocalTag(body) {
    const name = normalizeTagName(body.name);
    const expectedSha = normalizeExpectedTagSha(body.sha);
    const actualSha = await readLocalTagObjectSha(name);
    if (!actualSha.startsWith(expectedSha)) {
      throw new Error(`本地 Tag ${name} 已经变化。为避免操作错 Tag，请刷新 Tag 列表后重新选择。`);
    }
    return actualSha;
  }
  
  async function readLocalTagObjectSha(name) {
    return (await git(currentRepo, ["rev-parse", "-q", "--verify", `refs/tags/${name}`], { timeout: 60000 }).catch(() => {
      throw new Error(`本地 Tag ${name} 不存在`);
    })).trim().toLowerCase();
  }
  
  function normalizeExpectedTagSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("Tag 列表状态已过期，请刷新 Tag 列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("Tag 身份不合法，请刷新 Tag 列表后重新选择。");
    return sha;
  }
  
  async function ensureRemoteTag(remote, name, expectedSha = "") {
    const output = await git(currentRepo, ["ls-remote", "--tags", remote, `refs/tags/${name}`], { timeout: 60000, maxBuffer: 1024 * 1024 * 2 });
    const remoteSha = remoteTagObjectSha(output, name);
    if (!remoteSha) throw new Error(`远端 Tag ${name} 不存在或已经被删除。请刷新 Tag 列表后重新选择。`);
    if (expectedSha && !remoteSha.startsWith(expectedSha)) {
      throw new Error(`远端 Tag ${name} 已经变化。为避免删除别人新推送的同名 Tag，请刷新 Tag 列表后重新选择。`);
    }
    return remoteSha;
  }
  
  function remoteTagObjectSha(output, name) {
    const fullRef = `refs/tags/${name}`;
    const row = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .find((parts) => parts[1] === fullRef);
    return (row?.[0] || "").toLowerCase();
  }
  
  function sameFsPath(left, right) {
    if (!left || !right) return false;
    const normalize = (value) => path.resolve(String(value).replaceAll("/", path.sep)).replace(/[\\/]+/g, "\\").toLowerCase();
    return normalize(left) === normalize(right);
  }
  
  function readNewFileDiff(file, repoPath = currentRepo) {
    const repoRoot = path.resolve(repoPath);
    const fullPath = path.resolve(repoRoot, file);
    if (!fullPath.startsWith(repoRoot + path.sep)) throw new Error("文件路径不合法");
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return "";
    const buffer = fs.readFileSync(fullPath);
    if (buffer.includes(0)) return "";
    const decoded = decodeUtf8Strict(buffer);
    if (decoded === null) return "";
    const text = decoded;
    const lines = text ? text.split("\n") : [];
    if (text.endsWith("\n")) lines.pop();
    const diffLines = [
      `diff --git a/${file} b/${file}`,
      "new file mode 100644",
      "--- /dev/null",
      `+++ b/${file}`,
    ];
    for (let index = 0; index < lines.length; index += UNTRACKED_DIFF_HUNK_SIZE) {
      const chunk = lines.slice(index, index + UNTRACKED_DIFF_HUNK_SIZE);
      diffLines.push(`@@ -0,0 +${index + 1},${chunk.length} @@`);
      diffLines.push(...chunk.map((line) => `+${line}`));
      if (!text.endsWith("\n") && index + chunk.length >= lines.length) {
        diffLines.push("\\ No newline at end of file");
      }
    }
    return diffLines.join("\n");
  }
  
  function decodeUtf8Strict(buffer) {
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
    } catch (_error) {
      return null;
    }
  }
  
  function commandResult(output) {
    return { ok: true, output: output || "命令已完成" };
  }
  
  function commandResultWithSummary(summary, output) {
    const detail = String(output || "").trim();
    return { ok: true, output: detail ? `${summary}\n${detail}` : summary };
  }
  
  async function readCurrentSyncState(repoPath = currentRepo, options = {}) {
    const branch = options.branch !== undefined
      ? String(options.branch || "").trim()
      : (await readBranchDisplayName(repoPath).catch(() => "")).trim();
    if (!branch || branch === "detached HEAD") {
      return { branch: "HEAD", detached: true, unborn: false, upstream: "", upstreamSha: "", upstreamGone: false, ahead: 0, behind: 0 };
    }
    const upstream = options.upstream !== undefined
      ? String(options.upstream || "").trim()
      : (await git(repoPath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "")).trim();
    const hasCommit = typeof options.hasCommit === "boolean" ? options.hasCommit : await hasHeadCommit(repoPath);
    if (!hasCommit) {
      const upstreamSha = upstream ? (await git(repoPath, ["rev-parse", "--verify", `${upstream}^{commit}`]).catch(() => "")).trim() : "";
      return { branch, detached: false, unborn: true, upstream, upstreamSha, upstreamGone: Boolean(upstream && !upstreamSha), ahead: 0, behind: 0 };
    }
    if (!upstream) {
      return { branch, detached: false, unborn: false, upstream: "", upstreamSha: "", upstreamGone: false, ahead: 0, behind: 0 };
    }
    const upstreamSha = (await git(repoPath, ["rev-parse", "--verify", `${upstream}^{commit}`]).catch(() => "")).trim();
    if (!upstreamSha) {
      return { branch, detached: false, unborn: false, upstream, upstreamSha: "", upstreamGone: true, ahead: 0, behind: 0 };
    }
    const counts = (await git(repoPath, ["rev-list", "--left-right", "--count", `${upstream}...HEAD`]).catch(() => "0\t0")).trim().split(/\s+/);
    return {
      branch,
      detached: false,
      unborn: false,
      upstream,
      upstreamSha,
      upstreamGone: false,
      behind: Number(counts[0] || 0),
      ahead: Number(counts[1] || 0),
    };
  }
  
  function syncCommandResult(action, output, before, after) {
    const lines = [syncTitle(action)];
    lines.push(syncTrackingLine(after, before));
    const stateLine = syncStateLine(after);
    if (stateLine) lines.push(stateLine);
    const changeLine = syncChangeLine(before, after);
    if (changeLine) lines.push(changeLine);
    const remoteChanges = parseRemoteSyncChanges(output);
    if (remoteChanges.length) {
      lines.push(`远端更新：${remoteChanges.slice(0, 5).join("；")}${remoteChanges.length > 5 ? `；另有 ${remoteChanges.length - 5} 项` : ""}`);
    } else if (action === "fetch") {
      lines.push("远端更新：没有发现新的远端变化");
    }
    const detail = conciseGitOutput(output);
    if (detail) lines.push(`Git 输出：${detail}`);
    return { ok: true, output: lines.filter(Boolean).join("\n"), sync: { action, before, after, remoteChanges } };
  }
  
  function syncTitle(action) {
    if (action === "fetch") return "抓取完成";
    if (action === "pull") return "拉取完成";
    if (action === "pullRebase") return "变基拉取完成";
    if (action === "push") return "推送完成";
    if (action === "forcePush") return "安全强推完成";
    return "同步完成";
  }
  
  function syncTrackingLine(after, before) {
    const branch = after?.branch || before?.branch || "当前分支";
    if (after?.detached || before?.detached) return "当前处于游离 HEAD，无法计算分支同步状态";
    if (after?.upstream) return `当前分支：${branch} -> ${after.upstream}`;
    if (before?.upstream) return `当前分支：${branch}，上游 ${before.upstream} 现在不可用`;
    return `当前分支：${branch}，未设置 upstream`;
  }
  
  function syncStateLine(state) {
    if (!state || state.detached) return "";
    if (state.unborn) return "同步状态：当前分支还没有首个提交，无法计算领先/落后";
    if (!state.upstream) return "同步状态：未设置 upstream，无法判断领先/落后";
    if (state.upstreamGone) return "同步状态：上游分支已不存在，请抓取远端后确认是否需要重新设置 upstream";
    if (!state.ahead && !state.behind) return "同步状态：本地与上游一致";
    if (state.ahead && state.behind) return `同步状态：本地领先 ${state.ahead} 个提交，同时落后 ${state.behind} 个提交，需要先处理分叉`;
    if (state.ahead) return `同步状态：本地还有 ${state.ahead} 个提交未推送`;
    return `同步状态：远端还有 ${state.behind} 个提交未拉取`;
  }
  
  function syncChangeLine(before, after) {
    if (!before || !after || before.detached || after.detached || !after.upstream || after.upstreamGone) return "";
    if (before.upstream !== after.upstream) {
      return `跟踪变化：${before.upstream || "未设置"} -> ${after.upstream}`;
    }
    if (before.ahead === after.ahead && before.behind === after.behind) return "";
    return `领先/落后变化：领先 ${before.ahead} -> ${after.ahead}，落后 ${before.behind} -> ${after.behind}`;
  }
  
  function parseRemoteSyncChanges(output) {
    const changes = [];
    for (const rawLine of String(output || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("From ") || line.startsWith("To ")) continue;
      const arrow = line.match(/(.+?)\s+->\s+(.+)$/);
      if (!arrow) continue;
      const left = arrow[1].trim();
      const right = arrow[2].trim();
      if (left.includes("[new branch]")) {
        changes.push(`新增远端分支 ${right}`);
      } else if (left.includes("[new tag]")) {
        changes.push(`新增远端 Tag ${right}`);
      } else if (left.includes("[deleted]")) {
        changes.push(`删除远端引用 ${right}`);
      } else if (left.includes("[forced update]") || line.toLowerCase().includes("forced update")) {
        changes.push(`强制更新 ${right}`);
      } else if (right) {
        changes.push(`更新 ${right}`);
      }
    }
    return [...new Set(changes)];
  }
  
  function conciseGitOutput(output) {
    const lines = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("From ") && !line.startsWith("To "))
      .filter((line) => !/\s+->\s+/.test(line))
      .slice(0, 4);
    return lines.join("；");
  }
  
  function parseStatus(output) {
    if (output.includes("\0")) return parseStatusRecords(output.split("\0").filter(Boolean));
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const indexStatus = line[0] || " ";
        const worktreeStatus = line[1] || " ";
        const status = `${indexStatus}${worktreeStatus}`.trim() || "M";
        const rawPath = line.slice(3).trim();
        const renameParts = rawPath.split(" -> ");
        const file = parseStatusPath(renameParts.length > 1 ? renameParts[renameParts.length - 1] : rawPath);
        const previousFile = renameParts.length > 1 ? parseStatusPath(renameParts.slice(0, -1).join(" -> ")) : "";
        return statusFile(indexStatus, worktreeStatus, status, file, previousFile);
      });
  }
  
  function parseStatusRecords(records) {
    const files = [];
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (record.length < 3) continue;
      const indexStatus = record[0] || " ";
      const worktreeStatus = record[1] || " ";
      const status = `${indexStatus}${worktreeStatus}`.trim() || "M";
      const file = record.slice(3);
      const hasPreviousFile = (indexStatus === "R" || indexStatus === "C") && records[index + 1];
      const previousFile = hasPreviousFile ? records[index + 1] : "";
      files.push(statusFile(indexStatus, worktreeStatus, status, file, previousFile));
      if (hasPreviousFile) index += 1;
    }
    return files;
  }
  
  async function readWorkingStatus(repoPath, statusOutput) {
    const files = parseStatus(statusOutput);
    const paths = [...new Set(files.flatMap((file) => [file.file, file.previousFile].filter(Boolean)))];
    const indexEntries = await readIndexSnapshotEntries(repoPath, paths);
    const enriched = files.map((file) => {
      const snapshot = statusFileSnapshot(repoPath, file, indexEntries);
      return { ...file, snapshot };
    });
    return {
      files: enriched,
      snapshot: combinedWorktreeSnapshot(enriched),
    };
  }
  
  async function readIndexSnapshotEntries(repoPath, files) {
    const entries = new Map();
    if (!files.length) return entries;
    const output = await git(repoPath, ["ls-files", "-s", "-z", "--", ...files], { maxBuffer: 1024 * 1024 * 8 }).catch(() => "");
    for (const record of String(output || "").split("\0").filter(Boolean)) {
      const tabIndex = record.indexOf("\t");
      if (tabIndex < 0) continue;
      const meta = record.slice(0, tabIndex).trim().split(/\s+/);
      const file = record.slice(tabIndex + 1);
      if (meta.length < 3 || !file) continue;
      const value = `${meta[0]}:${meta[1]}:${meta[2]}`;
      const list = entries.get(file) || [];
      list.push(value);
      entries.set(file, list);
    }
    for (const [file, list] of entries) {
      entries.set(file, list.sort().join(","));
    }
    return entries;
  }
  
  function statusFileSnapshot(repoPath, file, indexEntries) {
    return sha256Json({
      file: file.file,
      previousFile: file.previousFile || "",
      state: file.state,
      extra: file.extra,
      conflict: Boolean(file.conflict),
      staged: Boolean(file.staged),
      unstaged: Boolean(file.unstaged),
      indexStatus: file.indexStatus || "",
      worktreeStatus: file.worktreeStatus || "",
      index: indexEntries.get(file.file) || "missing",
      previousIndex: file.previousFile ? indexEntries.get(file.previousFile) || "missing" : "",
      worktree: worktreeFileSnapshot(repoPath, file.file),
      previousWorktree: file.previousFile ? worktreeFileSnapshot(repoPath, file.previousFile) : "",
    });
  }
  
  function combinedWorktreeSnapshot(files) {
    return sha256Json(files.map((file) => `${file.file}\0${file.previousFile || ""}\0${file.snapshot || ""}`).sort());
  }
  
  function worktreeFileSnapshot(repoPath, file) {
    const repoRoot = path.resolve(repoPath);
    const fullPath = path.resolve(repoRoot, normalizeRepoFile(file));
    if (!sameFsPath(repoRoot, fullPath) && !isPathInside(repoRoot, fullPath)) return "outside";
    const cacheKey = process.platform === "win32" ? fullPath.toLowerCase() : fullPath;
    try {
      const stat = fs.statSync(fullPath, { bigint: true });
      if (!stat.isFile()) {
        worktreeFileSnapshotCache.delete(cacheKey);
        return stat.isDirectory() ? "directory" : "other";
      }
      const fingerprint = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
      const cached = worktreeFileSnapshotCache.get(cacheKey);
      if (cached?.fingerprint === fingerprint) {
        worktreeFileSnapshotCache.delete(cacheKey);
        worktreeFileSnapshotCache.set(cacheKey, cached);
        return cached.snapshot;
      }
      const hash = crypto.createHash("sha256");
      hash.update(fs.readFileSync(fullPath));
      const snapshot = `file:${stat.size}:${hash.digest("hex")}`;
      worktreeFileSnapshotCache.delete(cacheKey);
      worktreeFileSnapshotCache.set(cacheKey, { fingerprint, snapshot });
      while (worktreeFileSnapshotCache.size > WORKTREE_SNAPSHOT_CACHE_LIMIT) {
        worktreeFileSnapshotCache.delete(worktreeFileSnapshotCache.keys().next().value);
      }
      return snapshot;
    } catch (error) {
      worktreeFileSnapshotCache.delete(cacheKey);
      if (error?.code === "ENOENT") return "missing";
      return `error:${error?.code || "unknown"}`;
    }
  }
  
  function sha256Json(value) {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
  
  function statusFile(indexStatus, worktreeStatus, status, file, previousFile = "") {
    const conflict = indexStatus === "U" || worktreeStatus === "U" || ["AA", "AU", "UD", "DU", "UA", "UU", "DD"].includes(status);
    const staged = indexStatus !== " " && indexStatus !== "?";
    const unstaged = worktreeStatus !== " " || indexStatus === "?";
    const displayStatus = worktreeStatus !== " " ? worktreeStatus : indexStatus;
    const state = conflict ? "C" : displayStatus === "A" || displayStatus === "?" ? "A" : displayStatus === "D" ? "D" : displayStatus === "R" ? "R" : "M";
    return {
      state,
      file,
      extra: status,
      conflict,
      staged,
      unstaged,
      indexStatus: indexStatus.trim(),
      worktreeStatus: worktreeStatus.trim(),
      previousFile,
    };
  }
  
  function selectStatusFile(files, file, scope = "any") {
    const matches = files.filter((item) => item.file === file);
    if (!matches.length) return null;
    if (scope === "conflict") return matches.find((item) => item.conflict) || null;
    if (scope === "staged") return matches.find((item) => item.staged) || null;
    if (scope === "untracked") return matches.find((item) => item.indexStatus === "?") || null;
    if (scope === "unstaged") return matches.find((item) => item.unstaged) || null;
    return matches[0];
  }
  
  function worktreeActionTargetScope(kind, requestedScope) {
    if (kind === "unstage") return "staged";
    if (requestedScope === "untracked") return "untracked";
    return "unstaged";
  }
  
  function parseStatusPath(value) {
    const text = String(value || "").trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1).replace(/\\(["\\abfnrtv])/g, (_match, escape) => {
        return { '"': '"', "\\": "\\", a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" }[escape] || escape;
      });
    }
    return text;
  }
  
  function parseStashList(output) {
    return String(output || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [ref, shaOrSubject = "", subjectOrTime = "", maybeTime = ""] = line.split(GIT_LOG_FIELD_SEPARATOR);
        const hasSha = /^[0-9a-f]{40}$/i.test(shaOrSubject);
        const sha = hasSha ? shaOrSubject : "";
        const subject = hasSha ? subjectOrTime : shaOrSubject;
        const time = hasSha ? maybeTime : subjectOrTime;
        const parsed = parseStashSubject(subject);
        return {
          ref,
          sha,
          branch: parsed.branch,
          message: parsed.message,
          subject,
          time,
          label: `${ref} · ${parsed.branch || "未知分支"}`,
        };
      })
      .filter((item) => /^stash@\{\d+\}$/.test(item.ref));
  }
  
  function parseStashSubject(subject) {
    const text = String(subject || "").trim();
    const onMatch = text.match(/^On ([^:]+):\s*(.*)$/);
    if (onMatch) return { branch: onMatch[1], message: onMatch[2] || "储藏更改" };
    const wipMatch = text.match(/^WIP on ([^:]+):\s*(?:[0-9a-f]{7,40}\s+)?(.*)$/i);
    if (wipMatch) return { branch: wipMatch[1], message: wipMatch[2] || "WIP" };
    return { branch: "", message: text || "储藏更改" };
  }
  
  function parseNameStatus(output) {
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\t");
        const extra = parts[0] || "M";
        const code = extra.slice(0, 1);
        const state = code === "A" ? "A" : code === "D" ? "D" : code === "R" ? "R" : code === "C" ? "C" : "M";
        const file = parts[parts.length - 1] || line;
        const previousFile = parts.length > 2 ? parts[1] : "";
        return { state, file, previousFile, extra };
      });
  }
  
  function parseDiff(output) {
    if (!String(output || "").trim()) return [];
    let hunkIndex = -1;
    const lines = output.split(/\r?\n/);
    while (lines[lines.length - 1] === "") lines.pop();
    return lines
      .map((line) => {
        let type = "ctx";
        if (line.startsWith("diff --git ")) {
          hunkIndex = -1;
          type = "meta";
        } else if (line.startsWith("@@ ")) {
          hunkIndex += 1;
          type = "meta";
        } else if (hunkIndex >= 0) {
          if (line.startsWith("\\ No newline at end of file")) type = "meta";
          else if (line.startsWith("+")) type = "add";
          else if (line.startsWith("-")) type = "del";
        } else if (/^(\+\+\+|---|index |new file mode |deleted file mode |old mode |new mode |similarity index |rename from |rename to |copy from |copy to |Binary files |GIT binary patch|literal |delta |\\ No newline at end of file)/.test(line)) {
          type = "meta";
        }
        return { type, text: line, hunkIndex: hunkIndex >= 0 ? hunkIndex : null };
      });
  }
  
  function parseLog(output) {
    const commits = [];
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes(GIT_LOG_FIELD_SEPARATOR)) continue;
      const marker = line.indexOf(GIT_LOG_FIELD_SEPARATOR);
      const graph = line.slice(0, marker);
      const parts = line.slice(marker + 1).split(GIT_LOG_FIELD_SEPARATOR);
      if (parts.length < 7) continue;
      const lane = Math.max(0, Math.min(laneColors.length - 1, Math.floor(Math.max(0, graph.indexOf("*")) / 2)));
      commits.push({
        sha: parts[0],
        short: parts[1],
        author: parts[2] || "unknown",
        time: parts[3] || "",
        message: parts[4] || "(无提交信息)",
        refs: parts[5] || "",
        parents: parts[6] ? parts[6].split(" ").filter(Boolean) : [],
        lane,
        color: laneColors[lane],
        files: [],
        diff: [],
      });
    }
    return commits;
  }
  
  async function readCurrentSyncDetails(repoPath = currentRepo, options = {}) {
    const [state, remotes] = await Promise.all([
      readCurrentSyncState(repoPath, options),
      Array.isArray(options.remotes) ? options.remotes : readRemoteDetails(repoPath),
    ]);
    const pullRequest = await readPullRequestLink(state, remotes, repoPath, options).catch((error) => ({
      available: false,
      reason: `无法生成 PR 链接：${String(error?.message || error || "未知错误")}`,
      url: "",
    }));
    const details = {
      ...state,
      remotes,
      pullRequest,
      incoming: [],
      outgoing: [],
    };
    if (state.detached || !state.upstream || state.upstreamGone) return details;
    const [incomingOutput, outgoingOutput] = await Promise.all([
      state.behind ? git(repoPath, syncLogArgs(`HEAD..${state.upstream}`)).catch(() => "") : "",
      state.ahead ? git(repoPath, syncLogArgs(`${state.upstream}..HEAD`)).catch(() => "") : "",
    ]);
    details.incoming = parseSyncCommits(incomingOutput);
    details.outgoing = parseSyncCommits(outgoingOutput);
    return details;
  }
  
  function syncLogArgs(range) {
    return [
      "log",
      "--max-count=20",
      "--date=relative",
      `--pretty=format:${REF_COMMIT_LOG_FORMAT}`,
      range,
    ];
  }
  
  function parseSyncCommits(output) {
    return String(output || "")
      .split(/\r?\n/)
      .filter((line) => line.includes(GIT_LOG_FIELD_SEPARATOR))
      .slice(0, 20)
      .map((line) => {
        const parts = line.split(GIT_LOG_FIELD_SEPARATOR);
        return {
          sha: parts[0] || "",
          short: parts[1] || "",
          author: parts[2] || "unknown",
          time: parts[3] || "",
          message: parts[4] || "(无提交信息)",
          refs: parts[5] || "",
          parents: parts[6] ? parts[6].split(" ").filter(Boolean) : [],
        };
      })
      .filter((commit) => commit.sha);
  }
  
  async function readCachedAuthDiagnostics(repoPath = currentRepo, options = {}) {
    const remotes = await readRemoteDetails(repoPath);
    const cacheKey = authDiagnosticsCacheKey(repoPath, remotes);
    const now = Date.now();
    const cached = authDiagnosticsCache.get(cacheKey);
    if (!options.refresh && cached && cached.expiresAt > now) {
      return authDiagnosticsCacheResult(cached, true);
    }
  
    const diagnostics = await readAuthDiagnostics(remotes).catch((error) => authDiagnosticsFailure(error, remotes));
    const entry = {
      data: { ...diagnostics, checkedAt: new Date(now).toISOString() },
      expiresAt: now + AUTH_DIAGNOSTICS_CACHE_TTL_MS,
    };
    authDiagnosticsCache.set(cacheKey, entry);
    while (authDiagnosticsCache.size > AUTH_DIAGNOSTICS_CACHE_LIMIT) {
      authDiagnosticsCache.delete(authDiagnosticsCache.keys().next().value);
    }
    return authDiagnosticsCacheResult(entry, false);
  }
  
  function authDiagnosticsCacheKey(repoPath, remotes) {
    const repoKey = path.resolve(String(repoPath || "")).replace(/[\\/]+/g, "\\").toLowerCase();
    const remoteKey = remotes
      .map((remote) => [remote.name, remote.fetchUrl, remote.pushUrl, ...(remote.pushUrls || [])].map((value) => String(value || "")).join("\u0000"))
      .sort()
      .join("\u0001");
    return `${repoKey}\u0002${remoteKey}`;
  }
  
  function authDiagnosticsCacheResult(entry, cached) {
    return {
      ...entry.data,
      cached,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
    };
  }
  
  function authDiagnosticsFailure(error, remotes) {
    return {
      summary: "认证助手读取失败",
      level: "warn",
      advice: `无法读取本机认证信息：${String(error?.message || error || "未知错误")}`,
      remotes: remotes.map((remote) => remoteAuthSummary(remote)),
      ssh: { directory: "~/.ssh", exists: false, keys: [], configExists: false, knownHostsExists: false },
      agent: { available: false, loaded: false, keyCount: 0, message: "未检测" },
      credentialManager: { available: false, name: "Git Credential Manager", version: "", message: "未检测" },
      commands: ["git remote -v"],
    };
  }
  
  async function readAuthDiagnostics(remotes = []) {
    const [ssh, agent, credentialManager] = await Promise.all([
      readSshKeyInventory(),
      readSshAgentStatus(),
      readCredentialManagerStatus(),
    ]);
    const remoteSummaries = remotes.map((remote) => remoteAuthSummary(remote));
    const hasSshRemote = remoteSummaries.some((remote) => remote.kind === "ssh");
    const hasHttpsRemote = remoteSummaries.some((remote) => remote.kind === "https");
    const commands = buildAuthDiagnosticCommands(remoteSummaries);
    const adviceParts = [];
    let level = "ok";
  
    if (!remoteSummaries.length) {
      level = "info";
      adviceParts.push("当前仓库还没有远端，添加远端后再检查认证状态。");
    }
    if (hasSshRemote) {
      if (!ssh.exists || !ssh.keys.length) {
        level = "warn";
        adviceParts.push("远端使用 SSH，但没有在 ~/.ssh 里发现常见 key 文件。需要先创建 SSH key 并添加到 Git 平台。");
      } else if (!agent.loaded) {
        level = level === "warn" ? "warn" : "info";
        adviceParts.push("远端使用 SSH，已发现 key 文件；ssh-agent 没有报告已加载 key，推送失败时请执行 ssh-add。");
      } else {
        adviceParts.push(`SSH key 和 ssh-agent 都可见，agent 当前报告 ${agent.keyCount} 个 key。`);
      }
    }
    if (hasHttpsRemote) {
      if (!credentialManager.available) {
        level = level === "warn" ? "warn" : "info";
        adviceParts.push("远端使用 HTTPS，但没有检测到 Git Credential Manager。推送时可能需要手动输入 Token。");
      } else {
        adviceParts.push(`HTTPS 凭据管理器可用：${credentialManager.version || credentialManager.name}。`);
      }
    }
    if (!adviceParts.length) {
      adviceParts.push("当前远端认证配置没有明显风险；如果抓取或推送失败，请先点远端行的“诊断”。");
    }
  
    return {
      summary: authSummaryText(remoteSummaries, ssh, agent, credentialManager),
      level,
      advice: adviceParts.join(" "),
      remotes: remoteSummaries,
      ssh,
      agent,
      credentialManager,
      commands,
    };
  }
  
  function remoteAuthSummary(remote = {}) {
    const url = remote.pushUrl || remote.fetchUrl || "";
    const kind = remoteAuthKind(url);
    const host = extractRemoteHost(url);
    return {
      name: remote.name || "",
      url,
      kind,
      kindLabel: remoteAuthKindLabel(kind),
      host,
    };
  }
  
  function remoteAuthKind(url) {
    const text = String(url || "").trim();
    if (!text) return "missing";
    if (/^https?:\/\//i.test(text)) return "https";
    if (/^ssh:\/\//i.test(text) || /^[^@\s]+@[^:\s]+:.+/.test(text)) return "ssh";
    return "local";
  }
  
  function remoteAuthKindLabel(kind) {
    if (kind === "ssh") return "SSH";
    if (kind === "https") return "HTTPS";
    if (kind === "local") return "本地路径";
    return "未设置";
  }
  
  async function readSshKeyInventory() {
    const dir = path.join(os.homedir(), ".ssh");
    const result = {
      directory: "~/.ssh",
      exists: false,
      keys: [],
      configExists: false,
      knownHostsExists: false,
      message: "",
    };
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
      result.exists = true;
    } catch (error) {
      result.message = "没有找到 ~/.ssh 目录，或当前进程没有权限读取。";
      return result;
    }
  
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    result.configExists = files.includes("config");
    result.knownHostsExists = files.some((file) => file === "known_hosts" || file.startsWith("known_hosts."));
    const candidates = new Map();
    const ensure = (base) => {
      if (!candidates.has(base)) candidates.set(base, { name: base, publicKey: false, privateKey: false, publicFile: "", privateFile: "", updated: "" });
      return candidates.get(base);
    };
  
    for (const file of files) {
      if (file.endsWith(".pub") && !file.startsWith("known_hosts")) {
        const base = file.slice(0, -4);
        const item = ensure(base);
        item.publicKey = true;
        item.publicFile = file;
        item.updated = await sshFileUpdated(dir, file);
        continue;
      }
      if (/^id_[A-Za-z0-9_-]+$/.test(file) || ["identity"].includes(file)) {
        const item = ensure(file);
        item.privateKey = true;
        item.privateFile = file;
        item.updated = await sshFileUpdated(dir, file);
      }
    }
  
    result.keys = [...candidates.values()]
      .sort((left, right) => Number(right.privateKey) - Number(left.privateKey) || left.name.localeCompare(right.name))
      .slice(0, 12);
    result.message = result.keys.length ? `发现 ${result.keys.length} 组 SSH key 文件` : "没有发现常见 SSH key 文件";
    return result;
  }
  
  async function sshFileUpdated(dir, file) {
    try {
      const stat = await fs.promises.stat(path.join(dir, file));
      return formatLocalTime(stat.mtime);
    } catch {
      return "";
    }
  }
  
  async function readSshAgentStatus() {
    const probe = await runProbe("ssh-add", ["-l"], { timeout: 5000 });
    const text = `${probe.stdout || ""}\n${probe.stderr || ""}`.trim();
    if (!probe.ok) {
      const lower = text.toLowerCase();
      if (lower.includes("no identities")) {
        return { available: true, loaded: false, keyCount: 0, message: "ssh-agent 可用，但没有加载 key。", output: text };
      }
      return { available: false, loaded: false, keyCount: 0, message: text || "无法调用 ssh-add -l，可能没有安装 OpenSSH 或 ssh-agent 未启动。", output: text };
    }
    const keyCount = text ? text.split(/\r?\n/).filter(Boolean).length : 0;
    return {
      available: true,
      loaded: keyCount > 0,
      keyCount,
      message: keyCount ? `ssh-agent 已加载 ${keyCount} 个 key。` : "ssh-agent 可用，但没有返回 key。",
      output: text,
    };
  }
  
  async function readCredentialManagerStatus() {
    const probes = [
      { args: ["credential-manager", "version"], name: "Git Credential Manager" },
      { args: ["credential-manager-core", "--version"], name: "Git Credential Manager Core" },
    ];
    for (const probe of probes) {
      try {
        const output = await gitStandalone(probe.args, { timeout: 5000, maxBuffer: 1024 * 256 });
        const version = String(output || "").trim().split(/\r?\n/).filter(Boolean)[0] || probe.name;
        return { available: true, name: probe.name, version, message: `${probe.name} 可用。` };
      } catch {
        // Try the next credential manager command.
      }
    }
    return { available: false, name: "Git Credential Manager", version: "", message: "没有检测到 Git Credential Manager 命令。" };
  }
  
  function runProbe(file, args = [], options = {}) {
    return new Promise((resolve) => {
      execFile(
        file,
        args,
        {
          windowsHide: true,
          timeout: options.timeout || 5000,
          maxBuffer: options.maxBuffer || 1024 * 256,
          encoding: "utf8",
        },
        (error, stdout, stderr) => {
          resolve({ ok: !error, stdout: stdout || "", stderr: stderr || "", message: error?.message || "" });
        }
      );
    });
  }
  
  function buildAuthDiagnosticCommands(remotes) {
    const commands = ["git remote -v"];
    const sshHosts = [...new Set(remotes.filter((remote) => remote.kind === "ssh" && remote.host).map((remote) => remote.host))];
    const httpsRemotes = remotes.filter((remote) => remote.kind === "https");
    if (sshHosts.length) {
      commands.push("ssh-add -l");
      sshHosts.slice(0, 3).forEach((host) => commands.push(`ssh -T git@${host}`));
    }
    if (httpsRemotes.length) {
      commands.push("git credential-manager version");
      commands.push("git credential-manager diagnose");
    }
    return [...new Set(commands)].slice(0, 8);
  }
  
  function authSummaryText(remotes, ssh, agent, credentialManager) {
    const sshCount = remotes.filter((remote) => remote.kind === "ssh").length;
    const httpsCount = remotes.filter((remote) => remote.kind === "https").length;
    const localCount = remotes.filter((remote) => remote.kind === "local").length;
    const parts = [];
    if (sshCount) parts.push(`${sshCount} 个 SSH 远端`);
    if (httpsCount) parts.push(`${httpsCount} 个 HTTPS 远端`);
    if (localCount) parts.push(`${localCount} 个本地远端`);
    const remoteText = parts.length ? parts.join("，") : "没有远端";
    const sshText = ssh.exists ? `${ssh.keys.length} 组 SSH key` : "未发现 ~/.ssh";
    const agentText = agent.loaded ? `agent ${agent.keyCount} 个 key` : "agent 未加载 key";
    const gcmText = credentialManager.available ? "GCM 可用" : "GCM 未检测到";
    return `${remoteText}；${sshText}；${agentText}；${gcmText}`;
  }
  
  async function readPullRequestLink(syncState = {}, remotes = [], repoPath = currentRepo, options = {}) {
    const branch = String(syncState.branch || "").trim();
    if (!branch || branch === "HEAD" || branch === "detached HEAD" || syncState.detached) {
      return { available: false, reason: "当前处于游离 HEAD，请先切换或创建本地分支。", url: "" };
    }
    const remote = preferredWebRemote(remotes);
    if (!remote?.webBase) {
      return { available: false, reason: "当前仓库没有可识别的 GitHub / GitLab / Bitbucket / Gitea 网页远端。", url: "" };
    }
    const targetBranch = await inferPullRequestTarget(branch, syncState, repoPath, options);
    if (!targetBranch) {
      return { available: false, reason: "没有找到可作为目标的主分支。", url: "" };
    }
    if (targetBranch === branch) {
      return { available: false, reason: "当前分支已经是目标分支，不需要创建 PR。", url: "" };
    }
    const platform = remoteWebPlatform(remote.webBase);
    const url = buildPullRequestUrl(remote.webBase, platform, branch, targetBranch);
    return {
      available: Boolean(url),
      url,
      source: branch,
      target: targetBranch,
      remote: remote.name,
      remoteUrl: remote.url,
      platform,
      platformLabel: remotePlatformLabel(platform),
      title: platform === "gitlab" ? "创建 Merge Request" : "创建 Pull Request",
      reason: url ? "" : "当前远端平台暂不支持自动生成 PR 链接。",
    };
  }
  
  function preferredWebRemote(remotes = []) {
    const ordered = [
      ...remotes.filter((remote) => remote.name === "origin"),
      ...remotes.filter((remote) => remote.name !== "origin"),
    ];
    for (const remote of ordered) {
      const url = remote.pushUrl || remote.fetchUrl || "";
      const webBase = remoteWebBase(url) || remoteWebBase(remote.fetchUrl);
      if (webBase) return { ...remote, url, webBase };
    }
    return null;
  }
  
  async function inferPullRequestTarget(branch, syncState = {}, repoPath = currentRepo, options = {}) {
    const localBranches = Array.isArray(options.localBranches)
      ? options.localBranches
      : parseSimpleLines(await git(repoPath, ["branch", "--format=%(refname:short)"]).catch(() => ""));
    const remoteNames = Array.isArray(options.remoteNames) ? options.remoteNames : await readRemoteNames(repoPath);
    const upstreamBranch = syncState.upstream ? splitRemoteBranchRef(syncState.upstream, remoteNames).branch : "";
    if (upstreamBranch && upstreamBranch !== branch) return upstreamBranch;
    const preferred = ["main", "master", "develop", "development", "dev", "trunk"];
    const preferredMatch = preferred.find((name) => localBranches.includes(name) && name !== branch);
    if (preferredMatch) return preferredMatch;
    return localBranches.find((name) => name && name !== branch) || "";
  }
  
  function buildPullRequestUrl(webBase, platform, sourceBranch, targetBranch) {
    const base = String(webBase || "").replace(/\/+$/, "");
    if (!base || !sourceBranch || !targetBranch) return "";
    const source = encodeURIComponent(sourceBranch);
    const target = encodeURIComponent(targetBranch);
    if (platform === "gitlab") {
      return `${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${source}&merge_request%5Btarget_branch%5D=${target}`;
    }
    if (platform === "bitbucket") {
      return `${base}/pull-requests/new?source=${source}&dest=${target}`;
    }
    if (platform === "github") {
      return `${base}/compare/${target}...${source}?expand=1`;
    }
    return `${base}/compare/${target}...${source}`;
  }
  
  function remoteWebBase(remoteUrl) {
    const value = String(remoteUrl || "").trim();
    if (!value) return "";
    const scpLike = value.match(/^git@([^:]+):(.+)$/);
    if (scpLike) return cleanRemoteWebPath(`https://${scpLike[1]}/${scpLike[2]}`);
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.username = "";
        url.password = "";
        return cleanRemoteWebPath(url.toString());
      }
      if (url.protocol === "ssh:" && url.hostname && url.pathname) {
        return cleanRemoteWebPath(`https://${url.hostname}${url.pathname}`);
      }
    } catch {
    }
    return "";
  }
  
  function cleanRemoteWebPath(value) {
    return String(value || "")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");
  }
  
  function remoteWebPlatform(webBase) {
    try {
      const url = new URL(webBase);
      const host = url.hostname.toLowerCase();
      if (host === "github.com" || host.endsWith(".github.com")) return "github";
      if (host === "gitlab.com" || host.includes("gitlab")) return "gitlab";
      if (host === "bitbucket.org" || host.endsWith(".bitbucket.org")) return "bitbucket";
      if (host.includes("gitea") || host.includes("forgejo")) return "gitea";
    } catch {
    }
    return "generic";
  }
  
  function remotePlatformLabel(platform) {
    if (platform === "github") return "GitHub";
    if (platform === "gitlab") return "GitLab";
    if (platform === "bitbucket") return "Bitbucket";
    if (platform === "gitea") return "Gitea / Forgejo";
    return "Web";
  }
  
  function sampleState() {
    const files = [
      { state: "M", file: "src/views/HistoryPanel.tsx", extra: "+28 -6" },
      { state: "A", file: "src/git/graphLayout.ts", extra: "+61" },
      { state: "M", file: "src/styles/workbench.css", extra: "+44 -12" },
      { state: "D", file: "docs/old-flow.md", extra: "-18" },
      { state: "M", file: "package.json", extra: "+2 -1" },
    ];
    const diff = [
      { type: "meta", text: "diff --git a/src/views/HistoryPanel.tsx b/src/views/HistoryPanel.tsx" },
      { type: "ctx", text: "function HistoryPanel({ commits, selectedSha }) {" },
      { type: "del", text: "  const lanes = commits.map((commit) => commit.lane);" },
      { type: "add", text: "  const lanes = graphLayout(commits, selectedSha);" },
      { type: "ctx", text: "  return (" },
      { type: "add", text: "    <GraphCanvas lanes={lanes} focus={selectedSha} />" },
      { type: "ctx", text: "    <CommitRows commits={commits} />" },
      { type: "del", text: "    <CommitDetails sha={selectedSha} />" },
      { type: "add", text: "    <CommitDetails sha={selectedSha} mode=\"inspector\" />" },
      { type: "ctx", text: "  );" },
      { type: "ctx", text: "}" },
    ];
    const data = [
      ["f83a9c2b0177", "Mina", "12 分钟前", "打磨提交图连线动画", "feature/visual-history", 0, ["d41c2ab91020"]],
      ["d41c2ab91020", "Leon", "38 分钟前", "添加语义化 Diff 分组", "review-ready", 0, ["ad9ef73774af", "7ca12dd48211"]],
      ["7ca12dd48211", "Rae", "1 小时前", "修复 Diff 面板拖拽尺寸", "fix/diff-pane-resize", 1, ["91b2a10552dd"]],
      ["ad9ef73774af", "Mina", "2 小时前", "接入分支操作菜单", "", 0, ["3cb8ffe030e4"]],
      ["91b2a10552dd", "Rae", "2 小时前", "完善检查器空状态", "", 1, ["3cb8ffe030e4"]],
      ["3cb8ffe030e4", "Nora", "5 小时前", "合并 release/2.9 到可视化历史", "merge", 0, ["6bb990ef4afd", "4ab612e810db"]],
      ["4ab612e810db", "Owen", "昨天", "发布候选版本构建", "release/2.9", 2, ["fa51203b0921"]],
      ["6bb990ef4afd", "Leon", "昨天", "持久化历史列宽", "", 0, ["fa51203b0921"]],
      ["fa51203b0921", "Nora", "周一", "添加命令面板动作", "main", 0, ["0be81f4189de"]],
      ["0be81f4189de", "Mina", "周一", "规范化提交图泳道数据", "", 0, ["8e3ab9017ed2"]],
      ["8e3ab9017ed2", "Owen", "周五", "初始化可视化历史外壳", "origin/main", 3, []],
    ];
    return {
      repo: {
        name: "atlas-dashboard",
        path: "示例仓库",
        branch: "feature/visual-history",
        headSha: data[0][0],
        isSample: true,
        remoteNames: ["origin", "upstream"],
      },
      branches: ["feature/visual-history", "main", "release/2.9", "fix/diff-pane-resize", "experiment/ai-summary", "chore/design-tokens"],
      branchInfo: {
        "feature/visual-history": { upstream: "origin/feature/visual-history", ahead: 2, behind: 1 },
        "fix/diff-pane-resize": { upstream: "origin/fix/diff-pane-resize", ahead: 0, behind: 0 },
        "experiment/ai-summary": { upstream: "origin/experiment/ai-summary", upstreamGone: true, ahead: 1, behind: 0 },
      },
      branchCleanup: [
        {
          branch: "feature/visual-history",
          current: true,
          protected: true,
          protectedReason: "当前分支",
          upstream: "origin/feature/visual-history",
          ahead: 2,
          behind: 1,
          statusLabel: "当前",
          reason: "当前所在分支不能删除",
          lastCommitShort: "f83a9c2",
          lastSubject: "打磨提交图连线动画",
          lastUpdated: "12 分钟前",
        },
        {
          branch: "fix/diff-pane-resize",
          mergedIntoCurrent: true,
          canDelete: true,
          recommended: true,
          statusLabel: "已合并",
          reason: "已合并到当前 HEAD，可用安全删除清理",
          lastCommitShort: "91b2a10",
          lastSubject: "完善检查器空状态",
          lastUpdated: "2 小时前",
        },
        {
          branch: "experiment/ai-summary",
          upstreamGone: true,
          attention: true,
          canDelete: true,
          statusLabel: "上游丢失",
          reason: "上游分支已经不存在，删除前先确认本地提交是否还需要",
          lastCommitShort: "d41c2ab",
          lastSubject: "添加语义化 Diff 分组",
          lastUpdated: "38 分钟前",
        },
        {
          branch: "main",
          protected: true,
          protectedReason: "主干/长期分支",
          statusLabel: "保护",
          reason: "主干或长期分支默认保留",
          lastCommitShort: "fa51203",
          lastSubject: "添加命令面板动作",
          lastUpdated: "周一",
        },
      ],
      worktrees: [
        {
          path: "示例仓库",
          head: "f83a9c2b0177",
          shortHead: "f83a9c",
          branch: "feature/visual-history",
          label: "feature/visual-history",
          current: true,
          exists: true,
          status: "dirty",
          dirtyCount: 5,
        },
        {
          path: "D:\\开发\\atlas-dashboard-main",
          head: "fa51203b0921",
          shortHead: "fa51203",
          branch: "main",
          label: "main",
          current: false,
          exists: true,
          status: "clean",
          dirtyCount: 0,
        },
        {
          path: "D:\\开发\\atlas-dashboard-old-review",
          head: "91b2a10552dd",
          shortHead: "91b2a10",
          branch: "old/review",
          label: "old/review",
          current: false,
          exists: false,
          prunable: true,
          pruneReason: "working tree path is missing",
          status: "missing",
          dirtyCount: 0,
        },
      ],
      submodules: [
        {
          name: "shared-ui",
          path: "packages/shared-ui",
          url: "git@github.com:example/shared-ui.git",
          branch: "main",
          sha: "6bb990ef4afd",
          shortSha: "6bb990e",
          status: "ok",
          statusLabel: "已就绪",
          summary: "heads/main",
          initialized: true,
          exists: true,
          dirtyCount: 0,
          worktreeBranch: "main",
          worktreeHead: "6bb990e",
        },
        {
          name: "legacy-theme",
          path: "vendor/legacy-theme",
          url: "https://github.com/example/legacy-theme.git",
          branch: "",
          sha: "4ab612e810db",
          shortSha: "4ab612e",
          status: "uninitialized",
          statusLabel: "未初始化",
          initialized: false,
          exists: false,
          dirtyCount: 0,
        },
      ],
      worktreePruneSnapshot: sha256Json([]),
      remotes: ["origin/main", "origin/feature/visual-history", "upstream/release/2.9"],
      sync: {
        branch: "feature/visual-history",
        upstream: "origin/feature/visual-history",
        upstreamSha: "f6d4a2c9e8b7f1a3d5c6b8a9e0f1c2d3b4a5e6f7",
        upstreamGone: false,
        ahead: 2,
        behind: 1,
        remotes: [
          { name: "origin", fetchUrl: "git@github.com:example/atlas-dashboard.git", pushUrl: "git@github.com:example/atlas-dashboard.git", pushUrls: ["git@github.com:example/atlas-dashboard.git"] },
          { name: "upstream", fetchUrl: "https://github.com/example/base-dashboard.git", pushUrl: "https://github.com/example/base-dashboard.git", pushUrls: ["https://github.com/example/base-dashboard.git"] },
        ],
        auth: {
          summary: "1 个 SSH 远端，1 个 HTTPS 远端；2 组 SSH key；agent 1 个 key；GCM 可用",
          level: "ok",
          advice: "SSH key 和 ssh-agent 都可见，HTTPS 凭据管理器可用；如果某个远端仍失败，请点远端行的“诊断”。",
          remotes: [
            { name: "origin", url: "git@github.com:example/atlas-dashboard.git", kind: "ssh", kindLabel: "SSH", host: "github.com" },
            { name: "upstream", url: "https://github.com/example/base-dashboard.git", kind: "https", kindLabel: "HTTPS", host: "github.com" },
          ],
          ssh: {
            directory: "~/.ssh",
            exists: true,
            keys: [
              { name: "id_ed25519", publicKey: true, privateKey: true, publicFile: "id_ed25519.pub", privateFile: "id_ed25519", updated: "2026-06-12 20:18:00" },
              { name: "id_rsa_work", publicKey: true, privateKey: true, publicFile: "id_rsa_work.pub", privateFile: "id_rsa_work", updated: "2026-06-08 09:42:00" },
            ],
            configExists: true,
            knownHostsExists: true,
            message: "发现 2 组 SSH key 文件",
          },
          agent: { available: true, loaded: true, keyCount: 1, message: "ssh-agent 已加载 1 个 key。" },
          credentialManager: { available: true, name: "Git Credential Manager", version: "Git Credential Manager 2.x", message: "Git Credential Manager 可用。" },
          commands: ["git remote -v", "ssh-add -l", "ssh -T git@github.com", "git credential-manager version", "git credential-manager diagnose"],
        },
        pullRequest: {
          available: true,
          url: "https://github.com/example/atlas-dashboard/compare/main...feature%2Fvisual-history?expand=1",
          source: "feature/visual-history",
          target: "main",
          remote: "origin",
          remoteUrl: "git@github.com:example/atlas-dashboard.git",
          platform: "github",
          platformLabel: "GitHub",
          title: "创建 Pull Request",
          reason: "",
        },
        incoming: [
          { sha: "b91a4d3c22aa", short: "b91a4d3", author: "Nora", time: "18 分钟前", message: "远端补充发布说明", refs: "origin/feature/visual-history", parents: [] },
        ],
        outgoing: [
          { sha: "f83a9c2b0177", short: "f83a9c2", author: "Mina", time: "12 分钟前", message: "打磨提交图连线动画", refs: "feature/visual-history", parents: [] },
          { sha: "d41c2ab91020", short: "d41c2ab", author: "Leon", time: "38 分钟前", message: "添加语义化 Diff 分组", refs: "", parents: [] },
        ],
      },
      tags: [
        { name: "v2.9.0", object: "4ab612e", time: "昨天", subject: "发布候选版本构建", type: "commit" },
        { name: "ui-graph-beta", object: "d41c2ab", time: "38 分钟前", subject: "添加语义化 Diff 分组", type: "tag" },
      ],
      recoveryPoints: [
        {
          ref: "refs/forkline/recovery/20260612-213000/feature_visual-history/rebase-onto",
          shortRef: "20260612-213000/feature_visual-history/rebase-onto",
          sha: "f83a9c2b0177",
          short: "f83a9c2",
          subject: "打磨提交图连线动画",
          branch: "feature_visual-history",
          action: "rebase-onto",
          actionLabel: "变基前",
          time: "2026-06-12 21:30:00",
        },
      ],
      reflogEntries: [
        {
          index: 0,
          sha: "f83a9c2b0177",
          short: "f83a9c2",
          selector: "HEAD@{0}",
          message: "commit: 打磨提交图连线动画",
          action: "commit",
          actionLabel: "提交",
          author: "Mina",
          rawTime: "2026-06-12T21:42:00+08:00",
          time: "2026-06-12 21:42:00",
        },
        {
          index: 1,
          sha: "fa51203b0921",
          short: "fa51203",
          selector: "HEAD@{1}",
          message: "checkout: moving from main to feature/visual-history",
          action: "checkout",
          actionLabel: "切换",
          author: "Mina",
          rawTime: "2026-06-12T21:18:00+08:00",
          time: "2026-06-12 21:18:00",
        },
      ],
      runningOperations: [
        {
          id: "sample-running",
          action: "fetch",
          label: "抓取远端",
          startedAt: Date.now() - 2400,
          startedTime: "2026-06-12 21:34:01",
          durationMs: 2400,
          elapsed: "2 秒",
        },
      ],
      operationLog: [
        {
          id: "sample-2",
          status: "success",
          action: "pullRebase",
          label: "变基拉取远端",
          time: "2026-06-12 21:32:18",
          durationMs: 1240,
          summary: "变基拉取完成\n当前分支：feature/visual-history -> origin/feature/visual-history\n同步状态：本地还有 2 个提交未推送",
        },
        {
          id: "sample-1",
          status: "error",
          action: "push",
          label: "推送到远端",
          time: "2026-06-12 21:28:04",
          durationMs: 460,
          summary: "推送被保护：本地领先 2，同时落后 1，普通推送已保护。请先拉取/变基拉取，或确认后使用安全强推。",
        },
      ],
      workingFiles: files,
      commits: data.map(([sha, author, time, message, refs, lane, parents], index) => ({
        sha,
        short: sha.slice(0, 7),
        author,
        time,
        message,
        refs,
        parents,
        lane,
        color: laneColors[lane],
        files: [files[index % files.length], files[(index + 1) % files.length]],
        diff,
      })),
    };
  }

  async function openRepo(repoPath) {
    if (!repoPath || typeof repoPath !== "string") {
      throw new Error("请输入仓库路径");
    }
    const root = (await git(repoPath, ["rev-parse", "--show-toplevel"])).trim();
    if (!currentRepo || !sameFsPath(currentRepo, root)) worktreeFileSnapshotCache.clear();
    setCurrentRepo(root);
    return readState();
  }

  async function readBranchDisplayName(repoPath) {
    const symbolic = (await git(repoPath, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => "")).trim();
    if (symbolic) return symbolic;
    const branch = (await git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    if (!branch || branch === "HEAD") return "detached HEAD";
    return branch;
  }

  async function readState(ref = "", rawHistoryLimit = DEFAULT_HISTORY_LIMIT) {
    const historyLimit = normalizeHistoryLimit(rawHistoryLimit);
    if (!currentRepo) {
      const sample = sampleState();
      const page = historyPage(sample.commits || [], historyLimit);
      return { ...sample, commits: page.commits, history: page.history };
    }
    const repoPath = currentRepo;
    const selectedRef = String(ref || "").trim();
    const hasSubmoduleConfig = repoHasSubmoduleConfig(repoPath);
    await ensureLiveRemoteBranchRef(selectedRef, repoPath);
    const [branch, headShaOutput, branchOutput, trackingOutput, branchMetaOutput, remoteMetaOutput, mergedBranchOutput, remoteOutput, remoteVerboseOutput, tagOutput, worktreeOutput, submoduleConfigOutput, submoduleStatusOutput, statusOutput, stashOutput, recoveryOutput, logOutput] = await Promise.all([
      readBranchDisplayName(repoPath),
      git(repoPath, ["rev-parse", "--verify", "HEAD"]).catch(() => ""),
      git(repoPath, ["branch", "--all", "--format=%(refname)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/heads", "--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/heads", "--sort=-committerdate", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)\t%(committerdate:relative)\t%(committerdate:unix)\t%(subject)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/remotes", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)"]).catch(() => ""),
      git(repoPath, ["branch", "--merged", "HEAD", "--format=%(refname:short)"]).catch(() => ""),
      git(repoPath, ["remote"]).catch(() => ""),
      git(repoPath, ["remote", "-v"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/tags", "--sort=-creatordate", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)\t%(creatordate:relative)\t%(subject)\t%(objecttype)"]).catch(() => ""),
      git(repoPath, ["worktree", "list", "--porcelain"]).catch(() => ""),
      hasSubmoduleConfig ? git(repoPath, submoduleConfigArgs()).catch(() => "") : "",
      hasSubmoduleConfig ? git(repoPath, ["submodule", "status", "--recursive"]).catch(() => "") : "",
      git(repoPath, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => ""),
      git(repoPath, ["stash", "list", "--format=%gd%x00%H%x00%gs%x00%cr"]).catch(() => ""),
      git(repoPath, ["for-each-ref", RECOVERY_REF_PREFIX, "--sort=-refname", "--format=%(refname)\t%(objectname)\t%(objectname:short)\t%(subject)"]).catch(() => ""),
      git(repoPath, logArgs(selectedRef, historyLimit)).catch(() => ""),
    ]);
  
    const branches = [];
    const remotes = [];
    const remoteNames = parseRemoteNames(remoteOutput);
    for (const raw of branchOutput.split(/\r?\n/)) {
      const refname = raw.trim();
      if (!refname) continue;
      if (refname.startsWith("refs/heads/")) {
        branches.push(refname.replace(/^refs\/heads\//, ""));
        continue;
      }
      if (refname.startsWith("refs/remotes/")) {
        const remoteBranch = refname.replace(/^refs\/remotes\//, "");
        if (isKnownRemoteBranch(remoteBranch, remoteNames)) remotes.push(remoteBranch);
        continue;
      }
      if (refname.endsWith("/HEAD") || refname === "origin" || refname === "upstream") continue;
      if (refname.startsWith("remotes/")) {
        const remoteBranch = refname.replace(/^remotes\//, "");
        if (isKnownRemoteBranch(remoteBranch, remoteNames)) remotes.push(remoteBranch);
      } else if (/^[^/]+\/.+/.test(refname) && isKnownRemoteBranch(refname, remoteNames)) remotes.push(refname);
      else branches.push(refname);
    }
    const currentBranch = branch.trim();
    if (currentBranch && currentBranch !== "detached HEAD" && !branches.includes(currentBranch)) {
      branches.unshift(currentBranch);
    }
    const remoteInfo = parseRemoteBranchInfo(remoteMetaOutput, remoteNames);
  
    const worktreeRows = parseWorktreeList(worktreeOutput, repoPath);
    const worktreePruneSnapshot = buildWorktreePruneSnapshot(worktreeRows);
    const branchMeta = parseBranchCleanupMeta(branchMetaOutput);
    const branchTracking = parseBranchTracking(trackingOutput);
    const branchInfo = mergeBranchInfo(branchTracking, branchMeta, parseWorktreeBranches(worktreeOutput, repoPath));
    const branchCleanup = buildBranchCleanup({
      branches,
      branchInfo,
      branchMeta,
      mergedBranches: parseSimpleLines(mergedBranchOutput),
      currentBranch,
    });
    const syncOptions = {
      branch: currentBranch,
      hasCommit: Boolean(headShaOutput.trim()),
      remotes: parseRemoteDetails(remoteVerboseOutput, remoteNames),
      localBranches: branches,
      remoteNames,
    };
    if (branchTracking[currentBranch]) syncOptions.upstream = branchTracking[currentBranch].upstream;
    const [worktrees, submodules, working, sync] = await Promise.all([
      enrichWorktreeList(worktreeRows, { repoPath, statusOutput }),
      enrichSubmodules(parseSubmodules(submoduleConfigOutput, submoduleStatusOutput), repoPath),
      readWorkingStatus(repoPath, statusOutput),
      readCurrentSyncDetails(repoPath, syncOptions),
    ]);
    const commitPage = historyPage(parseLog(logOutput), historyLimit);
    return {
      repo: {
        name: path.basename(repoPath),
        path: repoPath,
        branch: branch.trim() || "detached HEAD",
        headSha: headShaOutput.trim(),
        selectedRef,
        isSample: false,
        operation: detectRepoOperation(repoPath),
        remoteNames,
      },
      branches,
      branchInfo,
      branchCleanup,
      worktrees,
      worktreePruneSnapshot,
      submodules,
      remotes,
      remoteInfo,
      sync,
      workingFiles: working.files,
      worktreeSnapshot: working.snapshot,
      stashes: parseStashList(stashOutput),
      recoveryPoints: parseRecoveryPoints(recoveryOutput),
      tags: parseTags(tagOutput),
      runningOperations: listRunningOperations(),
      operationLog,
      commits: commitPage.commits,
      history: commitPage.history,
    };
  }

  async function readReflogState(repoPath = currentRepo) {
    const output = await readReflogOutput(80, repoPath).catch(() => "");
    return { reflogEntries: parseReflogEntries(output) };
  }

  async function readRefState(ref = "", rawHistoryLimit = DEFAULT_HISTORY_LIMIT) {
    const historyLimit = normalizeHistoryLimit(rawHistoryLimit);
    if (!currentRepo) {
      const sample = sampleState();
      sample.repo.selectedRef = ref;
      if (ref) sample.commits = sampleBranchCommits(sample, ref);
      const page = historyPage(sample.commits || [], historyLimit);
      return { repo: sample.repo, commits: page.commits, history: page.history };
    }
    const repoPath = currentRepo;
    const selectedRef = String(ref || "").trim();
    await ensureLiveRemoteBranchRef(selectedRef, repoPath);
    const [branch, headShaOutput, logOutput] = await Promise.all([
      readBranchDisplayName(repoPath),
      git(repoPath, ["rev-parse", "--verify", "HEAD"]).catch(() => ""),
      git(repoPath, logArgs(selectedRef, historyLimit)).catch(() => ""),
    ]);
    const commitPage = historyPage(parseLog(logOutput), historyLimit);
    return {
      repo: {
        name: path.basename(repoPath),
        path: repoPath,
        branch: branch.trim() || "detached HEAD",
        headSha: headShaOutput.trim(),
        selectedRef,
        isSample: false,
        operation: detectRepoOperation(repoPath),
      },
      commits: commitPage.commits,
      history: commitPage.history,
    };
  }

  function sampleBranchCommits(sample, ref) {
    const commits = sample?.commits || [];
    if (!ref || !commits.length) return commits;
    const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
    let cursor = commits.find((commit) => refNamesFromText(commit.refs).includes(ref)) || commits[0];
    const list = [];
    while (cursor && !list.some((commit) => commit.sha === cursor.sha)) {
      list.push({ ...cursor, lane: 0, color: laneColors[0] });
      cursor = bySha.get(cursor.parents?.[0]);
    }
    return list;
  }

  function refNamesFromText(refs) {
    return String(refs || "")
      .split(",")
      .map((item) => item.trim().replace(/^HEAD\s+->\s+/, ""))
      .filter(Boolean);
  }

  function normalizeHistoryLimit(value) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isInteger(parsed)) return DEFAULT_HISTORY_LIMIT;
    return Math.max(20, Math.min(MAX_HISTORY_LIMIT, parsed));
  }

  function historyPage(commits, limit) {
    const list = Array.isArray(commits) ? commits : [];
    const hasMore = list.length > limit;
    const visible = hasMore ? list.slice(0, limit) : list;
    return {
      commits: visible,
      history: {
        limit,
        loaded: visible.length,
        hasMore,
        pageSize: DEFAULT_HISTORY_LIMIT,
        maxLimit: MAX_HISTORY_LIMIT,
      },
    };
  }

  function logArgs(ref, limit = DEFAULT_HISTORY_LIMIT) {
    const selectedRef = String(ref || "").trim();
    const historyLimit = normalizeHistoryLimit(limit);
    const args = [
      "log",
      "--graph",
      "--topo-order",
      `--max-count=${historyLimit + 1}`,
      "--date=relative",
      `--pretty=format:%x00${REF_COMMIT_LOG_FORMAT}`,
    ];
    if (selectedRef) {
      args.push("--first-parent", selectedRef);
    } else {
      args.push("--branches", "--remotes");
    }
    return args;
  }

  async function readWorktree(options = {}) {
    const includeStashes = Boolean(options.includeStashes);
    if (!currentRepo) {
      const sample = sampleState();
      return {
        workingFiles: sample.workingFiles,
        operation: null,
        ...(includeStashes ? { stashes: sample.stashes || [] } : {}),
      };
    }
    const repoPath = currentRepo;
    const [statusOutput, stashOutput] = await Promise.all([
      git(repoPath, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => ""),
      includeStashes ? git(repoPath, ["stash", "list", "--format=%gd%x00%H%x00%gs%x00%cr"]).catch(() => "") : "",
    ]);
    const working = await readWorkingStatus(repoPath, statusOutput);
    return {
      workingFiles: working.files,
      worktreeSnapshot: working.snapshot,
      operation: detectRepoOperation(repoPath),
      ...(includeStashes ? { stashes: parseStashList(stashOutput) } : {}),
    };
  }

  async function readWorkingDiff(filePath, rawScope = "auto") {
    if (!currentRepo) {
      const sample = sampleState();
      return { file: filePath || sample.workingFiles[0]?.file || "", scope: "unstaged", requestedScope: "auto", diff: sample.commits[0]?.diff || [] };
    }
    const repoPath = currentRepo;
    const file = normalizeRepoFile(filePath);
    const requestedScope = normalizeWorktreeDiffRequestScope(rawScope);
    let scope = requestedScope === "auto" ? "unstaged" : requestedScope;
    let target = await readStatusFileForDiff(file, scope, repoPath);
    let output = await readWorktreeDiffOutput(file, scope, target, repoPath);
    if (!output && requestedScope !== "staged") {
      target = target || await readStatusFileForDiff(file, "unstaged", repoPath);
      if (target?.indexStatus === "?") {
        scope = "untracked";
        output = readNewFileDiff(file, repoPath);
      }
    }
    if (!output && requestedScope === "auto") {
      scope = "staged";
      target = await readStatusFileForDiff(file, scope, repoPath);
      output = await readWorktreeDiffOutput(file, scope, target, repoPath);
    }
    return { file, previousFile: target?.previousFile || "", scope, requestedScope, diff: parseDiff(output) };
  }

  async function readStash(ref) {
    if (!currentRepo) {
      return { ref: "", files: [], diff: [] };
    }
    const repoPath = currentRepo;
    const stashRef = normalizeStashRef(ref);
    const [filesOutput, diffOutput] = await Promise.all([
      git(repoPath, ["stash", "show", "--include-untracked", "--name-status", stashRef], { maxBuffer: 1024 * 1024 * 2 }),
      git(repoPath, ["stash", "show", "--include-untracked", "--patch", "--no-ext-diff", "--unified=8", stashRef], { maxBuffer: 1024 * 1024 * 5 }),
    ]);
    return {
      ref: stashRef,
      files: parseNameStatus(filesOutput),
      diff: parseDiff(diffOutput),
    };
  }

  async function ensureRemoteBranchStillExists(remoteRef, parsed = null, repoPath = currentRepo) {
    const { remote, branch } = parsed || splitRemoteBranchRef(remoteRef, await readRemoteNames(repoPath));
    const output = await git(repoPath, ["ls-remote", "--heads", remote, branch], { timeout: 60000, maxBuffer: 1024 * 1024 * 2 });
    if (String(output || "").trim()) return;
    await git(repoPath, ["fetch", remote, "--prune"], { timeout: 120000 }).catch(() => "");
    throw new Error(`远端分支 ${remoteRef} 已不存在，已刷新远端分支列表。请刷新后重新选择。`);
  }

  async function ensureLiveRemoteBranchRef(ref, repoPath = currentRepo) {
    if (!String(ref || "").trim()) return;
    const remoteNames = await readRemoteNames(repoPath);
    if (!isKnownRemoteBranch(ref, remoteNames)) return;
    await ensureRemoteBranchStillExists(ref, splitRemoteBranchRef(ref, remoteNames), repoPath);
  }

  async function readWorktreeDiffOutput(file, scope, fileInfo = null, repoPath = currentRepo, context = WORKTREE_DIFF_CONTEXT) {
    const diffScope = normalizeDiffScope(scope);
    const diffContext = normalizeWorktreeDiffContext(context);
    const target = fileInfo || await readStatusFileForDiff(file, diffScope === "staged" ? "staged" : "unstaged", repoPath);
    const pathspecs = worktreeDiffPathspecs(file, target);
    const args = diffScope === "staged"
      ? ["diff", "--cached", "--find-renames", "--find-copies", "--no-ext-diff", `--unified=${diffContext}`, "--", ...pathspecs]
      : ["diff", "--find-renames", "--find-copies", "--no-ext-diff", `--unified=${diffContext}`, "--", ...pathspecs];
    return git(repoPath, args, { maxBuffer: 1024 * 1024 * 8, stdoutOnly: true }).catch(() => "");
  }

  async function readStatusFileForDiff(file, scope = "any", repoPath = currentRepo) {
    const statusOutput = await git(repoPath, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
    return selectStatusFile(parseStatus(statusOutput), file, scope);
  }

  function worktreeDiffPathspecs(file, target) {
    const currentFile = normalizeRepoFile(file);
    const previousFile = target?.previousFile ? normalizeRepoFile(target.previousFile) : "";
    if (previousFile && (target.indexStatus === "R" || target.indexStatus === "C")) {
      return [previousFile, currentFile];
    }
    return [currentFile];
  }

  function normalizeRepoFile(filePath) {
    const value = String(filePath || "").replaceAll("\\", "/");
    if (!value || value.includes("\0")) throw new Error("请选择要对照的文件");
    if (path.isAbsolute(value) || value.split("/").includes("..")) throw new Error("文件路径不合法");
    return value;
  }

  function normalizeDiffScope(value) {
    const scope = String(value || "unstaged").trim().toLowerCase();
    if (scope === "unstaged" || scope === "staged") return scope;
    throw new Error("Diff 范围不合法，请刷新后再试。");
  }

  function normalizeWorktreeDiffRequestScope(value) {
    const scope = String(value || "auto").trim().toLowerCase();
    if (scope === "auto" || scope === "unstaged" || scope === "staged") return scope;
    throw new Error("Diff 视图不合法，请刷新后再试。");
  }

  function normalizeWorktreeDiffContext(value) {
    return value === FILE_EDITOR_DIFF_CONTEXT || value === String(FILE_EDITOR_DIFF_CONTEXT)
      ? FILE_EDITOR_DIFF_CONTEXT
      : WORKTREE_DIFF_CONTEXT;
  }

  function normalizeBranchName(branchName) {
    const branch = String(branchName || "").trim();
    if (!branch || branch.includes("\0")) throw new Error("请选择要切换的分支");
    if (branch.startsWith("-") || branch.includes("\\") || branch.includes("..") || branch.includes("@{")) {
      throw new Error("分支名不合法");
    }
    if (branch.endsWith(".lock") || branch.split("/").some((part) => !part || part.endsWith("."))) {
      throw new Error("分支名不合法");
    }
    return branch;
  }

  function normalizeRefName(value, label = "分支起点") {
    const ref = String(value || "").trim();
    if (!ref || ref.includes("\0")) throw new Error(`${label}不合法`);
    if (ref.startsWith("-") || ref.includes("\\") || ref.includes("..") || ref.includes("@{") || /\s/.test(ref)) {
      throw new Error(`${label}不合法`);
    }
    if (ref.endsWith(".lock") || ref.endsWith(".") || ref.split("/").some((part) => !part || part.endsWith("."))) {
      throw new Error(`${label}不合法`);
    }
    return ref;
  }

  function normalizeRemoteName(value) {
    return normalizeRefName(value, "远端名");
  }

  async function readRemoteNames(repoPath = currentRepo) {
    return parseRemoteNames(await git(repoPath, ["remote"]).catch(() => ""));
  }

  async function hasHeadCommit(repoPath) {
    return Boolean((await git(repoPath, ["rev-parse", "--verify", "HEAD^{commit}"]).catch(() => "")).trim());
  }

  function readReflogOutput(maxCount = 80, repoPath = currentRepo) {
    const count = Math.max(1, Math.min(Number.parseInt(String(maxCount || 80), 10) || 80, 200));
    return git(repoPath, [
      "log",
      "-g",
      `--max-count=${count}`,
      "--date=iso-strict",
      "--format=%H%x00%h%x00%gd%x00%gs%x00%an%x00%ad",
      "HEAD",
    ], { maxBuffer: 1024 * 1024 * 2 });
  }

  function parseRecoveryPoints(output) {
    return String(output || "")
      .split(/\r?\n/)
      .filter((line) => line.includes("\t"))
      .map((line) => {
        const [ref, sha, short, ...subjectParts] = line.split("\t");
        const subject = subjectParts.join("\t");
        return recoveryPointFromParts(ref, sha, short, subject);
      })
      .filter(Boolean);
  }

  function parseReflogEntries(output) {
    return String(output || "")
      .split(/\r?\n/)
      .filter((line) => line.includes(GIT_LOG_FIELD_SEPARATOR))
      .map((line, index) => {
        const [sha, short, rawSelector, rawMessage, author, rawTime] = line.split(GIT_LOG_FIELD_SEPARATOR);
        if (!sha) return null;
        const selector = rawSelector || `HEAD@{${index}}`;
        const message = reflogMessage(rawMessage);
        return {
          index,
          sha,
          short: short || String(sha).slice(0, 7),
          selector,
          message,
          action: reflogActionKey(message),
          actionLabel: reflogActionLabel(message),
          author: author || "",
          rawTime: rawTime || "",
          time: reflogTimeLabel(rawTime),
        };
      })
      .filter(Boolean);
  }

  function reflogMessage(value) {
    return String(value || "").trim() || "HEAD 位置变更";
  }

  function reflogActionKey(message) {
    const lower = String(message || "").toLowerCase();
    if (lower.startsWith("commit")) return "commit";
    if (lower.startsWith("checkout")) return "checkout";
    if (lower.startsWith("reset")) return "reset";
    if (lower.startsWith("merge")) return "merge";
    if (lower.startsWith("rebase")) return "rebase";
    if (lower.startsWith("cherry-pick")) return "cherry-pick";
    if (lower.startsWith("revert")) return "revert";
    if (lower.startsWith("pull")) return "pull";
    if (lower.startsWith("clone")) return "clone";
    return "move";
  }

  function reflogActionLabel(message) {
    const labels = {
      commit: "提交",
      checkout: "切换",
      reset: "重置",
      merge: "合并",
      rebase: "变基",
      "cherry-pick": "挑选",
      revert: "还原",
      pull: "拉取",
      clone: "克隆",
      move: "移动",
    };
    return labels[reflogActionKey(message)] || "移动";
  }

  function reflogTimeLabel(value) {
    const date = new Date(String(value || ""));
    return Number.isNaN(date.getTime()) ? String(value || "") : formatLocalTime(date);
  }

  function recoveryPointFromParts(ref, sha, short, subject = "") {
    if (!ref || !ref.startsWith(`${RECOVERY_REF_PREFIX}/`)) return null;
    const shortRef = shortRecoveryRef(ref);
    const parts = shortRef.split("/");
    const timestamp = parts[0] || "";
    const branch = parts[1] || "HEAD";
    const action = (parts[2] || "operation").replace(/-\d+$/, "");
    return {
      ref,
      shortRef,
      sha,
      short: short || String(sha || "").slice(0, 7),
      subject: subject || "",
      branch,
      action,
      actionLabel: recoveryActionLabel(action),
      timestamp,
      time: recoveryTimeLabel(timestamp),
    };
  }

  function shortRecoveryRef(ref) {
    return String(ref || "").replace(`${RECOVERY_REF_PREFIX}/`, "");
  }

  function recoveryTimeLabel(timestamp) {
    const match = String(timestamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
    if (!match) return timestamp || "";
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  }

  function recoveryActionLabel(action) {
    const labels = {
      amend: "追加提交前",
      reword: "修改提交信息前",
      "pull-rebase": "变基拉取前",
      "rebase-onto": "变基前",
      "history-squash": "压缩提交前",
      "history-fixup": "修补提交前",
      "history-drop": "丢弃提交前",
      "history-queue": "历史编辑队列前",
      "reset-soft": "软重置前",
      "reset-mixed": "混合重置前",
      "reset-hard": "硬重置前",
      "restore-recovery": "恢复前",
      "restore-reflog": "引用日志恢复前",
    };
    if (String(action || "").startsWith("reflog-")) return "引用日志保存点";
    return labels[action] || "危险操作前";
  }

  function extractRemoteHost(remoteUrl) {
    const value = String(remoteUrl || "").trim();
    if (!value) return "";
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      try {
        return new URL(value).hostname;
      } catch {
        return "";
      }
    }
    const scpLike = value.match(/^[^@]+@([^:]+):/);
    return scpLike?.[1] || "";
  }

  function normalizeSha(value) {
    const sha = String(value || "").trim();
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error("提交 SHA 不合法");
    return sha;
  }

  function resolveGitDirSync(repoPath) {
    if (!repoPath) return "";
    const dotGit = path.join(repoPath, ".git");
    try {
      const stat = fs.statSync(dotGit);
      if (stat.isDirectory()) return dotGit;
      if (stat.isFile()) {
        const text = fs.readFileSync(dotGit, "utf8");
        const match = text.match(/^gitdir:\s*(.+)\s*$/i);
        if (!match) return "";
        const gitDir = match[1].trim();
        return path.resolve(repoPath, gitDir);
      }
    } catch {
      return "";
    }
    return "";
  }

  function detectRepoOperation(repoPath) {
    const gitDir = resolveGitDirSync(repoPath);
    if (!gitDir) return null;
    if (fs.existsSync(path.join(gitDir, "REVERT_HEAD"))) {
      return { type: "revert", label: "还原提交未完成", canContinue: true, canAbort: true, snapshot: gitOperationSnapshot(gitDir, "revert") };
    }
    if (fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD"))) {
      return { type: "cherryPick", label: "挑选提交未完成", canContinue: true, canAbort: true, canSkip: true, snapshot: gitOperationSnapshot(gitDir, "cherryPick") };
    }
    if (fs.existsSync(path.join(gitDir, "MERGE_HEAD"))) {
      return { type: "merge", label: "合并未完成", canContinue: true, canAbort: true, snapshot: gitOperationSnapshot(gitDir, "merge") };
    }
    if (fs.existsSync(path.join(gitDir, "rebase-merge")) || fs.existsSync(path.join(gitDir, "rebase-apply"))) {
      return { type: "rebase", label: "变基未完成", canContinue: true, canAbort: true, canSkip: true, snapshot: gitOperationSnapshot(gitDir, "rebase") };
    }
    return null;
  }

  function gitOperationSnapshot(gitDir, type) {
    const paths = operationSnapshotPaths(gitDir, type);
    const entries = paths
      .map((relative) => operationSnapshotEntry(gitDir, relative))
      .filter(Boolean)
      .sort((left, right) => left.path.localeCompare(right.path));
    return sha256Json({ type, entries });
  }

  function operationSnapshotPaths(gitDir, type) {
    if (type === "merge") return ["MERGE_HEAD", "MERGE_MODE", "MERGE_MSG"];
    if (type === "revert") return ["REVERT_HEAD", ...sequencerSnapshotPaths(gitDir)];
    if (type === "cherryPick") return ["CHERRY_PICK_HEAD", ...sequencerSnapshotPaths(gitDir)];
    if (type === "rebase") {
      return [
        ...directorySnapshotPaths(gitDir, "rebase-merge"),
        ...directorySnapshotPaths(gitDir, "rebase-apply"),
      ];
    }
    return [];
  }

  function sequencerSnapshotPaths(gitDir) {
    return directorySnapshotPaths(gitDir, "sequencer");
  }

  function directorySnapshotPaths(gitDir, relativeDir) {
    const root = path.join(gitDir, relativeDir);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
    const results = [];
    const stack = [root];
    while (stack.length && results.length < 128) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          results.push(path.relative(gitDir, full).replaceAll("\\", "/"));
        }
      }
    }
    return results;
  }

  function operationSnapshotEntry(gitDir, relativePath) {
    const full = path.join(gitDir, relativePath);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) return null;
      const buffer = fs.readFileSync(full);
      return {
        path: relativePath.replaceAll("\\", "/"),
        size: stat.size,
        sha: crypto.createHash("sha256").update(buffer).digest("hex"),
      };
    } catch {
      return null;
    }
  }

  function formatLocalTime(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  return {
    setCurrentRepo,
    extractRemoteHost,
    normalizeSha,
    resolveGitDirSync,
    detectRepoOperation,
    gitOperationSnapshot,
    operationSnapshotPaths,
    sequencerSnapshotPaths,
    directorySnapshotPaths,
    operationSnapshotEntry,
    formatLocalTime,
    openRepo,
    readBranchDisplayName,
    readState,
    readReflogState,
    readRefState,
    sampleBranchCommits,
    refNamesFromText,
    normalizeHistoryLimit,
    historyPage,
    logArgs,
    readWorktree,
    readWorkingDiff,
    readStash,
    ensureRemoteBranchStillExists,
    ensureLiveRemoteBranchRef,
    readWorktreeDiffOutput,
    readStatusFileForDiff,
    worktreeDiffPathspecs,
    normalizeRepoFile,
    normalizeDiffScope,
    normalizeWorktreeDiffRequestScope,
    normalizeWorktreeDiffContext,
    normalizeBranchName,
    normalizeRefName,
    normalizeRemoteName,
    readRemoteNames,
    hasHeadCommit,
    readReflogOutput,
    parseRecoveryPoints,
    parseReflogEntries,
    reflogMessage,
    reflogActionKey,
    reflogActionLabel,
    reflogTimeLabel,
    recoveryPointFromParts,
    shortRecoveryRef,
    recoveryTimeLabel,
    recoveryActionLabel,
    readRemoteBranchNames,
    ensureRemoteBranchRef,
    readRemoteDetails,
    readExplicitRemotePushUrls,
    replaceRemotePushUrls,
    defaultRemoteName,
    parseRemoteNames,
    parseRemoteDetails,
    isKnownRemoteBranch,
    splitRemoteBranchRef,
    normalizeStashRef,
    ensureCurrentStashRef,
    normalizeExpectedStashSha,
    normalizeStashMessage,
    normalizeStashFiles,
    normalizeTagName,
    parseWorktreeBranches,
    parseWorktreeList,
    buildWorktreePruneSnapshot,
    worktreePruneEntries,
    enrichWorktreeList,
    submoduleConfigArgs,
    repoHasSubmoduleConfig,
    parseSubmodules,
    enrichSubmodules,
    normalizeSubmodulePath,
    readDirectory,
    isPathInside,
    parseBranchTracking,
    mergeBranchInfo,
    parseBranchCleanupMeta,
    parseRemoteBranchInfo,
    parseSimpleLines,
    buildBranchCleanup,
    parseTags,
    ensureCurrentLocalTag,
    normalizeExpectedTagSha,
    ensureRemoteTag,
    sameFsPath,
    readNewFileDiff,
    decodeUtf8Strict,
    commandResult,
    commandResultWithSummary,
    readCurrentSyncState,
    syncCommandResult,
    syncStateLine,
    parseStatus,
    readWorkingStatus,
    sha256Json,
    selectStatusFile,
    worktreeActionTargetScope,
    parseStashList,
    parseNameStatus,
    parseDiff,
    parseLog,
    readCurrentSyncDetails,
    readCachedAuthDiagnostics,
    sampleState,
  };
}

module.exports = { createRepositoryService };
