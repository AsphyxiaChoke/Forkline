// Commit list rendering and commit search.
const COMMIT_VIRTUALIZATION_THRESHOLD = 240;
const COMMIT_VIEWPORT_OVERSCAN_ROWS = 12;
let commitGraphResizeFrame = 0;
let commitViewportFrame = 0;
let commitVirtualized = false;
let commitViewportStart = -1;
let commitViewportEnd = -1;
let commitLayoutCache = [];
let commitHighlightPattern = null;
let commitRenderedGraphWidth = 0;

function renderCommits(options = {}) {
  cancelScheduledCommitRender();
  cancelScheduledCommitGraphResize();
  cancelScheduledCommitViewportRender();
  const previousSelectedSha = state.selectedSha;
  const inspectorMode = options.inspector || "always";
  const terms = commitSearchTerms();
  const highlightPattern = commitSearchPattern(terms);
  state.filtered = !terms.length
    ? state.data.commits
    : state.data.commits.filter((commit) => commitMatchesSearch(commit, terms));
  updateCommitSearchMeta(terms, state.filtered.length, state.data.commits.length);

  const selectedVisible = state.filtered.some((commit) => commit.sha === state.selectedSha);
  const selectedLoadedInGraph = isGraphCommitLoaded(state.selectedSha);
  if (state.filtered.length && !selectedVisible && (!state.selectedSha || selectedLoadedInGraph)) {
    state.selectedSha = state.filtered[0].sha;
  }

  const graphHeight = Math.max(rowH, state.filtered.length * rowH);
  const footerHeight = state.historyHasMore || state.historyLoading ? 48 : 0;
  const isBranchScope = Boolean(state.selectedRef);
  els.commitGraph.style.minHeight = `${graphHeight + footerHeight}px`;
  els.commitGraph.classList.toggle("branch-scope", isBranchScope);
  els.commitGraph.classList.toggle("all-scope", !isBranchScope);
  els.graphModeLabel.textContent = isBranchScope ? state.selectedRef : t("全部分支");
  els.graphModeLabel.title = isBranchScope ? t("当前只显示 {branch}", { branch: state.selectedRef }) : t("当前显示所有分支");
  commitLayoutCache = layoutGraphCommits(state.filtered, state.selectedRef);
  commitRenderedGraphWidth = graphRenderWidth(commitLayoutCache, state.selectedRef);
  commitHighlightPattern = highlightPattern;
  commitVirtualized = state.filtered.length > COMMIT_VIRTUALIZATION_THRESHOLD;
  commitViewportStart = -1;
  commitViewportEnd = -1;
  els.commitGraph.classList.toggle("virtualized", commitVirtualized);

  if (!state.filtered.length) {
    commitVirtualized = false;
    commitLayoutCache = [];
    els.commitGraph.classList.remove("virtualized");
    els.commitGraph.innerHTML = "";
    const emptyTitle = terms.length ? t("没有匹配的提交") : t("还没有提交");
    const emptySub = terms.length ? t("换一个关键词试试") : t("暂存文件后创建第一次提交");
    els.commitGraph.insertAdjacentHTML(
      "beforeend",
      `<div class="commit-row" style="grid-template-columns:1fr;min-width:0"><div class="message"><strong>${emptyTitle}</strong><span>${emptySub}</span></div></div>`
    );
    appendHistoryLoadMore(graphHeight);
    renderCommitInspector(inspectorMode, previousSelectedSha);
    return;
  }

  if (commitVirtualized) {
    els.commitGraph.innerHTML = '<div class="commit-window"></div>';
    renderCommitViewport(true);
  } else {
    els.commitGraph.innerHTML = renderGraphSvg(commitLayoutCache, graphHeight, state.selectedRef, commitRenderedGraphWidth);
    els.commitGraph.appendChild(createCommitRows(0, state.filtered.length));
  }
  appendHistoryLoadMore(graphHeight);
  renderCommitInspector(inspectorMode, previousSelectedSha);
}

