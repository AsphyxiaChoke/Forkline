// Side-by-side worktree editor backed by CodeMirror MergeView.
const FILE_EDITOR_SEARCH_MARK_LIMIT = 2000;
const FILE_EDITOR_COMPACT_MEDIA = "(max-width: 720px)";
const FILE_EDITOR_WINDOW_MARGIN = 12;
const FILE_EDITOR_WINDOW_MIN_WIDTH = 640;
const FILE_EDITOR_WINDOW_MIN_HEIGHT = 360;
let fileEditorDragState = null;
let fileEditorResizeState = null;

async function openCommitFileViewer(filePath, previousFilePath = "", commitSha = "") {
  const commit = String(commitSha || "").trim();
  if (!commit) {
    toast(t("提交信息已失效，请刷新后再试。"));
    return false;
  }
  return openFileEditor(filePath, previousFilePath, { source: "commit", commit });
}

async function openFileEditor(filePath, previousFilePath = "", options = {}) {
  const source = options.source === "commit" ? "commit" : "worktree";
  const commit = source === "commit" ? String(options.commit || "").trim() : "";
  const file = String(filePath || "");
  const previousFile = String(previousFilePath || "");
  if (!file) {
    toast(t(source === "commit" ? "请选择要查看的提交文件" : "请选择要编辑的文件"));
    return false;
  }
  if (!state.data || state.data.repo?.isSample) {
    toast(t("请先打开真实 Git 仓库"));
    return false;
  }
  const current = state.fileEditor;
  const showing = els.fileEditorModal.classList.contains("show");
  if (
    showing &&
    current?.file === file &&
    current?.previousFile === previousFile &&
    current?.source === source &&
    current?.commit === commit &&
    !options.reload
  ) {
    fileEditorFocus();
    return true;
  }
  if (!options.force && (current?.saving || current?.operating)) {
    toast(t("编辑器正在处理文件，请稍候。"));
    return false;
  }
  if (!options.force && showing && fileEditorDirty() && !confirm(t("文件还有未保存的修改，确认切换到 {file}？", { file }))) {
    return false;
  }

  destroyFileEditorInstance();
  resetFileEditorSearchUi();
  const repoPath = repoPathSnapshot();
  const editor = {
    source,
    commit,
    parent: "",
    readOnly: source === "commit",
    file,
    previousFile,
    repoPath,
    snapshot: "",
    originalContent: "",
    oldContent: "",
    loading: true,
    saving: false,
    operating: false,
    operationMessage: "",
    diffScope: "",
    diffContext: null,
    diff: [],
    canStage: false,
    conflict: false,
    exists: true,
    branchSnapshot: null,
    fileSnapshot: null,
    contextSelection: null,
    codeMirror: null,
    mergeView: null,
    resizeObserver: null,
    buttonObserver: null,
    resizeFrame: 0,
    searchMarks: [],
    searchMatches: [],
    searchTimer: null,
  };
  state.fileEditor = editor;
  updateFileEditorModeUi(editor);
  els.fileEditorOldLabel.textContent = t(editor.readOnly ? "父提交 · 正在读取" : "暂存区 · 正在读取");
  els.fileEditorNewLabel.textContent = t(editor.readOnly ? "此提交 · 正在读取" : "工作区");
  els.fileEditorMerge.hidden = false;
  els.fileEditorMerge.textContent = t("正在读取文件...");
  els.fileEditorFallback.hidden = true;
  els.fileEditorOldText.value = "";
  els.fileEditorText.value = "";
  els.fileEditorModal.classList.add("show");
  els.fileEditorModal.setAttribute("aria-hidden", "false");
  prepareFileEditorWindow();
  updateFileEditorStatus();

  try {
    const params = new URLSearchParams({ file });
    if (previousFile) params.set("previousFile", previousFile);
    if (editor.readOnly) params.set("sha", commit);
    const endpoint = editor.readOnly ? "/api/commit-file" : "/api/worktree-file";
    const data = await api(`${endpoint}?${params.toString()}`);
    if (!isCurrentRepoPath(repoPath) || state.fileEditor !== editor) return;

    editor.snapshot = data.snapshot || "";
    editor.commit = data.commit || commit;
    editor.parent = data.parent || "";
    editor.exists = data.exists !== false;
    editor.originalContent = normalizeFileEditorContent(data.content || "");
    editor.oldContent = normalizeFileEditorContent(data.oldContent || "");
    editor.oldFile = data.oldFile || previousFile || file;
    editor.previousFile = data.previousFile || previousFile;
    editor.oldExists = Boolean(data.oldExists);
    editor.oldUnavailable = data.oldUnavailable || "";
    editor.encoding = data.encoding || "utf-8";
    editor.oldEncoding = data.oldEncoding || "";
    editor.lineEnding = data.lineEnding || "lf";
    editor.oldLineEnding = data.oldLineEnding || "";
    editor.byteLength = Number(data.byteLength || 0);
    editor.diffScope = data.diffScope || "";
    editor.diffContext = Number.isInteger(data.diffContext) ? data.diffContext : null;
    editor.diff = Array.isArray(data.diff) ? data.diff : [];
    editor.canStage = Boolean(data.canStage && editor.diffScope && editor.diff.length);
    editor.conflict = Boolean(data.conflict);
    editor.branchSnapshot = editor.readOnly ? null : currentBranchSnapshotPayload();
    editor.fileSnapshot = editor.readOnly ? null : fileSnapshotPayload(editor.file, editor.diffScope);
    editor.mode = fileEditorMode(file);
    editor.loading = false;
    createFileEditorInstance(editor);
    setFileEditorControlsDisabled(false);
    updateFileEditorCompareLabels(editor);
    updateFileEditorStatus();
    fileEditorFocus();
    return true;
  } catch (error) {
    if (!isCurrentRepoPath(repoPath) || state.fileEditor !== editor) return;
    closeFileEditor(true);
    toast(error.message);
    return false;
  }
}

async function switchOpenFileEditor(filePath, previousFilePath = "") {
  if (!els.fileEditorModal.classList.contains("show")) return true;
  return openFileEditor(filePath, previousFilePath);
}

