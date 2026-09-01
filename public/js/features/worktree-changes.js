// Worktree and staging area rendering.
const WORKTREE_FILE_INITIAL_LIMIT = 800;
const WORKTREE_FILE_BATCH_SIZE = 100;

function renderStage(options = {}) {
  const refreshDiff = options.refreshDiff !== false;
  els.changeList.innerHTML = "";
  els.stagedChangeList.innerHTML = "";
  const files = state.data.workingFiles || [];
  const progressiveError = String(state.data.progressiveError || "");
  if (state.data.progressive || progressiveError) {
    const message = progressiveError
      ? t("工作区详情加载失败，请重新打开仓库")
      : t("正在载入工作区和仓库详情");
    const loadingRow = `<div class="file-row empty-row"><span></span><span class="file-name">${message}</span><span></span></div>`;
    els.changeList.innerHTML = loadingRow;
    els.stagedChangeList.innerHTML = loadingRow;
    els.changeList.title = progressiveError;
    els.stagedChangeList.title = progressiveError;
    state.worktreeSignature = "";
    updateWorktreeFilterMeta([], 0, 0);
    if (refreshDiff && state.activeDiff?.source !== "history") renderWorkDiffEmpty(message);
    els.draftNote.textContent = message;
    els.refreshChanges.disabled = true;
    els.stashChanges.disabled = true;
    els.stashChanges.title = t("仓库详情载入完成后才能创建储藏");
    if (typeof renderRecoveryUndoButton === "function") renderRecoveryUndoButton();
    return;
  }
  els.changeList.removeAttribute("title");
  els.stagedChangeList.removeAttribute("title");
  els.refreshChanges.disabled = Boolean(state.refreshingWorktree);
  const terms = worktreeFilterTerms();
  const visibleFiles = filterWorkingFiles(files, terms);
  state.worktreeSignature = worktreeStateSignature(files, state.data.repo.operation, state.data.worktreeSnapshot);
  updateWorktreeFilterMeta(terms, visibleFiles.length, files.length);
  const operationBanner = renderRepoOperationBanner(files);
  if (!files.length) {
    state.selectedFile = "";
    state.selectedChanges.clear();
    els.changeList.innerHTML = `${operationBanner}<div class="file-row"><span></span><span class="file-name">${t("工作区没有未暂存的更改")}</span><span></span></div>`;
    els.stagedChangeList.innerHTML = `<div class="file-row"><span></span><span class="file-name">${t("没有已暂存的更改")}</span><span></span></div>`;
    if (refreshDiff && state.activeDiff?.source !== "history") renderWorkDiffEmpty("没有未提交的更改");
  } else {
    const groups = changeGroups(visibleFiles);
    pruneSelectedChanges(groups);
    const visibleChangeFiles = [...groups.unstaged, ...groups.staged];
    if (!visibleChangeFiles.length) {
      state.selectedFile = "";
      state.selectedChanges.clear();
      els.changeList.innerHTML = `${operationBanner}<div class="file-row empty-row"><span></span><span class="file-name">${terms.length ? t("没有匹配的更改") : t("没有未提交的更改")}</span><span></span></div>`;
      els.stagedChangeList.innerHTML = `<div class="file-row empty-row"><span></span><span class="file-name">${terms.length ? t("没有匹配的更改") : t("没有已暂存的更改")}</span><span></span></div>`;
      if (refreshDiff && state.activeDiff?.source !== "history") renderWorkDiffEmpty(terms.length ? "没有匹配的更改" : "没有未提交的更改");
    } else {
      const previousFile = state.selectedFile;
      if (!visibleChangeFiles.some((file) => file.file === state.selectedFile)) {
        state.selectedFile = "";
      }
      if (state.selectedFile !== previousFile) {
        state.workDiffScope = preferredWorkDiffScope(selectedWorkingFileInfo(state.selectedFile));
      } else {
        state.workDiffScope = normalizeWorkDiffScopeChoice(state.workDiffScope, selectedWorkingFileInfo(state.selectedFile));
      }
      ensureSelectedFileChangeKey();
      els.changeList.innerHTML = `
        ${operationBanner}
        ${renderChangeSection("unstaged", "未暂存", groups.unstaged, [
          { action: "stageFile", label: "暂存", bulkLabel: "暂存所选" },
          { action: "discardWorktreeFile", label: "丢弃", bulkLabel: "丢弃所选", danger: true },
        ])}
      `;
      els.stagedChangeList.innerHTML = `
        ${renderChangeSection("staged", "已暂存", groups.staged, [
          { action: "unstageFile", label: "取消暂存", bulkLabel: "取消所选" },
          { action: "discardStagedFile", label: "丢弃", bulkLabel: "丢弃所选", danger: true },
        ])}
      `;
      bindFileTree(els.changeList, { selectable: true, loadMoreScope: "unstaged" });
      bindFileTree(els.stagedChangeList, { selectable: true, loadMoreScope: "staged" });
      markSelectedFile();
      if (refreshDiff && state.activeDiff?.source === "worktree") {
        if (state.selectedFile) loadWorkingDiffLazy(state.selectedFile).catch((error) => toast(error.message));
        else renderWorkDiffEmpty("未选择文件");
      }
    }
  }
  const counts = countFiles(files);
  const groups = changeGroups(files);
  const filterText = terms.length ? t(" · 筛选 {visible}/{total}", { visible: visibleFiles.length, total: files.length }) : "";
  els.draftNote.textContent = worktreeDraftSummary(groups, counts, filterText);
  const unborn = Boolean(state.data?.sync?.unborn);
  els.stashChanges.disabled = unborn;
  els.stashChanges.title = unborn ? t("当前分支还没有首个提交，不能创建储藏") : t("储藏全部未提交更改");
  if (typeof renderRecoveryUndoButton === "function") renderRecoveryUndoButton();
}

