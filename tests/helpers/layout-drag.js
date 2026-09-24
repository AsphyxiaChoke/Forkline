"use strict";

const assert = require("node:assert/strict");

async function checkLayoutDragging(cdp, evaluate, diagnostic) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const results = await evaluate(cdp, `(${measureLayoutDragging.toString()})()`);
  diagnostic("layout drag: " + JSON.stringify(results));
  assertLayoutDragging(results);
  await checkNativeDragging(cdp, evaluate, diagnostic);
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  return results;
}

function assertLayoutDragging(results) {
  for (const result of results) {
    assert.ok(result.writes <= 145, `${result.selector}: ${result.writes} style writes for 40 frames`);
    assert.ok(result.reads < 60, `${result.selector}: ${result.reads} computed-style reads during drag`);
    assert.equal(result.layouts, 0, `${result.selector}: resizing must not recompute commit relationships`);
    if (result.selector.includes("history-resizer")) {
      assert.equal(result.rows, 0, `${result.selector}: resizing must preserve commit row nodes`);
    }
    assert.ok(result.p95 < 70, `${result.selector}: p95 frame took ${result.p95}ms`);
    assert.equal(result.resizing, false, `${result.selector}: drag did not finish`);
    assert.ok(result.movement > 50, `${result.selector}: the panel did not visibly resize`);
    assert.ok(result.releaseJump < 1.1, `${result.selector}: the panel jumped on release`);
  }
}

async function checkHistoryColumnDragging(cdp, evaluate, diagnostic) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await evaluate(cdp, 'window.headerDragOriginalCommits = state.data.commits');
  try {
    for (const count of [120, 240]) {
      const loaded = await evaluate(cdp, `(() => {
        state.data.commits = window.headerDragOriginalCommits.slice(0, ${count});
        els.historyScroll.scrollTop = 0;
        renderCommits({ inspector: 'never' });
        return state.filtered.length;
      })()`);
      assert.equal(loaded, count, 'header drag regression requires two real history pages');
      const selectors = ['graph', 'message', 'author', 'time'].map(name => `[data-history-resizer="${name}"]`);
      const results = await evaluate(cdp, `(${measureLayoutDragging.toString()})(${JSON.stringify(selectors)})`);
      diagnostic(`header drag (${count} commits): ` + JSON.stringify(results));
      assertLayoutDragging(results);
      const rows = await evaluate(cdp, `(() => ({
        rendered: els.commitGraph.querySelectorAll('.commit-row[data-sha]').length,
        visible: Math.ceil(els.historyScroll.clientHeight / rowH),
      }))()`);
      assert.ok(rows.rendered <= rows.visible + 24, `${count} commits: offscreen rows still participate in column resizing`);
      await checkNativeDragging(cdp, evaluate, diagnostic, false);
      const bottom = await evaluate(cdp, `(async () => {
        els.historyScroll.scrollTop = els.historyScroll.scrollHeight;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        renderCommitViewport();
        const last = state.filtered.at(-1);
        const row = els.commitGraph.querySelector('.commit-row[data-sha="' + last.sha + '"]');
        return { visible: Boolean(row), height: row?.getBoundingClientRect().height, expectedHeight: rowH };
      })()`);
      assert.equal(bottom.visible, true, 'last commit must remain reachable after resizing');
      assert.equal(bottom.height, bottom.expectedHeight, 'commit rows must remain aligned with the graph');
    }
  } finally {
    await evaluate(cdp, `state.data.commits = window.headerDragOriginalCommits; delete window.headerDragOriginalCommits; els.historyScroll.scrollTop = 0; renderCommits({ inspector: 'never' }); resetLayoutPreferences();`);
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }
}

async function measureLayoutDragging(selectors = ['[data-resizer="sidebar"]', '[data-resizer="inspector"]', '[data-resizer="stage"]', '[data-history-resizer="message"]', '[data-history-resizer="graph"]', '[data-stage-resizer="0"]', '[data-stage-resizer="1"]']) {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const results = [];
  for (const selector of selectors) {
    resetLayoutPreferences();
    await frame(); await frame();
    const handle = document.querySelector(selector);
    const rect = handle.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const panel = selector.includes('history-resizer') ? handle.parentElement
      : selector.includes('stage-resizer') ? handle.previousElementSibling
      : selector.includes('"stage"') ? document.querySelector('.stage')
      : handle.previousElementSibling;
    const extent = () => selector.includes('[data-resizer="stage"]') ? panel.getBoundingClientRect().height : panel.getBoundingClientRect().width;
    const before = extent();
    const capture = handle.setPointerCapture;
    const set = CSSStyleDeclaration.prototype.setProperty, read = window.getComputedStyle;
    const layout = layoutGraphCommits, createRows = createCommitRows;
    let writes = 0, reads = 0, layouts = 0, rows = 0;
    const times = [];
    try {
      // Synthetic bursts exercise high-rate input through the real listeners.
      handle.setPointerCapture = () => {};
      CSSStyleDeclaration.prototype.setProperty = function(...args) { writes++; return set.apply(this, args); };
      window.getComputedStyle = function(...args) { reads++; return read.apply(this, args); };
      layoutGraphCommits = function(...args) { layouts++; return layout(...args); };
      createCommitRows = function(...args) { rows++; return createRows(...args); };
      let previous = await frame();
      handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
      for (let tick = 0; tick < 40; tick++) {
        for (let sample = 0; sample < 8; sample++) {
          const delta = (tick * 8 + sample + 1) * 0.5;
          document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x + delta, clientY: y - delta, pointerId: 1, buttons: 1 }));
        }
        const now = await frame(); times.push(now - previous); previous = now;
      }
      await frame(); await frame();
      const dragged = extent();
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x + 160, clientY: y - 160, pointerId: 1 }));
      await frame(); await frame();
      times.sort((a, b) => a - b);
      results.push({ selector, writes, reads, layouts, rows, median: times[20], p95: times[38], max: times[39], resizing: document.body.classList.contains("resizing"), movement: Math.abs(dragged - before), releaseJump: Math.abs(extent() - dragged) });
    } finally {
      CSSStyleDeclaration.prototype.setProperty = set;
      window.getComputedStyle = read;
      layoutGraphCommits = layout;
      createCommitRows = createRows;
      handle.setPointerCapture = capture;
    }
  }
  resetLayoutPreferences();
  return results;
}

