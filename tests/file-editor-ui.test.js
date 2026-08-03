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
const contextMenus = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const diffWorkbench = fs.readFileSync(path.join(root, "public", "js", "features", "diff-workbench.js"), "utf8");
const inspector = fs.readFileSync(path.join(root, "public", "js", "panels", "inspector.js"), "utf8");
const repositories = fs.readFileSync(path.join(root, "public", "js", "features", "repositories.js"), "utf8");
const editor = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const catalog = require(path.join(root, "public", "js", "i18n-catalog.js"));

test("file editor opens from worktree double-click and follows file selection while open", () => {
  assert.match(html, /id="editWorktreeFile"/);
  assert.match(html, /data-file-action="edit"/);
  assert.match(html, /id="fileEditorModal"/);
  assert.match(html, /id="fileEditorText"[^>]*wrap="off"/);
  assert.match(html, /js\/features\/file-editor\.js/);
  assert.match(contextMenus, /action === "edit"/);
  assert.match(contextMenus, /previousFile: fileInfo\.previousFile/);
  assert.match(contextMenus, /openFileEditor\(context\.file, context\.previousFile/);
  assert.match(diffWorkbench, /row\.addEventListener\("dblclick"/);
  assert.match(diffWorkbench, /openFileEditor\(filePath, previousFile/);
  assert.match(diffWorkbench, /switchOpenFileEditor\(filePath, previousFile/);
  assert.match(editor, /文件还有未保存的修改，确认切换到/);
});

test("worktree selection updates in place so the same row can receive a double-click", () => {
  const selectChangeSource = diffWorkbench.slice(
    diffWorkbench.indexOf("function selectChangeFile"),
    diffWorkbench.indexOf("function updateChangeSelection")
  );
  assert.match(selectChangeSource, /refreshChangeSelectionUi\(\)/);
  assert.match(selectChangeSource, /loadWorkingDiff\(filePath\)/);
  assert.doesNotMatch(selectChangeSource, /renderStage\(\)/);
  assert.match(diffWorkbench, /function refreshChangeSelectionUi\(\)[\s\S]*?row\.classList\.toggle\("multi-selected", selected\)/);
  assert.match(diffWorkbench, /actions\?\.querySelectorAll\("\[data-bulk-file-action\]"\)[\s\S]*?button\.disabled = selectedCount === 0/);
});

test("commit file double-click opens the shared comparison window in read-only mode", () => {
  assert.match(inspector, /bindFileTree\(els\.detailBody, \{ mode: "commit", commitSha: commit\.sha \}\)/);
  assert.match(diffWorkbench, /options\.mode === "commit"[\s\S]*row\.addEventListener\("dblclick"/);
  assert.match(diffWorkbench, /openCommitFileViewer\(filePath, previousFile, options\.commitSha\)/);
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

test("historical comparison no longer coordinates with a removed inline preview", () => {
  assert.doesNotMatch(inspector, /previewSuspended|renderSelectedCommitFileDiff/);
  assert.doesNotMatch(editor, /restoreCommitPreview|renderSelectedCommitFileDiff/);
});

test("read-only historical comparison does not observe stage buttons", () => {
  assert.match(editor, /if \(editor\.canStage\) observeFileEditorStageButtons\(editor\);/);
});

test("read-only historical comparison avoids MergeView alignment loops", () => {
  assert.match(editor, /connect: editor\.readOnly \? null : "align"/);
});

test("large files use two lightweight CodeMirror panes instead of MergeView", () => {
  const largeCompare = editor.match(/function createLargeFileCompare[\s\S]*?\n}\n\nfunction observeFileEditorStageButtons/)?.[0] || "";
  assert.match(editor, /else if \(editor\.largeFile\) \{\s*createLargeFileCompare\(editor, codeMirrorOptions\);/s);
  assert.match(largeCompare, /editor\.oldCodeMirror = CodeMirror\(oldHost/);
  assert.match(largeCompare, /editor\.codeMirror = CodeMirror\(newHost/);
  assert.doesNotMatch(largeCompare, /MergeView/);
  assert.match(largeCompare, /editor\.oldCodeMirror\.on\("scroll", editor\.oldScrollHandler\)/);
  assert.match(editor, /editor\?\.oldCodeMirror && editor\.oldScrollHandler[\s\S]*?\.off\("scroll", editor\.oldScrollHandler\)/);
  assert.match(styles, /\.file-editor-large-compare\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 1px minmax\(0, 1fr\);/s);
});

test("file editor loads local CodeMirror MergeView with line numbers and syntax modes", () => {
  const simpleModeIndex = html.indexOf("./vendor/codemirror/addon/mode/simple.js");
  assert.ok(simpleModeIndex > html.indexOf("./vendor/codemirror/lib/codemirror.js"));
  assert.ok(simpleModeIndex < html.indexOf("./vendor/codemirror/mode/dockerfile/dockerfile.js"));
  assert.ok(simpleModeIndex < html.indexOf("./vendor/codemirror/mode/rust/rust.js"));
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "lib", "codemirror.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "addon", "mode", "simple.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "addon", "merge", "merge.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "diff-match-patch.js")), true);
  assert.match(html, /\.\/vendor\/codemirror\/lib\/codemirror\.css/);
  assert.match(html, /\.\/vendor\/codemirror\/addon\/merge\/merge\.css/);
  assert.match(html, /\.\/vendor\/codemirror\/diff-match-patch\.js/);
  assert.match(html, /\.\/vendor\/codemirror\/addon\/merge\/merge\.js/);
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
  assert.match(styles, /\.file-editor-body\s*\{[^}]*grid-row:\s*4/s);
  assert.match(styles, /\.file-editor-footer\s*\{[^}]*grid-row:\s*5/s);
  assert.match(styles, /\.cm-s-default \.cm-keyword/);
});

test("conflict file editor uses one CodeMirror pane instead of an empty MergeView comparison", () => {
  assert.match(editor, /editor\.conflict = Boolean\(data\.conflict\)/);
  assert.match(editor, /if \(editor\.conflict\) \{\s*editor\.codeMirror = CodeMirror\(els\.fileEditorMerge, codeMirrorOptions\);/s);
  assert.match(editor, /else \{\s*editor\.mergeView = CodeMirror\.MergeView/s);
  assert.match(styles, /\.file-editor-compare-labels\.is-single-pane\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
});

test("file editor provides find, replace, shortcuts, and repository cleanup", () => {
  assert.match(core, /fileEditor:\s*null/);
  assert.match(core, /fileEditorModal:\s*\$\("#fileEditorModal"\)/);
  assert.match(core, /fileEditorSearchInput:\s*\$\("#fileEditorSearchInput"\)/);
  assert.match(html, /id="fileEditorReplaceInput"/);
  assert.match(html, /id="fileEditorCaseSensitive"/);
  assert.match(html, /id="fileEditorReplaceAll"/);
  assert.match(events, /submitFileEditor/);
  assert.match(events, /addEventListener\("input", \(\) => updateFileEditorStatus\(\)\)/);
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
  assert.match(events, /beginFileEditorDrag/);
  assert.match(events, /moveFileEditorDrag/);
  assert.match(events, /endFileEditorDrag/);
  assert.match(events, /beginFileEditorResize/);
  assert.match(events, /moveFileEditorResize/);
  assert.match(events, /endFileEditorResize/);
  assert.match(events, /window\.addEventListener\("mousemove"/);
  assert.match(events, /window\.addEventListener\("mouseup"/);
  assert.match(editor, /function clampFileEditorWindow/);
  assert.match(editor, /new ResizeObserver/);
  assert.match(editor, /refreshFileEditorCodeMirror/);
});

test("file editor stages from the center and restores selected changes from a context menu", () => {
  assert.match(html, /id="fileEditorContextMenu"/);
  assert.match(html, /data-file-editor-action="stageSelectedLines"/);
  assert.match(html, /data-file-editor-action="discardSelectedHunk"/);
  assert.match(core, /fileEditorContextMenu:\s*\$\("#fileEditorContextMenu"\)/);
  assert.match(events, /showFileEditorContextMenu/);
  assert.match(events, /runFileEditorContextAction/);
  assert.match(editor, /stageFileEditorChunk/);
  assert.match(editor, /action: "stageHunk", hunkIndex, diffContext: editor\.diffContext/);
  assert.match(editor, /stageFileEditorSelectedLines/);
  assert.match(editor, /discardFileEditorSelectedHunk/);
  assert.match(editor, /createFileEditorInstance\(editor\);\s*setFileEditorControlsDisabled\(false\);/);
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
  const submitEditor = editor.match(/async function submitFileEditor[\s\S]*?\n}\n\nfunction closeFileEditor/)?.[0] || "";
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
  assert.match(editor, /captureFileEditorView\(editor, options\.focusLine\)/);
  assert.match(editor, /feedbackMessage: options\.feedbackMessage \|\| fallbackOutput/);
});

test("file editor exposes Chinese encoding and comparison messages in English mode", () => {
  assert.equal(catalog.translate("en", "查找替换"), "Find and replace");
  assert.equal(catalog.translate("en", "拖动调整窗口大小"), "Drag to resize the window");
  assert.equal(catalog.translate("en", "暂存区中不存在"), "Not present in the index");
  assert.equal(catalog.translate("en", "暂存此改动块"), "Stage this change block");
  assert.equal(catalog.translate("en", "还原所选改动块"), "Restore the selected change block");
  assert.equal(catalog.translate("en", "切换同步滚动"), "Toggle synchronized scrolling");
  assert.equal(catalog.translate("en", "大文件模式"), "Large file mode");
  assert.equal(catalog.translate("en", "已暂存改动块"), "Change block staged");
  assert.equal(catalog.translate("en", "找到 {count} 个匹配", { count: 3 }), "Found 3 matches");
  assert.equal(catalog.translate("en", "已替换 {count} 处", { count: 2 }), "Replaced 2 matches");
  assert.equal(
    catalog.translate("en", "文件不是有效的 UTF-8、GBK 或 GB18030 文本，当前编辑器无法打开。"),
    "This file is not valid UTF-8, GBK, or GB18030 text and cannot be opened in the editor."
  );
});
