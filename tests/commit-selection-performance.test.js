"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const historySource = fs.readFileSync(path.join(root, "public", "js", "features", "history-list.js"), "utf8");
const gitActionsSource = fs.readFileSync(path.join(root, "public", "js", "features", "git-actions.js"), "utf8");
const contextMenuSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const graphSource = fs.readFileSync(path.join(root, "public", "js", "features", "graph.js"), "utf8");
const diffWorkbenchSource = fs.readFileSync(path.join(root, "public", "js", "features", "file-tree.js"), "utf8");

test("commit rows use container event delegation instead of per-row listeners", () => {
  assert.doesNotMatch(historySource, /row\.addEventListener\("(?:click|contextmenu)"/);
  assert.match(eventsSource, /els\.commitGraph\.addEventListener\("click"[\s\S]*?\.commit-row\[data-sha\]/);
  assert.match(eventsSource, /els\.commitGraph\.addEventListener\("contextmenu"[\s\S]*?showCommitContextMenu/);
});

test("ordinary commit selection skips the full diff while sync preview requests it on demand", () => {
  assert.match(graphSource, /const includeDiff = Boolean\(options\.includeDiff\)/);
  assert.match(graphSource, /api\(`\/api\/commit\?sha=.*?\$\{includeDiff \? "&diff=1" : ""\}`\)/s);
  assert.match(diffWorkbenchSource, /loadCommit\(sha, \{ includeDiff: true \}\)/);
});

test("history load-more uses the lightweight ref endpoint and preserves scroll position", () => {
  assert.match(eventsSource, /data-load-more-commits[\s\S]*?loadMoreCommits/);
  assert.match(historySource, /api\(`\/api\/ref-state\?ref=.*?&limit=\$\{nextLimit\}`\)/s);
  assert.match(historySource, /const scrollTop = els\.historyScroll\?\.scrollTop \|\| 0/);
  assert.match(historySource, /els\.historyScroll\.scrollTop = scrollTop/);
  assert.match(historySource, /data-load-more-commits/);
});

test("history load-more discards a response after the selected ref changes", async () => {
  let resolveRequest;
  let renderCount = 0;
  const state = {
    data: {
      repo: { path: "C:/repo", selectedRef: "main" },
      commits: [{ sha: "main-new" }],
      history: { limit: 120, pageSize: 120, maxLimit: 5000 },
    },
    selectedRef: "main",
    historyLimit: 120,
    historyHasMore: true,
    historyLoading: false,
    historyRequestId: 0,
  };
  const context = vm.createContext({
    state,
    els: { historyScroll: { scrollTop: 240 } },
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => repoPath === state.data.repo.path,
    api: () => new Promise((resolve) => { resolveRequest = resolve; }),
    applyHistoryState: () => {},
    renderCommits: () => { renderCount += 1; },
    toast: () => {},
    t: (value) => value,
    window: { requestAnimationFrame: (callback) => callback() },
  });
  vm.runInContext(historySource, context);
  context.renderCommits = () => { renderCount += 1; };

  const pending = context.loadMoreCommits({ disabled: false, textContent: "" });
  state.selectedRef = "feature";
  state.historyRequestId += 1;
  state.historyLoading = false;
  state.data.commits = [{ sha: "feature-current" }];
  resolveRequest({
    repo: { selectedRef: "main" },
    commits: [{ sha: "main-old" }],
    history: { limit: 240, pageSize: 120, maxLimit: 5000, hasMore: false },
  });
  await pending;

  assert.equal(state.data.commits[0].sha, "feature-current");
  assert.equal(renderCount, 0);
});

test("rapid ref selection keeps the newest response", async () => {
  const requests = new Map();
  const state = {
    data: { repo: { path: "C:/repo", selectedRef: "" }, commits: [] },
    selectedRef: "",
    selectedSha: "",
    selectedTab: "details",
    historyLoading: false,
    historyRequestId: 0,
    refRequestId: 0,
    commitDetails: new Map(),
  };
  const context = vm.createContext({
    state,
    els: { searchInput: { value: "" } },
    api: (url) => new Promise((resolve) => { requests.set(url, resolve); }),
    repoPathSnapshot: () => state.data.repo.path,
    isCurrentRepoPath: (repoPath) => repoPath === state.data.repo.path,
    setInspectorContext: () => {},
    renderAll: () => {},
    renderCommits: () => {},
    renderSelectedCommitForRepoPath: async () => {},
    toast: () => {},
    t: (value) => value,
  });
  vm.runInContext(gitActionsSource, context);

  const first = context.selectRef("main");
  const second = context.selectRef("feature");
  requests.get("/api/ref-state?ref=feature")({
    repo: { selectedRef: "feature" },
    commits: [{ sha: "feature-new" }],
  });
  await second;
  requests.get("/api/ref-state?ref=main")({
    repo: { selectedRef: "main" },
    commits: [{ sha: "main-old" }],
  });
  await first;

  assert.equal(state.selectedRef, "feature");
  assert.equal(state.data.commits[0].sha, "feature-new");
});

test("selecting a visible commit updates the selected row without rebuilding the graph", async () => {
  const first = commitRow("a".repeat(40), true);
  const second = commitRow("b".repeat(40), false);
  const rows = [first, second];
  let renderCommitsCount = 0;
  let loadCommitSha = "";
  let inspectorRenderCount = 0;
  const state = {
    historyPlan: null,
    selectedTab: "details",
    selectedSha: first.sha,
  };
  const context = vm.createContext({
    state,
    inspectorTabs: { commit: ["details", "files", "tags"] },
    els: {
      commitGraph: {
        querySelector: (selector) => {
          if (selector === ".commit-row.selected") return rows.find((row) => row.classList.contains("selected")) || null;
          const match = selector.match(/^\.commit-row\[data-sha="([0-9a-f]+)"\]$/);
          return match ? rows.find((row) => row.sha === match[1]) || null : null;
        },
      },
    },
    setInspectorContext: () => {},
    renderCommits: () => { renderCommitsCount += 1; },
    loadCommit: async (sha) => { loadCommitSha = sha; },
    renderInspector: () => { inspectorRenderCount += 1; },
  });
  vm.runInContext(historySource, context);
  vm.runInContext(contextMenuSource, context);
  context.renderCommits = () => { renderCommitsCount += 1; };

  await context.selectCommit(second.sha);

  assert.equal(renderCommitsCount, 0);
  assert.equal(first.classList.contains("selected"), false);
  assert.equal(second.classList.contains("selected"), true);
  assert.equal(state.selectedSha, second.sha);
  assert.equal(loadCommitSha, second.sha);
  assert.equal(inspectorRenderCount, 1);
});

test("selecting a commit outside the rendered graph keeps the full render fallback", async () => {
  const first = commitRow("a".repeat(40), true);
  let renderCommitsCount = 0;
  const state = {
    historyPlan: null,
    selectedTab: "details",
    selectedSha: first.sha,
  };
  const context = vm.createContext({
    state,
    inspectorTabs: { commit: ["details", "files", "tags"] },
    els: {
      commitGraph: {
        querySelector: (selector) => selector === ".commit-row.selected" ? first : null,
      },
    },
    setInspectorContext: () => {},
    renderCommits: () => { renderCommitsCount += 1; },
    loadCommit: async () => {},
    renderInspector: () => {},
  });
  vm.runInContext(historySource, context);
  vm.runInContext(contextMenuSource, context);
  context.renderCommits = () => { renderCommitsCount += 1; };

  await context.selectCommit("c".repeat(40));

  assert.equal(renderCommitsCount, 1);
});

function commitRow(sha, selected) {
  const classes = new Set(selected ? ["selected"] : []);
  return {
    sha,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
  };
}
