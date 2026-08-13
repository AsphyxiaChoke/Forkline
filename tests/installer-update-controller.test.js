"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const {
  INSTALL_TOTAL_STEPS,
  createInstallerUpdateController,
} = require("../electron/installer-update-controller");

test("NSIS update controller checks without downloading automatically", async () => {
  const updater = new EventEmitter();
  let checks = 0;
  let downloads = 0;
  updater.checkForUpdates = async () => {
    checks += 1;
    return { updateInfo: { version: "0.4.1" } };
  };
  updater.downloadUpdate = async () => { downloads += 1; };
  updater.quitAndInstall = () => assert.fail("checking must not install");
  const controller = createInstallerUpdateController({
    updater,
    supported: true,
    currentVersion: "0.4.0",
  });

  const state = await controller.checkForUpdates();

  assert.equal(checks, 1);
  assert.equal(downloads, 0);
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.disableWebInstaller, true);
  assert.equal(state.status, "available");
  assert.equal(state.currentVersion, "0.4.0");
  assert.equal(state.latestVersion, "0.4.1");
  assert.equal(state.installMode, "nsis");
  assert.match(state.url, /releases\/tag\/v0\.4\.1$/);
});

test("NSIS update controller never displays an older release as the latest version", async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => ({ updateInfo: { version: "0.4.0" } });
  updater.downloadUpdate = () => assert.fail("older releases must not download");
  updater.quitAndInstall = () => assert.fail("older releases must not install");
  const controller = createInstallerUpdateController({
    updater,
    supported: true,
    currentVersion: "0.4.1",
  });

  const state = await controller.checkForUpdates();

  assert.equal(state.status, "current");
  assert.equal(state.currentVersion, "0.4.1");
  assert.equal(state.latestVersion, "0.4.1");
  assert.equal(state.url, "");
});

test("NSIS update controller stops Forkline before handing off to the installer", async () => {
  const updater = new EventEmitter();
  const actions = [];
  const states = [];
  updater.checkForUpdates = async () => ({ updateInfo: { version: "0.4.1" } });
  updater.downloadUpdate = async () => {
    actions.push("download");
    updater.emit("download-progress", { percent: 48.6 });
    updater.emit("update-downloaded", { version: "0.4.1" });
  };
  updater.quitAndInstall = (silent, forceRunAfter) => actions.push(`install:${silent}:${forceRunAfter}`);
  const controller = createInstallerUpdateController({
    updater,
    supported: true,
    currentVersion: "0.4.0",
    onState: (state) => states.push(state),
    prepareInstall: async () => { actions.push("stop-background"); },
  });

  await controller.install("v0.4.1");

  assert.deepEqual(actions, ["download", "stop-background", "install:false:true"]);
  assert.ok(states.some((state) => (
    state.installState === "downloading"
    && state.installMessage === "正在下载安装版更新"
    && state.downloadPercent === 49
  )));
  assert.ok(states.some((state) => state.installState === "stopping" && state.installStep === 3));
  assert.equal(controller.getState().installState, "installing");
  assert.equal(controller.getState().installStep, INSTALL_TOTAL_STEPS);
});

test("NSIS update controller rejects stale renderer targets before downloading", async () => {
  const updater = new EventEmitter();
  let downloads = 0;
  updater.checkForUpdates = async () => ({ updateInfo: { version: "0.4.2" } });
  updater.downloadUpdate = async () => { downloads += 1; };
  updater.quitAndInstall = () => {};
  const controller = createInstallerUpdateController({
    updater,
    supported: true,
    currentVersion: "0.4.1",
  });

  await assert.rejects(controller.install("0.4.1"), /页面中的目标版本已经过期，请刷新后重新检查更新。/);
  assert.equal(downloads, 0);
  assert.equal(controller.getState().installing, false);
});

test("NSIS update controller treats check failures as unavailable rather than failed installs", async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { throw new Error("network unavailable"); };
  updater.downloadUpdate = () => assert.fail("failed checks must not download");
  updater.quitAndInstall = () => assert.fail("failed checks must not install");
  const controller = createInstallerUpdateController({
    updater,
    supported: true,
    currentVersion: "0.4.1",
  });

  const state = await controller.checkForUpdates();

  assert.equal(state.status, "unavailable");
  assert.equal(state.installState, "");
  assert.equal(state.installError, "");
  assert.equal(state.installing, false);
});

test("NSIS update controller cancels installation when Forkline cannot stop completely", async () => {
  const updater = new EventEmitter();
  let installed = false;
  updater.checkForUpdates = async () => ({ updateInfo: { version: "0.4.2" } });
  updater.downloadUpdate = async () => {};
  updater.quitAndInstall = () => { installed = true; };
  const controller = createInstallerUpdateController({
    updater,
    supported: true,
    currentVersion: "0.4.1",
    prepareInstall: async () => { throw new Error("Forkline 后台服务未能完整停止，安装已取消。"); },
  });

  await assert.rejects(controller.install("0.4.2"), /安装已取消/);
  assert.equal(installed, false);
  assert.equal(controller.getState().installing, false);
  assert.equal(controller.getState().installState, "error");
  assert.match(controller.getState().installError, /后台服务未能完整停止/);
});

test("NSIS update controller stays disabled for source Electron runs", async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = () => assert.fail("unsupported runtime must not check");
  updater.downloadUpdate = () => assert.fail("unsupported runtime must not download");
  updater.quitAndInstall = () => assert.fail("unsupported runtime must not install");
  const controller = createInstallerUpdateController({
    updater,
    supported: false,
    currentVersion: "0.4.1",
  });

  assert.equal((await controller.checkForUpdates()).status, "unsupported");
  await assert.rejects(controller.install("0.4.2"), /不是 Forkline Windows 安装版/);
});
