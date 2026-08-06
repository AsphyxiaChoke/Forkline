// Branch and reference comparison panel.
function renderCompareTab() {
  const model = state.compare || {};
  const data = model.data;
  const controls = comparePickerHtml(model);
  els.detailNode.style.borderColor = data ? "var(--blue)" : "var(--line)";
  els.detailTitle.textContent = t("分支比较");
  els.detailSub.textContent = model.head ? `${model.base || "HEAD"} ... ${model.head}` : t("选择两个引用开始比较");
  if (model.loading) {
    setActiveDiff(null);
    els.detailBody.innerHTML = `${controls}<div class="empty-panel"><strong>${t("正在比较引用")}</strong><span>${escapeHtml(model.base || "HEAD")} ... ${escapeHtml(model.head || "")}</span></div>`;
    return;
  }
  if (model.error) {
    setActiveDiff(null);
    els.detailBody.innerHTML = `${controls}<div class="empty-panel"><strong>${t("比较失败")}</strong><span>${escapeHtml(t(model.error))}</span></div>`;
    return;
  }
  if (!data) {
    setActiveDiff(null);
    els.detailBody.innerHTML = `${controls}<div class="empty-panel"><strong>${t("选择两个引用比较")}</strong><span>${t("可以输入本地分支、远端分支、Tag 或提交 SHA，也可以继续从分支右键菜单进入。")}</span></div>`;
    return;
  }
  const files = data.files || [];
  if (state.selectedCompareFile && !files.some((file) => file.file === state.selectedCompareFile)) {
    state.selectedCompareFile = "";
  }
  if (!state.selectedCompareFile && files.length) state.selectedCompareFile = files[0].file;
  const selectedDiff = state.selectedCompareFile ? diffForFile(data.diff || [], state.selectedCompareFile) : data.diff || [];
  if (selectedDiff.length) {
    setActiveDiff({
      source: "compare",
      title: `${data.base} ... ${data.head}`,
      path: state.selectedCompareFile || `${data.baseShort || ""} -> ${data.headShort || ""}`,
      diff: selectedDiff,
      emptyText: t("没有可显示的比较改动"),
    });
  } else {
    setActiveDiff(null);
  }
  els.detailBody.innerHTML = tt`
    ${controls}
    <div class="compare-summary">
      <div class="sync-actions compare-actions">
        <button class="mini-btn" data-compare-refresh type="button"><span>刷新比较</span><span class="command-hint">git diff</span></button>
        <button class="mini-btn" data-compare-view-target type="button"><span>查看目标</span><span class="command-hint">${escapeHtml(data.head)}</span></button>
      </div>
      <div class="meta-grid sync-meta">
        <span>当前分支</span><div class="meta-value">${escapeHtml(data.base)} (${escapeHtml(data.baseShort || "")})</div>
        <span>目标分支</span><div class="meta-value">${escapeHtml(data.head)} (${escapeHtml(data.headShort || "")})</div>
        <span>共同祖先</span><div class="meta-value">${escapeHtml(data.mergeBaseShort || t("未找到"))}</div>
        <span>文件变化</span><div class="meta-value">${escapeHtml(t("{count} 个文件", { count: files.length }))}</div>
      </div>
      <div class="compare-counts">
        <div><span>当前独有</span><strong>${escapeHtml(data.baseOnlyCount || 0)}</strong></div>
        <div><span>目标独有</span><strong>${escapeHtml(data.headOnlyCount || 0)}</strong></div>
      </div>
    </div>
    <div class="compare-commit-columns">
      ${compareCommitListHtml("基准引用独有提交", data.baseOnlyCommits || [], "基准引用没有目标引用缺少的提交")}
      ${compareCommitListHtml("目标引用独有提交", data.headOnlyCommits || [], "目标引用没有基准引用缺少的提交")}
    </div>
    <div class="detail-section-title">目标分支带来的文件改动</div>
    <div class="commit-file-view compare-file-view">
      <div class="commit-file-tree sync-preview-files">
        ${files.length ? fileTreeHtml(files) : `<div class="file-row"><span></span><span class="file-name">${t("没有文件变化")}</span><span></span></div>`}
      </div>
      <div class="commit-file-diff sync-preview-diff">
        <div class="panel-title compact">
          <div class="panel-title-text">
            <span>${escapeHtml(state.selectedCompareFile ? shortFileName(state.selectedCompareFile) : data.head)}</span>
            <span class="panel-subtitle">${escapeHtml(state.selectedCompareFile || data.command || "")}</span>
          </div>
          <button class="mini-btn diff-max-btn" data-open-diff-modal type="button" ${selectedDiff.length ? "" : "disabled"}>最大化</button>
        </div>
        ${renderSideDiff(selectedDiff, "没有可显示的比较改动")}
      </div>
    </div>
  `;
  bindFileTree(els.detailBody, { mode: "compare" });
}

