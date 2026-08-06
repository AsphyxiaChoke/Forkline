const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile, execFileSync } = require("child_process");
const i18nCatalog = require("./public/js/i18n-catalog.js");
const { createFileEditorService } = require("./server/file-editor-service");
const { createGitOperationsService } = require("./server/git-operations-service");
const { OPERATION_OUTPUT_LIMIT, createGitRuntime } = require("./server/git-runtime");
const { createRepositoryHistoryService } = require("./server/repository-history");
const { createRepositoryService } = require("./server/repository-service");
const { createUpdateService } = require("./server/update-service");

const PORT = Number(process.env.PORT || 5177);
const PUBLIC_DIR = path.join(__dirname, "public");
const gitRuntime = createGitRuntime();
const {
  gitBin: GIT_BIN,
  git,
  gitBuffer,
  gitStandalone,
  isOperationCancelledError,
  terminateOperationProcess,
} = gitRuntime;
const RECOVERY_REF_PREFIX = "refs/forkline/recovery";
const ZERO_OID = "0000000000000000000000000000000000000000";
const WORKTREE_DIFF_CONTEXT = "8";
const FILE_EDITOR_DIFF_CONTEXT = 0;
const UNTRACKED_DIFF_HUNK_SIZE = 40;
const DEFAULT_HISTORY_LIMIT = 120;
const MAX_HISTORY_LIMIT = 5000;
const WORKTREE_SNAPSHOT_CACHE_LIMIT = 2048;
const BRANCH_STALE_DAYS = 30;
const PROTECTED_BRANCH_NAMES = new Set(["main", "master", "develop", "development", "dev", "trunk"]);
const GIT_LOG_FIELD_SEPARATOR = "\0";
const BASIC_COMMIT_LOG_FORMAT = "%H%x00%h%x00%an%x00%ar%x00%s%x00%P";
const REF_COMMIT_LOG_FORMAT = "%H%x00%h%x00%an%x00%ar%x00%s%x00%D%x00%P";
const AUTH_DIAGNOSTICS_CACHE_TTL_MS = 60 * 1000;
const AUTH_DIAGNOSTICS_CACHE_LIMIT = 12;
const CANCELLABLE_ACTIONS = new Set([
  "cloneRepository",
  "fetch",
  "fetchRemote",
  "pull",
  "pullRebase",
  "push",
  "forcePushLease",
  "initSubmodules",
  "updateSubmodules",
]);
let currentRepo = null;
let repoSwitchInProgress = false;
let gitOperationsService = null;
const activeOperations = new Map();
const operationLog = [];
const authDiagnosticsCache = new Map();
const worktreeFileSnapshotCache = new Map();
const REPO_SWITCHING_ACTIONS = new Set(["openWorktree", "cloneRepository", "initRepository"]);
const REMOTE_CONFIG_SNAPSHOT_ACTIONS = new Set(["fetchRemote", "setRemoteUrl", "deleteRemote"]);
const TAG_REMOTE_SNAPSHOT_ACTIONS = new Set(["pushTag", "deleteRemoteTag"]);
const REMOTE_BRANCH_REMOTE_SNAPSHOT_ACTIONS = new Set([
  "deleteRemoteBranch",
  "setUpstream",
  "checkoutRemoteBranch",
  "mergeRef",
  "rebaseOntoRef",
  "createBranch",
  "createWorktree",
]);
const TARGET_REF_SNAPSHOT_ACTIONS = new Set([
  "checkoutBranch",
  "checkoutRemoteBranch",
  "setUpstream",
  "mergeRef",
  "rebaseOntoRef",
  "createBranch",
  "createWorktree",
]);
const FILE_SNAPSHOT_ACTIONS = new Set([
  "stageFile",
  "unstageFile",
  "resolveConflictFile",
  "stageHunk",
  "stageSelectedLines",
  "unstageSelectedLines",
  "unstageHunk",
  "discardWorktreeHunk",
  "discardWorktreeFile",
  "discardStagedFile",
]);
const WORKTREE_SNAPSHOT_ACTIONS = new Set([
  "pull",
  "pullRebase",
  "stageAll",
  "discardAll",
  "checkoutBranch",
  "checkoutRemoteBranch",
  "mergeRef",
  "commit",
  "amendCommit",
  "cherryPickCommit",
  "revertCommit",
  "createStash",
  "applyStash",
  "popStash",
  "restoreCheckoutStash",
  "branchFromStash",
  "resetToCommit",
  "applyPatch",
  "ignoreWorktreePath",
  "initSubmodules",
  "updateSubmodules",
  "syncSubmodules",
  "continueRevert",
  "abortRevert",
  "continueCherryPick",
  "skipCherryPick",
  "abortCherryPick",
  "continueMerge",
  "abortMerge",
  "continueRebase",
  "skipRebase",
  "abortRebase",
]);
const OPERATION_SNAPSHOT_ACTIONS = new Set([
  "continueRevert",
  "abortRevert",
  "continueCherryPick",
  "skipCherryPick",
  "abortCherryPick",
  "continueMerge",
  "abortMerge",
  "continueRebase",
  "skipRebase",
  "abortRebase",
]);
const WORKTREE_PRUNE_SNAPSHOT_ACTIONS = new Set(["pruneAllWorktrees", "pruneWorktrees"]);
const ALL_REMOTE_CONFIG_SNAPSHOT_ACTIONS = new Set(["fetch"]);
const UPSTREAM_SNAPSHOT_ACTIONS = new Set(["pull", "pullRebase", "push", "forcePushLease", "unsetUpstream"]);
const CURRENT_BRANCH_SNAPSHOT_ACTIONS = new Set([
  "pull",
  "pullRebase",
  "push",
  "forcePushLease",
  "setUpstream",
  "unsetUpstream",
  "checkoutBranch",
  "checkoutRemoteBranch",
  "createBranch",
  "renameBranch",
  "createWorktree",
  "initSubmodules",
  "updateSubmodules",
  "syncSubmodules",
  "stageAll",
  "discardAll",
  "commit",
  "amendCommit",
  "mergeRef",
  "rebaseOntoRef",
  "rewordCommit",
  "rewriteHistoryCommit",
  "rewriteHistoryQueue",
  "cherryPickCommit",
  "revertCommit",
  "resetToCommit",
  "restoreRecoveryPoint",
  "createRecoveryPointFromReflog",
  "restoreReflogEntry",
  "applyPatch",
  "restoreCheckoutStash",
  "createStash",
  "applyStash",
  "popStash",
  "dropStash",
  "branchFromStash",
  "stageFile",
  "ignoreWorktreePath",
  "unstageFile",
  "resolveConflictFile",
  "stageHunk",
  "stageSelectedLines",
  "unstageSelectedLines",
  "unstageHunk",
  "discardWorktreeHunk",
  "discardWorktreeFile",
  "discardStagedFile",
  "continueRevert",
  "abortRevert",
  "continueCherryPick",
  "skipCherryPick",
  "abortCherryPick",
  "continueMerge",
  "abortMerge",
  "continueRebase",
  "skipRebase",
  "abortRebase",
]);

