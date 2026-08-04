// Tags, recovery points, reflog, logs, and settings panels.
function renderTagsTab() {
  const tags = state.data?.tags || [];
  if (state.selectedTag && !tags.some((tag) => tag.name === state.selectedTag)) {
    state.selectedTag = "";
  }
  if (!state.selectedTag && tags.length) state.selectedTag = tags[0].name;
  const selected = tags.find((tag) => tag.name === state.selectedTag);
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = t("标签列表");
  els.detailSub.textContent = tags.length ? t("{count} 个 Tag", { count: tags.length }) : t("没有 Tag");
  setActiveDiff(null);
  if (!tags.length) {
    els.detailBody.innerHTML = tt`
      <div class="empty-panel">
        <strong>没有 Tag</strong>
        <span>在提交右键菜单中选择“创建 Tag”后会显示在这里。</span>
      </div>
    `;
    return;
  }
  els.detailBody.innerHTML = tt`
    <div class="tag-layout">
      <div class="tag-list">
        ${tags.map((tag) => tagRowHtml(tag, tag.name === state.selectedTag)).join("")}
      </div>
      <div class="tag-detail">
        ${selected ? tagDetailHtml(selected) : ""}
      </div>
    </div>
  `;
}

function tagRowHtml(tag, active) {
  return `
    <button class="tag-row ${active ? "active" : ""}" data-tag-name="${escapeAttr(tag.name)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(tag.name)}</strong>
        <em>${escapeHtml(tag.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || t("无说明"))}</span>
      <span class="stash-branch">${escapeHtml(tag.short || tag.object ? `${tag.short || tag.object} · ${tag.type || "commit"}` : tag.type || "commit")}</span>
    </button>
  `;
}

function tagDetailHtml(tag) {
  return tt`
    <div class="tag-actions">
      <button class="mini-btn" data-tag-action="view" data-tag-name="${escapeAttr(tag.name)}" type="button">查看提交</button>
      <button class="mini-btn" data-tag-action="copy" data-tag-name="${escapeAttr(tag.name)}" type="button">复制名称</button>
      <button class="mini-btn" data-tag-action="push" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> refs/tags/${escapeAttr(tag.name)}:refs/tags/${escapeAttr(tag.name)}">推送 Tag</button>
      <button class="mini-btn danger" data-tag-action="deleteLocal" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git tag -d ${escapeAttr(tag.name)}">删除本地</button>
      <button class="mini-btn danger" data-tag-action="deleteRemote" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> :refs/tags/${escapeAttr(tag.name)}">删除远端</button>
    </div>
    <div class="meta-grid stash-meta">
      <span>名称</span><div class="meta-value">${escapeHtml(tag.name)}</div>
      <span>对象</span><div class="meta-value">${escapeHtml(tag.short || tag.object || t("未知"))}</div>
      <span>类型</span><div class="meta-value">${escapeHtml(tag.type || "commit")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(tag.time || t("未知"))}</div>
      <span>说明</span><div class="meta-value" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || t("无说明"))}</div>
    </div>
    <div class="empty-panel compact">
      <span>推送 Tag 会把这个本地标签发布到远端；删除远端 Tag 不会删除本地 Tag。</span>
    </div>
  `;
}

function selectTag(name) {
  if (!name || name === state.selectedTag) return;
  state.selectedTag = name;
  renderInspector();
}

function renderRecoveryTab() {
  const points = state.data?.recoveryPoints || [];
  const reflogState = prepareReflogState();
  const reflogEntries = reflogState.entries || [];
  const filteredPoints = filteredRecoveryPoints(points);
  if (state.selectedRecoveryRef && !points.some((point) => point.ref === state.selectedRecoveryRef)) {
    state.selectedRecoveryRef = "";
  }
  if (state.selectedRecoveryRef && !filteredPoints.some((point) => point.ref === state.selectedRecoveryRef)) {
    state.selectedRecoveryRef = "";
  }
  if (!state.selectedRecoveryRef && filteredPoints.length) state.selectedRecoveryRef = filteredPoints[0].ref;
  const selected = filteredPoints.find((point) => point.ref === state.selectedRecoveryRef);
  if (Array.isArray(reflogState.entries)) {
    if (state.selectedReflogSelector && !reflogEntries.some((entry) => entry.selector === state.selectedReflogSelector)) {
      state.selectedReflogSelector = "";
    }
    if (!state.selectedReflogSelector && reflogEntries.length) state.selectedReflogSelector = reflogEntries[0].selector;
  }
  const selectedReflog = reflogEntries.find((entry) => entry.selector === state.selectedReflogSelector);
  els.detailNode.style.borderColor = "var(--purple)";
  els.detailTitle.textContent = t("恢复点");
  els.detailSub.textContent = [
    points.length ? t("恢复点 {visible} / {total}", { visible: filteredPoints.length, total: points.length }) : t("没有自动恢复点"),
    reflogState.loading ? t("引用日志读取中") : reflogState.error ? t("引用日志读取失败") : reflogEntries.length ? t("引用日志 {count} 条", { count: reflogEntries.length }) : "",
  ].filter(Boolean).join(" · ");
  setActiveDiff(null);
  els.detailBody.innerHTML = tt`
    <div class="recovery-layout">
      ${
        points.length
          ? tt`
            ${recoveryFilterHtml(points, filteredPoints)}
            ${recoveryRetentionHtml(points)}
            <div class="recovery-list">
              ${
                filteredPoints.length
                  ? filteredPoints.map((point) => recoveryRowHtml(point, point.ref === state.selectedRecoveryRef)).join("")
                  : `<div class="empty-panel compact"><span>${t("没有匹配的恢复点。可以调整搜索、分支或动作筛选。")}</span></div>`
              }
            </div>
            <div class="recovery-detail">
              ${selected ? recoveryDetailHtml(selected) : `<div class="empty-panel compact"><span>${t("选择一个恢复点查看详情。")}</span></div>`}
            </div>
          `
          : `<div class="empty-panel compact"><strong>${t("没有自动恢复点")}</strong><span>${t("执行变基、追加、历史编辑或重置前，Forkline 会自动在这里留下恢复点。")}</span></div>`
      }
      ${reflogSectionHtml(reflogState, selectedReflog)}
    </div>
  `;
}

