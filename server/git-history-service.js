"use strict";



const { removeQuietly, writeTempFile } = require("./temp-files");



function createGitHistoryService(options) {

  const {

    git,

    getCurrentRepo,

    repositoryHistoryService,

    sampleState,

    parseStatus,

    detectRepoOperation,

    normalizeSha,

    basicCommitLogFormat: BASIC_COMMIT_LOG_FORMAT,

    historyRewriteActionLabel,

    resetModeLabel,

    resolveCommit,

    currentLocalBranchForRewrite,

    ensureCleanWorktree,

    ensureNoDirtySubmodulesForDiscard,

    hasHeadCommit,

    commandResultWithSummary,

    recoveryService,

  } = options;

  const { appendRecoveryLine, createRecoveryPoint } = recoveryService;

  let currentRepo = getCurrentRepo();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

  }



  async function readHistoryRewritePreview(sha, rawMode) {
    const mode = normalizeHistoryRewriteMode(rawMode);
    if (!currentRepo) {
      const sample = sampleState();
      const target = sample.commits.find((item) => item.sha === sha) || sample.commits[0];
      return {
        ok: true,
        mode,
        title: historyRewritePreviewTitle(mode),
        command: historyRewriteCommand(mode),
        effect: historyRewriteEffect(mode),
        branch: sample.repo.branch,
        target,
        parent: sample.commits.find((item) => item.sha === target?.parents?.[0]) || null,
        affectedCount: 3,
        affectedPreview: sample.commits.slice(0, 3),
        blockers: [],
        warnings: ["示例模式不会执行真实 Git 命令"],
        canRun: false,
      };
    }
    const repoPath = currentRepo;
    const targetSha = await resolveCommit(sha, repoPath);
    const target = await repositoryHistoryService.readBasicCommit(targetSha, repoPath);
    const blockers = [];
    const warnings = ["执行前会自动创建恢复点", "执行后目标提交之后的 SHA 会改变"];
    const operation = detectRepoOperation(repoPath);
    if (operation) blockers.push(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);

    const statusOutput = await git(repoPath, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
    const dirtyCount = parseStatus(statusOutput).length;
    if (statusOutput.trim()) blockers.push(`当前还有 ${dirtyCount || "未提交"} 个未提交改动。请先提交、储藏或丢弃后再编辑历史。`);

    let branch = "";
    try {
      branch = await currentLocalBranchForRewrite(repoPath);
    } catch (error) {
      blockers.push(error.message);
    }
    try {
      await ensureCommitInCurrentHistory(targetSha, repoPath);
    } catch (error) {
      blockers.push(error.message);
    }

    const parents = await commitParents(targetSha, repoPath);
    if (parents.length > 1) blockers.push(`暂不支持对 merge 提交执行${historyRewritePreviewTitle(mode)}`);
    if ((mode === "squash" || mode === "fixup") && parents.length === 0) {
      blockers.push("根提交没有父提交，不能压缩或修补进父提交");
    }

    const parent = parents[0] ? await repositoryHistoryService.readBasicCommit(parents[0], repoPath).catch(() => null) : null;
    let upstream = "";
    let rebaseStart = "";
    let affectedPreview = [];
    let affectedCount = 0;
    let targetIndex = -1;
    if (!parents.length && (mode === "squash" || mode === "fixup")) {
      affectedPreview = [target];
      affectedCount = 1;
      targetIndex = 0;
    } else {
      const base = mode === "drop" || (mode === "reword" && !parents[0]) ? targetSha : parents[0];
      const baseParents = base ? await commitParents(base, repoPath).catch(() => []) : [];
      upstream = baseParents.length ? `${base}^` : "--root";
      rebaseStart = upstream === "--root" ? "仓库根提交" : `${baseParents[0]?.slice(0, 7) || base.slice(0, 7)} 之后`;
      const affected = await readRewriteRangeCommits(upstream, repoPath).catch(() => []);
      affectedCount = affected.length;
      affectedPreview = affected.slice(0, 12);
      targetIndex = affected.findIndex((item) => item.sha === targetSha);
      const merges = affected.filter((item) => item.parents.length > 1);
      if (merges.length) {
        blockers.push(`这段历史里包含 merge 提交 ${merges[0].short}。为避免破坏分支拓扑，暂不自动执行 ${historyRewriteActionLabel(mode)}。`);
      }
      if (targetIndex === -1) blockers.push("目标提交不在这次历史编辑序列中，请刷新后重试。");
    }
    if (mode === "drop") warnings.push("丢弃提交可能让后续提交产生冲突");
    return {
      ok: true,
      mode,
      title: historyRewritePreviewTitle(mode),
      command: historyRewriteCommand(mode),
      effect: historyRewriteEffect(mode),
      branch,
      target,
      parent,
      upstream,
      rebaseStart,
      affectedCount,
      affectedPreview,
      targetIndex,
      dirtyCount,
      blockers: [...new Set(blockers.filter(Boolean))],
      warnings,
      canRun: blockers.length === 0,
    };
  }

  async function readHistoryRewriteQueuePreview(rawItems) {
    const requested = normalizeHistoryRewriteQueueItems(rawItems);
    if (!currentRepo) {
      const sample = sampleState();
      const actions = requested.map((item, index) => {
        const target = sample.commits[index + 1] || sample.commits[index] || sample.commits[0];
        return {
          mode: item.mode,
          modeLabel: historyRewritePreviewTitle(item.mode),
          target,
          parent: sample.commits.find((commit) => commit.sha === target?.parents?.[0]) || null,
        };
      });
      return {
        ok: true,
        mode: "queue",
        title: "历史编辑队列",
        command: "git rebase -i / queue",
        effect: "一次执行多条 squash / fixup / drop / reword 历史编辑动作。",
        branch: sample.repo.branch,
        queueCount: actions.length,
        actions,
        affectedCount: sample.commits.length,
        affectedPreview: sample.commits.map((commit, index) => ({ ...commit, queueAction: index ? requested[index - 1]?.mode || "pick" : "pick" })),
        blockers: [],
        warnings: ["示例模式不会执行真实 Git 命令"],
        canRun: false,
      };
    }

    const blockers = [];
    const warnings = ["执行前会自动创建恢复点", "执行后队列影响范围内的 SHA 会改变"];
    const repoPath = currentRepo;
    const operation = detectRepoOperation(repoPath);
    if (operation) blockers.push(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);

    const statusOutput = await git(repoPath, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
    const dirtyCount = parseStatus(statusOutput).length;
    if (statusOutput.trim()) blockers.push(`当前还有 ${dirtyCount || "未提交"} 个未提交改动。请先提交、储藏或丢弃后再编辑历史。`);

    let branch = "";
    try {
      branch = await currentLocalBranchForRewrite(repoPath);
    } catch (error) {
      blockers.push(error.message);
    }

    const resolved = [];
    const seenTargets = new Set();
    for (const item of requested) {
      const targetSha = await resolveCommit(item.sha, repoPath);
      if (seenTargets.has(targetSha)) {
        blockers.push(`提交 ${targetSha.slice(0, 7)} 在队列中重复出现。`);
        continue;
      }
      seenTargets.add(targetSha);
      try {
        await ensureCommitInCurrentHistory(targetSha, repoPath);
      } catch (error) {
        blockers.push(error.message);
      }
      const [target, parents] = await Promise.all([repositoryHistoryService.readBasicCommit(targetSha, repoPath), commitParents(targetSha, repoPath)]);
      if (parents.length > 1) blockers.push(`提交 ${target.short} 是 merge 提交，暂不支持加入历史编辑队列。`);
      if ((item.mode === "squash" || item.mode === "fixup") && parents.length === 0) {
        blockers.push(`提交 ${target.short} 是根提交，不能压缩或修补进父提交。`);
      }
      resolved.push({
        mode: item.mode,
        modeLabel: historyRewritePreviewTitle(item.mode),
        command: historyRewriteCommand(item.mode),
        summary: item.summary || "",
        body: item.body || "",
        target,
        parent: parents[0] ? await repositoryHistoryService.readBasicCommit(parents[0], repoPath).catch(() => null) : null,
        parentSha: parents[0] || "",
      });
    }

    const hasReword = resolved.some((item) => item.mode === "reword");
    const hasFold = resolved.some((item) => item.mode === "squash" || item.mode === "fixup");
    if (hasReword && hasFold) {
      blockers.push("批量修改提交信息暂不和压缩/修补混用，请分两次执行。");
    }

    const fullRange = await readRewriteRangeCommits("--root", repoPath).catch(() => []);
    const order = new Map(fullRange.map((commit, index) => [commit.sha, index]));
    let earliestBase = "";
    let earliestIndex = Number.POSITIVE_INFINITY;
    for (const item of resolved) {
      const base = item.mode === "drop" || (item.mode === "reword" && !item.parentSha) ? item.target.sha : item.parentSha;
      if (!base) continue;
      const index = order.get(base);
      if (index === undefined) {
        blockers.push(`提交 ${base.slice(0, 7)} 不在当前分支历史编辑范围中。`);
        continue;
      }
      if (index < earliestIndex) {
        earliestIndex = index;
        earliestBase = base;
      }
    }

    let upstream = "";
    let rebaseStart = "";
    let affected = [];
    if (earliestBase) {
      const baseParents = await commitParents(earliestBase, repoPath).catch(() => []);
      upstream = baseParents.length ? `${earliestBase}^` : "--root";
      rebaseStart = upstream === "--root" ? "仓库根提交" : `${baseParents[0]?.slice(0, 7) || earliestBase.slice(0, 7)} 之后`;
      affected = await readRewriteRangeCommits(upstream, repoPath).catch(() => []);
      const merges = affected.filter((commit) => commit.parents.length > 1);
      if (merges.length) {
        blockers.push(`这段历史里包含 merge 提交 ${merges[0].short}。为避免破坏分支拓扑，暂不自动执行历史编辑队列。`);
      }
      const affectedShas = new Set(affected.map((commit) => commit.sha));
      for (const item of resolved) {
        if (!affectedShas.has(item.target.sha)) {
          blockers.push(`提交 ${item.target.short} 不在这次历史编辑序列中，请刷新后重试。`);
        }
      }
    } else {
      blockers.push("无法计算历史编辑队列的重放起点。");
    }

    const actionBySha = new Map(resolved.map((item) => [item.target.sha, item]));
    for (let index = 0; index < affected.length; index += 1) {
      const commit = affected[index];
      const actionItem = actionBySha.get(commit.sha);
      const action = actionItem?.mode || "pick";
      if (action === "squash" || action === "fixup") {
        const previous = affected[index - 1];
        const previousAction = previous ? actionBySha.get(previous.sha)?.mode || "pick" : "";
        if (!previous) {
          blockers.push(`提交 ${commit.short} 是队列第一条，不能执行 ${historyRewritePreviewTitle(action)}。`);
        } else if (previousAction === "drop") {
          blockers.push(`提交 ${commit.short} 要${historyRewritePreviewTitle(action)}，但它前一条 ${previous.short} 会被丢弃。请调整队列。`);
        }
      }
    }

    if (resolved.some((item) => item.mode === "drop")) warnings.push("队列里包含丢弃提交，后续提交可能产生冲突");
    if (resolved.some((item) => item.mode === "reword")) warnings.push("队列里包含修改提交信息，相关提交的 SHA 会改变");
    const affectedPreview = affected.slice(0, 30).map((commit) => {
      const actionItem = actionBySha.get(commit.sha);
      const queueAction = actionItem?.mode || "pick";
      return {
        ...commit,
        queueAction,
        queueActionLabel: queueAction === "pick" ? "保留" : historyRewritePreviewTitle(queueAction),
        queueCommand: queueAction === "pick" ? "pick" : historyRewriteCommand(queueAction),
        queueSummary: actionItem?.summary || "",
      };
    });
    return {
      ok: true,
      mode: "queue",
      title: "历史编辑队列",
      command: "git rebase -i / queue",
      effect: "一次执行多条 squash / fixup / drop / reword 历史编辑动作，然后重新播放后续提交。",
      branch,
      upstream,
      rebaseStart,
      queueCount: resolved.length,
      actions: resolved,
      affectedCount: affected.length,
      affectedPreview,
      dirtyCount,
      blockers: [...new Set(blockers.filter(Boolean))],
      warnings,
      canRun: blockers.length === 0,
    };
  }

  async function rewordCommit(body) {
    const sha = normalizeSha(body.sha);
    const { summary, body: detail } = normalizeCommitMessageInput(body.summary, body.body);
    const statusOutput = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]);
    if (statusOutput.trim()) throw new Error("修改历史提交信息前，请先提交、暂存或还原工作区改动");
    const target = (await git(currentRepo, ["rev-parse", "--verify", `${sha}^{commit}`])).trim();
    await git(currentRepo, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
      throw new Error("只能修改当前分支历史中的提交信息");
    });
    const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
    const parents = parentLine.split(/\s+/).slice(1);
    if (parents.length > 1) throw new Error("暂不支持自动修改 merge 提交信息");
    if ((await git(currentRepo, ["rev-parse", "HEAD"])).trim() !== target) {
      await ensureLinearRewriteRange(parents.length ? `${target}^` : "--root", "reword");
    }
    const messageFile = writeTempFile("forkline-message-", `${summary}${detail ? `\n\n${detail}` : ""}\n`);
    const recovery = await createRecoveryPoint("reword");
    try {
      if ((await git(currentRepo, ["rev-parse", "HEAD"])).trim() === target) {
        await git(currentRepo, ["commit", "--amend", "-F", messageFile], { timeout: 120000 });
      } else {
        const editorFile = writeTempFile("forkline-sequence-", sequenceEditorScript(target), ".cjs");
        const messageEditorFile = writeTempFile("forkline-message-editor-", messageEditorScript(messageFile), ".cjs");
        try {
          const args = parents.length ? ["rebase", "-i", `${target}^`] : ["rebase", "-i", "--root"];
          await git(currentRepo, args, {
            timeout: 180000,
            env: {
              GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${editorFile}"`,
              GIT_EDITOR: `"${process.execPath}" "${messageEditorFile}"`,
            },
          });
        } finally {
          removeQuietly(editorFile);
          removeQuietly(messageEditorFile);
        }
      }
    } catch (error) {
      await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
      throw error;
    } finally {
      removeQuietly(messageFile);
    }
    return appendRecoveryLine({ ok: true, output: "提交信息已修改，历史 SHA 已重写" }, recovery);
  }

  async function rewriteHistoryCommit(body) {
    const mode = normalizeHistoryRewriteMode(body.mode);
    if (mode === "reword") throw new Error("请使用“修改提交信息”或历史编辑队列里的“改信息”。");
    const target = await resolveCommit(body.sha);
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再编辑历史。`);
    await ensureCleanWorktree("编辑历史提交前，请先提交、暂存或还原工作区改动");
    const currentBranch = await currentLocalBranchForRewrite();
    await ensureCommitInCurrentHistory(target);
    const parents = await commitParents(target);
    if (parents.length > 1) throw new Error("暂不支持对 merge 提交执行压缩、修补或丢弃");
    if ((mode === "squash" || mode === "fixup") && parents.length === 0) {
      throw new Error("根提交没有父提交，不能压缩或修补进父提交");
    }

    const base = mode === "drop" ? target : parents[0];
    const baseParents = base ? await commitParents(base) : [];
    const rebaseArgs = baseParents.length ? ["rebase", "-i", `${base}^`] : ["rebase", "-i", "--root"];
    await ensureLinearRewriteRange(baseParents.length ? `${base}^` : "--root", mode);

    const sequenceFile = writeTempFile("forkline-history-sequence-", sequenceEditorScript(target, mode), ".cjs");
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    const recovery = await createRecoveryPoint(`history-${mode}`);
    try {
      const output = await git(currentRepo, rebaseArgs, {
        timeout: 180000,
        env: {
          GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${sequenceFile}"`,
          GIT_EDITOR: `"${process.execPath}" "${editorFile}"`,
        },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return appendRecoveryLine(commandResultWithSummary(`${historyRewriteResultLabel(mode)} ${target.slice(0, 7)}，当前分支 ${currentBranch} 的 HEAD 为 ${newHead}`, output), recovery);
    } catch (error) {
      if (detectRepoOperation(currentRepo)?.type !== "rebase") {
        await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
      }
      throw error;
    } finally {
      removeQuietly(sequenceFile);
      removeQuietly(editorFile);
    }
  }

  async function rewriteHistoryQueue(body) {
    const preview = await readHistoryRewriteQueuePreview(body.items);
    if (!preview.canRun) {
      throw new Error((preview.blockers || []).join("\n") || "历史编辑队列还不能执行。请重新预检后再试。");
    }
    const currentBranch = preview.branch || (await currentLocalBranchForRewrite());
    const actions = (preview.actions || []).map((item) => ({ sha: item.target.sha, mode: item.mode, summary: item.summary || "", body: item.body || "" }));
    const actionBySha = new Map(actions.map((item) => [item.sha, item]));
    const affected = await readRewriteRangeCommits(preview.upstream || "--root").catch(() => []);
    const rewordMessages = affected
      .map((commit) => actionBySha.get(commit.sha))
      .filter((item) => item?.mode === "reword")
      .map((item) => `${item.summary}${item.body ? `\n\n${item.body}` : ""}\n`);
    const rebaseArgs = preview.upstream === "--root" ? ["rebase", "-i", "--root"] : ["rebase", "-i", preview.upstream];
    const sequenceFile = writeTempFile("forkline-history-queue-", sequenceEditorQueueScript(actions), ".cjs");
    const editorStateFile = rewordMessages.length ? writeTempFile("forkline-history-queue-editor-state-", "0\n") : "";
    const editorFile = rewordMessages.length
      ? writeTempFile("forkline-history-queue-message-editor-", messageEditorQueueScript(rewordMessages, editorStateFile), ".cjs")
      : writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    const recovery = await createRecoveryPoint("history-queue");
    try {
      const output = await git(currentRepo, rebaseArgs, {
        timeout: 240000,
        env: {
          GIT_SEQUENCE_EDITOR: `"${process.execPath}" "${sequenceFile}"`,
          GIT_EDITOR: `"${process.execPath}" "${editorFile}"`,
        },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return appendRecoveryLine(commandResultWithSummary(`已执行历史编辑队列 ${actions.length} 项，当前分支 ${currentBranch} 的 HEAD 为 ${newHead}`, output), recovery);
    } catch (error) {
      if (detectRepoOperation(currentRepo)?.type !== "rebase") {
        await git(currentRepo, ["rebase", "--abort"], { timeout: 60000 }).catch(() => "");
      }
      throw error;
    } finally {
      removeQuietly(sequenceFile);
      removeQuietly(editorFile);
      if (editorStateFile) removeQuietly(editorStateFile);
    }
  }

  async function revertCommit(body) {
    const target = await resolveCommit(body.sha);
    const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
    const parents = parentLine.split(/\s+/).slice(1);
    const args = ["revert"];
    if (parents.length > 1) {
      args.push("-m", String(normalizeMainline(body.mainline, parents.length)));
    }
    args.push("--no-edit", target);
    await git(currentRepo, args, { timeout: 120000 });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已还原提交 ${target.slice(0, 7)}，新建反向提交 ${newHead}` };
  }

  async function cherryPickCommit(body) {
    const target = await resolveCommit(body.sha);
    const parentLine = (await git(currentRepo, ["rev-list", "--parents", "-n", "1", target])).trim();
    const parents = parentLine.split(/\s+/).slice(1);
    const args = ["cherry-pick"];
    if (parents.length > 1) {
      args.push("-m", String(normalizeMainline(body.mainline, parents.length)));
    }
    args.push(target);
    await git(currentRepo, args, { timeout: 120000 });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return { ok: true, output: `已挑选提交 ${target.slice(0, 7)}，当前分支新建提交 ${newHead}` };
  }

  async function resetToCommit(body) {
    const target = await resolveCommit(body.sha);
    const mode = normalizeResetMode(body.mode);
    const args = mode === "mixed" ? ["reset", target] : ["reset", `--${mode}`, target];
    if (mode === "hard") await ensureNoDirtySubmodulesForDiscard("执行硬重置");
    const hasCurrentHead = await hasHeadCommit(currentRepo);
    const recovery = hasCurrentHead ? await createRecoveryPoint(`reset-${mode}`) : null;
    await git(currentRepo, args, { timeout: 120000 });
    const output = [`已${resetModeLabel(mode)}到 ${target.slice(0, 7)}`];
    if (!hasCurrentHead) output.push("当前分支原本还没有提交，无法创建重置前恢复点。");
    return appendRecoveryLine({ ok: true, output: output.join("\n") }, recovery);
  }

  async function continueRevert() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "revert") {
      return { ok: true, output: "当前没有正在进行的还原，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["revert", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续还原并创建反向提交 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }

  async function continueCherryPick() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "cherryPick") {
      return { ok: true, output: "当前没有正在进行的挑选，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["cherry-pick", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续挑选并创建提交 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }

  async function continueMerge() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "merge") {
      return { ok: true, output: "当前没有正在进行的合并，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["merge", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续合并并创建合并提交 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }

  async function abortMerge() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "merge") {
      return { ok: true, output: "当前没有正在进行的合并，工作区已经干净。" };
    }
    await git(currentRepo, ["merge", "--abort"], { timeout: 120000 });
    return { ok: true, output: "已中止合并，工作区已回到合并前状态" };
  }

  async function continueRebase() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "rebase") {
      return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
    }
    const editorFile = writeTempFile("forkline-noop-editor-", "process.exit(0);\n", ".cjs");
    try {
      await git(currentRepo, ["rebase", "--continue"], {
        timeout: 120000,
        env: { GIT_EDITOR: `"${process.execPath}" "${editorFile}"` },
      });
      const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
      return { ok: true, output: `已继续变基，当前 HEAD 为 ${newHead}` };
    } finally {
      removeQuietly(editorFile);
    }
  }

  async function skipRebase() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "rebase") {
      return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
    }
    const output = await git(currentRepo, ["rebase", "--skip"], { timeout: 120000 });
    return commandResultWithSummary("已跳过当前变基提交", output);
  }

  async function abortRebase() {
    const operation = detectRepoOperation(currentRepo);
    if (operation?.type !== "rebase") {
      return { ok: true, output: "当前没有正在进行的变基，工作区已经干净。" };
    }
    await git(currentRepo, ["rebase", "--abort"], { timeout: 120000 });
    return { ok: true, output: "已中止变基，工作区已回到变基前状态" };
  }

  async function ensureCommitInCurrentHistory(target, repoPath = currentRepo) {
    await git(repoPath, ["merge-base", "--is-ancestor", target, "HEAD"]).catch(() => {
      throw new Error("只能编辑当前分支历史中的提交");
    });
  }

  async function commitParents(target, repoPath = currentRepo) {
    const line = (await git(repoPath, ["rev-list", "--parents", "-n", "1", target])).trim();
    return line.split(/\s+/).slice(1);
  }

  async function ensureLinearRewriteRange(upstream, mode, repoPath = currentRepo) {
    const merges = await readRewriteRangeMerges(upstream, repoPath);
    if (merges.length) {
      const first = merges[0]?.short || "";
      throw new Error(`这段历史里包含 merge 提交 ${first}。为避免破坏分支拓扑，暂不自动执行 ${historyRewriteActionLabel(mode)}。`);
    }
  }

  async function readRewriteRangeMerges(upstream, repoPath = currentRepo) {
    const args = upstream === "--root" ? ["rev-list", "--parents", "HEAD"] : ["rev-list", "--parents", `${upstream}..HEAD`];
    return (await git(repoPath, args))
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/).filter(Boolean))
      .filter((parts) => parts.length > 2)
      .map((parts) => ({ sha: parts[0], short: parts[0]?.slice(0, 7) || "", parents: parts.slice(1) }));
  }

  async function readRewriteRangeCommits(upstream, repoPath = currentRepo) {
    const args = [
      "log",
      "--reverse",
      "--topo-order",
      "--date=relative",
      `--format=${BASIC_COMMIT_LOG_FORMAT}`,
    ];
    args.push(upstream === "--root" ? "HEAD" : `${upstream}..HEAD`);
    return repositoryHistoryService.parseBasicCommits(await git(repoPath, args, { maxBuffer: 1024 * 1024 * 2 }));
  }

  function normalizeResetMode(value) {
    const mode = String(value || "mixed").trim().toLowerCase();
    if (["soft", "mixed", "hard"].includes(mode)) return mode;
    throw new Error("Reset 类型不合法");
  }

  function normalizeHistoryRewriteMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (["squash", "fixup", "drop", "reword"].includes(mode)) return mode;
    throw new Error("历史编辑类型不合法");
  }

  function normalizeHistoryRewriteQueueItems(value) {
    const rawItems = Array.isArray(value) ? value : [];
    if (!rawItems.length) throw new Error("请先把要编辑的提交加入历史编辑队列");
    if (rawItems.length > 12) throw new Error("一次最多执行 12 条历史编辑动作，请拆成多次操作。");
    const seen = new Set();
    return rawItems.map((item) => {
      const sha = normalizeSha(item?.sha);
      if (seen.has(sha)) throw new Error(`提交 ${sha.slice(0, 7)} 在队列中重复出现。`);
      seen.add(sha);
      const mode = normalizeHistoryRewriteMode(item?.mode);
      if (mode !== "reword") return { sha, mode };
      return { sha, mode, ...normalizeCommitMessageInput(item?.summary, item?.body) };
    });
  }

  function normalizeCommitMessageInput(summaryValue, bodyValue) {
    const summary = String(summaryValue || "").replace(/\0/g, "").trim();
    const body = String(bodyValue || "").replace(/\0/g, "").replace(/\r\n/g, "\n").trim();
    if (!summary) throw new Error("请填写新的提交摘要");
    if (summary.length > 300) throw new Error("提交摘要太长，请控制在 300 个字符以内。");
    if (body.length > 10000) throw new Error("提交正文太长，请控制在 10000 个字符以内。");
    return { summary, body };
  }

  function historyRewriteResultLabel(mode) {
    if (mode === "squash") return "已将提交压缩进父提交";
    if (mode === "fixup") return "已将提交修补进父提交";
    if (mode === "drop") return "已丢弃提交";
    if (mode === "reword") return "已修改提交信息";
    return "已编辑提交";
  }

  function historyRewritePreviewTitle(mode) {
    if (mode === "squash") return "压缩进父提交";
    if (mode === "fixup") return "修补进父提交";
    if (mode === "drop") return "丢弃此提交";
    if (mode === "reword") return "修改提交信息";
    return "编辑历史";
  }

  function historyRewriteCommand(mode) {
    if (mode === "squash") return "git rebase -i / squash";
    if (mode === "fixup") return "git rebase -i / fixup";
    if (mode === "drop") return "git rebase -i / drop";
    if (mode === "reword") return "git rebase -i / reword";
    return "git rebase -i";
  }

  function historyRewriteEffect(mode) {
    if (mode === "squash") return "把此提交的改动和提交信息合并进父提交，然后重新播放后续提交。";
    if (mode === "fixup") return "把此提交的改动合并进父提交，丢弃此提交信息，然后重新播放后续提交。";
    if (mode === "drop") return "从当前分支历史中删除此提交，然后重新播放后续提交。";
    if (mode === "reword") return "只修改此提交的提交信息，然后重新播放后续提交。";
    return "重写当前分支历史。";
  }

  function normalizeMainline(value, parentCount) {
    const mainline = Number.parseInt(String(value || ""), 10);
    if (!Number.isInteger(mainline) || mainline < 1 || mainline > parentCount) {
      throw new Error(`请选择 merge 提交主线：1-${parentCount}`);
    }
    return mainline;
  }

  function sequenceEditorScript(targetSha, action = "reword") {
    return `
  const fs = require("fs");
  const todoPath = process.argv[2];
  const target = ${JSON.stringify(targetSha)};
  const action = ${JSON.stringify(action)};
  const text = fs.readFileSync(todoPath, "utf8");
  const lines = text.split(/\\r?\\n/).map((line) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("pick ")) return line;
    const hash = trimmed.split(/\\s+/)[1] || "";
    return target.startsWith(hash) ? line.replace(/^(\\s*)pick(\\s+)/, "$1" + action + "$2") : line;
  });
  fs.writeFileSync(todoPath, lines.join("\\n"), "utf8");
  `;
  }

  function sequenceEditorQueueScript(actions) {
    return `
  const fs = require("fs");
  const todoPath = process.argv[2];
  const actions = ${JSON.stringify(actions)};
  const text = fs.readFileSync(todoPath, "utf8");
  let changed = 0;
  function actionFor(hash) {
    for (const item of actions) {
      if (item.sha.startsWith(hash)) return item.mode;
    }
    return "";
  }
  const lines = text.split(/\\r?\\n/).map((line) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("pick ")) return line;
    const hash = trimmed.split(/\\s+/)[1] || "";
    const action = actionFor(hash);
    if (!action) return line;
    changed += 1;
    return line.replace(/^(\\s*)pick(\\s+)/, "$1" + action + "$2");
  });
  if (changed !== actions.length) {
    throw new Error("Forkline history queue expected " + actions.length + " actions, changed " + changed + " todo lines");
  }
  fs.writeFileSync(todoPath, lines.join("\\n"), "utf8");
  `;
  }

  function messageEditorScript(messageFile) {
    return `
  const fs = require("fs");
  fs.copyFileSync(${JSON.stringify(messageFile)}, process.argv[2]);
  `;
  }

  function messageEditorQueueScript(messages, stateFile) {
    return `
  const fs = require("fs");
  const messages = ${JSON.stringify(messages)};
  const stateFile = ${JSON.stringify(stateFile)};
  const messagePath = process.argv[2];
  let index = 0;
  try {
    index = Number.parseInt(fs.readFileSync(stateFile, "utf8"), 10) || 0;
  } catch {
    index = 0;
  }
  if (index < messages.length) {
    fs.writeFileSync(messagePath, messages[index], "utf8");
    fs.writeFileSync(stateFile, String(index + 1), "utf8");
  }
  `;
  }



  return {

    setCurrentRepo,

    abortMerge,

    abortRebase,

    cherryPickCommit,

    continueCherryPick,

    continueMerge,

    continueRebase,

    continueRevert,

    normalizeCommitMessageInput,

    normalizeHistoryRewriteMode,

    readHistoryRewritePreview,

    readHistoryRewriteQueuePreview,

    resetToCommit,

    revertCommit,

    rewordCommit,

    rewriteHistoryCommit,

    rewriteHistoryQueue,

    skipRebase,

  };

}



module.exports = { createGitHistoryService };
