// Keeps startup-safe Git state helpers eager while loading write actions on first use.
const gitActionsResource = "./js/features/git-actions.js";
const gitActionMethodNames = [
  "selectRef",
  "checkoutBranch",
  "checkoutRemoteBranch",
  "mergeBranchRef",
  "rebaseOntoRef",
  "runAction",
  "runRepoOperation",
  "fillLatestCommitMessage",
  "runUpstreamAction",
  "runRemoteAction",
  "runRemoteMenuAction",
  "createStashFromSelection",
  "ignoreWorktreePath",
  "runSingleFileAction",
  "runFileBatchAction",
  "rewordSelectedCommit",
];

let gitActionsLoadPromise = null;

function gitActionsImplementation() {
  return window.ForklineGitActions || null;
}

function gitActionsLoaded() {
  const implementation = gitActionsImplementation();
  return Boolean(implementation && gitActionMethodNames.every((name) => typeof implementation[name] === "function"));
}

function gitActionsResourceElement() {
  return document.querySelector("[data-git-actions-resource]");
}

function gitActionsLoadError() {
  return t("Git 操作资源加载失败，请重试。");
}

function loadGitActionsScript() {
  if (gitActionsLoaded()) return Promise.resolve();
  const existing = gitActionsResourceElement();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = gitActionsResource;
    script.async = false;
    script.dataset.gitActionsResource = "true";
    script.onload = () => {
      if (!gitActionsLoaded()) {
        script.remove();
        reject(new Error(gitActionsLoadError()));
        return;
      }
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(gitActionsLoadError()));
    };
    if (!existing) document.head.appendChild(script);
  });
}

async function ensureGitActionsLoaded() {
  if (gitActionsLoaded()) return;
  if (!gitActionsLoadPromise) gitActionsLoadPromise = loadGitActionsScript();
  try {
    await gitActionsLoadPromise;
  } catch (error) {
    gitActionsLoadPromise = null;
    throw error;
  }
}

async function runLazyGitAction(method, args) {
  const repoPath = repoPathSnapshot();
  await ensureGitActionsLoaded();
  if (!isCurrentRepoPath(repoPath)) return false;
  return gitActionsImplementation()[method](...args);
}

async function selectRef(ref) {
  return runLazyGitAction("selectRef", [ref]);
}

async function checkoutBranch(branch, button) {
  return runLazyGitAction("checkoutBranch", [branch, button]);
}

async function checkoutRemoteBranch(remoteRef, button) {
  return runLazyGitAction("checkoutRemoteBranch", [remoteRef, button]);
}

async function mergeBranchRef(ref) {
  return runLazyGitAction("mergeBranchRef", [ref]);
}

async function rebaseOntoRef(ref) {
  return runLazyGitAction("rebaseOntoRef", [ref]);
}

async function runAction(action) {
  return runLazyGitAction("runAction", [action]);
}

async function runRepoOperation(action, button) {
  return runLazyGitAction("runRepoOperation", [action, button]);
}

async function fillLatestCommitMessage() {
  return runLazyGitAction("fillLatestCommitMessage", []);
}

async function runUpstreamAction(action, ref = "", button = null) {
  return runLazyGitAction("runUpstreamAction", [action, ref, button]);
}

async function runRemoteAction(action, remoteName = "", button = null) {
  return runLazyGitAction("runRemoteAction", [action, remoteName, button]);
}

async function runRemoteMenuAction(action) {
  return runLazyGitAction("runRemoteMenuAction", [action]);
}

async function createStashFromSelection(files = null) {
  return runLazyGitAction("createStashFromSelection", [files]);
}

async function ignoreWorktreePath(action, file) {
  return runLazyGitAction("ignoreWorktreePath", [action, file]);
}

async function runSingleFileAction(action, file) {
  return runLazyGitAction("runSingleFileAction", [action, file]);
}

async function runFileBatchAction(action, scope, button) {
  return runLazyGitAction("runFileBatchAction", [action, scope, button]);
}

async function rewordSelectedCommit(form) {
  return runLazyGitAction("rewordSelectedCommit", [form]);
}

function rememberCheckoutStash(stash) {
  if (!stash?.message || !state.data?.repo?.path) return;
  const records = checkoutStashRecords().filter((item) => item.message !== stash.message);
  records.unshift({ ...stash, repoPath: state.data.repo.path });
  const storage = (typeof window === "object" && window.ForklinePreferenceStorage?.storage) || localStorage;
  storage.setItem("forkline-checkout-stashes", JSON.stringify(records.slice(0, 12)));
}

function checkoutStashRecords() {
  try {
    const storage = (typeof window === "object" && window.ForklinePreferenceStorage?.storage) || localStorage;
    const data = JSON.parse(storage.getItem("forkline-checkout-stashes") || "[]");
    return Array.isArray(data) ? data.filter((item) => item?.message && item?.branch) : [];
  } catch {
    return [];
  }
}

function forgetCheckoutStash(stash) {
  if (!stash?.message) return;
  const records = checkoutStashRecords().filter((item) => item.message !== stash.message);
  const storage = (typeof window === "object" && window.ForklinePreferenceStorage?.storage) || localStorage;
  storage.setItem("forkline-checkout-stashes", JSON.stringify(records));
}

