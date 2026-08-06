"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "panels", "recovery.js"), "utf8");

test("lazy reflog loading discards a response after the repository changes", async () => {
  let resolveRequest;
  let renderCount = 0;
  const response = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const state = {
    data: { repo: { path: "C:/repo-a", branch: "main", headSha: "aaaa", isSample: false } },
    selectedTab: "recovery",
    reflog: { key: "", entries: null, loading: false, error: "", inline: false },
    reflogRequestId: 0,
  };
  const context = vm.createContext({
    state,
    api: async (pathname) => {
      assert.equal(pathname, "/api/reflog");
      return response;
    },
    repoPathSnapshot: () => state.data?.repo?.path || "",
    isCurrentRepoPath: (repoPath) => (state.data?.repo?.path || "") === repoPath,
    renderInspector: () => {
      renderCount += 1;
    },
  });
  vm.runInContext(source, context);

  const pending = context.loadReflogEntries();
  assert.equal(state.reflog.loading, true);
  state.data = { repo: { path: "C:/repo-b", branch: "dev", headSha: "bbbb", isSample: false } };
  state.reflogRequestId += 1;
  state.reflog = { key: "", entries: null, loading: false, error: "", inline: false };
  resolveRequest({ reflogEntries: [{ selector: "HEAD@{0}", sha: "aaaa" }] });
  await pending;

  assert.equal(state.reflog.entries, null);
  assert.equal(state.reflog.loading, false);
  assert.equal(renderCount, 0);
});

test("lazy reflog loading stores current results and rerenders only the recovery tab", async () => {
  let renderCount = 0;
  const entries = [{ selector: "HEAD@{0}", sha: "cccc" }];
  const state = {
    data: { repo: { path: "C:/repo-c", branch: "main", headSha: "cccc", isSample: false } },
    selectedTab: "recovery",
    reflog: { key: "", entries: null, loading: false, error: "", inline: false },
    reflogRequestId: 0,
  };
  const context = vm.createContext({
    state,
    api: async () => ({ reflogEntries: entries }),
    repoPathSnapshot: () => state.data?.repo?.path || "",
    isCurrentRepoPath: (repoPath) => (state.data?.repo?.path || "") === repoPath,
    renderInspector: () => {
      renderCount += 1;
    },
  });
  vm.runInContext(source, context);

  await context.loadReflogEntries();
  assert.deepEqual(state.reflog.entries, entries);
  assert.equal(state.reflog.loading, false);
  assert.equal(state.reflog.error, "");
  assert.equal(renderCount, 1);
});
