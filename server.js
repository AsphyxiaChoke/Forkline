const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile, execFileSync } = require("child_process");

const PORT = Number(process.env.PORT || 5177);
const PUBLIC_DIR = path.join(__dirname, "public");
const GIT_BIN = findGitExecutable();

let currentRepo = null;
let nextOperationId = 1;
const activeOperations = new Map();

const laneColors = ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"];

function git(repoPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    const fullArgs = ["-C", repoPath, "-c", "core.quotepath=false", ...args];
    execFile(
      GIT_BIN,
      fullArgs,
      {
        windowsHide: true,
        timeout: options.timeout || 15000,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 8,
        encoding: "utf8",
        env: options.env ? { ...process.env, ...options.env } : process.env,
      },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n");
        if (error) {
          reject(new Error(output.trim() || error.message));
          return;
        }
        resolve(output);
      }
    );
  });
}

function findGitExecutable() {
  const configured = process.env.GIT_BIN;
  if (configured && fs.existsSync(configured)) return configured;

  const names = process.platform === "win32" ? ["git.exe", "git.cmd", "git.bat"] : ["git"];
  for (const rawDir of (process.env.PATH || "").split(path.delimiter)) {
    const dir = rawDir.replace(/^"|"$/g, "");
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Git\\cmd\\git.exe",
          "C:\\Program Files\\Git\\bin\\git.exe",
          "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
          "C:\\Program Files (x86)\\Git\\bin\\git.exe",
        ]
      : ["/usr/local/bin/git", "/usr/bin/git", "/bin/git"];

  return candidates.find((candidate) => fs.existsSync(candidate)) || "git";
}

async function openRepo(repoPath) {
  if (!repoPath || typeof repoPath !== "string") {
    throw new Error("请输入仓库路径");
  }
  const root = (await git(repoPath, ["rev-parse", "--show-toplevel"])).trim();
  currentRepo = root;
  return readState();
}

async function readState(ref = "") {
  if (!currentRepo) return sampleState();
  const [branch, branchOutput, trackingOutput, remoteOutput, tagOutput, worktreeOutput, statusOutput, stashOutput, logOutput] = await Promise.all([
    git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "detached HEAD"),
    git(currentRepo, ["branch", "--all", "--format=%(refname)"]).catch(() => ""),
    git(currentRepo, ["for-each-ref", "refs/heads", "--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)"]).catch(() => ""),
    git(currentRepo, ["remote"]).catch(() => ""),
    git(currentRepo, ["for-each-ref", "refs/tags", "--sort=-creatordate", "--format=%(refname:short)\t%(objectname:short)\t%(creatordate:relative)\t%(subject)\t%(objecttype)"]).catch(() => ""),
    git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""),
    git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => ""),
    git(currentRepo, ["stash", "list", "--format=%gd%x1f%gs%x1f%cr"]).catch(() => ""),
    git(currentRepo, logArgs(ref)),
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

  const branchInfo = mergeBranchInfo(parseBranchTracking(trackingOutput), parseWorktreeBranches(worktreeOutput, currentRepo));
  const sync = await readCurrentSyncDetails();
  return {
    repo: {
      name: path.basename(currentRepo),
      path: currentRepo,
      branch: branch.trim() || "detached HEAD",
      selectedRef: ref,
      isSample: false,
      operation: detectRepoOperation(currentRepo),
      remoteNames,
    },
    branches: branches.slice(0, 32),
    branchInfo,
    remotes: remotes.slice(0, 32),
    sync,
    workingFiles: parseStatus(statusOutput),
    stashes: parseStashList(stashOutput),
    tags: parseTags(tagOutput),
    commits: parseLog(logOutput),
  };
}

function logArgs(ref) {
  const args = [
    "log",
    "--graph",
    "--max-count=120",
    "--date=relative",
    "--pretty=format:%x1f%H%x1f%h%x1f%an%x1f%ar%x1f%s%x1f%D%x1f%P",
  ];
  if (ref) {
    args.splice(1, 0, ref);
  } else {
    args.splice(1, 0, "--branches", "--remotes");
  }
  return args;
}

async function readCommit(sha) {
  if (!currentRepo) {
    const sample = sampleState();
    const commit = sample.commits.find((item) => item.sha === sha) || sample.commits[0];
    return { files: commit.files, diff: commit.diff };
  }
  const [filesOutput, diffOutput, messageOutput] = await Promise.all([
    git(currentRepo, ["show", "--name-status", "--format=", "--find-renames", sha], { maxBuffer: 1024 * 1024 * 2 }),
    git(currentRepo, ["show", "--format=", "--unified=8", "--no-ext-diff", sha], { maxBuffer: 1024 * 1024 * 5 }),
    git(currentRepo, ["show", "-s", "--format=%B", sha], { maxBuffer: 1024 * 256 }),
  ]);
  return {
    files: parseNameStatus(filesOutput),
    diff: parseDiff(diffOutput),
    message: messageOutput.trimEnd(),
  };
}

async function readWorktree() {
  if (!currentRepo) {
    return { workingFiles: sampleState().workingFiles, operation: null };
  }
  const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
  return { workingFiles: parseStatus(statusOutput), operation: detectRepoOperation(currentRepo) };
}

async function readWorkingDiff(filePath) {
  if (!currentRepo) {
    const sample = sampleState();
    return { file: filePath || sample.workingFiles[0]?.file || "", diff: sample.commits[0]?.diff || [] };
  }
  const file = normalizeRepoFile(filePath);
  let output = await git(currentRepo, ["diff", "--no-ext-diff", "--unified=80", "--", file], { maxBuffer: 1024 * 1024 * 8 }).catch(() => "");
  if (!output) {
    output = await git(currentRepo, ["diff", "--cached", "--no-ext-diff", "--unified=80", "--", file], { maxBuffer: 1024 * 1024 * 8 }).catch(() => "");
  }
  if (!output) {
    output = readNewFileDiff(file);
  }
  return { file, diff: parseDiff(output) };
}

async function readStash(ref) {
  if (!currentRepo) {
    return { ref: "", files: [], diff: [] };
  }
  const stashRef = normalizeStashRef(ref);
  const [filesOutput, diffOutput] = await Promise.all([
    git(currentRepo, ["stash", "show", "--include-untracked", "--name-status", stashRef], { maxBuffer: 1024 * 1024 * 2 }),
    git(currentRepo, ["stash", "show", "--include-untracked", "--patch", "--no-ext-diff", "--unified=8", stashRef], { maxBuffer: 1024 * 1024 * 5 }),
  ]);
  return {
    ref: stashRef,
    files: parseNameStatus(filesOutput),
    diff: parseDiff(diffOutput),
  };
}

