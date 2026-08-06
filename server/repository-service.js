"use strict";

const fs = require("fs");
const path = require("path");
const { createRepositoryBrowseService } = require("./repository-browse-service");
const { createRepositorySubmoduleService } = require("./repository-submodule-service");
const { createRepositoryAuthService } = require("./repository-auth-service");
const { createRepositoryWorktreeService } = require("./repository-worktree-service");
const { createRepositoryStateService } = require("./repository-state-service");

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
    browseService.setCurrentRepo(currentRepo);
    submoduleService.setCurrentRepo(currentRepo);
    authService.setCurrentRepo(currentRepo);
    worktreeService.setCurrentRepo(currentRepo);
    stateService.setCurrentRepo(currentRepo);
  }

  const browseService = createRepositoryBrowseService({ getCurrentRepo: () => currentRepo });
  const { isPathInside, readDirectory, sameFsPath } = browseService;

  const submoduleService = createRepositorySubmoduleService({
    git,
    getCurrentRepo: () => currentRepo,
    browseService,
    normalizeRepoFile: (...args) => worktreeService.normalizeRepoFile(...args),
    parseStatus: (...args) => worktreeService.parseStatus(...args),
    readWorkingStatus: (...args) => worktreeService.readWorkingStatus(...args),
    sha256Json: (...args) => worktreeService.sha256Json(...args),
  });
  const {
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
  } = submoduleService;

  const authService = createRepositoryAuthService({
    git,
    gitStandalone,
    getCurrentRepo: () => currentRepo,
    readRemoteDetails: (...args) => readRemoteDetails(...args),
    readRemoteNames: (...args) => readRemoteNames(...args),
    splitRemoteBranchRef,
    parseSimpleLines,
    extractRemoteHost: (...args) => extractRemoteHost(...args),
    formatLocalTime: (...args) => formatLocalTime(...args),
    authDiagnosticsCacheTtlMs: AUTH_DIAGNOSTICS_CACHE_TTL_MS,
    authDiagnosticsCacheLimit: AUTH_DIAGNOSTICS_CACHE_LIMIT,
    authDiagnosticsCache,
  });
  const { openSystemCredentialManager, readCachedAuthDiagnostics, readPullRequestLink } = authService;
  const worktreeService = createRepositoryWorktreeService({
    git,
    getCurrentRepo: () => currentRepo,
    browseService,
    authService,
    readBranchDisplayName: (...args) => readBranchDisplayName(...args),
    hasHeadCommit: (...args) => hasHeadCommit(...args),
    readRemoteDetails: (...args) => readRemoteDetails(...args),
    normalizeStashRef,
    sampleState: (...args) => sampleState(...args),
    detectRepoOperation: (...args) => detectRepoOperation(...args),
    worktreeDiffContext: WORKTREE_DIFF_CONTEXT,
    fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,
    worktreeSnapshotCacheLimit: WORKTREE_SNAPSHOT_CACHE_LIMIT,
    untrackedDiffHunkSize: UNTRACKED_DIFF_HUNK_SIZE,
    gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,
    refCommitLogFormat: REF_COMMIT_LOG_FORMAT,
    laneColors,
    worktreeFileSnapshotCache,
  });
  const {
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
  } = worktreeService;

  const stateService = createRepositoryStateService({
    git,
    getCurrentRepo: () => currentRepo,
    submoduleService,
    worktreeService,
    readBranchDisplayName: (...args) => readBranchDisplayName(...args),
    ensureLiveRemoteBranchRef: (...args) => ensureLiveRemoteBranchRef(...args),
    parseRemoteNames,
    parseRemoteDetails,
    isKnownRemoteBranch,
    parseBranchTracking,
    mergeBranchInfo,
    parseBranchCleanupMeta,
    parseRemoteBranchInfo,
    parseSimpleLines,
    buildBranchCleanup,
    parseTags,
    parseRecoveryPoints,
    readReflogOutput,
    parseReflogEntries,
    detectRepoOperation,
    recoveryRefPrefix: RECOVERY_REF_PREFIX,
    defaultHistoryLimit: DEFAULT_HISTORY_LIMIT,
    maxHistoryLimit: MAX_HISTORY_LIMIT,
    refCommitLogFormat: REF_COMMIT_LOG_FORMAT,
    laneColors,
    operationLog,
    listRunningOperations,
  });
  const {
    historyPage,
    logArgs,
    normalizeHistoryLimit,
    readRefState,
    readReflogState,
    readState,
    readSyncState,
    refNamesFromText,
    sampleBranchCommits,
    sampleState,
  } = stateService;

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
    readSyncState,
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
    openSystemCredentialManager,
    readCachedAuthDiagnostics,
    sampleState,
  };
}

module.exports = { createRepositoryService };
