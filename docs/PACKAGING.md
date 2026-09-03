# Forkline Windows 发布包

## Web 便携包

### 目标

便携包在不改成 Electron 的前提下提供双击启动和应用内更新：

- 内置固定版本的 Windows x64 Node.js，用户不需要单独安装 Node.js。
- 保留浅层 `.git`、`main` 分支和官方 `origin`，继续使用 Forkline 现有的快进更新流程。
- Git 仍由系统提供，以继续复用用户已有的凭据、SSH、GCM 和 Git 配置。

### 产物

```text
Forkline-v0.4.0-windows-x64-portable.zip
Forkline-v0.4.0-windows-x64-portable.zip.sha256
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

`.github/workflows/release-portable.yml` 在正式 Release 发布后构建并上传名称包含 `-windows-x64-portable` 的 ZIP 与 SHA256，也可以手动输入已有 Tag 重新构建并覆盖附件。GitHub 页面中的 `Source code (zip)` 只是源码快照，不是便携包。

`v0.3.0` 早于该工作流加入，因此首次便携附件由本地执行相同脚本构建并上传；后续 Release 走自动工作流。

从 `v0.3.1` 起，发布 Release 后由该工作流自动构建并上传 Windows x64 ZIP 和 SHA256 文件。

`v0.4.1` 继续发布 Web 便携包；便携包仍保留 `.git` 并使用原有快进更新，不会改成 NSIS 或 `electron-updater`。

### 更新边界

- Forkline 源码继续由现有应用内更新流程获取正式 Release Tag 并执行快进更新。
- 内置 Node 不属于 Git 跟踪文件，普通源码更新不会替换运行时。
- 只有需要升级 Node 运行时时，才重新下载新的完整便携包。
- GitHub 自动生成的 `Source code (zip)` 不含 `.git`、内置 Node.js 或 `Forkline.cmd`，不能替代名称包含 `-windows-x64-portable.zip` 的便携附件，也不能执行应用内一键更新。

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

Electron `43.4.1` 包不再通过自身生命周期脚本自动下载 Windows 运行时；只有 `npm ci` 时，`node_modules/electron/dist/electron.exe` 可能不存在。安装器工作流会在依赖安装后显式执行 Electron 提供的安装入口并检查 EXE 存在，再使用固定 Node.js `24.13.0` 运行普通、真实 Chromium 和真实 Electron 三组独立回归。测试文件、断言、串行语义和 Chromium 的 `3x` 共享 runner 计时系数均保持不变，不通过跳过测试或放宽门槛规避失败。

安装器当前没有代码签名。Release 说明必须明确“未知发布者”和 SmartScreen 风险，并要求用户只从官方 Release 下载和核验 SHA-256。

### 更新边界

- 只有打包后的 Windows NSIS 版本启用 `electron-updater`；开发态和其他平台返回不支持，并继续使用原 Git 更新路径。
- 不自动下载，不静默安装。用户在设置页点击“立即更新并重启”后才下载。
- 安装前必须确认没有 Git 操作仍在执行，再优雅停止 Forkline 后台服务以及它持有的 Git/SSH 子进程；操作繁忙、停机超时或失败时取消安装。
- GitHub provider 仍从官方 Release 读取 `latest.yml`，由官方元数据决定版本和 SHA-512。`v0.4.2` 起只把与版本严格匹配的 `AsphyxiaChoke/Forkline` Windows x64 EXE 和 blockmap 改写到 `https://ghfast.top/`；其他仓库、协议、主机、文件名和资产类型均不改写。
- 加速下载沿用官方元数据中的 SHA-512。节点失败或内容校验失败时，`electron-updater` 先清理失败缓存，再关闭差分下载并回退 GitHub 官方完整 EXE；用户取消下载时不回退。渲染进程不能提供任意 URL、镜像或可执行文件路径。
- `v0.4.1` 的 GitHub provider 会直接生成官方资产 URL，且该版本中没有加速控制器。因此首次从 `v0.4.1` 升级 `v0.4.2` 仍走官方源；安装 `v0.4.2` 后的后续安装版更新才启用国内加速。

### 发布验证

- `npm.cmd test`、`node --check` 和 `git diff --check` 全部通过。
- ASAR 内 `package.json` 版本和入口正确，更新控制器及设置页内容与发布源码一致。
- 本机验证当前用户安装、目录选择、桌面/开始菜单快捷方式、启动、版本显示、后台服务退出和卸载。
- 从既有 `%APPDATA%\forkline` 升级时，确认 `desktop-recent-repositories.json` 生成且最近仓库在回环端口变化后仍保留；卸载应移除程序、快捷方式和卸载登记，但继续保留该用户数据文件。
- `Get-AuthenticodeSignature` 应如实记录签名状态；未签名版本不得写成已受信任。
- Release 工作流完成后重新下载全部附件，校验安装器 SHA-256 与 `.sha256` 内容一致，并核对 `latest.yml` 的版本、文件名、大小和 SHA-512。
- 通过加速 URL 下载正式 EXE 与 blockmap，确认响应对应白名单资产，并按官方 `latest.yml` 的 SHA-512 复核 EXE；再验证代理失败会回退官方完整下载、用户取消不会回退。

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

## v0.4.1 既有标签安装器重跑

`v0.4.1` 发布后发现 GitHub Windows runner 会让正常的小文件 MergeView 首次构建超过 `250 ms`，产品按设计自动切换为轻量双栏，但旧浏览器性能测试仍固定要求存在一个 MergeView，因此安装器工作流连续两次以 `335/336` 失败。该结果不是安装器构建失败，也不是产品自动降级失效。

默认分支中的修正测试把两条行为明确隔离：正常 MergeView 交互段临时绕开自动降级，随后恢复真实保护，并继续通过注入 `300 ms` 构建延迟验证自动降级、诊断记录和记忆重开。不得通过提高产品阈值、跳过真实 Chromium 回归或重试掩盖此问题。

手动重跑不可变 `v0.4.1` 时，工作流签出该 Tag 后只从当前工作流提交借用修正后的 `tests/browser-performance.test.js` 执行回归，测试结束立即把该文件恢复为 Tag 内容，再构建安装器。产品源码、打包输入和 `v0.4.1` 标签均不改变；后续新版本的 Tag 应直接包含修正后的测试，不走此兼容步骤。

安装器使用 GitHub 共享 Windows runner，Git 与磁盘冷路径会比固定本机明显波动。该工作流显式设置 `FORKLINE_BROWSER_PERFORMANCE_SCALE=3`，只缩放浏览器回归中五个依赖 Git/磁盘调度的严格计时预算；正常开发和本机回归继续使用 `1x` 原门限。功能结果、文件数、DOM 上限、响应体大小、UI 主线程卡顿和自动降级断言均不缩放。

## v0.4.1 正式发布验收

- Release：[Forkline v0.4.1](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.1)，当前为 Latest，且不是草稿或预发布版本。
- 安装器工作流：[GitHub Actions 31663989923](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31663989923)，完整自动回归 `336/336` 通过；测试后恢复不可变 `v0.4.1` Tag 的测试文件，再构建并上传产品附件。
- `Forkline-Setup-0.4.1-windows-x64.exe`：`100,594,372` 字节，SHA-256 `e376110142f8a1b5b96eeb5db8e815cc988f90c8112fa7bff3572a3819c313ce`。
- `Forkline-Setup-0.4.1-windows-x64.exe.blockmap`：`105,783` 字节，SHA-256 `d257df1d0f90786cb43de4b1bfc0f8fedad7815373c770d9d85d4f668c9e0697`。
- `Forkline-Setup-0.4.1-windows-x64.exe.sha256`：`102` 字节，SHA-256 `def6f3aff8db326c801369dcb83bb65975debc7ca3fcc0633da774e1d11369e0`。
- `Forkline-v0.4.1-windows-x64.zip`：`36,583,817` 字节，SHA-256 `a91a2c0129d43d99f540968676372e3258aa68cf11b22c62b28883c622ac30ee`。
- `Forkline-v0.4.1-windows-x64.zip.sha256`：`99` 字节，SHA-256 `a41c240ec0f996b649a0a1eeb52f476003d88c0f46777b14118956e68f770e97`。
- `latest.yml`：`369` 字节，SHA-256 `b0d45ee8146b348d151c2673399ee972cea1858c36e1555a42334350b470ecf3`；其中版本为 `0.4.1`、文件名为安装器名称、大小为 `100594372`，SHA-512 `yQqFzGao5RTW95tMd4FRZrln/c5fkRCjVCWR74Zht0rx2qcesgBLGbFcRUr8ZGbNjt9JkOCydO5huIyIV88Nhw==` 与重新下载的 EXE 逐字节计算值一致。
- 六个附件均从正式 Release 重新下载；本机 SHA-256 与 GitHub digest 全部一致，EXE/ZIP 也分别与附件中的 `.sha256` 内容一致。安装器 Authenticode 状态如实为 `NotSigned`。
- `D:\Forkline` 最终保留当前用户安装版；设置页显示“已是最新版本”，当前版本与最新版本均为 `v0.4.1`。通过窗口关闭按钮退出后，Forkline/Electron/后台服务进程和监听端口均为 0。

## v0.4.2 正式发布与安装验收

- Release：[Forkline v0.4.2](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.2)，当前为 Latest，且不是草稿或预发布版本；不可移动的注释标签 `v0.4.2` 固定指向发布提交 `125e65b2efb38806b43a00e38613a63b63df86e7`。
- 安装器工作流：[GitHub Actions 31670594368](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31670594368)；便携包工作流：[GitHub Actions 31670594400](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31670594400)。两条工作流均在 `v0.4.2` 标签提交上成功完成。
- `Forkline-Setup-0.4.2-windows-x64.exe`：`100,595,414` 字节，SHA-256 `a01deabc74b1f3b0b9a9506fee8b17cdec99567f8ec48c6b6fd6cfebf10fb1ac`；`Forkline-Setup-0.4.2-windows-x64.exe.blockmap`：`105,775` 字节，SHA-256 `3aa3cf7e9724cc0fd9dd97c024c78585471b6192adad89b0c36d2a4cd9653777`。
- `Forkline-Setup-0.4.2-windows-x64.exe.sha256`：`102` 字节，SHA-256 `5043f944124e118a45b33d2adf313cb29dce5ad4969f76c93c555fd503015752`；`Forkline-v0.4.2-windows-x64.zip`：`36,612,928` 字节，SHA-256 `69208264366207f2f3cf320fb0c964e7a16ef0138888b635e5b950baa64fefb0`；ZIP 校验文件为 `99` 字节，SHA-256 `9f0e39237ba77c03c496644cb2a25cb69695c631c50272c87fe277bda2eb0a50`。
- `latest.yml`：`369` 字节，SHA-256 `fd1454bbf138f39d2793b8cd062a59a0c35f267fb9644465fb1075d7d0b56bdd`；版本、文件名、`100595414` 字节大小和 SHA-512 `+Z5Wptfey84ZbBrWZRMedT4ZOxLBR9HdTvQjxeVfarCYHOg1w4lyNDoczTjH7xGHxK/OsmcVUWCppWEMlwsNbQ==` 均与正式 EXE 一致。
- 六个附件均从正式 Release 重新下载，本机 SHA-256 与 GitHub digest 全部一致，EXE/ZIP 也分别匹配各自校验文件。国内代理完整 EXE、blockmap 和 ZIP 的校验值与官方附件一致；正式 blockmap 的代理复核文件 SHA-256 同为 `3aa3cf7e9724cc0fd9dd97c024c78585471b6192adad89b0c36d2a4cd9653777`。安装器 Authenticode 状态为 `NotSigned`，发布说明中的未知发布者和 SmartScreen 风险继续有效。
- 最终安装版由用户从正式安装器安装到 `D:\Forkline`。`Forkline.exe` 文件版本为 `0.4.2`、产品版本为 `0.4.2.0`；HKCU 卸载项为 `Forkline 0.4.2`，桌面和开始菜单快捷方式的目标与工作目录均指向 `D:\Forkline`，`%APPDATA%\forkline` 用户数据保留。
- 安装后的 `app.asar` 版本为 `0.4.2`，保留 `electron-updater` 运行依赖并包含国内加速模块；主进程、preload、安装更新控制器和加速器与 `v0.4.2` 标签源码在换行归一化后逐字节一致。
- 设置页联网显示“已是最新版本”，当前版本与最新版本均为 `v0.4.2`。通过窗口关闭按钮退出后，Forkline/Electron/后台服务进程和监听端口均为 0，D 盘安装、快捷方式、用户数据和卸载登记继续保留。
- 当前没有 `v0.4.3`，因此本机没有伪造一次不存在的加速升级；软件内加速能力以自动专项、官方元数据 SHA-512、正式代理附件一致性和失败回退验证为依据。从已安装的 `v0.4.2` 开始，后续 NSIS 更新才优先使用国内加速，源码与便携版的 Git 更新语义不变。