function updateFileEditorModeUi(editor) {
  const readOnly = Boolean(editor.readOnly);
  els.fileEditorForm.classList.toggle("is-readonly", readOnly);
  els.fileEditorTitle.textContent = t(readOnly ? "历史文件对照" : "编辑文件");
  els.fileEditorPath.textContent = readOnly && editor.previousFile && editor.previousFile !== editor.file
    ? `${editor.previousFile} -> ${editor.file}`
    : editor.file;
  els.fileEditorToggleSearch.textContent = t(readOnly ? "查找" : "查找替换");
  els.fileEditorToggleSearch.title = t(readOnly ? "查找文件内容" : "查找或替换文件内容");
  els.fileEditorSave.hidden = readOnly;
  els.fileEditorCancel.textContent = t(readOnly ? "关闭" : "取消");
  els.fileEditorMerge.setAttribute("aria-label", t(readOnly ? "父提交与此提交对照编辑器" : "暂存区与工作区对照编辑器"));
  els.fileEditorOldText.setAttribute("aria-label", t(readOnly ? "父提交版本文件内容" : "暂存区文件内容"));
  els.fileEditorText.setAttribute("aria-label", t(readOnly ? "此提交版本文件内容" : "工作区文件内容"));
  els.fileEditorText.readOnly = readOnly;
}

async function submitFileEditor(event) {
  event?.preventDefault?.();
  const editor = state.fileEditor;
  if (!editor || editor.readOnly || editor.loading || editor.saving || editor.operating || !fileEditorDirty()) return;
  if (!isCurrentRepoPath(editor.repoPath)) {
    closeFileEditor(true);
    toast(t("仓库已经切换，请在目标仓库中重新打开文件"));
    return;
  }

  editor.saving = true;
  setFileEditorControlsDisabled(true);
  updateFileEditorStatus();
  let result;
  try {
    result = await api("/api/worktree-file", {
      method: "POST",
      body: JSON.stringify({
        file: editor.file,
        content: fileEditorValue(),
        expectedSnapshot: editor.snapshot,
      }),
    });
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return;
  } catch (error) {
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return;
    editor.saving = false;
    setFileEditorControlsDisabled(false);
    updateFileEditorStatus(error.message);
    toast(error.message);
    return;
  }
  const file = editor.file;
  const previousFile = editor.previousFile;
  editor.saving = false;
  setFileEditorControlsDisabled(false);
  state.selectedFile = file;
  state.workDiffScope = "unstaged";
  state.selectedChanges.delete(changeKey("staged", file));
  state.selectedChanges.add(changeKey("unstaged", file));
  toast(result.output || t("文件已保存"));
  await refreshWorktree(true);
  if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return;
  await openFileEditor(file, previousFile, { force: true, reload: true });
}

function closeFileEditor(force = false) {
  if (!els.fileEditorModal.classList.contains("show")) return true;
  if ((state.fileEditor?.saving || state.fileEditor?.operating) && !force) return false;
  if (!force && fileEditorDirty() && !confirm(t("文件还有未保存的修改，确认关闭编辑器？"))) return false;
  destroyFileEditorInstance();
  state.fileEditor = null;
  els.fileEditorModal.classList.remove("show");
  els.fileEditorModal.setAttribute("aria-hidden", "true");
  els.fileEditorOldText.value = "";
  els.fileEditorText.value = "";
  setFileEditorControlsDisabled(false);
  hideFileEditorContextMenu();
  return true;
}

function createFileEditorInstance(editor) {
  els.fileEditorMerge.replaceChildren();
  const canUseCodeMirror = typeof CodeMirror === "function";
  const canUseMergeView = canUseCodeMirror && typeof CodeMirror.MergeView === "function";
  if (!canUseCodeMirror || (!editor.conflict && !canUseMergeView)) {
    els.fileEditorMerge.hidden = true;
    els.fileEditorFallback.hidden = false;
    els.fileEditorOldText.value = editor.oldContent;
    els.fileEditorText.value = editor.originalContent;
    els.fileEditorText.disabled = false;
    els.fileEditorText.readOnly = editor.readOnly;
    return;
  }

  els.fileEditorMerge.hidden = false;
  els.fileEditorFallback.hidden = true;
  const codeMirrorOptions = {
    value: editor.originalContent,
    mode: editor.mode.mode,
    lineNumbers: true,
    lineWrapping: false,
    indentUnit: 2,
    tabSize: 4,
    indentWithTabs: false,
    readOnly: editor.readOnly,
    styleActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: !editor.readOnly,
    extraKeys: {
      "Ctrl-S": () => {
        if (!editor.readOnly) submitFileEditor().catch((error) => toast(error.message));
      },
      "Cmd-S": () => {
        if (!editor.readOnly) submitFileEditor().catch((error) => toast(error.message));
      },
      "Ctrl-F": () => openFileEditorSearch(false),
      "Cmd-F": () => openFileEditorSearch(false),
      "Ctrl-H": () => openFileEditorSearch(!editor.readOnly),
      "Cmd-Alt-F": () => openFileEditorSearch(!editor.readOnly),
    },
  };
  if (editor.conflict) {
    editor.codeMirror = CodeMirror(els.fileEditorMerge, codeMirrorOptions);
  } else {
    editor.mergeView = CodeMirror.MergeView(els.fileEditorMerge, {
      ...codeMirrorOptions,
      origLeft: editor.oldContent,
      highlightDifferences: true,
      connect: "align",
      collapseIdentical: false,
      chunkClassLocation: ["background", "gutter"],
      revertButtons: editor.canStage,
      revertChunk: (_mergeView, _from, origStart, origEnd, _to, editStart, editEnd) => {
        stageFileEditorChunk(origStart.line, origEnd.line, editStart.line, editEnd.line).catch((error) => toast(error.message));
      },
      phrases: {
        "Revert chunk": t("暂存此改动块"),
        "Toggle locked scrolling": t("切换同步滚动"),
      },
    });
    editor.codeMirror = editor.mergeView.editor();
    observeFileEditorStageButtons(editor);
  }
  editor.changeHandler = () => {
    updateFileEditorStatus();
    scheduleFileEditorSearchRefresh();
  };
  editor.codeMirror.on("change", editor.changeHandler);
  observeFileEditorResize(editor);
  requestAnimationFrame(() => {
    if (state.fileEditor !== editor) return;
    refreshFileEditorCodeMirror(editor);
    requestAnimationFrame(() => {
      if (state.fileEditor === editor) refreshFileEditorCodeMirror(editor);
    });
  });
}

