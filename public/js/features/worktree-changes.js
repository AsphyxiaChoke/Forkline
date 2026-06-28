// Worktree and staging area rendering.
function renderWorkingFiles() {
  const files = state.data.workingFiles;
  const terms = worktreeFilterTerms();
  const visibleFiles = filterWorkingFiles(files, terms);
  state.worktreeSignature = worktreeStateSignature(files, state.data.repo.operation);
  updateWorktreeFilterMeta(terms, visibleFiles.length, files.length);
}

function renderStage() {
  els.changeList.innerHTML = "";
  const files = state.data.workingFiles;
  const terms = worktreeFilterTerms();
  const visibleFiles = filterWorkingFiles(files, terms);
  state.worktreeSignature = worktreeStateSignature(files, state.data.repo.operation);
  updateWorktreeFilterMeta(terms, visibleFiles.length, files.length);
  const operationBanner = renderRepoOperationBanner(files);
  if (!files.length) {
    state.selectedFile = "";
    state.selectedChanges.clear();
    els.changeList.innerHTML = `${operationBanner}<div class="file-row"><span></span><span class="file-name">没有未提交的更改</span><span></span></div>`;
    if (state.activeDiff?.source !== "history") renderWorkDiffEmpty("没有未提交的更改");
  } else {
    const groups = changeGroups(visibleFiles);
    pruneSelectedChanges(groups);
    const visibleChangeFiles = [...groups.unstaged, ...groups.staged];
    if (!visibleChangeFiles.length) {
      state.selectedFile = "";
      state.selectedChanges.clear();
      els.changeList.innerHTML = `${operationBanner}<div class="file-row empty-row"><span></span><span class="file-name">${terms.length ? "没有匹配的更改" : "没有未提交的更改"}</span><span></span></div>`;
      if (state.activeDiff?.source !== "history") renderWorkDiffEmpty(terms.length ? "没有匹配的更改" : "没有未提交的更改");
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
      els.changeList.innerHTML = `
        ${operationBanner}
        ${renderChangeSection("unstaged", "工作区", groups.unstaged, [
          { action: "stageFile", label: "暂存", bulkLabel: "暂存所选" },
          { action: "discardWorktreeFile", label: "丢弃", bulkLabel: "丢弃所选", danger: true },
        ])}
        ${renderChangeSection("staged", "已暂存", groups.staged, [
          { action: "unstageFile", label: "取消暂存", bulkLabel: "取消所选" },
          { action: "discardStagedFile", label: "丢弃", bulkLabel: "丢弃所选", danger: true },
        ])}
      `;
      bindFileTree(els.changeList, { selectable: true });
      markSelectedFile();
      if (state.activeDiff?.source !== "history") {
        if (state.selectedFile) loadWorkingDiff(state.selectedFile);
        else renderWorkDiffEmpty("未选择文件");
      }
    }
  }
  const counts = countFiles(files);
  const groups = changeGroups(files);
  const filterText = terms.length ? ` · 筛选 ${visibleFiles.length}/${files.length}` : "";
  els.draftNote.textContent = `${groups.unstaged.length} 个未暂存，${groups.staged.length} 个已暂存 · ${counts.C} 个冲突，${counts.M} 个修改，${counts.A} 个新增，${counts.D} 个删除${filterText}`;
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
  els.worktreeFilterCount.title = active ? `工作区筛选结果：${visibleCount} / ${totalCount}` : "";
  els.worktreeFilterCount.hidden = !active;
  els.clearWorktreeFilter.hidden = !active;
}

function updateWorktreeFilter(value) {
  state.worktreeFilter = String(value || "");
  renderWorkingFiles();
  renderStage();
}