async function runAction(body) {
  if (!currentRepo) {
    return { ok: true, sample: true, output: "示例模式不会执行真实 Git 命令" };
  }
  const action = body.action;
  if (action === "fetch") {
    return fetchRemotes();
  }
  if (action === "pull") {
    return pullCurrentBranch();
  }
  if (action === "pullRebase") {
    return pullRebaseCurrentBranch();
  }
  if (action === "push") {
    return pushCurrentBranch();
  }
  if (action === "forcePushLease") {
    return forcePushCurrentBranchWithLease();
  }
  if (action === "fetchRemote") {
    return fetchRemote(body);
  }
  if (action === "addRemote") {
    return addRemote(body);
  }
  if (action === "setRemoteUrl") {
    return setRemoteUrl(body);
  }
  if (action === "deleteRemote") {
    return deleteRemote(body);
  }
  if (action === "setUpstream") {
    return setCurrentBranchUpstream(body);
  }
  if (action === "unsetUpstream") {
    return unsetCurrentBranchUpstream();
  }
  if (action === "stageAll") {
    return commandResult(await git(currentRepo, ["add", "-A"], { timeout: 60000 }));
  }
  if (action === "discardAll") {
    await git(currentRepo, ["reset", "--hard", "HEAD"], { timeout: 60000 });
    await git(currentRepo, ["clean", "-fd"], { timeout: 60000 });
    return { ok: true, output: "已丢弃全部未提交更改" };
  }
  if (action === "continueRevert") {
    return continueRevert();
  }
  if (action === "abortRevert") {
    return commandResult(await git(currentRepo, ["revert", "--abort"], { timeout: 120000 }) || "已中止还原，工作区已回到还原前状态");
  }
  if (action === "continueCherryPick") {
    return continueCherryPick();
  }
  if (action === "skipCherryPick") {
    return commandResult(await git(currentRepo, ["cherry-pick", "--skip"], { timeout: 120000 }) || "已跳过当前挑选提交");
  }
  if (action === "abortCherryPick") {
    return commandResult(await git(currentRepo, ["cherry-pick", "--abort"], { timeout: 120000 }) || "已中止挑选，工作区已回到挑选前状态");
  }
  if (action === "continueMerge") {
    return continueMerge();
  }
  if (action === "abortMerge") {
    return abortMerge();
  }
  if (action === "continueRebase") {
    return continueRebase();
  }
  if (action === "skipRebase") {
    return skipRebase();
  }
  if (action === "abortRebase") {
    return abortRebase();
  }
  if (action === "checkoutBranch") {
    return checkoutBranch(body);
  }
  if (action === "checkoutRemoteBranch") {
    return checkoutRemoteBranch(body);
  }
  if (action === "createBranch") {
    return createBranch(body);
  }
  if (action === "renameBranch") {
    return renameBranch(body);
  }
  if (action === "deleteBranch") {
    return deleteBranch(body);
  }
  if (action === "deleteRemoteBranch") {
    return deleteRemoteBranch(body);
  }
  if (action === "mergeRef") {
    return mergeRef(body);
  }
  if (action === "rebaseOntoRef") {
    return rebaseOntoRef(body);
  }
  if (action === "createTag") {
    return createTag(body);
  }
  if (action === "deleteTag") {
    return deleteTag(body);
  }
  if (action === "pushTag") {
    return pushTag(body);
  }
  if (action === "deleteRemoteTag") {
    return deleteRemoteTag(body);
  }
  if (action === "pruneWorktrees") {
    return pruneWorktrees(body);
  }
  if (action === "findCheckoutStash") {
    return findCheckoutStash(body);
  }
  if (action === "restoreCheckoutStash") {
    return commandResult(await restoreCheckoutStash(body));
  }
  if (action === "createStash") {
    return createStash(body);
  }
  if (action === "applyStash") {
    const ref = normalizeStashRef(body.ref);
    return commandResult(await git(currentRepo, ["stash", "apply", ref], { timeout: 120000 }));
  }
  if (action === "popStash") {
    const ref = normalizeStashRef(body.ref);
    return commandResult(await git(currentRepo, ["stash", "pop", ref], { timeout: 120000 }));
  }
  if (action === "dropStash") {
    const ref = normalizeStashRef(body.ref);
    return commandResult(await git(currentRepo, ["stash", "drop", ref], { timeout: 120000 }));
  }
  if (action === "stageFile") {
    const file = normalizeRepoFile(body.file);
    return commandResult(await git(currentRepo, ["add", "--", file], { timeout: 60000 }));
  }
  if (action === "unstageFile") {
    const file = normalizeRepoFile(body.file);
    return commandResult(await git(currentRepo, ["reset", "-q", "--", file], { timeout: 60000 }));
  }
  if (action === "discardWorktreeFile") {
    return commandResult(await discardWorktreeFile(body));
  }
  if (action === "discardStagedFile") {
    return commandResult(await discardStagedFile(body));
  }
  if (action === "commit") {
    const summary = String(body.summary || "").trim();
    const detail = String(body.body || "").trim();
    if (!summary) throw new Error("请填写提交摘要");
    const args = ["commit", "-m", summary];
    if (detail) args.push("-m", detail);
    return commandResult(await git(currentRepo, args, { timeout: 120000 }));
  }
  if (action === "amendCommit") {
    const summary = String(body.summary || "").trim();
    const detail = String(body.body || "").trim();
    const args = ["commit", "--amend"];
    if (!summary && !detail) {
      args.push("--no-edit");
    } else {
      if (!summary) throw new Error("覆盖上一次提交信息时，请填写提交摘要");
      args.push("-m", summary);
      if (detail) args.push("-m", detail);
    }
    return commandResult(await git(currentRepo, args, { timeout: 120000 }));
  }
  if (action === "rewordCommit") {
    return commandResult(await rewordCommit(body));
  }
  if (action === "rewriteHistoryCommit") {
    return rewriteHistoryCommit(body);
  }
  if (action === "cherryPickCommit") {
    return cherryPickCommit(body);
  }
  if (action === "revertCommit") {
    return revertCommit(body);
  }
  if (action === "resetToCommit") {
    return resetToCommit(body);
  }
  throw new Error("未知操作");
}

function beginOperation(body = {}) {
  const operation = {
    id: nextOperationId++,
    label: actionLabel(body),
    startedAt: Date.now(),
  };
  activeOperations.set(operation.id, operation);
  return operation;
}

function actionLabel(body = {}) {
  const action = String(body.action || "");
  const file = body.file ? shortText(body.file, 72) : "";
  const ref = body.ref ? shortText(body.ref, 72) : "";
  const branch = body.branch ? shortText(body.branch, 72) : "";
  const labels = {
    fetch: "抓取远端",
    pull: "拉取远端",
    pullRebase: "变基拉取远端",
    push: "推送到远端",
    forcePushLease: "安全强推到远端",
    fetchRemote: body.name ? `抓取远端 ${shortText(body.name, 72)}` : "抓取指定远端",
    addRemote: body.name ? `添加远端 ${shortText(body.name, 72)}` : "添加远端",
    setRemoteUrl: body.name ? `修改远端 ${shortText(body.name, 72)} URL` : "修改远端 URL",
    deleteRemote: body.name ? `删除远端 ${shortText(body.name, 72)}` : "删除远端",
    setUpstream: body.ref ? `设置 upstream ${shortText(body.ref, 72)}` : "设置 upstream",
    unsetUpstream: "取消 upstream",
    stageAll: "暂存全部更改",
    discardAll: "丢弃全部未提交更改",
    continueRevert: "继续还原",
    abortRevert: "中止还原",
    continueCherryPick: "继续挑选提交",
    skipCherryPick: "跳过挑选提交",
    abortCherryPick: "中止挑选提交",
    continueMerge: "继续合并",
    abortMerge: "中止合并",
    continueRebase: "继续变基",
    skipRebase: "跳过变基提交",
    abortRebase: "中止变基",
    createBranch: branch ? `创建分支 ${branch}` : "创建分支",
    renameBranch: branch ? `重命名分支 ${branch}` : "重命名分支",
    deleteBranch: branch ? `删除分支 ${branch}` : "删除分支",
    deleteRemoteBranch: body.ref ? `删除远端分支 ${shortText(body.ref, 72)}` : "删除远端分支",
    mergeRef: ref ? `合并分支 ${ref}` : "合并分支",
    rebaseOntoRef: ref ? `变基到 ${ref}` : "变基当前分支",
    createTag: body.name ? `创建 Tag ${shortText(body.name, 72)}` : "创建 Tag",
    deleteTag: body.name ? `删除本地 Tag ${shortText(body.name, 72)}` : "删除本地 Tag",
    pushTag: body.name ? `推送 Tag ${shortText(body.name, 72)}` : "推送 Tag",
    deleteRemoteTag: body.name ? `删除远端 Tag ${shortText(body.name, 72)}` : "删除远端 Tag",
    pruneWorktrees: branch ? `清理 ${branch} 的 worktree 记录` : "清理 worktree 记录",
    findCheckoutStash: branch ? `查找 ${branch} 的签出储藏` : "查找签出储藏",
    restoreCheckoutStash: branch ? `恢复 ${branch} 的签出储藏` : "恢复签出储藏",
    createStash: "创建储藏",
    applyStash: ref ? `应用储藏 ${ref}` : "应用储藏",
    popStash: ref ? `弹出储藏 ${ref}` : "弹出储藏",
    dropStash: ref ? `删除储藏 ${ref}` : "删除储藏",
    stageFile: file ? `暂存文件 ${file}` : "暂存文件",
    unstageFile: file ? `取消暂存文件 ${file}` : "取消暂存文件",
    discardWorktreeFile: file ? `丢弃工作区文件 ${file}` : "丢弃工作区文件",
    discardStagedFile: file ? `丢弃已暂存文件 ${file}` : "丢弃已暂存文件",
    commit: "创建提交",
    amendCommit: "追加到上一次提交",
    rewordCommit: body.sha ? `修改提交信息 ${shortText(body.sha, 12)}` : "修改历史提交信息",
    rewriteHistoryCommit: body.sha ? `${historyRewriteActionLabel(body.mode)} ${shortText(body.sha, 12)}` : "编辑历史提交",
    cherryPickCommit: body.sha ? `挑选提交 ${shortText(body.sha, 12)}` : "挑选提交",
    revertCommit: body.sha ? `还原提交 ${shortText(body.sha, 12)}` : "还原提交",
    resetToCommit: body.sha ? `${resetModeLabel(body.mode)}到 ${shortText(body.sha, 12)}` : "重置到提交",
    checkoutBranch: branch ? `切换分支 ${branch}${checkoutModeText(body.mode)}` : "切换分支",
    checkoutRemoteBranch: ref ? `签出远端分支 ${ref}${checkoutModeText(body.mode)}` : "签出远端分支",
  };
  return labels[action] || `Git 操作 ${action || "未知"}`;
}

