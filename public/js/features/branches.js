// Branch lists, branch filters, and branch modal actions.
function renderBranches() {
  els.branchList.innerHTML = "";
  els.remoteList.innerHTML = "";
  els.branchStrip.innerHTML = "";
  const currentRef = state.selectedRef;
  const currentBranch = state.data.repo.branch;
  const filterTerms = branchFilterTerms();

  const allChip = document.createElement("button");
  allChip.className = `branch-chip ${state.selectedRef ? "" : "active"}`;
  allChip.type = "button";
  allChip.innerHTML = `<span class="branch-dot" style="--branch:var(--quiet)"></span><span>全部分支</span>`;
  allChip.addEventListener("click", () => selectRef(""));
  els.branchStrip.appendChild(allChip);

  const branchInfo = state.data.branchInfo || {};
  const localBranchItems = state.data.branches.map((branch, index) => {
    const info = branchInfo[branch] || {};
    const options = {
      local: true,
      checkout: true,
      current: branch === currentBranch,
      occupied: Boolean(info.worktreePath),
      worktreePath: info.worktreePath,
      prunable: info.prunable,
      upstream: info.upstream || "",
      ahead: Number(info.ahead || 0),
      behind: Number(info.behind || 0),
      upstreamGone: Boolean(info.upstreamGone),
      merge: true,
      rename: true,
      delete: true,
    };
    return { branch, index, options, active: branch === currentRef };
  });
  const remoteBranchItems = state.data.remotes.map((branch, index) => ({
    branch,
    index: index + 3,
    options: { remote: true, remoteCheckout: true, merge: true, deleteRemote: true },
    active: branch === currentRef,
  }));
  const visibleLocalBranches = filterBranchItems(localBranchItems, filterTerms);
  const visibleRemoteBranches = filterBranchItems(remoteBranchItems, filterTerms);
  visibleLocalBranches.forEach(({ branch, index, options, active }) => {
    els.branchList.appendChild(branchButton(branch, index, active, options));
  });
  if (!visibleLocalBranches.length) appendBranchEmpty(els.branchList, filterTerms.length ? "没有匹配的本地分支" : "没有本地分支");
  localBranchItems.forEach(({ branch, index, options }) => {
    const chip = document.createElement("button");
    chip.className = `branch-chip ${branch === currentRef ? "active" : ""} ${branch === currentBranch ? "current-branch" : ""}`;
    chip.type = "button";
    chip.innerHTML = `<span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span>`;
    chip.addEventListener("click", () => selectRef(branch));
    chip.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showBranchContextMenu(event, branch, options);
    });
    els.branchStrip.appendChild(chip);
  });
  visibleRemoteBranches.forEach(({ branch, index, options, active }) => {
    els.remoteList.appendChild(branchButton(branch, index, active, options));
  });
  if (!visibleRemoteBranches.length) appendBranchEmpty(els.remoteList, filterTerms.length ? "没有匹配的远端分支" : "没有远端分支");
  updateBranchFilterMeta(filterTerms, visibleLocalBranches.length + visibleRemoteBranches.length, localBranchItems.length + remoteBranchItems.length);
}

