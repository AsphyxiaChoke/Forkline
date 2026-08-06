// Sync overview and lightweight sync-state refresh.
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
  if (selectedSyncCommit && !selectedSyncDetail?.diffLoaded) {
    loadSyncCommitPreview(selectedSyncCommit.sha);
  }
  const previewModel = selectedSyncCommit ? syncPreviewModel(selectedSyncCommit, selectedSyncDetail) : null;
  const remotes = sync.remotes || [];
  const authState = prepareSyncAuthState(sync.auth, remotes);
  const pushGuard = syncPushGuard(sync);
  const pullRequest = sync.pullRequest || {};
  els.detailNode.style.borderColor = upstreamGone ? "var(--danger)" : hasUpstream ? "var(--teal)" : "var(--yellow)";
  els.detailTitle.textContent = t("同步详情");
  els.detailSub.textContent = sync.branch ? `${sync.branch}${sync.upstream ? ` -> ${sync.upstream}` : t(" · 未设置 upstream")}` : t("当前分支");
  if (selectedSyncCommit && previewModel?.selectedDiff?.length) {
    const fileLabel = previewModel.selectedFile ? `${selectedSyncCommit.short || selectedSyncCommit.sha.slice(0, 7)} · ${previewModel.selectedFile}` : selectedSyncCommit.message;
    setActiveDiff({ source: "sync", title: t("{sha} · 同步提交", { sha: selectedSyncCommit.short || selectedSyncCommit.sha.slice(0, 7) }), path: fileLabel, diff: previewModel.selectedDiff, emptyText: t("没有可显示的同步改动") });
  } else {
    setActiveDiff(null);
  }
  els.detailBody.innerHTML = tt`
    <div class="sync-actions">
      <button class="mini-btn" data-sync-action="fetch" type="button"><span>抓取</span><span class="command-hint">git fetch</span></button>
      <button class="mini-btn" data-sync-action="pull" type="button" ${hasUpstream && !upstreamGone ? "" : "disabled"}><span>拉取</span><span class="command-hint">git pull</span></button>
      <button class="mini-btn" data-sync-action="pullRebase" type="button" ${hasUpstream && !upstreamGone ? "" : "disabled"} title="git pull --rebase"><span>变基拉取</span><span class="command-hint">pull --rebase</span></button>
      <button class="mini-btn" data-sync-action="push" type="button" ${pushGuard.blocked ? "disabled" : ""} title="${escapeAttr(pushGuard.title || "git push")}"><span>推送</span><span class="command-hint">git push</span></button>
      <button class="mini-btn danger" data-sync-action="forcePushLease" type="button" ${hasUpstream && !upstreamGone ? "" : "disabled"}><span>安全强推</span><span class="command-hint">--force-with-lease</span></button>
      <button class="mini-btn" data-sync-pr-action="open" type="button" ${pullRequest.available ? "" : "disabled"} title="${escapeAttr(pullRequest.available ? pullRequest.url : t(pullRequest.reason || "当前分支不能创建 PR"))}"><span>${escapeHtml(t(pullRequest.title || "创建 PR"))}</span><span class="command-hint">${escapeHtml(t(pullRequest.platformLabel || "web"))}</span></button>
      <button class="mini-btn" data-sync-pr-action="copy" type="button" ${pullRequest.available ? "" : "disabled"} title="${escapeAttr(pullRequest.available ? pullRequest.url : t(pullRequest.reason || "当前分支不能创建 PR"))}"><span>复制 PR 链接</span><span class="command-hint">copy</span></button>
    </div>
    <div class="meta-grid sync-meta">
      <span>当前分支</span><div class="meta-value">${escapeHtml(sync.branch || state.data?.repo?.branch || t("未知"))}</div>
      <span>Upstream</span><div class="meta-value">${escapeHtml(sync.upstream || t("未设置"))}</div>
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
    ${syncAuthHtml(authState, remotes)}
    <div class="detail-section-title">待拉取提交</div>
    ${syncCommitListHtml(incoming, "远端没有本地缺少的提交")}
    <div class="detail-section-title">待推送提交</div>
    ${syncCommitListHtml(outgoing, "本地没有待推送提交")}
    ${syncCommits.length ? `<div class="detail-section-title">${t("同步提交预览")}</div>${syncCommitPreviewHtml(selectedSyncCommit, selectedSyncDetail, previewModel)}` : ""}
  `;
  bindFileTree(els.detailBody, { mode: "sync" });
}

