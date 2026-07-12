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
const serverPath = path.join(projectRoot, "server.js");
const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: nullConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
  LC_ALL: "C",
  LANG: "C",
};

let baseUrl = "";
let serverProcess = null;
let serverLog = "";

test.before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
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
  serverProcess.stdout.on("data", (chunk) => appendServerLog(chunk));
  serverProcess.stderr.on("data", (chunk) => appendServerLog(chunk));
  await waitForServer();
});

test.after(async () => {
  await stopServer();
});

test("sample state localizes display metadata without translating commit data", async () => {
  const response = await request("/api/state", { locale: "en" });
  assertStatus(response, 200);
  assert.equal(response.body.repo.isSample, true);
  assert.equal(response.body.commits[0].time, "12 minutes ago");
  assert.equal(response.body.commits[0].message, "打磨提交图连线动画");
  assert.equal(response.body.branchCleanup[0].lastUpdated, "12 minutes ago");
  assert.match(response.body.sync.auth.summary, /SSH remote/);
  assert.doesNotMatch(response.body.sync.auth.summary, /[\u3400-\u9fff]/);
});

test("repository context headers support non-Latin paths and legacy ASCII values", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-repo-context-"));
  t.after(() => removeFixture(root));

  const unicodeRepo = path.join(root, "中文仓库");
  await initRepository(unicodeRepo);
  await openRepo(unicodeRepo);

  const encoded = await request("/api/state", { repoPath: unicodeRepo });
  assertStatus(encoded, 200);
  assert.equal(path.resolve(encoded.body.repo.path), path.resolve(unicodeRepo));

  const malformed = await request("/api/state", { repoPathHeader: "v1:%E0%A4%A" });
  assertStatus(malformed, 400);
  assert.match(malformed.body.error, /仓库上下文编码无效/);

  const legacyRepo = path.join(root, "legacy-repo");
  await initRepository(legacyRepo);
  await openRepo(legacyRepo);
  const legacy = await request("/api/state", { repoPathHeader: legacyRepo });
  assertStatus(legacy, 200);
  assert.equal(path.resolve(legacy.body.repo.path), path.resolve(legacyRepo));
});

test("backend locale follows the request without translating Git data", { timeout: 120000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forkline-i18n-"));
  t.after(() => removeFixture(root));

  const repo = path.join(root, "中文仓库");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "说明.txt"), "base\n", "utf8");
  await git(repo, ["add", "说明.txt"]);
  await git(repo, ["commit", "-m", "设置 分支 桌面"]);
  const state = await openRepo(repo);

  const englishState = await request("/api/state", { repoPath: repo, locale: "en-US" });
  assertStatus(englishState, 200);
  assert.equal(path.resolve(englishState.body.repo.path), path.resolve(repo));
  assert.equal(englishState.body.commits[0].message, "设置 分支 桌面");

  const englishError = await request("/api/state", { repoPathHeader: "v1:%E0%A4%A", locale: "en" });
  assertStatus(englishError, 400);
  assert.match(englishError.body.error, /repository context encoding is invalid/i);
  assert.doesNotMatch(englishError.body.error, /[\u3400-\u9fff]/);

  const unsupportedLocale = await request("/api/state", { repoPathHeader: "v1:%E0%A4%A", locale: "fr" });
  assertStatus(unsupportedLocale, 400);
  assert.match(unsupportedLocale.body.error, /仓库上下文编码无效/);

  const branch = "功能/保留中文";
  const created = await request("/api/action", {
    method: "POST",
    repoPath: repo,
    locale: "en",
    body: {
      action: "createBranch",
      branch,
      checkout: true,
      expectedBranch: state.repo.branch,
      expectedHead: state.repo.headSha,
      expectedWorktreeSnapshot: state.worktreeSnapshot,
    },
  });
  assertStatus(created, 200);
  assert.equal(created.body.output, `Created and switched to ${branch}`);
  const afterCreate = await request("/api/state", { repoPath: repo, locale: "en" });
  assertStatus(afterCreate, 200);
  assert.equal(afterCreate.body.repo.branch, branch);
});

