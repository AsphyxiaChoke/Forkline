"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const diagnosticsSource = fs.readFileSync(path.join(root, "public", "js", "app", "performance-diagnostics.js"), "utf8");
const editorSource = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor.js"), "utf8");
const actionsSource = fs.readFileSync(path.join(root, "public", "js", "features", "file-editor-actions.js"), "utf8");
const logsSource = fs.readFileSync(path.join(root, "public", "js", "panels", "logs.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

test("UI diagnostics persist errors and long tasks and build a copyable report", () => {
  const context = createDiagnosticsContext();
  vm.runInContext(diagnosticsSource, context);

  context.__listeners.get("error")({ message: "render failed", error: { stack: "stack line" } });
  context.__listeners.get("unhandledrejection")({ reason: { message: "request failed", stack: "async stack" } });
  context.__longTaskObserver.callback({
    getEntries: () => [{ duration: 275.4, startTime: 42 }],
  });

  const entries = context.getUiDiagnostics();
  assert.equal(entries.length, 3);
  assert.equal(entries[0].type, "longtask");
  assert.equal(entries[0].durationMs, 275.4);
  assert.equal(entries[1].type, "rejection");
  assert.equal(entries[2].message, "render failed");
  assert.match(context.localStorage.getItem("forkline-ui-diagnostics-v1"), /render failed/);

  const report = context.formatUiDiagnosticReport();
  assert.match(report, /Forkline 界面诊断/);
  assert.match(report, /D:\\repo/);
  assert.match(report, /main\.c/);
  assert.match(report, /275\.4ms/);
});

test("slow editor keys survive reloads for the same repository and file snapshot", () => {
  const first = createDiagnosticsContext();
  vm.runInContext(diagnosticsSource, first);
  const editor = sampleEditor();
  assert.equal(first.shouldUseRememberedFileEditorLightweight(editor), false);
  first.rememberSlowFileEditor(editor, 420.2);
  assert.equal(first.shouldUseRememberedFileEditorLightweight(editor), true);

  const second = createDiagnosticsContext({ sessionValues: first.sessionStorage.values });
  vm.runInContext(diagnosticsSource, second);
  assert.equal(second.shouldUseRememberedFileEditorLightweight(editor), true);
  assert.match(second.sessionStorage.getItem("forkline-slow-file-editors-v1"), /main\.c/);
});

test("file editor and operation logs wire automatic downgrade and diagnostic controls", () => {
  const diagnosticsIndex = indexHtml.indexOf("./js/app/performance-diagnostics.js");
  assert.ok(diagnosticsIndex > indexHtml.indexOf("./js/core.js"));
  assert.ok(diagnosticsIndex < indexHtml.indexOf("./js/app/init.js"));
  assert.match(editorSource, /shouldUseRememberedFileEditorLightweight\(editor\)/);
  assert.match(editorSource, /createFileEditorWithPerformanceGuard\(editor\)/);
  assert.match(editorSource, /rememberSlowFileEditor\(editor, renderMs\)/);
  assert.match(actionsSource, /readOnly:\s*editor\.readOnly/);
  assert.match(logsSource, /renderUiDiagnosticsSection\(diagnostics\)/);
  assert.match(logsSource, /data-ui-diagnostics-copy/);
  assert.match(logsSource, /data-ui-diagnostics-clear/);
  assert.match(eventsSource, /copyUiDiagnosticReport\(\)/);
  assert.match(eventsSource, /clearUiDiagnostics\(\)/);
});

function createDiagnosticsContext(options = {}) {
  const listeners = new Map();
  const localStorage = createStorage(options.localValues);
  const sessionStorage = createStorage(options.sessionValues);
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Math,
    Set,
    Map,
    localStorage,
    sessionStorage,
    navigator: { userAgent: "Forkline Test Browser" },
    location: { href: "http://127.0.0.1:5177/" },
    performance: { now: () => 100 },
    state: {
      selectedTab: "logs",
      selectedRef: "main",
      selectedSha: "1234567890abcdef",
      selectedFile: "main.c",
      data: { repo: { path: "D:\\repo", branch: "main", head: "1234567890abcdef" } },
      fileEditor: sampleEditor(),
    },
    window: {
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
    },
    PerformanceObserver: class PerformanceObserver {
      static supportedEntryTypes = ["longtask"];
      constructor(callback) {
        this.callback = callback;
        context.__longTaskObserver = this;
      }
      observe() {}
    },
  });
  context.localStorage = localStorage;
  context.sessionStorage = sessionStorage;
  context.__listeners = listeners;
  return context;
}

function createStorage(initialValues = new Map()) {
  const values = new Map(initialValues instanceof Map ? initialValues : Object.entries(initialValues || {}));
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function sampleEditor() {
  return {
    repoPath: "D:\\repo",
    source: "worktree",
    commit: "",
    file: "main.c",
    snapshot: "snapshot-1",
    byteLength: 1024,
    oldContent: "old\n",
    originalContent: "new\n",
    conflict: false,
    conflictVersions: { ours: { byteLength: 0 }, theirs: { byteLength: 0 } },
  };
}
