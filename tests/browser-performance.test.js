"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { once } = require("node:events");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const serverPath = path.join(projectRoot, "server.js");
const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const browserExecutable = findChromiumExecutable();
const browserRequired = process.env.FORKLINE_REQUIRE_BROWSER === "1" || process.env.npm_lifecycle_event === "test:browser";
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: nullConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
  LC_ALL: "C",
  LANG: "C",
};

test("real Chromium keeps historical file comparison responsive", {
  skip: browserExecutable || browserRequired ? false : "No supported Chromium browser is installed",
  timeout: 120000,
}, async (t) => {
  assert.ok(browserExecutable, "Install Microsoft Edge, Google Chrome, or Chromium, or set FORKLINE_BROWSER_PATH");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-browser-performance-"));
  const repo = path.join(root, "repo");
  const profile = path.join(root, "browser-profile");
  let serverProcess = null;
  let browserProcess = null;
  let cdp = null;
  let serverLog = "";
  let browserLog = "";

  t.after(async () => {
    cdp?.close();
    await stopBrowser(browserProcess);
    await stopProcess(serverProcess);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const head = await createComparisonFixture(repo);
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env: {
      ...gitEnv,
      PORT: String(port),
      FORKLINE_NO_OPEN: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess.stdout.on("data", (chunk) => {
    serverLog = appendLog(serverLog, chunk);
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverLog = appendLog(serverLog, chunk);
  });
  await waitForServer(baseUrl, serverProcess, () => serverLog);
  await openRepository(baseUrl, repo);

  browserProcess = spawn(browserExecutable, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--window-size=1280,900",
    "about:blank",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  browserProcess.stdout.on("data", (chunk) => {
    browserLog = appendLog(browserLog, chunk);
  });
  browserProcess.stderr.on("data", (chunk) => {
    browserLog = appendLog(browserLog, chunk);
  });

  const devToolsPort = await waitForDevToolsPort(profile, browserProcess, () => browserLog);
  const target = await waitForPageTarget(devToolsPort, browserProcess, () => browserLog);
  cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: baseUrl });
  await waitForPageReady(cdp);

  const baselineResizeListeners = await countWindowListeners(cdp, "resize");
  const complex = await evaluate(cdp, `(async () => {
    let maxDelay = 0;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      maxDelay = Math.max(maxDelay, now - lastTick - 25);
      lastTick = now;
    }, 25);
    const openStarted = performance.now();
    const opened = await openCommitFileViewer("complex.c", "", ${JSON.stringify(head)});
    const openMs = performance.now() - openStarted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    clearInterval(timer);
    const scrollers = Array.from(document.querySelectorAll("#fileEditorMerge .CodeMirror-scroll"));
    const scrollStarted = performance.now();
    scrollers[0].scrollTop = 50000;
    scrollers[0].dispatchEvent(new Event("scroll"));
    const scrollMs = performance.now() - scrollStarted;
    const result = {
      opened,
      openMs,
      maxDelay,
      scrollMs,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
      status: document.querySelector("#fileEditorStatus").textContent,
      synchronized: scrollers.length === 2 && Math.abs(scrollers[0].scrollTop - scrollers[1].scrollTop) < 1,
    };
    const closeStarted = performance.now();
    closeFileEditor(true);
    result.closeMs = performance.now() - closeStarted;
    result.remainingCodeMirrors = document.querySelectorAll("#fileEditorMerge .CodeMirror").length;
    return result;
  })()`);

  assert.equal(complex.opened, true);
  assert.equal(complex.mergeViews, 0);
  assert.equal(complex.codeMirrors, 2);
  assert.equal(complex.compareHidden, true);
  assert.match(complex.status, /复杂文件轻量模式 · 行数较多/);
  assert.equal(complex.synchronized, true);
  assert.equal(complex.remainingCodeMirrors, 0);
  assert.ok(complex.openMs < 5000, `complex comparison opened in ${complex.openMs.toFixed(1)} ms`);
  assert.ok(complex.maxDelay < 1500, `complex comparison blocked the event loop for ${complex.maxDelay.toFixed(1)} ms`);
  assert.ok(complex.scrollMs < 250, `complex comparison scroll handler took ${complex.scrollMs.toFixed(1)} ms`);
  assert.ok(complex.closeMs < 250, `complex comparison close took ${complex.closeMs.toFixed(1)} ms`);
  const warmedResizeListeners = await countWindowListeners(cdp, "resize");
  assert.ok(
    warmedResizeListeners >= baselineResizeListeners && warmedResizeListeners <= baselineResizeListeners + 1,
    `CodeMirror warm-up changed resize listeners from ${baselineResizeListeners} to ${warmedResizeListeners}`
  );

  const scattered = await evaluate(cdp, `(async () => {
    const opened = await openCommitFileViewer("scattered.c", "", ${JSON.stringify(head)});
    const result = {
      opened,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
      status: document.querySelector("#fileEditorStatus").textContent,
    };
    closeFileEditor(true);
    return result;
  })()`);
  assert.equal(scattered.opened, true);
  assert.equal(scattered.mergeViews, 0);
  assert.equal(scattered.codeMirrors, 2);
  assert.equal(scattered.compareHidden, true);
  assert.match(scattered.status, /复杂文件轻量模式 · 差异较复杂/);
  assert.equal(await countWindowListeners(cdp, "resize"), warmedResizeListeners);

  const smallOpened = await evaluate(cdp, `(async () => {
    const started = performance.now();
    const opened = await openCommitFileViewer("small.c", "", ${JSON.stringify(head)});
    return {
      opened,
      openMs: performance.now() - started,
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      compareHidden: document.querySelector("#fileEditorCompareMode").hidden,
    };
  })()`);
  assert.equal(smallOpened.opened, true);
  assert.equal(smallOpened.mergeViews, 1);
  assert.equal(smallOpened.compareHidden, false);
  assert.ok(smallOpened.openMs < 2000, `small comparison opened in ${smallOpened.openMs.toFixed(1)} ms`);
  const smallResizeListeners = await countWindowListeners(cdp, "resize");
  assert.equal(smallResizeListeners, warmedResizeListeners + 1);

  const switches = await evaluate(cdp, `(() => {
    const modes = ["align", "connect", "align", "connect", "align", "connect", "align", "connect"];
    const started = performance.now();
    const results = modes.map((mode) => setFileEditorCompareMode(mode));
    return {
      elapsed: performance.now() - started,
      allSucceeded: results.every(Boolean),
      mergeViews: document.querySelectorAll("#fileEditorMerge .CodeMirror-merge").length,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
    };
  })()`);
  assert.equal(switches.allSucceeded, true);
  assert.equal(switches.mergeViews, 1);
  assert.equal(switches.codeMirrors, 2);
  assert.ok(switches.elapsed < 2000, `eight comparison switches took ${switches.elapsed.toFixed(1)} ms`);
  const switchedResizeListeners = await countWindowListeners(cdp, "resize");
  assert.equal(switchedResizeListeners, warmedResizeListeners + 1);

  const closed = await evaluate(cdp, `(() => {
    const started = performance.now();
    const result = closeFileEditor(true);
    return {
      result,
      elapsed: performance.now() - started,
      codeMirrors: document.querySelectorAll("#fileEditorMerge .CodeMirror").length,
    };
  })()`);
  assert.equal(closed.result, true);
  assert.equal(closed.codeMirrors, 0);
  assert.ok(closed.elapsed < 250, `small comparison close took ${closed.elapsed.toFixed(1)} ms`);
  const finalResizeListeners = await countWindowListeners(cdp, "resize");
  assert.equal(finalResizeListeners, warmedResizeListeners);
  t.diagnostic(
    `complex open ${complex.openMs.toFixed(1)} ms, max event-loop delay ${complex.maxDelay.toFixed(1)} ms, scroll ${complex.scrollMs.toFixed(1)} ms, close ${complex.closeMs.toFixed(1)} ms`
  );
  t.diagnostic(
    `small open ${smallOpened.openMs.toFixed(1)} ms, eight switches ${switches.elapsed.toFixed(1)} ms, resize listeners ${baselineResizeListeners} -> ${warmedResizeListeners} -> ${smallResizeListeners} -> ${switchedResizeListeners} -> ${finalResizeListeners}`
  );
});

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () => this.rejectPending(new Error("Chromium DevTools connection closed")));
    socket.addEventListener("error", () => this.rejectPending(new Error("Chromium DevTools connection failed")));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chromium DevTools")), 10000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Unable to connect to Chromium DevTools"));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Chromium DevTools connection is not open"));
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
    if (message.error) pending.reject(new Error(`${message.error.message || "DevTools command failed"} (${message.error.code || "unknown"})`));
    else pending.resolve(message.result || {});
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