test("ordinary parent stash still creates, applies, and pops", { timeout: 120000 }, async (t) => {
  const fixture = await createSubmoduleFixture("ordinary-stash");
  t.after(() => removeFixture(fixture.root));

  await fs.appendFile(fixture.notePath, "ordinary change\n", "utf8");
  let state = await openRepo(fixture.parent);
  assert.deepEqual(state.workingFiles.map((item) => item.file), ["note.txt"]);

  const created = await action(fixture.parent, state, {
    action: "createStash",
    message: "ordinary-control",
    files: [],
  });
  assertStatus(created, 200);

  state = await readState(fixture.parent);
  const stash = state.stashes.find((item) => item.message === "ordinary-control");
  assert.ok(stash, "ordinary stash should appear in state");
  assert.equal(await fs.readFile(fixture.notePath, "utf8"), "base\n");

  const applied = await action(fixture.parent, state, {
    action: "applyStash",
    ref: stash.ref,
    sha: stash.sha,
  });
  assertStatus(applied, 200);
  assert.match(await fs.readFile(fixture.notePath, "utf8"), /ordinary change/);

  state = await readState(fixture.parent);
  assert.ok(state.stashes.some((item) => item.sha === stash.sha), "apply should keep the stash");
  await git(fixture.parent, ["restore", "--source=HEAD", "--", "note.txt"]);

  state = await readState(fixture.parent);
  const popped = await action(fixture.parent, state, {
    action: "popStash",
    ref: stash.ref,
    sha: stash.sha,
  });
  assertStatus(popped, 200);
  assert.match(await fs.readFile(fixture.notePath, "utf8"), /ordinary change/);

  state = await readState(fixture.parent);
  assert.ok(!state.stashes.some((item) => item.sha === stash.sha), "pop should remove only the applied stash");
});

test("gitlink stash is rejected before creation and existing stash is preserved", { timeout: 120000 }, async (t) => {
  const fixture = await createSubmoduleFixture("gitlink-stash");
  t.after(() => removeFixture(fixture.root));

  await git(fixture.submodule, ["checkout", "--detach", fixture.childSecond]);
  await git(fixture.parent, ["add", "modules/child"]);
  let state = await openRepo(fixture.parent);

  const blockedCreate = await action(fixture.parent, state, {
    action: "createStash",
    message: "blocked-gitlink",
    files: [],
  });
  assertStatus(blockedCreate, 400);
  assert.match(blockedCreate.body.error, /子模块/);
  assert.equal(await git(fixture.parent, ["stash", "list", "--format=%H"]), "");
  assert.match(await git(fixture.parent, ["diff", "--cached", "--name-only"]), /modules\/child/);

  await git(fixture.parent, ["stash", "push", "-m", "gitlink-repro"]);
  await git(fixture.parent, ["-c", "protocol.file.allow=always", "submodule", "update", "--init", "--recursive"]);
  state = await openRepo(fixture.parent);
  const stash = state.stashes.find((item) => item.message === "gitlink-repro");
  assert.ok(stash, "direct Git stash should create the legacy gitlink fixture");

  const blockedApply = await action(fixture.parent, state, {
    action: "applyStash",
    ref: stash.ref,
    sha: stash.sha,
  });
  assertStatus(blockedApply, 400);
  assert.match(blockedApply.body.error, /gitlink/);

  state = await readState(fixture.parent);
  assert.ok(state.stashes.some((item) => item.sha === stash.sha), "blocked apply must preserve the stash");
  const current = state.stashes.find((item) => item.sha === stash.sha);
  const blockedPop = await action(fixture.parent, state, {
    action: "popStash",
    ref: current.ref,
    sha: current.sha,
  });
  assertStatus(blockedPop, 400);

  state = await readState(fixture.parent);
  assert.ok(state.stashes.some((item) => item.sha === stash.sha), "blocked pop must preserve the stash");
  assert.equal(await git(fixture.parent, ["status", "--short"]), "");
});

