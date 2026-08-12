// Inspector shell, commit details, files, file history, and blame panels.
function renderInspector() {
  renderInspectorTabs();
  if (state.selectedTab === "stashes") {
    renderInspectorPanelLazy("stashes");
    return;
  }
  if (state.selectedTab === "tags") {
    renderInspectorPanelLazy("tags");
    return;
  }
  if (state.selectedTab === "recovery") {
    renderInspectorPanelLazy("recovery");
    return;
  }
  if (state.selectedTab === "logs") {
    renderInspectorPanelLazy("logs");
    return;
  }
  if (state.selectedTab === "settings") {
    renderInspectorPanelLazy("settings");
    return;
  }
  if (state.selectedTab === "sync") {
    renderInspectorPanelLazy("sync");
    return;
  }
  if (state.selectedTab === "compare") {
    renderInspectorPanelLazy("compare");
    return;
  }
  if (["fileHistory", "fileBlame"].includes(state.selectedTab)) {
    renderInspectorPanelLazy("fileInsights");
    return;
  }
  if (["branches", "worktrees", "submodules"].includes(state.selectedTab)) {
    renderInspectorPanelLazy("workspaces");
    return;
  }
  const commit = commitRecordForSha(state.selectedSha);
  if (!commit) {
    els.detailTitle.textContent = t("没有提交");
    els.detailSub.textContent = t("当前列表为空");
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

function commitRecordForSha(sha) {
  if (!sha) return null;
  const graphCommit = state.data?.commits.find((item) => item.sha === sha);
  if (graphCommit) return graphCommit;
  const loadedDetail = state.commitDetails.get(sha) || {};
  const historyCommit = state.fileHistory?.data?.commits?.find((item) => item.sha === sha);
  if (historyCommit) {
    return {
      ...historyCommit,
      ...loadedDetail,
      sha: historyCommit.sha,
      short: historyCommit.short || loadedDetail.short || String(historyCommit.sha || "").slice(0, 7),
      author: loadedDetail.author || historyCommit.author,
      time: loadedDetail.time || historyCommit.time,
      message: historyCommit.message || loadedDetail.summary || loadedDetail.message,
      parents: loadedDetail.parents || historyCommit.parents || [],
      refs: historyCommit.refs || t("文件历史"),
      color: historyCommit.color || "#23c7b7",
    };
  }
  const blameLine = state.fileBlame?.data?.lines?.find((item) => item.sha === sha);
  if (!blameLine) return null;
  return {
    ...loadedDetail,
    sha: blameLine.sha,
    short: blameLine.short || loadedDetail.short || String(blameLine.sha || "").slice(0, 7),
    author: loadedDetail.author || blameLine.author || "unknown",
    time: loadedDetail.time || blameLine.time || "",
    message: blameLine.summary || loadedDetail.summary || loadedDetail.message || t("(无提交信息)"),
    refs: t("逐行追踪"),
    parents: loadedDetail.parents || [],
    files: [],
    diff: [],
    color: "#5ca9ff",
  };
}

function isGraphCommitLoaded(sha) {
  return Boolean(sha && state.data?.commits?.some((item) => item.sha === sha));
}

function renderDetailsTab(commit, detail) {
  const message = commitMessageParts(commit, detail);
  const isMergeCommit = (commit.parents || []).length > 1;
  const canFold = !isMergeCommit && (commit.parents || []).length === 1;
  const canDrop = !isMergeCommit;
  const remoteUrl = commitRemoteUrl(commit.sha);
  const historyPlanOpen = state.historyPlan?.sha === commit.sha;
  const historyQueueOpen = Boolean(
    state.historyQueue.items?.length || state.historyQueue.loading || state.historyQueue.preview || state.historyQueue.error
  );
  els.detailBody.innerHTML = tt`
    <div class="meta-grid">
      <span>提交</span><div class="meta-value">${escapeHtml(commit.short)}</div>
      <span>作者</span><div class="meta-value">${escapeHtml(commit.author)}</div>
      <span>父提交</span><div class="meta-value">${escapeHtml(commit.parents?.length ? commit.parents.map((p) => p.slice(0, 7)).join(", ") : t("根提交"))}</div>
      <span>引用</span><div class="meta-value">${escapeHtml(commit.refs || t("无"))}</div>
    </div>
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
        <span class="rewrite-note">${t(isMergeCommit ? "merge 提交暂不支持自动修改" : "保存会重写此提交之后的历史 SHA")}</span>
        <button class="mini-btn" type="submit" ${isMergeCommit ? "disabled" : ""}>保存信息</button>
      </div>
    </form>
    <div class="detail-section-title commit-action-section-title">提交操作</div>
    <div class="commit-tools commit-action-tools">
      <button class="mini-btn" data-commit-tool="branch" data-sha="${escapeAttr(commit.sha)}" type="button" title="git branch：从此提交创建本地分支"><span>新建分支</span><span class="command-hint">git branch</span></button>
      <button class="mini-btn" data-commit-tool="openRemote" data-sha="${escapeAttr(commit.sha)}" type="button" ${remoteUrl ? "" : "disabled"} title="${escapeAttr(remoteUrl ? t("打开远端提交：{url}", { url: remoteUrl }) : t("当前仓库没有可识别的网页远端 URL"))}"><span>远端查看</span><span class="command-hint">web</span></button>
      <button class="mini-btn" data-commit-tool="copyPatch" data-sha="${escapeAttr(commit.sha)}" type="button" title="git format-patch -1：复制此提交补丁"><span>复制补丁</span><span class="command-hint">format-patch</span></button>
      <button class="mini-btn" data-commit-tool="downloadPatch" data-sha="${escapeAttr(commit.sha)}" type="button" title="下载此提交的 .patch 文件"><span>下载补丁</span><span class="command-hint">.patch</span></button>
      <button class="mini-btn" data-commit-tool="cherryPick" data-sha="${escapeAttr(commit.sha)}" type="button" title="${t(isMergeCommit ? "git cherry-pick -m：挑选 merge 提交前选择主线" : "git cherry-pick：把此提交复制到当前分支")}"><span>挑选</span><span class="command-hint">${isMergeCommit ? "git cherry-pick -m" : "git cherry-pick"}</span></button>
      <button class="mini-btn" data-commit-tool="revert" data-sha="${escapeAttr(commit.sha)}" type="button" title="${t(isMergeCommit ? "git revert -m：还原 merge 提交前选择主线" : "git revert：创建一个反向提交来抵消此提交")}"><span>还原</span><span class="command-hint">${isMergeCommit ? "git revert -m" : "git revert"}</span></button>
      <button class="mini-btn" data-commit-tool="resetSoft" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --soft：移动当前分支，改动保留在已暂存区"><span>软重置</span><span class="command-hint">git reset --soft</span></button>
      <button class="mini-btn" data-commit-tool="resetMixed" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --mixed：移动当前分支，改动保留在工作区"><span>混合重置</span><span class="command-hint">git reset --mixed</span></button>
      <button class="mini-btn danger" data-commit-tool="resetHard" data-sha="${escapeAttr(commit.sha)}" type="button" title="git reset --hard：移动当前分支，并丢弃工作区改动"><span>硬重置</span><span class="command-hint">git reset --hard</span></button>
    </div>
    <details class="commit-action-disclosure" ${historyPlanOpen ? "open" : ""}>
      <summary class="detail-section-title commit-action-section-title">历史编辑</summary>
      <div class="commit-tools commit-action-tools">
        <button class="mini-btn" data-commit-tool="squash" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${t(isMergeCommit ? "merge 提交暂不支持自动压缩" : canFold ? "git rebase -i squash：把此提交和信息压缩进父提交" : "根提交没有父提交，不能压缩")}"><span>压缩进父提交</span><span class="command-hint">git rebase -i squash</span></button>
        <button class="mini-btn" data-commit-tool="fixup" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${t(isMergeCommit ? "merge 提交暂不支持自动修补" : canFold ? "git rebase -i fixup：把此提交改动修补进父提交，并丢弃此提交信息" : "根提交没有父提交，不能修补")}"><span>修补进父提交</span><span class="command-hint">git rebase -i fixup</span></button>
        <button class="mini-btn danger" data-commit-tool="drop" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${t(isMergeCommit ? "merge 提交暂不支持自动丢弃" : "git rebase -i drop：从当前分支历史中删除此提交")}"><span>丢弃此提交</span><span class="command-hint">git rebase -i drop</span></button>
      </div>
      ${renderHistoryRewritePlan(commit)}
    </details>
    <details class="commit-action-disclosure" ${historyQueueOpen ? "open" : ""}>
      <summary class="detail-section-title commit-action-section-title">历史编辑队列</summary>
      <div class="commit-tools commit-action-tools">
        <button class="mini-btn" data-commit-tool="queueSquash" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${t(canFold ? "加入历史编辑队列，执行时压缩进前一条提交" : "此提交不能加入压缩队列")}"><span>加入队列：压缩</span><span class="command-hint">queue squash</span></button>
        <button class="mini-btn" data-commit-tool="queueFixup" data-sha="${escapeAttr(commit.sha)}" type="button" ${canFold ? "" : "disabled"} title="${t(canFold ? "加入历史编辑队列，执行时修补进前一条提交" : "此提交不能加入修补队列")}"><span>加入队列：修补</span><span class="command-hint">queue fixup</span></button>
        <button class="mini-btn" data-commit-tool="queueReword" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${t(canDrop ? "加入历史编辑队列，执行时修改提交信息" : "此提交不能加入改信息队列")}"><span>加入队列：改信息</span><span class="command-hint">queue reword</span></button>
        <button class="mini-btn danger" data-commit-tool="queueDrop" data-sha="${escapeAttr(commit.sha)}" type="button" ${canDrop ? "" : "disabled"} title="${t(canDrop ? "加入历史编辑队列，执行时丢弃此提交" : "此提交不能加入丢弃队列")}"><span>加入队列：丢弃</span><span class="command-hint">queue drop</span></button>
      </div>
      ${renderHistoryRewriteQueue()}
    </details>
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
  if (files.length) {
    if (!files.some((file) => file.file === state.selectedCommitFile)) {
      state.selectedCommitFile = files[0].file;
    }
  } else {
    state.selectedCommitFile = "";
  }
  els.detailBody.innerHTML = tt`
    <div class="detail-section-title">变更文件</div>
    <div class="commit-file-tree commit-file-list-only">${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">${t("没有文件列表")}</span><span></span></div>`}</div>
  `;
  bindFileTree(els.detailBody, { mode: "commit", commitSha: commit.sha });
}

async function openFileHistory(filePath, ref = "") {
  return openFileInsightPanel("fileHistory", filePath, ref);
}

async function openFileBlame(filePath, ref = "") {
  return openFileInsightPanel("fileBlame", filePath, ref);
}

async function openFileInsightPanel(tab, filePath, ref = "") {
  if (!filePath) {
    toast(t("请选择文件"));
    return false;
  }
  const targetRef = ref || currentFileHistoryRef();
  const repoPath = repoPathSnapshot();
  const stateKey = tab === "fileBlame" ? "fileBlame" : "fileHistory";
  state[stateKey] = { file: filePath, ref: targetRef, repoPath, data: null, loading: true, error: "", pending: true };
  state.selectedTab = tab;
  renderInspector();
  await ensureInspectorPanelLoaded("fileInsights");
  if (!isCurrentRepoPath(repoPath)) return false;
  const loader = window[tab === "fileBlame" ? "loadFileBlamePanel" : "loadFileHistoryPanel"];
  if (typeof loader !== "function") throw new Error(inspectorPanelLoadError("fileInsights"));
  return loader(filePath, targetRef);
}

function currentFileHistoryRef() {
  return state.selectedRef || state.data?.repo?.selectedRef || state.data?.repo?.branch || "HEAD";
}