function observeFileEditorStageButtons(editor) {
  refreshFileEditorStageButtons(editor);
  if (typeof MutationObserver !== "function") return;
  editor.buttonObserver = new MutationObserver(() => refreshFileEditorStageButtons(editor));
  editor.buttonObserver.observe(els.fileEditorMerge, { childList: true, subtree: true });
}

function refreshFileEditorStageButtons(editor) {
  if (state.fileEditor !== editor) return;
  els.fileEditorMerge.querySelectorAll(".CodeMirror-merge-copy").forEach((button) => {
    if (button.textContent !== t("暂存")) button.textContent = t("暂存");
    button.title = t("暂存此改动块");
    button.setAttribute("aria-label", button.title);
  });
}

async function stageFileEditorChunk(origFromLine, origToLine, editFromLine, editToLine) {
  const editor = state.fileEditor;
  if (!editor?.canStage) {
    toast(t("这个位置已经没有可暂存的改动块，请刷新后再试。"));
    return;
  }
  if (fileEditorDirty()) {
    toast(t("请先保存编辑器中的修改，再操作暂存区。"));
    return;
  }
  const hunkIndex = fileEditorHunkForChunk(editor, origFromLine, origToLine, editFromLine, editToLine);
  if (!Number.isInteger(hunkIndex)) {
    toast(t("这个位置已经没有可暂存的改动块，请刷新后再试。"));
    return;
  }
  await runFileEditorGitAction(
    { action: "stageHunk", hunkIndex, diffContext: editor.diffContext },
    "正在暂存改动块...",
    "改动块操作完成"
  );
}

async function stageFileEditorSelectedLines(selection = state.fileEditor?.contextSelection) {
  if (!selection?.lines?.length) {
    toast(t("所选内容没有可暂存的新增或删除行。"));
    return;
  }
  await runFileEditorGitAction(
    { action: "stageSelectedLines", lines: selection.lines },
    "正在暂存所选行...",
    "所选行操作完成"
  );
}

async function discardFileEditorSelectedHunk(selection = state.fileEditor?.contextSelection) {
  const editor = state.fileEditor;
  if (!editor || selection?.hunkIndices?.length !== 1) {
    toast(t("所选内容必须位于同一个改动块内，请缩小选择范围。"));
    return;
  }
  if (editor.diffScope !== "unstaged") {
    toast(t("未跟踪文件不能按块还原，请直接编辑或删除该文件。"));
    return;
  }
  if (!confirm(t("确认还原所选改动块？\n\n文件：{file}\n此操作无法撤销。", { file: editor.file }))) return;
  await runFileEditorGitAction(
    { action: "discardWorktreeHunk", hunkIndex: selection.hunkIndices[0] },
    "正在还原改动块...",
    "工作区改动块已丢弃"
  );
}

async function runFileEditorContextAction(action) {
  const selection = state.fileEditor?.contextSelection;
  hideFileEditorContextMenu();
  if (action === "stageSelectedLines") {
    await stageFileEditorSelectedLines(selection);
    return;
  }
  if (action === "discardSelectedHunk") await discardFileEditorSelectedHunk(selection);
}

async function runFileEditorGitAction(payload, operationMessage, fallbackOutput) {
  const editor = state.fileEditor;
  if (!editor || editor.readOnly || editor.loading || editor.saving || editor.operating) return false;
  if (fileEditorDirty()) {
    toast(t("请先保存编辑器中的修改，再操作暂存区。"));
    return false;
  }
  if (!isCurrentRepoPath(editor.repoPath)) {
    closeFileEditor(true);
    toast(t("仓库已经切换，请在目标仓库中重新打开文件"));
    return false;
  }

  const file = editor.file;
  const previousFile = editor.previousFile;
  editor.operating = true;
  editor.operationMessage = t(operationMessage);
  els.fileEditorForm.classList.add("is-operating");
  setFileEditorControlsDisabled(true);
  updateFileEditorStatus();
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        file,
        scope: editor.diffScope,
        ...(editor.branchSnapshot || currentBranchSnapshotPayload()),
        ...(editor.fileSnapshot || fileSnapshotPayload(editor.file, editor.diffScope)),
      }),
    });
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return false;
    toast(result.output || t(fallbackOutput));
    await refreshWorktree(true);
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return false;
    await openFileEditor(file, previousFile, { force: true, reload: true });
    return true;
  } catch (error) {
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return false;
    editor.operating = false;
    editor.operationMessage = "";
    els.fileEditorForm.classList.remove("is-operating");
    setFileEditorControlsDisabled(false);
    updateFileEditorStatus(error.message);
    toast(error.message);
    await refreshWorktree(true);
    if (state.fileEditor === editor) await openFileEditor(file, previousFile, { force: true, reload: true });
    return false;
  }
}

function showFileEditorContextMenu(event) {
  const editor = state.fileEditor;
  if (!editor || editor.readOnly || editor.loading || !els.fileEditorModal.classList.contains("show")) return;
  if (!event.target.closest(".CodeMirror-merge-editor, #fileEditorText")) return;
  const selection = fileEditorSelectionDetails(editor);
  if (!selection.selectedLines.length || (!selection.lines.length && !selection.hunkIndices.length)) return;

  event.preventDefault();
  event.stopPropagation();
  hideCommitContextMenu();
  hideBranchContextMenu();
  hideFileContextMenu();
  hideTagContextMenu();
  hideRemoteContextMenu();
  hideReflogContextMenu();
  editor.contextSelection = selection;
  const dirty = fileEditorDirty();
  const stageButton = els.fileEditorContextMenu.querySelector('[data-file-editor-action="stageSelectedLines"]');
  const discardButton = els.fileEditorContextMenu.querySelector('[data-file-editor-action="discardSelectedHunk"]');
  stageButton.disabled = dirty || !editor.canStage || !selection.lines.length;
  stageButton.title = dirty ? t("请先保存编辑器中的修改，再操作暂存区。") : t("暂存编辑器中选中的新增或修改行");
  discardButton.disabled = dirty || editor.diffScope !== "unstaged" || selection.hunkIndices.length !== 1;
  discardButton.title = dirty
    ? t("请先保存编辑器中的修改，再操作暂存区。")
    : selection.hunkIndices.length === 1
      ? t("还原选区所在的整个未暂存改动块")
      : t("所选内容必须位于同一个改动块内，请缩小选择范围。");
  els.fileEditorContextMenu.classList.add("show");
  els.fileEditorContextMenu.setAttribute("aria-hidden", "false");
  positionContextMenu(els.fileEditorContextMenu, event, 96);
}

