const $ = (selector) => document.querySelector(selector);
const recentRepoStorageKey = "forkline-recent-repos";
const recoveryPolicyStorageKey = "forkline-recovery-policy";

const state = {
  data: null,
  filtered: [],
  selectedSha: "",
  selectedTab: "details",
  selectedRef: "",
  theme: "dark",
  selectedFile: "",
  workDiffScope: "unstaged",
  selectedCommitFile: "",
  selectedSyncSha: "",
  selectedSyncFile: "",
  selectedCompareFile: "",
  compare: { base: "", head: "", data: null, loading: false, error: "" },
  fileHistory: { file: "", ref: "", data: null, loading: false, error: "" },
  fileBlame: { file: "", ref: "", data: null, loading: false, error: "" },
  activeDiff: null,
  openDiffOnInit: false,
  branchStartSha: "",
  branchModalMode: "create",
  branchRenameOld: "",
  tagTargetSha: "",
  mainlineAction: "",
  mainlineCommitSha: "",
  contextCommitSha: "",
  contextBranch: null,
  contextFile: null,
  contextTag: null,
  contextRemote: null,
  diffRequestId: 0,
  refreshingWorktree: false,
  worktreeSignature: "",
  commitDetails: new Map(),
  loadingCommitDetails: new Set(),
  stashDetails: new Map(),
  selectedStash: "",
  selectedTag: "",
  selectedRecoveryRef: "",
  recoveryFilter: { query: "", branch: "", action: "" },
  recoveryPolicy: defaultRecoveryPolicy(),
  remoteCheck: null,
  historyPlan: null,
  historyQueue: { items: [], loading: false, preview: null, error: "" },
  historyQueuePreviewTimer: 0,
  ignoredCheckoutStashes: new Set(),
  selectedChanges: new Set(),
  lastChangeSelection: null,
  branchFilter: "",
  worktreeFilter: "",
  cloneTargetAuto: false,
  commandPaletteIndex: 0,
};

const laneX = [28, 54, 80, 106, 118, 126, 128];
const rowH = 62;
const els = {
  repoName: $("#repoName"),
  repoPath: $("#repoPath"),
  sideRepoName: $("#sideRepoName"),
  sideRepoBranch: $("#sideRepoBranch"),
  repoInput: $("#repoInput"),
  recentRepoSelect: $("#recentRepoSelect"),
  clearRecentRepos: $("#clearRecentRepos"),
  cloneRepo: $("#cloneRepo"),
  initRepo: $("#initRepo"),
  openRepo: $("#openRepo"),
  openCommandPalette: $("#openCommandPalette"),
  searchInput: $("#searchInput"),
  searchCount: $("#searchCount"),
  clearSearch: $("#clearSearch"),
  branchList: $("#branchList"),
  branchFilterInput: $("#branchFilterInput"),
  branchFilterCount: $("#branchFilterCount"),
  clearBranchFilter: $("#clearBranchFilter"),
  newBranch: $("#newBranch"),
  remoteList: $("#remoteList"),
  worktreeList: $("#worktreeList"),
  worktreeFilterInput: $("#worktreeFilterInput"),
  worktreeFilterCount: $("#worktreeFilterCount"),
  clearWorktreeFilter: $("#clearWorktreeFilter"),
  branchStrip: $("#branchStrip"),
  commitGraph: $("#commitGraph"),
  changeList: $("#changeList"),
  stageAll: $("#stageAll"),
  stashChanges: $("#stashChanges"),
  discardAll: $("#discardAll"),
  commitForm: $("#commitForm"),
  commitSummary: $("#commitSummary"),
  commitBody: $("#commitBody"),
  amendToggle: $("#amendToggle"),
  commitSubmit: $("#commitSubmit"),
  draftNote: $("#draftNote"),
  workDiffTitle: $("#workDiffTitle"),
  workDiffPath: $("#workDiffPath"),
  workDiffView: $("#workDiffView"),
  maximizeDiff: $("#maximizeDiff"),
  refreshChanges: $("#refreshChanges"),
  diffModal: $("#diffModal"),
  diffModalTitle: $("#diffModalTitle"),
  diffModalPath: $("#diffModalPath"),
  diffModalBody: $("#diffModalBody"),
  closeDiffModal: $("#closeDiffModal"),
  commitContextMenu: $("#commitContextMenu"),
  branchContextMenu: $("#branchContextMenu"),
  fileContextMenu: $("#fileContextMenu"),
  tagContextMenu: $("#tagContextMenu"),
  remoteContextMenu: $("#remoteContextMenu"),
  detailNode: $("#detailNode"),
  detailTitle: $("#detailTitle"),
  detailSub: $("#detailSub"),
  detailBody: $("#detailBody"),
  checkoutModal: $("#checkoutModal"),
  checkoutModalText: $("#checkoutModalText"),
  stashRestoreModal: $("#stashRestoreModal"),
  stashRestoreText: $("#stashRestoreText"),
  cloneModal: $("#cloneModal"),
  cloneForm: $("#cloneForm"),
  cloneUrlInput: $("#cloneUrlInput"),
  cloneTargetInput: $("#cloneTargetInput"),
  cloneOpenToggle: $("#cloneOpenToggle"),
  cloneSubmit: $("#cloneSubmit"),
  cloneCancel: $("#cloneCancel"),
  initModal: $("#initModal"),
  initForm: $("#initForm"),
  initPathInput: $("#initPathInput"),
  initOpenToggle: $("#initOpenToggle"),
  initSubmit: $("#initSubmit"),
  initCancel: $("#initCancel"),
  commandPalette: $("#commandPalette"),
  commandInput: $("#commandInput"),
  commandList: $("#commandList"),
  commandClose: $("#commandClose"),
  branchModal: $("#branchModal"),
  branchForm: $("#branchForm"),
  branchNameInput: $("#branchNameInput"),
  branchModalTitle: $("#branchModalTitle"),
  branchStartText: $("#branchStartText"),
  branchCheckoutLabel: $("#branchCheckoutLabel"),
  branchCheckoutToggle: $("#branchCheckoutToggle"),
  branchSubmit: $("#branchSubmit"),
  branchCancel: $("#branchCancel"),
  tagModal: $("#tagModal"),
  tagForm: $("#tagForm"),
  tagNameInput: $("#tagNameInput"),
  tagAnnotatedToggle: $("#tagAnnotatedToggle"),
  tagMessageInput: $("#tagMessageInput"),
  tagStartText: $("#tagStartText"),
  tagSubmit: $("#tagSubmit"),
  tagCancel: $("#tagCancel"),
  mainlineModal: $("#mainlineModal"),
  mainlineForm: $("#mainlineForm"),
  mainlineOptions: $("#mainlineOptions"),
  mainlineModalTitle: $("#mainlineModalTitle"),
  mainlineStartText: $("#mainlineStartText"),
  mainlineSubmit: $("#mainlineSubmit"),
  mainlineCancel: $("#mainlineCancel"),
  toast: $("#toast"),
  themeToggle: $("#themeToggle"),
  graphModeLabel: $("#graphModeLabel"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (data.operationLog && state.data) state.data.operationLog = data.operationLog;
  if (data.runningOperations && state.data) state.data.runningOperations = data.runningOperations;
  if (!response.ok || data.error) {
    const error = new Error(data.error || "请求失败");
    error.data = data;
    if (data.remoteCheck) error.remoteCheck = data.remoteCheck;
    throw error;
  }
  return data;
}

async function init() {
  try {
    renderRecentRepos();
    const params = new URLSearchParams(window.location.search);
    const initialRef = params.get("ref") || "";
    const initialTab = params.get("tab") || "";
    state.openDiffOnInit = params.get("diff") === "max";
    if (["details", "files", "fileHistory", "fileBlame", "branches", "worktrees", "sync", "compare", "stashes", "tags", "recovery", "logs"].includes(initialTab)) state.selectedTab = initialTab;
    state.selectedRef = initialRef;
    state.data = await api(`/api/state?ref=${encodeURIComponent(initialRef)}`);
    state.selectedRef = state.data.repo.selectedRef || initialRef;
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
      if (state.openDiffOnInit) openDiffModal();
    }
    await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  }
}

function renderAll() {
  renderRepo();
  renderBranches();
  renderWorkingFiles();
  renderStage();
  renderCommits();
  renderInspector();
}

function renderRepo() {
  const repo = state.data.repo;
  els.repoName.textContent = repo.name;
  els.repoPath.textContent = state.selectedRef ? `${repo.path} · ${state.selectedRef}` : repo.path;
  els.sideRepoName.textContent = repo.name;
  els.sideRepoBranch.textContent = state.selectedRef || repo.branch;
  if (!repo.isSample) els.repoInput.value = repo.path;
}

function renderBranches() {
  els.branchList.innerHTML = "";
  els.remoteList.innerHTML = "";
  els.branchStrip.innerHTML = "";
  const currentRef = state.selectedRef;
  const currentBranch = state.data.repo.branch;
  const filterTerms = branchFilterTerms();

  const allChip = document.createElement("button");
  allChip.className = `branch-chip ${state.selectedRef ? "" : "active"}`;
  allChip.type = "button";
  allChip.innerHTML = `<span class="branch-dot" style="--branch:var(--quiet)"></span><span>全部分支</span>`;
  allChip.addEventListener("click", () => selectRef(""));
  els.branchStrip.appendChild(allChip);

  const branchInfo = state.data.branchInfo || {};
  const localBranchItems = state.data.branches.map((branch, index) => {
    const info = branchInfo[branch] || {};
    const options = {
      local: true,
      checkout: true,
      current: branch === currentBranch,
      occupied: Boolean(info.worktreePath),
      worktreePath: info.worktreePath,
      prunable: info.prunable,
      upstream: info.upstream || "",
      ahead: Number(info.ahead || 0),
      behind: Number(info.behind || 0),
      upstreamGone: Boolean(info.upstreamGone),
      merge: true,
      rename: true,
      delete: true,
    };
    return { branch, index, options, active: branch === currentRef };
  });
  const remoteBranchItems = state.data.remotes.map((branch, index) => ({
    branch,
    index: index + 3,
    options: { remote: true, remoteCheckout: true, merge: true, deleteRemote: true },
    active: branch === currentRef,
  }));
  const visibleLocalBranches = filterBranchItems(localBranchItems, filterTerms);
  const visibleRemoteBranches = filterBranchItems(remoteBranchItems, filterTerms);
  visibleLocalBranches.forEach(({ branch, index, options, active }) => {
    els.branchList.appendChild(branchButton(branch, index, active, options));
  });
  if (!visibleLocalBranches.length) appendBranchEmpty(els.branchList, filterTerms.length ? "没有匹配的本地分支" : "没有本地分支");
  localBranchItems.forEach(({ branch, index, options }) => {
    const chip = document.createElement("button");
    chip.className = `branch-chip ${branch === currentRef ? "active" : ""}`;
    chip.type = "button";
    chip.innerHTML = `<span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span>`;
    chip.addEventListener("click", () => selectRef(branch));
    chip.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showBranchContextMenu(event, branch, options);
    });
    els.branchStrip.appendChild(chip);
  });
  visibleRemoteBranches.forEach(({ branch, index, options, active }) => {
    els.remoteList.appendChild(branchButton(branch, index, active, options));
  });
  if (!visibleRemoteBranches.length) appendBranchEmpty(els.remoteList, filterTerms.length ? "没有匹配的远端分支" : "没有远端分支");
  updateBranchFilterMeta(filterTerms, visibleLocalBranches.length + visibleRemoteBranches.length, localBranchItems.length + remoteBranchItems.length);
}

function branchFilterTerms() {
  return String(state.branchFilter || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function filterBranchItems(items, terms) {
  if (!terms.length) return items;
  return items.filter((item) => {
    const text = branchSearchText(item.branch, item.options);
    return terms.every((term) => text.includes(term));
  });
}

function branchSearchText(branch, options = {}) {
  return [
    branch,
    options.upstream,
    options.upstreamGone ? "上游丢失 gone" : "",
    options.ahead ? `领先 ahead ${options.ahead}` : "",
    options.behind ? `落后 behind ${options.behind}` : "",
    options.remote ? remoteCheckoutBranch(branch) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function updateBranchFilterMeta(terms, visibleCount, totalCount) {
  const active = terms.length > 0;
  els.branchFilterCount.textContent = active ? `${visibleCount}/${totalCount}` : "";
  els.branchFilterCount.title = active ? `分支筛选结果：${visibleCount} / ${totalCount}` : "";
  els.branchFilterCount.hidden = !active;
  els.clearBranchFilter.hidden = !active;
}

function appendBranchEmpty(root, text) {
  const empty = document.createElement("div");
  empty.className = "branch-empty";
  empty.textContent = text;
  root.appendChild(empty);
}

function updateBranchFilter(value) {
  state.branchFilter = String(value || "");
  renderBranches();
}

function clearBranchFilter() {
  if (!state.branchFilter && !els.branchFilterInput.value) return;
  state.branchFilter = "";
  els.branchFilterInput.value = "";
  renderBranches();
  els.branchFilterInput.focus();
}

function branchButton(branch, index, active, options = {}) {
  const row = document.createElement("div");
  row.className = "branch-row";
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showBranchContextMenu(event, branch, options);
  });
  const button = document.createElement("button");
  button.className = `nav-item ${active ? "active" : ""}`;
  button.type = "button";
  button.title = branchTrackingTitle(branch, options);
  button.innerHTML = `<span class="branch-dot" style="--branch:${laneColor(index)}"></span><span class="branch-copy"><span class="branch-name">${escapeHtml(branch)}</span>${branchTrackingHtml(options)}</span>`;
  button.addEventListener("click", () => selectRef(branch));
  row.appendChild(button);
  if (options.checkout) {
    const checkout = document.createElement("button");
    const blocked = options.occupied && !options.current;
    const canPrune = blocked && options.prunable;
    checkout.className = "branch-checkout";
    checkout.type = "button";
    checkout.textContent = options.current ? "当前" : canPrune ? "清理" : blocked ? "占用" : "切换";
    checkout.disabled = Boolean(options.current || (blocked && !canPrune));
    checkout.title = branchCheckoutTitle(branch, options, blocked);
    if (canPrune) {
      checkout.classList.add("prune");
      checkout.addEventListener("click", (event) => {
        event.stopPropagation();
        cleanupStaleWorktree(branch, checkout, options);
      });
    } else if (blocked) {
      checkout.classList.add("blocked");
    } else {
      checkout.addEventListener("click", (event) => {
        event.stopPropagation();
        checkoutBranch(branch, checkout);
      });
    }
    row.appendChild(checkout);
  }
  if (options.remoteCheckout) {
    const checkout = document.createElement("button");
    const localBranch = remoteCheckoutBranch(branch);
    checkout.className = "branch-checkout remote";
    checkout.type = "button";
    checkout.textContent = "签出";
    checkout.disabled = Boolean(!localBranch || localBranch === state.data.repo.branch);
    checkout.title = !localBranch
      ? "这个远端引用不能自动推导本地分支名"
      : checkout.disabled
        ? "对应的本地分支已经是当前分支"
        : `签出 ${branch} 为本地分支 ${localBranch}`;
    checkout.addEventListener("click", (event) => {
      event.stopPropagation();
      checkoutRemoteBranch(branch, checkout);
    });
    row.appendChild(checkout);
  }
  if (options.merge) {
    const merge = document.createElement("button");
    merge.className = "branch-merge";
    merge.type = "button";
    merge.textContent = "合并";
    merge.disabled = Boolean(options.current);
    merge.title = options.current ? "不能把当前分支合并到自己" : `合并 ${branch} 到当前分支`;
    merge.addEventListener("click", (event) => {
      event.stopPropagation();
      mergeBranchRef(branch);
    });
    row.appendChild(merge);
  }
  if (options.delete) {
    const rename = document.createElement("button");
    const renameBlocked = Boolean(options.occupied && !options.current);
    rename.className = "branch-rename";
    rename.type = "button";
    rename.textContent = "改";
    rename.disabled = renameBlocked;
    rename.title = renameBlocked ? "分支被其他工作树占用，不能重命名" : `重命名本地分支 ${branch}`;
    rename.addEventListener("click", (event) => {
      event.stopPropagation();
      openRenameBranchModal(branch);
    });
    row.appendChild(rename);

    const remove = document.createElement("button");
    const blocked = Boolean(options.current || options.occupied);
    remove.className = "branch-delete";
    remove.type = "button";
    remove.textContent = "删";
    remove.disabled = blocked;
    remove.title = branchDeleteTitle(branch, options, blocked);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteBranch(branch, remove);
    });
    row.appendChild(remove);
  }
  return row;
}

function branchTrackingHtml(options = {}) {
  if (!options.local) return "";
  const badges = [];
  if (options.upstream) badges.push(`<span class="branch-badge upstream">${escapeHtml(options.upstream)}</span>`);
  else if (options.current) badges.push(`<span class="branch-badge muted">未设置 upstream</span>`);
  if (options.upstreamGone) badges.push(`<span class="branch-badge danger">上游丢失</span>`);
  if (options.ahead) badges.push(`<span class="branch-badge ahead">↑${Number(options.ahead)}</span>`);
  if (options.behind) badges.push(`<span class="branch-badge behind">↓${Number(options.behind)}</span>`);
  return badges.length ? `<span class="branch-meta">${badges.join("")}</span>` : "";
}

function branchTrackingTitle(branch, options = {}) {
  if (!options.local) return branch;
  const parts = [branch];
  if (options.upstream) parts.push(`upstream：${options.upstream}`);
  else if (options.current) parts.push("未设置 upstream，推送时会自动设置");
  if (options.upstreamGone) parts.push("上游分支已不存在");
  if (options.ahead) parts.push(`领先 ${options.ahead} 个提交`);
  if (options.behind) parts.push(`落后 ${options.behind} 个提交`);
  return parts.join("\n");
}

function branchCheckoutTitle(branch, options, blocked) {
  if (options.current) return "当前分支";
  if (!blocked) return `切换到 ${branch}`;
  if (options.prunable) return `失效 worktree 占用：${options.worktreePath || "未知路径"}。点击清理后可再切换`;
  return `已在其他工作树签出：${options.worktreePath || "未知路径"}`;
}

function branchDeleteTitle(branch, options, blocked) {
  if (options.current) return "不能删除当前分支";
  if (options.occupied) return "分支被其他工作树占用，先清理或切换后再删除";
  return `删除本地分支 ${branch}`;
}

async function deleteBranch(branch, button) {
  if (!state.data || !branch) return;
  if (!confirm(`确认删除本地分支：${branch}？\n\n会使用安全删除；如果分支还没有合并，Git 会阻止删除。`)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteBranch", branch }) });
    toast(result.output || `已删除本地分支 ${branch}`);
    state.commitDetails.clear();
    if (state.selectedRef === branch) state.selectedRef = state.data.repo.branch || "";
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteRemoteBranch(remoteRef) {
  if (!state.data || !remoteRef) return;
  const command = remoteDeleteCommand(remoteRef);
  if (!confirm(`确认删除远端分支：${remoteRef}？\n\n此操作会删除远端仓库中的分支，不会删除本地分支。\n命令：${command}`)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteRemoteBranch", ref: remoteRef }) });
    toast(result.output || `已删除远端分支 ${remoteRef}`);
    state.commitDetails.clear();
    if (state.selectedRef === remoteRef) state.selectedRef = state.data.repo.branch || "";
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  }
}

function remoteDeleteCommand(remoteRef) {
  const parts = String(remoteRef || "").split("/").filter(Boolean);
  if (parts.length < 2) return "git push <远端> --delete <分支>";
  return `git push ${parts[0]} --delete ${parts.slice(1).join("/")}`;
}

async function cleanupStaleWorktree(branch, button, options = {}) {
  if (!state.data) return;
  const pathText = options.worktreePath ? `\n占用路径：${options.worktreePath}` : "";
  if (!state.data.repo.isSample && !confirm(`确认清理 ${branch} 的失效 worktree 记录？${pathText}\n\n这只清理 Git 的失效 worktree 元数据，不会删除当前工作区文件。`)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "pruneWorktrees", branch }) });
    toast(result.output || "已清理失效 worktree 记录");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function openBranchModal() {
  if (!state.data) return;
  const commit = state.data.commits.find((item) => item.sha === state.selectedSha);
  state.branchModalMode = "create";
  state.branchRenameOld = "";
  state.branchStartSha = commit?.sha || "";
  els.branchNameInput.value = "";
  els.branchModalTitle.textContent = "新建分支";
  els.branchNameInput.placeholder = "例如 feature/login";
  els.branchCheckoutToggle.checked = true;
  els.branchCheckoutLabel.style.display = "";
  els.branchSubmit.textContent = "创建分支";
  els.branchStartText.textContent = commit
    ? `从选中提交 ${commit.short} 创建分支。`
    : "从当前 HEAD 创建分支。";
  els.branchModal.classList.add("show");
  els.branchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.branchNameInput.focus(), 0);
}

function openBranchModalFromRef(ref, label = "分支") {
  if (!state.data || !ref) return;
  state.branchModalMode = "create";
  state.branchRenameOld = "";
  state.branchStartSha = ref;
  els.branchNameInput.value = "";
  els.branchModalTitle.textContent = "新建分支";
  els.branchNameInput.placeholder = "例如 feature/login";
  els.branchCheckoutToggle.checked = true;
  els.branchCheckoutLabel.style.display = "";
  els.branchSubmit.textContent = "创建分支";
  els.branchStartText.textContent = `从${label} ${ref} 的最新提交创建分支。`;
  els.branchModal.classList.add("show");
  els.branchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.branchNameInput.focus(), 0);
}

function openRenameBranchModal(branch) {
  if (!state.data || !branch) return;
  state.branchModalMode = "rename";
  state.branchRenameOld = branch;
  state.branchStartSha = "";
  els.branchNameInput.value = branch;
  els.branchNameInput.placeholder = "新的分支名";
  els.branchModalTitle.textContent = "重命名分支";
  els.branchStartText.textContent = `将 ${branch} 重命名为新的本地分支名。`;
  els.branchCheckoutLabel.style.display = "none";
  els.branchSubmit.textContent = "重命名";
  els.branchModal.classList.add("show");
  els.branchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => {
    els.branchNameInput.focus();
    els.branchNameInput.select();
  }, 0);
}

function closeBranchModal() {
  els.branchModal.classList.remove("show");
  els.branchModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function submitBranchForm(event) {
  event.preventDefault();
  if (!state.data) return;
  const branch = els.branchNameInput.value.trim();
  if (!branch) {
    toast("请输入分支名");
    els.branchNameInput.focus();
    return;
  }
  if (state.branchModalMode === "rename") {
    await renameBranchFromForm(branch);
    return;
  }
  const checkout = els.branchCheckoutToggle.checked;
  const submit = els.branchForm.querySelector('button[type="submit"]');
  try {
    submit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "createBranch", branch, start: state.branchStartSha, checkout }),
    });
    toast(result.output || `已创建分支 ${branch}`);
    closeBranchModal();
    state.commitDetails.clear();
    state.selectedRef = result.checkedOut ? branch : state.selectedRef;
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
}

async function renameBranchFromForm(nextBranch) {
  const oldBranch = state.branchRenameOld;
  if (!oldBranch) return;
  if (oldBranch === nextBranch) {
    closeBranchModal();
    return;
  }
  const submit = els.branchSubmit;
  try {
    submit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "renameBranch", branch: oldBranch, newBranch: nextBranch }),
    });
    toast(result.output || `已重命名为 ${nextBranch}`);
    closeBranchModal();
    state.commitDetails.clear();
    if (state.selectedRef === oldBranch || state.data.repo.branch === oldBranch) state.selectedRef = nextBranch;
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
}

function renderWorkingFiles() {
  els.worktreeList.innerHTML = "";
  const files = state.data.workingFiles;
  const terms = worktreeFilterTerms();
  const visibleFiles = filterWorkingFiles(files, terms);
  state.worktreeSignature = worktreeStateSignature(files, state.data.repo.operation);
  updateWorktreeFilterMeta(terms, visibleFiles.length, files.length);
  if (!files.length) {
    els.worktreeList.innerHTML = `<div class="file-row"><span></span><span class="file-name">工作区干净</span><span></span></div>`;
    return;
  }
  if (!visibleFiles.length) {
    els.worktreeList.innerHTML = `<div class="file-row empty-row"><span></span><span class="file-name">没有匹配的工作区文件</span><span></span></div>`;
    return;
  }
  els.worktreeList.innerHTML = fileTreeHtml(visibleFiles);
  bindFileTree(els.worktreeList, { selectable: true });
}

function renderStage() {
  els.changeList.innerHTML = "";
  const files = state.data.workingFiles;
  const terms = worktreeFilterTerms();
  const visibleFiles = filterWorkingFiles(files, terms);
  state.worktreeSignature = worktreeStateSignature(files, state.data.repo.operation);
  const operationBanner = renderRepoOperationBanner(files);
  if (!files.length) {
    state.selectedFile = "";
    state.selectedChanges.clear();
    els.changeList.innerHTML = `${operationBanner}<div class="file-row"><span></span><span class="file-name">没有未提交的更改</span><span></span></div>`;
    if (state.activeDiff?.source !== "history") renderWorkDiffEmpty("没有未提交的更改");
  } else {
    const groups = changeGroups(visibleFiles);
    pruneSelectedChanges(groups);
    const visibleChangeFiles = [...groups.unstaged, ...groups.staged];
    if (!visibleChangeFiles.length) {
      state.selectedFile = "";
      state.selectedChanges.clear();
      els.changeList.innerHTML = `${operationBanner}<div class="file-row empty-row"><span></span><span class="file-name">${terms.length ? "没有匹配的更改" : "没有未提交的更改"}</span><span></span></div>`;
      if (state.activeDiff?.source !== "history") renderWorkDiffEmpty(terms.length ? "没有匹配的更改" : "没有未提交的更改");
    } else {
      const previousFile = state.selectedFile;
      if (!visibleChangeFiles.some((file) => file.file === state.selectedFile)) {
        state.selectedFile = visibleChangeFiles[0]?.file || "";
      }
      if (state.selectedFile !== previousFile) {
        state.workDiffScope = preferredWorkDiffScope(selectedWorkingFileInfo(state.selectedFile));
      } else {
        state.workDiffScope = normalizeWorkDiffScopeChoice(state.workDiffScope, selectedWorkingFileInfo(state.selectedFile));
      }
      els.changeList.innerHTML = `
        ${operationBanner}
        ${renderChangeSection("unstaged", "未暂存", groups.unstaged, [
          { action: "stageFile", label: "暂存", bulkLabel: "暂存所选" },
          { action: "discardWorktreeFile", label: "丢弃", bulkLabel: "丢弃所选", danger: true },
        ])}
        ${renderChangeSection("staged", "已暂存", groups.staged, [
          { action: "unstageFile", label: "取消暂存", bulkLabel: "取消所选" },
          { action: "discardStagedFile", label: "丢弃", bulkLabel: "丢弃所选", danger: true },
        ])}
      `;
      bindFileTree(els.changeList, { selectable: true });
      markSelectedFile();
      if (state.activeDiff?.source !== "history") loadWorkingDiff(state.selectedFile);
    }
  }
  const counts = countFiles(files);
  const groups = changeGroups(files);
  const filterText = terms.length ? ` · 筛选 ${visibleFiles.length}/${files.length}` : "";
  els.draftNote.textContent = `${groups.unstaged.length} 个未暂存，${groups.staged.length} 个已暂存 · ${counts.C} 个冲突，${counts.M} 个修改，${counts.A} 个新增，${counts.D} 个删除${filterText}`;
}

