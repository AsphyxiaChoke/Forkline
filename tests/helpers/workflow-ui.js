"use strict";

const assert = require("node:assert/strict");

async function checkWorkflowInteractions(cdp, evaluate, diagnostic) {
  const result = await evaluate(cdp, `(async () => {
    const result = {};
    const actualBranch = state.data.repo.branch;
    await selectRef('workflow-view');
    result.target = els.commitTarget.textContent;
    result.workingBranch = actualBranch;
    result.sidebar = els.sideRepoBranch.textContent;

    els.commitSummary.value = 'ordinary draft'; els.commitBody.value = 'ordinary body';
    els.commitPushToggle.checked = true;
    els.amendToggle.checked = true;
    await changeCommitMode();
    els.commitSummary.value = 'amend draft';
    els.amendToggle.checked = false; await changeCommitMode();
    result.normalDraft = els.commitSummary.value;
    result.normalPush = els.commitPushToggle.checked;
    els.amendToggle.checked = true; await changeCommitMode();
    result.amendDraft = els.commitSummary.value;
    els.amendToggle.checked = false; await changeCommitMode();

    els.searchInput.value = 'workflow-no-match'; renderCommits({ inspector: 'never' });
    result.searchScope = els.searchCount.textContent;
    const more = els.commitGraph.querySelector('[data-load-more-commits]');
    result.moreLabel = more?.textContent;
    await loadMoreCommits(more);
    result.loaded = state.data.commits.length;
    result.query = els.searchInput.value;
    els.searchInput.value = ''; renderCommits({ inspector: 'never' });

    const beforeConfirm = window.confirm;
    let confirms = 0;
    window.confirm = () => { confirms++; return false; };
    try {
      const viewed = state.data.commits[10].sha;
      await selectCommit(viewed);
      els.historyScroll.scrollTop = rowH * 8 + 7;
      const top = els.historyScroll.scrollTop;
      result.fetchOk = await runAction('fetch');
      result.selectionPreserved = state.selectedSha === viewed;
      result.scrollPreserved = Math.abs(els.historyScroll.scrollTop - top) < 1;
      result.fetchConfirms = confirms;

      const files = changeGroups(filterWorkingFiles(state.data.workingFiles)).unstaged.slice(0, 2).map(file => file.file);
      state.selectedChanges = new Set(files.map(file => changeKey('unstaged', file)));
      renderStage({ refreshDiff: false }); refreshChangeSelectionUi();
      const selectedButton = els.changeList.querySelector('[data-bulk-file-action="stageFile"]');
      result.selectedLabel = selectedButton.textContent.trim();
      await runFileBatchAction('stageFile', 'unstaged', selectedButton);
      result.selectedStaged = files.every(file => state.data.workingFiles.some(item => item.file === file && item.staged));
      result.otherFilesUnstaged = state.data.workingFiles.some(item => !files.includes(item.file) && item.unstaged);
      result.allLabel = els.stageAll.textContent;

      els.searchInput.value = 'large-history'; renderCommits({ inspector: 'never' });
      els.commitPushToggle.checked = false;
      els.commitSummary.value = 'workflow regression commit'; els.commitBody.value = '';
      result.commitOk = await runAction('commit');
      result.commitConfirms = confirms;
      result.selectedNewCommit = state.selectedSha === state.data.repo.headSha;
      result.commitRef = state.selectedRef;
      result.queryAfterCommit = els.searchInput.value;
      const selectedRow = els.commitGraph.querySelector('.commit-row[data-sha="' + state.selectedSha + '"]');
      const selectedRect = selectedRow?.getBoundingClientRect();
      const historyRect = els.historyScroll.getBoundingClientRect();
      result.newCommitVisible = Boolean(selectedRect && selectedRect.top >= historyRect.top && selectedRect.bottom <= historyRect.bottom);
      result.discardCancelled = (await runAction('discardAll')) === false;
      result.discardConfirms = confirms;
    } finally { window.confirm = beforeConfirm; }
    return result;
  })()`);
  diagnostic('workflow interactions: ' + JSON.stringify(result));
  assert.equal(result.target, `提交到：${result.workingBranch} · 正在查看：workflow-view`);
  assert.equal(result.sidebar, `工作分支：${result.workingBranch}`);
  assert.equal(result.normalDraft, 'ordinary draft');
  assert.equal(result.normalPush, true);
  assert.equal(result.amendDraft, 'amend draft');
  assert.match(result.searchScope, /已加载 120/);
  assert.equal(result.moreLabel, '继续搜索更早历史');
  assert.equal(result.loaded, 240);
  assert.equal(result.query, 'workflow-no-match');
  assert.equal(result.fetchOk, true);
  assert.equal(result.selectionPreserved, true);
  assert.equal(result.scrollPreserved, true);
  assert.equal(result.fetchConfirms, 0);
  assert.equal(result.selectedLabel, '暂存所选 (2)');
  assert.equal(result.selectedStaged, true);
  assert.equal(result.otherFilesUnstaged, true);
  assert.equal(result.allLabel, '暂存全部');
  assert.equal(result.commitOk, true);
  assert.equal(result.commitConfirms, 0);
  assert.equal(result.selectedNewCommit, true);
  assert.equal(result.commitRef, result.workingBranch);
  assert.equal(result.queryAfterCommit, '');
  assert.equal(result.newCommitVisible, true);
  assert.equal(result.discardCancelled, true);
  assert.equal(result.discardConfirms, 1);

  for (const width of [1920, 1280]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: false });
    const layout = await evaluate(cdp, `(async () => {
      resetLayoutPreferences();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [els.stageAll, els.discardAll, els.commitSubmit, els.amendToggle.closest('label'), els.commitPushToggle.closest('label')].map(button => {
        const rect = button.getBoundingClientRect();
        const panel = button.closest('.changes, .commit-form').getBoundingClientRect();
        return { text: button.textContent.trim(), inside: rect.left >= panel.left && rect.right <= panel.right + 1 && rect.bottom <= panel.bottom + 1 };
      });
    })()`);
    diagnostic(`workflow controls (${width}px): ` + JSON.stringify(layout));
    assert.ok(layout.every(button => button.inside), 'workflow controls must fit inside their resized panels');
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
}

module.exports = { checkWorkflowInteractions };