const laneColors = ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"];

const repositoryService = createRepositoryService({
  git,
  gitStandalone,
  getCurrentRepo: () => currentRepo,
  setManagedRepo: (repoPath) => {
    currentRepo = repoPath;
    gitOperationsService?.setCurrentRepo(repoPath);
  },
  operationLog,
  listRunningOperations: (...args) => gitOperationsService ? gitOperationsService.listRunningOperations(...args) : [],
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
});
const {
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
  normalizeSha,
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
  extractRemoteHost,
  formatLocalTime,
  resolveGitDirSync,
  detectRepoOperation,
  gitOperationSnapshot,
  operationSnapshotPaths,
  sequencerSnapshotPaths,
  directorySnapshotPaths,
  operationSnapshotEntry,
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
} = repositoryService;

const fileEditorService = createFileEditorService({
  git,
  gitBuffer,
  getCurrentRepo: () => currentRepo,
  readStatusFileForDiff,
  readWorktreeDiffOutput,
  readNewFileDiff: repositoryService.readNewFileDiff,
  parseDiff: repositoryService.parseDiff,
  normalizeRepoFile,
  normalizeSha,
  isPathInside: repositoryService.isPathInside,
  decodeUtf8Strict: repositoryService.decodeUtf8Strict,
});
const {
  readEditableCommitFile,
  readEditableWorktreeFile,
  saveEditableWorktreeFile,
} = fileEditorService;

const repositoryHistoryService = createRepositoryHistoryService({
  git,
  getCurrentRepo: () => currentRepo,
  sampleState: repositoryService.sampleState,
  normalizeRepoFile,
  normalizeSha,
  normalizeRefName,
  ensureLiveRemoteBranchRef,
  readBranchDisplayName,
  hasHeadCommit,
  parseStatus: repositoryService.parseStatus,
  selectStatusFile: repositoryService.selectStatusFile,
  parseNameStatus: repositoryService.parseNameStatus,
  parseDiff: repositoryService.parseDiff,
  formatLocalTime,
});

gitOperationsService = createGitOperationsService({
  git,
  gitStandalone,
  getCurrentRepo: () => currentRepo,
  getRepoSwitchInProgress: () => repoSwitchInProgress,
  activeOperations,
  operationLog,
  repositoryService,
  repositoryHistoryService,
  terminateOperationProcess,
  friendlyErrorMessage: (...args) => friendlyErrorMessage(...args),
  formatDuration,
  shortText,
  cancellableActions: CANCELLABLE_ACTIONS,
  repoSwitchingActions: REPO_SWITCHING_ACTIONS,
  remoteConfigSnapshotActions: REMOTE_CONFIG_SNAPSHOT_ACTIONS,
  tagRemoteSnapshotActions: TAG_REMOTE_SNAPSHOT_ACTIONS,
  remoteBranchSnapshotActions: REMOTE_BRANCH_REMOTE_SNAPSHOT_ACTIONS,
  targetRefSnapshotActions: TARGET_REF_SNAPSHOT_ACTIONS,
  fileSnapshotActions: FILE_SNAPSHOT_ACTIONS,
  worktreeSnapshotActions: WORKTREE_SNAPSHOT_ACTIONS,
  operationSnapshotActions: OPERATION_SNAPSHOT_ACTIONS,
  worktreePruneSnapshotActions: WORKTREE_PRUNE_SNAPSHOT_ACTIONS,
  allRemoteConfigSnapshotActions: ALL_REMOTE_CONFIG_SNAPSHOT_ACTIONS,
  upstreamSnapshotActions: UPSTREAM_SNAPSHOT_ACTIONS,
  currentBranchSnapshotActions: CURRENT_BRANCH_SNAPSHOT_ACTIONS,
  operationOutputLimit: OPERATION_OUTPUT_LIMIT,
  protectedBranchNames: PROTECTED_BRANCH_NAMES,
  recoveryRefPrefix: RECOVERY_REF_PREFIX,
  zeroOid: ZERO_OID,
  fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,
  basicCommitLogFormat: BASIC_COMMIT_LOG_FORMAT,
  gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,
});
const {
  readHistoryRewritePreview,
  readHistoryRewriteQueuePreview,
  runAction,
  actionChangesRepo,
  ensureCanSwitchRepo,
  ensureCanStartAction,
  beginOperation,
  recordOperation,
  actionOutputSummary,
  listRunningOperations,
  cancelActiveOperation,
  actionLabel,
} = gitOperationsService;

