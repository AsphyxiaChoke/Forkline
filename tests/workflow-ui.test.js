"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, "public/js", file), "utf8");
const translate = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
function load(file, bindings = {}) {
  const context = vm.createContext({ t: translate, ...bindings });
  vm.runInContext(source(file), context);
  return context;
}

test("global file actions identify their full scope; selected actions count unrendered files", () => {
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  assert.match(html, /id="stageAll"[^>]*>暂存全部</);
  assert.match(html, /id="discardAll"[^>]*>丢弃全部更改</);
  const files = Array.from({ length: 805 }, (_, index) => ({ file: `folder/${index}.txt`, unstaged: true }));
  const c = load("features/worktree-changes.js", {
    state: { selectedChanges: new Set(files.map(file => `unstaged:${file.file}`)) },
    changeKey: (scope, file) => `${scope}:${file}`,
    escapeAttr: value => value, escapeHtml: value => value,
    fileTreeHtml: () => "",
  });
  const rendered = c.renderChangeSection("unstaged", "未暂存", files, [{ action: "stageFile", bulkLabel: "暂存所选" }]);
  assert.match(rendered, /暂存所选 \(805\)/);
  assert.match(rendered, /data-scope="unstaged"/);
  assert.equal(c.selectedFilesInScope("staged", files).length, 0);
});


function commitModeHarness() {
  const els = { amendToggle: { checked: false }, commitPushToggle: { checked: true }, commitSummary: { value: 'new draft' }, commitBody: { value: 'new body' }, commitSubmit: {} };
  const state = { data: { repo: { headSha: 'head', path: 'repo' }, sync: {} } };
  const c = load('features/git-actions-loader.js', { els, state, repoPathSnapshot: () => state.data.repo.path });
  c.fillLatestCommitMessage = async () => { els.commitSummary.value = 'last commit'; els.commitBody.value = 'last body'; };
  return { c, els, state };
}

test('normal and amend drafts survive repeated switches and restore the push choice', async () => {
  const { c, els, state } = commitModeHarness();
  els.amendToggle.checked = true; await c.changeCommitMode();
  assert.equal(els.commitSummary.value, 'last commit');
  els.commitSummary.value = 'edited last';
  els.amendToggle.checked = false; await c.changeCommitMode();
  assert.equal(els.commitSummary.value, 'new draft');
  assert.equal(els.commitBody.value, 'new body');
  assert.equal(els.commitPushToggle.checked, true);
  els.amendToggle.checked = true; await c.changeCommitMode();
  assert.equal(els.commitSummary.value, 'edited last');
  els.amendToggle.checked = false; await c.changeCommitMode();
  state.data.repo.headSha = 'new head';
  els.amendToggle.checked = true; await c.changeCommitMode();
  assert.equal(els.commitSummary.value, 'last commit');
});

test('late amend message cannot replace a restored or newly typed draft', async () => {
  for (const change of ['switch', 'type']) {
    const { c, els, state } = commitModeHarness();
    let resolve;
    const implementation = load('features/git-actions.js', {
      state, els, repoPathSnapshot: () => 'repo', isCurrentRepoPath: () => true,
      api: () => new Promise(done => { resolve = done; }),
      commitMessageParts: () => ({ summary: 'late', body: 'late body' }), toast: () => {},
    });
    c.fillLatestCommitMessage = implementation.fillLatestCommitMessage;
    els.amendToggle.checked = true;
    const pending = c.changeCommitMode();
    if (change === 'switch') { els.amendToggle.checked = false; await c.changeCommitMode(); }
    else els.commitSummary.value = 'typed while loading';
    resolve({}); await pending;
    assert.equal(els.commitSummary.value, change === 'switch' ? 'new draft' : 'typed while loading');
  }
});


test('commit target follows the working branch while the history can view another branch', () => {
  const state = { data: { repo: { branch: 'main' } }, selectedRef: 'feature' };
  const els = { commitTarget: {} };
  const c = load('features/worktree-changes.js', { state, els });
  c.renderCommitTarget();
  assert.equal(els.commitTarget.textContent, '提交到：main · 正在查看：feature');
  state.selectedRef = 'main'; c.renderCommitTarget();
  assert.equal(els.commitTarget.textContent, '提交到：main');
  state.data.repo.branch = 'detached HEAD'; state.selectedRef = ''; c.renderCommitTarget();
  assert.match(els.commitTarget.textContent, /分离的 HEAD/);
});


