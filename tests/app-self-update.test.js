"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const { createUpdateService } = require("../server/update-service");
const {
  cleanupCandidateRef,
  isOfficialForklineRemote,
  normalizeRepositoryRemote,
  prepareSelfUpdate,
  readSelfUpdateStatus,
  recoverWorkingTree,
  rollbackWorkingTree,
  runSelfUpdatePlan,
  selfUpdateStatusFile,
  updateWorkingTree,
  writeSelfUpdateStatus,
} = require("../app-self-update");

const serverSource = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const updateServiceSource = fs.readFileSync(path.resolve(__dirname, "..", "server", "update-service.js"), "utf8");
const updaterSource = fs.readFileSync(path.resolve(__dirname, "..", "app-self-update.js"), "utf8");

test("self update only accepts the official Forkline repository", () => {
  assert.equal(normalizeRepositoryRemote("https://github.com/AsphyxiaChoke/Forkline.git"), "github.com/asphyxiachoke/forkline");
  assert.equal(normalizeRepositoryRemote("git@github.com:AsphyxiaChoke/Forkline.git"), "github.com/asphyxiachoke/forkline");
  assert.equal(isOfficialForklineRemote("ssh://git@github.com/AsphyxiaChoke/Forkline.git"), true);
  assert.equal(isOfficialForklineRemote("https://github.com/example/Forkline.git"), false);
});

test("self update fast-forwards to the release commit and can roll back with reset --keep", async (t) => {
  const fixture = createUpdateFixture(1);
  t.after(() => fixture.cleanup());
  const repoDir = fixture.clones[0];
  const allowRemote = localRemoteGuard(fixture.remote);
  const plan = await prepareSelfUpdate({
    repoDir,
    currentVersion: "0.2.0",
    targetVersion: "0.3.0",
    tagName: "v0.3.0",
    gitBin: "git",
    port: 5177,
    parentPid: process.pid,
    allowRemote,
  });

  assert.equal(plan.expectedHead, fixture.oldSha);
  assert.equal(plan.targetSha, fixture.targetSha);
  const untouchedRecovery = await recoverWorkingTree(plan);
  assert.equal(untouchedRecovery.state, "not-needed");
  assert.match(untouchedRecovery.message, /尚未写入|无需回退/);
  await updateWorkingTree(plan, { allowRemote });
  assert.equal(git(repoDir, ["rev-parse", "HEAD"]), fixture.targetSha);
  assert.equal(JSON.parse(fs.readFileSync(path.join(repoDir, "package.json"), "utf8")).version, "0.3.0");

  assert.equal(await rollbackWorkingTree(plan), true);
  assert.equal(git(repoDir, ["rev-parse", "HEAD"]), fixture.oldSha);
  assert.equal(JSON.parse(fs.readFileSync(path.join(repoDir, "package.json"), "utf8")).version, "0.2.0");
  await cleanupCandidateRef(plan);
});

test("self update blocks dirty and diverged Forkline checkouts", async (t) => {
  const fixture = createUpdateFixture(2);
  t.after(() => fixture.cleanup());
  const allowRemote = localRemoteGuard(fixture.remote);
  fs.writeFileSync(path.join(fixture.clones[0], "local-note.txt"), "dirty\n", "utf8");
  await assert.rejects(
    prepareSelfUpdate({
      repoDir: fixture.clones[0],
      currentVersion: "0.2.0",
      targetVersion: "0.3.0",
      tagName: "v0.3.0",
      gitBin: "git",
      port: 5177,
      parentPid: process.pid,
      allowRemote,
    }),
    /有未提交修改/
  );

  fs.writeFileSync(path.join(fixture.clones[1], "local-commit.txt"), "local\n", "utf8");
  git(fixture.clones[1], ["add", "local-commit.txt"]);
  git(fixture.clones[1], ["commit", "-m", "local commit"]);
  await assert.rejects(
    prepareSelfUpdate({
      repoDir: fixture.clones[1],
      currentVersion: "0.2.0",
      targetVersion: "0.3.0",
      tagName: "v0.3.0",
      gitBin: "git",
      port: 5177,
      parentPid: process.pid,
      allowRemote,
    }),
    /本地提交|偏离正式版本/
  );
  assert.equal(git(fixture.clones[1], ["for-each-ref", "--format=%(refname)", "refs/forkline/self-update"]), "");
});

test("self update status survives restart and terminal results can be consumed", (t) => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-update-status-"));
  t.after(() => fs.rmSync(repoDir, { recursive: true, force: true }));
  const statusFile = selfUpdateStatusFile(repoDir);
  t.after(() => fs.rmSync(statusFile, { force: true }));
  writeSelfUpdateStatus(statusFile, { state: "success", targetVersion: "0.3.0", message: "ok" });
  assert.equal(readSelfUpdateStatus(statusFile).state, "success");
  assert.equal(readSelfUpdateStatus(statusFile, { consume: true }).targetVersion, "0.3.0");
  assert.equal(readSelfUpdateStatus(statusFile), null);
});

