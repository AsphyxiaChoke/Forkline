# v0.4.24 本地更新

## 更新内容

- 顶部新增“刷新仓库”：更新本地分支、提交历史和工作区状态，保留提交草稿、搜索条件及有效阅读位置；刷新期间显示进度并阻止重复点击。
- 优化左侧栏、右侧栏、底部高度及工作区三栏的连续拖动，减少大量文件时的卡顿。
- 优化历史列宽调整；拖动图谱列不再重复计算提交关系和重建提交列表。
- 补修默认 120 条／240 条提交时顶部列分隔线仍卡顿的问题：超出可见区域便使用现有虚拟列表，避免屏幕外的行反复计算样式。
- 松手时准确保存最终位置，保留布局记忆、列宽限制、横向滚动和键盘调整。
- 保留文件比较的 MergeView 连线、行对齐、语法高亮及双栏/三栏滚动同步。
- 明确全部文件与所选文件的操作范围，所选按钮显示准确数量。
- 普通提交与“修改上次提交”分别保留草稿，防止迟到的提交信息覆盖输入。
- 分别显示实际工作分支、正在查看的分支及提交目标。
- 历史搜索显示已加载条数，可继续搜索更早历史。
- 同步后保留历史阅读位置，创建或修改提交后定位到工作分支的新提交。
- 抓取、暂存全部及普通提交减少重复确认，远端与危险操作保留确认。

## 本地使用

- 安装版：运行 `Forkline-Setup-0.4.24-windows-x64.exe` 更新现有安装，继续通过桌面或开始菜单启动。
- 绿色版：解压 `Forkline-v0.4.24-windows-x64-portable.zip`，双击 `Forkline.exe`；个人设置保存在同目录 `data`。
- 本轮交付为本地打包更新，尚未创建 GitHub Release，线上自动更新暂不提供此版本。
- Windows 包未签名，可能显示“未知发布者”或 SmartScreen 提示；交付文件附有 SHA-256 校验文件。

## 首轮验证

- 安装与打包契约测试 4/4 通过；依赖版本未变。
- 安装版与绿色版的版本号、三份拖动修复文件及两份保留的现有文件均与工作区逐字节一致；本机安装后的 ASAR 与已核验构建完全一致。
- 安装器退出码 0，程序及系统登记版本均为 0.4.24。桌面和开始菜单快捷方式统一指向 `C:\Users\Administrator\AppData\Local\Programs\Forkline\Forkline.exe`；原桌面指向的 `D:\Forkline` 副本未修改。
- 使用已安装 EXE、隔离用户数据运行 Electron 回归，2/2 通过（约 98 秒），覆盖七类分隔条、松手定位、布局重载恢复及 MergeView 快速滚动、行对齐和内存回收。
- 七类连续拖动帧间隔中位数约 6.1 ms，松手跳变 0 px；原生鼠标拖动最终位置均正确。数字为本机测试夹具实测，不代表所有硬件和仓库的表现。
- 安装前、安装后及测试结束后，四份用户设置的 SHA-256 一致；未执行卸载测试，测试进程已退出。
- 安装器更新元数据的版本、文件名、大小、SHA-512 匹配；绿色 ZIP 完整性及 SHA-256 校验通过，包内不含用户 `data`。

## 顶部列分隔线补修验证

- 69 项定向测试、新增普通列表专项及完整 Chromium 回归均通过；完整回归使用项目既有性能倍率 3，第一次默认倍率运行触发原有冷 Git API 耗时门槛，详见 [诊断记录](ISSUE_3_DRAG_PERFORMANCE.md)。
- 本机正常退出后以同版本安装器替换，安装退出码 0；包内代码及安装后 ASAR 逐字节核验一致。安装后的 EXE 再次通过 120／240 条真实提交的四列专项，中位帧间隔约 12–24 ms，松手跳变 0 px；原生输入、最后一条提交可达和行高度对齐检查通过。
- 设置哈希和两个快捷方式目标保持一致；最新绿色包的完整性、SHA-256、版本及包内代码均已核验，包内无用户数据。

## 最新本地产物（刷新仓库）

