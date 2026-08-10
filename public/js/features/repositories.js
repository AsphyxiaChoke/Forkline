// Repository path, recent repositories, clone/init/patch, open repo, and ref selection.
function applyFilter(value) {
  els.searchInput.value = value;
  renderCommits();
}

function recentRepos() {
  try {
    const data = JSON.parse(localStorage.getItem(recentRepoStorageKey) || "[]");
    return Array.isArray(data) ? data.filter((item) => item?.path).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveRecentRepo(repo) {
  if (!repo?.path || repo.isSample) return;
  const pathKey = normalizeRecentRepoPath(repo.path);
  const records = recentRepos().filter((item) => normalizeRecentRepoPath(item.path) !== pathKey);
  records.unshift({
    path: repo.path,
    name: repo.name || repo.path,
    branch: repo.branch || "",
    lastOpened: new Date().toISOString(),
  });
  try {
    localStorage.setItem(recentRepoStorageKey, JSON.stringify(records.slice(0, 10)));
  } catch {
    return;
  }
  renderRecentRepos();
}

function renderRecentRepos() {
  if (!els.recentRepoSelect) return;
  const records = recentRepos();
  els.recentRepoSelect.innerHTML = [
    `<option value="">${t("最近仓库")}</option>`,
    ...records.map((repo) => `<option value="${escapeAttr(repo.path)}">${escapeHtml(recentRepoLabel(repo))}</option>`),
  ].join("");
  els.recentRepoSelect.disabled = !records.length;
  if (els.clearRecentRepos) els.clearRecentRepos.disabled = !records.length;
}

function recentRepoLabel(repo) {
  const branch = repo.branch ? ` · ${repo.branch}` : "";
  const pathTail = recentRepoPathTail(repo.path);
  const suffix = pathTail && pathTail !== repo.name ? ` · ${pathTail}` : "";
  return `${repo.name || repo.path}${branch}${suffix}`;
}

function recentRepoPathTail(path) {
  const parts = String(path || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  return parts.slice(-2).join("/");
}

function normalizeRecentRepoPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

async function openRecentRepo() {
  const path = els.recentRepoSelect.value;
  if (!path) return;
  els.repoInput.value = path;
  await openRepo(path);
  els.recentRepoSelect.value = "";
}

function clearRecentRepos() {
  if (!recentRepos().length) return;
  if (!confirm(t("确认清除最近仓库列表？\n\n这只会清除当前浏览器里的 Forkline 记录，不会删除任何本地仓库。"))) return;
  try {
    localStorage.removeItem(recentRepoStorageKey);
  } catch {
    toast(t("浏览器阻止访问最近仓库记录"));
    return;
  }
  renderRecentRepos();
  toast(t("最近仓库已清除"));
}

function openCloneModal() {
  if (state.cloneOperationPending) {
    toast(t("克隆操作仍在进行，请到操作日志查看进度或取消。"));
    return;
  }
  els.cloneUrlInput.value = "";
  els.cloneTargetInput.value = "";
  els.cloneOpenToggle.checked = true;
  state.cloneTargetAuto = true;
  els.cloneModal.classList.add("show");
  els.cloneModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.cloneUrlInput.focus(), 0);
}

function closeCloneModal() {
  els.cloneModal.classList.remove("show");
  els.cloneModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.cloneTargetAuto = false;
}

function setCloneOperationPending(pending, cancelling = false) {
  state.cloneOperationPending = pending;
  els.cloneSubmit.disabled = pending;
  els.cloneUrlInput.disabled = pending;
  els.cloneTargetInput.disabled = pending;
  els.cloneOpenToggle.disabled = pending;
  els.cloneCancel.disabled = cancelling;
  els.cloneCancel.textContent = pending ? (cancelling ? t("取消中") : t("取消克隆")) : t("取消");
}

async function cancelCloneOrClose() {
  if (!state.cloneOperationPending) {
    closeCloneModal();
    return;
  }
  setCloneOperationPending(true, true);
  await refreshOperationProgress();
  let operation = (state.data?.runningOperations || []).find((item) => item.action === "cloneRepository");
  if (!operation) {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    await refreshOperationProgress();
    operation = (state.data?.runningOperations || []).find((item) => item.action === "cloneRepository");
  }
  if (!operation) {
    setCloneOperationPending(true, false);
    throw new Error(t("克隆操作正在启动，请稍候再取消。"));
  }
  try {
    await cancelRunningOperation(operation.id, { confirm: false, button: els.cloneCancel });
  } catch (error) {
    setCloneOperationPending(true, false);
    throw error;
  }
}

function syncCloneTargetSuggestion() {
  const target = els.cloneTargetInput.value.trim();
  if (target && !state.cloneTargetAuto) return;
  if (!target) state.cloneTargetAuto = true;
  const source = els.cloneUrlInput.value.trim();
  const name = cloneNameFromSource(source);
  const base = cloneBaseDirectory();
  if (name && base) els.cloneTargetInput.value = joinLocalPath(base, name);
}

function cloneBaseDirectory() {
  const repoPath = state.data?.repo && !state.data.repo.isSample ? state.data.repo.path : recentRepos()[0]?.path || "";
  return repoParentPath(repoPath);
}

function repoParentPath(repoPath) {
  const value = String(repoPath || "").trim();
  const slash = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  if (slash < 0) return "";
  if (/^[A-Za-z]:[\\/]/.test(value) && slash === 2) return value.slice(0, 3);
  return value.slice(0, slash);
}

function cloneNameFromSource(source) {
  const clean = String(source || "")
    .trim()
    .split(/[?#]/)[0]
    .replace(/[\\/]+$/, "");
  if (!clean) return "";
  const name = clean.split(/[\\/:]/).filter(Boolean).pop() || "";
  return name.replace(/\.git$/i, "") || "repository";
}

function joinLocalPath(base, name) {
  const root = String(base || "").replace(/[\\/]+$/, "");
  const sep = root.includes("\\") || /^[A-Za-z]:/.test(root) ? "\\" : "/";
  return `${root}${sep}${name}`;
}

async function submitCloneForm(event) {
  event.preventDefault();
  const source = els.cloneUrlInput.value.trim();
  const targetPath = els.cloneTargetInput.value.trim();
  if (!source) {
    toast(t("请输入克隆来源"));
    els.cloneUrlInput.focus();
    return;
  }
  if (!targetPath) {
    toast(t("请输入保存位置"));
    els.cloneTargetInput.focus();
    return;
  }
  const openAfter = els.cloneOpenToggle.checked;
  const message = t(
    "确认克隆仓库？\n\n来源：{source}\n保存到：{target}\n\n命令：git clone <来源> <保存到>",
    { source, target: targetPath }
  );
  if (!confirm(message)) return;

  setCloneOperationPending(true);
  const openRequestId = openAfter ? ++state.openRepoRequestId : 0;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "cloneRepository", url: source, targetPath, openAfter }),
    });
    if (result.state) {
      const opened = await applyOpenedRepoData(result.state, openRequestId);
      if (opened) {
        saveRecentRepo(state.data.repo);
        els.repoInput.value = state.data.repo.path;
      }
    }
    closeCloneModal();
    toast(result.output || t("克隆完成"));
  } catch (error) {
    if (error.data?.cancelled) closeCloneModal();
    toast(error.message);
  } finally {
    setCloneOperationPending(false);
  }
}

