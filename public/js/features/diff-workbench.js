// Worktree diff loading, feedback, hunk actions, and modal lifecycle.
const WORK_DIFF_TARGET_HIGHLIGHT_DURATION = 1800;
const WORK_DIFF_TARGET_HIGHLIGHT_TTL = 4000;

function renderWorkDiffEmpty(message) {
  resetDiffLineSelection(false);
  setActiveDiff(null);
  els.workDiffTitle.textContent = t("变更对照");
  els.workDiffPath.textContent = "";
  els.workDiffView.className = "work-diff-view empty";
  els.workDiffView.textContent = t(message);
}

async function loadWorkingDiff(filePath) {
  if (!filePath) {
    renderWorkDiffEmpty("未选择文件");
    return;
  }
  if (state.workDiffFeedback?.file && state.workDiffFeedback.file !== filePath) state.workDiffFeedback = null;
  const fileInfo = selectedWorkingFileInfo(filePath);
  const scope = normalizeWorkDiffScopeChoice(state.workDiffScope, fileInfo);
  state.workDiffScope = scope;
  const repoPath = repoPathSnapshot();
  const requestId = ++state.diffRequestId;
  els.workDiffTitle.textContent = t("变更对照");
  els.workDiffPath.textContent = filePath;
  els.workDiffView.className = "work-diff-view loading";
  els.workDiffView.textContent = t("正在读取差异...");
  try {
    const data = await api(`/api/worktree-diff?file=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(scope)}`);
    if (requestId !== state.diffRequestId || !isCurrentRepoPath(repoPath)) return;
    const fallbackScope = fallbackWorkDiffScope(data.scope || scope, fileInfo, data.diff || []);
    if (fallbackScope) {
      const fallback = await api(`/api/worktree-diff?file=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(fallbackScope)}`);
      if (requestId !== state.diffRequestId || !isCurrentRepoPath(repoPath)) return;
      if (fallback.diff?.length) {
        renderWorkDiff(fallback.file || filePath, fallback.diff, fallback.scope || fallbackScope);
        return;
      }
    }
    renderWorkDiff(data.file || filePath, data.diff || [], data.scope || "unstaged");
  } catch (error) {
    if (requestId !== state.diffRequestId || !isCurrentRepoPath(repoPath)) return;
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = error.message;
  }
}

function renderWorkDiff(filePath, diff, scope = "unstaged") {
  resetDiffLineSelection(false);
  const scopeLabel = workDiffScopeLabel(scope);
  const title = `${shortFileName(filePath)} · ${scopeLabel}`;
  state.workDiffScope = scope === "staged" ? "staged" : "unstaged";
  setActiveDiff({ source: "worktree", title, path: filePath, diff, scope, emptyText: t("没有可显示的差异") });
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = filePath;
  if (!diff.length) {
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = t("没有可显示的差异");
    return;
  }
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的差异", { hunkActions: true, lineAction: selectedDiffLineAction(filePath, scope), filePath, scope });
  scheduleWorkDiffTargetClear(els.workDiffView);
  updateDiffLineSelectionToolbar();
}

function setActiveDiff(payload) {
  state.activeDiff = payload;
  state.diffModalRenderLimit = SIDE_DIFF_INITIAL_RENDER_LINES;
  if (els.editWorktreeFile) {
    els.editWorktreeFile.disabled = !(payload?.source === "worktree" && payload?.path && !state.data?.repo?.isSample);
  }
  if (els.maximizeDiff) els.maximizeDiff.disabled = !payload?.diff?.length;
}

function selectedWorkingFileInfo(filePath = state.selectedFile, scope = state.workDiffScope) {
  if (!filePath) return null;
  const matches = (state.data?.workingFiles || []).filter((file) => file.file === filePath);
  if (scope === "staged") return matches.find((file) => file.staged) || matches[0] || null;
  if (scope === "unstaged" || scope === "untracked") return matches.find((file) => file.unstaged) || matches[0] || null;
  return matches[0] || null;
}

function fileChangeFlags(fileInfo) {
  if (!fileInfo) return { hasUnstaged: false, hasStaged: false };
  return {
    hasUnstaged: Boolean(fileInfo?.unstaged || (!fileInfo?.staged && fileInfo?.unstaged !== false)),
    hasStaged: Boolean(fileInfo?.staged),
  };
}

function isUntrackedFile(fileInfo) {
  return Boolean(fileInfo && fileInfo.indexStatus === "?" && fileInfo.worktreeStatus === "?");
}

