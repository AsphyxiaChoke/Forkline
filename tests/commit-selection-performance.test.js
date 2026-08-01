"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const historySource = fs.readFileSync(path.join(root, "public", "js", "features", "history-list.js"), "utf8");
const contextMenuSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");

test("commit rows use container event delegation instead of per-row listeners", () => {
  assert.doesNotMatch(historySource, /row\.addEventListener\("(?:click|contextmenu)"/);
  assert.match(eventsSource, /els\.commitGraph\.addEventListener\("click"[\s\S]*?\.commit-row\[data-sha\]/);
  assert.match(eventsSource, /els\.commitGraph\.addEventListener\("contextmenu"[\s\S]*?showCommitContextMenu/);
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
