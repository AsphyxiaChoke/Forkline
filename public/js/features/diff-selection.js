// Diff line selection, line actions, and view restoration.
function resetDiffLineSelection(update = true) {
  state.selectedDiffLines.clear();
  state.lastDiffLineKey = "";
  if (update) syncDiffLineSelectionRows();
}

function handleDiffLineSelection(row, event = {}, root = els.workDiffView) {
  const rows = Array.from(root.querySelectorAll(".diff-line-selectable[data-diff-line-key]"));
  const rowIndex = rows.indexOf(row);
  if (rowIndex < 0) return;
  const rowKeys = diffRowLineKeys(row);
  if (!rowKeys.length) return;
  const lastIndex = rows.findIndex((item) => item.dataset.diffLineKey === state.lastDiffLineKey);
  const additive = event.ctrlKey || event.metaKey;
  if (event.shiftKey && lastIndex >= 0) {
    if (!additive) state.selectedDiffLines.clear();
    const [start, end] = [lastIndex, rowIndex].sort((left, right) => left - right);
    rows.slice(start, end + 1).forEach((item) => diffRowLineKeys(item).forEach((key) => state.selectedDiffLines.add(key)));
  } else if (additive) {
    const selected = rowKeys.every((key) => state.selectedDiffLines.has(key));
    rowKeys.forEach((key) => {
      if (selected) state.selectedDiffLines.delete(key);
      else state.selectedDiffLines.add(key);
    });
  } else {
    const onlyThisRow = state.selectedDiffLines.size === rowKeys.length && rowKeys.every((key) => state.selectedDiffLines.has(key));
    state.selectedDiffLines.clear();
    if (!onlyThisRow) rowKeys.forEach((key) => state.selectedDiffLines.add(key));
  }
  state.lastDiffLineKey = row.dataset.diffLineKey || "";
  syncDiffLineSelectionRows();
}

function diffRowLineKeys(row) {
  return String(row?.dataset?.diffLineKeys || "").split(",").filter(Boolean);
}

function syncDiffLineSelectionRows() {
  [els.workDiffView, els.diffModalBody].forEach((root) => {
    const rows = Array.from(root.querySelectorAll(".diff-line-selectable[data-diff-line-keys]"));
    rows.forEach((row) => {
      const selected = diffRowLineKeys(row).some((key) => state.selectedDiffLines.has(key));
      row.classList.toggle("selected", selected);
    });
    updateDiffLineSelectionToolbar(root);
  });
}

function updateDiffLineSelectionToolbar(root = els.workDiffView) {
  const countNode = root.querySelector("[data-selected-line-count]");
  const button = root.querySelector("[data-line-action]");
  if (!countNode || !button) return;
  const selectedRows = root.querySelectorAll(".diff-line-selectable.selected").length;
  countNode.textContent = selectedRows ? t("已选 {count} 行", { count: selectedRows }) : t("未选择行");
  button.disabled = selectedRows === 0;
}

function selectedDiffLinePayload() {
  return Array.from(state.selectedDiffLines).map((key) => {
    const [hunkIndex, lineIndex] = key.split(":").map((part) => Number.parseInt(part, 10));
    return { hunkIndex, lineIndex };
  }).filter((line) => Number.isInteger(line.hunkIndex) && Number.isInteger(line.lineIndex));
}

