// Recovery retention policy shared by startup, settings, and dangerous operations.
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
    const storage = (typeof window === "object" && window.ForklinePreferenceStorage?.storage) || localStorage;
    const stored = JSON.parse(storage.getItem(recoveryPolicyStorageKey) || "{}");
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
    const storage = (typeof window === "object" && window.ForklinePreferenceStorage?.storage) || localStorage;
    storage.setItem(recoveryPolicyStorageKey, JSON.stringify({ version: 2, repositories }));
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

function recoveryAutoPruneHtml() {
  return tt`
    <label class="recovery-auto-prune" title="危险操作创建恢复点后检查保留策略；发现候选时仍会先询问，不会静默删除。">
      <input data-recovery-policy="autoPrune" type="checkbox" ${state.recoveryPolicy.autoPrune ? "checked" : ""} />
      <span>操作后提醒整理</span>
      <em>显示候选并确认</em>
    </label>
  `;
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
    if (!state.data.recoveryPoints?.some((point) => point.ref === state.selectedRecoveryRef)) {
      state.selectedRecoveryRef = state.data.recoveryPoints?.[0]?.ref || "";
    }
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
