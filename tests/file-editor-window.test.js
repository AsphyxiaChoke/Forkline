"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  fileEditorWindowUrl,
  normalizeFileEditorRequest,
  readFileEditorWindowContext,
} = require("../electron/file-editor-window");

test("file editor window context accepts only bounded worktree and commit requests", () => {
  assert.deepEqual(normalizeFileEditorRequest({
    file: "src/main.c",
    previousFile: "src/old-main.c",
    source: "worktree",
    commit: "",
  }), {
    file: "src/main.c",
    previousFile: "src/old-main.c",
    source: "worktree",
    commit: "",
  });
  assert.deepEqual(normalizeFileEditorRequest({
    file: "src/main.c",
    source: "commit",
    commit: "0123456789abcdef0123456789abcdef01234567",
  })?.source, "commit");
  assert.equal(normalizeFileEditorRequest({ file: "src/main.c", source: "unknown" }), null);
  assert.equal(normalizeFileEditorRequest({ file: "src/main.c", source: "commit", commit: "not-a-sha" }), null);
  assert.equal(normalizeFileEditorRequest({ file: `x${"a".repeat(4096)}`, source: "worktree" }), null);
});

test("file editor window context round-trips through an encoded internal URL", () => {
  const request = {
    file: "目录/配置 文件.txt",
    previousFile: "旧目录/配置 文件.txt",
    source: "worktree",
    commit: "",
  };
  const url = fileEditorWindowUrl("http://127.0.0.1:63247", request);
  assert.match(url, /^http:\/\/127\.0\.0\.1:63247\/\?fileEditorWindow=1&/);
  assert.deepEqual(readFileEditorWindowContext(new URL(url).search), request);
});
