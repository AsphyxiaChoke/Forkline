// File history and blame panels loaded when either inspector tab is first opened.
let fileHistoryPanelLoad = null;
let fileBlamePanelLoad = null;

function renderFileInsightsTab() {
  if (state.selectedTab === "fileBlame") {
    if (state.fileBlame?.pending && (!state.fileBlame.repoPath || isCurrentRepoPath(state.fileBlame.repoPath))) {
      loadFileBlamePanel(state.fileBlame.file, state.fileBlame.ref);
    }
    renderFileBlameTab();
    return;
  }
  if (state.fileHistory?.pending && (!state.fileHistory.repoPath || isCurrentRepoPath(state.fileHistory.repoPath))) {
    loadFileHistoryPanel(state.fileHistory.file, state.fileHistory.ref);
  }
  renderFileHistoryTab();
}

function renderFileHistoryTab() {
  const history = state.fileHistory;
  els.detailNode.style.borderColor = "var(--teal)";
  els.detailTitle.textContent = t("文件历史");
  els.detailSub.textContent = history.file || t("从文件右键菜单或提交文件列表打开");
  if (!history.file) {
    els.detailBody.innerHTML = tt`
      <div class="empty-state">
        <strong>还没有选择文件</strong>
        <span>在工作区文件上右键选择“查看文件历史”，或在提交的文件面板里点击“文件历史”。</span>
      </div>
    `;
    return;
  }
  if (history.loading) {
    els.detailBody.innerHTML = `<div class="empty-state"><strong>${t("正在读取文件历史")}</strong><span>${escapeHtml(history.file)}</span></div>`;
    return;
  }
  if (history.error) {
    els.detailBody.innerHTML = `<div class="empty-state danger"><strong>${t("读取失败")}</strong><span>${escapeHtml(t(history.error))}</span></div>`;
    return;
  }
  const data = history.data || {};
  const commits = data.commits || [];
  els.detailBody.innerHTML = tt`
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
        : `<div class="empty-state"><strong>${t("没有找到历史记录")}</strong><span>${t("这个文件可能还没有提交，或在当前引用 {ref} 中不存在。", { ref: escapeHtml(data.ref || history.ref || "HEAD") })}</span></div>`
    }
  `;
}

