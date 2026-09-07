"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { spawn } = require("node:child_process");
const { compareVersions, normalizeVersion, requestJsonUrl } = require("../app-update");

const RELEASE_API = "https://api.github.com/repos/AsphyxiaChoke/Forkline/releases/latest";
const MARKER = "forkline-portable.json";

function desktopDistribution(options) {
  if (!options.packaged || options.platform !== "win32") return "source";
  const root = path.dirname(options.executable);
  const exists = options.exists || fs.existsSync;
  if (exists(path.join(root, "resources", MARKER))) return "portable";
  return exists(path.join(root, "Uninstall Forkline.exe")) ? "nsis" : "unpacked";
}

function portableAsset(release, currentVersion) {
  const version = normalizeVersion(release?.tag_name);
  if (!/^\d+\.\d+\.\d+$/.test(version) || release.draft || release.prerelease) throw new Error("没有可用的正式便携版更新。");
  if (compareVersions(version, currentVersion) <= 0) return { version };
  const name = `Forkline-v${version}-windows-x64-portable.zip`;
  const asset = release.assets?.find((item) => item.name === name && item.state === "uploaded");
  const url = `https://github.com/AsphyxiaChoke/Forkline/releases/download/${release.tag_name}/${name}`;
  if (!asset || asset.browser_download_url !== url || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || "") || !Number.isSafeInteger(asset.size) || asset.size <= 0) {
    throw new Error("新版本的 Electron 便携 ZIP 尚未发布完整，请稍后重试。");
  }
  return { version, name, url, size: asset.size, sha256: asset.digest.slice(7).toLowerCase() };
}

async function downloadPortableZip(asset, destination, options = {}) {
  const fetchUrl = options.fetch || fetch;
  const response = await fetchUrl(asset.url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`便携版下载失败：HTTP ${response.status}`);
  const hash = crypto.createHash("sha256");
  let size = 0;
  const verify = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > asset.size) { callback(new Error("便携 ZIP 大小与官方元数据不符。")); return; }
      hash.update(chunk);
      options.progress?.({ percent: size / asset.size * 100 });
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), verify, fs.createWriteStream(destination, { flags: "wx" }));
  if (size !== asset.size || hash.digest("hex") !== asset.sha256) throw new Error("便携 ZIP 的 SHA-256 校验失败，已取消更新。");
}

function runHelper(script, planFile, mode) {
  return spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-PlanPath", planFile, "-Mode", mode], {
    cwd: path.dirname(planFile), windowsHide: true, detached: mode === "Apply", stdio: mode === "Apply" ? "ignore" : ["ignore", "ignore", "pipe"],
  });
}

function waitForHelper(child, readyFile) {
  return new Promise((resolve, reject) => {
    let errorText = "";
    const deadline = Date.now() + 30_000;
    const poll = setInterval(() => {
      if (fs.existsSync(readyFile)) finish();
      else if (Date.now() > deadline) finish(new Error("便携版更新助手启动超时。"));
    }, 100);
    const failed = (error) => finish(error);
    const exited = (code) => finish(new Error(errorText || `便携版更新助手退出：${code}`));
    child.stderr?.on("data", (chunk) => { errorText = (errorText + chunk).slice(-4000); });
    child.once("error", failed);
    child.once("exit", exited);
    function finish(error) {
      clearInterval(poll);
      child.removeListener("error", failed);
      child.removeListener("exit", exited);
      if (error) reject(error);
      else { child.stderr?.destroy(); child.unref(); resolve(); }
    }
  });
}

class ForklinePortableUpdater extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.asset = null;
    this.planDirectory = "";
  }

  async checkForUpdates() {
    const release = await (this.options.requestRelease || requestJsonUrl)(RELEASE_API);
    this.asset = portableAsset(release, this.options.currentVersion);
    return { updateInfo: { version: this.asset.version } };
  }

  async downloadUpdate() {
    if (!this.asset?.url) throw new Error("请先检查 Electron 便携版更新。");
    this.cancelInstall();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-portable-update-"));
    this.planDirectory = directory;
    const archive = path.join(directory, "update.zip");
    const progress = (value) => this.emit("download-progress", value);
    try {
      await downloadPortableZip(this.asset, archive, { fetch: this.options.fetch, progress });
    } catch {
      fs.rmSync(archive, { force: true });
      await downloadPortableZip({ ...this.asset, url: `https://ghfast.top/${this.asset.url}` }, archive, { fetch: this.options.fetch, progress });
    }
    const script = path.join(directory, "apply-portable-update.ps1");
    fs.copyFileSync(path.join(__dirname, "apply-portable-update.ps1"), script);
    const planFile = path.join(directory, "plan.json");
    const plan = {
      installDirectory: this.options.installDirectory,
      parentPid: process.pid,
      version: this.asset.version,
      sha256: this.asset.sha256,
      healthFile: path.join(directory, `forkline-electron-update-${crypto.randomUUID()}.json`),
    };
    fs.writeFileSync(planFile, JSON.stringify(plan), "utf8");
    const preparing = runHelper(script, planFile, "Prepare");
    await new Promise((resolve, reject) => {
      let errorText = "";
      preparing.stderr.on("data", (chunk) => { errorText = (errorText + chunk).slice(-4000); });
      preparing.once("error", reject);
      preparing.once("exit", (code) => code === 0 ? resolve() : reject(new Error(errorText || "便携 ZIP 解压校验失败。")));
    });
    const helper = runHelper(script, planFile, "Apply");
    await waitForHelper(helper, path.join(directory, "helper-ready"));
    this.emit("update-downloaded");
    return [archive];
  }

  quitAndInstall() {
    if (!this.planDirectory) throw new Error("便携版更新尚未准备完成。");
    fs.writeFileSync(path.join(this.planDirectory, "apply"), "ready", "utf8");
    this.options.quit();
  }

  cancelInstall() {
    if (this.planDirectory) {
      fs.writeFileSync(path.join(this.planDirectory, "cancel"), "cancel", "utf8");
      this.planDirectory = "";
    }
  }
}

module.exports = { MARKER, ForklinePortableUpdater, desktopDistribution, downloadPortableZip, portableAsset };