function hideFileEditorContextMenu() {
  if (!els.fileEditorContextMenu) return;
  els.fileEditorContextMenu.classList.remove("show");
  els.fileEditorContextMenu.setAttribute("aria-hidden", "true");
  if (state.fileEditor) state.fileEditor.contextSelection = null;
}

function fileEditorSelectionDetails(editor) {
  const selectedLines = fileEditorSelectedLineNumbers(editor);
  const lineMap = fileEditorDiffLineSelectionMap(editor.diff);
  const payload = new Map();
  const hunkIndices = new Set();
  selectedLines.forEach((lineNumber) => {
    const entry = lineMap.get(lineNumber);
    if (!entry) return;
    entry.lines.forEach((line) => payload.set(`${line.hunkIndex}:${line.lineIndex}`, line));
    entry.hunkIndices.forEach((hunkIndex) => hunkIndices.add(hunkIndex));
  });
  return { selectedLines, lines: [...payload.values()], hunkIndices: [...hunkIndices] };
}

function fileEditorSelectedLineNumbers(editor) {
  const selected = new Set();
  if (editor.codeMirror) {
    editor.codeMirror.listSelections().forEach((range) => {
      if (range.anchor.line === range.head.line && range.anchor.ch === range.head.ch) return;
      const [from, to] = compareFileEditorPos(range.anchor, range.head) <= 0 ? [range.anchor, range.head] : [range.head, range.anchor];
      let lastLine = to.line;
      if (to.ch === 0 && to.line > from.line) lastLine -= 1;
      for (let line = from.line; line <= lastLine; line += 1) selected.add(line);
    });
    return [...selected];
  }
  const start = els.fileEditorText.selectionStart;
  const end = els.fileEditorText.selectionEnd;
  if (start === end) return [];
  const value = els.fileEditorText.value;
  const startLine = value.slice(0, start).split("\n").length - 1;
  let endLine = value.slice(0, end).split("\n").length - 1;
  if (end > start && value[end - 1] === "\n") endLine -= 1;
  for (let line = startLine; line <= endLine; line += 1) selected.add(line);
  return [...selected];
}

function compareFileEditorPos(left, right) {
  if (left.line !== right.line) return left.line - right.line;
  return left.ch - right.ch;
}

function fileEditorDiffHunks(diff) {
  return (diff || []).flatMap((line) => {
    if (line?.type !== "meta") return [];
    const match = String(line.text || "").match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match || !Number.isInteger(line.hunkIndex)) return [];
    return [{
      hunkIndex: line.hunkIndex,
      oldStart: Number(match[1]),
      oldCount: match[2] === undefined ? 1 : Number(match[2]),
      newStart: Number(match[3]),
      newCount: match[4] === undefined ? 1 : Number(match[4]),
    }];
  });
}

function fileEditorHunkForChunk(editor, origFromLine, origToLine, editFromLine, editToLine) {
  const origFrom = Math.max(0, Number(origFromLine) || 0);
  const origTo = Math.max(origFrom, Number(origToLine) || origFrom);
  const editFrom = Math.max(0, Number(editFromLine) || 0);
  const editTo = Math.max(editFrom, Number(editToLine) || editFrom);
  let best = null;
  fileEditorDiffHunks(editor.diff).forEach((hunk) => {
    const oldStart = Math.max(0, hunk.oldStart - 1);
    const newStart = Math.max(0, hunk.newStart - 1);
    const oldOverlap = Math.max(0, Math.min(origTo, oldStart + hunk.oldCount) - Math.max(origFrom, oldStart));
    const newOverlap = Math.max(0, Math.min(editTo, newStart + hunk.newCount) - Math.max(editFrom, newStart));
    const score = oldOverlap + newOverlap;
    if (!score) return;
    if (!best || score > best.score) best = { hunkIndex: hunk.hunkIndex, score };
  });
  return best?.hunkIndex;
}

function fileEditorDiffLineSelectionMap(diff) {
  const lineMap = new Map();
  let hunkIndex = null;
  let newLine = 0;
  let hunkLineIndex = -1;
  let block = null;

  const flushBlock = () => {
    if (!block?.adds.length) {
      block = null;
      return;
    }
    block.adds.forEach((add, index) => {
      const keys = [add.line];
      if (block.dels.length) {
        if (block.adds.length === 1) keys.push(...block.dels);
        else if (index < block.dels.length) keys.push(block.dels[index]);
        if (index === block.adds.length - 1 && block.dels.length > block.adds.length) {
          keys.push(...block.dels.slice(block.adds.length));
        }
      }
      const entry = lineMap.get(add.newLine) || { lines: [], hunkIndices: new Set() };
      keys.forEach((line) => {
        if (!entry.lines.some((item) => item.hunkIndex === line.hunkIndex && item.lineIndex === line.lineIndex)) entry.lines.push(line);
        entry.hunkIndices.add(line.hunkIndex);
      });
      lineMap.set(add.newLine, entry);
    });
    block = null;
  };

  (diff || []).forEach((line) => {
    const text = String(line?.text || "");
    if (line?.type === "meta") {
      if (text.startsWith("\\ No newline at end of file")) return;
      flushBlock();
      const match = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        hunkIndex = Number.isInteger(line.hunkIndex) ? line.hunkIndex : null;
        newLine = Number(match[2]) - 1;
        hunkLineIndex = -1;
      } else if (text.startsWith("diff --git ")) {
        hunkIndex = null;
      }
      return;
    }
    if (!Number.isInteger(hunkIndex)) return;
    hunkLineIndex += 1;
    const payload = { hunkIndex, lineIndex: hunkLineIndex };
    if (line.type === "del") {
      block ||= { dels: [], adds: [] };
      block.dels.push(payload);
      return;
    }
    if (line.type === "add") {
      block ||= { dels: [], adds: [] };
      newLine += 1;
      block.adds.push({ line: payload, newLine: newLine - 1 });
      return;
    }
    flushBlock();
    newLine += 1;
  });
  flushBlock();
  return lineMap;
}

function refreshFileEditorCodeMirror(editor) {
  editor.codeMirror?.refresh();
  editor.mergeView?.leftOriginal()?.refresh();
  refreshFileEditorStageButtons(editor);
}

function fileEditorWindowCanFloat() {
  return !window.matchMedia(FILE_EDITOR_COMPACT_MEDIA).matches;
}

