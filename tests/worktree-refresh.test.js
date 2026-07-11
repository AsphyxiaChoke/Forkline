"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "features", "diff-workbench.js"), "utf8");

test("worktree signatures include file snapshots", () => {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const first = context.worktreeStateSignature([{ state: "M", file: "note.txt", snapshot: "content-a" }], null);
  const second = context.worktreeStateSignature([{ state: "M", file: "note.txt", snapshot: "content-b" }], null);
  assert.notEqual(first, second);
});

test("worktree polling runs only while the page is visible and focused", () => {
  let focusHandler = null;
  let visibilityHandler = null;
  let intervalHandler = null;
  let intervalMs = 0;
  let focused = false;
  const calls = [];
  const context = vm.createContext({
    __calls: calls,
    window: {
      addEventListener: (name, handler) => {
        if (name === "focus") focusHandler = handler;
      },
    },
    document: {
      hidden: false,
      hasFocus: () => focused,
      addEventListener: (name, handler) => {
        if (name === "visibilitychange") visibilityHandler = handler;
      },
    },
    setInterval: (handler, ms) => {
      intervalHandler = handler;
      intervalMs = ms;
      return 1;
    },
  });
  vm.runInContext(source, context);
  vm.runInContext("refreshWorktree = (silent) => __calls.push(silent)", context);
  context.initWorktreeAutoRefresh();

  assert.equal(intervalMs, 5000);
  assert.ok(focusHandler);
  assert.ok(visibilityHandler);
  assert.ok(intervalHandler);
  intervalHandler();
  assert.deepEqual(calls, []);

  focused = true;
  intervalHandler();
  assert.deepEqual(calls, [true]);

  context.document.hidden = true;
  focusHandler();
  assert.deepEqual(calls, [true]);

  context.document.hidden = false;
  visibilityHandler();
  focusHandler();
  assert.deepEqual(calls, [true, true, true]);
});