function scheduleSelfUpdateShutdown() {
  setTimeout(() => {
    const forceExit = setTimeout(() => process.exit(0), 2000);
    server.close(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
    server.closeIdleConnections?.();
  }, 250);
}

async function readJson(req) {
  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new Error("请求内容类型不合法。Forkline 只接受 application/json 的本地页面请求。");
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  const body = JSON.stringify(localizeResponseData(data, res.forklineLocale));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function requestLocale(req) {
  return i18nCatalog.normalizeLocale(req.headers["x-forkline-locale"]) || i18nCatalog.defaultLocale;
}

function localizeResponseData(value, locale, pathParts = []) {
  if (i18nCatalog.normalizeLocale(locale) !== "en" || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    if (pathParts.at(-1) === "steps") return value.map((item) => (typeof item === "string" ? translateServerText(locale, item) : localizeResponseData(item, locale, pathParts)));
    return value.map((item, index) => localizeResponseData(item, locale, [...pathParts, String(index)]));
  }
  if (typeof value !== "object") return value;
  const localized = {};
  Object.entries(value).forEach(([key, item]) => {
    const nextPath = [...pathParts, key];
    if (typeof item === "string" && shouldLocalizeResponseField(key, nextPath, value)) {
      localized[key] = localizeResponseString(key, item, nextPath, value, locale);
    } else {
      localized[key] = localizeResponseData(item, locale, nextPath);
    }
  });
  return localized;
}

function shouldLocalizeResponseField(key, pathParts, parent) {
  if (key === "error") return true;
  if (key === "output") return true;
  if (["time", "lastUpdated", "elapsed"].includes(key)) return true;
  if (["actionLabel", "statusLabel", "deleteBlockedReason", "protectedReason", "pruneReason", "reason", "advice", "categoryLabel", "kindLabel", "platformLabel"].includes(key)) return true;
  const pathText = pathParts.join(".");
  if (key === "name" && pathText.includes("systemCredentialManager")) return true;
  if (key === "label") return /(?:operationLog|runningOperations|\.operation\.)/.test(pathText);
  if (key === "title") return pathText.includes("pullRequest") || pathText.includes("diagnosis") || Array.isArray(parent.steps);
  if (key === "summary") return pathText.includes("operationLog") || pathText.includes("auth") || pathText.includes("diagnosis") || Array.isArray(parent.steps);
  if (key === "message") return (pathText.includes("auth") || pathText.includes("systemCredentialManager")) && !pathText.includes("operationLog");
  return false;
}

function localizeResponseString(key, value, pathParts, parent, locale) {
  const pathText = pathParts.join(".");
  if (key === "error") return translateServerError(locale, value);
  if (key === "output") return translateServerOutput(locale, value);
  if (["time", "lastUpdated", "elapsed"].includes(key)) return translateServerTime(locale, value);
  if (key === "summary" && pathText.includes("operationLog")) {
    return parent?.status === "error" ? translateServerError(locale, value) : translateServerOutput(locale, value);
  }
  if (key === "summary" && isAuthDiagnosticsSummary(parent, value)) return translateAuthDiagnosticsSummary(parent);
  if (key === "message") return i18nCatalog.translateKnown(locale, value);
  return translateServerText(locale, value);
}

function isAuthDiagnosticsSummary(parent, value) {
  return String(value || "").includes("；")
    && Array.isArray(parent?.remotes)
    && parent?.ssh
    && parent?.agent
    && parent?.credentialManager;
}

function translateAuthDiagnosticsSummary(model) {
  const remotes = model.remotes || [];
  const remoteParts = [
    countLabel(remotes.filter((remote) => remote.kind === "ssh").length, "SSH remote"),
    countLabel(remotes.filter((remote) => remote.kind === "https").length, "HTTPS remote"),
    countLabel(remotes.filter((remote) => remote.kind === "local").length, "local remote"),
  ].filter(Boolean);
  const remoteText = remoteParts.length ? remoteParts.join(", ") : "No remotes";
  const keyCount = Number(model.ssh?.keys?.length) || 0;
  const sshText = model.ssh?.exists ? countLabel(keyCount, "SSH key pair", true) : "~/.ssh not found";
  const agentCount = Number(model.agent?.keyCount) || 0;
  const agentText = model.agent?.loaded ? countLabel(agentCount, "key in the agent", true, "keys in the agent") : "No keys loaded in the agent";
  const gcmText = model.credentialManager?.available ? "GCM available" : "GCM not detected";
  return `${remoteText}; ${sshText}; ${agentText}; ${gcmText}`;
}

function countLabel(count, label, includeZero = false, plural = `${label}s`) {
  if (!count && !includeZero) return "";
  return `${count} ${count === 1 ? label : plural}`;
}

function translateServerText(locale, text) {
  return i18nCatalog.translate(locale, String(text || ""));
}

function translateServerTime(locale, text) {
  const source = String(text || "");
  if (i18nCatalog.normalizeLocale(locale) !== "en") return source;
  const relative = source.match(/^(\d+)\s*(秒|分钟|小时|天|周|个月|年)(前)?$/);
  if (relative) {
    const count = Number(relative[1]);
    const units = { 秒: "second", 分钟: "minute", 小时: "hour", 天: "day", 周: "week", 个月: "month", 年: "year" };
    const unit = units[relative[2]] || relative[2];
    const amount = `${count} ${unit}${count === 1 ? "" : "s"}`;
    return relative[3] ? `${amount} ago` : amount;
  }
  return translateServerText(locale, source);
}

function translateServerOutput(locale, text) {
  const source = String(text || "");
  const whole = i18nCatalog.translateKnown(locale, source);
  if (whole !== source) return whole;
  return source.split(/(\r?\n)/).map((line) => {
    if (/^\r?\n$/.test(line)) return line;
    const match = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const inner = match?.[2] || line;
    if (inner.startsWith("Git 输出：")) return `${match?.[1] || ""}Git output:${inner.slice("Git 输出：".length)}${match?.[3] || ""}`;
    const translated = i18nCatalog.translateKnown(locale, inner);
    return `${match?.[1] || ""}${translated}${match?.[3] || ""}`;
  }).join("");
}

function translateServerError(locale, text) {
  const source = String(text || "");
  const gitOutputMarker = source.indexOf("\n\nGit 输出：");
  const messageSource = gitOutputMarker >= 0 ? source.slice(0, gitOutputMarker) : source;
  const gitOutput = gitOutputMarker >= 0 ? source.slice(gitOutputMarker + "\n\nGit 输出：".length).trim() : "";
  const translated = i18nCatalog.translateKnown(locale, messageSource);
  if (!/[\u3400-\u9fff]/.test(translated)) {
    return [translated, gitOutput ? `Git output:\n${gitOutput}` : ""].filter(Boolean).join("\n\n");
  }
  return [
    "The operation could not be completed. Refresh the repository state and try again.",
    gitOutput ? `Git output:\n${gitOutput}` : "",
  ].filter(Boolean).join("\n\n");
}

function sendError(res, error, context = {}) {
  const extra = {};
  if (error?.remoteCheck) extra.remoteCheck = error.remoteCheck;
  sendJson(res, 400, { error: friendlyErrorMessage(error, context), ...extra, operationLog, runningOperations: listRunningOperations(context.operation?.id) });
}

function decodeRepoPathHeader(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("v1:")) return raw;
  try {
    const decoded = decodeURIComponent(raw.slice(3));
    if (/[\u0000-\u001f\u007f]/.test(decoded)) throw new Error("invalid control character");
    return decoded;
  } catch {
    throw new Error("页面仓库上下文编码无效。请刷新页面后再试。");
  }
}

function ensureRequestRepoMatchesCurrent(req, options = {}) {
  const expectedRepo = decodeRepoPathHeader(req.headers["x-forkline-repo-path"]);
  if (!expectedRepo) {
    if (options.requireRepo && currentRepo) {
      throw new Error("页面缺少仓库上下文。为避免把操作执行到错误仓库，请刷新页面后再试。");
    }
    return;
  }
  if (currentRepo && sameFsPath(expectedRepo, currentRepo)) return;
  throw new Error(`页面仓库已经切换。请求来自 ${expectedRepo}，但当前服务端仓库是 ${currentRepo || "未打开仓库"}。为避免误操作，请刷新或重新打开目标仓库后再执行。`);
}

function friendlyErrorMessage(error, context = {}) {
  const raw = String(error?.message || error || "").trim();
  const text = raw || "操作失败";
  const lower = text.toLowerCase();
  const operationKind = actionOperationKind(context.body?.action);
  if (lower.includes("no cherry-pick or revert in progress")) {
    return operationKind === "cherryPick" ? "当前没有正在进行的挑选，工作区已经干净。" : "当前没有正在进行的还原，工作区已经干净。";
  }
  if (lower.includes("no merge in progress") || lower.includes("merge_head missing")) {
    return "当前没有正在进行的合并，工作区已经干净。";
  }
  if (lower.includes("nothing to commit") && lower.includes("working tree clean")) {
    return operationKind === "cherryPick" ? "没有需要继续提交的挑选内容，工作区已经干净。" : "没有需要继续提交的还原内容，工作区已经干净。";
  }
  if (lower.includes("previous cherry-pick is now empty") || lower.includes("the previous cherry-pick is now empty")) {
    return "这次挑选解决冲突后没有留下新的改动。可以跳过挑选，或中止这次挑选。";
  }
  if (lower.includes("cannot 'squash' without a previous commit") || lower.includes("cannot 'fixup' without a previous commit")) {
    return "这个提交前面没有可合并的提交，不能执行压缩或修补。";
  }
  if (lower.includes("index.lock") && (lower.includes("unable to create") || lower.includes("file exists"))) {
    return indexLockMessage(text, context);
  }
  if (lower.includes("patch failed") || lower.includes("does not apply") || lower.includes("corrupt patch") || lower.includes("error: patch")) {
    return `补丁无法应用。常见原因是当前分支内容和补丁生成时不一致、补丁已经应用过，或补丁内容不完整。\n\nGit 输出：${shortText(text, 1200)}`;
  }
  if (lower.includes("duplicate entries") && lower.includes("failed to unpack trees")) {
    const file = text.match(/duplicate entries:\s*(.+)/i)?.[1]?.split(/\r?\n/)[0]?.trim() || "";
    const target = file ? `路径 ${file} ` : "这条储藏 ";
    return `${target}在储藏中同时存在工作区记录和未跟踪记录，Git 无法正常展开。通常是旧版本或手动执行 git stash -u 时，遇到了“已暂存删除/重命名旧路径 + 未跟踪重建”的同名文件。请先确认这条储藏是否还需要；如果不需要，可以删除该储藏。`;
  }
  if (isMissingStashReferenceError(lower)) {
    return "这条储藏已经不存在，可能已被弹出、删除，或储藏列表还没有刷新。请刷新储藏列表后重新选择。";
  }
  if (lower.includes("your local changes") && lower.includes("would be overwritten")) {
    if (isStashApplyAction(context.body?.action)) {
      return "应用储藏会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些本地修改后再恢复这条储藏；原储藏仍保留在列表中。";
    }
    if (operationKind === "revert") {
      return "还原提交会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些修改后再还原。";
    }
    if (operationKind === "cherryPick") {
      return "挑选提交会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些修改后再挑选。";
    }
    return "这个操作会覆盖本地修改。请先提交或储藏后再试；如果是切换分支，也可以使用“储藏并签出/强制签出”。";
  }
  if (lower.includes("is already checked out at")) {
    return "这个分支已经在另一个工作树中签出。请换一个起点或填写新的分支名来创建工作树。";
  }
  if (lower.includes("pathspec") && lower.includes("did not match any files")) {
    const file = text.match(/pathspec ['"]([^'"]+)['"] did not match any files/i)?.[1] || "";
    return file ? `找不到文件 ${file}，这个文件可能已经被删除、重命名，或不在当前工作区中。` : "找不到要操作的文件。请刷新工作区后再试。";
  }
  if (lower.includes("fatal: no such path") && lower.includes(" in ")) {
    const match = text.match(/fatal: no such path ['"]?(.+?)['"]? in (.+)$/i);
    const file = match?.[1] || "";
    const ref = match?.[2] || "";
    return file ? `文件 ${file} 在 ${ref || "当前引用"} 中不存在。它可能已经被删除、重命名，或还没有提交到这个分支。` : "这个文件在当前引用中不存在，可能已经被删除或重命名。";
  }
  if (lower.includes("please commit your changes or stash them")) {
    return "当前有未提交修改。请先提交或储藏后再试。";
  }
  if (String(context.body?.action || "") === "pushTag" && lower.includes("tag") && lower.includes("already exists")) {
    const remote = context.body?.remote ? `远端 ${context.body.remote} ` : "远端 ";
    const name = context.body?.name ? ` ${context.body.name}` : "";
    return `${remote}已经存在 Tag${name}，Git 已拒绝覆盖。请确认远端 Tag 是否要保留；如需改写，请先删除远端 Tag 后再推送，或换一个新的 Tag 名。`;
  }
  if (lower.includes("remote") && lower.includes("already exists")) {
    return "这个远端名已经存在。请换一个名称，或在同步页修改已有远端的 URL。";
  }
  const remoteMessage = remoteFailureMessage(text, context);
  if (remoteMessage) return remoteMessage;
  if (lower.includes("no such remote") || lower.includes("does not appear to be a git repository")) {
    return "远端不可用。请检查远端名称和 URL 是否正确，或先确认网络/本地路径可访问。";
  }
  if (lower.includes(" is unmerged")) {
    const file = text.match(/path ['"]([^'"]+)['"] is unmerged/i)?.[1] || "";
    const target = file ? `文件 ${file} ` : "";
    if (operationKind === "cherryPick") {
      return `${target}还有未解决的冲突。请先在工作区解决冲突并暂存，再点“继续挑选”；如果不想保留这次挑选，点“中止挑选”。`;
    }
    if (operationKind === "merge") {
      return `${target}还有未解决的冲突。请先在工作区解决冲突并暂存，再点“继续合并”；如果不想保留这次合并，点“中止合并”。`;
    }
    if (operationKind === "rebase") {
      return `${target}还有未解决的冲突。请先在工作区解决冲突并暂存，再点“继续变基”；如果不想保留这次变基，点“中止变基”。`;
    }
    return `${target}还有未解决的冲突。请先在工作区解决冲突并暂存，再点“继续还原”；如果不想保留这次还原，点“中止还原”。`;
  }
  if (lower.includes("no rebase in progress")) {
    return "当前没有正在进行的变基，工作区已经干净。";
  }
  if ((operationKind === "rebase" || lower.includes("rebase")) && (lower.includes("conflict") || lower.includes("could not apply") || lower.includes("resolve all conflicts"))) {
    return "变基时发生冲突。请在工作区查看冲突文件，手动解决并暂存后继续变基；不想继续时可以中止变基。";
  }
  if (lower.includes("cherry-pick") && (lower.includes("automatic merge failed") || lower.includes("conflict"))) {
    return "挑选提交时发生冲突。请在工作区查看冲突文件，手动解决并暂存后继续挑选；不想继续时可以中止挑选。";
  }
  if (lower.includes("revert") && (lower.includes("automatic merge failed") || lower.includes("conflict"))) {
    return "还原提交时发生冲突。请在工作区查看冲突文件，手动解决后提交；不想继续时可以执行中止还原。";
  }
  if (lower.includes("automatic merge failed") || lower.includes("merge conflict") || lower.includes("conflict (")) {
    return "合并发生冲突。请在工作区查看冲突文件，手动解决并暂存后继续合并；不想继续时可以中止合并。";
  }
  if (lower.includes("merge_head exists") || lower.includes("not concluded your merge")) {
    return "上一次合并还没有结束。请先解决冲突并提交，或中止当前合并后再继续。";
  }
  if (lower.includes("unmerged files") || lower.includes("needs merge")) {
    return operationKind === "rebase"
      ? "当前还有未解决的变基冲突文件。请先处理并暂存这些文件后再继续变基。"
      : "当前还有未解决的合并冲突文件。请先处理这些文件后再继续操作。";
  }
  if (lower.includes("not a git repository")) {
    return "这个路径不是 Git 仓库，请打开包含 .git 的项目目录。";
  }
  if (lower.includes("already exists") && lower.includes("branch")) {
    return "分支已存在，请换一个分支名。";
  }
  if ((lower.includes("branch") && lower.includes("not found")) || lower.includes("no branch named")) {
    return "这个本地分支已经不存在，可能是分支列表还没有刷新。请刷新分支列表后重新选择。";
  }
  if (lower.includes("already exists") && lower.includes("tag")) {
    return "标签已存在，请换一个标签名。";
  }
  if (lower.includes("not fully merged")) {
    return "这个分支还没有完全合并，安全删除已被 Git 阻止。确认不需要后，再做强制删除。";
  }
  if (lower.includes("cannot delete branch") && lower.includes("checked out")) {
    return "这个分支正在其他工作树中使用，不能删除。请先切换或清理对应工作树。";
  }
  if (lower.includes("no configured push destination") || lower.includes("does not appear to be a git repository")) {
    return "当前仓库没有可用远端。请先添加远端地址后再推送或拉取。";
  }
  if (lower.includes("src refspec") && lower.includes("does not match any")) {
    return "当前分支还没有可推送的提交。请先创建首个提交后再推送。";
  }
  if (lower.includes("no commit on branch")) {
    return "当前分支还没有任何提交。请先创建首个提交后再继续这个操作。";
  }
  if (lower.includes("empty head")) {
    return "当前分支还没有任何提交，不能执行这个分支操作。请先创建首个提交后再继续。";
  }
  if (lower.includes("not a valid object name")) {
    return "当前引用不是有效提交。当前分支可能还没有首个提交，请先创建提交后再继续。";
  }
  if (lower.includes("initial commit")) {
    return "当前分支还没有首个提交，Git 不能执行这个操作。请先创建首个提交后再继续。";
  }
  if (lower.includes("ambiguous argument 'head'") && lower.includes("unknown revision")) {
    return "当前分支还没有首个提交，HEAD 暂时不是有效引用。请先创建首个提交，或选择不依赖 HEAD 的操作。";
  }
  if (lower.includes("stale info")) {
    if (context.body?.action === "deleteRemoteBranch") {
      return "远端分支删除被 Git 拒绝：确认后该分支又有了新提交。为避免删除别人刚推送的内容，本次没有删除；请抓取并刷新后重新确认。";
    }
    if (context.body?.action === "deleteRemoteTag") {
      return "远端 Tag 删除被 Git 拒绝：确认后这个 Tag 又指向了新的对象。为避免删除别人刚更新的 Tag，本次没有删除；请刷新后重新确认。";
    }
    return "安全强推被 Git 拒绝：远端分支在你上次抓取后可能已经变化。请先抓取远端，确认远端新增提交是否可以覆盖，再重新操作。";
  }
  if (context.body?.action === "forcePushLease" && lower.includes("rejected")) {
    return "安全强推被 Git 拒绝：远端分支在你上次抓取后可能已经变化。请先抓取远端，确认远端新增提交是否可以覆盖，再重新操作。";
  }
  if (lower.includes("failed to push some refs") && (lower.includes("non-fast-forward") || lower.includes("fetch first") || lower.includes("rejected"))) {
    return "推送被远端拒绝：远端可能有你本地没有的提交。请先抓取/拉取，处理差异后再推送。";
  }
  if ((lower.includes("remote ref does not exist") || lower.includes("unable to delete")) && lower.includes("remote")) {
    return "远端分支不存在或已经被删除。请先抓取远端刷新列表。";
  }
  return text;
}

function remoteFailureMessage(text, context = {}) {
  const lower = String(text || "").toLowerCase();
  const action = String(context.body?.action || "");
  const isRemoteOperation = ["fetch", "pull", "pullRebase", "push", "forcePushLease", "cloneRepository", "fetchRemote", "testRemote", "setRemoteUrl", "addRemote"].includes(action);
  const hasRemoteSignal =
    lower.includes("permission denied") ||
    lower.includes("authentication failed") ||
    lower.includes("could not read from remote repository") ||
    lower.includes("repository not found") ||
    lower.includes("could not resolve host") ||
    lower.includes("failed to connect") ||
    lower.includes("connection timed out") ||
    lower.includes("network is unreachable") ||
    lower.includes("unable to access") ||
    lower.includes("ssl certificate") ||
    lower.includes("access denied");
  if (!isRemoteOperation && !hasRemoteSignal) return "";
  const remoteName = context.body?.remote || context.body?.name;
  const remote = action === "cloneRepository" ? "克隆源" : remoteName ? `远端 ${remoteName}` : "远端";
  if (lower.includes("permission denied (publickey)") || lower.includes("publickey")) {
    return `${remote} 的 SSH 认证失败。请确认 SSH key 已添加到 Git 托管平台，并且当前终端可以执行 ssh -T 对应主机；也可以在同步页把远端 URL 改成 HTTPS。`;
  }
  if (lower.includes("authentication failed") || lower.includes("could not read username") || lower.includes("access denied")) {
    return `${remote} 的 HTTPS 认证失败。请确认用户名、Personal Access Token 或凭据管理器里的密码是否有效；GitHub 等平台通常不能再使用账号密码推送。`;
  }
  if (lower.includes("repository not found") || lower.includes("not found")) {
    return `${remote} 指向的仓库不存在，或当前账号没有访问权限。请检查远端 URL、仓库名、组织权限和私有仓库授权。`;
  }
  if (lower.includes("could not resolve host")) {
    return `${remote} 的主机名无法解析。请检查远端 URL 是否拼写正确，以及 DNS、代理或网络连接是否正常。`;
  }
  if (lower.includes("failed to connect") || lower.includes("connection timed out") || lower.includes("network is unreachable")) {
    return `${remote} 连接超时或网络不可达。请检查网络、代理、VPN、防火墙，或稍后再试。`;
  }
  if (lower.includes("ssl certificate")) {
    return `${remote} 的 HTTPS 证书校验失败。请检查系统时间、代理证书或公司网络的证书配置。`;
  }
  const localPath = extractLocalRemoteErrorPath(text);
  if (localPath) {
    return `${remote} 指向的本地路径 ${localPath} 不存在或不是 Git 仓库。请确认这个文件夹仍然存在；如果是裸仓库，路径通常以 .git 结尾。`;
  }
  if (lower.includes("could not read from remote repository")) {
    return `${remote} 无法读取。请确认远端 URL 正确、仓库存在，并且你拥有访问权限。`;
  }
  if (lower.includes("unable to access")) {
    return `${remote} 无法访问。请检查远端 URL、网络连接、代理设置和认证凭据。`;
  }
  return "";
}

function extractLocalRemoteErrorPath(text) {
  const value = String(text || "");
  const match = value.match(/fatal:\s+['"]([^'"]+)['"]\s+does not appear to be a git repository/i);
  const target = match?.[1]?.trim() || "";
  if (!target) return "";
  if (/^[A-Za-z]:[\\/]/.test(target)) return target;
  if (/^(?:\\\\|\/\/)[^\\/]/.test(target)) return target;
  if (/^(?:\.{1,2}[\\/]|[\\/])/.test(target)) return target;
  if (!target.includes("://") && !/^[^@\s]+@[^:\s]+:.+/.test(target) && (/[\\/]/.test(target) || target.endsWith(".git"))) return target;
  return "";
}

function actionOperationKind(action) {
  const value = String(action || "").toLowerCase();
  if (value.includes("cherrypick")) return "cherryPick";
  if (value.includes("rewritehistorycommit") || value.includes("rewritehistoryqueue") || value.includes("rewordcommit")) return "rebase";
  if (value.includes("revert")) return "revert";
  if (value.includes("merge")) return "merge";
  if (value.includes("rebase")) return "rebase";
  return "";
}

function isStashApplyAction(action) {
  return ["applystash", "popstash", "restorecheckoutstash"].includes(String(action || "").toLowerCase());
}

function isMissingStashReferenceError(lower) {
  return (
    lower.includes("stash@{")
    && (
      lower.includes("is not a valid reference")
      || lower.includes("not a valid stash")
      || lower.includes("not a stash-like commit")
      || lower.includes("log for refs/stash is empty")
    )
  );
}

function indexLockMessage(text, context = {}) {
  const attempted = context.operation?.label || actionLabel(context.body || {});
  const lockPath = findIndexLockPath(text);
  const lockInfo = lockPath ? describeLockFile(lockPath) : "";
  const otherOperations = describeActiveOperations(context.operation?.id);
  const gitProcesses = describeGitProcesses(currentRepo);
  const lines = [
    `Git 索引被锁住，刚才的“${attempted}”没有执行成功。`,
  ];
  if (otherOperations.length) {
    lines.push(`Forkline 还在执行：${otherOperations.join("；")}`);
  }
  if (gitProcesses.length) {
    lines.push(`系统里检测到 Git 进程：${gitProcesses.join("；")}`);
  } else {
    lines.push("系统里暂时没有检测到正在运行的 Git 进程；如果没有其它 Git/编辑器在操作仓库，这可能是上一次异常退出留下的锁。");
  }
  if (lockInfo) lines.push(lockInfo);
  lines.push("说明：index.lock 本身不会记录具体命令，所以这里只能根据刚才的 Forkline 操作、活跃进程和锁文件时间判断。确认没有 Git 操作在运行后，再删除这个 lock 文件重试。");
  return lines.join("\n");
}

function findIndexLockPath(text) {
  const fromGit = String(text || "").match(/['"]([^'"]*index\.lock)['"]/)?.[1] || "";
  if (fromGit) return path.normalize(fromGit);
  const gitDir = resolveGitDirSync(currentRepo);
  return gitDir ? path.join(gitDir, "index.lock") : "";
}

function describeLockFile(lockPath) {
  try {
    const stat = fs.statSync(lockPath);
    const time = stat.mtime || stat.birthtime;
    const age = Math.max(0, Date.now() - time.getTime());
    return `锁文件：${lockPath}\n锁文件时间：${formatLocalTime(time)}（约 ${formatDuration(age)} 前）`;
  } catch {
    return `锁文件：${lockPath}`;
  }
}

function describeActiveOperations(excludeId) {
  return listRunningOperations(excludeId)
    .slice(0, 4)
    .map((operation) => `${operation.label}，已运行 ${operation.elapsed}`);
}

function describeGitProcesses(repoPath) {
  try {
    const processes = process.platform === "win32" ? listWindowsGitProcesses(repoPath) : listPosixGitProcesses(repoPath);
    return processes.slice(0, 5).map((item) => {
      const command = item.command ? `：${shortText(item.command, 140)}` : "";
      return `PID ${item.pid} ${item.name || "git"}${command}`;
    });
  } catch {
    return [];
  }
}

function listWindowsGitProcesses(repoPath) {
  const script = `
$repo = $env:FORKLINE_REPO_PATH
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -in @('git.exe','git.cmd','git.bat') -or
    (($_.CommandLine) -and ($_.CommandLine -match '(^|[\\\\/\\s])git(\\.exe|\\.cmd|\\.bat)?(\\s|$)'))
  } |
  Where-Object {
    -not $repo -or
    ($_.Name -in @('git.exe','git.cmd','git.bat')) -or
    (($_.CommandLine) -and ($_.CommandLine.Contains($repo)))
  } |
  Select-Object -First 5 ProcessId,Name,CommandLine |
  ConvertTo-Json -Compress
`;
  const output = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    timeout: 1500,
    windowsHide: true,
    env: { ...process.env, FORKLINE_REPO_PATH: repoPath || "" },
  }).trim();
  if (!output) return [];
  const parsed = JSON.parse(output);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .filter(Boolean)
    .map((row) => ({ pid: row.ProcessId, name: row.Name, command: row.CommandLine || "" }))
    .filter((row) => row.pid);
}

function listPosixGitProcesses(repoPath) {
  const output = execFileSync("ps", ["-eo", "pid=,comm=,args="], { encoding: "utf8", timeout: 1500 }).trim();
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
      if (!match) return null;
      return { pid: match[1], name: path.basename(match[2]), command: match[3] || "" };
    })
    .filter((row) => row && /(^|[\/\s])git(\s|$)/i.test(`${row.name} ${row.command}`))
    .filter((row) => !repoPath || row.command.includes(repoPath) || /^git$/i.test(row.name))
    .slice(0, 5);
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