test('history search states its loaded scope and offers another page without clearing the query', async () => {
  let markup = '', requested = '';
  const els = { searchInput: { value: 'old change', closest: () => null }, searchCount: {}, clearSearch: {}, historyScroll: { scrollTop: 0 }, commitGraph: { insertAdjacentHTML: (_, value) => { markup = value; } } };
  const state = { data: { repo: {}, commits: Array.from({length:120},()=>({})), history: { pageSize:120, maxLimit:5000 } }, historyLimit:120, historyHasMore:true, historyRequestId:0, selectedRef:'main' };
  const c = load('features/history-list.js', {
    state, els, rowH:40, escapeHtml:value=>value,
    repoPathSnapshot:()=> 'repo', isCurrentRepoPath:()=>true,
    api:async url=> { requested=url; return {commits:Array.from({length:240},()=>({})),history:{limit:240,hasMore:true}}; },
    applyHistoryState:()=>{state.historyLoading=false;}, window:{requestAnimationFrame:fn=>fn()},
  });
  c.commitSearchTerms = () => els.searchInput.value.split(' ');
  c.renderCommits = () => {};
  c.updateCommitSearchMeta(['old'],0,120);
  assert.match(els.searchCount.textContent,/0 \/ 已加载 120/);
  c.appendHistoryLoadMore(40);
  assert.match(markup,/继续搜索更早历史/);
  await c.loadMoreCommits({});
  assert.match(requested,/ref=main&limit=240/);
  assert.equal(els.searchInput.value,'old change');
  state.historyHasMore=false; markup=''; c.appendHistoryLoadMore(40);
  assert.equal(markup,'');
});


function actionHarness() {
  const commits = ['head', 'viewed', 'tail'].map(sha => ({ sha }));
  const state = { data: { repo: { path: 'repo', branch: 'main', headSha: 'head' }, workingFiles: [], commits }, selectedRef: 'main', selectedSha: 'viewed', filtered: commits, historyLimit: 240, commitDetails: new Map() };
  const calls = [], confirmations = [], errors = [];
  const els = { searchInput: { value: 'old search' }, commitSummary: { value: 'summary' }, commitBody: { value: 'body' }, commitPushToggle: { checked: false }, historyScroll: { scrollTop: 47 } };
  const c = load('features/git-actions.js', { state, els, rowH:40,
    confirm: message => { confirmations.push(message); return true; },
    repoPathSnapshot: () => 'repo', isCurrentRepoPath: () => true,
    api: async (url, options) => { calls.push({url,body:JSON.parse(options?.body || '{}')}); return {}; },
    loadStateForRepoPath: async (...args) => { calls.push({refresh:args}); return { repo: { path:'repo',branch:'main',selectedRef:'main' },commits:[{sha:'new'},...commits] }; },
    renderAll: () => { state.filtered=state.data.commits; },
    loadCommit: async()=>{}, renderInspector:()=>{}, reportDesktopRecoveryState:()=>{},
    toast: message=>errors.push(message),
  });
  c.currentBranchSnapshotPayload=()=>({expectedBranch:'main'});
  c.allRemoteConfigSnapshotPayload=()=>({});
  return {c,state,els,calls,confirmations,errors};
}

test('fetch preserves selected history and its pixel offset when a newer commit is inserted', async () => {
  const {c,state,els,calls,errors}=actionHarness();
  assert.equal(await c.runAction('fetch'),true,errors.join(';'));
  assert.equal(state.selectedSha,'viewed');
  assert.equal(els.historyScroll.scrollTop,87);
  assert.deepEqual([...calls.find(call=>call.refresh).refresh],['repo','main',240]);
});

test('creating a commit still selects the new head; removed history gets a valid fallback', async () => {
  const created=actionHarness();
  created.state.selectedRef='other-branch';
  await created.c.runAction('commit');
  assert.equal(created.state.selectedSha,'new');
  assert.equal(created.els.commitSummary.value,'');
  assert.equal(created.els.searchInput.value,'');
  assert.equal(created.els.historyScroll.scrollTop,0);
  assert.equal(created.calls.find(call=>call.refresh).refresh[1],'main');
  const removed=actionHarness();
  removed.c.loadStateForRepoPath=async()=>({repo:{path:'repo',branch:'main'},commits:[{sha:'replacement'}]});
  await removed.c.runAction('fetch');
  assert.equal(removed.state.selectedSha,'replacement');
});


test('routine local actions avoid redundant confirmation while destructive and push actions keep it', async () => {
  for (const action of ['fetch','stageAll','commit']) {
    const {c,confirmations}=actionHarness();
    await c.runAction(action);
    assert.equal(confirmations.length,0,action);
  }
  for (const action of ['discardAll','amendCommit','pull','pullRebase','push','forcePushLease']) {
    const {c,calls}=actionHarness();
    let prompted=false;
    c.confirm=()=>{prompted=true; return false;};
    c.actionConfirmMessage=()=> 'Confirm dangerous or remote operation';
    assert.equal(await c.runAction(action),false);
    assert.equal(prompted,true,action);
    assert.equal(calls.length,0,action+' must not run after cancellation');
  }
  const combo=actionHarness();
  combo.els.commitPushToggle.checked=true;
  combo.c.confirm=()=>false;
  assert.equal(await combo.c.runAction('commit'),false);
  assert.equal(combo.calls.length,0,'commit with push still requires confirmation');
});
