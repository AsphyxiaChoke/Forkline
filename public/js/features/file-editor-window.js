// Floating editor window, view state, lifecycle, and status.
const FILE_EDITOR_COMPACT_MEDIA = "(max-width: 720px)";
const FILE_EDITOR_WINDOW_MARGIN = 12;
const FILE_EDITOR_WINDOW_MIN_WIDTH = 640;
const FILE_EDITOR_WINDOW_MIN_HEIGHT = 360;
let fileEditorDragState = null;
let fileEditorResizeState = null;

function refreshFileEditorCodeMirror(editor) {
  editor.codeMirror?.refresh();
  editor.oldCodeMirror?.refresh();
  editor.theirsCodeMirror?.refresh();
  editor.mergeView?.leftOriginal()?.refresh();
  editor.mergeView?.rightOriginal()?.refresh();
  refreshFileEditorStageButtons(editor);
  refreshFileEditorConflictButtons(editor);
  positionFileEditorChangeMarkers(editor);
}

function captureFileEditorView(editor, focusLine = null) {
  const current = editor?.codeMirror;
  if (!current) return null;
  const currentScroll = current.getScrollInfo();
  const original = fileEditorOriginalCodeMirror(editor);
  const oldScroll = original?.getScrollInfo?.();
  const incoming = fileEditorIncomingCodeMirror(editor);
  const incomingScroll = incoming?.getScrollInfo?.();
  const view = {
    line: Number.isInteger(focusLine) ? Math.max(0, focusLine) : current.lineAtHeight(currentScroll.top, "local"),
    left: currentScroll.left,
    oldLine: oldScroll ? original.lineAtHeight(oldScroll.top, "local") : null,
    oldLeft: oldScroll?.left || 0,
  };
  if (incomingScroll) {
    view.incomingLine = incoming.lineAtHeight(incomingScroll.top, "local");
    view.incomingLeft = incomingScroll.left;
  }
  return view;
}

function restoreFileEditorView(editor, view) {
  if (!view || !editor?.codeMirror) return;
  const scrollToLine = (codeMirror, line, left = 0) => {
    if (!codeMirror || !Number.isInteger(line)) return;
    const target = Math.max(codeMirror.firstLine(), Math.min(codeMirror.lastLine(), line));
    codeMirror.scrollTo(left, Math.max(0, codeMirror.heightAtLine(target, "local") - 96));
  };
  scrollToLine(editor.codeMirror, view.line, view.left);
  scrollToLine(fileEditorOriginalCodeMirror(editor), view.oldLine ?? view.line, view.oldLeft);
  scrollToLine(fileEditorIncomingCodeMirror(editor), view.incomingLine ?? view.line, view.incomingLeft);
}

function fileEditorOriginalCodeMirror(editor) {
  return editor?.oldCodeMirror || editor?.mergeView?.leftOriginal?.() || null;
}

function fileEditorIncomingCodeMirror(editor) {
  return editor?.theirsCodeMirror || editor?.mergeView?.rightOriginal?.() || null;
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
  if (editor?.codeMirror && editor.diffUpdateHandler) editor.codeMirror.off("updateDiff", editor.diffUpdateHandler);
  if (editor?.oldCodeMirror && editor.oldScrollHandler) editor.oldCodeMirror.off("scroll", editor.oldScrollHandler);
  if (editor?.codeMirror && editor.newScrollHandler) editor.codeMirror.off("scroll", editor.newScrollHandler);
  editor?.conflictScrollHandlers?.forEach(({ source, handler }) => source.off("scroll", handler));
  if (editor?.changeMarkerFrame) cancelAnimationFrame(editor.changeMarkerFrame);
  editor?.changeMarkerRails?.forEach((rail) => rail.remove());
  editor?.mergeView?.destroy?.();
  if (els.fileEditorMerge) els.fileEditorMerge.replaceChildren();
  els.fileEditorOldLabel.hidden = false;
  els.fileEditorResultLabel.hidden = true;
  els.fileEditorOldLabel.parentElement?.classList.remove("is-single-pane");
  els.fileEditorOldLabel.parentElement?.classList.remove("is-conflict-three-way");
  if (editor) {
    editor.codeMirror = null;
    editor.oldCodeMirror = null;
    editor.theirsCodeMirror = null;
    editor.mergeView = null;
    editor.conflictScrollHandlers = null;
    editor.resizeObserver = null;
    editor.buttonObserver = null;
    editor.resizeFrame = 0;
    editor.diffUpdateHandler = null;
    editor.changeMarkerRails = [];
    editor.changeMarkers = [];
    editor.changeMarkerFrame = 0;
  }
  els.fileEditorForm.classList.remove("is-operating");
  els.fileEditorForm.classList.remove("is-readonly");
  els.fileEditorForm.classList.remove("is-large-file");
  els.fileEditorForm.classList.remove("is-lightweight-compare");
  els.fileEditorForm.classList.remove("is-conflict-editor");
  els.fileEditorForm.classList.remove("is-line-aligned");
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
    if (editor.largeFile) metadataParts.push(t("大文件模式"));
    else if (editor.lightweightCompare) {
      metadataParts.push(t("复杂文件轻量模式"));
      metadataParts.push(t(editor.lightweightReason === "lines" ? "行数较多" : editor.lightweightReason === "size" ? "内容较大" : editor.lightweightReason === "slow" ? "响应较慢，已自动切换" : "差异较复杂"));
    }
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
    const dirtyMessage = editor.recoveryDraftRestored
      ? t("已恢复页面停止前的未保存内容")
      : t("有未保存的修改");
    els.fileEditorStatus.textContent = `${dirtyMessage} · ${metadata}`;
  } else if (editor.feedbackMessage) {
    els.fileEditorStatus.textContent = `${t(editor.feedbackMessage)} · ${metadata}`;
  } else {
    els.fileEditorStatus.textContent = metadata;
  }
  els.fileEditorSave.disabled = Boolean(editor.readOnly || editor.loading || editor.saving || editor.operating || !fileEditorDirty());
  reportDesktopRecoveryState();
}