test("stash checkout rejects hidden dirty submodule before partial mutation", { timeout: 120000 }, async (t) => {
  const fixture = await createSubmoduleFixture("checkout-stash");
  t.after(() => removeFixture(fixture.root));

  await fs.appendFile(fixture.notePath, "parent change\n", "utf8");
  await fs.appendFile(fixture.childFile, "child change\n", "utf8");
  const parentStatus = await git(fixture.parent, ["status", "--short"]);
  assert.equal(parentStatus, "M note.txt", "ignore=dirty should hide the child modification from parent status");

  const state = await openRepo(fixture.parent);
  assert.equal(state.submodules[0].dirtyCount, 1);
  const targetSha = state.branchInfo.target?.sha || "";
  assert.ok(targetSha, "target branch SHA should be available");

  const blocked = await action(fixture.parent, state, {
    action: "checkoutBranch",
    branch: "target",
    mode: "stash",
    expectedTargetSha: targetSha,
  });
  assertStatus(blocked, 400);
  assert.match(blocked.body.error, /子模块/);

  assert.equal(await git(fixture.parent, ["branch", "--show-current"]), "main");
  assert.match(await fs.readFile(fixture.notePath, "utf8"), /parent change/);
  assert.match(await git(fixture.submodule, ["status", "--short"]), /child\.txt/);
  assert.equal(await git(fixture.parent, ["stash", "list", "--format=%H"]), "");
});

test("authentication diagnostics load on demand and cache by remote configuration", { timeout: 120000 }, async (t) => {
  const fixture = await createRemoteFixture("auth-diagnostics");
  t.after(() => removeFixture(fixture.root));

  const state = await openRepo(fixture.repo);
  assert.equal(Object.hasOwn(state.sync, "auth"), false, "full state refresh should not probe local authentication tools");

  const missingContext = await request("/api/auth-diagnostics");
  assertStatus(missingContext, 400);
  assert.match(missingContext.body.error, /仓库上下文/);

  const first = await request("/api/auth-diagnostics", { repoPath: fixture.repo });
  assertStatus(first, 200);
  assert.equal(first.body.cached, false);
  assert.match(first.body.summary, /远端/);
  assert.ok(first.body.advice);
  assert.equal(first.body.remotes[0].kind, "https");
  assert.ok(first.body.ssh && first.body.agent && first.body.credentialManager);
  assert.ok(Array.isArray(first.body.commands));

  const second = await request("/api/auth-diagnostics", { repoPath: fixture.repo });
  assertStatus(second, 200);
  assert.equal(second.body.cached, true);
  assert.equal(second.body.checkedAt, first.body.checkedAt);

  const refreshed = await request("/api/auth-diagnostics?refresh=1", { repoPath: fixture.repo });
  assertStatus(refreshed, 200);
  assert.equal(refreshed.body.cached, false, "manual refresh must bypass the authentication diagnostics cache");

  await git(fixture.repo, ["remote", "set-url", "origin", "git@github.com:example/forkline-auth.git"]);
  const changedRemote = await request("/api/auth-diagnostics", { repoPath: fixture.repo });
  assertStatus(changedRemote, 200);
  assert.equal(changedRemote.body.cached, false, "changed remote URLs must not reuse stale authentication diagnostics");
  assert.equal(changedRemote.body.remotes[0].kind, "ssh");
});

