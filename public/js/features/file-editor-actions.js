// File editor comparison panes, staging, and context actions.
function bindFileEditorScrollSync(editor, panes) {
  let frame = 0;
  let pendingSource = null;
  const programmaticScrolls = new WeakMap();
  const wheelActive = new WeakSet();
  const wheelTimers = new Map();
  const entries = panes
    .map((source) => ({ source, element: source.getScrollerElement?.() }))
    .filter(({ element }) => element);
  const schedule = (source) => {
    pendingSource = source;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const activeSource = pendingSource;
      pendingSource = null;
      if (!activeSource) return;
      const sourceInfo = activeSource.getScrollInfo();
      const sourceRange = Math.max(1, sourceInfo.height - sourceInfo.clientHeight);
      panes.forEach((target) => {
        if (target === activeSource) return;
        const targetInfo = target.getScrollInfo();
        const targetRange = Math.max(0, targetInfo.height - targetInfo.clientHeight);
        const nextTop = targetRange * (sourceInfo.top / sourceRange);
        if (Math.abs(targetInfo.top - nextTop) < 1 && Math.abs(targetInfo.left - sourceInfo.left) < 1) return;
        const expectedPositions = programmaticScrolls.get(target) || [];
        expectedPositions.push({ left: sourceInfo.left, top: nextTop });
        programmaticScrolls.set(target, expectedPositions);
        target.scrollTo(sourceInfo.left, nextTop);
      });
    });
    editor.scrollSyncFrame = frame;
  };
  const handlers = entries.map(({ source, element }) => {
    const handler = () => {
      const expectedPositions = programmaticScrolls.get(source);
      if (expectedPositions?.length) {
        const scrollInfo = source.getScrollInfo();
        const matchedIndex = expectedPositions.findIndex(
          (expected) => Math.abs(scrollInfo.top - expected.top) < 1 && Math.abs(scrollInfo.left - expected.left) < 1
        );
        if (matchedIndex >= 0) {
          expectedPositions.splice(0, matchedIndex + 1);
          if (!expectedPositions.length) programmaticScrolls.delete(source);
          return;
        }
        programmaticScrolls.delete(source);
      }
      if (wheelActive.has(source)) return;
      schedule(source);
    };
    const wheelHandler = () => {
      wheelActive.add(source);
      const previousTimer = wheelTimers.get(source);
      if (previousTimer) clearTimeout(previousTimer);
      wheelTimers.set(source, setTimeout(() => {
        wheelActive.delete(source);
        wheelTimers.delete(source);
      }, 200));
      schedule(source);
    };
    element.addEventListener("wheel", wheelHandler, { passive: true });
    element.addEventListener("scroll", handler, { passive: true });
    return { source, element, handler, wheelHandler };
  });
  editor.scrollSyncWheelTimers = wheelTimers;
  editor.scrollSyncHandlers = handlers;
  return handlers;
}

function createLargeFileCompare(editor, codeMirrorOptions) {
  const compare = document.createElement("div");
  compare.className = "file-editor-large-compare";
  const oldHost = document.createElement("div");
  oldHost.className = "file-editor-large-pane file-editor-large-old";
  const divider = document.createElement("div");
  divider.className = "file-editor-large-divider";
  const newHost = document.createElement("div");
  newHost.className = "file-editor-large-pane file-editor-large-new";
  compare.append(oldHost, divider, newHost);
  els.fileEditorMerge.append(compare);

  editor.oldCodeMirror = CodeMirror(oldHost, {
    ...codeMirrorOptions,
    value: editor.oldContent,
    readOnly: "nocursor",
    autoCloseBrackets: false,
    styleActiveLine: false,
  });
  editor.codeMirror = CodeMirror(newHost, {
    ...codeMirrorOptions,
    readOnly: editor.readOnly,
    autoCloseBrackets: false,
  });
  const handlers = bindFileEditorScrollSync(editor, [editor.oldCodeMirror, editor.codeMirror]);
  editor.oldScrollHandler = handlers[0].handler;
  editor.newScrollHandler = handlers[1].handler;
}

