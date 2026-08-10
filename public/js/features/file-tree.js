// Hierarchical file trees and file selection state.
const fileTreeBindings = new WeakMap();

function fileTreeHtml(files, options = {}) {
  const root = { dirs: new Map(), files: [] };
  files.forEach((file) => addFileToTree(root, file));
  const directoryCounts = Array.isArray(options.totalFiles) ? fileTreeDirectoryCounts(options.totalFiles) : null;
  return `<div class="file-tree">${treeNodeHtml(root, 0, { ...options, directoryCounts })}</div>`;
}

function fileTreeDirectoryCounts(files) {
  const counts = new Map();
  files.forEach((file) => {
    const parts = String(file.file || "").replaceAll("\\", "/").split("/").filter(Boolean);
    parts.pop();
    let current = "";
    parts.forEach((part) => {
      current = current ? `${current}/${part}` : part;
      counts.set(current, (counts.get(current) || 0) + 1);
    });
  });
  return counts;
}

function addFileToTree(root, file) {
  const raw = String(file.file || "");
  const normalized = raw.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const leaf = parts.pop() || normalized || t("未知文件");
  let node = root;
  parts.forEach((part) => {
    if (!node.dirs.has(part)) node.dirs.set(part, { name: part, dirs: new Map(), files: [] });
    node = node.dirs.get(part);
  });
  node.files.push({ ...file, raw, leaf });
}

function treeNodeHtml(node, depth, options = {}, parentPath = "") {
  const dirs = [...node.dirs.values()]
    .map((dir) => {
      const directoryPath = parentPath ? `${parentPath}/${dir.name}` : dir.name;
      const count = options.directoryCounts?.get(directoryPath) || treeFileCount(dir);
      return `
        <div class="tree-group" data-tree-path="${escapeAttr(directoryPath)}" style="--depth:${depth}">
          <button class="tree-head" type="button">
            <span class="tree-caret"></span>
            <span class="tree-folder" title="${escapeAttr(dir.name)}">${escapeHtml(dir.name)}</span>
            <span class="tree-count">${count}</span>
          </button>
          <div class="tree-children">${treeNodeHtml(dir, depth + 1, options, directoryPath)}</div>
        </div>
      `;
    })
    .join("");
  const rows = node.files.map((file) => fileLeafRowHtml(file, depth, options)).join("");
  return `${dirs}${rows}`;
}

function treeFileCount(node) {
  return [...node.dirs.values()].reduce((total, dir) => total + treeFileCount(dir), node.files.length);
}

function appendFileTreeBatch(targetTree, html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const sourceTree = container.querySelector(".file-tree");
  if (!sourceTree) return;
  mergeFileTreeChildren(targetTree, sourceTree);
}

function mergeFileTreeChildren(target, source) {
  [...source.children].forEach((child) => {
    if (!child.classList.contains("tree-group")) {
      target.append(child);
      return;
    }
    const path = child.dataset.treePath || "";
    const existing = [...target.children].find((item) => item.classList.contains("tree-group") && item.dataset.treePath === path);
    if (!existing) {
      const firstFile = [...target.children].find((item) => !item.classList.contains("tree-group"));
      target.insertBefore(child, firstFile || null);
      return;
    }
    const targetChildren = [...existing.children].find((item) => item.classList.contains("tree-children"));
    const sourceChildren = [...child.children].find((item) => item.classList.contains("tree-children"));
    if (targetChildren && sourceChildren) mergeFileTreeChildren(targetChildren, sourceChildren);
  });
}

function fileLeafRowHtml(file, depth, options = {}) {
  const selectionScope = options.selectionScope || "";
  const selected = selectionScope && state.selectedChanges.has(changeKey(selectionScope, file.raw));
  const conflict = Boolean(file.conflict);
  const status = scopedFileStatus(file, selectionScope);
  return `
    <button class="file-row leaf-row ${selected ? "multi-selected" : ""} ${conflict ? "conflict" : ""}" type="button" data-select-file data-scope="${escapeAttr(selectionScope)}" data-file="${escapeAttr(file.raw)}" data-previous-file="${escapeAttr(file.previousFile || "")}" style="--depth:${depth}" title="${escapeAttr(conflict ? t("{file} · 冲突未解决", { file: file.raw }) : file.raw)}">
      <span class="badge ${status.state}">${status.badge}</span>
      <span class="file-leaf">${escapeHtml(file.leaf)}</span>
      <span class="file-extra ${status.scope ? `scope-${status.scope}` : ""}">${escapeHtml(status.extra)}</span>
    </button>
  `;
}

