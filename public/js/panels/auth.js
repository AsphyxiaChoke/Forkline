// Remote authentication diagnostics and system credential entry.
function remoteListHtml(remotes) {
  if (!remotes.length) {
    return `<div class="empty-panel compact"><span>${t("还没有配置远端。添加远端后，就可以抓取、拉取和推送。")}</span></div>`;
  }
  return `
    <div class="remote-list">
      ${remotes.map((remote) => remoteRowHtml(remote)).join("")}
    </div>
  `;
}

function remoteRowHtml(remote) {
  const fetchUrl = remote.fetchUrl || t("未设置");
  const pushUrl = remote.pushUrl || remote.fetchUrl || t("未设置");
  return tt`
    <div class="remote-row" data-remote-name="${escapeAttr(remote.name)}">
      <div class="remote-main">
        <strong class="remote-name" title="${escapeAttr(remote.name)}">${escapeHtml(remote.name)}</strong>
        <span class="remote-url" title="${escapeAttr(fetchUrl)}"><em>fetch</em><span>${escapeHtml(fetchUrl)}</span></span>
        <span class="remote-url" title="${escapeAttr(pushUrl)}"><em>push</em><span>${escapeHtml(pushUrl)}</span></span>
      </div>
      <div class="remote-actions">
        <button class="mini-btn" data-remote-action="test" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>诊断</span><span class="command-hint">ls-remote</span></button>
        <button class="mini-btn" data-remote-action="fetch" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>抓取</span><span class="command-hint">git fetch</span></button>
        <button class="mini-btn" data-remote-action="edit" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>修改 URL</span><span class="command-hint">set-url</span></button>
        <button class="mini-btn danger" data-remote-action="delete" data-remote-name="${escapeAttr(remote.name)}" type="button"><span>删除</span><span class="command-hint">remove</span></button>
      </div>
    </div>
  `;
}

function remoteCheckHtml(remotes) {
  const check = state.remoteCheck;
  if (!check?.remote) return "";
  const remote = remotes.find((item) => item.name === check.remote);
  if (!remote) return "";
  const ok = check.status === "success";
  const fetchUrl = check.fetchUrl || remote.fetchUrl || t("未设置");
  const pushUrl = check.pushUrl || remote.pushUrl || remote.fetchUrl || t("未设置");
  const command = check.command || `git ls-remote --heads ${check.remote}`;
  const output = String(check.output || "").trim();
  const checkedAt = check.checkedAt || "";
  const diagnosis = remoteCheckDiagnosis(check, remote, ok);
  return tt`
    <section class="remote-check-card ${ok ? "success" : "error"}">
      <div class="remote-check-head">
        <div>
          <strong>${t(ok ? "远端连接正常" : "远端诊断失败")}</strong>
          <span>${escapeHtml(check.remote)}${checkedAt ? ` · ${escapeHtml(checkedAt)}` : ""}</span>
        </div>
        <span class="remote-check-status">${t(ok ? "通过" : "失败")}</span>
      </div>
      <div class="meta-grid sync-meta remote-check-meta">
        <span>fetch URL</span><div class="meta-value" title="${escapeAttr(fetchUrl)}">${escapeHtml(fetchUrl)}</div>
        <span>push URL</span><div class="meta-value" title="${escapeAttr(pushUrl)}">${escapeHtml(pushUrl)}</div>
        <span>检查命令</span><div class="meta-value">${escapeHtml(command)}</div>
        ${ok ? `<span>${t("可读分支")}</span><div class="meta-value">${t("{count} 个", { count: escapeHtml(String(check.heads ?? t("未知"))) })}</div>` : `<span>${t("判断结果")}</span><div class="meta-value">${escapeHtml(t(diagnosis.summary))}</div>`}
      </div>
      ${remoteDiagnosisHtml(diagnosis)}
      ${output ? `<pre>${escapeHtml(output)}</pre>` : ""}
    </section>
  `;
}

function prepareSyncAuthState(inlineAuth, remotes = []) {
  if (inlineAuth) {
    return { repoPath: repoPathSnapshot(), remoteKey: syncAuthRemoteKey(remotes), data: inlineAuth, loading: false, error: "", inline: true };
  }
  const repoPath = repoPathSnapshot();
  const remoteKey = syncAuthRemoteKey(remotes);
  const current = state.authDiagnostics || {};
  if (current.repoPath !== repoPath || current.remoteKey !== remoteKey) {
    state.authDiagnosticsRequestId += 1;
    state.authDiagnostics = { repoPath, remoteKey, data: null, loading: false, error: "", inline: false };
  }
  if (repoPath && !state.data?.repo?.isSample && !state.authDiagnostics.data && !state.authDiagnostics.loading && !state.authDiagnostics.error) {
    loadAuthDiagnostics();
  }
  return state.authDiagnostics;
}

