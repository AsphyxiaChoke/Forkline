// Commit list rendering and commit search.
let commitGraphResizeFrame = 0;

function renderCommits(options = {}) {
  cancelScheduledCommitRender();
  cancelScheduledCommitGraphResize();
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

  const minHeight = Math.max(rowH, state.filtered.length * rowH);
  const isBranchScope = Boolean(state.selectedRef);
  els.commitGraph.style.minHeight = `${minHeight}px`;
  els.commitGraph.classList.toggle("branch-scope", isBranchScope);
  els.commitGraph.classList.toggle("all-scope", !isBranchScope);
  els.graphModeLabel.textContent = isBranchScope ? state.selectedRef : t("全部分支");
  els.graphModeLabel.title = isBranchScope ? t("当前只显示 {branch}", { branch: state.selectedRef }) : t("当前显示所有分支");
  const graphCommits = layoutGraphCommits(state.filtered, state.selectedRef);
  const renderedGraphWidth = graphRenderWidth(graphCommits, state.selectedRef);
  els.commitGraph.innerHTML = renderGraphSvg(graphCommits, minHeight, state.selectedRef, renderedGraphWidth);

  if (!state.filtered.length) {
    const emptyTitle = terms.length ? t("没有匹配的提交") : t("还没有提交");
    const emptySub = terms.length ? t("换一个关键词试试") : t("暂存文件后创建第一次提交");
    els.commitGraph.insertAdjacentHTML(
      "beforeend",
      `<div class="commit-row" style="grid-template-columns:1fr;min-width:0"><div class="message"><strong>${emptyTitle}</strong><span>${emptySub}</span></div></div>`
    );
    renderCommitInspector(inspectorMode, previousSelectedSha);
    return;
  }

  const rows = document.createDocumentFragment();
  state.filtered.forEach((commit) => {
    const headCommit = isHeadCommit(commit);
    const row = document.createElement("button");
    row.className = `commit-row ${commit.sha === state.selectedSha ? "selected" : ""} ${headCommit ? "current-head" : ""}`;
    row.type = "button";
    row.dataset.sha = commit.sha;
    row.innerHTML = `
      <div class="graph-cell">
      </div>
      <div class="message">
        <strong title="${escapeAttr(commit.message)}">${highlightSearchText(commit.message, highlightPattern)}</strong>
        <span class="commit-ref-line" title="${escapeAttr(commit.refs || t("提交历史"))}">${headCommit ? '<b class="head-badge">HEAD</b>' : ""}<span class="commit-ref-text">${highlightSearchText(commit.refs || t("提交历史"), highlightPattern)}</span></span>
      </div>
      <div class="author">
        <span class="author-badge" style="--avatar:${commit.color}">${initials(commit.author)}</span>
        <span title="${escapeAttr(commit.author)}">${highlightSearchText(commit.author, highlightPattern)}</span>
      </div>
      <div class="time">${escapeHtml(commit.time)}</div>
      <div class="sha" title="${escapeAttr(commit.sha)}">${highlightSearchText(commit.short, highlightPattern)}</div>
    `;
    rows.appendChild(row);
  });
  els.commitGraph.appendChild(rows);
  renderCommitInspector(inspectorMode, previousSelectedSha);
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
  const minHeight = Math.max(rowH, state.filtered.length * rowH);
  const graphCommits = layoutGraphCommits(state.filtered, state.selectedRef);
  const renderedGraphWidth = graphRenderWidth(graphCommits, state.selectedRef);
  currentGraph.outerHTML = renderGraphSvg(graphCommits, minHeight, state.selectedRef, renderedGraphWidth);
}

function renderCommitInspector(mode, previousSelectedSha) {
  if (mode === "never") return;
  if (mode === "selection-change" && previousSelectedSha === state.selectedSha) return;
  renderInspector();
}

function updateCommitSelection(nextSha) {
  const nextRow = els.commitGraph.querySelector(`.commit-row[data-sha="${nextSha}"]`);
  if (!nextRow) return false;
  const selectedRow = els.commitGraph.querySelector(".commit-row.selected");
  if (selectedRow !== nextRow) selectedRow?.classList.remove("selected");
  nextRow.classList.add("selected");
  return true;
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

