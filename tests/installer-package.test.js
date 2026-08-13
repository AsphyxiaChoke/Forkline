"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "release-installer.yml"), "utf8");
const installerInclude = fs.readFileSync(path.join(root, "electron", "installer.nsh"), "utf8");

test("Windows installer is per-user, assisted, x64, and creates standard shortcuts", () => {
  assert.equal(pkg.version, "0.4.1");
  assert.equal(pkg.description, "中文 Git 可视化管理工具");
  assert.equal(pkg.author, "AsphyxiaChoke");
  assert.equal(pkg.scripts["build:installer"], "electron-builder --win nsis --x64 --publish never");
  assert.equal(pkg.build.appId, "io.github.asphyxiachoke.forkline");
  assert.equal(pkg.build.win.target[0].target, "nsis");
  assert.deepEqual(pkg.build.win.target[0].arch, ["x64"]);
  assert.equal(pkg.build.win.artifactName, "Forkline-Setup-${version}-windows-x64.${ext}");
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.equal(pkg.build.nsis.perMachine, false);
  assert.equal(pkg.build.nsis.allowElevation, false);
  assert.equal(pkg.build.nsis.include, "electron/installer.nsh");
  assert.match(installerInclude, /!macro\s+customInstallMode\s*\r?\n\s*StrCpy\s+\$isForceCurrentInstall\s+"1"\s*\r?\n!macroend/);
  assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(pkg.build.nsis.createDesktopShortcut, true);
  assert.equal(pkg.build.nsis.createStartMenuShortcut, true);
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
});

test("installer release workflow publishes updater metadata and checksums", () => {
  assert.match(workflow, /release:\s*\r?\n\s*types:\s*\[published\]/);
  assert.match(workflow, /ref:\s*\$\{\{ steps\.release\.outputs\.tag \}\}/);
  assert.match(workflow, /npm\.cmd ci/);
  assert.match(workflow, /name:\s*Use corrected v0\.4\.1 browser regression harness[\s\S]*?github\.event_name == 'workflow_dispatch' && steps\.release\.outputs\.tag == 'v0\.4\.1'[\s\S]*?git restore --source='\$\{\{ github\.sha \}\}' --worktree -- tests\/browser-performance\.test\.js/);
  assert.match(workflow, /name:\s*Run automated tests[\s\S]*?TEMP:\s*\$\{\{ runner\.temp \}\}[\s\S]*?TMP:\s*\$\{\{ runner\.temp \}\}[\s\S]*?npm\.cmd test/);
  assert.match(workflow, /name:\s*Restore release-tag browser regression harness[\s\S]*?always\(\)[\s\S]*?git restore --worktree -- tests\/browser-performance\.test\.js/);
  assert.match(workflow, /npm\.cmd test/);
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY/);
  assert.match(workflow, /npm\.cmd run build:installer/);
  assert.match(workflow, /Forkline-Setup-\*-windows-x64\.exe\.blockmap/);
  assert.match(workflow, /Forkline-Setup-\*-windows-x64\.exe\.sha256/);
  assert.match(workflow, /dist\/installer\/latest\.yml/);
  assert.match(workflow, /gh release upload/);
});
