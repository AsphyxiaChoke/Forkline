// Frontend error, long-task, and slow editor diagnostics.
const UI_DIAGNOSTIC_STORAGE_KEY = "forkline-ui-diagnostics-v1";
const SLOW_FILE_EDITOR_STORAGE_KEY = "forkline-slow-file-editors-v1";
const UI_DIAGNOSTIC_LIMIT = 40;
const SLOW_FILE_EDITOR_LIMIT = 40;
const UI_LONG_TASK_MIN_MS = 200;
const FILE_EDITOR_SLOW_RENDER_LIMIT_MS = 250;
const UI_DIAGNOSTIC_STORAGE_MAX_BYTES = 128 * 1024;

const uiDiagnostics = [];
const slowFileEditorKeys = new Set(readDiagnosticStorage(sessionStorage, SLOW_FILE_EDITOR_STORAGE_KEY));
let uiDiagnosticSequence = 0;
let uiDiagnosticsInitialized = false;

function readDiagnosticStorage(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeDiagnosticStorage(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Diagnostics must never interrupt the application flow.
  }
}

function uiDiagnosticStorage() {
  return window.ForklinePreferenceStorage?.storage || localStorage;
}

function uiDiagnosticIdentity(entry) {
  return entry?.id ? `id:${entry.id}` : `entry:${JSON.stringify(entry)}`;
}

function trimUiDiagnosticsToStorageLimit() {
  while (
    uiDiagnostics.length &&
    new TextEncoder().encode(JSON.stringify(uiDiagnostics)).byteLength > UI_DIAGNOSTIC_STORAGE_MAX_BYTES
  ) {
    uiDiagnostics.pop();
  }
}

function initializeUiDiagnostics() {
  if (uiDiagnosticsInitialized) return getUiDiagnostics();
  const captured = uiDiagnostics.slice();
  const stored = readDiagnosticStorage(uiDiagnosticStorage(), UI_DIAGNOSTIC_STORAGE_KEY);
  const identities = new Set();
  uiDiagnostics.length = 0;
  [...captured, ...stored].forEach((entry) => {
    const identity = uiDiagnosticIdentity(entry);
    if (identities.has(identity)) return;
    identities.add(identity);
    uiDiagnostics.push(entry);
  });
  uiDiagnostics.sort((left, right) => Date.parse(right?.time) - Date.parse(left?.time));
  if (uiDiagnostics.length > UI_DIAGNOSTIC_LIMIT) uiDiagnostics.length = UI_DIAGNOSTIC_LIMIT;
  trimUiDiagnosticsToStorageLimit();
  uiDiagnosticsInitialized = true;
  writeDiagnosticStorage(uiDiagnosticStorage(), UI_DIAGNOSTIC_STORAGE_KEY, uiDiagnostics);
  return getUiDiagnostics();
}

function recordUiDiagnostic(type, details = {}) {
  const normalizedType = String(type || "info");
  const durationMs = Math.max(0, Number(details.durationMs || 0));
  if (normalizedType === "longtask" && durationMs < UI_LONG_TASK_MIN_MS) return null;
  const entry = {
    id: `${Date.now()}-${uiDiagnosticSequence += 1}`,
    type: normalizedType,
    time: new Date().toISOString(),
    durationMs,
    message: String(details.message || "").slice(0, 2000),
    stack: String(details.stack || "").slice(0, 6000),
    startTime: Math.max(0, Number(details.startTime || 0)),
    context: normalizeUiDiagnosticContext(details.context || currentUiDiagnosticContext()),
  };
  uiDiagnostics.unshift(entry);
  if (uiDiagnostics.length > UI_DIAGNOSTIC_LIMIT) uiDiagnostics.length = UI_DIAGNOSTIC_LIMIT;
  trimUiDiagnosticsToStorageLimit();
  if (uiDiagnosticsInitialized) writeDiagnosticStorage(uiDiagnosticStorage(), UI_DIAGNOSTIC_STORAGE_KEY, uiDiagnostics);
  return { ...entry, context: { ...entry.context, editor: entry.context.editor ? { ...entry.context.editor } : null } };
}

function getUiDiagnostics() {
  return uiDiagnostics.map((entry) => ({
    ...entry,
    context: { ...(entry.context || {}), editor: entry.context?.editor ? { ...entry.context.editor } : null },
  }));
}