function branchFilterTerms() {
  return String(state.branchFilter || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function filterBranchItems(items, terms) {
  if (!terms.length) return items;
  return items.filter((item) => {
    const text = branchSearchText(item.branch, item.options);
    return terms.every((term) => text.includes(term));
  });
}

function branchSearchText(branch, options = {}) {
  return [
    branch,
    options.upstream,
    options.upstreamGone ? "上游丢失 gone" : "",
    options.ahead ? `领先 ahead ${options.ahead}` : "",
    options.behind ? `落后 behind ${options.behind}` : "",
    options.remote ? remoteCheckoutBranch(branch) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function updateBranchFilterMeta(terms, visibleCount, totalCount) {
  const active = terms.length > 0;
  els.branchFilterCount.textContent = active ? `${visibleCount}/${totalCount}` : "";
  els.branchFilterCount.title = active ? `分支筛选结果：${visibleCount} / ${totalCount}` : "";
  els.branchFilterCount.hidden = !active;
  els.clearBranchFilter.hidden = !active;
}

function appendBranchEmpty(root, text) {
  const empty = document.createElement("div");
  empty.className = "branch-empty";
  empty.textContent = text;
  root.appendChild(empty);
}

function updateBranchFilter(value) {
  state.branchFilter = String(value || "");
  renderBranches();
}

function clearBranchFilter() {
  if (!state.branchFilter && !els.branchFilterInput.value) return;
  state.branchFilter = "";
  els.branchFilterInput.value = "";
  renderBranches();
  els.branchFilterInput.focus();
}

function branchButton(branch, index, active, options = {}) {
  const row = document.createElement("div");
  row.className = `branch-row ${options.current ? "current-branch" : ""}`;
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showBranchContextMenu(event, branch, options);
  });
  const button = document.createElement("button");
  button.className = `nav-item ${active ? "active" : ""} ${options.current ? "current-branch" : ""}`;
  button.type = "button";
  button.title = branchTrackingTitle(branch, options);
  button.innerHTML = `<span class="branch-dot" style="--branch:${laneColor(index)}"></span><span class="branch-copy"><span class="branch-name">${escapeHtml(branch)}</span>${branchTrackingHtml(options)}</span>`;
  button.addEventListener("click", () => selectRef(branch));
  row.appendChild(button);
  if (options.checkout) {
    const checkout = document.createElement("button");
    const blocked = options.occupied && !options.current;
    const canPrune = blocked && options.prunable;
    checkout.className = "branch-checkout";
    checkout.type = "button";
    checkout.textContent = options.current ? "当前" : canPrune ? "清理" : blocked ? "占用" : "切换";
    checkout.disabled = Boolean(options.current || (blocked && !canPrune));
    checkout.title = branchCheckoutTitle(branch, options, blocked);
    if (canPrune) {
      checkout.classList.add("prune");
      checkout.addEventListener("click", (event) => {
        event.stopPropagation();
        cleanupStaleWorktree(branch, checkout, options);
      });
    } else if (blocked) {
      checkout.classList.add("blocked");
    } else {
      checkout.addEventListener("click", (event) => {
        event.stopPropagation();
        checkoutBranch(branch, checkout);
      });
    }
    row.appendChild(checkout);
  }
  if (options.remoteCheckout) {
    const checkout = document.createElement("button");
    const localBranch = remoteCheckoutBranch(branch);
    checkout.className = "branch-checkout remote";
    checkout.type = "button";
    checkout.textContent = "签出";
    checkout.disabled = Boolean(!localBranch || localBranch === state.data.repo.branch);
    checkout.title = !localBranch
      ? "这个远端引用不能自动推导本地分支名"
      : checkout.disabled
        ? "对应的本地分支已经是当前分支"
        : `签出 ${branch} 为本地分支 ${localBranch}`;
    checkout.addEventListener("click", (event) => {
      event.stopPropagation();
      checkoutRemoteBranch(branch, checkout);
    });
    row.appendChild(checkout);
  }
  if (options.merge) {
    const merge = document.createElement("button");
    merge.className = "branch-merge";
    merge.type = "button";
    merge.textContent = "合并";
    merge.disabled = Boolean(options.current);
    merge.title = options.current ? "不能把当前分支合并到自己" : `合并 ${branch} 到当前分支`;
    merge.addEventListener("click", (event) => {
      event.stopPropagation();
      mergeBranchRef(branch);
    });
    row.appendChild(merge);
  }
  if (options.delete) {
    const rename = document.createElement("button");
    const renameBlocked = Boolean(options.occupied && !options.current);
    rename.className = "branch-rename";
    rename.type = "button";
    rename.textContent = "改";
    rename.disabled = renameBlocked;
    rename.title = renameBlocked ? "分支被其他工作树占用，不能重命名" : `重命名本地分支 ${branch}`;
    rename.addEventListener("click", (event) => {
      event.stopPropagation();
      openRenameBranchModal(branch);
    });
    row.appendChild(rename);

    const remove = document.createElement("button");
    const blocked = Boolean(options.current || options.occupied);
    remove.className = "branch-delete";
    remove.type = "button";
    remove.textContent = "删";
    remove.disabled = blocked;
    remove.title = branchDeleteTitle(branch, options, blocked);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteBranch(branch, remove);
    });
    row.appendChild(remove);
  }
  return row;
}

