// Diff rendering, file trees, workbench diff, and active diff modal.
function renderDiff(diff) {
  if (!diff?.length) return `<div class="diff"><div class="diff-line"><span class="ln">1</span><code>没有可显示的 Diff</code></div></div>`;
  return `
    <div class="diff">
      ${diff
        .map(
          (line, index) => `
          <div class="diff-line ${line.type}">
            <span class="ln">${index + 1}</span>
            <code>${escapeHtml(line.text)}</code>
          </div>`
        )
        .join("")}
    </div>
  `;
}

function fileTreeHtml(files, options = {}) {
  const root = { dirs: new Map(), files: [] };
  files.forEach((file) => addFileToTree(root, file));
  return `<div class="file-tree">${treeNodeHtml(root, 0, options)}</div>`;
}

function addFileToTree(root, file) {
  const raw = String(file.file || "");
  const normalized = raw.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const leaf = parts.pop() || normalized || "未知文件";
  let node = root;
  parts.forEach((part) => {
    if (!node.dirs.has(part)) node.dirs.set(part, { name: part, dirs: new Map(), files: [] });
    node = node.dirs.get(part);
  });
  node.files.push({ ...file, raw, leaf });
}

function treeNodeHtml(node, depth, options = {}) {
  const dirs = [...node.dirs.values()]
    .map(
      (dir) => `
        <div class="tree-group" style="--depth:${depth}">
          <button class="tree-head" type="button">
            <span class="tree-caret"></span>
            <span class="tree-folder" title="${escapeAttr(dir.name)}">${escapeHtml(dir.name)}</span>
            <span class="tree-count">${treeFileCount(dir)}</span>
          </button>
          <div class="tree-children">${treeNodeHtml(dir, depth + 1, options)}</div>
        </div>
      `
    )
    .join("");
  const rows = node.files.map((file) => fileLeafRowHtml(file, depth, options)).join("");
  return `${dirs}${rows}`;
}

function treeFileCount(node) {
  return [...node.dirs.values()].reduce((total, dir) => total + treeFileCount(dir), node.files.length);
}

function fileLeafRowHtml(file, depth, options = {}) {
  const selectionScope = options.selectionScope || "";
  const selected = selectionScope && state.selectedChanges.has(changeKey(selectionScope, file.raw));
  const conflict = Boolean(file.conflict);
  return `
    <button class="file-row leaf-row ${selected ? "multi-selected" : ""} ${conflict ? "conflict" : ""}" type="button" data-select-file data-scope="${escapeAttr(selectionScope)}" data-file="${escapeAttr(file.raw)}" style="--depth:${depth}" title="${escapeAttr(conflict ? `${file.raw} · 冲突未解决` : file.raw)}">
      <span class="badge ${file.state}">${conflict ? "!" : file.state}</span>
      <span class="file-leaf">${escapeHtml(file.leaf)}</span>
      <span class="file-extra">${escapeHtml(conflict ? "冲突" : file.extra || "")}</span>
    </button>
  `;
}

function bindFileTree(root, options = {}) {
  root.querySelectorAll(".tree-head").forEach((head) => {
    head.addEventListener("click", () => head.closest(".tree-group")?.classList.toggle("collapsed"));
  });
  if (options.mode === "worktree" || options.selectable) {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", (event) => {
        const filePath = row.dataset.file || "";
        const scope = row.dataset.scope || "";
        if (scope) {
          selectChangeFile(filePath, scope, event);
        } else {
          selectWorkingFile(filePath);
        }
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showFileContextMenu(event, row.dataset.file || "", row.dataset.scope || "");
      });
    });
    markSelectedFile();
    return;
  }
  if (options.mode === "commit") {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", () => selectCommitFile(row.dataset.file || ""));
    });
    markCommitFile();
  }
  if (options.mode === "sync") {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", () => selectSyncPreviewFile(row.dataset.file || ""));
    });
    markSyncPreviewFile();
  }
  if (options.mode === "compare") {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      row.addEventListener("click", () => selectCompareFile(row.dataset.file || ""));
    });
    markCompareFile();
  }
}

function selectChangeFile(filePath, scope, event) {
  if (!filePath) return;
  updateChangeSelection(scope, filePath, event);
  const selected = state.selectedChanges.has(changeKey(scope, filePath));
  state.selectedFile = selected ? filePath : "";
  if (selected) {
    setInspectorContext("file", inspectorTabs.file.includes(state.selectedTab) ? state.selectedTab : "fileHistory");
  }
  renderStage();
  if (selected) openSelectedFileInspector(filePath);
  else renderWorkDiffEmpty("未选择文件");
}

