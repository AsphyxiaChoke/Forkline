"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { once } = require("node:events");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const packagedElectronExecutable = String(process.env.FORKLINE_ELECTRON_EXE || "").trim();
const electronExecutable = packagedElectronExecutable || path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe");
const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const cdpCommandTimeoutMs = 15000;

test("Electron standalone file editor stays responsive during rapid wheel scrolling", {
  skip: process.platform === "win32" ? false : "Windows Electron regression",
  timeout: 120000,
}, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-electron-editor-scroll-"));
  const repo = path.join(root, "repo");
  const appData = path.join(root, "appdata");
  const localAppData = path.join(root, "localappdata");
  const port = await freePort();
  let electronProcess = null;
  let mainCdp = null;
  let editorCdp = null;
  let electronLog = "";

  t.after(async () => {
    editorCdp?.close();
    mainCdp?.close();
    await stopProcessTree(electronProcess);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  await createFixture(repo);
  await fs.mkdir(appData, { recursive: true });
  await fs.mkdir(localAppData, { recursive: true });

  electronProcess = spawn(electronExecutable, [
    ...(packagedElectronExecutable ? [] : [projectRoot]),
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${localAppData}`,
    repo,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      APPDATA: appData,
      LOCALAPPDATA: localAppData,
      GIT_CONFIG_GLOBAL: nullConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
      ELECTRON_ENABLE_LOGGING: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  electronProcess.stdout.on("data", (chunk) => {
    electronLog = appendLog(electronLog, chunk);
  });
  electronProcess.stderr.on("data", (chunk) => {
    electronLog = appendLog(electronLog, chunk);
  });

  const mainTarget = await waitForTarget(port, electronProcess, () => electronLog, (target) => (
    target.type === "page" && !target.url.includes("fileEditorWindow=1")
  ));
  mainCdp = await CdpClient.connect(mainTarget.webSocketDebuggerUrl);
  await mainCdp.send("Runtime.enable");
  await waitForExpression(mainCdp, `Boolean(
    document.readyState === "complete" &&
    typeof state !== "undefined" &&
    state.data?.repo?.path &&
    typeof refreshWorktree === "function"
  )`);

  const opened = await evaluate(mainCdp, `(async () => {
    await refreshWorktree(false);
    renderStage({ refreshDiff: false });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const row = document.querySelector('#changeList [data-select-file][data-file="large-scroll.c"]');
    row?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    return Boolean(row);
  })()`);
  assert.equal(opened, true, "large worktree file row was not available for double-click");

  const editorTarget = await waitForTarget(port, electronProcess, () => electronLog, (target) => (
    target.type === "page" && target.url.includes("fileEditorWindow=1")
  ));
  editorCdp = await CdpClient.connect(editorTarget.webSocketDebuggerUrl);
  await editorCdp.send("Runtime.enable");
  await waitForExpression(editorCdp, `Boolean(
    document.readyState === "complete" &&
    state.fileEditor?.file === "large-scroll.c" &&
    state.fileEditor?.loading === false &&
    document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll").length === 2
  )`, 30000);

  const prepared = await evaluate(editorCdp, `(() => {
    const panes = Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"));
    panes.forEach((pane) => { pane.scrollTop = 0; });
    const traces = panes.map(() => []);
    const handlers = panes.map((pane, index) => () => traces[index].push(pane.scrollTop));
    panes.forEach((pane, index) => pane.addEventListener("scroll", handlers[index], { passive: true }));
    const heartbeat = { ticks: 0, maxDelay: 0, last: performance.now() };
    const timer = setInterval(() => {
      const now = performance.now();
      heartbeat.maxDelay = Math.max(heartbeat.maxDelay, now - heartbeat.last - 16);
      heartbeat.last = now;
      heartbeat.ticks += 1;
    }, 16);
    const longTasks = [];
    const observer = typeof PerformanceObserver === "function"
      ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
      : null;
    observer?.observe({ type: "longtask", buffered: true });
    window.__forklineElectronScrollTest = { panes, traces, handlers, heartbeat, timer, longTasks, observer };
    const rect = panes[0].getBoundingClientRect();
    return {
      x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
      paneCount: panes.length,
    };
  })()`);
  assert.equal(prepared.paneCount, 2);

  await editorCdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: prepared.x,
    y: prepared.y,
    buttons: 0,
  });
  for (let index = 0; index < 240; index += 1) {
    await editorCdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: prepared.x,
      y: prepared.y,
      deltaX: 0,
      deltaY: 720,
    });
    if (index % 20 === 19) await delay(4);
  }

  const metrics = await evaluate(editorCdp, `(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const session = window.__forklineElectronScrollTest;
    clearInterval(session.timer);
    session.observer?.disconnect();
    session.panes.forEach((pane, index) => pane.removeEventListener("scroll", session.handlers[index]));
    const upwardJumps = session.traces.map((trace) => trace.reduce(
      (maximum, top, index) => Math.max(maximum, index ? trace[index - 1] - top : 0),
      0
    ));
    const ratios = session.panes.map((pane) => pane.scrollTop / Math.max(1, pane.scrollHeight - pane.clientHeight));
    const result = {
      tops: session.panes.map((pane) => pane.scrollTop),
      traceLengths: session.traces.map((trace) => trace.length),
      upwardJumps,
      ratioSpread: Math.max(...ratios) - Math.min(...ratios),
      heartbeatTicks: session.heartbeat.ticks,
      maxHeartbeatDelay: session.heartbeat.maxDelay,
      maxLongTask: Math.max(0, ...session.longTasks),
      longTaskCount: session.longTasks.length,
    };
    delete window.__forklineElectronScrollTest;
    return result;
  })()`);

  t.diagnostic(
    `Electron editor wheel: traces ${metrics.traceLengths.join("/")}, tops ${metrics.tops.map((top) => top.toFixed(1)).join("/")}, upward ${metrics.upwardJumps.map((jump) => jump.toFixed(1)).join("/")}, ratio spread ${metrics.ratioSpread.toFixed(4)}, heartbeat ${metrics.heartbeatTicks} ticks / ${metrics.maxHeartbeatDelay.toFixed(1)} ms max delay, long tasks ${metrics.longTaskCount} / ${metrics.maxLongTask.toFixed(1)} ms max`
  );
  assert.ok(metrics.traceLengths.every((length) => length > 0), "rapid wheel did not produce scroll events in both panes");
  assert.ok(metrics.tops.every((top) => top > 0), "rapid wheel did not move both panes downward");
  assert.ok(Math.max(...metrics.upwardJumps) <= 2, "rapid wheel moved an editor pane upward");
  assert.ok(metrics.ratioSpread <= 0.02, `rapid wheel left panes ${metrics.ratioSpread.toFixed(4)} apart`);
  assert.ok(metrics.heartbeatTicks >= 10, "standalone editor heartbeat stopped during wheel scrolling");
  assert.ok(metrics.maxHeartbeatDelay < 500, `standalone editor blocked for ${metrics.maxHeartbeatDelay.toFixed(1)} ms`);
  assert.ok(metrics.maxLongTask < 500, `standalone editor produced a ${metrics.maxLongTask.toFixed(1)} ms long task`);
  assert.equal(await evaluate(editorCdp, "document.title"), "Forkline 编辑器");
});

async function createFixture(repo) {
  await fs.mkdir(repo, { recursive: true });
  await git("", ["init", "--initial-branch=main", repo]);
  await git(repo, ["config", "user.name", "Forkline Electron Test"]);
  await git(repo, ["config", "user.email", "forkline-electron@example.invalid"]);
  await git(repo, ["config", "core.autocrlf", "false"]);
  const original = Array.from({ length: 60000 }, (_, index) => `int scroll_${String(index).padStart(5, "0")} = ${index};`);
  await fs.writeFile(path.join(repo, "large-scroll.c"), `${original.join("\n")}\n`, "utf8");
  await git(repo, ["add", "large-scroll.c"]);
  await git(repo, ["commit", "-m", "add large scroll fixture"]);
  for (let index = 0; index < original.length; index += 500) original[index] += " // changed";
  await fs.writeFile(path.join(repo, "large-scroll.c"), `${original.join("\n")}\n`, "utf8");
}

async function git(repo, args) {
  const fullArgs = repo ? ["-C", repo, ...args] : args;
  await execFileAsync("git", fullArgs, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: nullConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
    },
  });
}

async function freePort() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForTarget(port, processHandle, readLog, predicate) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Electron exited early:\n${readLog()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.webSocketDebuggerUrl && predicate(item));
      if (target) return target;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for Electron DevTools target:\n${readLog()}`);
}

async function waitForExpression(cdp, expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for Electron expression: ${expression}`);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Electron evaluation failed";
    throw new Error(detail);
  }
  return response.result?.value;
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () => this.rejectPending(new Error("Electron DevTools connection closed")));
    socket.addEventListener("error", () => this.rejectPending(new Error("Electron DevTools connection failed")));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Electron DevTools")), 10000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Unable to connect to Electron DevTools"));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Electron DevTools connection is not open"));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`Timed out waiting for Electron DevTools command: ${method}`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
  }

  handleMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data || ""));
    } catch {
      return;
    }
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(`${message.error.message || "DevTools command failed"} (${message.error.code || "unknown"})`));
    else pending.resolve(message.result || {});
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function stopProcessTree(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(processHandle.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    return;
  }
  const exited = once(processHandle, "exit");
  processHandle.kill();
  await Promise.race([exited, delay(3000)]);
  if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
}

function appendLog(current, chunk) {
  return `${current}${String(chunk || "")}`.slice(-20000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
