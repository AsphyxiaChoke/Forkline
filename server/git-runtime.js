"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const OPERATION_OUTPUT_LIMIT = 24 * 1024;
const OPERATION_CANCELLED_CODE = "FORKLINE_OPERATION_CANCELLED";

function createGitRuntime(options = {}) {
  const gitBin = options.gitBin || findGitExecutable();
  const runExecFile = options.execFile || execFile;
  const terminateProcess = options.terminateProcess || terminateOperationProcess;
  const shutdownWaitMs = Number.isFinite(options.shutdownWaitMs) ? Math.max(0, options.shutdownWaitMs) : 1200;
  const forceWaitMs = Number.isFinite(options.forceWaitMs) ? Math.max(0, options.forceWaitMs) : 300;
  const ownedProcesses = new Set();
  let shuttingDown = false;
  let shutdownPromise = null;

  function git(repoPath, args, commandOptions = {}) {
    const fullArgs = ["-C", repoPath, "-c", "core.quotepath=false", ...args];
    return executeGit(fullArgs, {
      ...commandOptions,
      command: formatGitCommand(args, repoPath),
    });
  }

  function gitStandalone(args, commandOptions = {}) {
    return executeGit(["-c", "core.quotepath=false", ...args], {
      ...commandOptions,
      command: formatGitCommand(args),
    });
  }

  function executeGit(fullArgs, commandOptions = {}) {
    return new Promise((resolve, reject) => {
      if (shuttingDown) {
        reject(runtimeShutdownError());
        return;
      }
      const operation = commandOptions.operation;
      if (operation?.cancelRequested) {
        reject(operationCancelledError(operation));
        return;
      }
      const child = runExecFile(
        gitBin,
        fullArgs,
        {
          windowsHide: true,
          timeout: commandOptions.timeout || 15000,
          maxBuffer: commandOptions.maxBuffer || 1024 * 1024 * 8,
          encoding: "utf8",
          env: commandOptions.env ? { ...process.env, ...commandOptions.env } : process.env,
        },
        (error, stdout, stderr) => {
          const output = [stdout, stderr].filter(Boolean).join("\n");
          if (error) {
            if (operation?.cancelRequested) {
              reject(operationCancelledError(operation));
              return;
            }
            reject(new Error(output.trim() || error.message));
            return;
          }
          resolve(commandOptions.stdoutOnly ? stdout : output);
        }
      );
      registerOwnedProcess(child);
      if (operation) trackOperationProcess(operation, child, commandOptions.command || "git");
    });
  }

  function gitBuffer(repoPath, args, commandOptions = {}) {
    return new Promise((resolve, reject) => {
      if (shuttingDown) {
        reject(runtimeShutdownError());
        return;
      }
      const fullArgs = ["-C", repoPath, "-c", "core.quotepath=false", ...args];
      const child = runExecFile(
        gitBin,
        fullArgs,
        {
          windowsHide: true,
          timeout: commandOptions.timeout || 15000,
          maxBuffer: commandOptions.maxBuffer || 1024 * 1024 * 8,
          encoding: null,
          env: commandOptions.env ? { ...process.env, ...commandOptions.env } : process.env,
        },
        (error, stdout, stderr) => {
          if (error) {
            const output = Buffer.concat([stdout || Buffer.alloc(0), stderr || Buffer.alloc(0)]).toString("utf8").trim();
            reject(new Error(output || error.message));
            return;
          }
          resolve(stdout || Buffer.alloc(0));
        }
      );
      registerOwnedProcess(child);
    });
  }

  function registerOwnedProcess(child) {
    if (!child || typeof child.once !== "function") return child;
    ownedProcesses.add(child);
    child.once("close", () => ownedProcesses.delete(child));
    if (shuttingDown) void stopOwnedProcess(child);
    return child;
  }

  async function stopOwnedProcess(child) {
    try {
      await terminateProcess(child);
    } catch {
      // Continue to the owned-handle fallback below.
    }
    if (await waitForProcessExit(child, shutdownWaitMs)) return;
    forceOwnedProcessExit(child);
    await waitForProcessExit(child, forceWaitMs);
  }

  function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = Promise.all([...ownedProcesses].map(stopOwnedProcess))
      .then(() => ({ remainingProcesses: ownedProcesses.size }));
    return shutdownPromise;
  }

  return {
    gitBin,
    git,
    gitBuffer,
    gitStandalone,
    isOperationCancelledError,
    registerOwnedProcess,
    shutdown,
    terminateOperationProcess,
  };
}

