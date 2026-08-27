// Shared state, constants, and DOM handles for Forkline scripts.
const $ = (selector) => document.querySelector(selector);
const recentRepoStorageKey = "forkline-recent-repos";
const recoveryPolicyStorageKey = "forkline-recovery-policy";
const localeStorageKey = "forkline-locale";

const state = {
  data: null,
  filtered: [],
  selectedSha: "",
  selectedTab: "details",
  inspectorContext: "commit",
  selectedRef: "",
  theme: "dark",
  locale: "zh-CN",
  desktopZoom: null,
  appUpdate: {
    status: "loading",
    currentVersion: "",
    latestVersion: "",
    url: "",
    installSupported: false,
    installMode: "",
    installing: false,
    installError: "",
    installState: "",
    installMessage: "",
    installStep: 0,
    installTotal: 6,
    downloadPercent: 0,
    lastResult: null,
  },
  selectedFile: "",
  workDiffScope: "unstaged",
  selectedCommitFile: "",
  selectedSyncSha: "",
  selectedSyncFile: "",
  selectedCompareFile: "",
  compare: { base: "", head: "", data: null, loading: false, error: "" },
  fileHistory: { file: "", ref: "", data: null, loading: false, error: "" },
  fileBlame: { file: "", ref: "", data: null, loading: false, error: "" },
  activeDiff: null,
  workDiffFeedback: null,
  historyLimit: 120,
  historyHasMore: false,
  historyLoading: false,
  diffModalRenderLimit: 0,
  fileEditor: null,
  commitFileCompareMode: "connect",
  openDiffOnInit: false,
  branchStartSha: "",
  branchModalMode: "create",
  branchRenameOld: "",
  tagTargetSha: "",
  mainlineAction: "",
  mainlineCommitSha: "",
  contextCommitSha: "",
  contextBranch: null,
  contextFile: null,
  contextTag: null,
  contextRemote: null,
  contextReflogEntry: null,
  diffRequestId: 0,
  refRequestId: 0,
  historyRequestId: 0,
  compareRequestId: 0,
  fileHistoryRequestId: 0,
  fileBlameRequestId: 0,
  syncRequestId: 0,
  refreshingWorktree: false,
  worktreeSignature: "",
  commitDetails: new Map(),
  loadingCommitDetails: new Set(),
  stashDetails: new Map(),
  selectedStash: "",
  selectedTag: "",
  selectedRecoveryRef: "",
  recoveryUndo: null,
  recoveryRedo: null,
  selectedReflogSelector: "",
  recoveryFilter: { query: "", branch: "", action: "" },
  recoveryPolicy: { keepDays: "90", maxPerBranch: "50", autoPrune: false },
  recoveryPolicyRepoPath: "",
  reflog: { key: "", entries: null, loading: false, error: "", inline: false },
  reflogRequestId: 0,
  remoteCheck: null,
  authDiagnostics: { repoPath: "", remoteKey: "", data: null, loading: false, error: "", inline: false },
  authDiagnosticsRequestId: 0,
  historyPlan: null,
  historyQueue: { items: [], loading: false, preview: null, error: "" },
  historyQueuePreviewTimer: 0,
  selectedChanges: new Set(),
  selectedDiffLines: new Set(),
  lastChangeSelection: null,
  lastDiffLineKey: "",
  branchFilter: "",
  worktreeFilter: "",
  worktreeRenderLimits: { unstaged: 800, staged: 800 },
  commitSearchRenderTimer: 0,
  cloneTargetAuto: false,
  cloneOperationPending: false,
  commandPaletteIndex: 0,
  folderBrowse: null,
  folderBrowseRequestId: 0,
  openRepoRequestId: 0,
  stateRequestId: 0,
  repoHydrating: false,
  repoDetailRequestId: 0,
  repoDetailLoads: {},
};

function repoPathSnapshot() {
  return state.data?.repo?.path || "";
}

function isCurrentRepoPath(repoPath) {
  return repoPathSnapshot() === repoPath;
}

function invalidateStateRefreshes() {
  state.stateRequestId = Number.isInteger(state.stateRequestId) ? state.stateRequestId + 1 : 1;
  return state.stateRequestId;
}

