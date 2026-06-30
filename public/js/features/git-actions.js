// Checkout, merge, rebase, repository operations, remotes, stash, file actions, and commits.
async function selectRef(ref) {
  if (!state.data) return;
  try {
    setInspectorContext(ref ? "branch" : "commit", ref ? "branches" : "details");
    state.selectedRef = ref;
    els.searchInput.value = "";
    state.commitDetails.clear();
    const data = await api(`/api/ref-state?ref=${encodeURIComponent(ref)}`);
    state.data.repo = { ...state.data.repo, ...(data.repo || {}), selectedRef: data.repo?.selectedRef || ref };
    state.data.commits = data.commits || [];
    state.selectedRef = state.data.repo.selectedRef || ref;
    state.selectedSha = state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    toast(ref ? `已查看 ${ref}` : "已显示全部分支");
  } catch (error) {
    toast(error.message);
  }
}

async function checkoutBranch(branch, button) {
  if (!state.data || !branch) return;
  if (branch === state.data.repo.branch) {
    toast("已经在这个分支上");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  let mode = "keep";
  if (!state.data.repo.isSample && dirtyCount) {
    mode = await chooseCheckoutMode(branch, dirtyCount);
    if (!mode) return;
  } else if (!state.data.repo.isSample && !confirm(`确认切换到分支：${branch}？`)) {
    return;
  }
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "checkoutBranch", branch, mode }) });
    rememberCheckoutStash(result.stash);
    toast(result.output || `已切换到 ${branch}`);
    state.commitDetails.clear();
    state.selectedRef = branch;
    state.data = await api(`/api/state?ref=${encodeURIComponent(branch)}`);
    state.selectedRef = state.data.repo.selectedRef || branch;
    state.selectedSha = state.data.commits[0]?.sha || "";
    els.searchInput.value = "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function checkoutRemoteBranch(remoteRef, button) {
  if (!state.data || !remoteRef) return;
  const localBranch = remoteCheckoutBranch(remoteRef);
  if (localBranch && localBranch === state.data.repo.branch) {
    toast("对应的本地分支已经是当前分支");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  let mode = "keep";
  const targetText = localBranch ? `${remoteRef} -> ${localBranch}` : remoteRef;
  if (!state.data.repo.isSample && dirtyCount) {
    mode = await chooseCheckoutMode(targetText, dirtyCount);
    if (!mode) return;
  } else if (!state.data.repo.isSample && !confirm(`确认将远端分支签出为本地分支：${targetText}？`)) {
    return;
  }
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "checkoutRemoteBranch", ref: remoteRef, mode }),
    });
    const nextBranch = result.branch || localBranch || remoteRef;
    rememberCheckoutStash(result.stash);
    toast(result.output || `已签出 ${nextBranch}`);
    state.commitDetails.clear();
    state.selectedRef = nextBranch;
    state.data = await api(`/api/state?ref=${encodeURIComponent(nextBranch)}`);
    state.selectedRef = state.data.repo.selectedRef || nextBranch;
    state.selectedSha = state.data.commits[0]?.sha || "";
    els.searchInput.value = "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
    await maybeRestoreCheckoutStash(state.data.repo.branch);
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function mergeBranchRef(ref) {
  if (!state.data || !ref) return;
  const current = state.data.repo.branch || "当前分支";
  if (ref === current) {
    toast("不能把当前分支合并到自己");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? `\n\n当前还有 ${dirtyCount} 个未提交改动，Git 可能会阻止合并。建议先提交或储藏。` : "";
  if (!state.data.repo.isSample && !confirm(`确认将 ${ref} 合并到当前分支 ${current}？${dirtyNote}`)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "mergeRef", ref }) });
    toast(result.output || `已合并 ${ref}`);
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
    await refreshWorktree(true);
  }
}

