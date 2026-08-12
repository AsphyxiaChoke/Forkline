const MAX_RENDERER_DRAFT_BYTES = 8 * 1024 * 1024;
const MAX_REPOSITORY_PATH_LENGTH = 4096;
const MAX_FILE_PATH_LENGTH = 4096;
const MAX_COMMIT_SUMMARY_LENGTH = 64 * 1024;
const MAX_COMMIT_BODY_LENGTH = 2 * 1024 * 1024;

function strictString(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  if (value.length > maxLength) throw new RangeError(`${label} is too large`);
  return value;
}

function normalizeViewNumber(value, integer = false) {
  if (!Number.isFinite(value)) return null;
  const normalized = integer ? Math.trunc(value) : value;
  return Math.max(0, Math.min(10_000_000, normalized));
}

function normalizeRendererDraftView(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const view = {};
  const fields = [
    ["line", true],
    ["left", false],
    ["oldLine", true],
    ["oldLeft", false],
    ["incomingLine", true],
    ["incomingLeft", false],
  ];
  for (const [field, integer] of fields) {
    const normalized = normalizeViewNumber(value[field], integer);
    if (normalized !== null) view[field] = normalized;
  }
  return Object.keys(view).length ? view : null;
}

function normalizeRendererCommitDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = strictString(value.summary, "commit summary", MAX_COMMIT_SUMMARY_LENGTH);
  const body = strictString(value.body, "commit body", MAX_COMMIT_BODY_LENGTH);
  const amend = Boolean(value.amend);
  if (!summary.trim() && !body.trim() && !amend) return null;
  return { summary, body, amend };
}

function normalizeRendererFileDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const file = strictString(value.file, "file path", MAX_FILE_PATH_LENGTH).trim();
  const previousFile = strictString(value.previousFile, "previous file path", MAX_FILE_PATH_LENGTH).trim();
  const snapshot = strictString(value.snapshot, "file snapshot", 64).trim().toLowerCase();
  const content = strictString(value.content, "file content", MAX_RENDERER_DRAFT_BYTES);
  const hasDraft = Boolean(file || previousFile || snapshot || content);
  if (!hasDraft) return null;
  if (!file) throw new TypeError("file path is required");
  if (!/^[a-f0-9]{64}$/.test(snapshot)) throw new TypeError("file snapshot must be a SHA-256 value");
  const view = normalizeRendererDraftView(value.view);
  return {
    file,
    previousFile,
    snapshot,
    content,
    ...(view ? { view } : {}),
  };
}

function normalizeRendererDraft(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("renderer draft must be an object");
  const commit = normalizeRendererCommitDraft(value.commit);
  const fileEditor = normalizeRendererFileDraft(value.fileEditor);
  if (!commit && !fileEditor) return null;
  const repoPath = strictString(value.repoPath, "repository path", MAX_REPOSITORY_PATH_LENGTH).trim();
  if (!repoPath) throw new TypeError("repository path is required");
  return {
    repoPath,
    ...(commit ? { commit } : {}),
    ...(fileEditor ? { fileEditor } : {}),
  };
}

function cloneDraft(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function createRendererDraftStore(options = {}) {
  const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0
    ? options.maxBytes
    : MAX_RENDERER_DRAFT_BYTES;
  let draft = null;

  function write(value) {
    const normalized = normalizeRendererDraft(value);
    if (!normalized) {
      draft = null;
      return true;
    }
    const bytes = Buffer.byteLength(JSON.stringify(normalized), "utf8");
    if (bytes > maxBytes) throw new RangeError("renderer recovery draft exceeds 8 MiB");
    draft = cloneDraft(normalized);
    return true;
  }

  return {
    clear() {
      draft = null;
    },
    read() {
      return cloneDraft(draft);
    },
    write,
  };
}

module.exports = {
  MAX_RENDERER_DRAFT_BYTES,
  createRendererDraftStore,
  normalizeRendererDraft,
};
