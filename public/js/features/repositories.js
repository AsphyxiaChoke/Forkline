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
    `<option value="">最近仓库</option>`,
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
  if (!confirm("确认清除最近仓库列表？\n\n这只会清除当前浏览器里的 Forkline 记录，不会删除任何本地仓库。")) return;
  try {
    localStorage.removeItem(recentRepoStorageKey);
  } catch {
    toast("浏览器阻止访问最近仓库记录");
    return;
  }
  renderRecentRepos();
  toast("最近仓库已清除");
}

function openCloneModal() {
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
    toast("请输入克隆来源");
    els.cloneUrlInput.focus();
    return;
  }
  if (!targetPath) {
    toast("请输入保存位置");
    els.cloneTargetInput.focus();
    return;
  }
  const openAfter = els.cloneOpenToggle.checked;
  const message = [
    "确认克隆仓库？",
    "",
    `来源：${source}`,
    `保存到：${targetPath}`,
    "",
    "命令：git clone <来源> <保存到>",
  ].join("\n");
  if (!confirm(message)) return;

  els.cloneSubmit.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "cloneRepository", url: source, targetPath, openAfter }),
    });
    if (result.state) {
      await applyOpenedRepoData(result.state);
      saveRecentRepo(state.data.repo);
      els.repoInput.value = state.data.repo.path;
    }
    closeCloneModal();
    toast(result.output || "克隆完成");
  } catch (error) {
    toast(error.message);
  } finally {
    els.cloneSubmit.disabled = false;
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
    toast("请先打开真实 Git 仓库");
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
    toast("请先打开真实 Git 仓库");
    return;
  }
  const patch = els.patchTextInput.value;
  const stage = els.patchStageToggle.checked;
  if (!patch.trim()) {
    toast("请粘贴补丁内容");
    els.patchTextInput.focus();
    return;
  }
  const command = stage ? "git apply --index" : "git apply";
  if (!confirm(`确认应用补丁？\n\n命令：${command}\n${stage ? "补丁会应用并进入暂存区。" : "补丁会应用到工作区，不会自动暂存。"}`)) return;
  try {
    els.patchSubmit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "applyPatch", patch, stage }),
    });
    closePatchModal();
    toast(result.output || "补丁已应用");
    state.commitDetails.clear();
    state.data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    els.patchSubmit.disabled = false;
  }
}

async function submitInitForm(event) {
  event.preventDefault();
  const targetPath = els.initPathInput.value.trim();
  if (!targetPath) {
    toast("请输入要初始化的文件夹");
    els.initPathInput.focus();
    return;
  }
  const openAfter = els.initOpenToggle.checked;
  const message = [
    "确认初始化 Git 仓库？",
    "",
    `位置：${targetPath}`,
    "",
    "命令：git init <文件夹>",
  ].join("\n");
  if (!confirm(message)) return;

  els.initSubmit.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "initRepository", targetPath, openAfter }),
    });
    if (result.state) {
      await applyOpenedRepoData(result.state);
      saveRecentRepo(state.data.repo);
      els.repoInput.value = state.data.repo.path;
    }
    closeInitModal();
    toast(result.output || "初始化仓库完成");
  } catch (error) {
    toast(error.message);
  } finally {
    els.initSubmit.disabled = false;
  }
}

async function applyOpenedRepoData(data) {
  state.commitDetails.clear();
  state.fileHistory = { file: "", ref: "", data: null, loading: false, error: "" };
  state.fileBlame = { file: "", ref: "", data: null, loading: false, error: "" };
  state.historyPlan = null;
  state.historyQueue = { items: [], loading: false, preview: null, error: "" };
  state.remoteCheck = null;
  state.data = data;
  state.selectedRef = state.data.repo.branch && state.data.repo.branch !== "detached HEAD" ? state.data.repo.branch : "";
  if (state.selectedRef) {
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  }
  state.selectedSha = state.data.commits[0]?.sha || "";
  els.searchInput.value = "";
  renderAll();
  if (state.selectedSha) {
    await loadCommit(state.selectedSha);
    renderInspector();
  }
}

async function openRepo(pathOverride = "") {
  const repoPath = typeof pathOverride === "string" && pathOverride ? pathOverride.trim() : els.repoInput.value.trim();
  if (!repoPath) {
    toast("请输入仓库路径");
    return;
  }
  try {
    els.openRepo.disabled = true;
    await applyOpenedRepoData(await api("/api/open", { method: "POST", body: JSON.stringify({ path: repoPath }) }));
    saveRecentRepo(state.data.repo);
    toast(`已打开 ${state.data.repo.name}`);
    await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  } finally {
    els.openRepo.disabled = false;
  }
}