function createConflictFileCompare(editor, codeMirrorOptions) {
  const compare = document.createElement("div");
  compare.className = "file-editor-conflict-compare";
  const oursHost = document.createElement("div");
  oursHost.className = "file-editor-conflict-pane file-editor-conflict-ours";
  const leftDivider = document.createElement("div");
  leftDivider.className = "file-editor-conflict-divider";
  const resultHost = document.createElement("div");
  resultHost.className = "file-editor-conflict-pane file-editor-conflict-result";
  const rightDivider = document.createElement("div");
  rightDivider.className = "file-editor-conflict-divider";
  const theirsHost = document.createElement("div");
  theirsHost.className = "file-editor-conflict-pane file-editor-conflict-theirs";
  compare.append(oursHost, leftDivider, resultHost, rightDivider, theirsHost);
  els.fileEditorMerge.append(compare);

  const referenceOptions = {
    ...codeMirrorOptions,
    readOnly: "nocursor",
    autoCloseBrackets: false,
    styleActiveLine: false,
  };
  editor.oldCodeMirror = CodeMirror(oursHost, {
    ...referenceOptions,
    value: editor.conflictVersions.ours.content,
  });
  editor.codeMirror = CodeMirror(resultHost, codeMirrorOptions);
  editor.theirsCodeMirror = CodeMirror(theirsHost, {
    ...referenceOptions,
    value: editor.conflictVersions.theirs.content,
  });
  bindConflictFileEditorScroll(editor);
}

function bindConflictFileEditorScroll(editor) {
  const panes = [editor.oldCodeMirror, editor.codeMirror, editor.theirsCodeMirror].filter(Boolean);
  editor.conflictScrollHandlers = bindFileEditorScrollSync(editor, panes);
}

function observeFileEditorChangeMarkers(editor) {
  scheduleFileEditorChangeMarkers(editor);
  editor.diffUpdateHandler = () => scheduleFileEditorChangeMarkers(editor);
  editor.codeMirror.on("updateDiff", editor.diffUpdateHandler);
}

function scheduleFileEditorChangeMarkers(editor) {
  if (!editor?.mergeView || editor.conflict) return;
  if (editor.changeMarkerFrame) cancelAnimationFrame(editor.changeMarkerFrame);
  editor.changeMarkerFrame = requestAnimationFrame(() => {
    editor.changeMarkerFrame = 0;
    refreshFileEditorChangeMarkers(editor);
  });
}

function refreshFileEditorChangeMarkers(editor) {
  editor.changeMarkerRails?.forEach((rail) => rail.remove());
  editor.changeMarkerRails = [];
  editor.changeMarkers = [];
  if (state.fileEditor !== editor || !editor.mergeView || editor.conflict) return;

  const oldCodeMirror = editor.mergeView.leftOriginal();
  const newCodeMirror = editor.codeMirror;
  const chunks = editor.mergeView.leftChunks() || [];
  if (!oldCodeMirror || !newCodeMirror || !chunks.length) return;

  const sides = [
    { className: "is-old", codeMirror: oldCodeMirror, lineKey: "origFrom" },
    { className: "is-new", codeMirror: newCodeMirror, lineKey: "editFrom" },
  ];
  sides.forEach(({ className, codeMirror, lineKey }) => {
    const rail = document.createElement("div");
    rail.className = `file-editor-change-rail ${className}`;
    chunks.forEach((chunk) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = `file-editor-change-marker ${className}`;
      const oldCount = Math.max(0, chunk.origTo - chunk.origFrom);
      const newCount = Math.max(0, chunk.editTo - chunk.editFrom);
      marker.title = `改动位置：旧版第 ${chunk.origFrom + 1} 行，新版第 ${chunk.editFrom + 1} 行；范围：旧 ${oldCount} 行，新 ${newCount} 行`;
      marker.setAttribute("aria-label", marker.title);
      marker.addEventListener("click", () => {
        const targetTop = fileEditorChangeTargetTop(codeMirror, chunk[lineKey]);
        codeMirror.scrollTo(null, Math.max(0, targetTop));
      });
      rail.append(marker);
      editor.changeMarkers.push({ marker, codeMirror, line: chunk[lineKey] });
    });
    codeMirror.getWrapperElement().append(rail);
    editor.changeMarkerRails.push(rail);
  });
  positionFileEditorChangeMarkers(editor);
}

function positionFileEditorChangeMarkers(editor) {
  if (state.fileEditor !== editor) return;
  editor.changeMarkers?.forEach(({ marker, codeMirror, line }) => {
    const ratio = fileEditorChangeMarkerRatio(codeMirror, line);
    marker.style.top = `clamp(0px, ${ratio * 100}%, calc(100% - 5px))`;
  });
}

function fileEditorChangeMarkerRatio(codeMirror, line) {
  const scrollInfo = codeMirror.getScrollInfo();
  const scrollRange = Math.max(0, scrollInfo.height - scrollInfo.clientHeight);
  if (scrollRange > 0) return fileEditorChangeTargetTop(codeMirror, line, scrollInfo) / scrollRange;

  const lineCount = codeMirror.lineCount();
  if (line <= 0) return 0;
  if (line >= lineCount) return 1;
  return Math.max(0, Math.min(1, codeMirror.heightAtLine(line, "local", true) / Math.max(1, scrollInfo.clientHeight)));
}

