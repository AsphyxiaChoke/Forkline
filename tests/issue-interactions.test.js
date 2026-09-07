"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = (file) => fs.readFileSync(path.resolve(__dirname, "../public/js", file), "utf8");
const load = (file, bindings) => { const context = vm.createContext(bindings); vm.runInContext(source(file), context); return context; };

test("Ctrl toggles commits, Shift ranges loaded history and context changes clear the selection", () => {
  const commits = ["a", "b", "c", "d"].map((sha) => ({ sha }));
  const state = { filtered: commits, selectedSha: "a", selectedRef: "main", selectedCommitShas: new Set() };
  const c = load("features/history-list.js", { state, repoPathSnapshot: () => "C:/repo" });
  c.reconcileCommitSelection([]);
  c.changeCommitSelection("b", { ctrlKey: true });
  assert.deepEqual([...state.selectedCommitShas], ["a", "b"]);
  c.changeCommitSelection("d", { shiftKey: true });
  assert.deepEqual([...state.selectedCommitShas], ["b", "c", "d"]);
  c.changeCommitSelection("c", { ctrlKey: true });
  assert.deepEqual([...state.selectedCommitShas], ["b", "d"]);
  c.changeCommitSelection("b");
  assert.deepEqual([...state.selectedCommitShas], ["b"]);
  c.changeCommitSelection("b", { ctrlKey: true });
  assert.equal(state.selectedSha, "");
  assert.equal(state.selectedCommitShas.size, 0);
  c.changeCommitSelection("a");
  c.changeCommitSelection("d", { shiftKey: true });
  c.reconcileCommitSelection([]);
  assert.equal(state.selectedCommitShas.size, 4);
  state.selectedRef = "feature";
  c.reconcileCommitSelection([]);
  assert.equal(state.selectedCommitShas.size, 0);
  c.changeCommitSelection("a");
  c.changeCommitSelection("b", { ctrlKey: true });
  c.reconcileCommitSelection(["search"]);
  assert.equal(state.selectedCommitShas.size, 0);
});

test("history rewrite and removed commits cannot leave stale multi-selection targets", () => {
  const state = { filtered: ["a", "b", "c"].map((sha) => ({ sha })), selectedSha: "a", selectedRef: "main" };
  const c = load("features/history-list.js", { state, repoPathSnapshot: () => "C:/repo" });
  c.reconcileCommitSelection([]);
  c.changeCommitSelection("c", { shiftKey: true });
  state.filtered = [{ sha: "a" }, { sha: "b" }];
  c.reconcileCommitSelection([]);
  assert.equal(state.selectedSha, "a");
  assert.deepEqual([...state.selectedCommitShas], ["a", "b"]);
  state.selectedSha = "rewritten";
  c.reconcileCommitSelection([]);
  assert.equal(state.selectedCommitShas.size, 0);
});

test("identical file names in different selected commits highlight only the clicked group", () => {
  const selected = new Map();
  const rows = ["a", "b"].map((sha) => ({ dataset: { file: "src/file.c" }, closest: () => ({ dataset: { commitGroup: sha } }), classList: { toggle: (_class, value) => selected.set(sha, value) } }));
  const state = { selectedSha: "a", selectedCommitFile: "" };
  const c = load("features/file-tree.js", { state, els: { detailBody: { querySelectorAll: () => rows } } });
  c.selectCommitFile("src/file.c", "b");
  assert.equal(selected.get("a"), false);
  assert.equal(selected.get("b"), true);
});

test("multiple expanded groups await one pending commit read", async () => {
  let resolveRequest;
  let requests = 0;
  const state = { data: { commits: [] }, commitDetails: new Map(), loadingCommitDetails: new Set() };
  const c = load("features/graph.js", { state, repoPathSnapshot: () => "repo", isCurrentRepoPath: () => true, api: () => { requests++; return new Promise((resolve) => { resolveRequest = resolve; }); }, toast: () => {} });
  const first = c.loadCommit("a");
  const second = c.loadCommit("a");
  let secondDone = false;
  second.then(() => { secondDone = true; });
  await Promise.resolve();
  assert.equal(secondDone, false);
  resolveRequest({ files: [{ file: "src/file.c" }] });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, b);
  assert.equal(requests, 1);
  assert.equal(state.loadingCommitDetails.size, 0);
});

