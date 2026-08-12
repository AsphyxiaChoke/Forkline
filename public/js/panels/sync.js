// Sync state core kept on the initial page for topbar and Git actions.
function mergeSyncState(data) {
  if (!state.data || !data) return;
  const repo = data.repo || {};
  state.data.repo = {
    ...state.data.repo,
    ...(Array.isArray(repo.remoteNames) ? { remoteNames: repo.remoteNames } : {}),
  };
  if (Array.isArray(data.remotes)) state.data.remotes = data.remotes;
  if (data.remoteInfo) state.data.remoteInfo = data.remoteInfo;
  if (data.branchInfo) {
    const branchInfo = { ...(state.data.branchInfo || {}) };
    for (const [branch, info] of Object.entries(data.branchInfo)) {
      branchInfo[branch] = { ...(branchInfo[branch] || {}), ...info };
    }
    state.data.branchInfo = branchInfo;
  }
  if (data.sync) state.data.sync = data.sync;
}

function syncRepoSnapshotMatches(data, repoPath) {
  const current = state.data?.repo || {};
  const incoming = data?.repo || {};
  return incoming.path === repoPath
    && incoming.branch === current.branch
    && incoming.headSha === current.headSha;
}

async function refreshSyncState() {
  if (!state.data) return false;
  const repoPath = repoPathSnapshot();
  const requestId = ++state.syncRequestId;
  try {
    const data = await api("/api/sync-state");
    if (requestId !== state.syncRequestId || !isCurrentRepoPath(repoPath)) return false;
    if (!syncRepoSnapshotMatches(data, repoPath)) {
      toast(t("仓库当前分支或最新提交已经变化，请先刷新仓库再查看同步状态。"));
      return false;
    }
    mergeSyncState(data);
    renderBranches();
    if (state.selectedTab === "sync") renderInspector();
    return true;
  } catch (error) {
    if (requestId !== state.syncRequestId || !isCurrentRepoPath(repoPath)) return false;
    toast(error.message);
    return false;
  }
}

function syncPushGuard(sync) {
  if (sync?.detached) {
    return { blocked: true, title: t("当前处于游离 HEAD，不能直接推送分支"), text: t("推送保护：当前处于游离 HEAD，请先切换或创建本地分支。") };
  }
  if (sync?.unborn) {
    return { blocked: true, title: t("当前分支还没有首个提交，不能推送"), text: t("推送保护：当前分支还没有任何提交。请先创建首个提交后再推送。") };
  }
  if (sync?.upstreamGone) {
    const upstream = sync.upstream || "upstream";
    return {
      blocked: true,
      title: t("upstream {upstream} 已不存在", { upstream }),
      text: t("推送保护：{upstream} 已不存在。请抓取远端后重新设置 upstream；如果要重新创建远端分支，先取消 upstream 再推送。", { upstream }),
    };
  }
  const behind = sync?.behind || 0;
  const ahead = sync?.ahead || 0;
  if (behind > 0) {
    const stateText = ahead ? t("本地领先 {ahead}，同时落后 {behind}", { ahead, behind }) : t("本地落后 {behind}", { behind });
    return {
      blocked: true,
      title: t("{state}，普通推送已保护", { state: stateText }),
      text: t("推送保护：{state}。请先检查待拉取提交；通常使用“变基拉取”把本地提交移到远端之后，如果确认要改写远端历史，再使用安全强推。", { state: stateText }),
    };
  }
  return { blocked: false, title: "", text: "" };
}
