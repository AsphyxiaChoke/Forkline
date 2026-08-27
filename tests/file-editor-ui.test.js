"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const core = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const events = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const branches = fs.readFileSync(path.join(root, "public", "js", "features", "branches.js"), "utf8");
const contextMenus = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const fileTree = fs.readFileSync(path.join(root, "public", "js", "features", "file-tree.js"), "utf8");
const diffLoader = fs.readFileSync(path.join(root, "public", "js", "features", "diff-workbench-loader.js"), "utf8");
const diffCore = fs.readFileSync(path.join(root, "public", "js", "features", "diff-workbench.js"), "utf8");
const diffRenderer = fs.readFileSync(path.join(root, "public", "js", "features", "diff-renderer.js"), "utf8");
const diffSelection = fs.readFileSync(path.join(root, "public", "js", "features", "diff-selection.js"), "utf8");
const worktreeChanges = fs.readFileSync(path.join(root, "public", "js", "features", "worktree-changes.js"), "utf8");
const worktreeRefresh = fs.readFileSync(path.join(root, "public", "js", "features", "worktree-refresh.js"), "utf8");
const diffWorkbench = [fileTree, diffLoader, diffRenderer, diffSelection, diffCore, worktreeRefresh].join("\n");
const inspector = fs.readFileSync(path.join(root, "public", "js", "panels", "inspector.js"), "utf8");
const repositories = fs.readFileSync(path.join(root, "public", "js", "features", "repositories.js"), "utf8");
const editorLoader = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-loader.js"), "utf8");
const editorUtils = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-utils.js"), "utf8");
const editorActions = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-actions.js"), "utf8");
const editorWindow = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-window.js"), "utf8");
const editorSearch = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-search.js"), "utf8");
const editorCore = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor.js"), "utf8");
const editor = [editorUtils, editorActions, editorWindow, editorSearch, editorCore].join("\n");
const mergeAddon = fs.readFileSync(path.join(root, "public", "vendor", "codemirror", "addon", "merge", "merge.js"), "utf8");
const baseStyles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const diffWorkbenchStyles = fs.readFileSync(path.join(root, "public", "diff-workbench.css"), "utf8");
const editorStyles = fs.readFileSync(path.join(root, "public", "file-editor.css"), "utf8");
const styles = `${baseStyles}\n${diffWorkbenchStyles}\n${editorStyles}`;
const catalog = require(path.join(root, "public", "js", "i18n-catalog.js"));