function updateFileEditorCompareLabels(editor) {
  const labels = els.fileEditorOldLabel.parentElement;
  if (editor.recoverySnapshotChanged) {
    labels?.classList.remove("is-single-pane");
    labels?.classList.remove("is-conflict-three-way");
    els.fileEditorOldLabel.hidden = false;
    els.fileEditorResultLabel.hidden = true;
    els.fileEditorOldLabel.textContent = `${t("磁盘当前版本")} · ${String(editor.encoding || "utf-8").toUpperCase()}`;
    els.fileEditorNewLabel.textContent = `${t("恢复草稿")} · ${t("只读")}`;
    return;
  }
  if (editor.source === "commit") {
    labels?.classList.remove("is-single-pane");
    labels?.classList.remove("is-conflict-three-way");
    els.fileEditorOldLabel.hidden = false;
    els.fileEditorResultLabel.hidden = true;
    updateCommitFileCompareLabels(editor);
    return;
  }
  if (editor.conflict) {
    if (editor.conflictFallback) {
      labels?.classList.add("is-single-pane");
      labels?.classList.remove("is-conflict-three-way");
      els.fileEditorOldLabel.hidden = true;
      els.fileEditorResultLabel.hidden = true;
      els.fileEditorNewLabel.textContent = `${t("合并结果")} · ${String(editor.encoding || "utf-8").toUpperCase()} · ${t(editor.mode?.label || "纯文本")}`;
      return;
    }
    labels?.classList.remove("is-single-pane");
    labels?.classList.add("is-conflict-three-way");
    els.fileEditorOldLabel.hidden = false;
    els.fileEditorResultLabel.hidden = false;
    els.fileEditorOldLabel.textContent = fileEditorConflictVersionLabel("当前版本", editor.conflictVersions.ours);
    els.fileEditorResultLabel.textContent = `${t("合并结果")} · ${String(editor.encoding || "utf-8").toUpperCase()} · ${t(editor.mode?.label || "纯文本")}`;
    els.fileEditorNewLabel.textContent = fileEditorConflictVersionLabel("对方版本", editor.conflictVersions.theirs);
    return;
  }
  labels?.classList.remove("is-single-pane");
  labels?.classList.remove("is-conflict-three-way");
  els.fileEditorOldLabel.hidden = false;
  els.fileEditorResultLabel.hidden = true;
  const oldDetails = [];
  if (editor.oldUnavailable) oldDetails.push(fileEditorOldUnavailableLabel(editor.oldUnavailable));
  else if (!editor.oldExists) oldDetails.push(t("暂存区中不存在"));
  else {
    if (editor.oldEncoding) oldDetails.push(String(editor.oldEncoding).toUpperCase());
    if (editor.oldLineEnding) oldDetails.push(fileEditorLineEndingLabel(editor.oldLineEnding));
  }
  els.fileEditorOldLabel.textContent = `${t("暂存区")}${oldDetails.length ? ` · ${oldDetails.join(" · ")}` : ""}`;
  els.fileEditorNewLabel.textContent = `${t("工作区")} · ${String(editor.encoding || "utf-8").toUpperCase()} · ${t(editor.mode?.label || "纯文本")}${editor.largeFile ? ` · ${t("大文件只读模式")}` : ""}`;
}

function fileEditorConflictVersionLabel(title, version) {
  const details = [];
  if (!version?.exists) details.push(t("版本不存在"));
  else if (version.tooLarge) details.push(t("版本超过 16 MiB，无法在冲突编辑器中显示。"));
  else if (version.unavailable) details.push(t("版本无法显示：{reason}", { reason: t(version.unavailable) }));
  else {
    if (version.encoding) details.push(String(version.encoding).toUpperCase());
    if (version.lineEnding) details.push(fileEditorLineEndingLabel(version.lineEnding));
  }
  return `${t(title)}${details.length ? ` · ${details.join(" · ")}` : ""}`;
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
  if (editor) updateFileEditorCompareModeUi(editor, disabled);
}