function historyRewriteActionLabel(mode) {
  if (mode === "squash") return "压缩提交";
  if (mode === "fixup") return "修补提交";
  if (mode === "drop") return "丢弃提交";
  return "编辑提交";
}

function resetModeLabel(mode) {
  if (mode === "soft") return "软重置";
  if (mode === "hard") return "硬重置";
  return "混合重置";
}

function checkoutModeText(mode) {
  if (mode === "stash") return "（储藏并签出）";
  if (mode === "force") return "（强制签出）";
  return "";
}

async function checkoutBranch(body) {
  const branch = normalizeBranchName(body.branch);
  const mode = normalizeCheckoutMode(body.mode);
  const sourceBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  const branchOutput = await git(currentRepo, ["branch", "--format=%(refname:short)"]);
  const branches = branchOutput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (!branches.includes(branch)) throw new Error("只能切换到本地分支");
  const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
  if (worktrees[branch]) {
    const info = worktrees[branch];
    const suffix = info.prunable ? "。这个占用记录已经失效，可以清理 worktree 记录后再切换" : "";
    throw new Error(`分支 ${branch} 已在其他工作树签出：${info.worktreePath}${suffix}`);
  }
  if (mode === "stash") {
    const dirty = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
    let stash = null;
    if (dirty.trim()) {
      const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      const message = `Forkline: checkout ${branch} ${stamp}`;
      await git(currentRepo, ["stash", "push", "-u", "-m", message], { timeout: 120000 });
      stash = { branch: sourceBranch, target: branch, ref: "stash@{0}", message };
    }
    await git(currentRepo, ["switch", branch], { timeout: 60000 });
    return { ok: true, output: "已储藏本地更改并切换分支", stash };
  }
  if (mode === "force") {
    await git(currentRepo, ["reset", "--hard", "HEAD"], { timeout: 60000 });
    await git(currentRepo, ["clean", "-fd"], { timeout: 60000 });
    await git(currentRepo, ["switch", "--force", branch], { timeout: 60000 });
    return { ok: true, output: "已丢弃本地更改并强制切换分支" };
  }
  await git(currentRepo, ["switch", branch], { timeout: 60000 });
  return { ok: true, output: "已切换分支并保留本地更改" };
}

async function checkoutRemoteBranch(body) {
  const remoteRef = normalizeRefName(body.ref, "远端分支");
  const mode = normalizeCheckoutMode(body.mode);
  const sourceBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  const remoteBranches = (await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]))
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.endsWith("/HEAD"));
  if (!remoteBranches.includes(remoteRef)) throw new Error("远端分支不存在，请先抓取远端后再试");
  const localBranch = normalizeRemoteCheckoutBranch(remoteRef);
  const localBranches = (await git(currentRepo, ["branch", "--format=%(refname:short)"]))
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const localExists = localBranches.includes(localBranch);
  const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
  if (localExists && worktrees[localBranch] && localBranch !== sourceBranch) {
    const info = worktrees[localBranch];
    const suffix = info.prunable ? "。这个占用记录已经失效，可以清理 worktree 记录后再切换" : "";
    throw new Error(`分支 ${localBranch} 已在其他工作树签出：${info.worktreePath}${suffix}`);
  }

  const switchArgs = localExists ? ["switch", localBranch] : ["switch", "--track", "-c", localBranch, remoteRef];
  if (mode === "stash") {
    const dirty = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
    let stash = null;
    if (dirty.trim()) {
      const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      const message = `Forkline: checkout ${localBranch} ${stamp}`;
      await git(currentRepo, ["stash", "push", "-u", "-m", message], { timeout: 120000 });
      stash = { branch: sourceBranch, target: localBranch, ref: "stash@{0}", message };
    }
    await git(currentRepo, switchArgs, { timeout: 60000 });
    return { ok: true, branch: localBranch, remote: remoteRef, output: `已从 ${remoteRef} 签出本地分支 ${localBranch}`, stash };
  }
  if (mode === "force") {
    await git(currentRepo, ["reset", "--hard", "HEAD"], { timeout: 60000 });
    await git(currentRepo, ["clean", "-fd"], { timeout: 60000 });
    await git(currentRepo, switchArgs, { timeout: 60000 });
    return { ok: true, branch: localBranch, remote: remoteRef, output: `已强制签出本地分支 ${localBranch}` };
  }
  await git(currentRepo, switchArgs, { timeout: 60000 });
  return { ok: true, branch: localBranch, remote: remoteRef, output: `已从 ${remoteRef} 签出本地分支 ${localBranch}` };
}

async function createBranch(body) {
  const branch = normalizeBranchName(body.branch);
  const start = normalizeBranchStart(body.start);
  const checkout = Boolean(body.checkout);
  await git(currentRepo, ["check-ref-format", "--branch", branch]).catch(() => {
    throw new Error("分支名不合法");
  });
  const args = checkout ? ["switch", "-c", branch] : ["branch", branch];
  if (start) args.push(start);
  await git(currentRepo, args, { timeout: 60000 });
  return {
    ok: true,
    branch,
    checkedOut: checkout,
    output: checkout ? `已创建并切换到 ${branch}` : `已创建分支 ${branch}`,
  };
}

async function deleteBranch(body) {
  const branch = normalizeBranchName(body.branch);
  const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (branch === currentBranch) throw new Error("不能删除当前所在分支，请先切换到其他分支");
  await git(currentRepo, ["branch", "-d", branch], { timeout: 60000 });
  return { ok: true, output: `已删除本地分支 ${branch}` };
}