function comparePickerHtml(model = {}) {
  const base = model.base || currentCompareBaseRef();
  const head = model.head || "";
  const sameRef = Boolean(base && head && base === head);
  const refs = compareRefOptions([base, head]);
  return tt`
    <div class="compare-picker">
      <datalist id="compareRefOptions">
        ${refs.map((item) => `<option value="${escapeAttr(item.ref)}" label="${escapeAttr(item.label)}"></option>`).join("")}
      </datalist>
      <label>
        <span>基准引用</span>
        <input data-compare-ref="base" list="compareRefOptions" autocomplete="off" spellcheck="false" value="${escapeAttr(base)}" placeholder="main / HEAD / Tag / SHA" />
      </label>
      <label>
        <span>目标引用</span>
        <input data-compare-ref="head" list="compareRefOptions" autocomplete="off" spellcheck="false" value="${escapeAttr(head)}" placeholder="选择或输入要比较的引用" />
      </label>
      <div class="compare-picker-actions">
        <button class="mini-btn" data-compare-run type="button" ${!base || !head || sameRef ? "disabled" : ""}><span>开始比较</span><span class="command-hint">git diff</span></button>
        <button class="mini-btn" data-compare-swap type="button" ${!base || !head ? "disabled" : ""}>交换</button>
      </div>
    </div>
  `;
}

function compareRefOptions(extraRefs = []) {
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

function comparePickerRefs() {
  const base = els.detailBody.querySelector('[data-compare-ref="base"]')?.value.trim() || "";
  const head = els.detailBody.querySelector('[data-compare-ref="head"]')?.value.trim() || "";
  return { base, head };
}

function updateComparePickerState() {
  const refs = comparePickerRefs();
  state.compare = { ...(state.compare || {}), base: refs.base, head: refs.head };
  const run = els.detailBody.querySelector("[data-compare-run]");
  const swap = els.detailBody.querySelector("[data-compare-swap]");
  const sameRef = Boolean(refs.base && refs.head && refs.base === refs.head);
  if (run) run.disabled = !refs.base || !refs.head || sameRef;
  if (swap) swap.disabled = !refs.base || !refs.head;
}

async function runCompareFromPicker() {
  const { base, head } = comparePickerRefs();
  if (!base || !head) {
    toast(t("请先填写基准引用和目标引用"));
    return;
  }
  if (base === head) {
    toast(t("基准引用和目标引用相同，不需要比较"));
    return;
  }
  await openCompareBranch(head, base);
}

async function swapCompareRefs() {
  const { base, head } = comparePickerRefs();
  if (!base || !head) return;
  const baseInput = els.detailBody.querySelector('[data-compare-ref="base"]');
  const headInput = els.detailBody.querySelector('[data-compare-ref="head"]');
  if (baseInput) baseInput.value = head;
  if (headInput) headInput.value = base;
  updateComparePickerState();
  if (base !== head) await openCompareBranch(base, head);
}

function compareCommitListHtml(title, commits, emptyText) {
  return `
    <section class="compare-commit-list">
      <div class="detail-section-title">${escapeHtml(t(title))}</div>
      ${
        commits.length
          ? commits.map((commit) => compareCommitRowHtml(commit)).join("")
          : `<div class="empty-panel compact"><span>${escapeHtml(t(emptyText))}</span></div>`
      }
    </section>
  `;
}

function compareCommitRowHtml(commit) {
  return `
    <button class="sync-commit-row" data-compare-commit="${escapeAttr(commit.sha)}" type="button">
      <span class="sync-commit-message" title="${escapeAttr(commit.message)}">${escapeHtml(commit.message)}</span>
      <span class="sync-commit-meta">${escapeHtml(commit.short || commit.sha?.slice(0, 7) || "")} · ${escapeHtml(commit.author || "unknown")} · ${escapeHtml(commit.time || "")}</span>
    </button>
  `;
}
