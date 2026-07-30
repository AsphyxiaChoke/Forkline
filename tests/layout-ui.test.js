"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const layoutSource = fs.readFileSync(path.join(root, "public", "js", "app", "layout-utils.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "public", "js", "bootstrap.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const inspectorSource = fs.readFileSync(path.join(root, "public", "js", "panels", "inspector.js"), "utf8");
const worktreeSource = fs.readFileSync(path.join(root, "public", "js", "features", "worktree-changes.js"), "utf8");
const contextMenuSource = fs.readFileSync(path.join(root, "public", "js", "features", "context-menus.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

test("ordinary command hints become hover titles without duplicate text", () => {
  const context = vm.createContext({});
  vm.runInContext(layoutSource, context);

  const first = commandButton("git fetch");
  context.decorateCommandHints(first.root);
  assert.equal(first.button.getAttribute("title"), "git fetch");

  const second = commandButton("git reset --soft", "移动当前分支");
  context.decorateCommandHints(second.root);
  context.decorateCommandHints(second.root);
  assert.equal(second.button.getAttribute("title"), "移动当前分支\ngit reset --soft");
});

test("command hint observer starts before the app renders dynamic panels", () => {
  assert.match(bootstrapSource, /initCommandHints\(\);[\s\S]*?init\(\);/);
});

test("missing layout preferences keep the CSS defaults", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const context = vm.createContext({
    document: {
      body: { classList: { add: () => {}, remove: () => {} } },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: { getItem: () => null },
    window: { addEventListener: () => {}, innerHeight: 900, innerWidth: 1600 },
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();
  assert.equal(values.get("--sidebar-w"), "240px");
  assert.equal(values.get("--inspector-w"), "340px");
  assert.equal(values.get("--stage-h"), "300px");
});

test("temporarily constrained side panels recover their preferred widths", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const stored = new Map([
    ["forkline-sidebar-w", "280"],
    ["forkline-inspector-w", "380"],
  ]);
  const listeners = new Map();
  const windowMock = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    innerHeight: 900,
    innerWidth: 1600,
  };
  const context = vm.createContext({
    document: {
      body: { classList: { add: () => {}, remove: () => {} } },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: {
      getItem: (name) => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, String(value)),
    },
    window: windowMock,
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();
  assert.equal(values.get("--sidebar-w"), "280px");
  assert.equal(values.get("--inspector-w"), "380px");

  windowMock.innerWidth = 800;
  listeners.get("resize")();
  assert.equal(values.get("--sidebar-w"), "160px");
  assert.equal(values.get("--inspector-w"), "266px");

  windowMock.innerWidth = 1600;
  listeners.get("resize")();
  assert.equal(values.get("--sidebar-w"), "280px");
  assert.equal(values.get("--inspector-w"), "380px");
});

test("bottom panel resizer updates and saves the stage height", () => {
  const values = new Map([
    ["--sidebar-w", "240px"],
    ["--inspector-w", "340px"],
    ["--stage-h", "300px"],
  ]);
  const stored = new Map();
  const handleListeners = new Map();
  const documentListeners = new Map();
  const bodyClasses = new Set();
  const handle = {
    dataset: { resizer: "stage" },
    addEventListener: (name, listener) => handleListeners.set(name, listener),
    setPointerCapture: () => {},
  };
  const context = vm.createContext({
    document: {
      body: {
        classList: {
          add: (name) => bodyClasses.add(name),
          remove: (name) => bodyClasses.delete(name),
        },
      },
      documentElement: { style: { setProperty: (name, value) => values.set(name, value) } },
      querySelectorAll: () => [handle],
      addEventListener: (name, listener) => documentListeners.set(name, listener),
      removeEventListener: (name) => documentListeners.delete(name),
    },
    getComputedStyle: () => ({ getPropertyValue: (name) => values.get(name) || "" }),
    localStorage: {
      getItem: (name) => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, String(value)),
    },
    window: { addEventListener: () => {}, innerHeight: 900, innerWidth: 1600 },
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();

  handleListeners.get("pointerdown")({ clientY: 500, pointerId: 1, preventDefault: () => {} });
  documentListeners.get("pointermove")({ clientY: 420 });
  assert.equal(values.get("--stage-h"), "380px");
  assert.equal(bodyClasses.has("resizing"), true);

  documentListeners.get("pointerup")();
  assert.equal(stored.get("forkline-stage-h"), "380");
  assert.equal(bodyClasses.has("resizing"), false);
});

test("transition-width topbar uses compact repository path columns", () => {
  assert.match(styles, /@media\s*\(max-width:\s*1040px\)[\s\S]*?\.path-open\s*\{[^}]*grid-template-columns:\s*minmax\(96px,\s*1fr\)\s+minmax\(96px,\s*116px\)\s+max-content;/s);
});

test("worktree, index, and commit editor share one parallel bottom row", () => {
  const stageStart = indexHtml.indexOf('<section class="stage">');
  const stageEnd = indexHtml.indexOf("</section>", stageStart);
  const stageMarkup = indexHtml.slice(stageStart, stageEnd);
  const worktreeIndex = stageMarkup.indexOf('id="changeList"');
  const stagedIndex = stageMarkup.indexOf('id="stagedChangeList"');
  const commitIndex = stageMarkup.indexOf('id="commitForm"');

  assert.ok(stageStart >= 0 && stageEnd > stageStart);
  assert.ok(worktreeIndex >= 0 && stagedIndex > worktreeIndex && commitIndex > stagedIndex);
  assert.doesNotMatch(stageMarkup, /class="work-diff"/);
  assert.match(styles, /\.stage\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(styles, /@container\s+main-workspace\s*\(max-width:\s*700px\)[\s\S]*?\.stage\s*\{[^}]*grid-template-columns:\s*220px\s+220px\s+minmax\(240px,\s*1fr\);/s);
  assert.match(worktreeSource, /els\.changeList\.innerHTML\s*=\s*`[\s\S]*?renderChangeSection\("unstaged"/s);
  assert.match(worktreeSource, /els\.stagedChangeList\.innerHTML\s*=\s*`[\s\S]*?renderChangeSection\("staged"/s);
  assert.match(contextMenuSource, /action\s*===\s*"diff"[\s\S]*?await loadWorkingDiff\(context\.file\);[\s\S]*?openDiffModal\(\);/s);
});

test("narrow layout preserves commit messages and contains the commit form", () => {
  assert.match(styles, /\.main\s*\{[^}]*container-name:\s*main-workspace;/s);
  assert.match(styles, /@container\s+main-workspace\s*\(max-width:\s*700px\)/);
  assert.match(styles, /@container\s+main-workspace\s*\(max-width:\s*500px\)[\s\S]*?grid-template-columns:\s*var\(--graph-w\)\s+minmax\(96px,\s*1fr\)\s+minmax\(66px,\s*72px\);/);
  assert.match(styles, /\.commit-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.mini-btn\s*>\s*\.command-hint\s*\{[^}]*display:\s*none;/s);
});

test("minimum inspector width wraps controls instead of clipping labels", () => {
  assert.match(styles, /\.inspector\s*\{[^}]*container-name:\s*inspector-panel;/s);
  assert.match(styles, /@container\s+inspector-panel\s*\(max-width:\s*300px\)/);
  assert.match(styles, /\.upstream-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.settings-card-head\s*>\s*\.mini-btn\s*\{[^}]*width:\s*100%;/s);
});

test("minimum sidebar width contains branch rows and actions", () => {
  assert.match(styles, /\.sidebar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.side-section\s*\{[^}]*min-width:\s*0;/s);
});

test("commit operation sections center without changing other detail headings", () => {
  assert.equal((inspectorSource.match(/class="detail-section-title commit-action-section-title"/g) || []).length, 3);
  assert.equal((inspectorSource.match(/class="commit-tools commit-action-tools"/g) || []).length, 3);
  assert.match(styles, /\.commit-action-section-title,[\s\S]*?\.history-queue-empty\s*\{[^}]*text-align:\s*center;/s);
  assert.doesNotMatch(styles, /\.detail-section-title\s*\{[^}]*text-align:\s*center;/s);
});

test("commit operation buttons use a compact responsive grid", () => {
  assert.match(styles, /\.commit-action-tools\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*6px;/s);
  assert.match(styles, /\.commit-action-tools \.mini-btn\s*\{[^}]*white-space:\s*normal;/s);
  assert.match(styles, /\[data-commit-tool="resetHard"\],[\s\S]*?\[data-commit-tool="drop"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
  assert.match(styles, /@container\s+inspector-panel\s*\(max-width:\s*300px\)[\s\S]*?\.commit-action-tools\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
});

test("context menus stay accessible within short viewports", () => {
  assert.match(styles, /\.context-menu\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*16px\);/s);
  assert.match(styles, /\.context-menu\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(eventsSource, /document\.addEventListener\("scroll",\s*\(event\)\s*=>\s*\{\s*if\s*\(event\.target instanceof Element && event\.target\.closest\("\.context-menu"\)\) return;/s);
});

function commandButton(command, title = "") {
  const attributes = new Map();
  if (title) attributes.set("title", title);
  const button = {
    classList: { contains: (name) => name === "mini-btn" },
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
  };
  const hint = { parentElement: button, textContent: command };
  const root = { querySelectorAll: () => [hint] };
  return { button, root };
}