test("optimized state reads preserve worktree and sync semantics", { timeout: 120000 }, async (t) => {
  const fixture = await createStateSnapshotFixture("state-snapshot");
  t.after(() => removeFixture(fixture.root));

  await fs.writeFile(fixture.draftPath, "untracked\n", "utf8");
  let state = await openRepo(fixture.repo);
  assert.equal(state.repo.branch, "main");
  assert.equal(state.sync.branch, "main");
  assert.equal(state.sync.detached, false);
  assert.equal(state.sync.unborn, false);
  assert.equal(state.sync.upstream, "origin/main");
  assert.equal(state.sync.upstreamSha, fixture.remoteSha);
  assert.equal(state.sync.ahead, 1);
  assert.equal(state.sync.behind, 0);
  assert.deepEqual(state.workingFiles.map((item) => item.file), ["draft.txt"]);
  const currentWorktree = state.worktrees.find((item) => path.resolve(item.path) === path.resolve(fixture.repo));
  assert.ok(currentWorktree, "current worktree should remain in the optimized state response");
  assert.equal(currentWorktree.status, "dirty");
  assert.equal(currentWorktree.dirtyCount, 1);
  assert.deepEqual(state.submodules, []);
  assert.equal(state.sync.remotes[0].name, "origin");
  assert.equal(Object.hasOwn(state, "reflogEntries"), false, "full state should not include recovery-tab reflog data");

  const missingReflogContext = await request("/api/reflog");
  assertStatus(missingReflogContext, 400);
  assert.match(missingReflogContext.body.error, /仓库上下文/);
  const reflog = await request("/api/reflog", { repoPath: fixture.repo });
  assertStatus(reflog, 200);
  assert.ok(reflog.body.reflogEntries.length > 0);
  assert.match(reflog.body.reflogEntries[0].selector, /^HEAD@\{.+\}$/);
  assert.equal(reflog.body.reflogEntries[0].sha, state.repo.headSha);

  await git(fixture.repo, ["switch", "--detach", "HEAD"]);
  state = await openRepo(fixture.repo);
  assert.equal(state.repo.branch, "detached HEAD");
  assert.equal(state.sync.branch, "HEAD");
  assert.equal(state.sync.detached, true);

  const unbornRepo = path.join(fixture.root, "unborn");
  await initRepository(unbornRepo);
  state = await openRepo(unbornRepo);
  assert.equal(state.repo.branch, "main");
  assert.equal(state.sync.branch, "main");
  assert.equal(state.sync.unborn, true);
  assert.equal(state.sync.detached, false);
  assert.equal(state.sync.upstream, "");
  const unbornReflog = await request("/api/reflog", { repoPath: unbornRepo });
  assertStatus(unbornReflog, 200);
  assert.deepEqual(unbornReflog.body.reflogEntries, []);
});

async function createStateSnapshotFixture(label) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const repo = path.join(root, "repo");
  const remote = path.join(root, "remote.git");
  const notePath = path.join(repo, "note.txt");
  const draftPath = path.join(repo, "draft.txt");
  await initRepository(repo);
  await fs.writeFile(notePath, "base\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  const remoteSha = await git(repo, ["rev-parse", "HEAD"]);
  await git("", ["init", "--bare", "--initial-branch=main", remote]);
  await git(repo, ["remote", "add", "origin", remote]);
  await git(repo, ["push", "-u", "origin", "main"]);
  await fs.appendFile(notePath, "local ahead\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "local-ahead"]);
  return { root, repo, remote, notePath, draftPath, remoteSha };
}

async function createRemoteFixture(label) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const repo = path.join(root, "repo");
  await initRepository(repo);
  await fs.writeFile(path.join(repo, "note.txt"), "base\n", "utf8");
  await git(repo, ["add", "note.txt"]);
  await git(repo, ["commit", "-m", "base"]);
  await git(repo, ["remote", "add", "origin", "https://github.com/example/forkline-auth.git"]);
  return { root, repo };
}