function syncAuthRemoteKey(remotes = []) {
  return remotes
    .map((remote) => [remote.name, remote.fetchUrl, remote.pushUrl, ...(remote.pushUrls || [])].map((value) => String(value || "")).join("\u0000"))
    .sort()
    .join("\u0001");
}

async function loadAuthDiagnostics(refresh = false) {
  const repoPath = repoPathSnapshot();
  if (!repoPath || state.data?.repo?.isSample) return;
  const remoteKey = syncAuthRemoteKey(state.data?.sync?.remotes || []);
  const requestId = ++state.authDiagnosticsRequestId;
  state.authDiagnostics = { repoPath, remoteKey, data: null, loading: true, error: "", inline: false };
  if (refresh && state.selectedTab === "sync") renderInspector();
  try {
    const data = await api(`/api/auth-diagnostics${refresh ? "?refresh=1" : ""}`);
    if (requestId !== state.authDiagnosticsRequestId || !isCurrentRepoPath(repoPath)) return;
    if (remoteKey !== syncAuthRemoteKey(state.data?.sync?.remotes || [])) return;
    state.authDiagnostics = { repoPath, remoteKey, data, loading: false, error: "", inline: false };
  } catch (error) {
    if (requestId !== state.authDiagnosticsRequestId || !isCurrentRepoPath(repoPath)) return;
    state.authDiagnostics = { repoPath, remoteKey, data: null, loading: false, error: error.message, inline: false };
  }
  if (state.selectedTab === "sync" && isCurrentRepoPath(repoPath)) renderInspector();
}

function syncAuthHtml(authState, remotes = []) {
  if (authState?.loading) {
    return tt`
      <section class="auth-card">
        <div class="auth-card-head">
          <div><strong>认证助手</strong><span>正在检测 SSH key、ssh-agent 和 HTTPS 凭据管理器</span></div>
          <span class="auth-status">检测中</span>
        </div>
        <p class="auth-advice">认证环境只在打开同步页时检测，不再拖慢仓库历史和工作区刷新。</p>
      </section>
    `;
  }
  if (authState?.error) {
    return tt`
      <section class="auth-card auth-card-warn">
        <div class="auth-card-head">
          <div><strong>认证助手读取失败</strong><span>${escapeHtml(t(authState.error))}</span></div>
          <div class="auth-card-tools">
            <span class="auth-status">失败</span>
            <button class="mini-btn" data-auth-action="refresh" type="button">重新检测</button>
          </div>
        </div>
      </section>
    `;
  }
  const model = authState?.data;
  if (!model && !remotes.length) return "";
  if (!model) return "";
  const level = model.level || "info";
  const remoteRows = Array.isArray(model.remotes) ? model.remotes : [];
  const ssh = model.ssh || {};
  const agent = model.agent || {};
  const credential = model.credentialManager || {};
  const systemCredential = model.systemCredentialManager || {};
  const keys = Array.isArray(ssh.keys) ? ssh.keys : [];
  const commands = Array.isArray(model.commands) ? model.commands.filter(Boolean) : ["git remote -v"];
  return tt`
    <section class="auth-card auth-card-${escapeAttr(level)}">
      <div class="auth-card-head">
        <div>
          <strong>认证助手</strong>
          <span>${escapeHtml(t(model.summary || "检查 SSH key、ssh-agent 和 HTTPS 凭据管理器"))}</span>
        </div>
        <div class="auth-card-tools">
          <span class="auth-status">${escapeHtml(authLevelLabel(level))}</span>
          ${authState.inline ? "" : `<button class="mini-btn" data-auth-action="refresh" type="button">${t("重新检测")}</button>`}
        </div>
      </div>
      ${model.advice ? `<p class="auth-advice">${escapeHtml(t(model.advice))}</p>` : ""}
      <div class="auth-remote-list">
        ${
          remoteRows.length
            ? remoteRows.map((remote) => authRemotePillHtml(remote)).join("")
            : `<span class="auth-pill muted">${t("没有远端")}</span>`
        }
      </div>
      <div class="auth-grid">
        <div class="auth-box">
          <strong>SSH key</strong>
          <span>${escapeHtml(t(ssh.message || (ssh.exists ? "已读取 ~/.ssh" : "没有读取到 ~/.ssh")))}</span>
          <div class="auth-key-list">
            ${
              keys.length
                ? keys.map((key) => authKeyHtml(key)).join("")
                : `<em>${t("未发现常见 key 文件")}</em>`
            }
          </div>
        </div>
        <div class="auth-box">
          <strong>认证工具</strong>
          <span>${escapeHtml(t(agent.message || "ssh-agent 未检测"))}</span>
          <span>${escapeHtml(t(credential.message || "Git Credential Manager 未检测"))}</span>
          <span>${escapeHtml(t(systemCredential.message || "系统凭据管理器未检测"))}</span>
          <span>${escapeHtml(t(ssh.configExists ? "存在 SSH config" : "未发现 SSH config"))} · ${escapeHtml(t(ssh.knownHostsExists ? "存在 known_hosts" : "未发现 known_hosts"))}</span>
          <div class="auth-box-actions">
            <button class="mini-btn" data-auth-action="openCredentials" type="button" ${systemCredential.canOpen ? "" : "disabled"} title="${escapeAttr(t(systemCredential.canOpen ? "在系统凭据管理器中查看或更新 Git HTTPS 登录信息" : systemCredential.message || "当前系统暂不支持打开系统凭据管理器"))}">
              <span>打开系统凭据</span><span class="command-hint">${escapeHtml(t(systemCredential.name || "System"))}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="remote-diagnosis-commands auth-commands">
        ${commands.map((cmd) => `<button class="remote-command-copy" data-copy-remote-command="${escapeAttr(cmd)}" type="button" title="${t("复制命令")}"><span>${escapeHtml(cmd)}</span><em>${t("复制")}</em></button>`).join("")}
      </div>
    </section>
  `;
}

