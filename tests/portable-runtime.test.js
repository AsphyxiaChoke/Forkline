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
