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
const SELF_UPDATE_TOTAL_STEPS = 6;
const SELF_UPDATE_FETCH_ATTEMPTS = 3;
const SELF_UPDATE_STEPS = {
  preparing: 1,
  stopping: 2,
  verifying: 3,
  updating: 4,
  restarting: 5,
  checking: 6,
  complete: 6,
};
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

function writeSelfUpdateProgress(plan, phase, message, extra = {}) {
  const state = phase === "complete" ? "success" : phase === "failed" ? "error" : phase;
  const value = {
    state,
    phase,
    step: SELF_UPDATE_STEPS[phase] || 0,
    totalSteps: SELF_UPDATE_TOTAL_STEPS,
    currentVersion: plan.currentVersion,
    targetVersion: plan.targetVersion,
    repoPath: plan.managedRepo,
    message,
    ...extra,
  };
  writeSelfUpdateStatus(plan.statusFile, value);
  return value;
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
    const child = execFile(
      gitBin,
      ["-C", repoDir, "-c", "core.quotepath=false", ...args],
      {
        windowsHide: true,
        timeout: options.timeout || 20000,
        maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
        encoding: "utf8",
        env: options.env ? { ...process.env, ...options.env } : process.env,
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          reject(error);
          return;
        }
        resolve({ code: error ? Number(error.code) : 0, stdout: stdout || "", stderr: stderr || "" });
      }
    );
    if (typeof options.onProgress === "function" && child.stderr) {
      let pending = "";
      let lastKey = "";
      child.stderr.on("data", (chunk) => {
        const parts = `${pending}${String(chunk || "")}`.split(/[\r\n]+/);
        pending = parts.pop() || "";
        for (const part of parts) emit(part);
      });
      child.stderr.on("end", () => emit(pending));
      function emit(value) {
        const progress = parseGitFetchProgress(value);
        if (!progress) return;
        const key = JSON.stringify(progress);
        if (key === lastKey) return;
        lastKey = key;
        try {
          options.onProgress(progress);
        } catch {}
      }
    }
  });
}

function parseGitFetchProgress(value) {
  const line = String(value || "").replace(/^remote:\s*/i, "").trim();
  const match = line.match(/(Counting objects|Compressing objects|Receiving objects|Resolving deltas):\s*(\d+)%\s*\((\d+)\/(\d+)\)(?:,\s*([0-9]+(?:\.[0-9]+)?)\s*(bytes|KiB|MiB|GiB))?/i);
  if (!match) return null;
  const stages = {
    "counting objects": "counting",
    "compressing objects": "compressing",
    "receiving objects": "receiving",
    "resolving deltas": "resolving",
  };
  const progress = {
    downloadStage: stages[match[1].toLowerCase()] || "receiving",
    downloadPercent: Math.min(100, Math.max(0, Number(match[2]) || 0)),
    downloadObjects: Math.max(0, Number(match[3]) || 0),
    downloadTotalObjects: Math.max(0, Number(match[4]) || 0),
  };
  const downloadBytes = parseGitProgressBytes(match[5], match[6]);
  if (downloadBytes > 0) progress.downloadBytes = downloadBytes;
  return progress;
}

function parseGitProgressBytes(value, unit) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const powers = { bytes: 0, kib: 1, mib: 2, gib: 3 };
  const power = powers[String(unit || "").toLowerCase()];
  if (power === undefined) return 0;
  return Math.round(amount * (1024 ** power));
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

async function fetchReleaseCandidate(plan, options = {}) {
  const fetchCommand = options.fetchCommand || runGitCommand;
  const attempts = Math.max(1, Number(options.fetchAttempts) || SELF_UPDATE_FETCH_ATTEMPTS);
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    emitFetchProgress(options, {
      downloadStage: "connecting",
      downloadPercent: 0,
      fetchAttempt: attempt,
      fetchAttempts: attempts,
    });
    try {
      lastResult = await fetchCommand(
        plan.repoDir,
        ["fetch", "--progress", "--no-write-fetch-head", "origin", `refs/tags/${plan.tagName}:${plan.candidateRef}`],
        {
          gitBin: plan.gitBin,
          timeout: options.fetchTimeout || 60000,
          env: { LC_ALL: "C", LANG: "C" },
          onProgress: (progress) => emitFetchProgress(options, { ...progress, fetchAttempt: attempt, fetchAttempts: attempts }),
        }
      );
    } catch (error) {
      lastResult = { code: -1, stdout: "", stderr: error.message || String(error) };
    }
    if (lastResult.code === 0) {
      emitFetchProgress(options, {
        downloadStage: "complete",
        downloadPercent: 100,
        fetchAttempt: attempt,
        fetchAttempts: attempts,
      });
      return lastResult;
    }
    if (attempt >= attempts || !isTransientGitFetchFailure(lastResult)) return lastResult;
    await cleanupCandidateRef(plan, { gitBin: plan.gitBin });
    emitFetchProgress(options, {
      downloadStage: "retrying",
      downloadPercent: 0,
      fetchAttempt: attempt + 1,
      fetchAttempts: attempts,
    });
    await wait(Math.max(0, Number(options.fetchRetryDelayMs) || attempt * 1000));
  }
  return lastResult || { code: -1, stdout: "", stderr: "Release fetch failed" };
}

function emitFetchProgress(options, progress) {
  if (typeof options.onFetchProgress !== "function") return;
  try {
    options.onFetchProgress(progress);
  } catch {}
}

