// File type, content, and lightweight comparison helpers.
const FILE_EDITOR_LIGHTWEIGHT_LINE_LIMIT = 20000;
const FILE_EDITOR_LIGHTWEIGHT_CHAR_LIMIT = 768 * 1024;
const FILE_EDITOR_LIGHTWEIGHT_CHANGED_LINE_LIMIT = 2000;
const FILE_EDITOR_LIGHTWEIGHT_CHANGE_SEGMENT_LIMIT = 32;

function normalizeFileEditorContent(value) {
  return String(value || "").replace(/\r\n|\r/g, "\n");
}

function normalizeFileEditorConflictVersions(value = {}) {
  return {
    ours: normalizeFileEditorConflictVersion(value?.ours),
    theirs: normalizeFileEditorConflictVersion(value?.theirs),
  };
}

function normalizeFileEditorConflictVersion(value = {}) {
  return {
    exists: Boolean(value?.exists),
    content: normalizeFileEditorContent(value?.content || ""),
    encoding: String(value?.encoding || ""),
    lineEnding: String(value?.lineEnding || ""),
    byteLength: Math.max(0, Number(value?.byteLength || 0)),
    unavailable: String(value?.unavailable || ""),
    tooLarge: Boolean(value?.tooLarge),
    largeFile: Boolean(value?.largeFile),
  };
}

function detectFileEditorLightweightCompare(source, oldContent, content, largeFile = false) {
  if ((source !== "commit" && source !== "worktree") || largeFile) return { enabled: false, reason: "" };
  const oldText = String(oldContent || "");
  const newText = String(content || "");
  if (Math.max(oldText.length, newText.length) >= FILE_EDITOR_LIGHTWEIGHT_CHAR_LIMIT) {
    return { enabled: true, reason: "size" };
  }
  if (Math.max(fileEditorLineCount(oldText), fileEditorLineCount(newText)) >= FILE_EDITOR_LIGHTWEIGHT_LINE_LIMIT) {
    return { enabled: true, reason: "lines" };
  }

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const sharedLength = Math.min(oldLines.length, newLines.length);
  let prefixLength = 0;
  while (prefixLength < sharedLength && oldLines[prefixLength] === newLines[prefixLength]) prefixLength += 1;

  let suffixLength = 0;
  while (
    suffixLength < sharedLength - prefixLength &&
    oldLines[oldLines.length - suffixLength - 1] === newLines[newLines.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const oldChangedLength = oldLines.length - prefixLength - suffixLength;
  const newChangedLength = newLines.length - prefixLength - suffixLength;
  const compareLength = Math.max(oldChangedLength, newChangedLength);
  let changedLines = 0;
  let changeSegments = 0;
  let insideChange = false;
  for (let index = 0; index < compareLength; index += 1) {
    const changed = oldLines[prefixLength + index] !== newLines[prefixLength + index];
    if (changed) {
      changedLines += 1;
      if (!insideChange) changeSegments += 1;
    }
    insideChange = changed;
    if (
      changedLines >= FILE_EDITOR_LIGHTWEIGHT_CHANGED_LINE_LIMIT ||
      changeSegments >= FILE_EDITOR_LIGHTWEIGHT_CHANGE_SEGMENT_LIMIT
    ) {
      return { enabled: true, reason: "diff" };
    }
  }
  return { enabled: false, reason: "" };
}

function fileEditorLineCount(content) {
  let lines = 1;
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) lines += 1;
  }
  return lines;
}

function fileEditorMode(filePath) {
  const name = String(filePath || "").replaceAll("\\", "/").split("/").pop().toLowerCase();
  if (name === "dockerfile") return { mode: "dockerfile", label: "Dockerfile" };
  if (name === "cmakelists.txt") return { mode: "text/x-cmake", label: "CMake" };
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const modes = {
    ".js": { mode: "javascript", label: "JavaScript" },
    ".mjs": { mode: "javascript", label: "JavaScript" },
    ".cjs": { mode: "javascript", label: "JavaScript" },
    ".json": { mode: { name: "javascript", json: true }, label: "JSON" },
    ".jsonc": { mode: { name: "javascript", json: true }, label: "JSON" },
    ".ts": { mode: { name: "javascript", typescript: true }, label: "TypeScript" },
    ".jsx": { mode: "text/jsx", label: "JSX" },
    ".tsx": { mode: "text/typescript-jsx", label: "TSX" },
    ".html": { mode: "htmlmixed", label: "HTML" },
    ".htm": { mode: "htmlmixed", label: "HTML" },
    ".vue": { mode: "htmlmixed", label: "Vue" },
    ".xml": { mode: "xml", label: "XML" },
    ".svg": { mode: "xml", label: "SVG" },
    ".css": { mode: "css", label: "CSS" },
    ".scss": { mode: "text/x-scss", label: "SCSS" },
    ".less": { mode: "text/x-less", label: "Less" },
    ".c": { mode: "text/x-csrc", label: "C" },
    ".h": { mode: "text/x-csrc", label: "C" },
    ".cc": { mode: "text/x-c++src", label: "C++" },
    ".cpp": { mode: "text/x-c++src", label: "C++" },
    ".cxx": { mode: "text/x-c++src", label: "C++" },
    ".hpp": { mode: "text/x-c++src", label: "C++" },
    ".java": { mode: "text/x-java", label: "Java" },
    ".cs": { mode: "text/x-csharp", label: "C#" },
    ".kt": { mode: "text/x-kotlin", label: "Kotlin" },
    ".py": { mode: "python", label: "Python" },
    ".md": { mode: "markdown", label: "Markdown" },
    ".markdown": { mode: "markdown", label: "Markdown" },
    ".sh": { mode: "shell", label: "Shell" },
    ".bash": { mode: "shell", label: "Shell" },
    ".sql": { mode: "sql", label: "SQL" },
    ".yaml": { mode: "yaml", label: "YAML" },
    ".yml": { mode: "yaml", label: "YAML" },
    ".properties": { mode: "properties", label: "Properties" },
    ".ini": { mode: "properties", label: "INI" },
    ".diff": { mode: "diff", label: "Diff" },
    ".patch": { mode: "diff", label: "Patch" },
    ".ps1": { mode: "powershell", label: "PowerShell" },
    ".go": { mode: "text/x-go", label: "Go" },
    ".rs": { mode: "text/x-rustsrc", label: "Rust" },
    ".toml": { mode: "toml", label: "TOML" },
    ".php": { mode: "application/x-httpd-php", label: "PHP" },
  };
  return modes[extension] || { mode: null, label: "纯文本" };
}

function fileEditorLineEndingLabel(value) {
  if (value === "crlf") return "CRLF";
  if (value === "cr") return "CR";
  return "LF";
}

function formatFileEditorBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
}

function escapeFileEditorRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
