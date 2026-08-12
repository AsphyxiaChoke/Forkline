// Loads secondary inspector panels only when they are opened for the first time.
const inspectorPanelDefinitions = {
  workspaces: {
    resource: "./js/panels/workspaces.js",
    styleResource: "./workspaces.css",
    renderer: "renderWorkspaceTab",
    tabs: ["branches", "worktrees", "submodules"],
    title: "分支与工作区",
    subtitle: "分支整理、工作树和子模块",
    color: "var(--blue)",
  },
  stashes: {
    resource: "./js/panels/stashes.js",
    styleResource: "./repository-panels.css",
    styleKey: "repositoryPanels",
    renderer: "renderStashesTab",
    title: "储藏列表",
    subtitle: "储藏与暂存记录",
    color: "var(--amber)",
  },
  recovery: {
    resource: "./js/panels/recovery.js",
    styleResource: "./repository-panels.css",
    styleKey: "repositoryPanels",
    renderer: "renderRecoveryTab",
    title: "恢复点",
    subtitle: "恢复点、引用日志与恢复操作",
    color: "var(--purple)",
  },
  sync: {
    resource: "./js/panels/auth.js",
    styleResource: "./repository-panels.css",
    styleKey: "repositoryPanels",
    renderer: "renderSyncTab",
    title: "同步情况",
    subtitle: "同步详情",
    color: "var(--teal)",
  },
  compare: {
    resource: "./js/panels/compare.js",
    styleResource: "./repository-panels.css",
    styleKey: "repositoryPanels",
    renderer: "renderCompareTab",
    title: "分支比较",
    subtitle: "选择两个引用查看差异",
    color: "var(--blue)",
  },
  logs: {
    resource: "./js/panels/logs.js",
    styleResource: "./logs.css",
    renderer: "renderLogsTab",
    title: "操作日志",
    subtitle: "Git 操作与界面诊断",
    color: "var(--amber)",
  },
  fileInsights: {
    resource: "./js/panels/file-insights.js",
    styleResource: "./file-insights.css",
    renderer: "renderFileInsightsTab",
    tabs: ["fileHistory", "fileBlame"],
    title: "文件追踪",
    subtitle: "文件提交历史与逐行归属",
    color: "var(--teal)",
  },
  settings: {
    resource: "./js/panels/settings.js",
    styleResource: "./settings.css",
    renderer: "renderSettingsTab",
    title: "设置",
    subtitle: "本机偏好和界面行为",
    color: "var(--violet)",
  },
  tags: {
    resource: "./js/panels/tags.js",
    styleResource: "./repository-panels.css",
    styleKey: "repositoryPanels",
    renderer: "renderTagsTab",
    title: "标签列表",
    subtitle: "本地与远端 Tag 操作",
    color: "var(--blue)",
  },
};

const inspectorPanelLoadPromises = new Map();
const inspectorPanelStyleLoadPromises = new Map();

function inspectorPanelDefinition(panel) {
  return inspectorPanelDefinitions[panel] || null;
}

function inspectorPanelLoaded(panel) {
  const definition = inspectorPanelDefinition(panel);
  return Boolean(definition && inspectorPanelRendererLoaded(panel) && inspectorPanelStyleLoaded(panel));
}

function inspectorPanelRendererLoaded(panel) {
  const definition = inspectorPanelDefinition(panel);
  return Boolean(definition && typeof window[definition.renderer] === "function");
}

function inspectorPanelStyleLoaded(panel) {
  const definition = inspectorPanelDefinition(panel);
  if (!definition?.styleResource) return true;
  return inspectorPanelStyleElement(panel)?.dataset.loaded === "true";
}

function inspectorPanelStyleKey(panel) {
  const definition = inspectorPanelDefinition(panel);
  return definition?.styleKey || panel;
}

function inspectorPanelActive(panel) {
  const definition = inspectorPanelDefinition(panel);
  if (!definition) return false;
  return definition.tabs ? definition.tabs.includes(state.selectedTab) : state.selectedTab === panel;
}

function inspectorPanelResourceElement(panel) {
  return Array.from(document.querySelectorAll("[data-inspector-panel-resource]"))
    .find((element) => element.dataset.inspectorPanelResource === panel) || null;
}

function inspectorPanelStyleElement(panel) {
  const styleKey = inspectorPanelStyleKey(panel);
  return Array.from(document.querySelectorAll("[data-inspector-panel-style]"))
    .find((element) => element.dataset.inspectorPanelStyle === styleKey) || null;
}

