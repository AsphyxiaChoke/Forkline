// Keeps inspector tab context eager and loads folder/command UI on first use.
const folderCommandResource = "./js/features/folder-command-implementation.js";
const folderCommandStyleResource = "./folder-command.css";
let folderCommandLoadPromise = null;
let folderCommandStyleLoadPromise = null;

function folderCommandScriptLoaded() {
  return typeof window.openFolderModal === "function"
    && typeof window.closeFolderModal === "function"
    && typeof window.loadFolder === "function"
    && typeof window.openSelectedFolder === "function"
    && typeof window.openCommandPalette === "function"
    && typeof window.closeCommandPalette === "function"
    && typeof window.renderCommandPalette === "function"
    && typeof window.executeCommandPaletteItem === "function"
    && typeof window.handleCommandPaletteKeydown === "function";
}

function folderCommandLoaded() {
  return folderCommandScriptLoaded() && folderCommandStyleLoaded();
}

function folderCommandResourceElement() {
  return document.querySelector("[data-folder-command-resource]");
}

function folderCommandStyleElement() {
  return document.querySelector("[data-folder-command-style]");
}

function folderCommandStyleLoaded() {
  return folderCommandStyleElement()?.dataset.loaded === "true";
}

function folderCommandLoadError() {
  return t("目录选择和命令面板资源加载失败，请重试。");
}

function loadFolderCommandScript() {
  if (folderCommandScriptLoaded()) return Promise.resolve();
  const existing = folderCommandResourceElement();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = folderCommandResource;
    script.async = false;
    script.dataset.folderCommandResource = "true";
    script.onload = () => {
      if (!folderCommandScriptLoaded()) {
        script.remove();
        reject(new Error(folderCommandLoadError()));
        return;
      }
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(folderCommandLoadError()));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function loadFolderCommandStyle() {
  if (folderCommandStyleLoaded()) return Promise.resolve();
  if (folderCommandStyleLoadPromise) return folderCommandStyleLoadPromise;
  const existing = folderCommandStyleElement();
  const promise = new Promise((resolve, reject) => {
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = folderCommandStyleResource;
    link.dataset.folderCommandStyle = "true";
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      reject(new Error(folderCommandLoadError()));
    };
    if (!existing) document.head.appendChild(link);
  });
  folderCommandStyleLoadPromise = promise;
  promise.catch(() => {
    if (folderCommandStyleLoadPromise === promise) folderCommandStyleLoadPromise = null;
  });
  return promise;
}

function loadFolderCommandResources() {
  return Promise.all([
    loadFolderCommandStyle(),
    loadFolderCommandScript(),
  ]);
}

async function ensureFolderCommandLoaded() {
  if (folderCommandLoaded()) return;
  if (!folderCommandLoadPromise) folderCommandLoadPromise = loadFolderCommandResources();
  try {
    await folderCommandLoadPromise;
  } catch (error) {
    folderCommandLoadPromise = null;
    throw error;
  }
}

async function openFolderModalLazy() {
  await ensureFolderCommandLoaded();
  return window.openFolderModal();
}

function closeFolderModalLazy() {
  if (typeof window.closeFolderModal === "function") window.closeFolderModal();
}

async function loadFolderLazy(pathValue = "") {
  await ensureFolderCommandLoaded();
  return window.loadFolder(pathValue);
}

async function openSelectedFolderLazy() {
  await ensureFolderCommandLoaded();
  return window.openSelectedFolder();
}

async function openCommandPaletteLazy() {
  await ensureFolderCommandLoaded();
  return window.openCommandPalette();
}

function closeCommandPaletteLazy() {
  if (typeof window.closeCommandPalette === "function") window.closeCommandPalette();
}

function renderCommandPaletteLazy() {
  if (typeof window.renderCommandPalette === "function") window.renderCommandPalette();
}

function handleCommandPaletteKeydownLazy(event) {
  if (typeof window.handleCommandPaletteKeydown === "function") window.handleCommandPaletteKeydown(event);
}

async function executeCommandPaletteItemLazy(id) {
  await ensureFolderCommandLoaded();
  return window.executeCommandPaletteItem(id);
}

function switchInspectorTab(tab) {
  state.inspectorContext = contextForInspectorTab(tab) || state.inspectorContext;
  state.selectedTab = tab;
  ensureInspectorTabData(tab);
  renderInspector();
}

function contextForInspectorTab(tab) {
  return Object.entries(inspectorTabs).find(([, tabs]) => tabs.includes(tab))?.[0] || "";
}

function setInspectorContext(context, preferredTab = "") {
  if (!inspectorTabs[context]) context = "commit";
  state.inspectorContext = context;
  const tabs = inspectorTabs[context];
  state.selectedTab = preferredTab && tabs.includes(preferredTab)
    ? preferredTab
    : tabs.includes(state.selectedTab)
      ? state.selectedTab
      : tabs[0];
}

function renderInspectorTabs() {
  const tabContext = contextForInspectorTab(state.selectedTab);
  if (tabContext && tabContext !== state.inspectorContext) state.inspectorContext = tabContext;
  const visibleTabs = state.inspectorContext === "more" ? [] : inspectorTabs[state.inspectorContext] || inspectorTabs.commit;
  if (visibleTabs.length && !visibleTabs.includes(state.selectedTab)) state.selectedTab = visibleTabs[0];
  els.inspector?.classList.toggle("more-context", state.inspectorContext === "more");
  document.querySelectorAll(".tab").forEach((tab) => {
    const visible = visibleTabs.includes(tab.dataset.tab);
    tab.hidden = !visible;
    tab.classList.toggle("active", visible && tab.dataset.tab === state.selectedTab);
  });
  if (els.moreInspectorSelect) {
    const moreTabs = inspectorTabs.more;
    els.moreInspectorSelect.value = moreTabs.includes(state.selectedTab) ? state.selectedTab : "";
  }
}

function ensureInspectorTabData(tab) {
  const detailSection = repoDetailSectionForTab(tab);
  if (detailSection) loadRepoDetailSection(detailSection);
  if (tab === "sync") {
    refreshSyncState().catch((error) => toast(error.message));
  }
  if (tab === "fileHistory" && state.selectedFile && state.fileHistory.file !== state.selectedFile) {
    openFileHistory(state.selectedFile).catch((error) => toast(error.message));
  }
  if (tab === "fileBlame" && state.selectedFile && state.fileBlame.file !== state.selectedFile) {
    openFileBlame(state.selectedFile).catch((error) => toast(error.message));
  }
}
