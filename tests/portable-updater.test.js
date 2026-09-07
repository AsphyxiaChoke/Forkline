"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { portableAsset, desktopDistribution, downloadPortableZip } = require("../electron/portable-updater");

const exec = promisify(execFile);
const helper = path.resolve(__dirname, "../electron/apply-portable-update.ps1");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const version = "0.4.23";
const name = `Forkline-v${version}-windows-x64-portable.zip`;
const asset = { name, state: "uploaded", browser_download_url: `https://github.com/AsphyxiaChoke/Forkline/releases/download/v${version}/${name}`, digest: `sha256:${"a".repeat(64)}`, size: 100 };
const release = (patch = {}) => ({ tag_name: `v${version}`, assets: [asset], ...patch });

test("desktop distribution never treats an unpacked or portable app as NSIS", () => {
  const options = { packaged: true, platform: "win32", executable: path.join(os.tmpdir(), "Forkline.exe") };
  assert.equal(desktopDistribution({ ...options, exists: () => false }), "unpacked");
  assert.equal(desktopDistribution({ ...options, exists: (file) => file.endsWith("Uninstall Forkline.exe") }), "nsis");
  assert.equal(desktopDistribution({ ...options, exists: (file) => file.endsWith("forkline-portable.json") }), "portable");
  assert.equal(desktopDistribution({ ...options, packaged: false }), "source");
});

test("portable updates accept only complete official stable desktop ZIP assets", () => {
  assert.equal(portableAsset(release(), "0.4.22").version, version);
  assert.deepEqual(portableAsset(release(), version), { version });
  for (const patch of [{ prerelease: true }, { draft: true }, { tag_name: "v0.4.23-test.1" }]) {
    assert.throws(() => portableAsset(release(patch), "0.4.22"));
  }
  for (const patch of [
    { name: name.replace("portable", "web") }, { name: "Forkline-Setup-0.4.23-windows-x64.exe" },
    { digest: undefined }, { size: 0 }, { state: "new" }, { browser_download_url: "https://example.com/app.zip" },
  ]) assert.throws(() => portableAsset(release({ assets: [{ ...asset, ...patch }] }), "0.4.22"));
});

test("portable download streams and rejects truncation, overflow, HTTP errors and checksum mismatch", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-download-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const content = Buffer.from("official portable bytes");
  const metadata = { url: asset.browser_download_url, size: content.length, sha256: digest(content) };
  const download = (file, body, override = {}) => downloadPortableZip({ ...metadata, ...override }, path.join(root, file), { fetch: async () => new Response(body) });
  await download("good.zip", content);
  assert.deepEqual(fs.readFileSync(path.join(root, "good.zip")), content);
  await assert.rejects(download("short.zip", content.subarray(1)), /SHA-256/);
  await assert.rejects(download("long.zip", Buffer.concat([content, content])), /大小/);
  await assert.rejects(download("hash.zip", content, { sha256: "0".repeat(64) }), /SHA-256/);
  await assert.rejects(downloadPortableZip(metadata, path.join(root, "http.zip"), { fetch: async () => new Response("missing", { status: 404 }) }), /HTTP 404/);
});

