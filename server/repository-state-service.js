"use strict";

const path = require("path");

function createRepositoryStateService(options) {
  const {
    git,
    getCurrentRepo,
    submoduleService,
    worktreeService,
    readBranchDisplayName,
    parseRemoteNames,
    parseRemoteDetails,
    isKnownRemoteBranch,
    parseBranchTracking,
    mergeBranchInfo,
    parseBranchCleanupMeta,
    parseRemoteBranchInfo,
    parseSimpleLines,
    buildBranchCleanup,
    parseTags,
    parseRecoveryPoints,
    readReflogOutput,
    parseReflogEntries,
    detectRepoOperation,
    recoveryRefPrefix: RECOVERY_REF_PREFIX,
    defaultHistoryLimit: DEFAULT_HISTORY_LIMIT,
    maxHistoryLimit: MAX_HISTORY_LIMIT,
    refCommitLogFormat: REF_COMMIT_LOG_FORMAT,
    laneColors,
    operationLog,
    listRunningOperations,
  } = options;
  const {
    buildWorktreePruneSnapshot,
    enrichSubmodules,
    enrichWorktreeList,
    parseSubmodules,
    parseWorktreeBranches,
    parseWorktreeList,
    repoHasSubmoduleConfig,
    submoduleConfigArgs,
  } = submoduleService;
  const {
    parseLog,
    parseStashList,
    readCurrentSyncDetails,
    readWorkingStatus,
    sha256Json,
  } = worktreeService;
  let currentRepo = getCurrentRepo();

  function setCurrentRepo(repoPath) {
    currentRepo = repoPath || null;
  }

  function sampleState() {
    const files = [
      { state: "M", file: "src/views/HistoryPanel.tsx", extra: "+28 -6" },
      { state: "A", file: "src/git/graphLayout.ts", extra: "+61" },
      { state: "M", file: "src/styles/workbench.css", extra: "+44 -12" },
      { state: "D", file: "docs/old-flow.md", extra: "-18" },
      { state: "M", file: "package.json", extra: "+2 -1" },
    ];
    const diff = [
      { type: "meta", text: "diff --git a/src/views/HistoryPanel.tsx b/src/views/HistoryPanel.tsx" },
      { type: "ctx", text: "function HistoryPanel({ commits, selectedSha }) {" },
      { type: "del", text: "  const lanes = commits.map((commit) => commit.lane);" },
      { type: "add", text: "  const lanes = graphLayout(commits, selectedSha);" },
      { type: "ctx", text: "  return (" },
      { type: "add", text: "    <GraphCanvas lanes={lanes} focus={selectedSha} />" },
      { type: "ctx", text: "    <CommitRows commits={commits} />" },
      { type: "del", text: "    <CommitDetails sha={selectedSha} />" },
      { type: "add", text: "    <CommitDetails sha={selectedSha} mode=\"inspector\" />" },
      { type: "ctx", text: "  );" },
      { type: "ctx", text: "}" },
    ];
    const data = [
      ["f83a9c2b0177", "Mina", "12 分钟前", "打磨提交图连线动画", "feature/visual-history", 0, ["d41c2ab91020"]],
      ["d41c2ab91020", "Leon", "38 分钟前", "添加语义化 Diff 分组", "review-ready", 0, ["ad9ef73774af", "7ca12dd48211"]],
      ["7ca12dd48211", "Rae", "1 小时前", "修复 Diff 面板拖拽尺寸", "fix/diff-pane-resize", 1, ["91b2a10552dd"]],
      ["ad9ef73774af", "Mina", "2 小时前", "接入分支操作菜单", "", 0, ["3cb8ffe030e4"]],
      ["91b2a10552dd", "Rae", "2 小时前", "完善检查器空状态", "", 1, ["3cb8ffe030e4"]],
      ["3cb8ffe030e4", "Nora", "5 小时前", "合并 release/2.9 到可视化历史", "merge", 0, ["6bb990ef4afd", "4ab612e810db"]],
      ["4ab612e810db", "Owen", "昨天", "发布候选版本构建", "release/2.9", 2, ["fa51203b0921"]],
      ["6bb990ef4afd", "Leon", "昨天", "持久化历史列宽", "", 0, ["fa51203b0921"]],
      ["fa51203b0921", "Nora", "周一", "添加命令面板动作", "main", 0, ["0be81f4189de"]],
      ["0be81f4189de", "Mina", "周一", "规范化提交图泳道数据", "", 0, ["8e3ab9017ed2"]],
      ["8e3ab9017ed2", "Owen", "周五", "初始化可视化历史外壳", "origin/main", 3, []],
    ];
    return {
      repo: {
        name: "atlas-dashboard",
        path: "示例仓库",
        branch: "feature/visual-history",
        headSha: data[0][0],
        isSample: true,
        remoteNames: ["origin", "upstream"],
      },
      branches: ["feature/visual-history", "main", "release/2.9", "fix/diff-pane-resize", "experiment/ai-summary", "chore/design-tokens"],
      branchInfo: {
        "feature/visual-history": { upstream: "origin/feature/visual-history", ahead: 2, behind: 1 },
        "fix/diff-pane-resize": { upstream: "origin/fix/diff-pane-resize", ahead: 0, behind: 0 },
        "experiment/ai-summary": { upstream: "origin/experiment/ai-summary", upstreamGone: true, ahead: 1, behind: 0 },
      },
      branchCleanup: [
        {
          branch: "feature/visual-history",
          current: true,
          protected: true,
          protectedReason: "当前分支",
          upstream: "origin/feature/visual-history",
          ahead: 2,
          behind: 1,
          statusLabel: "当前",
          reason: "当前所在分支不能删除",
          lastCommitShort: "f83a9c2",
          lastSubject: "打磨提交图连线动画",
          lastUpdated: "12 分钟前",
        },
        {
          branch: "fix/diff-pane-resize",
          mergedIntoCurrent: true,
          canDelete: true,
          recommended: true,
          statusLabel: "已合并",
          reason: "已合并到当前 HEAD，可用安全删除清理",
          lastCommitShort: "91b2a10",
          lastSubject: "完善检查器空状态",
          lastUpdated: "2 小时前",
        },
        {
          branch: "experiment/ai-summary",
          upstreamGone: true,
          attention: true,
          canDelete: true,
          statusLabel: "上游丢失",
          reason: "上游分支已经不存在，删除前先确认本地提交是否还需要",
          lastCommitShort: "d41c2ab",
          lastSubject: "添加语义化 Diff 分组",
          lastUpdated: "38 分钟前",
        },
        {
          branch: "main",
          protected: true,
          protectedReason: "主干/长期分支",
          statusLabel: "保护",
          reason: "主干或长期分支默认保留",
          lastCommitShort: "fa51203",
          lastSubject: "添加命令面板动作",
          lastUpdated: "周一",
        },
      ],
      worktrees: [
        {
          path: "示例仓库",
          head: "f83a9c2b0177",
          shortHead: "f83a9c",
          branch: "feature/visual-history",
          label: "feature/visual-history",
          current: true,
          exists: true,
          status: "dirty",
          dirtyCount: 5,
        },
        {
          path: "D:\\开发\\atlas-dashboard-main",
          head: "fa51203b0921",
          shortHead: "fa51203",
          branch: "main",
          label: "main",
          current: false,
          exists: true,
          status: "clean",
          dirtyCount: 0,
        },
        {
          path: "D:\\开发\\atlas-dashboard-old-review",
          head: "91b2a10552dd",
          shortHead: "91b2a10",
          branch: "old/review",
          label: "old/review",
          current: false,
          exists: false,
          prunable: true,
          pruneReason: "working tree path is missing",
          status: "missing",
          dirtyCount: 0,
        },
      ],
      submodules: [
        {
          name: "shared-ui",
          path: "packages/shared-ui",
          url: "git@github.com:example/shared-ui.git",
          branch: "main",
          sha: "6bb990ef4afd",
          shortSha: "6bb990e",
          status: "ok",
          statusLabel: "已就绪",
          summary: "heads/main",
          initialized: true,
          exists: true,
          dirtyCount: 0,
          worktreeBranch: "main",
          worktreeHead: "6bb990e",
        },
        {
          name: "legacy-theme",
          path: "vendor/legacy-theme",
          url: "https://github.com/example/legacy-theme.git",
          branch: "",
          sha: "4ab612e810db",
          shortSha: "4ab612e",
          status: "uninitialized",
          statusLabel: "未初始化",
          initialized: false,
          exists: false,
          dirtyCount: 0,
        },
      ],
      worktreePruneSnapshot: sha256Json([]),
      remotes: ["origin/main", "origin/feature/visual-history", "upstream/release/2.9"],
      sync: {
        branch: "feature/visual-history",
        upstream: "origin/feature/visual-history",
        upstreamSha: "f6d4a2c9e8b7f1a3d5c6b8a9e0f1c2d3b4a5e6f7",
        upstreamGone: false,
        ahead: 2,
        behind: 1,
        remotes: [
          { name: "origin", fetchUrl: "git@github.com:example/atlas-dashboard.git", pushUrl: "git@github.com:example/atlas-dashboard.git", pushUrls: ["git@github.com:example/atlas-dashboard.git"] },
          { name: "upstream", fetchUrl: "https://github.com/example/base-dashboard.git", pushUrl: "https://github.com/example/base-dashboard.git", pushUrls: ["https://github.com/example/base-dashboard.git"] },
        ],
        auth: {
          summary: "1 个 SSH 远端，1 个 HTTPS 远端；2 组 SSH key；agent 1 个 key；GCM 可用",
          level: "ok",
          advice: "SSH key 和 ssh-agent 都可见，HTTPS 凭据管理器可用；如果某个远端仍失败，请点远端行的“诊断”。",
          remotes: [
            { name: "origin", url: "git@github.com:example/atlas-dashboard.git", kind: "ssh", kindLabel: "SSH", host: "github.com" },
            { name: "upstream", url: "https://github.com/example/base-dashboard.git", kind: "https", kindLabel: "HTTPS", host: "github.com" },
          ],
          ssh: {
            directory: "~/.ssh",
            exists: true,
            keys: [
              { name: "id_ed25519", publicKey: true, privateKey: true, publicFile: "id_ed25519.pub", privateFile: "id_ed25519", updated: "2026-06-12 20:18:00" },
              { name: "id_rsa_work", publicKey: true, privateKey: true, publicFile: "id_rsa_work.pub", privateFile: "id_rsa_work", updated: "2026-06-08 09:42:00" },
            ],
            configExists: true,
            knownHostsExists: true,
            message: "发现 2 组 SSH key 文件",
          },
          agent: { available: true, loaded: true, keyCount: 1, message: "ssh-agent 已加载 1 个 key。" },
          credentialManager: { available: true, name: "Git Credential Manager", version: "Git Credential Manager 2.x", message: "Git Credential Manager 可用。" },
          commands: ["git remote -v", "ssh-add -l", "ssh -T git@github.com", "git credential-manager version", "git credential-manager diagnose"],
        },
        pullRequest: {
          available: true,
          url: "https://github.com/example/atlas-dashboard/compare/main...feature%2Fvisual-history?expand=1",
          source: "feature/visual-history",
          target: "main",
          remote: "origin",
          remoteUrl: "git@github.com:example/atlas-dashboard.git",
          platform: "github",
          platformLabel: "GitHub",
          title: "创建 Pull Request",
          reason: "",
        },
        incoming: [
          { sha: "b91a4d3c22aa", short: "b91a4d3", author: "Nora", time: "18 分钟前", message: "远端补充发布说明", refs: "origin/feature/visual-history", parents: [] },
        ],
        outgoing: [
          { sha: "f83a9c2b0177", short: "f83a9c2", author: "Mina", time: "12 分钟前", message: "打磨提交图连线动画", refs: "feature/visual-history", parents: [] },
          { sha: "d41c2ab91020", short: "d41c2ab", author: "Leon", time: "38 分钟前", message: "添加语义化 Diff 分组", refs: "", parents: [] },
        ],
      },
      tags: [
        { name: "v2.9.0", object: "4ab612e", time: "昨天", subject: "发布候选版本构建", type: "commit" },
        { name: "ui-graph-beta", object: "d41c2ab", time: "38 分钟前", subject: "添加语义化 Diff 分组", type: "tag" },
      ],
      recoveryPoints: [
        {
          ref: "refs/forkline/recovery/20260612-213000/feature_visual-history/rebase-onto",
          shortRef: "20260612-213000/feature_visual-history/rebase-onto",
          sha: "f83a9c2b0177",
          short: "f83a9c2",
          subject: "打磨提交图连线动画",
          branch: "feature_visual-history",
          action: "rebase-onto",
          actionLabel: "变基前",
          time: "2026-06-12 21:30:00",
        },
      ],
      reflogEntries: [
        {
          index: 0,
          sha: "f83a9c2b0177",
          short: "f83a9c2",
          selector: "HEAD@{0}",
          message: "commit: 打磨提交图连线动画",
          action: "commit",
          actionLabel: "提交",
          author: "Mina",
          rawTime: "2026-06-12T21:42:00+08:00",
          time: "2026-06-12 21:42:00",
        },
        {
          index: 1,
          sha: "fa51203b0921",
          short: "fa51203",
          selector: "HEAD@{1}",
          message: "checkout: moving from main to feature/visual-history",
          action: "checkout",
          actionLabel: "切换",
          author: "Mina",
          rawTime: "2026-06-12T21:18:00+08:00",
          time: "2026-06-12 21:18:00",
        },
      ],
      runningOperations: [
        {
          id: "sample-running",
          action: "fetch",
          label: "抓取远端",
          startedAt: Date.now() - 2400,
          startedTime: "2026-06-12 21:34:01",
          durationMs: 2400,
          elapsed: "2 秒",
        },
      ],
      operationLog: [
        {
          id: "sample-2",
          status: "success",
          action: "pullRebase",
          label: "变基拉取远端",
          time: "2026-06-12 21:32:18",
          durationMs: 1240,
          summary: "变基拉取完成\n当前分支：feature/visual-history -> origin/feature/visual-history\n同步状态：本地还有 2 个提交未推送",
        },
        {
          id: "sample-1",
          status: "error",
          action: "push",
          label: "推送到远端",
          time: "2026-06-12 21:28:04",
          durationMs: 460,
          summary: "推送被保护：本地领先 2，同时落后 1，普通推送已保护。请先拉取/变基拉取，或确认后使用安全强推。",
        },
      ],
      workingFiles: files,
      commits: data.map(([sha, author, time, message, refs, lane, parents], index) => ({
        sha,
        short: sha.slice(0, 7),
        author,
        time,
        message,
        refs,
        parents,
        lane,
        color: laneColors[lane],
        files: [files[index % files.length], files[(index + 1) % files.length]],
        diff,
      })),
    };
  }
  function parseBranchRefs(output, remoteNames) {
    const branches = [];
    const remotes = [];
    for (const raw of String(output || "").split(/\r?\n/)) {
      const refname = raw.trim();
      if (!refname) continue;
      if (refname.startsWith("refs/heads/")) {
        branches.push(refname.replace(/^refs\/heads\//, ""));
        continue;
      }
      if (refname.startsWith("refs/remotes/")) {
        const remoteBranch = refname.replace(/^refs\/remotes\//, "");
        if (isKnownRemoteBranch(remoteBranch, remoteNames)) remotes.push(remoteBranch);
        continue;
      }
      if (refname.endsWith("/HEAD") || refname === "origin" || refname === "upstream") continue;
      if (refname.startsWith("remotes/")) {
        const remoteBranch = refname.replace(/^remotes\//, "");
        if (isKnownRemoteBranch(remoteBranch, remoteNames)) remotes.push(remoteBranch);
      } else if (/^[^/]+\/.+/.test(refname) && isKnownRemoteBranch(refname, remoteNames)) remotes.push(refname);
      else branches.push(refname);
    }
    return { branches, remotes };
  }

  async function readState(ref = "", rawHistoryLimit = DEFAULT_HISTORY_LIMIT) {
    const historyLimit = normalizeHistoryLimit(rawHistoryLimit);
    if (!currentRepo) {
      const sample = sampleState();
      const page = historyPage(sample.commits || [], historyLimit);
      return { ...sample, commits: page.commits, history: page.history };
    }
    const repoPath = currentRepo;
    const selectedRef = String(ref || "").trim();
    const hasSubmoduleConfig = repoHasSubmoduleConfig(repoPath);
    const [branch, headShaOutput, branchOutput, trackingOutput, branchMetaOutput, remoteMetaOutput, mergedBranchOutput, remoteOutput, remoteVerboseOutput, tagOutput, worktreeOutput, submoduleConfigOutput, submoduleStatusOutput, statusOutput, stashOutput, recoveryOutput, logOutput] = await Promise.all([
      readBranchDisplayName(repoPath),
      git(repoPath, ["rev-parse", "--verify", "HEAD"]).catch(() => ""),
      git(repoPath, ["branch", "--all", "--format=%(refname)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/heads", "--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/heads", "--sort=-committerdate", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)\t%(committerdate:relative)\t%(committerdate:unix)\t%(subject)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/remotes", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)"]).catch(() => ""),
      git(repoPath, ["branch", "--merged", "HEAD", "--format=%(refname:short)"]).catch(() => ""),
      git(repoPath, ["remote"]).catch(() => ""),
      git(repoPath, ["remote", "-v"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/tags", "--sort=-creatordate", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)\t%(creatordate:relative)\t%(subject)\t%(objecttype)"]).catch(() => ""),
      git(repoPath, ["worktree", "list", "--porcelain"]).catch(() => ""),
      hasSubmoduleConfig ? git(repoPath, submoduleConfigArgs()).catch(() => "") : "",
      hasSubmoduleConfig ? git(repoPath, ["submodule", "status", "--recursive"]).catch(() => "") : "",
      git(repoPath, ["status", "--short", "-z", "--untracked-files=all"]).catch(() => ""),
      git(repoPath, ["stash", "list", "--format=%gd%x00%H%x00%gs%x00%cr"]).catch(() => ""),
      git(repoPath, ["for-each-ref", RECOVERY_REF_PREFIX, "--sort=-refname", "--format=%(refname)\t%(objectname)\t%(objectname:short)\t%(subject)"]).catch(() => ""),
      git(repoPath, logArgs(selectedRef, historyLimit)).catch(() => ""),
    ]);

    const remoteNames = parseRemoteNames(remoteOutput);
    const { branches, remotes } = parseBranchRefs(branchOutput, remoteNames);
    const currentBranch = branch.trim();
    if (currentBranch && currentBranch !== "detached HEAD" && !branches.includes(currentBranch)) {
      branches.unshift(currentBranch);
    }
    const remoteInfo = parseRemoteBranchInfo(remoteMetaOutput, remoteNames);

    const worktreeRows = parseWorktreeList(worktreeOutput, repoPath);
    const worktreePruneSnapshot = buildWorktreePruneSnapshot(worktreeRows);
    const branchMeta = parseBranchCleanupMeta(branchMetaOutput);
    const branchTracking = parseBranchTracking(trackingOutput);
    const branchInfo = mergeBranchInfo(branchTracking, branchMeta, parseWorktreeBranches(worktreeOutput, repoPath));
    const branchCleanup = buildBranchCleanup({
      branches,
      branchInfo,
      branchMeta,
      mergedBranches: parseSimpleLines(mergedBranchOutput),
      currentBranch,
    });
    const syncOptions = {
      branch: currentBranch,
      hasCommit: Boolean(headShaOutput.trim()),
      remotes: parseRemoteDetails(remoteVerboseOutput, remoteNames),
      localBranches: branches,
      remoteNames,
    };
    if (branchTracking[currentBranch]) syncOptions.upstream = branchTracking[currentBranch].upstream;
    const [worktrees, submodules, working, sync] = await Promise.all([
      enrichWorktreeList(worktreeRows, { repoPath, statusOutput }),
      enrichSubmodules(parseSubmodules(submoduleConfigOutput, submoduleStatusOutput), repoPath),
      readWorkingStatus(repoPath, statusOutput),
      readCurrentSyncDetails(repoPath, syncOptions),
    ]);
    const commitPage = historyPage(parseLog(logOutput), historyLimit);
    return {
      repo: {
        name: path.basename(repoPath),
        path: repoPath,
        branch: branch.trim() || "detached HEAD",
        headSha: headShaOutput.trim(),
        selectedRef,
        isSample: false,
        operation: detectRepoOperation(repoPath),
        remoteNames,
      },
      branches,
      branchInfo,
      branchCleanup,
      worktrees,
      worktreePruneSnapshot,
      submodules,
      remotes,
      remoteInfo,
      sync,
      workingFiles: working.files,
      worktreeSnapshot: working.snapshot,
      stashes: parseStashList(stashOutput),
      recoveryPoints: parseRecoveryPoints(recoveryOutput),
      tags: parseTags(tagOutput),
      runningOperations: listRunningOperations(),
      operationLog,
      commits: commitPage.commits,
      history: commitPage.history,
    };
  }

  async function readOpenState(rawHistoryLimit = DEFAULT_HISTORY_LIMIT) {
    const historyLimit = normalizeHistoryLimit(rawHistoryLimit);
    if (!currentRepo) return readState("", historyLimit);
    const repoPath = currentRepo;
    const currentBranch = String(await readBranchDisplayName(repoPath).catch(() => "")).trim();
    const selectedRef = currentBranch && currentBranch !== "detached HEAD" ? currentBranch : "";
    const [syncState, logOutput] = await Promise.all([
      readSyncState({ includeBranches: true }),
      git(repoPath, logArgs(selectedRef, historyLimit)).catch(() => ""),
    ]);
    const commitPage = historyPage(parseLog(logOutput), historyLimit);
    return {
      ...syncState,
      repo: {
        ...(syncState.repo || {}),
        selectedRef,
        operation: detectRepoOperation(repoPath),
      },
      branchCleanup: [],
      worktrees: [],
      worktreePruneSnapshot: "",
      submodules: [],
      workingFiles: [],
      worktreeSnapshot: "",
      stashes: [],
      recoveryPoints: [],
      tags: [],
      runningOperations: listRunningOperations(),
      operationLog,
      commits: commitPage.commits,
      history: commitPage.history,
      progressive: true,
    };
  }

  async function readSyncState(options = {}) {
    if (!currentRepo) {
      const sample = sampleState();
      const branch = sample.repo?.branch || "";
      return {
        repo: sample.repo,
        ...(options.includeBranches ? { branches: sample.branches || [] } : {}),
        branchInfo: branch && sample.branchInfo?.[branch] ? { [branch]: sample.branchInfo[branch] } : {},
        remotes: sample.remotes || [],
        remoteInfo: sample.remoteInfo || {},
        sync: sample.sync || {},
      };
    }
    const repoPath = currentRepo;
    const [branch, headShaOutput, branchOutput, trackingOutput, remoteMetaOutput, remoteOutput, remoteVerboseOutput] = await Promise.all([
      readBranchDisplayName(repoPath),
      git(repoPath, ["rev-parse", "--verify", "HEAD"]).catch(() => ""),
      git(repoPath, ["branch", "--all", "--format=%(refname)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/heads", "--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)"]).catch(() => ""),
      git(repoPath, ["for-each-ref", "refs/remotes", "--format=%(refname:short)\t%(objectname)\t%(objectname:short)"]).catch(() => ""),
      git(repoPath, ["remote"]).catch(() => ""),
      git(repoPath, ["remote", "-v"]).catch(() => ""),
    ]);
    const remoteNames = parseRemoteNames(remoteOutput);
    const { branches, remotes } = parseBranchRefs(branchOutput, remoteNames);
    const currentBranch = branch.trim();
    if (currentBranch && currentBranch !== "detached HEAD" && !branches.includes(currentBranch)) branches.unshift(currentBranch);
    const branchTracking = parseBranchTracking(trackingOutput);
    const syncOptions = {
      branch: currentBranch,
      hasCommit: Boolean(headShaOutput.trim()),
      remotes: parseRemoteDetails(remoteVerboseOutput, remoteNames),
      localBranches: branches,
      remoteNames,
    };
    if (branchTracking[currentBranch]) syncOptions.upstream = branchTracking[currentBranch].upstream;
    const sync = await readCurrentSyncDetails(repoPath, syncOptions);
    const branchInfo = currentBranch && currentBranch !== "detached HEAD"
      ? {
          [currentBranch]: {
            ...(branchTracking[currentBranch] || {}),
            upstream: sync.upstream || "",
            ahead: sync.ahead || 0,
            behind: sync.behind || 0,
            upstreamGone: Boolean(sync.upstreamGone),
          },
        }
      : {};
    return {
      repo: {
        name: path.basename(repoPath),
        path: repoPath,
        branch: currentBranch || "detached HEAD",
        headSha: headShaOutput.trim(),
        isSample: false,
        remoteNames,
      },
      ...(options.includeBranches ? { branches } : {}),
      branchInfo,
      remotes,
      remoteInfo: parseRemoteBranchInfo(remoteMetaOutput, remoteNames),
      sync,
    };
  }
  async function readReflogState(repoPath = currentRepo) {
    const output = await readReflogOutput(80, repoPath).catch(() => "");
    return { reflogEntries: parseReflogEntries(output) };
  }
  async function readRefState(ref = "", rawHistoryLimit = DEFAULT_HISTORY_LIMIT) {
    const historyLimit = normalizeHistoryLimit(rawHistoryLimit);
    if (!currentRepo) {
      const sample = sampleState();
      sample.repo.selectedRef = ref;
      if (ref) sample.commits = sampleBranchCommits(sample, ref);
      const page = historyPage(sample.commits || [], historyLimit);
      return { repo: sample.repo, commits: page.commits, history: page.history };
    }
    const repoPath = currentRepo;
    const selectedRef = String(ref || "").trim();
    const [branch, headShaOutput, logOutput] = await Promise.all([
      readBranchDisplayName(repoPath),
      git(repoPath, ["rev-parse", "--verify", "HEAD"]).catch(() => ""),
      git(repoPath, logArgs(selectedRef, historyLimit)).catch(() => ""),
    ]);
    const commitPage = historyPage(parseLog(logOutput), historyLimit);
    return {
      repo: {
        name: path.basename(repoPath),
        path: repoPath,
        branch: branch.trim() || "detached HEAD",
        headSha: headShaOutput.trim(),
        selectedRef,
        isSample: false,
        operation: detectRepoOperation(repoPath),
      },
      commits: commitPage.commits,
      history: commitPage.history,
    };
  }
  function sampleBranchCommits(sample, ref) {
    const commits = sample?.commits || [];
    if (!ref || !commits.length) return commits;
    const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
    let cursor = commits.find((commit) => refNamesFromText(commit.refs).includes(ref)) || commits[0];
    const list = [];
    while (cursor && !list.some((commit) => commit.sha === cursor.sha)) {
      list.push({ ...cursor, lane: 0, color: laneColors[0] });
      cursor = bySha.get(cursor.parents?.[0]);
    }
    return list;
  }
  function refNamesFromText(refs) {
    return String(refs || "")
      .split(",")
      .map((item) => item.trim().replace(/^HEAD\s+->\s+/, ""))
      .filter(Boolean);
  }
  function normalizeHistoryLimit(value) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isInteger(parsed)) return DEFAULT_HISTORY_LIMIT;
    return Math.max(20, Math.min(MAX_HISTORY_LIMIT, parsed));
  }
  function historyPage(commits, limit) {
    const list = Array.isArray(commits) ? commits : [];
    const hasMore = list.length > limit;
    const visible = hasMore ? list.slice(0, limit) : list;
    return {
      commits: visible,
      history: {
        limit,
        loaded: visible.length,
        hasMore,
        pageSize: DEFAULT_HISTORY_LIMIT,
        maxLimit: MAX_HISTORY_LIMIT,
      },
    };
  }
  function logArgs(ref, limit = DEFAULT_HISTORY_LIMIT) {
    const selectedRef = String(ref || "").trim();
    const historyLimit = normalizeHistoryLimit(limit);
    const args = [
      "log",
      "--graph",
      "--topo-order",
      `--max-count=${historyLimit + 1}`,
      "--date=relative",
      `--pretty=format:%x00${REF_COMMIT_LOG_FORMAT}`,
    ];
    if (selectedRef) {
      args.push("--first-parent", selectedRef);
    } else {
      args.push("--branches", "--remotes");
    }
    return args;
  }

  return {
    setCurrentRepo,
    historyPage,
    logArgs,
    normalizeHistoryLimit,
    readRefState,
    readReflogState,
    readOpenState,
    readState,
    readSyncState,
    refNamesFromText,
    sampleBranchCommits,
    sampleState,
  };
}

module.exports = { createRepositoryStateService };