function branchTrackingHtml(options = {}) {
  if (!options.local) return "";
  const badges = [];
  if (options.current) badges.push(`<span class="branch-badge current">当前</span>`);
  if (options.upstream) badges.push(`<span class="branch-badge upstream">${escapeHtml(options.upstream)}</span>`);
  else if (options.current) badges.push(`<span class="branch-badge muted">未设置 upstream</span>`);
  if (options.upstreamGone) badges.push(`<span class="branch-badge danger">上游丢失</span>`);
  if (options.ahead) badges.push(`<span class="branch-badge ahead">↑${Number(options.ahead)}</span>`);
  if (options.behind) badges.push(`<span class="branch-badge behind">↓${Number(options.behind)}</span>`);
  return badges.length ? `<span class="branch-meta">${badges.join("")}</span>` : "";
}

function branchTrackingTitle(branch, options = {}) {
  if (!options.local) return branch;
  const parts = [branch];
  if (options.current) parts.push("当前分支");
  if (options.upstream) parts.push(`upstream：${options.upstream}`);
  else if (options.current) parts.push("未设置 upstream，推送时会自动设置");
  if (options.upstreamGone) parts.push("上游分支已不存在");
  if (options.ahead) parts.push(`领先 ${options.ahead} 个提交`);
  if (options.behind) parts.push(`落后 ${options.behind} 个提交`);
  return parts.join("\n");
}

function branchCheckoutTitle(branch, options, blocked) {
  if (options.current) return "当前分支";
  if (!blocked) return `切换到 ${branch}`;
  if (options.prunable) return `失效 worktree 占用：${options.worktreePath || "未知路径"}。点击清理后可再切换`;
  return `已在其他工作树签出：${options.worktreePath || "未知路径"}`;
}

function branchDeleteTitle(branch, options, blocked) {
  if (options.current) return "不能删除当前分支";
  if (options.occupied) return "分支被其他工作树占用，先清理或切换后再删除";
  return `删除本地分支 ${branch}`;
}

async function deleteBranch(branch, button) {
  if (!state.data || !branch) return;
  if (!confirm(`确认删除本地分支：${branch}？\n\n会使用安全删除；如果分支还没有合并，Git 会阻止删除。`)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteBranch", branch }) });
    toast(result.output || `已删除本地分支 ${branch}`);
    state.commitDetails.clear();
    if (state.selectedRef === branch) state.selectedRef = state.data.repo.branch || "";
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

async function deleteRemoteBranch(remoteRef) {
  if (!state.data || !remoteRef) return;
  const command = remoteDeleteCommand(remoteRef);
  if (!confirm(`确认删除远端分支：${remoteRef}？\n\n此操作会删除远端仓库中的分支，不会删除本地分支。\n命令：${command}`)) return;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteRemoteBranch", ref: remoteRef }) });
    toast(result.output || `已删除远端分支 ${remoteRef}`);
    state.commitDetails.clear();
    if (state.selectedRef === remoteRef) state.selectedRef = state.data.repo.branch || "";
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

function remoteDeleteCommand(remoteRef) {
  const parts = String(remoteRef || "").split("/").filter(Boolean);
  if (parts.length < 2) return "git push <远端> --delete <分支>";
  return `git push ${parts[0]} --delete ${parts.slice(1).join("/")}`;
}

async function cleanupStaleWorktree(branch, button, options = {}) {
  if (!state.data) return;
  const pathText = options.worktreePath ? `\n占用路径：${options.worktreePath}` : "";
  if (!state.data.repo.isSample && !confirm(`确认清理 ${branch} 的失效 worktree 记录？${pathText}\n\n这只清理 Git 的失效 worktree 元数据，不会删除当前工作区文件。`)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "pruneWorktrees", branch }) });
    toast(result.output || "已清理失效 worktree 记录");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
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

function openBranchModal() {
  if (!state.data) return;
  const commit = state.data.commits.find((item) => item.sha === state.selectedSha);
  state.branchModalMode = "create";
  state.branchRenameOld = "";
  state.branchStartSha = commit?.sha || "";
  els.branchNameInput.value = "";
  els.branchModalTitle.textContent = "新建分支";
  els.branchNameInput.placeholder = "例如 feature/login";
  els.branchCheckoutToggle.checked = true;
  els.branchCheckoutLabel.style.display = "";
  els.branchSubmit.textContent = "创建分支";
  els.branchStartText.textContent = commit
    ? `从选中提交 ${commit.short} 创建分支。`
    : "从当前 HEAD 创建分支。";
  els.branchModal.classList.add("show");
  els.branchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.branchNameInput.focus(), 0);
}