function scopedFileStatus(file, scope = "") {
  if (file.conflict) return { state: "C", badge: "!", extra: t("冲突"), scope: "" };
  const indexStatus = String(file.indexStatus || "");
  const worktreeStatus = String(file.worktreeStatus || "");
  const rawCode = scope === "staged" ? indexStatus : scope === "unstaged" ? (indexStatus === "?" ? "?" : worktreeStatus) : worktreeStatus || indexStatus || file.state || "M";
  const code = rawCode.slice(0, 1);
  const renamed = code === "R" || file.state === "R";
  const copied = code === "C" || file.state === "C";
  const state = rawCode === "A" || rawCode === "?" ? "A" : code === "D" ? "D" : renamed || copied ? "R" : "M";
  const badge = renamed ? "R" : copied ? "C" : state;
  const changeText = renamed ? t("重命名") : copied ? t("复制") : "";
  if (scope === "staged") {
    return { state, badge, extra: changeText || (rawCode ? t("已暂存") : ""), scope: "staged" };
  }
  if (scope === "unstaged") {
    return { state, badge, extra: changeText || (rawCode === "?" ? t("未跟踪") : rawCode ? t("未暂存") : ""), scope: "unstaged" };
  }
  return { state, badge, extra: changeText || t(file.extra || ""), scope: "" };
}

function bindFileTree(root, options = {}) {
  let binding = fileTreeBindings.get(root);
  if (!binding) {
    binding = { options: {} };
    root.addEventListener("click", (event) => handleFileTreeClick(root, binding, event));
    root.addEventListener("dblclick", (event) => handleFileTreeDoubleClick(root, binding, event));
    root.addEventListener("contextmenu", (event) => handleFileTreeContextMenu(root, binding, event));
    root.addEventListener("scroll", () => handleFileTreeScroll(root, binding), { passive: true });
    fileTreeBindings.set(root, binding);
  }
  binding.options = { ...options };

  if (options.mode === "worktree" || options.selectable) {
    return;
  }
  if (options.mode === "commit") markCommitFile();
  if (options.mode === "sync") markSyncPreviewFile();
  if (options.mode === "compare") markCompareFile();
}

async function handleFileTreeClick(root, binding, event) {
  const options = binding.options || {};
  const loadMore = fileTreeEventTarget(root, event, "[data-file-tree-more]");
  if (loadMore) {
    event.preventDefault();
    expandWorktreeFileTree(loadMore.dataset.fileTreeMore || options.loadMoreScope || "");
    return;
  }
  const head = fileTreeEventTarget(root, event, ".tree-head");
  if (head) {
    head.closest(".tree-group")?.classList.toggle("collapsed");
    return;
  }
  const row = fileTreeEventTarget(root, event, "[data-select-file]");
  if (!row) return;
  const filePath = row.dataset.file || "";
  if (options.mode === "worktree" || options.selectable) {
    const previousFile = row.dataset.previousFile || "";
    const scope = row.dataset.scope || "";
    try {
      if (!await switchOpenFileEditorLazy(filePath, previousFile)) return;
    } catch (error) {
      toast(error.message);
      return;
    }
    if (scope) selectChangeFile(filePath, scope, event);
    else selectWorkingFile(filePath);
    return;
  }
  if (options.mode === "commit") selectCommitFile(filePath);
  if (options.mode === "sync") selectSyncPreviewFile(filePath);
  if (options.mode === "compare") selectCompareFile(filePath);
}

function handleFileTreeDoubleClick(root, binding, event) {
  const row = fileTreeEventTarget(root, event, "[data-select-file]");
  if (!row) return;
  const options = binding.options || {};
  const filePath = row.dataset.file || "";
  const previousFile = row.dataset.previousFile || "";
  if (options.mode === "worktree" || options.selectable) {
    event.preventDefault();
    if (els.fileEditorModal.classList.contains("show")) return;
    openFileEditorLazy(filePath, previousFile).catch((error) => toast(error.message));
    return;
  }
  if (options.mode === "commit") {
    event.preventDefault();
    openCommitFileViewerLazy(filePath, previousFile, options.commitSha).catch((error) => toast(error.message));
  }
}