function isTransientGitFetchFailure(result) {
  const detail = [result?.stdout, result?.stderr].filter(Boolean).join("\n");
  return /connection (?:was )?reset|recv failure|timed? out|timeout|temporary failure|could not resolve host|connection (?:closed|aborted)|tls|http\/2 stream|rpc failed|early eof|remote end hung up/i.test(detail);
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
    const fetchResult = await fetchReleaseCandidate(plan, options);
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
  if (typeof options.onVerified === "function") await options.onVerified();
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

async function recoverWorkingTree(plan, options = {}) {
  const currentHead = await requireGitOutput(plan.repoDir, ["rev-parse", "HEAD"], { gitBin: options.gitBin || plan.gitBin });
  if (currentHead === plan.expectedHead) {
    return { state: "not-needed", message: "更新尚未写入，Forkline 文件没有修改，无需回退。" };
  }
  if (currentHead !== plan.targetSha) {
    return {
      state: "blocked",
      message: "Forkline 当前提交已发生额外变化，为避免覆盖这些变化，未自动回退。",
    };
  }
  const result = await runGitCommand(
    plan.repoDir,
    ["reset", "--keep", plan.expectedHead],
    { gitBin: options.gitBin || plan.gitBin, timeout: 30000 }
  );
  if (result.code !== 0) {
    return { state: "failed", message: gitFailure(result, "自动回退失败。").message };
  }
  return { state: "complete", message: "已恢复到更新前版本。" };
}

async function rollbackWorkingTree(plan, options = {}) {
  return (await recoverWorkingTree(plan, options)).state === "complete";
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
  let currentStage = "stopping";
  try {
    writeSelfUpdateProgress(plan, "stopping", "正在关闭旧版本服务");
    await waitForProcessExit(plan.parentPid, options.processExitTimeoutMs || 20000);
    parentExited = true;
    currentStage = "verifying";
    writeSelfUpdateProgress(plan, "verifying", "正在重新校验更新条件");
    await updateWorkingTree(plan, {
      ...options,
      onVerified: async () => {
        currentStage = "updating";
        writeSelfUpdateProgress(plan, "updating", `正在写入 v${plan.targetVersion}`);
        if (typeof options.onVerified === "function") await options.onVerified();
      },
    });
    currentStage = "restarting";
    writeSelfUpdateProgress(plan, "restarting", "正在启动新版本");
    startedServer = await startServerProcess(plan);
    currentStage = "checking";
    writeSelfUpdateProgress(plan, "checking", "正在确认新版本可以正常使用", { serverPid: startedServer.pid });
    await waitForServer(plan.port, options.serverTimeoutMs || 20000);
    await cleanupCandidateRef(plan, options);
    writeSelfUpdateProgress(plan, "complete", `Forkline 已更新到 v${plan.targetVersion}`, {
      serverPid: startedServer.pid,
    });
    startedServer.unref();
    return { ok: true };
  } catch (error) {
    if (startedServer) await stopServerProcess(startedServer);
    let recovery = parentExited
      ? { state: "unknown", message: "无法确认自动回退结果。" }
      : { state: "not-needed", message: "旧版本服务未退出，更新文件没有修改，原版本仍在运行。" };
    let fallbackServerPid = 0;
    let serviceState = parentExited ? "unavailable" : "unchanged";
    let serviceMessage = parentExited ? "Forkline 服务尚未恢复。" : "旧版本服务仍在运行。";
    if (parentExited) {
      writeSelfUpdateProgress(plan, "recovering", "更新失败，正在恢复更新前版本", {
        step: SELF_UPDATE_STEPS[currentStage] || 0,
        failedStage: currentStage,
        rollbackState: "pending",
        serviceState: "recovering",
      });
      try {
        recovery = await recoverWorkingTree(plan, options);
      } catch (recoveryError) {
        recovery = { state: "failed", message: `自动回退检查失败：${recoveryError.message}` };
      }
      try {
        const fallbackServer = await startServerProcess(plan);
        await waitForServer(plan.port, options.serverTimeoutMs || 20000);
        fallbackServerPid = fallbackServer.pid;
        fallbackServer.unref();
        serviceState = "restored";
        serviceMessage = recovery.state === "complete" ? "更新前版本服务已重新启动。" : "Forkline 服务已重新启动。";
      } catch {
        serviceState = "unavailable";
        serviceMessage = "Forkline 服务没有恢复，请重新运行 start.cmd。";
      }
    }
    await cleanupCandidateRef(plan, options);
    const rolledBack = recovery.state === "complete";
    const outcomeText = recovery.state === "complete"
      ? "，已恢复到更新前版本"
      : recovery.state === "not-needed"
        ? "，更新文件没有修改"
        : ["failed", "blocked"].includes(recovery.state)
          ? "，自动回退未完成"
          : "，回退状态未知";
    const recoveryMessage = [recovery.message, serviceMessage].filter(Boolean).join(" ");
    writeSelfUpdateProgress(plan, "failed", `更新失败${outcomeText}：${error.message}`, {
      step: SELF_UPDATE_STEPS[currentStage] || 0,
      failedStage: currentStage,
      serverPid: fallbackServerPid,
      error: error.message,
      rolledBack,
      rollbackState: recovery.state,
      recoveryMessage,
      serviceState,
      serviceMessage,
    });
    return {
      ok: false,
      error: error.message,
      rolledBack,
      failedStage: currentStage,
      rollbackState: recovery.state,
      serviceState,
    };
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
  SELF_UPDATE_TOTAL_STEPS,
  assertLocalUpdateSafety,
  cleanupCandidateRef,
  clearSelfUpdateStatus,
  isOfficialForklineRemote,
  launchSelfUpdateRunner,
  normalizeRepositoryRemote,
  parseGitFetchProgress,
  prepareSelfUpdate,
  readSelfUpdateStatus,
  recoverWorkingTree,
  rollbackWorkingTree,
  runGitCommand,
  runSelfUpdatePlan,
  selfUpdateStatusFile,
  updateWorkingTree,
  verifySelfUpdatePlan,
  writeSelfUpdateStatus,
};
