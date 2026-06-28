// Stashes, sync, compare, remotes, and auth panels.
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