function clearUiDiagnostics() {
  uiDiagnostics.length = 0;
  try {
    uiDiagnosticStorage().removeItem(UI_DIAGNOSTIC_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser profiles.
  }
}

function currentUiDiagnosticContext() {
  const repo = state.data?.repo || {};
  const editor = state.fileEditor;
  return {
    url: typeof location === "object" ? String(location.href || "") : "",
    repoPath: String(repo.path || ""),
    branch: String(repo.branch || ""),
    head: String(repo.head || state.selectedSha || ""),
    selectedTab: String(state.selectedTab || ""),
    selectedRef: String(state.selectedRef || ""),
    selectedFile: String(state.selectedFile || ""),
    editor: editor ? {
      file: String(editor.file || ""),
      source: String(editor.source || ""),
      conflict: Boolean(editor.conflict),
      largeFile: Boolean(editor.largeFile),
      lightweight: Boolean(editor.lightweightCompare),
      lightweightReason: String(editor.lightweightReason || ""),
      byteLength: Math.max(0, Number(editor.byteLength || 0)),
    } : null,
  };
}

function normalizeUiDiagnosticContext(value = {}) {
  const editor = value.editor && typeof value.editor === "object" ? value.editor : null;
  return {
    url: String(value.url || "").slice(0, 1000),
    repoPath: String(value.repoPath || "").slice(0, 1000),
    branch: String(value.branch || "").slice(0, 500),
    head: String(value.head || "").slice(0, 100),
    selectedTab: String(value.selectedTab || "").slice(0, 100),
    selectedRef: String(value.selectedRef || "").slice(0, 500),
    selectedFile: String(value.selectedFile || "").slice(0, 1000),
    editor: editor ? {
      file: String(editor.file || "").slice(0, 1000),
      source: String(editor.source || "").slice(0, 100),
      conflict: Boolean(editor.conflict),
      largeFile: Boolean(editor.largeFile),
      lightweight: Boolean(editor.lightweight),
      lightweightReason: String(editor.lightweightReason || "").slice(0, 100),
      byteLength: Math.max(0, Number(editor.byteLength || 0)),
    } : null,
  };
}

function formatUiDiagnosticReport() {
  const context = currentUiDiagnosticContext();
  const browser = typeof navigator === "object" ? String(navigator.userAgent || "") : "";
  const lines = [
    "Forkline 界面诊断",
    `生成时间: ${new Date().toISOString()}`,
    `浏览器: ${browser}`,
    `页面: ${context.url}`,
    `仓库: ${context.repoPath}`,
    `分支: ${context.branch}`,
    `HEAD: ${context.head}`,
    `当前页面: ${context.selectedTab}`,
    `当前文件: ${context.editor?.file || context.selectedFile || ""}`,
    "",
    `最近记录: ${uiDiagnostics.length}`,
  ];
  uiDiagnostics.forEach((entry, index) => {
    const entryContext = entry.context || {};
    const duration = entry.durationMs ? ` ${entry.durationMs.toFixed(1)}ms` : "";
    lines.push("");
    lines.push(`${index + 1}. [${entry.type}] ${entry.time}${duration}`);
    if (entry.message) lines.push(entry.message);
    if (entryContext.repoPath) lines.push(`仓库: ${entryContext.repoPath}`);
    if (entryContext.branch || entryContext.selectedRef) lines.push(`引用: ${entryContext.branch || entryContext.selectedRef}`);
    if (entryContext.editor?.file || entryContext.selectedFile) lines.push(`文件: ${entryContext.editor?.file || entryContext.selectedFile}`);
    if (entryContext.editor) {
      lines.push(`编辑器: ${entryContext.editor.source || "worktree"} / ${entryContext.editor.lightweight ? `lightweight:${entryContext.editor.lightweightReason || "yes"}` : "merge"} / ${entryContext.editor.byteLength || 0} bytes`);
    }
    if (entry.stack) lines.push(entry.stack);
  });
  return lines.join("\n");
}

async function copyUiDiagnosticReport() {
  await copyText(formatUiDiagnosticReport());
}

function slowFileEditorKey(editor = {}) {
  const identity = editor.source === "commit" ? editor.commit : editor.snapshot;
  return [
    editor.repoPath,
    editor.source,
    identity,
    editor.file,
    editor.byteLength,
    String(editor.oldContent || "").length,
    editor.conflictVersions?.ours?.byteLength || 0,
    editor.conflictVersions?.theirs?.byteLength || 0,
  ].map((value) => String(value || "")).join("\n");
}

function shouldUseRememberedFileEditorLightweight(editor) {
  return slowFileEditorKeys.has(slowFileEditorKey(editor));
}

function rememberSlowFileEditor(editor, durationMs) {
  const key = slowFileEditorKey(editor);
  if (!key.trim()) return;
  slowFileEditorKeys.delete(key);
  slowFileEditorKeys.add(key);
  while (slowFileEditorKeys.size > SLOW_FILE_EDITOR_LIMIT) {
    slowFileEditorKeys.delete(slowFileEditorKeys.values().next().value);
  }
  writeDiagnosticStorage(sessionStorage, SLOW_FILE_EDITOR_STORAGE_KEY, [...slowFileEditorKeys]);
  recordUiDiagnostic("editor-slow", {
    durationMs,
    message: "文件对照创建过慢，已自动切换为轻量模式。",
  });
}

function startUiPerformanceDiagnostics() {
  if (typeof window !== "object" || typeof window.addEventListener !== "function") return;
  window.addEventListener("error", (event) => {
    recordUiDiagnostic("error", {
      message: event?.message || event?.error?.message || "未知界面错误",
      stack: event?.error?.stack || "",
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    recordUiDiagnostic("rejection", {
      message: reason?.message || String(reason || "未知异步错误"),
      stack: reason?.stack || "",
    });
  });
  if (
    typeof PerformanceObserver === "function" &&
    Array.isArray(PerformanceObserver.supportedEntryTypes) &&
    PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => recordUiDiagnostic("longtask", {
          durationMs: entry.duration,
          startTime: entry.startTime,
          message: "浏览器主线程出现长时间阻塞。",
        }));
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Older Chromium versions may expose the entry type but reject this observer form.
    }
  }
}

startUiPerformanceDiagnostics();