async function createComparisonFixture(repo) {
  await fs.mkdir(repo, { recursive: true });
  await git("", ["init", "--initial-branch=main", repo]);
  await git(repo, ["config", "user.name", "Forkline Browser Test"]);
  await git(repo, ["config", "user.email", "forkline-browser@example.invalid"]);
  await git(repo, ["config", "core.autocrlf", "false"]);

  const complex = Array.from({ length: 60000 }, (_, index) => `x${index}`);
  const scattered = Array.from({ length: 240 }, (_, index) => `int item_${index} = ${index};`);
  const small = Array.from({ length: 30 }, (_, index) => `int small_${index} = ${index};`);
  await writeFixtureFiles(repo, complex, scattered, small);
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "add browser performance fixtures"]);

  complex[30000] = "x30000_changed";
  for (let index = 0; index < 40; index += 1) {
    const lineIndex = index * 5 + 1;
    scattered[lineIndex] = `int item_${lineIndex} = ${lineIndex + 1000};`;
  }
  small[10] = "int small_10 = 1000;";
  await writeFixtureFiles(repo, complex, scattered, small);
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "change browser performance fixtures"]);
  return git(repo, ["rev-parse", "HEAD"]);
}

async function writeFixtureFiles(repo, complex, scattered, small) {
  await Promise.all([
    fs.writeFile(path.join(repo, "complex.c"), `${complex.join("\n")}\n`, "utf8"),
    fs.writeFile(path.join(repo, "scattered.c"), `${scattered.join("\n")}\n`, "utf8"),
    fs.writeFile(path.join(repo, "small.c"), `${small.join("\n")}\n`, "utf8"),
  ]);
}

