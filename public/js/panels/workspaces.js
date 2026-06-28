// Branch cleanup, worktree, and submodule panels.
function renderBranchesTab(commit) {
  const rows = branchCleanupRows();
  const summary = branchCleanupSummary(rows);
  const realRepo = Boolean(state.data && !state.data.repo.isSample);
  els.detailNode.style.borderColor = "var(--teal)";
  els.detailTitle.textContent = "分支整理";
  els.detailSub.textContent = rows.length ? `${rows.length} 个本地分支 · 基准 ${state.data?.repo?.branch || "HEAD"}` : "没有本地分支";
  if (!rows.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有本地分支</strong>
        <span>打开真实 Git 仓库后会在这里显示分支整理建议。</span>
      </div>
    `;
    return;
  }
  const relatedRefs = (commit?.refs || state.data?.repo?.branch || "")
    .split(",")
    .map((ref) => ({ label: ref.trim(), ref: normalizeCommitRefLabel(ref) }))
    .filter((item) => item.label && item.ref)
    .slice(0, 8);
  const relatedHtml = relatedRefs.length
    ? `
      <div class="branch-focus">
        <div class="detail-section-title">当前提交引用</div>
        <div class="branch-focus-list">
          ${relatedRefs.map((item, index) => `<button class="nav-item" data-branch-cleanup-action="view" data-branch="${escapeAttr(item.ref)}" type="button" title="${escapeAttr(item.ref)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(item.label)}</span></button>`).join("")}
        </div>
      </div>
    `
    : "";
  els.detailBody.innerHTML = `
    <div class="branch-cleanup-layout">
      <div class="branch-cleanup-summary">
        <div><span>已合并</span><strong>${summary.merged}</strong></div>
        <div><span>上游丢失</span><strong>${summary.gone}</strong></div>
        <div><span>长期未动</span><strong>${summary.stale}</strong></div>
      </div>
      <div class="branch-cleanup-actions">
        <button class="mini-btn" data-branch-cleanup-action="refresh" type="button"><span>刷新</span><span class="command-hint">git branch</span></button>
        <button class="mini-btn danger" data-branch-cleanup-action="deleteMerged" type="button" ${!realRepo || !summary.deletableMerged ? "disabled" : ""}>
          <span>删除已合并</span><span class="command-hint">git branch -d</span>
        </button>
      </div>
      ${relatedHtml}
      <div class="branch-cleanup-list">
        ${rows.map((row, index) => branchCleanupRowHtml(row, index, realRepo)).join("")}
      </div>
    </div>
  `;
}

function normalizeCommitRefLabel(ref) {
  return String(ref || "")
    .trim()
    .replace(/^HEAD\s*->\s*/, "")
    .replace(/^tag:\s*/, "")
    .trim();
}

function branchCleanupRows() {
  const rows = state.data?.branchCleanup;
  if (Array.isArray(rows) && rows.length) return rows;
  const current = state.data?.repo?.branch || "";
  const branchInfo = state.data?.branchInfo || {};
  return (state.data?.branches || []).map((branch) => {
    const info = branchInfo[branch] || {};
    const protectedBranch = branch === current || ["main", "master", "develop", "development", "dev", "trunk"].includes(String(branch || "").toLowerCase());
    return {
      branch,
      current: branch === current,
      protected: protectedBranch,
      upstream: info.upstream || "",
      upstreamGone: Boolean(info.upstreamGone),
      ahead: Number(info.ahead) || 0,
      behind: Number(info.behind) || 0,
      occupied: Boolean(info.worktreePath),
      worktreePath: info.worktreePath || "",
      canDelete: !protectedBranch && !info.worktreePath,
      statusLabel: branch === current ? "当前" : protectedBranch ? "保护" : info.upstreamGone ? "上游丢失" : "活跃",
      reason: branch === current ? "当前所在分支不能删除" : protectedBranch ? "主干或长期分支默认保留" : info.upstreamGone ? "上游分支已经不存在，删除前先确认本地提交是否还需要" : "等待 Git 状态刷新",
    };
  });
}

function branchCleanupSummary(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.mergedIntoCurrent) acc.merged += 1;
      if (row.upstreamGone) acc.gone += 1;
      if (row.stale) acc.stale += 1;
      if (row.canDelete && row.mergedIntoCurrent) acc.deletableMerged += 1;
      return acc;
    },
    { merged: 0, gone: 0, stale: 0, deletableMerged: 0 }
  );
}

function branchCleanupRowHtml(row, index, realRepo) {
  const canDelete = Boolean(realRepo && row.canDelete);
  const classes = ["branch-cleanup-row", branchCleanupStatusClass(row), row.recommended ? "recommended" : "", row.attention ? "attention" : ""].filter(Boolean).join(" ");
  const branch = row.branch || "";
  const meta = branchCleanupMetaHtml(row);
  const deleteTitle = canDelete ? `安全删除本地分支 ${branch}` : row.deleteBlockedReason || row.protectedReason || (realRepo ? "这个分支暂不适合删除" : "示例仓库不能执行删除");
  return `
    <div class="${classes}" data-branch-name="${escapeAttr(branch)}">
      <div class="branch-cleanup-head">
        <strong title="${escapeAttr(branch)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span></strong>
        <span class="branch-cleanup-status">${escapeHtml(row.statusLabel || "活跃")}</span>
      </div>
      ${meta}
      <div class="branch-cleanup-last">
        <code>${escapeHtml(row.lastCommitShort || "")}</code>
        <span title="${escapeAttr(row.lastSubject || "")}">${escapeHtml(row.lastSubject || "没有提交摘要")}</span>
        <em>${escapeHtml(row.lastUpdated || "")}</em>
      </div>
      <p title="${escapeAttr(row.reason || "")}">${escapeHtml(row.reason || "")}</p>
      <div class="branch-cleanup-row-actions">
        <button class="mini-btn" data-branch-cleanup-action="view" data-branch="${escapeAttr(branch)}" type="button">查看</button>
        <button class="mini-btn" data-branch-cleanup-action="compare" data-branch="${escapeAttr(branch)}" type="button" ${row.current ? "disabled" : ""}>比较</button>
        <button class="mini-btn danger" data-branch-cleanup-action="delete" data-branch="${escapeAttr(branch)}" type="button" title="${escapeAttr(deleteTitle)}" ${canDelete ? "" : "disabled"}>
          <span>删除</span><span class="command-hint">git branch -d</span>
        </button>
      </div>
    </div>
  `;
}

function branchCleanupMetaHtml(row) {
  const badges = [];
  if (row.upstream) badges.push(`<span class="branch-badge upstream" title="${escapeAttr(row.upstream)}">${escapeHtml(row.upstream)}</span>`);
  else if (row.current) badges.push(`<span class="branch-badge muted">未设置 upstream</span>`);
  if (row.upstreamGone) badges.push(`<span class="branch-badge danger">上游丢失</span>`);
  if (row.ahead) badges.push(`<span class="branch-badge ahead">领先 ${escapeHtml(row.ahead)}</span>`);
  if (row.behind) badges.push(`<span class="branch-badge behind">落后 ${escapeHtml(row.behind)}</span>`);
  if (row.mergedIntoCurrent) badges.push(`<span class="branch-badge merged">已合并</span>`);
  if (row.stale) badges.push(`<span class="branch-badge stale">${escapeHtml(row.staleDays || 0)} 天未动</span>`);
  if (row.occupied) badges.push(`<span class="branch-badge danger">worktree 占用</span>`);
  if (row.protected && !row.current) badges.push(`<span class="branch-badge muted">保护</span>`);
  return badges.length ? `<div class="branch-cleanup-meta">${badges.join("")}</div>` : `<div class="branch-cleanup-meta"><span class="branch-badge muted">无 upstream</span></div>`;
}

function branchCleanupStatusClass(row) {
  if (row.current) return "current";
  if (row.protected) return "protected";
  if (row.occupied) return "occupied";
  if (row.mergedIntoCurrent) return "merged";
  if (row.upstreamGone) return "gone";
  if (row.stale) return "stale";
  return "active";
}

async function runBranchCleanupAction(action, button) {
  const branch = button?.dataset?.branch || "";
  if (action === "refresh") {
    await refreshBranchCleanup(button);
    return;
  }
  if (action === "deleteMerged") {
    await deleteMergedCleanupBranches(button);
    return;
  }
  if (!branch) return;
  if (action === "view") {
    await selectRef(branch);
    return;
  }
  if (action === "compare") {
    await openCompareBranch(branch);
    return;
  }
  if (action === "delete") {
    await deleteBranch(branch, button);
  }
}

async function refreshBranchCleanup(button) {
  if (!state.data) return;
  if (button) button.disabled = true;
  try {
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    renderInspector();
    toast("分支整理已刷新");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteMergedCleanupBranches(button) {
  if (!state.data || state.data.repo.isSample) return;
  const branches = branchCleanupRows()
    .filter((row) => row.canDelete && row.mergedIntoCurrent)
    .map((row) => row.branch)
    .filter(Boolean);
  if (!branches.length) {
    toast("没有可安全删除的已合并分支");
    return;
  }
  const preview = branches.slice(0, 8).join("\n");
  const suffix = branches.length > 8 ? `\n... 还有 ${branches.length - 8} 个` : "";
  if (!confirm(`确认安全删除这些已合并分支？\n\n${preview}${suffix}\n\n命令：git branch -d <分支>\n如果 Git 判断未完全合并，会自动阻止。`)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "deleteBranches", branches }),
    });
    toast(result.output || `已删除 ${branches.length} 个分支`);
    state.commitDetails.clear();
    if (branches.includes(state.selectedRef)) state.selectedRef = state.data.repo.branch || "";
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

function branchCleanupContextOptions(branch) {
  const row = branchCleanupRows().find((item) => item.branch === branch) || {};
  return {
    local: true,
    checkout: true,
    rename: true,
    delete: true,
    current: Boolean(row.current || branch === state.data?.repo?.branch),
    occupied: Boolean(row.occupied),
    worktreePath: row.worktreePath || "",
    prunable: false,
    upstream: row.upstream || "",
    upstreamGone: Boolean(row.upstreamGone),
    ahead: Number(row.ahead) || 0,
    behind: Number(row.behind) || 0,
  };
}

function renderWorktreesTab() {
  const rows = state.data?.worktrees || [];
  const realRepo = Boolean(state.data && !state.data.repo.isSample);
  const summary = worktreeSummary(rows);
  els.detailNode.style.borderColor = summary.dirty || summary.prunable ? "var(--amber)" : "var(--blue)";
  els.detailTitle.textContent = "工作树";
  els.detailSub.textContent = rows.length ? `${rows.length} 个 Git worktree · 当前 ${state.data?.repo?.branch || "HEAD"}` : "没有工作树";
  setActiveDiff(null);
  els.detailBody.innerHTML = `
    <div class="worktree-dashboard">
      <div class="worktree-summary">
        <div><span>总数</span><strong>${rows.length}</strong></div>
        <div><span>干净</span><strong>${summary.clean}</strong></div>
        <div><span>有改动</span><strong>${summary.dirty}</strong></div>
        <div><span>失效</span><strong>${summary.prunable}</strong></div>
      </div>
      ${worktreeCreateHtml(realRepo)}
      <div class="worktree-actions">
        <button class="mini-btn" data-worktree-action="refresh" type="button"><span>刷新</span><span class="command-hint">git worktree</span></button>
        <button class="mini-btn" data-worktree-action="pruneAll" type="button" ${realRepo && summary.prunable ? "" : "disabled"}><span>清理失效</span><span class="command-hint">prune</span></button>
      </div>
      <div class="worktree-list">
        ${
          rows.length
            ? rows.map((row, index) => worktreeRowHtml(row, index, realRepo)).join("")
            : `<div class="empty-panel compact"><span>当前仓库还没有额外工作树。</span></div>`
        }
      </div>
    </div>
  `;
}

function worktreeSummary(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      if (row.prunable || !row.exists) acc.prunable += 1;
      else if (row.status === "dirty") acc.dirty += 1;
      else if (row.status === "clean") acc.clean += 1;
      return acc;
    },
    { clean: 0, dirty: 0, prunable: 0 }
  );
}

function worktreeCreateHtml(realRepo) {
  const defaultRef = worktreeDefaultRef();
  const refs = compareRefOptions([defaultRef]);
  const target = worktreeTargetSuggestion(defaultRef);
  return `
    <form class="worktree-create" data-worktree-form>
      <datalist id="worktreeRefOptions">
        ${refs.map((item) => `<option value="${escapeAttr(item.ref)}" label="${escapeAttr(item.label)}"></option>`).join("")}
      </datalist>
      <label>
        <span>目标文件夹</span>
        <input data-worktree-field="targetPath" autocomplete="off" spellcheck="false" value="${escapeAttr(target)}" placeholder="D:\\项目\\repo-feature" ${realRepo ? "" : "disabled"} />
      </label>
      <label>
        <span>起点引用</span>
        <input data-worktree-field="ref" list="worktreeRefOptions" autocomplete="off" spellcheck="false" value="${escapeAttr(defaultRef)}" placeholder="HEAD / main / origin/feature" ${realRepo ? "" : "disabled"} />
      </label>
      <label>
        <span>新分支名</span>
        <input data-worktree-field="branch" autocomplete="off" spellcheck="false" placeholder="可选，不填则直接签出起点" ${realRepo ? "" : "disabled"} />
      </label>
      <button class="mini-btn" type="submit" ${realRepo ? "" : "disabled"}><span>创建工作树</span><span class="command-hint">git worktree add</span></button>
    </form>
  `;
}

function worktreeDefaultRef() {
  return state.selectedRef || state.data?.repo?.branch || "HEAD";
}

function worktreeTargetSuggestion(ref) {
  const repo = state.data?.repo || {};
  const base = repoParentPath(repo.path || "");
  if (!base) return "";
  const repoName = worktreePathSlug(repo.name || "repo");
  const refName = worktreePathSlug(ref || "worktree");
  return joinLocalPath(base, `${repoName}-${refName}`);
}

function worktreePathSlug(value) {
  return String(value || "worktree")
    .replace(/^[A-Za-z]:/, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/[\\/\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56) || "worktree";
}

function worktreeRowHtml(row, index, realRepo) {
  const status = worktreeStatus(row);
  const branch = row.label || row.branch || "detached HEAD";
  const openDisabled = !realRepo || row.current || !row.exists || row.prunable;
  const pruneDisabled = !realRepo || !row.prunable;
  return `
    <article class="worktree-row ${row.current ? "current" : ""} ${row.prunable || !row.exists ? "prunable" : ""}">
      <div class="worktree-row-head">
        <strong title="${escapeAttr(branch)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(branch)}</span></strong>
        <span class="worktree-status ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      <div class="worktree-path" title="${escapeAttr(row.path || "")}">${escapeHtml(row.path || "未知路径")}</div>
      <div class="worktree-meta">
        <span>${escapeHtml(row.shortHead || "无 HEAD")}</span>
        ${row.detached ? `<span>游离 HEAD</span>` : ""}
        ${row.locked ? `<span title="${escapeAttr(row.lockReason || "locked")}">已锁定</span>` : ""}
        ${row.operation?.label ? `<span title="${escapeAttr(row.operation.label)}">操作中</span>` : ""}
        ${row.prunable && row.pruneReason ? `<span title="${escapeAttr(row.pruneReason)}">可清理</span>` : ""}
      </div>
      <div class="worktree-row-actions">
        <button class="mini-btn" data-worktree-action="open" data-worktree-path="${escapeAttr(row.path || "")}" type="button" ${openDisabled ? "disabled" : ""}>打开</button>
        <button class="mini-btn" data-worktree-action="copyPath" data-worktree-path="${escapeAttr(row.path || "")}" type="button">复制路径</button>
        <button class="mini-btn danger" data-worktree-action="pruneAll" type="button" ${pruneDisabled ? "disabled" : ""}><span>清理</span><span class="command-hint">prune</span></button>
      </div>
    </article>
  `;
}

function worktreeStatus(row) {
  if (row.prunable || !row.exists) return { label: "失效", className: "danger" };
  if (row.operation?.label) return { label: "操作中", className: "warn" };
  if (row.status === "dirty") return { label: `${row.dirtyCount || 0} 个改动`, className: "warn" };
  if (row.status === "clean") return { label: "干净", className: "ok" };
  return { label: "未知", className: "muted" };
}

async function submitWorktreeForm(form) {
  if (!state.data) return;
  const targetPath = form.querySelector('[data-worktree-field="targetPath"]')?.value.trim() || "";
  const ref = form.querySelector('[data-worktree-field="ref"]')?.value.trim() || "HEAD";
  const branch = form.querySelector('[data-worktree-field="branch"]')?.value.trim() || "";
  if (!targetPath) {
    toast("请输入工作树目标文件夹");
    return;
  }
  if (!ref) {
    toast("请输入工作树起点引用");
    return;
  }
  const command = branch ? `git worktree add -b ${branch} ${targetPath} ${ref}` : `git worktree add ${targetPath} ${ref}`;
  if (!state.data.repo.isSample && !confirm(`确认创建工作树？\n\n位置：${targetPath}\n起点：${ref}${branch ? `\n新分支：${branch}` : ""}\n命令：${command}`)) return;
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "createWorktree", targetPath, ref, branch }),
    });
    toast(result.output || "已创建工作树");
    state.commitDetails.clear();
    state.data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function runWorktreeAction(action, button) {
  if (!state.data) return;
  const worktreePath = button?.dataset?.worktreePath || "";
  if (action === "copyPath") {
    await copyText(worktreePath);
    toast("已复制工作树路径");
    return;
  }
  if (action === "refresh") {
    await refreshWorktreeDashboard(button);
    return;
  }
  if (action === "open") {
    await openWorktreePath(worktreePath, button);
    return;
  }
  if (action === "pruneAll") {
    await pruneWorktreeRecords(button);
  }
}

async function refreshWorktreeDashboard(button) {
  if (button) button.disabled = true;
  try {
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    toast("工作树列表已刷新");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openWorktreePath(worktreePath, button) {
  if (!worktreePath) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "openWorktree", path: worktreePath }),
    });
    toast(result.output || "已打开工作树");
    state.commitDetails.clear();
    state.selectedRef = "";
    state.data = result.state;
    state.selectedSha = state.data.commits[0]?.sha || "";
    saveRecentRepo(state.data.repo);
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

async function pruneWorktreeRecords(button) {
  if (!state.data?.repo?.isSample && !confirm("确认清理失效工作树记录？\n\n命令：git worktree prune --verbose\n这只清理 Git 中已经失效的 worktree 元数据，不会删除仍存在的工作区文件。")) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "pruneAllWorktrees" }),
    });
    toast(result.output || "已清理失效工作树记录");
    state.data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderSubmodulesTab() {
  const rows = state.data?.submodules || [];
  const realRepo = Boolean(state.data && !state.data.repo.isSample);
  const summary = submoduleSummary(rows);
  els.detailNode.style.borderColor = summary.conflict || summary.changed ? "var(--amber)" : "var(--blue)";
  els.detailTitle.textContent = "子模块";
  els.detailSub.textContent = rows.length ? `${rows.length} 个 Git submodule` : "没有子模块";
  setActiveDiff(null);
  els.detailBody.innerHTML = `
    <div class="submodule-dashboard">
      <div class="submodule-summary">
        <div><span>总数</span><strong>${rows.length}</strong></div>
        <div><span>未初始化</span><strong>${summary.uninitialized}</strong></div>
        <div><span>不一致</span><strong>${summary.changed}</strong></div>
        <div><span>有改动</span><strong>${summary.dirty}</strong></div>
      </div>
      <div class="submodule-actions">
        <button class="mini-btn" data-submodule-action="initAll" type="button" ${realRepo && rows.length ? "" : "disabled"}><span>初始化</span><span class="command-hint">update --init</span></button>
        <button class="mini-btn" data-submodule-action="updateAll" type="button" ${realRepo && rows.length ? "" : "disabled"}><span>更新全部</span><span class="command-hint">submodule update</span></button>
        <button class="mini-btn" data-submodule-action="syncAll" type="button" ${realRepo && rows.length ? "" : "disabled"}><span>同步 URL</span><span class="command-hint">submodule sync</span></button>
        <button class="mini-btn" data-submodule-action="refresh" type="button"><span>刷新</span><span class="command-hint">git submodule</span></button>
      </div>
      <div class="submodule-list">
        ${
          rows.length
            ? rows.map((row, index) => submoduleRowHtml(row, index, realRepo)).join("")
            : `<div class="empty-panel compact"><span>当前仓库没有 .gitmodules 配置。添加子模块后会显示初始化和更新入口。</span></div>`
        }
      </div>
    </div>
  `;
}

function submoduleSummary(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      if (!row.initialized || row.status === "uninitialized") acc.uninitialized += 1;
      if (row.status === "changed") acc.changed += 1;
      if (row.status === "conflict") acc.conflict += 1;
      if (row.dirtyCount) acc.dirty += 1;
      return acc;
    },
    { uninitialized: 0, changed: 0, conflict: 0, dirty: 0 }
  );
}

function submoduleRowHtml(row, index, realRepo) {
  const status = submoduleStatus(row);
  const pathText = row.path || "";
  const updateTitle = row.initialized ? `更新子模块 ${pathText}` : `初始化子模块 ${pathText}`;
  return `
    <article class="submodule-row ${status.className}">
      <div class="submodule-row-head">
        <strong title="${escapeAttr(row.name || pathText)}"><span class="branch-dot" style="--branch:${laneColor(index)}"></span><span>${escapeHtml(row.name || pathText)}</span></strong>
        <span class="submodule-status ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      <div class="submodule-path" title="${escapeAttr(pathText)}">${escapeHtml(pathText)}</div>
      <div class="submodule-url" title="${escapeAttr(row.url || "")}">${escapeHtml(row.url || "未配置 URL")}</div>
      <div class="submodule-meta">
        <span>${escapeHtml(row.shortSha || "无提交")}</span>
        ${row.branch ? `<span title="${escapeAttr(row.branch)}">${escapeHtml(row.branch)}</span>` : ""}
        ${row.worktreeBranch ? `<span title="${escapeAttr(row.worktreeBranch)}">${escapeHtml(row.worktreeBranch)}</span>` : ""}
        ${row.summary ? `<span title="${escapeAttr(row.summary)}">${escapeHtml(row.summary)}</span>` : ""}
        ${row.dirtyCount ? `<span>${escapeHtml(row.dirtyCount)} 个改动</span>` : ""}
      </div>
      <div class="submodule-row-actions">
        <button class="mini-btn" data-submodule-action="update" data-submodule-path="${escapeAttr(pathText)}" type="button" ${realRepo ? "" : "disabled"} title="${escapeAttr(updateTitle)}"><span>${row.initialized ? "更新" : "初始化"}</span><span class="command-hint">update</span></button>
        <button class="mini-btn" data-submodule-action="copyPath" data-submodule-path="${escapeAttr(pathText)}" type="button">复制路径</button>
        <button class="mini-btn" data-submodule-action="copyUrl" data-submodule-url="${escapeAttr(row.url || "")}" type="button" ${row.url ? "" : "disabled"}>复制 URL</button>
      </div>
    </article>
  `;
}

function submoduleStatus(row) {
  if (row.status === "conflict") return { label: "冲突", className: "danger" };
  if (!row.initialized || row.status === "uninitialized") return { label: "未初始化", className: "warn" };
  if (row.status === "changed") return { label: "提交不一致", className: "warn" };
  if (row.dirtyCount) return { label: `${row.dirtyCount} 个改动`, className: "warn" };
  if (row.status === "ok") return { label: "已就绪", className: "ok" };
  return { label: row.statusLabel || "已配置", className: "muted" };
}

async function runSubmoduleAction(action, button) {
  if (!state.data) return;
  const submodulePath = button?.dataset?.submodulePath || "";
  if (action === "copyPath") {
    await copyText(submodulePath);
    toast("已复制子模块路径");
    return;
  }
  if (action === "copyUrl") {
    const url = button?.dataset?.submoduleUrl || "";
    if (!url) return;
    await copyText(url);
    toast("已复制子模块 URL");
    return;
  }
  if (action === "refresh") {
    await refreshSubmodules(button);
    return;
  }
  const payload = submoduleActionPayload(action, submodulePath);
  if (!payload) return;
  const message = submoduleConfirmMessage(action, submodulePath);
  if (!state.data.repo.isSample && !confirm(message)) return;
  if (button) button.disabled = true;
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    toast(result.output || "子模块操作完成");
    state.data = result.state || await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function submoduleActionPayload(action, submodulePath) {
  if (action === "initAll") return { action: "initSubmodules" };
  if (action === "updateAll") return { action: "updateSubmodules" };
  if (action === "syncAll") return { action: "syncSubmodules" };
  if (action === "update") return { action: "updateSubmodules", path: submodulePath };
  return null;
}

function submoduleConfirmMessage(action, submodulePath) {
  if (action === "syncAll") return "确认同步子模块 URL 配置？\n\n命令：git submodule sync --recursive\n这会根据 .gitmodules 更新本地子模块 URL 配置。";
  if (action === "initAll") return "确认初始化并更新所有子模块？\n\n命令：git submodule update --init --recursive\n这可能需要访问子模块远端仓库。";
  if (action === "updateAll") return "确认更新所有子模块？\n\n命令：git submodule update --init --recursive\n这会把子模块签出到父仓库记录的提交。";
  return `确认更新子模块：${submodulePath}？\n\n命令：git submodule update --init --recursive -- ${submodulePath}`;
}

async function refreshSubmodules(button) {
  if (button) button.disabled = true;
  try {
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    renderAll();
    toast("子模块列表已刷新");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