async function pushCurrentBranch() {
  const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (!branch || branch === "HEAD" || branch === "detached HEAD") {
    throw new Error("当前处于游离 HEAD，不能直接推送分支。请先切换或创建本地分支。");
  }
  const before = await readCurrentSyncState();
  const upstream = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "")).trim();
  let output = "";
  if (upstream) {
    ensurePushIsSafe(before);
    output = await git(currentRepo, ["push"], { timeout: 120000 });
  } else {
    const remoteNames = await readRemoteNames();
    const remote = remoteNames.includes("origin") ? "origin" : remoteNames[0];
    if (!remote) throw new Error("当前仓库没有远端。请先添加远端仓库后再推送。");
    output = await git(currentRepo, ["push", "-u", remote, branch], { timeout: 120000 });
  }
  const after = await readCurrentSyncState();
  return syncCommandResult("push", output, before, after);
}

function ensurePushIsSafe(state) {
  if (!state?.upstream) return;
  if (state.upstreamGone) {
    throw new Error(`推送被保护：当前分支的 upstream ${state.upstream} 已不存在。请先抓取远端，并重新设置 upstream；如果要重新创建远端分支，请先取消 upstream 后再推送。`);
  }
  if (state.behind > 0) {
    const diverged = state.ahead > 0;
    const stateText = diverged ? `本地领先 ${state.ahead} 个提交，同时落后 ${state.behind} 个提交` : `本地落后 ${state.behind} 个提交`;
    throw new Error(`推送被保护：当前分支 ${state.branch} ${stateText}。普通 git push 会被远端拒绝，或覆盖团队协作风险过高。请先拉取/变基并检查待拉取提交；如果这是改写历史后的预期结果，请使用“安全强推”。`);
  }
}

async function forcePushCurrentBranchWithLease() {
  const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (!branch || branch === "HEAD" || branch === "detached HEAD") {
    throw new Error("当前处于游离 HEAD，不能直接强推。请先切换或创建本地分支。");
  }
  const before = await readCurrentSyncState();
  if (!before.upstream) {
    throw new Error("当前分支没有 upstream，不能执行安全强推。请先普通推送一次建立跟踪关系。");
  }
  if (before.upstreamGone) {
    throw new Error("当前分支的 upstream 已不存在，不能执行安全强推。请先抓取远端并确认要推送到哪里。");
  }
  const remoteNames = await readRemoteNames();
  const parsed = splitRemoteBranchRef(before.upstream, remoteNames);
  const output = await git(currentRepo, ["push", "--force-with-lease", parsed.remote, `HEAD:${parsed.branch}`], { timeout: 120000 });
  const after = await readCurrentSyncState();
  return syncCommandResult("forcePush", output, before, after);
}

async function fetchRemotes() {
  const before = await readCurrentSyncState();
  const output = await git(currentRepo, ["fetch", "--all", "--prune"], { timeout: 120000 });
  const after = await readCurrentSyncState();
  return syncCommandResult("fetch", output, before, after);
}

async function fetchRemote(body) {
  const remote = await ensureRemoteName(body.name);
  const before = await readCurrentSyncState();
  const output = await git(currentRepo, ["fetch", remote, "--prune"], { timeout: 120000 });
  const after = await readCurrentSyncState();
  return syncCommandResult("fetch", output || `已抓取远端 ${remote}`, before, after);
}

async function pullCurrentBranch() {
  const before = await readCurrentSyncState();
  const output = await git(currentRepo, ["pull", "--ff-only"], { timeout: 120000 });
  const after = await readCurrentSyncState();
  return syncCommandResult("pull", output, before, after);
}

async function pullRebaseCurrentBranch() {
  await currentLocalBranch("变基拉取");
  const operation = detectRepoOperation(currentRepo);
  if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再变基拉取。`);
  await ensureCleanWorktree("当前有未提交修改。请先提交或储藏后再执行变基拉取。");
  const before = await readCurrentSyncState();
  if (!before.upstream) {
    throw new Error("当前分支没有 upstream，不能执行变基拉取。请先在同步页设置 upstream。");
  }
  if (before.upstreamGone) {
    throw new Error(`当前分支的 upstream ${before.upstream} 已不存在，不能执行变基拉取。请先抓取远端并重新设置 upstream。`);
  }
  const output = await git(currentRepo, ["pull", "--rebase"], { timeout: 120000 });
  const after = await readCurrentSyncState();
  return syncCommandResult("pullRebase", output, before, after);
}

async function addRemote(body) {
  const remote = normalizeRemoteName(body.name);
  const url = normalizeRemoteUrl(body.url);
  const remoteNames = await readRemoteNames();
  if (remoteNames.includes(remote)) throw new Error(`远端 ${remote} 已存在`);
  await git(currentRepo, ["remote", "add", remote, url], { timeout: 60000 });
  return { ok: true, output: `已添加远端 ${remote}\nURL：${url}` };
}

async function setRemoteUrl(body) {
  const remote = await ensureRemoteName(body.name);
  const url = normalizeRemoteUrl(body.url);
  await git(currentRepo, ["remote", "set-url", remote, url], { timeout: 60000 });
  return { ok: true, output: `已修改远端 ${remote} 的 URL\nURL：${url}` };
}

async function deleteRemote(body) {
  const remote = await ensureRemoteName(body.name);
  await git(currentRepo, ["remote", "remove", remote], { timeout: 60000 });
  return { ok: true, output: `已删除远端 ${remote}` };
}

async function setCurrentBranchUpstream(body) {
  const branch = await currentLocalBranch("设置 upstream");
  const upstream = await ensureRemoteBranchRef(body.ref || body.upstream);
  const before = await readCurrentSyncState();
  if (before.upstream === upstream) {
    return { ok: true, output: `当前分支 ${branch} 已经跟踪 ${upstream}` };
  }
  await git(currentRepo, ["branch", `--set-upstream-to=${upstream}`, branch], { timeout: 60000 });
  const after = await readCurrentSyncState();
  const state = syncStateLine(after);
  return { ok: true, output: [`已设置 upstream：${branch} -> ${upstream}`, state].filter(Boolean).join("\n") };
}

async function unsetCurrentBranchUpstream() {
  const branch = await currentLocalBranch("取消 upstream");
  const before = await readCurrentSyncState();
  if (!before.upstream) {
    return { ok: true, output: `当前分支 ${branch} 没有 upstream，无需取消` };
  }
  await git(currentRepo, ["branch", "--unset-upstream", branch], { timeout: 60000 });
  return { ok: true, output: `已取消 upstream：${branch}\n原 upstream：${before.upstream}` };
}

async function deleteRemoteBranch(body) {
  const remoteRef = normalizeRefName(body.ref || body.branch, "远端分支");
  if (remoteRef.endsWith("/HEAD")) throw new Error("不能删除远端 HEAD 引用");
  const remoteBranches = (await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]))
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.endsWith("/HEAD"));
  if (!remoteBranches.includes(remoteRef)) throw new Error("远端分支不存在，请先抓取远端后再试");
  const parsed = splitRemoteBranchRef(remoteRef, await readRemoteNames());
  const output = await git(currentRepo, ["push", parsed.remote, "--delete", parsed.branch], { timeout: 120000 });
  await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
  return commandResultWithSummary(`已删除远端分支 ${remoteRef}`, output);
}

async function renameBranch(body) {
  const branch = normalizeBranchName(body.branch);
  const newBranch = normalizeBranchName(body.newBranch);
  if (branch === newBranch) return { ok: true, branch, output: "分支名没有变化" };
  await git(currentRepo, ["check-ref-format", "--branch", newBranch]).catch(() => {
    throw new Error("分支名不合法");
  });
  const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  const args = branch === currentBranch ? ["branch", "-m", newBranch] : ["branch", "-m", branch, newBranch];
  await git(currentRepo, args, { timeout: 60000 });
  return { ok: true, branch: newBranch, output: `已重命名分支：${branch} -> ${newBranch}` };
}

async function mergeRef(body) {
  const ref = normalizeRefName(body.ref, "合并目标");
  const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (ref === currentBranch) throw new Error("不能把当前分支合并到自己");
  const output = await git(currentRepo, ["merge", "--no-ff", "--no-edit", ref], { timeout: 120000 });
  return commandResult(output || `已合并 ${ref}`);
}

async function rebaseOntoRef(body) {
  const ref = normalizeRefName(body.ref, "变基目标");
  const operation = detectRepoOperation(currentRepo);
  if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再变基。`);
  const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (!currentBranch || currentBranch === "HEAD" || currentBranch === "detached HEAD") {
    throw new Error("当前处于游离 HEAD，不能直接变基。请先切换到本地分支。");
  }
  if (ref === currentBranch) throw new Error("不能把当前分支变基到自己");
  const dirty = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
  if (dirty.trim()) throw new Error("当前有未提交修改。请先提交或储藏后再变基。");
  await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 });
  const output = await git(currentRepo, ["rebase", ref], { timeout: 120000 });
  const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
  return commandResultWithSummary(`已将当前分支 ${currentBranch} 变基到 ${ref}，当前 HEAD 为 ${newHead}`, output);
}

