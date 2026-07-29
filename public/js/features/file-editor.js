// Side-by-side worktree editor backed by CodeMirror MergeView.
const FILE_EDITOR_SEARCH_MARK_LIMIT = 2000;
const FILE_EDITOR_COMPACT_MEDIA = "(max-width: 720px)";
const FILE_EDITOR_WINDOW_MARGIN = 12;
const FILE_EDITOR_WINDOW_MIN_WIDTH = 640;
const FILE_EDITOR_WINDOW_MIN_HEIGHT = 360;
let fileEditorDragState = null;
let fileEditorResizeState = null;

async function openFileEditor(filePath, previousFilePath = "") {
  const file = String(filePath || "");
  const previousFile = String(previousFilePath || "");
  if (!file) {
    toast(t("请选择要编辑的文件"));
    return;
  }
  if (!state.data || state.data.repo?.isSample) {
    toast(t("请先打开真实 Git 仓库"));
    return;
  }

  destroyFileEditorInstance();
  resetFileEditorSearchUi();
  const repoPath = repoPathSnapshot();
  const editor = {
    file,
    previousFile,
    repoPath,
    snapshot: "",
    originalContent: "",
    oldContent: "",
    loading: true,
    saving: false,
    codeMirror: null,
    mergeView: null,
    resizeObserver: null,
    resizeFrame: 0,
    searchMarks: [],
    searchMatches: [],
    searchTimer: null,
  };
  state.fileEditor = editor;
  els.fileEditorPath.textContent = file;
  els.fileEditorOldLabel.textContent = t("旧版本 · 正在读取");
  els.fileEditorNewLabel.textContent = t("新版本 · 工作区");
  els.fileEditorMerge.hidden = false;
  els.fileEditorMerge.textContent = t("正在读取文件...");
  els.fileEditorFallback.hidden = true;
  els.fileEditorOldText.value = "";
  els.fileEditorText.value = "";
  els.fileEditorModal.classList.add("show");
  els.fileEditorModal.setAttribute("aria-hidden", "false");
  prepareFileEditorWindow();
  document.body.classList.add("modal-open");
  updateFileEditorStatus();

  try {
    const params = new URLSearchParams({ file });
    if (previousFile) params.set("previousFile", previousFile);
    const data = await api(`/api/worktree-file?${params.toString()}`);
    if (!isCurrentRepoPath(repoPath) || state.fileEditor !== editor) return;

    editor.snapshot = data.snapshot || "";
    editor.originalContent = normalizeFileEditorContent(data.content || "");
    editor.oldContent = normalizeFileEditorContent(data.oldContent || "");
    editor.oldFile = data.oldFile || previousFile || file;
    editor.oldExists = Boolean(data.oldExists);
    editor.oldUnavailable = data.oldUnavailable || "";
    editor.encoding = data.encoding || "utf-8";
    editor.oldEncoding = data.oldEncoding || "";
    editor.lineEnding = data.lineEnding || "lf";
    editor.oldLineEnding = data.oldLineEnding || "";
    editor.byteLength = Number(data.byteLength || 0);
    editor.mode = fileEditorMode(file);
    editor.loading = false;
    createFileEditorInstance(editor);
    updateFileEditorCompareLabels(editor);
    updateFileEditorStatus();
    fileEditorFocus();
  } catch (error) {
    if (!isCurrentRepoPath(repoPath) || state.fileEditor !== editor) return;
    closeFileEditor(true);
    toast(error.message);
  }
}

