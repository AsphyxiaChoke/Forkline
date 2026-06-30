// Context menus for commits, branches, files, tags, remotes, and reflog entries.
async function selectCommit(sha) {
  if (!sha) return;
  if (state.historyPlan?.sha !== sha) state.historyPlan = null;
  setInspectorContext("commit", inspectorTabs.commit.includes(state.selectedTab) ? state.selectedTab : "details");
  state.selectedSha = sha;
  renderCommits({ inspector: "never" });
  await loadCommit(sha);
  renderInspector();
}

function showCommitContextMenu(event, commit) {
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  hideReflogContextMenu();
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
  hideReflogContextMenu();
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
  hideReflogContextMenu();
  const fileInfo = contextWorkingFileInfo(filePath, scope);
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

function contextWorkingFileInfo(filePath, scope = "") {
  const matches = (state.data?.workingFiles || []).filter((file) => file.file === filePath);
  if (scope === "staged") return matches.find((file) => file.staged) || matches[0] || null;
  if (scope === "unstaged" || scope === "untracked") return matches.find((file) => file.unstaged || (!file.staged && file.unstaged !== false)) || matches[0] || null;
  return matches.find((file) => file.unstaged || (!file.staged && file.unstaged !== false)) || matches.find((file) => file.staged) || matches[0] || null;
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
  hideReflogContextMenu();
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
  hideReflogContextMenu();
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

function showReflogContextMenu(event, entry) {
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  state.contextReflogEntry = entry || null;
  const menu = els.reflogContextMenu;
  const hasEntry = Boolean(entry?.sha);
  menu.querySelectorAll("[data-reflog-menu-action]").forEach((button) => {
    button.disabled = !hasEntry;
  });
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
  positionContextMenu(menu, event, 190);
}

function hideReflogContextMenu() {
  els.reflogContextMenu.classList.remove("show");
  els.reflogContextMenu.setAttribute("aria-hidden", "true");
  state.contextReflogEntry = null;
}

async function runFileContextAction(action) {
  const context = state.contextFile;
  hideFileContextMenu();
  if (!context?.file) return;
  if (action === "diff") {
    state.selectedFile = context.file;
    if (context.scope) state.workDiffScope = context.scope === "staged" ? "staged" : "unstaged";
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