test("file editor opens from worktree double-click and follows file selection while open", () => {
  assert.match(html, /id="editWorktreeFile"/);
  assert.match(html, /data-file-action="edit"/);
  assert.match(html, /id="fileEditorModal"/);
  assert.match(html, /id="fileEditorText"[^>]*wrap="off"/);
  assert.match(html, /js\/features\/file-editor-loader\.js/);
  assert.doesNotMatch(html, /file-editor\.css|vendor\/codemirror|js\/features\/file-editor-(?:utils|actions|window|search)\.js|js\/features\/file-editor\.js/);
  assert.match(editorLoader, /const fileEditorStyleResources = \[\s*"\.\/file-editor\.css"/);
  assert.doesNotMatch(baseStyles, /\.file-editor-(?:modal|dialog|merge|search|footer)/);
  assert.match(editorStyles, /\.file-editor-modal\s*\{/);
  const diffScripts = [
    "./js/features/file-editor-loader.js",
    "./js/features/diff-workbench-loader.js",
    "./js/features/file-tree.js",
    "./js/features/diff-renderer.js",
    "./js/features/worktree-refresh.js",
  ];
  let previousDiffScript = -1;
  for (const script of diffScripts) {
    const position = html.indexOf(`<script src="${script}"></script>`);
    assert.ok(position > previousDiffScript, `${script} should load after the previous diff module`);
    previousDiffScript = position;
  }
  assert.match(fileTree, /function fileTreeHtml\(/);
  assert.match(fileTree, /function shortFileName\(/);
  assert.match(diffLoader, /async function ensureDiffWorkbenchLoaded\(/);
  assert.match(diffLoader, /function setActiveDiff\(/);
  assert.match(diffCore, /async function runWorkDiffHunkAction\(/);
  assert.match(diffRenderer, /function renderSideDiff\(/);
  assert.match(diffRenderer, /function trimDiffPrefix\(/);
  assert.match(diffSelection, /async function runWorkDiffLineAction\(/);
  assert.match(worktreeRefresh, /function initWorktreeAutoRefresh\(/);
  assert.match(branches, /function remoteCheckoutBranch\(/);
  assert.match(branches, /function splitRemoteBranchRef\(/);
  assert.doesNotMatch(diffCore, /function renderSideDiff|function resetDiffLineSelection|function refreshWorktree/);
  const editorScripts = [
    "./js/features/file-editor-loader.js",
    "./js/features/repositories.js",
    "./js/app/events.js",
  ];
  let previousScript = -1;
  for (const script of editorScripts) {
    const position = html.indexOf(`<script src="${script}"></script>`);
    assert.ok(position > previousScript, `${script} should load after the previous editor module`);
    previousScript = position;
  }
  assert.match(editorCore, /async function openFileEditor\(/);
  assert.match(editorActions, /async function stageFileEditorChunk\(/);
  assert.match(editorWindow, /function destroyFileEditorInstance\(/);
  assert.match(editorSearch, /function openFileEditorSearch\(/);
  assert.match(editorUtils, /function detectFileEditorLightweightCompare\(/);
  assert.doesNotMatch(editorCore, /async function stageFileEditorChunk|function beginFileEditorDrag|function openFileEditorSearch/);
  assert.match(contextMenus, /action === "edit"/);
  assert.match(contextMenus, /previousFile: fileInfo\.previousFile/);
  assert.match(contextMenus, /openFileEditorLazy\(context\.file, context\.previousFile/);
  assert.match(diffWorkbench, /root\.addEventListener\("dblclick"/);
  assert.match(diffWorkbench, /openFileEditorLazy\(filePath, previousFile/);
  assert.match(diffWorkbench, /switchOpenFileEditorLazy\(filePath, previousFile/);
  assert.match(editor, /文件还有未保存的修改，确认切换到/);
});

test("file trees reuse delegated root listeners and apply the latest mode", async () => {
  const listeners = new Map();
  const listenerAdds = new Map();
  const state = { selectedSyncFile: "" };
  let inspectorRenders = 0;
  const sandbox = {
    state,
    els: { detailBody: { querySelectorAll: () => [] } },
    renderInspector: () => {
      inspectorRenders += 1;
    },
  };
  vm.runInNewContext(fileTree, sandbox);
  const rootElement = {
    addEventListener: (type, listener) => {
      listenerAdds.set(type, (listenerAdds.get(type) || 0) + 1);
      listeners.set(type, listener);
    },
    querySelectorAll: () => [],
    contains: () => true,
  };

  sandbox.bindFileTree(rootElement, { mode: "commit", commitSha: "abc123" });
  sandbox.bindFileTree(rootElement, { mode: "sync" });

  assert.deepEqual(Object.fromEntries(listenerAdds), { click: 1, dblclick: 1, contextmenu: 1, scroll: 1 });
  const row = { dataset: { file: "src/main.c", previousFile: "" } };
  await listeners.get("click")({
    target: {
      closest: (selector) => selector === "[data-select-file]" ? row : null,
    },
  });
  assert.equal(state.selectedSyncFile, "src/main.c");
  assert.equal(inspectorRenders, 1);
});

test("delegated worktree file events preserve selection, editing, context menus, and folder folding", async () => {
  const listeners = new Map();
  const calls = [];
  const sandbox = {
    els: { fileEditorModal: { classList: { contains: () => false } } },
    toast: (message) => calls.push(["toast", message]),
  };
  vm.runInNewContext(fileTree, sandbox);
  sandbox.switchOpenFileEditorLazy = async (...args) => {
    calls.push(["switch", ...args]);
    return true;
  };
  sandbox.selectChangeFile = (...args) => calls.push(["select", ...args]);
  sandbox.openFileEditorLazy = async (...args) => {
    calls.push(["open", ...args]);
    return true;
  };
  sandbox.showFileContextMenuLazy = async (...args) => calls.push(["menu", ...args.slice(1)]);
  const rootElement = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    contains: () => true,
  };
  sandbox.bindFileTree(rootElement, { selectable: true });
  const row = { dataset: { file: "src/main.c", previousFile: "src/old-main.c", scope: "unstaged" } };
  const rowTarget = { closest: (selector) => selector === "[data-select-file]" ? row : null };
  const clickEvent = { target: rowTarget, ctrlKey: true };

  await listeners.get("click")(clickEvent);
  let prevented = false;
  listeners.get("dblclick")({ target: rowTarget, preventDefault: () => { prevented = true; } });
  let contextPrevented = false;
  let contextStopped = false;
  const contextEvent = {
    target: rowTarget,
    preventDefault: () => { contextPrevented = true; },
    stopPropagation: () => { contextStopped = true; },
  };
  listeners.get("contextmenu")(contextEvent);

  let folded = "";
  const head = { closest: () => ({ classList: { toggle: (name) => { folded = name; } } }) };
  await listeners.get("click")({
    target: { closest: (selector) => selector === ".tree-head" ? head : null },
  });

  assert.deepEqual(calls[0], ["switch", "src/main.c", "src/old-main.c"]);
  assert.equal(calls[1][0], "select");
  assert.equal(calls[1][1], "src/main.c");
  assert.equal(calls[1][2], "unstaged");
  assert.equal(calls[1][3], clickEvent);
  assert.deepEqual(calls[2], ["open", "src/main.c", "src/old-main.c"]);
  assert.deepEqual(calls[3], ["menu", "src/main.c", "unstaged"]);
  assert.equal(prevented, true);
  assert.equal(contextPrevented, true);
  assert.equal(contextStopped, true);
  assert.equal(folded, "collapsed");
});

test("worktree and staged trees select complete folders without expanding virtualized rows", () => {
  const files = Array.from({ length: 1200 }, (_value, index) => ({
    file: `src/hidden/file-${String(index).padStart(4, "0")}.txt`,
    state: "M",
    unstaged: true,
    staged: false,
  }));
  const selectedChanges = new Set();
  let refreshes = 0;
  const sandbox = {
    state: { data: { workingFiles: files }, selectedChanges },
    changeGroups: (items) => ({ unstaged: items.filter((file) => file.unstaged), staged: items.filter((file) => file.staged) }),
    filterWorkingFiles: (items) => items,
    changeKey: (scope, file) => `${scope}:${file}`,
    t: (value) => value,
    escapeAttr: (value) => String(value),
    escapeHtml: (value) => String(value),
    scopedFileStatus: () => ({ state: "M", badge: "M", extra: "" }),
    refreshChangeSelectionUi: () => {
      refreshes += 1;
    },
  };
  vm.runInNewContext(fileTree, sandbox);
  sandbox.refreshChangeSelectionUi = () => {
    refreshes += 1;
  };

  const markup = sandbox.fileTreeHtml(files.slice(0, 800), { selectionScope: "unstaged", totalFiles: files });
  assert.match(markup, /data-select-folder/);
  assert.match(markup, /class="tree-toggle"/);
  assert.doesNotMatch(sandbox.fileTreeHtml(files.slice(0, 2), { mode: "commit" }), /data-select-folder/);

  sandbox.selectFolderChanges("unstaged", "src/hidden");
  assert.equal(selectedChanges.size, 1200);
  assert.equal(refreshes, 1);
  sandbox.selectFolderChanges("unstaged", "src/hidden");
  assert.equal(selectedChanges.size, 0);

  const limitSandbox = {
    state: { selectedFile: "", selectedChanges, worktreeRenderLimits: { unstaged: 800, staged: 800 } },
    changeKey: (scope, file) => `${scope}:${file}`,
  };
  vm.runInNewContext(worktreeChanges, limitSandbox);
  files.forEach((file) => selectedChanges.add(`unstaged:${file.file}`));
  assert.equal(limitSandbox.worktreeFileRenderLimit("unstaged", files), 800);
  limitSandbox.state.selectedFile = files.at(-1).file;
  assert.equal(limitSandbox.worktreeFileRenderLimit("unstaged", files), 1200);
});

test("worktree selection updates in place so the same row can receive a double-click", () => {
  const selectChangeSource = diffWorkbench.slice(
    diffWorkbench.indexOf("function selectChangeFile"),
    diffWorkbench.indexOf("function updateChangeSelection")
  );
  assert.match(selectChangeSource, /refreshChangeSelectionUi\(\)/);
  assert.match(selectChangeSource, /setActiveDiff\(null\)/);
  assert.doesNotMatch(selectChangeSource, /loadWorkingDiff(?:Lazy)?\(filePath\)/);
  assert.doesNotMatch(selectChangeSource, /renderStage\(\)/);
  assert.match(diffWorkbench, /function refreshChangeSelectionUi\(\)[\s\S]*?row\.classList\.toggle\("multi-selected", selected\)/);
  assert.match(diffWorkbench, /actions\?\.querySelectorAll\("\[data-bulk-file-action\]"\)[\s\S]*?button\.disabled = selectedCount === 0/);
});

test("commit file double-click opens the shared comparison window in read-only mode", () => {
  assert.match(inspector, /bindFileTree\(els\.detailBody, \{ mode: "commit", commitSha: commit\.sha \}\)/);
  assert.match(diffWorkbench, /function handleFileTreeDoubleClick[\s\S]*options\.mode === "commit"/);
  assert.match(diffWorkbench, /openCommitFileViewerLazy\(filePath, previousFile, options\.commitSha\)/);
  assert.match(editor, /async function openCommitFileViewer/);
  assert.match(editor, /"\/api\/commit-file"/);
  assert.match(editor, /readOnly: source === "commit"/);
  assert.match(editor, /readOnly: editor\.readOnly/);
  assert.match(editor, /if \(state\.fileEditor\?\.readOnly\) return false;/);
  assert.match(editor, /if \(!editor \|\| editor\.readOnly/);
  assert.match(editor, /els\.fileEditorSave\.hidden = readOnly/);
  assert.match(html, /file-editor-search-field file-editor-replace-field[\s\S]*id="fileEditorReplaceInput"/);
  assert.match(styles, /\.file-editor-dialog\.is-readonly[\s\S]*#fileEditorReplaceAll/);
});

test("commit file single-click keeps the long file list mounted for a following double-click", () => {
  const calls = [];
  const sandbox = {
    state: { selectedCommitFile: "src/first.js" },
  };
  vm.runInNewContext(diffWorkbench, sandbox);
  sandbox.markCommitFile = () => calls.push("mark");

  sandbox.selectCommitFile("src/deep/target.js");

  assert.equal(sandbox.state.selectedCommitFile, "src/deep/target.js");
  assert.deepEqual(calls, ["mark"]);
});

test("commit files tab keeps only the scrollable file tree and loads no inline diff preview", () => {
  assert.match(inspector, /commit-file-tree commit-file-list-only/);
  assert.doesNotMatch(inspector, /renderSelectedCommitFileDiff/);
  assert.doesNotMatch(diffWorkbench, /renderHistoryDiffInWorkbench/);
  assert.match(styles, /\.commit-file-tree\.commit-file-list-only\s*\{[^}]*max-height:/s);
});

test("large side diffs render an initial batch and expand without losing the full source", () => {
  const sandbox = {
    state: {
      selectedDiffLines: new Set(),
      diffModalRenderLimit: 1000,
    },
    els: {},
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value),
    t: (value, replacements = {}) => Object.entries(replacements).reduce(
      (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
      value
    ),
    renderDiffModalBody: () => {},
  };
  vm.runInNewContext(diffWorkbench, sandbox);
  const diff = Array.from({ length: 2500 }, (_, index) => ({ type: "ctx", text: ` line-${index}` }));

  const html = sandbox.renderSideDiff(diff, "empty", { maxLines: 1000, loadMoreTarget: "modal" });

  assert.equal((html.match(/class="side-row ctx/g) || []).length, 1000);
  assert.match(html, /line-999/);
  assert.doesNotMatch(html, /line-1000/);
  assert.match(html, /data-side-diff-more="modal"/);
  assert.match(html, /data-next-limit="2000"/);

  let modalRenders = 0;
  sandbox.renderDiffModalBody = () => {
    modalRenders += 1;
  };
  sandbox.expandSideDiff({ dataset: { sideDiffMore: "modal", nextLimit: "2000" } });

  assert.equal(sandbox.state.diffModalRenderLimit, 2000);
  assert.equal(modalRenders, 1);
});

test("large diff controls are delegated and closing the modal releases rendered rows", () => {
  assert.match(events, /data-side-diff-more[\s\S]{0,220}expandSideDiff/);
  assert.match(diffWorkbench, /function closeDiffModal\(\)[\s\S]{0,260}els\.diffModalBody\.replaceChildren\(\)/);
});

test("worktree diff explains partial staging and keeps the latest result visible", () => {
  const state = {
    data: {
      workingFiles: [{
        file: "部分暂存.txt",
        indexStatus: "?",
        worktreeStatus: "?",
        staged: false,
        unstaged: true,
      }],
    },
    selectedDiffLines: new Set(),
    workDiffFeedback: null,
  };
  const sandbox = {
    state,
    els: {},
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value),
    t: (value, replacements = {}) => Object.entries(replacements).reduce(
      (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
      value
    ),
  };
  vm.runInNewContext(diffWorkbench, sandbox);
  const diff = [
    { type: "meta", text: "@@ -0,0 +1,3 @@", hunkIndex: 0 },
    { type: "add", text: "+第一行", hunkIndex: 0 },
    { type: "add", text: "+第二行", hunkIndex: 0 },
    { type: "add", text: "+第三行", hunkIndex: 0 },
  ];

  const hint = sandbox.renderSideDiff(diff, "empty", { filePath: "部分暂存.txt", scope: "untracked", hunkActions: true });
  assert.match(hint, /work-diff-feedback notice/);
  assert.match(hint, /未跟踪文件：部分暂存后，其余内容仍保留在工作区。/);

  state.data.workingFiles = [{
    file: "部分暂存.txt",
    indexStatus: "A",
    worktreeStatus: "M",
    staged: true,
    unstaged: true,
  }];
  sandbox.setWorkDiffFeedback("部分暂存.txt", "已暂存所选 1 行", { partialUntracked: true });
  const result = sandbox.renderSideDiff(diff, "empty", { filePath: "部分暂存.txt", scope: "unstaged" });
  assert.match(result, /work-diff-feedback success/);
  assert.match(result, /已暂存所选 1 行/);
  assert.match(result, /其余内容仍保留在工作区/);
  assert.match(result, /仍有未暂存改动 · 已有暂存内容/);

  state.data.workingFiles = [];
  const empty = sandbox.renderSideDiff([], "此文件没有剩余未提交改动", { filePath: "部分暂存.txt", scope: "unstaged" });
  assert.match(empty, /已暂存所选 1 行/);
  assert.match(empty, /此文件没有剩余未提交改动/);
  assert.equal(catalog.translateKnown("en", "未跟踪文件：部分暂存后，其余内容仍保留在工作区。"), "Untracked file: after partial staging, the remaining content stays in the worktree.");
});

test("worktree diff briefly highlights the matching hunk after an action refresh", () => {
  const timers = [];
  const state = {
    data: {
      workingFiles: [{
        file: "target.c",
        indexStatus: " ",
        worktreeStatus: "M",
        staged: false,
        unstaged: true,
      }],
    },
    selectedDiffLines: new Set(),
    workDiffFeedback: null,
  };
  const sandbox = {
    state,
    els: {},
    escapeHtml: (value) => String(value),
    escapeAttr: (value) => String(value),
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    t: (value, replacements = {}) => Object.entries(replacements).reduce(
      (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
      value
    ),
  };
  vm.runInNewContext(diffWorkbench, sandbox);
  const before = [
    { type: "meta", text: "@@ -1 +1,2 @@", hunkIndex: 0 },
    { type: "add", text: "+first change", hunkIndex: 0 },
    { type: "meta", text: "@@ -20,2 +20,3 @@", hunkIndex: 1 },
    { type: "del", text: "-old target", hunkIndex: 1 },
    { type: "add", text: "+new target", hunkIndex: 1 },
    { type: "add", text: "+keep target", hunkIndex: 1 },
  ];
  const highlight = sandbox.captureWorkDiffTarget([1], before);
  sandbox.setWorkDiffFeedback("target.c", "已暂存所选 1 行", { highlight });

  const after = [
    { type: "meta", text: "@@ -20,2 +20,2 @@", hunkIndex: 0 },
    { type: "del", text: "-old target", hunkIndex: 0 },
    { type: "add", text: "+keep target", hunkIndex: 0 },
    { type: "meta", text: "@@ -100 +100,2 @@", hunkIndex: 1 },
    { type: "add", text: "+elsewhere", hunkIndex: 1 },
  ];
  const rendered = sandbox.renderSideDiff(after, "empty", { filePath: "target.c", scope: "unstaged", hunkActions: true });

  assert.equal(highlight.hunks.length, 1);
  assert.equal((rendered.match(/work-diff-target/g) || []).length, 1);
  assert.match(rendered, /side-row meta[^\"]*work-diff-target/);
  assert.match(diffWorkbench, /captureWorkDiffTarget\(\[hunkIndex\]\)/);
  assert.match(diffWorkbench, /captureWorkDiffTarget\(lines\.map\(\(line\) => line\.hunkIndex\)\)/);
  assert.match(styles, /@keyframes work-diff-target-flash/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*\.side-row\.meta\.work-diff-target \.side-meta\s*\{[^}]*animation:\s*none !important/s);

  const missing = sandbox.renderSideDiff([
    { type: "meta", text: "@@ -100 +100,2 @@", hunkIndex: 0 },
    { type: "add", text: "+unrelated change", hunkIndex: 0 },
  ], "empty", { filePath: "target.c", scope: "unstaged" });
  assert.doesNotMatch(missing, /work-diff-target/);

  state.workDiffFeedback.highlight.expiresAt = Date.now() - 1;
  const expired = sandbox.renderSideDiff(after, "empty", { filePath: "target.c", scope: "unstaged" });
  assert.doesNotMatch(expired, /work-diff-target/);
  sandbox.setWorkDiffFeedback("target.c", "已暂存所选 1 行", { highlight });

  let removed = false;
  sandbox.scheduleWorkDiffTargetClear({
    querySelectorAll: () => [{ classList: { remove: (name) => { removed = name === "work-diff-target"; } } }],
  });
  assert.deepEqual(timers.map((timer) => timer.delay), [1800]);
  timers[0].callback();
  assert.equal(removed, true);
  assert.equal(state.workDiffFeedback.highlight, null);
});

test("worktree diff actions restore the modal, loaded range, and both scroll axes", () => {
  let modalOpens = 0;
  const frameCallbacks = [];
  const timerCallbacks = [];
  const state = { diffModalRenderLimit: 2400 };
  const els = {
    diffModal: { classList: { contains: (name) => name === "show" } },
    diffModalBody: { scrollTop: 680, scrollLeft: 145 },
    workDiffView: { scrollTop: 230, scrollLeft: 55 },
  };
  const sandbox = {
    state,
    els,
    requestAnimationFrame: (callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    },
    setTimeout: (callback, delay) => {
      timerCallbacks.push({ callback, delay });
      return timerCallbacks.length;
    },
  };
  vm.runInNewContext(diffWorkbench, sandbox);
  const view = sandbox.captureWorkDiffActionView();

  state.diffModalRenderLimit = 1000;
  els.diffModalBody.scrollTop = 0;
  els.diffModalBody.scrollLeft = 0;
  els.workDiffView.scrollTop = 0;
  els.workDiffView.scrollLeft = 0;
  sandbox.openDiffModal = () => {
    modalOpens += 1;
  };
  sandbox.restoreWorkDiffActionView(view);

  assert.equal(state.diffModalRenderLimit, 2400);
  assert.equal(modalOpens, 1);
  assert.equal(els.diffModalBody.scrollTop, 680);
  assert.equal(els.diffModalBody.scrollLeft, 145);
  assert.equal(els.workDiffView.scrollTop, 230);
  assert.equal(els.workDiffView.scrollLeft, 55);
  assert.equal(frameCallbacks.length, 2);
  assert.deepEqual(timerCallbacks.map((item) => item.delay), [60, 60]);

  els.diffModalBody.scrollTop = 0;
  els.diffModalBody.scrollLeft = 0;
  els.workDiffView.scrollTop = 0;
  els.workDiffView.scrollLeft = 0;
  frameCallbacks.forEach((callback) => callback());
  assert.equal(els.diffModalBody.scrollTop, 680);
  assert.equal(els.diffModalBody.scrollLeft, 145);
  assert.equal(els.workDiffView.scrollTop, 230);
  assert.equal(els.workDiffView.scrollLeft, 55);

  els.diffModalBody.scrollTop = 0;
  els.diffModalBody.scrollLeft = 0;
  els.workDiffView.scrollTop = 0;
  els.workDiffView.scrollLeft = 0;
  timerCallbacks.forEach(({ callback }) => callback());
  assert.equal(els.diffModalBody.scrollTop, 680);
  assert.equal(els.diffModalBody.scrollLeft, 145);
  assert.equal(els.workDiffView.scrollTop, 230);
  assert.equal(els.workDiffView.scrollLeft, 55);
});

test("maximized diffs keep feedback, line actions, and headers sticky while scrolling", () => {
  assert.match(styles, /\.diff-modal-body \.side-diff\s*\{[^}]*overflow:\s*visible/s);
  assert.match(styles, /\.side-diff\.has-work-feedback \.diff-line-toolbar\s*\{[^}]*position:\s*sticky[^}]*top:\s*38px/s);
  assert.match(styles, /\.side-diff\.has-work-feedback \.diff-line-toolbar \+ \.side-diff-head\s*\{[^}]*top:\s*76px/s);
});

test("historical comparison no longer coordinates with a removed inline preview", () => {
  assert.doesNotMatch(inspector, /previewSuspended|renderSelectedCommitFileDiff/);
  assert.doesNotMatch(editor, /restoreCommitPreview|renderSelectedCommitFileDiff/);
});

test("read-only historical comparison does not observe stage buttons", () => {
  assert.match(editor, /if \(editor\.canStage\) observeFileEditorStageButtons\(editor\);/);
});

test("historical comparison can switch between connectors and aligned spacer rows", () => {
  assert.match(html, /id="fileEditorCompareMode"[\s\S]*data-file-editor-compare-mode="connect"[\s\S]*data-file-editor-compare-mode="align"/);
  assert.match(core, /commitFileCompareMode:\s*"connect"/);
  assert.match(core, /fileEditorCompareMode:\s*\$\("#fileEditorCompareMode"\)/);
  assert.match(editorLoader, /fileEditorCompareMode\.addEventListener\("click"[\s\S]*setFileEditorCompareMode/);
  assert.match(editor, /compareMode:\s*source === "commit" \? normalizeFileEditorCompareMode\(state\.commitFileCompareMode\) : "align"/);
  assert.match(editor, /connect:\s*editor\.readOnly\s*\?\s*editor\.compareMode === "align" \? "align" : null\s*:\s*"align"/s);
  assert.match(editor, /function setFileEditorCompareMode[\s\S]*captureFileEditorView\(editor\)[\s\S]*destroyFileEditorInstance\(\)[\s\S]*createFileEditorInstance\(editor\)/);
  assert.match(styles, /\.file-editor-compare-mode\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.equal(catalog.translateKnown("en", "行对齐"), "Align lines");
});

test("replaced MergeView instances release global resize tracking immediately", () => {
  assert.match(editor, /editor\?\.mergeView\?\.destroy\?\.\(\);[\s\S]*?fileEditorMerge\) els\.fileEditorMerge\.replaceChildren\(\)/);
  assert.match(mergeAddon, /this\._onResize = onResize;[\s\S]*?this\._resizeInterval = setInterval/);
  assert.match(mergeAddon, /if \(!p\) self\.destroy\(\);/);
  assert.match(mergeAddon, /destroy: function\(\) \{[\s\S]*?clearInterval\(this\._resizeInterval\)[\s\S]*?CodeMirror\.off\(window, "resize", this\._onResize\)/);
});

test("large historical files keep the lightweight comparison path", () => {
  assert.match(editor, /const showCompareMode = commitView && !editor\.largeFile && !editor\.lightweightCompare && !editor\.conflict/);
  assert.match(editor, /if \(!editor \|\| editor\.source !== "commit" \|\| editor\.largeFile \|\| editor\.lightweightCompare \|\| editor\.conflict/);
});

test("historical comparison switches complex files to the lightweight path", () => {
  const sandbox = {};
  vm.runInNewContext(editor, sandbox);

  const manyLines = Array.from({ length: 60000 }, (_, index) => `line-${index}`).join("\n");
  const lineResult = sandbox.detectFileEditorLightweightCompare("commit", manyLines, manyLines, false);
  assert.equal(lineResult.enabled, true);
  assert.equal(lineResult.reason, "lines");

  const oldLines = Array.from({ length: 240 }, (_, index) => `line-${index}`);
  const newLines = oldLines.slice();
  for (let index = 0; index < 40; index += 1) {
    const lineIndex = index * 5 + 1;
    newLines[lineIndex] = `changed-${lineIndex}`;
  }
  const diffResult = sandbox.detectFileEditorLightweightCompare("commit", oldLines.join("\n"), newLines.join("\n"), false);
  assert.equal(diffResult.enabled, true);
  assert.equal(diffResult.reason, "diff");

  const smallResult = sandbox.detectFileEditorLightweightCompare("commit", "one\ntwo\nthree", "one\nchanged\nthree", false);
  assert.equal(smallResult.enabled, false);
  assert.equal(smallResult.reason, "");

  const shiftedLines = Array.from({ length: 3000 }, (_, index) => `line-${index}`);
  const insertedLines = shiftedLines.slice();
  insertedLines.splice(1500, 0, "inserted-line");
  const shiftedResult = sandbox.detectFileEditorLightweightCompare("commit", shiftedLines.join("\n"), insertedLines.join("\n"), false);
  assert.equal(shiftedResult.enabled, false);
  assert.equal(shiftedResult.reason, "");

  const worktreeResult = sandbox.detectFileEditorLightweightCompare("worktree", manyLines, manyLines, false);
  assert.equal(worktreeResult.enabled, false);
  assert.equal(worktreeResult.reason, "");
});

test("large files use two lightweight CodeMirror panes instead of MergeView", () => {
  const largeCompare = editor.match(/function createLargeFileCompare[\s\S]*?\r?\n}\r?\n\r?\nfunction observeFileEditorStageButtons/)?.[0] || "";
  assert.match(editor, /else if \(editor\.largeFile \|\| editor\.lightweightCompare\) \{\s*createLargeFileCompare\(editor, codeMirrorOptions\);/s);
  assert.match(largeCompare, /editor\.oldCodeMirror = CodeMirror\(oldHost/);
  assert.match(largeCompare, /editor\.codeMirror = CodeMirror\(newHost/);
  assert.doesNotMatch(largeCompare, /MergeView/);
  assert.match(largeCompare, /editor\.oldCodeMirror\.on\("scroll", editor\.oldScrollHandler\)/);
  assert.match(editor, /editor\?\.oldCodeMirror && editor\.oldScrollHandler[\s\S]*?\.off\("scroll", editor\.oldScrollHandler\)/);
  assert.match(styles, /\.file-editor-large-compare\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 1px minmax\(0, 1fr\);/s);
});

test("file editor loads local CodeMirror MergeView with line numbers and syntax modes", () => {
  const simpleModeIndex = editorLoader.indexOf("./vendor/codemirror/addon/mode/simple.js");
  assert.ok(simpleModeIndex > editorLoader.indexOf("./vendor/codemirror/lib/codemirror.js"));
  assert.ok(simpleModeIndex < editorLoader.indexOf("./vendor/codemirror/mode/dockerfile/dockerfile.js"));
  assert.ok(simpleModeIndex < editorLoader.indexOf("./vendor/codemirror/mode/rust/rust.js"));
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "lib", "codemirror.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "addon", "mode", "simple.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "addon", "merge", "merge.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "diff-match-patch.js")), true);
  assert.match(editorLoader, /\.\/vendor\/codemirror\/lib\/codemirror\.css/);
  assert.match(editorLoader, /\.\/vendor\/codemirror\/addon\/merge\/merge\.css/);
  assert.match(editorLoader, /\.\/vendor\/codemirror\/diff-match-patch\.js/);
  assert.match(editorLoader, /\.\/vendor\/codemirror\/addon\/merge\/merge\.js/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /id="fileEditorOldLabel"/);
  assert.match(html, /id="fileEditorNewLabel"/);
  assert.match(html, /id="fileEditorMerge"/);
  assert.match(editor, /CodeMirror\.MergeView/);
  assert.match(editor, /origLeft: editor\.oldContent/);
  assert.match(editor, /lineNumbers: true/);
  assert.match(editor, /chunkClassLocation: \["background", "gutter"\]/);
  assert.match(editor, /revertButtons: editor\.canStage/);
  assert.match(editor, /revertChunk:.*stageFileEditorChunk/s);
  assert.match(editor, /"Revert chunk": t\("暂存此改动块"\)/);
  assert.match(editor, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{/);
  assert.match(editor, /refreshFileEditorCodeMirror/);
  assert.match(editor, /fileEditorMode\(file\)/);
  assert.match(editor, /"\.c": \{ mode: "text\/x-csrc"/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-linenumber/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-copy\s*\{/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-left \.CodeMirror-merge-l-chunk/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-editor \.CodeMirror-merge-l-chunk/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-spacer\s*\{[^}]*width:\s*100%[^}]*repeating-linear-gradient/s);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-l-deleted/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-l-inserted/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-2pane \.CodeMirror-merge-gap\s*\{[^}]*width:\s*40px/s);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-pane\s*\{[^}]*height:\s*100%/s);
  assert.match(styles, /\.file-editor-body \.file-editor-merge \.CodeMirror-merge,/);
  assert.match(styles, /\.file-editor-body \.file-editor-merge \.CodeMirror\s*\{[^}]*height:\s*100%/s);
  assert.match(styles, /\.file-editor-body\s*\{[^}]*grid-row:\s*4/s);
  assert.match(styles, /\.file-editor-footer\s*\{[^}]*grid-row:\s*5/s);
  assert.match(styles, /\.cm-s-default \.cm-keyword/);
});

test("conflict file editor uses current, result, and incoming panes", () => {
  assert.match(html, /id="fileEditorResultLabel"/);
  assert.match(core, /fileEditorResultLabel:\s*\$\("#fileEditorResultLabel"\)/);
  assert.match(editor, /editor\.conflict = Boolean\(data\.conflict\)/);
  assert.match(editor, /editor\.conflictVersions = normalizeFileEditorConflictVersions\(data\.conflictVersions\)/);
  assert.match(editor, /detectFileEditorLightweightCompare\(\s*"commit",\s*editor\.conflictVersions\.ours\.content,\s*editor\.conflictVersions\.theirs\.content/s);
  assert.match(editor, /else if \(editor\.conflict\) \{\s*editor\.mergeView = CodeMirror\.MergeView/s);
  assert.match(editor, /if \(editor\.conflict && \(editor\.lightweightCompare \|\| !canUseMergeView\)\) \{\s*createConflictFileCompare\(editor, codeMirrorOptions\);/s);
  assert.match(editor, /function createConflictFileCompare\(/);
  assert.match(editor, /function bindConflictFileEditorScroll\(/);
  assert.match(editor, /origLeft: editor\.conflictVersions\.ours\.content/);
  assert.match(editor, /origRight: editor\.conflictVersions\.theirs\.content/);
  assert.match(editor, /"Revert chunk": t\("将此侧改动应用到合并结果"\)/);
  assert.match(editor, /if \(button\.textContent !== t\("应用"\)\) button\.textContent = t\("应用"\)/);
  assert.match(editor, /else \{\s*editor\.mergeView = CodeMirror\.MergeView/s);
  assert.match(styles, /\.file-editor-compare-labels\.is-conflict-three-way\s*\{[^}]*grid-template-columns:[^}]*calc\(\(100% - 56px\) \/ 3\)/s);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-3pane \.CodeMirror-merge-pane/);
});

test("ordinary worktree files accept null conflict versions from the API", () => {
  const context = vm.createContext({});
  vm.runInContext(editorUtils, context);

  const normalized = vm.runInContext("normalizeFileEditorConflictVersions(null)", context);
  assert.equal(normalized.ours.exists, false);
  assert.equal(normalized.ours.content, "");
  assert.equal(normalized.theirs.exists, false);
  assert.equal(normalized.theirs.content, "");
});

test("two-pane file comparison shows clickable change markers beside both scrollbars", () => {
  assert.match(editorActions, /function observeFileEditorChangeMarkers\(/);
  assert.match(editorActions, /editor\.mergeView\.leftChunks\(\)/);
  assert.match(editorActions, /file-editor-change-rail/);
  assert.match(editorActions, /file-editor-change-marker/);
  assert.match(editorActions, /scrollTo\(null, Math\.max\(0, targetTop\)\)/);
  assert.match(editorActions, /function fileEditorChangeTargetTop\(/);
  assert.match(editorActions, /scrollInfo\.height - scrollInfo\.clientHeight/);
  assert.match(editorCore, /observeFileEditorChangeMarkers\(editor\)/);
  assert.match(editorActions, /function positionFileEditorChangeMarkers\(/);
  assert.match(editorWindow, /positionFileEditorChangeMarkers\(editor\)/);
  assert.match(editorWindow, /editor\.codeMirror\.off\("updateDiff", editor\.diffUpdateHandler\)/);
  assert.match(styles, /\.file-editor-change-rail\s*\{/);
  assert.match(styles, /\.file-editor-change-marker\.is-old\s*\{[^}]*var\(--danger\)/s);
  assert.match(styles, /\.file-editor-change-marker\.is-new\s*\{[^}]*var\(--green\)/s);
});

test("file editor stays hidden until the comparison is fully prepared", () => {
  assert.match(
    editorCore,
    /await api\([\s\S]*?classList\.add\("show", "is-preparing"\)[\s\S]*?createFileEditorWithPerformanceGuard\(editor\)[\s\S]*?await waitForFileEditorPaint\(\)[\s\S]*?classList\.remove\("is-preparing"\)/
  );
  assert.match(editorCore, /classList\.remove\("show", "is-preparing"\)/);
  assert.match(styles, /\.file-editor-modal\.is-preparing\s*\{[^}]*visibility:\s*hidden/s);
});

test("file editor provides find, replace, shortcuts, and repository cleanup", () => {
  assert.match(core, /fileEditor:\s*null/);
  assert.match(core, /fileEditorModal:\s*\$\("#fileEditorModal"\)/);
  assert.match(core, /fileEditorSearchInput:\s*\$\("#fileEditorSearchInput"\)/);
  assert.match(html, /id="fileEditorReplaceInput"/);
  assert.match(html, /id="fileEditorCaseSensitive"/);
  assert.match(html, /id="fileEditorReplaceAll"/);
  assert.match(events, /submitFileEditor/);
  assert.match(editorLoader, /addEventListener\("input", \(\) => updateFileEditorStatus\(\)\)/);
  assert.match(events, /key\.toLowerCase\(\) === "f"/);
  assert.match(events, /key\.toLowerCase\(\) === "h"/);
  assert.match(events, /key\.toLowerCase\(\) === "s"/);
  assert.match(editor, /getSearchCursor/);
  assert.match(editor, /replaceCurrentFileEditorMatch/);
  assert.match(editor, /replaceAllFileEditorMatches/);
  assert.match(events, /closeFileEditor/);
  assert.match(repositories, /destroyFileEditorInstance\(\)/);
  assert.match(repositories, /els\.fileEditorModal/);
  assert.match(styles, /\.file-editor-dialog/);
  assert.match(styles, /@media \(max-width: 720px\)/);
});

test("file editor is a non-blocking floating window with a practical default size", () => {
  assert.match(styles, /\.file-editor-modal\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /\.file-editor-dialog\s*\{[^}]*pointer-events:\s*auto/s);
  assert.match(
    styles,
    /\.file-editor-dialog\s*\{[^}]*width:\s*min\(1180px, calc\(100vw - 48px\)\)[^}]*height:\s*min\(760px, calc\(100vh - 64px\)\)/s
  );
  assert.doesNotMatch(editor, /document\.body\.classList\.add\("modal-open"\)/);
  assert.match(
    styles,
    /\.file-editor-merge \.CodeMirror-merge-2pane \.CodeMirror-merge-gap\s*\{[^}]*width:\s*48px/s
  );
  assert.match(styles, /grid-template-columns:\s*calc\(50% - 24px\) 48px calc\(50% - 24px\)/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-2pane \.CodeMirror-merge-pane\s*\{[^}]*width:\s*calc\(50% - 24px\)/s);
  assert.doesNotMatch(styles, /calc\(\(100% - (?:40|48)px\) \/ 2\)/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-pane\s*\{[^}]*height:\s*100%/s);
});

test("file editor window can be resized and dragged without escaping the viewport", () => {
  assert.match(html, /id="fileEditorResizeHandle"/);
  assert.doesNotMatch(styles, /\.file-editor-dialog\s*\{[^}]*resize:\s*both/s);
  assert.match(styles, /\.file-editor-resize-handle\s*\{/);
  assert.match(styles, /\.file-editor-head\s*\{[^}]*cursor:\s*move/s);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.file-editor-dialog[\s\S]*?resize:\s*none/);
  assert.match(editorLoader, /beginFileEditorDrag/);
  assert.match(editorLoader, /moveFileEditorDrag/);
  assert.match(editorLoader, /endFileEditorDrag/);
  assert.match(editorLoader, /beginFileEditorResize/);
  assert.match(editorLoader, /moveFileEditorResize/);
  assert.match(editorLoader, /endFileEditorResize/);
  assert.match(editorLoader, /window\.addEventListener\("mousemove"/);
  assert.match(editorLoader, /window\.addEventListener\("mouseup"/);
  assert.match(editor, /function clampFileEditorWindow/);
  assert.match(editor, /new ResizeObserver/);
  assert.match(editor, /refreshFileEditorCodeMirror/);
});

test("file editor stages from the center and restores selected changes from a context menu", () => {
  assert.match(html, /id="fileEditorContextMenu"/);
  assert.match(html, /data-file-editor-action="stageSelectedLines"/);
  assert.match(html, /data-file-editor-action="discardSelectedHunk"/);
  assert.match(core, /fileEditorContextMenu:\s*\$\("#fileEditorContextMenu"\)/);
  assert.match(editorLoader, /showFileEditorContextMenu/);
  assert.match(events, /runFileEditorContextAction/);
  assert.match(editor, /stageFileEditorChunk/);
  assert.match(editor, /action: "stageHunk", hunkIndex, diffContext: editor\.diffContext/);
  assert.match(editor, /stageFileEditorSelectedLines/);
  assert.match(editor, /discardFileEditorSelectedHunk/);
  assert.match(editor, /createFileEditorWithPerformanceGuard\(editor\);\s*setFileEditorControlsDisabled\(false\);/);
  assert.match(editor, /currentBranchSnapshotPayload\(\)/);
  assert.match(editor, /fileSnapshotPayload\(editor\.file, editor\.diffScope\)/);
  assert.match(editor, /button\.textContent = t\("暂存"\)/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-copy\s*\{[^}]*font-size:\s*11px/s);
});

test("file editor centers each stage button on the full visual chunk", () => {
  const sandbox = {};
  vm.runInNewContext(editor, sandbox);
  const codeMirror = (lineHeights) => ({
    getScrollerElement: () => ({ getBoundingClientRect: () => ({ top: 100 }) }),
    getScrollInfo: () => ({ top: 20 }),
    heightAtLine: (line) => lineHeights[line],
  });
  const mergeView = {
    wrap: { getBoundingClientRect: () => ({ top: 80 }) },
    leftOriginal: () => codeMirror({ 2: 40, 6: 160 }),
    editor: () => codeMirror({ 3: 60, 9: 240 }),
  };

  assert.equal(
    sandbox.fileEditorStageButtonCenter(mergeView, { origFrom: 2, origTo: 6, editFrom: 3, editTo: 9 }),
    140
  );
  assert.match(editor, /button\.style\.top\s*=\s*`\$\{center\}px`/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-copy\s*\{[^}]*transform:\s*translate\(-50%,\s*-50%\)/s);
});

test("file editor merge highlights keep syntax text readable", () => {
  assert.match(
    styles,
    /\.file-editor-merge \.CodeMirror-merge-left \.CodeMirror-merge-l-chunk\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--danger\) 12%, var\(--field\)\)/s
  );
  assert.match(
    styles,
    /\.file-editor-merge \.CodeMirror-merge-editor \.CodeMirror-merge-l-chunk\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--green\) 11%, var\(--field\)\)/s
  );
  assert.match(
    styles,
    /\.file-editor-merge \.CodeMirror-merge-l-deleted\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--danger\) 18%, transparent\)/s
  );
  assert.match(
    styles,
    /\.file-editor-merge \.CodeMirror-merge-l-inserted\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--green\) 16%, transparent\)/s
  );
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-l-(?:deleted|inserted)[^}]*box-shadow:[^}]*var\(--(?:danger|green)\)/s);
});

test("file editor maps working-tree selections to the matching Git hunk and line keys", () => {
  const sandbox = {};
  vm.runInNewContext(editor, sandbox);
  const diff = [
    { type: "meta", text: "@@ -1,3 +1,3 @@", hunkIndex: 0 },
    { type: "ctx", text: " first", hunkIndex: 0 },
    { type: "del", text: "-old", hunkIndex: 0 },
    { type: "add", text: "+new", hunkIndex: 0 },
    { type: "ctx", text: " third", hunkIndex: 0 },
    { type: "meta", text: "@@ -20,2 +20,3 @@", hunkIndex: 1 },
    { type: "ctx", text: " twenty", hunkIndex: 1 },
    { type: "add", text: "+inserted", hunkIndex: 1 },
    { type: "ctx", text: " twenty-one", hunkIndex: 1 },
  ];
  const lineMap = sandbox.fileEditorDiffLineSelectionMap(diff);
  assert.deepEqual(
    Array.from(lineMap.get(1).lines, (line) => `${line.hunkIndex}:${line.lineIndex}`).sort(),
    ["0:1", "0:2"]
  );
  assert.deepEqual(Array.from(lineMap.get(20).lines, (line) => `${line.hunkIndex}:${line.lineIndex}`), ["1:1"]);
  assert.equal(sandbox.fileEditorHunkForChunk({ diff }, 1, 2, 1, 2), 0);
  assert.equal(sandbox.fileEditorHunkForChunk({ diff }, 20, 21, 20, 21), 1);
  assert.equal(sandbox.fileEditorHunkForChunk({ diff }, 10, 11, 10, 11), undefined);

  const editorDiff = [
    { type: "meta", text: "@@ -5 +5 @@", hunkIndex: 0 },
    { type: "del", text: "-old five", hunkIndex: 0 },
    { type: "add", text: "+new five", hunkIndex: 0 },
    { type: "meta", text: "@@ -10 +10 @@", hunkIndex: 1 },
    { type: "del", text: "-old ten", hunkIndex: 1 },
    { type: "add", text: "+new ten", hunkIndex: 1 },
    { type: "meta", text: "@@ -15 +14,0 @@", hunkIndex: 2 },
    { type: "del", text: "-deleted fifteen", hunkIndex: 2 },
  ];
  assert.equal(sandbox.fileEditorHunkForChunk({ diff: editorDiff }, 4, 5, 4, 5), 0);
  assert.equal(sandbox.fileEditorHunkForChunk({ diff: editorDiff }, 9, 10, 9, 10), 1);
  assert.equal(sandbox.fileEditorHunkForChunk({ diff: editorDiff }, 14, 15, 14, 14), 2);
});

test("saving keeps the floating editor open and reloads its comparison", () => {
  const submitEditor = editor.match(/async function submitFileEditor[\s\S]*?\r?\n}\r?\n\r?\nfunction closeFileEditor/)?.[0] || "";
  assert.match(editor, /await refreshWorktree\(true\)/);
  assert.match(submitEditor, /const restoreView = captureFileEditorView\(editor\)/);
  assert.match(submitEditor, /await openFileEditor\(file, previousFile, \{ force: true, reload: true, restoreView, feedbackMessage: "文件已保存" \}\)/);
  assert.doesNotMatch(submitEditor, /state\.selectedChanges\.add[\s\S]{0,240}closeFileEditor\(true\)/);
});

test("file editor restores the viewed line after save and staging actions", () => {
  const sandbox = {};
  vm.runInNewContext(editor, sandbox);
  const scrolls = [];
  const current = {
    getScrollInfo: () => ({ top: 420, left: 14 }),
    lineAtHeight: (height) => height / 10,
    firstLine: () => 0,
    lastLine: () => 200,
    heightAtLine: (line) => line * 10,
    scrollTo: (left, top) => scrolls.push(["current", left, top]),
  };
  const old = {
    getScrollInfo: () => ({ top: 390, left: 8 }),
    lineAtHeight: (height) => height / 10,
    firstLine: () => 0,
    lastLine: () => 200,
    heightAtLine: (line) => line * 10,
    scrollTo: (left, top) => scrolls.push(["old", left, top]),
  };
  const view = sandbox.captureFileEditorView({ codeMirror: current, oldCodeMirror: old });

  assert.deepEqual({ ...view }, { line: 42, left: 14, oldLine: 39, oldLeft: 8 });
  sandbox.restoreFileEditorView({ codeMirror: current, oldCodeMirror: old }, view);
  assert.deepEqual(scrolls, [["current", 14, 324], ["old", 8, 294]]);
  const mergeViewEditor = { codeMirror: current, oldCodeMirror: null, mergeView: { leftOriginal: () => old } };
  const mergeView = sandbox.captureFileEditorView(mergeViewEditor);
  assert.deepEqual({ ...mergeView }, { line: 42, left: 14, oldLine: 39, oldLeft: 8 });
  sandbox.restoreFileEditorView(mergeViewEditor, mergeView);
  assert.deepEqual(scrolls.slice(-2), [["current", 14, 324], ["old", 8, 294]]);
  assert.match(editor, /captureFileEditorView\(editor, options\.focusLine\)/);
  assert.match(editor, /feedbackMessage: options\.feedbackMessage \|\| fallbackOutput/);
});

test("file editor exposes Chinese encoding and comparison messages in English mode", () => {
  assert.equal(catalog.translate("en", "查找替换"), "Find and replace");
  assert.equal(catalog.translate("en", "拖动调整窗口大小"), "Drag to resize the window");
  assert.equal(catalog.translate("en", "恢复文件草稿"), "Recover file draft");
  assert.equal(catalog.translate("en", "磁盘当前版本"), "Current disk version");
  assert.equal(catalog.translate("en", "恢复草稿"), "Recovered draft");
  assert.equal(
    catalog.translate("en", "已恢复页面停止前的未保存内容"),
    "Recovered unsaved content from before the page stopped"
  );
  assert.equal(catalog.translate("en", "暂存区中不存在"), "Not present in the index");
  assert.equal(catalog.translate("en", "暂存此改动块"), "Stage this change block");
  assert.equal(catalog.translate("en", "还原所选改动块"), "Restore the selected change block");
  assert.equal(catalog.translate("en", "切换同步滚动"), "Toggle synchronized scrolling");
  assert.equal(catalog.translate("en", "大文件模式"), "Large file mode");
  assert.equal(catalog.translate("en", "复杂文件轻量模式"), "Complex file lightweight mode");
  assert.equal(catalog.translate("en", "行数较多"), "Many lines");
  assert.equal(catalog.translate("en", "差异较复杂"), "Complex differences");
  assert.equal(catalog.translate("en", "已暂存改动块"), "Change block staged");
  assert.equal(catalog.translate("en", "找到 {count} 个匹配", { count: 3 }), "Found 3 matches");
  assert.equal(catalog.translate("en", "已替换 {count} 处", { count: 2 }), "Replaced 2 matches");
  assert.equal(
    catalog.translate("en", "文件不是有效的 UTF-8、GBK 或 GB18030 文本，当前编辑器无法打开。"),
    "This file is not valid UTF-8, GBK, or GB18030 text and cannot be opened in the editor."
  );
});