async function loadStateForRepoPath(repoPath, ref = state.selectedRef) {
  const requestId = invalidateStateRefreshes();
  const data = await api(`/api/state?ref=${encodeURIComponent(ref)}&details=core`);
  if (requestId !== state.stateRequestId || !isCurrentRepoPath(repoPath)) return null;
  state.repoDetailRequestId += 1;
  state.repoDetailLoads = {};
  return data;
}

async function renderSelectedCommitForRepoPath(repoPath) {
  if (!state.selectedSha || !isCurrentRepoPath(repoPath)) return;
  await loadCommit(state.selectedSha);
  if (!isCurrentRepoPath(repoPath)) return;
  renderInspector();
}

function mergeWorktreeState(data, options = {}) {
  if (!state.data || !data) return;
  state.data.workingFiles = data.workingFiles || [];
  state.data.worktreeSnapshot = data.worktreeSnapshot || "";
  state.data.repo = { ...(state.data.repo || {}), operation: data.operation || null };
  if (options.stashes) state.data.stashes = data.stashes || [];
}

function applyHistoryState(data = state.data) {
  const history = data?.history || {};
  const loaded = Array.isArray(data?.commits) ? data.commits.length : 0;
  state.historyLimit = Number.isInteger(history.limit) ? history.limit : Math.max(120, loaded);
  state.historyHasMore = Boolean(history.hasMore);
  state.historyLoading = false;
}

const graphWidth = 176;
const laneX = [28, 54, 80, 106, 132, 154, 166];
const rowH = 62;
const inspectorTabs = {
  commit: ["details", "files", "tags"],
  file: ["fileHistory", "fileBlame"],
  branch: ["branches", "sync", "compare"],
  more: ["worktrees", "submodules", "stashes", "recovery", "logs", "settings"],
};

