"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const core = fs.readFileSync(path.join(root, "public", "js", "core.js"), "utf8");
const events = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const contextMenus = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const repositories = fs.readFileSync(path.join(root, "public", "js", "features", "repositories.js"), "utf8");
const editor = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const catalog = require(path.join(root, "public", "js", "i18n-catalog.js"));

test("file editor is available from the worktree toolbar and file context menu", () => {
  assert.match(html, /id="editWorktreeFile"/);
  assert.match(html, /data-file-action="edit"/);
  assert.match(html, /id="fileEditorModal"/);
  assert.match(html, /id="fileEditorText"[^>]*wrap="off"/);
  assert.match(html, /js\/features\/file-editor\.js/);
  assert.match(contextMenus, /action === "edit"/);
  assert.match(contextMenus, /previousFile: fileInfo\.previousFile/);
  assert.match(contextMenus, /openFileEditor\(context\.file, context\.previousFile/);
});

test("file editor loads local CodeMirror MergeView with line numbers and syntax modes", () => {
  assert.equal(fs.existsSync(path.join(root, "public", "vendor", "codemirror", "lib", "codemirror.js")), true);
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
  assert.match(editor, /revertButtons: true/);
  assert.match(editor, /"Revert chunk": t\("用旧版本还原此变更块"\)/);
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

test("file editor uses the available viewport for side-by-side files", () => {
  assert.match(styles, /\.file-editor-modal\s*\{[^}]*padding:\s*12px/s);
  assert.match(
    styles,
    /\.file-editor-dialog\s*\{[^}]*width:\s*min\(1920px, calc\(100vw - 24px\)\)[^}]*height:\s*min\(1200px, calc\(100vh - 24px\)\)/s
  );
  assert.doesNotMatch(styles, /\.file-editor-dialog\s*\{[^}]*width:\s*min\(1440px/s);
  assert.doesNotMatch(styles, /\.file-editor-dialog\s*\{[^}]*height:\s*min\(860px/s);
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

test("file editor exposes Chinese encoding and comparison messages in English mode", () => {
  assert.equal(catalog.translate("en", "查找替换"), "Find and replace");
  assert.equal(catalog.translate("en", "拖动调整窗口大小"), "Drag to resize the window");
  assert.equal(catalog.translate("en", "HEAD 中不存在"), "Not present in HEAD");
  assert.equal(catalog.translate("en", "用旧版本还原此变更块"), "Restore this change block from the old version");
  assert.equal(catalog.translate("en", "切换同步滚动"), "Toggle synchronized scrolling");
  assert.equal(catalog.translate("en", "找到 {count} 个匹配", { count: 3 }), "Found 3 matches");
  assert.equal(catalog.translate("en", "已替换 {count} 处", { count: 2 }), "Replaced 2 matches");
  assert.equal(
    catalog.translate("en", "文件不是有效的 UTF-8、GBK 或 GB18030 文本，当前编辑器无法打开。"),
    "This file is not valid UTF-8, GBK, or GB18030 text and cannot be opened in the editor."
  );
});