async function runWorkDiffLineAction(button) {
  const repoPath = repoPathSnapshot();
  const file = activeWorktreeDiffFile();
  const scope = state.activeDiff?.scope || "unstaged";
  const action = button?.dataset?.lineAction || "";
  const lines = selectedDiffLinePayload();
  if (!file || !lines.length) {
    toast(t("请选择要操作的行"));
    return;
  }
  state.selectedFile = file;
  const view = captureWorkDiffActionView();
  if (action === "stageSelectedLines" && scope !== "unstaged" && scope !== "untracked") {
    toast(t("只能暂存工作区中未暂存的行"));
    return;
  }
  if (action === "unstageSelectedLines" && scope !== "staged") {
    toast(t("只能在已暂存 Diff 中取消暂存所选行"));
    return;
  }
  if (action !== "stageSelectedLines" && action !== "unstageSelectedLines") return;
  const highlight = captureWorkDiffTarget(lines.map((line) => line.hunkIndex));
  const buttons = document.querySelectorAll(".work-diff-view [data-line-action], .work-diff-view [data-hunk-action], .diff-modal-body [data-line-action], .diff-modal-body [data-hunk-action]");
  buttons.forEach((item) => {
    item.disabled = true;
  });
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action, file, scope, lines, ...currentBranchSnapshotPayload(), ...fileSnapshotPayload(file, scope) }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("所选行操作完成"));
    setWorkDiffFeedback(file, result.output || t("所选行操作完成"), {
      partialUntracked: scope === "untracked" && action === "stageSelectedLines",
      highlight,
    });
    resetDiffLineSelection(false);
    await refreshWorkDiffAfterAction(file, scope, view, repoPath);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
    await refreshWorktree(true);
    syncDiffLineSelectionRows();
  } finally {
    buttons.forEach((item) => {
      if (item !== button) item.disabled = false;
    });
    syncDiffLineSelectionRows();
  }
}

function captureWorkDiffActionView() {
  return {
    modalOpen: Boolean(els.diffModal?.classList.contains("show")),
    modalScrollTop: Number(els.diffModalBody?.scrollTop) || 0,
    modalScrollLeft: Number(els.diffModalBody?.scrollLeft) || 0,
    workScrollTop: Number(els.workDiffView?.scrollTop) || 0,
    workScrollLeft: Number(els.workDiffView?.scrollLeft) || 0,
    renderLimit: state.diffModalRenderLimit || SIDE_DIFF_INITIAL_RENDER_LINES,
  };
}

async function refreshWorkDiffAfterAction(file, scope, view, repoPath) {
  await refreshWorktree(true);
  if (!isCurrentRepoPath(repoPath)) return;
  const fileInfo = selectedWorkingFileInfo(file, scope);
  if (fileInfo) {
    state.selectedFile = file;
    state.workDiffScope = normalizeWorkDiffScopeChoice(scope, fileInfo);
    await loadWorkingDiff(file);
    if (!isCurrentRepoPath(repoPath)) return;
  } else {
    renderCompletedWorkDiff(file, scope);
  }
  restoreWorkDiffActionView(view);
}

function renderCompletedWorkDiff(file, scope) {
  resetDiffLineSelection(false);
  const normalizedScope = scope === "staged" ? "staged" : "unstaged";
  const title = `${shortFileName(file)} · ${t("无剩余更改")}`;
  state.workDiffScope = normalizedScope;
  setActiveDiff({ source: "worktree", title, path: file, diff: [], scope: normalizedScope, emptyText: t("此文件没有剩余未提交改动") });
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = file;
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff([], "此文件没有剩余未提交改动", { filePath: file, scope: normalizedScope });
}

function restoreWorkDiffActionView(view) {
  if (!view) return;
  state.diffModalRenderLimit = Math.max(SIDE_DIFF_INITIAL_RENDER_LINES, Number(view.renderLimit) || 0);
  restoreWorkDiffScrollAfterRender(els.workDiffView, view.workScrollTop, view.workScrollLeft);
  if (!view.modalOpen) return;
  openDiffModal();
  restoreWorkDiffScrollAfterRender(els.diffModalBody, view.modalScrollTop, view.modalScrollLeft);
}

function restoreWorkDiffScrollAfterRender(element, top, left) {
  restoreWorkDiffScroll(element, top, left);
  const restore = () => restoreWorkDiffScroll(element, top, left);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
  if (typeof setTimeout === "function") setTimeout(restore, 60);
}

function restoreWorkDiffScroll(element, top, left) {
  if (!element) return;
  if (Number.isFinite(top)) element.scrollTop = top;
  if (Number.isFinite(left)) element.scrollLeft = left;
}

function activeWorktreeDiffFile() {
  if (state.activeDiff?.source === "worktree" && state.activeDiff?.path) return state.activeDiff.path;
  return state.selectedFile;
}
