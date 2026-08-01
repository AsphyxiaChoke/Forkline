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
const graphSource = fs.readFileSync(path.join(root, "public", "js", "features", "graph.js"), "utf8");
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

test("portrait layout docks the inspector below the graph without disabling the sidebar resizer", () => {
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)\s*and\s*\(max-width:\s*1600px\)/);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.workspace\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-w\)\s+7px\s+minmax\(0,\s*1fr\);[^}]*grid-template-rows:\s*minmax\(500px,\s*70%\)\s+minmax\(280px,\s*30%\);/s);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.workspace-resizer\[data-resizer="sidebar"\]\s*\{[^}]*display:\s*block;[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.workspace-resizer\[data-resizer="inspector"\]\s*\{[^}]*display:\s*none;/s);
  assert.match(styles, /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.inspector\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*border-top:\s*1px\s+solid\s+var\(--line-strong\);/s);
});

test("portrait width calculation leaves room for the graph instead of the docked inspector", () => {
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
    window: {
      addEventListener: () => {},
      innerHeight: 1279,
      innerWidth: 716,
      matchMedia: () => ({ matches: true }),
    },
  });
  vm.runInContext(layoutSource, context);
  context.initLayoutResizers();
  assert.equal(values.get("--sidebar-w"), "240px");
  assert.equal(values.get("--inspector-w"), "340px");
});

test("long graph labels stay inside the graph column without squeezing commit messages", () => {
  const context = vm.createContext({
    graphWidth: 176,
    laneX: [28, 54, 80, 106, 132, 154, 166],
    state: { data: { branches: ["feature/complete-portrait-layout"], remotes: [], repo: { remoteNames: [] } } },
    escapeHtml: (value) => String(value),
    laneColor: () => "#23c7b7",
  });
  vm.runInContext(graphSource, context);

  const branch = "feature/complete-portrait-layout";
  const commits = [{ lane: 2, refs: branch }];
  const width = context.graphRenderWidth(commits, "");
  const markup = context.graphLabel(80, 31, branch, "#23c7b7", width);
  const renderedText = markup.match(/<text[^>]*>([^<]*)<\/text>/)?.[1] || "";

  assert.equal(width, 176);
  assert.equal(context.graphLabelWidth(branch), 128);
  assert.ok(renderedText.endsWith("..."));
  assert.ok(renderedText.length < branch.length);
});

test("graph mode badge keeps the complete scope name instead of shrinking", () => {
  assert.match(styles, /\.graph-head\s+em\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*overflow:\s*visible;[^}]*max-width:\s*none;[^}]*text-overflow:\s*clip;/s);
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

test("commit message body editor has a practical default height", () => {
  assert.match(styles, /\.reword-form \.edit-field textarea\s*\{[^}]*min-height:\s*132px;/s);
});

test("conflict choice buttons form an equal centered row", () => {
  assert.match(styles, /\.conflict-choice-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.conflict-choice-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*width:\s*100%;/s);
  assert.match(styles, /\.conflict-choice-actions \.mini-btn\s*\{[^}]*display:\s*grid;[^}]*width:\s*100%;[^}]*place-items:\s*center;[^}]*text-align:\s*center;/s);
  assert.match(styles, /\.conflict-choice-actions \.mini-btn\s*>\s*span:not\(\.command-hint\)\s*\{[^}]*width:\s*100%;[^}]*text-align:\s*center;/s);
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
