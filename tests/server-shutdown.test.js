"use strict";

const assert = require("node:assert/strict");
const { fork } = require("node:child_process");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");
const { shutdownServerProcess } = require("../electron/server-process-shutdown");
const {
  SERVER_SHUTDOWN_MESSAGE,
  createServerShutdownController,
} = require("../server/shutdown-controller");

function waitForMessage(child, type, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.removeListener("message", onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeoutMs);
    const onMessage = (message) => {
      if (message?.type !== type) return;
      clearTimeout(timer);
      child.removeListener("message", onMessage);
      resolve(message);
    };
    child.on("message", onMessage);
  });
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessGone(pid, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processIsRunning(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return !processIsRunning(pid);
}

test("server shutdown stops accepting requests, terminates owned Git processes, and exits", async () => {
  const calls = [];
  const processRef = new EventEmitter();
  const exited = new Promise((resolve) => {
    processRef.exit = (code) => {
      calls.push(["exit", code]);
      resolve();
    };
  });
  const server = {
    listening: true,
    close(callback) {
      calls.push(["close"]);
      this.listening = false;
      queueMicrotask(callback);
    },
    closeIdleConnections() {
      calls.push(["close-idle"]);
    },
  };
  const controller = createServerShutdownController({
    server,
    processRef,
    async stopOwnedProcesses() {
      calls.push(["stop-git"]);
    },
  });
  controller.attach();

  processRef.emit("message", { type: SERVER_SHUTDOWN_MESSAGE });
  await exited;

  assert.deepEqual(calls, [
    ["close"],
    ["close-idle"],
    ["stop-git"],
    ["exit", 0],
  ]);
});

test("server shutdown force-closes remaining HTTP connections after a bounded wait", async () => {
  const calls = [];
  const server = {
    listening: true,
    close() {
      calls.push("close");
      this.listening = false;
    },
    closeIdleConnections() {},
    closeAllConnections() {
      calls.push("close-all");
    },
  };
  const controller = createServerShutdownController({
    server,
    processRef: new EventEmitter(),
    stopOwnedProcesses: async () => {},
    closeTimeoutMs: 5,
  });

  const result = await controller.shutdown("test");

  assert.equal(result.forcedConnections, true);
  assert.deepEqual(calls, ["close", "close-all"]);
});

test("desktop shutdown removes the real server process and its owned helper process", async () => {
  const child = fork(path.join(__dirname, "fixtures", "shutdown-server-child.js"), [], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  const helperMessage = waitForMessage(child, "helper-started");
  const ready = waitForMessage(child, "ready");
  let helperPid = 0;
  try {
    helperPid = (await helperMessage).pid;
    await ready;
    assert.equal(processIsRunning(child.pid), true);
    assert.equal(processIsRunning(helperPid), true);

    const result = await shutdownServerProcess(child, { gracefulTimeoutMs: 4000 });

    assert.equal(result.mode, "graceful");
    assert.equal(await waitForProcessGone(child.pid), true);
    assert.equal(await waitForProcessGone(helperPid), true);
  } finally {
    if (processIsRunning(child.pid)) {
      await shutdownServerProcess(child, { gracefulTimeoutMs: 50, forceTimeoutMs: 100 });
    }
    if (helperPid && processIsRunning(helperPid)) {
      try {
        process.kill(helperPid, "SIGKILL");
      } catch {
        // The helper may finish while test cleanup is running.
      }
    }
  }
});