test("PowerShell portable replacement preserves data, rejects unsafe ZIPs and restores failed startups", { skip: process.platform !== "win32", timeout: 120000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forkline-portable-中文-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 30, retryDelay: 200 }));
  const compiler = path.join(root, "compile.ps1");
  const executable = path.join(root, "fixture.exe");
  fs.writeFileSync(compiler, 'param($Source,$Output)\nAdd-Type -Path $Source -OutputAssembly $Output -OutputType WindowsApplication\n');
  await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", compiler, path.join(__dirname, "fixtures/portable-update-app.cs"), executable], { windowsHide: true });
  const path7za = await require("app-builder-lib/out/toolsets/7zip").getPath7za();
  let sequence = 0;
  async function fixture(startup = version, extras = {}) {
    const directory = path.join(root, String(++sequence));
    const install = path.join(directory, "软件目录");
    const payload = path.join(directory, "source");
    for (const [target, v] of [[install, "0.4.22"], [payload, version]]) {
      fs.mkdirSync(path.join(target, "resources"), { recursive: true });
      fs.copyFileSync(executable, path.join(target, "Forkline.exe"));
      fs.writeFileSync(path.join(target, "resources/app.asar"), v);
      fs.writeFileSync(path.join(target, "resources/startup.txt"), target === payload ? startup : v);
      const files = ["Forkline.exe", "resources/app.asar", "resources/startup.txt", "resources/forkline-portable.json", ...(target === payload ? ["new.txt"] : ["retired.txt"])];
      fs.writeFileSync(path.join(target, target === payload ? "new.txt" : "retired.txt"), v);
      fs.writeFileSync(path.join(target, "resources/forkline-portable.json"), JSON.stringify({ kind: "electron-portable", version: v, files }));
    }
    fs.mkdirSync(path.join(install, "data"));
    fs.writeFileSync(path.join(install, "data/preferences.json"), "personal prefs");
    fs.writeFileSync(path.join(install, "personal.txt"), "unrelated document");
    for (const [file, content] of Object.entries(extras)) {
      fs.mkdirSync(path.dirname(path.join(payload, file)), { recursive: true });
      fs.writeFileSync(path.join(payload, file), content);
    }
    const archive = path.join(directory, "update.zip");
    await exec(path7za, ["a", "-tzip", archive, "."], { cwd: payload, windowsHide: true });
    const plan = { installDirectory: install, parentPid: 2147483647, version, sha256: digest(fs.readFileSync(archive)), healthFile: path.join(directory, "forkline-electron-update-fixture.json") };
    const planPath = path.join(directory, "plan.json");
    fs.writeFileSync(planPath, JSON.stringify(plan));
    const prepare = () => exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, "-PlanPath", planPath, "-Mode", "Prepare"], { windowsHide: true });
    const apply = async () => {
      fs.writeFileSync(path.join(directory, "apply"), "ready");
      try { await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, "-PlanPath", planPath, "-Mode", "Apply"], { windowsHide: true, timeout: 60000 }); } catch (error) {
        if (!fs.existsSync(path.join(install, "data/portable-update-result.json"))) throw error;
      }
      return JSON.parse(fs.readFileSync(path.join(install, "data/portable-update-result.json"), "utf8"));
    };
    return { directory, install, prepare, apply, plan, planPath };
  }
  await t.test("successful update removes retired product files and keeps personal files", async () => {
    const f = await fixture();
    await f.prepare();
    assert.equal((await f.apply()).state, "completed");
    assert.equal(fs.readFileSync(path.join(f.install, "resources/app.asar"), "utf8"), version);
    assert.equal(fs.readFileSync(path.join(f.install, "data/preferences.json"), "utf8"), "personal prefs");
    assert.equal(fs.readFileSync(path.join(f.install, "personal.txt"), "utf8"), "unrelated document");
    assert.equal(fs.existsSync(path.join(f.install, "retired.txt")), false);
  });
  await t.test("startup failure restores the old manifest and removed files", async () => {
    const f = await fixture("fail");
    await f.prepare();
    const result = await f.apply();
    assert.equal(result.rollbackState, "complete");
    assert.equal(fs.readFileSync(path.join(f.install, "resources/app.asar"), "utf8"), "0.4.22");
    assert.equal(fs.existsSync(path.join(f.install, "retired.txt")), true);
    assert.equal(fs.existsSync(path.join(f.install, "new.txt")), false);
    assert.equal(fs.readFileSync(path.join(f.install, "data/preferences.json"), "utf8"), "personal prefs");
  });
  await t.test("version mismatch, modified ZIP and personal-file collision never replace old files", async () => {
    for (const type of ["version", "hash", "collision", "data", "manifest"]) {
      const f = await fixture(version, type === "data" ? { "data/injected.txt": "bad" } : type === "manifest" ? { "extra.txt": "unexpected" } : {});
      if (type === "version") f.plan.version = "0.4.24";
      if (type === "hash") f.plan.sha256 = "0".repeat(64);
      if (type === "collision") fs.writeFileSync(path.join(f.install, "new.txt"), "personal file");
      fs.writeFileSync(f.planPath, JSON.stringify(f.plan));
      await assert.rejects(f.prepare(), undefined, type);
      assert.equal(fs.readFileSync(path.join(f.install, "resources/app.asar"), "utf8"), "0.4.22");
    }
  });
  await t.test("cancelled helper leaves program files unchanged", async () => {
    const f = await fixture();
    await f.prepare();
    fs.writeFileSync(path.join(f.directory, "cancel"), "cancel");
    await assert.rejects(exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", helper, "-PlanPath", f.planPath, "-Mode", "Apply"], { windowsHide: true }));
    assert.equal(fs.readFileSync(path.join(f.install, "resources/app.asar"), "utf8"), "0.4.22");
  });
  await t.test("ZIP traversal is rejected before extraction", async () => {
    const f = await fixture();
    const script = path.join(f.directory, "unsafe-zip.ps1");
    fs.writeFileSync(script, "param($Archive)\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\n$zip = [IO.Compression.ZipFile]::Open($Archive, 'Update')\ntry { [void]$zip.CreateEntry('../escaped.txt') } finally { $zip.Dispose() }\n");
    await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", script, path.join(f.directory, "update.zip")], { windowsHide: true });
    f.plan.sha256 = digest(fs.readFileSync(path.join(f.directory, "update.zip")));
    fs.writeFileSync(f.planPath, JSON.stringify(f.plan));
    await assert.rejects(f.prepare(), /Unsafe package path/);
    assert.equal(fs.existsSync(path.join(f.directory, "escaped.txt")), false);
  });
});