## v0.4.3 发布准备

- `v0.4.3` 修复普通工作区文件的 API 合法返回 `conflictVersions: null` 时，前端文件编辑器读取 `ours` 导致无法打开文件的问题。修复不改变冲突文件、Git 或更新语义。
- 工具函数回归、真实 Chromium 双击普通工作区文件回归和完整自动回归均通过；完整结果为 `342/342`，0 失败、0 跳过。
- 本机 NSIS 产物 `Forkline-Setup-0.4.3-windows-x64.exe` 为 `100,684,036` 字节，SHA-256 `557b02835430ef1b489a7424a5f71c1f3ef40eda4b86d2b4540cdeac650532f5`；blockmap 为 `105,574` 字节，SHA-256 `126077949fcc2b0224da88a53f623d98a06344a7e937b1c0d6332e08c05355bd`。
- 本机 `latest.yml` 为 `369` 字节，SHA-256 `9c2ee4710117029e452dc282b0de694aee5ae34e1038bdfeb0f50b20883ebde6`；版本、文件名、`100684036` 字节大小和 SHA-512 `Ur2w8Z+465eyhp4z8jvuzbEZTDGJzxL7FP4TisUD6i7vhWDqpepmB73NnL1RuDhCwk9eVfcGZd9QR/OoSSvSKA==` 与 EXE 一致。安装器仍为 `NotSigned`。
- 本机离线验证只在命令行临时指定 `node_modules/electron/dist`，没有将本机路径或下载镜像写入 `package.json`。正式 Release 仍由 GitHub Windows runner 在不可变 `v0.4.3` 标签上重新测试和构建，正式附件以远端工作流产物为准。

`v0.4.3` Release 首次安装器 Run `31676525204` 为 `341/342`，唯一失败是共享 runner 上普通小文件的首次 MergeView 构建触发既有 `250 ms` 自动降级，而新增回归只接受 MergeView。修正后的测试接受 MergeView 或两个轻量 CodeMirror 窗格，但仍固定普通文件成功打开、非冲突状态和原 TypeError 不再出现；不会修改产品保护阈值或发布标签。手动重跑会临时借用默认分支修正测试，随后恢复不可变 `v0.4.3` 标签的测试文件再构建产品。

## v0.4.4 发布准备

- `v0.4.4` 修复 Electron 每次启动选择不同回环端口时，最近仓库因浏览器来源变化而看似丢失的问题。Electron 改用 `%APPDATA%\forkline\desktop-recent-repositories.json`，首次升级会从既有 LevelDB 中定位旧随机端口并通过沙箱化 Chromium 来源读取固定记录；Web 和 Web 便携版继续使用原 `localStorage`，Git 与更新语义不变。
- 完整 `npm.cmd test` 为 `347/347`，0 失败、0 跳过；专项 `91/91` 覆盖稳定存储、迁移、Electron 受限 IPC、启动顺序、布局和安装器契约。安装后的普通工作区文件在真实 Electron 页面中 `234 ms` 完整打开，保持 `conflict === false`，没有捕获到页面错误。
- 本机 NSIS 安装器 `Forkline-Setup-0.4.4-windows-x64.exe` 为 `100,600,510` 字节，SHA-256 `22566fbc3b815df033d582627ab7fd21bd5cad8bce193f70ced7ae32a86948fe`，SHA-512 `xu8Por6RG4THQnBKFZK7WLBAU+QwbiMOj2t0uRYYh62Pbmc57rJyANC9WJe0vCeYoDZ8ykRZrzZ1cF/gPLSUPA==`，签名状态为 `NotSigned`。blockmap 为 `105,720` 字节、SHA-256 `8b2e89fb948687a9951e908e8de8594c57297632d2f37b67ee9353448c962275`；`latest.yml` 为 `369` 字节、SHA-256 `06f18a93ef228ef24e89b1425bab18869533ac6d78852e074cc0af620e46d24e`，版本、文件名、大小和 SHA-512 与 EXE 一致。
- 本机从 v0.4.3 覆盖安装到 `D:\Forkline` 后迁移出 `4` 条真实最近仓库；服务端口从 `65214` 变为 `59745` 后，路径与分支集合仍完整。卸载移除了安装目录、桌面/开始菜单快捷方式和 HKCU 登记，同时稳定 JSON 的 SHA-256 保持 `bdb869af1e5c72933e77629e19217632ab24ca405be6ac538c527d56c7146922` 且仍有 `4` 条记录；重新安装后版本、登记、快捷方式、仓库恢复和退出无残留均通过，最终保留 `D:\Forkline` v0.4.4。
- 本地 `win-unpacked` 和最终安装目录的 ASAR 均为 `0.4.4`，入口为 `electron/main.js`，保留 `electron-updater ^6.8.9`；稳定存储模块与源码在换行归一化后完全一致。正式 Release 仍必须由不可变 `v0.4.4` 标签触发两条 Windows 工作流，远端附件需重新下载并校验；本机产物不能替代正式工作流产物。

## v0.4.4 正式发布验收

- Release：[Forkline v0.4.4](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.4) 为 Latest，且不是草稿或预发布版本；不可移动的注释标签 `v0.4.4` 固定指向发布提交 `21e66ccbe372d69f18b9761118c6da20088cb5b4`。
- 安装器工作流：[GitHub Actions 31687442333](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31687442333)；便携包工作流：[GitHub Actions 31687442202](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31687442202)。两条工作流均在 `v0.4.4` 标签提交上成功，安装器工作流完整自动回归为 `347/347`，0 失败、0 跳过。
- `Forkline-Setup-0.4.4-windows-x64.exe`：`100,597,262` 字节，SHA-256 `3d3c893e7db8d3406c51a569b6a1fb94ecc859185f3caf26137ca1be149e5f12`；`Forkline-Setup-0.4.4-windows-x64.exe.blockmap`：`105,889` 字节，SHA-256 `acefb4b803110a3df74b46ed8198d5be7733086fcdc5a27bcea74b67d2e8d281`。
- `Forkline-Setup-0.4.4-windows-x64.exe.sha256`：`102` 字节，SHA-256 `84bbdf631c4e2ecfe0ec3c77558443aec5f03a4826f5cad38c514a6d32fa3319`；`Forkline-v0.4.4-windows-x64.zip`：`36,646,273` 字节，SHA-256 `6d13e5cfd1beda161561c2a657bd003ced732204324dfaaf2d140c9c41059222`；ZIP 校验文件为 `99` 字节，SHA-256 `ccb667f144342247c80b6555278e3fba179d510a85df1a36299b404bd44356df`。
- `latest.yml`：`369` 字节，SHA-256 `167500b1669e2bb94be31b53e8ff3fa2321e58498314f49a884a3af9779d80a6`；版本 `0.4.4`、文件名、`100597262` 字节大小和 SHA-512 `2dGtVBSwNffb8kHvGvNcxFom4l5rHf2/+An93NFu0cUfoaqdNxrNLOWSbHvsqOP/4O9JDyipIl3F4epxEDOq+w==` 均与正式 EXE 一致。
- 六个正式附件的本机 SHA-256 与 GitHub digest 全部一致，EXE/ZIP 也分别匹配各自校验文件；便携 ZIP 已检查包含 `.git`、`runtime`、源码、文档和启动脚本，继续保留现有 Git 快进更新形态。
- `ghfast.top` 下载的正式 EXE 和 blockmap 分别与官方附件逐字节校验一致；正式 EXE 文件版本为 `0.4.4`、产品版本为 `0.4.4`，Authenticode 状态为 `NotSigned`。发布说明已明确“未知发布者”和 SmartScreen 风险，用户仍应只信任官方 Release 元数据与校验值。
- 最终本机保留 `D:\Forkline` v0.4.4，当前无 Forkline/Electron/后台服务进程或监听端口；HKCU 卸载项为 `Forkline 0.4.4`。稳定最近仓库文件仍含 `4` 条迁移记录，软件重启或后续更新不会再因随机回环端口变化而读取到空列表。

## v0.4.5 发布准备

- `v0.4.5` 修复 Electron 每次启动使用不同随机回环端口时，主题、语言、侧栏/详情栏/底栏尺寸、历史列宽、恢复点策略、签出储藏记录和界面诊断因浏览器来源变化而看似丢失的问题。安装版改用 `%APPDATA%\forkline\desktop-ui-preferences.json` 保存上述 `9` 个固定键；Web 和 Web 便携版继续使用当前来源的原生 `localStorage`。
- 主进程和 preload 只提供当前主窗口可调用的固定读取、写入和删除 IPC，不接受文件路径、任意 IPC 名称或任意偏好键。单个值限制按 UTF-8 实际字节数计算为 `128 KiB`，不再按 JavaScript 字符数误放行较大的中文内容。
- 稳定文件首次创建时，仅在某个旧回环来源具有唯一最新的最近仓库或界面诊断业务时间证据时迁移普通偏好；界面诊断从全部来源按时间合并去重。任一来源读取失败时不固化部分结果，下一次启动仍可完整重试。
- 界面诊断仍最多保留最新 `40` 条；当较大的中文记录整体超过 `128 KiB` 时按 UTF-8 字节数裁掉最旧记录，优先保存最新诊断，避免渲染进程提交的完整值被主进程拒绝。
- 提交前稳定偏好、Electron 壳、布局和诊断专项为 `97/97`，完整 `npm.cmd test` 为 `356/356`，0 失败、0 跳过；真实 Chromium 中复杂历史文件首次打开约 `197.3 ms`，4000 文件冷扫描约 `334.6 ms`，仍低于 `350 ms` 门限。依赖审计为 0 个已知漏洞，Electron `43.3.0`、electron-builder `26.15.3`、electron-updater `6.8.9` 均完整。
- 本机 NSIS 安装器 `Forkline-Setup-0.4.5-windows-x64.exe` 为 `100,602,897` 字节，SHA-256 `5e3b305a16642de99499966ef6fc761a0401fff46fab1df555cf4daa32ac6989`，SHA-512 `9ejiZp4fvwKYobJ4gUEa2WrdUu/LcSkxfMijglEonY7RojOUJ1YdTSNYAcBg+aB0zlSBLfwJ+hY+UG84CQnslA==`，签名状态为 `NotSigned`。blockmap 为 `105,810` 字节、SHA-256 `f27d0a28b85d638a9518e1814cd078a39e361033d71cad8eea33825e1e5505e2`；`latest.yml` 为 `369` 字节、SHA-256 `d1af6313f083201220bd2783c1b3dbc3dd340e871df979ed53a10e3122267638`，版本、文件名、大小和 SHA-512 与 EXE 一致。
- 本机构建首次停在 GitHub Electron ZIP 的 0 字节下载，随后只在当前命令行临时设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后成功；没有把国内构建镜像或本机缓存路径写入正式配置。安装版运行时更新继续由官方 `latest.yml` 和 SHA-512 作为信任根，并按既有白名单优先使用 `ghfast.top`、失败后回退 GitHub 官方完整 EXE。
- v0.4.5 已在 `D:\Forkline` 完成当前用户安装、目录选择、桌面/开始菜单快捷方式、覆盖安装、启动、随机端口重启、正常退出、卸载保留用户数据和重装验证。服务端口从 `61975` 变为 `53882` 后，中文、深色、`75%` 缩放和 `4` 条最近仓库仍保留；普通文件 `配置文件5 (2) - 副本.txt` 可正常打开，未再出现 `Cannot read properties of null (reading 'ours')`。最终安装版文件版本为 `0.4.5`、产品版本为 `0.4.5.0`，当前无 Forkline 或后台服务进程残留。
- 正式 Release 仍必须由新的不可变 `v0.4.5` 注释标签触发安装器与便携包工作流；本机产物只作为本机验收证据，不能上传冒充正式附件。发布说明继续明确安装器未签名、未知发布者和 SmartScreen 风险。