function inspectorPanelLoadError(panel) {
  const definition = inspectorPanelDefinition(panel);
  return t("{panel}资源加载失败，请重试。", { panel: t(definition?.title || "面板") });
}

function loadInspectorPanelScript(panel) {
  const definition = inspectorPanelDefinition(panel);
  if (!definition) return Promise.reject(new Error(t("未知面板")));
  if (inspectorPanelRendererLoaded(panel)) return Promise.resolve();
  const existing = inspectorPanelResourceElement(panel);
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = definition.resource;
    script.async = false;
    script.dataset.inspectorPanelResource = panel;
    script.onload = () => {
      if (!inspectorPanelRendererLoaded(panel)) {
        script.remove();
        reject(new Error(inspectorPanelLoadError(panel)));
        return;
      }
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(inspectorPanelLoadError(panel)));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function loadInspectorPanelStyle(panel) {
  const definition = inspectorPanelDefinition(panel);
  if (!definition?.styleResource || inspectorPanelStyleLoaded(panel)) return Promise.resolve();
  const styleKey = inspectorPanelStyleKey(panel);
  if (inspectorPanelStyleLoadPromises.has(styleKey)) {
    return inspectorPanelStyleLoadPromises.get(styleKey);
  }
  const existing = inspectorPanelStyleElement(panel);
  const promise = new Promise((resolve, reject) => {
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = definition.styleResource;
    link.dataset.inspectorPanelStyle = styleKey;
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      reject(new Error(inspectorPanelLoadError(panel)));
    };
    if (!existing) document.head.appendChild(link);
  });
  inspectorPanelStyleLoadPromises.set(styleKey, promise);
  promise.catch(() => {
    if (inspectorPanelStyleLoadPromises.get(styleKey) === promise) {
      inspectorPanelStyleLoadPromises.delete(styleKey);
    }
  });
  return promise;
}

function loadInspectorPanelResources(panel) {
  return Promise.all([
    loadInspectorPanelStyle(panel),
    loadInspectorPanelScript(panel),
  ]);
}

async function ensureInspectorPanelLoaded(panel) {
  if (inspectorPanelLoaded(panel)) return;
  if (!inspectorPanelLoadPromises.has(panel)) {
    inspectorPanelLoadPromises.set(panel, loadInspectorPanelResources(panel));
  }
  try {
    await inspectorPanelLoadPromises.get(panel);
  } catch (error) {
    inspectorPanelLoadPromises.delete(panel);
    throw error;
  }
}

function renderInspectorPanelLazy(panel) {
  const definition = inspectorPanelDefinition(panel);
  if (!definition) return;
  if (inspectorPanelLoaded(panel)) {
    window[definition.renderer]();
    return;
  }
  renderInspectorPanelLoading(panel);
  ensureInspectorPanelLoaded(panel)
    .then(() => {
      if (inspectorPanelActive(panel)) window[definition.renderer]();
    })
    .catch((error) => {
      if (inspectorPanelActive(panel)) renderInspectorPanelLoadError(panel, error);
    });
}

function renderInspectorPanelLoading(panel) {
  const definition = inspectorPanelDefinition(panel);
  els.detailTitle.textContent = t(definition.title);
  els.detailSub.textContent = t(definition.subtitle);
  els.detailNode.style.borderColor = definition.color;
  setActiveDiff(null);
  els.detailBody.innerHTML = `<div class="empty-panel compact"><span>${t("正在载入{panel}...", { panel: t(definition.title) })}</span></div>`;
}

function renderInspectorPanelLoadError(panel, error) {
  const definition = inspectorPanelDefinition(panel);
  const message = inspectorPanelLoadError(panel);
  els.detailTitle.textContent = t(definition.title);
  els.detailSub.textContent = message;
  els.detailNode.style.borderColor = definition.color;
  els.detailBody.innerHTML = `
    <div class="empty-panel compact">
      <strong>${message}</strong>
      <span>${escapeHtml(error?.message || t("未知错误"))}</span>
      <button class="mini-btn" data-inspector-panel-retry="${escapeAttr(panel)}" type="button">${t("重试")}</button>
    </div>
  `;
  els.detailBody.querySelector("[data-inspector-panel-retry]")?.addEventListener("click", () => renderInspectorPanelLazy(panel), { once: true });
}
