"use strict";

const SERVER_SHUTDOWN_MESSAGE = "forkline:shutdown";
const DEFAULT_CLOSE_TIMEOUT_MS = 2200;

function createServerShutdownController(options = {}) {
  const server = options.server;
  const processRef = options.processRef || process;
  const stopOwnedProcesses = options.stopOwnedProcesses;
  const closeTimeoutMs = Number.isFinite(options.closeTimeoutMs)
    ? Math.max(0, options.closeTimeoutMs)
    : DEFAULT_CLOSE_TIMEOUT_MS;
  if (!server || typeof server.close !== "function" || typeof stopOwnedProcesses !== "function") {
    throw new TypeError("Server shutdown controller requires HTTP server and process cleanup handlers");
  }

  let attached = false;
  let shutdownPromise = null;
  let exitPromise = null;

  function closeHttpServer() {
    if (server.listening === false) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = (closed) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(closed);
      };
      try {
        server.close(() => finish(true));
        server.closeIdleConnections?.();
      } catch {
        finish(true);
        return;
      }
      timer = setTimeout(() => finish(false), closeTimeoutMs);
    });
  }

  function shutdown(reason = "shutdown") {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      const closePromise = closeHttpServer();
      let processCleanup = null;
      try {
        processCleanup = await stopOwnedProcesses();
      } catch (error) {
        processCleanup = { error: error?.message || String(error) };
      }
      const closed = await closePromise;
      if (!closed) server.closeAllConnections?.();
      return {
        reason,
        forcedConnections: !closed,
        processCleanup,
      };
    })();
    return shutdownPromise;
  }

  function requestExit(reason = "shutdown") {
    if (exitPromise) return exitPromise;
    exitPromise = shutdown(reason).finally(() => processRef.exit?.(0));
    return exitPromise;
  }

  function attach() {
    if (attached) return;
    attached = true;
    processRef.on?.("message", (message) => {
      if (message?.type === SERVER_SHUTDOWN_MESSAGE) void requestExit("desktop");
    });
    processRef.once?.("disconnect", () => void requestExit("parent-disconnect"));
    processRef.once?.("SIGTERM", () => void requestExit("sigterm"));
    processRef.once?.("SIGINT", () => void requestExit("sigint"));
  }

  return { attach, requestExit, shutdown };
}

module.exports = {
  DEFAULT_CLOSE_TIMEOUT_MS,
  SERVER_SHUTDOWN_MESSAGE,
  createServerShutdownController,
};