## v0.4.5 正式发布验收

- Release：[Forkline v0.4.5](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.5) 为 Latest，且不是草稿或预发布版本；远端注释标签对象 `ebb92b8dc6f27a3e4d8ae9eef39dd0898bca9e8e` 固定解引用到发布提交 `dec62991b1768e3970e754aef334223acd609894`。
- 安装器工作流：[GitHub Actions 31705019886](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31705019886)；便携包工作流：[GitHub Actions 31705019861](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31705019861)。两条工作流均在 `v0.4.5@dec6299` 上成功；安装器工作流完整自动回归为 `356/356`，0 失败、0 跳过，耗时约 `132.7` 秒。
- `Forkline-Setup-0.4.5-windows-x64.exe`：`100,599,666` 字节，SHA-256 `12a13f9d9e021486d66da05ec46816e37808f7bf8e46e538068a4295ff2fa34b`；`Forkline-Setup-0.4.5-windows-x64.exe.blockmap`：`105,744` 字节，SHA-256 `b73ccd0fc0289c1b8f1d1941ef14e40b980e324b285abc1ee5932b44007f05f2`。
- `Forkline-Setup-0.4.5-windows-x64.exe.sha256`：`102` 字节，SHA-256 `8b933cd6d4f3033ba02b87841a36fa05e686f36be999a2e65cf272094fc8b2b2`；`Forkline-v0.4.5-windows-x64.zip`：`36,675,747` 字节，SHA-256 `f02bf39c9261f773b33d6b8cc2c9455a71745feab53792ca14c47c32d0335750`；ZIP 校验文件为 `99` 字节，SHA-256 `c56cc9b744f8b77a85bd9fb470c63d64a9b510d9a3aad13d33bfbed5568039f2`。
- `latest.yml`：`369` 字节，SHA-256 `9e14bf1b7e82b9f2efdd941d130420098d50f2e881577bafff21eb46440f37ec`；版本 `0.4.5`、文件名、`100599666` 字节大小和 SHA-512 `MxWpKFYAXIO585TJ/tkPb5XqmlFCgj9Dh9gTLXDwWYlSvRUHX8FQpGZMukPcVRTpXxB1V/BgGR3f3rEKIvWm/g==` 均与正式 EXE 一致。
- 六个附件均匹配 GitHub Release 提供的 digest，EXE/ZIP 也分别匹配各自 `.sha256` 内容。正式 EXE 文件版本与产品版本均为 `0.4.5`，Authenticode 状态为 `NotSigned`；Release 已明确未知发布者和 SmartScreen 风险。
- GitHub 大文件直连在本机出现长时间低速与连接重置；通过 `ghfast.top` 重新取得的正式 EXE、blockmap 和便携 ZIP 的大小与 SHA-256 均匹配 GitHub 官方 digest。官方 `latest.yml`、SHA-512 和 Release digest 继续作为信任根，国内节点只承担受限白名单资产传输。
- 便携 ZIP 已确认包含 `.git`、`runtime`、源码、文档和启动脚本，继续保留现有 Git 快进更新形态。当前 `D:\Forkline` 仍保留已通过覆盖安装、随机端口重启、卸载保留数据和重装终验的 v0.4.5 安装版；正式远端附件未被本机验证产物替代。

## v0.4.6 发布准备

- `v0.4.6` 修复 Electron 界面偏好写入失败时内存仍显示为已保存的问题。相同偏好键的写入按顺序提交；IPC 返回 `false` 或拒绝时恢复最后一次已经确认落盘的值并显示中文提示，较早请求的迟到失败不会撤销较新的成功选择。
- `%APPDATA%\forkline\desktop-ui-preferences.json` 不再直接覆盖：主进程先写同目录 `.tmp`，再重命名替换。写入中断或替换失败时保留上一份完整 JSON，并清理临时文件。
- 设置页在 Electron 中明确说明主题和语言保存在 Forkline 本机用户数据中，重启和更新后保留；Web 和 Web 便携版继续显示浏览器存储说明。Git、菜单、便携版 Git 快进更新、NSIS `electron-updater` 和国内加速信任边界均不变。
- 正式 Release 必须由新的不可变 `v0.4.6` 注释标签触发两条 Windows 工作流；本机构建只用于覆盖升级验收。发布说明继续明确安装器未签名、未知发布者和 SmartScreen 风险，不得移动 `v0.4.5` 或任何既有标签。

## v0.4.6 本机安装验收

- 偏好、设置页和布局专项为 `65/65`；首轮完整回归为 `363/364`，唯一失败是既有 4000 文件冷扫描在本机波动到 `408.1 ms`，同一真实 Chromium 专项复跑为 `274.8 ms`。后续两次完整回归均为 `364/364`，冷扫描分别为 `295.4 ms` 和提交前最终复核的 `298.6 ms`。`npm.cmd audit --audit-level=low` 为 0 个已知漏洞，依赖树确认 Electron `43.3.0`、electron-builder `26.15.3`、electron-updater `6.8.9` 完整。
- 本机安装器 `Forkline-Setup-0.4.6-windows-x64.exe` 为 `100,603,608` 字节，SHA-256 `a3cc78668d820dce2c929c7b555489ae1e8ce42d8bfe2719b647d791518e7df1`，SHA-512 `3uV7GHgHBsGhO5ITclZoEYF7l/SNE5ap+en4D7tjvR7iPP2p5Mv2wAYN5bTu9jBWJZ1hVOUZ89KuzTJTflQfpw==`，Authenticode 为 `NotSigned`。blockmap 为 `105,849` 字节、SHA-256 `e189897ff0f785784915f6ada8fa5670d41b63991badec6f4173ea24121de771`；`latest.yml` 为 `369` 字节、SHA-256 `3306ca8a9d866ae9aca9ee9a6901d1d1a88df667f5e7770c74178e06edc6728d`，版本、文件名、大小和 SHA-512 均与 EXE 一致。
- 已用上述 SHA-256 完全匹配的未签名安装器覆盖安装到 `D:\Forkline`。首轮交互覆盖后程序与卸载器文件均已是 `0.4.6`，但 HKCU 卸载登记仍停在 `0.4.4`；检查排除了源码硬编码、重复卸载键、安装器携带旧版本和注册表权限问题。同一安装器完整静默覆盖退出码为 `0` 后，登记立即正确更新为 `Forkline 0.4.6`，证据与首轮安装未完成登记收尾一致，未为该现场现象增加重复 NSIS 注册表代码。
- 最终 `D:\Forkline\Forkline.exe` 文件版本为 `0.4.6`、产品版本为 `0.4.6.0`，SHA-256 `22bd04513e55fb92aca8ecdae9cd82c49cf52f998fca0ccf4335403ee58b8a12`；卸载器文件/产品版本均为 `0.4.6`。HKCU 卸载命令为 `"D:\Forkline\Uninstall Forkline.exe" /currentuser`，桌面与开始菜单快捷方式的目标、工作目录和图标均指向 `D:\Forkline`。
- 最终安装版设置页显示“已是最新版本”，当前版本和最新版本均为 `v0.4.6`；中文、深色、`75%` 和 `4` 条最近仓库完整保留，Electron 主题与语言说明均指向 Forkline 本机用户数据。普通未暂存文件 `配置文件5 (2) - 副本.txt` 两次均可打开对照编辑器，未再出现 `Cannot read properties of null (reading 'ours')`。
- `%APPDATA%\forkline\desktop-ui-preferences.json` 与安装前备份的 SHA-256 均为 `9e7e3e89a26e2c7ff9111ed9f30fef71ff402dff6f0fef09a4933d1ead36d10c`；测试脏文件与备份的 SHA-256 均为 `f22338f52ef95050d4924a8bc990ad23d16052814e6c8cef4169d2f0b9b40f9`。最近仓库文件仍包含原 `4` 条路径和分支，只更新了当前仓库的正常 `lastOpened` 时间。
- 安装目录 `app.asar` SHA-256 为 `00100eadda9ac7c016464cce235c0070cadf22b18f35b57f846ae86973d26a85`，内部版本为 `0.4.6`、入口为 `electron/main.js`、保留 `electron-updater ^6.8.9`；偏好原子写入、渲染端存储门面、启动、翻译和设置页脚本与当前工作树逐字节一致。通过窗口关闭按钮退出后，安装目录相关 Forkline、后台服务、Git/SSH 子进程和监听端口均为 `0`。
- 本机产物和安装现场只作为发布前验收证据，不能上传冒充正式附件。正式 Release 仍须从不可变 `v0.4.6` 标签重新构建并核对六个远端附件、GitHub digest、校验文件、官方 `latest.yml`、国内代理完整下载和软件内 `v0.4.5 → v0.4.6` 更新流程。

## v0.4.6 正式发布与软件内更新验收

- Release：[Forkline v0.4.6](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.6) 为 Latest、非草稿、非预发布；不可移动的注释标签 `v0.4.6` 固定解引用到发布提交 `14193fcc33c4c39f4349e729e34ee3dfbdbd9369`。
- 便携包工作流：[GitHub Actions 31763297562](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31763297562)；安装器工作流：[GitHub Actions 31763297556](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31763297556)。两条工作流均在 `v0.4.6@14193fc` 上成功；安装器工作流正式自动回归为 `364/364`，0 失败、0 跳过。
- `Forkline-Setup-0.4.6-windows-x64.exe`：`100,600,231` 字节，SHA-256 `46d3f83bae1eae2c88155644e3c90536a9ff03fc44b5465791b71c96588f2b0a`；对应 blockmap：`105,772` 字节，SHA-256 `b4588204e11b0f740578296a8793bfccbc21b1376757e1c6b99d528a12c8c9f9`。
- 安装器校验文件为 `102` 字节、SHA-256 `421603dd27f1b9e1ccca6da40904a8690d168ff736ee5333db2141088fda8a39`；便携 ZIP 为 `36,699,971` 字节、SHA-256 `a246f885605d9e31687952c9a4d9a70f5277fd1f1106385128c068b56132e3ca`；ZIP 校验文件为 `99` 字节、SHA-256 `122b50f09fdd2e1038d277e2fb2a5da679b44f20933728490ed4e7abd49a8205`。
- `latest.yml` 为 `369` 字节、SHA-256 `debfe0599258a9ec13df97870f145f7c68567cf5457dcc0182683bc9fe35f678`；版本 `0.4.6`、文件名、大小和 SHA-512 `o1Lk0FWAxvlJ4nLwxc2cO8ghLaDiUXp6v5zg+4hmVFOGp4Dz6px0l2MmhzCRL9pfjjgrJzi+O0mo4tDtgCfYwA==` 均与正式 EXE 一致。六附件匹配 GitHub digest，安装器 Authenticode 为 `NotSigned`，Release 已标明未知发布者和 SmartScreen 风险。
- 正式发布阶段通过 `ghfast.top` 下载的完整 EXE、blockmap 和便携 ZIP 均匹配官方 digest。国内节点只承担固定白名单资产传输；官方 `latest.yml`、SHA-512、校验文件和 Release digest 继续作为信任根，节点失败或校验失败时仍回退 GitHub 官方完整安装包。
- 软件内终验先把正式 v0.4.5 安装器覆盖到 `D:\Forkline`，确认文件版本和 HKCU 登记均为 `0.4.5`，再通过 Electron CDP 的真实设置入口点击“立即更新并重启”。下载进度可见，旧实例退出后程序与登记均为 `0.4.6`，更新器缓存安装器的大小和 SHA-256 与正式附件完全一致。
- 更新后 CDP 终验确认设置页当前/最新均为 `v0.4.6` 且显示“已是最新版本”，中文、深色、`75%`、当前仓库和 `4` 条最近仓库保留；稳定界面偏好、缩放和窗口状态文件哈希不变，最近仓库只正常更新当前条目的 `lastOpened`。更新器随后按设计延迟启动带 `--updated` 参数的新实例，实际验证了安装后自动重开；正常关闭该实例后安装目录进程、后台服务和 Git/SSH 子进程立即为 `0`，等待 `30` 秒仍无二次拉起。
- 终验完成后删除本轮临时 Playwright 缓存、安装器、用户数据备份和已消费的 updater `pending` 副本，合计约 `294.4 MiB`；`%TEMP%` 无 `forkline-*` 残留。保留 updater 当前基线用于后续差分更新。旧文档中的临时备份路径已经失效，不得继续引用为恢复来源。
- 本轮仅追加发布验收文档，不修改产品代码或安装包内容。后续产品代码变更必须发布新补丁版本；禁止移动 `v0.4.6` 或任何既有标签。

