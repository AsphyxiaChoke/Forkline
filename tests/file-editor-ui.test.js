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
  assert.match(editor, /stageFileEditorSelectedLines/);
  assert.match(editor, /discardFileEditorSelectedHunk/);
  assert.match(editor, /createFileEditorInstance\(editor\);\s*setFileEditorControlsDisabled\(false\);/);
  assert.match(editor, /currentBranchSnapshotPayload\(\)/);
  assert.match(editor, /fileSnapshotPayload\(editor\.file, editor\.diffScope\)/);
  assert.match(editor, /button\.textContent = t\("暂存"\)/);
  assert.match(styles, /\.file-editor-merge \.CodeMirror-merge-copy\s*\{[^}]*font-size:\s*11px/s);
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
  assert.equal(sandbox.fileEditorHunkForEditRange({ diff }, 1, 2), 0);
  assert.equal(sandbox.fileEditorHunkForEditRange({ diff }, 20, 21), 1);
  assert.equal(sandbox.fileEditorHunkForEditRange({ diff }, 10, 11), undefined);
});

test("saving keeps the floating editor open and reloads its comparison", () => {
  const submitEditor = editor.match(/async function submitFileEditor[\s\S]*?\n}\n\nfunction closeFileEditor/)?.[0] || "";
  assert.match(editor, /await refreshWorktree\(true\)/);
  assert.match(editor, /await openFileEditor\(file, previousFile, \{ force: true, reload: true \}\)/);
  assert.doesNotMatch(submitEditor, /state\.selectedChanges\.add[\s\S]{0,240}closeFileEditor\(true\)/);
});

test("file editor exposes Chinese encoding and comparison messages in English mode", () => {
  assert.equal(catalog.translate("en", "查找替换"), "Find and replace");
  assert.equal(catalog.translate("en", "拖动调整窗口大小"), "Drag to resize the window");
  assert.equal(catalog.translate("en", "暂存区中不存在"), "Not present in the index");
  assert.equal(catalog.translate("en", "暂存此改动块"), "Stage this change block");
  assert.equal(catalog.translate("en", "还原所选改动块"), "Restore the selected change block");
  assert.equal(catalog.translate("en", "切换同步滚动"), "Toggle synchronized scrolling");
  assert.equal(catalog.translate("en", "找到 {count} 个匹配", { count: 3 }), "Found 3 matches");
  assert.equal(catalog.translate("en", "已替换 {count} 处", { count: 2 }), "Replaced 2 matches");
  assert.equal(
    catalog.translate("en", "文件不是有效的 UTF-8、GBK 或 GB18030 文本，当前编辑器无法打开。"),
    "This file is not valid UTF-8, GBK, or GB18030 text and cannot be opened in the editor."
  );
});
