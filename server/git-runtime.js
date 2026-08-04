"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const OPERATION_OUTPUT_LIMIT = 24 * 1024;
const OPERATION_CANCELLED_CODE = "FORKLINE_OPERATION_CANCELLED";

function createGitRuntime(options = {}) {
  const gitBin = options.gitBin || findGitExecutable();

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
      const operation = commandOptions.operation;
      if (operation?.cancelRequested) {
        reject(operationCancelledError(operation));
        return;
      }
      const child = execFile(
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
      if (operation) trackOperationProcess(operation, child, commandOptions.command || "git");
    });
  }

  function gitBuffer(repoPath, args, commandOptions = {}) {
    return new Promise((resolve, reject) => {
      const fullArgs = ["-C", repoPath, "-c", "core.quotepath=false", ...args];
      execFile(
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
    });
  }

  return {
    gitBin,
    git,
    gitBuffer,
    gitStandalone,
    isOperationCancelledError,
    terminateOperationProcess,
  };
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

function terminateOperationProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.killed) return Promise.resolve();
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolve());
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
};
