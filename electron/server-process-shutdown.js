"use strict";

const { terminateOperationProcess } = require("../server/git-runtime");
const { SERVER_SHUTDOWN_MESSAGE } = require("../server/shutdown-controller");

const DEFAULT_GRACEFUL_TIMEOUT_MS = 3500;
const DEFAULT_FORCE_TIMEOUT_MS = 750;

function processHasExited(child) {
  return !child || child.exitCode != null || child.signalCode != null;
}

function waitForProcessExit(child, timeoutMs) {
  if (processHasExited(child)) return Promise.resolve(true);
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
    child.once?.("exit", onExit);
    child.once?.("close", onExit);
    timer = setTimeout(() => finish(processHasExited(child)), timeoutMs);
  });
}

function requestGracefulShutdown(child) {
  if (!child?.connected || typeof child.send !== "function") return false;
  try {
    child.send({ type: SERVER_SHUTDOWN_MESSAGE });
    return true;
  } catch {
    return false;
  }
}

async function shutdownServerProcess(child, options = {}) {
  if (processHasExited(child)) return { mode: "already-exited" };
  const gracefulTimeoutMs = Number.isFinite(options.gracefulTimeoutMs)
    ? Math.max(0, options.gracefulTimeoutMs)
    : DEFAULT_GRACEFUL_TIMEOUT_MS;
  const forceTimeoutMs = Number.isFinite(options.forceTimeoutMs)
    ? Math.max(0, options.forceTimeoutMs)
    : DEFAULT_FORCE_TIMEOUT_MS;
  const terminateProcess = options.terminateProcess || terminateOperationProcess;

  if (requestGracefulShutdown(child) && await waitForProcessExit(child, gracefulTimeoutMs)) {
    return { mode: "graceful" };
  }

  try {
    await terminateProcess(child);
  } catch {
    // Continue with the same owned server handle; never scan by process name.
  }
  if (await waitForProcessExit(child, forceTimeoutMs)) return { mode: "terminated" };

  try {
    child.kill?.("SIGKILL");
  } catch {
    // The server may have exited while the final fallback was being scheduled.
  }
  child.stdin?.destroy?.();
  child.stdout?.destroy?.();
  child.stderr?.destroy?.();
  await waitForProcessExit(child, forceTimeoutMs);
  return { mode: processHasExited(child) ? "forced" : "timeout" };
}

module.exports = {
  DEFAULT_FORCE_TIMEOUT_MS,
  DEFAULT_GRACEFUL_TIMEOUT_MS,
  shutdownServerProcess,
};