function renderFileHistoryCommit(commit) {
  const change = fileHistoryChangeLabel(commit.change || commit.files?.[0]?.state || "M");
  const renameText = commit.previousFile ? `<span class="file-history-rename">${escapeHtml(commit.previousFile)} -> ${escapeHtml(commit.files?.[0]?.file || "")}</span>` : "";
  return tt`
    <article class="file-history-row">
      <span class="state-pill ${change.className}">${escapeHtml(change.label)}</span>
      <div class="file-history-main">
        <strong>${escapeHtml(commit.message || t("(无提交信息)"))}</strong>
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
    A: { label: t("新增"), className: "added" },
    D: { label: t("删除"), className: "deleted" },
    R: { label: t("重命名"), className: "renamed" },
    C: { label: t("复制"), className: "renamed" },
    M: { label: t("修改"), className: "modified" },
  };
  return map[code] || map.M;
}

function renderFileBlameTab() {
  const blame = state.fileBlame;
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = t("逐行追踪");
  els.detailSub.textContent = blame.file || t("从文件右键菜单或提交文件列表打开");
  if (!blame.file) {
    els.detailBody.innerHTML = tt`
      <div class="empty-state">
        <strong>还没有选择文件</strong>
        <span>在工作区文件上右键选择“逐行追踪”，或在提交的文件面板里点击“逐行追踪”。</span>
      </div>
    `;
    return;
  }
  if (blame.loading) {
    els.detailBody.innerHTML = `<div class="empty-state"><strong>${t("正在读取逐行追踪")}</strong><span>${escapeHtml(blame.file)}</span></div>`;
    return;
  }
  if (blame.error) {
    els.detailBody.innerHTML = `<div class="empty-state danger"><strong>${t("读取失败")}</strong><span>${escapeHtml(t(blame.error))}</span></div>`;
    return;
  }
  const data = blame.data || {};
  const lines = data.lines || [];
  els.detailBody.innerHTML = tt`
    <div class="file-blame-head">
      <div>
        <div class="detail-section-title">逐行追踪</div>
        <strong>${escapeHtml(data.file || blame.file)}</strong>
        <span>${escapeHtml(data.command || `git blame --line-porcelain -- ${blame.file}`)}</span>
      </div>
      <div class="file-blame-actions">
        ${data.truncated ? `<span class="blame-truncated">${t("仅显示前 {count} 行", { count: lines.length })}</span>` : ""}
        <button class="mini-btn" data-file-blame-refresh type="button">刷新</button>
      </div>
    </div>
    ${
      lines.length
        ? `<div class="file-blame-list">${lines.map(renderFileBlameLine).join("")}</div>`
        : `<div class="empty-state"><strong>${t("没有可显示的内容")}</strong><span>${t("这个文件可能在当前引用 {ref} 中不存在，或是空文件。", { ref: escapeHtml(data.ref || blame.ref || "HEAD") })}</span></div>`
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

function loadFileBlamePanel(filePath, targetRef) {
  const repoPath = repoPathSnapshot();
  const key = [repoPath, targetRef, filePath].join("\u0000");
  if (fileBlamePanelLoad?.key === key) return fileBlamePanelLoad.promise;
  const requestId = ++state.fileBlameRequestId;
  state.fileBlame = { file: filePath, ref: targetRef, repoPath, data: null, loading: true, error: "", pending: false };
  if (state.selectedTab === "fileBlame") renderInspector();
  const promise = (async () => {
    try {
      const data = await api(`/api/file-blame?file=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(targetRef)}`);
      if (requestId !== state.fileBlameRequestId || !isCurrentRepoPath(repoPath)) return false;
      state.fileBlame = { file: filePath, ref: data.ref || targetRef, repoPath, data, loading: false, error: "", pending: false };
      return true;
    } catch (error) {
      if (requestId !== state.fileBlameRequestId || !isCurrentRepoPath(repoPath)) return false;
      state.fileBlame = { file: filePath, ref: targetRef, repoPath, data: null, loading: false, error: error.message, pending: false };
      return false;
    } finally {
      if (fileBlamePanelLoad?.key === key) fileBlamePanelLoad = null;
      if (isCurrentRepoPath(repoPath) && state.selectedTab === "fileBlame") renderInspector();
    }
  })();
  fileBlamePanelLoad = { key, promise };
  return promise;
}

async function runFileBlameAction(action, button) {
  const sha = button.dataset.sha || "";
  if (!sha) return;
  const commit = commitRecordForSha(sha);
  if (!commit) {
    toast(t("这条逐行追踪记录已经过期，请刷新逐行追踪后再试。"));
    return;
  }
  if (action === "view") {
    els.searchInput.value = "";
    state.selectedTab = "details";
    await openHistoryCommit(sha);
  }
}

function loadFileHistoryPanel(filePath, targetRef) {
  const repoPath = repoPathSnapshot();
  const key = [repoPath, targetRef, filePath].join("\u0000");
  if (fileHistoryPanelLoad?.key === key) return fileHistoryPanelLoad.promise;
  const requestId = ++state.fileHistoryRequestId;
  state.fileHistory = { file: filePath, ref: targetRef, repoPath, data: null, loading: true, error: "", pending: false };
  if (state.selectedTab === "fileHistory") renderInspector();
  const promise = (async () => {
    try {
      const data = await api(`/api/file-history?file=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(targetRef)}`);
      if (requestId !== state.fileHistoryRequestId || !isCurrentRepoPath(repoPath)) return false;
      state.fileHistory = { file: filePath, ref: data.ref || targetRef, repoPath, data, loading: false, error: "", pending: false };
      return true;
    } catch (error) {
      if (requestId !== state.fileHistoryRequestId || !isCurrentRepoPath(repoPath)) return false;
      state.fileHistory = { file: filePath, ref: targetRef, repoPath, data: null, loading: false, error: error.message, pending: false };
      return false;
    } finally {
      if (fileHistoryPanelLoad?.key === key) fileHistoryPanelLoad = null;
      if (isCurrentRepoPath(repoPath) && state.selectedTab === "fileHistory") renderInspector();
    }
  })();
  fileHistoryPanelLoad = { key, promise };
  return promise;
}

async function runFileHistoryAction(action, button) {
  const sha = button.dataset.sha || "";
  const file = button.dataset.file || state.fileHistory.file || "";
  if (!sha) return;
  const commit = commitRecordForSha(sha);
  if (!commit) {
    toast(t("这条文件历史记录已经过期，请刷新文件历史后再试。"));
    return;
  }
  els.searchInput.value = "";
  if (action === "view") {
    state.selectedTab = "details";
    await openHistoryCommit(sha);
    return;
  }
  if (action === "file") {
    state.selectedCommitFile = file;
    state.selectedTab = "files";
    await openHistoryCommit(sha);
  }
}

async function openHistoryCommit(sha) {
  if (isGraphCommitLoaded(sha)) {
    await selectCommit(sha);
    return;
  }
  setInspectorContext("commit", inspectorTabs.commit.includes(state.selectedTab) ? state.selectedTab : "details");
  state.selectedSha = sha;
  renderCommits({ inspector: "never" });
  await loadCommit(sha);
  renderInspector();
}