function authLevelLabel(level) {
  if (level === "ok") return t("正常");
  if (level === "warn") return t("注意");
  return t("提示");
}

function authRemotePillHtml(remote) {
  const kind = remote.kind || "missing";
  const platform = remote.platformLabel ? t(remote.platformLabel) : "";
  const detail = [platform, remote.host].filter(Boolean).join(" · ");
  const title = [remote.name, remote.url, detail].filter(Boolean).join(" · ");
  return `
    <div class="auth-remote-entry">
      <span class="auth-pill auth-${escapeAttr(kind)}" title="${escapeAttr(title)}">
        <strong>${escapeHtml(remote.name || "remote")}</strong>
        <em>${escapeHtml(t(remote.kindLabel || kind))}</em>
        ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
      </span>
      <button class="auth-inline-action" data-remote-action="test" data-remote-name="${escapeAttr(remote.name)}" type="button" title="${escapeAttr(t("使用 git ls-remote 检查这个远端的网络和认证状态"))}">${t("检查连接")}</button>
      ${remote.statusUrl ? `<a class="auth-inline-action" href="${escapeAttr(remote.statusUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("打开托管平台状态页"))}">${t("平台状态")}</a>` : ""}
    </div>
  `;
}

async function openSystemCredentialManagerFromSync() {
  const repoPath = repoPathSnapshot();
  const response = await api("/api/system-credentials/open", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!isCurrentRepoPath(repoPath)) return;
  toast(t(response.output || "已打开系统凭据管理器"));
}

function authKeyHtml(key) {
  const status = t(key.privateKey && key.publicKey ? "完整" : key.privateKey ? "缺 .pub" : "仅公钥");
  const file = key.privateFile || key.publicFile || key.name || "";
  return `<span class="auth-key" title="${escapeAttr([key.privateFile, key.publicFile, key.updated].filter(Boolean).join(" · "))}"><code>${escapeHtml(file)}</code><em>${escapeHtml(status)}</em></span>`;
}

function remoteDiagnosisHtml(diagnosis) {
  const steps = Array.isArray(diagnosis.steps) ? diagnosis.steps.filter(Boolean) : [];
  const commands = Array.isArray(diagnosis.commands) ? diagnosis.commands.filter(Boolean) : [];
  return tt`
    <div class="remote-diagnosis remote-diagnosis-${escapeAttr(diagnosis.category || "unknown")}">
      <div class="remote-diagnosis-title">
        <strong>${escapeHtml(t(diagnosis.title || "排查向导"))}</strong>
        <span>${escapeHtml(t(diagnosis.categoryLabel || remoteDiagnosisCategoryLabel(diagnosis.category)))}</span>
      </div>
      ${steps.length ? `<ol class="remote-diagnosis-steps">${steps.map((step) => `<li>${escapeHtml(t(step))}</li>`).join("")}</ol>` : ""}
      ${
        commands.length
          ? `<div class="remote-diagnosis-commands">${commands.map((cmd) => `<button class="remote-command-copy" data-copy-remote-command="${escapeAttr(cmd)}" type="button" title="${t("复制命令")}"><span>${escapeHtml(cmd)}</span><em>${t("复制")}</em></button>`).join("")}</div>`
          : ""
      }
    </div>
  `;
}

