# Forkline Windows 发布包

## Web 便携包

### 目标

便携包在不改成 Electron 的前提下提供双击启动和应用内更新：

- 内置固定版本的 Windows x64 Node.js，用户不需要单独安装 Node.js。
- 保留浅层 `.git`、`main` 分支和官方 `origin`，继续使用 Forkline 现有的快进更新流程。
- Git 仍由系统提供，以继续复用用户已有的凭据、SSH、GCM 和 Git 配置。

### 产物

```text
Forkline-v0.4.0-windows-x64.zip
Forkline-v0.4.0-windows-x64.zip.sha256
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

### 本地构建

要求：Windows、Git、PowerShell、可访问 `github.com` 和 `nodejs.org`，当前源码仓库工作区干净且 `origin` 指向官方 Forkline。

```powershell
./scripts/build-portable.ps1 -ReleaseTag v0.4.0
```

也可以双击 `build-portable.cmd`，默认使用 `package.json` 对应的正式 Tag。产物写入 `dist/`。

构建脚本会：

1. 校验 Tag 与该提交中的 `package.json` 版本一致。
2. 在临时目录创建该 Tag 的浅层 Git 仓库，并把本地分支固定为 `main`。
3. 下载固定 Node.js Windows x64 ZIP，并按官方 `SHASUMS256.txt` 校验 SHA256。
4. 写入便携运行时和启动器，确认 Git 工作区仍干净。
5. 使用 `tar.exe` 创建包含隐藏 `.git` 的 ZIP，并生成 ZIP SHA256 文件。

### Release 自动构建

`.github/workflows/release-portable.yml` 在正式 Release 发布后构建并上传 ZIP 与 SHA256，也可以手动输入已有 Tag 重新构建并覆盖附件。

`v0.3.0` 早于该工作流加入，因此首次便携附件由本地执行相同脚本构建并上传；后续 Release 走自动工作流。

从 `v0.3.1` 起，发布 Release 后由该工作流自动构建并上传 Windows x64 ZIP 和 SHA256 文件。

`v0.4.1` 继续发布 Web 便携包；便携包仍保留 `.git` 并使用原有快进更新，不会改成 NSIS 或 `electron-updater`。

### 更新边界

- Forkline 源码继续由现有应用内更新流程获取正式 Release Tag 并执行快进更新。
- 内置 Node 不属于 Git 跟踪文件，普通源码更新不会替换运行时。
- 只有需要升级 Node 运行时时，才重新下载新的完整便携包。
- GitHub 自动生成的 Source code ZIP 不含 `.git`，不能替代便携附件，也不能执行应用内一键更新。

### 发布验证

- `npm.cmd test` 全部通过。
- 解压 ZIP 后确认分支为 `main`、HEAD 等于发布 Tag、`origin` 为官方仓库且 `git status` 为空。
- 使用 `runtime/node.exe` 启动服务并确认首页 HTTP 200。
- 使用 Windows 进程树强制终止后确认服务端口释放。
- Release 附件 SHA256 与本地生成文件一致。

## Electron NSIS 安装版

### 产物

```text
Forkline-Setup-<version>-windows-x64.exe
Forkline-Setup-<version>-windows-x64.exe.blockmap
Forkline-Setup-<version>-windows-x64.exe.sha256
latest.yml
```

安装器按当前用户安装、显示安装向导、允许选择目录，并默认创建桌面与开始菜单快捷方式。`latest.yml` 和 blockmap 供 `electron-updater` 检查与差分下载使用。

### 本地构建

```powershell
npm.cmd ci
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npm.cmd run build:installer
```

产物写入 `dist/installer/`。正式配置不固定本机 Electron 或 NSIS 缓存目录；离线验证可以临时通过 electron-builder 命令行覆盖运行时路径，但不得把本机路径写回 `package.json`。

### Release 自动构建

`.github/workflows/release-installer.yml` 在正式 Release 发布后签出不可变 Tag，校验 Tag 与 `package.json` 版本一致，在 Windows x64 runner 上执行完整自动回归，再构建未签名 NSIS 安装器、生成 SHA-256，并把安装器、blockmap、校验文件和 `latest.yml` 附加到同一个 Release。

GitHub Windows runner 的默认 `%TEMP%` 可能使用 8.3 短路径，而 Git 会返回同一目录的长路径。安装器工作流只在自动测试步骤把 `TEMP` 与 `TMP` 固定为 `${{ runner.temp }}`，避免测试夹具把同一物理仓库误判为不同路径；正式安装器配置和运行时路径处理不受此 CI 设置影响。

安装器当前没有代码签名。Release 说明必须明确“未知发布者”和 SmartScreen 风险，并要求用户只从官方 Release 下载和核验 SHA-256。

### 更新边界

- 只有打包后的 Windows NSIS 版本启用 `electron-updater`；开发态和其他平台返回不支持，并继续使用原 Git 更新路径。
- 不自动下载，不静默安装。用户在设置页点击“立即更新并重启”后才下载。
- 安装前必须确认没有 Git 操作仍在执行，再优雅停止 Forkline 后台服务以及它持有的 Git/SSH 子进程；操作繁忙、停机超时或失败时取消安装。
- 安装器下载地址由 GitHub provider 固定生成，渲染进程不能提供任意 URL 或可执行文件路径。

### 发布验证

- `npm.cmd test`、`node --check` 和 `git diff --check` 全部通过。
- ASAR 内 `package.json` 版本和入口正确，更新控制器及设置页内容与发布源码一致。
- 本机验证当前用户安装、目录选择、桌面/开始菜单快捷方式、启动、版本显示、后台服务退出和卸载。
- `Get-AuthenticodeSignature` 应如实记录签名状态；未签名版本不得写成已受信任。
- Release 工作流完成后重新下载全部附件，校验安装器 SHA-256 与 `.sha256` 内容一致，并核对 `latest.yml` 的版本、文件名、大小和 SHA-512。

## v0.3.0 实际产物

- ZIP：`Forkline-v0.3.0-windows-x64.zip`
- 大小：`35,872,015` 字节，约 `34.2 MiB`
- SHA256：`ef88c0a29bedfb1a0142ff92883bf813bcbced0c8cf993ec837779fc861ce702`
- 内置运行时：Node.js `v24.13.0`
- Release 下载：[Forkline v0.3.0](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.3.0)

## v0.3.1 实际产物

- ZIP：`Forkline-v0.3.1-windows-x64.zip`
- 大小：`35,977,719` 字节，约 `34.3 MiB`
- SHA256：`387f6b4b9e5332bb165dc347a97b5717b7667a8163e65045535b25245c9bfff8`
- 内置运行时：Node.js `v24.13.0`
- 自动构建：[GitHub Actions 31352410934](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31352410934)
- Release 下载：[Forkline v0.3.1](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.3.1)

## v0.4.0 实际产物

- ZIP：`Forkline-v0.4.0-windows-x64.zip`
- 大小：`36,486,187` 字节，约 `34.8 MiB`
- SHA256：`8df2ba3da1c32be4fa5653cc72d447bfaaae67c4e31add36c54d59d18cd43343`
- 内置运行时：Node.js `v24.13.0`
- 自动构建：[GitHub Actions 31575254040](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31575254040)
- Release 下载：[Forkline v0.4.0](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.0)
- 验收：工作流成功，ZIP 与 SHA256 附件均已上传；重新下载 ZIP 后计算的 SHA256 与附件内容一致。