async function rebaseOntoRef(ref) {
  if (!state.data || !ref) return;
  const current = state.data.repo.branch || "当前分支";
  if (ref === current) {
    toast("不能把当前分支变基到自己");
    return;
  }
  const dirtyCount = (state.data.workingFiles || []).length;
  const dirtyNote = dirtyCount ? `\n\n当前还有 ${dirtyCount} 个未提交改动，Git 会阻止变基。请先提交或储藏。` : "";
  const message = `确认把当前分支 ${current} 变基到 ${ref}？\n\n命令：git rebase ${ref}\n这会重写当前分支尚未合入 ${ref} 的提交 SHA。${dirtyNote}`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "rebaseOntoRef", ref }) });
    toast(result.output || `已变基到 ${ref}`);
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
    await refreshWorktree(true);
  }
}

function chooseCheckoutMode(branch, count) {
  els.checkoutModalText.textContent = `切换到 ${branch} 前，当前工作区有 ${count} 个未提交改动。`;
  els.checkoutModal.classList.add("show");
  els.checkoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  return new Promise((resolve) => {
    const cleanup = (mode) => {
      els.checkoutModal.classList.remove("show");
      els.checkoutModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      els.checkoutModal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(mode);
    };
    const onClick = (event) => {
      const button = event.target.closest("[data-checkout-mode]");
      if (!button) return;
      const mode = button.dataset.checkoutMode;
      cleanup(mode === "cancel" ? "" : mode);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") cleanup("");
    };
    els.checkoutModal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
  });
}

function rememberCheckoutStash(stash) {
  if (!stash?.message || !state.data?.repo?.path) return;
  const records = checkoutStashRecords().filter((item) => item.message !== stash.message);
  records.unshift({ ...stash, repoPath: state.data.repo.path });
  localStorage.setItem("forkline-checkout-stashes", JSON.stringify(records.slice(0, 12)));
}

function checkoutStashRecords() {
  try {
    const data = JSON.parse(localStorage.getItem("forkline-checkout-stashes") || "[]");
    return Array.isArray(data) ? data.filter((item) => item?.message && item?.branch) : [];
  } catch {
    return [];
  }
}

function forgetCheckoutStash(stash) {
  if (!stash?.message) return;
  const records = checkoutStashRecords().filter((item) => item.message !== stash.message);
  localStorage.setItem("forkline-checkout-stashes", JSON.stringify(records));
}

async function maybeRestoreCheckoutStash(branch) {
  if (!branch || state.data?.repo?.isSample) return;
  let stash = checkoutStashRecords().find((item) => item.repoPath === state.data.repo.path && item.branch === branch);
  if (!stash) {
    const found = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "findCheckoutStash", branch }) });
    stash = found.stash;
  }
  if (!stash?.message || state.ignoredCheckoutStashes.has(stash.message)) return;
  const restore = await chooseStashRestore(stash);
  if (!restore) {
    state.ignoredCheckoutStashes.add(stash.message);
    return;
  }
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "restoreCheckoutStash", branch, message: stash.message }),
    });
    forgetCheckoutStash(stash);
    toast(result.output || "已恢复储藏的本地更改");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    if (isMissingCheckoutStashError(error)) {
      forgetCheckoutStash(stash);
      state.ignoredCheckoutStashes.add(stash.message);
    }
    toast(error.message);
  }
}

function isMissingCheckoutStashError(error) {
  return String(error?.message || error || "").includes("没有找到可恢复的 Forkline 储藏");
}

function chooseStashRestore(stash) {
  els.stashRestoreText.textContent = `${stash.label || stash.message} 可以恢复到当前分支。`;
  els.stashRestoreModal.classList.add("show");
  els.stashRestoreModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  return new Promise((resolve) => {
    const cleanup = (restore) => {
      els.stashRestoreModal.classList.remove("show");
      els.stashRestoreModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      els.stashRestoreModal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(restore);
    };
    const onClick = (event) => {
      const button = event.target.closest("[data-stash-restore]");
      if (!button) return;
      cleanup(button.dataset.stashRestore === "restore");
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") cleanup(false);
    };
    els.stashRestoreModal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
  });
}