async function createSubmoduleFixture(label) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `forkline-${label}-`));
  const childSource = path.join(root, "child-source");
  const parent = path.join(root, "parent");
  const submodule = path.join(parent, "modules", "child");
  const childFile = path.join(submodule, "child.txt");
  const notePath = path.join(parent, "note.txt");

  await initRepository(childSource);
  await fs.writeFile(path.join(childSource, "child.txt"), "one\n", "utf8");
  await git(childSource, ["add", "child.txt"]);
  await git(childSource, ["commit", "-m", "child-one"]);
  const childFirst = await git(childSource, ["rev-parse", "HEAD"]);
  await fs.writeFile(path.join(childSource, "child.txt"), "two\n", "utf8");
  await git(childSource, ["add", "child.txt"]);
  await git(childSource, ["commit", "-m", "child-two"]);
  const childSecond = await git(childSource, ["rev-parse", "HEAD"]);

  await initRepository(parent);
  await fs.writeFile(notePath, "base\n", "utf8");
  await git(parent, ["-c", "protocol.file.allow=always", "submodule", "add", childSource, "modules/child"]);
  await git(submodule, ["checkout", "--detach", childFirst]);
  await git(parent, ["add", "."]);
  await git(parent, ["commit", "-m", "parent-base"]);

  await git(parent, ["switch", "-c", "target"]);
  await git(submodule, ["checkout", "--detach", childSecond]);
  await git(parent, ["add", "modules/child"]);
  await git(parent, ["commit", "-m", "target-gitlink"]);
  await git(parent, ["-c", "submodule.recurse=false", "switch", "main"]);
  await git(submodule, ["checkout", "--detach", childFirst]);
  await git(parent, ["config", "submodule.recurse", "true"]);
  await git(parent, ["config", "submodule.modules/child.ignore", "dirty"]);
  assert.equal(await git(parent, ["status", "--short"]), "");

  return { root, parent, submodule, childFile, notePath, childFirst, childSecond };
}

async function initRepository(repoPath) {
  await fs.mkdir(repoPath, { recursive: true });
  await git("", ["init", "--initial-branch=main", repoPath]);
  await git(repoPath, ["config", "user.name", "Forkline Test"]);
  await git(repoPath, ["config", "user.email", "forkline@example.invalid"]);
  await git(repoPath, ["config", "core.autocrlf", "false"]);
}

async function git(repoPath, args) {
  const fullArgs = repoPath ? ["-C", repoPath, ...args] : args;
  try {
    const { stdout } = await execFileAsync("git", fullArgs, {
      env: gitEnv,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return String(stdout || "").trim();
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n");
    throw new Error(`git ${fullArgs.join(" ")} failed:\n${detail}`);
  }
}

async function openRepo(repoPath) {
  const response = await request("/api/open", {
    method: "POST",
    body: { path: repoPath },
  });
  assertStatus(response, 200);
  return response.body;
}

async function readState(repoPath) {
  const response = await request("/api/state", { repoPath });
  assertStatus(response, 200);
  return response.body;
}

async function action(repoPath, state, payload) {
  return request("/api/action", {
    method: "POST",
    repoPath,
    body: {
      expectedBranch: state.repo.branch,
      expectedHead: state.repo.headSha,
      expectedWorktreeSnapshot: state.worktreeSnapshot,
      ...payload,
    },
  });
}

async function request(pathname, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.locale) headers["X-Forkline-Locale"] = options.locale;
  if (Object.hasOwn(options, "repoPathHeader")) {
    headers["X-Forkline-Repo-Path"] = options.repoPathHeader;
  } else if (options.repoPath) {
    headers["X-Forkline-Repo-Path"] = `v1:${encodeURIComponent(options.repoPath)}`;
  }
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { error: raw || "响应不是 JSON" };
  }
  return { status: response.status, body };
}

function assertStatus(response, expected) {
  assert.equal(
    response.status,
    expected,
    `HTTP ${response.status}, expected ${expected}\n${JSON.stringify(response.body, null, 2)}\nServer log:\n${serverLog}`
  );
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

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Forkline server exited early:\n${serverLog}`);
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Forkline server:\n${serverLog}`);
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  const exited = once(serverProcess, "exit");
  serverProcess.kill();
  await Promise.race([exited, delay(5000)]);
  if (serverProcess.exitCode === null) serverProcess.kill("SIGKILL");
}

async function removeFixture(root) {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function appendServerLog(chunk) {
  serverLog = `${serverLog}${String(chunk || "")}`.slice(-12000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