function updateChangeSelection(scope, filePath, event = {}) {
  const key = changeKey(scope, filePath);
  const additive = Boolean(event.ctrlKey || event.metaKey);
  const items = changeGroups(filterWorkingFiles(state.data?.workingFiles || []))[scope] || [];

  if (event.shiftKey && state.lastChangeSelection?.scope === scope) {
    const anchorIndex = items.findIndex((file) => changeKey(scope, file.file) === state.lastChangeSelection.key);
    const targetIndex = items.findIndex((file) => file.file === filePath);
    if (anchorIndex >= 0 && targetIndex >= 0) {
      if (!additive) clearSelectedScope(scope);
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      items.slice(start, end + 1).forEach((file) => state.selectedChanges.add(changeKey(scope, file.file)));
    } else if (!additive) {
      state.selectedChanges.clear();
      state.selectedChanges.add(key);
    }
  } else if (additive) {
    if (state.selectedChanges.has(key)) state.selectedChanges.delete(key);
    else state.selectedChanges.add(key);
  } else {
    state.selectedChanges.clear();
    state.selectedChanges.add(key);
  }

  state.lastChangeSelection = { scope, key };
}

function clearSelectedScope(scope) {
  const prefix = `${scope}:`;
  for (const key of state.selectedChanges) {
    if (key.startsWith(prefix)) state.selectedChanges.delete(key);
  }
}

function selectWorkingFile(filePath) {
  if (!filePath || filePath === state.selectedFile) return;
  state.selectedFile = filePath;
  setInspectorContext("file", inspectorTabs.file.includes(state.selectedTab) ? state.selectedTab : "fileHistory");
  state.workDiffScope = preferredWorkDiffScope(selectedWorkingFileInfo(filePath));
  markSelectedFile();
  loadWorkingDiff(filePath);
  openSelectedFileInspector(filePath);
}

function openSelectedFileInspector(filePath) {
  if (!filePath) return;
  if (state.selectedTab === "fileBlame") {
    openFileBlame(filePath).catch((error) => toast(error.message));
    return;
  }
  openFileHistory(filePath).catch((error) => toast(error.message));
}

function markSelectedFile() {
  document.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedFile);
  });
}

function selectCommitFile(filePath) {
  if (!filePath || filePath === state.selectedCommitFile) return;
  state.selectedCommitFile = filePath;
  renderInspector();
}

function syncCommitBySha(sha) {
  const sync = state.data?.sync || {};
  return [...(sync.incoming || []), ...(sync.outgoing || [])].find((commit) => commit.sha === sha);
}

async function selectSyncCommit(sha) {
  const commit = syncCommitBySha(sha);
  if (!commit) {
    toast("这个提交已经不在当前同步列表中，请刷新后再试。");
    return;
  }
  state.selectedSyncSha = sha;
  state.selectedSyncFile = "";
  renderInspector();
  await loadSyncCommitPreview(sha);
}

async function loadSyncCommitPreview(sha) {
  if (!sha || state.commitDetails.has(sha) || state.loadingCommitDetails.has(sha)) return;
  await loadCommit(sha);
  if (state.selectedTab === "sync" && state.selectedSyncSha === sha) {
    renderInspector();
  }
}

function selectSyncPreviewFile(filePath) {
  if (!filePath || filePath === state.selectedSyncFile) return;
  state.selectedSyncFile = filePath;
  renderInspector();
}

function selectCompareFile(filePath) {
  if (!filePath || filePath === state.selectedCompareFile) return;
  state.selectedCompareFile = filePath;
  renderInspector();
}

function markCompareFile() {
  els.detailBody.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedCompareFile);
  });
}

function markCommitFile() {
  els.detailBody.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedCommitFile);
  });
}

function markSyncPreviewFile() {
  els.detailBody.querySelectorAll("[data-select-file]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.file === state.selectedSyncFile);
  });
}

function renderWorkDiffEmpty(message) {
  resetDiffLineSelection(false);
  setActiveDiff(null);
  els.workDiffTitle.textContent = "变更对照";
  els.workDiffPath.textContent = "";
  els.workDiffView.className = "work-diff-view empty";
  els.workDiffView.textContent = message;
}