async function createTag(body) {
  const name = normalizeTagName(body.name);
  const target = normalizeSha(body.target);
  const annotated = Boolean(body.annotated);
  const message = String(body.message || "").trim() || name;
  await git(currentRepo, ["check-ref-format", `refs/tags/${name}`]).catch(() => {
    throw new Error("标签名不合法");
  });
  const args = annotated ? ["tag", "-a", name, target, "-m", message] : ["tag", name, target];
  await git(currentRepo, args, { timeout: 60000 });
  return { ok: true, tag: name, output: `已创建 Tag ${name}` };
}

async function deleteTag(body) {
  const name = normalizeTagName(body.name);
  await ensureLocalTag(name);
  const output = await git(currentRepo, ["tag", "-d", name], { timeout: 60000 });
  return commandResultWithSummary(`已删除本地 Tag ${name}`, output);
}

async function pushTag(body) {
  const name = normalizeTagName(body.name);
  await ensureLocalTag(name);
  const remote = await defaultRemoteName(body.remote);
  const output = await git(currentRepo, ["push", remote, `refs/tags/${name}:refs/tags/${name}`], { timeout: 120000 });
  return commandResultWithSummary(`已推送 Tag ${name} 到 ${remote}`, output);
}

async function deleteRemoteTag(body) {
  const name = normalizeTagName(body.name);
  const remote = await defaultRemoteName(body.remote);
  const output = await git(currentRepo, ["push", remote, `:refs/tags/${name}`], { timeout: 120000 });
  return commandResultWithSummary(`已删除远端 Tag ${name}`, output);
}

async function pruneWorktrees(body) {
  const branch = normalizeBranchName(body.branch);
  const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
  const info = worktrees[branch];
  if (!info) return { ok: true, output: "没有发现需要清理的失效 worktree 记录" };
  if (!info.prunable) {
    throw new Error(`分支 ${branch} 已在其他工作树签出：${info.worktreePath}`);
  }
  const output = await git(currentRepo, ["worktree", "prune", "--verbose"], { timeout: 60000 });
  return commandResult(output || "已清理失效 worktree 记录");
}

async function findCheckoutStash(body) {
  const branch = normalizeBranchName(body.branch);
  const stash = await findForklineStash(branch, String(body.message || "").trim());
  return { ok: true, stash };
}

async function restoreCheckoutStash(body) {
  const branch = normalizeBranchName(body.branch);
  const stash = await findForklineStash(branch, String(body.message || "").trim());
  if (!stash) throw new Error("没有找到可恢复的 Forkline 储藏");
  await git(currentRepo, ["stash", "pop", stash.ref], { timeout: 120000 });
  return "已恢复储藏的本地更改";
}

async function createStash(body) {
  const message = normalizeStashMessage(body.message);
  const files = normalizeStashFiles(body.files);
  const dirty = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
  if (!dirty.trim()) throw new Error("没有可储藏的未提交更改");
  const args = ["stash", "push", "-u", "-m", message];
  if (files.length) args.push("--", ...files);
  const output = await git(currentRepo, args, { timeout: 120000 });
  return commandResult(output || `已创建储藏：${message}`);
}

async function findForklineStash(branch, message = "") {
  const output = await git(currentRepo, ["stash", "list", "--format=%gd%x1f%s"]).catch(() => "");
  const rows = output
    .split(/\r?\n/)
    .map((line) => {
      const [ref, subject] = line.split("\x1f");
      return { ref: (ref || "").trim(), subject: (subject || "").trim() };
    })
    .filter((item) => item.ref && item.subject);
  const match = rows.find((item) => message && item.subject.includes(message))
    || rows.find((item) => item.subject.startsWith(`On ${branch}: Forkline: checkout `));
  if (!match) return null;
  const messagePart = match.subject.replace(/^On [^:]+:\s*/, "");
  return { ref: match.ref, branch, message: messagePart, label: match.subject };
}

async function discardWorktreeFile(body) {
  const file = normalizeRepoFile(body.file);
  const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
  const target = parseStatus(statusOutput).find((item) => item.file === file);
  if (!target?.unstaged) throw new Error("这个文件没有可丢弃的工作区改动");
  if (target.indexStatus === "?") {
    await git(currentRepo, ["clean", "-f", "--", file], { timeout: 60000 });
  } else {
    await git(currentRepo, ["restore", "--worktree", "--", file], { timeout: 60000 });
  }
  return "工作区改动已丢弃";
}

async function discardStagedFile(body) {
  const file = normalizeRepoFile(body.file);
  const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all", "--", file]);
  const target = parseStatus(statusOutput).find((item) => item.file === file);
  if (!target?.staged) throw new Error("这个文件没有可丢弃的已暂存改动");
  if (target.indexStatus === "A") {
    await git(currentRepo, ["rm", "-f", "--", file], { timeout: 60000 });
  } else {
    await git(currentRepo, ["restore", "--source=HEAD", "--staged", "--worktree", "--", file], { timeout: 60000 });
  }
  return "已暂存改动已丢弃";
}

