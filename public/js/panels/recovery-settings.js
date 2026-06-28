// Tags, recovery points, reflog, logs, and settings panels.
function renderTagsTab() {
  const tags = state.data?.tags || [];
  if (state.selectedTag && !tags.some((tag) => tag.name === state.selectedTag)) {
    state.selectedTag = "";
  }
  if (!state.selectedTag && tags.length) state.selectedTag = tags[0].name;
  const selected = tags.find((tag) => tag.name === state.selectedTag);
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = "标签列表";
  els.detailSub.textContent = tags.length ? `${tags.length} 个 Tag` : "没有 Tag";
  setActiveDiff(null);
  if (!tags.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有 Tag</strong>
        <span>在提交右键菜单中选择“创建 Tag”后会显示在这里。</span>
      </div>
    `;
    return;
  }
  els.detailBody.innerHTML = `
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
      <span class="stash-message" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || "无说明")}</span>
      <span class="stash-branch">${escapeHtml(tag.object ? `${tag.object} · ${tag.type || "commit"}` : tag.type || "commit")}</span>
    </button>
  `;
}

function tagDetailHtml(tag) {
  return `
    <div class="tag-actions">
      <button class="mini-btn" data-tag-action="view" data-tag-name="${escapeAttr(tag.name)}" type="button">查看提交</button>
      <button class="mini-btn" data-tag-action="copy" data-tag-name="${escapeAttr(tag.name)}" type="button">复制名称</button>
      <button class="mini-btn" data-tag-action="push" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> refs/tags/${escapeAttr(tag.name)}:refs/tags/${escapeAttr(tag.name)}">推送 Tag</button>
      <button class="mini-btn danger" data-tag-action="deleteLocal" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git tag -d ${escapeAttr(tag.name)}">删除本地</button>
      <button class="mini-btn danger" data-tag-action="deleteRemote" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> :refs/tags/${escapeAttr(tag.name)}">删除远端</button>
    </div>
    <div class="meta-grid stash-meta">
      <span>名称</span><div class="meta-value">${escapeHtml(tag.name)}</div>
      <span>对象</span><div class="meta-value">${escapeHtml(tag.object || "未知")}</div>
      <span>类型</span><div class="meta-value">${escapeHtml(tag.type || "commit")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(tag.time || "未知")}</div>
      <span>说明</span><div class="meta-value" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || "无说明")}</div>
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
  const reflogEntries = state.data?.reflogEntries || [];
  const filteredPoints = filteredRecoveryPoints(points);
  if (state.selectedRecoveryRef && !points.some((point) => point.ref === state.selectedRecoveryRef)) {
    state.selectedRecoveryRef = "";
  }
  if (state.selectedRecoveryRef && !filteredPoints.some((point) => point.ref === state.selectedRecoveryRef)) {
    state.selectedRecoveryRef = "";
  }
  if (!state.selectedRecoveryRef && filteredPoints.length) state.selectedRecoveryRef = filteredPoints[0].ref;
  const selected = filteredPoints.find((point) => point.ref === state.selectedRecoveryRef);
  if (state.selectedReflogSelector && !reflogEntries.some((entry) => entry.selector === state.selectedReflogSelector)) {
    state.selectedReflogSelector = "";
  }
  if (!state.selectedReflogSelector && reflogEntries.length) state.selectedReflogSelector = reflogEntries[0].selector;
  const selectedReflog = reflogEntries.find((entry) => entry.selector === state.selectedReflogSelector);
  els.detailNode.style.borderColor = "var(--purple)";
  els.detailTitle.textContent = "恢复点";
  els.detailSub.textContent = [
    points.length ? `恢复点 ${filteredPoints.length} / ${points.length}` : "没有自动恢复点",
    reflogEntries.length ? `引用日志 ${reflogEntries.length} 条` : "",
  ].filter(Boolean).join(" · ");
  setActiveDiff(null);
  if (!points.length && !reflogEntries.length) {
    els.detailBody.innerHTML = `
      <div class="empty-panel">
        <strong>没有恢复点</strong>
        <span>执行变基、追加、历史编辑或重置前，Forkline 会自动在这里留下恢复点；HEAD 引用日志也会显示在这里。</span>
      </div>
    `;
    return;
  }
  els.detailBody.innerHTML = `
    <div class="recovery-layout">
      ${
        points.length
          ? `
            ${recoveryFilterHtml(points, filteredPoints)}
            ${recoveryRetentionHtml(points)}
            <div class="recovery-list">
              ${
                filteredPoints.length
                  ? filteredPoints.map((point) => recoveryRowHtml(point, point.ref === state.selectedRecoveryRef)).join("")
                  : `<div class="empty-panel compact"><span>没有匹配的恢复点。可以调整搜索、分支或动作筛选。</span></div>`
              }
            </div>
            <div class="recovery-detail">
              ${selected ? recoveryDetailHtml(selected) : `<div class="empty-panel compact"><span>选择一个恢复点查看详情。</span></div>`}
            </div>
          `
          : `<div class="empty-panel compact"><strong>没有自动恢复点</strong><span>执行变基、追加、历史编辑或重置前，Forkline 会自动在这里留下恢复点。</span></div>`
      }
      ${reflogSectionHtml(reflogEntries, selectedReflog)}
    </div>
  `;
}