function createCommitRows(start, end) {
  const rows = document.createDocumentFragment();
  state.filtered.slice(start, end).forEach((commit, offset) => {
    const index = start + offset;
    const headCommit = isHeadCommit(commit);
    const row = document.createElement("button");
    row.className = `commit-row ${index % 2 === 1 ? "row-alt" : ""} ${commit.sha === state.selectedSha ? "selected" : ""} ${headCommit ? "current-head" : ""}`;
    row.type = "button";
    row.dataset.sha = commit.sha;
    row.dataset.rowIndex = String(index);
    row.innerHTML = `
      <div class="graph-cell">
      </div>
      <div class="message">
        <strong title="${escapeAttr(commit.message)}">${highlightSearchText(commit.message, commitHighlightPattern)}</strong>
        <span class="commit-ref-line" title="${escapeAttr(commit.refs || t("提交历史"))}">${headCommit ? '<b class="head-badge">HEAD</b>' : ""}<span class="commit-ref-text">${highlightSearchText(commit.refs || t("提交历史"), commitHighlightPattern)}</span></span>
      </div>
      <div class="author">
        <span class="author-badge" style="--avatar:${commit.color}">${initials(commit.author)}</span>
        <span title="${escapeAttr(commit.author)}">${highlightSearchText(commit.author, commitHighlightPattern)}</span>
      </div>
      <div class="time">${escapeHtml(commit.time)}</div>
      <div class="sha" title="${escapeAttr(commit.sha)}">${highlightSearchText(commit.short, commitHighlightPattern)}</div>
    `;
    rows.appendChild(row);
  });
  return rows;
}

function renderCommitViewport(force = false) {
  if (!commitVirtualized || !state.filtered?.length || !els.historyScroll) return;
  const range = commitViewportRange();
  if (!force && range.start === commitViewportStart && range.end === commitViewportEnd) return;
  commitViewportStart = range.start;
  commitViewportEnd = range.end;
  const graphHeight = Math.max(rowH, state.filtered.length * rowH);
  const graphMarkup = renderGraphSvg(commitLayoutCache, graphHeight, state.selectedRef, commitRenderedGraphWidth, range);
  const currentGraph = els.commitGraph.querySelector(".graph-lines");
  if (currentGraph) currentGraph.outerHTML = graphMarkup;
  else els.commitGraph.insertAdjacentHTML("afterbegin", graphMarkup);
  let commitWindow = els.commitGraph.querySelector(".commit-window");
  if (!commitWindow) {
    commitWindow = document.createElement("div");
    commitWindow.className = "commit-window";
    els.commitGraph.appendChild(commitWindow);
  }
  commitWindow.style.top = `${range.start * rowH}px`;
  commitWindow.replaceChildren(createCommitRows(range.start, range.end));
}

function commitViewportRange() {
  const total = state.filtered?.length || 0;
  const viewportHeight = Math.max(rowH, els.historyScroll?.clientHeight || rowH * 12);
  const maxScrollTop = Math.max(0, total * rowH - viewportHeight);
  const currentScrollTop = Math.max(0, els.historyScroll?.scrollTop || 0);
  const scrollTop = Math.min(currentScrollTop, maxScrollTop);
  if (scrollTop !== currentScrollTop) els.historyScroll.scrollTop = scrollTop;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - COMMIT_VIEWPORT_OVERSCAN_ROWS);
  const end = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowH) + COMMIT_VIEWPORT_OVERSCAN_ROWS);
  return { start, end: Math.max(start + 1, end) };
}

function scheduleCommitViewportRender() {
  if (!commitVirtualized || commitViewportFrame) return;
  commitViewportFrame = window.requestAnimationFrame(() => {
    commitViewportFrame = 0;
    renderCommitViewport();
  });
}

function cancelScheduledCommitViewportRender() {
  if (!commitViewportFrame) return;
  window.cancelAnimationFrame(commitViewportFrame);
  commitViewportFrame = 0;
}