## v0.4.7 Electron 43.4.0 发布准备与本机验收

- `v0.4.7` 只把应用/安装器版本从 `0.4.6` 升至 `0.4.7`，并把 Electron 从 `43.3.0` 更新到 `43.4.0`。Electron 官方发布说明确认该版本修复 Windows 注销、关机或重启时可能发生的浏览器进程崩溃，以及高负载下快速切换菜单的崩溃，并回移 Chromium、ANGLE、V8 上游修复。Forkline 产品代码、Web 菜单、Git 语义、便携版 Git 快进更新、NSIS `electron-updater` 和国内加速信任边界均未改变。
- 提交前完整自动回归为 `364/364`，0 失败、0 跳过，总耗时约 `119.5` 秒；真实 Chromium 4000 文件冷扫描为 `311.8 ms`，低于 `350 ms` 门限。`npm.cmd audit --audit-level=low` 为 0 个已知漏洞；使用一次性仓库缓存复跑 `npm.cmd outdated` 后无过期依赖，依赖树为 Electron `43.4.0`、electron-builder `26.15.3`、electron-updater `6.8.9`。
- 本机安装器 `Forkline-Setup-0.4.7-windows-x64.exe` 为 `100,615,388` 字节，SHA-256 `792de7e45b9da71bd4972118f06f4e87095dde2cd53cadfed174730151933063`，SHA-512 `7AFrbWfTgP11sbUU7NAVxdbDPNvLZSJ/6DyVLlV9hM7AdrWi+D0PljgfB7MFZVRQEnTBjrdE9kTcLsQjGLI5PA==`，Authenticode 为 `NotSigned`。blockmap 为 `105,369` 字节、SHA-256 `a1445919b41e9b8a46abbccf7e3508ae5966d74667d56a5f6474ac76d032e1e2`；`latest.yml` 为 `369` 字节、SHA-256 `59301b2bf6a44a4b8b6fbd6b21e4d6e49841395ffcf755585feb1b790333a551`，版本、文件名、大小和 SHA-512 均与 EXE 一致。
- 打包目录 `app.asar` 为 `5,217,613` 字节、SHA-256 `9b5ea34efa8432a8dfbf313e6146866eb51d5fc524c168a973f878698097a0b1`；内部版本为 `0.4.7`、入口为 `electron/main.js`、保留 `electron-updater ^6.8.9`，5 个关键脚本与工作树逐字节一致。源码 Electron 和安装版 CDP 均确认用户代理包含 `Electron/43.4.0`，正式仓库与 `package.json` 可正常打开，未出现新增诊断或控制台错误。
- 本机完成 `v0.4.6 → v0.4.7` 覆盖安装、卸载保留用户数据和全新安装回 `D:\Forkline`，三个安装器进程退出码均为 `0`。最终程序文件版本为 `0.4.7`、产品版本为 `0.4.7.0`，HKCU 登记为 `Forkline 0.4.7`，卸载命令为 `"D:\Forkline\Uninstall Forkline.exe" /currentuser`；桌面和开始菜单快捷方式均指向 `D:\Forkline\Forkline.exe`。安装版 `currentVersion=0.4.7`、`installMode=nsis`，关闭后无 Forkline 进程残留。
- `%APPDATA%\forkline\desktop-ui-preferences.json` 和 `desktop-preferences.json` 与安装前备份 SHA-256 完全一致；窗口状态只因正常启动关闭而更新。最近仓库在安装前后均为 `5` 条，路径、名称和分支语义一致，只更新当前正式仓库的 `lastOpened`。验证备份在完成逐项比对后已经按用户要求删除，不再是可用恢复来源；当前用户数据继续保留。
- 本轮精准删除 `dist` 下的本机构建、CDP/ASAR 脚本、两个测试配置、验证备份和一次性 npm 缓存，共 `474,254,953` 字节（约 `452.3 MiB`）。原有 v0.3.0 便携 ZIP 与校验文件、`D:\Forkline` v0.4.7、真实用户数据，以及 updater 的 `installer.exe`/`current.blockmap` 差分基线均保留；真实 updater 目录没有 `pending`。受保护异常未跟踪文件继续为 0 字节、SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，未删除、未修改、未暂存、未提交。
- 正式 Release 仍必须由新的不可移动 `v0.4.7` 注释标签触发安装器和便携包工作流；本机产物已经清理，不能上传冒充正式附件。当前 GitHub CLI 凭据失效，恢复认证后才可推送、创建标签和 Release；随后必须核对六个正式附件、GitHub digest、校验文件、`latest.yml`、未签名风险和国内节点下载，再从正式 v0.4.6 安装版执行软件内更新到正式 v0.4.7。不得移动 `v0.4.6` 或任何既有标签。

## v0.4.7 正式发布与软件内更新验收

