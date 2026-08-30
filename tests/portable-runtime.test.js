"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const saferBufferFiles = [
  "vendor/iconv-lite/node_modules/safer-buffer/package.json",
  "vendor/iconv-lite/node_modules/safer-buffer/safer.js",
  "vendor/iconv-lite/node_modules/safer-buffer/dangerous.js",
  "vendor/iconv-lite/node_modules/safer-buffer/LICENSE",
];

test("portable checkout includes iconv-lite's safer-buffer dependency", () => {
  const ignoreRules = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(ignoreRules, /!vendor\/iconv-lite\/node_modules\//);
  assert.match(ignoreRules, /!vendor\/iconv-lite\/node_modules\/safer-buffer\//);

  for (const file of saferBufferFiles) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is required at runtime`);
  }

  const gitProbe = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: root,
    encoding: "utf8",
  });
  if (gitProbe.status === 0) {
    for (const file of saferBufferFiles) {
      const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", file], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(tracked.status, 0, `${file} must be included in Git checkouts`);
    }
  }

  const runtimeProbe = spawnSync(
    process.execPath,
    [
      "-e",
      "const iconv = require('./vendor/iconv-lite'); process.stdout.write(iconv.decode(iconv.encode('中文', 'gbk'), 'gbk'));",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NODE_PATH: "" },
    }
  );
  assert.equal(runtimeProbe.status, 0, runtimeProbe.stderr);
  assert.equal(runtimeProbe.stdout, "中文");
});

test("portable release build preserves Git updates and verifies bundled Node", () => {
  const ignoreRules = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const buildScript = fs.readFileSync(path.join(root, "scripts", "build-portable.ps1"), "utf8");
  const buildCommand = fs.readFileSync(path.join(root, "build-portable.cmd"), "utf8");
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "release-portable.yml"), "utf8");
  const packagingDoc = fs.readFileSync(path.join(root, "docs", "PACKAGING.md"), "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

  assert.match(ignoreRules, /^\/dist\/$/m);
  assert.match(packageJson.scripts["build:portable"], /scripts\/build-portable\.ps1/);
  assert.match(buildCommand, /scripts\\build-portable\.ps1/);
  assert.match(buildScript, /SHASUMS256\.txt/);
  assert.match(buildScript, /Get-FileHash[^\n]+SHA256/);
  assert.match(buildScript, /"init", "-b", "main"/);
  assert.match(buildScript, /refs\/tags\/\$\{ReleaseTag\}:refs\/tags\/\$\{ReleaseTag\}/);
  assert.match(buildScript, /\.git\\info\\exclude/);
  assert.match(buildScript, /\/runtime\//);
  assert.match(buildScript, /Forkline\.cmd/);
  assert.match(buildScript, /tar\.exe -a -c -f/);
  assert.match(buildScript, /\$packageName\/\.git\/HEAD/);
  assert.match(buildScript, /\$packageName = "Forkline-\$ReleaseTag-windows-x64-portable"/);
  assert.match(workflow, /release:\s*\n\s*types: \[published\]/);
  assert.match(workflow, /dist\/Forkline-v\*-windows-x64-portable\.zip/);
  assert.match(workflow, /dist\/Forkline-v\*-windows-x64-portable\.zip\.sha256/);
  assert.doesNotMatch(workflow, /gh release upload \$tag dist\/\*\.zip/);
  assert.match(readme, /Forkline-v\*-windows-x64-portable\.zip/);
  assert.match(readme, /GitHub 自动生成的[\s\S]*Source code \(zip\)[\s\S]*只是源码/);
  assert.match(packagingDoc, /应用内更新/);
  assert.match(packagingDoc, /强制终止/);
  assert.match(packagingDoc, /windows-x64-portable/);
});
