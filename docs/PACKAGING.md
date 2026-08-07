# Forkline Windows 便携包

## 目标

便携包在不改成 Electron 的前提下提供双击启动和应用内更新：

- 内置固定版本的 Windows x64 Node.js，用户不需要单独安装 Node.js。
- 保留浅层 `.git`、`main` 分支和官方 `origin`，继续使用 Forkline 现有的快进更新流程。
- Git 仍由系统提供，以继续复用用户已有的凭据、SSH、GCM 和 Git 配置。

## 产物

```text
Forkline-v0.3.0-windows-x64.zip
Forkline-v0.3.0-windows-x64.zip.sha256
```

ZIP 内额外包含：

```text
runtime/node.exe
runtime/NODE-LICENSE.txt
Forkline.cmd
PORTABLE-INFO.txt
.git/
```

`runtime/`、`Forkline.cmd` 和 `PORTABLE-INFO.txt` 写入包内 `.git/info/exclude`，因此不会让 Forkline 自身工作区变脏。启动器使用内置 Node，更新后的服务重启仍沿用同一个 `process.execPath`。

## 本地构建

要求：Windows、Git、PowerShell、可访问 `github.com` 和 `nodejs.org`，当前源码仓库工作区干净且 `origin` 指向官方 Forkline。

```powershell
./scripts/build-portable.ps1 -ReleaseTag v0.3.0
```

也可以双击 `build-portable.cmd`，默认使用 `package.json` 对应的正式 Tag。产物写入 `dist/`。

构建脚本会：

1. 校验 Tag 与该提交中的 `package.json` 版本一致。
2. 在临时目录创建该 Tag 的浅层 Git 仓库，并把本地分支固定为 `main`。
3. 下载固定 Node.js Windows x64 ZIP，并按官方 `SHASUMS256.txt` 校验 SHA256。
4. 写入便携运行时和启动器，确认 Git 工作区仍干净。
5. 使用 `tar.exe` 创建包含隐藏 `.git` 的 ZIP，并生成 ZIP SHA256 文件。

## Release 自动构建

`.github/workflows/release-portable.yml` 在正式 Release 发布后构建并上传 ZIP 与 SHA256，也可以手动输入已有 Tag 重新构建并覆盖附件。

`v0.3.0` 早于该工作流加入，因此首次便携附件由本地执行相同脚本构建并上传；后续 Release 走自动工作流。

## 更新边界

- Forkline 源码继续由现有应用内更新流程获取正式 Release Tag 并执行快进更新。
- 内置 Node 不属于 Git 跟踪文件，普通源码更新不会替换运行时。
- 只有需要升级 Node 运行时时，才重新下载新的完整便携包。
- GitHub 自动生成的 Source code ZIP 不含 `.git`，不能替代便携附件，也不能执行应用内一键更新。

## 发布验证

- `npm.cmd test` 全部通过。
- 解压 ZIP 后确认分支为 `main`、HEAD 等于发布 Tag、`origin` 为官方仓库且 `git status` 为空。
- 使用 `runtime/node.exe` 启动服务并确认首页 HTTP 200。
- 使用 Windows 进程树强制终止后确认服务端口释放。
- Release 附件 SHA256 与本地生成文件一致。

## v0.3.0 实际产物

- ZIP：`Forkline-v0.3.0-windows-x64.zip`
- 大小：`35,872,015` 字节，约 `34.2 MiB`
- SHA256：`ef88c0a29bedfb1a0142ff92883bf813bcbced0c8cf993ec837779fc861ce702`
- 内置运行时：Node.js `v24.13.0`
- Release 下载：[Forkline v0.3.0](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.3.0)