function prepareReflogState() {
  const inlineEntries = state.data?.reflogEntries;
  if (Array.isArray(inlineEntries)) {
    return { key: reflogStateKey(), entries: inlineEntries, loading: false, error: "", inline: true };
  }
  const key = reflogStateKey();
  if (state.reflog.key !== key) {
    state.reflogRequestId += 1;
    state.reflog = { key, entries: null, loading: false, error: "", inline: false };
  }
  if (repoPathSnapshot() && !state.data?.repo?.isSample && state.reflog.entries === null && !state.reflog.loading && !state.reflog.error) {
    loadReflogEntries();
  }
  return state.reflog;
}

function reflogStateKey() {
  return [repoPathSnapshot(), state.data?.repo?.branch || "", state.data?.repo?.headSha || ""].join("\u0000");
}

async function loadReflogEntries(refresh = false) {
  const repoPath = repoPathSnapshot();
  if (!repoPath || state.data?.repo?.isSample) return;
  const key = reflogStateKey();
  const requestId = ++state.reflogRequestId;
  state.reflog = { key, entries: null, loading: true, error: "", inline: false };
  if (refresh && state.selectedTab === "recovery") renderInspector();
  try {
    const data = await api("/api/reflog");
    if (requestId !== state.reflogRequestId || !isCurrentRepoPath(repoPath) || key !== reflogStateKey()) return;
    state.reflog = { key, entries: Array.isArray(data.reflogEntries) ? data.reflogEntries : [], loading: false, error: "", inline: false };
  } catch (error) {
    if (requestId !== state.reflogRequestId || !isCurrentRepoPath(repoPath) || key !== reflogStateKey()) return;
    state.reflog = { key, entries: null, loading: false, error: error.message, inline: false };
  }
  if (state.selectedTab === "recovery" && isCurrentRepoPath(repoPath)) renderInspector();
}

function recoveryRetentionHtml(points) {
  const policy = normalizedRecoveryPolicy();
  const plan = recoveryRetentionPlan(points, policy);
  const active = recoveryPolicyActive(policy);
  const buttonText = t(!active ? "设置策略" : plan.deleteCount ? "按策略清理" : "无需清理");
  const summary = active
    ? t("将清理 {deleteCount} 个，保留 {keepCount} 个", { deleteCount: plan.deleteCount, keepCount: plan.keepCount })
    : t("当前共有 {count} 个恢复点", { count: points.length });
  return tt`
    <section class="recovery-retention">
      <div class="recovery-retention-head">
        <strong>保留策略</strong>
        <span>${escapeHtml(summary)}</span>
      </div>
      <div class="recovery-retention-grid">
        <label class="recovery-retention-rule">
          <span>保留最近</span>
          <input data-recovery-policy="keepDays" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.keepDays)}" />
          <em>${t("天")}</em>
        </label>
        <label class="recovery-retention-rule">
          <span>每分支</span>
          <input data-recovery-policy="maxPerBranch" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.maxPerBranch)}" />
          <em>${t("个")}</em>
        </label>
      </div>
      <div class="recovery-retention-actions">
        <span>${escapeHtml(recoveryPolicyLabel(policy) || t("策略未启用"))}</span>
        <button class="mini-btn danger" data-recovery-prune type="button" ${active && plan.deleteCount ? "" : "disabled"}>
          <span>${buttonText}</span><span class="command-hint">update-ref -d</span>
        </button>
      </div>
      ${recoveryRetentionPreviewHtml(plan, active)}
    </section>
  `;
}

function recoveryRetentionPreviewHtml(plan, active) {
  if (!active || !plan.deleteCount) return "";
  const preview = plan.deletePoints.slice(0, 6);
  const extra = Math.max(0, plan.deleteCount - preview.length);
  return tt`
    <div class="recovery-retention-preview">
      <div class="recovery-retention-preview-head">
        <strong>将清理</strong>
        <span>${escapeHtml(t("{count} 个候选", { count: plan.deleteCount }))}</span>
      </div>
      <div class="recovery-retention-preview-list">
        ${preview.map(recoveryRetentionPreviewRow).join("")}
      </div>
      ${extra ? `<div class="recovery-retention-more">${t("另有 {count} 个恢复点也会被清理", { count: escapeHtml(String(extra)) })}</div>` : ""}
    </div>
  `;
}

function recoveryRetentionPreviewRow(point) {
  return tt`
    <div class="recovery-retention-preview-row">
      <strong title="${escapeAttr(t(point.actionLabel || point.action || "恢复点"))}">${escapeHtml(t(point.actionLabel || point.action || "恢复点"))}</strong>
      <span title="${escapeAttr(point.branch || "HEAD")}">${escapeHtml(point.branch || "HEAD")}</span>
      <em title="${escapeAttr(point.shortRef || point.ref || "")}">${escapeHtml(point.short || point.sha?.slice(0, 7) || point.shortRef || "")}</em>
      <small>${escapeHtml(point.time || "")}</small>
    </div>
  `;
}