function repositoryRefOptions(extraRefs = []) {
  const seen = new Set();
  const items = [];
  const add = (ref, label) => {
    const value = String(ref || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    items.push({ ref: value, label });
  };
  add("HEAD", t("当前 HEAD"));
  add(state.data?.repo?.branch, t("当前分支"));
  (state.data?.branches || []).forEach((branch) => add(branch, t("本地分支")));
  (state.data?.remotes || []).forEach((branch) => add(branch, t("远端分支")));
  (state.data?.tags || []).forEach((tag) => add(tag.name, "Tag"));
  extraRefs.forEach((ref) => add(ref, t("当前输入")));
  return items;
}
const els = {
  appUpdateIndicator: $("#appUpdateIndicator"),
  gitActionStatus: $("#gitActionStatus"),
  repoName: $("#repoName"),
  repoPath: $("#repoPath"),
  sideRepoName: $("#sideRepoName"),
  sideRepoBranch: $("#sideRepoBranch"),
  repoInput: $("#repoInput"),
  recentRepoSelect: $("#recentRepoSelect"),
  clearRecentRepos: $("#clearRecentRepos"),
  browseRepo: $("#browseRepo"),
  cloneRepo: $("#cloneRepo"),
  initRepo: $("#initRepo"),
  openRepo: $("#openRepo"),
  openCommandPalette: $("#openCommandPalette"),
  moreInspectorSelect: $("#moreInspectorSelect"),
  searchInput: $("#searchInput"),
  searchCount: $("#searchCount"),
  clearSearch: $("#clearSearch"),
  branchList: $("#branchList"),
  branchFilterInput: $("#branchFilterInput"),
  branchFilterCount: $("#branchFilterCount"),
  clearBranchFilter: $("#clearBranchFilter"),
  newBranch: $("#newBranch"),
  remoteList: $("#remoteList"),
  worktreeFilterInput: $("#worktreeFilterInput"),
  worktreeFilterCount: $("#worktreeFilterCount"),
  clearWorktreeFilter: $("#clearWorktreeFilter"),
  branchStrip: $("#branchStrip"),
  historyScroll: $("#historyScroll"),
  commitGraph: $("#commitGraph"),
  changeList: $("#changeList"),
  stagedChangeList: $("#stagedChangeList"),
  stageAll: $("#stageAll"),
  stashChanges: $("#stashChanges"),
  discardAll: $("#discardAll"),
  commitForm: $("#commitForm"),
  commitSummary: $("#commitSummary"),
  commitBody: $("#commitBody"),
  amendToggle: $("#amendToggle"),
  commitPushToggle: $("#commitPushToggle"),
  commitSubmit: $("#commitSubmit"),
  draftNote: $("#draftNote"),
  workDiffTitle: $("#workDiffTitle"),
  workDiffPath: $("#workDiffPath"),
  workDiffView: $("#workDiffView"),
  editWorktreeFile: $("#editWorktreeFile"),
  maximizeDiff: $("#maximizeDiff"),
  refreshChanges: $("#refreshChanges"),
  diffModal: $("#diffModal"),
  diffModalTitle: $("#diffModalTitle"),
  diffModalPath: $("#diffModalPath"),
  diffModalBody: $("#diffModalBody"),
  closeDiffModal: $("#closeDiffModal"),
  commitContextMenu: $("#commitContextMenu"),
  branchContextMenu: $("#branchContextMenu"),
  fileContextMenu: $("#fileContextMenu"),
  fileEditorContextMenu: $("#fileEditorContextMenu"),
  tagContextMenu: $("#tagContextMenu"),
  remoteContextMenu: $("#remoteContextMenu"),
  reflogContextMenu: $("#reflogContextMenu"),
  detailNode: $("#detailNode"),
  detailTitle: $("#detailTitle"),
  detailSub: $("#detailSub"),
  detailBody: $("#detailBody"),
  inspector: $(".inspector"),
  inspectorTabs: $(".tabs"),
  checkoutModal: $("#checkoutModal"),
  checkoutModalText: $("#checkoutModalText"),
  folderModal: $("#folderModal"),
  folderClose: $("#folderClose"),
  folderPathInput: $("#folderPathInput"),
  folderGo: $("#folderGo"),
  folderRoots: $("#folderRoots"),
  folderList: $("#folderList"),
  folderParent: $("#folderParent"),
  folderOpen: $("#folderOpen"),
  folderCurrentPath: $("#folderCurrentPath"),
  cloneModal: $("#cloneModal"),
  cloneForm: $("#cloneForm"),
  cloneUrlInput: $("#cloneUrlInput"),
  cloneTargetInput: $("#cloneTargetInput"),
  cloneOpenToggle: $("#cloneOpenToggle"),
  cloneSubmit: $("#cloneSubmit"),
  cloneCancel: $("#cloneCancel"),
  initModal: $("#initModal"),
  initForm: $("#initForm"),
  initPathInput: $("#initPathInput"),
  initOpenToggle: $("#initOpenToggle"),
  initSubmit: $("#initSubmit"),
  initCancel: $("#initCancel"),
  patchModal: $("#patchModal"),
  patchForm: $("#patchForm"),
  patchTextInput: $("#patchTextInput"),
  patchStageToggle: $("#patchStageToggle"),
  patchSubmit: $("#patchSubmit"),
  patchCancel: $("#patchCancel"),
  commandPalette: $("#commandPalette"),
  commandInput: $("#commandInput"),
  commandList: $("#commandList"),
  commandClose: $("#commandClose"),
  branchModal: $("#branchModal"),
  branchForm: $("#branchForm"),
  branchNameInput: $("#branchNameInput"),
  branchModalTitle: $("#branchModalTitle"),
  branchStartText: $("#branchStartText"),
  branchCheckoutLabel: $("#branchCheckoutLabel"),
  branchCheckoutToggle: $("#branchCheckoutToggle"),
  branchSubmit: $("#branchSubmit"),
  branchCancel: $("#branchCancel"),
  tagModal: $("#tagModal"),
  tagForm: $("#tagForm"),
  tagNameInput: $("#tagNameInput"),
  tagAnnotatedToggle: $("#tagAnnotatedToggle"),
  tagMessageInput: $("#tagMessageInput"),
  tagStartText: $("#tagStartText"),
  tagSubmit: $("#tagSubmit"),
  tagCancel: $("#tagCancel"),
  mainlineModal: $("#mainlineModal"),
  mainlineForm: $("#mainlineForm"),
  mainlineOptions: $("#mainlineOptions"),
  mainlineModalTitle: $("#mainlineModalTitle"),
  mainlineStartText: $("#mainlineStartText"),
  mainlineSubmit: $("#mainlineSubmit"),
  mainlineCancel: $("#mainlineCancel"),
  fileEditorModal: $("#fileEditorModal"),
  fileEditorForm: $("#fileEditorForm"),
  fileEditorTitle: $("#fileEditorTitle"),
  fileEditorPath: $("#fileEditorPath"),
  fileEditorCompareMode: $("#fileEditorCompareMode"),
  fileEditorToggleSearch: $("#fileEditorToggleSearch"),
  fileEditorSearch: $("#fileEditorSearch"),
  fileEditorSearchInput: $("#fileEditorSearchInput"),
  fileEditorReplaceInput: $("#fileEditorReplaceInput"),
  fileEditorCaseSensitive: $("#fileEditorCaseSensitive"),
  fileEditorFindPrevious: $("#fileEditorFindPrevious"),
  fileEditorFindNext: $("#fileEditorFindNext"),
  fileEditorReplaceOne: $("#fileEditorReplaceOne"),
  fileEditorReplaceAll: $("#fileEditorReplaceAll"),
  fileEditorMatchStatus: $("#fileEditorMatchStatus"),
  fileEditorOldLabel: $("#fileEditorOldLabel"),
  fileEditorResultLabel: $("#fileEditorResultLabel"),
  fileEditorNewLabel: $("#fileEditorNewLabel"),
  fileEditorMerge: $("#fileEditorMerge"),
  fileEditorFallback: $("#fileEditorFallback"),
  fileEditorOldText: $("#fileEditorOldText"),
  fileEditorText: $("#fileEditorText"),
  fileEditorStatus: $("#fileEditorStatus"),
  fileEditorSave: $("#fileEditorSave"),
  fileEditorCancel: $("#fileEditorCancel"),
  fileEditorClose: $("#fileEditorClose"),
  fileEditorResizeHandle: $("#fileEditorResizeHandle"),
  toast: $("#toast"),
  toastMessage: $("#toastMessage"),
  toastClose: $("#toastClose"),
  undoRecovery: $("#undoRecovery"),
  redoRecovery: $("#redoRecovery"),
  themeToggle: $("#themeToggle"),
  graphModeLabel: $("#graphModeLabel"),
};

window.Forkline = {
  storageKeys: {
    recentRepo: recentRepoStorageKey,
    recoveryPolicy: recoveryPolicyStorageKey,
    locale: localeStorageKey,
  },
  constants: {
    graphWidth,
    laneX,
    rowH,
    inspectorTabs,
  },
  state,
  els,
};

const DESKTOP_RECOVERY_DRAFT_SAVE_DELAY_MS = 600;
let lastDesktopRecoveryStateSignature = "";
let lastDesktopRecoveryDraftSignature = "";
let desktopRecoveryDraftReady = false;
let desktopRecoveryDraftSaveTimer = 0;
let pendingDesktopRecoveryFileDraft = null;

function desktopRecoveryCommitDraft() {
  const summary = String(els.commitSummary?.value || "");
  const body = String(els.commitBody?.value || "");
  const amend = Boolean(els.amendToggle?.checked);
  return summary.trim() || body.trim() || amend ? { summary, body, amend } : null;
}

function desktopRecoveryFileDraft() {
  const editor = state.fileEditor;
  const editorDirty = typeof fileEditorDirty === "function" && fileEditorDirty();
  const recoverySnapshotChanged = Boolean(editor?.recoverySnapshotChanged);
  if (
    editor
    && !editor.loading
    && editor.repoPath === repoPathSnapshot()
    && editor.file
    && (editorDirty || recoverySnapshotChanged)
  ) {
    const view = typeof captureFileEditorView === "function" ? captureFileEditorView(editor) : null;
    return {
      file: String(editor.file || ""),
      previousFile: String(editor.previousFile || ""),
      snapshot: String(editor.recoveryDraftSnapshot || editor.snapshot || ""),
      content: typeof fileEditorValue === "function" ? fileEditorValue() : String(els.fileEditorText?.value || ""),
      ...(view ? { view } : {}),
    };
  }
  return pendingDesktopRecoveryFileDraft;
}

function captureDesktopRecoveryDraft() {
  const repoPath = repoPathSnapshot();
  if (!repoPath || state.data?.repo?.isSample) return null;
  const commit = desktopRecoveryCommitDraft();
  const fileEditor = desktopRecoveryFileDraft();
  if (!commit && !fileEditor) return null;
  return {
    repoPath,
    ...(commit ? { commit } : {}),
    ...(fileEditor ? { fileEditor } : {}),
  };
}

async function saveDesktopRecoveryDraft() {
  const bridge = window.forklineDesktop;
  if (!desktopRecoveryDraftReady || typeof bridge?.saveRecoveryDraft !== "function") return;
  const draft = captureDesktopRecoveryDraft();
  const signature = JSON.stringify(draft);
  if (signature === lastDesktopRecoveryDraftSignature) return;
  try {
    const saved = await bridge.saveRecoveryDraft(draft);
    if (saved !== false) lastDesktopRecoveryDraftSignature = signature;
  } catch {}
}

function scheduleDesktopRecoveryDraftSave() {
  if (!desktopRecoveryDraftReady || desktopRecoveryDraftSaveTimer) return;
  if (typeof window.forklineDesktop?.saveRecoveryDraft !== "function") return;
  desktopRecoveryDraftSaveTimer = setTimeout(() => {
    desktopRecoveryDraftSaveTimer = 0;
    saveDesktopRecoveryDraft();
  }, DESKTOP_RECOVERY_DRAFT_SAVE_DELAY_MS);
}

async function restoreDesktopRecoveryDraft() {
  const bridge = window.forklineDesktop;
  if (typeof bridge?.readRecoveryDraft !== "function") {
    desktopRecoveryDraftReady = true;
    return false;
  }

  let draft = null;
  try {
    draft = await bridge.readRecoveryDraft();
  } catch {}
  if (!draft) {
    desktopRecoveryDraftReady = true;
    lastDesktopRecoveryDraftSignature = JSON.stringify(null);
    reportDesktopRecoveryState();
    return false;
  }
  if (String(draft.repoPath || "") !== repoPathSnapshot()) {
    toast(t("检测到其他仓库的页面恢复草稿，未自动应用到当前仓库。"));
    return false;
  }

  lastDesktopRecoveryDraftSignature = JSON.stringify(draft);
  let restored = false;
  if (draft.commit) {
    els.commitSummary.value = String(draft.commit.summary || "");
    els.commitBody.value = String(draft.commit.body || "");
    els.amendToggle.checked = Boolean(draft.commit.amend);
    updateAmendMode();
    restored = true;
  }

  pendingDesktopRecoveryFileDraft = draft.fileEditor || null;
  if (draft.fileEditor?.file) {
    try {
      const opened = await openFileEditorLazy(
        draft.fileEditor.file,
        draft.fileEditor.previousFile || "",
        { force: true, recoveryDraft: draft.fileEditor, restoreView: draft.fileEditor.view || null }
      );
      if (opened) {
        pendingDesktopRecoveryFileDraft = null;
        restored = true;
      }
    } catch (error) {
      toast(error.message);
    }
  }

  desktopRecoveryDraftReady = true;
  reportDesktopRecoveryState();
  if (restored) toast(t("已恢复页面停止前的未保存内容"));
  return restored;
}

function reportDesktopRecoveryState() {
  if (!desktopRecoveryDraftReady) return;
  scheduleDesktopRecoveryDraftSave();
  const bridge = window.forklineDesktop;
  if (typeof bridge?.reportRecoveryState !== "function") return;
  const editorDirty = Boolean(
    (typeof fileEditorDirty === "function" && fileEditorDirty())
    || state.fileEditor?.recoverySnapshotChanged
  );
  const value = {
    repoPath: repoPathSnapshot(),
    fileEditorDirty: editorDirty,
    fileEditorFile: editorDirty ? String(state.fileEditor?.file || pendingDesktopRecoveryFileDraft?.file || "") : "",
    commitDraftDirty: Boolean(desktopRecoveryCommitDraft()),
  };
  const signature = JSON.stringify(value);
  if (signature === lastDesktopRecoveryStateSignature) return;
  lastDesktopRecoveryStateSignature = signature;
  try {
    bridge.reportRecoveryState(value);
  } catch {}
}