function recoveryRetentionHtml(points) {
  const policy = normalizedRecoveryPolicy();
  const plan = recoveryRetentionPlan(points, policy);
  const active = recoveryPolicyActive(policy);
  const buttonText = !active ? "设置策略" : plan.deleteCount ? "按策略清理" : "无需清理";
  const summary = active
    ? `将清理 ${plan.deleteCount} 个，保留 ${plan.keepCount} 个`
    : `当前共有 ${points.length} 个恢复点`;
  return `
    <section class="recovery-retention">
      <div class="recovery-retention-head">
        <strong>保留策略</strong>
        <span>${escapeHtml(summary)}</span>
      </div>
      <div class="recovery-retention-grid">
        <label class="recovery-retention-rule">
          <span>保留最近</span>
          <input data-recovery-policy="keepDays" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.keepDays)}" />
          <em>天</em>
        </label>
        <label class="recovery-retention-rule">
          <span>每分支</span>
          <input data-recovery-policy="maxPerBranch" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.maxPerBranch)}" />
          <em>个</em>
        </label>
      </div>
      <div class="recovery-retention-actions">
        <span>${escapeHtml(recoveryPolicyLabel(policy) || "策略未启用")}</span>
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
  return `
    <div class="recovery-retention-preview">
      <div class="recovery-retention-preview-head">
        <strong>将清理</strong>
        <span>${escapeHtml(`${plan.deleteCount} 个候选`)}</span>
      </div>
      <div class="recovery-retention-preview-list">
        ${preview.map(recoveryRetentionPreviewRow).join("")}
      </div>
      ${extra ? `<div class="recovery-retention-more">另有 ${escapeHtml(String(extra))} 个恢复点也会被清理</div>` : ""}
    </div>
  `;
}

function recoveryRetentionPreviewRow(point) {
  return `
    <div class="recovery-retention-preview-row">
      <strong title="${escapeAttr(point.actionLabel || point.action || "恢复点")}">${escapeHtml(point.actionLabel || point.action || "恢复点")}</strong>
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
  const deleteText = filteredPoints.length === points.length ? "删除全部" : "删除筛选结果";
  return `
    <div class="recovery-filterbar">
      <input data-recovery-filter="query" autocomplete="off" placeholder="搜索恢复点、提交、分支" value="${escapeAttr(filter.query || "")}" />
      <select data-recovery-filter="branch">
        <option value="">全部分支</option>
        ${branches.map((branch) => `<option value="${escapeAttr(branch)}" ${branch === filter.branch ? "selected" : ""}>${escapeHtml(branch)}</option>`).join("")}
      </select>
      <select data-recovery-filter="action">
        <option value="">全部动作</option>
        ${actions.map((item) => `<option value="${escapeAttr(item.value)}" ${item.value === filter.action ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <div class="recovery-filter-actions">
        <button class="mini-btn" data-recovery-filter-reset type="button" ${active ? "" : "disabled"}>重置</button>
        <button class="mini-btn danger" data-recovery-bulk-delete type="button" ${filteredPoints.length ? "" : "disabled"}>
          <span>${deleteText}</span><span class="command-hint">update-ref -d</span>
        </button>
      </div>
      <div class="recovery-filter-count">${escapeHtml(`显示 ${filteredPoints.length} / ${points.length} 个恢复点`)}</div>
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
  return [
    policy.keepDays ? `保留最近 ${policy.keepDays} 天` : "",
    policy.maxPerBranch ? `每个分支保留 ${policy.maxPerBranch} 个` : "",
  ]
    .filter(Boolean)
    .join("；");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function recoveryRowHtml(point, active) {
  return `
    <button class="recovery-row ${active ? "active" : ""}" data-recovery-ref="${escapeAttr(point.ref)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(point.actionLabel || "恢复点")}</strong>
        <em>${escapeHtml(point.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(point.shortRef)}">${escapeHtml(point.shortRef)}</span>
      <span class="stash-branch">${escapeHtml(`${point.short || ""} · ${point.branch || "HEAD"}`)}</span>
    </button>
  `;
}

function recoveryDetailHtml(point) {
  return `
    <div class="recovery-actions">
      <button class="mini-btn" data-recovery-action="restore" data-recovery-ref="${escapeAttr(point.ref)}" type="button"><span>恢复到此处</span><span class="command-hint">reset --hard</span></button>
      <button class="mini-btn danger" data-recovery-action="delete" data-recovery-ref="${escapeAttr(point.ref)}" type="button"><span>删除恢复点</span><span class="command-hint">update-ref -d</span></button>
    </div>
    <div class="meta-grid stash-meta">
      <span>提交</span><div class="meta-value">${escapeHtml(point.short || point.sha || "未知")}</div>
      <span>动作</span><div class="meta-value">${escapeHtml(point.actionLabel || point.action || "危险操作前")}</div>
      <span>分支</span><div class="meta-value">${escapeHtml(point.branch || "HEAD")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(point.time || "未知")}</div>
      <span>引用</span><div class="meta-value" title="${escapeAttr(point.ref)}">${escapeHtml(point.shortRef || point.ref)}</div>
    </div>
    <div class="empty-panel compact">
      <span>恢复会执行 git reset --hard 到这个恢复点。恢复前 Forkline 会再创建一个新的恢复点，方便撤回这次恢复。</span>
    </div>
  `;
}

function reflogSectionHtml(entries, selected) {
  return `
    <section class="reflog-section">
      <div class="reflog-section-head">
        <div>
          <strong>引用日志</strong>
          <span>HEAD 最近经过的位置，用来找回被重置或切走的提交</span>
        </div>
        <em>${escapeHtml(entries.length ? `${entries.length} 条` : "无记录")}</em>
      </div>
      ${
        entries.length
          ? `
            <div class="reflog-list">
              ${entries.map((entry) => reflogRowHtml(entry, entry.selector === state.selectedReflogSelector)).join("")}
            </div>
            <div class="reflog-detail">
              ${selected ? reflogDetailHtml(selected) : `<div class="empty-panel compact"><span>选择一条引用日志查看可恢复位置。</span></div>`}
            </div>
          `
          : `<div class="empty-panel compact"><span>当前仓库没有可读取的 HEAD 引用日志。</span></div>`
      }
    </section>
  `;
}

function reflogRowHtml(entry, active) {
  return `
    <button class="reflog-row ${active ? "active" : ""}" data-reflog-selector="${escapeAttr(entry.selector)}" data-reflog-sha="${escapeAttr(entry.sha)}" type="button">
      <span class="stash-row-top">
        <strong title="${escapeAttr(entry.message || "")}">${escapeHtml(entry.message || "HEAD 位置变更")}</strong>
        <em>${escapeHtml(entry.selector || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(entry.sha || "")}">${escapeHtml(`${entry.short || ""} · ${entry.time || "未知时间"}`)}</span>
      <span class="stash-branch">${escapeHtml([entry.actionLabel, entry.author].filter(Boolean).join(" · ") || "移动")}</span>
    </button>
  `;
}

function reflogDetailHtml(entry) {
  return `
    <div class="reflog-actions">
      <button class="mini-btn" data-reflog-action="view" data-reflog-selector="${escapeAttr(entry.selector)}" type="button">查看提交</button>
      <button class="mini-btn" data-reflog-action="copy" data-reflog-selector="${escapeAttr(entry.selector)}" type="button">复制 SHA</button>
      <button class="mini-btn" data-reflog-action="create" data-reflog-selector="${escapeAttr(entry.selector)}" type="button"><span>创建恢复点</span><span class="command-hint">update-ref</span></button>
      <button class="mini-btn danger" data-reflog-action="restore" data-reflog-selector="${escapeAttr(entry.selector)}" type="button"><span>恢复到此处</span><span class="command-hint">reset --hard</span></button>
    </div>
    <div class="meta-grid stash-meta">
      <span>位置</span><div class="meta-value">${escapeHtml(entry.selector || "HEAD")}</div>
      <span>提交</span><div class="meta-value" title="${escapeAttr(entry.sha || "")}">${escapeHtml(entry.short || entry.sha || "未知")}</div>
      <span>动作</span><div class="meta-value">${escapeHtml(entry.actionLabel || "移动")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(entry.time || "未知")}</div>
      <span>说明</span><div class="meta-value" title="${escapeAttr(entry.message || "")}">${escapeHtml(entry.message || "HEAD 位置变更")}</div>
    </div>
    <div class="empty-panel compact">
      <span>引用日志是 Git 记录 HEAD 曾经指向哪里。创建恢复点只保存引用；恢复到此处会执行 git reset --hard，执行前 Forkline 会再创建一个恢复前恢复点。</span>
    </div>
  `;
}

function renderLogsTab() {
  const logs = state.data?.operationLog || [];
  const running = state.data?.runningOperations || [];
  els.detailTitle.textContent = "操作日志";
  els.detailSub.textContent = running.length
    ? `${running.length} 个 Git 操作正在执行`
    : logs.length
      ? `最近 ${logs.length} 条 Git 操作`
      : "还没有执行过 Git 操作";
  els.detailNode.style.borderColor = running.length || logs.some((item) => item.status === "error") ? "var(--amber)" : "var(--teal)";
  setActiveDiff(null);
  els.detailBody.innerHTML = `
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
          : `<div class="log-empty">执行抓取、提交、切换、合并、储藏等操作后，会在这里显示结果。</div>`
      }
    </div>
  `;
}

function renderSettingsTab() {
  const repos = recentRepos();
  const policy = normalizedRecoveryPolicy();
  const policyLabel = recoveryPolicyLabel(policy) || "策略未启用";
  els.detailTitle.textContent = "设置";
  els.detailSub.textContent = "本机偏好和界面行为";
  els.detailNode.style.borderColor = "var(--violet)";
  setActiveDiff(null);
  els.detailBody.innerHTML = `
    <div class="settings-layout">
      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>外观</strong>
            <span>主题会保存在当前浏览器。</span>
          </div>
        </div>
        <div class="settings-choice-row">
          ${settingsThemeButton("dark", "深色", "适合长时间查看提交图谱")}
          ${settingsThemeButton("light", "浅色", "适合明亮环境")}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>最近仓库</strong>
            <span>${repos.length ? `已保存 ${repos.length} 个本机仓库入口` : "当前没有最近仓库记录"}</span>
          </div>
          <button class="mini-btn danger" data-settings-action="clearRecentRepos" type="button" ${repos.length ? "" : "disabled"}>清空</button>
        </div>
        <div class="settings-list">
          ${
            repos.length
              ? repos.slice(0, 6).map(settingsRecentRepoRow).join("")
              : `<div class="empty-panel compact"><span>成功打开真实仓库后，这里会显示最近仓库。</span></div>`
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
            <em>天</em>
          </label>
          <label class="recovery-retention-rule">
            <span>每分支</span>
            <input data-recovery-policy="maxPerBranch" type="text" inputmode="numeric" maxlength="4" value="${escapeAttr(state.recoveryPolicy.maxPerBranch)}" />
            <em>个</em>
          </label>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-head">
          <div>
            <strong>布局</strong>
            <span>恢复侧栏、右栏、工作区和提交框宽高到默认值。</span>
          </div>
          <button class="mini-btn" data-settings-action="resetLayout" type="button">重置布局</button>
        </div>
      </section>
    </div>
  `;
}

function settingsThemeButton(theme, label, description) {
  const active = state.theme === theme;
  return `
    <button class="settings-choice ${active ? "active" : ""}" data-settings-theme="${escapeAttr(theme)}" type="button">
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
      <em>${escapeHtml(repo.branch || "未记录分支")}</em>
    </div>
  `;
}

function renderRunningOperationItem(item) {
  const duration = item.elapsed || formatDurationText(item.durationMs);
  return `
    <article class="operation-log-item running">
      <div class="operation-log-head">
        <span class="log-status">进行中</span>
        <strong title="${escapeAttr(item.label || "")}">${escapeHtml(item.label || "Git 操作")}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.startedTime || "")}</span>
        <code>${escapeHtml(item.action || "")}</code>
      </div>
      <pre>这个操作还在执行。若长时间没有结束，请检查认证窗口、网络状态、index.lock 或其他 Git 进程。</pre>
    </article>
  `;
}

function renderOperationLogItem(item) {
  const ok = item.status === "success";
  const label = ok ? "成功" : "失败";
  const duration = formatDurationText(item.durationMs);
  const summary = String(item.summary || (ok ? "操作已完成" : "操作失败")).trim();
  return `
    <article class="operation-log-item ${ok ? "success" : "error"}">
      <div class="operation-log-head">
        <span class="log-status">${label}</span>
        <strong title="${escapeAttr(item.label || "")}">${escapeHtml(item.label || "Git 操作")}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.time || "")}</span>
        <code>${escapeHtml(item.action || "")}</code>
      </div>
      <pre>${escapeHtml(summary)}</pre>
    </article>
  `;
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
  state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
  state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
  renderInspector();
}

function selectRecoveryPoint(ref) {
  if (!ref || ref === state.selectedRecoveryRef) return;
  state.selectedRecoveryRef = ref;
  renderInspector();
}

function findReflogEntry(selector) {
  return (state.data?.reflogEntries || []).find((entry) => entry.selector === selector);
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
    toast("请先设置恢复点保留策略。");
    return;
  }
  const plan = recoveryRetentionPlan(state.data.recoveryPoints || [], policy);
  if (!plan.deleteCount) {
    toast("当前没有需要清理的恢复点。");
    return;
  }
  const message = [
    `确认按保留策略清理 ${plan.deleteCount} 个恢复点？`,
    "",
    recoveryPolicyLabel(policy),
    `保留：${plan.keepCount} 个`,
    "命令：git update-ref -d <恢复点引用>",
    "",
    "删除后不能再通过 Forkline 恢复到这些引用。",
  ].join("\n");
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: "pruneRecoveryPoints", keepDays: policy.keepDays, maxPerBranch: policy.maxPerBranch }),
    });
    toast(result.output || "恢复点清理完成");
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedRecoveryRef = filteredRecoveryPoints()[0]?.ref || "";
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteFilteredRecoveryPoints(button) {
  if (!state.data) return;
  const points = filteredRecoveryPoints();
  if (!points.length) {
    toast("当前筛选结果没有可删除的恢复点");
    return;
  }
  const filter = state.recoveryFilter || {};
  const conditions = [
    filter.query ? `搜索：${filter.query}` : "",
    filter.branch ? `分支：${filter.branch}` : "",
    filter.action ? `动作：${points[0]?.actionLabel || filter.action}` : "",
  ].filter(Boolean);
  const scopeText = conditions.length ? conditions.join("\n") : "未设置筛选，将删除当前全部恢复点";
  const message = `确认删除当前列表里的 ${points.length} 个恢复点？\n\n${scopeText}\n\n命令：git update-ref -d <恢复点引用>\n\n删除后不能再通过 Forkline 恢复到这些引用。`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: "deleteRecoveryPoints", refs: points.map((point) => point.ref) }) });
    toast(result.output || "恢复点已删除");
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    state.selectedRecoveryRef = filteredRecoveryPoints()[0]?.ref || "";
    renderAll();
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runRecoveryAction(action, ref, button) {
  if (!state.data || !ref) return;
  const point = (state.data.recoveryPoints || []).find((item) => item.ref === ref);
  if (!point) {
    toast("恢复点已经不存在，请刷新后再试");
    return;
  }
  const message =
    action === "restore"
      ? `确认恢复当前分支到这个恢复点？\n\n恢复点：${point.shortRef}\n提交：${point.short || point.sha}\n命令：git reset --hard ${point.ref}\n\n这会移动当前分支并覆盖工作区。Forkline 会在恢复前再自动创建一个恢复点。`
      : `确认删除这个恢复点？\n\n${point.shortRef}\n\n删除后不能再通过 Forkline 恢复到这个引用。`;
  if (!state.data.repo.isSample && !confirm(message)) return;
  try {
    if (button) button.disabled = true;
    const apiAction = action === "restore" ? "restoreRecoveryPoint" : "deleteRecoveryPoint";
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: apiAction, ref }) });
    toast(result.output || "恢复点操作完成");
    state.commitDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
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
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function runReflogAction(action, selector, button) {
  if (!state.data || !selector) return;
  const entry = findReflogEntry(selector);
  if (!entry) {
    toast("引用日志记录已经变化，请刷新后再试");
    return;
  }
  if (action === "view") {
    await viewReflogEntry(entry);
    return;
  }
  if (action === "copy") {
    await copyText(entry.sha);
    toast("已复制提交 SHA");
    return;
  }
  if (action !== "create" && action !== "restore") return;
  const body = { selector: entry.selector, sha: entry.sha };
  const apiAction = action === "create" ? "createRecoveryPointFromReflog" : "restoreReflogEntry";
  if (action === "restore") {
    const message = [
      "确认把当前分支恢复到这条引用日志？",
      "",
      `位置：${entry.selector}`,
      `提交：${entry.short || entry.sha}`,
      `说明：${entry.message || "HEAD 位置变更"}`,
      `命令：git reset --hard ${entry.sha}`,
      "",
      "这会移动当前分支并覆盖工作区。Forkline 会在恢复前再自动创建一个恢复点。",
    ].join("\n");
    if (!state.data.repo.isSample && !confirm(message)) return;
  }
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: apiAction, ...body }) });
    toast(result.output || "引用日志操作完成");
    state.commitDetails.clear();
    state.selectedChanges.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (result.recovery?.ref) state.selectedRecoveryRef = result.recovery.ref;
    if (!state.data.reflogEntries?.some((item) => item.selector === state.selectedReflogSelector)) {
      state.selectedReflogSelector = state.data.reflogEntries?.[0]?.selector || "";
    }
    state.selectedSha = state.data.commits[0]?.sha || state.selectedSha;
    renderAll();
  } catch (error) {
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
    toast("已复制 Tag 名称");
    return;
  }
  const message = tagActionConfirmMessage(action, tag.name);
  if (!state.data.repo.isSample && !confirm(message)) return;
  const actionMap = {
    push: "pushTag",
    deleteLocal: "deleteTag",
    deleteRemote: "deleteRemoteTag",
  };
  try {
    if (button) button.disabled = true;
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: actionMap[action], name: tag.name }) });
    toast(result.output || "Tag 操作完成");
    state.commitDetails.clear();
    state.data = await api(`/api/state?ref=${encodeURIComponent(state.selectedRef)}`);
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.tags?.some((item) => item.name === state.selectedTag)) {
      state.selectedTag = state.data.tags?.[0]?.name || "";
    }
    renderAll();
    if (state.selectedSha && state.selectedTab !== "tags") {
      await loadCommit(state.selectedSha);
      renderInspector();
    }
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function tagActionConfirmMessage(action, name) {
  if (action === "push") return `确认推送 Tag：${name}？\n\n命令：git push <远端> refs/tags/${name}:refs/tags/${name}`;
  if (action === "deleteLocal") return `确认删除本地 Tag：${name}？\n\n命令：git tag -d ${name}\n此操作不会删除远端 Tag。`;
  if (action === "deleteRemote") return `确认删除远端 Tag：${name}？\n\n命令：git push <远端> :refs/tags/${name}\n此操作不会删除本地 Tag。`;
  return `确认操作 Tag：${name}？`;
}

