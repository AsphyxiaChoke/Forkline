"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("public/js/features/worktree-refresh.js");
const core = read("public/js/core.js");

function fixture() {
  const commits = [{ sha: "first" }, { sha: "selected" }];
  const calls = [];
  const messages = [];
  const state = {
    data: { repo: { path: "C:/repo", branch: "main" }, commits },
    selectedRef: "main", selectedSha: "selected", filtered: commits,
    historyLimit: 240, historyRequestId: 0, repoDetailRequestId: 0,
    commitDetails: new Map([["selected", {}]]),
  };
  const els = {
    refreshRepository: { disabled: false, textContent: "刷新仓库" },
    historyScroll: { scrollTop: 47 }, searchInput: { value: "my search" },
    commitSummary: { value: "draft" }, commitBody: { value: "body" },
  };
  const context = vm.createContext({
    state, els, rowH: 40, t: (value) => value, toast: (value) => messages.push(value),
    api: async (...args) => { calls.push(args); return context.response; },
    renderAll: () => { state.filtered = state.data.commits; },
    renderCommitViewport: () => {}, loadCommit: async () => {}, renderInspector: () => {},
  });
  vm.runInContext(core.slice(core.indexOf("function repoPathSnapshot()"), core.indexOf("function mergeWorktreeState(")), context);
  vm.runInContext(source, context);
  context.response = {
    repo: { path: "C:/repo", branch: "main", selectedRef: "main", headSha: "new" },
    commits: [{ sha: "new" }, ...commits], workingFiles: [{ file: "external.txt" }],
  };
  return { context, state, els, calls, messages };
}

test("repository refresh is wired to a visible topbar button", () => {
  assert.match(read("public/index.html"), /id="refreshRepository"[^>]*>刷新仓库<\/button>/);
  assert.match(read("public/js/app/events.js"), /els\.refreshRepository\.addEventListener\("click", refreshRepository\)/);
  assert.match(core, /refreshRepository: \$\("#refreshRepository"\)/);
});

test("manual refresh reads local core state once and preserves drafts, search, selection and anchor", async () => {
  const { context, state, els, calls, messages } = fixture();
  await context.refreshRepository();
  assert.deepEqual(calls, [["/api/state?ref=main&details=core&limit=240"]]);
  assert.equal(state.data.repo.headSha, "new");
  assert.equal(state.data.workingFiles[0].file, "external.txt");
  assert.equal(state.selectedSha, "selected");
  assert.equal(els.historyScroll.scrollTop, 87);
  assert.equal(els.commitSummary.value, "draft");
  assert.equal(els.commitBody.value, "body");
  assert.equal(els.searchInput.value, "my search");
  assert.equal(state.commitDetails.size, 0);
  assert.equal(state.historyRequestId, 1);
  assert.deepEqual(messages, ["仓库状态已刷新"]);
  assert.equal(els.refreshRepository.disabled, false);
  assert.equal(els.refreshRepository.textContent, "刷新仓库");
});

test("repeated clicks do not duplicate a pending refresh", async () => {
  const { context, els } = fixture();
  let resolve;
  let requests = 0;
  context.api = () => { requests++; return new Promise((done) => { resolve = done; }); };
  const pending = context.refreshRepository();
  assert.equal(els.refreshRepository.disabled, true);
  assert.equal(els.refreshRepository.textContent, "刷新中…");
  await context.refreshRepository();
  assert.equal(requests, 1);
  resolve(context.response);
  await pending;
  assert.equal(els.refreshRepository.disabled, false);
});

test("refresh failures keep previous data and restore the button", async () => {
  const { context, state, els, messages } = fixture();
  const previous = state.data;
  context.api = async () => { throw new Error("本地服务暂时不可用"); };
  await context.refreshRepository();
  assert.equal(state.data, previous);
  assert.deepEqual(messages, ["本地服务暂时不可用"]);
  assert.equal(els.refreshRepository.disabled, false);
  assert.equal(els.refreshRepository.textContent, "刷新仓库");
});

test("late refresh results cannot replace a switched repository or a newer branch view", async () => {
  for (const change of ["repository", "branch"]) {
    const { context, state, els, messages } = fixture();
    let resolve;
    context.api = () => new Promise((done) => { resolve = done; });
    const pending = context.refreshRepository();
    if (change === "repository") state.data = { repo: { path: "C:/other" } };
    else { context.invalidateStateRefreshes(); state.selectedRef = "feature"; }
    const current = state.data;
    resolve(context.response);
    await pending;
    assert.equal(state.data, current);
    assert.deepEqual(messages, []);
    assert.equal(els.refreshRepository.disabled, false);
  }
});

test("missing selected commits fall back to current history, including an empty repository", async () => {
  for (const commits of [[{ sha: "replacement" }], []]) {
    const { context, state } = fixture();
    context.response.commits = commits;
    context.response.repo.selectedRef = "";
    await context.refreshRepository();
    assert.equal(state.selectedSha, commits[0]?.sha || "");
    assert.equal(state.selectedRef, "");
  }
});

test("manual refresh does not start while the repository is opening", async () => {
  const { context, state, calls } = fixture();
  state.repoHydrating = true;
  await context.refreshRepository();
  assert.deepEqual(calls, []);
});