async function git(repo, args) {
  const fullArgs = repo ? ["-C", repo, ...args] : args;
  const { stdout } = await execFileAsync("git", fullArgs, {
    env: gitEnv,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return String(stdout || "").trim();
}

async function openRepository(baseUrl, repo) {
  const response = await fetch(`${baseUrl}/api/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: repo }),
  });
  if (!response.ok) throw new Error(`Unable to open browser performance fixture: ${await response.text()}`);
}

async function waitForServer(baseUrl, processHandle, readLog) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Forkline server exited early:\n${readLog()}`);
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Forkline server:\n${readLog()}`);
}

async function waitForDevToolsPort(profile, processHandle, readLog) {
  const activePortFile = path.join(profile, "DevToolsActivePort");
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Chromium exited before DevTools was ready:\n${readLog()}`);
    try {
      const [port] = (await fs.readFile(activePortFile, "utf8")).trim().split(/\r?\n/);
      if (Number(port) > 0) return Number(port);
    } catch {
      // Chromium is still creating its profile.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chromium DevTools port:\n${readLog()}`);
}

async function waitForPageTarget(port, processHandle, readLog) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Chromium exited before a page target was ready:\n${readLog()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
      // DevTools HTTP endpoint is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chromium page target:\n${readLog()}`);
}

async function waitForPageReady(cdp) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const ready = await evaluate(cdp, `Boolean(
        document.readyState === "complete" &&
        typeof state !== "undefined" &&
        state.data?.repo &&
        !state.data.repo.isSample &&
        typeof openCommitFileViewer === "function" &&
        typeof setFileEditorCompareMode === "function"
      )`);
      if (ready) return;
    } catch {
      // Navigation may still be replacing the execution context.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for the Forkline browser application");
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Browser evaluation failed";
    throw new Error(detail);
  }
  return response.result?.value;
}

async function countWindowListeners(cdp, type) {
  const objectGroup = `forkline-listeners-${Date.now()}-${Math.random()}`;
  const evaluated = await cdp.send("Runtime.evaluate", {
    expression: "window",
    objectGroup,
  });
  try {
    const objectId = evaluated.result?.objectId;
    if (!objectId) throw new Error("Unable to inspect Chromium window listeners");
    const response = await cdp.send("DOMDebugger.getEventListeners", { objectId });
    return response.listeners.filter((listener) => listener.type === type).length;
  } finally {
    await cdp.send("Runtime.releaseObjectGroup", { objectGroup }).catch(() => {});
  }
}

async function freePort() {
  const socket = net.createServer();
  socket.unref();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function stopProcess(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  const exited = once(processHandle, "exit");
  processHandle.kill();
  await Promise.race([exited, delay(3000)]);
  if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
}

async function stopBrowser(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(processHandle.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    return;
  }
  await stopProcess(processHandle);
}

function findChromiumExecutable() {
  const candidates = [
    process.env.FORKLINE_BROWSER_PATH,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "",
    process.platform === "win32" ? "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" : "",
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
    process.platform === "darwin" ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" : "",
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "",
    process.platform === "linux" ? "/usr/bin/microsoft-edge" : "",
    process.platform === "linux" ? "/usr/bin/google-chrome" : "",
    process.platform === "linux" ? "/usr/bin/chromium" : "",
    process.platform === "linux" ? "/usr/bin/chromium-browser" : "",
  ].filter(Boolean);
  return candidates.find((candidate) => fsSync.existsSync(candidate)) || "";
}

function appendLog(current, chunk) {
  return `${current}${String(chunk || "")}`.slice(-16000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