function worktreeFilterTerms() {
  return String(state.worktreeFilter || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function filterWorkingFiles(files, terms = worktreeFilterTerms()) {
  if (!terms.length) return files;
  return files.filter((file) => {
    const text = worktreeFileSearchText(file);
    return terms.every((term) => text.includes(term));
  });
}

function worktreeFileSearchText(file) {
  const pathText = String(file.file || "");
  const normalized = pathText.replaceAll("\\", "/");
  const leaf = normalized.split("/").filter(Boolean).pop() || pathText;
  return [
    pathText,
    normalized,
    leaf,
    file.state,
    file.extra,
    file.indexStatus,
    file.worktreeStatus,
    file.oldFile,
    file.previousFile,
    file.conflict ? "冲突 conflict unmerged" : "",
    file.staged ? "已暂存 staged cached index" : "",
    file.unstaged || (!file.staged && file.unstaged !== false) ? "未暂存 unstaged worktree working" : "",
    worktreeStateLabel(file.state),
    worktreeRawStatusLabel(file),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function worktreeStateLabel(stateCode) {
  const labels = {
    A: "新增 添加 未跟踪 added add new untracked",
    C: "冲突 unmerged conflict",
    D: "删除 deleted delete removed remove",
    M: "修改 modified change changed",
  };
  return labels[stateCode] || "";
}

function worktreeRawStatusLabel(file) {
  const raw = [file.extra, file.indexStatus, file.worktreeStatus].filter(Boolean).join("").toUpperCase();
  const labels = [];
  if (raw.includes("?")) labels.push("未跟踪 untracked new");
  if (raw.includes("R")) labels.push("重命名 renamed rename moved move");
  if (raw.includes("C")) labels.push("复制 copied copy");
  if (raw.includes("U")) labels.push("冲突 unmerged conflict");
  if (raw.includes("A")) labels.push("新增 添加 added add new");
  if (raw.includes("D")) labels.push("删除 deleted delete removed remove");
  if (raw.includes("M")) labels.push("修改 modified change changed");
  return labels.join(" ");
}

function updateWorktreeFilterMeta(terms, visibleCount, totalCount) {
  const active = terms.length > 0;
  els.worktreeFilterCount.textContent = active ? `${visibleCount}/${totalCount}` : "";
  els.worktreeFilterCount.title = active ? `工作区筛选结果：${visibleCount} / ${totalCount}` : "";
  els.worktreeFilterCount.hidden = !active;
  els.clearWorktreeFilter.hidden = !active;
}

function updateWorktreeFilter(value) {
  state.worktreeFilter = String(value || "");
  renderWorkingFiles();
  renderStage();
}

function clearWorktreeFilter() {
  if (!state.worktreeFilter && !els.worktreeFilterInput.value) return;
  state.worktreeFilter = "";
  els.worktreeFilterInput.value = "";
  renderWorkingFiles();
  renderStage();
  els.worktreeFilterInput.focus();
}

function renderRepoOperationBanner(files) {
  const operation = state.data?.repo?.operation;
  const conflicts = (files || []).filter((file) => file.conflict);
  if (!operation && !conflicts.length) return "";
  const isRevert = operation?.type === "revert";
  const isCherryPick = operation?.type === "cherryPick";
  const isMerge = operation?.type === "merge";
  const isRebase = operation?.type === "rebase";
  const actionName = isRebase ? "变基" : isMerge ? "合并" : isCherryPick ? "挑选" : isRevert ? "还原" : "操作";
  const title = isRebase ? "变基发生冲突" : isMerge ? "合并发生冲突" : isRevert ? "还原提交发生冲突" : isCherryPick ? "挑选提交发生冲突" : operation?.label || "仓库有未完成操作";
  const text = conflicts.length
    ? `${conflicts.length} 个冲突文件还没有解决。解决后先暂存冲突文件，再继续${actionName}；不想保留这次${actionName}就中止。`
    : `当前${actionName}已经没有冲突文件，确认解决结果后可以继续${actionName}。`;
  const actions = isRevert
    ? `
      <button class="mini-btn" data-repo-operation="continueRevert" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git revert --continue"}"><span>继续还原</span><span class="command-hint">git revert --continue</span></button>
      <button class="mini-btn danger" data-repo-operation="abortRevert" type="button" title="git revert --abort"><span>中止还原</span><span class="command-hint">git revert --abort</span></button>
    `
    : isCherryPick
    ? `
      <button class="mini-btn" data-repo-operation="continueCherryPick" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git cherry-pick --continue"}"><span>继续挑选</span><span class="command-hint">git cherry-pick --continue</span></button>
      <button class="mini-btn" data-repo-operation="skipCherryPick" type="button" title="git cherry-pick --skip"><span>跳过挑选</span><span class="command-hint">git cherry-pick --skip</span></button>
      <button class="mini-btn danger" data-repo-operation="abortCherryPick" type="button" title="git cherry-pick --abort"><span>中止挑选</span><span class="command-hint">git cherry-pick --abort</span></button>
    `
    : isMerge
    ? `
      <button class="mini-btn" data-repo-operation="continueMerge" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git merge --continue"}"><span>继续合并</span><span class="command-hint">git merge --continue</span></button>
      <button class="mini-btn danger" data-repo-operation="abortMerge" type="button" title="git merge --abort"><span>中止合并</span><span class="command-hint">git merge --abort</span></button>
    `
    : isRebase
    ? `
      <button class="mini-btn" data-repo-operation="continueRebase" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git rebase --continue"}"><span>继续变基</span><span class="command-hint">git rebase --continue</span></button>
      <button class="mini-btn" data-repo-operation="skipRebase" type="button" title="git rebase --skip"><span>跳过提交</span><span class="command-hint">git rebase --skip</span></button>
      <button class="mini-btn danger" data-repo-operation="abortRebase" type="button" title="git rebase --abort"><span>中止变基</span><span class="command-hint">git rebase --abort</span></button>
    `
    : "";
  return `
    <div class="operation-banner">
      <div class="operation-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(text)}</span>
      </div>
      <div class="operation-actions">${actions}</div>
    </div>
  `;
}

function changeGroups(files) {
  return {
    unstaged: files.filter((file) => file.unstaged || (!file.staged && file.unstaged !== false)),
    staged: files.filter((file) => file.staged),
  };
}

function renderChangeSection(scope, title, files, actions) {
  const emptyText = title === "未暂存" ? "没有未暂存的更改" : "没有已暂存的更改";
  const selectedCount = selectedFilesInScope(scope, files).length;
  return `
    <section class="change-section">
      <div class="change-section-title">
        <div class="change-section-label">
          <span>${title}</span>
          <em>${files.length}</em>
        </div>
        <div class="change-section-actions">
          ${selectedCount ? `<span class="selected-count">${selectedCount} 已选</span>` : ""}
          ${actions
            .map(
              (item) => `
                <button class="mini-btn bulk-action ${item.danger ? "danger" : ""}" type="button" data-bulk-file-action="${escapeAttr(item.action)}" data-scope="${escapeAttr(scope)}" ${selectedCount ? "" : "disabled"}>
                  ${escapeHtml(item.bulkLabel || item.label || "操作")}
                </button>
              `
            )
            .join("")}
        </div>
      </div>
      ${
        files.length
          ? fileTreeHtml(files, { selectionScope: scope })
          : `<div class="file-row empty-row"><span></span><span class="file-name">${emptyText}</span><span></span></div>`
      }
    </section>
  `;
}

function changeKey(scope, filePath) {
  return `${scope}:${filePath}`;
}

function selectedFilesInScope(scope, files) {
  return files.filter((file) => state.selectedChanges.has(changeKey(scope, file.file)));
}

function pruneSelectedChanges(groups) {
  const valid = new Set([
    ...groups.unstaged.map((file) => changeKey("unstaged", file.file)),
    ...groups.staged.map((file) => changeKey("staged", file.file)),
  ]);
  for (const key of state.selectedChanges) {
    if (!valid.has(key)) state.selectedChanges.delete(key);
  }
}

function renderCommits() {
  const terms = commitSearchTerms();
  state.filtered = !terms.length
    ? state.data.commits
    : state.data.commits.filter((commit) => commitMatchesSearch(commit, terms));
  updateCommitSearchMeta(terms, state.filtered.length, state.data.commits.length);

  if (state.filtered.length && !state.filtered.some((commit) => commit.sha === state.selectedSha)) {
    state.selectedSha = state.filtered[0].sha;
  }

  const minHeight = Math.max(rowH, state.filtered.length * rowH);
  const isBranchScope = Boolean(state.selectedRef);
  els.commitGraph.style.minHeight = `${minHeight}px`;
  els.commitGraph.classList.toggle("branch-scope", isBranchScope);
  els.commitGraph.classList.toggle("all-scope", !isBranchScope);
  els.graphModeLabel.textContent = isBranchScope ? state.selectedRef : "全部分支";
  els.graphModeLabel.title = isBranchScope ? `当前只显示 ${state.selectedRef}` : "当前显示所有分支";
  const graphCommits = layoutGraphCommits(state.filtered, state.selectedRef);
  els.commitGraph.innerHTML = renderGraphSvg(graphCommits, minHeight, state.selectedRef);

  if (!state.filtered.length) {
    const emptyTitle = terms.length ? "没有匹配的提交" : "还没有提交";
    const emptySub = terms.length ? "换一个关键词试试" : "暂存文件后创建第一次提交";
    els.commitGraph.insertAdjacentHTML(
      "beforeend",
      `<div class="commit-row" style="grid-template-columns:1fr;min-width:0"><div class="message"><strong>${emptyTitle}</strong><span>${emptySub}</span></div></div>`
    );
    renderInspector();
    return;
  }

  state.filtered.forEach((commit) => {
    const row = document.createElement("button");
    row.className = `commit-row ${commit.sha === state.selectedSha ? "selected" : ""}`;
    row.type = "button";
    row.dataset.sha = commit.sha;
    row.innerHTML = `
      <div class="graph-cell">
      </div>
      <div class="message">
        <strong title="${escapeAttr(commit.message)}">${highlightSearchText(commit.message, terms)}</strong>
        <span title="${escapeAttr(commit.refs || "提交历史")}">${highlightSearchText(commit.refs || "提交历史", terms)}</span>
      </div>
      <div class="author">
        <span class="author-badge" style="--avatar:${commit.color}">${initials(commit.author)}</span>
        <span title="${escapeAttr(commit.author)}">${highlightSearchText(commit.author, terms)}</span>
      </div>
      <div class="time">${escapeHtml(commit.time)}</div>
      <div class="sha" title="${escapeAttr(commit.sha)}">${highlightSearchText(commit.short, terms)}</div>
    `;
    row.addEventListener("click", async () => {
      await selectCommit(commit.sha);
    });
    row.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      await selectCommit(commit.sha);
      showCommitContextMenu(event, commit);
    });
    els.commitGraph.appendChild(row);
  });
  renderInspector();
}

function commitSearchTerms() {
  return els.searchInput.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function commitMatchesSearch(commit, terms) {
  const text = [commit.sha, commit.short, commit.author, commit.message, commit.refs]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => text.includes(term));
}

function updateCommitSearchMeta(terms, visibleCount, totalCount) {
  const active = terms.length > 0;
  els.searchCount.textContent = active ? `${visibleCount}/${totalCount}` : "";
  els.searchCount.title = active ? `搜索结果：${visibleCount} / ${totalCount} 个提交` : "";
  els.searchCount.hidden = !active;
  els.clearSearch.hidden = !active;
  els.searchInput.closest(".search")?.classList.toggle("active", active);
}

function highlightSearchText(value, terms) {
  const text = String(value || "");
  if (!terms.length || !text) return escapeHtml(text);
  const unique = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "gi");
  let result = "";
  let cursor = 0;
  text.replace(pattern, (match, _group, offset) => {
    result += escapeHtml(text.slice(cursor, offset));
    result += `<mark class="search-hit">${escapeHtml(match)}</mark>`;
    cursor = offset + match.length;
    return match;
  });
  return result + escapeHtml(text.slice(cursor));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearCommitSearch() {
  if (!els.searchInput.value) return;
  els.searchInput.value = "";
  renderCommits();
  els.searchInput.focus();
}

function openCommandPalette() {
  if (otherModalOpen()) return;
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  state.commandPaletteIndex = 0;
  els.commandInput.value = "";
  renderCommandPalette();
  els.commandPalette.classList.add("show");
  els.commandPalette.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.commandInput.focus(), 0);
}

function otherModalOpen() {
  return [
    els.checkoutModal,
    els.stashRestoreModal,
    els.cloneModal,
    els.initModal,
    els.branchModal,
    els.tagModal,
    els.mainlineModal,
    els.diffModal,
  ].some((modal) => modal?.classList.contains("show"));
}

function closeCommandPalette() {
  els.commandPalette.classList.remove("show");
  els.commandPalette.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.commandPaletteIndex = 0;
}

function renderCommandPalette() {
  const items = filteredCommandItems();
  normalizeCommandPaletteIndex(items);
  if (!items.length) {
    els.commandList.innerHTML = `<div class="command-empty">没有匹配的命令</div>`;
    return;
  }
  els.commandList.innerHTML = items
    .map((item, index) => {
      const classes = ["command-row", index === state.commandPaletteIndex ? "active" : "", item.danger ? "danger" : ""].filter(Boolean).join(" ");
      return `
        <button class="${classes}" data-command-id="${escapeAttr(item.id)}" type="button" ${item.disabled ? "disabled" : ""} role="option" aria-selected="${index === state.commandPaletteIndex ? "true" : "false"}">
          <span class="command-main">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.description || "")}</span>
          </span>
          <span class="command-hint-pill">${escapeHtml(item.hint || item.group || "")}</span>
        </button>
      `;
    })
    .join("");
}

function normalizeCommandPaletteIndex(items) {
  state.commandPaletteIndex = clamp(state.commandPaletteIndex, 0, Math.max(items.length - 1, 0));
  if (!items.length || !items[state.commandPaletteIndex]?.disabled) return;
  const enabledIndex = items.findIndex((item) => !item.disabled);
  if (enabledIndex >= 0) state.commandPaletteIndex = enabledIndex;
}

function filteredCommandItems() {
  const terms = els.commandInput.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const items = commandPaletteItems();
  if (!terms.length) return items;
  return items.filter((item) => {
    const text = [item.title, item.description, item.hint, item.group, item.keywords]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

function commandPaletteItems() {
  const hasRepo = Boolean(state.data);
  const realRepo = Boolean(state.data && !state.data.repo.isSample);
  const workingFiles = state.data?.workingFiles || [];
  const hasChanges = workingFiles.length > 0;
  const commit = selectedCommandCommit();
  const hasCommit = Boolean(commit);
  const remoteCommit = hasCommit ? commitRemoteUrl(commit.sha) : "";
  const pullRequest = state.data?.sync?.pullRequest || {};
  const branch = state.data?.repo?.branch || "当前分支";
  return [
    commandItem("focusSearch", "搜索提交", "聚焦顶部提交搜索框", "图谱", "commit author branch sha", hasRepo, () => {
      els.searchInput.focus();
      els.searchInput.select();
    }),
    commandItem("focusBranchFilter", "筛选分支", "聚焦左侧本地和远端分支筛选", "分支", "branch remote upstream filter", hasRepo, () => {
      els.branchFilterInput.focus();
      els.branchFilterInput.select();
    }),
    commandItem("focusWorktreeFilter", "筛选工作区文件", "按路径或状态过滤未提交更改", "工作区", "worktree changes file status filter", hasRepo, () => {
      els.worktreeFilterInput.focus();
      els.worktreeFilterInput.select();
    }),
    commandItem("tabDetails", "打开详情", "查看当前提交详情", "详情", "details commit", hasRepo, () => switchInspectorTab("details")),
    commandItem("tabFiles", "打开文件", "查看当前提交文件改动", "文件", "files diff", hasRepo, () => switchInspectorTab("files")),
    commandItem("tabBranches", "打开分支整理", "查看已合并、上游丢失和长期未动分支", "分支", "branch cleanup prune", hasRepo, () => switchInspectorTab("branches")),
    commandItem("tabWorktrees", "打开工作树", "查看和创建 Git worktree", "git worktree", "worktree workspace parallel checkout", hasRepo, () => switchInspectorTab("worktrees")),
    commandItem("tabSync", "打开同步", "查看 upstream、待拉取和待推送提交", "同步", "fetch pull push upstream", hasRepo, () => switchInspectorTab("sync")),
    commandItem("tabStashes", "打开储藏", "查看和恢复 Git stash", "储藏", "stash", hasRepo, () => switchInspectorTab("stashes")),
    commandItem("tabTags", "打开标签", "查看和管理 Tag", "标签", "tag release", hasRepo, () => switchInspectorTab("tags")),
    commandItem("tabRecovery", "打开恢复点", "查看历史编辑和重置前的恢复引用", "恢复点", "recovery reset", hasRepo, () => switchInspectorTab("recovery")),
    commandItem("tabLogs", "打开日志", "查看最近 Git 操作和失败原因", "日志", "operation log", hasRepo, () => switchInspectorTab("logs")),
    commandItem("refreshWorktree", "刷新工作区", "重新读取未提交修改", "git status", "worktree changes", realRepo, () => refreshWorktree(false)),
    commandItem("stageAll", "暂存全部", "把所有工作区改动加入暂存区", "git add", "stage changes", realRepo && hasChanges, () => runAction("stageAll")),
    commandItem("stashAll", "储藏工作区", "把当前未提交改动移入储藏列表", "git stash", "stash changes", realRepo && hasChanges, () => createStashFromSelection(null)),
    commandItem("discardAll", "丢弃全部", "清空已暂存、未暂存和未跟踪改动", "危险", "discard clean reset", realRepo && hasChanges, () => runAction("discardAll"), true),
    commandItem("fetch", "抓取", "从远端更新引用", "git fetch", "remote sync", realRepo, () => runAction("fetch")),
    commandItem("pull", "拉取", `快进拉取 ${branch}`, "git pull", "remote sync", realRepo, () => runAction("pull")),
    commandItem("pullRebase", "变基拉取", `把 ${branch} 的本地提交重放到远端之后`, "git pull --rebase", "remote rebase", realRepo, () => runAction("pullRebase")),
    commandItem("push", "推送", `推送 ${branch}`, "git push", "remote sync", realRepo, () => runAction("push")),
    commandItem("forcePushLease", "安全强推", "使用 force-with-lease 更新远端分支", "危险", "force push lease", realRepo, () => runAction("forcePushLease"), true),
    commandItem("openPullRequest", pullRequest.title || "创建 PR", `为 ${branch} 打开 ${pullRequest.platformLabel || "远端"} PR/MR 页面`, "web", "pull request merge request pr mr github gitlab", Boolean(pullRequest.available), () => runSyncPullRequestAction("open")),
    commandItem("copyPullRequest", "复制 PR 链接", "复制当前分支的 PR/MR 创建地址", "copy", "pull request merge request pr mr clipboard", Boolean(pullRequest.available), () => runSyncPullRequestAction("copy")),
    commandItem("newBranch", "新建分支", "从当前 HEAD 创建本地分支", "git branch", "branch checkout", hasRepo, openBranchModal),
    commandItem("createTag", "创建 Tag", "基于当前提交创建 Tag", "git tag", "release tag", hasCommit, () => openTagModal(commit)),
    commandItem("copySha", "复制提交 SHA", "复制当前选中提交的完整 SHA", "复制", "clipboard commit sha", hasCommit, async () => {
      await copyText(commit.sha);
      toast("已复制提交 SHA");
    }),
    commandItem("openRemoteCommit", "在远端查看", "打开当前提交的网页远端地址", "web", "github gitlab bitbucket", Boolean(remoteCommit), () => openRemoteCommit(commit)),
    commandItem("cloneRepo", "克隆仓库", "从远端 URL 或本地裸仓库创建工作区", "git clone", "clone repository", true, openCloneModal),
    commandItem("initRepo", "初始化仓库", "把本机文件夹创建为 Git 仓库", "git init", "init repository", true, openInitModal),
  ];
}

function commandItem(id, title, description, hint, keywords, enabled, run, danger = false) {
  return {
    id,
    title,
    description,
    hint,
    keywords,
    disabled: !enabled,
    danger,
    run,
  };
}

function selectedCommandCommit() {
  return state.data?.commits.find((commit) => commit.sha === state.selectedSha) || state.data?.commits?.[0] || null;
}

function switchInspectorTab(tab) {
  state.selectedTab = tab;
  renderInspector();
}

function moveCommandPaletteSelection(delta) {
  const items = filteredCommandItems();
  if (!items.length) return;
  let next = state.commandPaletteIndex;
  for (let step = 0; step < items.length; step += 1) {
    next = (next + delta + items.length) % items.length;
    if (!items[next].disabled) break;
  }
  state.commandPaletteIndex = next;
  renderCommandPalette();
  els.commandList.querySelector(".command-row.active")?.scrollIntoView({ block: "nearest" });
}

async function executeCommandPaletteItem(id) {
  const item = commandPaletteItems().find((candidate) => candidate.id === id);
  if (!item) return;
  if (item.disabled) {
    toast("当前命令不可用");
    renderCommandPalette();
    return;
  }
  closeCommandPalette();
  await item.run();
}

function handleCommandPaletteKeydown(event) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveCommandPaletteSelection(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveCommandPaletteSelection(-1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const items = filteredCommandItems();
    const item = items[state.commandPaletteIndex];
    if (item) executeCommandPaletteItem(item.id).catch((error) => toast(error.message));
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
  }
}

async function selectCommit(sha) {
  if (!sha) return;
  if (state.historyPlan?.sha !== sha) state.historyPlan = null;
  state.selectedSha = sha;
  renderCommits();
  await loadCommit(sha);
  renderInspector();
}

function showCommitContextMenu(event, commit) {
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  state.contextCommitSha = commit.sha;
  const menu = els.commitContextMenu;
  const isMergeCommit = (commit.parents || []).length > 1;
  const canFold = !isMergeCommit && (commit.parents || []).length === 1;
  const canDrop = !isMergeCommit;
  const remoteUrl = commitRemoteUrl(commit.sha);
  const openRemoteButton = menu.querySelector('[data-commit-action="openRemote"]');
  const cherryPickButton = menu.querySelector('[data-commit-action="cherryPick"]');
  const revertButton = menu.querySelector('[data-commit-action="revert"]');
  const squashButton = menu.querySelector('[data-commit-action="squash"]');
  const fixupButton = menu.querySelector('[data-commit-action="fixup"]');
  const dropButton = menu.querySelector('[data-commit-action="drop"]');
  const queueSquashButton = menu.querySelector('[data-commit-action="queueSquash"]');
  const queueFixupButton = menu.querySelector('[data-commit-action="queueFixup"]');
  const queueDropButton = menu.querySelector('[data-commit-action="queueDrop"]');
  const queueRewordButton = menu.querySelector('[data-commit-action="queueReword"]');
  if (openRemoteButton) {
    openRemoteButton.disabled = !remoteUrl;
    openRemoteButton.title = remoteUrl ? `打开远端提交：${remoteUrl}` : "当前仓库没有可识别的网页远端 URL";
  }
  if (cherryPickButton) {
    cherryPickButton.disabled = false;
    cherryPickButton.title = isMergeCommit ? "git cherry-pick -m：挑选 merge 提交前选择主线" : "git cherry-pick：把此提交复制到当前分支";
  }
  if (revertButton) {
    revertButton.disabled = false;
    revertButton.title = isMergeCommit ? "git revert -m：还原 merge 提交前选择主线" : "git revert：创建一个反向提交来抵消此提交";
  }
  if (squashButton) {
    squashButton.disabled = !canFold;
    squashButton.title = isMergeCommit ? "merge 提交暂不支持自动压缩" : canFold ? "git rebase -i squash：把此提交和信息压缩进父提交" : "根提交没有父提交，不能压缩";
  }
  if (fixupButton) {
    fixupButton.disabled = !canFold;
    fixupButton.title = isMergeCommit ? "merge 提交暂不支持自动修补" : canFold ? "git rebase -i fixup：把此提交改动修补进父提交，并丢弃此提交信息" : "根提交没有父提交，不能修补";
  }
  if (dropButton) {
    dropButton.disabled = !canDrop;
    dropButton.title = isMergeCommit ? "merge 提交暂不支持自动丢弃" : "git rebase -i drop：从当前分支历史中删除此提交";
  }
  if (queueSquashButton) {
    queueSquashButton.disabled = !canFold;
    queueSquashButton.title = isMergeCommit ? "merge 提交暂不支持加入历史编辑队列" : canFold ? "加入历史编辑队列：执行时用 squash 压缩进前一条提交" : "根提交没有父提交，不能压缩";
  }
  if (queueFixupButton) {
    queueFixupButton.disabled = !canFold;
    queueFixupButton.title = isMergeCommit ? "merge 提交暂不支持加入历史编辑队列" : canFold ? "加入历史编辑队列：执行时用 fixup 修补进前一条提交" : "根提交没有父提交，不能修补";
  }
  if (queueDropButton) {
    queueDropButton.disabled = !canDrop;
    queueDropButton.title = isMergeCommit ? "merge 提交暂不支持加入历史编辑队列" : "加入历史编辑队列：执行时用 drop 丢弃此提交";
  }
  if (queueRewordButton) {
    queueRewordButton.disabled = !canDrop;
    queueRewordButton.title = isMergeCommit ? "merge 提交暂不支持加入历史编辑队列" : "加入历史编辑队列：执行时用 reword 修改提交信息";
  }
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
  positionContextMenu(menu, event, 340);
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

function showBranchContextMenu(event, branch, options = {}) {
  hideCommitContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  state.contextBranch = { name: branch, ...options };
  const menu = els.branchContextMenu;
  const isLocal = Boolean(options.local || options.checkout || options.rename || options.delete);
  const isRemote = Boolean(options.remote);
  const isCurrent = Boolean(options.current);
  const occupied = Boolean(options.occupied);
  const prunable = Boolean(options.prunable);
  const checkoutButton = menu.querySelector('[data-branch-action="checkout"]');
  const mergeButton = menu.querySelector('[data-branch-action="merge"]');
  const rebaseButton = menu.querySelector('[data-branch-action="rebase"]');
  const pullRebaseButton = menu.querySelector('[data-branch-action="pullRebase"]');
  const forcePushButton = menu.querySelector('[data-branch-action="forcePush"]');
  const openPullRequestButton = menu.querySelector('[data-branch-action="openPullRequest"]');
  const copyPullRequestButton = menu.querySelector('[data-branch-action="copyPullRequest"]');
  const setUpstreamButton = menu.querySelector('[data-branch-action="setUpstream"]');
  const unsetUpstreamButton = menu.querySelector('[data-branch-action="unsetUpstream"]');
  const cleanupButton = menu.querySelector('[data-branch-action="cleanup"]');
  const renameButton = menu.querySelector('[data-branch-action="rename"]');
  const deleteButton = menu.querySelector('[data-branch-action="delete"]');
  const compareButton = menu.querySelector('[data-branch-action="compare"]');
  const remoteLocalBranch = isRemote ? remoteCheckoutBranch(branch) : "";
  const remoteIsCurrent = Boolean(remoteLocalBranch && remoteLocalBranch === state.data?.repo?.branch);
  const currentBranch = state.data?.repo?.branch || "";
  const currentInfo = state.data?.branchInfo?.[currentBranch] || {};
  const canSetUpstream = Boolean(isRemote && currentBranch && currentBranch !== "detached HEAD" && !branch.endsWith("/HEAD"));
  const pullRequest = state.data?.sync?.pullRequest || {};
  const canOpenPullRequest = Boolean(isLocal && isCurrent && pullRequest.available && pullRequest.url);
  const pullRequestUnavailable = !isLocal || !isCurrent
    ? "只能为当前本地分支创建 PR/MR，请先切换到这个分支。"
    : pullRequest.reason || "当前分支暂时不能生成 PR 链接。";
  checkoutButton.textContent = isRemote ? "签出为本地分支" : "切换到此分支";
  compareButton.disabled = !branch || (isLocal && isCurrent);
  compareButton.title = isLocal && isCurrent ? "不能把当前分支和自己比较" : `比较当前分支与 ${branch}`;
  checkoutButton.disabled = isRemote ? !remoteLocalBranch || remoteIsCurrent : !isLocal || isCurrent || occupied;
  checkoutButton.title = isRemote
    ? !remoteLocalBranch
      ? "这个远端引用不能自动推导本地分支名"
      : remoteIsCurrent
      ? "对应的本地分支已经是当前分支"
      : `签出 ${branch} 为本地分支 ${remoteLocalBranch || ""}`
    : isCurrent
      ? "当前分支"
      : occupied
        ? "分支被其他工作树占用"
        : "";
  mergeButton.disabled = isCurrent || (isRemote && !remoteLocalBranch);
  mergeButton.title = isCurrent
    ? "不能把当前分支合并到自己"
    : isRemote && !remoteLocalBranch
      ? "这个远端引用不能自动推导本地分支名"
      : `合并 ${branch} 到当前分支`;
  rebaseButton.disabled = isCurrent || (isRemote && !remoteLocalBranch);
  rebaseButton.title = isCurrent
    ? "不能把当前分支变基到自己"
    : isRemote && !remoteLocalBranch
      ? "这个远端引用不能自动推导本地分支名"
      : `把当前分支 ${state.data?.repo?.branch || ""} 变基到 ${branch}`;
  pullRebaseButton.disabled = !isLocal || !isCurrent || !currentInfo.upstream || currentInfo.upstreamGone;
  pullRebaseButton.title = !isLocal || !isCurrent
    ? "只能对当前本地分支执行变基拉取"
    : !currentInfo.upstream
      ? "当前分支没有 upstream，请先设置 upstream"
      : currentInfo.upstreamGone
        ? "当前分支的 upstream 已不存在，请先抓取并重新设置"
        : `从 ${currentInfo.upstream} 执行 git pull --rebase`;
  forcePushButton.disabled = !isLocal || !isCurrent;
  forcePushButton.title = !isLocal
    ? "只能对当前本地分支执行安全强推"
    : !isCurrent
      ? "请先切换到这个分支后再安全强推"
      : "使用 git push --force-with-lease 推送当前分支";
  if (openPullRequestButton) {
    openPullRequestButton.querySelector(".menu-label").textContent = pullRequest.title || "创建 Pull Request";
    openPullRequestButton.disabled = !canOpenPullRequest;
    openPullRequestButton.title = canOpenPullRequest ? pullRequest.url : pullRequestUnavailable;
  }
  if (copyPullRequestButton) {
    copyPullRequestButton.disabled = !canOpenPullRequest;
    copyPullRequestButton.title = canOpenPullRequest ? pullRequest.url : pullRequestUnavailable;
  }
  setUpstreamButton.disabled = !canSetUpstream || currentInfo.upstream === branch;
  setUpstreamButton.title = !canSetUpstream
    ? "只能把远端分支设为当前本地分支的 upstream"
    : currentInfo.upstream === branch
      ? "当前分支已经跟踪这个远端分支"
      : `把当前分支 ${currentBranch} 跟踪到 ${branch}`;
  unsetUpstreamButton.disabled = !isLocal || !isCurrent || !options.upstream;
  unsetUpstreamButton.title = !isLocal || !isCurrent ? "只能在当前本地分支上取消 upstream" : options.upstream ? `取消 ${branch} -> ${options.upstream}` : "当前分支没有 upstream";
  cleanupButton.hidden = !prunable;
  cleanupButton.disabled = !prunable;
  renameButton.textContent = isRemote ? "重命名分支" : "重命名本地分支";
  renameButton.disabled = !isLocal || (occupied && !isCurrent);
  renameButton.title = isRemote ? "远端分支不能在本地直接重命名" : occupied && !isCurrent ? "分支被其他工作树占用，不能重命名" : "";
  deleteButton.textContent = isRemote ? "删除远端分支" : "删除本地分支";
  deleteButton.classList.toggle("danger", true);
  deleteButton.disabled = isRemote ? !remoteLocalBranch : !isLocal || isCurrent || occupied;
  deleteButton.title = isRemote
    ? remoteLocalBranch
      ? `删除远端分支 ${branch}`
      : "这个远端引用不能自动推导分支名"
    : isCurrent
      ? "不能删除当前分支"
      : occupied
        ? "分支被其他工作树占用"
        : "";
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
  positionContextMenu(menu, event, 330);
}

function hideBranchContextMenu() {
  els.branchContextMenu.classList.remove("show");
  els.branchContextMenu.setAttribute("aria-hidden", "true");
  state.contextBranch = null;
}

function showFileContextMenu(event, filePath, scope = "") {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  const fileInfo = state.data?.workingFiles?.find((file) => file.file === filePath);
  if (!fileInfo) return;
  const resolvedScope = scope || (fileInfo.unstaged ? "unstaged" : fileInfo.staged ? "staged" : "");
  state.contextFile = { file: filePath, scope: resolvedScope };
  if (resolvedScope) {
    const key = changeKey(resolvedScope, filePath);
    if (!state.selectedChanges.has(key)) {
      state.selectedChanges.clear();
      state.selectedChanges.add(key);
      state.lastChangeSelection = { scope: resolvedScope, key };
      state.selectedFile = filePath;
      renderStage();
    }
  } else {
    state.selectedFile = filePath;
    markSelectedFile();
  }
  const menu = els.fileContextMenu;
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  const hasConflict = Boolean(fileInfo?.conflict);
  const canIgnore = isUntrackedFile(fileInfo);
  const canIgnoreDirectory = canIgnore && filePath.replaceAll("\\", "/").includes("/");
  menu.querySelector('[data-file-action="stageFile"]').disabled = !hasUnstaged;
  menu.querySelector('[data-file-action="discardWorktreeFile"]').disabled = !hasUnstaged;
  menu.querySelector('[data-file-action="unstageFile"]').disabled = !hasStaged;
  menu.querySelector('[data-file-action="discardStagedFile"]').disabled = !hasStaged;
  menu.querySelector('[data-file-action="resolveConflictOurs"]').disabled = !hasConflict;
  menu.querySelector('[data-file-action="resolveConflictTheirs"]').disabled = !hasConflict;
  menu.querySelector('[data-file-action="ignoreFile"]').disabled = !canIgnore;
  menu.querySelector('[data-file-action="ignoreDirectory"]').disabled = !canIgnoreDirectory;
  menu.querySelector('[data-file-action="stash"]').disabled = !selectedContextFiles().length;
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
  positionContextMenu(menu, event, 330);
}

function hideFileContextMenu() {
  els.fileContextMenu.classList.remove("show");
  els.fileContextMenu.setAttribute("aria-hidden", "true");
  state.contextFile = null;
}

function showTagContextMenu(event, tag) {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideRemoteContextMenu();
  state.contextTag = tag || null;
  const menu = els.tagContextMenu;
  const hasTag = Boolean(tag?.name);
  menu.querySelectorAll("[data-tag-action]").forEach((button) => {
    button.disabled = !hasTag;
  });
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
  positionContextMenu(menu, event, 230);
}

function hideTagContextMenu() {
  els.tagContextMenu.classList.remove("show");
  els.tagContextMenu.setAttribute("aria-hidden", "true");
  state.contextTag = null;
}

function showRemoteContextMenu(event, remote) {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  state.contextRemote = remote || null;
  const menu = els.remoteContextMenu;
  const hasRemote = Boolean(remote?.name);
  const hasFetch = Boolean(remote?.fetchUrl);
  const hasPush = Boolean(remote?.pushUrl || remote?.fetchUrl);
  menu.querySelector('[data-remote-menu-action="test"]').disabled = !hasRemote;
  menu.querySelector('[data-remote-menu-action="copyCheckCommand"]').disabled = !hasRemote;
  menu.querySelector('[data-remote-menu-action="fetch"]').disabled = !hasRemote;
  menu.querySelector('[data-remote-menu-action="edit"]').disabled = !hasRemote;
  menu.querySelector('[data-remote-menu-action="copyFetch"]').disabled = !hasFetch;
  menu.querySelector('[data-remote-menu-action="copyPush"]').disabled = !hasPush;
  menu.querySelector('[data-remote-menu-action="delete"]').disabled = !hasRemote;
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
  positionContextMenu(menu, event, 210);
}

function hideRemoteContextMenu() {
  els.remoteContextMenu.classList.remove("show");
  els.remoteContextMenu.setAttribute("aria-hidden", "true");
  state.contextRemote = null;
}

async function runFileContextAction(action) {
  const context = state.contextFile;
  hideFileContextMenu();
  if (!context?.file) return;
  if (action === "diff") {
    state.selectedFile = context.file;
    loadWorkingDiff(context.file);
    return;
  }
  if (action === "history") {
    await openFileHistory(context.file);
    return;
  }
  if (action === "blame") {
    await openFileBlame(context.file);
    return;
  }
  if (action === "stash") {
    await createStashFromSelection(selectedContextFiles());
    return;
  }
  if (action === "ignoreFile" || action === "ignoreDirectory") {
    await ignoreWorktreePath(action, context.file);
    return;
  }
  if (["stageFile", "discardWorktreeFile", "resolveConflictOurs", "resolveConflictTheirs"].includes(action)) {
    await runSingleFileAction(action, context.file);
    return;
  }
  if (["unstageFile", "discardStagedFile"].includes(action)) {
    await runSingleFileAction(action, context.file);
  }
}

async function runBranchContextAction(action) {
  const context = state.contextBranch;
  hideBranchContextMenu();
  if (!context?.name) return;
  const branch = context.name;
  const isLocal = Boolean(context.local || context.checkout || context.rename || context.delete);
  const isRemote = Boolean(context.remote);
  if (action === "view") {
    await selectRef(branch);
    return;
  }
  if (action === "compare") {
    await openCompareBranch(branch);
    return;
  }
  if (action === "cleanupView") {
    state.selectedTab = "branches";
    renderInspector();
    return;
  }
  if (action === "checkout") {
    if (isRemote) {
      await checkoutRemoteBranch(branch);
      return;
    }
    if (!isLocal) {
      toast("这个分支不能直接切换");
      return;
    }
    await checkoutBranch(branch);
    return;
  }
  if (action === "merge") {
    await mergeBranchRef(branch);
    return;
  }
  if (action === "rebase") {
    await rebaseOntoRef(branch);
    return;
  }
  if (action === "pullRebase") {
    await runAction("pullRebase");
    return;
  }
  if (action === "forcePush") {
    await runAction("forcePushLease");
    return;
  }
  if (action === "openPullRequest") {
    await runSyncPullRequestAction("open");
    return;
  }
  if (action === "copyPullRequest") {
    await runSyncPullRequestAction("copy");
    return;
  }
  if (action === "setUpstream") {
    if (!isRemote) {
      toast("请选择远端分支作为 upstream");
      return;
    }
    await runUpstreamAction("set", branch);
    return;
  }
  if (action === "unsetUpstream") {
    await runUpstreamAction("unset");
    return;
  }
  if (action === "cleanup") {
    await cleanupStaleWorktree(branch, null, context);
    return;
  }
  if (action === "branch") {
    openBranchModalFromRef(branch, isRemote ? "远端分支" : "分支");
    return;
  }
  if (action === "copy") {
    await copyText(branch);
    toast("已复制分支名");
    return;
  }
  if (action === "rename") {
    if (!isLocal) {
      toast("远端分支不能在本地直接重命名");
      return;
    }
    openRenameBranchModal(branch);
    return;
  }
  if (action === "delete") {
    if (isRemote) {
      await deleteRemoteBranch(branch);
      return;
    }
    if (!isLocal) {
      toast("这个引用不能直接删除");
      return;
    }
    await deleteBranch(branch);
  }
}

function currentCompareBaseRef() {
  const branch = state.data?.repo?.branch || "HEAD";
  return branch && branch !== "detached HEAD" ? branch : "HEAD";
}

async function openCompareBranch(head, base = currentCompareBaseRef()) {
  if (!head) return;
  state.compare = { base, head, data: null, loading: true, error: "" };
  state.selectedCompareFile = "";
  state.selectedTab = "compare";
  renderInspector();
  try {
    const data = await api(`/api/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
    state.compare = { base: data.base || base, head: data.head || head, data, loading: false, error: "" };
    state.selectedCompareFile = data.files?.[0]?.file || "";
    renderInspector();
  } catch (error) {
    state.compare = { base, head, data: null, loading: false, error: error.message };
    state.selectedCompareFile = "";
    renderInspector();
  }
}

async function refreshCompare() {
  const current = state.compare || {};
  const picker = comparePickerRefs();
  const base = picker.base || current.base || currentCompareBaseRef();
  const head = picker.head || current.head || "";
  if (!head) {
    toast("请选择要比较的目标引用");
    return;
  }
  await openCompareBranch(head, base);
}

async function runCommitContextAction(action) {
  const commit = state.data?.commits.find((item) => item.sha === state.contextCommitSha || item.sha === state.selectedSha);
  hideCommitContextMenu();
  if (!commit) return;
  if (action === "details") {
    state.selectedTab = "details";
    await selectCommit(commit.sha);
    return;
  }
  if (action === "branch") {
    state.selectedSha = commit.sha;
    renderCommits();
    await loadCommit(commit.sha);
    renderInspector();
    openBranchModal();
    return;
  }
  if (action === "tag") {
    state.selectedSha = commit.sha;
    renderCommits();
    await loadCommit(commit.sha);
    renderInspector();
    openTagModal(commit);
    return;
  }
  if (action === "copySha") {
    await copyText(commit.sha);
    toast("已复制提交 SHA");
    return;
  }
  if (action === "copyMessage") {
    await copyText(commit.message);
    toast("已复制提交信息");
    return;
  }
  if (action === "openRemote") {
    openRemoteCommit(commit);
    return;
  }
  if (action === "editMessage") {
    state.selectedTab = "details";
    await selectCommit(commit.sha);
    setTimeout(() => els.detailBody.querySelector("[data-reword-form] input")?.focus(), 0);
    return;
  }
  if (
    action === "cherryPick" ||
    action === "revert" ||
    action === "squash" ||
    action === "fixup" ||
    action === "drop" ||
    action === "queueSquash" ||
    action === "queueFixup" ||
    action === "queueDrop" ||
    action === "queueReword" ||
    action === "resetSoft" ||
    action === "resetMixed" ||
    action === "resetHard"
  ) {
    await runCommitToolAction(action, commit.sha);
  }
}

async function runCommitToolAction(action, sha) {
  const commit = state.data?.commits.find((item) => item.sha === sha || item.sha === state.selectedSha);
  if (!commit) return;
  const queueMode = historyQueueModeFromAction(action);
  if (queueMode) {
    await addHistoryQueueItem(commit, queueMode);
    return;
  }
  if (action === "openRemote") {
    openRemoteCommit(commit);
    return;
  }
  if (action === "cherryPick") {
    if (needsMainline(commit)) {
      openMainlineModal(action, commit);
      return;
    }
    await cherryPickCommit(commit);
    return;
  }
  if (action === "revert") {
    if (needsMainline(commit)) {
      openMainlineModal(action, commit);
      return;
    }
    await revertCommit(commit);
    return;
  }
  if (action === "squash" || action === "fixup" || action === "drop") {
    await openHistoryRewritePlan(commit, action);
    return;
  }
  if (action === "resetSoft" || action === "resetMixed" || action === "resetHard") {
    await resetToCommit(commit, action.replace(/^reset/, "").toLowerCase());
  }
}

function historyRewriteConfig(mode) {
  return {
    squash: {
      title: "压缩进父提交",
      command: "git rebase -i / squash",
      effect: "此提交的改动和提交信息会合并进它的父提交，此提交本身会消失。",
      needsParent: true,
    },
    fixup: {
      title: "修补进父提交",
      command: "git rebase -i / fixup",
      effect: "此提交的改动会合并进它的父提交，但此提交信息会被丢弃。",
      needsParent: true,
    },
    drop: {
      title: "丢弃此提交",
      command: "git rebase -i / drop",
      effect: "此提交会从当前分支历史中删除，后续提交会被重新播放。",
      needsParent: false,
    },
    reword: {
      title: "修改提交信息",
      command: "git rebase -i / reword",
      effect: "只修改此提交的提交信息，后续提交会被重新播放。",
      needsParent: false,
    },
  }[mode];
}

function historyQueueModeFromAction(action) {
  return {
    queueSquash: "squash",
    queueFixup: "fixup",
    queueDrop: "drop",
    queueReword: "reword",
  }[action];
}

function historyQueueMessageParts(item) {
  const detail = item?.sha ? state.commitDetails.get(item.sha) || {} : {};
  return commitMessageParts(item || {}, detail);
}

function historyQueueItemWithMode(item, mode) {
  if (mode !== "reword") return { ...item, mode };
  const parts = item.summary ? { summary: item.summary, body: item.body || "" } : historyQueueMessageParts(item);
  return { ...item, mode, summary: parts.summary, body: parts.body || "" };
}

function historyQueuePayload(items = state.historyQueue.items) {
  return items.map((item) => {
    const payload = { sha: item.sha, mode: item.mode };
    if (item.mode === "reword") {
      const next = historyQueueItemWithMode(item, "reword");
      payload.summary = next.summary || "";
      payload.body = next.body || "";
    }
    return payload;
  });
}

async function addHistoryQueueItem(commit, mode) {
  if (!state.data || !commit) return;
  const config = historyRewriteConfig(mode);
  if (!config) return;
  if (needsMainline(commit)) {
    toast("merge 提交暂不支持加入历史编辑队列。");
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast("根提交没有父提交，不能压缩或修补。");
    return;
  }
  const existing = state.historyQueue.items.find((item) => item.sha === commit.sha);
  const message = historyQueueMessageParts(commit);
  const nextItem = {
    sha: commit.sha,
    short: commit.short,
    message: commit.message,
    mode,
    parents: commit.parents || [],
    summary: mode === "reword" ? existing?.summary || message.summary : existing?.summary || "",
    body: mode === "reword" ? existing?.body ?? message.body : existing?.body || "",
  };
  const items = existing
    ? state.historyQueue.items.map((item) => (item.sha === commit.sha ? { ...item, ...nextItem } : item))
    : [...state.historyQueue.items, nextItem];
  if (items.length > 12) {
    toast("历史编辑队列一次最多 12 条动作。");
    return;
  }
  state.selectedTab = "details";
  state.selectedSha = commit.sha;
  state.historyPlan = null;
  state.historyQueue = { items, loading: true, preview: state.historyQueue.preview, error: "" };
  renderCommits();
  await loadCommit(commit.sha);
  renderInspector();
  toast(existing ? `已更新队列：${commit.short} -> ${config.title}` : `已加入历史编辑队列：${commit.short} ${config.title}`);
  await refreshHistoryRewriteQueuePreview();
}

function historyQueueSignature(items = state.historyQueue.items) {
  return items.map((item) => `${item.sha}:${item.mode}:${item.mode === "reword" ? `${item.summary || ""}\n${item.body || ""}` : ""}`).join("|");
}

async function refreshHistoryRewriteQueuePreview() {
  const items = state.historyQueue.items;
  if (!items.length) {
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    renderInspector();
    return;
  }
  const signature = historyQueueSignature(items);
  state.historyQueue = { ...state.historyQueue, loading: true, error: "" };
  renderInspector();
  try {
    const preview = await api("/api/history-rewrite-queue-preview", {
      method: "POST",
      body: JSON.stringify({ items: historyQueuePayload(items) }),
    });
    if (signature !== historyQueueSignature()) return;
    state.historyQueue = { ...state.historyQueue, loading: false, preview, error: "" };
    renderInspector();
  } catch (error) {
    if (signature !== historyQueueSignature()) return;
    state.historyQueue = { ...state.historyQueue, loading: false, preview: null, error: error.message };
    renderInspector();
  }
}

async function replaceHistoryQueueItems(items) {
  state.historyQueue = { items, loading: Boolean(items.length), preview: null, error: "" };
  renderInspector();
  await refreshHistoryRewriteQueuePreview();
}

function scheduleHistoryQueuePreviewRefresh() {
  if (state.historyQueuePreviewTimer) window.clearTimeout(state.historyQueuePreviewTimer);
  state.historyQueuePreviewTimer = window.setTimeout(() => {
    state.historyQueuePreviewTimer = 0;
    refreshHistoryRewriteQueuePreview().catch((error) => toast(error.message));
  }, 450);
}

function updateHistoryQueueField(control) {
  const sha = control?.dataset.sha || "";
  const field = control?.dataset.field || "";
  if (!sha || !["summary", "body"].includes(field)) return;
  const value = control.value;
  const items = state.historyQueue.items.map((item) => {
    if (item.sha !== sha) return item;
    return { ...historyQueueItemWithMode(item, "reword"), [field]: value };
  });
  state.historyQueue = { ...state.historyQueue, items, error: "" };
  scheduleHistoryQueuePreviewRefresh();
}

async function runHistoryRewriteQueue(action, button) {
  if (action === "clear") {
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    renderInspector();
    return;
  }
  if (action === "refresh") {
    await refreshHistoryRewriteQueuePreview();
    return;
  }
  if (action === "remove") {
    const sha = button?.dataset.sha || "";
    const items = state.historyQueue.items.filter((item) => item.sha !== sha);
    await replaceHistoryQueueItems(items);
    return;
  }
  if (action === "moveUp" || action === "moveDown") {
    const sha = button?.dataset.sha || "";
    const currentIndex = state.historyQueue.items.findIndex((item) => item.sha === sha);
    const offset = action === "moveUp" ? -1 : 1;
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.historyQueue.items.length) return;
    const items = [...state.historyQueue.items];
    [items[currentIndex], items[nextIndex]] = [items[nextIndex], items[currentIndex]];
    await replaceHistoryQueueItems(items);
    return;
  }
  if (action === "changeMode") {
    const sha = button?.dataset.sha || "";
    const mode = button?.dataset.mode || button?.value || "";
    const config = historyRewriteConfig(mode);
    if (!sha || !config) return;
    const items = state.historyQueue.items.map((item) => (item.sha === sha ? historyQueueItemWithMode(item, mode) : item));
    await replaceHistoryQueueItems(items);
    return;
  }
  if (action !== "execute") return;
  const preview = state.historyQueue.preview;
  if (!preview?.canRun) {
    toast((preview?.blockers || [state.historyQueue.error || "历史编辑队列还不能执行"]).join("\n"));
    return;
  }
  const message = [
    `确认执行历史编辑队列 ${state.historyQueue.items.length} 项？`,
    "",
    `分支：${preview.branch || state.data?.repo?.branch || "当前分支"}`,
    `影响提交：${preview.affectedCount || 0} 个`,
    "命令：git rebase -i / queue",
    "",
    "这会重写队列影响范围内的历史 SHA。执行前会创建恢复点。",
  ].join("\n");
  if (!state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "rewriteHistoryQueue",
        items: historyQueuePayload(),
      }),
    });
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    toast(result.output || "历史编辑队列已执行");
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    state.historyQueue = { ...state.historyQueue, loading: false, error: error.message };
    renderInspector();
    await refreshWorktree(true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openHistoryRewritePlan(commit, mode) {
  if (!state.data || !commit) return;
  const config = historyRewriteConfig(mode);
  if (!config) return;
  if (needsMainline(commit)) {
    toast("暂不支持对 merge 提交执行自动历史编辑。");
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast("根提交没有父提交，不能压缩或修补。");
    return;
  }
  state.selectedTab = "details";
  state.selectedSha = commit.sha;
  state.historyPlan = { sha: commit.sha, mode, loading: true, preview: null, error: "" };
  renderCommits();
  await loadCommit(commit.sha);
  renderInspector();
  try {
    const preview = await api(`/api/history-rewrite-preview?sha=${encodeURIComponent(commit.sha)}&mode=${encodeURIComponent(mode)}`);
    if (state.historyPlan?.sha !== commit.sha || state.historyPlan?.mode !== mode) return;
    state.historyPlan = { sha: commit.sha, mode, loading: false, preview, error: "" };
    renderInspector();
  } catch (error) {
    if (state.historyPlan?.sha !== commit.sha || state.historyPlan?.mode !== mode) return;
    state.historyPlan = { sha: commit.sha, mode, loading: false, preview: null, error: error.message };
    renderInspector();
  }
}

async function runHistoryRewritePlan(action, button) {
  const plan = state.historyPlan;
  if (!plan) return;
  const commit = state.data?.commits.find((item) => item.sha === plan.sha || item.sha === state.selectedSha);
  if (action === "cancel") {
    state.historyPlan = null;
    renderInspector();
    return;
  }
  if (action === "refresh") {
    await openHistoryRewritePlan(commit, plan.mode);
    return;
  }
  if (action !== "execute") return;
  const preview = plan.preview;
  if (!preview?.canRun) {
    toast((preview?.blockers || ["当前计划还不能执行"]).join("\n"));
    return;
  }
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewriteHistoryCommit", sha: plan.sha, mode: plan.mode }),
    });
    state.historyPlan = null;
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    toast(result.output || `已${preview.title || "编辑历史"} ${preview.target?.short || ""}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    state.historyPlan = { ...plan, loading: false, error: error.message };
    renderInspector();
    await refreshWorktree(true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function rewriteHistoryCommit(commit, mode) {
  if (!state.data || !commit) return;
  const config = historyRewriteConfig(mode);
  if (!config) return;
  if (needsMainline(commit)) {
    toast("暂不支持对 merge 提交执行自动历史编辑。");
    return;
  }
  if (config.needsParent && !(commit.parents || []).length) {
    toast("根提交没有父提交，不能压缩或修补。");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? `\n\n当前还有 ${dirtyCount} 个未提交改动，Git 会阻止历史编辑。请先提交或储藏。` : "";
  const warning = mode === "drop" ? "\n\n危险：如果后续提交依赖此提交，可能会产生冲突。" : "";
  const current = state.data.repo.branch || "当前分支";
  const message = `确认${config.title} ${commit.short}？\n\n命令：${config.command}\n分支：${current}\n效果：${config.effect}\n这会重写此提交之后的历史 SHA。${warning}${dirtyNote}\n\n提交信息：${commit.message}`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewriteHistoryCommit", sha: commit.sha, mode }),
    });
    toast(result.output || `已${config.title} ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    await refreshWorktree(false);
  }
}

async function cherryPickCommit(commit, mainline = null) {
  if (!state.data || !commit) return;
  const mainlineText = mainline ? `\n主线：父提交 ${mainline}` : "";
  if (!state.data.repo.isSample && !confirm(`确认挑选提交 ${commit.short} 到当前分支？\n\n这会在当前分支创建一个内容相同的新提交，不会移动原分支。${mainlineText}\n提交信息：${commit.message}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "cherryPickCommit", sha: commit.sha, mainline }),
    });
    toast(result.output || `已挑选提交 ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
    await refreshWorktree(false);
  }
}

async function revertCommit(commit, mainline = null) {
  if (!state.data || !commit) return;
  const mainlineText = mainline ? `\n主线：父提交 ${mainline}` : "";
  if (!state.data.repo.isSample && !confirm(`确认还原提交 ${commit.short}？\n\n这会创建一个新的反向提交，不会删除历史提交。${mainlineText}\n提交信息：${commit.message}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "revertCommit", sha: commit.sha, mainline }),
    });
    toast(result.output || `已还原提交 ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
  }
}

function needsMainline(commit) {
  return (commit?.parents || []).length > 1;
}

function openMainlineModal(action, commit) {
  const parents = commit?.parents || [];
  if (!commit || parents.length <= 1) return;
  state.mainlineAction = action;
  state.mainlineCommitSha = commit.sha;
  const actionText = action === "cherryPick" ? "挑选" : "还原";
  const command = action === "cherryPick" ? "git cherry-pick -m" : "git revert -m";
  els.mainlineModalTitle.textContent = `${actionText} merge 提交`;
  els.mainlineStartText.textContent = `提交 ${commit.short} 有 ${parents.length} 个父提交。选择主线后会执行 ${command}。`;
  els.mainlineSubmit.textContent = `继续${actionText}`;
  els.mainlineOptions.innerHTML = parents
    .map((parentSha, index) => {
      const mainline = index + 1;
      const checked = index === 0 ? "checked" : "";
      const hint = index === 0 ? "通常是执行合并时所在的分支方向" : "通常是被合并进来的分支方向";
      return `
        <label class="mainline-option">
          <input type="radio" name="mainline" value="${mainline}" ${checked} />
          <span>
            <strong>父提交 ${mainline} · ${escapeHtml(parentSha.slice(0, 7))}</strong>
            <em>${escapeHtml(hint)}</em>
          </span>
        </label>
      `;
    })
    .join("");
  els.mainlineModal.classList.add("show");
  els.mainlineModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.mainlineOptions.querySelector("input[name='mainline']:checked")?.focus(), 0);
}

function closeMainlineModal() {
  els.mainlineModal.classList.remove("show");
  els.mainlineModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.mainlineAction = "";
  state.mainlineCommitSha = "";
  els.mainlineOptions.innerHTML = "";
}

async function submitMainlineForm(event) {
  event.preventDefault();
  const commit = state.data?.commits.find((item) => item.sha === state.mainlineCommitSha);
  const action = state.mainlineAction;
  const selected = Number.parseInt(els.mainlineOptions.querySelector("input[name='mainline']:checked")?.value || "", 10);
  if (!commit || !Number.isInteger(selected)) {
    toast("请选择主线");
    return;
  }
  closeMainlineModal();
  if (action === "cherryPick") {
    await cherryPickCommit(commit, selected);
    return;
  }
  if (action === "revert") {
    await revertCommit(commit, selected);
  }
}

async function resetToCommit(commit, mode) {
  if (!state.data || !commit) return;
  const modeText = { soft: "软重置（soft）", mixed: "混合重置（mixed）", hard: "硬重置（hard）" }[mode] || "混合重置（mixed）";
  const effects = {
    soft: "当前分支会移动到此提交；后续提交的改动会保留在已暂存区。",
    mixed: "当前分支会移动到此提交；后续提交的改动会保留在工作区，且不会暂存。",
    hard: "当前分支会移动到此提交；后续提交和当前工作区改动都会被丢弃，无法从工作区恢复。",
  };
  const warning = mode === "hard" ? "\n\n危险：Hard Reset 会丢弃未提交改动，请确认你真的不需要它们。" : "";
  if (!state.data.repo.isSample && !confirm(`确认执行${modeText}到提交 ${commit.short}？\n\n${effects[mode]}${warning}\n\n提交信息：${commit.message}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "resetToCommit", sha: commit.sha, mode }),
    });
    toast(result.output || `已${modeText}到 ${commit.short}`);
    await reloadAfterHistoryAction();
  } catch (error) {
    toast(error.message);
  }
}

