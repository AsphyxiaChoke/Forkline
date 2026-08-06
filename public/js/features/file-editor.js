// File editor opening, loading, saving, and CodeMirror setup.
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
    largeFile: false,
    lightweightCompare: false,
    lightweightReason: "",
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
    oldCodeMirror: null,
    mergeView: null,
    compareMode: source === "commit" ? normalizeFileEditorCompareMode(state.commitFileCompareMode) : "align",
    restoreView: options.restoreView || null,
    feedbackMessage: options.feedbackMessage || "",
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
    editor.largeFile = Boolean(data.largeFile);
    editor.readOnly = editor.readOnly || Boolean(data.readOnly);
    editor.diffScope = data.diffScope || "";
    editor.diffContext = Number.isInteger(data.diffContext) ? data.diffContext : null;
    editor.diff = Array.isArray(data.diff) ? data.diff : [];
    editor.canStage = Boolean(data.canStage && editor.diffScope && editor.diff.length);
    editor.conflict = Boolean(data.conflict);
    const lightweightCompare = detectFileEditorLightweightCompare(
      editor.source,
      editor.oldContent,
      editor.originalContent,
      editor.largeFile
    );
    editor.lightweightCompare = lightweightCompare.enabled;
    editor.lightweightReason = lightweightCompare.reason;
    editor.branchSnapshot = editor.readOnly ? null : currentBranchSnapshotPayload();
    editor.fileSnapshot = editor.readOnly ? null : fileSnapshotPayload(editor.file, editor.diffScope);
    editor.mode = fileEditorMode(file);
    editor.loading = false;
    updateFileEditorModeUi(editor);
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
  const commitView = editor.source === "commit";
  const lightweightCompare = Boolean(editor.largeFile || editor.lightweightCompare);
  els.fileEditorForm.classList.toggle("is-readonly", readOnly);
  els.fileEditorForm.classList.toggle("is-large-file", Boolean(editor.largeFile));
  els.fileEditorForm.classList.toggle("is-lightweight-compare", Boolean(editor.lightweightCompare));
  els.fileEditorForm.classList.toggle("is-line-aligned", commitView && !lightweightCompare && editor.compareMode === "align");
  els.fileEditorTitle.textContent = t(commitView ? "历史文件对照" : editor.largeFile ? "大文件只读对照" : "编辑文件");
  els.fileEditorPath.textContent = commitView && editor.previousFile && editor.previousFile !== editor.file
    ? `${editor.previousFile} -> ${editor.file}`
    : editor.file;
  els.fileEditorToggleSearch.textContent = t(readOnly ? "查找" : "查找替换");
  els.fileEditorToggleSearch.title = t(readOnly ? "查找文件内容" : "查找或替换文件内容");
  els.fileEditorSave.hidden = readOnly;
  els.fileEditorCancel.textContent = t(readOnly ? "关闭" : "取消");
  els.fileEditorMerge.setAttribute("aria-label", t(commitView ? "父提交与此提交对照编辑器" : "暂存区与工作区对照编辑器"));
  els.fileEditorOldText.setAttribute("aria-label", t(commitView ? "父提交版本文件内容" : "暂存区文件内容"));
  els.fileEditorText.setAttribute("aria-label", t(commitView ? "此提交版本文件内容" : "工作区文件内容"));
  els.fileEditorText.readOnly = readOnly;
  updateFileEditorCompareModeUi(editor);
}

function normalizeFileEditorCompareMode(mode) {
  return mode === "align" ? "align" : "connect";
}

function updateFileEditorCompareModeUi(editor, forceDisabled = false) {
  const commitView = editor.source === "commit";
  const showCompareMode = commitView && !editor.largeFile && !editor.lightweightCompare && !editor.conflict;
  const hasMergeView = typeof CodeMirror === "function" && typeof CodeMirror.MergeView === "function";
  els.fileEditorCompareMode.hidden = !showCompareMode || !hasMergeView;
  els.fileEditorCompareMode.setAttribute("aria-label", t("历史对照方式"));
  els.fileEditorCompareMode.querySelectorAll("[data-file-editor-compare-mode]").forEach((button) => {
    const mode = normalizeFileEditorCompareMode(button.dataset.fileEditorCompareMode);
    const active = mode === editor.compareMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = t(mode === "align" ? "行对齐" : "连线");
    button.title = t(mode === "align" ? "用空白行补齐两侧差异" : "使用差异连线对照");
    button.disabled = forceDisabled || editor.loading || editor.saving || editor.operating || !showCompareMode || !hasMergeView;
  });
}

function setFileEditorCompareMode(mode) {
  const editor = state.fileEditor;
  if (!editor || editor.source !== "commit" || editor.largeFile || editor.lightweightCompare || editor.conflict || editor.loading || editor.saving || editor.operating) return false;
  const nextMode = normalizeFileEditorCompareMode(mode);
  if (editor.compareMode === nextMode) return true;

  const restoreView = captureFileEditorView(editor);
  destroyFileEditorInstance();
  editor.compareMode = nextMode;
  editor.restoreView = restoreView;
  state.commitFileCompareMode = nextMode;
  updateFileEditorModeUi(editor);
  createFileEditorInstance(editor);
  setFileEditorControlsDisabled(false);
  updateFileEditorCompareLabels(editor);
  updateFileEditorStatus();
  scheduleFileEditorSearchRefresh();
  return true;
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

  const restoreView = captureFileEditorView(editor);
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
  await openFileEditor(file, previousFile, { force: true, reload: true, restoreView, feedbackMessage: "文件已保存" });
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
  if (!canUseCodeMirror || (!editor.conflict && !editor.largeFile && !editor.lightweightCompare && !canUseMergeView)) {
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
  } else if (editor.largeFile || editor.lightweightCompare) {
    createLargeFileCompare(editor, codeMirrorOptions);
  } else {
    editor.mergeView = CodeMirror.MergeView(els.fileEditorMerge, {
      ...codeMirrorOptions,
      origLeft: editor.oldContent,
      highlightDifferences: true,
      connect: editor.readOnly
        ? editor.compareMode === "align" ? "align" : null
        : "align",
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
    if (editor.canStage) observeFileEditorStageButtons(editor);
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
    restoreFileEditorView(editor, editor.restoreView);
    requestAnimationFrame(() => {
      if (state.fileEditor === editor) refreshFileEditorCodeMirror(editor);
    });
  });
}
