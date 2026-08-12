// Keeps lightweight diff state available while loading the interactive workbench on first use.
const diffWorkbenchResources = [
  "./js/features/diff-selection.js",
  "./js/features/diff-workbench.js",
];
const diffWorkbenchStyleResource = "./diff-workbench.css";

let diffWorkbenchLoadPromise = null;
let diffWorkbenchStyleLoadPromise = null;

function diffWorkbenchResourceElement(resource) {
  return Array.from(document.querySelectorAll("[data-diff-workbench-resource]"))
    .find((element) => element.dataset.diffWorkbenchResource === resource) || null;
}

function loadDiffWorkbenchScript(resource) {
  const existing = diffWorkbenchResourceElement(resource);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = resource;
    script.async = false;
    script.dataset.diffWorkbenchResource = resource;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(t("Diff 工作台资源加载失败，请重试。")));
    };
    if (!existing) document.head.appendChild(script);
  });
}

function diffWorkbenchStyleElement() {
  return document.querySelector("[data-diff-workbench-style]");
}

function diffWorkbenchStyleLoaded() {
  return diffWorkbenchStyleElement()?.dataset.loaded === "true";
}

function loadDiffWorkbenchStyle() {
  if (diffWorkbenchStyleLoaded()) return Promise.resolve();
  if (diffWorkbenchStyleLoadPromise) return diffWorkbenchStyleLoadPromise;
  const existing = diffWorkbenchStyleElement();
  const promise = new Promise((resolve, reject) => {
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = diffWorkbenchStyleResource;
    link.dataset.diffWorkbenchStyle = "true";
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      reject(new Error(t("Diff 工作台资源加载失败，请重试。")));
    };
    if (!existing) document.head.appendChild(link);
  });
  diffWorkbenchStyleLoadPromise = promise;
  promise.catch(() => {
    if (diffWorkbenchStyleLoadPromise === promise) diffWorkbenchStyleLoadPromise = null;
  });
  return promise;
}

function diffWorkbenchResourcesLoaded() {
  return diffWorkbenchStyleLoaded()
    && typeof loadWorkingDiff === "function"
    && typeof runWorkDiffHunkAction === "function"
    && typeof runWorkDiffLineAction === "function";
}

async function loadDiffWorkbenchScripts() {
  for (const resource of diffWorkbenchResources) await loadDiffWorkbenchScript(resource);
}

async function ensureDiffWorkbenchLoaded() {
  if (diffWorkbenchResourcesLoaded()) return;
  if (!diffWorkbenchLoadPromise) {
    diffWorkbenchLoadPromise = (async () => {
      await Promise.all([
        loadDiffWorkbenchStyle(),
        loadDiffWorkbenchScripts(),
      ]);
      if (!diffWorkbenchResourcesLoaded()) throw new Error(t("Diff 工作台资源加载失败，请重试。"));
    })();
  }
  try {
    await diffWorkbenchLoadPromise;
  } catch (error) {
    diffWorkbenchLoadPromise = null;
    throw error;
  }
}

async function loadWorkingDiffLazy(filePath) {
  const repoPath = repoPathSnapshot();
  await ensureDiffWorkbenchLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return loadWorkingDiff(filePath);
}

async function openDiffModalLazy() {
  const repoPath = repoPathSnapshot();
  await ensureDiffWorkbenchLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return openDiffModal();
}

async function runWorkDiffLineActionLazy(button) {
  const repoPath = repoPathSnapshot();
  await ensureDiffWorkbenchLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return runWorkDiffLineAction(button);
}

async function runWorkDiffHunkActionLazy(action, button) {
  const repoPath = repoPathSnapshot();
  await ensureDiffWorkbenchLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return runWorkDiffHunkAction(action, button);
}

async function handleDiffLineSelectionLazy(row, event = {}, root = els.workDiffView) {
  const repoPath = repoPathSnapshot();
  await ensureDiffWorkbenchLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return handleDiffLineSelection(row, event, root);
}

function renderWorkDiffEmpty(message) {
  state.selectedDiffLines.clear();
  state.lastDiffLineKey = "";
  setActiveDiff(null);
  els.workDiffTitle.textContent = t("变更对照");
  els.workDiffPath.textContent = "";
  els.workDiffView.className = "work-diff-view empty";
  els.workDiffView.textContent = t(message);
}

function setActiveDiff(payload) {
  state.activeDiff = payload;
  state.diffModalRenderLimit = SIDE_DIFF_INITIAL_RENDER_LINES;
  if (els.editWorktreeFile) {
    els.editWorktreeFile.disabled = !(payload?.source === "worktree" && payload?.path && !state.data?.repo?.isSample);
  }
  if (els.maximizeDiff) els.maximizeDiff.disabled = !payload?.diff?.length;
}

function selectedWorkingFileInfo(filePath = state.selectedFile, scope = state.workDiffScope) {
  if (!filePath) return null;
  const matches = (state.data?.workingFiles || []).filter((file) => file.file === filePath);
  if (scope === "staged") return matches.find((file) => file.staged) || matches[0] || null;
  if (scope === "unstaged" || scope === "untracked") return matches.find((file) => file.unstaged) || matches[0] || null;
  return matches[0] || null;
}

function fileChangeFlags(fileInfo) {
  if (!fileInfo) return { hasUnstaged: false, hasStaged: false };
  return {
    hasUnstaged: Boolean(fileInfo?.unstaged || (!fileInfo?.staged && fileInfo?.unstaged !== false)),
    hasStaged: Boolean(fileInfo?.staged),
  };
}

function isUntrackedFile(fileInfo) {
  return Boolean(fileInfo && fileInfo.indexStatus === "?" && fileInfo.worktreeStatus === "?");
}

function preferredWorkDiffScope(fileInfo) {
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  if (hasUnstaged) return "unstaged";
  if (hasStaged) return "staged";
  return "unstaged";
}

function normalizeWorkDiffScopeChoice(scope, fileInfo) {
  const requested = scope === "staged" ? "staged" : "unstaged";
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  if (requested === "staged" && hasStaged) return "staged";
  if (requested === "unstaged" && hasUnstaged) return "unstaged";
  return preferredWorkDiffScope(fileInfo);
}

function closeDiffModal() {
  els.diffModal.classList.remove("show");
  els.diffModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  els.diffModalBody.replaceChildren();
}