async function reloadAfterHistoryAction() {
  state.commitDetails.clear();
  state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
  state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  state.selectedSha = state.data.commits[0]?.sha || "";
  state.selectedFile = "";
  state.selectedCommitFile = "";
  renderAll();
  if (state.selectedSha) {
    await loadCommit(state.selectedSha);
    renderInspector();
  }
}

async function copyText(text) {
  const value = String(text || "");
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function openRemoteCommit(commit) {
  const url = commitRemoteUrl(commit?.sha);
  if (!url) {
    toast("当前仓库没有可识别的网页远端 URL");
    return;
  }
  const opened = window.open(url, "_blank");
  if (!opened) {
    toast(`浏览器拦截了新窗口，可以复制地址手动打开：\n${url}`);
    return;
  }
  opened.opener = null;
  toast("已打开远端提交页面");
}

async function runSyncPullRequestAction(action) {
  const pullRequest = state.data?.sync?.pullRequest || {};
  if (!pullRequest.available || !pullRequest.url) {
    toast(pullRequest.reason || "当前分支暂时不能生成 PR 链接");
    return;
  }
  if (action === "copy") {
    await copyText(pullRequest.url);
    toast("已复制 PR 链接");
    return;
  }
  const opened = window.open(pullRequest.url, "_blank");
  if (!opened) {
    toast(`浏览器拦截了新窗口，可以复制地址手动打开：\n${pullRequest.url}`);
    return;
  }
  opened.opener = null;
  toast(pullRequest.title === "创建 Merge Request" ? "已打开 Merge Request 页面" : "已打开 Pull Request 页面");
}

function commitRemoteUrl(sha) {
  const webBase = preferredRemoteWebBase();
  if (!webBase || !sha) return "";
  return `${webBase}/${remoteCommitPathSegment(webBase)}/${encodeURIComponent(sha)}`;
}

function remoteCommitPathSegment(webBase) {
  try {
    const host = new URL(webBase).hostname.toLowerCase();
    if (host === "bitbucket.org" || host.endsWith(".bitbucket.org")) return "commits";
    if (host === "gitlab.com" || host.includes("gitlab")) return "-/commit";
  } catch {
  }
  return "commit";
}

function preferredRemoteWebBase() {
  const remotes = state.data?.sync?.remotes || [];
  const ordered = [
    ...remotes.filter((remote) => remote.name === "origin"),
    ...remotes.filter((remote) => remote.name !== "origin"),
  ];
  for (const remote of ordered) {
    const base = remoteWebBase(remote.pushUrl || remote.fetchUrl) || remoteWebBase(remote.fetchUrl);
    if (base) return base;
  }
  return "";
}

function remoteWebBase(remoteUrl) {
  const value = String(remoteUrl || "").trim();
  if (!value) return "";
  const scpLike = value.match(/^git@([^:]+):(.+)$/);
  if (scpLike) return cleanRemoteWebPath(`https://${scpLike[1]}/${scpLike[2]}`);
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.username = "";
      url.password = "";
      return cleanRemoteWebPath(url.toString());
    }
    if (url.protocol === "ssh:" && url.hostname && url.pathname) {
      return cleanRemoteWebPath(`https://${url.hostname}${url.pathname}`);
    }
  } catch {
  }
  return "";
}

function cleanRemoteWebPath(value) {
  return String(value || "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
}

function openTagModal(commit) {
  if (!commit) return;
  state.tagTargetSha = commit.sha;
  els.tagNameInput.value = "";
  els.tagAnnotatedToggle.checked = false;
  els.tagMessageInput.value = "";
  els.tagStartText.textContent = `基于提交 ${commit.short} 创建 Tag。`;
  els.tagModal.classList.add("show");
  els.tagModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.tagNameInput.focus(), 0);
}

function closeTagModal() {
  els.tagModal.classList.remove("show");
  els.tagModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.tagTargetSha = "";
}

async function createTagFromForm(event) {
  event.preventDefault();
  if (!state.data) return;
  const name = els.tagNameInput.value.trim();
  if (!name) {
    toast("请输入标签名");
    els.tagNameInput.focus();
    return;
  }
  const target = state.tagTargetSha || state.selectedSha;
  if (!target) {
    toast("没有选中的提交");
    return;
  }
  try {
    els.tagSubmit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "createTag",
        name,
        target,
        annotated: els.tagAnnotatedToggle.checked,
        message: els.tagMessageInput.value.trim(),
      }),
    });
    toast(result.output || `已创建 Tag ${name}`);
    closeTagModal();
    state.selectedTag = result.tag || name;
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    els.tagSubmit.disabled = false;
  }
}

function renderGraphSvg(commits, height, selectedRef) {
  const bySha = new Map(commits.map((commit, index) => [commit.sha, { commit, index }]));
  const byShort = new Map(commits.map((commit, index) => [commit.short, { commit, index }]));
  const selectedColor = selectedRef ? refColor(selectedRef) : "";
  const isFocused = Boolean(selectedRef);
  const guides = laneGuides(commits, height, selectedColor, isFocused);
  let paths = "";
  let nodes = "";
  let labels = "";
  commits.forEach((commit, index) => {
    const x1 = laneX[commit.lane] || laneX[0];
    const y1 = index * rowH + rowH / 2;
    const color = selectedColor || commit.color;
    const isPrimaryNode = !isFocused && commit.lane === 0;
    nodes += node(x1, y1, color, isFocused, isPrimaryNode);
    const label = selectedRef && index === 0 ? selectedRef : !selectedRef ? tipLabel(commit.refs) : "";
    if (label) labels += graphLabel(x1, y1, label, color, isFocused);
    const parents = commit.parents || [];
    if (!parents.length && index < commits.length - 1) {
      const next = commits[index + 1];
      paths += curve(x1, y1, laneX[next.lane] || laneX[0], (index + 1) * rowH + rowH / 2, color, isFocused, isPrimaryNode && next.lane === 0);
    }
    parents.forEach((parentSha) => {
      const parent = bySha.get(parentSha) || byShort.get(parentSha.slice(0, 7));
      if (!parent) {
        paths += curve(x1, y1, x1, Math.min(y1 + rowH, height), color, isFocused, isPrimaryNode);
        return;
      }
      if (parent.index <= index) return;
      paths += curve(x1, y1, laneX[parent.commit.lane] || laneX[0], parent.index * rowH + rowH / 2, color, isFocused, isPrimaryNode && parent.commit.lane === 0);
    });
  });
  return `
    <svg class="graph-lines ${isFocused ? "focus" : "overview"}" height="${height}" viewBox="0 0 132 ${height}" preserveAspectRatio="none" aria-hidden="true">
      <g class="lane-guides" fill="none" stroke-linecap="round">${guides}</g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      <g>${labels}</g>
      <g>${nodes}</g>
    </svg>
  `;
}

function layoutGraphCommits(visibleCommits, selectedRef) {
  if (selectedRef || !state.data?.commits?.length) return visibleCommits;
  const allCommits = state.data.commits;
  const primary = primaryBranchName();
  const primaryLine = primaryLineSet(allCommits, primary);
  if (!primaryLine.size) return visibleCommits;

  const inheritedLane = new Map();
  const laneBySha = new Map();
  const namedLanes = new Map([[primary, 0]]);
  let nextLane = 1;

  const allocateLane = (name = "") => {
    if (name && namedLanes.has(name)) return namedLanes.get(name);
    const lane = Math.min(nextLane, laneX.length - 1);
    if (name) namedLanes.set(name, lane);
    nextLane = Math.min(laneX.length - 1, nextLane + 1);
    return lane;
  };

  allCommits.forEach((commit) => {
    let lane = 0;
    if (!primaryLine.has(commit.sha)) {
      const branch = sideBranchName(commit, primary);
      lane = inheritedLane.get(commit.sha) ?? allocateLane(branch);
    }
    laneBySha.set(commit.sha, lane);
    (commit.parents || []).forEach((parentSha) => {
      if (!primaryLine.has(parentSha) && !inheritedLane.has(parentSha)) inheritedLane.set(parentSha, lane);
    });
  });

  return visibleCommits.map((commit) => {
    const lane = laneBySha.has(commit.sha) ? laneBySha.get(commit.sha) : Number(commit.lane) || 0;
    return { ...commit, lane, color: laneColor(lane) };
  });
}

function primaryBranchName() {
  const branches = state.data?.branches || [];
  if (branches.includes("main")) return "main";
  if (branches.includes("master")) return "master";
  const current = state.data?.repo?.branch || "";
  if (branches.includes(current)) return current;
  return branches[0] || current || "";
}

function primaryLineSet(commits, primary) {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const tip = commits.find((commit) => refNames(commit.refs).some((name) => isPrimaryRef(name, primary)));
  const line = new Set();
  let cursor = tip;
  while (cursor && !line.has(cursor.sha)) {
    line.add(cursor.sha);
    cursor = bySha.get(cursor.parents?.[0]);
  }
  return line;
}

function sideBranchName(commit, primary) {
  const names = refNames(commit.refs);
  const branches = state.data?.branches || [];
  const remotes = state.data?.remotes || [];
  const local = names.find((name) => branches.includes(name) && name !== primary);
  if (local) return local;
  const remote = names.find((name) => remotes.includes(name) && !isPrimaryRef(name, primary));
  if (remote) return remote;
  return "";
}

function refNames(refs) {
  return String(refs || "")
    .split(",")
    .map((ref) => ref.trim().replace(/^HEAD\s+->\s+/, ""))
    .filter(Boolean);
}

function isPrimaryRef(name, primary) {
  return Boolean(primary) && (name === primary || name.endsWith(`/${primary}`));
}

function curve(x1, y1, x2, y2, color, selected, primary = false) {
  const mid = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  if (selected) {
    return `
      <path d="${d}" stroke="${color}" stroke-width="10" opacity="0.16" />
      <path d="${d}" stroke="${color}" stroke-width="4.6" opacity="0.98" />
    `;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${primary ? 4.8 : 3.1}" opacity="${primary ? 0.9 : 0.72}" />`;
}

function laneGuides(commits, height, selectedColor, selected) {
  if (selected) {
    const lanes = [...new Set(commits.map((commit) => Number(commit.lane) || 0))].sort((a, b) => a - b);
    return lanes
      .map((lane, index) => {
        const x = laneX[lane] || laneX[0];
        const opacity = index === 0 ? 0.15 : 0.08;
        const width = index === 0 ? 18 : 12;
        return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${selectedColor}" stroke-width="${width}" opacity="${opacity}" />`;
      })
      .join("");
  }
  const lanes = [...new Set(commits.map((commit) => Number(commit.lane) || 0))].sort((a, b) => a - b);
  return lanes
    .map((lane) => {
      const x = laneX[lane] || laneX[0];
      if (lane === 0) {
        return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${laneColor(0)}" stroke-width="18" opacity="0.13" />`;
      }
      return `<line x1="${x}" y1="8" x2="${x}" y2="${Math.max(8, height - 8)}" stroke="${laneColor(lane)}" stroke-width="1.6" opacity="${lane < 4 ? 0.3 : 0.18}" stroke-dasharray="2 8" />`;
    })
    .join("");
}

function node(x, y, color, selected, primary = false) {
  const radius = selected ? 7.4 : primary ? 6.9 : 6.4;
  return `
    <circle cx="${x}" cy="${y}" r="${selected ? 15 : primary ? 13 : 12}" fill="${color}" opacity="${selected ? 0.18 : primary ? 0.14 : 0.1}" />
    <circle cx="${x}" cy="${y}" r="${selected || primary ? 10 : 9}" fill="var(--graph-node-fill)" stroke="var(--graph-node-ring)" stroke-width="3.2" />
    <circle cx="${x}" cy="${y}" r="${radius}" fill="var(--graph-node-fill)" stroke="${color}" stroke-width="${selected ? 3.6 : primary ? 3.5 : 3.1}" />
    <circle cx="${x}" cy="${y}" r="2.3" fill="${color}" opacity="0.96" />
  `;
}

function graphLabel(x, y, label, color, selected) {
  const maxChars = selected ? 8 : 7;
  const text = escapeHtml(label.length > maxChars ? `${label.slice(0, maxChars)}...` : label);
  const width = Math.min(76, Math.max(42, [...text].length * 9 + 16));
  const labelX = Math.min(x + 12, 126 - width);
  const labelY = Math.max(7, y - 25);
  return `
    <g class="graph-label">
      <rect x="${labelX}" y="${labelY}" width="${width}" height="20" rx="7" fill="var(--graph-label-bg)" stroke="${color}" stroke-width="1.2" opacity="0.96" />
      <text x="${labelX + 8}" y="${labelY + 14}" fill="var(--graph-label-text)" font-size="10" font-weight="800" font-family="Microsoft YaHei UI, Segoe UI, sans-serif">${text}</text>
    </g>
  `;
}

function tipLabel(refs) {
  const names = String(refs || "")
    .split(",")
    .map((item) => item.trim().replace(/^HEAD -> /, ""))
    .filter((item) => item && item !== "origin/HEAD" && !item.includes("stash"));
  return names.find((name) => state.data?.branches?.includes(name)) || names.find((name) => !name.startsWith("origin/")) || names[0] || "";
}

function refColor(ref) {
  const localIndex = state.data?.branches?.indexOf(ref) ?? -1;
  if (localIndex >= 0) return laneColor(localIndex);
  const remoteIndex = state.data?.remotes?.indexOf(ref) ?? -1;
  if (remoteIndex >= 0) return laneColor(remoteIndex + 3);
  return laneColor(1);
}

async function loadCommit(sha) {
  if (!sha || state.commitDetails.has(sha) || state.loadingCommitDetails.has(sha)) return;
  const commit = state.data.commits.find((item) => item.sha === sha);
  if (commit?.files?.length || commit?.diff?.length) {
    state.commitDetails.set(sha, { files: commit.files || [], diff: commit.diff || [] });
    return;
  }
  state.loadingCommitDetails.add(sha);
  try {
    const detail = await api(`/api/commit?sha=${encodeURIComponent(sha)}`);
    state.commitDetails.set(sha, detail);
  } catch (error) {
    toast(error.message);
  } finally {
    state.loadingCommitDetails.delete(sha);
  }
}

function renderInspector() {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.selectedTab));
  if (state.selectedTab === "stashes") {
    renderStashesTab();
    return;
  }
  if (state.selectedTab === "tags") {
    renderTagsTab();
    return;
  }
  if (state.selectedTab === "recovery") {
    renderRecoveryTab();
    return;
  }
  if (state.selectedTab === "logs") {
    renderLogsTab();
    return;
  }
  if (state.selectedTab === "sync") {
    renderSyncTab();
    return;
  }
  if (state.selectedTab === "compare") {
    renderCompareTab();
    return;
  }
  if (state.selectedTab === "fileHistory") {
    renderFileHistoryTab();
    return;
  }
  if (state.selectedTab === "fileBlame") {
    renderFileBlameTab();
    return;
  }
  if (state.selectedTab === "branches") {
    const branchCommit = state.data?.commits.find((item) => item.sha === state.selectedSha) || state.data?.commits?.[0] || null;
    renderBranchesTab(branchCommit);
    return;
  }
  if (state.selectedTab === "worktrees") {
    renderWorktreesTab();
    return;
  }
  const commit = state.data?.commits.find((item) => item.sha === state.selectedSha);
  if (!commit) {
    els.detailTitle.textContent = "没有提交";
    els.detailSub.textContent = "当前列表为空";
    els.detailBody.innerHTML = "";
    return;
  }
  const detail = state.commitDetails.get(commit.sha) || { files: commit.files || [], diff: commit.diff || [] };
  els.detailNode.style.borderColor = commit.color;
  els.detailTitle.textContent = commit.message;
  els.detailSub.textContent = `${commit.short} · ${commit.author} · ${commit.time}`;
  if (state.selectedTab === "files") renderFilesTab(commit, detail);
  else renderDetailsTab(commit, detail);
}

function renderDetailsTab(commit, detail) {
  const message = commitMessageParts(commit, detail);
  const isMergeCommit = (commit.parents || []).length > 1;
  const canFold = !isMergeCommit && (commit.parents || []).length === 1;
  const canDrop = !isMergeCommit;
  const remoteUrl = commitRemoteUrl(commit.sha);
  els.detailBody.innerHTML = `
    <div class="meta-grid">
      <span>提交</span><div class="meta-value">${escapeHtml(commit.short)}</div>
      <span>作者</span><div class="meta-value">${escapeHtml(commit.author)}</div>
      <span>父提交</span><div class="meta-value">${escapeHtml(commit.parents?.length ? commit.parents.map((p) => p.slice(0, 7)).join(", ") : "根提交")}</div>
      <span>引用</span><div class="meta-value">${escapeHtml(commit.refs || "无")}</div>
    </div>
    <div class="detail-section-title">提交操作</div>
    <div class="commit-tools">
      <button class="mini-btn" data-commit-tool="openRemote" data-sha="${escapeAttr(commit.sha)}" type="button" ${remoteUrl ? "" : "disabled"} title="${remoteUrl ? `打开远端提交：${escapeAttr(remoteUrl)}` : "当前仓库没有可识别的网页远端 URL"}"><span>远端查看</span><span class="command-hint">web</span></button>
      <button class="mini-btn" data-commit-tool="cherryPick" data-sha="${escapeAttr(commit.sha)}" type="button" title="${isMergeCommit ? "git cherry-pick -m：挑选 merge 提交前选择主线" : "git cherry-pick：把此提交复制到当前分支"}"><span>挑选</span><span class="command-hint">${isMergeCommit ? "git cherry-pick -m" : "git cherry-pick"}</span></button>
      <button class="mini-btn" data-commit-tool="revert" data-sha="${escapeAttr(commit.sha)}" type="button" title="${isMergeCommit ? "git revert -m：还原 merge 提交前选择主线" : "git revert：创建一个反向提交来抵消此提交"}"><span>还原</span><span class="command-hint">${isMergeCommit ? "git revert -m" : "git revert"}</span></button>
      <button class="mini-btn" data-commit-tool="resetSoft" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --soft：移动当前分支，改动保留在已暂存区"><span>软重置</span><span class="command-hint">git reset --soft</span></button>
      <button class="mini-btn" data-commit-tool="resetMixed" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --mixed：移动当前分支，改动保留在工作区"><span>混合重置</span><span class="command-hint">git reset --mixed</span></button>
      <button class="mini-btn danger" data-commit-tool="resetHard" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --hard：移动当前分支，并丢弃工作区改动"><span>硬重置</span><span class="command-hint">git reset --hard</span></button>
    </div>
    <div class="detail-section-title">历史编辑</div>
    <div class="commit-tools">
      <button class="mini-btn" data-commit-tool="squash" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${isMergeCommit ? "merge 提交暂不支持自动压缩" : canFold ? "git rebase -i squash：把此提交和信息压缩进父提交" : "根提交没有父提交，不能压缩"}"><span>压缩进父提交</span><span class="command-hint">git rebase -i squash</span></button>
      <button class="mini-btn" data-commit-tool="fixup" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${isMergeCommit ? "merge 提交暂不支持自动修补" : canFold ? "git rebase -i fixup：把此提交改动修补进父提交，并丢弃此提交信息" : "根提交没有父提交，不能修补"}"><span>修补进父提交</span><span class="command-hint">git rebase -i fixup</span></button>
      <button class="mini-btn danger" data-commit-tool="drop" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${isMergeCommit ? "merge 提交暂不支持自动丢弃" : "git rebase -i drop：从当前分支历史中删除此提交"}"><span>丢弃此提交</span><span class="command-hint">git rebase -i drop</span></button>
    </div>
    ${renderHistoryRewritePlan(commit)}
    <div class="detail-section-title">历史编辑队列</div>
    <div class="commit-tools">
      <button class="mini-btn" data-commit-tool="queueSquash" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${canFold ? "加入历史编辑队列，执行时压缩进前一条提交" : "此提交不能加入压缩队列"}"><span>加入队列：压缩</span><span class="command-hint">queue squash</span></button>
      <button class="mini-btn" data-commit-tool="queueFixup" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${canFold ? "加入历史编辑队列，执行时修补进前一条提交" : "此提交不能加入修补队列"}"><span>加入队列：修补</span><span class="command-hint">queue fixup</span></button>
      <button class="mini-btn" data-commit-tool="queueReword" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${canDrop ? "加入历史编辑队列，执行时修改提交信息" : "此提交不能加入改信息队列"}"><span>加入队列：改信息</span><span class="command-hint">queue reword</span></button>
      <button class="mini-btn danger" data-commit-tool="queueDrop" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${canDrop ? "加入历史编辑队列，执行时丢弃此提交" : "此提交不能加入丢弃队列"}"><span>加入队列：丢弃</span><span class="command-hint">queue drop</span></button>
    </div>
    ${renderHistoryRewriteQueue()}
    <div class="detail-section-title">提交信息</div>
    <form class="reword-form" data-reword-form data-sha="${escapeAttr(commit.sha)}">
      <label class="edit-field">
        <span>摘要</span>
        <input name="summary" autocomplete="off" value="${escapeAttr(message.summary)}" ${isMergeCommit ? "disabled" : ""} />
      </label>
      <label class="edit-field">
        <span>正文</span>
        <textarea name="body" ${isMergeCommit ? "disabled" : ""}>${escapeHtml(message.body)}</textarea>
      </label>
      <div class="reword-actions">
        <span class="rewrite-note">${isMergeCommit ? "merge 提交暂不支持自动修改" : "保存会重写此提交之后的历史 SHA"}</span>
        <button class="mini-btn" type="submit" ${isMergeCommit ? "disabled" : ""}>保存信息</button>
      </div>
    </form>
    <div class="detail-section-title">DIFF 预览</div>
    ${renderDiff(detail.diff)}
  `;
}