async function rewordCommit(body) {
  const sha = normalizeSha(body.sha);
  const summary = String(body.summary || "").trim();
  const detail = String(body.body || "").trim();
  if (!summary) throw new Error("请填写新的提交摘要");
  const statusOutput = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
  if (statusOutput.trim()) throw new Error("修改历史提交信息前，请先提交、暂存或还原工作区改动");
  const target = (await git(currentRepo, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
  await git(currentRepo, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
    throw new Error("只能修改当前分支历史中的提交信息");
  });
  const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
  const parents = parentLine.split(/\s+/).slice(1);
  if (parents.length > 1) throw new Error("暂不支持自动修改 merge 提交信息");
  const messageFile = writeTempFile("forkline-message-", `${summary}${detail ? `\n\n${detail}` : ""}\n`);
  try {
    if ((await git(currentRepo, ["rev-parse", "HEAD"])).trim() === target) {
      await git(currentRepo, ["commit", "--amend", "-F", messageFile], { timeout: 120000 });
    } else {
      const editorFile = writeTempFile("forkline-sequence-", sequenceEditorScript(target), ".cjs");
      const messageEditorFile = writeTempFile("forkline-message-editor-", messageEditorScript(messageFile), ".cjs");
      try {
        const args = parents.length ? ["rebase", "-i", `${target}^`] : ["rebase", "-i", "--root"];
        await git(currentRepo, args, {
          timeout: 180000,
          env: {
            GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${editorFile}"`,
            GIT_EDITOR: `"${process.execPath}" "${messageEditorFile}"`,
          },
        });
      } finally {
        removeQuietly(editorFile);
        removeQuietly(messageEditorFile);
      }
    }
  } catch (error) {
    await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
    throw error;
  } finally {
    removeQuietly(messageFile);
  }
  return "提交信息已修改，历史 SHA 已重写";
}

async function rewriteHistoryCommit(body) {
  const mode = normalizeHistoryRewriteMode(body.mode);
  const target = await resolveCommit(body.sha);
  const operation = detectRepoOperation(currentRepo);
  if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);
  await ensureCleanWorktree("编辑历史提交前，请先提交、暂存或还原工作区改动");
  const currentBranch = await currentLocalBranchForRewrite();
  await ensureCommitInCurrentHistory(target);
  const parents = await commitParents(target);
  if (parents.length > 1) throw new Error("暂不支持对 merge 提交执行压缩、修补或丢弃");
  if ((mode === "squash" || mode === "fixup") && parents.length === 0) {
    throw new Error("根提交没有父提交，不能压缩或修补进父提交");
  }

  const base = mode === "drop" ? target : parents[0];
  const baseParents = base ? await commitParents(base) : [];
  const rebaseArgs = baseParents.length ? ["rebase", "-i", `${base}^`] : ["rebase", "-i", "--root"];
  await ensureLinearRewriteRange(baseParents.length ? `${base}^` : "--root", mode);

  const sequenceFile = writeTempFile("forkline-history-sequence-", sequenceEditorScript(target, mode), ".cjs");
  const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
  try {
    const output = await git(currentRepo, rebaseArgs, {
      timeout: 180000,
      env: {
        GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${sequenceFile}"`,
        GIT_EDITOR: `"${process.execPath}" "${editorFile}"`,
      },
    });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return commandResultWithSummary(`${historyRewriteResultLabel(mode)} ${target.slice(0, 7)}，当前分支 ${currentBranch} 的 HEAD 为 ${newHead}`, output);
  } catch (error) {
    if (detectRepoOperation(currentRepo)?.type !== "rebase") {
      await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
    }
    throw error;
  } finally {
    removeQuietly(sequenceFile);
    removeQuietly(editorFile);
  }
}

async function revertCommit(body) {
  const target = await resolveCommit(body.sha);
  const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
  const parents = parentLine.split(/\s+/).slice(1);
  const args = ["revert"];
  if (parents.length > 1) {
    args.push("-m", String(normalizeMainline(body.mainline, parents.length)));
  }
  args.push("--no-edit", target);
  await git(currentRepo, args, { timeout: 120000 });
  const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
  return { ok: true, output: `已还原提交 ${target.slice(0, 7)}，新建反向提交 ${newHead}` };
}

async function cherryPickCommit(body) {
  const target = await resolveCommit(body.sha);
  const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
  const parents = parentLine.split(/\s+/).slice(1);
  const args = ["cherry-pick"];
  if (parents.length > 1) {
    args.push("-m", String(normalizeMainline(body.mainline, parents.length)));
  }
  args.push(target);
  await git(currentRepo, args, { timeout: 120000 });
  const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
  return { ok: true, output: `已挑选提交 ${target.slice(0, 7)}，当前分支新建提交 ${newHead}` };
}

async function resetToCommit(body) {
  const target = await resolveCommit(body.sha);
  const mode = normalizeResetMode(body.mode);
  const args = mode === "mixed" ? ["reset", target] : ["reset", `--${mode}`, target];
  await git(currentRepo, args, { timeout: 120000 });
  return { ok: true, output: `已${resetModeLabel(mode)}到 ${target.slice(0, 7)}` };
}

async function continueRevert() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "revert") {
    return { ok: true, output: "当前没有正在进行的还原，工作区已经干净。" };
  }
  const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
  try {
    await git(currentRepo, ["revert", "--continue"], {
      timeout: 120000,
      env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
    });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已继续还原并创建反向提交 ${newHead}` };
  } finally {
    removeQuietly(editorFile);
  }
}

async function continueCherryPick() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "cherryPick") {
    return { ok: true, output: "当前没有正在进行的挑选，工作区已经干净。" };
  }
  const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
  try {
    await git(currentRepo, ["cherry-pick", "--continue"], {
      timeout: 120000,
      env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
    });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已继续挑选并创建提交 ${newHead}` };
  } finally {
    removeQuietly(editorFile);
  }
}

async function continueMerge() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "merge") {
    return { ok: true, output: "当前没有正在进行的合并，工作区已经干净。" };
  }
  const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
  try {
    await git(currentRepo, ["merge", "--continue"], {
      timeout: 120000,
      env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
    });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已继续合并并创建合并提交 ${newHead}` };
  } finally {
    removeQuietly(editorFile);
  }
}

async function abortMerge() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "merge") {
    return { ok: true, output: "当前没有正在进行的合并，工作区已经干净。" };
  }
  await git(currentRepo, ["merge", "--abort"], { timeout: 120000 });
  return { ok: true, output: "已中止合并，工作区已回到合并前状态" };
}

async function continueRebase() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "rebase") {
    return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
  }
  const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
  try {
    await git(currentRepo, ["rebase", "--continue"], {
      timeout: 120000,
      env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
    });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已继续变基，当前 HEAD 为 ${newHead}` };
  } finally {
    removeQuietly(editorFile);
  }
}

async function skipRebase() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "rebase") {
    return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
  }
  const output = await git(currentRepo, ["rebase", "--skip"], { timeout: 120000 });
  return commandResultWithSummary("已跳过当前变基提交", output);
}

async function abortRebase() {
  const operation = detectRepoOperation(currentRepo);
  if (operation?.type !== "rebase") {
    return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
  }
  await git(currentRepo, ["rebase", "--abort"], { timeout: 120000 });
  return { ok: true, output: "已中止变基，工作区已回到变基前状态" };
}

async function resolveCommit(value) {
  const sha = normalizeSha(value);
  return (await git(currentRepo, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
}

async function currentLocalBranchForRewrite() {
  const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (!branch || branch === "HEAD" || branch === "detached HEAD") {
    throw new Error("当前处于游离 HEAD，不能编辑分支历史。请先切换到本地分支。");
  }
  return branch;
}

async function ensureCleanWorktree(message) {
  const statusOutput = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
  if (statusOutput.trim()) throw new Error(message);
}

async function ensureCommitInCurrentHistory(target) {
  await git(currentRepo, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
    throw new Error("只能编辑当前分支历史中的提交");
  });
}

async function commitParents(target) {
  const line = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
  return line.split(/\s+/).slice(1);
}

async function ensureLinearRewriteRange(upstream, mode) {
  const args = upstream === "--root" ? ["rev-list", "--parents", "HEAD"] : ["rev-list", "--parents", `${upstream}..HEAD`];
  const merges = (await git(currentRepo, args))
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).filter(Boolean))
    .filter((parts) => parts.length > 2);
  if (merges.length) {
    const first = merges[0][0]?.slice(0, 7) || "";
    throw new Error(`这段历史里包含 merge 提交 ${first}。为避免破坏分支拓扑，暂不自动执行 ${historyRewriteActionLabel(mode)}。`);
  }
}

function normalizeResetMode(value) {
  const mode = String(value || "mixed").trim().toLowerCase();
  if (["soft", "mixed", "hard"].includes(mode)) return mode;
  throw new Error("Reset 类型不合法");
}

function normalizeHistoryRewriteMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (["squash", "fixup", "drop"].includes(mode)) return mode;
  throw new Error("历史编辑类型不合法");
}

function historyRewriteResultLabel(mode) {
  if (mode === "squash") return "已将提交压缩进父提交";
  if (mode === "fixup") return "已将提交修补进父提交";
  if (mode === "drop") return "已丢弃提交";
  return "已编辑提交";
}

