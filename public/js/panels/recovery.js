// Recovery points, reflog, and retention policy.
function renderRecoveryTab() {
  if (renderRepoDetailPlaceholder("recoveryPoints", "恢复点", "var(--purple)")) return;
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
        ${recoveryAutoPruneHtml()}
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

function defaultRecoveryPolicy(repoPath = repoPathSnapshot()) {
  const fallback = recoveryPolicyFallback();
  const stored = readRecoveryPolicyPreferences();
  const repoKey = recoveryPolicyRepoKey(repoPath);
  const repoPolicy = repoKey && stored.repositories && typeof stored.repositories === "object"
    ? stored.repositories[repoKey]
    : null;
  const raw = repoPolicy && typeof repoPolicy === "object"
    ? repoPolicy
    : isLegacyRecoveryPolicyPreferences(stored)
      ? stored
      : {};
  return {
    keepDays: recoveryPolicyInputValue(raw.keepDays, fallback.keepDays),
    maxPerBranch: recoveryPolicyInputValue(raw.maxPerBranch, fallback.maxPerBranch),
    autoPrune: Boolean(raw.autoPrune),
  };
}

function recoveryPolicyFallback() {
  return { keepDays: "90", maxPerBranch: "50", autoPrune: false };
}

function recoveryPolicyRepoKey(value) {
  const path = String(value || "").trim().replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(path) || path.startsWith("//") ? path.toLowerCase() : path;
}

function readRecoveryPolicyPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(recoveryPolicyStorageKey) || "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

function isLegacyRecoveryPolicyPreferences(stored) {
  return Object.prototype.hasOwnProperty.call(stored || {}, "keepDays")
    || Object.prototype.hasOwnProperty.call(stored || {}, "maxPerBranch")
    || Object.prototype.hasOwnProperty.call(stored || {}, "autoPrune");
}

function loadRecoveryPolicyForRepo(repo = state.data?.repo) {
  const repoPath = repo && !repo.isSample ? repo.path || "" : "";
  const stored = readRecoveryPolicyPreferences();
  state.recoveryPolicyRepoPath = repoPath;
  state.recoveryPolicy = defaultRecoveryPolicy(repoPath);
  if (repoPath && isLegacyRecoveryPolicyPreferences(stored)) saveRecoveryPolicyPreference();
  return state.recoveryPolicy;
}

function recoveryPolicyInputValue(value, fallback = "") {
  const raw = value ?? fallback ?? "";
  return String(raw).replace(/[^\d]/g, "").slice(0, 4);
}

function saveRecoveryPolicyPreference() {
  const repoPath = state.recoveryPolicyRepoPath || (state.data?.repo && !state.data.repo.isSample ? state.data.repo.path : "");
  const repoKey = recoveryPolicyRepoKey(repoPath);
  if (!repoKey) return false;
  try {
    const stored = readRecoveryPolicyPreferences();
    const repositories = stored.repositories && typeof stored.repositories === "object" && !Array.isArray(stored.repositories)
      ? { ...stored.repositories }
      : {};
    repositories[repoKey] = {
      keepDays: state.recoveryPolicy?.keepDays || "",
      maxPerBranch: state.recoveryPolicy?.maxPerBranch || "",
      autoPrune: Boolean(state.recoveryPolicy?.autoPrune),
    };
    localStorage.setItem(recoveryPolicyStorageKey, JSON.stringify({ version: 2, repositories }));
    return true;
  } catch {
    return false;
  }
}

function normalizedRecoveryPolicy() {
  const raw = state.recoveryPolicy || {};
  return {
    keepDays: boundedRecoveryPolicyNumber(raw.keepDays, 3650),
    maxPerBranch: boundedRecoveryPolicyNumber(raw.maxPerBranch, 500),
    autoPrune: Boolean(raw.autoPrune),
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

function recoveryAutoPruneHtml() {
  return tt`
    <label class="recovery-auto-prune" title="危险操作创建恢复点后检查保留策略；发现候选时仍会先询问，不会静默删除。">
      <input data-recovery-policy="autoPrune" type="checkbox" ${state.recoveryPolicy.autoPrune ? "checked" : ""} />
      <span>操作后提醒整理</span>
      <em>显示候选并确认</em>
    </label>
  `;
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
  if (!["keepDays", "maxPerBranch", "autoPrune"].includes(key)) return;
  if (key === "autoPrune") {
    state.recoveryPolicy = { ...(state.recoveryPolicy || {}), autoPrune: Boolean(value) };
    saveRecoveryPolicyPreference();
    renderInspector();
    return;
  }
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

function recoveryPruneConfirmationMessage(plan, policy, automatic = false) {
  const preview = plan.deletePoints.slice(0, 6).map((point) => [
    t(point.actionLabel || point.action || "恢复点"),
    point.branch || "HEAD",
    point.short || point.sha?.slice(0, 7) || point.shortRef || point.ref,
    point.time || "",
  ].filter(Boolean).join(" · "));
  const extra = Math.max(0, plan.deleteCount - preview.length);
  const heading = automatic
    ? t("危险操作已完成并创建了恢复点。当前仓库有 {count} 个旧恢复点超出保留策略，确认清理以下候选？", { count: plan.deleteCount })
    : t("确认按当前仓库的保留策略清理 {count} 个恢复点？", { count: plan.deleteCount });
  return [
    heading,
    "",
    t("策略：{policy}", { policy: recoveryPolicyLabel(policy) }),
    t("保留：{count} 个", { count: plan.keepCount }),
    "",
    t("候选预览："),
    ...preview.map((item) => `- ${item}`),
    extra ? t("另有 {count} 个候选未在此处列出。", { count: extra }) : "",
    "",
    t("命令：git update-ref -d <恢复点引用>"),
    t("删除后不能再通过 Forkline 恢复到这些引用。"),
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join("\n");
}

async function maybeOfferRecoveryPolicyCleanup(result) {
  if (!result?.recovery?.ref || !result.recovery.sha || !state.data || state.data.repo.isSample || !state.recoveryPolicy?.autoPrune) return false;
  const policy = normalizedRecoveryPolicy();
  if (!recoveryPolicyActive(policy)) return false;
  const plan = recoveryRetentionPlan(state.data.recoveryPoints || [], policy);
  if (!plan.deleteCount) return false;
  return pruneRecoveryPointsByPolicy(null, { automatic: true });
}

async function pruneRecoveryPointsByPolicy(button, options = {}) {
  if (!state.data) return false;
  const policy = normalizedRecoveryPolicy();
  if (!recoveryPolicyActive(policy)) {
    if (!options.automatic) toast(t("请先设置恢复点保留策略。"));
    return false;
  }
  const plan = recoveryRetentionPlan(state.data.recoveryPoints || [], policy);
  if (!plan.deleteCount) {
    if (!options.automatic) toast(t("当前没有需要清理的恢复点。"));
    return false;
  }
  const message = recoveryPruneConfirmationMessage(plan, policy, Boolean(options.automatic));
  if (!state.data.repo.isSample && !confirm(message)) return false;
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
    return true;
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return false;
    toast(error.message);
    return false;
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
