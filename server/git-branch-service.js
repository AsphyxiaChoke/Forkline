"use strict";



const fs = require("fs");

const path = require("path");



function createGitBranchService(options) {

  const {

    git,

    gitStandalone,

    getCurrentRepo,

    repositoryService,

    recoveryService,

    worktreeService,

    friendlyErrorMessage,

    shortText,

    protectedBranchNames: PROTECTED_BRANCH_NAMES,

    resolveCommit,

    currentLocalBranch,

    ensureCleanWorktree,

    normalizeExpectedUpstreamSha,

  } = options;

  const { appendRecoveryLine, createRecoveryPoint } = recoveryService;

  const {

    discardAllWorktreeChanges,

    ensureNoDirtySubmodulesForDiscard,

    ensureStashSelectionHasNoSubmoduleChanges,

    readDirtySubmoduleWorktrees,

    validateStashFiles,

  } = worktreeService;

  const {

    commandResult,

    commandResultWithSummary,

    defaultRemoteName,

    detectRepoOperation,

    ensureCurrentLocalTag,

    ensureLiveRemoteBranchRef,

    ensureRemoteBranchRef,

    ensureRemoteBranchStillExists,

    ensureRemoteTag,

    extractRemoteHost,

    hasHeadCommit,

    normalizeBranchName,

    normalizeExpectedTagSha,

    normalizeRefName,

    normalizeRemoteName,

    normalizeSubmodulePath,

    normalizeTagName,

    openRepo,

    parseSimpleLines,

    parseStatus,

    parseSubmodules,

    parseWorktreeBranches,

    parseWorktreeList,

    readBranchDisplayName,

    readCurrentSyncState,

    readExplicitRemotePushUrls,

    readRemoteBranchNames,

    readRemoteDetails,

    readRemoteNames,

    readState,

    replaceRemotePushUrls,

    splitRemoteBranchRef,

    submoduleConfigArgs,

    syncCommandResult,

    syncStateLine,

    worktreePruneEntries,

  } = repositoryService;

  let currentRepo = getCurrentRepo();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

  }



  function ensureCheckoutOperationComplete() {
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再切换分支。`);
  }

  async function checkoutBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const mode = normalizeCheckoutMode(body.mode);
    ensureCheckoutOperationComplete();
    const sourceBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    const branchOutput = await git(currentRepo, ["branch", "--format=%(refname:short)"]);
    const branches = branchOutput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!branches.includes(branch)) throw new Error("只能切换到本地分支");
    const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
    if (worktrees[branch]) {
      const info = worktrees[branch];
      const suffix = info.prunable ? "。这个占用记录已经失效，可以清理 worktree 记录后再切换" : "";
      throw new Error(`分支 ${branch} 已在其他工作树签出：${info.worktreePath}${suffix}`);
    }
    if (mode === "stash") {
      await ensureNoDirtySubmodulesForDiscard("储藏并签出");
      const dirty = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
      let stash = null;
      if (dirty.trim()) {
        if (!(await hasHeadCommit(currentRepo))) {
          throw new Error(`当前分支 ${sourceBranch || "HEAD"} 还没有任何提交，不能储藏并签出。请先创建首个提交，或改用“强制签出”丢弃这些改动。`);
        }
        await ensureStashSelectionHasNoSubmoduleChanges([]);
        validateStashFiles(parseStatus(dirty), []);
        const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
        const message = `Forkline: checkout ${branch} ${stamp}`;
        await git(currentRepo, ["stash", "push", "-u", "-m", message], { timeout: 120000 });
        const sha = (await git(currentRepo, ["rev-parse", "--verify", "stash@{0}^{commit}"], { timeout: 60000 }).catch(() => "")).trim();
        stash = { branch: sourceBranch, target: branch, ref: "stash@{0}", message, sha };
      }
      await git(currentRepo, ["switch", branch], { timeout: 60000 });
      return { ok: true, output: "已储藏本地更改并切换分支", stash };
    }
    if (mode === "force") {
      await discardAllWorktreeChanges();
      await git(currentRepo, ["switch", "--force", branch], { timeout: 60000 });
      return { ok: true, output: "已丢弃本地更改并强制切换分支" };
    }
    await git(currentRepo, ["switch", branch], { timeout: 60000 });
    return { ok: true, output: "已切换分支并保留本地更改" };
  }

  async function checkoutRemoteBranch(body) {
    const remoteRef = normalizeRefName(body.ref, "远端分支");
    const mode = normalizeCheckoutMode(body.mode);
    ensureCheckoutOperationComplete();
    const sourceBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    const remoteNames = await readRemoteNames();
    const remoteBranches = (await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item && !item.endsWith("/HEAD"));
    if (!remoteBranches.includes(remoteRef)) throw new Error("远端分支不存在，请先抓取远端后再试");
    const parsedRemoteRef = splitRemoteBranchRef(remoteRef, remoteNames);
    await ensureRemoteBranchStillExists(remoteRef, parsedRemoteRef);
    const localBranch = normalizeRemoteCheckoutBranch(remoteRef, remoteNames);
    const localBranches = (await git(currentRepo, ["branch", "--format=%(refname:short)"]))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const localExists = localBranches.includes(localBranch);
    const worktrees = parseWorktreeBranches(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
    if (localExists && worktrees[localBranch] && localBranch !== sourceBranch) {
      const info = worktrees[localBranch];
      const suffix = info.prunable ? "。这个占用记录已经失效，可以清理 worktree 记录后再切换" : "";
      throw new Error(`分支 ${localBranch} 已在其他工作树签出：${info.worktreePath}${suffix}`);
    }

    const switchArgs = localExists ? ["switch", localBranch] : ["switch", "--track", "-c", localBranch, remoteRef];
    if (mode === "stash") {
      await ensureNoDirtySubmodulesForDiscard("储藏并签出");
      const dirty = await git(currentRepo, ["status", "--short", "-z", "--untracked-files=all"]);
      let stash = null;
      if (dirty.trim()) {
        if (!(await hasHeadCommit(currentRepo))) {
          throw new Error(`当前分支 ${sourceBranch || "HEAD"} 还没有任何提交，不能储藏并签出。请先创建首个提交，或改用“强制签出”丢弃这些改动。`);
        }
        await ensureStashSelectionHasNoSubmoduleChanges([]);
        validateStashFiles(parseStatus(dirty), []);
        const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
        const message = `Forkline: checkout ${localBranch} ${stamp}`;
        await git(currentRepo, ["stash", "push", "-u", "-m", message], { timeout: 120000 });
        const sha = (await git(currentRepo, ["rev-parse", "--verify", "stash@{0}^{commit}"], { timeout: 60000 }).catch(() => "")).trim();
        stash = { branch: sourceBranch, target: localBranch, ref: "stash@{0}", message, sha };
      }
      await git(currentRepo, switchArgs, { timeout: 60000 });
      const trackingOutput = localExists ? await ensureRemoteCheckoutTracking(localBranch, remoteRef) : "";
      return { ok: true, branch: localBranch, remote: remoteRef, output: [`已从 ${remoteRef} 签出本地分支 ${localBranch}`, trackingOutput].filter(Boolean).join("\n"), stash };
    }
    if (mode === "force") {
      await discardAllWorktreeChanges();
      await git(currentRepo, switchArgs, { timeout: 60000 });
      const trackingOutput = localExists ? await ensureRemoteCheckoutTracking(localBranch, remoteRef) : "";
      return { ok: true, branch: localBranch, remote: remoteRef, output: [`已强制签出本地分支 ${localBranch}`, trackingOutput].filter(Boolean).join("\n") };
    }
    await git(currentRepo, switchArgs, { timeout: 60000 });
    const trackingOutput = localExists ? await ensureRemoteCheckoutTracking(localBranch, remoteRef) : "";
    return { ok: true, branch: localBranch, remote: remoteRef, output: [`已从 ${remoteRef} 签出本地分支 ${localBranch}`, trackingOutput].filter(Boolean).join("\n") };
  }

  async function ensureRemoteCheckoutTracking(localBranch, remoteRef) {
    const upstream = (await git(currentRepo, ["for-each-ref", `refs/heads/${localBranch}`, "--format=%(upstream:short)"]).catch(() => "")).trim();
    if (upstream === remoteRef) return "";
    if (upstream) return `本地分支 ${localBranch} 已跟踪 ${upstream}，未自动改为 ${remoteRef}`;
    await git(currentRepo, ["branch", `--set-upstream-to=${remoteRef}`, localBranch], { timeout: 60000 });
    return `已设置 upstream：${localBranch} -> ${remoteRef}`;
  }

  async function createBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const start = normalizeBranchStart(body.start);
    const checkout = Boolean(body.checkout);
    await git(currentRepo, ["check-ref-format", "--branch", branch]).catch(() => {
      throw new Error("分支名不合法");
    });
    if (!start && !checkout && !(await hasHeadCommit(currentRepo))) {
      throw new Error("当前分支还没有任何提交，不能创建不切换的新分支。请勾选“创建后切换”，或从已有提交/分支创建。");
    }
    if (start) await ensureLiveRemoteBranchRef(start);
    const args = checkout ? ["switch", "-c", branch] : ["branch", branch];
    if (start) args.push(start);
    await git(currentRepo, args, { timeout: 60000 });
    return {
      ok: true,
      branch,
      checkedOut: checkout,
      output: checkout ? `已创建并切换到 ${branch}` : `已创建分支 ${branch}`,
    };
  }

  async function deleteBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    ensureBranchDeletionAllowed(branch, currentBranch);
    await ensureCurrentLocalBranch(branch, normalizeExpectedBranchSha(body.sha));
    await git(currentRepo, ["branch", "-d", branch], { timeout: 60000 });
    return { ok: true, output: `已删除本地分支 ${branch}` };
  }

  function ensureBranchDeletionAllowed(branch, currentBranch = "") {
    if (branch === currentBranch) throw new Error("不能删除当前所在分支，请先切换到其他分支");
    if (isProtectedBranchName(branch)) {
      throw new Error(`分支 ${branch} 是主干/长期分支，Forkline 默认保护，不允许从这里删除。`);
    }
  }

  function isProtectedBranchName(branch) {
    return PROTECTED_BRANCH_NAMES.has(String(branch || "").toLowerCase());
  }

  function normalizeBranchActionEntries(value) {
    const rawItems = Array.isArray(value) ? value : [];
    const seen = new Set();
    const entries = [];
    for (const item of rawItems) {
      const branch = normalizeBranchName(typeof item === "object" && item ? item.branch : item);
      if (seen.has(branch)) continue;
      seen.add(branch);
      entries.push({ branch, sha: typeof item === "object" && item ? item.sha : "" });
    }
    return entries;
  }

  async function ensureCurrentLocalBranch(branch, expectedSha) {
    const actualSha = (await git(currentRepo, ["rev-parse", "-q", "--verify", `refs/heads/${branch}^{commit}`], { timeout: 60000 }).catch(() => "")).trim().toLowerCase();
    if (!actualSha) throw new Error(`本地分支 ${branch} 已不存在，请刷新分支列表后重新选择。`);
    if (!actualSha.startsWith(expectedSha)) {
      throw new Error(`本地分支 ${branch} 已经变化。为避免重命名或删除错误分支，请刷新分支列表后重新选择。`);
    }
    return actualSha;
  }

  function normalizeExpectedBranchSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("分支列表状态已过期，请刷新分支列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("分支身份不合法，请刷新分支列表后重新选择。");
    return sha;
  }

  async function deleteBranches(body) {
    const branches = normalizeBranchActionEntries(body.branches);
    if (!branches.length) throw new Error("请选择要删除的本地分支");
    const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    const deleted = [];
    const failed = [];
    for (const entry of branches) {
      const { branch } = entry;
      try {
        ensureBranchDeletionAllowed(branch, currentBranch);
        await ensureCurrentLocalBranch(branch, normalizeExpectedBranchSha(entry.sha));
        await git(currentRepo, ["branch", "-d", branch], { timeout: 60000 });
        deleted.push(branch);
      } catch (error) {
        failed.push({ branch, error: friendlyErrorMessage(error, { body: { action: "deleteBranch", branch } }) });
      }
    }
    if (!deleted.length && failed.length) {
      throw new Error(`没有删除任何分支。\n${failed.map((item) => `${item.branch}：${item.error}`).join("\n")}`);
    }
    const lines = [`已删除 ${deleted.length} 个本地分支`];
    if (deleted.length) lines.push(`成功：${deleted.join("、")}`);
    if (failed.length) lines.push(`被 Git 阻止：${failed.map((item) => `${item.branch}（${item.error}）`).join("；")}`);
    return { ok: true, deleted, failed, output: lines.join("\n") };
  }

  async function pushCurrentBranch(operation) {
    const branch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (!branch || branch === "detached HEAD") {
      throw new Error("当前处于游离 HEAD，不能直接推送分支。请先切换或创建本地分支。");
    }
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${branch} 还没有任何提交，不能推送。请先创建首个提交后再推送。`);
    }
    const before = await readCurrentSyncState();
    const upstream = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "")).trim();
    let output = "";
    if (upstream) {
      ensurePushIsSafe(before);
      await ensureProtectedUpstreamPushAllowed(branch, upstream);
      output = await git(currentRepo, ["push", "--progress"], { timeout: 120000, operation });
    } else {
      const remoteNames = await readRemoteNames();
      const remote = remoteNames.includes("origin") ? "origin" : remoteNames[0];
      if (!remote) throw new Error("当前仓库没有远端。请先添加远端仓库后再推送。");
      output = await git(currentRepo, ["push", "--progress", "-u", remote, branch], { timeout: 120000, operation });
    }
    const after = await readCurrentSyncState();
    return syncCommandResult("push", output, before, after);
  }

  function ensurePushIsSafe(state) {
    if (!state?.upstream) return;
    if (state.upstreamGone) {
      throw new Error(`推送被保护：当前分支的 upstream ${state.upstream} 已不存在。请先抓取远端，并重新设置 upstream；如果要重新创建远端分支，请先取消 upstream 后再推送。`);
    }
    if (state.behind > 0) {
      const diverged = state.ahead > 0;
      const stateText = diverged ? `本地领先 ${state.ahead} 个提交，同时落后 ${state.behind} 个提交` : `本地落后 ${state.behind} 个提交`;
      throw new Error(`推送被保护：当前分支 ${state.branch} ${stateText}。普通 git push 会被远端拒绝，或覆盖团队协作风险过高。请先拉取/变基并检查待拉取提交；如果这是改写历史后的预期结果，请使用“安全强推”。`);
    }
  }

  async function ensureProtectedUpstreamPushAllowed(branch, upstream) {
    const parsed = splitRemoteBranchRef(upstream, await readRemoteNames());
    if (isProtectedBranchName(parsed.branch) && branch !== parsed.branch) {
      throw new Error(`推送被保护：当前分支 ${branch} 的 upstream 是远端主干/长期分支 ${upstream}。为避免把普通分支推到主干，请先取消 upstream，或切到 ${parsed.branch} 分支后再推送。`);
    }
  }

  async function forcePushCurrentBranchWithLease(body = {}, operation) {
    const branch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    if (!branch || branch === "detached HEAD") {
      throw new Error("当前处于游离 HEAD，不能直接强推。请先切换或创建本地分支。");
    }
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${branch} 还没有任何提交，不能强推。请先创建首个提交后再推送。`);
    }
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      throw new Error("当前分支没有 upstream，不能执行安全强推。请先普通推送一次建立跟踪关系。");
    }
    if (before.upstreamGone) {
      throw new Error("当前分支的 upstream 已不存在，不能执行安全强推。请先抓取远端并确认要推送到哪里。");
    }
    const remoteNames = await readRemoteNames();
    const parsed = splitRemoteBranchRef(before.upstream, remoteNames);
    if (isProtectedBranchName(parsed.branch)) {
      throw new Error(`远端分支 ${before.upstream} 是主干/长期分支，Forkline 默认保护，不允许从这里安全强推。`);
    }
    const leaseSha = normalizeExpectedUpstreamSha(body.expectedUpstreamSha);
    const output = await git(currentRepo, ["push", "--progress", `--force-with-lease=refs/heads/${parsed.branch}:${leaseSha}`, parsed.remote, `HEAD:${parsed.branch}`], { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return syncCommandResult("forcePush", output, before, after);
  }

  async function fetchRemotes(operation) {
    const before = await readCurrentSyncState();
    const output = await git(currentRepo, ["fetch", "--progress", "--all", "--prune"], { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return syncCommandResult("fetch", output, before, after);
  }

  async function fetchRemote(body, operation) {
    const remote = await ensureRemoteName(body.name);
    const before = await readCurrentSyncState();
    const output = await git(currentRepo, ["fetch", "--progress", remote, "--prune"], { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return syncCommandResult("fetch", output || `已抓取远端 ${remote}`, before, after);
  }

  async function testRemote(body) {
    const remote = await ensureRemoteName(body.name);
    const details = (await readRemoteDetails()).find((item) => item.name === remote) || { name: remote, fetchUrl: "", pushUrl: "" };
    let output = "";
    try {
      output = await git(currentRepo, ["ls-remote", "--heads", remote], { timeout: 60000, maxBuffer: 1024 * 1024 * 2 });
    } catch (error) {
      const reason = friendlyErrorMessage(error, { body: { ...body, action: "testRemote" } });
      const remoteError = new Error(reason);
      remoteError.remoteCheck = buildRemoteCheck(remote, details, "error", {
        reason,
        output: reason,
        rawOutput: String(error?.message || error || "").trim(),
      });
      throw remoteError;
    }
    const heads = String(output || "")
      .split(/\r?\n/)
      .filter((line) => line.includes("\trefs/heads/"));
    const lines = [
      `远端 ${remote} 连接正常`,
      `fetch URL：${details.fetchUrl || "未设置"}`,
      `push URL：${details.pushUrl || details.fetchUrl || "未设置"}`,
      `可读取分支：${heads.length} 个`,
      `检查命令：git ls-remote --heads ${remote}`,
    ];
    return {
      ok: true,
      output: lines.join("\n"),
      remoteCheck: buildRemoteCheck(remote, details, "success", {
        heads: heads.length,
        output: lines.join("\n"),
      }),
    };
  }

  function buildRemoteCheck(remote, details = {}, status, options = {}) {
    const fetchUrl = details.fetchUrl || "";
    const pushUrl = details.pushUrl || fetchUrl;
    const heads = Number.isFinite(options.heads) ? options.heads : 0;
    const reason = String(options.reason || "").trim();
    const rawOutput = String(options.rawOutput || "").trim();
    const output = String(options.output || reason || "").trim();
    const command = `git ls-remote --heads ${remote}`;
    return {
      remote,
      status,
      heads,
      fetchUrl,
      pushUrl,
      command,
      reason,
      rawOutput,
      output,
      diagnosis: remoteDiagnosis({ remote, fetchUrl, pushUrl, status, heads, reason, output, rawOutput }),
    };
  }

  function remoteDiagnosis({ remote, fetchUrl, pushUrl, status, heads, reason, output, rawOutput }) {
    const text = `${reason || ""}\n${output || ""}\n${rawOutput || ""}`.toLowerCase();
    const urlText = `${fetchUrl || ""} ${pushUrl || ""}`.toLowerCase();
    const host = extractRemoteHost(fetchUrl || pushUrl);
    const baseCommands = [`git remote -v`, `git ls-remote --heads ${remote}`];
    if (status === "success") {
      return {
        category: "ok",
        title: "远端读取正常",
        summary: `Forkline 已能读取 ${heads} 个远端分支，URL 和读取权限基本正常。`,
        steps: ["可以继续抓取、拉取或推送。", "如果推送失败，再查看同步页的保护提示和右侧日志。"],
        commands: baseCommands,
      };
    }
    if (text.includes("permission denied (publickey)") || text.includes("publickey") || text.includes("ssh") || urlText.startsWith("git@") || urlText.includes("ssh://")) {
      const commands = host ? [...baseCommands, `ssh -T git@${host}`, `ssh-add -l`, `git remote get-url ${remote}`] : [...baseCommands, `ssh-add -l`, `git remote get-url ${remote}`];
      return {
        category: "ssh",
        title: "SSH 凭据或主机认证",
        summary: "当前远端像是 SSH 连接失败，常见原因是 SSH key 没添加到平台、ssh-agent 没加载 key，或远端 URL 指向了错误账号。",
        steps: [
          "确认这个仓库应该使用 SSH 地址，且远端 URL 没写错。",
          host ? `在终端执行 ssh -T git@${host}，确认当前系统账号能通过平台认证。` : "在终端执行 ssh -T 对应 Git 主机，确认当前系统账号能通过平台认证。",
          "如果 key 不在 ssh-agent 里，先加载 key；如果不想处理 SSH，可以把远端 URL 改成 HTTPS。",
        ],
        commands,
      };
    }
    if (text.includes("authentication failed") || text.includes("could not read username") || text.includes("access denied") || text.includes("token") || (urlText.startsWith("http") && (text.includes("认证") || text.includes("authentication")))) {
      return {
        category: "https",
        title: "HTTPS 凭据或 Token",
        summary: "当前远端像是 HTTPS 登录失败，常见原因是凭据管理器里保存了旧密码，或 Personal Access Token 过期/权限不足。",
        steps: [
          "确认远端 URL 是你要访问的 HTTPS 仓库地址。",
          "检查 Windows 凭据管理器或 Git Credential Manager 中保存的账号和 Token。",
          "GitHub、GitLab 等平台通常要使用 Token，不能把账号密码当作推送密码。",
        ],
        commands: [...baseCommands, `git credential-manager diagnose`, `git remote get-url ${remote}`],
      };
    }
    if (text.includes("could not resolve host") || text.includes("主机名无法解析") || text.includes("dns")) {
      return {
        category: "network",
        title: "DNS 或主机名解析",
        summary: "Git 无法解析远端主机名，通常是 URL 主机写错、DNS、代理或网络环境问题。",
        steps: [
          "检查远端 URL 的主机名有没有拼写错误。",
          "确认当前网络、代理、VPN 或公司网络策略允许访问这个 Git 主机。",
          "修正 URL 或网络环境后重新执行诊断。",
        ],
        commands: [...baseCommands, `git remote get-url ${remote}`, `git config --get http.proxy`],
      };
    }
    if (text.includes("failed to connect") || text.includes("connection timed out") || text.includes("network is unreachable") || text.includes("连接超时") || text.includes("网络不可达")) {
      return {
        category: "network",
        title: "网络连接超时",
        summary: "Git 能识别远端地址，但连接不到服务器，常见原因是代理、VPN、防火墙或远端服务暂时不可达。",
        steps: [
          "确认浏览器或终端能访问对应 Git 平台。",
          "检查代理、VPN、防火墙和公司网络限制。",
          "网络恢复后先重新诊断，再执行抓取或推送。",
        ],
        commands: [...baseCommands, `git config --get http.proxy`, `git config --get https.proxy`],
      };
    }
    if (text.includes("ssl certificate") || text.includes("certificate") || text.includes("证书")) {
      return {
        category: "certificate",
        title: "HTTPS 证书校验",
        summary: "Git 在校验 HTTPS 证书时失败，常见原因是系统时间、公司代理证书或自签证书配置问题。",
        steps: [
          "先确认系统时间和时区正确。",
          "如果在公司网络或代理下，确认代理根证书已被系统和 Git 信任。",
          "不要直接关闭 SSL 校验；优先修复证书链或代理证书配置。",
        ],
        commands: [...baseCommands, `git config --show-origin --get http.sslCAInfo`, `git config --show-origin --get http.sslVerify`],
      };
    }
    if (text.includes("does not appear to be a git repository") || text.includes("no such remote") || text.includes("无法读取") || text.includes("unable to access")) {
      return {
        category: "url",
        title: "远端 URL 或仓库路径",
        summary: "远端地址不可用。可能是本地裸仓库路径不存在、URL 写错，或这个地址不是 Git 仓库。",
        steps: [
          "复制远端 URL 到浏览器或终端确认它真实存在。",
          "如果是本地路径远端，确认磁盘路径仍然存在且是裸仓库或普通 Git 仓库。",
          "在同步页修改 URL 后重新诊断。",
        ],
        commands: [...baseCommands, `git remote get-url ${remote}`],
      };
    }
    if (text.includes("repository not found") || text.includes("not found") || text.includes("仓库不存在") || text.includes("没有访问权限") || text.includes("权限")) {
      return {
        category: "permission",
        title: "仓库地址或访问权限",
        summary: "远端仓库可能不存在、已改名，或当前账号没有私有仓库/组织权限。",
        steps: [
          "先核对远端 URL 中的用户名、组织名和仓库名。",
          "确认当前登录账号有读取这个仓库的权限，私有仓库尤其要检查组织授权。",
          "如果仓库已迁移或改名，在同步页修改 URL 后重新诊断。",
        ],
        commands: [...baseCommands, `git remote get-url ${remote}`],
      };
    }
    return {
      category: "unknown",
      title: "需要继续排查",
      summary: "Forkline 没能把这次失败归到常见类型。先保留 Git 原始输出，再从 URL、网络和认证三条线排查。",
      steps: ["核对远端 URL。", "确认网络和代理可访问 Git 主机。", "确认当前系统账号或 Token 有仓库读取权限。"],
      commands: [...baseCommands, `git remote get-url ${remote}`],
    };
  }

  async function pullCurrentBranch(operation) {
    await currentLocalBranch("拉取");
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      throw new Error("当前分支没有 upstream，不能拉取。请先在同步页设置 upstream，或推送一次建立跟踪关系。");
    }
    if (before.upstreamGone) {
      throw new Error(`当前分支的 upstream ${before.upstream} 已不存在，不能拉取。请先抓取远端并重新设置 upstream。`);
    }
    const dirtySubmodules = await readDirtySubmoduleWorktrees();
    const args = ["pull", "--progress", "--ff-only"];
    if (dirtySubmodules.length) args.push("--no-recurse-submodules");
    const output = await git(currentRepo, args, { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return appendSkippedSubmoduleUpdate(syncCommandResult("pull", output, before, after), dirtySubmodules);
  }

  async function pullRebaseCurrentBranch(operation) {
    await currentLocalBranch("变基拉取");
    const repoOperation = detectRepoOperation(currentRepo);
    if (repoOperation) throw new Error(`仓库还有未完成操作：${repoOperation.label}。请先继续或中止后再变基拉取。`);
    await ensureCleanWorktree("当前有未提交修改。请先提交或储藏后再执行变基拉取。");
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      throw new Error("当前分支没有 upstream，不能执行变基拉取。请先在同步页设置 upstream。");
    }
    if (before.upstreamGone) {
      throw new Error(`当前分支的 upstream ${before.upstream} 已不存在，不能执行变基拉取。请先抓取远端并重新设置 upstream。`);
    }
    const dirtySubmodules = await readDirtySubmoduleWorktrees();
    const recovery = await createRecoveryPoint("pull-rebase");
    const args = ["pull", "--progress", "--rebase"];
    if (dirtySubmodules.length) args.push("--no-recurse-submodules");
    const output = await git(currentRepo, args, { timeout: 120000, operation });
    const after = await readCurrentSyncState();
    return appendRecoveryLine(appendSkippedSubmoduleUpdate(syncCommandResult("pullRebase", output, before, after), dirtySubmodules), recovery);
  }

  function appendSkippedSubmoduleUpdate(result, dirtySubmodules) {
    if (!dirtySubmodules.length) return result;
    const details = dirtySubmodules.slice(0, 5).map((item) => `${item.path}（${item.dirtyCount} 个未提交改动）`);
    const remaining = dirtySubmodules.length > details.length ? `；另有 ${dirtySubmodules.length - details.length} 个` : "";
    return {
      ...result,
      output: `${result.output}\n子模块保护：检测到 ${details.join("；")}${remaining}，本次只更新父仓库，没有递归切换子模块。请先处理子模块修改，再在“子模块”页更新。`,
      submoduleUpdateSkipped: true,
    };
  }

  async function cloneRepository(body, operation) {
    const source = normalizeRemoteUrl(body.url || body.source);
    const targetPath = normalizeCloneTargetPath(body.targetPath || body.path);
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) throw new Error(`目标文件夹的上级目录不存在：${parent}`);
    if (!fs.statSync(parent).isDirectory()) throw new Error(`目标文件夹的上级路径不是目录：${parent}`);
    if (fs.existsSync(targetPath)) {
      if (!fs.statSync(targetPath).isDirectory()) throw new Error(`目标路径已存在但不是文件夹：${targetPath}`);
      if (fs.readdirSync(targetPath).length) throw new Error(`目标文件夹不是空的：${targetPath}`);
    }

    const output = await gitStandalone(["clone", "--progress", "--", source, targetPath], { timeout: 600000, maxBuffer: 1024 * 1024 * 16, operation });
    const lines = [`克隆完成`, `来源：${source}`, `位置：${targetPath}`];
    const result = { ok: true, output: lines.join("\n"), clonedPath: targetPath, gitOutput: shortText(output, 2000) };
    if (body.openAfter !== false) {
      result.state = await openRepo(targetPath);
    }
    return result;
  }

  async function initRepository(body) {
    const targetPath = normalizeInitTargetPath(body.targetPath || body.path);
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) throw new Error(`目标文件夹的上级目录不存在：${parent}`);
    if (!fs.statSync(parent).isDirectory()) throw new Error(`目标文件夹的上级路径不是目录：${parent}`);
    if (fs.existsSync(targetPath)) {
      if (!fs.statSync(targetPath).isDirectory()) throw new Error(`目标路径已存在但不是文件夹：${targetPath}`);
    } else {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    const gitPath = path.join(targetPath, ".git");
    if (fs.existsSync(gitPath)) throw new Error(`这个文件夹已经是 Git 仓库：${targetPath}`);

    const output = await gitStandalone(["init", targetPath], { timeout: 60000, maxBuffer: 1024 * 1024 * 4 });
    const lines = [`初始化仓库完成`, `位置：${targetPath}`];
    const result = { ok: true, output: lines.join("\n"), initializedPath: targetPath, gitOutput: shortText(output, 2000) };
    if (body.openAfter !== false) {
      result.state = await openRepo(targetPath);
    }
    return result;
  }

  async function createWorktree(body) {
    const targetPath = normalizeWorktreeTargetPath(body.targetPath || body.path);
    const ref = normalizeRefName(body.ref || "HEAD", "工作树起点");
    const branch = String(body.branch || "").trim() ? normalizeBranchName(body.branch) : "";
    const currentBranch = (await readBranchDisplayName(currentRepo).catch(() => "")).trim();
    const usesCurrentHead = ref === "HEAD" || ref === "@" || (currentBranch && (ref === currentBranch || ref === `refs/heads/${currentBranch}`));
    if (usesCurrentHead && !(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${currentBranch || "HEAD"} 还没有任何提交，不能从 ${ref} 创建工作树。请先创建首个提交，或把工作树起点改成已有分支、Tag 或提交 SHA。`);
    }
    await ensureLiveRemoteBranchRef(ref);
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) throw new Error(`工作树上级目录不存在：${parent}`);
    if (!fs.statSync(parent).isDirectory()) throw new Error(`工作树上级路径不是目录：${parent}`);
    if (fs.existsSync(targetPath)) {
      if (!fs.statSync(targetPath).isDirectory()) throw new Error(`目标路径已存在但不是文件夹：${targetPath}`);
      if (fs.readdirSync(targetPath).length) throw new Error(`目标工作树文件夹不是空的：${targetPath}`);
    }

    const args = branch ? ["worktree", "add", "-b", branch, targetPath, ref] : ["worktree", "add", targetPath, ref];
    const output = await git(currentRepo, args, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    return {
      ok: true,
      output: [`已创建工作树`, `位置：${targetPath}`, branch ? `新分支：${branch}` : `起点：${ref}`].join("\n"),
      targetPath,
      branch,
      ref,
      gitOutput: shortText(output, 2000),
      state: await readState(),
    };
  }

  async function openWorktree(body) {
    const targetPath = normalizeExistingWorktreePath(body.path || body.targetPath);
    const state = await openRepo(targetPath);
    return {
      ok: true,
      output: `已打开工作树：${state.repo.path}`,
      state,
    };
  }

  async function pruneAllWorktrees() {
    const output = await git(currentRepo, ["worktree", "prune", "--verbose"], { timeout: 60000 });
    return {
      ok: true,
      output: output.trim() || "已清理失效工作树记录",
      state: await readState(),
    };
  }

  async function initSubmodules(operation) {
    const submodules = parseSubmodules(
      await git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      await git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => "")
    );
    if (!submodules.length) throw new Error("当前仓库没有配置子模块。");
    const output = await git(currentRepo, ["submodule", "update", "--progress", "--init", "--recursive"], { timeout: 600000, maxBuffer: 1024 * 1024 * 16, operation });
    return {
      ok: true,
      output: output.trim() || "已初始化并更新所有子模块",
      state: await readState(),
    };
  }

  async function updateSubmodules(body, operation) {
    const submodules = parseSubmodules(
      await git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      await git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => "")
    );
    if (!submodules.length) throw new Error("当前仓库没有配置子模块。");
    const submodulePath = body.path === undefined || body.path === null ? "" : String(body.path);
    const args = ["submodule", "update", "--progress", "--init", "--recursive"];
    let label = "所有子模块";
    if (submodulePath) {
      const file = normalizeSubmodulePath(submodulePath, submodules);
      args.push("--", file);
      label = file;
    }
    const output = await git(currentRepo, args, { timeout: 600000, maxBuffer: 1024 * 1024 * 16, operation });
    return {
      ok: true,
      output: output.trim() || `已更新${label}`,
      state: await readState(),
    };
  }

  async function syncSubmodules() {
    const submodules = parseSubmodules(
      await git(currentRepo, submoduleConfigArgs()).catch(() => ""),
      await git(currentRepo, ["submodule", "status", "--recursive"]).catch(() => "")
    );
    if (!submodules.length) throw new Error("当前仓库没有配置子模块。");
    const output = await git(currentRepo, ["submodule", "sync", "--recursive"], { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    return {
      ok: true,
      output: output.trim() || "已同步子模块 URL 配置",
      state: await readState(),
    };
  }

  async function addRemote(body) {
    const remote = normalizeRemoteName(body.name);
    const url = normalizeRemoteUrl(body.url);
    const remoteNames = await readRemoteNames();
    if (remoteNames.includes(remote)) throw new Error(`远端 ${remote} 已存在`);
    await git(currentRepo, ["remote", "add", remote, url], { timeout: 60000 });
    return { ok: true, output: `已添加远端 ${remote}\nURL：${url}` };
  }

  async function setRemoteUrl(body) {
    const remote = await ensureRemoteName(body.name);
    const url = normalizeRemoteUrl(body.url);
    const explicitPushUrls = await readExplicitRemotePushUrls(remote);
    await git(currentRepo, ["remote", "set-url", remote, url], { timeout: 60000 });
    if (explicitPushUrls.length) {
      await replaceRemotePushUrls(remote, [url]);
    }
    return { ok: true, output: `已修改远端 ${remote} 的 URL\nURL：${url}` };
  }

  async function deleteRemote(body) {
    const remote = await ensureRemoteName(body.name);
    await git(currentRepo, ["remote", "remove", remote], { timeout: 60000 });
    return { ok: true, output: `已删除远端 ${remote}` };
  }

  async function setCurrentBranchUpstream(body) {
    const branch = await currentLocalBranch("设置 upstream");
    const upstream = await ensureRemoteBranchRef(body.ref || body.upstream);
    const before = await readCurrentSyncState();
    if (before.unborn) {
      throw new Error(`当前分支 ${branch} 还没有任何提交，不能设置 upstream。请先创建首个提交后再设置。`);
    }
    if (before.upstream === upstream) {
      return { ok: true, output: `当前分支 ${branch} 已经跟踪 ${upstream}` };
    }
    await git(currentRepo, ["branch", `--set-upstream-to=${upstream}`, branch], { timeout: 60000 });
    const after = await readCurrentSyncState();
    const state = syncStateLine(after);
    return { ok: true, output: [`已设置 upstream：${branch} -> ${upstream}`, state].filter(Boolean).join("\n") };
  }

  async function unsetCurrentBranchUpstream() {
    const branch = await currentLocalBranch("取消 upstream");
    const before = await readCurrentSyncState();
    if (!before.upstream) {
      return { ok: true, output: `当前分支 ${branch} 没有 upstream，无需取消` };
    }
    await git(currentRepo, ["branch", "--unset-upstream", branch], { timeout: 60000 });
    return { ok: true, output: `已取消 upstream：${branch}\n原 upstream：${before.upstream}` };
  }

  async function deleteRemoteBranch(body) {
    const remoteRef = normalizeRefName(body.ref || body.branch, "远端分支");
    if (remoteRef.endsWith("/HEAD")) throw new Error("不能删除远端 HEAD 引用");
    const remoteBranches = (await git(currentRepo, ["branch", "--remotes", "--format=%(refname:short)"]))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item && !item.endsWith("/HEAD"));
    if (!remoteBranches.includes(remoteRef)) throw new Error("远端分支不存在，请先抓取远端后再试");
    const parsed = splitRemoteBranchRef(remoteRef, await readRemoteNames());
    if (isProtectedBranchName(parsed.branch)) {
      throw new Error(`远端分支 ${remoteRef} 是主干/长期分支，Forkline 默认保护，不允许从这里删除。`);
    }
    const deleteSha = await ensureRemoteBranchDeleteTargetFresh(remoteRef, parsed, normalizeExpectedRemoteBranchSha(body.sha));
    let output = "";
    try {
      output = await git(currentRepo, ["push", `--force-with-lease=refs/heads/${parsed.branch}:${deleteSha}`, parsed.remote, "--delete", parsed.branch], { timeout: 120000 });
    } catch (error) {
      if (!isMissingRemoteBranchDeleteError(error)) throw error;
      const pruneOutput = await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
      return commandResultWithSummary(`远端分支 ${remoteRef} 已不存在，已刷新远端分支列表`, pruneOutput);
    }
    await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
    return commandResultWithSummary(`已删除远端分支 ${remoteRef}`, output);
  }

  async function ensureRemoteBranchDeleteTargetFresh(remoteRef, parsed, expectedSha) {
    const localSha = (await git(currentRepo, ["rev-parse", "--verify", `refs/remotes/${remoteRef}^{commit}`], { timeout: 60000 }).catch(() => "")).trim();
    const remoteSha = await readRemoteBranchHeadSha(parsed);
    if (!localSha || !remoteSha) {
      await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
      throw new Error(`远端分支 ${remoteRef} 已不存在或本地列表已过期，已刷新远端分支列表。请刷新后重新选择。`);
    }
    if (!localSha.toLowerCase().startsWith(expectedSha)) {
      throw new Error(`远端分支 ${remoteRef} 的本地跟踪引用已经变化。为避免删除别人新推送的分支，请刷新后重新选择。`);
    }
    if (localSha !== remoteSha) {
      await git(currentRepo, ["fetch", parsed.remote, "--prune"], { timeout: 120000 }).catch(() => "");
      throw new Error(`远端分支 ${remoteRef} 已经变化，当前页面看到的不是最新远端分支。为避免删除别人新推送的分支，请刷新后重新选择。`);
    }
    return remoteSha;
  }

  async function readRemoteBranchHeadSha(parsed) {
    const output = await git(currentRepo, ["ls-remote", "--heads", parsed.remote, parsed.branch], { timeout: 60000, maxBuffer: 1024 * 1024 * 2 });
    const fullRef = `refs/heads/${parsed.branch}`;
    const row = String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .find((parts) => parts[1] === fullRef);
    return row?.[0] || "";
  }

  function normalizeExpectedRemoteBranchSha(value) {
    const sha = String(value || "").trim().toLowerCase();
    if (!sha) throw new Error("远端分支列表状态已过期，请刷新分支列表后重新选择。");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error("远端分支身份不合法，请刷新分支列表后重新选择。");
    return sha;
  }

  function isMissingRemoteBranchDeleteError(error) {
    const lower = String(error?.message || error || "").toLowerCase();
    return (lower.includes("remote ref does not exist") || lower.includes("unable to delete")) && lower.includes("remote");
  }

  async function renameBranch(body) {
    const branch = normalizeBranchName(body.branch);
    const newBranch = normalizeBranchName(body.newBranch);
    if (branch === newBranch) return { ok: true, branch, output: "分支名没有变化" };
    if (isProtectedBranchName(branch)) {
      throw new Error(`分支 ${branch} 是主干/长期分支，Forkline 默认保护，不允许从这里重命名。`);
    }
    await ensureCurrentLocalBranch(branch, normalizeExpectedBranchSha(body.sha));
    await git(currentRepo, ["check-ref-format", "--branch", newBranch]).catch(() => {
      throw new Error("分支名不合法");
    });
    const currentBranch = (await git(currentRepo, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")).trim();
    const args = branch === currentBranch ? ["branch", "-m", newBranch] : ["branch", "-m", branch, newBranch];
    await git(currentRepo, args, { timeout: 60000 });
    return { ok: true, branch: newBranch, output: `已重命名分支：${branch} -> ${newBranch}` };
  }

  async function mergeRef(body) {
    const ref = normalizeRefName(body.ref, "合并目标");
    await ensureLiveRemoteBranchRef(ref);
    const currentBranch = await currentLocalBranch("合并");
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${currentBranch} 还没有任何提交，不能合并分支。请先创建首个提交后再合并。`);
    }
    if (ref === currentBranch) throw new Error("不能把当前分支合并到自己");
    const output = await git(currentRepo, ["merge", "--no-ff", "--no-edit", ref], { timeout: 120000 });
    return commandResult(output || `已合并 ${ref}`);
  }

  async function rebaseOntoRef(body) {
    const ref = normalizeRefName(body.ref, "变基目标");
    const operation = detectRepoOperation(currentRepo);
    if (operation) throw new Error(`仓库还有未完成操作：${operation.label}。请先继续或中止后再变基。`);
    await ensureLiveRemoteBranchRef(ref);
    const currentBranch = await currentLocalBranch("变基");
    if (!(await hasHeadCommit(currentRepo))) {
      throw new Error(`当前分支 ${currentBranch} 还没有任何提交，不能变基。请先创建首个提交后再变基。`);
    }
    if (ref === currentBranch) throw new Error("不能把当前分支变基到自己");
    const dirty = await git(currentRepo, ["status", "--porcelain", "--untracked-files=all"]).catch(() => "");
    if (dirty.trim()) throw new Error("当前有未提交修改。请先提交或储藏后再变基。");
    await git(currentRepo, ["rev-parse", "--verify", `${ref}^{commit}`], { timeout: 60000 });
    const recovery = await createRecoveryPoint("rebase-onto");
    const output = await git(currentRepo, ["rebase", ref], { timeout: 120000 });
    const newHead = (await git(currentRepo, ["rev-parse", "--short", "HEAD"])).trim();
    return appendRecoveryLine(commandResultWithSummary(`已将当前分支 ${currentBranch} 变基到 ${ref}，当前 HEAD 为 ${newHead}`, output), recovery);
  }

  async function createTag(body) {
    const name = normalizeTagName(body.name);
    let target = "";
    try {
      target = await resolveCommit(body.target);
    } catch {
      throw new Error("Tag 目标提交不存在或不是有效提交。请刷新提交列表后重新选择。");
    }
    const annotated = Boolean(body.annotated);
    const message = String(body.message || "").trim() || name;
    await git(currentRepo, ["check-ref-format", `refs/tags/${name}`]).catch(() => {
      throw new Error("标签名不合法");
    });
    const args = annotated ? ["tag", "-a", name, target, "-m", message] : ["tag", name, target];
    await git(currentRepo, args, { timeout: 60000 });
    return { ok: true, tag: name, output: `已创建 Tag ${name}` };
  }

  async function deleteTag(body) {
    const name = normalizeTagName(body.name);
    await ensureCurrentLocalTag(body);
    const output = await git(currentRepo, ["tag", "-d", name], { timeout: 60000 });
    return commandResultWithSummary(`已删除本地 Tag ${name}`, output);
  }

  async function pushTag(body) {
    const name = normalizeTagName(body.name);
    await ensureCurrentLocalTag(body);
    const remote = await defaultRemoteName(body.remote);
    const output = await git(currentRepo, ["push", remote, `refs/tags/${name}:refs/tags/${name}`], { timeout: 120000 });
    if (output.toLowerCase().includes("everything up-to-date")) {
      return commandResultWithSummary(`远端 ${remote} 已有相同 Tag ${name}，无需重复推送`, output);
    }
    return commandResultWithSummary(`已推送 Tag ${name} 到 ${remote}`, output);
  }

  async function deleteRemoteTag(body) {
    const name = normalizeTagName(body.name);
    await ensureCurrentLocalTag(body);
    const remote = await defaultRemoteName(body.remote);
    const deleteSha = await ensureRemoteTag(remote, name, normalizeExpectedTagSha(body.sha));
    const output = await git(currentRepo, ["push", `--force-with-lease=refs/tags/${name}:${deleteSha}`, remote, `:refs/tags/${name}`], { timeout: 120000 });
    return commandResultWithSummary(`已删除远端 Tag ${name}`, output);
  }

  async function pruneWorktrees(body) {
    const branch = normalizeBranchName(body.branch);
    const rows = parseWorktreeList(await git(currentRepo, ["worktree", "list", "--porcelain"]).catch(() => ""), currentRepo);
    const prunable = worktreePruneEntries(rows);
    const info = prunable.find((row) => row.branch === branch);
    if (!info) return { ok: true, output: "没有发现需要清理的失效 worktree 记录" };
    if (prunable.length !== 1) {
      throw new Error(`当前有 ${prunable.length} 条失效 worktree 记录。单项清理会影响其他记录，请刷新后在工作树页使用“清理失效”一次确认全部。`);
    }
    const output = await git(currentRepo, ["worktree", "prune", "--verbose"], { timeout: 60000 });
    return commandResult(output || "已清理失效 worktree 记录");
  }

  function normalizeCheckoutMode(value) {
    const mode = String(value || "keep").trim();
    if (["keep", "stash", "force"].includes(mode)) return mode;
    throw new Error("切换分支方式不合法");
  }

  function normalizeBranchStart(value) {
    const start = String(value || "").trim();
    if (!start) return "";
    if (/^[0-9a-f]{7,40}$/i.test(start)) return start;
    return normalizeRefName(start);
  }

  function normalizeRemoteUrl(value) {
    const url = String(value || "").trim();
    if (!url || url.includes("\0") || /[\r\n]/.test(url)) throw new Error("远端 URL 不合法");
    return url;
  }

  function normalizeCloneTargetPath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("目标文件夹不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("目标文件夹必须是本机绝对路径");
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) throw new Error("目标文件夹不能是磁盘根目录");
    return resolved;
  }

  function normalizeInitTargetPath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("初始化文件夹不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("初始化文件夹必须是本机绝对路径");
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) throw new Error("初始化文件夹不能是磁盘根目录");
    return resolved;
  }

  function normalizeWorktreeTargetPath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("工作树文件夹不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("工作树文件夹必须是本机绝对路径");
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) throw new Error("工作树文件夹不能是磁盘根目录");
    if (sameFsPath(resolved, currentRepo)) throw new Error("新工作树不能和当前仓库路径相同");
    return resolved;
  }

  function normalizeExistingWorktreePath(value) {
    const targetPath = String(value || "").trim();
    if (!targetPath || targetPath.includes("\0") || /[\r\n]/.test(targetPath)) throw new Error("工作树路径不合法");
    const resolved = path.resolve(targetPath);
    if (!path.isAbsolute(targetPath)) throw new Error("工作树路径必须是本机绝对路径");
    if (!fs.existsSync(resolved)) throw new Error(`工作树路径不存在：${resolved}`);
    if (!fs.statSync(resolved).isDirectory()) throw new Error(`工作树路径不是文件夹：${resolved}`);
    return resolved;
  }

  function normalizeRemoteCheckoutBranch(remoteRef, remoteNames = []) {
    return splitRemoteBranchRef(remoteRef, remoteNames).branch;
  }

  async function ensureRemoteName(value) {
    const remote = normalizeRemoteName(value);
    const remoteNames = await readRemoteNames();
    if (!remoteNames.includes(remote)) throw new Error(`远端 ${remote} 不存在`);
    return remote;
  }



  return {

    setCurrentRepo,

    addRemote,

    checkoutBranch,

    checkoutRemoteBranch,

    cloneRepository,

    createBranch,

    createTag,

    createWorktree,

    deleteBranch,

    deleteBranches,

    deleteRemote,

    deleteRemoteBranch,

    deleteRemoteTag,

    deleteTag,

    ensurePushIsSafe,

    fetchRemote,

    fetchRemotes,

    forcePushCurrentBranchWithLease,

    initRepository,

    initSubmodules,

    isProtectedBranchName,

    mergeRef,

    normalizeRemoteUrl,

    openWorktree,

    pruneAllWorktrees,

    pruneWorktrees,

    pullCurrentBranch,

    pullRebaseCurrentBranch,

    pushCurrentBranch,

    pushTag,

    rebaseOntoRef,

    renameBranch,

    setCurrentBranchUpstream,

    setRemoteUrl,

    syncSubmodules,

    testRemote,

    unsetCurrentBranchUpstream,

    updateSubmodules,

  };

}



module.exports = { createGitBranchService };