function renderHistoryRewritePlan(commit) {
  const plan = state.historyPlan;
  if (!plan || plan.sha !== commit.sha) return "";
  const config = historyRewriteConfig(plan.mode) || { title: "编辑历史", command: "git rebase -i" };
  if (plan.loading) {
    return `
      <section class="history-plan loading">
        <div class="history-plan-head">
          <strong>${escapeHtml(config.title)}计划</strong>
          <span>${escapeHtml(config.command)}</span>
        </div>
        <div class="history-plan-empty">正在预检历史编辑范围...</div>
      </section>
    `;
  }
  if (plan.error && !plan.preview) {
    return `
      <section class="history-plan blocked">
        <div class="history-plan-head">
          <strong>${escapeHtml(config.title)}计划</strong>
          <span>${escapeHtml(config.command)}</span>
        </div>
        <div class="history-plan-alert">${escapeHtml(plan.error)}</div>
        <div class="history-plan-actions">
          <button class="mini-btn" data-history-plan-action="refresh" type="button">重新预检</button>
          <button class="mini-btn" data-history-plan-action="cancel" type="button">取消</button>
        </div>
      </section>
    `;
  }
  const preview = plan.preview || {};
  const blockers = preview.blockers || [];
  const warnings = preview.warnings || [];
  const affected = preview.affectedPreview || [];
  return `
    <section class="history-plan ${preview.canRun ? "" : "blocked"}">
      <div class="history-plan-head">
        <strong>${escapeHtml(preview.title || config.title)}计划</strong>
        <span>${escapeHtml(preview.command || config.command)}</span>
      </div>
      <p class="history-plan-effect">${escapeHtml(preview.effect || config.effect || "")}</p>
      <div class="history-plan-grid">
        <span>当前分支</span><strong>${escapeHtml(preview.branch || state.data?.repo?.branch || "未知")}</strong>
        <span>目标提交</span><strong>${escapeHtml(preview.target?.short || commit.short)} · ${escapeHtml(preview.target?.message || commit.message)}</strong>
        <span>父提交</span><strong>${preview.parent ? `${escapeHtml(preview.parent.short)} · ${escapeHtml(preview.parent.message)}` : "无父提交"}</strong>
        <span>重放范围</span><strong>${escapeHtml(preview.rebaseStart || "待计算")}</strong>
        <span>影响提交</span><strong>${escapeHtml(String(preview.affectedCount ?? affected.length))} 个</strong>
      </div>
      ${
        blockers.length
          ? `<div class="history-plan-alert">${blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : `<div class="history-plan-ok">预检通过，可以执行。执行前会创建恢复点。</div>`
      }
      ${
        warnings.length
          ? `<div class="history-plan-warnings">${warnings.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : ""
      }
      <div class="history-plan-list">
        ${affected.length ? affected.map((item) => renderHistoryPlanCommit(item, preview.target?.sha)).join("") : `<div class="history-plan-empty">没有可显示的影响提交</div>`}
      </div>
      <div class="history-plan-actions">
        <button class="mini-btn" data-history-plan-action="refresh" type="button">重新预检</button>
        <button class="mini-btn" data-history-plan-action="cancel" type="button">取消</button>
        <button class="mini-btn ${plan.mode === "drop" ? "danger" : ""}" data-history-plan-action="execute" type="button" ${preview.canRun ? "" : "disabled"}>
          <span>确认执行</span><span class="command-hint">${escapeHtml(preview.command || config.command)}</span>
        </button>
      </div>
    </section>
  `;
}

function renderHistoryPlanCommit(commit, targetSha) {
  const isTarget = commit.sha === targetSha;
  return `
    <div class="history-plan-commit ${isTarget ? "target" : ""}">
      <span>${isTarget ? "目标" : "重放"}</span>
      <strong>${escapeHtml(commit.short)} · ${escapeHtml(commit.message)}</strong>
      <em>${escapeHtml(commit.author || "")} ${escapeHtml(commit.time || "")}</em>
    </div>
  `;
}

function renderHistoryRewriteQueue() {
  const queue = state.historyQueue;
  const items = queue.items || [];
  if (!items.length) {
    return `<div class="history-plan-empty history-queue-empty">队列为空。可以把多个提交加入队列后一次预检和执行。</div>`;
  }
  const preview = queue.preview || {};
  const blockers = preview.blockers || [];
  const warnings = preview.warnings || [];
  const affected = preview.affectedPreview || [];
  const actionDetails = new Map((preview.actions || []).map((item) => [item.target?.sha, item]));
  return `
    <section class="history-plan history-queue ${preview.canRun ? "" : "blocked"}">
      <div class="history-plan-head">
        <strong>历史编辑队列</strong>
        <span>git rebase -i / queue</span>
      </div>
      <p class="history-plan-effect">把多个 squash / fixup / drop / reword 动作排队，预检通过后一次重写当前分支历史。</p>
      <div class="history-plan-grid">
        <span>当前分支</span><strong>${escapeHtml(preview.branch || state.data?.repo?.branch || "未知")}</strong>
        <span>队列动作</span><strong>${escapeHtml(String(preview.queueCount ?? items.length))} 项</strong>
        <span>重放范围</span><strong>${escapeHtml(preview.rebaseStart || (queue.loading ? "正在计算" : "待预检"))}</strong>
        <span>影响提交</span><strong>${escapeHtml(String(preview.affectedCount ?? affected.length))} 个</strong>
      </div>
      <div class="history-plan-list history-queue-list">
        ${items.map((item, index) => renderHistoryQueueItem(item, index, actionDetails.get(item.sha))).join("")}
      </div>
      ${queue.loading ? `<div class="history-plan-empty">正在预检历史编辑队列...</div>` : ""}
      ${queue.error ? `<div class="history-plan-alert"><span>${escapeHtml(queue.error)}</span></div>` : ""}
      ${
        blockers.length
          ? `<div class="history-plan-alert">${blockers.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : !queue.loading && preview.canRun
            ? `<div class="history-plan-ok">预检通过，可以执行队列。执行前会创建恢复点。</div>`
            : ""
      }
      ${
        warnings.length
          ? `<div class="history-plan-warnings">${warnings.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : ""
      }
      ${
        affected.length
          ? `<div class="history-queue-preview-title"><strong>实际执行顺序</strong><span>按当前分支历史生成</span></div><div class="history-plan-list">${affected.map(renderHistoryQueueAffectedCommit).join("")}</div>`
          : ""
      }
      <div class="history-plan-actions">
        <button class="mini-btn" data-history-queue-action="refresh" type="button">重新预检</button>
        <button class="mini-btn" data-history-queue-action="clear" type="button">清空队列</button>
        <button class="mini-btn danger" data-history-queue-action="execute" type="button" ${preview.canRun && !queue.loading ? "" : "disabled"}>
          <span>执行队列</span><span class="command-hint">git rebase -i</span>
        </button>
      </div>
    </section>
  `;
}

function renderHistoryQueueItem(item, index, detail) {
  const config = historyRewriteConfig(item.mode) || { title: "编辑历史", command: "git rebase -i" };
  const target = detail?.target || item;
  const commandText = item.mode === "reword" && item.summary ? `${config.command} -> ${item.summary}` : config.command;
  const modeOptions = ["squash", "fixup", "reword", "drop"]
    .map((mode) => {
      const modeConfig = historyRewriteConfig(mode);
      return `<option value="${escapeAttr(mode)}" ${mode === item.mode ? "selected" : ""}>${escapeHtml(modeConfig.title)}</option>`;
    })
    .join("");
  const rewordItem = historyQueueItemWithMode(item, "reword");
  const rewordFields = item.mode === "reword"
    ? `
      <div class="history-queue-reword">
        <label>
          <span>新摘要</span>
          <input data-history-queue-field data-sha="${escapeAttr(item.sha)}" data-field="summary" value="${escapeAttr(rewordItem.summary || "")}" autocomplete="off" />
        </label>
        <label>
          <span>新正文</span>
          <textarea data-history-queue-field data-sha="${escapeAttr(item.sha)}" data-field="body">${escapeHtml(rewordItem.body || "")}</textarea>
        </label>
      </div>
    `
    : "";
  return `
    <div class="history-plan-commit history-queue-item ${item.mode === "drop" ? "danger" : ""}">
      <div class="history-queue-mode-cell">
        <span>第 ${index + 1} 项</span>
        <select data-history-queue-action="changeMode" data-sha="${escapeAttr(item.sha)}" title="修改此队列项动作">
          ${modeOptions}
        </select>
      </div>
      <div class="history-queue-copy">
        <strong>${escapeHtml(target.short || item.short || item.sha.slice(0, 7))} · ${escapeHtml(target.message || item.message || "")}</strong>
        <em>${escapeHtml(commandText)}</em>
      </div>
      ${rewordFields}
      <div class="history-queue-buttons">
        <button class="mini-btn" data-history-queue-action="moveUp" data-sha="${escapeAttr(item.sha)}" type="button" ${index === 0 ? "disabled" : ""} title="上移队列显示顺序">上移</button>
        <button class="mini-btn" data-history-queue-action="moveDown" data-sha="${escapeAttr(item.sha)}" type="button" ${index >= state.historyQueue.items.length - 1 ? "disabled" : ""} title="下移队列显示顺序">下移</button>
        <button class="mini-btn" data-history-queue-action="remove" data-sha="${escapeAttr(item.sha)}" type="button" title="从历史编辑队列移除第 ${index + 1} 项">移除</button>
      </div>
    </div>
  `;
}

function renderHistoryQueueAffectedCommit(commit) {
  const action = commit.queueAction || "pick";
  const isChanged = action !== "pick";
  const command = commit.queueSummary ? `${commit.queueCommand || "pick"} -> ${commit.queueSummary}` : commit.queueCommand || "pick";
  return `
    <div class="history-plan-commit ${isChanged ? "target" : ""} ${action === "drop" ? "danger" : ""}">
      <span>${escapeHtml(commit.queueActionLabel || (isChanged ? action : "保留"))}</span>
      <strong>${escapeHtml(commit.short)} · ${escapeHtml(commit.message)}</strong>
      <em>${escapeHtml(command)} · ${escapeHtml(commit.author || "")} ${escapeHtml(commit.time || "")}</em>
    </div>
  `;
}

function commitMessageParts(commit, detail) {
  const raw = String(detail.message || commit.message || "").replace(/\r\n/g, "\n").trimEnd();
  const lines = raw.split("\n");
  const summary = (lines.shift() || commit.message || "").trim();
  while (lines[0] === "") lines.shift();
  return { summary, body: lines.join("\n").trimEnd() };
}

function renderFilesTab(commit, detail) {
  const files = detail.files || [];
  if (files.length && !files.some((file) => file.file === state.selectedCommitFile)) {
    state.selectedCommitFile = files[0].file;
  }
  const selectedDiff = state.selectedCommitFile ? diffForFile(detail.diff || [], state.selectedCommitFile) : detail.diff || [];
  if (state.selectedCommitFile) renderHistoryDiffInWorkbench(commit, detail, state.selectedCommitFile);
  els.detailBody.innerHTML = `
    <div class="detail-section-title">变更文件</div>
    <div class="commit-file-view">
      <div class="commit-file-tree">${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">没有文件列表</span><span></span></div>`}</div>
      <div class="commit-file-diff">
        <div class="panel-title compact">
          <div class="panel-title-text">
            <span>${escapeHtml(state.selectedCommitFile ? shortFileName(state.selectedCommitFile) : commit.short)}</span>
            <span class="panel-subtitle">${escapeHtml(state.selectedCommitFile || "未选择文件")}</span>
          </div>
          <button class="mini-btn" data-file-history-open data-file="${escapeAttr(state.selectedCommitFile || "")}" data-ref="${escapeAttr(commit.sha)}" type="button" ${state.selectedCommitFile ? "" : "disabled"}>文件历史</button>
          <button class="mini-btn" data-file-blame-open data-file="${escapeAttr(state.selectedCommitFile || "")}" data-ref="${escapeAttr(commit.sha)}" type="button" ${state.selectedCommitFile ? "" : "disabled"}>逐行追踪</button>
          <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
        </div>
        ${renderSideDiff(selectedDiff, "没有可显示的历史改动")}
      </div>
    </div>
  `;
  bindFileTree(els.detailBody, { mode: "commit" });
  markCommitFile();
}

function renderFileHistoryTab() {
  const history = state.fileHistory;
  els.detailNode.style.borderColor = "var(--teal)";
  els.detailTitle.textContent = "文件历史";
  els.detailSub.textContent = history.file || "从文件右键菜单或提交文件列表打开";
  if (!history.file) {
    els.detailBody.innerHTML = `
      <div class="empty-state">
        <strong>还没有选择文件</strong>
        <span>在工作区文件上右键选择“查看文件历史”，或在提交的文件面板里点击“文件历史”。</span>
      </div>
    `;
    return;
  }
  if (history.loading) {
    els.detailBody.innerHTML = `<div class="empty-state"><strong>正在读取文件历史</strong><span>${escapeHtml(history.file)}</span></div>`;
    return;
  }
  if (history.error) {
    els.detailBody.innerHTML = `<div class="empty-state danger"><strong>读取失败</strong><span>${escapeHtml(history.error)}</span></div>`;
    return;
  }
  const data = history.data || {};
  const commits = data.commits || [];
  els.detailBody.innerHTML = `
    <div class="file-history-head">
      <div>
        <div class="detail-section-title">文件历史</div>
        <strong>${escapeHtml(data.file || history.file)}</strong>
        <span>${escapeHtml(data.command || `git log --follow -- ${history.file}`)}</span>
      </div>
      <button class="mini-btn" data-file-history-refresh type="button">刷新</button>
    </div>
    ${
      commits.length
        ? `<div class="file-history-list">${commits.map(renderFileHistoryCommit).join("")}</div>`
        : `<div class="empty-state"><strong>没有找到历史记录</strong><span>这个文件可能还没有提交，或在当前引用 ${escapeHtml(data.ref || history.ref || "HEAD")} 中不存在。</span></div>`
    }
  `;
}

function renderFileHistoryCommit(commit) {
  const change = fileHistoryChangeLabel(commit.change || commit.files?.[0]?.state || "M");
  const renameText = commit.previousFile ? `<span class="file-history-rename">${escapeHtml(commit.previousFile)} -> ${escapeHtml(commit.files?.[0]?.file || "")}</span>` : "";
  return `
    <article class="file-history-row">
      <span class="state-pill ${change.className}">${escapeHtml(change.label)}</span>
      <div class="file-history-main">
        <strong>${escapeHtml(commit.message || "(无提交信息)")}</strong>
        <span>${escapeHtml(commit.short || commit.sha?.slice(0, 7) || "")} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
        ${renameText}
      </div>
      <div class="file-history-actions">
        <button class="mini-btn" data-file-history-action="view" data-sha="${escapeAttr(commit.sha || "")}" type="button">查看提交</button>
        <button class="mini-btn" data-file-history-action="file" data-sha="${escapeAttr(commit.sha || "")}" data-file="${escapeAttr(commit.files?.[0]?.file || state.fileHistory.file)}" type="button">文件改动</button>
      </div>
    </article>
  `;
}

function fileHistoryChangeLabel(stateCode) {
  const code = String(stateCode || "M").slice(0, 1);
  const map = {
    A: { label: "新增", className: "added" },
    D: { label: "删除", className: "deleted" },
    R: { label: "重命名", className: "renamed" },
    C: { label: "复制", className: "renamed" },
    M: { label: "修改", className: "modified" },
  };
  return map[code] || map.M;
}

function renderFileBlameTab() {
  const blame = state.fileBlame;
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = "逐行追踪";
  els.detailSub.textContent = blame.file || "从文件右键菜单或提交文件列表打开";
  if (!blame.file) {
    els.detailBody.innerHTML = `
      <div class="empty-state">
        <strong>还没有选择文件</strong>
        <span>在工作区文件上右键选择“逐行追踪”，或在提交的文件面板里点击“逐行追踪”。</span>
      </div>
    `;
    return;
  }
  if (blame.loading) {
    els.detailBody.innerHTML = `<div class="empty-state"><strong>正在读取逐行追踪</strong><span>${escapeHtml(blame.file)}</span></div>`;
    return;
  }
  if (blame.error) {
    els.detailBody.innerHTML = `<div class="empty-state danger"><strong>读取失败</strong><span>${escapeHtml(blame.error)}</span></div>`;
    return;
  }
  const data = blame.data || {};
  const lines = data.lines || [];
  els.detailBody.innerHTML = `
    <div class="file-blame-head">
      <div>
        <div class="detail-section-title">逐行追踪</div>
        <strong>${escapeHtml(data.file || blame.file)}</strong>
        <span>${escapeHtml(data.command || `git blame --line-porcelain -- ${blame.file}`)}</span>
      </div>
      <div class="file-blame-actions">
        ${data.truncated ? `<span class="blame-truncated">仅显示前 ${lines.length} 行</span>` : ""}
        <button class="mini-btn" data-file-blame-refresh type="button">刷新</button>
      </div>
    </div>
    ${
      lines.length
        ? `<div class="file-blame-list">${lines.map(renderFileBlameLine).join("")}</div>`
        : `<div class="empty-state"><strong>没有可显示的内容</strong><span>这个文件可能在当前引用 ${escapeHtml(data.ref || blame.ref || "HEAD")} 中不存在，或是空文件。</span></div>`
    }
  `;
}

function renderFileBlameLine(line, index, lines) {
  const previous = lines[index - 1];
  const grouped = previous?.sha === line.sha;
  return `
    <div class="file-blame-row ${grouped ? "grouped" : ""}">
      <button class="blame-commit" data-file-blame-action="view" data-sha="${escapeAttr(line.sha || "")}" type="button" title="${escapeAttr(line.summary || "")}">
        <strong>${grouped ? "" : escapeHtml(line.short || line.sha?.slice(0, 7) || "")}</strong>
        <span>${grouped ? "" : escapeHtml(line.author || "unknown")}</span>
      </button>
      <span class="blame-line">${escapeHtml(line.line || index + 1)}</span>
      <code>${escapeHtml(line.text || "")}</code>
    </div>
  `;
}

async function openFileBlame(filePath, ref = "") {
  if (!filePath) {
    toast("请选择文件");
    return;
  }
  const targetRef = ref || currentFileHistoryRef();
  state.fileBlame = { file: filePath, ref: targetRef, data: null, loading: true, error: "" };
  state.selectedTab = "fileBlame";
  renderInspector();
  try {
    const data = await api(`/api/file-blame?file=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(targetRef)}`);
    state.fileBlame = { file: filePath, ref: data.ref || targetRef, data, loading: false, error: "" };
  } catch (error) {
    state.fileBlame = { file: filePath, ref: targetRef, data: null, loading: false, error: error.message };
  }
  renderInspector();
}

async function runFileBlameAction(action, button) {
  const sha = button.dataset.sha || "";
  if (!sha) return;
  const commit = state.data?.commits.find((item) => item.sha === sha);
  if (!commit) {
    toast("这个提交不在当前图谱列表中，请清空过滤或切换到包含它的分支后再试。");
    return;
  }
  if (action === "view") {
    els.searchInput.value = "";
    state.selectedTab = "details";
    await selectCommit(sha);
  }
}

async function openFileHistory(filePath, ref = "") {
  if (!filePath) {
    toast("请选择文件");
    return;
  }
  const targetRef = ref || currentFileHistoryRef();
  state.fileHistory = { file: filePath, ref: targetRef, data: null, loading: true, error: "" };
  state.selectedTab = "fileHistory";
  renderInspector();
  try {
    const data = await api(`/api/file-history?file=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(targetRef)}`);
    state.fileHistory = { file: filePath, ref: data.ref || targetRef, data, loading: false, error: "" };
  } catch (error) {
    state.fileHistory = { file: filePath, ref: targetRef, data: null, loading: false, error: error.message };
  }
  renderInspector();
}

function currentFileHistoryRef() {
  return state.selectedRef || state.data?.repo?.selectedRef || state.data?.repo?.branch || "HEAD";
}

async function runFileHistoryAction(action, button) {
  const sha = button.dataset.sha || "";
  const file = button.dataset.file || state.fileHistory.file || "";
  if (!sha) return;
  const commit = state.data?.commits.find((item) => item.sha === sha);
  if (!commit) {
    toast("这个提交不在当前图谱列表中，请清空过滤或切换到包含它的分支后再试。");
    return;
  }
  els.searchInput.value = "";
  if (action === "view") {
    state.selectedTab = "details";
    await selectCommit(sha);
    return;
  }
  if (action === "file") {
    state.selectedCommitFile = file;
    state.selectedTab = "files";
    await selectCommit(sha);
  }
}

function renderBranchesTab(commit) {
  const rows = branchCleanupRows();
  const summary = branchCleanupSummary(rows);
  const realRepo = Boolean(state.data && !state.data.repo.isSample);
  els.detailNode.style.borderColor = "var(--teal)";
  els.detailTitle.textContent = "分支整理";
  els.detailSub.textContent = rows.length ? `${rows.length} 个本地分支 · 基准 ${state.data?.repo?.branch || "HEAD"}` : "没有本地分支";
  if (!rows.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有本地分支</strong>
        <span>打开真实 Git 仓库后会在这里显示分支整理建议。</span>
      </div>
    `;
    return;
  }
  const relatedRefs = (commit?.refs || state.data?.repo?.branch || "")
    .split(",")
    .map((ref) => ({ label: ref.trim(), ref: normalizeCommitRefLabel(ref) }))
    .filter((item) => item.label && item.ref)
    .slice(0, 8);
  const relatedHtml = relatedRefs.length
    ? `
      <div class="branch-focus">
        <div class="detail-section-title">当前提交引用</div>
        <div class="branch-focus-list">
          ${relatedRefs.map((item, index) => `<button class="nav-item" data-branch-cleanup-action="view" data-branch="${escapeAttr(item.ref)}" type="button" title="${escapeAttr(item.ref)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(item.label)}</span></button>`).join("")}
        </div>
      </div>
    `
    : "";
  els.detailBody.innerHTML = `
    <div class="branch-cleanup-layout">
      <div class="branch-cleanup-summary">
        <div><span>已合并</span><strong>${summary.merged}</strong></div>
        <div><span>上游丢失</span><strong>${summary.gone}</strong></div>
        <div><span>长期未动</span><strong>${summary.stale}</strong></div>
      </div>
      <div class="branch-cleanup-actions">
        <button class="mini-btn" data-branch-cleanup-action="refresh" type="button"><span>刷新</span><span class="command-hint">git branch</span></button>
        <button class="mini-btn danger" data-branch-cleanup-action="deleteMerged" type="button" ${!realRepo || !summary.deletableMerged ? "disabled" : ""}>
          <span>删除已合并</span><span class="command-hint">git branch -d</span>
        </button>
      </div>
      ${relatedHtml}
      <div class="branch-cleanup-list">
        ${rows.map((row, index) => branchCleanupRowHtml(row, index, realRepo)).join("")}
      </div>
    </div>
  `;
}

function normalizeCommitRefLabel(ref) {
  return String(ref || "")
    .trim()
    .replace(/^HEAD\s*->\s*/, "")
    .replace(/^tag:\s*/, "")
    .trim();
}

function branchCleanupRows() {
  const rows = state.data?.branchCleanup;
  if (Array.isArray(rows) && rows.length) return rows;
  const current = state.data?.repo?.branch || "";
  const branchInfo = state.data?.branchInfo || {};
  return (state.data?.branches || []).map((branch) => {
    const info = branchInfo[branch] || {};
    const protectedBranch = branch === current || ["main", "master", "develop", "development", "dev", "trunk"].includes(String(branch || "").toLowerCase());
    return {
      branch,
      current: branch === current,
      protected: protectedBranch,
      upstream: info.upstream || "",
      upstreamGone: Boolean(info.upstreamGone),
      ahead: Number(info.ahead) || 0,
      behind: Number(info.behind) || 0,
      occupied: Boolean(info.worktreePath),
      worktreePath: info.worktreePath || "",
      canDelete: !protectedBranch && !info.worktreePath,
      statusLabel: branch === current ? "当前" : protectedBranch ? "保护" : info.upstreamGone ? "上游丢失" : "活跃",
      reason: branch === current ? "当前所在分支不能删除" : protectedBranch ? "主干或长期分支默认保留" : info.upstreamGone ? "上游分支已经不存在，删除前先确认本地提交是否还需要" : "等待 Git 状态刷新",
    };
  });
}

function branchCleanupSummary(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.mergedIntoCurrent) acc.merged += 1;
      if (row.upstreamGone) acc.gone += 1;
      if (row.stale) acc.stale += 1;
      if (row.canDelete && row.mergedIntoCurrent) acc.deletableMerged += 1;
      return acc;
    },
    { merged: 0, gone: 0, stale: 0, deletableMerged: 0 }
  );
}

function branchCleanupRowHtml(row, index, realRepo) {
  const canDelete = Boolean(realRepo && row.canDelete);
  const classes = ["branch-cleanup-row", branchCleanupStatusClass(row), row.recommended ? "recommended" : "", row.attention ? "attention" : ""].filter(Boolean).join(" ");
  const branch = row.branch || "";
  const meta = branchCleanupMetaHtml(row);
  const deleteTitle = canDelete ? `安全删除本地分支 ${branch}` : row.deleteBlockedReason || row.protectedReason || (realRepo ? "这个分支暂不适合删除" : "示例仓库不能执行删除");
  return `
    <div class="${classes}" data-branch-name="${escapeAttr(branch)}">
      <div class="branch-cleanup-head">
        <strong title="${escapeAttr(branch)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span></strong>
        <span class="branch-cleanup-status">${escapeHtml(row.statusLabel || "活跃")}</span>
      </div>
      ${meta}
      <div class="branch-cleanup-last">
        <code>${escapeHtml(row.lastCommitShort || "")}</code>
        <span title="${escapeAttr(row.lastSubject || "")}">${escapeHtml(row.lastSubject || "没有提交摘要")}</span>
        <em>${escapeHtml(row.lastUpdated || "")}</em>
      </div>
      <p title="${escapeAttr(row.reason || "")}">${escapeHtml(row.reason || "")}</p>
      <div class="branch-cleanup-row-actions">
        <button class="mini-btn" data-branch-cleanup-action="view" data-branch="${escapeAttr(branch)}" type="button">查看</button>
        <button class="mini-btn" data-branch-cleanup-action="compare" data-branch="${escapeAttr(branch)}" type="button" ${row.current ? "disabled" : ""}>比较</button>
        <button class="mini-btn danger" data-branch-cleanup-action="delete" data-branch="${escapeAttr(branch)}" type="button" title="${escapeAttr(deleteTitle)}" ${canDelete ? "" : "disabled"}>
          <span>删除</span><span class="command-hint">git branch -d</span>
        </button>
      </div>
    </div>
  `;
}

function branchCleanupMetaHtml(row) {
  const badges = [];
  if (row.upstream) badges.push(`<span class="branch-badge upstream" title="${escapeAttr(row.upstream)}">${escapeHtml(row.upstream)}</span>`);
  else if (row.current) badges.push(`<span class="branch-badge muted">未设置 upstream</span>`);
  if (row.upstreamGone) badges.push(`<span class="branch-badge danger">上游丢失</span>`);
  if (row.ahead) badges.push(`<span class="branch-badge ahead">领先 ${escapeHtml(row.ahead)}</span>`);
  if (row.behind) badges.push(`<span class="branch-badge behind">落后 ${escapeHtml(row.behind)}</span>`);
  if (row.mergedIntoCurrent) badges.push(`<span class="branch-badge merged">已合并</span>`);
  if (row.stale) badges.push(`<span class="branch-badge stale">${escapeHtml(row.staleDays || 0)} 天未动</span>`);
  if (row.occupied) badges.push(`<span class="branch-badge danger">worktree 占用</span>`);
  if (row.protected && !row.current) badges.push(`<span class="branch-badge muted">保护</span>`);
  return badges.length ? `<div class="branch-cleanup-meta">${badges.join("")}</div>` : `<div class="branch-cleanup-meta"><span class="branch-badge muted">无 upstream</span></div>`;
}

function branchCleanupStatusClass(row) {
  if (row.current) return "current";
  if (row.protected) return "protected";
  if (row.occupied) return "occupied";
  if (row.mergedIntoCurrent) return "merged";
  if (row.upstreamGone) return "gone";
  if (row.stale) return "stale";
  return "active";
}

async function runBranchCleanupAction(action, button) {
  const branch = button?.dataset?.branch || "";
  if (action === "refresh") {
    await refreshBranchCleanup(button);
    return;
  }
  if (action === "deleteMerged") {
    await deleteMergedCleanupBranches(button);
    return;
  }
  if (!branch) return;
  if (action === "view") {
    await selectRef(branch);
    return;
  }
  if (action === "compare") {
    await openCompareBranch(branch);
    return;
  }
  if (action === "delete") {
    await deleteBranch(branch, button);
  }
}

async function refreshBranchCleanup(button) {
  if (!state.data) return;
  if (button) button.disabled = true;
  try {
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    renderInspector();
    toast("分支整理已刷新");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteMergedCleanupBranches(button) {
  if (!state.data || state.data.repo.isSample) return;
  const branches = branchCleanupRows()
    .filter((row) => row.canDelete && row.mergedIntoCurrent)
    .map((row) => row.branch)
    .filter(Boolean);
  if (!branches.length) {
    toast("没有可安全删除的已合并分支");
    return;
  }
  const preview = branches.slice(0, 8).join("\n");
  const suffix = branches.length > 8 ? `\n... 还有 ${branches.length - 8} 个` : "";
  if (!confirm(`确认安全删除这些已合并分支？\n\n${preview}${suffix}\n\n命令：git branch -d <分支>\n如果 Git 判断未完全合并，会自动阻止。`)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "deleteBranches", branches }),
    });
    toast(result.output || `已删除 ${branches.length} 个分支`);
    state.commitDetails.clear();
    if (branches.includes(state.selectedRef)) state.selectedRef = state.data.repo.branch || "";
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function branchCleanupContextOptions(branch) {
  const row = branchCleanupRows().find((item) => item.branch === branch) || {};
  return {
    local: true,
    checkout: true,
    rename: true,
    delete: true,
    current: Boolean(row.current || branch === state.data?.repo?.branch),
    occupied: Boolean(row.occupied),
    worktreePath: row.worktreePath || "",
    prunable: false,
    upstream: row.upstream || "",
    upstreamGone: Boolean(row.upstreamGone),
    ahead: Number(row.ahead) || 0,
    behind: Number(row.behind) || 0,
  };
}

function renderWorktreesTab() {
  const rows = state.data?.worktrees || [];
  const realRepo = Boolean(state.data && !state.data.repo.isSample);
  const summary = worktreeSummary(rows);
  els.detailNode.style.borderColor = summary.dirty || summary.prunable ? "var(--amber)" : "var(--blue)";
  els.detailTitle.textContent = "工作树";
  els.detailSub.textContent = rows.length ? `${rows.length} 个 Git worktree · 当前 ${state.data?.repo?.branch || "HEAD"}` : "没有工作树";
  setActiveDiff(null);
  els.detailBody.innerHTML = `
    <div class="worktree-dashboard">
      <div class="worktree-summary">
        <div><span>总数</span><strong>${rows.length}</strong></div>
        <div><span>干净</span><strong>${summary.clean}</strong></div>
        <div><span>有改动</span><strong>${summary.dirty}</strong></div>
        <div><span>失效</span><strong>${summary.prunable}</strong></div>
      </div>
      ${worktreeCreateHtml(realRepo)}
      <div class="worktree-actions">
        <button class="mini-btn" data-worktree-action="refresh" type="button"><span>刷新</span><span class="command-hint">git worktree</span></button>
        <button class="mini-btn" data-worktree-action="pruneAll" type="button" ${realRepo && summary.prunable ? "" : "disabled"}><span>清理失效</span><span class="command-hint">prune</span></button>
      </div>
      <div class="worktree-list">
        ${
          rows.length
            ? rows.map((row, index) => worktreeRowHtml(row, index, realRepo)).join("")
            : `<div class="empty-panel compact"><span>当前仓库还没有额外工作树。</span></div>`
        }
      </div>
    </div>
  `;
}

function worktreeSummary(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      if (row.prunable || !row.exists) acc.prunable += 1;
      else if (row.status === "dirty") acc.dirty += 1;
      else if (row.status === "clean") acc.clean += 1;
      return acc;
    },
    { clean: 0, dirty: 0, prunable: 0 }
  );
}

function worktreeCreateHtml(realRepo) {
  const defaultRef = worktreeDefaultRef();
  const refs = compareRefOptions([defaultRef]);
  const target = worktreeTargetSuggestion(defaultRef);
  return `
    <form class="worktree-create" data-worktree-form>
      <datalist id="worktreeRefOptions">
        ${refs.map((item) => `<option value="${escapeAttr(item.ref)}" label="${escapeAttr(item.label)}"></option>`).join("")}
      </datalist>
      <label>
        <span>目标文件夹</span>
        <input data-worktree-field="targetPath" autocomplete="off" spellcheck="false" value="${escapeAttr(target)}" placeholder="D:\\项目\\repo-feature" ${realRepo ? "" : "disabled"} />
      </label>
      <label>
        <span>起点引用</span>
        <input data-worktree-field="ref" list="worktreeRefOptions" autocomplete="off" spellcheck="false" value="${escapeAttr(defaultRef)}" placeholder="HEAD / main / origin/feature" ${realRepo ? "" : "disabled"} />
      </label>
      <label>
        <span>新分支名</span>
        <input data-worktree-field="branch" autocomplete="off" spellcheck="false" placeholder="可选，不填则直接签出起点" ${realRepo ? "" : "disabled"} />
      </label>
      <button class="mini-btn" type="submit" ${realRepo ? "" : "disabled"}><span>创建工作树</span><span class="command-hint">git worktree add</span></button>
    </form>
  `;
}

function worktreeDefaultRef() {
  return state.selectedRef || state.data?.repo?.branch || "HEAD";
}

function worktreeTargetSuggestion(ref) {
  const repo = state.data?.repo || {};
  const base = repoParentPath(repo.path || "");
  if (!base) return "";
  const repoName = worktreePathSlug(repo.name || "repo");
  const refName = worktreePathSlug(ref || "worktree");
  return joinLocalPath(base, `${repoName}-${refName}`);
}

function worktreePathSlug(value) {
  return String(value || "worktree")
    .replace(/^[A-Za-z]:/, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/[\\/\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56) || "worktree";
}

function worktreeRowHtml(row, index, realRepo) {
  const status = worktreeStatus(row);
  const branch = row.label || row.branch || "detached HEAD";
  const openDisabled = !realRepo || row.current || !row.exists || row.prunable;
  const pruneDisabled = !realRepo || !row.prunable;
  return `
    <article class="worktree-row ${row.current ? "current" : ""} ${row.prunable || !row.exists ? "prunable" : ""}">
      <div class="worktree-row-head">
        <strong title="${escapeAttr(branch)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span></strong>
        <span class="worktree-status ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      <div class="worktree-path" title="${escapeAttr(row.path || "")}">${escapeHtml(row.path || "未知路径")}</div>
      <div class="worktree-meta">
        <span>${escapeHtml(row.shortHead || "无 HEAD")}</span>
        ${row.detached ? `<span>游离 HEAD</span>` : ""}
        ${row.locked ? `<span title="${escapeAttr(row.lockReason || "locked")}">已锁定</span>` : ""}
        ${row.operation?.label ? `<span title="${escapeAttr(row.operation.label)}">操作中</span>` : ""}
        ${row.prunable && row.pruneReason ? `<span title="${escapeAttr(row.pruneReason)}">可清理</span>` : ""}
      </div>
      <div class="worktree-row-actions">
        <button class="mini-btn" data-worktree-action="open" data-worktree-path="${escapeAttr(row.path || "")}" type="button" ${openDisabled ? "disabled" : ""}>打开</button>
        <button class="mini-btn" data-worktree-action="copyPath" data-worktree-path="${escapeAttr(row.path || "")}" type="button">复制路径</button>
        <button class="mini-btn danger" data-worktree-action="pruneAll" type="button" ${pruneDisabled ? "disabled" : ""}><span>清理</span><span class="command-hint">prune</span></button>
      </div>
    </article>
  `;
}

function worktreeStatus(row) {
  if (row.prunable || !row.exists) return { label: "失效", className: "danger" };
  if (row.operation?.label) return { label: "操作中", className: "warn" };
  if (row.status === "dirty") return { label: `${row.dirtyCount || 0} 个改动`, className: "warn" };
  if (row.status === "clean") return { label: "干净", className: "ok" };
  return { label: "未知", className: "muted" };
}

async function submitWorktreeForm(form) {
  if (!state.data) return;
  const targetPath = form.querySelector('[data-worktree-field="targetPath"]')?.value.trim() || "";
  const ref = form.querySelector('[data-worktree-field="ref"]')?.value.trim() || "HEAD";
  const branch = form.querySelector('[data-worktree-field="branch"]')?.value.trim() || "";
  if (!targetPath) {
    toast("请输入工作树目标文件夹");
    return;
  }
  if (!ref) {
    toast("请输入工作树起点引用");
    return;
  }
  const command = branch ? `git worktree add -b ${branch} ${targetPath} ${ref}` : `git worktree add ${targetPath} ${ref}`;
  if (!state.data.repo.isSample && !confirm(`确认创建工作树？\n\n位置：${targetPath}\n起点：${ref}${branch ? `\n新分支：${branch}` : ""}\n命令：${command}`)) return;
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "createWorktree", targetPath, ref, branch }),
    });
    toast(result.output || "已创建工作树");
    state.commitDetails.clear();
    state.data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function runWorktreeAction(action, button) {
  if (!state.data) return;
  const worktreePath = button?.dataset?.worktreePath || "";
  if (action === "copyPath") {
    await copyText(worktreePath);
    toast("已复制工作树路径");
    return;
  }
  if (action === "refresh") {
    await refreshWorktreeDashboard(button);
    return;
  }
  if (action === "open") {
    await openWorktreePath(worktreePath, button);
    return;
  }
  if (action === "pruneAll") {
    await pruneWorktreeRecords(button);
  }
}

async function refreshWorktreeDashboard(button) {
  if (button) button.disabled = true;
  try {
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    toast("工作树列表已刷新");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openWorktreePath(worktreePath, button) {
  if (!worktreePath) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "openWorktree", path: worktreePath }),
    });
    toast(result.output || "已打开工作树");
    state.commitDetails.clear();
    state.selectedRef = "";
    state.data = result.state;
    state.selectedSha = state.data.commits[0]?.sha || "";
    saveRecentRepo(state.data.repo);
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function pruneWorktreeRecords(button) {
  if (!state.data?.repo?.isSample && !confirm("确认清理失效工作树记录？\n\n命令：git worktree prune --verbose\n这只清理 Git 中已经失效的 worktree 元数据，不会删除仍存在的工作区文件。")) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "pruneAllWorktrees" }),
    });
    toast(result.output || "已清理失效工作树记录");
    state.data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderStashesTab() {
  const stashes = state.data?.stashes || [];
  if (state.selectedStash && !stashes.some((stash) => stash.ref === state.selectedStash)) {
    state.selectedStash = "";
  }
  if (!state.selectedStash && stashes.length) state.selectedStash = stashes[0].ref;
  const selected = stashes.find((stash) => stash.ref === state.selectedStash);
  let detail = selected ? state.stashDetails.get(selected.ref) : null;
  if (selected && !detail) {
    detail = { loading: true };
    loadStashDetail(selected.ref);
  }

  els.detailNode.style.borderColor = "var(--amber)";
  els.detailTitle.textContent = "储藏列表";
  els.detailSub.textContent = stashes.length ? `${stashes.length} 个储藏` : "没有储藏";
  if (!stashes.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有储藏记录</strong>
        <span>使用“储藏并签出”或 Git stash 后会显示在这里。</span>
      </div>
    `;
    return;
  }

  const files = detail?.files || [];
  const diff = detail?.diff || [];
  if (selected && diff.length) {
    setActiveDiff({ source: "stash", title: `${selected.ref} · 储藏`, path: selected.message, diff, emptyText: "没有可显示的储藏改动" });
  } else {
    setActiveDiff(null);
  }
  els.detailBody.innerHTML = `
    <div class="stash-layout">
      <div class="stash-list">
        ${stashes.map((stash) => stashRowHtml(stash, stash.ref === state.selectedStash)).join("")}
      </div>
      <div class="stash-detail">
        ${selected ? stashDetailHtml(selected, detail, files, diff) : ""}
      </div>
    </div>
  `;
}

