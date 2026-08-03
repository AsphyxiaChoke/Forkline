"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");
const { normalizeVersion } = require("./app-update");

const OFFICIAL_REPOSITORY = "github.com/asphyxiachoke/forkline";
const UPDATE_REF_PREFIX = "refs/forkline/self-update";
const INCOMPLETE_OPERATIONS = [
  ["MERGE_HEAD", "合并"],
  ["CHERRY_PICK_HEAD", "挑选"],
  ["REVERT_HEAD", "还原"],
  ["rebase-merge", "变基"],
  ["rebase-apply", "变基"],
  ["sequencer", "提交序列"],
  ["BISECT_LOG", "二分查找"],
];

function normalizeRepositoryRemote(value) {
  let remote = String(value || "").trim().replace(/\\/g, "/");
  if (!remote) return "";
  if (/^git@github\.com:/i.test(remote)) {
    remote = `ssh://git@github.com/${remote.slice(remote.indexOf(":") + 1)}`;
  }
  try {
    const url = new URL(remote);
    const pathname = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    return `${url.hostname.toLowerCase()}/${pathname.toLowerCase()}`;
  } catch {
    return "";
  }
}

function isOfficialForklineRemote(value) {
  return normalizeRepositoryRemote(value) === OFFICIAL_REPOSITORY;
}

function selfUpdateStatusFile(repoDir) {
  const key = crypto.createHash("sha256").update(path.resolve(repoDir).toLowerCase()).digest("hex").slice(0, 20);
  return path.join(os.tmpdir(), `forkline-self-update-${key}.json`);
}

function writeSelfUpdateStatus(statusFile, value) {
  fs.writeFileSync(statusFile, JSON.stringify({ ...value, updatedAt: new Date().toISOString() }), "utf8");
}

function readSelfUpdateStatus(statusFile, options = {}) {
  let value = null;
  try {
    value = JSON.parse(fs.readFileSync(statusFile, "utf8"));
  } catch {
    return null;
  }
  if (options.consume && ["success", "error"].includes(value?.state)) {
    try {
      fs.rmSync(statusFile, { force: true });
    } catch {}
  }
  return value;
}

function clearSelfUpdateStatus(statusFile) {
  try {
    fs.rmSync(statusFile, { force: true });
  } catch {}
}

function runGitCommand(repoDir, args, options = {}) {
  const gitBin = options.gitBin || "git";
  return new Promise((resolve, reject) => {
    execFile(
      gitBin,
      ["-C", repoDir, "-c", "core.quotepath=false", ...args],
      {
        windowsHide: true,
        timeout: options.timeout || 20000,
        maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          reject(error);
          return;
        }
        resolve({ code: error ? Number(error.code) : 0, stdout: stdout || "", stderr: stderr || "" });
      }
    );
  });
}

function gitFailure(result, fallback) {
  const detail = [result?.stdout, result?.stderr].filter(Boolean).join("\n").trim();
  return new Error(detail ? `${fallback}\n${detail}` : fallback);
}

async function requireGitOutput(repoDir, args, options = {}, fallback = "Git 命令执行失败。") {
  const result = await runGitCommand(repoDir, args, options);
  if (result.code !== 0) throw gitFailure(result, fallback);
  return result.stdout.trim();
}

