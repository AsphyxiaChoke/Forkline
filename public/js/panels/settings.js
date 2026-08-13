// Application settings and self-update controls.
function renderSettingsTab() {
  const repos = recentRepos();
  const policy = normalizedRecoveryPolicy();
  const policyLabel = t(recoveryPolicyLabel(policy) || "策略未启用");
  const policyRepoLabel = state.data?.repo?.isSample
    ? t("示例仓库不保存策略")
    : t("仅应用于当前仓库：{name}", { name: state.data?.repo?.name || t("当前仓库") });
  const appUpdate = settingsAppUpdateView();
  const desktopZoomCard = settingsDesktopZoomCard();
  els.detailTitle.textContent = t("设置");
  els.detailSub.textContent = t("本机偏好和界面行为");
  els.detailNode.style.borderColor = "var(--violet)";
  setActiveDiff(null);
  els.detailBody.innerHTML = tt`
    <div class="settings-layout">
      <section class="settings-card settings-version-card">
        <div class="settings-card-head">
          <div>
            <strong>关于 Forkline</strong>
            <span>当前版本和 GitHub Release 更新状态。</span>
          </div>
          <span class="settings-update-status ${appUpdate.statusClass}">${escapeHtml(appUpdate.statusText)}</span>
        </div>
        <div class="settings-version-grid">
          <div class="settings-version-item">
            <span>当前版本</span>
            <strong>${escapeHtml(appUpdate.currentVersion)}</strong>
          </div>
          <div class="settings-version-item">
            <span>最新版本</span>
            <strong>${escapeHtml(appUpdate.latestVersion)}</strong>
          </div>
        </div>
        ${
          appUpdate.showInstallAction
          ? `<div class="settings-update-actions">
                <button class="mini-btn primary" data-settings-action="installUpdate" type="button" ${appUpdate.installing ? "disabled" : ""}>${escapeHtml(appUpdate.installing ? t("更新进行中") : t("立即更新并重启"))}</button>
              </div>`
            : ""
        }
        ${
          appUpdate.installing
            ? `<div class="settings-update-progress" role="status">
                <div class="settings-update-progress-head">
                  <strong>${escapeHtml(appUpdate.statusText)}</strong>
                  <span>${escapeHtml(`${appUpdate.installStep}/${appUpdate.installTotal}`)}</span>
                </div>
                <div class="settings-update-progress-track" role="progressbar" aria-label="${escapeAttr(t("Forkline 更新进度"))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${appUpdate.installProgress}">
                  <i style="width:${appUpdate.installProgress}%"></i>
                </div>
              </div>`
            : ""
        }
        ${appUpdate.installNote ? `<div class="settings-update-note">${escapeHtml(appUpdate.installNote)}</div>` : ""}
        ${appUpdate.recoveryText ? `<div class="settings-update-recovery ${escapeAttr(appUpdate.recoveryClass)}">${escapeHtml(appUpdate.recoveryText)}</div>` : ""}
        ${appUpdate.installError ? `<div class="settings-update-error"><strong>${escapeHtml(appUpdate.failureTitle)}</strong><span>${escapeHtml(appUpdate.installError)}</span></div>` : ""}
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>外观</strong>
            <span>主题会保存在当前浏览器。</span>
          </div>
        </div>
        <div class="settings-choice-row settings-theme-grid">
          ${themeCatalog.map(settingsThemeButton).join("")}
        </div>
      </section>

      ${desktopZoomCard}

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>语言</strong>
            <span>界面语言会保存在当前浏览器。</span>
          </div>
        </div>
        <div class="settings-choice-row">
          ${settingsLocaleButton("zh-CN", "中文", t("使用中文界面"))}
          ${settingsLocaleButton("en", "English", t("使用英文界面"))}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>最近仓库</strong>
            <span>${repos.length ? t("已保存 {count} 个本机仓库入口", { count: repos.length }) : t("当前没有最近仓库记录")}</span>
          </div>
          <button class="mini-btn danger" data-settings-action="clearRecentRepos" type="button" ${repos.length ? "" : "disabled"}>清空</button>
        </div>
        <div class="settings-list">
          ${
            repos.length
              ? repos.slice(0, 6).map(settingsRecentRepoRow).join("")
              : `<div class="empty-panel compact"><span>${t("成功打开真实仓库后，这里会显示最近仓库。")}</span></div>`
          }
        </div>
        <button class="mini-btn settings-wide-action" data-settings-action="chooseRepo" type="button">选择 Git 仓库目录</button>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>恢复点保留策略</strong>
            <span>${escapeHtml(`${policyLabel} · ${policyRepoLabel}`)}</span>
          </div>
        </div>
        <div class="settings-policy-grid">
          <label class="recovery-retention-rule">
            <span>保留最近</span>
            <input data-recovery-policy="keepDays" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.keepDays)}" />
            <em>${t("天")}</em>
          </label>
          <label class="recovery-retention-rule">
            <span>每分支</span>
            <input data-recovery-policy="maxPerBranch" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.maxPerBranch)}" />
            <em>${t("个")}</em>
          </label>
          ${recoveryAutoPruneHtml()}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>布局</strong>
            <span>恢复侧栏、右栏和底部区域高度到默认值。</span>
          </div>
          <button class="mini-btn" data-settings-action="resetLayout" type="button">重置布局</button>
        </div>
      </section>
    </div>
  `;
  refreshDesktopZoomState().catch(() => {});
}