function openInitModal() {
  const typedPath = els.repoInput.value.trim();
  const hasRealRepo = Boolean(state.data?.repo && !state.data.repo.isSample);
  els.initPathInput.value = hasRealRepo ? "" : typedPath;
  els.initOpenToggle.checked = true;
  els.initModal.classList.add("show");
  els.initModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.initPathInput.focus(), 0);
}

function closeInitModal() {
  els.initModal.classList.remove("show");
  els.initModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openPatchModal() {
  if (!state.data || state.data.repo.isSample) {
    toast(t("请先打开真实 Git 仓库"));
    return;
  }
  els.patchTextInput.value = "";
  els.patchStageToggle.checked = true;
  els.patchModal.classList.add("show");
  els.patchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.patchTextInput.focus(), 0);
}

function closePatchModal() {
  els.patchModal.classList.remove("show");
  els.patchModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function submitPatchForm(event) {
  event.preventDefault();
  if (!state.data || state.data.repo.isSample) {
    toast(t("请先打开真实 Git 仓库"));
    return;
  }
  const patch = els.patchTextInput.value;
  const stage = els.patchStageToggle.checked;
  if (!patch.trim()) {
    toast(t("请粘贴补丁内容"));
    els.patchTextInput.focus();
    return;
  }
  const command = stage ? "git apply --index" : "git apply";
  if (!confirm(t("确认应用补丁？\n\n命令：{command}\n{effect}", {
    command,
    effect: stage ? t("补丁会应用并进入暂存区。") : t("补丁会应用到工作区，不会自动暂存。"),
  }))) return;
  const repoPath = repoPathSnapshot();
  try {
    els.patchSubmit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "applyPatch", patch, stage, ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    closePatchModal();
    toast(result.output || t("补丁已应用"));
    const data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    if (!isCurrentRepoPath(repoPath)) return;
    state.commitDetails.clear();
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    els.patchSubmit.disabled = false;
  }
}

async function submitInitForm(event) {
  event.preventDefault();
  const targetPath = els.initPathInput.value.trim();
  if (!targetPath) {
    toast(t("请输入要初始化的文件夹"));
    els.initPathInput.focus();
    return;
  }
  const openAfter = els.initOpenToggle.checked;
  const message = t("确认初始化 Git 仓库？\n\n位置：{path}\n\n命令：git init <文件夹>", { path: targetPath });
  if (!confirm(message)) return;

  els.initSubmit.disabled = true;
  const openRequestId = openAfter ? ++state.openRepoRequestId : 0;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "initRepository", targetPath, openAfter }),
    });
    if (result.state) {
      const opened = await applyOpenedRepoData(result.state, openRequestId);
      if (opened) {
        saveRecentRepo(state.data.repo);
        els.repoInput.value = state.data.repo.path;
      }
    }
    closeInitModal();
    toast(result.output || t("初始化仓库完成"));
  } catch (error) {
    toast(error.message);
  } finally {
    els.initSubmit.disabled = false;
  }
}