function recoveryFilterHtml(points, filteredPoints) {
  const filter = state.recoveryFilter || {};
  const branches = uniqueSorted(points.map((point) => point.branch || "HEAD"));
  const actions = uniqueRecoveryActions(points);
  const active = recoveryFilterActive();
  const deleteText = t(filteredPoints.length === points.length ? "删除全部" : "删除筛选结果");
  return tt`
    <div class="recovery-filterbar">
      <input data-recovery-filter="query" autocomplete="off" placeholder="搜索恢复点、提交、分支" value="${escapeAttr(filter.query || "")}" />
      <select data-recovery-filter="branch">
        <option value="">全部分支</option>
        ${branches.map((branch) => `<option value="${escapeAttr(branch)}" ${branch === filter.branch ? "selected" : ""}>${escapeHtml(branch)}</option>`).join("")}
      </select>
      <select data-recovery-filter="action">
        <option value="">全部动作</option>
        ${actions.map((item) => `<option value="${escapeAttr(item.value)}" ${item.value === filter.action ? "selected" : ""}>${escapeHtml(t(item.label))}</option>`).join("")}
      </select>
      <div class="recovery-filter-actions">
        <button class="mini-btn" data-recovery-filter-reset type="button" ${active ? "" : "disabled"}>重置</button>
        <button class="mini-btn danger" data-recovery-bulk-delete type="button" ${filteredPoints.length ? "" : "disabled"}>
          <span>${deleteText}</span><span class="command-hint">update-ref -d</span>
        </button>
      </div>
      <div class="recovery-filter-count">${escapeHtml(t("显示 {visible} / {total} 个恢复点", { visible: filteredPoints.length, total: points.length }))}</div>
    </div>
  `;
}

function filteredRecoveryPoints(points = state.data?.recoveryPoints || []) {
  const filter = state.recoveryFilter || {};
  const query = String(filter.query || "").trim().toLowerCase();
  return points.filter((point) => {
    if (filter.branch && (point.branch || "HEAD") !== filter.branch) return false;
    if (filter.action && recoveryActionValue(point) !== filter.action) return false;
    if (!query) return true;
    return recoverySearchText(point).includes(query);
  });
}

function recoveryFilterActive() {
  const filter = state.recoveryFilter || {};
  return Boolean(filter.query || filter.branch || filter.action);
}

function recoverySearchText(point) {
  return [
    point.ref,
    point.shortRef,
    point.sha,
    point.short,
    point.subject,
    point.branch,
    point.action,
    point.actionLabel,
    point.time,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueRecoveryActions(points) {
  const seen = new Map();
  points.forEach((point) => {
    const value = recoveryActionValue(point);
    if (!value || seen.has(value)) return;
    seen.set(value, point.actionLabel || value);
  });
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

function recoveryActionValue(point) {
  return point.action || point.actionLabel || "";
}

function defaultRecoveryPolicy() {
  const fallback = { keepDays: "90", maxPerBranch: "50" };
  try {
    const stored = JSON.parse(localStorage.getItem(recoveryPolicyStorageKey) || "{}");
    return {
      keepDays: recoveryPolicyInputValue(stored.keepDays, fallback.keepDays),
      maxPerBranch: recoveryPolicyInputValue(stored.maxPerBranch, fallback.maxPerBranch),
    };
  } catch {
    return fallback;
  }
}

function recoveryPolicyInputValue(value, fallback = "") {
  const raw = value ?? fallback ?? "";
  return String(raw).replace(/[^\d]/g, "").slice(0, 4);
}

function saveRecoveryPolicyPreference() {
  try {
    localStorage.setItem(recoveryPolicyStorageKey, JSON.stringify({
      keepDays: state.recoveryPolicy?.keepDays || "",
      maxPerBranch: state.recoveryPolicy?.maxPerBranch || "",
    }));
  } catch {
  }
}

function normalizedRecoveryPolicy() {
  const raw = state.recoveryPolicy || {};
  return {
    keepDays: boundedRecoveryPolicyNumber(raw.keepDays, 3650),
    maxPerBranch: boundedRecoveryPolicyNumber(raw.maxPerBranch, 500),
  };
}

function boundedRecoveryPolicyNumber(value, max) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const number = Number.parseInt(text, 10);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, max);
}

function recoveryPolicyActive(policy = normalizedRecoveryPolicy()) {
  return Boolean(policy.keepDays || policy.maxPerBranch);
}

function recoveryRetentionPlan(points, policy = normalizedRecoveryPolicy(), now = Date.now()) {
  const deleteRefs = new Set();
  if (policy.keepDays) {
    const threshold = now - policy.keepDays * 24 * 60 * 60 * 1000;
    points.forEach((point) => {
      const timeMs = recoveryPointTimeMs(point);
      if (timeMs && timeMs < threshold) deleteRefs.add(point.ref);
    });
  }
  if (policy.maxPerBranch) {
    const groups = new Map();
    points.forEach((point) => {
      const branch = point.branch || "HEAD";
      groups.set(branch, [...(groups.get(branch) || []), point]);
    });
    groups.forEach((group) => {
      group
        .sort((a, b) => recoveryPointTimeMs(b) - recoveryPointTimeMs(a) || String(b.ref).localeCompare(String(a.ref)))
        .slice(policy.maxPerBranch)
        .forEach((point) => deleteRefs.add(point.ref));
    });
  }
  const deletePoints = points.filter((point) => deleteRefs.has(point.ref));
  return {
    deletePoints,
    deleteCount: deletePoints.length,
    keepCount: Math.max(0, points.length - deletePoints.length),
  };
}

function recoveryPointTimeMs(point) {
  const timestamp = point?.timestamp || String(point?.shortRef || "").split("/")[0];
  const match = String(timestamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) return 0;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).getTime();
}

