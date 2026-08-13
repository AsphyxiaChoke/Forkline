"use strict";

const { compareVersions, normalizeVersion } = require("../app-update");

const INSTALL_TOTAL_STEPS = 4;
const RELEASE_BASE_URL = "https://github.com/AsphyxiaChoke/Forkline/releases/tag";

function createInstallerUpdateController(options = {}) {
  const updater = options.updater;
  const supported = Boolean(options.supported);
  const currentVersion = normalizeVersion(options.currentVersion);
  const prepareInstall = options.prepareInstall || (() => Promise.resolve());
  const onState = options.onState || (() => {});
  if (!updater || typeof updater.on !== "function") {
    throw new TypeError("Installer update controller requires an updater");
  }

  let checkPromise = null;
  let installPromise = null;
  let state = {
    status: supported ? "loading" : "unsupported",
    currentVersion,
    latestVersion: "",
    url: "",
    installSupported: supported,
    installMode: supported ? "nsis" : "",
    installing: false,
    installState: "",
    installMessage: "",
    installStep: 0,
    installTotal: INSTALL_TOTAL_STEPS,
    downloadPercent: 0,
    installError: "",
  };

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.autoRunAppAfterInstall = true;
  updater.allowPrerelease = false;
  updater.disableWebInstaller = true;

  function snapshot() {
    return { ...state };
  }

  function updateState(patch) {
    state = { ...state, ...patch };
    const value = snapshot();
    onState(value);
    return value;
  }

  function applyUpdateInfo(info = {}) {
    const latestVersion = normalizeVersion(info.version);
    const available = Boolean(latestVersion && compareVersions(latestVersion, currentVersion) > 0);
    return updateState({
      status: available ? "available" : "current",
      latestVersion: available ? latestVersion : currentVersion,
      url: available ? `${RELEASE_BASE_URL}/v${latestVersion}` : "",
      installState: "",
      installMessage: "",
      installStep: 0,
      downloadPercent: 0,
      installError: "",
    });
  }

  updater.on("download-progress", (progress = {}) => {
    const percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
    updateState({
      installing: true,
      installState: "downloading",
      installMessage: "正在下载安装版更新",
      installStep: 2,
      downloadPercent: percent,
    });
  });
  updater.on("update-downloaded", () => {
    updateState({
      installing: true,
      installState: "stopping",
      installMessage: "安装包下载完成，正在停止 Forkline 后台服务",
      installStep: 3,
      downloadPercent: 100,
    });
  });
  updater.on("error", (error) => {
    if (!installPromise) return;
    updateState({
      installing: false,
      installState: "error",
      installMessage: "",
      installError: error?.message || String(error),
    });
  });

  async function checkForUpdates() {
    if (!supported) return snapshot();
    if (checkPromise) return checkPromise;
    checkPromise = (async () => {
      updateState({
        status: "loading",
        installState: "checking",
        installMessage: "正在检查安装版更新",
        installStep: 1,
        installError: "",
      });
      try {
        const result = await updater.checkForUpdates();
        return applyUpdateInfo(result?.updateInfo || {});
      } catch (error) {
        return updateState({
          status: "unavailable",
          latestVersion: "",
          url: "",
          installState: "",
          installMessage: "",
          installStep: 0,
          downloadPercent: 0,
          installError: "",
        });
      } finally {
        checkPromise = null;
      }
    })();
    return checkPromise;
  }

  async function install(requestedVersion) {
    if (!supported) throw new Error("当前不是 Forkline Windows 安装版，不能使用安装器更新。");
    if (installPromise) return installPromise;
    installPromise = (async () => {
      const checked = state.status === "available" ? snapshot() : await checkForUpdates();
      const targetVersion = normalizeVersion(requestedVersion);
      if (checked.status !== "available" || !checked.latestVersion) {
        throw new Error("当前没有可安装的新版本。");
      }
      if (!targetVersion || targetVersion !== checked.latestVersion) {
        throw new Error("页面中的目标版本已经过期，请刷新后重新检查更新。");
      }
      updateState({
        installing: true,
        installState: "downloading",
        installMessage: "正在下载安装版更新",
        installStep: 2,
        downloadPercent: 0,
        installError: "",
      });
      await updater.downloadUpdate();
      updateState({
        installing: true,
        installState: "stopping",
        installMessage: "安装包下载完成，正在停止 Forkline 后台服务",
        installStep: 3,
        downloadPercent: 100,
      });
      await prepareInstall();
      updateState({
        installing: true,
        installState: "installing",
        installMessage: "正在启动安装程序并重启 Forkline",
        installStep: 4,
      });
      updater.quitAndInstall(false, true);
      return snapshot();
    })().catch((error) => {
      updateState({
        installing: false,
        installState: "error",
        installMessage: "",
        installError: error?.message || String(error),
      });
      throw error;
    }).finally(() => {
      installPromise = null;
    });
    return installPromise;
  }

  return {
    checkForUpdates,
    getState: snapshot,
    install,
  };
}

module.exports = {
  INSTALL_TOTAL_STEPS,
  createInstallerUpdateController,
};