async function submitFileEditor(event) {
  event?.preventDefault?.();
  const editor = state.fileEditor;
  if (!editor || editor.loading || editor.saving || !fileEditorDirty()) return;
  if (!isCurrentRepoPath(editor.repoPath)) {
    closeFileEditor(true);
    toast(t("仓库已经切换，请在目标仓库中重新打开文件"));
    return;
  }

  editor.saving = true;
  setFileEditorControlsDisabled(true);
  updateFileEditorStatus();
  try {
    const result = await api("/api/worktree-file", {
      method: "POST",
      body: JSON.stringify({
        file: editor.file,
        content: fileEditorValue(),
        expectedSnapshot: editor.snapshot,
      }),
    });
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return;
    const file = editor.file;
    state.selectedFile = file;
    state.workDiffScope = "unstaged";
    state.selectedChanges.delete(changeKey("staged", file));
    state.selectedChanges.add(changeKey("unstaged", file));
    closeFileEditor(true);
    toast(result.output || t("文件已保存"));
    await refreshWorktree(true);
  } catch (error) {
    if (!isCurrentRepoPath(editor.repoPath) || state.fileEditor !== editor) return;
    editor.saving = false;
    setFileEditorControlsDisabled(false);
    updateFileEditorStatus(error.message);
    toast(error.message);
  }
}

function closeFileEditor(force = false) {
  if (!els.fileEditorModal.classList.contains("show")) return true;
  if (state.fileEditor?.saving && !force) return false;
  if (!force && fileEditorDirty() && !confirm(t("文件还有未保存的修改，确认关闭编辑器？"))) return false;
  destroyFileEditorInstance();
  state.fileEditor = null;
  els.fileEditorModal.classList.remove("show");
  els.fileEditorModal.setAttribute("aria-hidden", "true");
  els.fileEditorOldText.value = "";
  els.fileEditorText.value = "";
  setFileEditorControlsDisabled(false);
  document.body.classList.remove("modal-open");
  return true;
}