function handleFileTreeContextMenu(root, binding, event) {
  const options = binding.options || {};
  if (options.mode !== "worktree" && !options.selectable) return;
  const row = fileTreeEventTarget(root, event, "[data-select-file]");
  if (!row) return;
  event.preventDefault();
  event.stopPropagation();
  showFileContextMenu(event, row.dataset.file || "", row.dataset.scope || "");
}

function handleFileTreeScroll(root, binding) {
  const scope = binding.options?.loadMoreScope || "";
  if (!scope || root.scrollHeight <= root.clientHeight) return;
  if (root.scrollHeight - root.scrollTop - root.clientHeight > 120) return;
  expandWorktreeFileTree(scope);
}

function fileTreeEventTarget(root, event, selector) {
  const target = event.target?.closest?.(selector);
  return target && root.contains(target) ? target : null;
}

function selectChangeFile(filePath, scope, event) {
  if (!filePath) return;
  updateChangeSelection(scope, filePath, event);
  const selected = state.selectedChanges.has(changeKey(scope, filePath));
  if (!selected) state.workDiffFeedback = null;
  state.selectedFile = selected ? filePath : "";
  if (selected) {
    state.workDiffScope = scope === "staged" ? "staged" : "unstaged";
    setInspectorContext("file", inspectorTabs.file.includes(state.selectedTab) ? state.selectedTab : "fileHistory");
  }
  refreshChangeSelectionUi();
  if (selected) {
    loadWorkingDiff(filePath);
    openSelectedFileInspector(filePath);
  }
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
  [els.changeList, els.stagedChangeList].forEach((root) => {
    root.querySelectorAll("[data-select-file]").forEach((row) => {
      const scope = row.dataset.scope || "";
      const selected = row.dataset.file === state.selectedFile && (!scope || state.selectedChanges.has(changeKey(scope, row.dataset.file || "")));
      row.classList.toggle("selected", selected);
    });
  });
}

function refreshChangeSelectionUi() {
  [els.changeList, els.stagedChangeList].forEach((root) => {
    root.querySelectorAll("[data-select-file][data-scope]").forEach((row) => {
      const selected = state.selectedChanges.has(changeKey(row.dataset.scope || "", row.dataset.file || ""));
      row.classList.toggle("multi-selected", selected);
    });
    root.querySelectorAll(".change-section").forEach((section) => {
      const rows = [...section.querySelectorAll("[data-select-file][data-scope]")];
      const selectedCount = rows.filter((row) => row.classList.contains("multi-selected")).length;
      const actions = section.querySelector(".change-section-actions");
      let count = actions?.querySelector(".selected-count");
      if (selectedCount && actions) {
        if (!count) {
          count = document.createElement("span");
          count.className = "selected-count";
          actions.prepend(count);
        }
        count.textContent = t("{count} 已选", { count: selectedCount });
      } else {
        count?.remove();
      }
      actions?.querySelectorAll("[data-bulk-file-action]").forEach((button) => {
        button.disabled = selectedCount === 0;
      });
    });
  });
  markSelectedFile();
}

function selectCommitFile(filePath) {
  if (!filePath || filePath === state.selectedCommitFile) return;
  state.selectedCommitFile = filePath;
  markCommitFile();
}

function syncCommitBySha(sha) {
  const sync = state.data?.sync || {};
  return [...(sync.incoming || []), ...(sync.outgoing || [])].find((commit) => commit.sha === sha);
}

async function selectSyncCommit(sha) {
  const commit = syncCommitBySha(sha);
  if (!commit) {
    toast(t("这个提交已经不在当前同步列表中，请刷新后再试。"));
    return;
  }
  state.selectedSyncSha = sha;
  state.selectedSyncFile = "";
  renderInspector();
  await loadSyncCommitPreview(sha);
}

async function loadSyncCommitPreview(sha) {
  if (!sha || state.commitDetails.get(sha)?.diffLoaded || state.loadingCommitDetails.has(sha)) return;
  await loadCommit(sha, { includeDiff: true });
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

function shortFileName(filePath) {
  return String(filePath || "").replaceAll("\\", "/").split("/").filter(Boolean).pop() || t("变更对照");
}