async function checkNativeDragging(cdp, evaluate, diagnostic, reload = true) {
  const results = [];
  for (const [selector, panelSelector, axis, sign] of [
    ['[data-resizer="sidebar"]', '.sidebar', 'width', 1],
    ['[data-resizer="inspector"]', '.inspector', 'width', -1],
    ['[data-resizer="stage"]', '.stage', 'height', -1],
    ['[data-history-resizer="message"]', '[data-history-column="message"]', 'width', 1],
    ['[data-history-resizer="graph"]', '[data-history-column="graph"]', 'width', 1],
    ['[data-history-resizer="author"]', '[data-history-column="author"]', 'width', 1],
    ['[data-history-resizer="time"]', '[data-history-column="time"]', 'width', 1],
    ['[data-stage-resizer="0"]', '.worktree-changes', 'width', 1],
    ['[data-stage-resizer="1"]', '.staged-changes', 'width', 1],
  ]) {
    const start = await evaluate(cdp, `(async () => {
      resetLayoutPreferences();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const resetStarted = performance.now();
      while (performance.now() - resetStarted < 250) {
        const widths = [...document.querySelectorAll('.stage > .changes, .stage > .commit-form')].map(panel => panel.getBoundingClientRect().width);
        if (document.querySelector('.sidebar').getBoundingClientRect().width === 240 && document.querySelector('.inspector').getBoundingClientRect().width === 340 && document.querySelector('.stage').getBoundingClientRect().height === 300 && Math.max(...widths) - Math.min(...widths) < 1) break;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      const handle = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      const panel = document.querySelector(${JSON.stringify(panelSelector)}).getBoundingClientRect();
      return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, size: panel[${JSON.stringify(axis)}] };
    })()`);
    const input = (type, delta, buttons) => cdp.send('Input.dispatchMouseEvent', {
      type, x: start.x + (axis === 'width' ? delta * sign : 0), y: start.y + (axis === 'height' ? delta * sign : 0),
      button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: 1,
    });
    await input('mouseMoved', 0, 0);
    await input('mousePressed', 0, 1);
    for (let delta = 4; delta <= 48; delta += 4) await input('mouseMoved', delta, 1);
    const dragging = await evaluate(cdp, `(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return document.querySelector(${JSON.stringify(panelSelector)}).getBoundingClientRect()[${JSON.stringify(axis)}];
    })()`);
    await evaluate(cdp, `(() => {
      window.layoutDragReleased = new Promise(resolve => document.addEventListener('pointerup', () => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }, { once: true }));
    })()`);
    await input('mouseMoved', 60, 1);
    await input('mouseReleased', 60, 0);
    const end = await evaluate(cdp, `(async () => {
      await window.layoutDragReleased;
      delete window.layoutDragReleased;
      const started = performance.now();
      const panel = document.querySelector(${JSON.stringify(panelSelector)});
      let size = panel.getBoundingClientRect()[${JSON.stringify(axis)}];
      while (Math.abs(size - ${start.size + 60}) > 1 && performance.now() - started < 250) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        size = panel.getBoundingClientRect()[${JSON.stringify(axis)}];
      }
      return { size, settleMs: performance.now() - started, resizing: document.body.classList.contains('resizing') };
    })()`);
    assert.ok(Math.abs(dragging - start.size - 48) < 1.1, `${selector}: native drag moved ${dragging - start.size}px; ${JSON.stringify({start, end})}`);
    assert.ok(Math.abs(end.size - start.size - 60) < 1.1, `${selector}: release position was not applied (${end.size - start.size}px); ${JSON.stringify({start, end})}`);
    assert.equal(end.resizing, false);
    assert.ok(end.settleMs < 100, `${selector}: release remained pending for ${end.settleMs}ms`);
    results.push({ selector, dragged: dragging - start.size, released: end.size - start.size, settleMs: end.settleMs });
  }
  diagnostic('native layout drag: ' + JSON.stringify(results));
  if (!reload) return;
  const saved = await evaluate(cdp, `(() => {
    window.dragBeforeReload = true;
    return [...document.querySelectorAll('.stage > .changes, .stage > .commit-form')].map(panel => panel.getBoundingClientRect().width);
  })()`);
  await cdp.send('Page.reload');
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    ready = await evaluate(cdp, 'Boolean(!window.dragBeforeReload && document.readyState === "complete" && typeof state !== "undefined" && state.data?.repo && !state.repoHydrating)');
    if (ready) break;
  }
  assert.equal(ready, true, 'page did not finish reloading after drag');
  const restored = await evaluate(cdp, `(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return [...document.querySelectorAll('.stage > .changes, .stage > .commit-form')].map(panel => panel.getBoundingClientRect().width);
  })()`);
  restored.forEach((width, index) => assert.ok(Math.abs(width - saved[index]) < 1.1, 'stage column width was not restored after reload'));
  diagnostic('layout reload restored widths: ' + JSON.stringify(restored));
  await evaluate(cdp, 'resetLayoutPreferences()');
}

module.exports = { checkLayoutDragging, checkNativeDragging, checkHistoryColumnDragging };