function runtimeShutdownError() {
  const error = new Error("Forkline 后台服务正在关闭，不能再启动新的 Git 命令。");
  error.code = "FORKLINE_RUNTIME_SHUTTING_DOWN";
  return error;
}

function processHasExited(child) {
  return !child || child.exitCode != null || child.signalCode != null;
}

function waitForProcessExit(child, timeoutMs) {
  if (processHasExited(child)) return Promise.resolve(true);
  if (!child || typeof child.once !== "function") return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.removeListener?.("exit", onExit);
      child.removeListener?.("close", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    child.once("exit", onExit);
    child.once("close", onExit);
    timer = setTimeout(() => finish(processHasExited(child)), timeoutMs);
  });
}

function forceOwnedProcessExit(child) {
  if (processHasExited(child)) return;
  try {
    child.kill?.("SIGKILL");
  } catch {
    // The owned process may have exited between the status check and fallback.
  }
  child.stdin?.destroy?.();
  child.stdout?.destroy?.();
  child.stderr?.destroy?.();
}

function trackOperationProcess(operation, child, command) {
  operation.command = command;
  operation.processes.add(child);
  operation.pid = child.pid || 0;
  operation.commandStartedAt = Date.now();
  child.stdout?.on("data", (chunk) => appendOperationOutput(operation, chunk));
  child.stderr?.on("data", (chunk) => appendOperationOutput(operation, chunk));
  child.once("close", () => {
    operation.processes.delete(child);
    if (operation.pid === child.pid) operation.pid = 0;
  });
  if (operation.cancelRequested) terminateOperationProcess(child);
}

function appendOperationOutput(operation, chunk) {
  const text = String(chunk || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text) return;
  const output = `${operation.outputTail || ""}${text}`;
  operation.outputTail = output.length > OPERATION_OUTPUT_LIMIT
    ? `...\n${output.slice(-(OPERATION_OUTPUT_LIMIT - 4))}`
    : output;
  operation.lastOutputAt = Date.now();
}

function formatGitCommand(args, repoPath = "") {
  const prefix = repoPath ? ["git", "-C", repoPath] : ["git"];
  return [...prefix, ...args].map(formatCommandArgument).join(" ");
}

function formatCommandArgument(value) {
  const sanitized = String(value ?? "").replace(/([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+@)/gi, "$1***@");
  return /^[A-Za-z0-9_./:@=+-]+$/.test(sanitized) ? sanitized : JSON.stringify(sanitized);
}

function operationCancelledError(operation) {
  const error = new Error(`操作已取消：${operation?.label || "Git 操作"}`);
  error.code = OPERATION_CANCELLED_CODE;
  return error;
}

function isOperationCancelledError(error, operation) {
  return error?.code === OPERATION_CANCELLED_CODE || Boolean(operation?.cancelRequested);
}

function terminateOperationProcess(child, runTaskkill = execFile) {
  if (!child?.pid || child.exitCode !== null || child.killed) return Promise.resolve();
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      runTaskkill("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, (error) => {
        if (error) {
          try {
            child.kill("SIGTERM");
          } catch {
            // The root process may have exited while taskkill was running.
          }
          // Git helpers can keep inherited pipes open after the root process exits.
          child.stdin?.destroy();
          child.stdout?.destroy();
          child.stderr?.destroy();
        }
        resolve();
      });
    });
  }
  try {
    child.kill("SIGTERM");
  } catch {
    // The process may have finished between the status read and the cancel request.
  }
  return Promise.resolve();
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

  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Git\\cmd\\git.exe",
        "C:\\Program Files\\Git\\bin\\git.exe",
        "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
        "C:\\Program Files (x86)\\Git\\bin\\git.exe",
      ]
    : ["/usr/local/bin/git", "/usr/bin/git", "/bin/git"];

  return candidates.find((candidate) => fs.existsSync(candidate)) || "git";
}

module.exports = {
  OPERATION_OUTPUT_LIMIT,
  createGitRuntime,
  findGitExecutable,
  formatGitCommand,
  terminateOperationProcess,
};