function stashRowHtml(stash, active) {
  return `
    <button class="stash-row ${active ? "active" : ""}" data-stash-ref="${escapeAttr(stash.ref)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(stash.ref)}</strong>
        <em>${escapeHtml(stash.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(stash.message)}">${escapeHtml(stash.message)}</span>
      <span class="stash-branch" title="${escapeAttr(stash.subject)}">${escapeHtml(stash.branch || "未知分支")}</span>
    </button>
  `;
}

function stashDetailHtml(stash, detail, files, diff) {
  if (detail?.loading) {
    return `<div class="empty-panel compact"><span>正在读取储藏内容...</span></div>`;
  }
  if (detail?.error) {
    return `<div class="empty-panel compact"><strong>读取失败</strong><span>${escapeHtml(detail.error)}</span></div>`;
  }
  return `
    <div class="stash-actions">
      <button class="mini-btn" data-stash-action="apply" data-stash-ref="${escapeAttr(stash.ref)}" type="button">应用</button>
      <button class="mini-btn" data-stash-action="pop" data-stash-ref="${escapeAttr(stash.ref)}" type="button">弹出</button>
      <button class="mini-btn" data-stash-action="branch" data-stash-ref="${escapeAttr(stash.ref)}" type="button">建分支</button>
      <button class="mini-btn danger" data-stash-action="drop" data-stash-ref="${escapeAttr(stash.ref)}" type="button">删除</button>
    </div>
    <div class="meta-grid stash-meta">
      <span>引用</span><div class="meta-value">${escapeHtml(stash.ref)}</div>
      <span>分支</span><div class="meta-value">${escapeHtml(stash.branch || "未知")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(stash.time || "未知")}</div>
      <span>消息</span><div class="meta-value" title="${escapeAttr(stash.message)}">${escapeHtml(stash.message)}</div>
    </div>
    <div class="detail-section-title">变更文件</div>
    <div class="stash-files">${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">没有文件列表</span><span></span></div>`}</div>
    <div class="panel-title compact stash-diff-title">
      <div class="panel-title-text">
        <span>储藏差异</span>
        <span class="panel-subtitle">${escapeHtml(stash.ref)}</span>
      </div>
      <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${diff.length ? "" : "disabled"}>最大化</button>
    </div>
    <div class="stash-diff">${renderSideDiff(diff, "没有可显示的储藏改动")}</div>
  `;
}

async function loadStashDetail(ref) {
  if (!ref || state.stashDetails.get(ref)?.loading) return;
  state.stashDetails.set(ref, { loading: true });
  try {
    const detail = await api(`/api/stash?ref=${encodeURIComponent(ref)}`);
    state.stashDetails.set(ref, detail);
  } catch (error) {
    state.stashDetails.set(ref, { error: error.message });
  }
  if (state.selectedTab === "stashes" && state.selectedStash === ref) renderInspector();
}

function selectStash(ref) {
  if (!ref || ref === state.selectedStash) return;
  state.selectedStash = ref;
  renderInspector();
}

async function runStashAction(action, ref, button) {
  if (!state.data || !ref) return;
  const names = { apply: "应用储藏", pop: "弹出储藏", drop: "删除储藏", branch: "从储藏创建分支" };
  if (action === "branch") {
    await branchFromStash(ref, button);
    return;
  }
  const message = stashActionConfirmMessage(action, ref);
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: `${action}Stash`, ref }) });
    toast(result.output || `${names[action] || "储藏操作"}完成`);
    state.stashDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.stashes?.some((stash) => stash.ref === state.selectedStash)) {
      state.selectedStash = state.data.stashes?.[0]?.ref || "";
    }
    renderAll();
    if (state.selectedSha && state.selectedTab !== "stashes") {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function branchFromStash(ref, button) {
  const defaultName = defaultStashBranchName(ref);
  const branch = prompt(`从 ${ref} 创建新分支：`, defaultName);
  if (branch === null) return;
  const trimmed = branch.trim();
  if (!trimmed) {
    toast("请填写分支名");
    return;
  }
  const message = [
    `确认从 ${ref} 创建并切换到分支 ${trimmed}？`,
    "",
    "命令：git stash branch <分支> <储藏>",
    "成功后这条储藏会从列表删除，改动会出现在新分支工作区。",
  ].join("\n");
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "branchFromStash", ref, branch: trimmed }),
    });
    toast(result.output || `已从 ${ref} 创建分支 ${trimmed}`);
    state.stashDetails.clear();
    if (result.state) {
      state.data = result.state;
    } else {
      state.data = await api("/api/state");
    }
    state.selectedRef = state.data.repo.branch && state.data.repo.branch !== "detached HEAD" ? state.data.repo.branch : "";
    state.selectedStash = state.data.stashes?.[0]?.ref || "";
    state.selectedTab = "stashes";
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function defaultStashBranchName(ref) {
  const index = String(ref || "").match(/\d+/)?.[0] || "0";
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `stash/${stamp}-${index}`;
}

function stashActionConfirmMessage(action, ref) {
  if (action === "apply") return `确认应用 ${ref}？储藏会保留在列表中。`;
  if (action === "pop") return `确认弹出 ${ref}？成功后这条储藏会从列表删除。`;
  if (action === "drop") return `确认删除 ${ref}？这个操作不能撤销。`;
  return `确认操作 ${ref}？`;
}

function renderSyncTab() {
  const sync = state.data?.sync || {};
  const hasUpstream = Boolean(sync.upstream);
  const upstreamGone = Boolean(sync.upstreamGone);
  const incoming = sync.incoming || [];
  const outgoing = sync.outgoing || [];
  const syncCommits = [...incoming, ...outgoing];
  if (state.selectedSyncSha && !syncCommits.some((commit) => commit.sha === state.selectedSyncSha)) {
    state.selectedSyncSha = "";
    state.selectedSyncFile = "";
  }
  const selectedSyncCommit = state.selectedSyncSha ? syncCommits.find((commit) => commit.sha === state.selectedSyncSha) : null;
  const selectedSyncDetail = selectedSyncCommit ? state.commitDetails.get(selectedSyncCommit.sha) : null;
  if (selectedSyncCommit && !selectedSyncDetail) {
    loadSyncCommitPreview(selectedSyncCommit.sha);
  }
  const previewModel = selectedSyncCommit ? syncPreviewModel(selectedSyncCommit, selectedSyncDetail) : null;
  const remotes = sync.remotes || [];
  const pushGuard = syncPushGuard(sync);
  const pullRequest = sync.pullRequest || {};
  els.detailNode.style.borderColor = upstreamGone ? "var(--danger)" : hasUpstream ? "var(--teal)" : "var(--yellow)";
  els.detailTitle.textContent = "同步详情";
  els.detailSub.textContent = sync.branch ? `${sync.branch}${sync.upstream ? ` -> ${sync.upstream}` : " · 未设置 upstream"}` : "当前分支";
  if (selectedSyncCommit && previewModel?.selectedDiff?.length) {
    const fileLabel = previewModel.selectedFile ? `${selectedSyncCommit.short || selectedSyncCommit.sha.slice(0, 7)} · ${previewModel.selectedFile}` : selectedSyncCommit.message;
    setActiveDiff({ source: "sync", title: `${selectedSyncCommit.short || selectedSyncCommit.sha.slice(0, 7)} · 同步提交`, path: fileLabel, diff: previewModel.selectedDiff, emptyText: "没有可显示的同步改动" });
  } else {
    setActiveDiff(null);
  }
  els.detailBody.innerHTML = `
    <div class="sync-actions">
      <button class="mini-btn" data-sync-action="fetch" type="button"><span>抓取</span><span class="command-hint">git fetch</span></button>
      <button class="mini-btn" data-sync-action="pull" type="button" ${hasUpstream && !upstreamGone ? "" : "disabled"}><span>拉取</span><span class="command-hint">git pull</span></button>
      <button class="mini-btn" data-sync-action="pullRebase" type="button" ${hasUpstream && !upstreamGone ? "" : "disabled"} title="git pull --rebase"><span>变基拉取</span><span class="command-hint">pull --rebase</span></button>
      <button class="mini-btn" data-sync-action="push" type="button" ${pushGuard.blocked ? "disabled" : ""} title="${escapeAttr(pushGuard.title || "git push")}"><span>推送</span><span class="command-hint">git push</span></button>
      <button class="mini-btn danger" data-sync-action="forcePushLease" type="button" ${hasUpstream && !upstreamGone ? "" : "disabled"}><span>安全强推</span><span class="command-hint">--force-with-lease</span></button>
      <button class="mini-btn" data-sync-pr-action="open" type="button" ${pullRequest.available ? "" : "disabled"} title="${escapeAttr(pullRequest.available ? pullRequest.url : pullRequest.reason || "当前分支不能创建 PR")}"><span>${escapeHtml(pullRequest.title || "创建 PR")}</span><span class="command-hint">${escapeHtml(pullRequest.platformLabel || "web")}</span></button>
      <button class="mini-btn" data-sync-pr-action="copy" type="button" ${pullRequest.available ? "" : "disabled"} title="${escapeAttr(pullRequest.available ? pullRequest.url : pullRequest.reason || "当前分支不能创建 PR")}"><span>复制 PR 链接</span><span class="command-hint">copy</span></button>
    </div>
    <div class="meta-grid sync-meta">
      <span>当前分支</span><div class="meta-value">${escapeHtml(sync.branch || state.data?.repo?.branch || "未知")}</div>
      <span>Upstream</span><div class="meta-value">${escapeHtml(sync.upstream || "未设置")}</div>
      <span>同步状态</span><div class="meta-value">${escapeHtml(syncStatusText(sync))}</div>
      <span>建议</span><div class="meta-value">${escapeHtml(syncAdviceText(sync))}</div>
    </div>
    ${syncPushGuardHtml(pushGuard)}
    ${syncPullRequestHtml(pullRequest)}
    <div class="detail-section-title">上游分支</div>
    ${upstreamControlHtml(sync)}
    <div class="sync-section-head">
      <div class="detail-section-title">远端仓库</div>
      <button class="mini-btn" data-remote-action="add" type="button"><span>添加远端</span><span class="command-hint">git remote add</span></button>
    </div>
    ${remoteListHtml(remotes)}
    ${remoteCheckHtml(remotes)}
    ${syncAuthHtml(sync.auth, remotes)}
    <div class="detail-section-title">待拉取提交</div>
    ${syncCommitListHtml(incoming, "远端没有本地缺少的提交")}
    <div class="detail-section-title">待推送提交</div>
    ${syncCommitListHtml(outgoing, "本地没有待推送提交")}
    ${syncCommits.length ? `<div class="detail-section-title">同步提交预览</div>${syncCommitPreviewHtml(selectedSyncCommit, selectedSyncDetail, previewModel)}` : ""}
  `;
  bindFileTree(els.detailBody, { mode: "sync" });
}

function syncStatusText(sync) {
  if (!sync?.upstream) return "未设置 upstream";
  if (sync.upstreamGone) return "上游分支已不存在";
  const ahead = sync.ahead || 0;
  const behind = sync.behind || 0;
  if (ahead && behind) return `分叉：领先 ${ahead}，落后 ${behind}`;
  if (ahead) return `领先 ${ahead}`;
  if (behind) return `落后 ${behind}`;
  return "与上游一致";
}

function syncAdviceText(sync) {
  if (sync?.detached) return "当前处于游离 HEAD，请先切换或创建本地分支。";
  if (!sync?.upstream) return "可以普通推送一次来建立 upstream。";
  if (sync.upstreamGone) return "普通推送已保护。请先抓取远端，确认是否需要重新设置或取消 upstream。";
  const ahead = sync.ahead || 0;
  const behind = sync.behind || 0;
  if (ahead && behind) return "普通推送已保护。请先查看待拉取提交；想保持线性历史时点“变基拉取”，确认要覆盖远端历史时再用安全强推。";
  if (behind) return "普通推送已保护。请先查看待拉取提交；可点“拉取”快进，或点“变基拉取”保持线性历史。";
  if (ahead) return "可以推送；如果改写过远端历史，请使用安全强推。";
  return "不需要同步操作。";
}

function syncPushGuard(sync) {
  if (sync?.detached) {
    return { blocked: true, title: "当前处于游离 HEAD，不能直接推送分支", text: "推送保护：当前处于游离 HEAD，请先切换或创建本地分支。" };
  }
  if (sync?.upstreamGone) {
    const upstream = sync.upstream || "upstream";
    return {
      blocked: true,
      title: `upstream ${upstream} 已不存在`,
      text: `推送保护：${upstream} 已不存在。请抓取远端后重新设置 upstream；如果要重新创建远端分支，先取消 upstream 再推送。`,
    };
  }
  const behind = sync?.behind || 0;
  const ahead = sync?.ahead || 0;
  if (behind > 0) {
    const stateText = ahead ? `本地领先 ${ahead}，同时落后 ${behind}` : `本地落后 ${behind}`;
    return {
      blocked: true,
      title: `${stateText}，普通推送已保护`,
      text: `推送保护：${stateText}。请先检查待拉取提交；通常使用“变基拉取”把本地提交移到远端之后，如果确认要改写远端历史，再使用安全强推。`,
    };
  }
  return { blocked: false, title: "", text: "" };
}

function syncPushGuardHtml(guard) {
  if (!guard?.blocked) return "";
  return `
    <div class="sync-warning">
      <strong>普通推送已保护</strong>
      <span>${escapeHtml(guard.text)}</span>
    </div>
  `;
}

function syncPullRequestHtml(pr = {}) {
  if (!pr.available) {
    return `
      <div class="pr-card pr-card-muted">
        <div class="pr-card-head">
          <strong>Pull Request</strong>
          <span>${escapeHtml(pr.reason || "当前分支暂时不能生成 PR 链接")}</span>
        </div>
      </div>
    `;
  }
  return `
    <div class="pr-card">
      <div class="pr-card-head">
        <div>
          <strong>${escapeHtml(pr.title || "创建 Pull Request")}</strong>
          <span>${escapeHtml(pr.platformLabel || "Web")} · ${escapeHtml(pr.remote || "origin")}</span>
        </div>
        <span class="pr-route" title="${escapeAttr(`${pr.source || ""} -> ${pr.target || ""}`)}">${escapeHtml(pr.source || "")} → ${escapeHtml(pr.target || "")}</span>
      </div>
      <div class="pr-link-row">
        <code title="${escapeAttr(pr.url || "")}">${escapeHtml(pr.url || "")}</code>
        <button class="mini-btn" data-sync-pr-action="copy" type="button">复制</button>
      </div>
    </div>
  `;
}

function upstreamControlHtml(sync) {
  const remoteBranches = upstreamRemoteBranches();
  const selected = selectedUpstreamCandidate(sync, remoteBranches);
  const detached = sync?.detached || sync?.branch === "HEAD" || sync?.branch === "detached HEAD";
  const canSet = remoteBranches.length && !detached;
  const canUnset = Boolean(sync?.upstream) && !detached;
  return `
    <div class="upstream-panel">
      <select class="upstream-select" data-upstream-select ${canSet ? "" : "disabled"}>
        ${remoteBranches.length ? remoteBranches.map((ref) => `<option value="${escapeAttr(ref)}" ${ref === selected ? "selected" : ""}>${escapeHtml(ref)}</option>`).join("") : `<option value="">没有远端分支</option>`}
      </select>
      <div class="upstream-actions">
        <button class="mini-btn" data-upstream-action="set" type="button" ${canSet ? "" : "disabled"}><span>设置 upstream</span><span class="command-hint">git branch -u</span></button>
        <button class="mini-btn" data-upstream-action="unset" type="button" ${canUnset ? "" : "disabled"}><span>取消 upstream</span><span class="command-hint">--unset-upstream</span></button>
      </div>
    </div>
  `;
}

function upstreamRemoteBranches() {
  const remoteNames = state.data?.repo?.remoteNames || [];
  return (state.data?.remotes || [])
    .filter((ref) => ref && !ref.endsWith("/HEAD"))
    .filter((ref) => remoteNames.some((remote) => ref.startsWith(`${remote}/`) && ref.length > remote.length + 1));
}

function selectedUpstreamCandidate(sync, branches) {
  if (sync?.upstream && branches.includes(sync.upstream)) return sync.upstream;
  const branch = sync?.branch || state.data?.repo?.branch || "";
  const originMatch = branch ? branches.find((ref) => ref === `origin/${branch}`) : "";
  if (originMatch) return originMatch;
  const suffixMatch = branch ? branches.find((ref) => ref.endsWith(`/${branch}`)) : "";
  return suffixMatch || branches[0] || "";
}

function syncCommitListHtml(commits, emptyText) {
  if (!commits.length) {
    return `<div class="empty-panel compact"><span>${escapeHtml(emptyText)}</span></div>`;
  }
  return `
    <div class="sync-commit-list">
      ${commits.map((commit) => syncCommitRowHtml(commit)).join("")}
    </div>
  `;
}

function syncCommitRowHtml(commit) {
  const selected = commit.sha === state.selectedSyncSha;
  return `
    <button class="sync-commit-row ${selected ? "selected" : ""}" data-sync-commit="${escapeAttr(commit.sha)}" type="button">
      <span class="sync-commit-message" title="${escapeAttr(commit.message)}">${escapeHtml(commit.message)}</span>
      <span class="sync-commit-meta">${escapeHtml(commit.short || commit.sha.slice(0, 7))} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
    </button>
  `;
}

function syncPreviewModel(commit, detail) {
  const files = detail?.files || [];
  if (!files.length) {
    state.selectedSyncFile = "";
  } else if (!state.selectedSyncFile || !files.some((file) => file.file === state.selectedSyncFile)) {
    state.selectedSyncFile = files[0].file;
  }
  const selectedFile = state.selectedSyncFile;
  const diff = detail?.diff || [];
  const selectedDiff = selectedFile ? diffForFile(diff, selectedFile) : diff;
  return { files, selectedFile, selectedDiff };
}

function syncCommitPreviewHtml(commit, detail, model) {
  if (!commit) {
    return `<div class="empty-panel compact"><span>选择上方提交查看改动</span></div>`;
  }
  if (!detail) {
    return `<div class="empty-panel compact"><span>正在读取 ${escapeHtml(commit.short || commit.sha.slice(0, 7))} 的改动...</span></div>`;
  }
  const files = model?.files || [];
  const selectedFile = model?.selectedFile || "";
  const selectedDiff = model?.selectedDiff || [];
  return `
    <div class="sync-preview">
      <div class="sync-preview-head">
        <strong title="${escapeAttr(commit.message)}">${escapeHtml(commit.message)}</strong>
        <span>${escapeHtml(commit.short || commit.sha.slice(0, 7))} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
      </div>
      <div class="commit-file-view">
        <div class="commit-file-tree sync-preview-files">
          ${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">没有文件列表</span><span></span></div>`}
        </div>
        <div class="commit-file-diff sync-preview-diff">
          <div class="panel-title compact">
            <div class="panel-title-text">
              <span>${escapeHtml(selectedFile ? shortFileName(selectedFile) : commit.short || commit.sha.slice(0, 7))}</span>
              <span class="panel-subtitle">${escapeHtml(selectedFile || "未选择文件")}</span>
            </div>
            <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
          </div>
          ${renderSideDiff(selectedDiff, "没有可显示的同步改动")}
        </div>
      </div>
    </div>
  `;
}

function renderCompareTab() {
  const model = state.compare || {};
  const data = model.data;
  const controls = comparePickerHtml(model);
  els.detailNode.style.borderColor = data ? "var(--blue)" : "var(--line)";
  els.detailTitle.textContent = "分支比较";
  els.detailSub.textContent = model.head ? `${model.base || "HEAD"} ... ${model.head}` : "选择两个引用开始比较";
  if (model.loading) {
    setActiveDiff(null);
    els.detailBody.innerHTML = `${controls}<div class="empty-panel"><strong>正在比较引用</strong><span>${escapeHtml(model.base || "HEAD")} ... ${escapeHtml(model.head || "")}</span></div>`;
    return;
  }
  if (model.error) {
    setActiveDiff(null);
    els.detailBody.innerHTML = `${controls}<div class="empty-panel"><strong>比较失败</strong><span>${escapeHtml(model.error)}</span></div>`;
    return;
  }
  if (!data) {
    setActiveDiff(null);
    els.detailBody.innerHTML = `${controls}<div class="empty-panel"><strong>选择两个引用比较</strong><span>可以输入本地分支、远端分支、Tag 或提交 SHA，也可以继续从分支右键菜单进入。</span></div>`;
    return;
  }
  const files = data.files || [];
  if (state.selectedCompareFile && !files.some((file) => file.file === state.selectedCompareFile)) {
    state.selectedCompareFile = "";
  }
  if (!state.selectedCompareFile && files.length) state.selectedCompareFile = files[0].file;
  const selectedDiff = state.selectedCompareFile ? diffForFile(data.diff || [], state.selectedCompareFile) : data.diff || [];
  if (selectedDiff.length) {
    setActiveDiff({
      source: "compare",
      title: `${data.base} ... ${data.head}`,
      path: state.selectedCompareFile || `${data.baseShort || ""} -> ${data.headShort || ""}`,
      diff: selectedDiff,
      emptyText: "没有可显示的比较改动",
    });
  } else {
    setActiveDiff(null);
  }
  els.detailBody.innerHTML = `
    ${controls}
    <div class="compare-summary">
      <div class="sync-actions compare-actions">
        <button class="mini-btn" data-compare-refresh type="button"><span>刷新比较</span><span class="command-hint">git diff</span></button>
        <button class="mini-btn" data-compare-view-target type="button"><span>查看目标</span><span class="command-hint">${escapeHtml(data.head)}</span></button>
      </div>
      <div class="meta-grid sync-meta">
        <span>当前分支</span><div class="meta-value">${escapeHtml(data.base)} (${escapeHtml(data.baseShort || "")})</div>
        <span>目标分支</span><div class="meta-value">${escapeHtml(data.head)} (${escapeHtml(data.headShort || "")})</div>
        <span>共同祖先</span><div class="meta-value">${escapeHtml(data.mergeBaseShort || "未找到")}</div>
        <span>文件变化</span><div class="meta-value">${escapeHtml(`${files.length} 个文件`)}</div>
      </div>
      <div class="compare-counts">
        <div><span>当前独有</span><strong>${escapeHtml(data.baseOnlyCount || 0)}</strong></div>
        <div><span>目标独有</span><strong>${escapeHtml(data.headOnlyCount || 0)}</strong></div>
      </div>
    </div>
    <div class="compare-commit-columns">
      ${compareCommitListHtml("基准引用独有提交", data.baseOnlyCommits || [], "基准引用没有目标引用缺少的提交")}
      ${compareCommitListHtml("目标引用独有提交", data.headOnlyCommits || [], "目标引用没有基准引用缺少的提交")}
    </div>
    <div class="detail-section-title">目标分支带来的文件改动</div>
    <div class="commit-file-view compare-file-view">
      <div class="commit-file-tree sync-preview-files">
        ${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">没有文件变化</span><span></span></div>`}
      </div>
      <div class="commit-file-diff sync-preview-diff">
        <div class="panel-title compact">
          <div class="panel-title-text">
            <span>${escapeHtml(state.selectedCompareFile ? shortFileName(state.selectedCompareFile) : data.head)}</span>
            <span class="panel-subtitle">${escapeHtml(state.selectedCompareFile || data.command || "")}</span>
          </div>
          <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
        </div>
        ${renderSideDiff(selectedDiff, "没有可显示的比较改动")}
      </div>
    </div>
  `;
  bindFileTree(els.detailBody, { mode: "compare" });
}

function comparePickerHtml(model = {}) {
  const base = model.base || currentCompareBaseRef();
  const head = model.head || "";
  const sameRef = Boolean(base && head && base === head);
  const refs = compareRefOptions([base, head]);
  return `
    <div class="compare-picker">
      <datalist id="compareRefOptions">
        ${refs.map((item) => `<option value="${escapeAttr(item.ref)}" label="${escapeAttr(item.label)}"></option>`).join("")}
      </datalist>
      <label>
        <span>基准引用</span>
        <input data-compare-ref="base" list="compareRefOptions" autocomplete="off" spellcheck="false" value="${escapeAttr(base)}" placeholder="main / HEAD / Tag / SHA" />
      </label>
      <label>
        <span>目标引用</span>
        <input data-compare-ref="head" list="compareRefOptions" autocomplete="off" spellcheck="false" value="${escapeAttr(head)}" placeholder="选择或输入要比较的引用" />
      </label>
      <div class="compare-picker-actions">
        <button class="mini-btn" data-compare-run type="button" ${!base || !head || sameRef ? "disabled" : ""}><span>开始比较</span><span class="command-hint">git diff</span></button>
        <button class="mini-btn" data-compare-swap type="button" ${!base || !head ? "disabled" : ""}>交换</button>
      </div>
    </div>
  `;
}

function compareRefOptions(extraRefs = []) {
  const seen = new Set();
  const items = [];
  const add = (ref, label) => {
    const value = String(ref || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    items.push({ ref: value, label });
  };
  add("HEAD", "当前 HEAD");
  add(state.data?.repo?.branch, "当前分支");
  (state.data?.branches || []).forEach((branch) => add(branch, "本地分支"));
  (state.data?.remotes || []).forEach((branch) => add(branch, "远端分支"));
  (state.data?.tags || []).forEach((tag) => add(tag.name, "Tag"));
  extraRefs.forEach((ref) => add(ref, "当前输入"));
  return items;
}

function comparePickerRefs() {
  const base = els.detailBody.querySelector('[data-compare-ref="base"]')?.value.trim() || "";
  const head = els.detailBody.querySelector('[data-compare-ref="head"]')?.value.trim() || "";
  return { base, head };
}

function updateComparePickerState() {
  const refs = comparePickerRefs();
  state.compare = { ...(state.compare || {}), base: refs.base, head: refs.head };
  const run = els.detailBody.querySelector("[data-compare-run]");
  const swap = els.detailBody.querySelector("[data-compare-swap]");
  const sameRef = Boolean(refs.base && refs.head && refs.base === refs.head);
  if (run) run.disabled = !refs.base || !refs.head || sameRef;
  if (swap) swap.disabled = !refs.base || !refs.head;
}

async function runCompareFromPicker() {
  const { base, head } = comparePickerRefs();
  if (!base || !head) {
    toast("请先填写基准引用和目标引用");
    return;
  }
  if (base === head) {
    toast("基准引用和目标引用相同，不需要比较");
    return;
  }
  await openCompareBranch(head, base);
}

async function swapCompareRefs() {
  const { base, head } = comparePickerRefs();
  if (!base || !head) return;
  const baseInput = els.detailBody.querySelector('[data-compare-ref="base"]');
  const headInput = els.detailBody.querySelector('[data-compare-ref="head"]');
  if (baseInput) baseInput.value = head;
  if (headInput) headInput.value = base;
  updateComparePickerState();
  if (base !== head) await openCompareBranch(base, head);
}

function compareCommitListHtml(title, commits, emptyText) {
  return `
    <section class="compare-commit-list">
      <div class="detail-section-title">${escapeHtml(title)}</div>
      ${
        commits.length
          ? commits.map((commit) => compareCommitRowHtml(commit)).join("")
          : `<div class="empty-panel compact"><span>${escapeHtml(emptyText)}</span></div>`
      }
    </section>
  `;
}

function compareCommitRowHtml(commit) {
  return `
    <button class="sync-commit-row" data-compare-commit="${escapeAttr(commit.sha)}" type="button">
      <span class="sync-commit-message" title="${escapeAttr(commit.message)}">${escapeHtml(commit.message)}</span>
      <span class="sync-commit-meta">${escapeHtml(commit.short || commit.sha?.slice(0, 7) || "")} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
    </button>
  `;
}

function remoteListHtml(remotes) {
  if (!remotes.length) {
    return `<div class="empty-panel compact"><span>还没有配置远端。添加远端后，就可以抓取、拉取和推送。</span></div>`;
  }
  return `
    <div class="remote-list">
      ${remotes.map((remote) => remoteRowHtml(remote)).join("")}
    </div>
  `;
}

function remoteRowHtml(remote) {
  const fetchUrl = remote.fetchUrl || "未设置";
  const pushUrl = remote.pushUrl || remote.fetchUrl || "未设置";
  return `
    <div class="remote-row" data-remote-name="${escapeAttr(remote.name)}">
      <div class="remote-main">
        <strong class="remote-name" title="${escapeAttr(remote.name)}">${escapeHtml(remote.name)}</strong>
        <span class="remote-url" title="${escapeAttr(fetchUrl)}"><em>fetch</em><span>${escapeHtml(fetchUrl)}</span></span>
        <span class="remote-url" title="${escapeAttr(pushUrl)}"><em>push</em><span>${escapeHtml(pushUrl)}</span></span>
      </div>
      <div class="remote-actions">
        <button class="mini-btn" data-remote-action="test" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>诊断</span><span class="command-hint">ls-remote</span></button>
        <button class="mini-btn" data-remote-action="fetch" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>抓取</span><span class="command-hint">git fetch</span></button>
        <button class="mini-btn" data-remote-action="edit" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>修改 URL</span><span class="command-hint">set-url</span></button>
        <button class="mini-btn danger" data-remote-action="delete" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>删除</span><span class="command-hint">remove</span></button>
      </div>
    </div>
  `;
}

function remoteCheckHtml(remotes) {
  const check = state.remoteCheck;
  if (!check?.remote) return "";
  const remote = remotes.find((item) => item.name === check.remote);
  if (!remote) return "";
  const ok = check.status === "success";
  const fetchUrl = check.fetchUrl || remote.fetchUrl || "未设置";
  const pushUrl = check.pushUrl || remote.pushUrl || remote.fetchUrl || "未设置";
  const command = check.command || `git ls-remote --heads ${check.remote}`;
  const output = String(check.output || "").trim();
  const checkedAt = check.checkedAt || "";
  const diagnosis = remoteCheckDiagnosis(check, remote, ok);
  return `
    <section class="remote-check-card ${ok ? "success" : "error"}">
      <div class="remote-check-head">
        <div>
          <strong>${ok ? "远端连接正常" : "远端诊断失败"}</strong>
          <span>${escapeHtml(check.remote)}${checkedAt ? ` · ${escapeHtml(checkedAt)}` : ""}</span>
        </div>
        <span class="remote-check-status">${ok ? "通过" : "失败"}</span>
      </div>
      <div class="meta-grid sync-meta remote-check-meta">
        <span>fetch URL</span><div class="meta-value" title="${escapeAttr(fetchUrl)}">${escapeHtml(fetchUrl)}</div>
        <span>push URL</span><div class="meta-value" title="${escapeAttr(pushUrl)}">${escapeHtml(pushUrl)}</div>
        <span>检查命令</span><div class="meta-value">${escapeHtml(command)}</div>
        ${ok ? `<span>可读分支</span><div class="meta-value">${escapeHtml(String(check.heads ?? "未知"))} 个</div>` : `<span>判断结果</span><div class="meta-value">${escapeHtml(diagnosis.summary)}</div>`}
      </div>
      ${remoteDiagnosisHtml(diagnosis)}
      ${output ? `<pre>${escapeHtml(output)}</pre>` : ""}
    </section>
  `;
}

function syncAuthHtml(auth, remotes = []) {
  if (!auth && !remotes.length) return "";
  const model = auth || {};
  const level = model.level || "info";
  const remoteRows = Array.isArray(model.remotes) ? model.remotes : [];
  const ssh = model.ssh || {};
  const agent = model.agent || {};
  const credential = model.credentialManager || {};
  const keys = Array.isArray(ssh.keys) ? ssh.keys : [];
  const commands = Array.isArray(model.commands) ? model.commands.filter(Boolean) : ["git remote -v"];
  return `
    <section class="auth-card auth-card-${escapeAttr(level)}">
      <div class="auth-card-head">
        <div>
          <strong>认证助手</strong>
          <span>${escapeHtml(model.summary || "检查 SSH key、ssh-agent 和 HTTPS 凭据管理器")}</span>
        </div>
        <span class="auth-status">${escapeHtml(authLevelLabel(level))}</span>
      </div>
      ${model.advice ? `<p class="auth-advice">${escapeHtml(model.advice)}</p>` : ""}
      <div class="auth-remote-list">
        ${
          remoteRows.length
            ? remoteRows.map((remote) => authRemotePillHtml(remote)).join("")
            : `<span class="auth-pill muted">没有远端</span>`
        }
      </div>
      <div class="auth-grid">
        <div class="auth-box">
          <strong>SSH key</strong>
          <span>${escapeHtml(ssh.message || (ssh.exists ? "已读取 ~/.ssh" : "没有读取到 ~/.ssh"))}</span>
          <div class="auth-key-list">
            ${
              keys.length
                ? keys.map((key) => authKeyHtml(key)).join("")
                : `<em>未发现常见 key 文件</em>`
            }
          </div>
        </div>
        <div class="auth-box">
          <strong>认证工具</strong>
          <span>${escapeHtml(agent.message || "ssh-agent 未检测")}</span>
          <span>${escapeHtml(credential.message || "Git Credential Manager 未检测")}</span>
          <span>${escapeHtml(ssh.configExists ? "存在 SSH config" : "未发现 SSH config")} · ${escapeHtml(ssh.knownHostsExists ? "存在 known_hosts" : "未发现 known_hosts")}</span>
        </div>
      </div>
      <div class="remote-diagnosis-commands auth-commands">
        ${commands.map((cmd) => `<button class="remote-command-copy" data-copy-remote-command="${escapeAttr(cmd)}" type="button" title="复制命令"><span>${escapeHtml(cmd)}</span><em>复制</em></button>`).join("")}
      </div>
    </section>
  `;
}

function authLevelLabel(level) {
  if (level === "ok") return "正常";
  if (level === "warn") return "注意";
  return "提示";
}

function authRemotePillHtml(remote) {
  const kind = remote.kind || "missing";
  const title = [remote.name, remote.url, remote.host].filter(Boolean).join(" · ");
  return `<span class="auth-pill auth-${escapeAttr(kind)}" title="${escapeAttr(title)}"><strong>${escapeHtml(remote.name || "remote")}</strong><em>${escapeHtml(remote.kindLabel || kind)}</em>${remote.host ? `<small>${escapeHtml(remote.host)}</small>` : ""}</span>`;
}

function authKeyHtml(key) {
  const status = key.privateKey && key.publicKey ? "完整" : key.privateKey ? "缺 .pub" : "仅公钥";
  const file = key.privateFile || key.publicFile || key.name || "";
  return `<span class="auth-key" title="${escapeAttr([key.privateFile, key.publicFile, key.updated].filter(Boolean).join(" · "))}"><code>${escapeHtml(file)}</code><em>${escapeHtml(status)}</em></span>`;
}

function remoteDiagnosisHtml(diagnosis) {
  const steps = Array.isArray(diagnosis.steps) ? diagnosis.steps.filter(Boolean) : [];
  const commands = Array.isArray(diagnosis.commands) ? diagnosis.commands.filter(Boolean) : [];
  return `
    <div class="remote-diagnosis remote-diagnosis-${escapeAttr(diagnosis.category || "unknown")}">
      <div class="remote-diagnosis-title">
        <strong>${escapeHtml(diagnosis.title || "排查向导")}</strong>
        <span>${escapeHtml(diagnosis.categoryLabel || remoteDiagnosisCategoryLabel(diagnosis.category))}</span>
      </div>
      ${steps.length ? `<ol class="remote-diagnosis-steps">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : ""}
      ${
        commands.length
          ? `<div class="remote-diagnosis-commands">${commands.map((cmd) => `<button class="remote-command-copy" data-copy-remote-command="${escapeAttr(cmd)}" type="button" title="复制命令"><span>${escapeHtml(cmd)}</span><em>复制</em></button>`).join("")}</div>`
          : ""
      }
    </div>
  `;
}

function remoteCheckDiagnosis(check, remote, ok) {
  if (check?.diagnosis) return check.diagnosis;
  const output = String(check?.output || "").toLowerCase();
  const url = `${remote?.fetchUrl || ""} ${remote?.pushUrl || ""}`.toLowerCase();
  const commands = [`git remote -v`, check?.command || `git ls-remote --heads ${check?.remote || remote?.name || "origin"}`];
  if (ok) {
    return {
      category: "ok",
      title: "远端读取正常",
      summary: `Forkline 已能读取 ${check?.heads ?? "未知"} 个远端分支，URL 和读取权限基本正常。`,
      steps: ["可以继续抓取、拉取或推送。", "如果推送失败，再查看同步页的保护提示和右侧日志。"],
      commands,
    };
  }
  if (output.includes("ssh") || output.includes("publickey") || url.startsWith("git@") || url.includes("ssh://")) {
    return {
      category: "ssh",
      title: "SSH 凭据或主机认证",
      summary: "当前远端像是 SSH 连接失败，常见原因是 SSH key 没添加到平台、ssh-agent 没加载 key，或远端 URL 指向了错误账号。",
      steps: ["确认远端 URL 没写错。", "在终端执行 ssh -T 对应 Git 主机，确认当前系统账号能通过平台认证。", "如果不想处理 SSH，可以把远端 URL 改成 HTTPS。"],
      commands: [...commands, "ssh-add -l"],
    };
  }
  if (output.includes("token") || output.includes("https") || output.includes("认证") || output.includes("authentication") || url.startsWith("http")) {
    return {
      category: "https",
      title: "HTTPS 凭据或 Token",
      summary: "当前远端像是 HTTPS 登录失败，常见原因是凭据管理器里的旧密码，或 Personal Access Token 过期/权限不足。",
      steps: ["确认远端 URL 是目标仓库的 HTTPS 地址。", "检查 Windows 凭据管理器或 Git Credential Manager 中保存的账号和 Token。", "重新生成 Token 后再诊断连接。"],
      commands: [...commands, "git credential-manager diagnose"],
    };
  }
  if (output.includes("dns") || output.includes("主机名") || output.includes("网络") || output.includes("连接") || output.includes("resolve") || output.includes("timeout")) {
    return {
      category: "network",
      title: "网络或 DNS",
      summary: "当前远端像是网络访问失败，常见原因是 URL 主机写错、DNS、代理、VPN 或防火墙。",
      steps: ["检查远端 URL 的主机名。", "确认当前网络、代理、VPN 或公司网络策略允许访问这个 Git 主机。", "网络恢复后重新诊断。"],
      commands: [...commands, "git config --get http.proxy"],
    };
  }
  if (output.includes("does not appear") || output.includes("no such remote") || output.includes("无法读取") || output.includes("unable to access")) {
    return {
      category: "url",
      title: "远端 URL 或仓库路径",
      summary: "远端地址不可用。可能是本地裸仓库路径不存在、URL 写错，或这个地址不是 Git 仓库。",
      steps: ["复制远端 URL 到浏览器或终端确认它真实存在。", "如果是本地路径远端，确认磁盘路径仍然存在且是 Git 仓库。", "在同步页修改 URL 后重新诊断。"],
      commands: [...commands, `git remote get-url ${check?.remote || remote?.name || "origin"}`],
    };
  }
  if (output.includes("不存在") || output.includes("not found") || output.includes("权限")) {
    return {
      category: "permission",
      title: "仓库地址或访问权限",
      summary: "远端仓库可能不存在、已改名，或当前账号没有私有仓库/组织权限。",
      steps: ["核对远端 URL 中的用户名、组织名和仓库名。", "确认当前账号拥有读取这个仓库的权限。", "如果仓库已迁移或改名，在同步页修改 URL 后重新诊断。"],
      commands: [...commands, `git remote get-url ${check?.remote || remote?.name || "origin"}`],
    };
  }
  return {
    category: "unknown",
    title: "需要继续排查",
    summary: "Forkline 没能把这次失败归到常见类型。先保留 Git 原始输出，再从 URL、网络和认证三条线排查。",
    steps: ["核对远端 URL。", "确认网络和代理可访问 Git 主机。", "确认当前系统账号或 Token 有仓库读取权限。"],
    commands,
  };
}

function remoteDiagnosisCategoryLabel(category) {
  const labels = {
    ok: "正常",
    ssh: "SSH",
    https: "HTTPS",
    permission: "权限",
    network: "网络",
    certificate: "证书",
    url: "URL",
    unknown: "未分类",
  };
  return labels[category] || "诊断";
}

function remoteCheckTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function renderTagsTab() {
  const tags = state.data?.tags || [];
  if (state.selectedTag && !tags.some((tag) => tag.name === state.selectedTag)) {
    state.selectedTag = "";
  }
  if (!state.selectedTag && tags.length) state.selectedTag = tags[0].name;
  const selected = tags.find((tag) => tag.name === state.selectedTag);
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = "标签列表";
  els.detailSub.textContent = tags.length ? `${tags.length} 个 Tag` : "没有 Tag";
  setActiveDiff(null);
  if (!tags.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有 Tag</strong>
        <span>在提交右键菜单中选择“创建 Tag”后会显示在这里。</span>
      </div>
    `;
    return;
  }
  els.detailBody.innerHTML = `
    <div class="tag-layout">
      <div class="tag-list">
        ${tags.map((tag) => tagRowHtml(tag, tag.name === state.selectedTag)).join("")}
      </div>
      <div class="tag-detail">
        ${selected ? tagDetailHtml(selected) : ""}
      </div>
    </div>
  `;
}

function tagRowHtml(tag, active) {
  return `
    <button class="tag-row ${active ? "active" : ""}" data-tag-name="${escapeAttr(tag.name)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(tag.name)}</strong>
        <em>${escapeHtml(tag.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || "无说明")}</span>
      <span class="stash-branch">${escapeHtml(tag.object ? `${tag.object} · ${tag.type || "commit"}` : tag.type || "commit")}</span>
    </button>
  `;
}

function tagDetailHtml(tag) {
  return `
    <div class="tag-actions">
      <button class="mini-btn" data-tag-action="view" data-tag-name="${escapeAttr(tag.name)}" type="button">查看提交</button>
      <button class="mini-btn" data-tag-action="copy" data-tag-name="${escapeAttr(tag.name)}" type="button">复制名称</button>
      <button class="mini-btn" data-tag-action="push" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> refs/tags/${escapeAttr(tag.name)}:refs/tags/${escapeAttr(tag.name)}">推送 Tag</button>
      <button class="mini-btn danger" data-tag-action="deleteLocal" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git tag -d ${escapeAttr(tag.name)}">删除本地</button>
      <button class="mini-btn danger" data-tag-action="deleteRemote" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> :refs/tags/${escapeAttr(tag.name)}">删除远端</button>
    </div>
    <div class="meta-grid stash-meta">
      <span>名称</span><div class="meta-value">${escapeHtml(tag.name)}</div>
      <span>对象</span><div class="meta-value">${escapeHtml(tag.object || "未知")}</div>
      <span>类型</span><div class="meta-value">${escapeHtml(tag.type || "commit")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(tag.time || "未知")}</div>
      <span>说明</span><div class="meta-value" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || "无说明")}</div>
    </div>
    <div class="empty-panel compact">
      <span>推送 Tag 会把这个本地标签发布到远端；删除远端 Tag 不会删除本地 Tag。</span>
    </div>
  `;
}

function selectTag(name) {
  if (!name || name === state.selectedTag) return;
  state.selectedTag = name;
  renderInspector();
}

function renderRecoveryTab() {
  const points = state.data?.recoveryPoints || [];
  const filteredPoints = filteredRecoveryPoints(points);
  if (state.selectedRecoveryRef && !points.some((point) => point.ref === state.selectedRecoveryRef)) {
    state.selectedRecoveryRef = "";
  }
  if (state.selectedRecoveryRef && !filteredPoints.some((point) => point.ref === state.selectedRecoveryRef)) {
    state.selectedRecoveryRef = "";
  }
  if (!state.selectedRecoveryRef && filteredPoints.length) state.selectedRecoveryRef = filteredPoints[0].ref;
  const selected = filteredPoints.find((point) => point.ref === state.selectedRecoveryRef);
  els.detailNode.style.borderColor = "var(--purple)";
  els.detailTitle.textContent = "恢复点";
  els.detailSub.textContent = points.length ? `${filteredPoints.length} / ${points.length} 个可恢复位置` : "没有恢复点";
  setActiveDiff(null);
  if (!points.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有恢复点</strong>
        <span>执行变基、追加、历史编辑或重置前，Forkline 会自动在这里留下恢复点。</span>
      </div>
    `;
    return;
  }
  els.detailBody.innerHTML = `
    <div class="recovery-layout">
      ${recoveryFilterHtml(points, filteredPoints)}
      ${recoveryRetentionHtml(points)}
      <div class="recovery-list">
        ${
          filteredPoints.length
            ? filteredPoints.map((point) => recoveryRowHtml(point, point.ref === state.selectedRecoveryRef)).join("")
            : `<div class="empty-panel compact"><span>没有匹配的恢复点。可以调整搜索、分支或动作筛选。</span></div>`
        }
      </div>
      <div class="recovery-detail">
        ${selected ? recoveryDetailHtml(selected) : `<div class="empty-panel compact"><span>选择一个恢复点查看详情。</span></div>`}
      </div>
    </div>
  `;
}