function worktreeDraftSummary(groups, counts, filterText = "") {
  const items = [
    [groups.unstaged.length, "{count} 个未暂存"],
    [groups.staged.length, "{count} 个已暂存"],
    [counts.C, "{count} 个冲突"],
    [counts.M, "{count} 个修改"],
    [counts.A, "{count} 个新增"],
    [counts.D, "{count} 个删除"],
    [counts.R, "{count} 个重命名"],
  ];
  const summary = items
    .filter(([count]) => count > 0)
    .map(([count, label]) => t(label, { count }))
    .join(" · ");
  return `${summary}${filterText}`;
}

function ensureSelectedFileChangeKey() {
  if (!state.selectedFile) return;
  const scope = normalizeWorkDiffScopeChoice(state.workDiffScope, selectedWorkingFileInfo(state.selectedFile));
  state.workDiffScope = scope;
  state.selectedChanges.add(changeKey(scope, state.selectedFile));
}

function worktreeFilterTerms() {
  return String(state.worktreeFilter || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function filterWorkingFiles(files, terms = worktreeFilterTerms()) {
  if (!terms.length) return files;
  return files.filter((file) => {
    const text = worktreeFileSearchText(file);
    return terms.every((term) => text.includes(term));
  });
}

function worktreeFileSearchText(file) {
  const pathText = String(file.file || "");
  const normalized = pathText.replaceAll("\\", "/");
  const leaf = normalized.split("/").filter(Boolean).pop() || pathText;
  return [
    pathText,
    normalized,
    leaf,
    file.state,
    file.extra,
    file.indexStatus,
    file.worktreeStatus,
    file.oldFile,
    file.previousFile,
    file.conflict ? "冲突 conflict unmerged" : "",
    file.staged ? "已暂存 staged cached index" : "",
    file.unstaged || (!file.staged && file.unstaged !== false) ? "未暂存 unstaged worktree working" : "",
    worktreeStateLabel(file.state),
    worktreeRawStatusLabel(file),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function worktreeStateLabel(stateCode) {
  const labels = {
    A: "新增 添加 未跟踪 added add new untracked",
    C: "冲突 unmerged conflict",
    D: "删除 deleted delete removed remove",
    M: "修改 modified change changed",
    R: "重命名 renamed rename moved move",
  };
  return labels[stateCode] || "";
}

function worktreeRawStatusLabel(file) {
  const raw = [file.extra, file.indexStatus, file.worktreeStatus].filter(Boolean).join("").toUpperCase();
  const labels = [];
  if (raw.includes("?")) labels.push("未跟踪 untracked new");
  if (raw.includes("R")) labels.push("重命名 renamed rename moved move");
  if (raw.includes("C")) labels.push("复制 copied copy");
  if (raw.includes("U")) labels.push("冲突 unmerged conflict");
  if (raw.includes("A")) labels.push("新增 添加 added add new");
  if (raw.includes("D")) labels.push("删除 deleted delete removed remove");
  if (raw.includes("M")) labels.push("修改 modified change changed");
  return labels.join(" ");
}

function updateWorktreeFilterMeta(terms, visibleCount, totalCount) {
  const active = terms.length > 0;
  els.worktreeFilterCount.textContent = active ? `${visibleCount}/${totalCount}` : "";
  els.worktreeFilterCount.title = active ? t("工作区筛选结果：{visible} / {total}", { visible: visibleCount, total: totalCount }) : "";
  els.worktreeFilterCount.hidden = !active;
  els.clearWorktreeFilter.hidden = !active;
}

function updateWorktreeFilter(value) {
  state.worktreeFilter = String(value || "");
  renderStage();
}

function clearWorktreeFilter() {
  if (!state.worktreeFilter && !els.worktreeFilterInput.value) return;
  state.worktreeFilter = "";
  els.worktreeFilterInput.value = "";
  renderStage();
  els.worktreeFilterInput.focus();
}

function renderRepoOperationBanner(files) {
  const operation = state.data?.repo?.operation;
  const conflicts = (files || []).filter((file) => file.conflict);
  if (!operation && !conflicts.length) return "";
  const isRevert = operation?.type === "revert";
  const isCherryPick = operation?.type === "cherryPick";
  const isMerge = operation?.type === "merge";
  const isRebase = operation?.type === "rebase";
  const actionName = t(isRebase ? "变基" : isMerge ? "合并" : isCherryPick ? "挑选" : isRevert ? "还原" : "操作");
  const title = t(isRebase ? "变基发生冲突" : isMerge ? "合并发生冲突" : isRevert ? "还原提交发生冲突" : isCherryPick ? "挑选提交发生冲突" : operation?.label || "仓库有未完成操作");
  const text = conflicts.length
    ? t("{count} 个冲突文件还没有解决。解决后先暂存冲突文件，再继续{action}；不想保留这次{action}就中止。", { count: conflicts.length, action: actionName })
    : t("当前{action}已经没有冲突文件，确认解决结果后可以继续{action}。", { action: actionName });
  const actions = isRevert
    ? `
      <button class="mini-btn" data-repo-operation="continueRevert" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? t("先解决并暂存所有冲突文件") : "git revert --continue"}"><span>${t("继续还原")}</span><span class="command-hint">git revert --continue</span></button>
      <button class="mini-btn danger" data-repo-operation="abortRevert" type="button" title="git revert --abort"><span>${t("中止还原")}</span><span class="command-hint">git revert --abort</span></button>
    `
    : isCherryPick
    ? `
      <button class="mini-btn" data-repo-operation="continueCherryPick" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? t("先解决并暂存所有冲突文件") : "git cherry-pick --continue"}"><span>${t("继续挑选")}</span><span class="command-hint">git cherry-pick --continue</span></button>
      <button class="mini-btn" data-repo-operation="skipCherryPick" type="button" title="git cherry-pick --skip"><span>${t("跳过挑选")}</span><span class="command-hint">git cherry-pick --skip</span></button>
      <button class="mini-btn danger" data-repo-operation="abortCherryPick" type="button" title="git cherry-pick --abort"><span>${t("中止挑选")}</span><span class="command-hint">git cherry-pick --abort</span></button>
    `
    : isMerge
    ? `
      <button class="mini-btn" data-repo-operation="continueMerge" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? t("先解决并暂存所有冲突文件") : "git merge --continue"}"><span>${t("继续合并")}</span><span class="command-hint">git merge --continue</span></button>
      <button class="mini-btn danger" data-repo-operation="abortMerge" type="button" title="git merge --abort"><span>${t("中止合并")}</span><span class="command-hint">git merge --abort</span></button>
    `
    : isRebase
    ? `
      <button class="mini-btn" data-repo-operation="continueRebase" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? t("先解决并暂存所有冲突文件") : "git rebase --continue"}"><span>${t("继续变基")}</span><span class="command-hint">git rebase --continue</span></button>
      <button class="mini-btn" data-repo-operation="skipRebase" type="button" title="git rebase --skip"><span>${t("跳过提交")}</span><span class="command-hint">git rebase --skip</span></button>
      <button class="mini-btn danger" data-repo-operation="abortRebase" type="button" title="git rebase --abort"><span>${t("中止变基")}</span><span class="command-hint">git rebase --abort</span></button>
    `
    : "";
  return `
    <div class="operation-banner">
      <div class="operation-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(text)}</span>
      </div>
      ${renderConflictChoiceRows(conflicts)}
      <div class="operation-actions">${actions}</div>
    </div>
  `;
}

function refreshRepoOperationBanner(files) {
  const current = els.changeList.querySelector(".operation-banner");
  const html = renderRepoOperationBanner(files);
  if (current) {
    if (html) current.outerHTML = html;
    else current.remove();
  } else if (html) {
    els.changeList.insertAdjacentHTML("afterbegin", html);
  }
}

function renderConflictChoiceRows(conflicts) {
  if (!conflicts.length) return "";
  return `
    <div class="conflict-choice-list">
      ${conflicts
        .map((file) => {
          const filePath = file.file || "";
          return `
            <div class="conflict-choice-row">
              <span class="conflict-choice-path" title="${escapeAttr(filePath)}">${escapeHtml(filePath)}</span>
              <div class="conflict-choice-actions">
                <button class="mini-btn" data-conflict-choice="resolveConflictOurs" data-file="${escapeAttr(filePath)}" type="button"><span>${t("当前")}</span><span class="command-hint">--ours</span></button>
                <button class="mini-btn" data-conflict-choice="resolveConflictTheirs" data-file="${escapeAttr(filePath)}" type="button"><span>${t("对方")}</span><span class="command-hint">--theirs</span></button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function changeGroups(files) {
  return {
    unstaged: files.filter((file) => file.unstaged || (!file.staged && file.unstaged !== false)),
    staged: files.filter((file) => file.staged),
  };
}

function renderChangeSection(scope, title, files, actions) {
  const emptyText = scope === "unstaged" ? t("工作区没有未暂存的更改") : t("没有已暂存的更改");
  const localizedTitle = t(title);
  const selectedCount = selectedFilesInScope(scope, files).length;
  const renderLimit = worktreeFileRenderLimit(scope, files);
  const renderedFiles = files.slice(0, renderLimit);
  return `
    <section class="change-section">
      <div class="change-section-title">
        <div class="change-section-label">
          <span>${localizedTitle}</span>
          <em>${files.length}</em>
        </div>
        <div class="change-section-actions">
          ${selectedCount ? `<span class="selected-count">${t("{count} 已选", { count: selectedCount })}</span>` : ""}
          ${actions
            .map(
              (item) => `
                <button class="mini-btn bulk-action ${item.danger ? "danger" : ""}" type="button" data-bulk-file-action="${escapeAttr(item.action)}" data-scope="${escapeAttr(scope)}" ${selectedCount ? "" : "disabled"}>
                  ${escapeHtml(t(item.bulkLabel || item.label || "操作"))}
                </button>
              `
            )
            .join("")}
        </div>
      </div>
      ${
        files.length
          ? `${fileTreeHtml(renderedFiles, { selectionScope: scope, totalFiles: files })}${renderWorktreeFileTreeMore(scope, renderedFiles.length, files.length)}`
          : `<div class="file-row empty-row"><span></span><span class="file-name">${emptyText}</span><span></span></div>`
      }
    </section>
  `;
}

function worktreeFileRenderLimit(scope, files) {
  if (!state.worktreeRenderLimits) state.worktreeRenderLimits = { unstaged: WORKTREE_FILE_INITIAL_LIMIT, staged: WORKTREE_FILE_INITIAL_LIMIT };
  const current = Math.max(WORKTREE_FILE_INITIAL_LIMIT, Number(state.worktreeRenderLimits[scope]) || 0);
  const selectedFile = String(state.selectedFile || "");
  const selectedIndex = selectedFile
    ? files.findIndex((file) => file.file === selectedFile && state.selectedChanges.has(changeKey(scope, file.file)))
    : -1;
  const selectedLimit = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  state.worktreeRenderLimits[scope] = Math.max(current, selectedLimit);
  return Math.min(files.length, state.worktreeRenderLimits[scope]);
}

function renderWorktreeFileTreeMore(scope, shown, total) {
  if (shown >= total) return "";
  return `
    <button class="mini-btn file-tree-more" type="button" data-file-tree-more="${escapeAttr(scope)}" title="${escapeAttr(t("继续显示更多文件"))}">
      <span>${t("继续显示")}</span>
      <span class="file-tree-more-count">${t("已显示 {shown}/{total}", { shown, total })}</span>
    </button>
  `;
}

function expandWorktreeFileTree(scope) {
  if (scope !== "unstaged" && scope !== "staged") return false;
  const groups = changeGroups(filterWorkingFiles(state.data?.workingFiles || []));
  const files = groups[scope] || [];
  const current = worktreeFileRenderLimit(scope, files);
  if (current >= files.length) return false;
  const root = scope === "staged" ? els.stagedChangeList : els.changeList;
  const tree = root.querySelector(".change-section .file-tree");
  const chunkedTree = tree?.querySelector(":scope > .tree-chunk");
  const batchSize = chunkedTree ? WORKTREE_FILE_BATCH_SIZE * 2 : WORKTREE_FILE_BATCH_SIZE;
  const next = Math.min(files.length, current + batchSize);
  if (!tree) {
    state.worktreeRenderLimits[scope] = next;
    renderStage({ refreshDiff: false });
    return true;
  }
  const binding = fileTreeBindings.get(root);
  if (binding) syncTreeChunkWindow(root);
  const batch = files.slice(current, next);
  const addedBlockSize = appendFileTreeBatch(tree, fileTreeHtml(batch, { selectionScope: scope, totalFiles: files }));
  if (binding) {
    const currentHeight = Number.isFinite(binding.estimatedScrollHeight) ? binding.estimatedScrollHeight : root.scrollHeight;
    binding.estimatedScrollHeight = currentHeight + addedBlockSize;
  }
  state.worktreeRenderLimits[scope] = next;
  const more = root.querySelector(`[data-file-tree-more="${scope}"]`);
  if (next >= files.length) {
    more?.remove();
  } else {
    const count = more?.querySelector(".file-tree-more-count");
    if (count) count.textContent = t("已显示 {shown}/{total}", { shown: next, total: files.length });
  }
  if (binding) scheduleTreeChunkSync(root, binding);
  return true;
}

function changeKey(scope, filePath) {
  return `${scope}:${filePath}`;
}

function fileSnapshotPayload(filePath, scope = "") {
  const snapshot = workingFileForSnapshot(filePath, scope)?.snapshot || "";
  return snapshot ? { expectedFileSnapshot: snapshot } : {};
}

function worktreeSnapshotPayload() {
  const snapshot = state.data?.worktreeSnapshot || "";
  return snapshot ? { expectedWorktreeSnapshot: snapshot } : {};
}

function workingFileForSnapshot(filePath, scope = "") {
  const matches = (state.data?.workingFiles || []).filter((file) => file.file === filePath);
  if (scope === "staged") return matches.find((file) => file.staged) || matches[0] || null;
  if (scope === "unstaged" || scope === "untracked") return matches.find((file) => file.unstaged) || matches[0] || null;
  if (scope === "conflict") return matches.find((file) => file.conflict) || matches[0] || null;
  return matches[0] || null;
}

function selectedFilesInScope(scope, files) {
  return files.filter((file) => state.selectedChanges.has(changeKey(scope, file.file)));
}

function pruneSelectedChanges(groups) {
  const valid = new Set([
    ...groups.unstaged.map((file) => changeKey("unstaged", file.file)),
    ...groups.staged.map((file) => changeKey("staged", file.file)),
  ]);
  for (const key of state.selectedChanges) {
    if (!valid.has(key)) state.selectedChanges.delete(key);
  }
}

