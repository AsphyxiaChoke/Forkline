"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const syncSource = fs.readFileSync(path.join(root, "public", "js", "panels", "sync.js"), "utf8");
const eventSource = fs.readFileSync(path.join(root, "public", "js", "app", "events.js"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

function createContext() {
  const calls = { api: [], toast: [] };
  const context = vm.createContext({
    state: {},
    t: (message, values = {}) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), String(message)),
    tt: (strings, ...values) => strings.reduce((text, part, index) => text + part + (index < values.length ? values[index] : ""), ""),
    escapeHtml: (value) => String(value ?? ""),
    escapeAttr: (value) => String(value ?? ""),
    repoPathSnapshot: () => "C:\\repo",
    isCurrentRepoPath: (repoPath) => repoPath === "C:\\repo",
    api: async (requestPath, options) => {
      calls.api.push({ path: requestPath, options });
      return { ok: true, output: "已打开 Windows 凭据管理器。Forkline 不会自动读取、修改或删除其中的凭据。" };
    },
    toast: (message) => calls.toast.push(message),
  });
  vm.runInContext(syncSource, context);
  return { calls, context };
}

test("authentication card exposes system credentials and remote connection tools", async () => {
  const { calls, context } = createContext();
  const model = {
    level: "ok",
    summary: "认证环境正常",
    advice: "没有明显风险",
    remotes: [{
      name: "origin",
      url: "https://github.com/example/forkline.git",
      kind: "https",
      kindLabel: "HTTPS",
      host: "github.com",
      platformLabel: "GitHub",
      statusUrl: "https://www.githubstatus.com/",
    }],
    ssh: { exists: true, keys: [], message: "已读取 ~/.ssh", configExists: true, knownHostsExists: true },
    agent: { message: "ssh-agent 可用" },
    credentialManager: { message: "Git Credential Manager 可用" },
    systemCredentialManager: {
      canOpen: true,
      name: "Windows 凭据管理器",
      message: "可打开 Windows 凭据管理器查看或更新 Git HTTPS 登录信息。",
    },
    commands: ["git remote -v"],
  };

  const html = context.syncAuthHtml({ data: model, loading: false, error: "", inline: false }, model.remotes);
  assert.match(html, /data-auth-action="openCredentials"/);
  assert.doesNotMatch(html, /data-auth-action="openCredentials"[^>]*disabled/);
  assert.match(html, /data-remote-action="test"/);
  assert.match(html, /https:\/\/www\.githubstatus\.com\//);
  assert.match(styles, /\.auth-remote-entry\s*{/);

  await context.openSystemCredentialManagerFromSync();
  assert.equal(calls.api.length, 1);
  assert.equal(calls.api[0].path, "/api/system-credentials/open");
  assert.equal(calls.api[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls.api[0].options.body), {});
  assert.equal(calls.toast.length, 1);
});

test("system credential route and click handler stay explicit", () => {
  assert.match(serverSource, /parsed\.pathname === "\/api\/system-credentials\/open"/);
  assert.match(eventSource, /data-auth-action[\s\S]*?openCredentials[\s\S]*?openSystemCredentialManagerFromSync/);
});
