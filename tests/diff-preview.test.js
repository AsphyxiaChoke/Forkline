"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "features", "diff-renderer.js"), "utf8");
const inspectorSource = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "panels", "inspector.js"), "utf8");

function createContext() {
  const context = vm.createContext({
    escapeHtml: (value) => String(value ?? ""),
    t: (value, params) => String(value).replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => (
      Object.hasOwn(params || {}, key) ? String(params[key]) : match
    )),
  });
  vm.runInContext(source, context);
  return context;
}

test("commit details omit the aggregate diff preview", () => {
  assert.doesNotMatch(inspectorSource, /renderDiff\(detail\.diff\)/);
  assert.doesNotMatch(inspectorSource, /DIFF 预览/);
});

test("commit files use the full-height file list without an inline diff", () => {
  assert.match(inspectorSource, /commit-file-tree commit-file-list-only/);
  assert.doesNotMatch(inspectorSource, /renderSideDiff\(selectedDiff/);
  assert.doesNotMatch(inspectorSource, /data-open-diff-modal/);
});

test("side-by-side diffs reserve horizontal space for long code lines", () => {
  const context = createContext();
  const widths = context.diffColumnCharacterWidths([
    { type: "ctx", text: ` ${"a".repeat(80)}` },
    { type: "add", text: `+${"中".repeat(60)}` },
    { type: "del", text: `-${"b".repeat(100)}` },
  ]);

  assert.equal(widths.old, 100);
  assert.equal(widths.new, 120);
});
