"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const fileTreeSource = fs.readFileSync(path.join(root, "public", "js", "features", "file-tree.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "settings.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "settings.css"), "utf8");

test("Ctrl/Cmd+A selects the current filtered worktree or staged range and leaves text inputs native", () => {
  const files = [
    { file: "src/a.js", unstaged: true, staged: false },
    { file: "src/b.js", unstaged: true, staged: false },
    { file: "docs/c.md", unstaged: false, staged: true },
  ];
  const selectedChanges = new Set(["staged:old.txt"]);
  const sandbox = {
    state: { data: { workingFiles: files }, selectedChanges, worktreeFilter: "" },
    els: {
      changeList: { querySelectorAll: () => [] },
      stagedChangeList: { querySelectorAll: () => [] },
    },
    changeGroups: (items) => ({
      unstaged: items.filter((file) => file.unstaged),
      staged: items.filter((file) => file.staged),
    }),
    filterWorkingFiles: (items) => items,
    changeKey: (scope, file) => `${scope}:${file}`,
    t: (value) => value,
  };
  vm.runInNewContext(fileTreeSource, sandbox);

  const list = { id: "changeList" };
  const rowTarget = { closest: (selector) => selector.includes("#changeList") ? list : null };
  const inputTarget = { closest: (selector) => selector.includes("input") ? {} : list };
  const selectEvent = { target: rowTarget, key: "a", ctrlKey: true, metaKey: false };

  assert.equal(sandbox.handleWorkspaceSelectionShortcut(selectEvent), true);
  assert.deepEqual([...selectedChanges].sort(), ["staged:old.txt", "unstaged:src/a.js", "unstaged:src/b.js"]);
  assert.equal(sandbox.handleWorkspaceSelectionShortcut({ ...selectEvent, target: inputTarget }), false);
});

test("shortcut bindings keep native text editing and reset the more selector", () => {
  assert.match(eventsSource, /handleWorkspaceSelectionShortcut\(event\)/);
  assert.match(eventsSource, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(eventsSource, /event\.key === "Escape"/);
  assert.match(eventsSource, /handleWorkspaceSelectionShortcut\(event\)/);
  assert.match(settingsSource, /settings-shortcuts/);
  assert.match(styles, /\.settings-shortcuts\s*\{/);
});