function openBranchModalFromRef(ref, label = "分支") {
  if (!state.data || !ref) return;
  state.branchModalMode = "create";
  state.branchRenameOld = "";
  state.branchStartSha = ref;
  els.branchNameInput.value = "";
  els.branchModalTitle.textContent = "新建分支";
  els.branchNameInput.placeholder = "例如 feature/login";
  els.branchCheckoutToggle.checked = true;
  els.branchCheckoutLabel.style.display = "";
  els.branchSubmit.textContent = "创建分支";
  els.branchStartText.textContent = `从${label} ${ref} 的最新提交创建分支。`;
  els.branchModal.classList.add("show");
  els.branchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => els.branchNameInput.focus(), 0);
}

function openRenameBranchModal(branch) {
  if (!state.data || !branch) return;
  state.branchModalMode = "rename";
  state.branchRenameOld = branch;
  state.branchStartSha = "";
  els.branchNameInput.value = branch;
  els.branchNameInput.placeholder = "新的分支名";
  els.branchModalTitle.textContent = "重命名分支";
  els.branchStartText.textContent = `将 ${branch} 重命名为新的本地分支名。`;
  els.branchCheckoutLabel.style.display = "none";
  els.branchSubmit.textContent = "重命名";
  els.branchModal.classList.add("show");
  els.branchModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => {
    els.branchNameInput.focus();
    els.branchNameInput.select();
  }, 0);
}

function closeBranchModal() {
  els.branchModal.classList.remove("show");
  els.branchModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function submitBranchForm(event) {
  event.preventDefault();
  if (!state.data) return;
  const branch = els.branchNameInput.value.trim();
  if (!branch) {
    toast("请输入分支名");
    els.branchNameInput.focus();
    return;
  }
  if (state.branchModalMode === "rename") {
    await renameBranchFromForm(branch);
    return;
  }
  const checkout = els.branchCheckoutToggle.checked;
  const submit = els.branchForm.querySelector('button[type="submit"]');
  try {
    submit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "createBranch", branch, start: state.branchStartSha, checkout }),
    });
    toast(result.output || `已创建分支 ${branch}`);
    closeBranchModal();
    state.commitDetails.clear();
    state.selectedRef = result.checkedOut ? branch : state.selectedRef;
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
    submit.disabled = false;
  }
}

async function renameBranchFromForm(nextBranch) {
  const oldBranch = state.branchRenameOld;
  if (!oldBranch) return;
  if (oldBranch === nextBranch) {
    closeBranchModal();
    return;
  }
  const submit = els.branchSubmit;
  try {
    submit.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "renameBranch", branch: oldBranch, newBranch: nextBranch }),
    });
    toast(result.output || `已重命名为 ${nextBranch}`);
    closeBranchModal();
    state.commitDetails.clear();
    if (state.selectedRef === oldBranch || state.data.repo.branch === oldBranch) state.selectedRef = nextBranch;
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    if (state.selectedSha) {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    submit.disabled = false;
  }
}