function normalizeMainline(value, parentCount) {
  const mainline = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(mainline) || mainline < 1 || mainline > parentCount) {
    throw new Error(`请选择 merge 提交主线：1-${parentCount}`);
  }
  return mainline;
}

function normalizeSha(value) {
  const sha = String(value || "").trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error("提交 SHA 不合法");
  return sha;
}

function writeTempFile(prefix, content, extension = ".tmp") {
  const name = `${prefix}${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function sequenceEditorScript(targetSha, action = "reword") {
  return `
const fs = require("fs");
const todoPath = process.argv[2];
const target = ${JSON.stringify(targetSha)};
const action = ${JSON.stringify(action)};
const text = fs.readFileSync(todoPath, "utf8");
const lines = text.split(/\\r?\\n/).map((line) => {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("pick ")) return line;
  const hash = trimmed.split(/\\s+/)[1] || "";
  return target.startsWith(hash) ? line.replace(/^(\\s*)pick(\\s+)/, "$1" + action + "$2") : line;
});
fs.writeFileSync(todoPath, lines.join("\\n"), "utf8");
`;
}

function messageEditorScript(messageFile) {
  return `
const fs = require("fs");
fs.copyFileSync(${JSON.stringify(messageFile)}, process.argv[2]);
`;
}

function removeQuietly(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
  }
}

function normalizeRepoFile(filePath) {
  const value = String(filePath || "").replaceAll("\\", "/").trim();
  if (!value || value.includes("\0")) throw new Error("请选择要对照的文件");
  if (path.isAbsolute(value) || value.split("/").includes("..")) throw new Error("文件路径不合法");
  return value;
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

function normalizeCheckoutMode(value) {
  const mode = String(value || "keep").trim();
  if (["keep", "stash", "force"].includes(mode)) return mode;
  throw new Error("切换分支方式不合法");
}

function normalizeBranchStart(value) {
  const start = String(value || "").trim();
  if (!start) return "";
  if (/^[0-9a-f]{7,40}$/i.test(start)) return start;
  return normalizeRefName(start);
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
  const remote = normalizeRefName(value, "远端名");
  if (remote.includes("/")) throw new Error("远端名不能包含 /");
  return remote;
}

function normalizeRemoteUrl(value) {
  const url = String(value || "").trim();
  if (!url || url.includes("\0") || /[\r\n]/.test(url)) throw new Error("远端 URL 不合法");
  return url;
}

function normalizeRemoteCheckoutBranch(remoteRef) {
  const parts = String(remoteRef || "").split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("远端分支不合法");
  return normalizeBranchName(parts.slice(1).join("/"));
}

async function readRemoteNames() {
  return parseRemoteNames(await git(currentRepo, ["remote"]).catch(() => ""));
}

async function ensureRemoteName(value) {
  const remote = normalizeRemoteName(value);
  const remoteNames = await readRemoteNames();
  if (!remoteNames.includes(remote)) throw new Error(`远端 ${remote} 不存在`);
  return remote;
}

async function currentLocalBranch(actionText = "执行操作") {
  const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (!branch || branch === "HEAD" || branch === "detached HEAD") {
    throw new Error(`当前处于游离 HEAD，不能${actionText}。请先切换到本地分支。`);
  }
  return branch;
}

async function readRemoteBranchNames() {
  const remoteNames = await readRemoteNames();
  const output = await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]).catch(() => "");
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
  splitRemoteBranchRef(ref, await readRemoteNames());
  return ref;
}

async function readRemoteDetails() {
  const [names, verboseOutput] = await Promise.all([readRemoteNames(), git(currentRepo, ["remote", "-v"]).catch(() => "")]);
  return parseRemoteDetails(verboseOutput, names);
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
  const remotes = new Map(remoteNames.map((name) => [name, { name, fetchUrl: "", pushUrl: "" }]));
  for (const rawLine of String(output || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\S+)\s+(.+)\s+\((fetch|push)\)$/);
    if (!match) continue;
    const [, name, url, kind] = match;
    if (!remotes.has(name)) remotes.set(name, { name, fetchUrl: "", pushUrl: "" });
    const remote = remotes.get(name);
    if (kind === "fetch") remote.fetchUrl = url.trim();
    else remote.pushUrl = url.trim();
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

function normalizeStashMessage(value) {
  const message = String(value || "").replace(/\0/g, "").trim();
  return message || `Forkline: 手动储藏 ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
}

function normalizeStashFiles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((file) => normalizeRepoFile(file)))].slice(0, 120);
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

function parseTags(output) {
  return String(output || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 160)
    .map((line) => {
      const [name = "", object = "", time = "", subject = "", type = ""] = line.split("\t");
      return {
        name: name.trim(),
        object: object.trim(),
        time: time.trim(),
        subject: subject.trim(),
        type: type.trim() || "commit",
      };
    })
    .filter((tag) => tag.name);
}

async function ensureLocalTag(name) {
  await git(currentRepo, ["rev-parse", "-q", "--verify", `refs/tags/${name}`], { timeout: 60000 }).catch(() => {
    throw new Error(`本地 Tag ${name} 不存在`);
  });
}

function sameFsPath(left, right) {
  if (!left || !right) return false;
  const normalize = (value) => path.resolve(String(value).replaceAll("/", path.sep)).replace(/[\\/]+/g, "\\").toLowerCase();
  return normalize(left) === normalize(right);
}

function readNewFileDiff(file) {
  const repoRoot = path.resolve(currentRepo);
  const fullPath = path.resolve(repoRoot, file);
  if (!fullPath.startsWith(repoRoot + path.sep)) throw new Error("文件路径不合法");
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return "";
  const buffer = fs.readFileSync(fullPath);
  if (buffer.includes(0)) return "";
  const lines = buffer.toString("utf8").replace(/\r\n/g, "\n").split("\n").slice(0, 420);
  return [
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join("\n");
}

function commandResult(output) {
  return { ok: true, output: output || "命令已完成" };
}

function commandResultWithSummary(summary, output) {
  const detail = String(output || "").trim();
  return { ok: true, output: detail ? `${summary}\n${detail}` : summary };
}

async function readCurrentSyncState() {
  const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
  if (!branch || branch === "HEAD" || branch === "detached HEAD") {
    return { branch: "HEAD", detached: true, upstream: "", upstreamGone: false, ahead: 0, behind: 0 };
  }
  const upstream = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "")).trim();
  if (!upstream) {
    return { branch, upstream: "", upstreamGone: false, ahead: 0, behind: 0 };
  }
  const upstreamSha = (await git(currentRepo, ["rev-parse", "--verify", `${upstream}^{commit}`]).catch(() => "")).trim();
  if (!upstreamSha) {
    return { branch, upstream, upstreamGone: true, ahead: 0, behind: 0 };
  }
  const counts = (await git(currentRepo, ["rev-list", "--left-right", "--count", `${upstream}...HEAD`]).catch(() => "0\t0")).trim().split(/\s+/);
  return {
    branch,
    upstream,
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
    .slice(0, 120)
    .map((line) => {
      const indexStatus = line[0] || " ";
      const worktreeStatus = line[1] || " ";
      const status = `${indexStatus}${worktreeStatus}`.trim() || "M";
      const file = parseStatusPath(line.slice(3).trim().split(" -> ").pop());
      return statusFile(indexStatus, worktreeStatus, status, file);
    });
}

function parseStatusRecords(records) {
  const files = [];
  for (let index = 0; index < records.length && files.length < 120; index++) {
    const record = records[index];
    if (record.length < 3) continue;
    const indexStatus = record[0] || " ";
    const worktreeStatus = record[1] || " ";
    const status = `${indexStatus}${worktreeStatus}`.trim() || "M";
    const file = record.slice(3);
    files.push(statusFile(indexStatus, worktreeStatus, status, file));
    if ((indexStatus === "R" || indexStatus === "C") && records[index + 1]) index += 1;
  }
  return files;
}

