"use strict";



const crypto = require("crypto");

const fs = require("fs");

const path = require("path");

const INDEX_PATHSPEC_MAX_CHARS = 24 * 1024;
const INDEX_QUERY_CONCURRENCY = 4;
const WORKTREE_SNAPSHOT_CONCURRENCY = 32;
const WORKTREE_WATCH_RESCAN_MS = 60 * 1000;



function createRepositoryWorktreeService(options) {

  const {

    git,

    getCurrentRepo,

    browseService,

    authService,

    readBranchDisplayName,

    hasHeadCommit,

    readRemoteDetails,

    normalizeStashRef,

    sampleState,

    detectRepoOperation,

    worktreeDiffContext: WORKTREE_DIFF_CONTEXT,

    fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,

    worktreeSnapshotCacheLimit: WORKTREE_SNAPSHOT_CACHE_LIMIT,

    untrackedDiffHunkSize: UNTRACKED_DIFF_HUNK_SIZE,

    gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,

    refCommitLogFormat: REF_COMMIT_LOG_FORMAT,

    laneColors,

    worktreeFileSnapshotCache,

    now = Date.now,

    watchWorktree = (repoPath, listener) => fs.watch(repoPath, { recursive: true, persistent: false }, listener),

  } = options;

  const { isPathInside, sameFsPath } = browseService;

  const { readPullRequestLink } = authService;

  const readStatusFileSnapshot = options.statusFileSnapshot || statusFileSnapshot;

  const WORKTREE_WATCH_CACHE_LIMIT = 2;

  let currentRepo = getCurrentRepo();

  const worktreeWatchStates = new Map();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

    if (!currentRepo) closeAllWorktreeWatchers();

  }



  function worktreeWatchStateKey(repoPath) {

    const resolved = path.resolve(String(repoPath || ""));

    return process.platform === "win32" ? resolved.toLowerCase() : resolved;

  }



  function closeWorktreeWatchState(state) {

    if (!state) return;

    if (worktreeWatchStates.get(state.key) === state) worktreeWatchStates.delete(state.key);

    const watcher = state.watcher;

    state.watcher = null;

    state.changedPaths.clear();

    state.needsFullScan = false;

    state.readCache = null;

    try {

      watcher?.close();

    } catch {}

  }



  function closeAllWorktreeWatchers() {

    for (const state of [...worktreeWatchStates.values()]) closeWorktreeWatchState(state);

  }



  function touchWorktreeWatchState(state) {

    if (worktreeWatchStates.get(state.key) !== state) return;

    worktreeWatchStates.delete(state.key);

    worktreeWatchStates.set(state.key, state);

  }



  function trimWorktreeWatchStates() {

    while (worktreeWatchStates.size > WORKTREE_WATCH_CACHE_LIMIT) {

      closeWorktreeWatchState(worktreeWatchStates.values().next().value);

    }

  }



  function worktreeWatchPathKey(fileName) {

    const value = String(fileName || "")
      .replaceAll("\\", "/")
      .replace(/^\.\/+/, "")
      .replace(/\/{2,}/g, "/");

    if (!value || value === "." || path.isAbsolute(value) || value.split("/").includes("..")) return "";

    return process.platform === "win32" ? value.toLowerCase() : value;

  }



  function recordWorktreeWatchChange(state, fileName) {

    if (worktreeWatchStates.get(state.key) !== state) return;

    const watchedPath = worktreeWatchPathKey(fileName);

    if (!watchedPath || watchedPath === ".git" || watchedPath === ".git/index" || watchedPath === ".git/index.lock") {

      state.needsFullScan = true;

    } else if (watchedPath.startsWith(".git/")) {

      return;

    } else {

      state.changedPaths.add(watchedPath);

    }

    state.generation += 1;

  }



  function ensureWorktreeWatcher(repoPath) {

    const key = worktreeWatchStateKey(repoPath);

    const existing = worktreeWatchStates.get(key);

    if (existing?.watcher) {

      touchWorktreeWatchState(existing);

      return existing;

    }

    try {

      const state = {

        key,

        repoPath,

        watcher: null,

        generation: 0,

        changedPaths: new Set(),

        needsFullScan: false,

        readCache: null,

      };

      const watcher = watchWorktree(repoPath, (_eventType, fileName) => recordWorktreeWatchChange(state, fileName));

      if (!watcher || typeof watcher.close !== "function") return null;

      state.watcher = watcher;

      worktreeWatchStates.set(key, state);

      trimWorktreeWatchStates();

      watcher.on?.("error", () => {

        if (worktreeWatchStates.get(key) === state) closeWorktreeWatchState(state);

      });

      return state;

    } catch {

      return null;

    }

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
    const knownUpstreamSha = options.upstreamSha !== undefined ? String(options.upstreamSha || "").trim() : null;
    const knownUpstreamGone = typeof options.upstreamGone === "boolean" ? options.upstreamGone : null;
    const knownAhead = options.ahead !== undefined && Number.isFinite(Number(options.ahead))
      ? Math.max(0, Number(options.ahead))
      : null;
    const knownBehind = options.behind !== undefined && Number.isFinite(Number(options.behind))
      ? Math.max(0, Number(options.behind))
      : null;
    const hasCommit = typeof options.hasCommit === "boolean" ? options.hasCommit : await hasHeadCommit(repoPath);
    if (!hasCommit) {
      let upstreamSha = "";
      if (upstream && knownUpstreamGone !== true) {
        upstreamSha = knownUpstreamSha !== null
          ? knownUpstreamSha
          : (await git(repoPath, ["rev-parse", "--verify", `${upstream}^{commit}`]).catch(() => "")).trim();
      }
      return { branch, detached: false, unborn: true, upstream, upstreamSha, upstreamGone: Boolean(upstream && !upstreamSha), ahead: 0, behind: 0 };
    }
    if (!upstream) {
      return { branch, detached: false, unborn: false, upstream: "", upstreamSha: "", upstreamGone: false, ahead: 0, behind: 0 };
    }
    if (knownUpstreamGone === true) {
      return { branch, detached: false, unborn: false, upstream, upstreamSha: "", upstreamGone: true, ahead: 0, behind: 0 };
    }
    const upstreamSha = knownUpstreamSha !== null
      ? knownUpstreamSha
      : (await git(repoPath, ["rev-parse", "--verify", `${upstream}^{commit}`]).catch(() => "")).trim();
    if (!upstreamSha) {
      return { branch, detached: false, unborn: false, upstream, upstreamSha: "", upstreamGone: true, ahead: 0, behind: 0 };
    }
    if (knownAhead !== null && knownBehind !== null) {
      return {
        branch,
        detached: false,
        unborn: false,
        upstream,
        upstreamSha,
        upstreamGone: false,
        behind: knownBehind,
        ahead: knownAhead,
      };
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

  function compactWorktreeChangedPaths(changedPaths) {
    const paths = [...changedPaths];
    return paths.filter((candidate) => !paths.some((other) => (
      other !== candidate && other.startsWith(`${candidate}/`)
    )));
  }

  function changedStatusFileIndexes(files, changedPaths) {
    const indexes = new Set();
    for (const changedPath of compactWorktreeChangedPaths(changedPaths)) {
      for (let index = 0; index < files.length; index += 1) {
        const filePaths = [files[index].file, files[index].previousFile]
          .filter(Boolean)
          .map(worktreeWatchPathKey)
          .filter(Boolean);
        if (filePaths.some((filePath) => (
          filePath === changedPath
          || filePath.startsWith(`${changedPath}/`)
          || changedPath.startsWith(`${filePath}/`)
        ))) {
          indexes.add(index);
        }
      }
    }
    return [...indexes];
  }

  async function refreshCachedWorkingStatus(repoPath, cachedFiles, changedPaths) {
    const changedIndexes = changedStatusFileIndexes(cachedFiles, changedPaths);
    if (!changedIndexes.length) {
      return {
        files: cachedFiles,
        snapshot: combinedWorktreeSnapshot(cachedFiles),
      };
    }
    const changedFiles = changedIndexes.map((index) => cachedFiles[index]);
    const paths = [...new Set(changedFiles.flatMap((file) => (
      file.indexStatus === "?" ? [] : [file.file, file.previousFile].filter(Boolean)
    )))];
    const indexEntries = await readIndexSnapshotEntries(repoPath, paths);
    const refreshedFiles = await mapWithConcurrency(changedFiles, WORKTREE_SNAPSHOT_CONCURRENCY, async (file) => {
      const snapshot = await readStatusFileSnapshot(repoPath, file, indexEntries);
      return { ...file, snapshot };
    });
    const files = cachedFiles.slice();
    changedIndexes.forEach((index, changedIndex) => {
      files[index] = refreshedFiles[changedIndex];
    });
    return {
      files,
      snapshot: combinedWorktreeSnapshot(files),
    };
  }

  async function readWorkingStatus(repoPath, statusOutput) {
    const files = parseStatus(statusOutput);
    const paths = [...new Set(files.flatMap((file) => (
      file.indexStatus === "?" ? [] : [file.file, file.previousFile].filter(Boolean)
    )))];
    const indexEntries = await readIndexSnapshotEntries(repoPath, paths);
    const enriched = await mapWithConcurrency(files, WORKTREE_SNAPSHOT_CONCURRENCY, async (file) => {
      const snapshot = await readStatusFileSnapshot(repoPath, file, indexEntries);
      return { ...file, snapshot };
    });
    return {
      files: enriched,
      snapshot: combinedWorktreeSnapshot(enriched),
    };
  }

  async function readCachedWorkingStatus(repoPath, statusOutput, options = {}) {
    const forceScan = Boolean(options.forceScan);
    const watchState = ensureWorktreeWatcher(repoPath);
    if (!watchState) return readWorkingStatus(repoPath, statusOutput);

    const cachedGeneration = watchState.generation;
    const cachedWorktree = watchState.readCache;
    const cacheMatchesStatus = cachedWorktree?.repoPath === repoPath
      && cachedWorktree.statusOutput === statusOutput
      && now() - cachedWorktree.scannedAt <= WORKTREE_WATCH_RESCAN_MS;
    if (
      !forceScan
      && cacheMatchesStatus
      && cachedWorktree.generation === cachedGeneration
      && !watchState.needsFullScan
    ) {
      await new Promise((resolve) => setImmediate(resolve));
      if (
        worktreeWatchStates.get(watchState.key) === watchState
        && watchState.readCache === cachedWorktree
        && watchState.generation === cachedGeneration
        && !watchState.needsFullScan
      ) {
        return {
          files: cachedWorktree.files,
          snapshot: cachedWorktree.snapshot,
        };
      }
    }

    const scanGeneration = watchState.generation;
    const scanCache = watchState.readCache;
    const changedPaths = new Set(watchState.changedPaths);
    const canRefreshIncrementally = !forceScan
      && scanCache?.repoPath === repoPath
      && scanCache.statusOutput === statusOutput
      && scanCache.generation !== scanGeneration
      && Array.isArray(scanCache.files)
      && changedPaths.size > 0
      && !watchState.needsFullScan
      && now() - scanCache.scannedAt <= WORKTREE_WATCH_RESCAN_MS;
    const working = canRefreshIncrementally
      ? await refreshCachedWorkingStatus(repoPath, scanCache.files, changedPaths)
      : await readWorkingStatus(repoPath, statusOutput);
    if (
      worktreeWatchStates.get(watchState.key) === watchState
      && scanGeneration === watchState.generation
    ) {
      watchState.readCache = {
        repoPath,
        statusOutput,
        files: working.files,
        snapshot: working.snapshot,
        generation: watchState.generation,
        scannedAt: canRefreshIncrementally ? scanCache.scannedAt : now(),
      };
      watchState.changedPaths.clear();
      watchState.needsFullScan = false;
    } else if (worktreeWatchStates.get(watchState.key) === watchState) {
      watchState.readCache = null;
    }
    return working;
  }

  async function readIndexSnapshotEntries(repoPath, files) {
    const entries = new Map();
    if (!files.length) return entries;
    const batches = indexPathspecBatches(files);
    const outputs = await mapWithConcurrency(batches, INDEX_QUERY_CONCURRENCY, (batch) => (
      git(repoPath, ["ls-files", "-s", "-z", "--", ...batch], { maxBuffer: 1024 * 1024 * 8 }).catch(() => "")
    ));
    for (const output of outputs) {
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
    }
    for (const [file, list] of entries) {
      entries.set(file, list.sort().join(","));
    }
    return entries;
  }

  function indexPathspecBatches(files) {
    const batches = [];
    let batch = [];
    let chars = "ls-files\0-s\0-z\0--\0".length;
    for (const file of files) {
      const nextChars = String(file).length + 1;
      if (batch.length && chars + nextChars > INDEX_PATHSPEC_MAX_CHARS) {
        batches.push(batch);
        batch = [];
        chars = "ls-files\0-s\0-z\0--\0".length;
      }
      batch.push(file);
      chars += nextChars;
    }
    if (batch.length) batches.push(batch);
    return batches;
  }

  async function statusFileSnapshot(repoPath, file, indexEntries) {
    const [worktree, previousWorktree] = await Promise.all([
      worktreeFileSnapshot(repoPath, file.file),
      file.previousFile ? worktreeFileSnapshot(repoPath, file.previousFile) : "",
    ]);
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
      worktree,
      previousWorktree,
    });
  }

  function combinedWorktreeSnapshot(files) {
    return sha256Json(files.map((file) => `${file.file}\0${file.previousFile || ""}\0${file.snapshot || ""}`).sort());
  }

  async function worktreeFileSnapshot(repoPath, file) {
    const repoRoot = path.resolve(repoPath);
    const fullPath = path.resolve(repoRoot, normalizeRepoFile(file));
    if (!sameFsPath(repoRoot, fullPath) && !isPathInside(repoRoot, fullPath)) return "outside";
    const cacheKey = process.platform === "win32" ? fullPath.toLowerCase() : fullPath;
    const cached = worktreeFileSnapshotCache.get(cacheKey);
    try {
      let stat;
      let content = null;
      if (cached) {
        stat = await fs.promises.stat(fullPath, { bigint: true });
      } else {
        const handle = await fs.promises.open(fullPath, "r");
        try {
          stat = await handle.stat({ bigint: true });
          if (stat.isFile()) content = await handle.readFile();
        } finally {
          await handle.close();
        }
      }
      if (!stat.isFile()) {
        worktreeFileSnapshotCache.delete(cacheKey);
        return stat.isDirectory() ? "directory" : "other";
      }
      const fingerprint = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
      if (cached?.fingerprint === fingerprint) {
        worktreeFileSnapshotCache.delete(cacheKey);
        worktreeFileSnapshotCache.set(cacheKey, cached);
        return cached.snapshot;
      }
      const hash = crypto.createHash("sha256");
      hash.update(content ?? await fs.promises.readFile(fullPath));
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

  async function mapWithConcurrency(items, limit, mapper) {
    if (!items.length) return [];
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
    return results;
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

  async function readWorktree(options = {}) {
    const includeStashes = Boolean(options.includeStashes);
    const rawExpectedSnapshot = String(options.expectedSnapshot || "").trim().toLowerCase();
    const expectedSnapshot = /^[a-f0-9]{64}$/.test(rawExpectedSnapshot) ? rawExpectedSnapshot : "";
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
      git(repoPath, ["status", "--short", "-z", "--untracked-files=all"], {
        stdoutOnly: true,
        env: { GIT_OPTIONAL_LOCKS: "0" },
      }).catch(() => ""),
      includeStashes ? git(repoPath, ["stash", "list", "--format=%gd%x00%H%x00%gs%x00%cr"]).catch(() => "") : "",
    ]);
    const working = await readCachedWorkingStatus(repoPath, statusOutput, { forceScan: includeStashes });
    const operation = detectRepoOperation(repoPath);
    if (!includeStashes && expectedSnapshot && working.snapshot === expectedSnapshot) {
      return {
        unchanged: true,
        worktreeSnapshot: working.snapshot,
        operation,
      };
    }
    return {
      workingFiles: working.files,
      worktreeSnapshot: working.snapshot,
      operation,
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
    const statusOutput = await git(repoPath, ["status", "--short", "-z", "--untracked-files=all"], { stdoutOnly: true }).catch(() => "");
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



  return {

    setCurrentRepo,

    commandResult,

    commandResultWithSummary,

    decodeUtf8Strict,

    normalizeDiffScope,

    normalizeRepoFile,

    normalizeWorktreeDiffContext,

    normalizeWorktreeDiffRequestScope,

    parseDiff,

    parseLog,

    parseNameStatus,

    parseStashList,

    parseStatus,

    readCurrentSyncDetails,

    readCurrentSyncState,

    readNewFileDiff,

    readStash,

    readStatusFileForDiff,

    readCachedWorkingStatus,

    readWorkingDiff,

    readWorkingStatus,

    readWorktree,

    readWorktreeDiffOutput,

    selectStatusFile,

    sha256Json,

    syncCommandResult,

    syncStateLine,

    worktreeActionTargetScope,

    worktreeDiffPathspecs,

  };

}



module.exports = { createRepositoryWorktreeService };