test("self update preflight failures report that files were not changed", async (t) => {
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-update-preflight-"));
  const statusFile = selfUpdateStatusFile(appDir);
  const previousVersion = process.env.FORKLINE_APP_VERSION;
  process.env.FORKLINE_APP_VERSION = "0.2.0";
  t.after(() => {
    if (previousVersion === undefined) delete process.env.FORKLINE_APP_VERSION;
    else process.env.FORKLINE_APP_VERSION = previousVersion;
    fs.rmSync(statusFile, { force: true });
    fs.rmSync(appDir, { recursive: true, force: true });
  });
  const service = createUpdateService({
    appDir,
    port: 5177,
    gitBin: "git",
    getManagedRepo: () => "D:\\ManagedRepo",
    hasBusyOperations: () => false,
    readJson: async () => ({ version: "0.3.0" }),
    sendJson: () => assert.fail("预检失败不应发送成功响应"),
    scheduleShutdown: () => assert.fail("预检失败不应关闭服务"),
  });

  await assert.rejects(
    service.handleRequest({ method: "POST" }, {}, { pathname: "/api/app-update/install" }),
    (error) => {
      assert.equal(error.updateStatus?.failedStage, "preflight");
      assert.equal(error.updateStatus?.rollbackState, "not-needed");
      assert.equal(error.updateStatus?.serviceState, "unchanged");
      return true;
    }
  );
  const status = readSelfUpdateStatus(statusFile);
  assert.equal(status?.state, "error");
  assert.equal(status?.failedStage, "preflight");
  assert.match(status?.recoveryMessage || "", /原版本仍在运行/);
});

