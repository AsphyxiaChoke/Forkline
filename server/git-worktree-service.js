"use strict";



const fs = require("fs");

const path = require("path");

const { removeQuietly, writeTempFile } = require("./temp-files");

const {

  extractMovedFileUnstageHunkPatch,

  extractSelectedLinePatch,

  extractSingleHunkPatch,

  isDeletedFileDiffOutput,

  isMovedFileDiffOutput,

  isNewFileDiffOutput,

  normalizeDiffLineSelections,

} = require("./worktree-patch");



function createGitWorktreeService(options) {

  const {

    git,

    getCurrentRepo,

    repositoryService,

    friendlyErrorMessage,

    shortText,

    ensureCleanWorktree,

    fileEditorDiffContext: FILE_EDITOR_DIFF_CONTEXT,

    gitLogFieldSeparator: GIT_LOG_FIELD_SEPARATOR,

  } = options;

  const {

    commandResult,

    detectRepoOperation,

    ensureCurrentStashRef,

    enrichSubmodules,

    hasHeadCommit,

    normalizeBranchName,

    normalizeDiffScope,

    normalizeExpectedStashSha,

    normalizeRepoFile,

    normalizeStashFiles,

    normalizeStashMessage,

    normalizeWorktreeDiffContext,

    parseStatus,

    parseSubmodules,

    readBranchDisplayName,

    readNewFileDiff,

    readState,

    readWorktreeDiffOutput,

    repoHasSubmoduleConfig,

    selectStatusFile,

    submoduleConfigArgs,

    worktreeActionTargetScope,

  } = repositoryService;

  let currentRepo = getCurrentRepo();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

  }



  async function findCheckoutStash(body) {
    const branch = normalizeBranchName(body.branch);
    const stash = await findForklineStash(branch, String(body.message || "").trim());
    return { ok: true, stash };
  }

  async function restoreCheckoutStash(body) {
    const branch = normalizeBranchName(body.branch);
    const expectedSha = normalizeExpectedStashSha(body.sha);
    const currentBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (currentBranch !== branch) {
      throw new Error(`当前分支已经切换到 ${currentBranch || "HEAD"}，不能恢复属于 ${branch} 的切换储藏。请切回 ${branch} 后再恢复。`);
    }
    const stash = await findForklineStash(branch, String(body.message || "").trim(), expectedSha);
    if (!stash) throw new Error("这条切换储藏已经不存在或已经变化，请刷新储藏列表后重新选择。");
    await ensureStashHasNoGitlinkChanges(stash.ref);
    await git(currentRepo, ["stash", "pop", stash.ref], { timeout: 120000 });
    return "已恢复储藏的本地更改";
  }

  async function createStash(body) {
    const message = normalizeStashMessage(body.message);
    const files = normalizeStashFiles(body.files);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"], { stdoutOnly: true });
    if (!statusOutput.trim()) throw new Error("没有可储藏的未提交更改");
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error("当前分支还没有任何提交，不能创建储藏。请先创建首个提交，或使用“丢弃全部”清理这些未跟踪文件。");
    }
    await ensureStashSelectionHasNoSubmoduleChanges(files);
    validateStashFiles(parseStatus(statusOutput), files);
    const args = ["stash", "push", "-u", "-m", message];
    if (files.length) args.push("--", ...files);
    const output = await git(currentRepo, args, { timeout: 120000 });
    return commandResult(output || `已创建储藏：${message}`);
  }

  async function ensureStashSelectionHasNoSubmoduleChanges(files = []) {
    const [stagedOutput, worktreeOutput] = await Promise.all([
      git(currentRepo, ["diff", "--cached", "--raw", "--no-abbrev", "-z"]),
      git(currentRepo, ["diff", "--raw", "--no-abbrev", "-z"]),
    ]);
    const selected = new Set(files);
    const changes = uniqueGitlinkChanges([
      ...parseRawGitlinkChanges(stagedOutput),
      ...parseRawGitlinkChanges(worktreeOutput),
    ]).filter((item) => !selected.size || selected.has(item.path) || selected.has(item.previousPath));
    if (!changes.length) return;
    throw new Error(`储藏范围包含子模块改动：${gitlinkChangeSummary(changes)}。Git stash 不能可靠保存或恢复子模块内部内容和 gitlink，弹出时还可能删除储藏但不恢复对应修改。请先进入子模块提交、储藏或还原；如果只是父仓库的子模块指针变化，请先提交该指针或切回父仓库记录的提交。`);
  }

  async function ensureStashHasNoGitlinkChanges(ref) {
    const [worktreeOutput, indexOutput] = await Promise.all([
      git(currentRepo, ["diff", "--raw", "--no-abbrev", "-z", `${ref}^1`, ref], { timeout: 60000 }),
      git(currentRepo, ["diff", "--raw", "--no-abbrev", "-z", `${ref}^1`, `${ref}^2`], { timeout: 60000 }),
    ]);
    const changes = uniqueGitlinkChanges([
      ...parseRawGitlinkChanges(worktreeOutput),
      ...parseRawGitlinkChanges(indexOutput),
    ]);
    if (!changes.length) return;
    throw new Error(`这条储藏包含子模块指针变化：${gitlinkChangeSummary(changes)}。Git stash apply/pop 不能可靠恢复这类 gitlink，弹出时还可能删除储藏但不恢复修改。Forkline 已阻止本次操作，原储藏仍保留；请先在子模块中确认目标提交，再手动更新父仓库的子模块指针。`);
  }

  function parseRawGitlinkChanges(output) {
    const records = String(output || "").split("\0");
    const changes = [];
    for (let index = 0; index < records.length;) {
      const header = records[index++];
      const match = header.match(/^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/);
      if (!match) continue;
      const previousPath = records[index++] || "";
      const path = match[5] === "R" || match[5] === "C" ? records[index++] || previousPath : previousPath;
      if (match[1] !== "160000" && match[2] !== "160000") continue;
      changes.push({ path, previousPath });
    }
    return changes;
  }

  function uniqueGitlinkChanges(changes) {
    const unique = new Map();
    for (const item of changes) {
      const key = `${item.previousPath}\0${item.path}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()];
  }

  function gitlinkChangeSummary(changes) {
    const details = changes.slice(0, 5).map((item) => item.previousPath && item.previousPath !== item.path ? `${item.previousPath} -> ${item.path}` : item.path);
    const remaining = changes.length > details.length ? `；另有 ${changes.length - details.length} 个` : "";
    return `${details.join("；")}${remaining}`;
  }

  function validateStashFiles(statusFiles, files) {
    const duplicate = findUnsafeStashDuplicatePath(statusFiles, files);
    if (duplicate) {
      throw new Error(`当前路径 ${duplicate.path} 同时存在“已暂存删除/重命名旧路径”和“未跟踪重建”。Git stash -u 会生成无法查看或应用的储藏。请先取消暂存删除，或把重建文件改名后再储藏。`);
    }
    if (!files.length) return;
    if (!selectedStashFilesHaveChanges(statusFiles, files)) {
      throw new Error("所选文件没有可储藏的改动。请刷新工作区后重新选择有改动的文件。");
    }
    for (const file of files) {
      const moved = statusFiles.find((item) => item.previousFile && (item.file === file || item.previousFile === file));
      if (moved) {
        throw new Error(`所选文件包含已暂存重命名：${moved.previousFile} -> ${moved.file}。Git 不支持只储藏这个重命名的一部分，请改用“储藏全部”，或先取消暂存后再选择要储藏的文件。`);
      }
    }
  }

  function findUnsafeStashDuplicatePath(statusFiles, files = []) {
    const selected = new Set(files);
    const includesAny = (paths) => !selected.size || paths.some((file) => selected.has(file));
    const untracked = new Set(statusFiles.filter((item) => item.indexStatus === "?").map((item) => item.file));
    for (const item of statusFiles) {
      if (!item.staged) continue;
      const stagedRemovedPaths = [];
      if (item.indexStatus === "D") stagedRemovedPaths.push({ path: item.file, related: [item.file] });
      if (item.previousFile && item.indexStatus === "R") stagedRemovedPaths.push({ path: item.previousFile, related: [item.previousFile, item.file] });
      for (const entry of stagedRemovedPaths) {
        if (untracked.has(entry.path) && includesAny(entry.related)) return { path: entry.path };
      }
    }
    return null;
  }

  function selectedStashFilesHaveChanges(statusFiles, files) {
    const selected = new Set(files);
    return statusFiles.some((item) => {
      if (selected.has(item.file)) return true;
      return Boolean(item.previousFile && selected.has(item.previousFile));
    });
  }

  async function branchFromStash(body) {
    const ref = await ensureCurrentStashRef(body);
    const branch = normalizeBranchName(body.branch);
    await ensureStashHasNoGitlinkChanges(ref);
    await ensureCleanWorktree("从储藏创建分支前，请先提交、储藏或丢弃当前工作区改动。");
    const existing = (await git(currentRepo, ["show-ref", "--verify", `refs/heads/${branch}`]).catch(() => "")).trim();
    if (existing) throw new Error(`本地分支 ${branch} 已存在，请换一个分支名。`);
    const output = await git(currentRepo, ["stash", "branch", branch, ref], { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    const state = await readState();
    return {
      ok: true,
      branch,
      ref,
      state,
      output: [`已从 ${ref} 创建并切换到分支 ${branch}`, "储藏已应用到新分支，并从储藏列表移除。"].join("\n"),
      gitOutput: shortText(output, 2000),
    };
  }

  async function applyPatchText(body) {
    const patch = normalizePatchText(body.patch);
    const stage = Boolean(body.stage);
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再应用补丁。`);
    const filePath = writeTempFile("forkline-apply-patch-", patch, ".patch");
    const checkArgs = ["apply", "--check", "--binary"];
    const applyArgs = ["apply", "--binary"];
    if (stage) {
      checkArgs.push("--index");
      applyArgs.push("--index");
    }
    checkArgs.push(filePath);
    applyArgs.push(filePath);
    try {
      await git(currentRepo, checkArgs, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
      const output = await git(currentRepo, applyArgs, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
      return {
        ok: true,
        output: output.trim() || (stage ? "已应用补丁并暂存改动" : "已应用补丁到工作区"),
        state: await readState(),
      };
    } finally {
      removeQuietly(filePath);
    }
  }

  async function ignoreWorktreePath(body) {
    const file = normalizeRepoFile(body.file);
    const mode = normalizeIgnoreMode(body.mode);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, "untracked");
    if (!target || target.indexStatus !== "?" || target.worktreeStatus !== "?") {
      throw new Error("只能把未跟踪文件加入 .gitignore。已跟踪文件需要先从 Git 索引中移除后才能忽略。");
    }

    const patternPath = mode === "directory" ? repoDirectoryForIgnore(file) : file;
    if (!patternPath) throw new Error("根目录文件没有可忽略的所在目录，请直接忽略这个文件。");
    const pattern = gitignorePattern(patternPath, mode);
    const gitignorePath = path.join(currentRepo, ".gitignore");
    const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
    const lines = existing.replace(/\r/g, "").split("\n");
    if (lines.includes(pattern)) {
      return `这个规则已经在 .gitignore 中：${pattern}`;
    }

    const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(gitignorePath, `${prefix}${pattern}\n`, "utf8");
    return mode === "directory" ? `已加入 .gitignore：${pattern}\n该目录下的未跟踪文件会从工作区列表中隐藏。` : `已加入 .gitignore：${pattern}`;
  }

  function normalizeIgnoreMode(value) {
    const mode = String(value || "file").trim().toLowerCase();
    if (mode === "file" || mode === "directory") return mode;
    throw new Error("忽略类型不合法，请刷新后再试。");
  }

  function repoDirectoryForIgnore(file) {
    const dir = path.posix.dirname(file);
    return dir && dir !== "." ? dir : "";
  }

  function gitignorePattern(patternPath, mode) {
    const normalized = normalizeRepoFile(patternPath);
    const escaped = normalized
      .split("/")
      .map((part) => part.replace(/[\\*?\[\]#!]/g, "\\$&"))
      .join("/");
    return mode === "directory" ? `/${escaped}/` : `/${escaped}`;
  }

  async function findForklineStash(branch, message = "", expectedSha = "") {
    const output = await git(currentRepo, ["stash", "list", "--format=%gd%x00%H%x00%s"]).catch(() => "");
    const rows = output
      .split(/\r?\n/)
      .map((line) => {
        const [ref, sha, subject] = line.split(GIT_LOG_FIELD_SEPARATOR);
        return { ref: (ref || "").trim(), sha: (sha || "").trim().toLowerCase(), subject: (subject || "").trim() };
      })
      .filter((item) => item.ref && item.subject);
    const exactMatches = message ? rows.filter((item) => isForklineCheckoutStashForBranch(item.subject, branch, message)) : [];
    const branchMatches = rows.filter((item) => isForklineCheckoutStashForBranch(item.subject, branch));
    const candidates = message ? exactMatches : branchMatches;
    const match = expectedSha
      ? candidates.find((item) => item.sha.startsWith(expectedSha))
      : exactMatches[0] || branchMatches[0];
    if (!match) return null;
    const messagePart = checkoutStashMessagePart(match.subject, branch);
    return { ref: match.ref, sha: match.sha, branch, message: messagePart, label: match.subject };
  }

  function isForklineCheckoutStashForBranch(subject, branch, message = "") {
    const messagePart = checkoutStashMessagePart(subject, branch);
    if (!messagePart.startsWith("Forkline: checkout ")) return false;
    return message ? messagePart === message : true;
  }

  function checkoutStashMessagePart(subject, branch) {
    const prefix = `On ${branch}: `;
    const text = String(subject || "");
    return text.startsWith(prefix) ? text.slice(prefix.length).trim() : "";
  }

  async function discardWorktreeFile(body) {
    const file = normalizeRepoFile(body.file);
    await ensureNotSubmoduleDiscardTarget(file);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, "unstaged");
    if (!target?.unstaged) throw new Error("这个文件没有可丢弃的工作区改动");
    if (target.indexStatus === "?") {
      await git(currentRepo, ["clean", "-f", "--", file], { timeout: 60000 });
    } else {
      await git(currentRepo, ["restore", "--worktree", "--", file], { timeout: 60000 });
    }
    return "工作区改动已丢弃";
  }

  async function ensureNotSubmoduleDiscardTarget(file, message = "") {
    const [indexOutput, headOutput] = await Promise.all([
      git(currentRepo, ["ls-files", "-s", "-z", "--", file]).catch(() => ""),
      git(currentRepo, ["ls-tree", "-z", "HEAD", "--", file]).catch(() => ""),
    ]);
    if (![indexOutput, headOutput].some((output) => output.split("\0").some((record) => record.startsWith("160000 ")))) return;
    throw new Error(message || `路径 ${file} 是独立 Git 子模块，不能从父仓库丢弃它的修改。请进入该子模块提交、储藏或还原后再刷新。`);
  }

  async function unstageFile(body) {
    const file = normalizeRepoFile(body.file);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, "staged");
    if (!target?.staged) throw new Error("这个文件没有可取消暂存的改动");
    const paths = target.previousFile ? [target.previousFile, file] : [file];
    return git(currentRepo, ["reset", "-q", "--", ...paths], { timeout: 60000 });
  }

  async function discardStagedFile(body) {
    const file = normalizeRepoFile(body.file);
    await ensureNotSubmoduleDiscardTarget(file, `路径 ${file} 是独立 Git 子模块，不能从父仓库丢弃它的已暂存修改。请使用“取消暂存”仅撤销 gitlink 暂存，或进入子模块处理后再更新父仓库记录。`);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"], { stdoutOnly: true });
    const statusFiles = parseStatus(statusOutput);
    const target = selectStatusFile(statusFiles, file, "staged");
    if (!target?.staged) throw new Error("这个文件没有可丢弃的已暂存改动");
    if (target.previousFile && target.worktreeStatus) {
      await git(currentRepo, ["reset", "-q", "--", target.previousFile, file], { timeout: 60000 });
    } else if (target.previousFile) {
      await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--worktree", "--", target.previousFile, file], { timeout: 60000 });
    } else if (target.indexStatus === "A") {
      const args = target.worktreeStatus ? ["rm", "--cached", "-f", "--", file] : ["rm", "-f", "--", file];
      await git(currentRepo, args, { timeout: 60000 });
    } else if (statusFiles.some((item) => item.file === file && item.indexStatus === "?")) {
      await git(currentRepo, ["restore", "--staged", "--", file], { timeout: 60000 });
    } else if (target.worktreeStatus) {
      await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--", file], { timeout: 60000 });
    } else {
      await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--worktree", "--", file], { timeout: 60000 });
    }
    return "已暂存改动已丢弃";
  }

  async function resolveConflictFile(body) {
    const file = normalizeRepoFile(body.file);
    const side = normalizeConflictSide(body.side);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, "conflict");
    if (!target?.conflict) throw new Error("这个文件当前没有未解决冲突。");
    await git(currentRepo, ["checkout", `--${side}`, "--", file], { timeout: 60000 });
    await git(currentRepo, ["add", "--", file], { timeout: 60000 });
    return side === "ours" ? "已使用当前版本解决冲突并暂存" : "已使用对方版本解决冲突并暂存";
  }

  async function applyWorktreeHunk(body, kind) {
    const file = normalizeRepoFile(body.file);
    const hunkIndex = normalizeHunkIndex(body.hunkIndex);
    const requestedScope = String(body.scope || "unstaged").trim().toLowerCase();
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, worktreeActionTargetScope(kind, requestedScope));
    if (!target) throw new Error("这个文件当前没有可操作的改动。");
    if (target.conflict) throw new Error("冲突文件暂不支持按块操作，请先解决冲突。");
    const isUntracked = target.indexStatus === "?";
    const scope = isUntracked && requestedScope === "untracked" ? "untracked" : normalizeDiffScope(requestedScope);
    if (isUntracked && kind !== "stage") throw new Error("未跟踪文件只支持按块暂存；如果要删除内容，请在编辑器里修改文件。");
    if (kind === "stage" && scope !== "unstaged" && scope !== "untracked") throw new Error("只能暂存未暂存的改动块。");
    if (kind === "discard" && scope !== "unstaged") throw new Error("只能丢弃工作区中的未暂存改动块。");
    if (kind === "unstage" && scope !== "staged") throw new Error("只能取消暂存已暂存的改动块。");
    if ((kind === "stage" || kind === "discard") && !target.unstaged) throw new Error("这个文件没有未暂存改动块。");
    if (kind === "unstage" && !target.staged) throw new Error("这个文件没有已暂存改动块。");

    const diffOutput = isUntracked ? readNewFileDiff(file) : await readWorktreeDiffOutput(file, scope, target, currentRepo, body.diffContext);
    const diffContext = normalizeWorktreeDiffContext(body.diffContext);
    const movedFileUnstage = kind === "unstage" && isMovedFileDiffOutput(diffOutput);
    const patch = movedFileUnstage ? extractMovedFileUnstageHunkPatch(diffOutput, hunkIndex) : extractSingleHunkPatch(diffOutput, hunkIndex);
    const patchFile = writeTempFile("forkline-hunk-", patch, ".patch");
    try {
      const args = ["apply", "--whitespace=nowarn"];
      if (!isUntracked && diffContext === FILE_EDITOR_DIFF_CONTEXT) args.push("--unidiff-zero");
      if (kind === "stage") args.push("--cached");
      if (kind === "unstage") {
        args.push("--cached");
        if (!movedFileUnstage) args.push("--reverse");
      }
      if (kind === "discard") args.push("--reverse");
      args.push(patchFile);
      await git(currentRepo, args, { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
      if (kind === "discard") await refreshIndexStatForFile(file);
    } catch (error) {
      throw new Error(`改动块操作失败：${friendlyErrorMessage(error, { body: { action: `${kind}Hunk` } })}`);
    } finally {
      removeQuietly(patchFile);
    }
    if (kind === "stage") return isUntracked ? "已暂存此未跟踪文件改动块" : "已暂存此改动块";
    if (kind === "unstage") return "已取消暂存此改动块";
    return "工作区改动块已丢弃";
  }

  async function stageSelectedLines(body) {
    const file = normalizeRepoFile(body.file);
    const selectedLines = normalizeDiffLineSelections(body.lines);
    const requestedScope = String(body.scope || "unstaged").trim().toLowerCase();
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, requestedScope === "untracked" ? "untracked" : "unstaged");
    if (!target) throw new Error("这个文件当前没有可操作的改动。");
    if (target.conflict) throw new Error("冲突文件暂不支持按行暂存，请先解决冲突。");
    if (!target.unstaged) throw new Error("这个文件没有可暂存的工作区改动。");

    const isUntracked = target.indexStatus === "?";
    const scope = isUntracked && requestedScope === "untracked" ? "untracked" : normalizeDiffScope(requestedScope);
    if (scope !== "unstaged" && scope !== "untracked") throw new Error("只能暂存工作区中未暂存的行。");

    const diffOutput = isUntracked ? readNewFileDiff(file) : await readWorktreeDiffOutput(file, "unstaged");
    const patchMode = isDeletedFileDiffOutput(diffOutput) ? "stage-deleted-file" : "stage";
    const patch = extractSelectedLinePatch(diffOutput, selectedLines, patchMode);
    const patchFile = writeTempFile("forkline-lines-", patch, ".patch");
    try {
      await git(currentRepo, ["apply", "--cached", "--whitespace=nowarn", "--recount", patchFile], { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
    } catch (error) {
      throw new Error(`按行暂存失败：${friendlyErrorMessage(error, { body: { action: "stageSelectedLines" } })}`);
    } finally {
      removeQuietly(patchFile);
    }
    return `已暂存所选 ${selectedLines.length} 行`;
  }

  async function unstageSelectedLines(body) {
    const file = normalizeRepoFile(body.file);
    const selectedLines = normalizeDiffLineSelections(body.lines);
    const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file], { stdoutOnly: true });
    const target = selectStatusFile(parseStatus(statusOutput), file, "staged");
    if (!target) throw new Error("这个文件当前没有可操作的改动。");
    if (target.conflict) throw new Error("冲突文件暂不支持按行取消暂存，请先解决冲突。");
    if (!target.staged) throw new Error("这个文件没有可取消暂存的已暂存改动。");
    const scope = normalizeDiffScope(body.scope || "staged");
    if (scope !== "staged") throw new Error("只能在已暂存 Diff 中取消暂存所选行。");

    const diffOutput = await readWorktreeDiffOutput(file, "staged");
    const patchMode = isNewFileDiffOutput(diffOutput) ? "unstage-new-file" : isMovedFileDiffOutput(diffOutput) ? "unstage-moved-file" : "unstage";
    const patch = extractSelectedLinePatch(diffOutput, selectedLines, patchMode);
    const patchFile = writeTempFile("forkline-lines-", patch, ".patch");
    try {
      const args = ["apply", "--cached", "--whitespace=nowarn", "--recount"];
      if (patchMode === "unstage") args.push("--reverse");
      args.push(patchFile);
      await git(currentRepo, args, { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
    } catch (error) {
      throw new Error(`按行取消暂存失败：${friendlyErrorMessage(error, { body: { action: "unstageSelectedLines" } })}`);
    } finally {
      removeQuietly(patchFile);
    }
    return `已取消暂存所选 ${selectedLines.length} 行`;
  }

  async function refreshIndexStatForFile(file) {
    await git(currentRepo, ["update-index", "--refresh", "--", file], { timeout: 60000 }).catch(() => "");
  }

  function normalizePatchText(value) {
    const text = String(value || "").replace(/\r\n/g, "\n").trimEnd();
    if (!text.trim()) throw new Error("请粘贴补丁内容");
    if (Buffer.byteLength(text, "utf8") > 1024 * 1024 * 8) throw new Error("补丁太大，请拆分后再应用。");
    if (!text.includes("diff --git ") && !text.includes("--- ") && !text.includes("+++ ")) {
      throw new Error("补丁内容不像 git patch / diff。请确认粘贴的是完整补丁。");
    }
    return `${text}\n`;
  }

  function normalizeHunkIndex(value) {
    const index = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isInteger(index) || index < 0 || index > 200) throw new Error("改动块序号不合法，请刷新后再试。");
    return index;
  }

  function normalizeConflictSide(value) {
    const side = String(value || "").trim().toLowerCase();
    if (side === "ours" || side === "theirs") return side;
    throw new Error("请选择要保留的冲突版本。");
  }

  async function readSubmodulesForSafety() {
    if (!repoHasSubmoduleConfig(currentRepo)) return [];
    const [configOutput, statusOutput] = await Promise.all([
      git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => ""),
    ]);
    return enrichSubmodules(parseSubmodules(configOutput, statusOutput));
  }

  async function readDirtySubmoduleWorktrees() {
    const submodules = await readSubmodulesForSafety();
    return submodules.filter((item) => item.initialized && item.dirtyCount);
  }

  async function ensureNoDirtySubmodulesForDiscard(actionText = "直接丢弃父仓库全部更改") {
    const submodules = await readSubmodulesForSafety();
    const dirty = submodules.filter((item) => item.initialized && (item.dirtyCount || item.status === "changed" || item.status === "conflict"));
    if (!dirty.length) return;
    const details = dirty.slice(0, 5).map((item) => {
      const mismatch = item.status === "changed" ? "，提交与父仓库记录不一致" : item.status === "conflict" ? "，存在冲突" : "";
      return `${item.path}（${item.dirtyCount ? `${item.dirtyCount} 个未提交改动` : "独立提交状态"}${mismatch}）`;
    });
    const remaining = dirty.length > details.length ? `；另有 ${dirty.length - details.length} 个` : "";
    throw new Error(`子模块包含独立仓库改动，不能${actionText}：${details.join("；")}${remaining}。请先进入子模块提交、储藏或还原，再重新操作。`);
  }

  async function discardAllWorktreeChanges() {
    await ensureNoDirtySubmodulesForDiscard();
    if (await hasHeadCommit(currentRepo)) {
      await git(currentRepo, ["reset", "--hard", "HEAD"], { timeout: 60000 });
    } else {
      await git(currentRepo, ["rm", "-r", "--cached", "--ignore-unmatch", "--", "."], { timeout: 60000 }).catch(() => "");
    }
    await git(currentRepo, ["clean", "-fd"], { timeout: 60000 });
  }



  async function applyStash(body) {

    const ref = await ensureCurrentStashRef(body);

    await ensureStashHasNoGitlinkChanges(ref);

    return commandResult(await git(currentRepo, ["stash", "apply", ref], { timeout: 120000 }));

  }



  async function popStash(body) {

    const ref = await ensureCurrentStashRef(body);

    await ensureStashHasNoGitlinkChanges(ref);

    return commandResult(await git(currentRepo, ["stash", "pop", ref], { timeout: 120000 }));

  }



  async function dropStash(body) {

    const ref = await ensureCurrentStashRef(body);

    return commandResult(await git(currentRepo, ["stash", "drop", ref], { timeout: 120000 }));

  }



  async function stageAll() {

    return commandResult(await git(currentRepo, ["add", "-A"], { timeout: 60000 }));

  }



  async function stageFile(body) {

    const file = normalizeRepoFile(body.file);

    return commandResult(await git(currentRepo, ["add", "--", file], { timeout: 60000 }));

  }



  async function discardAll() {

    await discardAllWorktreeChanges();

    return { ok: true, output: "已丢弃全部未提交更改" };

  }



  return {

    setCurrentRepo,

    applyPatchText,

    applyStash,

    applyWorktreeHunk,

    branchFromStash,

    createStash,

    discardAll,

    discardAllWorktreeChanges,

    discardStagedFile,

    discardWorktreeFile,

    dropStash,

    ensureNoDirtySubmodulesForDiscard,

    ensureStashSelectionHasNoSubmoduleChanges,

    findCheckoutStash,

    ignoreWorktreePath,

    popStash,

    readDirtySubmoduleWorktrees,

    resolveConflictFile,

    restoreCheckoutStash,

    stageAll,

    stageFile,

    stageSelectedLines,

    unstageFile,

    unstageSelectedLines,

    validateStashFiles,

  };

}



module.exports = { createGitWorktreeService };
