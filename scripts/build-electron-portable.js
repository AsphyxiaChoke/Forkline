"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createReadStream } = require("node:fs");
const { spawn } = require("node:child_process");
const { build, Platform, Arch } = require("electron-builder");
const { getPath7za } = require("app-builder-lib/out/toolsets/7zip");

async function main() {
  const root = path.resolve(__dirname, "..");
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const output = path.resolve(process.argv[2] || path.join(root, "dist", "desktop-portable"));
  const archive = path.join(output, `Forkline-v${version}-windows-x64-portable.zip`);
  if (fs.existsSync(archive)) throw new Error(`Output already exists; choose a new build directory: ${archive}`);
  await build({
    projectDir: root,
    targets: Platform.WINDOWS.createTarget(["dir"], Arch.x64),
    publish: "never",
    config: { directories: { output } },
  });
  const application = path.join(output, "win-unpacked");
  const marker = "resources/forkline-portable.json";
  const files = [];
  function collect(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink() || [".git", ".github", "data"].includes(entry.name)) throw new Error(`Unexpected portable file: ${relative}`);
      if (entry.isDirectory()) collect(path.join(directory, entry.name), `${relative}/`);
      else files.push(relative);
    }
  }
  fs.writeFileSync(path.join(application, "PORTABLE-README.txt"), [
    "Forkline Electron 便携版",
    "解压到可写文件夹后双击 Forkline.exe，不需要运行 Setup。",
    "个人设置保存在同目录 data 文件夹；移动软件时请保留该目录。",
    "设置中的立即更新并重启会校验并替换便携 ZIP，保留 data。",
    "请勿把项目仓库放入软件自带的 resources 或 locales 文件夹。",
    "官方下载：https://github.com/AsphyxiaChoke/Forkline/releases",
  ].join("\r\n"), "utf8");
  collect(application);
  files.push(marker);
  fs.writeFileSync(path.join(application, marker), JSON.stringify({ kind: "electron-portable", version, files: files.sort() }, null, 2), "utf8");
  const path7za = await getPath7za();
  await new Promise((resolve, reject) => {
    const child = spawn(path7za, ["a", "-tzip", "-mx=9", archive, "."], { cwd: application, windowsHide: true, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Portable ZIP compression failed: ${code}`)));
  });
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const digest = hash.digest("hex");
  fs.writeFileSync(`${archive}.sha256`, `${digest}  ${path.basename(archive)}\n`, "ascii");
  console.log(JSON.stringify({ archive, bytes: fs.statSync(archive).size, sha256: digest, packageFiles: files.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