function recoveryRetentionHtml(points) {
  const policy = normalizedRecoveryPolicy();
  const plan = recoveryRetentionPlan(points, policy);
  const active = recoveryPolicyActive(policy);
  const buttonText = !active ? "设置策略" : plan.deleteCount ? "按策略清理" : "无需清理";
  const summary = active
    ? `将清理 ${plan.deleteCount} 个，保留 ${plan.keepCount} 个`
    : `当前共有 ${points.length} 个恢复点`;
  return `
    <section class="recovery-retention">
      <div class="recovery-retention-head">
        <strong>保留策略</strong>
        <span>${escapeHtml(summary)}</span>
      </div>
      <div class="recovery-retention-grid">
        <label class="recovery-retention-rule">
          <span>保留最近</span>
          <input data-recovery-policy="keepDays" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.keepDays)}" />
          <em>天</em>
        </label>
        <label class="recovery-retention-rule">
          <span>每分支</span>
          <input data-recovery-policy="maxPerBranch" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.maxPerBranch)}" />
          <em>个</em>
        </label>
      </div>
      <div class="recovery-retention-actions">
        <span>${escapeHtml(recoveryPolicyLabel(policy) || "策略未启用")}</span>
        <button class="mini-btn danger" data-recovery-prune type="button" ${active && plan.deleteCount ? "" : "disabled"}>
          <span>${buttonText}</span><span class="command-hint">update-ref -d</span>
        </button>
      </div>
      ${recoveryRetentionPreviewHtml(plan, active)}
    </section>
  `;
}

function recoveryRetentionPreviewHtml(plan, active) {
  if (!active || !plan.deleteCount) return "";
  const preview = plan.deletePoints.slice(0, 6);
  const extra = Math.max(0, plan.deleteCount - preview.length);
  return `
    <div class="recovery-retention-preview">
      <div class="recovery-retention-preview-head">
        <strong>将清理</strong>
        <span>${escapeHtml(`${plan.deleteCount} 个候选`)}</span>
      </div>
      <div class="recovery-retention-preview-list">
        ${preview.map(recoveryRetentionPreviewRow).join("")}
      </div>
      ${extra ? `<div class="recovery-retention-more">另有 ${escapeHtml(String(extra))} 个恢复点也会被清理</div>` : ""}
    </div>
  `;
}

function recoveryRetentionPreviewRow(point) {
  return `
    <div class="recovery-retention-preview-row">
      <strong title="${escapeAttr(point.actionLabel || point.action || "恢复点")}">${escapeHtml(point.actionLabel || point.action || "恢复点")}</strong>
      <span title="${escapeAttr(point.branch || "HEAD")}">${escapeHtml(point.branch || "HEAD")}</span>
      <em title="${escapeAttr(point.shortRef || point.ref || "")}">${escapeHtml(point.short || point.sha?.slice(0, 7) || point.shortRef || "")}</em>
      <small>${escapeHtml(point.time || "")}</small>
    </div>
  `;
}