function revealCommitIndex(index) {
  if (!commitVirtualized || !els.historyScroll || index < 0) return;
  const viewportHeight = Math.max(rowH, els.historyScroll.clientHeight || rowH * 12);
  const rowTop = index * rowH;
  const rowBottom = rowTop + rowH;
  const viewTop = els.historyScroll.scrollTop;
  const viewBottom = viewTop + viewportHeight;
  if (rowTop < viewTop || rowBottom > viewBottom) {
    els.historyScroll.scrollTop = Math.max(0, rowTop - Math.max(0, (viewportHeight - rowH) / 2));
  }
  renderCommitViewport(true);
}

function appendHistoryLoadMore(graphHeight = Math.max(rowH, (state.filtered?.length || 0) * rowH)) {
  const history = state.data?.history || {};
  if (!state.historyHasMore && !state.historyLoading) return;
  const loaded = state.data?.commits?.length || 0;
  const maxLimit = Number.isInteger(history.maxLimit) ? history.maxLimit : 5000;
  const reachedLimit = state.historyLimit >= maxLimit;
  const label = state.historyLoading
    ? t("正在加载更早提交...")
    : reachedLimit
      ? t("已达到 {count} 条显示上限", { count: maxLimit })
      : t("加载更早提交");
  els.commitGraph.insertAdjacentHTML(
    "beforeend",
    `<div class="history-load-more" style="top:${graphHeight}px"><button class="mini-btn" data-load-more-commits type="button" ${state.historyLoading || reachedLimit ? "disabled" : ""}>${escapeHtml(label)}</button><span>${escapeHtml(t("已载入 {count} 条", { count: loaded }))}</span></div>`
  );
}

async function loadMoreCommits(button) {
  if (!state.data || state.historyLoading || !state.historyHasMore) return;
  const history = state.data.history || {};
  const pageSize = Number.isInteger(history.pageSize) ? history.pageSize : 120;
  const maxLimit = Number.isInteger(history.maxLimit) ? history.maxLimit : 5000;
  const nextLimit = Math.min(maxLimit, Math.max(state.historyLimit, state.data.commits?.length || 0) + pageSize);
  if (nextLimit <= state.historyLimit) return;

  const repoPath = repoPathSnapshot();
  const selectedRef = state.selectedRef;
  const requestId = ++state.historyRequestId;
  const scrollTop = els.historyScroll?.scrollTop || 0;
  state.historyLoading = true;
  if (button) {
    button.disabled = true;
    button.textContent = t("正在加载更早提交...");
  }
  try {
    const data = await api(`/api/ref-state?ref=${encodeURIComponent(selectedRef)}&limit=${nextLimit}`);
    if (requestId !== state.historyRequestId || !isCurrentRepoPath(repoPath) || state.selectedRef !== selectedRef) return;
    state.data.repo = { ...state.data.repo, ...(data.repo || {}) };
    state.data.commits = data.commits || [];
    state.data.history = data.history || { limit: nextLimit, loaded: state.data.commits.length, hasMore: false, pageSize, maxLimit };
    applyHistoryState(state.data);
    renderCommits({ inspector: "never" });
    window.requestAnimationFrame(() => {
      if (requestId === state.historyRequestId && isCurrentRepoPath(repoPath) && state.selectedRef === selectedRef && els.historyScroll) {
        els.historyScroll.scrollTop = scrollTop;
      }
    });
  } catch (error) {
    if (requestId !== state.historyRequestId || !isCurrentRepoPath(repoPath) || state.selectedRef !== selectedRef) return;
    state.historyLoading = false;
    if (button) {
      button.disabled = false;
      button.textContent = t("加载更早提交");
    }
    toast(error.message);
  }
}

function scheduleCommitGraphResize() {
  if (commitGraphResizeFrame || !state.data || !els.commitGraph) return;
  commitGraphResizeFrame = window.requestAnimationFrame(() => {
    commitGraphResizeFrame = 0;
    refreshCommitGraphForColumnWidth();
  });
}

