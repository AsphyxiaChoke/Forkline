const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const PORT = Number(process.env.PORT || 5177);
const PUBLIC_DIR = path.join(__dirname, "public");
const GIT_BIN = findGitExecutable();

let currentRepo = null;

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
  const [branch, branchOutput, worktreeOutput, statusOutput, stashOutput, logOutput] = await Promise.all([
    git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "detached HEAD"),
    git(currentRepo, ["branch", "--all", "--format=%(refname)"]).catch(() => ""),
    git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""),
    git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => ""),
    git(currentRepo, ["stash", "list", "--format=%gd%x1f%gs%x1f%cr"]).catch(() => ""),
    git(currentRepo, logArgs(ref)),
  ]);

  const branches = [];
  const remotes = [];
  for (const raw of branchOutput.split(/\r?\n/)) {
    const refname = raw.trim();
    if (!refname) continue;
    if (refname.startsWith("refs/heads/")) {
      branches.push(refname.replace(/^refs\/heads\//, ""));
      continue;
    }
    if (refname.startsWith("refs/remotes/")) {
      const remoteBranch = refname.replace(/^refs\/remotes\//, "");
      if (remoteBranch && !remoteBranch.endsWith("/HEAD")) remotes.push(remoteBranch);
      continue;
    }
    if (refname.endsWith("/HEAD") || refname === "origin" || refname === "upstream") continue;
    if (refname.startsWith("remotes/")) remotes.push(refname.replace(/^remotes\//, ""));
    else if (/^[^/]+\/.+/.test(refname)) remotes.push(refname);
    else branches.push(refname);
  }

  return {
    repo: {
      name: path.basename(currentRepo),
      path: currentRepo,
      branch: branch.trim() || "detached HEAD",
      selectedRef: ref,
      isSample: false,
    },
    branches: branches.slice(0, 32),
    branchInfo: parseWorktreeBranches(worktreeOutput, currentRepo),
    remotes: remotes.slice(0, 32),
    workingFiles: parseStatus(statusOutput),
    stashes: parseStashList(stashOutput),
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
    return { workingFiles: sampleState().workingFiles };
  }
  const statusOutput = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => "");
  return { workingFiles: parseStatus(statusOutput) };
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
    return commandResult(await git(currentRepo, ["fetch", "--all", "--prune"], { timeout: 120000 }));
  }
  if (action === "pull") {
    return commandResult(await git(currentRepo, ["pull", "--ff-only"], { timeout: 120000 }));
  }
  if (action === "push") {
    return commandResult(await git(currentRepo, ["push"], { timeout: 120000 }));
  }
  if (action === "stageAll") {
    return commandResult(await git(currentRepo, ["add", "-A"], { timeout: 60000 }));
  }
  if (action === "discardAll") {
    await git(currentRepo, ["reset", "--hard", "HEAD"], { timeout: 60000 });
    await git(currentRepo, ["clean", "-fd"], { timeout: 60000 });
    return { ok: true, output: "已丢弃全部未提交更改" };
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
  if (action === "mergeRef") {
    return mergeRef(body);
  }
  if (action === "createTag") {
    return createTag(body);
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
  throw new Error("未知操作");
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

function sequenceEditorScript(targetSha) {
  return `
const fs = require("fs");
const todoPath = process.argv[2];
const target = ${JSON.stringify(targetSha)};
const text = fs.readFileSync(todoPath, "utf8");
const lines = text.split(/\\r?\\n/).map((line) => {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("pick ")) return line;
  const hash = trimmed.split(/\\s+/)[1] || "";
  return target.startsWith(hash) ? line.replace(/^(\\s*)pick(\\s+)/, "$1reword$2") : line;
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

function normalizeRemoteCheckoutBranch(remoteRef) {
  const parts = String(remoteRef || "").split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("远端分支不合法");
  return normalizeBranchName(parts.slice(1).join("/"));
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
  const staged = indexStatus !== " " && indexStatus !== "?";
  const unstaged = worktreeStatus !== " " || indexStatus === "?";
  const displayStatus = worktreeStatus !== " " ? worktreeStatus : indexStatus;
  const state = displayStatus === "A" || displayStatus === "?" ? "A" : displayStatus === "D" ? "D" : "M";
  return {
    state,
    file,
    extra: status,
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
    },
    branches: ["feature/visual-history", "main", "release/2.9", "fix/diff-pane-resize", "experiment/ai-summary", "chore/design-tokens"],
    remotes: ["origin/main", "origin/feature/visual-history", "upstream/release/2.9"],
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

function sendError(res, error) {
  sendJson(res, 400, { error: friendlyErrorMessage(error) });
}

function friendlyErrorMessage(error) {
  const raw = String(error?.message || error || "").trim();
  const text = raw || "操作失败";
  const lower = text.toLowerCase();
  if (lower.includes("index.lock") && (lower.includes("unable to create") || lower.includes("file exists"))) {
    const lockPath = text.match(/['"]([^'"]*index\.lock)['"]/)?.[1] || "";
    const suffix = lockPath ? ` 锁文件：${lockPath}` : "";
    return `Git 仓库正在被另一个操作占用，暂时不能继续。请等几秒再试，或关闭正在操作这个仓库的 Git/编辑器；如果确认没有 Git 操作在运行，再删除 index.lock 后重试。${suffix}`;
  }
  if (lower.includes("your local changes") && lower.includes("would be overwritten")) {
    return "这个操作会覆盖本地修改。请先提交或储藏后再试；如果是切换分支，也可以使用“储藏并签出/强制签出”。";
  }
  if (lower.includes("please commit your changes or stash them")) {
    return "当前有未提交修改。请先提交或储藏后再试。";
  }
  if (lower.includes("automatic merge failed") || lower.includes("merge conflict") || lower.includes("conflict (")) {
    return "合并发生冲突。请在工作区查看冲突文件，手动解决后提交；不想继续时可以执行中止合并。";
  }
  if (lower.includes("merge_head exists") || lower.includes("not concluded your merge")) {
    return "上一次合并还没有结束。请先解决冲突并提交，或中止当前合并后再继续。";
  }
  if (lower.includes("unmerged files") || lower.includes("needs merge")) {
    return "当前还有未解决的合并冲突文件。请先处理这些文件后再继续操作。";
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
  return text;
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
    res.writeHead(200, { "Content-Type": mime(filePath) });
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
      sendJson(res, 200, await runAction(body));
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