function prepareFileEditorWindow() {
  if (!fileEditorWindowCanFloat()) return;
  const dialog = els.fileEditorForm;
  if (!dialog.classList.contains("is-positioned")) {
    const rect = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.round(rect.left)}px`;
    dialog.style.top = `${Math.round(rect.top)}px`;
    dialog.style.width = `${Math.round(rect.width)}px`;
    dialog.style.height = `${Math.round(rect.height)}px`;
    dialog.classList.add("is-positioned");
  }
  clampFileEditorWindow();
}

function clampFileEditorWindow() {
  if (!fileEditorWindowCanFloat()) return;
  const dialog = els.fileEditorForm;
  const rect = dialog.getBoundingClientRect();
  const maxWidth = Math.max(1, window.innerWidth - FILE_EDITOR_WINDOW_MARGIN * 2);
  const maxHeight = Math.max(1, window.innerHeight - FILE_EDITOR_WINDOW_MARGIN * 2);
  const minWidth = Math.min(FILE_EDITOR_WINDOW_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(FILE_EDITOR_WINDOW_MIN_HEIGHT, maxHeight);
  const width = Math.min(maxWidth, Math.max(minWidth, rect.width));
  const height = Math.min(maxHeight, Math.max(minHeight, rect.height));
  const maxLeft = Math.max(FILE_EDITOR_WINDOW_MARGIN, window.innerWidth - width - FILE_EDITOR_WINDOW_MARGIN);
  const maxTop = Math.max(FILE_EDITOR_WINDOW_MARGIN, window.innerHeight - height - FILE_EDITOR_WINDOW_MARGIN);
  const left = Math.min(maxLeft, Math.max(FILE_EDITOR_WINDOW_MARGIN, rect.left));
  const top = Math.min(maxTop, Math.max(FILE_EDITOR_WINDOW_MARGIN, rect.top));
  dialog.style.left = `${Math.round(left)}px`;
  dialog.style.top = `${Math.round(top)}px`;
  dialog.style.width = `${Math.round(width)}px`;
  dialog.style.height = `${Math.round(height)}px`;
}

function beginFileEditorDrag(event) {
  if (event.button !== 0 || !fileEditorWindowCanFloat()) return;
  if (event.target.closest("button, input, textarea, select, a, label")) return;
  hideFileEditorContextMenu();
  prepareFileEditorWindow();
  const rect = els.fileEditorForm.getBoundingClientRect();
  fileEditorDragState = {
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
  document.body.classList.add("file-editor-window-dragging");
  event.preventDefault();
}

function moveFileEditorDrag(event) {
  const drag = fileEditorDragState;
  if (!drag) return;
  const maxLeft = Math.max(FILE_EDITOR_WINDOW_MARGIN, window.innerWidth - drag.width - FILE_EDITOR_WINDOW_MARGIN);
  const maxTop = Math.max(FILE_EDITOR_WINDOW_MARGIN, window.innerHeight - drag.height - FILE_EDITOR_WINDOW_MARGIN);
  const left = Math.min(maxLeft, Math.max(FILE_EDITOR_WINDOW_MARGIN, drag.left + event.clientX - drag.startX));
  const top = Math.min(maxTop, Math.max(FILE_EDITOR_WINDOW_MARGIN, drag.top + event.clientY - drag.startY));
  els.fileEditorForm.style.left = `${Math.round(left)}px`;
  els.fileEditorForm.style.top = `${Math.round(top)}px`;
}

function endFileEditorDrag() {
  const drag = fileEditorDragState;
  if (!drag) return;
  fileEditorDragState = null;
  document.body.classList.remove("file-editor-window-dragging");
}

function beginFileEditorResize(event) {
  if (event.button !== 0 || !fileEditorWindowCanFloat()) return;
  hideFileEditorContextMenu();
  prepareFileEditorWindow();
  const rect = els.fileEditorForm.getBoundingClientRect();
  fileEditorResizeState = {
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
  document.body.classList.add("file-editor-window-resizing");
  event.preventDefault();
  event.stopPropagation();
}

function moveFileEditorResize(event) {
  const resize = fileEditorResizeState;
  if (!resize) return;
  const maxWidth = Math.max(1, window.innerWidth - resize.left - FILE_EDITOR_WINDOW_MARGIN);
  const maxHeight = Math.max(1, window.innerHeight - resize.top - FILE_EDITOR_WINDOW_MARGIN);
  const minWidth = Math.min(FILE_EDITOR_WINDOW_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(FILE_EDITOR_WINDOW_MIN_HEIGHT, maxHeight);
  const width = Math.min(maxWidth, Math.max(minWidth, resize.width + event.clientX - resize.startX));
  const height = Math.min(maxHeight, Math.max(minHeight, resize.height + event.clientY - resize.startY));
  els.fileEditorForm.style.width = `${Math.round(width)}px`;
  els.fileEditorForm.style.height = `${Math.round(height)}px`;
}

function endFileEditorResize() {
  const resize = fileEditorResizeState;
  if (!resize) return;
  fileEditorResizeState = null;
  document.body.classList.remove("file-editor-window-resizing");
  clampFileEditorWindow();
}

function observeFileEditorResize(editor) {
  if (typeof ResizeObserver !== "function") return;
  editor.resizeObserver = new ResizeObserver(() => {
    if (editor.resizeFrame) return;
    editor.resizeFrame = requestAnimationFrame(() => {
      editor.resizeFrame = 0;
      if (state.fileEditor !== editor) return;
      clampFileEditorWindow();
      refreshFileEditorCodeMirror(editor);
      window.dispatchEvent(new Event("resize"));
    });
  });
  editor.resizeObserver.observe(els.fileEditorForm);
}

function destroyFileEditorInstance() {
  const editor = state.fileEditor;
  endFileEditorDrag();
  endFileEditorResize();
  if (editor?.resizeFrame) cancelAnimationFrame(editor.resizeFrame);
  editor?.resizeObserver?.disconnect();
  editor?.buttonObserver?.disconnect();
  if (editor?.searchTimer) clearTimeout(editor.searchTimer);
  clearFileEditorSearchMarks();
  if (editor?.codeMirror && editor.changeHandler) editor.codeMirror.off("change", editor.changeHandler);
  if (els.fileEditorMerge) els.fileEditorMerge.replaceChildren();
  els.fileEditorOldLabel.hidden = false;
  els.fileEditorOldLabel.parentElement?.classList.remove("is-single-pane");
  if (editor) {
    editor.codeMirror = null;
    editor.mergeView = null;
    editor.resizeObserver = null;
    editor.buttonObserver = null;
    editor.resizeFrame = 0;
  }
  els.fileEditorForm.classList.remove("is-operating");
  els.fileEditorForm.classList.remove("is-readonly");
  els.fileEditorText.readOnly = false;
  els.fileEditorSave.hidden = false;
  hideFileEditorContextMenu();
}

function fileEditorValue() {
  return state.fileEditor?.codeMirror?.getValue() ?? els.fileEditorText.value;
}

function fileEditorDirty() {
  if (state.fileEditor?.readOnly) return false;
  return Boolean(state.fileEditor && !state.fileEditor.loading && fileEditorValue() !== state.fileEditor.originalContent);
}

function fileEditorFocus() {
  if (state.fileEditor?.codeMirror) state.fileEditor.codeMirror.focus();
  else els.fileEditorText.focus();
}

function updateFileEditorStatus(message = "") {
  const editor = state.fileEditor;
  if (!editor) return;
  const metadataParts = [];
  if (!editor.loading) {
    if (editor.readOnly) metadataParts.push(t("只读"));
    if (editor.exists !== false) {
      metadataParts.push(String(editor.encoding || "utf-8").toUpperCase());
      metadataParts.push(fileEditorLineEndingLabel(editor.lineEnding));
      metadataParts.push(formatFileEditorBytes(editor.byteLength));
    }
    metadataParts.push(t(editor.mode?.label || "纯文本"));
  }
  const metadata = metadataParts.join(" · ");
  if (message) {
    els.fileEditorStatus.textContent = message;
  } else if (editor.loading) {
    els.fileEditorStatus.textContent = t("正在读取文件...");
  } else if (editor.saving) {
    els.fileEditorStatus.textContent = t("正在保存...");
  } else if (editor.operating) {
    els.fileEditorStatus.textContent = editor.operationMessage || t("正在更新暂存区...");
  } else if (fileEditorDirty()) {
    els.fileEditorStatus.textContent = `${t("有未保存的修改")} · ${metadata}`;
  } else {
    els.fileEditorStatus.textContent = metadata;
  }
  els.fileEditorSave.disabled = Boolean(editor.readOnly || editor.loading || editor.saving || editor.operating || !fileEditorDirty());
}

function updateFileEditorCompareLabels(editor) {
  const labels = els.fileEditorOldLabel.parentElement;
  if (editor.readOnly) {
    labels?.classList.remove("is-single-pane");
    els.fileEditorOldLabel.hidden = false;
    updateCommitFileCompareLabels(editor);
    return;
  }
  labels?.classList.toggle("is-single-pane", editor.conflict);
  els.fileEditorOldLabel.hidden = editor.conflict;
  if (editor.conflict) {
    const conflictNote = fileEditorOldUnavailableLabel(editor.oldUnavailable);
    els.fileEditorNewLabel.textContent = `${t("工作区")} · ${conflictNote} · ${String(editor.encoding || "utf-8").toUpperCase()} · ${t(editor.mode?.label || "纯文本")}`;
    return;
  }
  const oldDetails = [];
  if (editor.oldUnavailable) oldDetails.push(fileEditorOldUnavailableLabel(editor.oldUnavailable));
  else if (!editor.oldExists) oldDetails.push(t("暂存区中不存在"));
  else {
    if (editor.oldEncoding) oldDetails.push(String(editor.oldEncoding).toUpperCase());
    if (editor.oldLineEnding) oldDetails.push(fileEditorLineEndingLabel(editor.oldLineEnding));
  }
  els.fileEditorOldLabel.textContent = `${t("暂存区")}${oldDetails.length ? ` · ${oldDetails.join(" · ")}` : ""}`;
  els.fileEditorNewLabel.textContent = `${t("工作区")} · ${String(editor.encoding || "utf-8").toUpperCase()} · ${t(editor.mode?.label || "纯文本")}`;
}

function updateCommitFileCompareLabels(editor) {
  const oldDetails = [];
  if (!editor.parent) {
    oldDetails.push(t("根提交没有父提交"));
  } else {
    oldDetails.push(editor.parent.slice(0, 7));
    if (!editor.oldExists) oldDetails.push(t("父提交中不存在"));
    else {
      if (editor.oldEncoding) oldDetails.push(String(editor.oldEncoding).toUpperCase());
      if (editor.oldLineEnding) oldDetails.push(fileEditorLineEndingLabel(editor.oldLineEnding));
    }
  }
  const newDetails = [String(editor.commit || "").slice(0, 7)];
  if (!editor.exists) newDetails.push(t("此提交中不存在"));
  else {
    newDetails.push(String(editor.encoding || "utf-8").toUpperCase());
    if (editor.lineEnding) newDetails.push(fileEditorLineEndingLabel(editor.lineEnding));
  }
  els.fileEditorOldLabel.textContent = `${t("父提交")} · ${oldDetails.filter(Boolean).join(" · ")}`;
  els.fileEditorNewLabel.textContent = `${t("此提交")} · ${newDetails.filter(Boolean).join(" · ")}`;
}

function fileEditorOldUnavailableLabel(message) {
  const value = String(message || "");
  const prefix = "暂存区版本无法显示：";
  if (value.startsWith(prefix)) {
    return t("暂存区版本无法显示：{reason}", { reason: t(value.slice(prefix.length)) });
  }
  return t(value);
}

function setFileEditorControlsDisabled(disabled) {
  const editor = state.fileEditor;
  const readOnly = Boolean(editor?.readOnly);
  const codeMirror = editor?.codeMirror;
  if (codeMirror) codeMirror.setOption("readOnly", disabled ? "nocursor" : readOnly);
  els.fileEditorText.disabled = disabled;
  els.fileEditorText.readOnly = readOnly;
  els.fileEditorCancel.disabled = disabled;
  els.fileEditorClose.disabled = disabled;
  els.fileEditorToggleSearch.disabled = disabled;
  [
    els.fileEditorSearchInput,
    els.fileEditorCaseSensitive,
    els.fileEditorFindPrevious,
    els.fileEditorFindNext,
  ].forEach((control) => {
    control.disabled = disabled;
  });
  [els.fileEditorReplaceInput, els.fileEditorReplaceOne, els.fileEditorReplaceAll].forEach((control) => {
    control.disabled = disabled || readOnly;
  });
}

function openFileEditorSearch(focusReplace = false) {
  if (!state.fileEditor || state.fileEditor.loading) return;
  if (state.fileEditor.readOnly) focusReplace = false;
  els.fileEditorSearch.hidden = false;
  els.fileEditorSearch.setAttribute("aria-hidden", "false");
  els.fileEditorToggleSearch.classList.add("active");
  requestAnimationFrame(() => {
    const input = focusReplace ? els.fileEditorReplaceInput : els.fileEditorSearchInput;
    input.focus();
    input.select();
  });
  refreshFileEditorSearchMatches();
}

function toggleFileEditorSearch() {
  if (els.fileEditorSearch.hidden) openFileEditorSearch(false);
  else closeFileEditorSearch();
}

function closeFileEditorSearch() {
  els.fileEditorSearch.hidden = true;
  els.fileEditorSearch.setAttribute("aria-hidden", "true");
  els.fileEditorToggleSearch.classList.remove("active");
  clearFileEditorSearchMarks();
  fileEditorFocus();
}

function resetFileEditorSearchUi() {
  els.fileEditorSearch.hidden = true;
  els.fileEditorSearch.setAttribute("aria-hidden", "true");
  els.fileEditorToggleSearch.classList.remove("active");
  els.fileEditorSearchInput.value = "";
  els.fileEditorReplaceInput.value = "";
  els.fileEditorCaseSensitive.checked = false;
  els.fileEditorMatchStatus.textContent = t("未输入查找内容");
}

function scheduleFileEditorSearchRefresh() {
  const editor = state.fileEditor;
  if (!editor || els.fileEditorSearch.hidden) return;
  if (editor.searchTimer) clearTimeout(editor.searchTimer);
  editor.searchTimer = setTimeout(() => {
    editor.searchTimer = null;
    refreshFileEditorSearchMatches();
  }, 80);
}

function refreshFileEditorSearchMatches() {
  const editor = state.fileEditor;
  const codeMirror = editor?.codeMirror;
  const query = els.fileEditorSearchInput.value;
  clearFileEditorSearchMarks();
  if (!editor || !query) {
    if (editor) editor.searchMatches = [];
    els.fileEditorMatchStatus.textContent = t("未输入查找内容");
    return [];
  }
  if (!codeMirror) {
    const haystack = els.fileEditorCaseSensitive.checked ? fileEditorValue() : fileEditorValue().toLocaleLowerCase();
    const needle = els.fileEditorCaseSensitive.checked ? query : query.toLocaleLowerCase();
    let count = 0;
    for (let offset = 0; needle && (offset = haystack.indexOf(needle, offset)) >= 0; offset += Math.max(1, needle.length)) count += 1;
    els.fileEditorMatchStatus.textContent = count ? t("找到 {count} 个匹配", { count }) : t("没有找到匹配内容");
    return [];
  }

  const matches = [];
  const marks = [];
  const cursor = codeMirror.getSearchCursor(query, CodeMirror.Pos(0, 0), { caseFold: !els.fileEditorCaseSensitive.checked });
  let count = 0;
  while (cursor.findNext()) {
    const match = { from: cursor.from(), to: cursor.to() };
    count += 1;
    if (matches.length < FILE_EDITOR_SEARCH_MARK_LIMIT) {
      matches.push(match);
      marks.push(codeMirror.markText(match.from, match.to, { className: "file-editor-search-match" }));
    }
  }
  editor.searchMatches = matches;
  editor.searchMarks = marks;
  els.fileEditorMatchStatus.textContent = count ? t("找到 {count} 个匹配", { count }) : t("没有找到匹配内容");
  return matches;
}

function clearFileEditorSearchMarks() {
  const editor = state.fileEditor;
  for (const mark of editor?.searchMarks || []) mark.clear();
  if (editor) editor.searchMarks = [];
}

function findFileEditorMatch(direction = 1) {
  const editor = state.fileEditor;
  const codeMirror = editor?.codeMirror;
  const query = els.fileEditorSearchInput.value;
  if (!query) {
    openFileEditorSearch(false);
    return false;
  }
  if (!codeMirror) return findFallbackFileEditorMatch(direction);

  const options = { caseFold: !els.fileEditorCaseSensitive.checked };
  const start = direction > 0 ? codeMirror.getCursor("to") : codeMirror.getCursor("from");
  let cursor = codeMirror.getSearchCursor(query, start, options);
  let found = direction > 0 ? cursor.findNext() : cursor.findPrevious();
  if (!found) {
    const lastLine = codeMirror.lastLine();
    const wrap = direction > 0 ? CodeMirror.Pos(codeMirror.firstLine(), 0) : CodeMirror.Pos(lastLine, codeMirror.getLine(lastLine).length);
    cursor = codeMirror.getSearchCursor(query, wrap, options);
    found = direction > 0 ? cursor.findNext() : cursor.findPrevious();
  }
  if (!found) {
    els.fileEditorMatchStatus.textContent = t("没有找到匹配内容");
    return false;
  }

  const from = cursor.from();
  const to = cursor.to();
  codeMirror.setSelection(from, to);
  codeMirror.scrollIntoView({ from, to }, 72);
  const matches = refreshFileEditorSearchMatches();
  const index = matches.findIndex((match) => CodeMirror.cmpPos(match.from, from) === 0 && CodeMirror.cmpPos(match.to, to) === 0);
  if (index >= 0) els.fileEditorMatchStatus.textContent = t("第 {current} 个，共 {count} 个", { current: index + 1, count: matches.length });
  codeMirror.focus();
  return true;
}

function findFallbackFileEditorMatch(direction = 1) {
  const query = els.fileEditorSearchInput.value;
  const source = els.fileEditorCaseSensitive.checked ? els.fileEditorText.value : els.fileEditorText.value.toLocaleLowerCase();
  const needle = els.fileEditorCaseSensitive.checked ? query : query.toLocaleLowerCase();
  const start = direction > 0 ? els.fileEditorText.selectionEnd : els.fileEditorText.selectionStart;
  let index = direction > 0 ? source.indexOf(needle, start) : source.lastIndexOf(needle, Math.max(0, start - 1));
  if (index < 0) index = direction > 0 ? source.indexOf(needle) : source.lastIndexOf(needle);
  if (index < 0) return false;
  els.fileEditorText.setSelectionRange(index, index + query.length);
  els.fileEditorText.focus();
  return true;
}

function replaceCurrentFileEditorMatch() {
  const editor = state.fileEditor;
  if (!editor || editor.readOnly || editor.saving) return;
  const query = els.fileEditorSearchInput.value;
  if (!query) {
    openFileEditorSearch(false);
    return;
  }
  const replacement = els.fileEditorReplaceInput.value;
  if (!editor.codeMirror) {
    const selected = els.fileEditorText.value.slice(els.fileEditorText.selectionStart, els.fileEditorText.selectionEnd);
    if (!fileEditorTextMatchesQuery(selected, query)) {
      findFallbackFileEditorMatch(1);
      return;
    }
    els.fileEditorText.setRangeText(replacement, els.fileEditorText.selectionStart, els.fileEditorText.selectionEnd, "end");
    els.fileEditorText.dispatchEvent(new Event("input", { bubbles: true }));
    findFallbackFileEditorMatch(1);
    return;
  }

  const selected = editor.codeMirror.getSelection();
  if (!fileEditorTextMatchesQuery(selected, query)) {
    findFileEditorMatch(1);
    return;
  }
  editor.codeMirror.replaceSelection(replacement, "end", "+file-editor-replace");
  refreshFileEditorSearchMatches();
  findFileEditorMatch(1);
}

function replaceAllFileEditorMatches() {
  const editor = state.fileEditor;
  const query = els.fileEditorSearchInput.value;
  if (!editor || editor.readOnly || editor.saving || !query) {
    if (!query) openFileEditorSearch(false);
    return;
  }
  const replacement = els.fileEditorReplaceInput.value;
  if (!editor.codeMirror) {
    const flags = els.fileEditorCaseSensitive.checked ? "g" : "gi";
    const pattern = new RegExp(escapeFileEditorRegExp(query), flags);
    let count = 0;
    els.fileEditorText.value = els.fileEditorText.value.replace(pattern, () => {
      count += 1;
      return replacement;
    });
    els.fileEditorText.dispatchEvent(new Event("input", { bubbles: true }));
    toast(t("已替换 {count} 处", { count }));
    refreshFileEditorSearchMatches();
    return;
  }

  const cursor = editor.codeMirror.getSearchCursor(query, CodeMirror.Pos(0, 0), { caseFold: !els.fileEditorCaseSensitive.checked });
  let count = 0;
  editor.codeMirror.operation(() => {
    while (cursor.findNext()) {
      cursor.replace(replacement, "+file-editor-replace-all");
      count += 1;
    }
  });
  toast(t("已替换 {count} 处", { count }));
  refreshFileEditorSearchMatches();
  editor.codeMirror.focus();
}

function fileEditorTextMatchesQuery(value, query) {
  if (els.fileEditorCaseSensitive.checked) return value === query;
  return value.toLocaleLowerCase() === query.toLocaleLowerCase();
}

function handleFileEditorSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    findFileEditorMatch(event.shiftKey ? -1 : 1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeFileEditorSearch();
  }
}

function normalizeFileEditorContent(value) {
  return String(value || "").replace(/\r\n|\r/g, "\n");
}

function fileEditorMode(filePath) {
  const name = String(filePath || "").replaceAll("\\", "/").split("/").pop().toLowerCase();
  if (name === "dockerfile") return { mode: "dockerfile", label: "Dockerfile" };
  if (name === "cmakelists.txt") return { mode: "text/x-cmake", label: "CMake" };
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const modes = {
    ".js": { mode: "javascript", label: "JavaScript" },
    ".mjs": { mode: "javascript", label: "JavaScript" },
    ".cjs": { mode: "javascript", label: "JavaScript" },
    ".json": { mode: { name: "javascript", json: true }, label: "JSON" },
    ".jsonc": { mode: { name: "javascript", json: true }, label: "JSON" },
    ".ts": { mode: { name: "javascript", typescript: true }, label: "TypeScript" },
    ".jsx": { mode: "text/jsx", label: "JSX" },
    ".tsx": { mode: "text/typescript-jsx", label: "TSX" },
    ".html": { mode: "htmlmixed", label: "HTML" },
    ".htm": { mode: "htmlmixed", label: "HTML" },
    ".vue": { mode: "htmlmixed", label: "Vue" },
    ".xml": { mode: "xml", label: "XML" },
    ".svg": { mode: "xml", label: "SVG" },
    ".css": { mode: "css", label: "CSS" },
    ".scss": { mode: "text/x-scss", label: "SCSS" },
    ".less": { mode: "text/x-less", label: "Less" },
    ".c": { mode: "text/x-csrc", label: "C" },
    ".h": { mode: "text/x-csrc", label: "C" },
    ".cc": { mode: "text/x-c++src", label: "C++" },
    ".cpp": { mode: "text/x-c++src", label: "C++" },
    ".cxx": { mode: "text/x-c++src", label: "C++" },
    ".hpp": { mode: "text/x-c++src", label: "C++" },
    ".java": { mode: "text/x-java", label: "Java" },
    ".cs": { mode: "text/x-csharp", label: "C#" },
    ".kt": { mode: "text/x-kotlin", label: "Kotlin" },
    ".py": { mode: "python", label: "Python" },
    ".md": { mode: "markdown", label: "Markdown" },
    ".markdown": { mode: "markdown", label: "Markdown" },
    ".sh": { mode: "shell", label: "Shell" },
    ".bash": { mode: "shell", label: "Shell" },
    ".sql": { mode: "sql", label: "SQL" },
    ".yaml": { mode: "yaml", label: "YAML" },
    ".yml": { mode: "yaml", label: "YAML" },
    ".properties": { mode: "properties", label: "Properties" },
    ".ini": { mode: "properties", label: "INI" },
    ".diff": { mode: "diff", label: "Diff" },
    ".patch": { mode: "diff", label: "Patch" },
    ".ps1": { mode: "powershell", label: "PowerShell" },
    ".go": { mode: "text/x-go", label: "Go" },
    ".rs": { mode: "text/x-rustsrc", label: "Rust" },
    ".toml": { mode: "toml", label: "TOML" },
    ".php": { mode: "application/x-httpd-php", label: "PHP" },
  };
  return modes[extension] || { mode: null, label: "纯文本" };
}

function fileEditorLineEndingLabel(value) {
  if (value === "crlf") return "CRLF";
  if (value === "cr") return "CR";
  return "LF";
}

function formatFileEditorBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
}

function escapeFileEditorRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