async function runAction(action) {
  if (!state.data) return;
  const names = {
    fetch: "抓取",
    pull: "拉取",
    pullRebase: "变基拉取",
    push: "推送",
    forcePushLease: "安全强推",
    stageAll: "暂存全部",
    discardAll: "丢弃全部",
    commit: "创建提交",
    amendCommit: "追加提交",
  };
  if (!state.data.repo.isSample && !confirm(actionConfirmMessage(action, names[action]))) return;
  try {
    const payload = { action };
    if (action === "commit" || action === "amendCommit") {
      payload.summary = els.commitSummary.value.trim();
      payload.body = els.commitBody.value.trim();
    }
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    toast(result.output || `${names[action]}完成`);
    if (action === "commit") {
      els.commitSummary.value = "";
      els.commitBody.value = "";
    }
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  }
}

async function runRepoOperation(action, button) {
  if (!state.data) return;
  const messages = {
    continueRevert: "确认继续还原？请先确认所有冲突文件已经解决并暂存。",
    abortRevert: "确认中止还原？这会放弃当前这次还原，并回到还原前的状态。",
    continueCherryPick: "确认继续挑选？请先确认所有冲突文件已经解决并暂存。",
    skipCherryPick: "确认跳过当前挑选提交？这会放弃当前这一个提交的挑选，继续处理后续状态。",
    abortCherryPick: "确认中止挑选？这会放弃当前这次 cherry-pick，并回到挑选前的状态。",
    continueMerge: "确认继续合并？请先确认所有冲突文件已经解决并暂存。",
    abortMerge: "确认中止合并？这会放弃当前这次合并，并回到合并前的状态。",
    continueRebase: "确认继续变基？请先确认所有冲突文件已经解决并暂存。",
    skipRebase: "确认跳过当前变基提交？这会放弃当前这一个提交的变基，继续处理后续提交。",
    abortRebase: "确认中止变基？这会放弃当前这次 rebase，并回到变基前的状态。",
  };
  if (!state.data.repo.isSample && !confirm(messages[action] || "确认继续？")) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action }) });
    toast(result.output || "操作已完成");
    state.commitDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function fillLatestCommitMessage() {
  const commit = state.data?.commits?.[0];
  if (!commit) {
    els.amendToggle.checked = false;
    toast("没有可追加的上一次提交");
    return;
  }
  try {
    const detail = await api(`/api/commit?sha=${encodeURIComponent(commit.sha)}`);
    const message = commitMessageParts(commit, detail);
    els.commitSummary.value = message.summary;
    els.commitBody.value = message.body;
  } catch (error) {
    els.amendToggle.checked = false;
    toast(error.message);
  }
}

function updateAmendMode() {
  const enabled = Boolean(els.amendToggle.checked);
  els.commitSubmit.textContent = enabled ? "追加提交" : "创建提交";
  els.commitSubmit.title = enabled ? "追加到上一次提交" : "创建新的提交";
}

function actionConfirmMessage(action, name) {
  if (action === "amendCommit") return "确认追加到上一次提交？这会重写最新提交 SHA。";
  if (action === "discardAll") return "确认丢弃全部未提交更改？这会清空已暂存、未暂存和未跟踪文件，无法撤销。";
  if (action === "pullRebase") {
    const sync = state.data?.sync || {};
    const branch = sync.branch || state.data?.repo?.branch || "当前分支";
    const upstream = sync.upstream || "未设置 upstream";
    const stateText = `领先 ${sync.ahead || 0}，落后 ${sync.behind || 0}${sync.upstreamGone ? "，上游丢失" : ""}`;
    return `确认变基拉取当前分支：${branch}？\n\n目标：${upstream}\n当前状态：${stateText}\n命令：git pull --rebase\n\n这会先拉取远端提交，再把本地未推送提交重新应用到远端之后；本地这些提交的 SHA 可能会改变。遇到冲突时，工作区会显示“继续变基 / 跳过变基 / 中止变基”。`;
  }
  if (action === "push") {
    const branch = state.data?.repo?.branch || "当前分支";
    const info = state.data?.branchInfo?.[branch] || {};
    const sync = state.data?.sync || {};
    const guard = syncPushGuard(sync);
    if (guard.blocked) {
      return `${guard.text}\n\nForkline 会阻止这次普通推送。通常请先使用“变基拉取”；只有确认要改写远端历史时，再使用“安全强推”。`;
    }
    if (info.upstream) {
      return `确认推送当前分支：${branch}？\n\n目标：${info.upstream}\n当前状态：领先 ${info.ahead || 0}，落后 ${info.behind || 0}${info.upstreamGone ? "，上游丢失" : ""}\n命令：git push`;
    }
    return `当前分支 ${branch} 没有 upstream。确认推送并自动设置 upstream？\n\n默认命令：git push -u origin ${branch}\n如果仓库没有 origin，会使用第一个远端。`;
  }
  if (action === "forcePushLease") {
    const branch = state.data?.repo?.branch || "当前分支";
    const info = state.data?.branchInfo?.[branch] || {};
    const upstream = info.upstream || "未设置 upstream";
    const divergence = info.upstream
      ? `当前状态：领先 ${info.ahead || 0}，落后 ${info.behind || 0}${info.upstreamGone ? "，上游丢失" : ""}`
      : "当前分支没有 upstream，后端会拒绝安全强推。";
    return `确认安全强推当前分支：${branch}？\n\n目标：${upstream}\n命令：git push --force-with-lease\n${divergence}\n\n这会改写远端分支历史。--force-with-lease 会在远端分支自你上次抓取后又变化时拒绝推送；如果不确定，请先抓取并检查远端提交。`;
  }
  return `确认执行：${name}？`;
}