async function loadWorkingDiff(filePath) {
  if (!filePath) {
    renderWorkDiffEmpty("未选择文件");
    return;
  }
  const fileInfo = selectedWorkingFileInfo(filePath);
  const scope = normalizeWorkDiffScopeChoice(state.workDiffScope, fileInfo);
  state.workDiffScope = scope;
  const requestId = ++state.diffRequestId;
  els.workDiffTitle.textContent = "变更对照";
  els.workDiffPath.textContent = filePath;
  els.workDiffView.className = "work-diff-view loading";
  els.workDiffView.textContent = "正在读取差异...";
  try {
    const data = await api(`/api/worktree-diff?file=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(scope)}`);
    if (requestId !== state.diffRequestId) return;
    renderWorkDiff(data.file || filePath, data.diff || [], data.scope || "unstaged");
  } catch (error) {
    if (requestId !== state.diffRequestId) return;
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = error.message;
  }
}

function renderWorkDiff(filePath, diff, scope = "unstaged") {
  resetDiffLineSelection(false);
  const scopeLabel = workDiffScopeLabel(scope);
  const title = `${shortFileName(filePath)} · ${scopeLabel}`;
  state.workDiffScope = scope === "staged" ? "staged" : "unstaged";
  setActiveDiff({ source: "worktree", title, path: filePath, diff, scope, emptyText: "没有可显示的差异" });
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = filePath;
  if (!diff.length) {
    els.workDiffView.className = "work-diff-view empty";
    els.workDiffView.textContent = "没有可显示的差异";
    return;
  }
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的差异", { hunkActions: true, lineAction: selectedDiffLineAction(filePath, scope), filePath, scope });
  updateDiffLineSelectionToolbar();
}

function renderHistoryDiffInWorkbench(commit, detail, filePath) {
  resetDiffLineSelection(false);
  const diff = diffForFile(detail.diff || [], filePath);
  const title = `${shortFileName(filePath)} · 历史提交`;
  const path = `${commit.short} · ${filePath}`;
  setActiveDiff({ source: "history", title, path, diff, emptyText: "没有可显示的历史改动" });
  state.diffRequestId += 1;
  els.workDiffTitle.textContent = title;
  els.workDiffPath.textContent = path;
  els.workDiffView.className = "work-diff-view";
  els.workDiffView.innerHTML = renderSideDiff(diff, "没有可显示的历史改动");
}

function setActiveDiff(payload) {
  state.activeDiff = payload;
  if (els.maximizeDiff) els.maximizeDiff.disabled = !payload?.diff?.length;
}

function selectedWorkingFileInfo(filePath = state.selectedFile) {
  if (!filePath) return null;
  return (state.data?.workingFiles || []).find((file) => file.file === filePath) || null;
}

function fileChangeFlags(fileInfo) {
  return {
    hasUnstaged: Boolean(fileInfo?.unstaged || (!fileInfo?.staged && fileInfo?.unstaged !== false)),
    hasStaged: Boolean(fileInfo?.staged),
  };
}

function isUntrackedFile(fileInfo) {
  return Boolean(fileInfo && fileInfo.indexStatus === "?" && fileInfo.worktreeStatus === "?");
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

async function runWorkDiffHunkAction(action, button) {
  const file = state.selectedFile;
  const hunkIndex = Number.parseInt(button?.dataset.hunkIndex || "", 10);
  const scope = button?.dataset.hunkScope || state.activeDiff?.scope || "unstaged";
  if (!file || !Number.isInteger(hunkIndex) || hunkIndex < 0) {
    toast("请选择要操作的改动块");
    return;
  }
  if (action === "discardWorktreeHunk" && !state.data?.repo?.isSample && !confirm(`确认丢弃这个改动块？\n\n文件：${file}\n此操作无法撤销。`)) return;
  const buttons = els.workDiffView.querySelectorAll("[data-hunk-action]");
  buttons.forEach((item) => {
    item.disabled = true;
  });
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action, file, scope, hunkIndex }),
    });
    toast(result.output || "改动块操作完成");
    await refreshWorktree(true);
    if (state.selectedFile) {
      state.workDiffScope = normalizeWorkDiffScopeChoice(state.workDiffScope, selectedWorkingFileInfo(state.selectedFile));
      await loadWorkingDiff(state.selectedFile);
    }
  } catch (error) {
    toast(error.message);
    await refreshWorktree(true);
  } finally {
    buttons.forEach((item) => {
      item.disabled = false;
    });
  }
}