function samePath(left, right) {
  const a = path.resolve(left || "");
  const b = path.resolve(right || "");
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function resolveGitPath(repoDir, name, options = {}) {
  const value = await requireGitOutput(repoDir, ["rev-parse", "--git-path", name], options, "无法读取 Forkline Git 状态。");
  return path.isAbsolute(value) ? value : path.resolve(repoDir, value);
}

async function findIncompleteOperation(repoDir, options = {}) {
  for (const [name, label] of INCOMPLETE_OPERATIONS) {
    const target = await resolveGitPath(repoDir, name, options);
    if (fs.existsSync(target)) return label;
  }
  return "";
}

async function assertLocalUpdateSafety(options) {
  const repoDir = path.resolve(options.repoDir);
  const gitOptions = { gitBin: options.gitBin };
  const allowRemote = options.allowRemote || isOfficialForklineRemote;
  let root = "";
  try {
    root = await requireGitOutput(repoDir, ["rev-parse", "--show-toplevel"], gitOptions);
  } catch {
    throw new Error("当前 Forkline 目录不是 Git 克隆，无法一键更新。请从 Release 手动下载，或使用 git clone 安装。");
  }
  if (!samePath(root, repoDir)) throw new Error("Forkline 必须从 Git 仓库根目录启动，才能执行一键更新。");

  const remoteUrl = await requireGitOutput(repoDir, ["remote", "get-url", "origin"], gitOptions, "Forkline 没有可用的 origin 远端，无法一键更新。");
  if (!allowRemote(remoteUrl)) {
    throw new Error("为防止更新到错误项目，Forkline 的 origin 必须指向 AsphyxiaChoke/Forkline。");
  }

  const branch = await requireGitOutput(repoDir, ["branch", "--show-current"], gitOptions, "无法读取 Forkline 当前分支。");
  if (branch !== "main") throw new Error(`Forkline 当前位于 ${branch || "游离 HEAD"}，请先切换到 main 再更新。`);

  const operation = await findIncompleteOperation(repoDir, gitOptions);
  if (operation) throw new Error(`Forkline 自身仓库还有未完成的${operation}操作，请先完成或中止后再更新。`);

  const status = await requireGitOutput(
    repoDir,
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    gitOptions,
    "无法检查 Forkline 自身工作区。"
  );
  if (status) {
    throw new Error("Forkline 自身目录有未提交修改，一键更新已停止。请先提交、还原或备份这些修改。");
  }

  const head = await requireGitOutput(repoDir, ["rev-parse", "HEAD"], gitOptions, "无法读取 Forkline 当前提交。");
  if (options.expectedHead && head !== options.expectedHead) {
    throw new Error("Forkline 当前提交在更新过程中发生变化，一键更新已停止，请刷新后重试。");
  }
  return { repoDir, remoteUrl, branch, head };
}

async function cleanupCandidateRef(plan, options = {}) {
  if (!plan?.candidateRef) return;
  try {
    await runGitCommand(plan.repoDir, ["update-ref", "-d", plan.candidateRef], { gitBin: options.gitBin || plan.gitBin });
  } catch {}
}

async function prepareSelfUpdate(options) {
  const targetVersion = normalizeVersion(options.targetVersion);
  const tagName = String(options.tagName || "").trim();
  if (!targetVersion || normalizeVersion(tagName) !== targetVersion) {
    throw new Error("GitHub Release 标签与目标版本不一致，已停止更新。");
  }
  const currentVersion = normalizeVersion(options.currentVersion);
  if (!currentVersion) throw new Error("无法确认 Forkline 当前版本，已停止更新。");

  const local = await assertLocalUpdateSafety(options);
  const packagePath = path.join(local.repoDir, "package.json");
  let installedVersion = "";
  try {
    installedVersion = normalizeVersion(JSON.parse(fs.readFileSync(packagePath, "utf8")).version);
  } catch {}
  if (installedVersion !== currentVersion) {
    throw new Error("Forkline 运行版本与 package.json 不一致，请重新启动后再更新。");
  }

  const candidateRef = `${UPDATE_REF_PREFIX}/candidate-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const plan = {
    repoDir: local.repoDir,
    gitBin: options.gitBin || "git",
    currentVersion,
    targetVersion,
    tagName,
    candidateRef,
    expectedHead: local.head,
    statusFile: selfUpdateStatusFile(local.repoDir),
    port: Number(options.port),
    parentPid: Number(options.parentPid),
    managedRepo: String(options.managedRepo || ""),
  };

  try {
    const fetchResult = await runGitCommand(
      local.repoDir,
      ["fetch", "--no-write-fetch-head", "origin", `refs/tags/${tagName}:${candidateRef}`],
      { gitBin: plan.gitBin, timeout: options.fetchTimeout || 60000 }
    );
    if (fetchResult.code !== 0) throw gitFailure(fetchResult, `无法从 origin 获取正式版本 ${tagName}。`);

    plan.targetSha = await requireGitOutput(
      local.repoDir,
      ["rev-list", "-n", "1", candidateRef],
      { gitBin: plan.gitBin },
      `无法解析正式版本 ${tagName}。`
    );
    if (plan.targetSha === plan.expectedHead) throw new Error(`Forkline 已经位于 ${tagName}，无需重复更新。`);

    const packageText = await requireGitOutput(
      local.repoDir,
      ["show", `${plan.targetSha}:package.json`],
      { gitBin: plan.gitBin },
      `正式版本 ${tagName} 缺少有效的 package.json。`
    );
    let releaseVersion = "";
    try {
      releaseVersion = normalizeVersion(JSON.parse(packageText).version);
    } catch {}
    if (releaseVersion !== targetVersion) throw new Error(`正式版本 ${tagName} 的版本信息不一致，已停止更新。`);

    const ancestor = await runGitCommand(
      local.repoDir,
      ["merge-base", "--is-ancestor", plan.expectedHead, plan.targetSha],
      { gitBin: plan.gitBin }
    );
    if (ancestor.code === 1) {
      throw new Error("当前 Forkline 包含未发布的本地提交或已经偏离正式版本，不能自动快进更新。");
    }
    if (ancestor.code !== 0) throw gitFailure(ancestor, "无法确认 Forkline 是否可以安全快进更新。");

    return plan;
  } catch (error) {
    await cleanupCandidateRef(plan);
    throw error;
  }
}

async function verifySelfUpdatePlan(plan, options = {}) {
  const local = await assertLocalUpdateSafety({
    repoDir: plan.repoDir,
    gitBin: options.gitBin || plan.gitBin,
    expectedHead: plan.expectedHead,
    allowRemote: options.allowRemote,
  });
  const targetSha = await requireGitOutput(
    local.repoDir,
    ["rev-list", "-n", "1", plan.candidateRef],
    { gitBin: options.gitBin || plan.gitBin },
    "更新候选版本已经失效，请重新检查更新。"
  );
  if (targetSha !== plan.targetSha) throw new Error("更新候选版本在重启前发生变化，已停止更新。");
  const ancestor = await runGitCommand(
    local.repoDir,
    ["merge-base", "--is-ancestor", plan.expectedHead, plan.targetSha],
    { gitBin: options.gitBin || plan.gitBin }
  );
  if (ancestor.code !== 0) throw new Error("Forkline 已不能安全快进到目标版本，更新已停止。");
  return local;
}

async function updateWorkingTree(plan, options = {}) {
  await verifySelfUpdatePlan(plan, options);
  const result = await runGitCommand(
    plan.repoDir,
    ["merge", "--ff-only", plan.targetSha],
    { gitBin: options.gitBin || plan.gitBin, timeout: 60000 }
  );
  if (result.code !== 0) throw gitFailure(result, "Forkline 快进更新失败。");
  const head = await requireGitOutput(plan.repoDir, ["rev-parse", "HEAD"], { gitBin: options.gitBin || plan.gitBin });
  if (head !== plan.targetSha) throw new Error("Forkline 更新后提交位置不正确，已停止启动新版本。");
  return head;
}

async function rollbackWorkingTree(plan, options = {}) {
  const currentHead = await requireGitOutput(plan.repoDir, ["rev-parse", "HEAD"], { gitBin: options.gitBin || plan.gitBin });
  if (currentHead !== plan.targetSha) return false;
  const result = await runGitCommand(
    plan.repoDir,
    ["reset", "--keep", plan.expectedHead],
    { gitBin: options.gitBin || plan.gitBin, timeout: 30000 }
  );
  return result.code === 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcessExit(pid, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return;
      if (error?.code !== "EPERM") return;
    }
    await wait(200);
  }
  throw new Error("Forkline 服务没有按时退出，更新未执行。");
}

function startServerProcess(plan) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(plan.repoDir, "server.js")], {
      cwd: plan.repoDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        PORT: String(plan.port),
        FORKLINE_NO_OPEN: "1",
      },
    });
    child.once("error", reject);
    child.once("spawn", () => resolve(child));
  });
}

function serverResponds(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        if (body.length < 65536) body += chunk;
      });
      response.on("end", () => resolve(response.statusCode === 200 && body.includes("Forkline")));
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

async function waitForServer(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverResponds(port)) return;
    await wait(300);
  }
  throw new Error("更新后的 Forkline 服务没有正常启动。");
}

async function stopServerProcess(child) {
  if (!child?.pid) return;
  try {
    process.kill(child.pid);
  } catch {}
  await wait(400);
}

async function runSelfUpdatePlan(plan, options = {}) {
  let parentExited = false;
  let startedServer = null;
  try {
    await waitForProcessExit(plan.parentPid);
    parentExited = true;
    writeSelfUpdateStatus(plan.statusFile, {
      state: "updating",
      currentVersion: plan.currentVersion,
      targetVersion: plan.targetVersion,
      repoPath: plan.managedRepo,
      message: `正在更新到 v${plan.targetVersion}`,
    });
    await updateWorkingTree(plan, options);
    writeSelfUpdateStatus(plan.statusFile, {
      state: "restarting",
      currentVersion: plan.currentVersion,
      targetVersion: plan.targetVersion,
      repoPath: plan.managedRepo,
      message: "正在启动新版本",
    });
    startedServer = await startServerProcess(plan);
    await waitForServer(plan.port, options.serverTimeoutMs || 20000);
    await cleanupCandidateRef(plan, options);
    writeSelfUpdateStatus(plan.statusFile, {
      state: "success",
      currentVersion: plan.currentVersion,
      targetVersion: plan.targetVersion,
      repoPath: plan.managedRepo,
      serverPid: startedServer.pid,
      message: `Forkline 已更新到 v${plan.targetVersion}`,
    });
    startedServer.unref();
    return { ok: true };
  } catch (error) {
    if (startedServer) await stopServerProcess(startedServer);
    let rolledBack = false;
    let fallbackServerPid = 0;
    if (parentExited) {
      try {
        rolledBack = await rollbackWorkingTree(plan, options);
      } catch {}
      try {
        const fallbackServer = await startServerProcess(plan);
        await waitForServer(plan.port, options.serverTimeoutMs || 20000);
        fallbackServerPid = fallbackServer.pid;
        fallbackServer.unref();
      } catch {}
    }
    await cleanupCandidateRef(plan, options);
    const rollbackText = rolledBack ? "，已恢复到更新前版本" : "";
    writeSelfUpdateStatus(plan.statusFile, {
      state: "error",
      currentVersion: plan.currentVersion,
      targetVersion: plan.targetVersion,
      repoPath: plan.managedRepo,
      serverPid: fallbackServerPid,
      error: error.message,
      rolledBack,
      message: `更新失败${rollbackText}：${error.message}`,
    });
    return { ok: false, error: error.message, rolledBack };
  }
}

function launchSelfUpdateRunner(plan, options = {}) {
  const runnerPath = options.runnerPath || path.join(plan.repoDir, "self-update-runner.js");
  const encodedPlan = Buffer.from(JSON.stringify(plan), "utf8").toString("base64url");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath, encodedPlan], {
      cwd: plan.repoDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: process.env,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve(child.pid);
    });
  });
}

module.exports = {
  OFFICIAL_REPOSITORY,
  assertLocalUpdateSafety,
  cleanupCandidateRef,
  clearSelfUpdateStatus,
  isOfficialForklineRemote,
  launchSelfUpdateRunner,
  normalizeRepositoryRemote,
  prepareSelfUpdate,
  readSelfUpdateStatus,
  rollbackWorkingTree,
  runGitCommand,
  runSelfUpdatePlan,
  selfUpdateStatusFile,
  updateWorkingTree,
  verifySelfUpdatePlan,
  writeSelfUpdateStatus,
};
