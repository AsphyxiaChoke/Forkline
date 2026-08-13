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