function openDiffModal() {
  if (!state.activeDiff?.diff?.length) {
    toast("没有可最大化的对照内容");
    return;
  }
  els.diffModalTitle.textContent = state.activeDiff.title || "变更对照";
  els.diffModalPath.textContent = state.activeDiff.path || "";
  els.diffModalBody.innerHTML = renderSideDiff(state.activeDiff.diff, state.activeDiff.emptyText || "没有可显示的差异", diffModalOptions());
  syncDiffLineSelectionRows();
  els.diffModal.classList.add("show");
  els.diffModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeDiffModal() {
  els.diffModal.classList.remove("show");
  els.diffModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderSideDiff(diff, emptyText, options = {}) {
  if (!diff?.length) return `<div class="diff-empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="side-diff ${options.lineAction ? "line-selectable" : ""}">
      ${options.lineAction ? renderDiffLineToolbar(options.lineAction) : ""}
      <div class="side-diff-head"><span>旧版本</span><span>新版本</span></div>
      ${sideBySideRows(diff, options)}
    </div>
  `;
}

function diffModalOptions() {
  const active = state.activeDiff || {};
  if (active.source !== "worktree") return {};
  return {
    lineAction: selectedDiffLineAction(active.path, active.scope),
    filePath: active.path,
    scope: active.scope,
  };
}

function diffForFile(diff, filePath) {
  const target = normalizeDiffPath(filePath);
  const blocks = [];
  let current = [];
  for (const line of diff || []) {
    const text = String(line.text || "");
    if (text.startsWith("diff --git ")) {
      if (current.length) blocks.push(current);
      current = [line];
      continue;
    }
    if (current.length) current.push(line);
  }
  if (current.length) blocks.push(current);
  const matched = blocks.find((block) => diffBlockMatchesFile(block, target));
  return matched || [];
}

function diffBlockMatchesFile(block, target) {
  return block.some((line) => {
    const text = String(line.text || "");
    const normalized = normalizeDiffPath(text);
    return normalized.includes(` a/${target}`) || normalized.includes(` b/${target}`) || normalized.endsWith(`a/${target}`) || normalized.endsWith(`b/${target}`);
  });
}

function normalizeDiffPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^"|"$/g, "");
}

function sideBySideRows(diff, options = {}) {
  const rows = [];
  let oldLine = 0;
  let newLine = 0;
  let hunkLineIndex = -1;
  for (let index = 0; index < diff.length; index++) {
    const line = diff[index];
    const text = String(line.text || "");
    if (line.type === "meta") {
      const hunk = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]) - 1;
        newLine = Number(hunk[2]) - 1;
        hunkLineIndex = -1;
      }
      rows.push(renderSideMetaRow(line, text, options));
      continue;
    }
    if (line.type === "del" && diff[index + 1]?.type === "add") {
      const delLineIndex = nextHunkLineIndex(line, hunkLineIndex);
      hunkLineIndex = delLineIndex;
      const addLineIndex = nextHunkLineIndex(diff[index + 1], hunkLineIndex);
      hunkLineIndex = addLineIndex;
      oldLine += 1;
      newLine += 1;
      rows.push(sideRow("mod", oldLine, trimDiffPrefix(text), "del", newLine, trimDiffPrefix(diff[index + 1].text), "add", {
        lineKeys: diffLineKeys(options, [
          { hunkIndex: line.hunkIndex, lineIndex: delLineIndex },
          { hunkIndex: diff[index + 1].hunkIndex, lineIndex: addLineIndex },
        ]),
      }));
      index += 1;
      continue;
    }
    if (line.type === "del") {
      hunkLineIndex = nextHunkLineIndex(line, hunkLineIndex);
      oldLine += 1;
      rows.push(sideRow("del", oldLine, trimDiffPrefix(text), "del", "", "", "blank", {
        lineKeys: diffLineKeys(options, [{ hunkIndex: line.hunkIndex, lineIndex: hunkLineIndex }]),
      }));
      continue;
    }
    if (line.type === "add") {
      hunkLineIndex = nextHunkLineIndex(line, hunkLineIndex);
      newLine += 1;
      rows.push(sideRow("add", "", "", "blank", newLine, trimDiffPrefix(text), "add", {
        lineKeys: diffLineKeys(options, [{ hunkIndex: line.hunkIndex, lineIndex: hunkLineIndex }]),
      }));
      continue;
    }
    hunkLineIndex = nextHunkLineIndex(line, hunkLineIndex);
    oldLine += 1;
    newLine += 1;
    rows.push(sideRow("ctx", oldLine, trimDiffPrefix(text), "", newLine, trimDiffPrefix(text), ""));
  }
  return rows.join("");
}