function createFileEditorInstance(editor) {
  els.fileEditorMerge.replaceChildren();
  const canUseMergeView = typeof CodeMirror === "function" && typeof CodeMirror.MergeView === "function";
  if (!canUseMergeView) {
    els.fileEditorMerge.hidden = true;
    els.fileEditorFallback.hidden = false;
    els.fileEditorOldText.value = editor.oldContent;
    els.fileEditorText.value = editor.originalContent;
    els.fileEditorText.disabled = false;
    return;
  }

  els.fileEditorMerge.hidden = false;
  els.fileEditorFallback.hidden = true;
  editor.mergeView = CodeMirror.MergeView(els.fileEditorMerge, {
    value: editor.originalContent,
    origLeft: editor.oldContent,
    mode: editor.mode.mode,
    lineNumbers: true,
    lineWrapping: false,
    indentUnit: 2,
    tabSize: 4,
    indentWithTabs: false,
    styleActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    highlightDifferences: true,
    connect: "align",
    collapseIdentical: false,
    chunkClassLocation: ["background", "gutter"],
    revertButtons: true,
    phrases: {
      "Revert chunk": t("用旧版本还原此变更块"),
      "Toggle locked scrolling": t("切换同步滚动"),
    },
    extraKeys: {
      "Ctrl-S": () => submitFileEditor().catch((error) => toast(error.message)),
      "Cmd-S": () => submitFileEditor().catch((error) => toast(error.message)),
      "Ctrl-F": () => openFileEditorSearch(false),
      "Cmd-F": () => openFileEditorSearch(false),
      "Ctrl-H": () => openFileEditorSearch(true),
      "Cmd-Alt-F": () => openFileEditorSearch(true),
    },
  });
  editor.codeMirror = editor.mergeView.editor();
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

function refreshFileEditorCodeMirror(editor) {
  editor.codeMirror?.refresh();
  editor.mergeView?.leftOriginal()?.refresh();
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
  if (editor?.searchTimer) clearTimeout(editor.searchTimer);
  clearFileEditorSearchMarks();
  if (editor?.codeMirror && editor.changeHandler) editor.codeMirror.off("change", editor.changeHandler);
  if (els.fileEditorMerge) els.fileEditorMerge.replaceChildren();
  if (editor) {
    editor.codeMirror = null;
    editor.mergeView = null;
    editor.resizeObserver = null;
    editor.resizeFrame = 0;
  }
}

function fileEditorValue() {
  return state.fileEditor?.codeMirror?.getValue() ?? els.fileEditorText.value;
}

function fileEditorDirty() {
  return Boolean(state.fileEditor && !state.fileEditor.loading && fileEditorValue() !== state.fileEditor.originalContent);
}

function fileEditorFocus() {
  if (state.fileEditor?.codeMirror) state.fileEditor.codeMirror.focus();
  else els.fileEditorText.focus();
}

function updateFileEditorStatus(message = "") {
  const editor = state.fileEditor;
  if (!editor) return;
  const metadata = editor.loading
    ? ""
    : `${String(editor.encoding || "utf-8").toUpperCase()} · ${fileEditorLineEndingLabel(editor.lineEnding)} · ${formatFileEditorBytes(editor.byteLength)} · ${t(editor.mode?.label || "纯文本")}`;
  if (message) {
    els.fileEditorStatus.textContent = message;
  } else if (editor.loading) {
    els.fileEditorStatus.textContent = t("正在读取文件...");
  } else if (editor.saving) {
    els.fileEditorStatus.textContent = t("正在保存...");
  } else if (fileEditorDirty()) {
    els.fileEditorStatus.textContent = `${t("有未保存的修改")} · ${metadata}`;
  } else {
    els.fileEditorStatus.textContent = metadata;
  }
  els.fileEditorSave.disabled = Boolean(editor.loading || editor.saving || !fileEditorDirty());
}

function updateFileEditorCompareLabels(editor) {
  const oldDetails = [];
  if (editor.oldUnavailable) oldDetails.push(fileEditorOldUnavailableLabel(editor.oldUnavailable));
  else if (!editor.oldExists) oldDetails.push(t("HEAD 中不存在"));
  else {
    oldDetails.push("HEAD");
    if (editor.oldFile && editor.oldFile !== editor.file) oldDetails.push(editor.oldFile);
    if (editor.oldEncoding) oldDetails.push(String(editor.oldEncoding).toUpperCase());
    if (editor.oldLineEnding) oldDetails.push(fileEditorLineEndingLabel(editor.oldLineEnding));
  }
  els.fileEditorOldLabel.textContent = `${t("旧版本")} · ${oldDetails.join(" · ")}`;
  els.fileEditorNewLabel.textContent = `${t("新版本")} · ${t("工作区")} · ${String(editor.encoding || "utf-8").toUpperCase()} · ${t(editor.mode?.label || "纯文本")}`;
}

function fileEditorOldUnavailableLabel(message) {
  const value = String(message || "");
  const prefix = "HEAD 中的旧版本无法显示：";
  if (value.startsWith(prefix)) {
    return t("HEAD 中的旧版本无法显示：{reason}", { reason: t(value.slice(prefix.length)) });
  }
  return t(value);
}

function setFileEditorControlsDisabled(disabled) {
  const codeMirror = state.fileEditor?.codeMirror;
  if (codeMirror) codeMirror.setOption("readOnly", disabled ? "nocursor" : false);
  els.fileEditorText.disabled = disabled;
  els.fileEditorCancel.disabled = disabled;
  els.fileEditorClose.disabled = disabled;
  els.fileEditorToggleSearch.disabled = disabled;
  [
    els.fileEditorSearchInput,
    els.fileEditorReplaceInput,
    els.fileEditorCaseSensitive,
    els.fileEditorFindPrevious,
    els.fileEditorFindNext,
    els.fileEditorReplaceOne,
    els.fileEditorReplaceAll,
  ].forEach((control) => {
    control.disabled = disabled;
  });
}

function openFileEditorSearch(focusReplace = false) {
  if (!state.fileEditor || state.fileEditor.loading) return;
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
  if (!editor || editor.saving) return;
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
  if (!editor || editor.saving || !query) {
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