function recoveryFilterHtml(points, filteredPoints) {
  const filter = state.recoveryFilter || {};
  const branches = uniqueSorted(points.map((point) => point.branch || "HEAD"));
  const actions = uniqueRecoveryActions(points);
  const active = recoveryFilterActive();
  const deleteText = filteredPoints.length === points.length ? "删除全部" : "删除筛选结果";
  return `
    <div class="recovery-filterbar">
      <input data-recovery-filter="query" autocomplete="off" placeholder="搜索恢复点、提交、分支" value="${escapeAttr(filter.query || "")}" />
      <select data-recovery-filter="branch">
        <option value="">全部分支</option>
        ${branches.map((branch) => `<option value="${escapeAttr(branch)}" ${branch === filter.branch ? "selected" : ""}>${escapeHtml(branch)}</option>`).join("")}
      </select>
      <select data-recovery-filter="action">
        <option value="">全部动作</option>
        ${actions.map((item) => `<option value="${escapeAttr(item.value)}" ${item.value === filter.action ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <div class="recovery-filter-actions">
        <button class="mini-btn" data-recovery-filter-reset type="button" ${active ? "" : "disabled"}>重置</button>
        <button class="mini-btn danger" data-recovery-bulk-delete type="button" ${filteredPoints.length ? "" : "disabled"}>
          <span>${deleteText}</span><span class="command-hint">update-ref -d</span>
        </button>
      </div>
      <div class="recovery-filter-count">${escapeHtml(`显示 ${filteredPoints.length} / ${points.length} 个恢复点`)}</div>
    </div>
  `;
}

function filteredRecoveryPoints(points = state.data?.recoveryPoints || []) {
  const filter = state.recoveryFilter || {};
  const query = String(filter.query || "").trim().toLowerCase();
  return points.filter((point) => {
    if (filter.branch && (point.branch || "HEAD") !== filter.branch) return false;
    if (filter.action && recoveryActionValue(point) !== filter.action) return false;
    if (!query) return true;
    return recoverySearchText(point).includes(query);
  });
}

function recoveryFilterActive() {
  const filter = state.recoveryFilter || {};
  return Boolean(filter.query || filter.branch || filter.action);
}

function recoverySearchText(point) {
  return [
    point.ref,
    point.shortRef,
    point.sha,
    point.short,
    point.subject,
    point.branch,
    point.action,
    point.actionLabel,
    point.time,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueRecoveryActions(points) {
  const seen = new Map();
  points.forEach((point) => {
    const value = recoveryActionValue(point);
    if (!value || seen.has(value)) return;
    seen.set(value, point.actionLabel || value);
  });
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

function recoveryActionValue(point) {
  return point.action || point.actionLabel || "";
}

function defaultRecoveryPolicy() {
  const fallback = { keepDays: "90", maxPerBranch: "50" };
  try {
    const stored = JSON.parse(localStorage.getItem(recoveryPolicyStorageKey) || "{}");
    return {
      keepDays: recoveryPolicyInputValue(stored.keepDays, fallback.keepDays),
      maxPerBranch: recoveryPolicyInputValue(stored.maxPerBranch, fallback.maxPerBranch),
    };
  } catch {
    return fallback;
  }
}

function recoveryPolicyInputValue(value, fallback = "") {
  const raw = value ?? fallback ?? "";
  return String(raw).replace(/[^\d]/g, "").slice(0, 4);
}

function saveRecoveryPolicyPreference() {
  try {
    localStorage.setItem(recoveryPolicyStorageKey, JSON.stringify({
      keepDays: state.recoveryPolicy?.keepDays || "",
      maxPerBranch: state.recoveryPolicy?.maxPerBranch || "",
    }));
  } catch {
  }
}

function normalizedRecoveryPolicy() {
  const raw = state.recoveryPolicy || {};
  return {
    keepDays: boundedRecoveryPolicyNumber(raw.keepDays, 3650),
    maxPerBranch: boundedRecoveryPolicyNumber(raw.maxPerBranch, 500),
  };
}

function boundedRecoveryPolicyNumber(value, max) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const number = Number.parseInt(text, 10);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, max);
}

function recoveryPolicyActive(policy = normalizedRecoveryPolicy()) {
  return Boolean(policy.keepDays || policy.maxPerBranch);
}

function recoveryRetentionPlan(points, policy = normalizedRecoveryPolicy(), now = Date.now()) {
  const deleteRefs = new Set();
  if (policy.keepDays) {
    const threshold = now - policy.keepDays * 24 * 60 * 60 * 1000;
    points.forEach((point) => {
      const timeMs = recoveryPointTimeMs(point);
      if (timeMs && timeMs < threshold) deleteRefs.add(point.ref);
    });
  }
  if (policy.maxPerBranch) {
    const groups = new Map();
    points.forEach((point) => {
      const branch = point.branch || "HEAD";
      groups.set(branch, [...(groups.get(branch) || []), point]);
    });
    groups.forEach((group) => {
      group
        .sort((a, b) => recoveryPointTimeMs(b) - recoveryPointTimeMs(a) || String(b.ref).localeCompare(String(a.ref)))
        .slice(policy.maxPerBranch)
        .forEach((point) => deleteRefs.add(point.ref));
    });
  }
  const deletePoints = points.filter((point) => deleteRefs.has(point.ref));
  return {
    deletePoints,
    deleteCount: deletePoints.length,
    keepCount: Math.max(0, points.length - deletePoints.length),
  };
}

function recoveryPointTimeMs(point) {
  const timestamp = point?.timestamp || String(point?.shortRef || "").split("/")[0];
  const match = String(timestamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) return 0;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).getTime();
}

function recoveryPolicyLabel(policy = normalizedRecoveryPolicy()) {
  return [
    policy.keepDays ? `保留最近 ${policy.keepDays} 天` : "",
    policy.maxPerBranch ? `每个分支保留 ${policy.maxPerBranch} 个` : "",
  ]
    .filter(Boolean)
    .join("；");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function recoveryRowHtml(point, active) {
  return `
    <button class="recovery-row ${active ? "active" : ""}" data-recovery-ref="${escapeAttr(point.ref)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(point.actionLabel || "恢复点")}</strong>
        <em>${escapeHtml(point.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(point.shortRef)}">${escapeHtml(point.shortRef)}</span>
      <span class="stash-branch">${escapeHtml(`${point.short || ""} · ${point.branch || "HEAD"}`)}</span>
    </button>
  `;
}

function recoveryDetailHtml(point) {
  return `
    <div class="recovery-actions">
      <button class="mini-btn" data-recovery-action="restore" data-recovery-ref="${escapeAttr(point.ref)}" type="button"><span>恢复到此处</span><span class="command-hint">reset --hard</span></button>
      <button class="mini-btn danger" data-recovery-action="delete" data-recovery-ref="${escapeAttr(point.ref)}" type="button"><span>删除恢复点</span><span class="command-hint">update-ref -d</span></button>
    </div>
    <div class="meta-grid stash-meta">
      <span>提交</span><div class="meta-value">${escapeHtml(point.short || point.sha || "未知")}</div>
      <span>动作</span><div class="meta-value">${escapeHtml(point.actionLabel || point.action || "危险操作前")}</div>
      <span>分支</span><div class="meta-value">${escapeHtml(point.branch || "HEAD")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(point.time || "未知")}</div>
      <span>引用</span><div class="meta-value" title="${escapeAttr(point.ref)}">${escapeHtml(point.shortRef || point.ref)}</div>
    </div>
    <div class="empty-panel compact">
      <span>恢复会执行 git reset --hard 到这个恢复点。恢复前 Forkline 会再创建一个新的恢复点，方便撤回这次恢复。</span>
    </div>
  `;
}

function renderLogsTab() {
  const logs = state.data?.operationLog || [];
  const running = state.data?.runningOperations || [];
  els.detailTitle.textContent = "操作日志";
  els.detailSub.textContent = running.length
    ? `${running.length} 个 Git 操作正在执行`
    : logs.length
      ? `最近 ${logs.length} 条 Git 操作`
      : "还没有执行过 Git 操作";
  els.detailNode.style.borderColor = running.length || logs.some((item) => item.status === "error") ? "var(--amber)" : "var(--teal)";
  setActiveDiff(null);
  els.detailBody.innerHTML = `
    <div class="logs-toolbar">
      <div>
        <strong>最近操作</strong>
        <span>成功、失败、耗时和 Git 输出摘要</span>
      </div>
      <button class="mini-btn" data-log-refresh type="button">刷新</button>
    </div>
    ${
      running.length
        ? `<section class="running-log-section">
            <div class="running-log-title">进行中</div>
            <div class="operation-log-list">${running.map(renderRunningOperationItem).join("")}</div>
          </section>`
        : ""
    }
    <div class="operation-log-list">
      ${
        logs.length
          ? logs.map(renderOperationLogItem).join("")
          : `<div class="log-empty">执行抓取、提交、切换、合并、储藏等操作后，会在这里显示结果。</div>`
      }
    </div>
  `;
}

function renderRunningOperationItem(item) {
  const duration = item.elapsed || formatDurationText(item.durationMs);
  return `
    <article class="operation-log-item running">
      <div class="operation-log-head">
        <span class="log-status">进行中</span>
        <strong title="${escapeAttr(item.label || "")}">${escapeHtml(item.label || "Git 操作")}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.startedTime || "")}</span>
        <code>${escapeHtml(item.action || "")}</code>
      </div>
      <pre>这个操作还在执行。若长时间没有结束，请检查认证窗口、网络状态、index.lock 或其他 Git 进程。</pre>
    </article>
  `;
}

function renderOperationLogItem(item) {
  const ok = item.status === "success";
  const label = ok ? "成功" : "失败";
  const duration = formatDurationText(item.durationMs);
  const summary = String(item.summary || (ok ? "操作已完成" : "操作失败")).trim();
  return `
    <article class="operation-log-item ${ok ? "success" : "error"}">
      <div class="operation-log-head">
        <span class="log-status">${label}</span>
        <strong title="${escapeAttr(item.label || "")}">${escapeHtml(item.label || "Git 操作")}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.time || "")}</span>
        <code>${escapeHtml(item.action || "")}</code>
      </div>
      <pre>${escapeHtml(summary)}</pre>
    </article>
  `;
}

function formatDurationText(ms) {
  const value = Math.max(0, Number(ms) || 0);
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  return `${Math.round(seconds / 60)}min`;
}

async function refreshLogsTab() {
  if (!state.data) return;
  state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
  state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  renderInspector();
}

function selectRecoveryPoint(ref) {
  if (!ref || ref === state.selectedRecoveryRef) return;
  state.selectedRecoveryRef = ref;
  renderInspector();
}

function updateRecoveryFilter(key, value, input) {
  if (!["query", "branch", "action"].includes(key)) return;
  state.recoveryFilter = { ...(state.recoveryFilter || {}), [key]: value };
  renderInspector();
  if (input && key === "query") {
    const cursor = input.selectionStart ?? value.length;
    requestAnimationFrame(() => {
      const next = els.detailBody.querySelector('[data-recovery-filter="query"]');
      if (!next) return;
      next.focus();
      next.setSelectionRange(cursor, cursor);
    });
  }
}

function resetRecoveryFilter() {
  state.recoveryFilter = { query: "", branch: "", action: "" };
  renderInspector();
}

function updateRecoveryPolicy(key, value, input) {
  if (!["keepDays", "maxPerBranch"].includes(key)) return;
  const cleanValue = recoveryPolicyInputValue(value);
  state.recoveryPolicy = { ...(state.recoveryPolicy || {}), [key]: cleanValue };
  saveRecoveryPolicyPreference();
  renderInspector();
  if (input) {
    const cursor = Math.min(input.selectionStart ?? cleanValue.length, cleanValue.length);
    requestAnimationFrame(() => {
      const next = els.detailBody.querySelector(`[data-recovery-policy="${key}"]`);
      if (!next) return;
      next.focus();
      next.setSelectionRange(cursor, cursor);
    });
  }
}

async function pruneRecoveryPointsByPolicy(button) {
  if (!state.data) return;
  const policy = normalizedRecoveryPolicy();
  if (!recoveryPolicyActive(policy)) {
    toast("请先设置恢复点保留策略。");
    return;
  }
  const plan = recoveryRetentionPlan(state.data.recoveryPoints || [], policy);
  if (!plan.deleteCount) {
    toast("当前没有需要清理的恢复点。");
    return;
  }
  const message = [
    `确认按保留策略清理 ${plan.deleteCount} 个恢复点？`,
    "",
    recoveryPolicyLabel(policy),
    `保留：${plan.keepCount} 个`,
    "命令：git update-ref -d <恢复点引用>",
    "",
    "删除后不能再通过 Forkline 恢复到这些引用。",
  ].join("\n");
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "pruneRecoveryPoints", keepDays: policy.keepDays, maxPerBranch: policy.maxPerBranch }),
    });
    toast(result.output || "恢复点清理完成");
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedRecoveryRef = filteredRecoveryPoints()[0]?.ref || "";
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteFilteredRecoveryPoints(button) {
  if (!state.data) return;
  const points = filteredRecoveryPoints();
  if (!points.length) {
    toast("当前筛选结果没有可删除的恢复点");
    return;
  }
  const filter = state.recoveryFilter || {};
  const conditions = [
    filter.query ? `搜索：${filter.query}` : "",
    filter.branch ? `分支：${filter.branch}` : "",
    filter.action ? `动作：${points[0]?.actionLabel || filter.action}` : "",
  ].filter(Boolean);
  const scopeText = conditions.length ? conditions.join("\n") : "未设置筛选，将删除当前全部恢复点";
  const message = `确认删除当前列表里的 ${points.length} 个恢复点？\n\n${scopeText}\n\n命令：git update-ref -d <恢复点引用>\n\n删除后不能再通过 Forkline 恢复到这些引用。`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteRecoveryPoints", refs: points.map((point) => point.ref) }) });
    toast(result.output || "恢复点已删除");
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedRecoveryRef = filteredRecoveryPoints()[0]?.ref || "";
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRecoveryAction(action, ref, button) {
  if (!state.data || !ref) return;
  const point = (state.data.recoveryPoints || []).find((item) => item.ref === ref);
  if (!point) {
    toast("恢复点已经不存在，请刷新后再试");
    return;
  }
  const message =
    action === "restore"
      ? `确认恢复当前分支到这个恢复点？\n\n恢复点：${point.shortRef}\n提交：${point.short || point.sha}\n命令：git reset --hard ${point.ref}\n\n这会移动当前分支并覆盖工作区。Forkline 会在恢复前再自动创建一个恢复点。`
      : `确认删除这个恢复点？\n\n${point.shortRef}\n\n删除后不能再通过 Forkline 恢复到这个引用。`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const apiAction = action === "restore" ? "restoreRecoveryPoint" : "deleteRecoveryPoint";
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: apiAction, ref }) });
    toast(result.output || "恢复点操作完成");
    state.commitDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.recoveryPoints?.some((item) => item.ref === state.selectedRecoveryRef)) {
      state.selectedRecoveryRef = state.data.recoveryPoints?.[0]?.ref || "";
    }
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha && state.selectedTab !== "recovery") {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runTagAction(action, tagName, button) {
  if (!state.data || !tagName) return;
  const tag = (state.data.tags || []).find((item) => item.name === tagName) || { name: tagName };
  if (action === "view") {
    state.selectedTab = "details";
    await selectRef(tag.name);
    return;
  }
  if (action === "copy") {
    await copyText(tag.name);
    toast("已复制 Tag 名称");
    return;
  }
  const message = tagActionConfirmMessage(action, tag.name);
  if (!state.data.repo.isSample && !confirm(message)) return;
  const actionMap = {
    push: "pushTag",
    deleteLocal: "deleteTag",
    deleteRemote: "deleteRemoteTag",
  };
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: actionMap[action], name: tag.name }) });
    toast(result.output || "Tag 操作完成");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.tags?.some((item) => item.name === state.selectedTag)) {
      state.selectedTag = state.data.tags?.[0]?.name || "";
    }
    renderAll();
    if (state.selectedSha && state.selectedTab !== "tags") {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function tagActionConfirmMessage(action, name) {
  if (action === "push") return `确认推送 Tag：${name}？\n\n命令：git push <远端> refs/tags/${name}:refs/tags/${name}`;
  if (action === "deleteLocal") return `确认删除本地 Tag：${name}？\n\n命令：git tag -d ${name}\n此操作不会删除远端 Tag。`;
  if (action === "deleteRemote") return `确认删除远端 Tag：${name}？\n\n命令：git push <远端> :refs/tags/${name}\n此操作不会删除本地 Tag。`;
  return `确认操作 Tag：${name}？`;
}

function renderDiff(diff) {
  if (!diff?.length) return `<div class="diff"><div class="diff-line"><span class="ln">1</span><code>没有可显示的 Diff</code></div></div>`;
  return `
    <div class="diff">
      ${diff
        .map(
          (line, index) => `
          <div class="diff-line ${line.type}">
            <span class="ln">${index + 1}</span>
            <code>${escapeHtml(line.text)}</code>
          </div>`
        )
        .join("")}
    </div>
  `;
}

function fileTreeHtml(files, options = {}) {
  const root = { dirs: new Map(), files: [] };
  files.forEach((file) => addFileToTree(root, file));
  return `<div class="file-tree">${treeNodeHtml(root, 0, options)}</div>`;
}

function addFileToTree(root, file) {
  const raw = String(file.file || "");
  const normalized = raw.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const leaf = parts.pop() || normalized || "未知文件";
  let node = root;
  parts.forEach((part) => {
    if (!node.dirs.has(part)) node.dirs.set(part, { name: part, dirs: new Map(), files: [] });
    node = node.dirs.get(part);
  });
  node.files.push({ ...file, raw, leaf });
}

function treeNodeHtml(node, depth, options = {}) {
  const dirs = [...node.dirs.values()]
    .map(
      (dir) => `
        <div class="tree-group" style="--depth:${depth}">
          <button class="tree-head" type="button">
            <span class="tree-caret"></span>
            <span class="tree-folder" title="${escapeAttr(dir.name)}">${escapeHtml(dir.name)}</span>
            <span class="tree-count">${treeFileCount(dir)}</span>
          </button>
          <div class="tree-children">${treeNodeHtml(dir, depth + 1, options)}</div>
        </div>
      `
    )
    .join("");
  const rows = node.files.map((file) => fileLeafRowHtml(file, depth, options)).join("");
  return `${dirs}${rows}`;
}

function treeFileCount(node) {
  return [...node.dirs.values()].reduce((total, dir) => total + treeFileCount(dir), node.files.length);
}

function fileLeafRowHtml(file, depth, options = {}) {
  const selectionScope = options.selectionScope || "";
  const selected = selectionScope && state.selectedChanges.has(changeKey(selectionScope, file.raw));
  const conflict = Boolean(file.conflict);
  return `
    <button class="file-row leaf-row ${selected ? "multi-selected" : ""} ${conflict ? "conflict" : ""}" type="button" data-select-file data-scope="${escapeAttr(selectionScope)}" data-file="${escapeAttr(file.raw)}" style="--depth:${depth}" title="${escapeAttr(conflict ? `${file.raw} · 冲突未解决` : file.raw)}">
      <span class="badge ${file.state}">${conflict ? "!" : file.state}</span>
      <span class="file-leaf">${escapeHtml(file.leaf)}</span>
      <span class="file-extra">${escapeHtml(conflict ? "冲突" : file.extra || "")}</span>
    </button>
  `;
}

function bindFileTree(root, options = {}) {
  root.querySelectorAll(".tree-head").forEach((head) => {
    head.addEventListener("click", () => head.closest(".tree-group")?.classList.toggle("collapsed"));
  });
  if (options.mode === "worktree" || options.selectable) {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", (event) => {
        const filePath = row.dataset.file || "";
        const scope = row.dataset.scope || "";
        if (scope) {
          selectChangeFile(filePath, scope, event);
        } else {
          selectWorkingFile(filePath);
        }
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showFileContextMenu(event, row.dataset.file || "", row.dataset.scope || "");
      });
    });
    markSelectedFile();
    return;
  }
  if (options.mode === "commit") {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", () => selectCommitFile(row.dataset.file || ""));
    });
    markCommitFile();
  }
  if (options.mode === "sync") {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", () => selectSyncPreviewFile(row.dataset.file || ""));
    });
    markSyncPreviewFile();
  }
  if (options.mode === "compare") {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", () => selectCompareFile(row.dataset.file || ""));
    });
    markCompareFile();
  }
}

function selectChangeFile(filePath, scope, event) {
  if (!filePath) return;
  state.selectedFile = filePath;
  updateChangeSelection(scope, filePath, event);
  renderStage();
}

function updateChangeSelection(scope, filePath, event = {}) {
  const key = changeKey(scope, filePath);
  const additive = Boolean(event.ctrlKey || event.metaKey);
  const items = changeGroups(filterWorkingFiles(state.data?.workingFiles || []))[scope] || [];

  if (event.shiftKey && state.lastChangeSelection?.scope === scope) {
    const anchorIndex = items.findIndex((file) => changeKey(scope, file.file) === state.lastChangeSelection.key);
    const targetIndex = items.findIndex((file) => file.file === filePath);
    if (anchorIndex >= 0 && targetIndex >= 0) {
      if (!additive) clearSelectedScope(scope);
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      items.slice(start, end + 1).forEach((file) => state.selectedChanges.add(changeKey(scope, file.file)));
    } else if (!additive) {
      state.selectedChanges.clear();
      state.selectedChanges.add(key);
    }
  } else if (additive) {
    if (state.selectedChanges.has(key)) state.selectedChanges.delete(key);
    else state.selectedChanges.add(key);
  } else {
    state.selectedChanges.clear();
    state.selectedChanges.add(key);
  }

  state.lastChangeSelection = { scope, key };
}

function clearSelectedScope(scope) {
  const prefix = `${scope}:`;
  for (const key of state.selectedChanges) {
    if (key.startsWith(prefix)) state.selectedChanges.delete(key);
  }
}

function selectWorkingFile(filePath) {
  if (!filePath || filePath === state.selectedFile) return;
  state.selectedFile = filePath;
  state.workDiffScope = preferredWorkDiffScope(selectedWorkingFileInfo(filePath));
  markSelectedFile();
  updateWorkDiffActions();
  loadWorkingDiff(filePath);
}

function markSelectedFile() {
  document.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedFile);
  });
}

function selectCommitFile(filePath) {
  if (!filePath || filePath === state.selectedCommitFile) return;
  state.selectedCommitFile = filePath;
  renderInspector();
}

function syncCommitBySha(sha) {
  const sync = state.data?.sync || {};
  return [...(sync.incoming || []), ...(sync.outgoing || [])].find((commit) => commit.sha === sha);
}

async function selectSyncCommit(sha) {
  const commit = syncCommitBySha(sha);
  if (!commit) {
    toast("这个提交已经不在当前同步列表中，请刷新后再试。");
    return;
  }
  state.selectedSyncSha = sha;
  state.selectedSyncFile = "";
  renderInspector();
  await loadSyncCommitPreview(sha);
}

async function loadSyncCommitPreview(sha) {
  if (!sha || state.commitDetails.has(sha) || state.loadingCommitDetails.has(sha)) return;
  await loadCommit(sha);
  if (state.selectedTab === "sync" && state.selectedSyncSha === sha) {
    renderInspector();
  }
}

function selectSyncPreviewFile(filePath) {
  if (!filePath || filePath === state.selectedSyncFile) return;
  state.selectedSyncFile = filePath;
  renderInspector();
}

function selectCompareFile(filePath) {
  if (!filePath || filePath === state.selectedCompareFile) return;
  state.selectedCompareFile = filePath;
  renderInspector();
}

function markCompareFile() {
  els.detailBody.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedCompareFile);
  });
}

function markCommitFile() {
  els.detailBody.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedCommitFile);
  });
}

function markSyncPreviewFile() {
  els.detailBody.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedSyncFile);
  });
}

function renderWorkDiffEmpty(message) {
  setActiveDiff(null);
  els.workDiffTitle.textContent = "变更对照";
  els.workDiffPath.textContent = "";
  els.workDiffView.className = "work-diff-view empty";
  els.workDiffView.textContent = message;
  updateWorkDiffActions();
}

async function loadWorkingDiff(filePath) {
  if (!filePath) {
    renderWorkDiffEmpty("未选择文件");
    return;
  }
  const fileInfo = selectedWorkingFileInfo(filePath);
  const scope = normalizeWorkDiffScopeChoice(state.workDiffScope, fileInfo);
  state.workDiffScope = scope;
  const requestId = ++state.diffRequestId;
  els.workDiffTitle.textContent = "变更对照";
  els.workDiffPath.textContent = filePath;
  els.workDiffView.className = "work-diff-view loading";
  els.workDiffView.textContent = "正在读取差异...";
  updateWorkDiffActions(filePath);
  try {
    const data = await api(`/api/worktree-diff?file=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(scope)}`);
    if (requestId !== state.diffRequestId) return;
    renderWorkDiff(data.file || filePath, data.diff || [], data.scope || "unstaged");
  } catch (error) {
    if (requestId !== state.diffRequestId) return;
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = error.message;
  }
}

function renderWorkDiff(filePath, diff, scope = "unstaged") {
  const scopeLabel = workDiffScopeLabel(scope);
  const title = `${shortFileName(filePath)} · ${scopeLabel}`;
  state.workDiffScope = scope === "staged" ? "staged" : "unstaged";
  setActiveDiff({ source: "worktree", title, path: filePath, diff, scope, emptyText: "没有可显示的差异" });
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = filePath;
  updateWorkDiffActions(filePath);
  if (!diff.length) {
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = "没有可显示的差异";
    return;
  }
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的差异", { hunkActions: true, filePath, scope });
}

function renderHistoryDiffInWorkbench(commit, detail, filePath) {
  const diff = diffForFile(detail.diff || [], filePath);
  const title = `${shortFileName(filePath)} · 历史提交`;
  const path = `${commit.short} · ${filePath}`;
  setActiveDiff({ source: "history", title, path, diff, emptyText: "没有可显示的历史改动" });
  state.diffRequestId += 1;
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = path;
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的历史改动");
  updateWorkDiffActions("");
}

function setActiveDiff(payload) {
  state.activeDiff = payload;
  if (els.maximizeDiff) els.maximizeDiff.disabled = !payload?.diff?.length;
}

function selectedWorkingFileInfo(filePath = state.selectedFile) {
  if (!filePath) return null;
  return (state.data?.workingFiles || []).find((file) => file.file === filePath) || null;
}

function fileChangeFlags(fileInfo) {
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

function updateWorkDiffActions(filePath = state.selectedFile) {
  const fileInfo = selectedWorkingFileInfo(filePath);
  const hasWorktreeFile = Boolean(fileInfo);
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  const hasConflict = Boolean(fileInfo?.conflict);
  document.querySelectorAll("[data-work-diff-scope]").forEach((button) => {
    const scope = button.dataset.workDiffScope;
    const enabled = hasWorktreeFile && (scope === "unstaged" ? hasUnstaged : scope === "staged" ? hasStaged : false);
    button.disabled = !enabled;
    button.classList.toggle("active", enabled && state.workDiffScope === scope);
    button.title = workDiffScopeTitle(scope, filePath, enabled);
  });
  document.querySelectorAll("[data-work-diff-action]").forEach((button) => {
    const action = button.dataset.workDiffAction;
    const enabled =
      hasWorktreeFile &&
      ((action === "stageFile" || action === "discardWorktreeFile")
        ? hasUnstaged
        : action === "unstageFile" || action === "discardStagedFile"
          ? hasStaged
          : action === "resolveConflictOurs" || action === "resolveConflictTheirs"
            ? hasConflict
            : false);
    button.disabled = !enabled;
    button.title = workDiffActionTitle(action, filePath, enabled);
  });
}

function workDiffScopeTitle(scope, filePath, enabled) {
  if (!filePath) return "先选择一个工作区文件";
  if (!enabled) return scope === "staged" ? "当前文件没有已暂存改动" : "当前文件没有未暂存改动";
  return scope === "staged" ? `查看已暂存改动：${filePath}` : `查看未暂存改动：${filePath}`;
}

function workDiffActionTitle(action, filePath, enabled) {
  if (!filePath) return "先选择一个工作区文件";
  if (!enabled) return "当前文件没有适用的改动";
  const titles = {
    stageFile: `暂存 ${filePath}`,
    unstageFile: `取消暂存 ${filePath}`,
    resolveConflictOurs: `使用当前版本解决冲突并暂存：${filePath}`,
    resolveConflictTheirs: `使用对方版本解决冲突并暂存：${filePath}`,
    discardWorktreeFile: `丢弃工作区改动：${filePath}`,
    discardStagedFile: `丢弃已暂存改动：${filePath}`,
  };
  return titles[action] || filePath;
}

async function runWorkDiffFileAction(action, button) {
  const file = state.selectedFile;
  if (!file) {
    toast("请先选择一个工作区文件");
    return;
  }
  if (button) button.disabled = true;
  try {
    await runSingleFileAction(action, file);
  } finally {
    updateWorkDiffActions();
  }
}

async function switchWorkDiffScope(scope, button) {
  if (!state.selectedFile || button?.disabled) return;
  state.workDiffScope = scope === "staged" ? "staged" : "unstaged";
  updateWorkDiffActions();
  await loadWorkingDiff(state.selectedFile);
}

async function runWorkDiffHunkAction(action, button) {
  const file = state.selectedFile;
  const hunkIndex = Number.parseInt(button?.dataset.hunkIndex || "", 10);
  const scope = button?.dataset.hunkScope || state.activeDiff?.scope || "unstaged";
  if (!file || !Number.isInteger(hunkIndex) || hunkIndex < 0) {
    toast("请选择要操作的改动块");
    return;
  }
  if (action === "discardWorktreeHunk" && !state.data?.repo?.isSample && !confirm(`确认丢弃这个改动块？\n\n文件：${file}\n此操作无法撤销。`)) return;
  const buttons = els.workDiffView.querySelectorAll("[data-hunk-action]");
  buttons.forEach((item) => {
    item.disabled = true;
  });
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action, file, scope, hunkIndex }),
    });
    toast(result.output || "改动块操作完成");
    await refreshWorktree(true);
    if (state.selectedFile) {
      state.workDiffScope = normalizeWorkDiffScopeChoice(state.workDiffScope, selectedWorkingFileInfo(state.selectedFile));
      await loadWorkingDiff(state.selectedFile);
    }
  } catch (error) {
    toast(error.message);
    await refreshWorktree(true);
  } finally {
    buttons.forEach((item) => {
      item.disabled = false;
    });
  }
}

function openDiffModal() {
  if (!state.activeDiff?.diff?.length) {
    toast("没有可最大化的对照内容");
    return;
  }
  els.diffModalTitle.textContent = state.activeDiff.title || "变更对照";
  els.diffModalPath.textContent = state.activeDiff.path || "";
  els.diffModalBody.innerHTML = renderSideDiff(state.activeDiff.diff, state.activeDiff.emptyText || "没有可显示的差异");
  els.diffModal.classList.add("show");
  els.diffModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeDiffModal() {
  els.diffModal.classList.remove("show");
  els.diffModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderSideDiff(diff, emptyText, options = {}) {
  if (!diff?.length) return `<div class="diff-empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="side-diff">
      <div class="side-diff-head"><span>旧版本</span><span>新版本</span></div>
      ${sideBySideRows(diff, options)}
    </div>
  `;
}

function diffForFile(diff, filePath) {
  const target = normalizeDiffPath(filePath);
  const blocks = [];
  let current = [];
  for (const line of diff || []) {
    const text = String(line.text || "");
    if (text.startsWith("diff --git ")) {
      if (current.length) blocks.push(current);
      current = [line];
      continue;
    }
    if (current.length) current.push(line);
  }
  if (current.length) blocks.push(current);
  const matched = blocks.find((block) => diffBlockMatchesFile(block, target));
  return matched || [];
}

function diffBlockMatchesFile(block, target) {
  return block.some((line) => {
    const text = String(line.text || "");
    const normalized = normalizeDiffPath(text);
    return normalized.includes(` a/${target}`) || normalized.includes(` b/${target}`) || normalized.endsWith(`a/${target}`) || normalized.endsWith(`b/${target}`);
  });
}

function normalizeDiffPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^"|"$/g, "");
}

function sideBySideRows(diff, options = {}) {
  const rows = [];
  let oldLine = 0;
  let newLine = 0;
  for (let index = 0; index < diff.length; index++) {
    const line = diff[index];
    const text = String(line.text || "");
    if (line.type === "meta") {
      const hunk = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]) - 1;
        newLine = Number(hunk[2]) - 1;
      }
      rows.push(renderSideMetaRow(line, text, options));
      continue;
    }
    if (line.type === "del" && diff[index + 1]?.type === "add") {
      oldLine += 1;
      newLine += 1;
      rows.push(sideRow("mod", oldLine, trimDiffPrefix(text), "del", newLine, trimDiffPrefix(diff[index + 1].text), "add"));
      index += 1;
      continue;
    }
    if (line.type === "del") {
      oldLine += 1;
      rows.push(sideRow("del", oldLine, trimDiffPrefix(text), "del", "", "", "blank"));
      continue;
    }
    if (line.type === "add") {
      newLine += 1;
      rows.push(sideRow("add", "", "", "blank", newLine, trimDiffPrefix(text), "add"));
      continue;
    }
    oldLine += 1;
    newLine += 1;
    rows.push(sideRow("ctx", oldLine, trimDiffPrefix(text), "", newLine, trimDiffPrefix(text), ""));
  }
  return rows.join("");
}

function renderSideMetaRow(line, text, options = {}) {
  const actions = options.hunkActions ? workDiffHunkActionButtons(options.filePath, options.scope, line.hunkIndex) : "";
  return `
    <div class="side-row meta ${actions ? "has-actions" : ""}">
      <div class="side-meta">
        <span class="side-meta-text">${escapeHtml(text)}</span>
        ${actions}
      </div>
    </div>
  `;
}

function workDiffHunkActionButtons(filePath, scope, hunkIndex) {
  if (!Number.isInteger(hunkIndex)) return "";
  const fileInfo = selectedWorkingFileInfo(filePath);
  if (!fileInfo || fileInfo.conflict) return "";
  const untracked = isUntrackedFile(fileInfo);
  const normalizedScope = scope === "staged" ? "staged" : scope === "untracked" ? "untracked" : scope === "unstaged" ? "unstaged" : "";
  if (normalizedScope === "untracked" && untracked && fileInfo.unstaged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="stageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="untracked" type="button" title="把这个未跟踪文件块加入暂存区">暂存此块</button>
      </span>
    `;
  }
  if (untracked) return "";
  if (normalizedScope === "unstaged" && fileInfo.unstaged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="stageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="unstaged" type="button">暂存此块</button>
        <button class="mini-btn danger" data-hunk-action="discardWorktreeHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="unstaged" type="button">丢弃此块</button>
      </span>
    `;
  }
  if (normalizedScope === "staged" && fileInfo.staged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="unstageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="staged" type="button">取消暂存此块</button>
      </span>
    `;
  }
  return "";
}

function workDiffScopeLabel(scope) {
  if (scope === "staged") return "已暂存";
  if (scope === "untracked") return "未跟踪";
  return "未暂存";
}

function sideRow(type, oldNo, oldText, oldClass, newNo, newText, newClass) {
  return `
    <div class="side-row ${type}">
      <div class="side-cell old ${oldClass}">
        <span class="ln">${escapeHtml(oldNo)}</span><code>${escapeHtml(oldText)}</code>
      </div>
      <div class="side-cell new ${newClass}">
        <span class="ln">${escapeHtml(newNo)}</span><code>${escapeHtml(newText)}</code>
      </div>
    </div>
  `;
}

function trimDiffPrefix(text) {
  return String(text || "").replace(/^[-+ ]/, "");
}

function shortFileName(filePath) {
  return String(filePath || "").replaceAll("\\", "/").split("/").filter(Boolean).pop() || "变更对照";
}

function remoteCheckoutBranch(remoteRef) {
  const parts = String(remoteRef || "").split("/").filter(Boolean);
  return parts.length >= 2 ? parts.slice(1).join("/") : "";
}

function worktreeSignature(files) {
  return (files || []).map((file) => `${file.state}:${file.file}:${file.extra || ""}:${file.conflict ? "conflict" : ""}`).join("|");
}

function worktreeStateSignature(files, operation) {
  return `${worktreeSignature(files)}|op:${operation?.type || ""}`;
}

async function refreshWorktree(silent = false) {
  if (!state.data || state.refreshingWorktree) return;
  state.refreshingWorktree = true;
  els.refreshChanges.disabled = true;
  try {
    const data = await api("/api/worktree");
    const nextFiles = data.workingFiles || [];
    const nextOperation = data.operation || null;
    const nextSignature = worktreeStateSignature(nextFiles, nextOperation);
    if (nextSignature !== state.worktreeSignature) {
      state.data.workingFiles = nextFiles;
      state.data.repo.operation = nextOperation;
      renderWorkingFiles();
      renderStage();
      if (!silent) toast("未提交修改已刷新");
    } else if (!silent) {
      toast("未提交修改已是最新");
    }
  } catch (error) {
    if (!silent) toast(error.message);
  } finally {
    state.refreshingWorktree = false;
    els.refreshChanges.disabled = false;
  }
}

function initWorktreeAutoRefresh() {
  window.addEventListener("focus", () => refreshWorktree(true));
  setInterval(() => {
    if (!document.hidden) refreshWorktree(true);
  }, 5000);
}

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

async function selectRef(ref) {
  if (!state.data) return;
  try {
    state.selectedRef = ref;
    els.searchInput.value = "";
    state.commitDetails.clear();
    if (state.data.repo.isSample) {
      state.data.repo.selectedRef = ref;
    } else {
      state.data = await api(`/api/state?ref=${encodeURIComponent(ref)}`);
      state.selectedRef = state.data.repo.selectedRef || ref;
    }
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    toast(ref ? `已查看 ${ref}` : "已显示全部分支");
  } catch (error) {
    toast(error.message);
  }
}

async function checkoutBranch(branch, button) {
  if (!state.data || !branch) return;
  if (branch === state.data.repo.branch) {
    toast("已经在这个分支上");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  let mode = "keep";
  if (!state.data.repo.isSample && dirtyCount) {
    mode = await chooseCheckoutMode(branch, dirtyCount);
    if (!mode) return;
  } else if (!state.data.repo.isSample && !confirm(`确认切换到分支：${branch}？`)) {
    return;
  }
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "checkoutBranch", branch, mode }) });
    rememberCheckoutStash(result.stash);
    toast(result.output || `已切换到 ${branch}`);
    state.commitDetails.clear();
    state.selectedRef = branch;
    state.data = await api(`/api/state?ref=${encodeURIComponent(branch)}`);
    state.selectedRef = state.data.repo.selectedRef || branch;
    state.selectedSha = state.data.commits[0]?.sha || "";
    els.searchInput.value = "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function checkoutRemoteBranch(remoteRef, button) {
  if (!state.data || !remoteRef) return;
  const localBranch = remoteCheckoutBranch(remoteRef);
  if (localBranch && localBranch === state.data.repo.branch) {
    toast("对应的本地分支已经是当前分支");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  let mode = "keep";
  const targetText = localBranch ? `${remoteRef} -> ${localBranch}` : remoteRef;
  if (!state.data.repo.isSample && dirtyCount) {
    mode = await chooseCheckoutMode(targetText, dirtyCount);
    if (!mode) return;
  } else if (!state.data.repo.isSample && !confirm(`确认将远端分支签出为本地分支：${targetText}？`)) {
    return;
  }
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "checkoutRemoteBranch", ref: remoteRef, mode }),
    });
    const nextBranch = result.branch || localBranch || remoteRef;
    rememberCheckoutStash(result.stash);
    toast(result.output || `已签出 ${nextBranch}`);
    state.commitDetails.clear();
    state.selectedRef = nextBranch;
    state.data = await api(`/api/state?ref=${encodeURIComponent(nextBranch)}`);
    state.selectedRef = state.data.repo.selectedRef || nextBranch;
    state.selectedSha = state.data.commits[0]?.sha || "";
    els.searchInput.value = "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function mergeBranchRef(ref) {
  if (!state.data || !ref) return;
  const current = state.data.repo.branch || "当前分支";
  if (ref === current) {
    toast("不能把当前分支合并到自己");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? `\n\n当前还有 ${dirtyCount} 个未提交改动，Git 可能会阻止合并。建议先提交或储藏。` : "";
  if (!state.data.repo.isSample && !confirm(`确认将 ${ref} 合并到当前分支 ${current}？${dirtyNote}`)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "mergeRef", ref }) });
    toast(result.output || `已合并 ${ref}`);
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
    await refreshWorktree(true);
  }
}

async function rebaseOntoRef(ref) {
  if (!state.data || !ref) return;
  const current = state.data.repo.branch || "当前分支";
  if (ref === current) {
    toast("不能把当前分支变基到自己");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? `\n\n当前还有 ${dirtyCount} 个未提交改动，Git 会阻止变基。请先提交或储藏。` : "";
  const message = `确认把当前分支 ${current} 变基到 ${ref}？\n\n命令：git rebase ${ref}\n这会重写当前分支尚未合入 ${ref} 的提交 SHA。${dirtyNote}`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "rebaseOntoRef", ref }) });
    toast(result.output || `已变基到 ${ref}`);
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
    await refreshWorktree(true);
  }
}

function chooseCheckoutMode(branch, count) {
  els.checkoutModalText.textContent = `切换到 ${branch} 前，当前工作区有 ${count} 个未提交改动。`;
  els.checkoutModal.classList.add("show");
  els.checkoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  return new Promise((resolve) => {
    const cleanup = (mode) => {
      els.checkoutModal.classList.remove("show");
      els.checkoutModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      els.checkoutModal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(mode);
    };
    const onClick = (event) => {
      const button = event.target.closest("[data-checkout-mode]");
      if (!button) return;
      const mode = button.dataset.checkoutMode;
      cleanup(mode === "cancel" ? "" : mode);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") cleanup("");
    };
    els.checkoutModal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
  });
}

function rememberCheckoutStash(stash) {
  if (!stash?.message || !state.data?.repo?.path) return;
  const records = checkoutStashRecords().filter((item) => item.message !== stash.message);
  records.unshift({ ...stash, repoPath: state.data.repo.path });
  localStorage.setItem("forkline-checkout-stashes", JSON.stringify(records.slice(0, 12)));
}

function checkoutStashRecords() {
  try {
    const data = JSON.parse(localStorage.getItem("forkline-checkout-stashes") || "[]");
    return Array.isArray(data) ? data.filter((item) => item?.message && item?.branch) : [];
  } catch {
    return [];
  }
}

function forgetCheckoutStash(stash) {
  if (!stash?.message) return;
  const records = checkoutStashRecords().filter((item) => item.message !== stash.message);
  localStorage.setItem("forkline-checkout-stashes", JSON.stringify(records));
}

async function maybeRestoreCheckoutStash(branch) {
  if (!branch || state.data?.repo?.isSample) return;
  let stash = checkoutStashRecords().find((item) => item.repoPath === state.data.repo.path && item.branch === branch);
  if (!stash) {
    const found = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "findCheckoutStash", branch }) });
    stash = found.stash;
  }
  if (!stash?.message || state.ignoredCheckoutStashes.has(stash.message)) return;
  const restore = await chooseStashRestore(stash);
  if (!restore) {
    state.ignoredCheckoutStashes.add(stash.message);
    return;
  }
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "restoreCheckoutStash", branch, message: stash.message }),
    });
    forgetCheckoutStash(stash);
    toast(result.output || "已恢复储藏的本地更改");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  }
}

function chooseStashRestore(stash) {
  els.stashRestoreText.textContent = `${stash.label || stash.message} 可以恢复到当前分支。`;
  els.stashRestoreModal.classList.add("show");
  els.stashRestoreModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  return new Promise((resolve) => {
    const cleanup = (restore) => {
      els.stashRestoreModal.classList.remove("show");
      els.stashRestoreModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      els.stashRestoreModal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(restore);
    };
    const onClick = (event) => {
      const button = event.target.closest("[data-stash-restore]");
      if (!button) return;
      cleanup(button.dataset.stashRestore === "restore");
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") cleanup(false);
    };
    els.stashRestoreModal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
  });
}

async function runAction(action) {
  if (!state.data) return;
  const names = {
    fetch: "抓取",
    pull: "拉取",
    pullRebase: "变基拉取",
    push: "推送",
    forcePushLease: "安全强推",
    stageAll: "暂存全部",
    discardAll: "丢弃全部",
    commit: "创建提交",
    amendCommit: "追加提交",
  };
  if (!state.data.repo.isSample && !confirm(actionConfirmMessage(action, names[action]))) return;
  try {
    const payload = { action };
    if (action === "commit" || action === "amendCommit") {
      payload.summary = els.commitSummary.value.trim();
      payload.body = els.commitBody.value.trim();
    }
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    toast(result.output || `${names[action]}完成`);
    if (action === "commit") {
      els.commitSummary.value = "";
      els.commitBody.value = "";
    }
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  }
}

async function runRepoOperation(action, button) {
  if (!state.data) return;
  const messages = {
    continueRevert: "确认继续还原？请先确认所有冲突文件已经解决并暂存。",
    abortRevert: "确认中止还原？这会放弃当前这次还原，并回到还原前的状态。",
    continueCherryPick: "确认继续挑选？请先确认所有冲突文件已经解决并暂存。",
    skipCherryPick: "确认跳过当前挑选提交？这会放弃当前这一个提交的挑选，继续处理后续状态。",
    abortCherryPick: "确认中止挑选？这会放弃当前这次 cherry-pick，并回到挑选前的状态。",
    continueMerge: "确认继续合并？请先确认所有冲突文件已经解决并暂存。",
    abortMerge: "确认中止合并？这会放弃当前这次合并，并回到合并前的状态。",
    continueRebase: "确认继续变基？请先确认所有冲突文件已经解决并暂存。",
    skipRebase: "确认跳过当前变基提交？这会放弃当前这一个提交的变基，继续处理后续提交。",
    abortRebase: "确认中止变基？这会放弃当前这次 rebase，并回到变基前的状态。",
  };
  if (!state.data.repo.isSample && !confirm(messages[action] || "确认继续？")) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action }) });
    toast(result.output || "操作已完成");
    state.commitDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function fillLatestCommitMessage() {
  const commit = state.data?.commits?.[0];
  if (!commit) {
    els.amendToggle.checked = false;
    toast("没有可追加的上一次提交");
    return;
  }
  try {
    const detail = await api(`/api/commit?sha=${encodeURIComponent(commit.sha)}`);
    const message = commitMessageParts(commit, detail);
    els.commitSummary.value = message.summary;
    els.commitBody.value = message.body;
  } catch (error) {
    els.amendToggle.checked = false;
    toast(error.message);
  }
}

function updateAmendMode() {
  const enabled = Boolean(els.amendToggle.checked);
  els.commitSubmit.textContent = enabled ? "追加提交" : "创建提交";
  els.commitSubmit.title = enabled ? "追加到上一次提交" : "创建新的提交";
}

function actionConfirmMessage(action, name) {
  if (action === "amendCommit") return "确认追加到上一次提交？这会重写最新提交 SHA。";
  if (action === "discardAll") return "确认丢弃全部未提交更改？这会清空已暂存、未暂存和未跟踪文件，无法撤销。";
  if (action === "pullRebase") {
    const sync = state.data?.sync || {};
    const branch = sync.branch || state.data?.repo?.branch || "当前分支";
    const upstream = sync.upstream || "未设置 upstream";
    const stateText = `领先 ${sync.ahead || 0}，落后 ${sync.behind || 0}${sync.upstreamGone ? "，上游丢失" : ""}`;
    return `确认变基拉取当前分支：${branch}？\n\n目标：${upstream}\n当前状态：${stateText}\n命令：git pull --rebase\n\n这会先拉取远端提交，再把本地未推送提交重新应用到远端之后；本地这些提交的 SHA 可能会改变。遇到冲突时，工作区会显示“继续变基 / 跳过变基 / 中止变基”。`;
  }
  if (action === "push") {
    const branch = state.data?.repo?.branch || "当前分支";
    const info = state.data?.branchInfo?.[branch] || {};
    const sync = state.data?.sync || {};
    const guard = syncPushGuard(sync);
    if (guard.blocked) {
      return `${guard.text}\n\nForkline 会阻止这次普通推送。通常请先使用“变基拉取”；只有确认要改写远端历史时，再使用“安全强推”。`;
    }
    if (info.upstream) {
      return `确认推送当前分支：${branch}？\n\n目标：${info.upstream}\n当前状态：领先 ${info.ahead || 0}，落后 ${info.behind || 0}${info.upstreamGone ? "，上游丢失" : ""}\n命令：git push`;
    }
    return `当前分支 ${branch} 没有 upstream。确认推送并自动设置 upstream？\n\n默认命令：git push -u origin ${branch}\n如果仓库没有 origin，会使用第一个远端。`;
  }
  if (action === "forcePushLease") {
    const branch = state.data?.repo?.branch || "当前分支";
    const info = state.data?.branchInfo?.[branch] || {};
    const upstream = info.upstream || "未设置 upstream";
    const divergence = info.upstream
      ? `当前状态：领先 ${info.ahead || 0}，落后 ${info.behind || 0}${info.upstreamGone ? "，上游丢失" : ""}`
      : "当前分支没有 upstream，后端会拒绝安全强推。";
    return `确认安全强推当前分支：${branch}？\n\n目标：${upstream}\n命令：git push --force-with-lease\n${divergence}\n\n这会改写远端分支历史。--force-with-lease 会在远端分支自你上次抓取后又变化时拒绝推送；如果不确定，请先抓取并检查远端提交。`;
  }
  return `确认执行：${name}？`;
}