function remoteCheckDiagnosis(check, remote, ok) {
  if (check?.diagnosis) return check.diagnosis;
  const output = String(check?.output || "").toLowerCase();
  const url = `${remote?.fetchUrl || ""} ${remote?.pushUrl || ""}`.toLowerCase();
  const commands = [`git remote -v`, check?.command || `git ls-remote --heads ${check?.remote || remote?.name || "origin"}`];
  if (ok) {
    return {
      category: "ok",
      title: "远端读取正常",
      summary: t("Forkline 已能读取 {count} 个远端分支，URL 和读取权限基本正常。", { count: check?.heads ?? t("未知") }),
      steps: ["可以继续抓取、拉取或推送。", "如果推送失败，再查看同步页的保护提示和右侧日志。"],
      commands,
    };
  }
  if (output.includes("ssh") || output.includes("publickey") || url.startsWith("git@") || url.includes("ssh://")) {
    return {
      category: "ssh",
      title: "SSH 凭据或主机认证",
      summary: "当前远端像是 SSH 连接失败，常见原因是 SSH key 没添加到平台、ssh-agent 没加载 key，或远端 URL 指向了错误账号。",
      steps: ["确认远端 URL 没写错。", "在终端执行 ssh -T 对应 Git 主机，确认当前系统账号能通过平台认证。", "如果不想处理 SSH，可以把远端 URL 改成 HTTPS。"],
      commands: [...commands, "ssh-add -l"],
    };
  }
  if (output.includes("token") || output.includes("https") || output.includes("认证") || output.includes("authentication") || url.startsWith("http")) {
    return {
      category: "https",
      title: "HTTPS 凭据或 Token",
      summary: "当前远端像是 HTTPS 登录失败，常见原因是凭据管理器里的旧密码，或 Personal Access Token 过期/权限不足。",
      steps: ["确认远端 URL 是目标仓库的 HTTPS 地址。", "检查 Windows 凭据管理器或 Git Credential Manager 中保存的账号和 Token。", "重新生成 Token 后再诊断连接。"],
      commands: [...commands, "git credential-manager diagnose"],
    };
  }
  if (output.includes("dns") || output.includes("主机名") || output.includes("网络") || output.includes("连接") || output.includes("resolve") || output.includes("timeout")) {
    return {
      category: "network",
      title: "网络或 DNS",
      summary: "当前远端像是网络访问失败，常见原因是 URL 主机写错、DNS、代理、VPN 或防火墙。",
      steps: ["检查远端 URL 的主机名。", "确认当前网络、代理、VPN 或公司网络策略允许访问这个 Git 主机。", "网络恢复后重新诊断。"],
      commands: [...commands, "git config --get http.proxy"],
    };
  }
  if (output.includes("does not appear") || output.includes("no such remote") || output.includes("无法读取") || output.includes("unable to access")) {
    return {
      category: "url",
      title: "远端 URL 或仓库路径",
      summary: "远端地址不可用。可能是本地裸仓库路径不存在、URL 写错，或这个地址不是 Git 仓库。",
      steps: ["复制远端 URL 到浏览器或终端确认它真实存在。", "如果是本地路径远端，确认磁盘路径仍然存在且是 Git 仓库。", "在同步页修改 URL 后重新诊断。"],
      commands: [...commands, `git remote get-url ${check?.remote || remote?.name || "origin"}`],
    };
  }
  if (output.includes("不存在") || output.includes("not found") || output.includes("权限")) {
    return {
      category: "permission",
      title: "仓库地址或访问权限",
      summary: "远端仓库可能不存在、已改名，或当前账号没有私有仓库/组织权限。",
      steps: ["核对远端 URL 中的用户名、组织名和仓库名。", "确认当前账号拥有读取这个仓库的权限。", "如果仓库已迁移或改名，在同步页修改 URL 后重新诊断。"],
      commands: [...commands, `git remote get-url ${check?.remote || remote?.name || "origin"}`],
    };
  }
  return {
    category: "unknown",
    title: "需要继续排查",
    summary: "Forkline 没能把这次失败归到常见类型。先保留 Git 原始输出，再从 URL、网络和认证三条线排查。",
    steps: ["核对远端 URL。", "确认网络和代理可访问 Git 主机。", "确认当前系统账号或 Token 有仓库读取权限。"],
    commands,
  };
}

function remoteDiagnosisCategoryLabel(category) {
  const labels = {
    ok: "正常",
    ssh: "SSH",
    https: "HTTPS",
    permission: "权限",
    network: "网络",
    certificate: "证书",
    url: "URL",
    unknown: "未分类",
  };
  return t(labels[category] || "诊断");
}

function remoteCheckTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
