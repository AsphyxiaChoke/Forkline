// File editor find and replace workflow.
const FILE_EDITOR_SEARCH_MARK_LIMIT = 2000;

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
