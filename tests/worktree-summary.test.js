"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const catalog = require("../public/js/i18n-catalog.js");
const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "features", "worktree-changes.js"), "utf8");

function createContext(locale) {
  const context = vm.createContext({
    t: (value, params) => catalog.translate(locale, value, params),
  });
  vm.runInContext(source, context);
  return context;
}

test("worktree summary hides zero counts", () => {
  const context = createContext("zh-CN");
  const summary = context.worktreeDraftSummary(
    { unstaged: [{}], staged: [] },
    { C: 0, M: 0, A: 0, D: 1, R: 0 }
  );

  assert.equal(summary, "1 个未暂存 · 1 个删除");
});

test("worktree summary keeps nonzero English counts and filter text", () => {
  const context = createContext("en");
  const summary = context.worktreeDraftSummary(
    { unstaged: [], staged: [{}, {}] },
    { C: 0, M: 1, A: 0, D: 0, R: 0 },
    " · Filtered 2/3"
  );

  assert.equal(summary, "2 staged · 1 modified · Filtered 2/3");
});