function shortText(value, maxLength = 120) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const publicRoot = path.resolve(PUBLIC_DIR);
  const filePath = path.resolve(publicRoot, relative);
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime(filePath), "Cache-Control": "no-store" });
    res.end(data);
  });
}

function mime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  }[ext] || "application/octet-stream";
}

const updateService = createUpdateService({
  appDir: __dirname,
  port: PORT,
  gitBin: GIT_BIN,
  getManagedRepo: () => currentRepo,
  hasBusyOperations: () => repoSwitchInProgress || activeOperations.size > 0,
  readJson,
  sendJson,
  scheduleShutdown: scheduleSelfUpdateShutdown,
});

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  res.forklineLocale = requestLocale(req);
  try {
    if (await updateService.handleRequest(req, res, parsed)) return;
    if (req.method === "GET" && parsed.pathname === "/api/state") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readState(parsed.searchParams.get("ref") || "", parsed.searchParams.get("limit") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/sync-state") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readSyncState());
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/auth-diagnostics") {
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo) throw new Error("请先打开一个 Git 仓库，再检测认证环境。");
      const refresh = ["1", "true"].includes(String(parsed.searchParams.get("refresh") || "").toLowerCase());
      sendJson(res, 200, await readCachedAuthDiagnostics(currentRepo, { refresh }));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/system-credentials/open") {
      await readJson(req);
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo) throw new Error("请先打开一个 Git 仓库，再管理系统凭据。");
      sendJson(res, 200, await openSystemCredentialManager());
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/reflog") {
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo) throw new Error("请先打开一个 Git 仓库，再读取引用日志。");
      sendJson(res, 200, await readReflogState(currentRepo));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/ref-state") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readRefState(parsed.searchParams.get("ref") || "", parsed.searchParams.get("limit") || ""));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/open") {
      const body = await readJson(req);
      ensureCanSwitchRepo();
      repoSwitchInProgress = true;
      try {
        sendJson(res, 200, await openRepo(body.path));
      } finally {
        repoSwitchInProgress = false;
      }
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/browse") {
      sendJson(res, 200, readDirectory(parsed.searchParams.get("path") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/commit") {
      ensureRequestRepoMatchesCurrent(req);
      const includeDiff = ["1", "true"].includes(String(parsed.searchParams.get("diff") || "").toLowerCase());
      sendJson(res, 200, await repositoryHistoryService.readCommit(parsed.searchParams.get("sha") || "", { includeDiff }));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/patch") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await repositoryHistoryService.readCommitPatch(parsed.searchParams.get("sha") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/file-history") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await repositoryHistoryService.readFileHistory(parsed.searchParams.get("file") || "", parsed.searchParams.get("ref") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/file-blame") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await repositoryHistoryService.readFileBlame(parsed.searchParams.get("file") || "", parsed.searchParams.get("ref") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/commit-file") {
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo) throw new Error("请先打开一个 Git 仓库，再查看历史文件。");
      const repoPath = currentRepo;
      sendJson(
        res,
        200,
        await readEditableCommitFile(
          parsed.searchParams.get("sha") || "",
          parsed.searchParams.get("file") || "",
          parsed.searchParams.get("previousFile") || "",
          repoPath
        )
      );
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree-file") {
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo) throw new Error("请先打开一个 Git 仓库，再编辑文件。");
      const repoPath = currentRepo;
      sendJson(
        res,
        200,
        await readEditableWorktreeFile(
          parsed.searchParams.get("file") || "",
          parsed.searchParams.get("previousFile") || "",
          repoPath
        )
      );
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/worktree-file") {
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo) throw new Error("请先打开一个 Git 仓库，再编辑文件。");
      const repoPath = currentRepo;
      const body = await readJson(req);
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      if (!currentRepo || !sameFsPath(repoPath, currentRepo)) throw new Error("仓库已经切换，请在目标仓库中重新打开文件。");
      sendJson(res, 200, saveEditableWorktreeFile(body, repoPath));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/compare") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await repositoryHistoryService.readCompare(parsed.searchParams.get("base") || "", parsed.searchParams.get("head") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/history-rewrite-preview") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readHistoryRewritePreview(parsed.searchParams.get("sha") || "", parsed.searchParams.get("mode") || ""));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/history-rewrite-queue-preview") {
      ensureRequestRepoMatchesCurrent(req);
      const body = await readJson(req);
      sendJson(res, 200, await readHistoryRewriteQueuePreview(body.items));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readWorktree({ includeStashes: parsed.searchParams.get("stashes") === "1" }));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree-diff") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readWorkingDiff(parsed.searchParams.get("file") || "", parsed.searchParams.get("scope") || "auto"));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/stash") {
      ensureRequestRepoMatchesCurrent(req);
      sendJson(res, 200, await readStash(parsed.searchParams.get("ref") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/operations") {
      sendJson(res, 200, { operationLog, runningOperations: listRunningOperations() });
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/operations/cancel") {
      const body = await readJson(req);
      const operation = await cancelActiveOperation(body.id);
      sendJson(res, 200, {
        ok: true,
        output: operation.cancelledProcessCount ? "已发送取消请求，正在终止 Git 进程。" : "已记录取消请求，正在停止操作。",
        operationLog,
        runningOperations: listRunningOperations(),
      });
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/action") {
      const body = await readJson(req);
      ensureRequestRepoMatchesCurrent(req, { requireRepo: true });
      const operation = beginOperation(body);
      try {
        ensureCanStartAction(body, operation);
        if (operation.repoSwitching) repoSwitchInProgress = true;
        const result = await runAction(body, operation);
        recordOperation(operation, body, "success", actionOutputSummary(result) || "操作已完成");
        const runningOperations = listRunningOperations(operation.id);
        sendJson(res, 200, result && typeof result === "object" ? { ...result, operationLog, runningOperations } : { ok: true, output: String(result || ""), operationLog, runningOperations });
      } catch (error) {
        if (isOperationCancelledError(error, operation)) {
          recordOperation(operation, body, "cancelled", "操作已取消");
          sendJson(res, 400, { error: "操作已取消", cancelled: true, operationLog, runningOperations: listRunningOperations(operation.id) });
        } else {
          recordOperation(operation, body, "error", friendlyErrorMessage(error, { body, operation }));
          sendError(res, error, { body, operation });
        }
      } finally {
        if (operation.repoSwitching) repoSwitchInProgress = false;
        activeOperations.delete(operation.id);
      }
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendError(res, error);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Forkline Web running at ${url}`);
  openLocalAppInBrowser(url);
});

function openLocalAppInBrowser(url) {
  if (process.platform !== "win32") return;
  if (process.env.FORKLINE_NO_OPEN === "1") return;
  execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, (error) => {
    if (error) console.warn(`Unable to open browser automatically: ${error.message}`);
  });
}