async function runUpstreamAction(action, ref = "", button = null) {
  if (!state.data) return;
  const branch = state.data?.repo?.branch || "当前分支";
  const selectedRef = ref || els.detailBody.querySelector("[data-upstream-select]")?.value || "";
  let payload = null;
  let message = "";
  if (action === "set") {
    if (!selectedRef) {
      toast("请选择远端分支");
      return;
    }
    payload = { action: "setUpstream", ref: selectedRef };
    message = `确认设置当前分支 upstream？\n\n当前分支：${branch}\n目标：${selectedRef}\n命令：git branch --set-upstream-to=${selectedRef} ${branch}`;
  } else if (action === "unset") {
    const upstream = state.data?.sync?.upstream || state.data?.branchInfo?.[branch]?.upstream || "";
    payload = { action: "unsetUpstream" };
    message = `确认取消当前分支 upstream？\n\n当前分支：${branch}\n原 upstream：${upstream || "未设置"}\n命令：git branch --unset-upstream ${branch}`;
  }
  if (!payload) return;
  if (!state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    toast(result.output || "upstream 操作完成");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedTab = "sync";
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRemoteAction(action, remoteName = "", button = null) {
  if (!state.data) return;
  const remote = findRemote(remoteName);
  let payload = null;
  let message = "";
  if (action === "add") {
    const existingNames = syncRemotes().map((item) => item.name);
    const defaultName = existingNames.includes("origin") ? "upstream" : "origin";
    const nameInput = prompt("远端名称：", defaultName);
    if (nameInput === null) return;
    const name = cleanPromptValue(nameInput, "远端名称");
    if (!name) return;
    const urlInput = prompt("远端 URL：", "git@github.com:用户名/仓库名.git");
    if (urlInput === null) return;
    const url = cleanPromptValue(urlInput, "远端 URL");
    if (!url) return;
    payload = { action: "addRemote", name, url };
    message = `确认添加远端：${name}？\n\nURL：${url}\n命令：git remote add ${name} ${url}`;
  } else if (action === "edit") {
    if (!remote?.name) return;
    const currentUrl = remote.pushUrl || remote.fetchUrl || "";
    const urlInput = prompt(`修改远端 ${remote.name} 的 URL：`, currentUrl);
    if (urlInput === null) return;
    const url = cleanPromptValue(urlInput, "远端 URL");
    if (!url) return;
    payload = { action: "setRemoteUrl", name: remote.name, url };
    message = `确认修改远端 URL：${remote.name}？\n\n新 URL：${url}\n命令：git remote set-url ${remote.name} ${url}`;
  } else if (action === "delete") {
    if (!remote?.name) return;
    payload = { action: "deleteRemote", name: remote.name };
    message = `确认删除远端：${remote.name}？\n\n命令：git remote remove ${remote.name}\n这个操作只会删除当前仓库里的远端配置，不会删除 GitHub 或服务器上的仓库。`;
  } else if (action === "test") {
    if (!remote?.name) return;
    payload = { action: "testRemote", name: remote.name };
    message = "";
  } else if (action === "fetch") {
    if (!remote?.name) return;
    payload = { action: "fetchRemote", name: remote.name };
    message = `确认抓取远端：${remote.name}？\n\n命令：git fetch ${remote.name} --prune`;
  }
  if (!payload) return;
  if (message && !state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    if (action === "test") {
      const check = result.remoteCheck || {};
      state.remoteCheck = {
        ...check,
        status: "success",
        remote: check.remote || remote.name,
        heads: check.heads ?? 0,
        fetchUrl: check.fetchUrl || remote.fetchUrl || "",
        pushUrl: check.pushUrl || remote.pushUrl || remote.fetchUrl || "",
        command: check.command || `git ls-remote --heads ${check.remote || remote.name}`,
        output: check.output || result.output || "远端连接正常",
        checkedAt: remoteCheckTime(),
      };
    } else if (action === "add" || action === "edit" || action === "delete") {
      state.remoteCheck = null;
    }
    toast(result.output || "远端操作完成");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedTab = "sync";
    renderAll();
  } catch (error) {
    if (action === "test" && remote?.name) {
      const check = error.remoteCheck || {};
      state.remoteCheck = {
        ...check,
        status: "error",
        remote: check.remote || remote.name,
        fetchUrl: check.fetchUrl || remote.fetchUrl || "",
        pushUrl: check.pushUrl || remote.pushUrl || remote.fetchUrl || "",
        command: check.command || `git ls-remote --heads ${remote.name}`,
        output: check.output || error.message,
        checkedAt: remoteCheckTime(),
      };
      state.selectedTab = "sync";
      renderInspector();
    }
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRemoteMenuAction(action) {
  const remote = state.contextRemote;
  hideRemoteContextMenu();
  if (!remote?.name) return;
  if (action === "copyFetch" || action === "copyPush") {
    const url = action === "copyFetch" ? remote.fetchUrl : remote.pushUrl || remote.fetchUrl;
    if (!url) {
      toast("这个远端没有可复制的 URL");
      return;
    }
    await copyText(url);
    toast(action === "copyFetch" ? "已复制 fetch URL" : "已复制 push URL");
    return;
  }
  if (action === "copyCheckCommand") {
    await copyText(`git ls-remote --heads ${remote.name}`);
    toast("已复制诊断命令");
    return;
  }
  const mapped = action === "test" || action === "fetch" || action === "edit" || action === "delete" ? action : "";
  if (mapped) await runRemoteAction(mapped, remote.name);
}

function syncRemotes() {
  return state.data?.sync?.remotes || [];
}

function findRemote(name) {
  return syncRemotes().find((remote) => remote.name === name) || null;
}

function cleanPromptValue(value, label) {
  const text = String(value || "").trim();
  if (!text) toast(`请填写${label}`);
  return text;
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

async function createStashFromSelection(files = null) {
  if (!state.data) return;
  const selectedOnly = Array.isArray(files);
  const stashFiles = selectedOnly ? files : [];
  const allFiles = state.data.workingFiles || [];
  if (!allFiles.length) {
    toast("没有可储藏的未提交更改");
    return;
  }
  if (selectedOnly && !stashFiles.length) {
    toast("没有选中的文件可储藏");
    return;
  }
  const targetText = selectedOnly ? `${stashFiles.length} 个所选文件` : "全部未提交更改";
  const defaultMessage = `Forkline: 手动储藏 ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
  const message = state.data.repo.isSample ? defaultMessage : prompt(`为${targetText}填写储藏说明：`, defaultMessage);
  if (message === null) return;
  const trimmedMessage = String(message || "").trim() || defaultMessage;
  if (!state.data.repo.isSample && !confirm(`确认储藏${targetText}？\n\n说明：${trimmedMessage}`)) return;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "createStash", message: trimmedMessage, files: selectedOnly ? stashFiles : [] }),
    });
    toast("已创建储藏，工作区更改已移到右侧“储藏”列表");
    state.stashDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedStash = state.data.stashes?.[0]?.ref || state.selectedStash;
    state.selectedTab = "stashes";
    renderAll();
  } catch (error) {
    toast(error.message);
  }
}

async function ignoreWorktreePath(action, file) {
  if (!state.data || !file) return;
  const mode = action === "ignoreDirectory" ? "directory" : "file";
  const target = mode === "directory" ? worktreeDirectoryForFile(file) : file;
  if (!target) {
    toast("根目录文件没有可忽略的所在目录");
    return;
  }
  const command = mode === "directory" ? `/${target}/` : `/${file}`;
  const message =
    mode === "directory"
      ? `确认把目录加入 .gitignore？\n\n目录：${target}/\n规则：${command}\n\n这个操作只写入 .gitignore，不会删除本地文件。`
      : `确认把文件加入 .gitignore？\n\n文件：${file}\n规则：${command}\n\n这个操作只写入 .gitignore，不会删除本地文件。`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "ignoreWorktreePath", file, mode }) });
    toast(result.output || "已更新 .gitignore");
    state.selectedChanges.delete(changeKey("unstaged", file));
    state.selectedChanges.delete(changeKey("staged", file));
    const data = await api("/api/worktree");
    state.data.workingFiles = data.workingFiles || [];
    state.data.repo.operation = data.operation || null;
    renderWorkingFiles();
    renderStage();
  } catch (error) {
    toast(error.message);
  }
}

function worktreeDirectoryForFile(file) {
  const normalized = String(file || "").replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "";
}

async function runSingleFileAction(action, file) {
  if (!state.data || !file) return;
  const names = {
    stageFile: "暂存",
    unstageFile: "取消暂存",
    discardWorktreeFile: "丢弃",
    discardStagedFile: "丢弃",
    resolveConflictOurs: "已使用当前版本解决冲突",
    resolveConflictTheirs: "已使用对方版本解决冲突",
  };
  if (isDiscardAction(action) && !state.data.repo.isSample && !confirm(discardConfirmMessage(action, [file]))) return;
  if (isConflictResolveAction(action) && !state.data.repo.isSample && !confirm(conflictResolveConfirmMessage(action, file))) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(singleFileActionPayload(action, file)) });
    toast(result.output || `${names[action] || "操作"}完成`);
    state.selectedChanges.delete(changeKey("unstaged", file));
    state.selectedChanges.delete(changeKey("staged", file));
    const data = await api("/api/worktree");
    state.data.workingFiles = data.workingFiles || [];
    state.data.repo.operation = data.operation || null;
    syncFileSelectionAfterAction(action, [file], state.data.workingFiles);
    renderWorkingFiles();
    renderStage();
  } catch (error) {
    toast(error.message);
  }
}

function singleFileActionPayload(action, file) {
  if (action === "resolveConflictOurs") return { action: "resolveConflictFile", side: "ours", file };
  if (action === "resolveConflictTheirs") return { action: "resolveConflictFile", side: "theirs", file };
  return { action, file };
}

function syncFileSelectionAfterAction(action, files, nextFiles) {
  let fallback = null;
  for (const file of files) {
    state.selectedChanges.delete(changeKey("unstaged", file));
    state.selectedChanges.delete(changeKey("staged", file));
    const scope = nextScopeAfterFileAction(action, file, nextFiles);
    if (!scope) continue;
    state.selectedChanges.add(changeKey(scope, file));
    fallback = fallback || { file, scope };
    if (state.selectedFile === file) {
      state.selectedFile = file;
      state.workDiffScope = scope;
    }
  }
  if (files.includes(state.selectedFile) && !nextScopeAfterFileAction(action, state.selectedFile, nextFiles)) {
    state.selectedFile = fallback?.file || "";
    state.workDiffScope = fallback?.scope || "unstaged";
  } else if (!state.selectedFile && fallback) {
    state.selectedFile = fallback.file;
    state.workDiffScope = fallback.scope;
  }
}

function nextScopeAfterFileAction(action, file, nextFiles) {
  const matches = (nextFiles || []).filter((item) => item.file === file);
  const hasStaged = matches.some((item) => item.staged);
  const hasUnstaged = matches.some((item) => item.unstaged || (!item.staged && item.unstaged !== false));
  if (action === "stageFile" || isConflictResolveAction(action)) return hasStaged ? "staged" : hasUnstaged ? "unstaged" : "";
  if (action === "unstageFile") return hasUnstaged ? "unstaged" : hasStaged ? "staged" : "";
  if (action === "discardWorktreeFile") return hasStaged ? "staged" : "";
  if (action === "discardStagedFile") return hasUnstaged ? "unstaged" : "";
  return "";
}

function isConflictResolveAction(action) {
  return action === "resolveConflictOurs" || action === "resolveConflictTheirs";
}

function conflictResolveConfirmMessage(action, file) {
  const side = action === "resolveConflictOurs" ? "当前版本（git checkout --ours）" : "对方版本（git checkout --theirs）";
  return `确认使用${side}解决冲突并暂存？\n\n文件：${file}\n这会覆盖此文件里的冲突标记。`;
}

async function runFileBatchAction(action, scope, button) {
  if (!state.data) return;
  const groups = changeGroups(state.data.workingFiles || []);
  const files = selectedFilesInScope(scope, groups[scope] || []).map((file) => file.file);
  if (!files.length) return;
  const names = { stageFile: "暂存", unstageFile: "取消暂存", discardWorktreeFile: "丢弃", discardStagedFile: "丢弃" };
  const name = names[action] || "操作";
  if (isDiscardAction(action) && !state.data.repo.isSample && !confirm(discardConfirmMessage(action, files))) return;
  if (button) button.disabled = true;
  try {
    for (const file of files) {
      await api("/api/action", {
        method: "POST",
        body: JSON.stringify({ action, file }),
      });
      state.selectedChanges.delete(changeKey(scope, file));
    }
    toast(`${name}完成：${files.length} 个文件`);
    const data = await api("/api/worktree");
    state.data.workingFiles = data.workingFiles || [];
    state.data.repo.operation = data.operation || null;
    syncFileSelectionAfterAction(action, files, state.data.workingFiles);
    renderWorkingFiles();
    renderStage();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function isDiscardAction(action) {
  return action === "discardWorktreeFile" || action === "discardStagedFile";
}

function discardConfirmMessage(action, files) {
  const count = files.length;
  const target = count === 1 ? files[0] : `${count} 个文件`;
  if (action === "discardStagedFile") {
    return `确认丢弃已暂存改动：${target}？\n\n这会丢弃暂存区里的改动；如果同一文件还有未暂存内容，会保留在工作区。没有未暂存内容时，文件可能被恢复到 HEAD 或删除，无法撤销。`;
  }
  return `确认丢弃工作区改动：${target}？此操作无法撤销。`;
}

async function rewordSelectedCommit(form) {
  if (!state.data) return;
  const sha = form.dataset.sha || state.selectedSha;
  const commit = state.data.commits.find((item) => item.sha === sha);
  if (!commit) return;
  const summary = form.elements.summary.value.trim();
  const body = form.elements.body.value.trim();
  if (!summary) {
    toast("请填写新的提交摘要");
    return;
  }
  const previousIndex = state.data.commits.findIndex((item) => item.sha === sha);
  const targetName = sha === state.data.commits[0]?.sha ? "最新提交" : "历史提交";
  if (!state.data.repo.isSample && !confirm(`确认修改 ${targetName} ${commit.short} 的提交信息？这会重写相关历史 SHA。`)) return;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "rewordCommit", sha, summary, body }),
    });
    toast(result.output || "提交信息已修改");
    state.commitDetails.clear();
    state.historyPlan = null;
    state.historyQueue = { items: [], loading: false, preview: null, error: "" };
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    const sameCommit = state.data.commits.find((item) => item.sha === sha);
    state.selectedSha = sameCommit?.sha || state.data.commits[previousIndex]?.sha || state.data.commits[0]?.sha || "";
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
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

