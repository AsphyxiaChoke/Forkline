"use strict";



const fs = require("fs");

const os = require("os");

const path = require("path");

const { execFile, spawn } = require("child_process");



function createRepositoryAuthService(options) {

  const {

    git,

    gitStandalone,

    getCurrentRepo,

    readRemoteDetails,

    readRemoteNames,

    splitRemoteBranchRef,

    parseSimpleLines,

    extractRemoteHost,

    formatLocalTime,

    authDiagnosticsCacheTtlMs: AUTH_DIAGNOSTICS_CACHE_TTL_MS,

    authDiagnosticsCacheLimit: AUTH_DIAGNOSTICS_CACHE_LIMIT,

    authDiagnosticsCache,

    registerOwnedProcess = (child) => child,

    platform = process.platform,

    launchSystemCredentialManager = launchWindowsCredentialManager,

  } = options;

  let currentRepo = getCurrentRepo();



  function setCurrentRepo(repoPath) {

    currentRepo = repoPath || null;

  }



  async function readCachedAuthDiagnostics(repoPath = currentRepo, options = {}) {
    const remotes = await readRemoteDetails(repoPath);
    const cacheKey = authDiagnosticsCacheKey(repoPath, remotes);
    const now = Date.now();
    const cached = authDiagnosticsCache.get(cacheKey);
    if (!options.refresh && cached && cached.expiresAt > now) {
      return authDiagnosticsCacheResult(cached, true);
    }

    const diagnostics = await readAuthDiagnostics(remotes).catch((error) => authDiagnosticsFailure(error, remotes));
    const entry = {
      data: { ...diagnostics, checkedAt: new Date(now).toISOString() },
      expiresAt: now + AUTH_DIAGNOSTICS_CACHE_TTL_MS,
    };
    authDiagnosticsCache.set(cacheKey, entry);
    while (authDiagnosticsCache.size > AUTH_DIAGNOSTICS_CACHE_LIMIT) {
      authDiagnosticsCache.delete(authDiagnosticsCache.keys().next().value);
    }
    return authDiagnosticsCacheResult(entry, false);
  }

  function authDiagnosticsCacheKey(repoPath, remotes) {
    const repoKey = path.resolve(String(repoPath || "")).replace(/[\\/]+/g, "\\").toLowerCase();
    const remoteKey = remotes
      .map((remote) => [remote.name, remote.fetchUrl, remote.pushUrl, ...(remote.pushUrls || [])].map((value) => String(value || "")).join("\u0000"))
      .sort()
      .join("\u0001");
    return `${repoKey}\u0002${remoteKey}`;
  }

  function authDiagnosticsCacheResult(entry, cached) {
    return {
      ...entry.data,
      cached,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
    };
  }

  function authDiagnosticsFailure(error, remotes) {
    return {
      summary: "认证助手读取失败",
      level: "warn",
      advice: `无法读取本机认证信息：${String(error?.message || error || "未知错误")}`,
      remotes: remotes.map((remote) => remoteAuthSummary(remote)),
      ssh: { directory: "~/.ssh", exists: false, keys: [], configExists: false, knownHostsExists: false },
      agent: { available: false, loaded: false, keyCount: 0, message: "未检测" },
      credentialManager: { available: false, name: "Git Credential Manager", version: "", message: "未检测" },
      systemCredentialManager: systemCredentialManagerStatus(),
      commands: ["git remote -v"],
    };
  }

  async function readAuthDiagnostics(remotes = []) {
    const [ssh, agent, credentialManager] = await Promise.all([
      readSshKeyInventory(),
      readSshAgentStatus(),
      readCredentialManagerStatus(),
    ]);
    const remoteSummaries = remotes.map((remote) => remoteAuthSummary(remote));
    const hasSshRemote = remoteSummaries.some((remote) => remote.kind === "ssh");
    const hasHttpsRemote = remoteSummaries.some((remote) => remote.kind === "https");
    const commands = buildAuthDiagnosticCommands(remoteSummaries);
    const adviceParts = [];
    let level = "ok";

    if (!remoteSummaries.length) {
      level = "info";
      adviceParts.push("当前仓库还没有远端，添加远端后再检查认证状态。");
    }
    if (hasSshRemote) {
      if (!ssh.exists || !ssh.keys.length) {
        level = "warn";
        adviceParts.push("远端使用 SSH，但没有在 ~/.ssh 里发现常见 key 文件。需要先创建 SSH key 并添加到 Git 平台。");
      } else if (!agent.loaded) {
        level = level === "warn" ? "warn" : "info";
        adviceParts.push("远端使用 SSH，已发现 key 文件；ssh-agent 没有报告已加载 key，推送失败时请执行 ssh-add。");
      } else {
        adviceParts.push(`SSH key 和 ssh-agent 都可见，agent 当前报告 ${agent.keyCount} 个 key。`);
      }
    }
    if (hasHttpsRemote) {
      if (!credentialManager.available) {
        level = level === "warn" ? "warn" : "info";
        adviceParts.push("远端使用 HTTPS，但没有检测到 Git Credential Manager。推送时可能需要手动输入 Token。");
      } else {
        adviceParts.push(`HTTPS 凭据管理器可用：${credentialManager.version || credentialManager.name}。`);
      }
    }
    if (!adviceParts.length) {
      adviceParts.push("当前远端认证配置没有明显风险；如果抓取或推送失败，请先点远端行的“诊断”。");
    }

    return {
      summary: authSummaryText(remoteSummaries, ssh, agent, credentialManager),
      level,
      advice: adviceParts.join(" "),
      remotes: remoteSummaries,
      ssh,
      agent,
      credentialManager,
      systemCredentialManager: systemCredentialManagerStatus(),
      commands,
    };
  }

  function remoteAuthSummary(remote = {}) {
    const url = remote.pushUrl || remote.fetchUrl || "";
    const kind = remoteAuthKind(url);
    const host = extractRemoteHost(url);
    const webBase = remoteWebBase(url);
    const remotePlatform = webBase ? remoteWebPlatform(webBase) : kind === "local" ? "local" : "generic";
    return {
      name: remote.name || "",
      url,
      kind,
      kindLabel: remoteAuthKindLabel(kind),
      host,
      platform: remotePlatform,
      platformLabel: remoteAuthPlatformLabel(remotePlatform),
      statusUrl: remotePlatformStatusUrl(host),
    };
  }

  function remoteAuthKind(url) {
    const text = String(url || "").trim();
    if (!text) return "missing";
    if (/^https?:\/\//i.test(text)) return "https";
    if (/^ssh:\/\//i.test(text) || /^[^@\s]+@[^:\s]+:.+/.test(text)) return "ssh";
    return "local";
  }

  function remoteAuthKindLabel(kind) {
    if (kind === "ssh") return "SSH";
    if (kind === "https") return "HTTPS";
    if (kind === "local") return "本地路径";
    return "未设置";
  }

  async function readSshKeyInventory() {
    const dir = path.join(os.homedir(), ".ssh");
    const result = {
      directory: "~/.ssh",
      exists: false,
      keys: [],
      configExists: false,
      knownHostsExists: false,
      message: "",
    };
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
      result.exists = true;
    } catch (error) {
      result.message = "没有找到 ~/.ssh 目录，或当前进程没有权限读取。";
      return result;
    }

    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    result.configExists = files.includes("config");
    result.knownHostsExists = files.some((file) => file === "known_hosts" || file.startsWith("known_hosts."));
    const candidates = new Map();
    const ensure = (base) => {
      if (!candidates.has(base)) candidates.set(base, { name: base, publicKey: false, privateKey: false, publicFile: "", privateFile: "", updated: "" });
      return candidates.get(base);
    };

    for (const file of files) {
      if (file.endsWith(".pub") && !file.startsWith("known_hosts")) {
        const base = file.slice(0, -4);
        const item = ensure(base);
        item.publicKey = true;
        item.publicFile = file;
        item.updated = await sshFileUpdated(dir, file);
        continue;
      }
      if (/^id_[A-Za-z0-9_-]+$/.test(file) || ["identity"].includes(file)) {
        const item = ensure(file);
        item.privateKey = true;
        item.privateFile = file;
        item.updated = await sshFileUpdated(dir, file);
      }
    }

    result.keys = [...candidates.values()]
      .sort((left, right) => Number(right.privateKey) - Number(left.privateKey) || left.name.localeCompare(right.name))
      .slice(0, 12);
    result.message = result.keys.length ? `发现 ${result.keys.length} 组 SSH key 文件` : "没有发现常见 SSH key 文件";
    return result;
  }

  async function sshFileUpdated(dir, file) {
    try {
      const stat = await fs.promises.stat(path.join(dir, file));
      return formatLocalTime(stat.mtime);
    } catch {
      return "";
    }
  }

  async function readSshAgentStatus() {
    const probe = await runProbe("ssh-add", ["-l"], { timeout: 5000 });
    const text = `${probe.stdout || ""}\n${probe.stderr || ""}`.trim();
    if (!probe.ok) {
      const lower = text.toLowerCase();
      if (lower.includes("no identities")) {
        return { available: true, loaded: false, keyCount: 0, message: "ssh-agent 可用，但没有加载 key。", output: text };
      }
      return { available: false, loaded: false, keyCount: 0, message: text || "无法调用 ssh-add -l，可能没有安装 OpenSSH 或 ssh-agent 未启动。", output: text };
    }
    const keyCount = text ? text.split(/\r?\n/).filter(Boolean).length : 0;
    return {
      available: true,
      loaded: keyCount > 0,
      keyCount,
      message: keyCount ? `ssh-agent 已加载 ${keyCount} 个 key。` : "ssh-agent 可用，但没有返回 key。",
      output: text,
    };
  }

  async function readCredentialManagerStatus() {
    const probes = [
      { args: ["credential-manager", "version"], name: "Git Credential Manager" },
      { args: ["credential-manager-core", "--version"], name: "Git Credential Manager Core" },
    ];
    for (const probe of probes) {
      try {
        const output = await gitStandalone(probe.args, { timeout: 5000, maxBuffer: 1024 * 256 });
        const version = String(output || "").trim().split(/\r?\n/).filter(Boolean)[0] || probe.name;
        return { available: true, name: probe.name, version, message: `${probe.name} 可用。` };
      } catch {
        // Try the next credential manager command.
      }
    }
    return { available: false, name: "Git Credential Manager", version: "", message: "没有检测到 Git Credential Manager 命令。" };
  }

  function systemCredentialManagerStatus() {
    if (platform === "win32") {
      return {
        available: true,
        canOpen: true,
        name: "Windows 凭据管理器",
        message: "可打开 Windows 凭据管理器查看或更新 Git HTTPS 登录信息。",
      };
    }
    return {
      available: false,
      canOpen: false,
      name: "系统凭据管理器",
      message: "当前系统暂不支持从 Forkline 打开系统凭据管理器。",
    };
  }

  async function openSystemCredentialManager() {
    if (platform !== "win32") throw new Error("当前系统暂不支持从 Forkline 打开系统凭据管理器。");
    try {
      await launchSystemCredentialManager();
    } catch (error) {
      throw new Error(`无法打开 Windows 凭据管理器：${String(error?.message || error || "未知错误")}`);
    }
    return {
      ok: true,
      output: "已打开 Windows 凭据管理器。Forkline 不会自动读取、修改或删除其中的凭据。",
    };
  }

  function runProbe(file, args = [], options = {}) {
    return new Promise((resolve) => {
      const child = execFile(
        file,
        args,
        {
          windowsHide: true,
          timeout: options.timeout || 5000,
          maxBuffer: options.maxBuffer || 1024 * 256,
          encoding: "utf8",
        },
        (error, stdout, stderr) => {
          resolve({ ok: !error, stdout: stdout || "", stderr: stderr || "", message: error?.message || "" });
        }
      );
      registerOwnedProcess(child);
    });
  }

  function buildAuthDiagnosticCommands(remotes) {
    const commands = ["git remote -v"];
    const sshHosts = [...new Set(remotes.filter((remote) => remote.kind === "ssh" && remote.host).map((remote) => remote.host))];
    const httpsRemotes = remotes.filter((remote) => remote.kind === "https");
    if (sshHosts.length) {
      commands.push("ssh-add -l");
      sshHosts.slice(0, 3).forEach((host) => commands.push(`ssh -T git@${host}`));
    }
    if (httpsRemotes.length) {
      commands.push("git credential-manager version");
      commands.push("git credential-manager diagnose");
    }
    return [...new Set(commands)].slice(0, 8);
  }

  function authSummaryText(remotes, ssh, agent, credentialManager) {
    const sshCount = remotes.filter((remote) => remote.kind === "ssh").length;
    const httpsCount = remotes.filter((remote) => remote.kind === "https").length;
    const localCount = remotes.filter((remote) => remote.kind === "local").length;
    const parts = [];
    if (sshCount) parts.push(`${sshCount} 个 SSH 远端`);
    if (httpsCount) parts.push(`${httpsCount} 个 HTTPS 远端`);
    if (localCount) parts.push(`${localCount} 个本地远端`);
    const remoteText = parts.length ? parts.join("，") : "没有远端";
    const sshText = ssh.exists ? `${ssh.keys.length} 组 SSH key` : "未发现 ~/.ssh";
    const agentText = agent.loaded ? `agent ${agent.keyCount} 个 key` : "agent 未加载 key";
    const gcmText = credentialManager.available ? "GCM 可用" : "GCM 未检测到";
    return `${remoteText}；${sshText}；${agentText}；${gcmText}`;
  }

  async function readPullRequestLink(syncState = {}, remotes = [], repoPath = currentRepo, options = {}) {
    const branch = String(syncState.branch || "").trim();
    if (!branch || branch === "HEAD" || branch === "detached HEAD" || syncState.detached) {
      return { available: false, reason: "当前处于游离 HEAD，请先切换或创建本地分支。", url: "" };
    }
    const remote = preferredWebRemote(remotes);
    if (!remote?.webBase) {
      return { available: false, reason: "当前仓库没有可识别的 GitHub / GitLab / Bitbucket / Gitea 网页远端。", url: "" };
    }
    const targetBranch = await inferPullRequestTarget(branch, syncState, repoPath, options);
    if (!targetBranch) {
      return { available: false, reason: "没有找到可作为目标的主分支。", url: "" };
    }
    if (targetBranch === branch) {
      return { available: false, reason: "当前分支已经是目标分支，不需要创建 PR。", url: "" };
    }
    const platform = remoteWebPlatform(remote.webBase);
    const url = buildPullRequestUrl(remote.webBase, platform, branch, targetBranch);
    return {
      available: Boolean(url),
      url,
      source: branch,
      target: targetBranch,
      remote: remote.name,
      remoteUrl: remote.url,
      platform,
      platformLabel: remotePlatformLabel(platform),
      title: platform === "gitlab" ? "创建 Merge Request" : "创建 Pull Request",
      reason: url ? "" : "当前远端平台暂不支持自动生成 PR 链接。",
    };
  }

  function preferredWebRemote(remotes = []) {
    const ordered = [
      ...remotes.filter((remote) => remote.name === "origin"),
      ...remotes.filter((remote) => remote.name !== "origin"),
    ];
    for (const remote of ordered) {
      const url = remote.pushUrl || remote.fetchUrl || "";
      const webBase = remoteWebBase(url) || remoteWebBase(remote.fetchUrl);
      if (webBase) return { ...remote, url, webBase };
    }
    return null;
  }

  async function inferPullRequestTarget(branch, syncState = {}, repoPath = currentRepo, options = {}) {
    const localBranches = Array.isArray(options.localBranches)
      ? options.localBranches
      : parseSimpleLines(await git(repoPath, ["branch", "--format=%(refname:short)"]).catch(() => ""));
    const remoteNames = Array.isArray(options.remoteNames) ? options.remoteNames : await readRemoteNames(repoPath);
    const upstreamBranch = syncState.upstream ? splitRemoteBranchRef(syncState.upstream, remoteNames).branch : "";
    if (upstreamBranch && upstreamBranch !== branch) return upstreamBranch;
    const preferred = ["main", "master", "develop", "development", "dev", "trunk"];
    const preferredMatch = preferred.find((name) => localBranches.includes(name) && name !== branch);
    if (preferredMatch) return preferredMatch;
    return localBranches.find((name) => name && name !== branch) || "";
  }

  function buildPullRequestUrl(webBase, platform, sourceBranch, targetBranch) {
    const base = String(webBase || "").replace(/\/+$/, "");
    if (!base || !sourceBranch || !targetBranch) return "";
    const source = encodeURIComponent(sourceBranch);
    const target = encodeURIComponent(targetBranch);
    if (platform === "gitlab") {
      return `${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${source}&merge_request%5Btarget_branch%5D=${target}`;
    }
    if (platform === "bitbucket") {
      return `${base}/pull-requests/new?source=${source}&dest=${target}`;
    }
    if (platform === "github") {
      return `${base}/compare/${target}...${source}?expand=1`;
    }
    return `${base}/compare/${target}...${source}`;
  }

  function remoteWebBase(remoteUrl) {
    const value = String(remoteUrl || "").trim();
    if (!value) return "";
    const scpLike = value.match(/^git@([^:]+):(.+)$/);
    if (scpLike) return cleanRemoteWebPath(`https://${scpLike[1]}/${scpLike[2]}`);
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.username = "";
        url.password = "";
        return cleanRemoteWebPath(url.toString());
      }
      if (url.protocol === "ssh:" && url.hostname && url.pathname) {
        return cleanRemoteWebPath(`https://${url.hostname}${url.pathname}`);
      }
    } catch {
    }
    return "";
  }

  function cleanRemoteWebPath(value) {
    return String(value || "")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");
  }

  function remoteWebPlatform(webBase) {
    try {
      const url = new URL(webBase);
      const host = url.hostname.toLowerCase();
      if (host === "github.com" || host.endsWith(".github.com")) return "github";
      if (host === "gitlab.com" || host.includes("gitlab")) return "gitlab";
      if (host === "bitbucket.org" || host.endsWith(".bitbucket.org")) return "bitbucket";
      if (host.includes("gitea") || host.includes("forgejo")) return "gitea";
    } catch {
    }
    return "generic";
  }

  function remotePlatformLabel(platform) {
    if (platform === "github") return "GitHub";
    if (platform === "gitlab") return "GitLab";
    if (platform === "bitbucket") return "Bitbucket";
    if (platform === "gitea") return "Gitea / Forgejo";
    return "Web";
  }

  function remoteAuthPlatformLabel(platform) {
    if (platform === "local") return "本地 Git";
    if (platform === "generic") return "自建 Git 服务";
    return remotePlatformLabel(platform);
  }

  function remotePlatformStatusUrl(host) {
    const normalized = String(host || "").trim().toLowerCase();
    if (normalized === "github.com") return "https://www.githubstatus.com/";
    if (normalized === "gitlab.com") return "https://status.gitlab.com/";
    if (normalized === "bitbucket.org") return "https://bitbucket.status.atlassian.com/";
    return "";
  }



  return {

    setCurrentRepo,

    buildPullRequestUrl,

    openSystemCredentialManager,

    readCachedAuthDiagnostics,

    readPullRequestLink,

    remoteAuthSummary,

    remoteWebBase,

    systemCredentialManagerStatus,

  };

}

function launchWindowsCredentialManager() {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn("control.exe", ["/name", "Microsoft.CredentialManager"], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}



module.exports = { createRepositoryAuthService };
