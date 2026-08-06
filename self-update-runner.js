"use strict";

const { SELF_UPDATE_TOTAL_STEPS, runSelfUpdatePlan, writeSelfUpdateStatus } = require("./app-self-update");

async function main() {
  const encodedPlan = String(process.argv[2] || "");
  if (!encodedPlan) throw new Error("缺少 Forkline 更新计划。");
  const plan = JSON.parse(Buffer.from(encodedPlan, "base64url").toString("utf8"));
  await runSelfUpdatePlan(plan);
}

main().catch((error) => {
  try {
    const encodedPlan = String(process.argv[2] || "");
    const plan = encodedPlan ? JSON.parse(Buffer.from(encodedPlan, "base64url").toString("utf8")) : null;
    if (plan?.statusFile) {
      writeSelfUpdateStatus(plan.statusFile, {
        state: "error",
        phase: "failed",
        step: 0,
        totalSteps: SELF_UPDATE_TOTAL_STEPS,
        currentVersion: plan.currentVersion || "",
        targetVersion: plan.targetVersion || "",
        repoPath: plan.managedRepo || "",
        error: error.message,
        failedStage: "runner",
        rollbackState: "unknown",
        serviceState: "unknown",
        rolledBack: false,
        recoveryMessage: "更新器意外退出，无法确认自动回退和服务状态。",
        message: `更新器启动失败：${error.message}`,
      });
    }
  } catch {}
  process.exitCode = 1;
});