- Release：[Forkline v0.4.7](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.7) 为 Latest、非草稿、非预发布；不可移动的注释标签 `v0.4.7` 固定解引用到发布提交 `90a0d7071f354a66d0a40a3ae1679984757c9cd2`。安装器工作流 [31780695796](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31780695796) 与便携包工作流 [31780695825](https://github.com/AsphyxiaChoke/Forkline/actions/runs/31780695825) 均在该提交上成功，正式自动回归为 `364/364`，只有 GitHub Actions Node 20 弃用提示。
- 正式 EXE 为 `100,612,066` 字节、SHA-256 `d52eec77a9953819ee879be666ffec02222f8e5ffd63eda67ebeed6f5e26d5c3`；blockmap 为 `105,351` 字节、SHA-256 `da17581b906a1209cb0ac05fdd223eb50d2042cae03dce3c83d0fa213bf3bb9a`；EXE 校验文件为 `102` 字节、SHA-256 `6cba9fa5275273da61d6ef73c28620ab5612d127fc6ae38c3fd1d339d4a9d39f`。
- 正式便携 ZIP 为 `36,718,092` 字节、SHA-256 `4b3082ca0a5657aaad3af1a636c5cce7d17a581f8aff317c3e7df19580d54715`；ZIP 校验文件为 `99` 字节、SHA-256 `df08de3f5e10df22d78d12d3e384e5aa749e1139f9187981810252c27e8aa885`。ZIP 已确认包含 `.git`、`runtime/node.exe`、源码、文档和启动脚本，继续使用原 Git 快进更新。
- `latest.yml` 为 `369` 字节、SHA-256 `6cb5f5c13c651710a68e25e633501d9c281b0edef632023dad3897254f909d48`；版本、文件名、大小和 SHA-512 `kn2kYPBIV+oSHA6128wssEKfFyhm7058zyiJj0HO/smgo1Uz5kHExiKmaAIX2tUqGmNJJAZF2fqINM396GLUZA==` 均与正式 EXE 一致。六个附件全部匹配 GitHub digest，安装器 Authenticode 为 `NotSigned`，Release 中的未知发布者和 SmartScreen 风险说明继续有效。
- 软件内终验先把 GitHub digest 匹配的正式 v0.4.6 安装到 `D:\Forkline`，真实设置页确认 `currentVersion=0.4.6`、`latestVersion=0.4.7`、`installMode=nsis`、5 条最近仓库和可用的“立即更新并重启”按钮。点击并确认后，页面记录下载进度从 `0%` 到 `100%`，旧实例退出并完成安装，随后 updater 自动启动带 `--updated` 参数的新 v0.4.7 实例。
- Chromium 全局网络日志确认运行时更新实际请求 `https://ghfast.top/https://github.com/AsphyxiaChoke/Forkline/releases/download/v0.4.7/...`：blockmap 返回 `200` 且长度 `105351`，安装器通过同一受限 URL 发起字节范围请求。官方 GitHub `latest.yml` 和 SHA-512 继续作为信任根；本机 updater 缓存 `installer.exe` 为 `100,612,066` 字节，SHA-256、SHA-512 与正式附件完全一致，Authenticode 为 `NotSigned`。
- 更新后独立 CDP 终验确认用户代理为 `Electron/43.4.0`，设置页当前/最新均为 `v0.4.7`、显示“已是最新版本”，`installMode=nsis`。真实工作区文件行可正常打开和关闭，0 字节内容显示为 `UTF-8 · LF · 0 B`，冲突版本安全归一化，没有新增错误诊断或控制台错误；受保护异常文件的长度、写入时间和 SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` 均未变化。
- `desktop-preferences.json` 与更新前备份 SHA-256 同为 `326886b370dc6365ba8016545bcac8fa99362fcc510294f30c269fd43370797d`；本轮验收产生的 7 条长任务诊断已从已验证备份原子恢复，`desktop-ui-preferences.json` 最终 SHA-256 回到 `9e7e3e89a26e2c7ff9111ed9f30fef71ff402dff6f0fef09a4933d1ead36d10c`。5 条最近仓库的路径、名称和分支完全一致，仅当前仓库 `lastOpened` 正常更新；窗口状态只发生正常启动关闭变化。
- 最终程序文件版本和 HKCU 登记均为 `0.4.7`，卸载命令仍为 `"D:\Forkline\Uninstall Forkline.exe" /currentuser`。正常关闭最终窗口后 Forkline、后台服务及其子进程立即为 `0`，继续等待 `30` 秒仍无二次拉起。
- 精准删除本轮 `dist\release-validation-v0.4.7` 与 updater 已消费的 `pending`，共 `575,990,052` 字节（约 `549.3 MiB`）。保留 updater `installer.exe`/`current.blockmap` 差分基线、两份 v0.3.0 正式便携产物、`D:\Forkline` v0.4.7 和真实用户数据；本轮未删除早于当前任务的 npm 或浏览器缓存。本轮只追加发布验收文档，不修改已发布产品或移动任何标签。

## v0.4.8 发布前本机验收

- 性能门禁在当前无 `5177` 监听服务的正式仓库基线下重新验证：真实 Chromium 4000 文件冷 API `281.8 ms`，完整回归中的冷 API `325.4 ms`，均低于不可放宽的 `350 ms`；没有修改门限或测试以规避失败。
- 完整自动回归为 `385/385`，0 失败、0 跳过；依赖审计为 0 个漏洞，Node 语法和差异检查通过。本机构建使用 electron-builder `26.15.3`、Electron `43.4.1`。
- 本机 NSIS 产物：`Forkline-Setup-0.4.8-windows-x64.exe` 为 `104,605,702` 字节，SHA-256 `90a005f85afb508710a0852479f26cc273ea1df0342aa13f5550692258eaae04`；blockmap 为 `111,627` 字节，SHA-256 `053a0b585820bb3dd7cc3979aef5591c94c16e95c6a3b439935ee40e9388dc65`；`latest.yml` 为 `369` 字节，SHA-256 `02c9395eb8819a48dd886fad96aeb578f45e3471d93dd5cc44fe7a347ffcc35`；EXE Authenticode 为 `NotSigned`。本地生成的 `.sha256` 文件为 `102` 字节，内容与 EXE SHA-256 一致。
- 临时安装器验证使用当前用户模式和独立目录 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.8-local-e2e`：安装退出码 `0`，文件/产品版本为 `0.4.8/0.4.8.0`，HKCU 登记和桌面/开始菜单快捷方式正确；启动后主窗口标题为 `Forkline Web`，后台服务端口 `57843`、首页和核心状态均 HTTP `200`，正常关闭后进程树归零。
- 临时卸载退出码 `0`，安装目录、登记和快捷方式已移除；`%APPDATA%\forkline` 及四个稳定用户数据文件仍存在且字节数/哈希未变。现有 `D:\Forkline` v0.4.7 保持不动。
- 正式发布仍需在不可变 `v0.4.8` 标签上由 Release 事件触发安装器和便携包工作流；本机产物不能冒充正式附件。发布说明必须继续明确当前用户安装、可选目录、桌面/开始菜单快捷方式、用户数据保留、未签名/未知发布者和 SmartScreen 风险，以及更新前优雅停止 Forkline、Git、SSH 子进程。

## v0.4.8 正式发布与软件内更新验收

- 正式 Release：[v0.4.8](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.8)，Release ID `375395807`，发布提交 `377c7fe7c1dc19e4b060894fca55deb00a1ab16f`；安装器工作流 `32681983878`、便携包工作流 `32681983853` 均成功。`v0.4.8` 是当前正式版本，既有 `v0.4.0` 至 `v0.4.7` 标签未移动。
- 六个正式附件及 digest：`Forkline-Setup-0.4.8-windows-x64.exe` `104602003` 字节 / `be63579913237ddbdba4b2e8b9af5b1f514aa02b9fa71e942c9abdeb53ccdee1`；对应 blockmap `111478` 字节 / `d8d9528ecdfe85b9bdf76a1eb472c30a252510a6808f98267ba7f7957938f8da`；EXE `.sha256` / `fc7a9a05f26126f1bbce8eb0614e0a3633d871f9628ffad2fe2c6292c271bb73`；便携 ZIP `36769362` 字节 / `3f0e3ec9d4036e9cf044f5b79471d283e35c04aff2528c1cc08f3bae53627489`；ZIP `.sha256` / `afabe91fe67552332f0a811d5423989f2d55d4dcb8b4a34dd44555bb64728432`；`latest.yml` `369` 字节 / `932cb1aeef1abd489cc3fd46094966f18028a6684879e8bfcd7e2b42eedeaab9`。`latest.yml` 的 EXE SHA-512 为 `BJIy1UJefOvD9qaHXDxvtuFx5/jjebVzE3rSzirl4TEv9nK1MBdpdl+K3ZzmTZbgvCZ/yzfX1Ikf0NHjGF24Ww==`。
- 安装包是当前用户 NSIS 安装、可选安装目录、默认桌面/开始菜单快捷方式；正式 EXE 的 Authenticode 状态为 `NotSigned`，发布说明必须保留未知发布者和 SmartScreen 风险。便携包保留 `.git` 与内置 Node 运行时，继续走原 Git 快进更新，不使用 NSIS updater。
- 软件内更新终验采用临时隔离 v0.4.7 基线，而不是不存在的 `D:\Forkline` 现场。更新前页面状态为 `v0.4.7 → v0.4.8`，点击确认后旧服务停止；更新后安装目录 EXE/产品版本为 `0.4.8/0.4.8.0`，随机后台端口 `59137` 返回首页和核心状态 `200`，无运行操作、Git/SSH 子进程为 `0`。
- 更新后真实 Electron 设置页确认当前/最新均为 `v0.4.8`、状态“已是最新版本”，并确认中文、深色、`80%` 缩放和最近仓库仍可用。正常关闭后安装版进程、后台服务和监听端口均归零；用户数据目录 `%APPDATA%\forkline` 保留，稳定偏好字段和最近仓库语义保留。
- 隔离 v0.4.7 安装的已知现场异常：静默安装退出码为 `0`，但没有可见 HKCU 卸载登记；静默卸载退出码为 `0`，快捷方式被移除但安装目录文件仍在。因此本轮只把“更新后运行和退出”判为通过，把“该静默安装的标准登记卸载”判为异常并记录，不能混淆两者。确认无进程占用后，已删除明确的 `forkline-v0.4.7-update-e2e` 与 `forkline-v0.4.7-update-assets-20260824` 临时目录；未删除真实用户数据或 updater 基线。
- `n+fs.statSync(p.join('public'` 继续作为保护对象，长度 `0`、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，不得进入暂存区或提交。后续回滚应使用新的文档/修复提交，禁止移动任何既有标签。

## v0.4.9 发布准备

- v0.4.9 收尾了 Git 忙碌提示中文化、“更多”面板重复打开、工作区/暂存区筛选范围全选、Toast Escape 关闭、快捷键说明和提交图谱水平滚动问题；Web、源码克隆和便携版继续使用原 Git 快进更新，NSIS 安装版继续使用 `electron-updater`。
- NSIS 仍为当前用户安装、可选择目录、默认运行安装后程序，并创建桌面和开始菜单快捷方式。为保证重装时也恢复桌面快捷方式，`createDesktopShortcut` 使用 electron-builder 支持的 `"always"` 策略；该策略不改变安装目录或更新语义。
- 本机构建安装器 `Forkline-Setup-0.4.9-windows-x64.exe`：`104606437` 字节，SHA-256 `09f38e2a9c06ae17038f0716bf41dba7c113ad9379405590a11c7fe961c3f7d3`；blockmap：`111630` 字节，SHA-256 `4848f743c97dd40c31919e6426df7f0bd6b17a6f5eedf433f52f64111303a548`；`latest.yml`：`369` 字节，SHA-256 `b39850cd5deae8a13925e35e6720e44564f77511bc32345f68258c42b23cb243`。`latest.yml` 版本为 `0.4.9`，文件大小和 SHA-512 `MB+dtLVJB/md5ahvUDOhMySApSuoerd8PvpOardxlmQd2Hg5Nb5anvbv5tAlZ+bYs4wfv/u5/FGD6MTwMU0CdQ==` 与安装器一致；Authenticode 为 `NotSigned`。
- 真实交互式安装到 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.9-interactive-final2` 后，`Forkline.exe`/产品版本为 `0.4.9/0.4.9.0`，HKCU 登记为 `Forkline 0.4.9`，后台服务监听 `63247`，窗口标题为 `Forkline Web` 且响应正常。桌面快捷方式为 `D:\桌面\Forkline.lnk`，开始菜单快捷方式为 `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Forkline.lnk`；两者目标、工作目录和图标均指向该隔离安装目录。
- 该交互式临时实例正常关闭后 Forkline 进程归零；卸载器退出码为 `0`，安装目录、HKCU 登记和两个快捷方式均已移除。已有用户手动安装的 `D:\Forkline` 未被本轮清理。
- 本轮门禁：`node --check` 全部通过；`npm.cmd test` 为 `389/389`；`npm.cmd run test:browser` 为 `1/1`；`git diff --check` 通过。正式 Release 仍必须在不可变 `v0.4.9` 标签上由两条 GitHub Windows 工作流重新构建并核验六个附件、digest、`.sha256` 和 `latest.yml`，本机构建产物不能冒充正式附件。

### Notes

- `package.json`、`tests/installer-package.test.js`：把桌面快捷方式策略改为 `"always"` 并更新安装器契约测试。
- `docs/PACKAGING.md`、`docs/CONTINUE.md`、`progress.md`：追加 v0.4.9 发布准备、安装器产物、交互式安装/卸载和最终门禁记录。
- 回滚方式：提交前执行 `git restore -- package.json tests/installer-package.test.js docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后使用 `git revert <本轮提交>`。不得触碰异常未跟踪文件、`.playwright-cli/` 或任何既有标签。

## v0.4.9 正式发布与验收

- 正式 Release：[Forkline v0.4.9](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.9)，发布提交为 `ea43966a2ff5295aedf528bc3578eb61f5dbcbf5`；`v0.4.9` 为注释标签，标签目标与该提交一致，未移动 `v0.4.0` 至 `v0.4.8` 任一既有标签。
- 安装器工作流：[32747708600](https://github.com/AsphyxiaChoke/Forkline/actions/runs/32747708600) 成功；便携包工作流：[32747709108](https://github.com/AsphyxiaChoke/Forkline/actions/runs/32747709108) 成功。安装器工作流自动测试通过；仅有 GitHub Actions Node.js 20 弃用提示。
- 正式六个附件均为 `uploaded`：安装器 `104603086` 字节 / SHA-256 `9ee113acb86258f92feb38c88808e017884dd314b357a159898b87936eab23ba`；安装器 blockmap `111568` 字节 / `38af1e141d2acda34147c017608837e044bdf86843fee3834524451c0c6b27da`；安装器 `.sha256` `102` 字节 / `4fd674d5971332d7aeb644074732bcc2c18cc96245903910ff46fb6242873465`。
- 便携 ZIP `36789411` 字节 / SHA-256 `9c358d2bd5556938139b2ed38888bb301c190758b9fa2180de970307ab1e6fee`；ZIP `.sha256` `99` 字节 / `6a955716ccd57996c064cd0732fc79becc8951dcb42e5d3b153cbcba8a18d051`；`latest.yml` `369` 字节 / `220958d62114a2c658897cf0e5bdaeee570c0cb154afb47b47271257593c3cce`。
- 六个附件重新下载后的本机 SHA-256 全部匹配 GitHub API digest；两个 `.sha256` 文件分别匹配 EXE 和 ZIP；`latest.yml` 的版本 `0.4.9`、安装器大小 `104603086` 和 SHA-512 `MB+dtLVJB/md5ahvUDOhMySApSuoerd8PvpOardxlmQd2Hg5Nb5anvbv5tAlZ+bYs4wfv/u5/FGD6MTwMU0CdQ==` 均匹配。GitHub 直连大文件下载在本机卡在 0 字节，随后通过固定 Release 代理重新下载并以官方 API digest 复核，代理不作为信任根。
- 正式便携 ZIP 已确认保留 `.git`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd`、源码和 `docs/`；继续使用原 Git 快进更新。正式安装器 Authenticode 为 `NotSigned`，Release 说明已标注未知发布者和 SmartScreen 风险。
- 正式 Release 发布说明为中文，明确当前用户安装、可选目录、桌面/开始菜单快捷方式、`electron-updater`、更新前优雅停止 Forkline/Git/SSH 子进程、Web/便携版 Git 更新边界和未签名风险。
- 发布后最终工作区文档收尾只追加本节；`v0.4.9` 标签继续固定在产品提交，不将后续文档提交回写到该标签。

### Notes

- `docs/PACKAGING.md`、`docs/CONTINUE.md`、`progress.md`：追加正式 Release、工作流、六个附件 digest、下载复核和便携 ZIP 内容验收。
- 回滚方式：提交前执行 `git restore -- docs/PACKAGING.md docs/CONTINUE.md progress.md`；提交后使用 `git revert <本轮文档提交>`。不删除 Release 附件，不移动任何标签，不触碰异常未跟踪文件或 `.playwright-cli/`。
- 发布收尾后保留的 `D:\Forkline` 已用同一 v0.4.9 安装器恢复当前用户登记和快捷方式：HKCU 显示 `Forkline 0.4.9`，卸载命令指向 `D:\Forkline\Uninstall Forkline.exe`，桌面和开始菜单快捷方式均指向 `D:\Forkline\Forkline.exe`；程序文件版本仍为 `0.4.9/0.4.9.0`。

## v0.4.10 发布准备

- v0.4.10 修复文件编辑器 Diff 高亮导致的代码文字不清晰问题，并增加页面级“撤销/恢复”：安全的暂存、取消暂存和提交操作可以撤销、恢复；暂存撤销只恢复 Git index，不修改工作区文件。输入框、文本域和 CodeMirror 继续使用原生编辑撤销行为，Web、源码克隆、便携版更新语义和 NSIS `electron-updater` 边界不变。
- `package.json`、`package-lock.json` 和安装器契约测试已同步到 `0.4.10`。本机构建使用 electron-builder `26.15.3`、Electron `43.4.1`；默认 Electron 下载在本机网络中停留在约 1%，因此构建时使用本机已校验的 Electron 发行目录，缓存压缩包 SHA-256 为 `c2ef9a5f65472c34d14bd3e67b7d14e66b0c01f124aba45263d6a4232160e13a`。这只影响本机构建输入，GitHub 工作流仍按工作流自身的标准 Electron 下载流程构建。
- 本机构建安装器 `Forkline-Setup-0.4.10-windows-x64.exe`：`104691603` 字节，SHA-256 `5af9f04c0e0348b27bdfbf6fdc91d2f9d1a571864f989ee906a08ec47b678dc7`；blockmap：`111514` 字节，SHA-256 `2efb6ab9e451a33ef1461a689d6831bf0027881952c66ddf1cfddd3af9fc2b96`；`latest.yml`：`372` 字节，SHA-256 `c8504eb014472df08f633df62559c88755323f820da55b011ca5ce7fc5263ee5`。`latest.yml` 版本为 `0.4.10`，安装器大小和 SHA-512 `mXjwQsQUXk6pSW2VAcVNdE/1r115HyrfLFk83oP7VDj6mz3iq7ZO1jnRu4OjxXue41AA1B24KcYi2khPWRbW7g==` 与安装器一致；Authenticode 为 `NotSigned`。
- 当前版本完整回归为 `394/394`，0 失败、0 跳过；`npm.cmd run test:browser` 为 `1/1`，4000 文件工作区冷 API `337.4 ms`，低于 `350 ms` 门限。Node 语法检查、`git diff --check` 和安装器契约测试均通过。
- 在隔离目录 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.10-e2e` 完成当前用户静默安装，安装器退出码为 `0`，程序文件/产品版本为 `0.4.10/0.4.10.0`。使用独立 TEMP 用户数据启动后，真实窗口标题为 `Forkline Web`，设置页显示当前版本 `v0.4.10`，后台首页和核心状态接口返回 `200`；关闭后该安装目录的 Forkline 进程、后台端口和调试端口均为 `0`。现有 `D:\Forkline` 保持为 `0.4.9`，未覆盖。
- 本机静默卸载器退出码为 `0`，但未生成可见 HKCU 卸载登记和快捷方式，卸载后隔离目录仍存在；因此这次只把“安装文件、启动、页面版本、后台服务、关闭”判为通过，不把静默卸载写成标准交互式卸载通过。交互式 NSIS 的目录选择/快捷方式配置仍由安装器契约测试和既有 v0.4.9 交互式验收覆盖，正式发布说明继续标注当前用户安装、可选目录、桌面/开始菜单快捷方式和未签名 SmartScreen 风险。
- 正式发布仍待提交、推送，并在不可移动的 `v0.4.10` 标签上由安装器和便携包工作流重新构建；本机构建产物不能直接冒充正式 Release 附件。

## v0.4.10 独立编辑器与安装器重建验收

- 针对当前工作树重建 Windows x64 NSIS 安装器：`Forkline-Setup-0.4.10-windows-x64.exe` 为 `104609975` 字节，SHA-256 `072C1C0F36731B78ADE0BD07CA94AB8A01C03E78A97A3FE9C1FEB7D3A28A99DF`；blockmap 为 `111642` 字节，SHA-256 `3A252AD32FD662E9DF23B833B03E0B9AF16F1119F1C39AC5F0376A5927B7CA9A`；`latest.yml` 为 `372` 字节，SHA-256 `23D6DAA836E7868451A2423D1978D79008FD6DBB1900CBDBA374D9A271184B53`。
- `latest.yml` 版本为 `0.4.10`，安装器大小和 SHA-512 `v1omGzGSXFYkvCOCZSoVzwDfcSzLRVsp+mip6pjnQNC0jMhrETp5QUGzo19ETzz4ZfM/0pVbQQl8OfBFvqfcmQ==` 与本机构建安装器一致；Authenticode 为 `NotSigned`，正式发布说明必须继续标注未知发布者和 SmartScreen 风险。
- 隔离安装器退出码为 `0`，安装文件版本为 `0.4.10/0.4.10.0`。从隔离用户数据启动后，正式仓库页面加载成功，核心状态接口返回 HTTP `200`；主窗口与独立文件编辑器子窗口均完成真实验证，关闭子窗口后无编辑器调试页，停止临时实例后 Forkline 进程归零且服务端口不再监听。现有 `D:\Forkline` 未被覆盖。
- 静默卸载器退出码为 `0`，但本次仍观察到未生成可见 HKCU 卸载登记、未清理临时安装目录的现场异常；开始菜单中的既有快捷方式目标为 `D:\Forkline`，不是本轮创建对象，因此未删除。临时安装目录和三个临时用户数据目录在进程归零后已按明确路径清理。
- 自动回归：`npm.cmd test` 为 `398/398`，`npm.cmd run test:browser` 为 `1/1`；构建、独立编辑器窗口、固定 IPC、真实仓库页面和关闭流程均有证据。上述本机产物仅作验收，不可直接冒充正式 Release 附件。

## v0.4.10 正式 Release 验收

- 正式 Release：[Forkline v0.4.10](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.10) 已创建，为正式版、非草稿、非预发布；不可移动的 `v0.4.10` 标签解引用到 `15826d52e341a2fc17ec8855ae9bcde76acec678`，`v0.4.9` 仍固定在 `ea43966a2ff5295aedf528bc3578eb61f5dbcbf5`。
- 安装器工作流 [33134728084](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33134728084) 和便携包工作流 [33134728147](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33134728147) 均成功；正式 Release 说明为中文，明确 Windows x64 当前用户安装、可选目录、桌面/开始菜单快捷方式、`electron-updater` 更新边界、更新前优雅停止 Forkline/Git/SSH 子进程和未签名 SmartScreen 风险。
- 六个正式附件均为 `uploaded`，本机重新下载后 SHA-256 与 GitHub Release API digest 全部一致：安装器 `104606321` 字节 / `c9b6be0153ec05663b9a2c4fa7c15d424bd6a7f248169c5e5552b9da06999320`；blockmap `111672` 字节 / `91e1a724995314ef81dadb3c7733ac86b422c932efd10e1780a4024828874878`；安装器校验文件 `103` 字节 / `8a627971cfe16d28240b4db963173c9e8fa0ab8c7111ad3e55be63d424805a21`；便携 ZIP `36822241` 字节 / `738511f90f0644c8a3a3554142865afb7d53a882f3918c08b1ae26961b6521e7`；ZIP 校验文件 `100` 字节 / `e85b9cbac41d394feacbf78fe792b3f8ed253a68343d1559438319f5fa848602`；`latest.yml` `372` 字节 / `09fcf2833c4d2302e48c3da49be6eab8773ddf4614fef1bc324f6b77abf7094d`。
- 两个 `.sha256` 文件分别匹配安装器和便携 ZIP；`latest.yml` 版本为 `0.4.10`，安装器文件名、大小 `104606321` 和 SHA-512 `sSm6BmOKpqa85ZlDj/VucymFjx10amMHW3xkMpEYDtqltA4YgpCmwRl0ZfJBfLBo1Bqlblm2pkLYftsqgPXt6Q==` 均与正式安装器一致。正式安装器 Authenticode 为 `NotSigned`。
- 便携 ZIP 已确认保留顶层目录下的 `.git`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd`、源码、测试和 `docs/`；便携版继续使用现有 Git 快进更新，不使用 NSIS updater。当前 Release 验收下载目录为 `C:\Users\Administrator\AppData\Local\Temp\forkline-v0.4.10-release-audit-20260828-101658`。
- 正式附件验收至此完成。仓库中的异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍为 0 字节、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，`.playwright-cli/` 仍未跟踪；二者均未修改、暂存或提交。

## v0.4.11 发布准备

- v0.4.11 将 Issue #5 的工作区/暂存区目录选择改为 Windows 文件夹式可点击行：目录图标、名称和改动数量组成选择行，左侧箭头只负责展开/折叠；目录全选、取消选择、Ctrl/Cmd 多选、Shift 文件范围选择和虚拟化仍保持原语义。Web、源码克隆、便携版和 NSIS 安装版共用同一文件树实现。
- `package.json`、`package-lock.json` 和安装器契约测试已同步到 `0.4.11`。Web、源码克隆和便携版继续使用原 Git 快进更新；NSIS 安装版继续使用 `electron-updater`，安装更新前优雅停止 Forkline 后台服务及其 Git/SSH 子进程。
- 本机构建安装器 `Forkline-Setup-0.4.11-windows-x64.exe` 为 `104610247` 字节，SHA-256 `44044ad351ea3008f7d78598b9c7f921d1199a6c5c279fa73133bb63fd116064`；blockmap 为 `111564` 字节，SHA-256 `beefa5843fd9ae6437ea46e1c9925de5e68f2ffb6ee8fa1fe021a3d742e93447`；`latest.yml` 为 `372` 字节，SHA-256 `b397b7f7953f5d4b59835ce0a03710378182c48fdc3e2caf9c491c7d896956db`。`latest.yml` 版本、安装器文件名、大小和 SHA-512 `Hc3PQhK94mob5sSpv8itX0NgrWvJmcMBnumGvbuVWnzGihLc4tX1ofZMkeVF2ZrbBxgdioF7M2jURRAxxRg95w==` 均匹配；Authenticode 为 `NotSigned`。
- `npm.cmd test` 为 `399/399`，`npm.cmd run test:browser` 为 `1/1`；4000 文件工作区冷 API 为 `328.4 ms`，低于 `350 ms` 门限。`node --check tests\\installer-package.test.js` 和 `git diff --check` 通过。
- 隔离当前用户静默安装退出码为 `0`，安装目录生成程序和卸载器。无兼容性启动参数时，本机 Electron GPU 子进程因环境 DLL/图形能力异常退出；使用仅用于本机验收的 `--no-sandbox --disable-gpu --disable-gpu-compositing --disable-features=VizDisplayCompositor` 参数后，真实安装版后台监听 `127.0.0.1:56572`，首页和 `/api/state?details=core` 均 HTTP `200`，`/api/app-update` 显示当前版本 `0.4.11`。
- 本轮静默安装未生成该临时目录对应的可见 HKCU 卸载登记或快捷方式；静默卸载器退出码为 `0`，但未清理该临时安装目录。该现象按异常记录，不能写成标准交互式安装/卸载通过；现有 `D:\Forkline` 程序、登记和桌面/开始菜单快捷方式未触碰。
- 正式发布仍需在本轮提交推送后创建不可移动的 `v0.4.11` Release，由安装器和便携包工作流构建正式附件，再核对六个附件、GitHub digest、两个 `.sha256`、`latest.yml` 和便携 ZIP 内容。安装器未签名、未知发布者和 SmartScreen 风险必须保留在中文发布说明中。

## v0.4.11 正式 Release 验收

- 正式 Release：[Forkline v0.4.11](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.11) 已创建，Release ID 为 `378355055`，为正式版、非草稿、非预发布；`v0.4.11` 标签固定指向提交 `330bbf4209e8ad37148b8a9bf01c389fce4d2971`，`v0.4.9` 和 `v0.4.10` 标签未移动。
- 安装器工作流 [33156145227](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33156145227) 和便携包工作流 [33156145225](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33156145225) 均成功；中文发布说明已确认发布。
- 六个正式附件均为 `uploaded`，本机重新下载后 SHA-256 与 GitHub Release digest 全部一致：安装器 `104606205` 字节 / `f975eebc5d4d6a6ecf6efd7c3614d26b5971b6620b175d992bd11e1d6ffacbc9`；blockmap `111538` 字节 / `581d20d371176f6e9f67b2b9414c4cbaa6b5eabcc012b73680405f782ba7b7ff`；安装器校验文件 `103` 字节 / `d1970e246629a5923ea0ff2c1e0c3073e3320b92711ccbcbda0da9d6c294e018`；便携 ZIP `36832097` 字节 / `bc94b72015dcecdb120a3fcb0f28c9136f9d82eff1137601d32bdcc9feb418d5`；ZIP 校验文件 `100` 字节 / `0e6e668423516ff971329f449da68af444ec3f9af9721cd3c0d08b0032a7470f`；`latest.yml` `372` 字节 / `56290878d2ff8917fa4d4c95918b292236b516236017110c1b5f19838ad3a677`。
- `latest.yml` 的版本为 `0.4.11`，安装器大小为 `104606205`，SHA-512 为 `mdTLbsXQzPYPgVvL8D59GnFTOP8bY95xnSHUup/SvJHTQH1jrWVLxlAailv75EwfatuxWMxVZxe3jpQAvqzXYA==`；两个 `.sha256` 文件分别匹配安装器和便携 ZIP，便携 ZIP 保留 `.git`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd`、源码和 `docs/`。
- 正式安装器 Authenticode 为 `NotSigned`，发布说明已标注未知发布者和 SmartScreen 风险；安装版继续使用 `electron-updater` 并在更新前优雅停止 Forkline 后台服务及 Git/SSH 子进程，Web、源码克隆和便携版继续使用原 Git 快进更新。
- 正式附件验收完成。`n+fs.statSync(p.join('public'` 仍为 0 字节、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`，`.playwright-cli/` 仍未跟踪；二者均未修改、暂存或提交。

## v0.4.12 Issue 修复发布准备

- v0.4.12 汇总 Issue #10、#9 和 #1 的修复：便携包明确使用 `Forkline-v<version>-windows-x64-portable.zip` 并与 GitHub `Source code (zip)` 区分；Electron 独立编辑器预留 Windows 原生标题栏区域；Diff 变更文本使用主题已有的高对比前景色并保留低浓度背景、边框和下划线。
- Web、源码克隆和便携版继续使用现有 Git 快进更新；NSIS 安装版继续使用 `electron-updater`，安装更新前优雅停止 Forkline 后台服务及 Git/SSH 子进程。安装器仍为当前用户、可选目录、默认桌面和开始菜单快捷方式，未签名风险继续写入中文发布说明。
- 当前工作树版本已升至 `0.4.12`，旧 `v0.4.0` 至 `v0.4.11` 标签保持不变；正式 Release 需从新的不可移动 `v0.4.12` 标签构建，不覆盖既有 Release。
- 本地自动验证：`npm.cmd test` 为 `399/399`，`npm.cmd run test:browser` 为 `1/1`；Issue #1 定向回归、安装器/便携包契约、Node 语法检查和 `git diff --check` 均通过。远端 Issue 关闭、推送、两条 Windows 工作流和六个正式附件验收仍待 GitHub 写权限恢复后执行。

## v0.4.12 本机安装器构建验收

- 本机构建 `Forkline-Setup-0.4.12-windows-x64.exe` 成功，文件大小 `104610372` 字节，SHA-256 `5fdb54c89316c276474cd7b2532265d382196d3f81063daf8352fdbcbd86159f`；blockmap 大小 `111592` 字节。
- 本机 `dist/installer/latest.yml` 版本为 `0.4.12`，文件名为 `Forkline-Setup-0.4.12-windows-x64.exe`，大小 `104610372`，SHA-512 与安装器一致；Authenticode 状态为 `NotSigned`。正式发布以 GitHub Release 工作流附件为准，本机构建仅作本地验收证据，不能替代正式附件。

## v0.4.12 正式发布、全部 Issue 关闭与本机安装启动验收

- 正式 Release 已发布：[Forkline v0.4.12](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.12)。Release 为正式版、非草稿、非预发布，发布说明为中文；不可移动的 `v0.4.12` 注释标签固定指向提交 `b16fa69a5c92403a5acec6a0de8e1eddab7eee9b`。
- 标签验真确认 `v0.4.12` 的注释标签对象为 `c920c0c5be85e22ea0bc6d95330feae06768b07e`，标签目标为 `b16fa69a5c92403a5acec6a0de8e1eddab7eee9b`；`v0.4.0` 至 `v0.4.11` 均未修改。
- GitHub Actions 工作流均成功：安装器 [33322496291](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33322496291)、便携包 [33322496280](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33322496280)，均由 `v0.4.12` 发布事件触发。
- 六个正式附件均为 uploaded，并以 GitHub API digest 为信任根完成本机重新下载复核：安装器 104606262 字节 / SHA-256 `ba35f92178e0adc4c5551045aff04d6e9dc66adf37e93d10894ddea6ee069154`；blockmap 111597 字节 / `d5dc4c25c543d4770ed35e71aa23b2eeddf8295d6b4c7ba0fb512337f0956295`；安装器校验文件 103 字节 / `aa5488a333d3de50513b51f4de0d7d5b8a05d3eaa72a6038b58b4fe04f8f9b8b`；便携 ZIP 36848843 字节 / `d18e0175de9360be57a82321128ec9ae54d2737b159cd3f4b1ae3fe624e55eea`；便携 ZIP 校验文件 109 字节 / `2fa8c82cf81c5d4ff9acf1f91087e314699c0bf6d3f0f8643bce4ec8bf5ebac1`；latest.yml 372 字节 / `c8465de4e9d23cfc8d9a4571e5e92ba04b48e7eac4138187c1b57a6ac3c8b9f0`。
- latest.yml 版本为 0.4.12，安装器文件名和大小 104606262 一致，SHA-512 为 `HoSCCQwFNufkBYjHaioKRJxNeBOeMhU6OnGu/RtgoCbr8GTO86b7CBRwSnBPx5TU+2PvPaCx+DbNqG4TmQdsNg==`；两个 SHA-256 校验文件分别匹配安装器和便携 ZIP。便携 ZIP 顶层目录下确认保留 .git、runtime/node.exe、Forkline.cmd、start.cmd、package.json 和 docs/，继续使用原有 Git 快进更新语义。
- Release 继续保持产品边界：NSIS 安装版使用 electron-updater，更新前优雅停止 Forkline 后台服务及 Git/SSH 子进程；Web、源码克隆和便携版继续使用现有 Git 快进更新。安装器为当前用户安装、允许选择目录，默认创建桌面和开始菜单快捷方式；Authenticode 仍为 NotSigned，发布说明已标注未知发布者和 SmartScreen 风险。
- GitHub Issue 已全部收尾：当前开放 Issue 数为 0；#1、#9、#10 均已发布详细修复说明并关闭，#2 至 #8 也均已关闭。修复后的效果分别是：Release 页面能区分源码快照与可运行便携包；独立编辑器业务按钮与 Windows 原生窗口按钮分离且不重叠；Diff 新增/删除文本及 CodeMirror 语法子节点保持高对比度，同时保留低浓度背景和变更标记。
- 本机安装启动验收已完成，安装目录为 C:/Users/Administrator/AppData/Local/Temp/forkline-v0.4.12-interactive-final；Forkline.exe 产品文件版本为 0.4.12.0，卸载程序已生成。验收期间窗口标题为 Forkline Web，后台服务监听 127.0.0.1:62430，首页、核心状态、同步状态和操作状态接口均返回 HTTP 200；正常关闭后进程和服务归零。
- 按本轮验收约束未执行卸载操作，当前安装目录及卸载程序保留；因此不把卸载写成已验证或失败。受保护的异常未跟踪文件 n+fs.statSync(p.join('public' 仍为 0 字节、SHA-256 为 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`；.playwright-cli/ 未修改、未暂存、未提交。

- 发布完成后的当前主机严格性能复核出现环境相关波动：`npm.cmd test` 两次完整复跑均为 398/399，唯一失败为 4000 文件冷 API 超过固定 350 ms 门禁（372.8 ms、381.7 ms）；随后清理已识别的旧 forkline-e2e-0818b 测试进程树后，`npm.cmd run test:browser` 仍为 0/1，冷 API 为 399.5 ms。使用项目已有的诊断倍率 3 运行时全流程通过，冷 API 为 368.8 ms。v0.4.12 相对 v0.4.11 未修改 server.js 或 browser-performance.test.js，因此未将该主机复核波动归因于本版本代码，也未修改性能阈值；发布时已有的 399/399 与 1/1 验证记录保持原样。

## v0.4.13 文件双击查看修复准备

- v0.4.13 修复文件树单击切换与双击查看在编辑器读取期间竞争的问题。同一仓库、文件、来源和查看上下文共享一个进行中的打开请求，避免重复销毁/创建编辑器；切换仓库或目标文件不会复用旧请求。
- 当前版本、锁文件和安装器契约测试已升至 `0.4.13`；Web、源码克隆和便携版更新边界、NSIS `electron-updater`、当前用户安装和未签名风险说明不变。
- 自动回归包含加载器并发去重、切仓隔离和真实 Chromium 快速点击/双击阻塞读取场景。正式发布应使用新的不可移动 `v0.4.13` 标签，不覆盖 `v0.4.12` 或更早标签。

## v0.4.13 本机安装器构建验收

- 本机构建 `Forkline-Setup-0.4.13-windows-x64.exe` 成功，大小 `104610573` 字节，SHA-256 `04869302D471C4DF51A94435C6CC7458E8E2A6F3F2866DD2429A2376AC171A79`；blockmap 大小 `111744` 字节，SHA-256 `85B4EF737E25B9BF97F208CB687EA8099B8FF3EFE07AD8C8145A0C11B71DB14A`；`latest.yml` SHA-256 `776DA16DB5CC899CCC22215F97582B91D9443E33F86BB3C9F1661CA0C5584C5D`。
- `latest.yml` 版本为 `0.4.13`，安装器文件名为 `Forkline-Setup-0.4.13-windows-x64.exe`，大小为 `104610573`，SHA-512 为 `9wDnJNjfgsgvzRsmz6SYgyUeaotqlGCT69XDQ+ji5btuWnq/vPmhQq+HigFJhYS2fwnTBSmZ1vprNSXDXFsjeA==`；安装器产品版本为 `0.4.13`，Authenticode 为 `NotSigned`。

## v0.4.15 本机安装器构建验收

- 本轮针对文件双击查看偶发卡死风险增加了 `768 KiB` 内容前置分流；达到门限的工作区或历史文件在创建 `MergeView` 前使用两个轻量 CodeMirror，发布版本升至 `0.4.15`。Web、源码克隆和便携版继续使用原 Git 快进更新；NSIS 安装版继续使用 `electron-updater`。
- `npm.cmd run build:installer` 本机构建成功。`dist/installer/Forkline-Setup-0.4.15-windows-x64.exe` 为 `104610480` 字节，SHA-256 为 `C9273EADF43A64FB4C1D61F0D67736EBEACCE63C10DC44D2412F5BD0A8A9944E`；对应 blockmap 为 `111579` 字节，SHA-256 为 `6BD0890CC4926C90CD3CE7B589A79ED6F9D16A8438609E19BF14DD1BFF7C879C`。
- `dist/installer/latest.yml` 为 `372` 字节，SHA-256 为 `7CE290B3CB1C96A520726FB01B146BFE9080C991F6F79A756A677271856BF3A9`；版本、安装器文件名、大小 `104610480` 和 SHA-512 `VMUzRVTEO2m0gUBBFc/1vkNbfxBTGRn31YEwTIW7c/vya1wY7UAYZ1eh1SspcpouDpV8FQ1M+2W3Yti8N7wX/g==` 均与本机构建安装器一致。Authenticode 为 `NotSigned`，正式发布说明必须继续标注未知发布者和 SmartScreen 风险。
- 本轮定向编辑器回归为 `45/45`，真实 Chromium 回归为 `1/1`；约 `892 KB / 1900` 行工作区文件模拟两次单击加一次双击，打开约 `153.3 ms`，事件循环最大延迟约 `0.9 ms`，只执行 `1` 次打开和 `1` 次文件读取，创建 `0` 个 MergeView 和 `2` 个轻量 CodeMirror。按当前约束未执行卸载测试；本机构建产物不能替代 GitHub Release 工作流附件。
- 异常未跟踪文件 `n+fs.statSync(p.join('public'` 仍为 `0` 字节、SHA-256 为 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`；`.playwright-cli/` 仍未跟踪，二者均未修改、暂存或提交。回滚点为本轮提交，提交后使用 `git revert <v0.4.15 修复提交>`；不得删除、修改或移动 `v0.4.14` 及更早标签。

## v0.4.15 正式发布与附件验收

- 正式 Release：[Forkline v0.4.15](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.15) 已创建，Release ID 为 `379547673`，为正式版、非草稿、非预发布，并成为当前 Latest。发布说明已使用正常中文 Markdown；此前 `v0.4.14` 说明中的字面 `` `n `` 也已修正并复核。
- `v0.4.15` 为注释标签，标签对象为 `f9b8f758105577756c59cb1e65bdf07b51425166`，目标提交为 `fb028501c5419717391d57032ade0a559556a668`。`v0.4.14` 仍指向 `1bfd8da7914aab9a99ed3aa3a4acf738dcb1a710`，旧标签未移动。
- 安装器工作流 [33364075544](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33364075544) 与便携包工作流 [33364075498](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33364075498) 均成功，均由 `v0.4.15` Release 事件触发。
- 六个正式附件均为 `uploaded`，并完成本机代理下载与 GitHub API digest 对比：安装器 `104606898` 字节 / SHA-256 `336572c55c49efa111e1b83981e13c8e62792e0c4552f7a2a9d11b4daf56f8a2`；blockmap `111754` 字节 / `9209bbde3e340351e70c26f97f073b26ad205a15d15c06eee7b2903054de006b`；安装器校验文件 `103` 字节 / `5580b079916260a141477ed55c15c6d356d2c130ee5db063698ff4a0581b88ae`；便携 ZIP `36873766` 字节 / `b2c9479e27ab0d82fa2548a99a55587222cf5a52cfc41bc67d1cd63e801db7df`；便携 ZIP 校验文件 `109` 字节 / `9dc1f825f382f762b863daa18065ce432755c2e99bc45e7472442658970738d3`；`latest.yml` `372` 字节 / `dddb1b77bc83918e597ba25815cbbd879c3b0bcda43bbfd89be0c666e3bba52f`。
- 两个 `.sha256` 文件分别匹配安装器和便携 ZIP；`latest.yml` 版本为 `0.4.15`，安装器文件名和大小 `104606898` 一致，SHA-512 为 `3hKJFERUOwpwHTLgRNqnjl7wpGC0NjOc+hK29akXgH64MKee0zRmUClzloDYXQeUufsvNMzdKiQaSr3p+Sdj1Q==`。便携 ZIP 已确认包含 `.git/`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd`、`package.json` 和 `docs/`，继续使用原有 Git 快进更新语义。
- 正式安装器 Authenticode 为 `NotSigned`；Release 说明已明确未知发布者和 SmartScreen 风险。安装器继续为当前用户安装、允许选择目录、默认创建桌面和开始菜单快捷方式，并使用 `electron-updater`；更新前优雅停止 Forkline 后台服务及 Git / SSH 子进程。按本轮约束未执行卸载测试。
- 当前 GitHub 开放 Issue 数为 `0`。受保护异常未跟踪文件仍为 `0` 字节、SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`；`.playwright-cli/` 仍未跟踪，二者均未修改、暂存或提交。回滚点为本轮文档验收提交，提交后使用 `git revert <本轮文档验收提交>`；不得删除、修改或移动 `v0.4.14` 及更早标签。

## v0.4.16 正式发布与附件验收

- 正式 Release：[Forkline v0.4.16](https://github.com/AsphyxiaChoke/Forkline/releases/tag/v0.4.16) 已创建，Release ID 为 `379598716`，为正式版、非草稿、非预发布，并成为当前 Latest。发布说明为中文，明确记录滚动后双击查看卡死修复、安装版更新边界和未签名 SmartScreen 风险。
- `v0.4.16` 为注释标签，标签对象为 `c09a24f4e3b5c986faea6cf3659ecd3ac3e02da2`，目标提交为 `58f85da533155e454f7a9ab7cb64229b780c1985`；远端复核确认 `v0.4.15` 及更早标签未移动。
- 安装器工作流 [33371865652](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33371865652) 与便携包工作流 [33371865631](https://github.com/AsphyxiaChoke/Forkline/actions/runs/33371865631) 均成功，且均使用提交 `58f85da533155e454f7a9ab7cb64229b780c1985`。
- 六个正式附件均为 `uploaded`，本机重新下载后的 SHA-256 与 GitHub API digest 全部一致：安装器 `104606697` 字节 / `70f1f0878b0064c53c9b5e56a126aef723943335671614d6f864ce3a0599b4d6`；blockmap `111767` 字节 / `83a5f350c6107e3c281e4d36d3b6bdbf1ebb3d38e3b2f8ae0dbe71f1a3d58e49`；安装器校验文件 `103` 字节 / `c231fb598c88979d475bc083706d4a8fd04084dd20986ca57cbd9d2643f762b6`；便携 ZIP `36880014` 字节 / `1be6197b2e48e49d0a9df277ca87cb8871ff86d53ee5ac1c72cfb85881c84c1b`；便携 ZIP 校验文件 `109` 字节 / `1e4f8319a073cf418099befbdc332eb0b0b2024d4b6afb234b8cd3a5c895aa2a`；`latest.yml` `372` 字节 / `f1bd64558efb0649f8707af48c4359af413c51d353ba04d03b62d3a00c1a8dae`。
- `latest.yml` 版本为 `0.4.16`，安装器文件名和大小 `104606697` 一致，SHA-512 为 `bUUDA6jU1C/lUhCdNFZNW0ti12BYaBVVVOkMpwP9XPaj+j4LtWSCtmOgljs8TPQ9eWmR/sAil+H/VFk6rzqjcA==`；两个 `.sha256` 文件分别匹配安装器和便携 ZIP。远端便携 ZIP 已确认包含 `.git/`、`runtime/node.exe`、`Forkline.cmd`、`start.cmd`、`package.json` 和 `docs/`。
- 本地便携包脚本构建成功：`dist/Forkline-v0.4.16-windows-x64-portable.zip` 为 `36849396` 字节，SHA-256 为 `46ff87359ff8cab5b26a6e4d598a122eaab5ddf0bb4f3d30f2f491d50c708549`；正式分发以 GitHub Release 附件为准。远端安装器 Authenticode 为 `NotSigned`，首次运行可能显示未知发布者或 SmartScreen 提示。
- v0.4.16 修复后的真实 Chromium 滚动后双击回归通过；滚动后打开约 `229.8 ms`、最大事件循环延迟约 `23.2 ms`，4,000 个分散目录滚动完整加载通过。当前 GitHub 开放 Issue 数为 `0`；保护对象 `n+fs.statSync(p.join('public'` 和 `.playwright-cli/` 均未修改、未暂存、未提交。

## v0.4.16 滚动后文件查看卡死修复

- 本轮针对“滑动大量变更文件后双击查看可能卡死”完成修复。文件树增量合并按 `data-tree-path` 建立目录索引，避免分散目录增长时逐项线性扫描；工作区和暂存区继续保持首批 `800` 个文件，但滚动追加批次降为 `100` 个，缩短单次 DOM 工作块。目录选择、折叠、双击、右键菜单和 Git 操作语义不变。
- 真实 Chromium 回归覆盖 `4,000` 个分散目录的完整滚动加载，以及滚动文件列表后立即双击复杂工作区文件；滚动后双击成功打开，复杂文件使用轻量双栏编辑器，不创建 `MergeView`，且只发起一次文件读取请求。此前 `12,000` 个分散目录的旧实现可超过 `30` 秒无响应，修复后 `4,000` 个目录在回归门限内完成。
- 本地 Windows x64 NSIS 安装器已构建：`dist/installer/Forkline-Setup-0.4.16-windows-x64.exe`，大小 `104610629` 字节，SHA-256 `A49FC6624017F2C6FAF43C0E125B748AF7B0DED6DDBCD01652564CD0DD5FC471`；`dist/installer/latest.yml` 版本为 `0.4.16`，文件名、大小和 SHA-512 与安装器一致。Authenticode 为 `NotSigned`，正式发布说明须继续标注未知发布者和 SmartScreen 风险。
- 便携包和正式 Release 仍需由 `v0.4.16` 标签触发的 GitHub Windows 工作流生成并验收；正式发布前不得把本机构建产物当作远端附件。保护对象 `n+fs.statSync(p.join('public'` 与 `.playwright-cli/` 未修改、未暂存、未提交；不得移动 `v0.4.0` 至 `v0.4.15` 的任何既有标签。

## v0.4.19 普通编辑器滚动回弹修复准备

- v0.4.19 修复普通工作区双栏、历史只读双栏和普通冲突三栏快速滚轮时的反向位置覆盖。MergeView 行对齐重算先保留滚动位置，跨栏同步改用明确滚轮来源和程序滚动目标队列；同步滚动开关、编辑/暂存/冲突应用和 Web/便携版 Git 语义不变。
- `package.json`、`package-lock.json` 与安装器契约测试已升至 `0.4.19`。正式发布必须使用新的不可移动注释标签，由安装器和便携包工作流重新测试、构建并上传六个附件；本机构建不能冒充正式附件。
- 安装器继续按当前用户安装、允许选择目录、默认创建桌面和开始菜单快捷方式；NSIS 安装版继续使用 `electron-updater`，更新前优雅停止 Forkline 后台服务及 Git/SSH 子进程。安装器未签名，中文 Release 必须标注未知发布者与 SmartScreen 风险。
- 发布前自动回归 `$env:FORKLINE_BROWSER_PERFORMANCE_SCALE='3'; npm.cmd test` 为 `405/405`，真实 Chromium 专项为 `1/1`。真实 Electron 独立窗口覆盖普通工作区双栏、历史只读双栏和普通冲突三栏共三种 MergeView；双栏最大向上跳变均为 `0 px`，三栏最终位置完全一致且没有 `720/726 px` 大回弹。
- 本机安装器 `dist/installer/Forkline-Setup-0.4.19-windows-x64.exe` 为 `104613125` 字节，SHA-256 `ea969d8aab5d55c5a30bdf8ebd0d2e229ef091fec88ad657630fe874bf205d18`；blockmap 为 `111661` 字节，SHA-256 `4d327fee44660bc186d0b5004add833d736776bc89a57415d9b6163ff1149f62`；`latest.yml` 为 `372` 字节，SHA-256 `c53ac9770ccc68ab4618cd38e168a149f50fef3a1f7a08899bbb096bbccaee57`，版本、大小和 SHA-512 `m7APqpoVZw6v5U1O2vdL76NulCprDtIom65TvIJFXR2+pnd93z1sEgnPNevPQ5z4CUem4ndGlNBhEi1xFOpTRA==` 均匹配。Authenticode 为 `NotSigned`。
- 隔离当前用户安装、安装后 EXE 三场景快速滚轮回归和静默卸载均通过，安装与卸载退出码均为 `0`，隔离目录已删除。正式分发仍只能使用 `v0.4.19` Release 工作流生成的附件，并须重新核对六个附件与远端 digest。

### v0.4.19 滚动修复最终复测

- 重新验证了 `120 px` 小步进快速滚轮：真实 Electron 安装后覆盖普通工作区双栏、轻量双栏、历史只读双栏和普通冲突三栏，每栏分别作为来源共 `9` 条路径；最终栏间偏差和最大向上跳变均为 `0 px`，编辑器心跳最大延迟 `12.2 ms`。
- 本轮完整自动测试为 `406/406`，失败 `0`；安装器契约 `2/2`；安装后的 EXE 版本为 `0.4.19`。临时隔离安装和卸载退出码均为 `0`，卸载后目录和当前用户登记均不存在。
- 重新构建的本机安装器 `dist/installer/Forkline-Setup-0.4.19-windows-x64.exe` 大小 `104613359` 字节，SHA-256 `b2db5e6a2daf13436cd9dee4718dabf104c08bea7efa760cc28372d894af5889`；blockmap 大小 `111555` 字节，SHA-256 `e91c85fec4362641afdcfa93be4943ead95d97e408587aefb695526e06922a51`；`latest.yml` SHA-256 `7b8dce0f7bff305ba1e59d1d7c0da7c497c1e3ebf44cdbb7aa933f84bd155e5f`，其版本、安装器大小和 SHA-512 与新构建匹配。Authenticode 仍为 `NotSigned`。