async function applyOpenedRepoData(data, requestId = 0) {
  if (requestId && requestId !== state.openRepoRequestId) return false;
  clearOpenedRepoState();
  state.data = data;
  state.repoHydrating = Boolean(data.progressive);
  state.selectedRef = state.data.repo.branch && state.data.repo.branch !== "detached HEAD" ? state.data.repo.branch : "";
  if (state.selectedRef && !data.progressive) {
    const selectedRef = state.selectedRef;
    const refData = await api(`/api/ref-state?ref=${encodeURIComponent(selectedRef)}`);
    if (requestId && requestId !== state.openRepoRequestId) return false;
    state.data = {
      ...state.data,
      repo: { ...state.data.repo, ...(refData.repo || {}), selectedRef: refData.repo?.selectedRef || selectedRef },
      commits: refData.commits || [],
      history: refData.history || state.data.history,
    };
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  }
  loadRecoveryPolicyForRepo(state.data.repo);
  state.selectedSha = state.data.commits[0]?.sha || "";
  els.searchInput.value = "";
  renderAll();
  const hydrationPromise = data.progressive
    ? hydrateOpenedRepoData(requestId, state.data.repo.path, state.selectedRef)
    : null;
  if (state.selectedSha) {
    await loadCommit(state.selectedSha);
  }
  if (hydrationPromise && !(await hydrationPromise)) return false;
  renderInspector();
  return true;
}

async function hydrateOpenedRepoData(requestId, repoPath, openedRef) {
  try {
    const data = await api(`/api/state?ref=${encodeURIComponent(openedRef || "")}&details=core`);
    if (requestId !== state.openRepoRequestId || !isCurrentRepoPath(repoPath)) return false;
    const viewedRef = state.selectedRef;
    const viewedCommits = state.data.commits || [];
    const viewedHistory = state.data.history || {};
    const selectedSha = state.selectedSha;
    state.data = {
      ...data,
      repo: { ...(data.repo || {}), selectedRef: viewedRef },
      commits: viewedCommits,
      history: viewedHistory,
      progressive: false,
      progressiveError: "",
    };
    state.selectedRef = viewedRef;
    state.selectedSha = viewedCommits.some((commit) => commit.sha === selectedSha)
      ? selectedSha
      : viewedCommits[0]?.sha || "";
    state.repoHydrating = false;
    renderRepo();
    renderBranches();
    renderStage();
    updateAmendMode();
    return true;
  } catch (error) {
    if (requestId !== state.openRepoRequestId || !isCurrentRepoPath(repoPath)) return false;
    state.data.progressive = false;
    state.data.progressiveError = String(error?.message || error || t("未知错误"));
    state.repoHydrating = true;
    renderStage();
    toast(t("仓库已打开，但工作区详情加载失败：{message}", { message: state.data.progressiveError }));
    return true;
  }
}