async function runUpstreamAction(action, ref = "", button = null) {
  if (!state.data) return;
  const branch = state.data?.repo?.branch || "当前分支";
  const selectedRef = ref || els.detailBody.querySelector("[data-upstream-select]")?.value || "";
  let payload = null;
  let message = "";
  if (action === "set") {
    if (!selectedRef) {
      toast("请选择远端分支");
      return;
    }
    payload = { action: "setUpstream", ref: selectedRef };
    message = `确认设置当前分支 upstream？\n\n当前分支：${branch}\n目标：${selectedRef}\n命令：git branch --set-upstream-to=${selectedRef} ${branch}`;
  } else if (action === "unset") {
    const upstream = state.data?.sync?.upstream || state.data?.branchInfo?.[branch]?.upstream || "";
    payload = { action: "unsetUpstream" };
    message = `确认取消当前分支 upstream？\n\n当前分支：${branch}\n原 upstream：${upstream || "未设置"}\n命令：git branch --unset-upstream ${branch}`;
  }
  if (!payload) return;
  if (!state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    toast(result.output || "upstream 操作完成");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedTab = "sync";
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRemoteAction(action, remoteName = "", button = null) {
  if (!state.data) return;
  const remote = findRemote(remoteName);
  let payload = null;
  let message = "";
  if (action === "add") {
    const existingNames = syncRemotes().map((item) => item.name);
    const defaultName = existingNames.includes("origin") ? "upstream" : "origin";
    const nameInput = prompt("远端名称：", defaultName);
    if (nameInput === null) return;
    const name = cleanPromptValue(nameInput, "远端名称");
    if (!name) return;
    const urlInput = prompt("远端 URL：", "git@github.com:用户名/仓库名.git");
    if (urlInput === null) return;
    const url = cleanPromptValue(urlInput, "远端 URL");
    if (!url) return;
    payload = { action: "addRemote", name, url };
    message = `确认添加远端：${name}？\n\nURL：${url}\n命令：git remote add ${name} ${url}`;
  } else if (action === "edit") {
    if (!remote?.name) return;
    const currentUrl = remote.pushUrl || remote.fetchUrl || "";
    const urlInput = prompt(`修改远端 ${remote.name} 的 URL：`, currentUrl);
    if (urlInput === null) return;
    const url = cleanPromptValue(urlInput, "远端 URL");
    if (!url) return;
    payload = { action: "setRemoteUrl", name: remote.name, url };
    message = `确认修改远端 URL：${remote.name}？\n\n新 URL：${url}\n命令：git remote set-url ${remote.name} ${url}`;
  } else if (action === "delete") {
    if (!remote?.name) return;
    payload = { action: "deleteRemote", name: remote.name };
    message = `确认删除远端：${remote.name}？\n\n命令：git remote remove ${remote.name}\n这个操作只会删除当前仓库里的远端配置，不会删除 GitHub 或服务器上的仓库。`;
  } else if (action === "test") {
    if (!remote?.name) return;
    payload = { action: "testRemote", name: remote.name };
    message = "";
  } else if (action === "fetch") {
    if (!remote?.name) return;
    payload = { action: "fetchRemote", name: remote.name };
    message = `确认抓取远端：${remote.name}？\n\n命令：git fetch ${remote.name} --prune`;
  }
  if (!payload) return;
  if (message && !state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    if (action === "test") {
      const check = result.remoteCheck || {};
      state.remoteCheck = {
        ...check,
        status: "success",
        remote: check.remote || remote.name,
        heads: check.heads ?? 0,
        fetchUrl: check.fetchUrl || remote.fetchUrl || "",
        pushUrl: check.pushUrl || remote.pushUrl || remote.fetchUrl || "",
        command: check.command || `git ls-remote --heads ${check.remote || remote.name}`,
        output: check.output || result.output || "远端连接正常",
        checkedAt: remoteCheckTime(),
      };
    } else if (action === "add" || action === "edit" || action === "delete") {
      state.remoteCheck = null;
    }
    toast(result.output || "远端操作完成");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedTab = "sync";
    renderAll();
  } catch (error) {
    if (action === "test" && remote?.name) {
      const check = error.remoteCheck || {};
      state.remoteCheck = {
        ...check,
        status: "error",
        remote: check.remote || remote.name,
        fetchUrl: check.fetchUrl || remote.fetchUrl || "",
        pushUrl: check.pushUrl || remote.pushUrl || remote.fetchUrl || "",
        command: check.command || `git ls-remote --heads ${remote.name}`,
        output: check.output || error.message,
        checkedAt: remoteCheckTime(),
      };
      state.selectedTab = "sync";
      renderInspector();
    }
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRemoteMenuAction(action) {
  const remote = state.contextRemote;
  hideRemoteContextMenu();
  if (!remote?.name) return;
  if (action === "copyFetch" || action === "copyPush") {
    const url = action === "copyFetch" ? remote.fetchUrl : remote.pushUrl || remote.fetchUrl;
    if (!url) {
      toast("这个远端没有可复制的 URL");
      return;
    }
    await copyText(url);
    toast(action === "copyFetch" ? "已复制 fetch URL" : "已复制 push URL");
    return;
  }
  if (action === "copyCheckCommand") {
    await copyText(`git ls-remote --heads ${remote.name}`);
    toast("已复制诊断命令");
    return;
  }
  const mapped = action === "test" || action === "fetch" || action === "edit" || action === "delete" ? action : "";
  if (mapped) await runRemoteAction(mapped, remote.name);
}

function syncRemotes() {
  return state.data?.sync?.remotes || [];
}

function findRemote(name) {
  return syncRemotes().find((remote) => remote.name === name) || null;
}

function cleanPromptValue(value, label) {
  const text = String(value || "").trim();
  if (!text) toast(`请填写${label}`);
  return text;
}

function selectedContextFiles() {
  const files = state.data?.workingFiles || [];
  const selected = new Set();
  for (const key of state.selectedChanges) {
    const [, ...pathParts] = key.split(":");
    const filePath = pathParts.join(":");
    if (filePath && files.some((file) => file.file === filePath)) selected.add(filePath);
  }
  if (!selected.size && state.contextFile?.file) selected.add(state.contextFile.file);
  return [...selected];
}

async function createStashFromSelection(files = null) {
  if (!state.data) return;
  const selectedOnly = Array.isArray(files);
  const stashFiles = selectedOnly ? files : [];
  const allFiles = state.data.workingFiles || [];
  if (!allFiles.length) {
    toast("没有可储藏的未提交更改");
    return;
  }
  if (selectedOnly && !stashFiles.length) {
    toast("没有选中的文件可储藏");
    return;
  }
  const targetText = selectedOnly ? `${stashFiles.length} 个所选文件` : "全部未提交更改";
  const defaultMessage = `Forkline: 手动储藏 ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
  const message = state.data.repo.isSample ? defaultMessage : prompt(`为${targetText}填写储藏说明：`, defaultMessage);
  if (message === null) return;
  const trimmedMessage = String(message || "").trim() || defaultMessage;
  if (!state.data.repo.isSample && !confirm(`确认储藏${targetText}？\n\n说明：${trimmedMessage}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "createStash", message: trimmedMessage, files: selectedOnly ? stashFiles : [] }),
    });
    toast("已创建储藏，工作区更改已移到右侧“储藏”列表");
    state.stashDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedStash = state.data.stashes?.[0]?.ref || state.selectedStash;
    state.selectedTab = "stashes";
    renderAll();
  } catch (error) {
    toast(error.message);
  }
}

async function ignoreWorktreePath(action, file) {
  if (!state.data || !file) return;
  const mode = action === "ignoreDirectory" ? "directory" : "file";
  const target = mode === "directory" ? worktreeDirectoryForFile(file) : file;
  if (!target) {
    toast("根目录文件没有可忽略的所在目录");
    return;
  }
  const command = mode === "directory" ? `/${target}/` : `/${file}`;
  const message =
    mode === "directory"
      ? `确认把目录加入 .gitignore？\n\n目录：${target}/\n规则：${command}\n\n这个操作只写入 .gitignore，不会删除本地文件。`
      : `确认把文件加入 .gitignore？\n\n文件：${file}\n规则：${command}\n\n这个操作只写入 .gitignore，不会删除本地文件。`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "ignoreWorktreePath", file, mode }) });
    toast(result.output || "已更新 .gitignore");
    state.selectedChanges.delete(changeKey("unstaged", file));
    state.selectedChanges.delete(changeKey("staged", file));
    const data = await api("/api/worktree");
    state.data.workingFiles = data.workingFiles || [];
    state.data.repo.operation = data.operation || null;
    renderWorkingFiles();
    renderStage();
  } catch (error) {
    toast(error.message);
  }
}

function worktreeDirectoryForFile(file) {
  const normalized = String(file || "").replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "";
}

async function runSingleFileAction(action, file) {
  if (!state.data || !file) return;
  const names = {
    stageFile: "暂存",
    unstageFile: "取消暂存",
    discardWorktreeFile: "丢弃",
    discardStagedFile: "丢弃",
    resolveConflictOurs: "已使用当前版本解决冲突",
    resolveConflictTheirs: "已使用对方版本解决冲突",
  };
  if (isDiscardAction(action) && !state.data.repo.isSample && !confirm(discardConfirmMessage(action, [file]))) return;
  if (isConflictResolveAction(action) && !state.data.repo.isSample && !confirm(conflictResolveConfirmMessage(action, file))) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(singleFileActionPayload(action, file)) });
    toast(result.output || `${names[action] || "操作"}完成`);
    state.selectedChanges.delete(changeKey("unstaged", file));
    state.selectedChanges.delete(changeKey("staged", file));
    const data = await api("/api/worktree");
    state.data.workingFiles = data.workingFiles || [];
    state.data.repo.operation = data.operation || null;
    renderWorkingFiles();
    renderStage();
  } catch (error) {
    toast(error.message);
  }
}

function singleFileActionPayload(action, file) {
  if (action === "resolveConflictOurs") return { action: "resolveConflictFile", side: "ours", file };
  if (action === "resolveConflictTheirs") return { action: "resolveConflictFile", side: "theirs", file };
  return { action, file };
}

function isConflictResolveAction(action) {
  return action === "resolveConflictOurs" || action === "resolveConflictTheirs";
}

function conflictResolveConfirmMessage(action, file) {
  const side = action === "resolveConflictOurs" ? "当前版本（git checkout --ours）" : "对方版本（git checkout --theirs）";
  return `确认使用${side}解决冲突并暂存？\n\n文件：${file}\n这会覆盖此文件里的冲突标记。`;
}

async function runFileBatchAction(action, scope, button) {
  if (!state.data) return;
  const groups = changeGroups(state.data.workingFiles || []);
  const files = selectedFilesInScope(scope, groups[scope] || []).map((file) => file.file);
  if (!files.length) return;
  const names = { stageFile: "暂存", unstageFile: "取消暂存", discardWorktreeFile: "丢弃", discardStagedFile: "丢弃" };
  const name = names[action] || "操作";
  if (isDiscardAction(action) && !state.data.repo.isSample && !confirm(discardConfirmMessage(action, files))) return;
  if (button) button.disabled = true;
  try {
    for (const file of files) {
      await api("/api/action", {
        method: "POST",
        body: JSON.stringify({ action, file }),
      });
      state.selectedChanges.delete(changeKey(scope, file));
    }
    toast(`${name}完成：${files.length} 个文件`);
    const data = await api("/api/worktree");
    state.data.workingFiles = data.workingFiles || [];
    state.data.repo.operation = data.operation || null;
    renderWorkingFiles();
    renderStage();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function isDiscardAction(action) {
  return action === "discardWorktreeFile" || action === "discardStagedFile";
}

function discardConfirmMessage(action, files) {
  const count = files.length;
  const target = count === 1 ? files[0] : `${count} 个文件`;
  if (action === "discardStagedFile") return `确认丢弃已暂存改动：${target}？此操作会同时丢弃相关工作区内容，无法撤销。`;
  return `确认丢弃工作区改动：${target}？此操作无法撤销。`;
}

async function rewordSelectedCommit(form) {
  if (!state.data) return;
  const sha = form.dataset.sha || state.selectedSha;
  const commit = state.data.commits.find((item) => item.sha === sha);
  if (!commit) return;
  const summary = form.elements.summary.value.trim();
  const body = form.elements.body.value.trim();
  if (!summary) {
    toast("请填写新的提交摘要");
    return;
  }
  const previousIndex = state.data.commits.findIndex((item) => item.sha === sha);
  const targetName = sha === state.data.commits[0]?.sha ? "最新提交" : "历史提交";
  if (!state.data.repo.isSample && !confirm(`确认修改 ${targetName} ${commit.short} 的提交信息？这会重写相关历史 SHA。`)) return;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewordCommit", sha, summary, body }),
    });
    toast(result.output || "提交信息已修改");
    state.commitDetails.clear();
    state.historyPlan = null;
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    const sameCommit = state.data.commits.find((item) => item.sha === sha);
    state.selectedSha = sameCommit?.sha || state.data.commits[previousIndex]?.sha || state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

function countFiles(files) {
  return files.reduce(
    (acc, file) => {
      acc[file.state] = (acc[file.state] || 0) + 1;
      return acc;
    },
    { M: 0, A: 0, D: 0, C: 0 }
  );
}

function laneColor(index) {
  return ["#23c7b7", "#ff7a67", "#f0b85b", "#5ca9ff", "#9c7cff", "#6bd58c", "#f071b8"][index % 7];
}

function initTheme() {
  const queryTheme = new URLSearchParams(window.location.search).get("theme");
  const storedTheme = localStorage.getItem("forkline-theme");
  const theme = normalizeTheme(queryTheme) || normalizeTheme(storedTheme) || "dark";
  applyTheme(theme, false);
}

function normalizeTheme(theme) {
  return theme === "light" || theme === "dark" ? theme : "";
}

function applyTheme(theme, persist = true) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("forkline-theme", theme);
  els.themeToggle.textContent = theme === "light" ? "深色" : "浅色";
  els.themeToggle.title = theme === "light" ? "切换到深色模式" : "切换到浅色模式";
}

function toggleTheme() {
  applyTheme(state.theme === "light" ? "dark" : "light");
}

function initLayoutResizers() {
  const root = document.documentElement;
  const configs = {
    sidebar: { varName: "--sidebar-w", store: "forkline-sidebar-w", min: 190, max: () => layoutMax("sidebar"), axis: "x", sign: 1 },
    inspector: { varName: "--inspector-w", store: "forkline-inspector-w", min: 260, max: () => layoutMax("inspector"), axis: "x", sign: -1 },
    changes: { varName: "--changes-w", store: "forkline-changes-w", min: 240, max: () => layoutMax("changes"), axis: "x", sign: 1 },
    stage: { varName: "--stage-h", store: "forkline-stage-h", min: 220, max: () => layoutMax("stage"), axis: "y", sign: -1 },
    commitForm: { varName: "--commit-form-h", store: "forkline-commit-form-h", min: 90, max: () => layoutMax("commitForm"), axis: "y", sign: -1 },
  };
  Object.values(configs).forEach((config) => {
    const stored = Number(localStorage.getItem(config.store));
    if (Number.isFinite(stored)) root.style.setProperty(config.varName, `${clamp(stored, config.min, configMax(config))}px`);
  });
  document.querySelectorAll("[data-resizer]").forEach((handle) => {
    const config = configs[handle.dataset.resizer];
    if (!config) return;
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      const startPoint = config.axis === "x" ? event.clientX : event.clientY;
      const startSize = numericCssVar(config.varName);
      document.body.classList.add("resizing");
      const onMove = (moveEvent) => {
        const point = config.axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const next = clamp(startSize + (point - startPoint) * config.sign, config.min, configMax(config));
        root.style.setProperty(config.varName, `${next}px`);
        if (config.varName === "--stage-h") {
          const commitConfig = configs.commitForm;
          const currentCommit = numericCssVar(commitConfig.varName);
          root.style.setProperty(commitConfig.varName, `${clamp(currentCommit, commitConfig.min, configMax(commitConfig))}px`);
        }
      };
      const onUp = () => {
        const current = numericCssVar(config.varName);
        localStorage.setItem(config.store, String(current));
        document.body.classList.remove("resizing");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
    });
  });
  window.addEventListener("resize", () => clampLayoutVars(configs));
  clampLayoutVars(configs);
}

function clampLayoutVars(configs) {
  Object.values(configs).forEach((config) => {
    const current = numericCssVar(config.varName);
    const next = clamp(current, config.min, configMax(config));
    document.documentElement.style.setProperty(config.varName, `${next}px`);
  });
}

function layoutMax(kind) {
  const width = window.innerWidth || 1160;
  const height = window.innerHeight || 760;
  const sidebar = numericCssVar("--sidebar-w") || 240;
  const inspector = numericCssVar("--inspector-w") || 340;
  const resizers = 14;
  const mainMin = 560;
  if (kind === "sidebar") return Math.max(220, Math.min(420, width - inspector - resizers - mainMin));
  if (kind === "inspector") return Math.max(280, Math.min(560, width - sidebar - resizers - mainMin));
  if (kind === "changes") return Math.max(280, Math.min(620, width - sidebar - inspector - resizers - 360));
  if (kind === "stage") return Math.max(240, Math.min(500, height - 260));
  if (kind === "commitForm") {
    const stageHeight = numericCssVar("--stage-h") || 300;
    return Math.max(110, Math.min(320, stageHeight - 90));
  }
  return 520;
}

function configMax(config) {
  return typeof config.max === "function" ? config.max() : config.max;
}

function numericCssVar(name) {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initials(name) {
  const parts = String(name || "?").trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return escapeHtml((parts[0][0] + parts[1][0]).toUpperCase());
  return escapeHtml(parts[0]?.slice(0, 2).toUpperCase() || "?");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function toast(message) {
  const text = String(message || "");
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  const duration = clamp(2200 + text.length * 45, 2600, text.includes("\n") ? 16000 : 7600);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), duration);
}

els.openRepo.addEventListener("click", openRepo);
els.cloneRepo.addEventListener("click", openCloneModal);
els.initRepo.addEventListener("click", openInitModal);
els.openCommandPalette.addEventListener("click", openCommandPalette);
els.repoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openRepo();
});
els.recentRepoSelect.addEventListener("change", () => {
  openRecentRepo().catch((error) => toast(error.message));
});
els.clearRecentRepos.addEventListener("click", clearRecentRepos);
els.cloneForm.addEventListener("submit", submitCloneForm);
els.cloneCancel.addEventListener("click", closeCloneModal);
els.cloneUrlInput.addEventListener("input", syncCloneTargetSuggestion);
els.cloneTargetInput.addEventListener("input", () => {
  state.cloneTargetAuto = !els.cloneTargetInput.value.trim();
});
els.initForm.addEventListener("submit", submitInitForm);
els.initCancel.addEventListener("click", closeInitModal);
els.commandClose.addEventListener("click", closeCommandPalette);
els.commandPalette.addEventListener("click", (event) => {
  if (event.target === els.commandPalette) closeCommandPalette();
});
els.commandInput.addEventListener("input", () => {
  state.commandPaletteIndex = 0;
  renderCommandPalette();
});
els.commandInput.addEventListener("keydown", handleCommandPaletteKeydown);
els.commandList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-command-id]");
  if (!button || button.disabled) return;
  executeCommandPaletteItem(button.dataset.commandId).catch((error) => toast(error.message));
});
els.branchFilterInput.addEventListener("input", () => updateBranchFilter(els.branchFilterInput.value));
els.clearBranchFilter.addEventListener("click", clearBranchFilter);
els.worktreeFilterInput.addEventListener("input", () => updateWorktreeFilter(els.worktreeFilterInput.value));
els.clearWorktreeFilter.addEventListener("click", clearWorktreeFilter);
els.searchInput.addEventListener("input", renderCommits);
els.clearSearch.addEventListener("click", clearCommitSearch);
els.themeToggle.addEventListener("click", toggleTheme);
els.newBranch.addEventListener("click", openBranchModal);
els.branchForm.addEventListener("submit", submitBranchForm);
els.branchCancel.addEventListener("click", closeBranchModal);
els.branchModal.addEventListener("click", (event) => {
  if (event.target === els.branchModal) closeBranchModal();
});
els.tagForm.addEventListener("submit", createTagFromForm);
els.tagCancel.addEventListener("click", closeTagModal);
els.tagModal.addEventListener("click", (event) => {
  if (event.target === els.tagModal) closeTagModal();
});
els.cloneModal.addEventListener("click", (event) => {
  if (event.target === els.cloneModal) closeCloneModal();
});
els.initModal.addEventListener("click", (event) => {
  if (event.target === els.initModal) closeInitModal();
});
els.mainlineForm.addEventListener("submit", (event) => {
  submitMainlineForm(event).catch((error) => toast(error.message));
});
els.mainlineCancel.addEventListener("click", closeMainlineModal);
els.mainlineModal.addEventListener("click", (event) => {
  if (event.target === els.mainlineModal) closeMainlineModal();
});
els.refreshChanges.addEventListener("click", () => refreshWorktree(false));
els.maximizeDiff.addEventListener("click", openDiffModal);
document.querySelectorAll("[data-work-diff-scope]").forEach((button) => {
  button.addEventListener("click", () => switchWorkDiffScope(button.dataset.workDiffScope, button).catch((error) => toast(error.message)));
});
els.workDiffView.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hunk-action]");
  if (!button) return;
  event.preventDefault();
  if (!button.disabled) runWorkDiffHunkAction(button.dataset.hunkAction, button).catch((error) => toast(error.message));
});
document.querySelectorAll("[data-work-diff-action]").forEach((button) => {
  button.addEventListener("click", () => runWorkDiffFileAction(button.dataset.workDiffAction, button));
});
els.closeDiffModal.addEventListener("click", closeDiffModal);
els.diffModal.addEventListener("click", (event) => {
  if (event.target === els.diffModal) closeDiffModal();
});
els.stashChanges.addEventListener("click", () => createStashFromSelection(null));
els.stageAll.addEventListener("click", () => runAction("stageAll"));
els.discardAll.addEventListener("click", () => runAction("discardAll"));
els.amendToggle.addEventListener("change", () => {
  updateAmendMode();
  if (els.amendToggle.checked) fillLatestCommitMessage();
});
els.commitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(els.amendToggle.checked ? "amendCommit" : "commit");
});
els.detailBody.addEventListener("submit", (event) => {
  const worktreeForm = event.target.closest("[data-worktree-form]");
  if (worktreeForm) {
    event.preventDefault();
    submitWorktreeForm(worktreeForm).catch((error) => toast(error.message));
    return;
  }
  const form = event.target.closest("[data-reword-form]");
  if (!form) return;
  event.preventDefault();
  rewordSelectedCommit(form);
});
els.detailBody.addEventListener("input", (event) => {
  const compareRef = event.target.closest("[data-compare-ref]");
  if (compareRef && state.selectedTab === "compare") {
    updateComparePickerState();
    return;
  }
  const historyQueueField = event.target.closest("[data-history-queue-field]");
  if (historyQueueField) {
    updateHistoryQueueField(historyQueueField);
    return;
  }
  const filter = event.target.closest("[data-recovery-filter]");
  if (filter && state.selectedTab === "recovery") {
    updateRecoveryFilter(filter.dataset.recoveryFilter, filter.value, filter);
    return;
  }
  const policy = event.target.closest("[data-recovery-policy]");
  if (policy && state.selectedTab === "recovery") {
    updateRecoveryPolicy(policy.dataset.recoveryPolicy, policy.value, policy);
  }
});
els.detailBody.addEventListener("keydown", (event) => {
  const compareRef = event.target.closest("[data-compare-ref]");
  if (!compareRef || state.selectedTab !== "compare" || event.key !== "Enter") return;
  event.preventDefault();
  runCompareFromPicker().catch((error) => toast(error.message));
});
els.detailBody.addEventListener("change", (event) => {
  const historyQueueMode = event.target.closest('select[data-history-queue-action="changeMode"]');
  if (historyQueueMode) {
    event.preventDefault();
    runHistoryRewriteQueue("changeMode", historyQueueMode).catch((error) => toast(error.message));
    return;
  }
  const filter = event.target.closest("[data-recovery-filter]");
  if (filter && state.selectedTab === "recovery") {
    updateRecoveryFilter(filter.dataset.recoveryFilter, filter.value, filter);
    return;
  }
  const policy = event.target.closest("[data-recovery-policy]");
  if (policy && state.selectedTab === "recovery") {
    updateRecoveryPolicy(policy.dataset.recoveryPolicy, policy.value, policy);
  }
});
els.detailBody.addEventListener("click", (event) => {
  const branchCleanupAction = event.target.closest("[data-branch-cleanup-action]");
  if (branchCleanupAction) {
    event.preventDefault();
    if (!branchCleanupAction.disabled) {
      runBranchCleanupAction(branchCleanupAction.dataset.branchCleanupAction, branchCleanupAction).catch((error) => toast(error.message));
    }
    return;
  }
  const worktreeAction = event.target.closest("[data-worktree-action]");
  if (worktreeAction) {
    event.preventDefault();
    if (!worktreeAction.disabled) {
      runWorktreeAction(worktreeAction.dataset.worktreeAction, worktreeAction).catch((error) => toast(error.message));
    }
    return;
  }
  const compareRun = event.target.closest("[data-compare-run]");
  if (compareRun) {
    event.preventDefault();
    if (!compareRun.disabled) runCompareFromPicker().catch((error) => toast(error.message));
    return;
  }
  const compareSwap = event.target.closest("[data-compare-swap]");
  if (compareSwap) {
    event.preventDefault();
    if (!compareSwap.disabled) swapCompareRefs().catch((error) => toast(error.message));
    return;
  }
  const syncAction = event.target.closest("[data-sync-action]");
  if (syncAction) {
    event.preventDefault();
    if (!syncAction.disabled) runAction(syncAction.dataset.syncAction).catch((error) => toast(error.message));
    return;
  }
  const syncPrAction = event.target.closest("[data-sync-pr-action]");
  if (syncPrAction) {
    event.preventDefault();
    if (!syncPrAction.disabled) runSyncPullRequestAction(syncPrAction.dataset.syncPrAction).catch((error) => toast(error.message));
    return;
  }
  const remoteCommandCopy = event.target.closest("[data-copy-remote-command]");
  if (remoteCommandCopy) {
    event.preventDefault();
    copyText(remoteCommandCopy.dataset.copyRemoteCommand || "").then(() => toast("已复制诊断命令")).catch((error) => toast(error.message));
    return;
  }
  const remoteAction = event.target.closest("[data-remote-action]");
  if (remoteAction) {
    event.preventDefault();
    if (!remoteAction.disabled) {
      runRemoteAction(remoteAction.dataset.remoteAction, remoteAction.dataset.remoteName || "", remoteAction).catch((error) => toast(error.message));
    }
    return;
  }
  const upstreamAction = event.target.closest("[data-upstream-action]");
  if (upstreamAction) {
    event.preventDefault();
    if (!upstreamAction.disabled) {
      runUpstreamAction(upstreamAction.dataset.upstreamAction, "", upstreamAction).catch((error) => toast(error.message));
    }
    return;
  }
  const syncCommit = event.target.closest("[data-sync-commit]");
  if (syncCommit) {
    event.preventDefault();
    const sha = syncCommit.dataset.syncCommit;
    selectSyncCommit(sha).catch((error) => toast(error.message));
    return;
  }
  const compareRefresh = event.target.closest("[data-compare-refresh]");
  if (compareRefresh) {
    event.preventDefault();
    refreshCompare().catch((error) => toast(error.message));
    return;
  }
  const compareTarget = event.target.closest("[data-compare-view-target]");
  if (compareTarget) {
    event.preventDefault();
    const head = state.compare?.data?.head || state.compare?.head || "";
    if (head) {
      state.selectedTab = "details";
      selectRef(head).catch((error) => toast(error.message));
    }
    return;
  }
  const compareCommit = event.target.closest("[data-compare-commit]");
  if (compareCommit) {
    event.preventDefault();
    const sha = compareCommit.dataset.compareCommit || "";
    if (sha) {
      state.selectedTab = "details";
      selectCommit(sha).catch((error) => toast(error.message));
    }
    return;
  }
  const recoveryAction = event.target.closest("[data-recovery-action]");
  if (recoveryAction) {
    event.preventDefault();
    if (!recoveryAction.disabled) {
      runRecoveryAction(recoveryAction.dataset.recoveryAction, recoveryAction.dataset.recoveryRef || state.selectedRecoveryRef || "", recoveryAction).catch((error) => toast(error.message));
    }
    return;
  }
  const recoveryFilterReset = event.target.closest("[data-recovery-filter-reset]");
  if (recoveryFilterReset) {
    event.preventDefault();
    resetRecoveryFilter();
    return;
  }
  const recoveryPrune = event.target.closest("[data-recovery-prune]");
  if (recoveryPrune) {
    event.preventDefault();
    if (!recoveryPrune.disabled) pruneRecoveryPointsByPolicy(recoveryPrune).catch((error) => toast(error.message));
    return;
  }
  const recoveryBulkDelete = event.target.closest("[data-recovery-bulk-delete]");
  if (recoveryBulkDelete) {
    event.preventDefault();
    if (!recoveryBulkDelete.disabled) deleteFilteredRecoveryPoints(recoveryBulkDelete).catch((error) => toast(error.message));
    return;
  }
  const recoveryRow = event.target.closest(".recovery-row[data-recovery-ref]");
  if (recoveryRow) {
    event.preventDefault();
    selectRecoveryPoint(recoveryRow.dataset.recoveryRef || "");
    return;
  }
  const logRefresh = event.target.closest("[data-log-refresh]");
  if (logRefresh) {
    event.preventDefault();
    refreshLogsTab().catch((error) => toast(error.message));
    return;
  }
  const fileHistoryOpen = event.target.closest("[data-file-history-open]");
  if (fileHistoryOpen) {
    event.preventDefault();
    if (!fileHistoryOpen.disabled) {
      openFileHistory(fileHistoryOpen.dataset.file || "", fileHistoryOpen.dataset.ref || "").catch((error) => toast(error.message));
    }
    return;
  }
  const fileHistoryRefresh = event.target.closest("[data-file-history-refresh]");
  if (fileHistoryRefresh) {
    event.preventDefault();
    openFileHistory(state.fileHistory.file, state.fileHistory.ref).catch((error) => toast(error.message));
    return;
  }
  const fileHistoryAction = event.target.closest("[data-file-history-action]");
  if (fileHistoryAction) {
    event.preventDefault();
    runFileHistoryAction(fileHistoryAction.dataset.fileHistoryAction, fileHistoryAction).catch((error) => toast(error.message));
    return;
  }
  const fileBlameOpen = event.target.closest("[data-file-blame-open]");
  if (fileBlameOpen) {
    event.preventDefault();
    if (!fileBlameOpen.disabled) {
      openFileBlame(fileBlameOpen.dataset.file || "", fileBlameOpen.dataset.ref || "").catch((error) => toast(error.message));
    }
    return;
  }
  const fileBlameRefresh = event.target.closest("[data-file-blame-refresh]");
  if (fileBlameRefresh) {
    event.preventDefault();
    openFileBlame(state.fileBlame.file, state.fileBlame.ref).catch((error) => toast(error.message));
    return;
  }
  const fileBlameAction = event.target.closest("[data-file-blame-action]");
  if (fileBlameAction) {
    event.preventDefault();
    runFileBlameAction(fileBlameAction.dataset.fileBlameAction, fileBlameAction).catch((error) => toast(error.message));
    return;
  }
  const historyPlanAction = event.target.closest("[data-history-plan-action]");
  if (historyPlanAction) {
    event.preventDefault();
    if (!historyPlanAction.disabled) {
      runHistoryRewritePlan(historyPlanAction.dataset.historyPlanAction, historyPlanAction).catch((error) => toast(error.message));
    }
    return;
  }
  const historyQueueAction = event.target.closest("[data-history-queue-action]");
  if (historyQueueAction) {
    event.preventDefault();
    if (historyQueueAction.tagName === "SELECT") return;
    if (!historyQueueAction.disabled) {
      runHistoryRewriteQueue(historyQueueAction.dataset.historyQueueAction, historyQueueAction).catch((error) => toast(error.message));
    }
    return;
  }
  const button = event.target.closest("[data-commit-tool]");
  if (!button) return;
  event.preventDefault();
  if (button.disabled) return;
  runCommitToolAction(button.dataset.commitTool, button.dataset.sha).catch((error) => toast(error.message));
});
els.detailBody.addEventListener("contextmenu", (event) => {
  const cleanupRow = event.target.closest(".branch-cleanup-row[data-branch-name]");
  if (cleanupRow) {
    event.preventDefault();
    event.stopPropagation();
    const branch = cleanupRow.dataset.branchName || "";
    if (branch) showBranchContextMenu(event, branch, branchCleanupContextOptions(branch));
    return;
  }
  const remoteRow = event.target.closest(".remote-row[data-remote-name]");
  if (remoteRow) {
    event.preventDefault();
    event.stopPropagation();
    const remote = findRemote(remoteRow.dataset.remoteName || "");
    if (remote) showRemoteContextMenu(event, remote);
    return;
  }
  const tagRow = event.target.closest(".tag-row[data-tag-name]");
  if (!tagRow) return;
  event.preventDefault();
  event.stopPropagation();
  const tag = (state.data?.tags || []).find((item) => item.name === tagRow.dataset.tagName);
  if (tag) {
    state.selectedTag = tag.name;
    renderInspector();
    showTagContextMenu(event, tag);
  }
});
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.action));
});
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.selectedTab = tab.dataset.tab;
    renderInspector();
  });
});
document.addEventListener("click", (event) => {
  const commitMenuAction = event.target.closest("[data-commit-action]");
  if (commitMenuAction) {
    event.stopPropagation();
    if (!commitMenuAction.disabled) {
      runCommitContextAction(commitMenuAction.dataset.commitAction).catch((error) => toast(error.message));
    }
    return;
  }
  const branchMenuAction = event.target.closest("[data-branch-action]");
  if (branchMenuAction) {
    event.stopPropagation();
    if (!branchMenuAction.disabled) {
      runBranchContextAction(branchMenuAction.dataset.branchAction).catch((error) => toast(error.message));
    }
    return;
  }
  const fileMenuAction = event.target.closest("[data-file-action]");
  if (fileMenuAction) {
    event.stopPropagation();
    if (!fileMenuAction.disabled) {
      runFileContextAction(fileMenuAction.dataset.fileAction).catch((error) => toast(error.message));
    }
    return;
  }
  const tagMenuAction = event.target.closest("#tagContextMenu [data-tag-action]");
  if (tagMenuAction) {
    event.stopPropagation();
    const tagName = state.contextTag?.name || "";
    hideTagContextMenu();
    if (!tagMenuAction.disabled) {
      runTagAction(tagMenuAction.dataset.tagAction, tagName, tagMenuAction).catch((error) => toast(error.message));
    }
    return;
  }
  const remoteMenuAction = event.target.closest("#remoteContextMenu [data-remote-menu-action]");
  if (remoteMenuAction) {
    event.stopPropagation();
    if (!remoteMenuAction.disabled) {
      runRemoteMenuAction(remoteMenuAction.dataset.remoteMenuAction).catch((error) => toast(error.message));
    }
    return;
  }
  if (!event.target.closest("#commitContextMenu")) hideCommitContextMenu();
  if (!event.target.closest("#branchContextMenu")) hideBranchContextMenu();
  if (!event.target.closest("#fileContextMenu")) hideFileContextMenu();
  if (!event.target.closest("#tagContextMenu")) hideTagContextMenu();
  if (!event.target.closest("#remoteContextMenu")) hideRemoteContextMenu();
  const stashAction = event.target.closest("[data-stash-action]");
  if (stashAction) {
    event.stopPropagation();
    runStashAction(stashAction.dataset.stashAction, stashAction.dataset.stashRef || "", stashAction);
    return;
  }
  const stashRow = event.target.closest("[data-stash-ref]");
  if (stashRow && stashRow.classList.contains("stash-row")) {
    event.stopPropagation();
    selectStash(stashRow.dataset.stashRef || "");
    return;
  }
  const tagAction = event.target.closest("[data-tag-action]");
  if (tagAction) {
    event.stopPropagation();
    runTagAction(tagAction.dataset.tagAction, tagAction.dataset.tagName || state.selectedTag || "", tagAction).catch((error) => toast(error.message));
    return;
  }
  const tagRow = event.target.closest("[data-tag-name]");
  if (tagRow && tagRow.classList.contains("tag-row")) {
    event.stopPropagation();
    selectTag(tagRow.dataset.tagName || "");
    return;
  }
  const bulkAction = event.target.closest("[data-bulk-file-action]");
  if (bulkAction) {
    event.stopPropagation();
    runFileBatchAction(bulkAction.dataset.bulkFileAction, bulkAction.dataset.scope || "", bulkAction);
    return;
  }
  const repoOperation = event.target.closest("[data-repo-operation]");
  if (repoOperation) {
    event.stopPropagation();
    runRepoOperation(repoOperation.dataset.repoOperation, repoOperation);
    return;
  }
  if (event.target.closest("[data-open-diff-modal]")) openDiffModal();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }
  if (event.key === "Escape" && els.commandPalette.classList.contains("show")) {
    closeCommandPalette();
    return;
  }
  if (event.key === "Escape" && els.diffModal.classList.contains("show")) closeDiffModal();
  if (event.key === "Escape" && els.cloneModal.classList.contains("show")) closeCloneModal();
  if (event.key === "Escape" && els.initModal.classList.contains("show")) closeInitModal();
  if (event.key === "Escape" && els.branchModal.classList.contains("show")) closeBranchModal();
  if (event.key === "Escape" && els.tagModal.classList.contains("show")) closeTagModal();
  if (event.key === "Escape" && els.mainlineModal.classList.contains("show")) closeMainlineModal();
  if (event.key === "Escape" && els.commitContextMenu.classList.contains("show")) hideCommitContextMenu();
  if (event.key === "Escape" && els.branchContextMenu.classList.contains("show")) hideBranchContextMenu();
  if (event.key === "Escape" && els.fileContextMenu.classList.contains("show")) hideFileContextMenu();
  if (event.key === "Escape" && els.tagContextMenu.classList.contains("show")) hideTagContextMenu();
  if (event.key === "Escape" && els.remoteContextMenu.classList.contains("show")) hideRemoteContextMenu();
});
document.addEventListener("scroll", () => {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
}, true);
window.addEventListener("resize", () => {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
});

initTheme();
initLayoutResizers();
initWorktreeAutoRefresh();
updateAmendMode();
init();
