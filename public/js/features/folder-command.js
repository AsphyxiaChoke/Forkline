// Folder picker and command palette.
async function openFolderModal() {
  if (otherModalOpen()) return;
  els.folderModal.classList.add("show");
  els.folderModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const currentPath = state.data?.repo && !state.data.repo.isSample ? state.data.repo.path : recentRepos()[0]?.path || "";
  await loadFolder(els.repoInput.value.trim() || currentPath);
}

function closeFolderModal() {
  els.folderModal.classList.remove("show");
  els.folderModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function loadFolder(pathValue = "") {
  const requestId = ++state.folderBrowseRequestId;
  els.folderList.innerHTML = `<div class="folder-empty">${t("正在读取目录...")}</div>`;
  try {
    const data = await api(`/api/browse?path=${encodeURIComponent(pathValue || "")}`);
    if (requestId !== state.folderBrowseRequestId) return;
    state.folderBrowse = data;
    renderFolderBrowser();
  } catch (error) {
    if (requestId !== state.folderBrowseRequestId) return;
    els.folderList.innerHTML = `<div class="folder-empty">${escapeHtml(error.message)}</div>`;
    toast(error.message);
  }
}

function renderFolderBrowser() {
  const data = state.folderBrowse;
  if (!data) return;
  els.folderCurrentPath.textContent = data.current || "";
  els.folderPathInput.value = data.current || "";
  els.folderParent.disabled = !data.parent;
  els.folderOpen.textContent = data.isGit ? t("打开 Git 仓库") : t("打开此目录");
  els.folderOpen.title = data.isGit ? t("打开当前 Git 仓库") : t("把当前目录填入路径并尝试打开");
  const shortcuts = (data.shortcuts || [])
    .map((item) => `<button class="folder-root folder-shortcut" type="button" data-folder-path="${escapeAttr(item.path)}">${escapeHtml(t(item.name))}</button>`)
    .join("");
  const roots = (data.roots || [])
    .map((root) => `<button class="folder-root" type="button" data-folder-path="${escapeAttr(root.path)}">${escapeHtml(root.name)}</button>`)
    .join("");
  els.folderRoots.innerHTML = `${shortcuts}${roots}`;
  els.folderList.innerHTML = (data.entries || []).length
    ? data.entries
        .map(
          (entry) => `
            <button class="folder-row ${entry.isGit ? "is-git" : ""}" type="button" data-folder-path="${escapeAttr(entry.path)}" title="${escapeAttr(entry.path)}">
              <span class="folder-icon">${entry.isGit ? "Git" : ""}</span>
              <span class="folder-name">${escapeHtml(entry.name)}</span>
              <span class="folder-meta">${entry.isGit ? t("仓库") : ""}</span>
            </button>
          `
        )
        .join("")
    : `<div class="folder-empty">${t("这个目录下没有可进入的文件夹")}</div>`;
}

async function openSelectedFolder() {
  const target = state.folderBrowse?.current || els.folderPathInput.value.trim();
  if (!target) return;
  els.repoInput.value = target;
  closeFolderModal();
  await openRepo(target);
}

function openCommandPalette() {
  if (otherModalOpen()) return;
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  hideReflogContextMenu();
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
    els.cloneModal,
    els.initModal,
    els.patchModal,
    els.branchModal,
    els.tagModal,
    els.mainlineModal,
    els.diffModal,
    els.folderModal,
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
    els.commandList.innerHTML = `<div class="command-empty">${t("没有匹配的命令")}</div>`;
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
  const sync = state.data?.sync || {};
  const pullRequest = sync.pullRequest || {};
  const branch = state.data?.repo?.branch || t("当前分支");
  const hasUsableUpstream = Boolean(sync.upstream && !sync.upstreamGone);
  const canPush = realRepo && !syncPushGuard(sync).blocked;
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
    commandItem("tabSubmodules", "打开子模块", "查看和更新 Git submodule", "git submodule", "submodule modules dependency update init sync", hasRepo, () => switchInspectorTab("submodules")),
    commandItem("tabSync", "打开同步", "查看 upstream、待拉取和待推送提交", "同步", "fetch pull push upstream", hasRepo, () => switchInspectorTab("sync")),
    commandItem("tabStashes", "打开储藏", "查看和恢复 Git stash", "储藏", "stash", hasRepo, () => switchInspectorTab("stashes")),
    commandItem("tabTags", "打开标签", "查看和管理 Tag", "标签", "tag release", hasRepo, () => switchInspectorTab("tags")),
    commandItem("tabRecovery", "打开恢复点", "查看历史编辑和重置前的恢复引用", "恢复点", "recovery reset", hasRepo, () => switchInspectorTab("recovery")),
    commandItem("tabLogs", "打开日志", "查看最近 Git 操作和失败原因", "日志", "operation log", hasRepo, () => switchInspectorTab("logs")),
    commandItem("tabSettings", "打开设置", "管理主题、最近仓库、恢复点策略和布局偏好", "设置", "settings preference theme recent layout", true, () => switchInspectorTab("settings")),
    commandItem("refreshWorktree", "刷新工作区", "重新读取未提交修改", "git status", "worktree changes", realRepo, () => refreshWorktree(false)),
    commandItem("stageAll", "暂存全部", "把所有工作区改动加入暂存区", "git add", "stage changes", realRepo && hasChanges, () => runAction("stageAll")),
    commandItem("stashAll", "储藏工作区", "把当前未提交改动移入储藏列表", "git stash", "stash changes", realRepo && hasChanges && !sync.unborn, () => createStashFromSelection(null)),
    commandItem("discardAll", "丢弃全部", "清空已暂存、未暂存和未跟踪改动", "危险", "discard clean reset", realRepo && hasChanges, () => runAction("discardAll"), true),
    commandItem("fetch", "抓取", "从远端更新引用", "git fetch", "remote sync", realRepo, () => runAction("fetch")),
    commandItem("pull", "拉取", t("快进拉取 {branch}", { branch }), "git pull", "remote sync", realRepo && hasUsableUpstream, () => runAction("pull")),
    commandItem("pullRebase", "变基拉取", t("把 {branch} 的本地提交重放到远端之后", { branch }), "git pull --rebase", "remote rebase", realRepo && hasUsableUpstream, () => runAction("pullRebase")),
    commandItem("push", "推送", t("推送 {branch}", { branch }), "git push", "remote sync", canPush, () => runAction("push")),
    commandItem("forcePushLease", "安全强推", "使用 force-with-lease 更新远端分支", "危险", "force push lease", realRepo && hasUsableUpstream && !sync.unborn, () => runAction("forcePushLease"), true),
    commandItem("openPullRequest", pullRequest.title || "创建 PR", t("为 {branch} 打开 {platform} PR/MR 页面", { branch, platform: t(pullRequest.platformLabel || "远端") }), "web", "pull request merge request pr mr github gitlab", Boolean(pullRequest.available), () => runSyncPullRequestAction("open")),
    commandItem("copyPullRequest", "复制 PR 链接", "复制当前分支的 PR/MR 创建地址", "copy", "pull request merge request pr mr clipboard", Boolean(pullRequest.available), () => runSyncPullRequestAction("copy")),
    commandItem("newBranch", "新建分支", hasCommit ? t("从选中提交 {sha} 创建本地分支", { sha: commit.short }) : "从当前 HEAD 创建本地分支", "git branch", "branch checkout commit", hasRepo, openBranchModal),
    commandItem("applyPatch", "应用补丁", "粘贴 .patch / diff 到当前仓库", "git apply", "patch diff apply format-patch", realRepo, openPatchModal),
    commandItem("copyPatch", "复制选中提交补丁", "把选中提交导出为 format-patch 文本", "format-patch", "patch diff copy", hasCommit, () => copyCommitPatch(commit)),
    commandItem("downloadPatch", "下载选中提交补丁", "把选中提交保存为 .patch 文件", ".patch", "patch diff download format-patch", hasCommit, () => downloadCommitPatch(commit)),
    commandItem("createTag", "创建 Tag", "基于当前提交创建 Tag", "git tag", "release tag", hasCommit, () => openTagModal(commit)),
    commandItem("copySha", "复制提交 SHA", "复制当前选中提交的完整 SHA", "复制", "clipboard commit sha", hasCommit, async () => {
      await copyText(commit.sha);
      toast(t("已复制提交 SHA"));
    }),
    commandItem("openRemoteCommit", "在远端查看", "打开当前提交的网页远端地址", "web", "github gitlab bitbucket", Boolean(remoteCommit), () => openRemoteCommit(commit)),
    commandItem("cloneRepo", "克隆仓库", "从远端 URL 或本地裸仓库创建工作区", "git clone", "clone repository", true, openCloneModal),
    commandItem("initRepo", "初始化仓库", "把本机文件夹创建为 Git 仓库", "git init", "init repository", true, openInitModal),
  ];
}

function commandItem(id, title, description, hint, keywords, enabled, run, danger = false) {
  return {
    id,
    title: t(title),
    description: t(description),
    hint: t(hint),
    keywords,
    disabled: !enabled,
    danger,
    run,
  };
}

function selectedCommandCommit() {
  return commitRecordForSha(state.selectedSha) || state.data?.commits?.[0] || null;
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
  if (tab === "fileHistory" && state.selectedFile && state.fileHistory.file !== state.selectedFile) {
    openFileHistory(state.selectedFile).catch((error) => toast(error.message));
  }
  if (tab === "fileBlame" && state.selectedFile && state.fileBlame.file !== state.selectedFile) {
    openFileBlame(state.selectedFile).catch((error) => toast(error.message));
  }
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
    toast(t("当前命令不可用"));
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