- 安装版：`dist/local-0.4.24-refresh-installer/Forkline-Setup-0.4.24-windows-x64.exe`（96,224,172 字节）。SHA-256：`a0dbf73775c7d2e45700442a7ea597105ded31e01530b98c8a4d938c2a07c80f`。
- 绿色版：`dist/local-0.4.24-refresh-portable/Forkline-v0.4.24-windows-x64-portable.zip`（134,583,390 字节）。SHA-256：`cf6bf11704b53e0f28809363fdfd7133a93413dd6769acb3fb4d6182fa6433e4`。
- 两包均附 `.sha256`；安装更新元数据与 EXE 匹配，ZIP 完整性通过。140 份产品文件与当前源码逐字节一致，两包 ASAR SHA-256 均为 `b2c13215db0f4e439278ed0f3e01ff3a1bd03ce5aefef5eb9271df27dc479c80`。
- 本机安装退出码 0；已安装 EXE、ASAR 和更新配置与构建一致。桌面、开始菜单均指向 `C:\Users\Administrator\AppData\Local\Programs\Forkline\Forkline.exe`。
- 打包契约与按钮测试 11/11 通过；已安装程序及实际解压绿色版均通过临时仓库外部提交、分支、文件刷新和草稿保留检查，正常退出后后台端口释放。六份设置文件哈希与安装前一致。
- 版本仍为 0.4.24，本地安装已更新，未发布 GitHub Release。Windows 包仍未签名。
- 完整旧程序、设置及快捷方式备份：`C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Forkline-backups\before-refresh-20260924`。需要回退时，先正常退出 Forkline，再将其中 `installed` 下的文件复制回标准安装目录；仅在需要恢复设置时使用 `user-data` 副本。

## 历史本地产物（六项动线修复）

- 安装版：`dist/local-0.4.24-workflow-installer/Forkline-Setup-0.4.24-windows-x64.exe`（96,223,928 字节）。SHA-256：`22bae3737171c4d8b29cd66f89ec95210cb26cdd33438e13d53736b4f592de89`。
- 绿色版：`dist/local-0.4.24-workflow-portable/Forkline-v0.4.24-windows-x64-portable.zip`（134,583,282 字节）。SHA-256：`0d68c2e292ed6fb69174833990de88c3aaba2f1997b90d182c7f7fab06855513`。
- 两种产物均附 `.sha256`。包内产品源码与工作区一致，安装更新元数据的版本、大小、文件名及 SHA-512 匹配；绿色 ZIP 完整性与 23 份产品文件清单一致，包内没有用户 `data`。
- 从实际 ZIP 解压后的 EXE 启动验证六项动线，1/1 通过。详细源码回归见 [动线改进记录](WORKFLOW_IMPROVEMENTS.md)。打包没有修改产品源码，不重复执行文件页面完整回归。
- 该轮仅交付本地包，当时未更新本机安装或创建 GitHub Release。版本为 0.4.24，请按目录和 SHA-256 区分构建。安装包未签名。

## 上一轮本地产物（顶部列分隔线补修）

- 安装版：`dist/local-0.4.24-header-installer/Forkline-Setup-0.4.24-windows-x64.exe`（96,139,659 字节）。SHA-256：`c39ee1075433bc5b9f1c64d42c28e5f092ae58467766dd6fc63f24bd1c381946`。
- 绿色版：`dist/local-0.4.24-header-portable/Forkline-v0.4.24-windows-x64-portable.zip`（134,582,052 字节）。SHA-256：`f7a505355cc786b514aa876e73e43c7e3295482286ee4b21615d21730a21f9b4`。
- 该轮本机使用顶部拖动补修构建，版本为 0.4.24。以下首轮产物保留作为回退点。

## 首轮本地产物（保留供回退）

- 安装版：`dist/local-0.4.24-installer/Forkline-Setup-0.4.24-windows-x64.exe`（96,139,650 字节）。
  SHA-256：`ed07f7980e98b5fc9ab42fd8f80bc8c2999591d6016651cf24fa06f462b9e73c`。
- 绿色版：`dist/local-0.4.24-portable/Forkline-v0.4.24-windows-x64-portable.zip`（134,582,090 字节）。
  SHA-256：`7028f0c80c96929e6621b37db31aacf1281e5f052c6623e040ea2c809eb61b55`。
- 设置、旧 ASAR、原桌面快捷方式及回滚安装器哈希备份：`C:\Users\Administrator\AppData\Local\Temp\forkline-before-0.4.24-20260908-110438`。
- 如需回退安装版本，退出 Forkline 后运行仓库内保留的 `dist/installer/Forkline-Setup-0.4.22-windows-x64.exe`，选择原标准安装目录；需要恢复原桌面入口时，从上述备份复制 `desktop-Forkline.lnk` 至 `D:\桌面\Forkline.lnk`。当前未执行回退。