function nextHunkLineIndex(line, current) {
  return Number.isInteger(line?.hunkIndex) ? current + 1 : current;
}

function diffLineKeys(options, lines) {
  if (!options.lineAction) return [];
  return lines
    .filter((line) => Number.isInteger(line.hunkIndex) && Number.isInteger(line.lineIndex) && line.lineIndex >= 0)
    .map((line) => diffLineKey(line.hunkIndex, line.lineIndex));
}

function diffLineKey(hunkIndex, lineIndex) {
  return `${hunkIndex}:${lineIndex}`;
}

function renderDiffLineToolbar(action) {
  return `
    <div class="diff-line-toolbar">
      <span data-selected-line-count>未选择行</span>
      <button class="mini-btn" data-line-action="${escapeAttr(action.action)}" type="button" disabled title="${escapeAttr(action.title)}">${escapeHtml(action.label)}</button>
    </div>
  `;
}

function renderSideMetaRow(line, text, options = {}) {
  const actions = options.hunkActions ? workDiffHunkActionButtons(options.filePath, options.scope, line.hunkIndex) : "";
  return `
    <div class="side-row meta ${actions ? "has-actions" : ""}">
      <div class="side-meta">
        <span class="side-meta-text">${escapeHtml(text)}</span>
        ${actions}
      </div>
    </div>
  `;
}

function workDiffHunkActionButtons(filePath, scope, hunkIndex) {
  if (!Number.isInteger(hunkIndex)) return "";
  const fileInfo = selectedWorkingFileInfo(filePath);
  if (!fileInfo || fileInfo.conflict) return "";
  const untracked = isUntrackedFile(fileInfo);
  const normalizedScope = scope === "staged" ? "staged" : scope === "untracked" ? "untracked" : scope === "unstaged" ? "unstaged" : "";
  if (normalizedScope === "untracked" && untracked && fileInfo.unstaged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="stageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="untracked" type="button" title="把这个未跟踪文件块加入暂存区">暂存此块</button>
      </span>
    `;
  }
  if (untracked) return "";
  if (normalizedScope === "unstaged" && fileInfo.unstaged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="stageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="unstaged" type="button">暂存此块</button>
        <button class="mini-btn danger" data-hunk-action="discardWorktreeHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="unstaged" type="button">丢弃此块</button>
      </span>
    `;
  }
  if (normalizedScope === "staged" && fileInfo.staged) {
    return `
      <span class="hunk-actions">
        <button class="mini-btn" data-hunk-action="unstageHunk" data-hunk-index="${escapeAttr(String(hunkIndex))}" data-hunk-scope="staged" type="button">取消暂存此块</button>
      </span>
    `;
  }
  return "";
}

function workDiffScopeLabel(scope) {
  if (scope === "staged") return "已暂存";
  if (scope === "untracked") return "未跟踪";
  return "未暂存";
}

function sideRow(type, oldNo, oldText, oldClass, newNo, newText, newClass, options = {}) {
  const lineKeys = options.lineKeys || [];
  const selected = lineKeys.some((key) => state.selectedDiffLines.has(key));
  const attrs = lineKeys.length
    ? ` data-diff-line-key="${escapeAttr(lineKeys[0])}" data-diff-line-keys="${escapeAttr(lineKeys.join(","))}"`
    : "";
  return `
    <div class="side-row ${type} ${lineKeys.length ? "diff-line-selectable" : ""} ${selected ? "selected" : ""}"${attrs}>
      <div class="side-cell old ${oldClass}">
        <span class="ln">${escapeHtml(oldNo)}</span><code>${escapeHtml(oldText)}</code>
      </div>
      <div class="side-cell new ${newClass}">
        <span class="ln">${escapeHtml(newNo)}</span><code>${escapeHtml(newText)}</code>
      </div>
    </div>
  `;
}

function selectedDiffLineAction(filePath, scope) {
  const fileInfo = selectedWorkingFileInfo(filePath);
  if (!fileInfo || fileInfo.conflict) return null;
  if ((scope === "unstaged" || (scope === "untracked" && isUntrackedFile(fileInfo))) && fileInfo.unstaged) {
    return { action: "stageSelectedLines", label: "暂存所选行", title: "暂存当前 Diff 中选中的行" };
  }
  if (scope === "staged" && fileInfo.staged) {
    return { action: "unstageSelectedLines", label: "取消暂存所选行", title: "把已暂存 Diff 中选中的行退回工作区" };
  }
  return null;
}

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
  countNode.textContent = selectedRows ? `已选 ${selectedRows} 行` : "未选择行";
  button.disabled = selectedRows === 0;
}

