"use strict";

const MAX_FILE_EDITOR_PATH_LENGTH = 4096;
const FILE_EDITOR_WINDOW_QUERY = "fileEditorWindow";
const FILE_EDITOR_THEME_IDS = new Set(["dark", "light", "graphite", "forest", "rose", "contrast"]);

function boundedPath(value) {
  const path = String(value || "");
  if (!path || path.includes("\0") || path.length > MAX_FILE_EDITOR_PATH_LENGTH) return null;
  return path;
}

function normalizeCommit(value) {
  const commit = String(value || "").trim();
  return /^[0-9a-f]{7,64}$/i.test(commit) ? commit : null;
}

function normalizeTheme(value) {
  const theme = String(value || "").trim().toLowerCase();
  return FILE_EDITOR_THEME_IDS.has(theme) ? theme : "";
}

function normalizeFileEditorRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const file = boundedPath(value.file);
  const previousFile = boundedPath(value.previousFile) || "";
  const rawTheme = String(value.theme || "").trim();
  const theme = normalizeTheme(rawTheme);
  if (!file || (String(value.previousFile || "") && !previousFile)) return null;
  if (rawTheme && !theme) return null;
  if (value.source !== "worktree" && value.source !== "commit") return null;
  const commit = value.source === "commit" ? normalizeCommit(value.commit) : "";
  if (value.source === "commit" && !commit) return null;
  return { file, previousFile, source: value.source, commit, ...(theme ? { theme } : {}) };
}

function fileEditorWindowUrl(serverUrl, request) {
  const normalized = normalizeFileEditorRequest(request);
  if (!normalized) return "";
  try {
    const url = new URL(String(serverUrl));
    url.search = "";
    url.searchParams.set(FILE_EDITOR_WINDOW_QUERY, "1");
    url.searchParams.set("file", normalized.file);
    if (normalized.previousFile) url.searchParams.set("previousFile", normalized.previousFile);
    url.searchParams.set("source", normalized.source);
    if (normalized.commit) url.searchParams.set("commit", normalized.commit);
    if (normalized.theme) url.searchParams.set("theme", normalized.theme);
    return url.toString();
  } catch {
    return "";
  }
}

function readFileEditorWindowContext(search) {
  const params = new URLSearchParams(String(search || ""));
  if (params.get(FILE_EDITOR_WINDOW_QUERY) !== "1") return null;
  return normalizeFileEditorRequest({
    file: params.get("file") || "",
    previousFile: params.get("previousFile") || "",
    source: params.get("source") || "",
    commit: params.get("commit") || "",
    theme: params.get("theme") || "",
  });
}

module.exports = {
  FILE_EDITOR_WINDOW_QUERY,
  fileEditorWindowUrl,
  normalizeFileEditorRequest,
  readFileEditorWindowContext,
};