function cancelScheduledCommitGraphResize() {
  if (!commitGraphResizeFrame) return;
  window.cancelAnimationFrame(commitGraphResizeFrame);
  commitGraphResizeFrame = 0;
}

function refreshCommitGraphForColumnWidth() {
  const currentGraph = els.commitGraph.querySelector(".graph-lines");
  if (!currentGraph || !Array.isArray(state.filtered)) return;
  commitLayoutCache = layoutGraphCommits(state.filtered, state.selectedRef);
  commitRenderedGraphWidth = graphRenderWidth(commitLayoutCache, state.selectedRef);
  if (commitVirtualized) {
    renderCommitViewport(true);
    return;
  }
  const minHeight = Math.max(rowH, state.filtered.length * rowH);
  currentGraph.outerHTML = renderGraphSvg(commitLayoutCache, minHeight, state.selectedRef, commitRenderedGraphWidth);
}

function renderCommitInspector(mode, previousSelectedSha) {
  if (mode === "never") return;
  if (mode === "selection-change" && previousSelectedSha === state.selectedSha) return;
  renderInspector();
}

function updateCommitSelection(nextSha) {
  let nextRow = els.commitGraph.querySelector(`.commit-row[data-sha="${nextSha}"]`);
  if (!nextRow && commitVirtualized && Array.isArray(state.filtered)) {
    const index = state.filtered.findIndex((commit) => commit.sha === nextSha);
    if (index >= 0) {
      revealCommitIndex(index);
      nextRow = els.commitGraph.querySelector(`.commit-row[data-sha="${nextSha}"]`);
    }
  }
  if (!nextRow) return false;
  const selectedRow = els.commitGraph.querySelector(".commit-row.selected");
  if (selectedRow !== nextRow) selectedRow?.classList.remove("selected");
  nextRow.classList.add("selected");
  return true;
}

async function selectCommit(sha) {
  if (!sha) return;
  if (state.historyPlan?.sha !== sha) state.historyPlan = null;
  setInspectorContext("commit", inspectorTabs.commit.includes(state.selectedTab) ? state.selectedTab : "details");
  state.selectedSha = sha;
  if (!updateCommitSelection(sha)) renderCommits({ inspector: "never" });
  await loadCommit(sha);
  renderInspector();
}

function scheduleCommitRender(delay = 90) {
  cancelScheduledCommitRender();
  state.commitSearchRenderTimer = window.setTimeout(() => {
    state.commitSearchRenderTimer = 0;
    renderCommits({ inspector: "selection-change" });
  }, delay);
}

function cancelScheduledCommitRender() {
  if (!state.commitSearchRenderTimer) return;
  window.clearTimeout(state.commitSearchRenderTimer);
  state.commitSearchRenderTimer = 0;
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

function isHeadCommit(commit) {
  const headSha = state.data?.repo?.headSha || "";
  if (headSha) return commit.sha === headSha;
  return String(commit?.refs || "")
    .split(",")
    .some((ref) => {
      const value = ref.trim();
      return value === "HEAD" || value.startsWith("HEAD -> ");
    });
}

function updateCommitSearchMeta(terms, visibleCount, totalCount) {
  const active = terms.length > 0;
  els.searchCount.textContent = active ? `${visibleCount}/${totalCount}` : "";
  els.searchCount.title = active ? t("搜索结果：{visible} / {total} 个提交", { visible: visibleCount, total: totalCount }) : "";
  els.searchCount.hidden = !active;
  els.clearSearch.hidden = !active;
  els.searchInput.closest(".search")?.classList.toggle("active", active);
}

function commitSearchPattern(terms) {
  if (!terms.length) return null;
  const unique = [...new Set(terms)].sort((a, b) => b.length - a.length);
  return new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "gi");
}

function highlightSearchText(value, pattern) {
  const text = String(value || "");
  if (!pattern || !text) return escapeHtml(text);
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
  renderCommits({ inspector: "selection-change" });
  els.searchInput.focus();
}