function recoveryPolicyLabel(policy = normalizedRecoveryPolicy()) {
  const labels = [
    policy.keepDays ? t("保留最近 {count} 天", { count: policy.keepDays }) : "",
    policy.maxPerBranch ? t("每个分支保留 {count} 个", { count: policy.maxPerBranch }) : "",
  ].filter(Boolean);
  return labels.join(currentLocale() === "en" ? "; " : "；");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function recoveryRowHtml(point, active) {
  return tt`
    <button class="recovery-row ${active ? "active" : ""}" data-recovery-ref="${escapeAttr(point.ref)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(t(point.actionLabel || "恢复点"))}</strong>
        <em>${escapeHtml(point.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(point.shortRef)}">${escapeHtml(point.shortRef)}</span>
      <span class="stash-branch">${escapeHtml(`${point.short || ""} · ${point.branch || "HEAD"}`)}</span>
    </button>
  `;
}

function recoveryDetailHtml(point) {
  return tt`
    <div class="recovery-actions">
      <button class="mini-btn" data-recovery-action="restore" data-recovery-ref="${escapeAttr(point.ref)}" type="button"><span>恢复到此处</span><span class="command-hint">reset --hard</span></button>
      <button class="mini-btn danger" data-recovery-action="delete" data-recovery-ref="${escapeAttr(point.ref)}" type="button"><span>删除恢复点</span><span class="command-hint">update-ref -d</span></button>
    </div>
    <div class="meta-grid stash-meta">
      <span>提交</span><div class="meta-value">${escapeHtml(point.short || point.sha || t("未知"))}</div>
      <span>动作</span><div class="meta-value">${escapeHtml(t(point.actionLabel || point.action || "危险操作前"))}</div>
      <span>分支</span><div class="meta-value">${escapeHtml(point.branch || "HEAD")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(point.time || t("未知"))}</div>
      <span>引用</span><div class="meta-value" title="${escapeAttr(point.ref)}">${escapeHtml(point.shortRef || point.ref)}</div>
    </div>
    <div class="empty-panel compact">
      <span>恢复会执行 git reset --hard 到这个恢复点。恢复前 Forkline 会再创建一个新的恢复点，方便撤回这次恢复。</span>
    </div>
  `;
}

function reflogSectionHtml(reflogState, selected) {
  const entries = reflogState.entries || [];
  const statusText = t(reflogState.loading ? "读取中" : reflogState.error ? "读取失败" : entries.length ? "{count} 条" : "无记录", { count: entries.length });
  return tt`
    <section class="reflog-section">
      <div class="reflog-section-head">
        <div>
          <strong>引用日志</strong>
          <span>HEAD 最近经过的位置，用来找回被重置或切走的提交</span>
        </div>
        <div class="reflog-section-tools">
          <em>${escapeHtml(statusText)}</em>
          ${reflogState.inline ? "" : `<button class="mini-btn" data-reflog-refresh type="button" ${reflogState.loading ? "disabled" : ""}>${t("刷新")}</button>`}
        </div>
      </div>
      ${
        reflogState.loading
          ? `<div class="empty-panel compact"><span>${t("正在读取 HEAD 引用日志...")}</span></div>`
          : reflogState.error
            ? `<div class="empty-panel compact"><strong>${t("引用日志读取失败")}</strong><span>${escapeHtml(t(reflogState.error))}</span></div>`
          : entries.length
          ? tt`
            <div class="reflog-list">
              ${entries.map((entry) => reflogRowHtml(entry, entry.selector === state.selectedReflogSelector)).join("")}
            </div>
            <div class="reflog-detail">
              ${selected ? reflogDetailHtml(selected) : `<div class="empty-panel compact"><span>${t("选择一条引用日志查看可恢复位置。")}</span></div>`}
            </div>
          `
          : `<div class="empty-panel compact"><span>${t("当前仓库没有可读取的 HEAD 引用日志。")}</span></div>`
      }
    </section>
  `;
}

function reflogRowHtml(entry, active) {
  return tt`
    <button class="reflog-row ${active ? "active" : ""}" data-reflog-selector="${escapeAttr(entry.selector)}" data-reflog-sha="${escapeAttr(entry.sha)}" type="button">
      <span class="stash-row-top">
        <strong title="${escapeAttr(entry.message || "")}">${escapeHtml(entry.message || t("HEAD 位置变更"))}</strong>
        <em>${escapeHtml(entry.selector || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(entry.sha || "")}">${escapeHtml(`${entry.short || ""} · ${entry.time || t("未知时间")}`)}</span>
      <span class="stash-branch">${escapeHtml([t(entry.actionLabel || ""), entry.author].filter(Boolean).join(" · ") || t("移动"))}</span>
    </button>
  `;
}

function reflogDetailHtml(entry) {
  return tt`
    <div class="reflog-actions">
      <button class="mini-btn" data-reflog-action="view" data-reflog-selector="${escapeAttr(entry.selector)}" type="button">查看提交</button>
      <button class="mini-btn" data-reflog-action="copy" data-reflog-selector="${escapeAttr(entry.selector)}" type="button">复制 SHA</button>
      <button class="mini-btn" data-reflog-action="create" data-reflog-selector="${escapeAttr(entry.selector)}" type="button"><span>创建恢复点</span><span class="command-hint">update-ref</span></button>
      <button class="mini-btn danger" data-reflog-action="restore" data-reflog-selector="${escapeAttr(entry.selector)}" type="button"><span>恢复到此处</span><span class="command-hint">reset --hard</span></button>
    </div>
    <div class="meta-grid stash-meta">
      <span>位置</span><div class="meta-value">${escapeHtml(entry.selector || "HEAD")}</div>
      <span>提交</span><div class="meta-value" title="${escapeAttr(entry.sha || "")}">${escapeHtml(entry.short || entry.sha || t("未知"))}</div>
      <span>动作</span><div class="meta-value">${escapeHtml(t(entry.actionLabel || "移动"))}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(entry.time || t("未知"))}</div>
      <span>说明</span><div class="meta-value" title="${escapeAttr(entry.message || "")}">${escapeHtml(entry.message || t("HEAD 位置变更"))}</div>
    </div>
    <div class="empty-panel compact">
      <span>引用日志是 Git 记录 HEAD 曾经指向哪里。创建恢复点只保存引用；恢复到此处会执行 git reset --hard，执行前 Forkline 会再创建一个恢复前恢复点。</span>
    </div>
  `;
}

function renderLogsTab() {
  const logs = state.data?.operationLog || [];
  const running = state.data?.runningOperations || [];
  els.detailTitle.textContent = t("操作日志");
  els.detailSub.textContent = running.length
    ? t("{count} 个 Git 操作正在执行", { count: running.length })
    : logs.length
      ? t("最近 {count} 条 Git 操作", { count: logs.length })
      : t("还没有执行过 Git 操作");
  els.detailNode.style.borderColor = running.length || logs.some((item) => item.status === "error") ? "var(--amber)" : "var(--teal)";
  setActiveDiff(null);
  els.detailBody.innerHTML = tt`
    <div class="logs-toolbar">
      <div>
        <strong>最近操作</strong>
        <span>成功、失败、耗时和 Git 输出摘要</span>
      </div>
      <button class="mini-btn" data-log-refresh type="button">刷新</button>
    </div>
    ${
      running.length
        ? `<section class="running-log-section">
            <div class="running-log-title">进行中</div>
            <div class="operation-log-list">${running.map(renderRunningOperationItem).join("")}</div>
          </section>`
        : ""
    }
    <div class="operation-log-list">
      ${
        logs.length
          ? logs.map(renderOperationLogItem).join("")
          : `<div class="log-empty">${t("执行抓取、提交、切换、合并、储藏等操作后，会在这里显示结果。")}</div>`
      }
    </div>
  `;
}

function renderSettingsTab() {
  const repos = recentRepos();
  const policy = normalizedRecoveryPolicy();
  const policyLabel = t(recoveryPolicyLabel(policy) || "策略未启用");
  const appUpdate = settingsAppUpdateView();
  els.detailTitle.textContent = t("设置");
  els.detailSub.textContent = t("本机偏好和界面行为");
  els.detailNode.style.borderColor = "var(--violet)";
  setActiveDiff(null);
  els.detailBody.innerHTML = tt`
    <div class="settings-layout">
      <section class="settings-card settings-version-card">
        <div class="settings-card-head">
          <div>
            <strong>关于 Forkline</strong>
            <span>当前版本和 GitHub Release 更新状态。</span>
          </div>
          <span class="settings-update-status ${appUpdate.statusClass}">${escapeHtml(appUpdate.statusText)}</span>
        </div>
        <div class="settings-version-grid">
          <div class="settings-version-item">
            <span>当前版本</span>
            <strong>${escapeHtml(appUpdate.currentVersion)}</strong>
          </div>
          <div class="settings-version-item">
            <span>最新版本</span>
            <strong>${escapeHtml(appUpdate.latestVersion)}</strong>
          </div>
        </div>
        ${
          appUpdate.showInstallAction
            ? `<div class="settings-update-actions">
                <button class="mini-btn primary" data-settings-action="installUpdate" type="button" ${appUpdate.installing ? "disabled" : ""}>${escapeHtml(appUpdate.installing ? t("正在更新并重启") : t("立即更新并重启"))}</button>
              </div>`
            : ""
        }
        ${appUpdate.installNote ? `<div class="settings-update-note">${escapeHtml(appUpdate.installNote)}</div>` : ""}
        ${appUpdate.installError ? `<div class="settings-update-error">${escapeHtml(appUpdate.installError)}</div>` : ""}
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>外观</strong>
            <span>主题会保存在当前浏览器。</span>
          </div>
        </div>
        <div class="settings-choice-row settings-theme-grid">
          ${themeCatalog.map(settingsThemeButton).join("")}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>语言</strong>
            <span>界面语言会保存在当前浏览器。</span>
          </div>
        </div>
        <div class="settings-choice-row">
          ${settingsLocaleButton("zh-CN", "中文", t("使用中文界面"))}
          ${settingsLocaleButton("en", "English", t("使用英文界面"))}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>最近仓库</strong>
            <span>${repos.length ? t("已保存 {count} 个本机仓库入口", { count: repos.length }) : t("当前没有最近仓库记录")}</span>
          </div>
          <button class="mini-btn danger" data-settings-action="clearRecentRepos" type="button" ${repos.length ? "" : "disabled"}>清空</button>
        </div>
        <div class="settings-list">
          ${
            repos.length
              ? repos.slice(0, 6).map(settingsRecentRepoRow).join("")
              : `<div class="empty-panel compact"><span>${t("成功打开真实仓库后，这里会显示最近仓库。")}</span></div>`
          }
        </div>
        <button class="mini-btn settings-wide-action" data-settings-action="chooseRepo" type="button">选择 Git 仓库目录</button>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>恢复点保留策略</strong>
            <span>${escapeHtml(policyLabel)}</span>
          </div>
        </div>
        <div class="settings-policy-grid">
          <label class="recovery-retention-rule">
            <span>保留最近</span>
            <input data-recovery-policy="keepDays" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.keepDays)}" />
            <em>${t("天")}</em>
          </label>
          <label class="recovery-retention-rule">
            <span>每分支</span>
            <input data-recovery-policy="maxPerBranch" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.maxPerBranch)}" />
            <em>${t("个")}</em>
          </label>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>布局</strong>
            <span>恢复侧栏、右栏和底部区域高度到默认值。</span>
          </div>
          <button class="mini-btn" data-settings-action="resetLayout" type="button">重置布局</button>
        </div>
      </section>
    </div>
  `;
}

function settingsAppUpdateView() {
  const update = state.appUpdate || {};
  const status = update.status || "loading";
  const installing = Boolean(update.installing);
  const installError = String(update.installError || "");
  const displayVersion = (value) => {
    const version = String(value || "").trim();
    return version ? (version.startsWith("v") ? version : `v${version}`) : "";
  };
  const currentVersion = displayVersion(update.currentVersion) || t("正在读取");
  const latestVersion = displayVersion(update.latestVersion) || (status === "loading" ? t("正在检查") : t("未知"));
  const shared = {
    currentVersion,
    latestVersion,
    installing,
    installError,
    showInstallAction: status === "available" && Boolean(update.installSupported),
    installNote: status === "available" && !update.installSupported
      ? t("当前安装方式不支持一键更新，请点击左上角更新图标打开 Release。")
      : "",
  };
  if (installing) {
    return { ...shared, statusClass: "loading", statusText: t("正在更新并重启") };
  }
  if (installError) {
    return { ...shared, statusClass: "unavailable", statusText: t("更新失败") };
  }
  if (status === "available") {
    return {
      ...shared,
      statusClass: "available",
      statusText: t("发现新版本 {version}", { version: latestVersion }),
    };
  }
  if (status === "current") {
    return { ...shared, statusClass: "current", statusText: t("已是最新版本") };
  }
  if (status === "unavailable") {
    return { ...shared, statusClass: "unavailable", statusText: t("暂时无法检查更新") };
  }
  return { ...shared, statusClass: "loading", statusText: t("正在检查更新") };
}

async function installAppUpdate() {
  const update = state.appUpdate || {};
  if (update.installing || update.status !== "available" || !update.installSupported) return;
  if (typeof fileEditorDirty === "function" && fileEditorDirty()) {
    throw new Error(t("文件编辑器还有未保存的修改，请先保存或关闭后再更新 Forkline。"));
  }
  if (String(els.commitSummary?.value || "").trim() || String(els.commitBody?.value || "").trim()) {
    throw new Error(t("提交信息框还有未提交内容，请先处理后再更新 Forkline。"));
  }
  const current = update.currentVersion ? `v${String(update.currentVersion).replace(/^v/i, "")}` : t("未知");
  const latest = update.latestVersion ? `v${String(update.latestVersion).replace(/^v/i, "")}` : t("未知");
  if (!confirm(t("确认将 Forkline 从 {current} 更新到 {latest}？\n\n只会更新 Forkline 自身，不会修改当前管理的仓库。页面会短暂断开，完成后自动刷新。", { current, latest }))) return;

  state.appUpdate.installing = true;
  state.appUpdate.installError = "";
  renderInspector();
  try {
    await api("/api/app-update/install", {
      method: "POST",
      body: JSON.stringify({ version: update.latestVersion }),
    });
    await waitForSelfUpdateRestart(update.latestVersion);
  } catch (error) {
    state.appUpdate.installing = false;
    state.appUpdate.installError = error.message;
    if (state.selectedTab === "settings") renderInspector();
    toast(error.message);
  }
}

function settingsThemeButton(theme) {
  const active = state.theme === theme.id;
  return `
    <button class="settings-choice settings-theme-choice ${active ? "active" : ""}" data-settings-theme="${escapeAttr(theme.id)}" type="button">
      <span class="settings-theme-preview" aria-hidden="true">
        ${theme.swatches.map((color) => `<i class="settings-theme-swatch" style="--theme-swatch:${escapeAttr(color)}"></i>`).join("")}
      </span>
      <strong>${escapeHtml(t(theme.label))}</strong>
      <span class="settings-theme-description">${escapeHtml(t(theme.description))}</span>
    </button>
  `;
}

function settingsLocaleButton(locale, label, description) {
  const active = state.locale === locale;
  return `
    <button class="settings-choice ${active ? "active" : ""}" data-settings-locale="${escapeAttr(locale)}" type="button">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(description)}</span>
    </button>
  `;
}

function settingsRecentRepoRow(repo) {
  return `
    <div class="settings-repo-row">
      <div>
        <strong title="${escapeAttr(repo.name || repo.path)}">${escapeHtml(repo.name || repo.path)}</strong>
        <span title="${escapeAttr(repo.path)}">${escapeHtml(repo.path || "")}</span>
      </div>
      <em>${escapeHtml(repo.branch || t("未记录分支"))}</em>
    </div>
  `;
}

function renderRunningOperationItem(item) {
  const duration = item.elapsed || formatDurationText(item.durationMs);
  const phaseLabel = item.cancelRequested
    ? t("取消中")
    : item.phase === "preparing"
      ? t("准备中")
      : item.phase === "finishing"
        ? t("收尾中")
        : t("进行中");
  const command = item.command || t("正在准备 Git 命令");
  const output = item.outputTail || (item.cancelRequested
    ? t("正在终止 Git 进程，请稍候。")
    : t("等待 Git 输出。若长时间没有变化，请检查认证窗口或网络状态。"));
  return tt`
    <article class="operation-log-item running">
      <div class="operation-log-head">
        <span class="log-status">${escapeHtml(phaseLabel)}</span>
        <strong title="${escapeAttr(t(item.label || ""))}">${escapeHtml(t(item.label || "Git 操作"))}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.startedTime || "")}</span>
        <code>${escapeHtml(item.action || "")}</code>
      </div>
      <div class="operation-log-command">
        <code title="${escapeAttr(command)}">${escapeHtml(command)}</code>
        ${item.cancelSupported ? `<button class="mini-btn danger" data-operation-cancel="${escapeAttr(item.id)}" type="button" ${item.cancellable ? "" : "disabled"}>${escapeHtml(item.cancelRequested ? t("取消中") : t("取消操作"))}</button>` : ""}
      </div>
      <pre>${escapeHtml(output)}</pre>
    </article>
  `;
}

function renderOperationLogItem(item) {
  const ok = item.status === "success";
  const cancelled = item.status === "cancelled";
  const label = t(ok ? "成功" : cancelled ? "已取消" : "失败");
  const duration = formatDurationText(item.durationMs);
  const summary = t(String(item.summary || (ok ? "操作已完成" : cancelled ? "操作已取消" : "操作失败")).trim());
  const output = String(item.outputTail || "").trim();
  const detail = output && output !== summary ? `${summary}\n\n${output}` : summary;
  const command = item.command || item.action || "";
  return tt`
    <article class="operation-log-item ${ok ? "success" : cancelled ? "cancelled" : "error"}">
      <div class="operation-log-head">
        <span class="log-status">${label}</span>
        <strong title="${escapeAttr(t(item.label || ""))}">${escapeHtml(t(item.label || "Git 操作"))}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.time || "")}</span>
        <code title="${escapeAttr(command)}">${escapeHtml(command)}</code>
      </div>
      <pre>${escapeHtml(detail)}</pre>
    </article>
  `;
}

async function cancelRunningOperation(id, options = {}) {
  let operation = (state.data?.runningOperations || []).find((item) => String(item.id) === String(id));
  if (!operation) {
    await refreshOperationProgress();
    operation = (state.data?.runningOperations || []).find((item) => String(item.id) === String(id));
  }
  if (!operation) throw new Error(t("这个 Git 操作已经结束，请刷新操作日志查看结果。"));
  if (!operation.cancellable && !operation.cancelRequested) throw new Error(t("这个 Git 操作当前不能取消。"));
  if (operation.cancelRequested) return;
  if (options.confirm !== false) {
    const command = operation.command ? `\n\n${operation.command}` : "";
    if (!confirm(t("确认取消“{label}”？{command}\n\nGit 会停止当前命令，已经完成的远端传输不会自动回退。", { label: t(operation.label || "Git 操作"), command }))) return;
  }
  if (options.button) options.button.disabled = true;
  const result = await api("/api/operations/cancel", {
    method: "POST",
    body: JSON.stringify({ id: operation.id }),
  });
  renderOperationProgressIfVisible();
  toast(result.output || t("正在取消操作"));
  return result;
}

function formatDurationText(ms) {
  const value = Math.max(0, Number(ms) || 0);
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  return `${Math.round(seconds / 60)}min`;
}

async function refreshLogsTab() {
  if (!state.data) return;
  const repoPath = repoPathSnapshot();
  await api("/api/operations");
  if (!isCurrentRepoPath(repoPath)) return;
  renderInspector();
}

function selectRecoveryPoint(ref) {
  if (!ref || ref === state.selectedRecoveryRef) return;
  state.selectedRecoveryRef = ref;
  renderInspector();
}

function findReflogEntry(selector) {
  const entries = Array.isArray(state.data?.reflogEntries) ? state.data.reflogEntries : state.reflog.entries || [];
  return entries.find((entry) => entry.selector === selector);
}

function selectReflogEntry(selector) {
  if (!selector || selector === state.selectedReflogSelector) return;
  state.selectedReflogSelector = selector;
  renderInspector();
}

async function viewReflogEntry(entry) {
  if (!entry?.sha) return;
  state.selectedTab = "details";
  await selectRef(entry.sha);
}

function updateRecoveryFilter(key, value, input) {
  if (!["query", "branch", "action"].includes(key)) return;
  state.recoveryFilter = { ...(state.recoveryFilter || {}), [key]: value };
  renderInspector();
  if (input && key === "query") {
    const cursor = input.selectionStart ?? value.length;
    requestAnimationFrame(() => {
      const next = els.detailBody.querySelector('[data-recovery-filter="query"]');
      if (!next) return;
      next.focus();
      next.setSelectionRange(cursor, cursor);
    });
  }
}

function resetRecoveryFilter() {
  state.recoveryFilter = { query: "", branch: "", action: "" };
  renderInspector();
}

function updateRecoveryPolicy(key, value, input) {
  if (!["keepDays", "maxPerBranch"].includes(key)) return;
  const cleanValue = recoveryPolicyInputValue(value);
  state.recoveryPolicy = { ...(state.recoveryPolicy || {}), [key]: cleanValue };
  saveRecoveryPolicyPreference();
  renderInspector();
  if (input) {
    const cursor = Math.min(input.selectionStart ?? cleanValue.length, cleanValue.length);
    requestAnimationFrame(() => {
      const next = els.detailBody.querySelector(`[data-recovery-policy="${key}"]`);
      if (!next) return;
      next.focus();
      next.setSelectionRange(cursor, cursor);
    });
  }
}

async function pruneRecoveryPointsByPolicy(button) {
  if (!state.data) return;
  const policy = normalizedRecoveryPolicy();
  if (!recoveryPolicyActive(policy)) {
    toast(t("请先设置恢复点保留策略。"));
    return;
  }
  const plan = recoveryRetentionPlan(state.data.recoveryPoints || [], policy);
  if (!plan.deleteCount) {
    toast(t("当前没有需要清理的恢复点。"));
    return;
  }
  const message = t("确认按保留策略清理 {deleteCount} 个恢复点？\n\n{policy}\n保留：{keepCount} 个\n命令：git update-ref -d <恢复点引用>\n\n删除后不能再通过 Forkline 恢复到这些引用。", {
    deleteCount: plan.deleteCount,
    policy: recoveryPolicyLabel(policy),
    keepCount: plan.keepCount,
  });
  if (!state.data.repo.isSample && !confirm(message)) return;
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        action: "pruneRecoveryPoints",
        keepDays: policy.keepDays,
        maxPerBranch: policy.maxPerBranch,
        deleteRefs: plan.deletePoints.map((point) => ({ ref: point.ref, sha: point.sha })),
      }),
    });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("恢复点清理完成"));
    const data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    if (!isCurrentRepoPath(repoPath)) return;
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedRecoveryRef = filteredRecoveryPoints()[0]?.ref || "";
    renderAll();
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteFilteredRecoveryPoints(button) {
  if (!state.data) return;
  const points = filteredRecoveryPoints();
  if (!points.length) {
    toast(t("当前筛选结果没有可删除的恢复点"));
    return;
  }
  const filter = state.recoveryFilter || {};
  const conditions = [
    filter.query ? t("搜索：{query}", { query: filter.query }) : "",
    filter.branch ? t("分支：{branch}", { branch: filter.branch }) : "",
    filter.action ? t("动作：{action}", { action: t(points[0]?.actionLabel || filter.action) }) : "",
  ].filter(Boolean);
  const scopeText = conditions.length ? conditions.join("\n") : t("未设置筛选，将删除当前全部恢复点");
  const message = t("确认删除当前列表里的 {count} 个恢复点？\n\n{scope}\n\n命令：git update-ref -d <恢复点引用>\n\n删除后不能再通过 Forkline 恢复到这些引用。", { count: points.length, scope: scopeText });
  if (!state.data.repo.isSample && !confirm(message)) return;
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteRecoveryPoints", refs: points.map((point) => ({ ref: point.ref, sha: point.sha })) }) });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("恢复点已删除"));
    const data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    if (!isCurrentRepoPath(repoPath)) return;
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedRecoveryRef = filteredRecoveryPoints()[0]?.ref || "";
    renderAll();
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRecoveryAction(action, ref, button) {
  if (!state.data || !ref) return;
  const point = (state.data.recoveryPoints || []).find((item) => item.ref === ref);
  if (!point) {
    toast(t("恢复点已经不存在，请刷新后再试"));
    return;
  }
  const message =
    action === "restore"
      ? t("确认恢复当前分支到这个恢复点？\n\n恢复点：{ref}\n提交：{sha}\n命令：git reset --hard {fullRef}\n\n这会移动当前分支并覆盖工作区。Forkline 会在恢复前再自动创建一个恢复点。", { ref: point.shortRef, sha: point.short || point.sha, fullRef: point.ref })
      : t("确认删除这个恢复点？\n\n{ref}\n\n删除后不能再通过 Forkline 恢复到这个引用。", { ref: point.shortRef });
  if (!state.data.repo.isSample && !confirm(message)) return;
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const apiAction = action === "restore" ? "restoreRecoveryPoint" : "deleteRecoveryPoint";
    const snapshot = action === "restore" ? currentBranchSnapshotPayload() : {};
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: apiAction, ref, sha: point.sha, ...snapshot }) });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("恢复点操作完成"));
    state.commitDetails.clear();
    state.selectedChanges.clear();
    const data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    if (!isCurrentRepoPath(repoPath)) return;
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.recoveryPoints?.some((item) => item.ref === state.selectedRecoveryRef)) {
      state.selectedRecoveryRef = state.data.recoveryPoints?.[0]?.ref || "";
    }
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
    if (state.selectedSha && state.selectedTab !== "recovery") {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runReflogAction(action, selector, button) {
  if (!state.data || !selector) return;
  const entry = findReflogEntry(selector);
  if (!entry) {
    toast(t("引用日志记录已经变化，请刷新后再试"));
    return;
  }
  if (action === "view") {
    await viewReflogEntry(entry);
    return;
  }
  if (action === "copy") {
    await copyText(entry.sha);
    toast(t("已复制提交 SHA"));
    return;
  }
  if (action !== "create" && action !== "restore") return;
  const body = { selector: entry.selector, sha: entry.sha };
  const apiAction = action === "create" ? "createRecoveryPointFromReflog" : "restoreReflogEntry";
  if (action === "restore") {
    const message = t("确认把当前分支恢复到这条引用日志？\n\n位置：{position}\n提交：{sha}\n说明：{message}\n命令：git reset --hard {fullSha}\n\n这会移动当前分支并覆盖工作区。Forkline 会在恢复前再自动创建一个恢复点。", {
      position: entry.selector,
      sha: entry.short || entry.sha,
      message: entry.message || t("HEAD 位置变更"),
      fullSha: entry.sha,
    });
    if (!state.data.repo.isSample && !confirm(message)) return;
  }
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const snapshot = action === "restore" || action === "create" ? currentBranchSnapshotPayload() : {};
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: apiAction, ...body, ...snapshot }) });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("引用日志操作完成"));
    state.commitDetails.clear();
    state.selectedChanges.clear();
    const data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    if (!isCurrentRepoPath(repoPath)) return;
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (result.recovery?.ref) state.selectedRecoveryRef = result.recovery.ref;
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runReflogMenuAction(action) {
  const entry = state.contextReflogEntry;
  hideReflogContextMenu();
  if (!entry?.selector) return;
  await runReflogAction(action, entry.selector, null);
}