function settingsDesktopZoomCard() {
  const desktop = window.forklineDesktop;
  if (!desktop?.getZoomFactor || !desktop?.setZoomFactor) return "";
  const factors = Array.isArray(desktop.zoomFactors) ? desktop.zoomFactors : [0.75, 0.8, 0.9, 1, 1.1];
  const current = Number(state.desktopZoom) || 0.9;
  return `
    <section class="settings-card electron-zoom-card">
      <div class="settings-card-head">
        <div>
          <strong>${t("界面缩放")}</strong>
          <span>${t("仅影响 Electron 桌面窗口，选择后自动保存。")}</span>
        </div>
      </div>
      <div class="settings-choice-row settings-zoom-grid">
        ${factors.map((factor) => `
          <button class="settings-choice settings-zoom-choice ${Math.abs(current - Number(factor)) < 0.001 ? "active" : ""}" data-settings-zoom="${escapeAttr(factor)}" type="button">
            <strong>${Math.round(Number(factor) * 100)}%</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

async function refreshDesktopZoomState() {
  const desktop = window.forklineDesktop;
  if (!desktop?.getZoomFactor) return;
  const zoomFactor = Number(await desktop.getZoomFactor());
  if (!Number.isFinite(zoomFactor) || Math.abs(Number(state.desktopZoom) - zoomFactor) < 0.001) return;
  state.desktopZoom = zoomFactor;
  if (state.selectedTab === "settings") renderInspector();
}

function settingsAppUpdateView() {
  const update = state.appUpdate || {};
  const status = update.status || "loading";
  const installing = Boolean(update.installing);
  const lastResult = update.lastResult?.state === "error" ? update.lastResult : null;
  const installErrorSource = String(update.installError || lastResult?.error || lastResult?.message || "");
  const installError = installErrorSource ? t(installErrorSource) : "";
  const installTotal = Math.max(1, Number(update.installTotal) || 6);
  const installStep = Math.min(installTotal, Math.max(0, Number(update.installStep) || 0));
  const installProgress = update.installState === "downloading" && Number.isFinite(Number(update.downloadPercent))
    ? Math.max(0, Math.min(100, Math.round(Number(update.downloadPercent))))
    : Math.round((installStep / installTotal) * 100);
  const rollbackState = String(lastResult?.rollbackState || "");
  const recoveryText = lastResult ? selfUpdateRecoveryText(lastResult) : "";
  const recoveryClass = ["complete", "not-needed"].includes(rollbackState)
    ? "ok"
    : ["failed", "blocked", "unknown"].includes(rollbackState)
      ? "danger"
      : "";
  const failureTitle = lastResult?.failedStage === "preflight" ? t("更新前检查未通过") : t("更新失败");
  const displayVersion = (value) => {
    const version = String(value || "").trim();
    return version ? (version.startsWith("v") ? version : `v${version}`) : "";
  };
  const currentVersion = displayVersion(update.currentVersion) || t("正在读取");
  const latestVersion = displayVersion(update.latestVersion) || (status === "loading" ? t("正在检查") : t("未知"));
  const shared = {
    currentVersion,
    latestVersion,
    installing,
    installError,
    installStep,
    installTotal,
    installProgress,
    recoveryText,
    recoveryClass,
    failureTitle,
    showInstallAction: status === "available" && Boolean(update.installSupported),
    installNote: status === "available" && !update.installSupported
      ? t("当前安装方式不支持一键更新，请点击左上角更新图标打开 Release。")
      : "",
  };
  if (installing) {
    return { ...shared, statusClass: "loading", statusText: t(update.installMessage || "正在更新并重启") };
  }
  if (installError) {
    return { ...shared, statusClass: "unavailable", statusText: failureTitle };
  }
  if (status === "available") {
    return {
      ...shared,
      statusClass: "available",
      statusText: t("发现新版本 {version}", { version: latestVersion }),
    };
  }
  if (status === "current") {
    return { ...shared, statusClass: "current", statusText: t("已是最新版本") };
  }
  if (status === "unavailable") {
    return { ...shared, statusClass: "unavailable", statusText: t("暂时无法检查更新") };
  }
  return { ...shared, statusClass: "loading", statusText: t("正在检查更新") };
}

async function installAppUpdate() {
  const update = state.appUpdate || {};
  if (update.installing || update.status !== "available" || !update.installSupported) return;
  if (typeof fileEditorDirty === "function" && fileEditorDirty()) {
    throw new Error(t("文件编辑器还有未保存的修改，请先保存或关闭后再更新 Forkline。"));
  }
  if (String(els.commitSummary?.value || "").trim() || String(els.commitBody?.value || "").trim()) {
    throw new Error(t("提交信息框还有未提交内容，请先处理后再更新 Forkline。"));
  }
  const current = update.currentVersion ? `v${String(update.currentVersion).replace(/^v/i, "")}` : t("未知");
  const latest = update.latestVersion ? `v${String(update.latestVersion).replace(/^v/i, "")}` : t("未知");
  if (!confirm(t("确认将 Forkline 从 {current} 更新到 {latest}？\n\n只会更新 Forkline 自身，不会修改当前管理的仓库。页面会短暂断开，完成后自动刷新。", { current, latest }))) return;

  state.appUpdate.installing = true;
  state.appUpdate.installError = "";
  state.appUpdate.installState = "preparing";
  state.appUpdate.installMessage = update.installMode === "nsis"
    ? t("正在检查并下载安装版更新")
    : t("正在检查版本和本地更新条件");
  state.appUpdate.installStep = 1;
  state.appUpdate.installTotal = update.installMode === "nsis" ? 4 : 6;
  state.appUpdate.lastResult = null;
  renderInspector();
  if (update.installMode === "nsis") {
    try {
      await window.forklineDesktop.installInstallerUpdate(update.latestVersion);
    } catch (error) {
      state.appUpdate = {
        ...state.appUpdate,
        installing: false,
        installError: String(error.message || error),
      };
      if (state.selectedTab === "settings") renderInspector();
      toast(error.message || String(error));
    }
    return;
  }
  let stopPreparationPolling = false;
  const preparationPoll = watchSelfUpdatePreparation(() => stopPreparationPolling);
  try {
    await api("/api/app-update/install", {
      method: "POST",
      body: JSON.stringify({ version: update.latestVersion }),
    });
    stopPreparationPolling = true;
    await preparationPoll;
    await waitForSelfUpdateRestart(update.latestVersion);
  } catch (error) {
    const result = error.updateResult
      || (error.data?.updateStatus ? { ...error.data.updateStatus, error: error.message } : null)
      || {
        state: "error",
        phase: "failed",
        failedStage: "request",
        rollbackState: "unknown",
        serviceState: "unknown",
        error: error.message,
      };
    state.appUpdate = {
      ...state.appUpdate,
      installing: false,
      installError: String(result.error || error.message),
      lastResult: result,
    };
    if (state.selectedTab === "settings") renderInspector();
    toast(selfUpdateFailureMessage(result));
  } finally {
    stopPreparationPolling = true;
    await preparationPoll;
  }
}

async function watchSelfUpdatePreparation(shouldStop) {
  while (!shouldStop()) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (shouldStop()) break;
    try {
      const result = await readSelfUpdateResult(false);
      if (result?.state && result.state !== "idle") applySelfUpdateProgress(result);
    } catch {}
  }
}