async function maybeRestoreCheckoutStash(branch) {
  if (!branch || state.data?.repo?.isSample) return;
  const repoPath = repoPathSnapshot();
  if (!isCurrentCheckoutStashContext(repoPath, branch)) return;
  let stash = checkoutStashRecords().find((item) => item.repoPath === state.data.repo.path && item.branch === branch);
  if (stash && !stash.sha) {
    forgetCheckoutStash(stash);
    stash = null;
  }
  if (!stash) {
    const found = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "findCheckoutStash", branch }) });
    if (!isCurrentCheckoutStashContext(repoPath, branch)) return;
    stash = found.stash;
  }
  if (!stash?.message) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "restoreCheckoutStash", branch, message: stash.message, sha: stash.sha || "", ...currentBranchSnapshotPayload() }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    forgetCheckoutStash(stash);
    toast(result.output || t("已恢复储藏的本地更改"));
    const data = await loadStateForRepoPath(repoPath);
    if (!data) return;
    state.commitDetails.clear();
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    if (isMissingCheckoutStashError(error)) forgetCheckoutStash(stash);
    toast(error.message);
  }
}

function isCurrentCheckoutStashContext(repoPath, branch) {
  if (!isCurrentRepoPath(repoPath) || state.data?.repo?.branch !== branch) return false;
  return !state.selectedRef || state.selectedRef === branch;
}

function isMissingCheckoutStashError(error) {
  const message = String(error?.message || error || "");
  return [
    "没有找到可恢复的 Forkline 储藏",
    "这条切换储藏已经不存在或已经变化",
    t("没有找到可恢复的 Forkline 储藏"),
    t("这条切换储藏已经不存在或已经变化"),
  ].some((text) => message.includes(text));
}

function currentBranchSnapshotPayload() {
  const payload = {
    expectedBranch: state.data?.repo?.branch || "",
    expectedHead: state.data?.repo?.headSha || "",
    ...worktreeSnapshotPayload(),
    ...operationSnapshotPayload(),
  };
  const upstream = state.data?.sync?.upstream || "";
  payload.expectedUpstream = upstream;
  payload.expectedUpstreamSha = state.data?.sync?.upstreamSha || "";
  const remote = upstream ? remoteForUpstream(upstream) : defaultSyncRemote();
  if (upstream && remote?.name) {
    Object.assign(payload, {
      expectedUpstreamRemote: remote.name,
      expectedUpstreamFetchUrl: remote.fetchUrl || "",
      expectedUpstreamPushUrl: remote.pushUrl || "",
      expectedUpstreamPushUrls: remotePushUrls(remote),
    });
  } else if (!upstream) {
    payload.expectedDefaultRemote = remote?.name || "";
    if (remote?.name) {
      Object.assign(payload, {
        expectedDefaultRemoteFetchUrl: remote.fetchUrl || "",
        expectedDefaultRemotePushUrl: remote.pushUrl || "",
        expectedDefaultRemotePushUrls: remotePushUrls(remote),
      });
    }
  }
  return payload;
}

function operationSnapshotPayload() {
  const operation = state.data?.repo?.operation || {};
  return operation?.type && operation?.snapshot
    ? { expectedOperationType: operation.type, expectedOperationSnapshot: operation.snapshot }
    : {};
}

function remoteForUpstream(upstream) {
  if (!upstream) return null;
  return findRemote(splitRemoteBranchRef(upstream).remote);
}

function defaultSyncRemote() {
  const remotes = syncRemotes();
  return remotes.find((remote) => remote.name === "origin") || remotes[0] || null;
}

function syncRemotes() {
  return state.data?.sync?.remotes || [];
}

function findRemote(name) {
  return syncRemotes().find((remote) => remote.name === name) || null;
}

function remoteConfigSnapshotPayload(remote) {
  return {
    expectedFetchUrl: remote?.fetchUrl || "",
    expectedPushUrl: remote?.pushUrl || "",
    expectedPushUrls: remotePushUrls(remote),
  };
}

function remotePushUrls(remote) {
  const urls = Array.isArray(remote?.pushUrls) ? remote.pushUrls.map((url) => String(url || "")) : [];
  return urls.length ? urls : [remote?.pushUrl || ""];
}

function updateAmendMode() {
  const canAmend = canAmendCurrentHead();
  if (!canAmend && els.amendToggle.checked) els.amendToggle.checked = false;
  els.amendToggle.disabled = !canAmend;
  els.amendToggle.title = canAmend ? t("追加到上一次提交") : t("当前分支还没有上一次提交");
  const enabled = canAmend && Boolean(els.amendToggle.checked);
  els.commitSubmit.textContent = enabled ? t("追加提交") : t("创建提交");
  els.commitSubmit.title = enabled ? t("追加到上一次提交") : t("创建新的提交");
}

function canAmendCurrentHead() {
  return Boolean(state.data?.repo?.headSha && !state.data?.sync?.unborn);
}

function currentHeadCommitForAmend() {
  const headSha = state.data?.repo?.headSha || "";
  if (!headSha) return null;
  return state.data?.commits?.find((commit) => commit.sha === headSha) || { sha: headSha, short: headSha.slice(0, 7), message: "" };
}

function selectedContextFiles() {
  const files = state.data?.workingFiles || [];
  const selected = new Set();
  for (const key of state.selectedChanges) {
    const [, ...pathParts] = key.split(":");
    const filePath = pathParts.join(":");
    if (filePath && files.some((file) => file.file === filePath)) selected.add(filePath);
  }
  if (!selected.size && state.contextFile?.file) selected.add(state.contextFile.file);
  return [...selected];
}

function countFiles(files) {
  return files.reduce(
    (acc, file) => {
      acc[file.state] = (acc[file.state] || 0) + 1;
      return acc;
    },
    { M: 0, A: 0, D: 0, R: 0, C: 0 }
  );
}