test("message column can shrink to 80px or expand beyond the viewport without changing neighbours", () => {
  const values = new Map();
  const c = load("app/layout-utils.js", { document: { documentElement: { style: { setProperty: (name, value) => values.set(name, value) } } } });
  c.resizeHistoryBoundary("message", "author", 300, 104, -999);
  assert.equal(values.get("--history-message-w"), "80px");
  c.resizeHistoryBoundary("message", "author", 300, 104, 2000);
  assert.equal(values.get("--history-message-w"), "2300px");
  assert.equal(values.has("--history-author-w"), false);
});

test("folder menus snapshot descendant paths and dispatch batch actions after closing", async () => {
  const files = [{ file: "src/a.c" }, { file: "src/sub/b.c" }, { file: "src2/outside.c" }];
  const state = { data: { workingFiles: files }, selectedChanges: new Set() };
  const buttons = ["stageFile", "unstageFile", "discardWorktreeFile", "discardStagedFile", "stash", "edit", "blame"].map((fileAction) => ({ dataset: { fileAction } }));
  let batch;
  const c = load("features/context-menus.js", {
    state, els: { fileContextMenu: { querySelectorAll: () => buttons, classList: { add: () => {} }, setAttribute: () => {} } },
    hideCommitContextMenu: () => {}, hideBranchContextMenu: () => {}, hideTagContextMenu: () => {}, hideRemoteContextMenu: () => {}, hideReflogContextMenu: () => {},
    hideFileContextMenu: () => { state.contextFile = null; }, filterWorkingFiles: (value) => value,
    changeGroups: (value) => ({ unstaged: value, staged: value }), treeFileIsInFolder: (file, folder) => file.startsWith(`${folder}/`),
    changeKey: (scope, file) => `${scope}:${file}`, selectedFilesInScope: (scope, value) => value.filter((file) => state.selectedChanges.has(`${scope}:${file.file}`)),
    refreshChangeSelectionUi: () => {}, positionContextMenu: () => {}, runFileBatchAction: async (...args) => { batch = args; },
  });
  c.showFileContextMenu({}, "src", "unstaged", true);
  assert.deepEqual([...state.selectedChanges], ["unstaged:src/a.c", "unstaged:src/sub/b.c"]);
  assert.equal(buttons.find((button) => button.dataset.fileAction === "edit").hidden, true);
  assert.equal(buttons.find((button) => button.dataset.fileAction === "unstageFile").hidden, true);
  state.selectedChanges.clear();
  await c.runFileContextAction("stageFile");
  assert.equal(batch[0], "stageFile");
  assert.deepEqual([...batch[3]], ["src/a.c", "src/sub/b.c"]);
  c.showFileContextMenu({}, "src", "staged", true);
  assert.equal(buttons.find((button) => button.dataset.fileAction === "unstageFile").hidden, false);
  assert.equal(buttons.find((button) => button.dataset.fileAction === "stageFile").hidden, true);
});

test("desktop status shows repository, branch, changes and a running operation", () => {
  const element = {};
  const state = { data: { repo: { name: "repo", branch: "main", path: "C:/repo" }, workingFiles: [{}], runningOperations: [{ label: "正在拉取" }] } };
  const c = load("app/layout-utils.js", { state, document: { getElementById: () => element }, t: (text, values) => text.replace("{count}", values?.count) });
  c.renderDesktopStatus();
  assert.match(element.textContent, /repo · main.*1 个更改.*正在拉取/);
  state.data.runningOperations = [];
  c.renderDesktopStatus();
  assert.match(element.textContent, /就绪$/);
});