function fileEditorChangeTargetTop(codeMirror, line, scrollInfo = codeMirror.getScrollInfo()) {
  const lineCount = codeMirror.lineCount();
  const targetLine = Math.min(Math.max(0, line), Math.max(0, lineCount - 1));
  const lineTop = codeMirror.heightAtLine(targetLine, "local", true);
  const scrollRange = Math.max(0, scrollInfo.height - scrollInfo.clientHeight);
  return Math.max(0, Math.min(scrollRange, lineTop - scrollInfo.clientHeight / 2));
}

function observeFileEditorStageButtons(editor) {
  refreshFileEditorStageButtons(editor);
  if (typeof MutationObserver !== "function") return;
  editor.buttonObserver = new MutationObserver(() => refreshFileEditorStageButtons(editor));
  editor.buttonObserver.observe(els.fileEditorMerge, { childList: true, subtree: true });
}

function refreshFileEditorStageButtons(editor) {
  if (state.fileEditor !== editor || !editor.canStage) return;
  els.fileEditorMerge.querySelectorAll(".CodeMirror-merge-copy").forEach((button) => {
    if (button.textContent !== t("暂存")) button.textContent = t("暂存");
    button.title = t("暂存此改动块");
    button.setAttribute("aria-label", button.title);
    const center = fileEditorStageButtonCenter(editor.mergeView, button.chunk);
    if (Number.isFinite(center)) button.style.top = `${center}px`;
  });
}

function observeFileEditorConflictButtons(editor) {
  refreshFileEditorConflictButtons(editor);
  if (typeof MutationObserver !== "function") return;
  editor.buttonObserver = new MutationObserver(() => refreshFileEditorConflictButtons(editor));
  editor.buttonObserver.observe(els.fileEditorMerge, { childList: true, subtree: true });
}

function refreshFileEditorConflictButtons(editor) {
  if (state.fileEditor !== editor || !editor.conflict || !editor.mergeView) return;
  els.fileEditorMerge.querySelectorAll(".CodeMirror-merge-copy").forEach((button) => {
    const side = button.parentElement?.classList.contains("CodeMirror-merge-copybuttons-right") ? "right" : "left";
    if (button.textContent !== t("应用")) button.textContent = t("应用");
    button.title = t(side === "right" ? "将对方版本改动应用到合并结果" : "将当前版本改动应用到合并结果");
    button.setAttribute("aria-label", button.title);
    const center = fileEditorStageButtonCenter(editor.mergeView, button.chunk, side);
    if (Number.isFinite(center)) button.style.top = `${center}px`;
  });
}

function fileEditorStageButtonCenter(mergeView, chunk, side = "left") {
  const original = side === "right" ? mergeView?.rightOriginal?.() : mergeView?.leftOriginal?.();
  const edited = mergeView?.editor?.();
  const wrap = mergeView?.wrap;
  if (!original || !edited || !wrap || !chunk) return Number.NaN;

  const wrapTop = wrap.getBoundingClientRect().top;
  const paneOffset = (codeMirror) => {
    return wrapTop - codeMirror.getScrollerElement().getBoundingClientRect().top + codeMirror.getScrollInfo().top;
  };
  const originalOffset = paneOffset(original);
  const editedOffset = paneOffset(edited);
  const bounds = [
    original.heightAtLine(chunk.origFrom, "local", true) - originalOffset,
    original.heightAtLine(chunk.origTo, "local", true) - originalOffset,
    edited.heightAtLine(chunk.editFrom, "local", true) - editedOffset,
    edited.heightAtLine(chunk.editTo, "local", true) - editedOffset,
  ];
  if (!bounds.every(Number.isFinite)) return Number.NaN;
  return (Math.min(bounds[0], bounds[2]) + Math.max(bounds[1], bounds[3])) / 2;
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
    "改动块操作完成",
    { focusLine: editFromLine, feedbackMessage: "已暂存改动块" }
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
    "所选行操作完成",
    { focusLine: selection.selectedLines?.[0] || 0, feedbackMessage: t("已暂存 {count} 行", { count: selection.lines.length }) }
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
    "工作区改动块已丢弃",
    { focusLine: selection.selectedLines?.[0] || 0, feedbackMessage: "工作区改动块已丢弃" }
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

async function runFileEditorGitAction(payload, operationMessage, fallbackOutput, options = {}) {
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
  const restoreView = captureFileEditorView(editor, options.focusLine);
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
    await openFileEditor(file, previousFile, {
      force: true,
      reload: true,
      restoreView,
      feedbackMessage: options.feedbackMessage || fallbackOutput,
    });
    if ((payload.action === "stageHunk" || payload.action === "stageSelectedLines") && typeof offerIndexUndo === "function") {
      offerIndexUndo(result, payload.action === "stageHunk" ? "暂存改动块" : "暂存所选行");
    }
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
    if (state.fileEditor === editor) await openFileEditor(file, previousFile, { force: true, reload: true, restoreView });
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