const repoDetailFields = {
  branchCleanup: ["branchCleanup"],
  worktrees: ["worktrees", "worktreePruneSnapshot"],
  submodules: ["submodules"],
  stashes: ["stashes"],
  recoveryPoints: ["recoveryPoints"],
};

function repoDetailSectionForTab(tab) {
  return {
    branches: "branchCleanup",
    worktrees: "worktrees",
    submodules: "submodules",
    stashes: "stashes",
    recovery: "recoveryPoints",
  }[tab] || "";
}

function repoDetailLoaded(section) {
  if (!state.data || state.data.progressive) return false;
  const fields = repoDetailFields[section] || [];
  return fields.length > 0 && fields.every((field) => Object.prototype.hasOwnProperty.call(state.data, field));
}

function repoDetailLoadState(section) {
  if (repoDetailLoaded(section)) return { status: "loaded", error: "" };
  if (state.data?.progressive) return { status: "loading", error: "" };
  const current = state.repoDetailLoads[section];
  if (current?.repoPath === repoPathSnapshot() && current.status !== "loaded") return current;
  return { status: "idle", error: "" };
}

async function loadRepoDetailSection(section, options = {}) {
  if (!repoDetailFields[section] || !state.data || state.data.repo.isSample || state.data.progressive) return false;
  if (!options.refresh && repoDetailLoaded(section)) return true;
  const repoPath = repoPathSnapshot();
  if (!repoPath) return false;
  const requestId = ++state.repoDetailRequestId;
  state.repoDetailLoads[section] = { repoPath, requestId, status: "loading", error: "" };
  try {
    const data = await api(`/api/state-details?section=${encodeURIComponent(section)}`);
    const current = state.repoDetailLoads[section];
    if (!current || current.requestId !== requestId || !isCurrentRepoPath(repoPath)) return false;
    if (data.section && data.section !== section) throw new Error(t("仓库详情区块不合法"));
    mergeRepoDetailSection(section, data);
    state.repoDetailLoads[section] = { repoPath, requestId, status: "loaded", error: "" };
    if (section === "branchCleanup" || section === "worktrees") renderBranches();
    if (repoDetailSectionForTab(state.selectedTab) === section) renderInspector();
    return true;
  } catch (error) {
    const current = state.repoDetailLoads[section];
    if (!current || current.requestId !== requestId || !isCurrentRepoPath(repoPath)) return false;
    state.repoDetailLoads[section] = {
      repoPath,
      requestId,
      status: "error",
      error: String(error?.message || error || t("读取失败")),
    };
    if (repoDetailSectionForTab(state.selectedTab) === section) renderInspector();
    return false;
  }
}

function mergeRepoDetailSection(section, data) {
  if (!state.data) return;
  for (const field of repoDetailFields[section] || []) {
    state.data[field] = field === "worktreePruneSnapshot" ? String(data[field] || "") : (data[field] || []);
  }
  if (Array.isArray(data.branches)) state.data.branches = data.branches;
  if (section === "branchCleanup" && data.branchInfo) {
    state.data.branchInfo = data.branchInfo;
  } else if (section === "worktrees" && data.worktreeBranchInfo) {
    const branchInfo = {};
    for (const [branch, info] of Object.entries(state.data.branchInfo || {})) {
      const { worktreePath, prunable, reason, ...rest } = info || {};
      branchInfo[branch] = rest;
    }
    state.data.branchInfo = { ...branchInfo };
    for (const [branch, info] of Object.entries(data.worktreeBranchInfo)) {
      state.data.branchInfo[branch] = { ...(state.data.branchInfo[branch] || {}), ...info };
    }
  } else if (data.branchInfo) {
    state.data.branchInfo = { ...(state.data.branchInfo || {}), ...data.branchInfo };
  }
}

function renderRepoDetailPlaceholder(section, title, borderColor) {
  if (repoDetailLoaded(section)) return false;
  const loadState = repoDetailLoadState(section);
  if (loadState.status === "idle") loadRepoDetailSection(section);
  const failed = loadState.status === "error";
  els.detailNode.style.borderColor = borderColor;
  els.detailTitle.textContent = t(title);
  els.detailSub.textContent = t(failed ? "读取失败" : "读取中");
  setActiveDiff(null);
  els.detailBody.innerHTML = `
    <div class="empty-panel">
      <strong>${t(failed ? "读取失败" : "读取中")}</strong>
      ${failed ? `<span>${escapeHtml(loadState.error)}</span><button class="mini-btn" data-repo-detail-retry="${escapeAttr(section)}" type="button">${t("刷新")}</button>` : ""}
    </div>
  `;
  return true;
}

