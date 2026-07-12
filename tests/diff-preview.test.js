"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "features", "diff-workbench.js"), "utf8");

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

test("commit diff previews cap large diffs at 400 rendered lines", () => {
  const context = createContext();
  const diff = Array.from({ length: 1000 }, (_, index) => ({ type: "ctx", text: `preview-line-${index + 1}` }));

  const html = context.renderDiff(diff);

  assert.equal((html.match(/class="diff-line/g) || []).length, 400);
  assert.match(html, /仅显示前 400 \/ 1000 行/);
  assert.match(html, /preview-line-400/);
  assert.doesNotMatch(html, /preview-line-401/);
});

test("commit diff previews keep small diffs complete", () => {
  const context = createContext();
  const diff = Array.from({ length: 12 }, (_, index) => ({ type: "ctx", text: `small-line-${index + 1}` }));

  const html = context.renderDiff(diff);

  assert.equal((html.match(/class="diff-line/g) || []).length, 12);
  assert.doesNotMatch(html, /仅显示前/);
  assert.match(html, /small-line-12/);
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