test("self update API keeps JSON confirmation and avoids destructive reset modes", () => {
  assert.match(serverSource, /createUpdateService\([\s\S]*?getManagedRepo: \(\) => currentRepo[\s\S]*?scheduleShutdown: scheduleSelfUpdateShutdown/);
  assert.match(serverSource, /await updateService\.handleRequest\(req, res, parsed\)/);
  assert.match(updateServiceSource, /req\.method === "POST" && parsed\.pathname === "\/api\/app-update\/install"/);
  assert.match(updateServiceSource, /const body = await readJson\(req\);[\s\S]*?prepareLaunch\(body\)/);
  assert.match(updateServiceSource, /managedRepo: getManagedRepo\(\) \|\| ""/);
  assert.match(updateServiceSource, /failedStage: "preflight"/);
  assert.match(serverSource, /error\?\.updateStatus/);
  assert.match(updateServiceSource, /scheduleShutdown\(\)/);
  assert.match(updaterSource, /\["merge", "--ff-only", plan\.targetSha\]/);
  assert.match(updaterSource, /\["reset", "--keep", plan\.expectedHead\]/);
  assert.doesNotMatch(updaterSource, /reset", "--hard/);
});

test("self update runner exits the old process, starts the new service, and reports success", async () => {
  const fixture = createUpdateFixture(1);
  const repoDir = fixture.clones[0];
  const allowRemote = localRemoteGuard(fixture.remote);
  const port = await freePort();
  const blocker = await startBlockingProcess();
  let serverPid = 0;
  let plan = null;
  try {
    plan = await prepareSelfUpdate({
      repoDir,
      currentVersion: "0.2.0",
      targetVersion: "0.3.0",
      tagName: "v0.3.0",
      gitBin: "git",
      port,
      parentPid: blocker.pid,
      managedRepo: repoDir,
      allowRemote,
    });
    setTimeout(() => {
      try {
        process.kill(blocker.pid);
      } catch {}
    }, 300);
    const result = await runSelfUpdatePlan(plan, { allowRemote });
    const status = readSelfUpdateStatus(plan.statusFile);
    serverPid = Number(status?.serverPid || 0);
    assert.equal(result.ok, true);
    assert.equal(status?.state, "success");
    assert.equal(status?.step, 6);
    assert.equal(status?.totalSteps, 6);
    assert.equal(status?.phase, "complete");
    assert.equal(status?.targetVersion, "0.3.0");
    assert.equal(status?.repoPath, repoDir);
    assert.ok(serverPid > 0);
    assert.match(await readUrl(port), /Forkline v0\.3\.0/);
    assert.equal(git(repoDir, ["rev-parse", "HEAD"]), fixture.targetSha);
  } finally {
    try {
      process.kill(blocker.pid);
    } catch {}
    if (!serverPid && plan?.statusFile) serverPid = Number(readSelfUpdateStatus(plan.statusFile)?.serverPid || 0);
    if (serverPid) {
      try {
        process.kill(serverPid);
      } catch {}
    }
    if (plan?.statusFile) fs.rmSync(plan.statusFile, { force: true });
    fixture.cleanup();
  }
});

test("self update runner rolls back and restarts the old service when the new service fails", async () => {
  const fixture = createUpdateFixture(1, { brokenTargetServer: true });
  const repoDir = fixture.clones[0];
  const allowRemote = localRemoteGuard(fixture.remote);
  const port = await freePort();
  const blocker = await startBlockingProcess();
  let serverPid = 0;
  let plan = null;
  try {
    plan = await prepareSelfUpdate({
      repoDir,
      currentVersion: "0.2.0",
      targetVersion: "0.3.0",
      tagName: "v0.3.0",
      gitBin: "git",
      port,
      parentPid: blocker.pid,
      managedRepo: repoDir,
      allowRemote,
    });
    setTimeout(() => {
      try {
        process.kill(blocker.pid);
      } catch {}
    }, 300);
    const result = await runSelfUpdatePlan(plan, { allowRemote, serverTimeoutMs: 1600 });
    const status = readSelfUpdateStatus(plan.statusFile);
    serverPid = Number(status?.serverPid || 0);
    assert.equal(result.ok, false);
    assert.equal(result.rolledBack, true);
    assert.equal(status?.state, "error");
    assert.equal(status?.failedStage, "checking");
    assert.equal(status?.rollbackState, "complete");
    assert.equal(status?.serviceState, "restored");
    assert.match(status?.recoveryMessage || "", /恢复到更新前版本/);
    assert.match(status?.message || "", /已恢复到更新前版本/);
    assert.equal(status?.repoPath, repoDir);
    assert.equal(status?.rolledBack, true);
    assert.ok(serverPid > 0);
    assert.match(await readUrl(port), /Forkline v0\.2\.0/);
    assert.equal(git(repoDir, ["rev-parse", "HEAD"]), fixture.oldSha);
  } finally {
    try {
      process.kill(blocker.pid);
    } catch {}
    if (!serverPid && plan?.statusFile) serverPid = Number(readSelfUpdateStatus(plan.statusFile)?.serverPid || 0);
    if (serverPid) {
      try {
        process.kill(serverPid);
      } catch {}
    }
    if (plan?.statusFile) fs.rmSync(plan.statusFile, { force: true });
    fixture.cleanup();
  }
});

function createUpdateFixture(cloneCount, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-self-update-"));
  const remote = path.join(root, "remote.git");
  const source = path.join(root, "source");
  git(root, ["init", "--bare", "--initial-branch=main", remote]);
  fs.mkdirSync(source);
  git(source, ["init", "--initial-branch=main"]);
  configureIdentity(source);
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ name: "forkline", version: "0.2.0", private: true }, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(source, "server.js"), testServerSource("0.2.0"), "utf8");
  git(source, ["add", "."]);
  git(source, ["commit", "-m", "v0.2.0"]);
  const oldSha = git(source, ["rev-parse", "HEAD"]);
  git(source, ["remote", "add", "origin", remote]);
  git(source, ["push", "-u", "origin", "main"]);

  const clones = [];
  for (let index = 0; index < cloneCount; index += 1) {
    const clone = path.join(root, `clone-${index}`);
    git(root, ["-c", "core.autocrlf=false", "clone", remote, clone]);
    configureIdentity(clone);
    clones.push(clone);
  }

  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ name: "forkline", version: "0.3.0", private: true }, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(source, "server.js"), options.brokenTargetServer ? "process.exit(1);\n" : testServerSource("0.3.0"), "utf8");
  git(source, ["add", "."]);
  git(source, ["commit", "-m", "v0.3.0"]);
  git(source, ["tag", "-a", "v0.3.0", "-m", "v0.3.0"]);
  const targetSha = git(source, ["rev-parse", "HEAD"]);
  git(source, ["push", "origin", "main", "--tags"]);

  return {
    clones,
    oldSha,
    remote,
    targetSha,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function localRemoteGuard(expected) {
  const normalized = path.resolve(expected).toLowerCase();
  return (value) => path.resolve(String(value || "")).toLowerCase() === normalized;
}

function configureIdentity(repoDir) {
  git(repoDir, ["config", "user.name", "Forkline Test"]);
  git(repoDir, ["config", "user.email", "forkline@example.test"]);
  git(repoDir, ["config", "core.autocrlf", "false"]);
}

function testServerSource(version) {
  return `"use strict";\nconst http = require("http");\nconst port = Number(process.env.PORT);\nhttp.createServer((_req, res) => {\n  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });\n  res.end("<title>Forkline</title>Forkline v${version}");\n}).listen(port, "127.0.0.1");\n`;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startBlockingProcess() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
    child.once("error", reject);
    child.once("spawn", () => resolve(child));
  });
}

function readUrl(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/", timeout: 3000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => resolve(body));
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

function git(repoDir, args) {
  return execFileSync("git", ["-C", repoDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