function setWorkDiffFeedback(file, message, options = {}) {
  const highlight = options.highlight?.hunks?.length
    ? { ...options.highlight, expiresAt: Date.now() + WORK_DIFF_TARGET_HIGHLIGHT_TTL }
    : null;
  state.workDiffFeedback = {
    file,
    message,
    partialUntracked: Boolean(options.partialUntracked),
    highlight,
  };
}

function workDiffFeedbackForFile(filePath) {
  return state.workDiffFeedback?.file === filePath ? state.workDiffFeedback : null;
}

function renderWorkDiffFeedback(options = {}) {
  const filePath = options.filePath || "";
  if (!filePath) return "";
  const fileInfo = selectedWorkingFileInfo(filePath, options.scope);
  const feedback = workDiffFeedbackForFile(filePath);
  const untrackedHint = !feedback && isUntrackedFile(fileInfo) && (options.scope === "untracked" || options.scope === "unstaged");
  if (!feedback && !untrackedHint) return "";
  const message = feedback?.message || t("未跟踪文件：部分暂存后，其余内容仍保留在工作区。");
  const detail = feedback?.partialUntracked && fileChangeFlags(fileInfo).hasUnstaged ? t("其余内容仍保留在工作区") : "";
  const stateText = feedback ? workDiffFeedbackStateText(fileInfo) : "";
  return `
    <div class="work-diff-feedback ${feedback ? "success" : "notice"}" role="status" aria-live="polite">
      <span class="work-diff-feedback-copy">
        <strong>${escapeHtml(message)}</strong>
        ${detail ? `<span class="work-diff-feedback-detail">${escapeHtml(detail)}</span>` : ""}
      </span>
      ${stateText ? `<span class="work-diff-feedback-state">${escapeHtml(stateText)}</span>` : ""}
    </div>
  `;
}

function workDiffFeedbackStateText(fileInfo) {
  if (!fileInfo) return t("此文件没有剩余未提交改动");
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  const labels = [
    hasUnstaged ? t("仍有未暂存改动") : "",
    hasStaged ? t("已有暂存内容") : "",
  ].filter(Boolean);
  return labels.join(" · ") || t("此文件没有剩余未提交改动");
}

function captureWorkDiffTarget(hunkIndexes, diff = state.activeDiff?.diff) {
  const requested = new Set((hunkIndexes || []).filter((index) => Number.isInteger(index)));
  const hunks = workDiffHunks(diff)
    .filter((hunk) => requested.has(hunk.hunkIndex))
    .map(({ oldStart, oldCount, newStart, newCount, changeKeys }) => ({ oldStart, oldCount, newStart, newCount, changeKeys }));
  return hunks.length ? { hunks } : null;
}

function highlightedWorkDiffHunks(diff, feedback) {
  const highlight = feedback?.highlight;
  if (!highlight?.hunks?.length || Number(highlight.expiresAt) <= Date.now()) return new Set();
  const candidates = workDiffHunks(diff);
  const matched = new Set();
  for (const target of highlight.hunks) {
    const targetKeys = new Set(target.changeKeys || []);
    let best = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      if (matched.has(candidate.hunkIndex) || !workDiffHunkRangesTouch(target, candidate)) continue;
      const sharedChanges = candidate.changeKeys.filter((key) => targetKeys.has(key)).length;
      if (!sharedChanges) continue;
      const distance = Math.abs(candidate.oldStart - target.oldStart) + Math.abs(candidate.newStart - target.newStart);
      const score = (sharedChanges * 1000) - distance;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (best) matched.add(best.hunkIndex);
  }
  return matched;
}

function workDiffHunks(diff) {
  const hunks = [];
  let current = null;
  for (const line of diff || []) {
    const range = line?.type === "meta" ? parseDiffHunkRange(line.text) : null;
    if (range) {
      current = {
        hunkIndex: Number.isInteger(line.hunkIndex) ? line.hunkIndex : hunks.length,
        ...range,
        changeKeys: [],
      };
      hunks.push(current);
      continue;
    }
    if (current && (line?.type === "add" || line?.type === "del")) {
      const key = `${line.type}:${trimDiffPrefix(line.text)}`;
      if (!current.changeKeys.includes(key)) current.changeKeys.push(key);
    }
  }
  return hunks;
}

function workDiffHunkRangesTouch(left, right) {
  return diffRangesTouch(left.oldStart, left.oldCount, right.oldStart, right.oldCount)
    || diffRangesTouch(left.newStart, left.newCount, right.newStart, right.newCount);
}

