"use strict";



function createGitRecoveryService(options) {

  const {

    git,

    getCurrentRepo,

    recoveryRefPrefix: RECOVERY_REF_PREFIX,

    zeroOid: ZERO_OID,

    recoveryPointFromParts,

    shortRecoveryRef,

    parseRecoveryPoints,

    parseReflogEntries,

    readReflogOutput,

    normalizeSha,

    normalizeRefName,

    hasHeadCommit,

    resolveCommit,

    currentLocalBranch,

    ensureCleanWorktree,

    ensureNoDirtySubmodulesForDiscard,

  } = options;

  let currentRepo = getCurrentRepo();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

  }



  async function createRecoveryPoint(actionKey) {
    return createRecoveryPointForCommit(actionKey, "HEAD");
  }

  async function createRecoveryPointForCommit(actionKey, targetRef = "HEAD", branchOverride = "") {
    const branch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "HEAD")).trim() || "HEAD";
    const sha = (await git(currentRepo, ["rev-parse", "--verify", `${targetRef}^{commit}`])).trim();
    const short = (await git(currentRepo, ["rev-parse", "--short", sha])).trim();
    const timestamp = recoveryTimestamp();
    const baseRef = `${RECOVERY_REF_PREFIX}/${timestamp}/${recoverySlug(branchOverride || branch, "HEAD")}/${recoverySlug(actionKey, "operation")}`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ref = attempt ? `${baseRef}-${attempt + 1}` : baseRef;
      await git(currentRepo, ["check-ref-format", ref], { timeout: 60000 });
      try {
        await git(currentRepo, ["update-ref", ref, sha, ZERO_OID], { timeout: 60000 });
        return recoveryPointFromParts(ref, sha, short);
      } catch (error) {
        const exists = await git(currentRepo, ["rev-parse", "--verify", ref], { timeout: 60000 }).then(() => true).catch(() => false);
        if (exists) continue;
        throw error;
      }
    }
    throw new Error("同一秒内恢复点过多，请稍后重试。");
  }

  function appendRecoveryLine(result, recovery) {
    if (!recovery) return result;
    return {
      ...result,
      recovery,
      output: [result.output, recoveryPointLine(recovery)].filter(Boolean).join("\n"),
    };
  }

  function recoveryPointLine(recovery) {
    if (!recovery) return "";
    return `恢复点：${recovery.shortRef}（${recovery.short}）。可在右侧“恢复点”页恢复，或执行 git reset --hard ${recovery.ref}`;
  }

  async function restoreRecoveryPoint(body) {
    const ref = await ensureRecoveryRef(body.ref, normalizeExpectedRecoverySha(body.sha));
    await currentLocalBranch("恢复恢复点");
    await ensureCleanWorktree("恢复到恢复点前，请先提交、储藏或还原当前工作区改动。");
    await ensureNoDirtySubmodulesForDiscard("恢复到恢复点");
    const target = (await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
    const hasCurrentHead = await hasHeadCommit(currentRepo);
    const before = hasCurrentHead ? await createRecoveryPoint("restore-recovery") : null;
    await git(currentRepo, ["reset", "--hard", target], { timeout: 120000 });
    const short = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    const output = [`已恢复到 ${short}`];
    if (!hasCurrentHead) output.push("当前分支原本还没有提交，无法创建恢复前恢复点。");
    return appendRecoveryLine({ ok: true, output: output.join("\n") }, before);
  }

  async function createRecoveryPointFromReflog(body) {
    const entry = await ensureReflogEntry(body);
    const recovery = await createRecoveryPointForCommit(`reflog-${entry.short}`, entry.sha);
    return {
      ok: true,
      recovery,
      output: `已从引用日志 ${entry.selector} 创建恢复点 ${recovery.shortRef}（${recovery.short}）`,
    };
  }

  async function restoreReflogEntry(body) {
    const entry = await ensureReflogEntry(body);
    await currentLocalBranch("恢复引用日志记录");
    await ensureCleanWorktree("恢复到引用日志记录前，请先提交、储藏或还原当前工作区改动。");
    await ensureNoDirtySubmodulesForDiscard("恢复引用日志记录");
    const before = await createRecoveryPoint("restore-reflog");
    await git(currentRepo, ["reset", "--hard", entry.sha], { timeout: 120000 });
    const short = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return appendRecoveryLine({ ok: true, output: `已恢复到引用日志 ${entry.selector}：${short}` }, before);
  }

  async function deleteRecoveryPoint(body) {
    const ref = await ensureRecoveryRef(body.ref, normalizeExpectedRecoverySha(body.sha));
    await git(currentRepo, ["update-ref", "-d", ref], { timeout: 60000 });
    return { ok: true, output: `已删除恢复点 ${shortRecoveryRef(ref)}` };
  }

  async function deleteRecoveryPoints(body) {
    const entries = normalizeRecoveryRefEntries(body.refs);
    if (!entries.length) throw new Error("请选择要删除的恢复点");
    if (entries.length > 80) throw new Error("一次最多删除 80 个恢复点，请先缩小筛选范围。");
    const safeRefs = [];
    for (const entry of entries) {
      safeRefs.push(await ensureRecoveryRef(entry.ref, normalizeExpectedRecoverySha(entry.sha)));
    }
    for (const ref of safeRefs) {
      await git(currentRepo, ["update-ref", "-d", ref], { timeout: 60000 });
    }
    return { ok: true, output: `已删除 ${safeRefs.length} 个恢复点` };
  }

  function normalizeRecoveryRefEntries(value) {
    const rawItems = Array.isArray(value) ? value : [];
    const seen = new Set();
    const entries = [];
    for (const item of rawItems) {
      const ref = typeof item === "object" && item ? String(item.ref || "").trim() : String(item || "").trim();
      const sha = typeof item === "object" && item ? String(item.sha || "").trim() : "";
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      entries.push({ ref, sha });
    }
    return entries;
  }

  async function pruneRecoveryPoints(body) {
    const policy = normalizeRecoveryRetentionPolicy(body);
    const points = await readRecoveryPointsFromGit();
    const plan = recoveryRetentionPlan(points, policy);
    const expectedEntries = normalizeRecoveryRefEntries(body.deleteRefs);
    if (!plan.deletePoints.length) {
      if (expectedEntries.length) {
        throw new Error("恢复点清理预览已经变化，请刷新恢复点列表后重新清理。");
      }
      return {
        ok: true,
        output: `没有需要清理的恢复点。当前保留 ${points.length} 个恢复点。`,
        deleted: 0,
        plan,
      };
    }
    if (!expectedEntries.length) {
      throw new Error("恢复点清理预览已过期，请刷新恢复点列表后重新清理。");
    }
    if (expectedEntries.length > 120) {
      throw new Error(`本次策略会删除 ${expectedEntries.length} 个恢复点。为避免误删，请先缩小策略范围或使用筛选删除。`);
    }
    const plannedRefs = new Set(plan.deletePoints.map((point) => point.ref));
    const expectedRefs = new Set(expectedEntries.map((entry) => entry.ref));
    if (plannedRefs.size !== expectedRefs.size || [...plannedRefs].some((ref) => !expectedRefs.has(ref))) {
      throw new Error("恢复点清理预览已经变化，请刷新恢复点列表后重新清理。");
    }
    const safeRefs = [];
    for (const entry of expectedEntries) {
      const ref = await ensureRecoveryRef(entry.ref, normalizeExpectedRecoverySha(entry.sha));
      if (!plannedRefs.has(ref)) throw new Error("恢复点清理预览已经变化，请刷新恢复点列表后重新清理。");
      safeRefs.push(ref);
    }
    for (const ref of safeRefs) {
      await git(currentRepo, ["update-ref", "-d", ref], { timeout: 60000 });
    }
    return {
      ok: true,
      output: `已按保留策略清理 ${safeRefs.length} 个恢复点，保留 ${plan.keepCount} 个。${recoveryRetentionPolicyLabel(policy)}`,
      deleted: safeRefs.length,
      plan,
    };
  }

  async function readRecoveryPointsFromGit() {
    const output = await git(currentRepo, ["for-each-ref", RECOVERY_REF_PREFIX, "--sort=-refname", "--format=%(refname)\t%(objectname)\t%(objectname:short)\t%(subject)"]).catch(() => "");
    return parseRecoveryPoints(output);
  }

  async function ensureReflogEntry(body) {
    const requestedSha = normalizeSha(body.sha);
    const sha = await resolveCommit(requestedSha);
    const selector = String(body.selector || "").trim();
    const entries = parseReflogEntries(await readReflogOutput(120).catch(() => ""));
    const entry = entries.find((item) => item.sha === sha && (!selector || item.selector === selector)) || entries.find((item) => item.sha === sha);
    if (!entry) throw new Error("引用日志中没有这条记录，请刷新后再试。");
    return { ...entry, sha };
  }

  function normalizeRecoveryRetentionPolicy(body) {
    const keepDays = normalizeRetentionNumber(body.keepDays, "保留天数", 3650);
    const maxPerBranch = normalizeRetentionNumber(body.maxPerBranch, "每个分支保留数量", 500);
    if (!keepDays && !maxPerBranch) throw new Error("请至少设置一个恢复点保留规则。");
    return { keepDays, maxPerBranch };
  }

  function normalizeRetentionNumber(value, label, max) {
    if (value === undefined || value === null || value === "") return 0;
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) throw new Error(`${label}必须是 0 到 ${max} 之间的整数。`);
    const number = Number.parseInt(text, 10);
    if (number < 0 || number > max) throw new Error(`${label}必须是 0 到 ${max} 之间的整数。`);
    return number;
  }

  function recoveryRetentionPlan(points, policy, now = new Date()) {
    const deleteRefs = new Set();
    const nowMs = now.getTime();
    if (policy.keepDays) {
      const threshold = nowMs - policy.keepDays * 24 * 60 * 60 * 1000;
      for (const point of points) {
        const timeMs = recoveryPointTimeMs(point);
        if (timeMs && timeMs < threshold) deleteRefs.add(point.ref);
      }
    }
    if (policy.maxPerBranch) {
      const groups = new Map();
      for (const point of points) {
        const branch = point.branch || "HEAD";
        groups.set(branch, [...(groups.get(branch) || []), point]);
      }
      for (const group of groups.values()) {
        group
          .sort((a, b) => recoveryPointTimeMs(b) - recoveryPointTimeMs(a) || String(b.ref).localeCompare(String(a.ref)))
          .slice(policy.maxPerBranch)
          .forEach((point) => deleteRefs.add(point.ref));
      }
    }
    const deletePoints = points.filter((point) => deleteRefs.has(point.ref));
    return {
      keepDays: policy.keepDays,
      maxPerBranch: policy.maxPerBranch,
      keepCount: Math.max(0, points.length - deletePoints.length),
      deleteCount: deletePoints.length,
        deletePoints: deletePoints.map((point) => ({
          ref: point.ref,
          shortRef: point.shortRef,
          sha: point.sha,
          short: point.short,
          branch: point.branch,
          actionLabel: point.actionLabel,
        time: point.time,
      })),
    };
  }

  function recoveryPointTimeMs(point) {
    return recoveryTimestampToMs(point?.timestamp || String(point?.shortRef || "").split("/")[0]);
  }

  function recoveryTimestampToMs(timestamp) {
    const match = String(timestamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
    if (!match) return 0;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).getTime();
  }

  function recoveryRetentionPolicyLabel(policy) {
    return [
      policy.keepDays ? `保留最近 ${policy.keepDays} 天` : "",
      policy.maxPerBranch ? `每个分支保留 ${policy.maxPerBranch} 个` : "",
    ]
      .filter(Boolean)
      .join("；");
  }

  async function ensureRecoveryRef(value, expectedSha = "") {
    const input = String(value || "").trim().replace(/^\/+/, "");
    if (!input) throw new Error("请选择恢复点");
    const ref = input.startsWith(`${RECOVERY_REF_PREFIX}/`) ? input : `${RECOVERY_REF_PREFIX}/${input}`;
    normalizeRefName(ref, "恢复点");
    if (!ref.startsWith(`${RECOVERY_REF_PREFIX}/`)) throw new Error("恢复点不属于 Forkline 管理范围");
    const actualSha = (await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 }).catch(() => {
      throw new Error("恢复点不存在或已经被删除");
    })).trim().toLowerCase();
    if (expectedSha && !actualSha.startsWith(expectedSha)) {
      throw new Error("恢复点已经变化。为避免恢复或删除错误提交，请刷新恢复点列表后重新选择。");
    }
    return ref;
  }

  function normalizeExpectedRecoverySha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("恢复点状态已过期，请刷新恢复点列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("恢复点身份不合法，请刷新恢复点列表后重新选择。");
    return sha;
  }

  function recoveryTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function recoverySlug(value, fallback) {
    const slug = String(value || "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^\.+|\.+$/g, "")
      .replace(/_+/g, "_")
      .slice(0, 64);
    return slug || fallback;
  }



  return {

    setCurrentRepo,

    appendRecoveryLine,

    createRecoveryPoint,

    createRecoveryPointForCommit,

    createRecoveryPointFromReflog,

    deleteRecoveryPoint,

    deleteRecoveryPoints,

    normalizeRecoveryRetentionPolicy,

    pruneRecoveryPoints,

    recoveryPointLine,

    recoveryRetentionPlan,

    restoreRecoveryPoint,

    restoreReflogEntry,

  };

}



module.exports = { createGitRecoveryService };
