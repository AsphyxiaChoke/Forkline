// Loads full context menu behavior on the first right-click.
const contextMenuResource = "./js/features/context-menus.js";
const contextMenuStyleResource = "./context-menu.css";
let contextMenuLoadPromise = null;
let contextMenuStyleLoadPromise = null;

function contextMenuImplementationLoaded() {
  return typeof window.showCommitContextMenu === "function"
    && typeof window.showBranchContextMenu === "function"
    && typeof window.showFileContextMenu === "function"
    && typeof window.showTagContextMenu === "function"
    && typeof window.showRemoteContextMenu === "function"
    && typeof window.showReflogContextMenu === "function"
    && typeof window.runFileContextAction === "function"
    && typeof window.runBranchContextAction === "function";
}

function contextMenusLoaded() {
  return contextMenuImplementationLoaded() && contextMenuStyleLoaded();
}

function contextMenuResourceElement() {
  return document.querySelector("[data-context-menu-resource]");
}

function contextMenuStyleElement() {
  return document.querySelector("[data-context-menu-style]");
}

function contextMenuStyleLoaded() {
  return contextMenuStyleElement()?.dataset.loaded === "true";
}

function contextMenuLoadError() {
  return t("右键菜单资源加载失败，请重试。");
}

function loadContextMenuScript() {
  if (contextMenuImplementationLoaded()) return Promise.resolve();
  const existing = contextMenuResourceElement();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = contextMenuResource;
    script.async = false;
    script.dataset.contextMenuResource = "true";
    script.onload = () => {
      if (!contextMenuImplementationLoaded()) {
        script.remove();
        reject(new Error(contextMenuLoadError()));
        return;
      }
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(contextMenuLoadError()));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function ensureContextMenuStyleLoaded() {
  if (contextMenuStyleLoaded()) return Promise.resolve();
  if (contextMenuStyleLoadPromise) return contextMenuStyleLoadPromise;
  const existing = contextMenuStyleElement();
  contextMenuStyleLoadPromise = new Promise((resolve, reject) => {
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = contextMenuStyleResource;
    link.dataset.contextMenuStyle = "true";
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      contextMenuStyleLoadPromise = null;
      reject(new Error(contextMenuLoadError()));
    };
    if (!existing) document.head.appendChild(link);
  });
  return contextMenuStyleLoadPromise;
}

async function ensureContextMenusLoaded() {
  if (contextMenusLoaded()) return;
  if (!contextMenuLoadPromise) {
    contextMenuLoadPromise = Promise.all([ensureContextMenuStyleLoaded(), loadContextMenuScript()]);
  }
  try {
    await contextMenuLoadPromise;
  } catch (error) {
    contextMenuLoadPromise = null;
    throw error;
  }
}

async function showCommitContextMenuLazy(event, commit) {
  const repoPath = repoPathSnapshot();
  await ensureContextMenusLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return window.showCommitContextMenu(event, commit);
}

async function showBranchContextMenuLazy(event, branch, options = {}) {
  const repoPath = repoPathSnapshot();
  await ensureContextMenusLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return window.showBranchContextMenu(event, branch, options);
}

async function showFileContextMenuLazy(event, filePath, scope = "") {
  const repoPath = repoPathSnapshot();
  await ensureContextMenusLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return window.showFileContextMenu(event, filePath, scope);
}

async function showTagContextMenuLazy(event, tag) {
  const repoPath = repoPathSnapshot();
  await ensureContextMenusLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return window.showTagContextMenu(event, tag);
}

async function showRemoteContextMenuLazy(event, remote) {
  const repoPath = repoPathSnapshot();
  await ensureContextMenusLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return window.showRemoteContextMenu(event, remote);
}

async function showReflogContextMenuLazy(event, entry) {
  const repoPath = repoPathSnapshot();
  await ensureContextMenusLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return window.showReflogContextMenu(event, entry);
}

function positionContextMenu(menu, event, fallbackHeight = 220) {
  const width = menu.offsetWidth || 230;
  const height = menu.offsetHeight || fallbackHeight;
  const x = clamp(event.clientX, 8, window.innerWidth - width - 8);
  const y = clamp(event.clientY, 8, window.innerHeight - height - 8);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

function hideCommitContextMenu() {
  els.commitContextMenu.classList.remove("show");
  els.commitContextMenu.setAttribute("aria-hidden", "true");
  state.contextCommitSha = "";
}

function hideBranchContextMenu() {
  els.branchContextMenu.classList.remove("show");
  els.branchContextMenu.setAttribute("aria-hidden", "true");
  state.contextBranch = null;
}

function hideFileContextMenu() {
  els.fileContextMenu.classList.remove("show");
  els.fileContextMenu.setAttribute("aria-hidden", "true");
  state.contextFile = null;
}

function hideTagContextMenu() {
  els.tagContextMenu.classList.remove("show");
  els.tagContextMenu.setAttribute("aria-hidden", "true");
  state.contextTag = null;
}

function hideRemoteContextMenu() {
  els.remoteContextMenu.classList.remove("show");
  els.remoteContextMenu.setAttribute("aria-hidden", "true");
  state.contextRemote = null;
}

function hideReflogContextMenu() {
  els.reflogContextMenu.classList.remove("show");
  els.reflogContextMenu.setAttribute("aria-hidden", "true");
  state.contextReflogEntry = null;
}