function syncStatusText(sync) {
  if (sync?.unborn) return t("还没有首个提交");
  if (!sync?.upstream) return t("未设置 upstream");
  if (sync.upstreamGone) return t("上游分支已不存在");
  const ahead = sync.ahead || 0;
  const behind = sync.behind || 0;
  if (ahead && behind) return t("分叉：领先 {ahead}，落后 {behind}", { ahead, behind });
  if (ahead) return t("领先 {count}", { count: ahead });
  if (behind) return t("落后 {count}", { count: behind });
  return t("与上游一致");
}

function syncAdviceText(sync) {
  if (sync?.detached) return t("当前处于游离 HEAD，请先切换或创建本地分支。");
  if (sync?.unborn) return t("当前分支还没有首个提交。请先提交一次，再推送或计算领先/落后。");
  if (!sync?.upstream) return t("可以普通推送一次来建立 upstream。");
  if (sync.upstreamGone) return t("普通推送已保护。请先抓取远端，确认是否需要重新设置或取消 upstream。");
  const ahead = sync.ahead || 0;
  const behind = sync.behind || 0;
  if (ahead && behind) return t("普通推送已保护。请先查看待拉取提交；想保持线性历史时点“变基拉取”，确认要覆盖远端历史时再用安全强推。");
  if (behind) return t("普通推送已保护。请先查看待拉取提交；可点“拉取”快进，或点“变基拉取”保持线性历史。");
  if (ahead) return t("可以推送；如果改写过远端历史，请使用安全强推。");
  return t("不需要同步操作。");
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

function syncPushGuardHtml(guard) {
  if (!guard?.blocked) return "";
  return tt`
    <div class="sync-warning">
      <strong>普通推送已保护</strong>
      <span>${escapeHtml(guard.text)}</span>
    </div>
  `;
}

function syncPullRequestHtml(pr = {}) {
  if (!pr.available) {
    return tt`
      <div class="pr-card pr-card-muted">
        <div class="pr-card-head">
          <strong>Pull Request</strong>
          <span>${escapeHtml(t(pr.reason || "当前分支暂时不能生成 PR 链接"))}</span>
        </div>
      </div>
    `;
  }
  return tt`
    <div class="pr-card">
      <div class="pr-card-head">
        <div>
          <strong>${escapeHtml(t(pr.title || "创建 Pull Request"))}</strong>
          <span>${escapeHtml(t(pr.platformLabel || "Web"))} · ${escapeHtml(pr.remote || "origin")}</span>
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
  const canSet = remoteBranches.length && !detached && !sync?.unborn;
  const canUnset = Boolean(sync?.upstream) && !detached;
  return tt`
    <div class="upstream-panel">
      <select class="upstream-select" data-upstream-select ${canSet ? "" : "disabled"}>
        ${remoteBranches.length ? remoteBranches.map((ref) => `<option value="${escapeAttr(ref)}" ${ref === selected ? "selected" : ""}>${escapeHtml(ref)}</option>`).join("") : `<option value="">${t("没有远端分支")}</option>`}
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
    return `<div class="empty-panel compact"><span>${escapeHtml(t(emptyText))}</span></div>`;
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
    return `<div class="empty-panel compact"><span>${t("选择上方提交查看改动")}</span></div>`;
  }
  if (!detail) {
    return `<div class="empty-panel compact"><span>${t("正在读取 {sha} 的改动...", { sha: escapeHtml(commit.short || commit.sha.slice(0, 7)) })}</span></div>`;
  }
  const files = model?.files || [];
  const selectedFile = model?.selectedFile || "";
  const selectedDiff = model?.selectedDiff || [];
  return tt`
    <div class="sync-preview">
      <div class="sync-preview-head">
        <strong title="${escapeAttr(commit.message)}">${escapeHtml(commit.message)}</strong>
        <span>${escapeHtml(commit.short || commit.sha.slice(0, 7))} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
      </div>
      <div class="commit-file-view">
        <div class="commit-file-tree sync-preview-files">
          ${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">${t("没有文件列表")}</span><span></span></div>`}
        </div>
        <div class="commit-file-diff sync-preview-diff">
          <div class="panel-title compact">
            <div class="panel-title-text">
              <span>${escapeHtml(selectedFile ? shortFileName(selectedFile) : commit.short || commit.sha.slice(0, 7))}</span>
              <span class="panel-subtitle">${escapeHtml(selectedFile || t("未选择文件"))}</span>
            </div>
            <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
          </div>
          ${renderSideDiff(selectedDiff, "没有可显示的同步改动")}
        </div>
      </div>
    </div>
  `;
}
