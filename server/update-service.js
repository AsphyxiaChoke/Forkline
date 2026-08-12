"use strict";

const fs = require("fs");
const path = require("path");
const packageInfo = require("../package.json");
const { createAppUpdateChecker, normalizeVersion } = require("../app-update");
const {
  SELF_UPDATE_TOTAL_STEPS,
  cleanupCandidateRef,
  clearSelfUpdateStatus,
  launchSelfUpdateRunner,
  prepareSelfUpdate,
  readSelfUpdateStatus,
  selfUpdateStatusFile,
  writeSelfUpdateStatus,
} = require("../app-self-update");

function createUpdateService(options) {
  const {
    appDir,
    port,
    gitBin,
    getManagedRepo,
    hasBusyOperations,
    readJson,
    sendJson,
    scheduleShutdown,
    selfUpdateRuntime = null,
  } = options;
  const readAppUpdate = createAppUpdateChecker({
    currentVersion: process.env.FORKLINE_APP_VERSION || packageInfo.version,
    releaseApiUrl: process.env.FORKLINE_RELEASE_API_URL,
  });
  const statusFile = selfUpdateStatusFile(appDir);
  let updateInProgress = false;

  function runtimeSupported() {
    return !process.env.FORKLINE_APP_VERSION
      && !process.env.FORKLINE_RELEASE_API_URL
      && fs.existsSync(path.join(appDir, ".git"));
  }

  async function readUpdateState() {
    const update = await readAppUpdate();
    return { ...update, installSupported: runtimeSupported() };
  }

  async function prepareLaunch(body, onFetchProgress) {
    if (process.env.FORKLINE_APP_VERSION || process.env.FORKLINE_RELEASE_API_URL) {
      throw new Error("当前处于版本检查测试模式，不能执行一键更新。");
    }
    if (!fs.existsSync(path.join(appDir, ".git"))) {
      throw new Error("当前 Forkline 是源码压缩包，不是 Git 克隆，不能一键更新。请打开 Release 下载新版本。");
    }
    if (hasBusyOperations()) throw new Error("Forkline 还有操作正在执行，请等待完成后再更新。");
    const update = await readAppUpdate();
    const requestedVersion = normalizeVersion(body?.version);
    if (!update.available || !update.latestVersion || !update.tagName) throw new Error("当前没有可安装的新版本。");
    if (!requestedVersion || requestedVersion !== update.latestVersion) {
      throw new Error("页面中的目标版本已经过期，请刷新后重新检查更新。");
    }
    const managedRepo = getManagedRepo() || "";
    const runtimeParentPid = Number(selfUpdateRuntime?.parentPid);
    return prepareSelfUpdate({
      repoDir: appDir,
      gitBin,
      currentVersion: update.currentVersion,
      targetVersion: update.latestVersion,
      tagName: update.tagName,
      port,
      parentPid: Number.isInteger(runtimeParentPid) && runtimeParentPid > 0
        ? runtimeParentPid
        : process.pid,
      managedRepo,
      restartMode: selfUpdateRuntime?.restartMode,
      electronExecPath: selfUpdateRuntime?.electronExecPath,
      electronAppPath: selfUpdateRuntime?.electronAppPath,
      onFetchProgress: (progress) => onFetchProgress?.({
        ...progress,
        currentVersion: update.currentVersion,
        targetVersion: update.latestVersion,
        repoPath: managedRepo,
      }),
    });
  }

  async function install(req, res) {
    if (updateInProgress) throw new Error("Forkline 更新已经开始，请等待服务重启。");
    updateInProgress = true;
    let plan = null;
    try {
      const body = await readJson(req);
      clearSelfUpdateStatus(statusFile);
      writeSelfUpdateStatus(statusFile, {
        state: "preparing",
        phase: "preparing",
        step: 1,
        totalSteps: SELF_UPDATE_TOTAL_STEPS,
        currentVersion: normalizeVersion(packageInfo.version),
        targetVersion: normalizeVersion(body?.version),
        repoPath: getManagedRepo() || "",
        downloadStage: "checking",
        downloadPercent: 0,
        message: "正在检查版本和本地更新条件",
      });
      plan = await prepareLaunch(body, (progress) => {
        writeSelfUpdateStatus(statusFile, {
          state: "preparing",
          phase: "preparing",
          step: 1,
          totalSteps: SELF_UPDATE_TOTAL_STEPS,
          ...progress,
          message: preparationProgressMessage(progress),
        });
      });
      writeSelfUpdateStatus(statusFile, {
        state: "starting",
        phase: "starting",
        step: 1,
        totalSteps: SELF_UPDATE_TOTAL_STEPS,
        currentVersion: plan.currentVersion,
        targetVersion: plan.targetVersion,
        repoPath: plan.managedRepo,
        message: `更新前检查已通过，正在准备更新到 v${plan.targetVersion}`,
      });
      const runnerPid = await launchSelfUpdateRunner(plan);
      sendJson(res, 200, { ok: true, restarting: true, targetVersion: plan.targetVersion, runnerPid });
      scheduleShutdown(plan);
    } catch (error) {
      updateInProgress = false;
      if (plan) await cleanupCandidateRef(plan);
      const failureStatus = {
        state: "error",
        phase: "failed",
        step: 1,
        totalSteps: SELF_UPDATE_TOTAL_STEPS,
        currentVersion: plan?.currentVersion || normalizeVersion(packageInfo.version),
        targetVersion: plan?.targetVersion || "",
        repoPath: plan?.managedRepo || getManagedRepo() || "",
        failedStage: "preflight",
        rollbackState: "not-needed",
        serviceState: "unchanged",
        rolledBack: false,
        error: error.message,
        recoveryMessage: "更新文件没有修改，原版本仍在运行。",
        message: `更新前检查未通过：${error.message}`,
      };
      try {
        writeSelfUpdateStatus(statusFile, failureStatus);
      } catch {}
      error.updateStatus = failureStatus;
      throw error;
    }
  }

  function preparationProgressMessage(progress = {}) {
    if (progress.downloadStage === "retrying") {
      return `下载连接中断，正在进行第 ${progress.fetchAttempt || 1}/${progress.fetchAttempts || 1} 次尝试`;
    }
    if (progress.downloadStage === "receiving" && Number.isFinite(Number(progress.downloadPercent))) {
      return `正在下载正式版本：${Number(progress.downloadPercent)}%`;
    }
    if (progress.downloadStage === "resolving") return `正在处理下载内容：${Number(progress.downloadPercent) || 0}%`;
    if (progress.downloadStage === "complete") return "正式版本下载完成，正在校验";
    return "正在连接 GitHub 下载正式版本";
  }

  async function handleRequest(req, res, parsed) {
    if (req.method === "GET" && parsed.pathname === "/api/app-update") {
      sendJson(res, 200, await readUpdateState());
      return true;
    }
    if (req.method === "GET" && parsed.pathname === "/api/app-update/status") {
      const consume = ["1", "true"].includes(String(parsed.searchParams.get("consume") || "").toLowerCase());
      sendJson(res, 200, readSelfUpdateStatus(statusFile, { consume }) || { state: "idle" });
      return true;
    }
    if (req.method === "POST" && parsed.pathname === "/api/app-update/install") {
      await install(req, res);
      return true;
    }
    return false;
  }

  return {
    handleRequest,
    prepareLaunch,
    readUpdateState,
    runtimeSupported,
  };
}

module.exports = { createUpdateService };