function statusFile(indexStatus, worktreeStatus, status, file) {
  const conflict = indexStatus === "U" || worktreeStatus === "U" || ["AA", "AU", "UD", "DU", "UA", "UU", "DD"].includes(status);
  const staged = indexStatus !== " " && indexStatus !== "?";
  const unstaged = worktreeStatus !== " " || indexStatus === "?";
  const displayStatus = worktreeStatus !== " " ? worktreeStatus : indexStatus;
  const state = conflict ? "C" : displayStatus === "A" || displayStatus === "?" ? "A" : displayStatus === "D" ? "D" : "M";
  return {
    state,
    file,
    extra: status,
    conflict,
    staged,
    unstaged,
    indexStatus: indexStatus.trim(),
    worktreeStatus: worktreeStatus.trim(),
  };
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
    .slice(0, 80)
    .map((line) => {
      const [ref, subject = "", time = ""] = line.split("\x1f");
      const parsed = parseStashSubject(subject);
      return {
        ref,
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
    .slice(0, 160)
    .map((line) => {
      const parts = line.split("\t");
      const status = (parts[0] || "M").slice(0, 1);
      const state = status === "A" ? "A" : status === "D" ? "D" : "M";
      return { state, file: parts[parts.length - 1] || line, extra: status };
    });
}

function parseDiff(output) {
  if (!String(output || "").trim()) return [];
  return output
    .split(/\r?\n/)
    .slice(0, 320)
    .map((line) => {
      let type = "ctx";
      if (/^(diff --git|@@|\+\+\+|---)/.test(line)) type = "meta";
      else if (line.startsWith("+")) type = "add";
      else if (line.startsWith("-")) type = "del";
      return { type, text: line.slice(0, 280) };
    });
}

function parseLog(output) {
  const commits = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("\x1f")) continue;
    const marker = line.indexOf("\x1f");
    const graph = line.slice(0, marker);
    const parts = line.slice(marker + 1).split("\x1f");
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

async function readCurrentSyncDetails() {
  const [state, remotes] = await Promise.all([readCurrentSyncState(), readRemoteDetails()]);
  const details = {
    ...state,
    remotes,
    incoming: [],
    outgoing: [],
  };
  if (state.detached || !state.upstream || state.upstreamGone) return details;
  const [incomingOutput, outgoingOutput] = await Promise.all([
    state.behind ? git(currentRepo, syncLogArgs(`HEAD..${state.upstream}`)).catch(() => "") : "",
    state.ahead ? git(currentRepo, syncLogArgs(`${state.upstream}..HEAD`)).catch(() => "") : "",
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
    "--pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%s%x1f%D%x1f%P",
    range,
  ];
}

function parseSyncCommits(output) {
  return String(output || "")
    .split(/\r?\n/)
    .filter((line) => line.includes("\x1f"))
    .slice(0, 20)
    .map((line) => {
      const parts = line.split("\x1f");
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
      isSample: true,
      remoteNames: ["origin", "upstream"],
    },
    branches: ["feature/visual-history", "main", "release/2.9", "fix/diff-pane-resize", "experiment/ai-summary", "chore/design-tokens"],
    remotes: ["origin/main", "origin/feature/visual-history", "upstream/release/2.9"],
    sync: {
      branch: "feature/visual-history",
      upstream: "origin/feature/visual-history",
      upstreamGone: false,
      ahead: 2,
      behind: 1,
      remotes: [
        { name: "origin", fetchUrl: "git@github.com:example/atlas-dashboard.git", pushUrl: "git@github.com:example/atlas-dashboard.git" },
        { name: "upstream", fetchUrl: "https://github.com/example/base-dashboard.git", pushUrl: "https://github.com/example/base-dashboard.git" },
      ],
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

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, error, context = {}) {
  sendJson(res, 400, { error: friendlyErrorMessage(error, context) });
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
  if (lower.includes("your local changes") && lower.includes("would be overwritten")) {
    return "这个操作会覆盖本地修改。请先提交或储藏后再试；如果是切换分支，也可以使用“储藏并签出/强制签出”。";
  }
  if (lower.includes("please commit your changes or stash them")) {
    return "当前有未提交修改。请先提交或储藏后再试。";
  }
  if (lower.includes("remote") && lower.includes("already exists")) {
    return "这个远端名已经存在。请换一个名称，或在同步页修改已有远端的 URL。";
  }
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
  if (lower.includes("already exists") && lower.includes("tag")) {
    return "标签已存在，请换一个标签名。";
  }
  if (lower.includes("not fully merged")) {
    return "这个分支还没有完全合并，安全删除已被 Git 阻止。确认不需要后，再做强制删除。";
  }
  if (lower.includes("cannot delete branch") && lower.includes("checked out")) {
    return "这个分支正在其他工作树中使用，不能删除。请先切换或清理对应工作树。";
  }
  if (lower.includes("could not read from remote repository")) {
    return "无法读取远端仓库。请检查网络、远端地址和账号权限。";
  }
  if (lower.includes("authentication failed")) {
    return "远端认证失败。请检查 Git 账号、Token 或凭据管理器。";
  }
  if (lower.includes("no configured push destination") || lower.includes("does not appear to be a git repository")) {
    return "当前仓库没有可用远端。请先添加远端地址后再推送或拉取。";
  }
  if (lower.includes("stale info") || (context.body?.action === "forcePushLease" && lower.includes("rejected"))) {
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

function actionOperationKind(action) {
  const value = String(action || "").toLowerCase();
  if (value.includes("cherrypick")) return "cherryPick";
  if (value.includes("rewritehistorycommit") || value.includes("rewordcommit")) return "rebase";
  if (value.includes("revert")) return "revert";
  if (value.includes("merge")) return "merge";
  if (value.includes("rebase")) return "rebase";
  return "";
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
    return { type: "revert", label: "还原提交未完成", canContinue: true, canAbort: true };
  }
  if (fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD"))) {
    return { type: "cherryPick", label: "挑选提交未完成", canContinue: true, canAbort: true, canSkip: true };
  }
  if (fs.existsSync(path.join(gitDir, "MERGE_HEAD"))) {
    return { type: "merge", label: "合并未完成", canContinue: true, canAbort: true };
  }
  if (fs.existsSync(path.join(gitDir, "rebase-merge")) || fs.existsSync(path.join(gitDir, "rebase-apply"))) {
    return { type: "rebase", label: "变基未完成", canContinue: true, canAbort: true, canSkip: true };
  }
  return null;
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
  return [...activeOperations.values()]
    .filter((operation) => operation.id !== excludeId)
    .slice(0, 4)
    .map((operation) => `${operation.label}，已运行 ${formatDuration(Date.now() - operation.startedAt)}`);
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

function formatLocalTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) {
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

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && parsed.pathname === "/api/state") {
      sendJson(res, 200, await readState(parsed.searchParams.get("ref") || ""));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/open") {
      const body = await readJson(req);
      sendJson(res, 200, await openRepo(body.path));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/commit") {
      sendJson(res, 200, await readCommit(parsed.searchParams.get("sha") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree") {
      sendJson(res, 200, await readWorktree());
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/worktree-diff") {
      sendJson(res, 200, await readWorkingDiff(parsed.searchParams.get("file") || ""));
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/stash") {
      sendJson(res, 200, await readStash(parsed.searchParams.get("ref") || ""));
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/action") {
      const body = await readJson(req);
      const operation = beginOperation(body);
      try {
        sendJson(res, 200, await runAction(body));
      } catch (error) {
        sendError(res, error, { body, operation });
      } finally {
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
  console.log(`Forkline Web running at http://127.0.0.1:${PORT}`);
});