async function runTagAction(action, tagName, button) {
  if (!state.data || !tagName) return;
  const tag = (state.data.tags || []).find((item) => item.name === tagName) || { name: tagName };
  if (action === "view") {
    state.selectedTab = "details";
    await selectRef(tag.name);
    return;
  }
  if (action === "copy") {
    await copyText(tag.name);
    toast(t("已复制 Tag 名称"));
    return;
  }
  const remote = action === "push" || action === "deleteRemote" ? defaultTagRemote() : null;
  if ((action === "push" || action === "deleteRemote") && !remote?.name) {
    toast(t("当前仓库没有远端。请先添加远端仓库后再操作 Tag。"));
    return;
  }
  const message = tagActionConfirmMessage(action, tag.name, remote?.name);
  if (!state.data.repo.isSample && !confirm(message)) return;
  const actionMap = {
    push: "pushTag",
    deleteLocal: "deleteTag",
    deleteRemote: "deleteRemoteTag",
  };
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const payload = { action: actionMap[action], name: tag.name, sha: tag.object || "" };
    if (remote?.name) Object.assign(payload, { remote: remote.name }, remoteConfigSnapshotPayload(remote));
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("Tag 操作完成"));
    const data = await loadStateForRepoPath(repoPath);
    if (!data) return;
    state.commitDetails.clear();
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.tags?.some((item) => item.name === state.selectedTag)) {
      state.selectedTag = state.data.tags?.[0]?.name || "";
    }
    renderAll();
    if (state.selectedSha && state.selectedTab !== "tags") {
      await renderSelectedCommitForRepoPath(repoPath);
    }
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function defaultTagRemote() {
  const remotes = syncRemotes();
  return remotes.find((remote) => remote.name === "origin") || remotes[0] || null;
}

function tagActionConfirmMessage(action, name, remoteName = "<远端>") {
  const remote = remoteName === "<远端>" ? t("<远端>") : remoteName;
  if (action === "push") return t("确认推送 Tag：{name}？\n\n命令：git push {remote} refs/tags/{name}:refs/tags/{name}", { name, remote });
  if (action === "deleteLocal") return t("确认删除本地 Tag：{name}？\n\n命令：git tag -d {name}\n此操作不会删除远端 Tag。", { name });
  if (action === "deleteRemote") return t("确认删除远端 Tag：{name}？\n\n命令：git push {remote} :refs/tags/{name}\n此操作不会删除本地 Tag。", { name, remote });
  return t("确认操作 Tag：{name}？", { name });
}