function selectedDiffLinePayload() {
  return Array.from(state.selectedDiffLines).map((key) => {
    const [hunkIndex, lineIndex] = key.split(":").map((part) => Number.parseInt(part, 10));
    return { hunkIndex, lineIndex };
  }).filter((line) => Number.isInteger(line.hunkIndex) && Number.isInteger(line.lineIndex));
}

async function runWorkDiffLineAction(button) {
  const file = state.selectedFile;
  const scope = state.activeDiff?.scope || "unstaged";
  const action = button?.dataset?.lineAction || "";
  const lines = selectedDiffLinePayload();
  if (!file || !lines.length) {
    toast("请选择要操作的行");
    return;
  }
  if (action === "stageSelectedLines" && scope !== "unstaged" && scope !== "untracked") {
    toast("只能暂存工作区中未暂存的行");
    return;
  }
  if (action === "unstageSelectedLines" && scope !== "staged") {
    toast("只能在已暂存 Diff 中取消暂存所选行");
    return;
  }
  if (action !== "stageSelectedLines" && action !== "unstageSelectedLines") return;
  const buttons = document.querySelectorAll(".work-diff-view [data-line-action], .work-diff-view [data-hunk-action], .diff-modal-body [data-line-action], .diff-modal-body [data-hunk-action]");
  buttons.forEach((item) => {
    item.disabled = true;
  });
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action, file, scope, lines }),
    });
    toast(result.output || "所选行操作完成");
    resetDiffLineSelection(false);
    await refreshWorktree(true);
    if (state.selectedFile) {
      const nextFileInfo = selectedWorkingFileInfo(state.selectedFile);
      if (action === "stageSelectedLines" && nextFileInfo?.staged) state.workDiffScope = "staged";
      else if (action === "unstageSelectedLines" && nextFileInfo?.unstaged) state.workDiffScope = "unstaged";
      else state.workDiffScope = normalizeWorkDiffScopeChoice(state.workDiffScope, nextFileInfo);
      await loadWorkingDiff(state.selectedFile);
      if (els.diffModal.classList.contains("show")) {
        if (state.activeDiff?.diff?.length) openDiffModal();
        else closeDiffModal();
      }
    }
  } catch (error) {
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

function trimDiffPrefix(text) {
  return String(text || "").replace(/^[-+ ]/, "");
}

function shortFileName(filePath) {
  return String(filePath || "").replaceAll("\\", "/").split("/").filter(Boolean).pop() || "变更对照";
}

function remoteCheckoutBranch(remoteRef) {
  const parts = String(remoteRef || "").split("/").filter(Boolean);
  return parts.length >= 2 ? parts.slice(1).join("/") : "";
}

function worktreeSignature(files) {
  return (files || []).map((file) => `${file.state}:${file.file}:${file.extra || ""}:${file.conflict ? "conflict" : ""}`).join("|");
}

function worktreeStateSignature(files, operation) {
  return `${worktreeSignature(files)}|op:${operation?.type || ""}`;
}

async function refreshWorktree(silent = false) {
  if (!state.data || state.refreshingWorktree) return;
  state.refreshingWorktree = true;
  els.refreshChanges.disabled = true;
  try {
    const data = await api("/api/worktree");
    const nextFiles = data.workingFiles || [];
    const nextOperation = data.operation || null;
    const nextSignature = worktreeStateSignature(nextFiles, nextOperation);
    if (nextSignature !== state.worktreeSignature) {
      state.data.workingFiles = nextFiles;
      state.data.repo.operation = nextOperation;
      renderWorkingFiles();
      renderStage();
      if (!silent) toast("未提交修改已刷新");
    } else if (!silent) {
      toast("未提交修改已是最新");
    }
  } catch (error) {
    if (!silent) toast(error.message);
  } finally {
    state.refreshingWorktree = false;
    els.refreshChanges.disabled = false;
  }
}

function initWorktreeAutoRefresh() {
  window.addEventListener("focus", () => refreshWorktree(true));
  setInterval(() => {
    if (!document.hidden) refreshWorktree(true);
  }, 5000);
}