function diffRangesTouch(leftStart, leftCount, rightStart, rightCount) {
  const leftEnd = leftStart + Math.max(1, leftCount) - 1;
  const rightEnd = rightStart + Math.max(1, rightCount) - 1;
  return leftStart <= rightEnd + 3 && rightStart <= leftEnd + 3;
}

function scheduleWorkDiffTargetClear(root) {
  const rows = Array.from(root?.querySelectorAll?.(".work-diff-target") || []);
  if (!rows.length || typeof setTimeout !== "function") return;
  const highlight = state.workDiffFeedback?.highlight;
  setTimeout(() => {
    rows.forEach((row) => row.classList.remove("work-diff-target"));
    if (state.workDiffFeedback?.highlight === highlight) state.workDiffFeedback.highlight = null;
  }, WORK_DIFF_TARGET_HIGHLIGHT_DURATION);
}

function preferredWorkDiffScope(fileInfo) {
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  if (hasUnstaged) return "unstaged";
  if (hasStaged) return "staged";
  return "unstaged";
}

function normalizeWorkDiffScopeChoice(scope, fileInfo) {
  const requested = scope === "staged" ? "staged" : "unstaged";
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  if (requested === "staged" && hasStaged) return "staged";
  if (requested === "unstaged" && hasUnstaged) return "unstaged";
  return preferredWorkDiffScope(fileInfo);
}

function fallbackWorkDiffScope(scope, fileInfo, diff) {
  if (diff?.length) return "";
  const requested = scope === "staged" ? "staged" : "unstaged";
  const { hasUnstaged, hasStaged } = fileChangeFlags(fileInfo);
  if (requested === "unstaged" && hasStaged) return "staged";
  if (requested === "staged" && hasUnstaged) return "unstaged";
  return "";
}

async function runWorkDiffHunkAction(action, button) {
  const repoPath = repoPathSnapshot();
  const file = activeWorktreeDiffFile();
  const hunkIndex = Number.parseInt(button?.dataset.hunkIndex || "", 10);
  const scope = button?.dataset.hunkScope || state.activeDiff?.scope || "unstaged";
  if (!file || !Number.isInteger(hunkIndex) || hunkIndex < 0) {
    toast(t("请选择要操作的改动块"));
    return;
  }
  state.selectedFile = file;
  const highlight = captureWorkDiffTarget([hunkIndex]);
  const view = captureWorkDiffActionView();
  if (action === "discardWorktreeHunk" && !state.data?.repo?.isSample && !confirm(t("确认丢弃这个改动块？\n\n文件：{file}\n此操作无法撤销。", { file }))) return;
  const buttons = document.querySelectorAll(".work-diff-view [data-hunk-action], .diff-modal-body [data-hunk-action]");
  buttons.forEach((item) => {
    item.disabled = true;
  });
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action, file, scope, hunkIndex, ...currentBranchSnapshotPayload(), ...fileSnapshotPayload(file, scope) }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("改动块操作完成"));
    setWorkDiffFeedback(file, result.output || t("改动块操作完成"), {
      partialUntracked: scope === "untracked" && action === "stageHunk",
      highlight,
    });
    await refreshWorkDiffAfterAction(file, scope, view, repoPath);
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
    await refreshWorktree(true);
  } finally {
    buttons.forEach((item) => {
      item.disabled = false;
    });
  }
}

function openDiffModal() {
  const feedback = state.activeDiff?.source === "worktree" ? workDiffFeedbackForFile(state.activeDiff.path || "") : null;
  if (!state.activeDiff || (!state.activeDiff.diff?.length && !feedback)) {
    toast(t("没有可最大化的对照内容"));
    return;
  }
  els.diffModalTitle.textContent = state.activeDiff.title || t("变更对照");
  els.diffModalPath.textContent = state.activeDiff.path || "";
  if (!state.diffModalRenderLimit) state.diffModalRenderLimit = SIDE_DIFF_INITIAL_RENDER_LINES;
  renderDiffModalBody();
  els.diffModal.classList.add("show");
  els.diffModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function renderDiffModalBody() {
  if (!state.activeDiff) return;
  els.diffModalBody.innerHTML = renderSideDiff(state.activeDiff.diff, state.activeDiff.emptyText || "没有可显示的差异", {
    ...diffModalOptions(),
    maxLines: state.diffModalRenderLimit || SIDE_DIFF_INITIAL_RENDER_LINES,
    loadMoreTarget: "modal",
  });
  scheduleWorkDiffTargetClear(els.diffModalBody);
  syncDiffLineSelectionRows();
}

function closeDiffModal() {
  els.diffModal.classList.remove("show");
  els.diffModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  els.diffModalBody.replaceChildren();
}