function clearOpenedRepoState() {
  clearRepoScopedActionState();
  if (typeof clearRecoveryUndo === "function") clearRecoveryUndo();
  state.selectedFile = "";
  state.workDiffScope = "unstaged";
  state.selectedCommitFile = "";
  state.selectedSyncSha = "";
  state.selectedSyncFile = "";
  state.selectedCompareFile = "";
  state.compare = { base: "", head: "", data: null, loading: false, error: "" };
  state.selectedChanges.clear();
  state.selectedDiffLines.clear();
  state.lastChangeSelection = null;
  state.worktreeRenderLimits = { unstaged: 800, staged: 800 };
  state.lastDiffLineKey = "";
  state.workDiffFeedback = null;
  setActiveDiff(null);
  state.commitDetails.clear();
  state.loadingCommitDetails.clear();
  state.stashDetails.clear();
  state.selectedStash = "";
  state.fileHistory = { file: "", ref: "", data: null, loading: false, error: "" };
  state.fileBlame = { file: "", ref: "", data: null, loading: false, error: "" };
  state.historyPlan = null;
  state.historyQueue = { items: [], loading: false, preview: null, error: "" };
  state.reflogRequestId += 1;
  state.reflog = { key: "", entries: null, loading: false, error: "", inline: false };
  state.remoteCheck = null;
  state.authDiagnosticsRequestId += 1;
  state.authDiagnostics = { repoPath: "", remoteKey: "", data: null, loading: false, error: "", inline: false };
  state.repoDetailLoads = {};
}

function clearRepoScopedActionState() {
  state.branchStartSha = "";
  state.branchRenameOld = "";
  state.branchModalMode = "create";
  state.tagTargetSha = "";
  state.mainlineAction = "";
  state.mainlineCommitSha = "";
  state.contextCommitSha = "";
  state.contextBranch = null;
  state.contextFile = null;
  state.contextTag = null;
  state.contextRemote = null;
  state.contextReflogEntry = null;
  if (typeof destroyFileEditorInstance === "function") destroyFileEditorInstance();
  state.fileEditor = null;
  let closedModal = false;
  for (const modal of [els.branchModal, els.tagModal, els.mainlineModal, els.fileEditorModal]) {
    if (!modal) continue;
    if (modal.classList?.contains?.("show")) closedModal = true;
    modal.classList?.remove?.("show");
    modal.setAttribute?.("aria-hidden", "true");
  }
  if (els.mainlineOptions) els.mainlineOptions.innerHTML = "";
  resetFileEditorSearchUi();
  if (els.fileEditorOldText) els.fileEditorOldText.value = "";
  if (els.fileEditorText) els.fileEditorText.value = "";
  for (const menu of [els.commitContextMenu, els.branchContextMenu, els.fileContextMenu, els.fileEditorContextMenu, els.tagContextMenu, els.remoteContextMenu, els.reflogContextMenu]) {
    menu?.classList?.remove?.("show");
    menu?.setAttribute?.("aria-hidden", "true");
  }
  if (closedModal) document.body.classList.remove("modal-open");
}

async function openRepo(pathOverride = "") {
  const repoPath = typeof pathOverride === "string" && pathOverride ? pathOverride.trim() : els.repoInput.value.trim();
  if (!repoPath) {
    toast(t("请输入仓库路径"));
    return;
  }
  const requestId = ++state.openRepoRequestId;
  state.repoHydrating = true;
  try {
    els.openRepo.disabled = true;
    const data = await api("/api/open", { method: "POST", body: JSON.stringify({ path: repoPath, progressive: true }) });
    if (requestId !== state.openRepoRequestId) return;
    const opened = await applyOpenedRepoData(data, requestId);
    if (!opened) return;
    saveRecentRepo(state.data.repo);
    if (!state.data.progressiveError) {
      toast(t("已打开 {name}", { name: state.data.repo.name }));
      await maybeRestoreCheckoutStash(state.data.repo.branch);
    }
  } catch (error) {
    if (requestId !== state.openRepoRequestId) return;
    state.repoHydrating = false;
    toast(error.message);
  } finally {
    if (requestId === state.openRepoRequestId) els.openRepo.disabled = false;
  }
}