function settingsThemeButton(theme) {
  const active = state.theme === theme.id;
  return `
    <button class="settings-choice settings-theme-choice ${active ? "active" : ""}" data-settings-theme="${escapeAttr(theme.id)}" type="button">
      <span class="settings-theme-preview" aria-hidden="true">
        ${theme.swatches.map((color) => `<i class="settings-theme-swatch" style="--theme-swatch:${escapeAttr(color)}"></i>`).join("")}
      </span>
      <strong>${escapeHtml(t(theme.label))}</strong>
      <span class="settings-theme-description">${escapeHtml(t(theme.description))}</span>
    </button>
  `;
}

function settingsLocaleButton(locale, label, description) {
  const active = state.locale === locale;
  return `
    <button class="settings-choice ${active ? "active" : ""}" data-settings-locale="${escapeAttr(locale)}" type="button">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(description)}</span>
    </button>
  `;
}

function settingsRecentRepoRow(repo) {
  return `
    <div class="settings-repo-row">
      <div>
        <strong title="${escapeAttr(repo.name || repo.path)}">${escapeHtml(repo.name || repo.path)}</strong>
        <span title="${escapeAttr(repo.path)}">${escapeHtml(repo.path || "")}</span>
      </div>
      <em>${escapeHtml(repo.branch || t("未记录分支"))}</em>
    </div>
  `;
}