function clearWorktreeFilter() {
  if (!state.worktreeFilter && !els.worktreeFilterInput.value) return;
  state.worktreeFilter = "";
  els.worktreeFilterInput.value = "";
  renderWorkingFiles();
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
  const actionName = isRebase ? "变基" : isMerge ? "合并" : isCherryPick ? "挑选" : isRevert ? "还原" : "操作";
  const title = isRebase ? "变基发生冲突" : isMerge ? "合并发生冲突" : isRevert ? "还原提交发生冲突" : isCherryPick ? "挑选提交发生冲突" : operation?.label || "仓库有未完成操作";
  const text = conflicts.length
    ? `${conflicts.length} 个冲突文件还没有解决。解决后先暂存冲突文件，再继续${actionName}；不想保留这次${actionName}就中止。`
    : `当前${actionName}已经没有冲突文件，确认解决结果后可以继续${actionName}。`;
  const actions = isRevert
    ? `
      <button class="mini-btn" data-repo-operation="continueRevert" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git revert --continue"}"><span>继续还原</span><span class="command-hint">git revert --continue</span></button>
      <button class="mini-btn danger" data-repo-operation="abortRevert" type="button" title="git revert --abort"><span>中止还原</span><span class="command-hint">git revert --abort</span></button>
    `
    : isCherryPick
    ? `
      <button class="mini-btn" data-repo-operation="continueCherryPick" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git cherry-pick --continue"}"><span>继续挑选</span><span class="command-hint">git cherry-pick --continue</span></button>
      <button class="mini-btn" data-repo-operation="skipCherryPick" type="button" title="git cherry-pick --skip"><span>跳过挑选</span><span class="command-hint">git cherry-pick --skip</span></button>
      <button class="mini-btn danger" data-repo-operation="abortCherryPick" type="button" title="git cherry-pick --abort"><span>中止挑选</span><span class="command-hint">git cherry-pick --abort</span></button>
    `
    : isMerge
    ? `
      <button class="mini-btn" data-repo-operation="continueMerge" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git merge --continue"}"><span>继续合并</span><span class="command-hint">git merge --continue</span></button>
      <button class="mini-btn danger" data-repo-operation="abortMerge" type="button" title="git merge --abort"><span>中止合并</span><span class="command-hint">git merge --abort</span></button>
    `
    : isRebase
    ? `
      <button class="mini-btn" data-repo-operation="continueRebase" type="button" ${conflicts.length ? "disabled" : ""} title="${conflicts.length ? "先解决并暂存所有冲突文件" : "git rebase --continue"}"><span>继续变基</span><span class="command-hint">git rebase --continue</span></button>
      <button class="mini-btn" data-repo-operation="skipRebase" type="button" title="git rebase --skip"><span>跳过提交</span><span class="command-hint">git rebase --skip</span></button>
      <button class="mini-btn danger" data-repo-operation="abortRebase" type="button" title="git rebase --abort"><span>中止变基</span><span class="command-hint">git rebase --abort</span></button>
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
                <button class="mini-btn" data-conflict-choice="resolveConflictOurs" data-file="${escapeAttr(filePath)}" type="button"><span>当前</span><span class="command-hint">--ours</span></button>
                <button class="mini-btn" data-conflict-choice="resolveConflictTheirs" data-file="${escapeAttr(filePath)}" type="button"><span>对方</span><span class="command-hint">--theirs</span></button>
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
  const emptyText = title === "工作区" ? "工作区没有未暂存的更改" : "没有已暂存的更改";
  const selectedCount = selectedFilesInScope(scope, files).length;
  return `
    <section class="change-section">
      <div class="change-section-title">
        <div class="change-section-label">
          <span>${title}</span>
          <em>${files.length}</em>
        </div>
        <div class="change-section-actions">
          ${selectedCount ? `<span class="selected-count">${selectedCount} 已选</span>` : ""}
          ${actions
            .map(
              (item) => `
                <button class="mini-btn bulk-action ${item.danger ? "danger" : ""}" type="button" data-bulk-file-action="${escapeAttr(item.action)}" data-scope="${escapeAttr(scope)}" ${selectedCount ? "" : "disabled"}>
                  ${escapeHtml(item.bulkLabel || item.label || "操作")}
                </button>
              `
            )
            .join("")}
        </div>
      </div>
      ${
        files.length
          ? fileTreeHtml(files, { selectionScope: scope })
          : `<div class="file-row empty-row"><span></span><span class="file-name">${emptyText}</span><span></span></div>`
      }
    </section>
  `;
}

function changeKey(scope, filePath) {
  return `${scope}:${filePath}`;
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

