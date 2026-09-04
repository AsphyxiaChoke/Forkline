# Forkline 架构

## 后端分层

- `server.js`：进程启动、共享状态接线、HTTP 本地化/错误转换、静态资源和 API 路由编排；不再直接实现 Git 领域行为。
- `server/git-runtime.js`：Git 可执行文件发现、文本/二进制命令执行、长操作输出捕获、凭据隐藏和进程树终止。
- `server/repository-service.js`：仓库读取门面，负责打开/切换仓库、引用与远端通用校验，以及下列读取子服务的显式接线。
- `server/repository-browse-service.js`：目录浏览、快捷路径和仓库内路径边界判断；浏览仓库子目录时向上解析最近仓库根目录，容器目录仅在直接子目录唯一时自动选择仓库，多仓库容器返回候选而不猜测。
- `server/repository-auth-service.js`：认证环境按需诊断与缓存、托管平台识别、Windows 系统凭据入口，以及 PR/MR 网页地址生成。
- `server/repository-submodule-service.js`：工作树/子模块解析、状态增强和失效工作树快照。
- `server/repository-worktree-service.js`：工作区状态、文件快照、Diff、储藏和同步详情读取。
- `server/repository-state-service.js`：示例状态、全量/轻量仓库状态编排和历史分页。
- `server/repository-history.js`：提交详情、补丁、文件历史、逐行追踪和分支比较。
- `server/git-operations-service.js`：Git 写操作门面，负责请求分派、共享快照校验和下列写操作子服务的显式接线。
- `server/git-branch-service.js`：克隆/初始化、分支、远端、Tag、工作树、子模块和同步写操作。
- `server/git-worktree-service.js`：暂存/取消暂存、丢弃、储藏、冲突处理和补丁应用；对可恢复的索引操作记录前后 index tree，并通过 `read-tree --reset` 在快照守卫通过后只恢复暂存区。
- `server/git-history-service.js`：合并、变基、挑选、还原、重置和历史编辑。
- `server/git-recovery-service.js`：恢复点创建/恢复/清理、reflog 恢复和保留策略。
- `server/worktree-patch.js`、`server/temp-files.js`：可直接测试的纯补丁处理和临时文件清理辅助。
- `server/file-editor-service.js`：历史/工作区文件读取、UTF-8/GBK/GB18030 解码、编辑边界、旧内容校验和保存。
- `server/update-service.js`：Release 检查、更新状态和安装请求。

后端模块继续使用 CommonJS 工厂函数，由 `server.js` 显式传入 Git 运行时、当前仓库状态和共享操作记录。仓库或 Git 操作门面切换当前仓库时，会同步更新其全部子服务。新增行为应放入对应服务，路由只负责解析请求、调用服务和发送响应。

## 前端分层

- `public/js/core.js`：共享状态、存储键、常量、DOM 引用和 `window.Forkline` 命名空间。
- `public/js/i18n-loader.js`：首屏轻量中文门面，提供语言标准化和原文回退；第一次使用英语时载入完整词典，共享进行中的加载 Promise，失败后允许重试。
- `public/js/i18n-catalog.js`：完整英文文案目录、模板插值和已知服务端文本翻译；浏览器按需载入，CommonJS 测试和服务端继续直接引用。
- `public/js/i18n.js`：浏览器语言状态、静态页面文案捕获、异步语言切换和本地持久化。
- `public/js/desktop-preference-storage.js`：Electron 启动时通过固定 preload 接口读入稳定界面偏好，并提供与 `localStorage` 相同的最小读写门面；同一偏好键的 IPC 写入串行执行，失败时恢复最后一次确认值并发送受限失败通知。普通 Web 和 Web 便携版没有桌面接口时继续直接使用当前来源的 `localStorage`。
- `public/js/api.js`：共享 API 请求封装和长时间 Git 操作控制，对外暴露 `Forkline.api`，携带仓库上下文和当前语言请求头，并保留首屏操作轮询与取消能力。
- `public/js/app/`：启动附近的界面编排、界面性能诊断、事件绑定、布局工具和首轮渲染辅助。
- `public/js/features/`：分支、工作区更改、历史列表、图谱渲染、仓库操作、Git 操作、右键菜单和 Diff 工作台等业务流程。
- `public/js/features/context-menu-loader.js`：首屏右键菜单门面，负责首次使用时并行载入完整菜单实现与 `context-menu.css`、共享进行中的加载 Promise、脚本/样式独立失败重试，并保留菜单定位、关闭和供文件编辑器复用样式的能力。
- `public/js/features/folder-command.js`：首屏目录/命令门面和右栏上下文模块；保留页签切换、上下文判断和详情触发，第一次打开目录选择器或命令面板时并行载入 `folder-command-implementation.js` 与 `folder-command.css`，等待两者完成后再打开，失败时只重试失败资源。
- `public/js/features/folder-command-implementation.js`：按需载入的本机目录浏览和命令面板完整实现，两种入口共用同一组脚本与样式加载 Promise；文件夹打开入口使用后端解析出的仓库根目录，多仓库或无仓库时保持选择器打开并提示用户继续选择。
- `public/js/features/recovery-policy.js`：首屏保留的恢复点策略、按仓库偏好、整理确认和危险操作后清理入口；不包含恢复点页面或 reflog 界面。
- `public/js/features/recovery-undo.js`：首屏保留的页面级撤销/恢复控制器；提交操作使用 Git 恢复点，暂存操作使用 index tree，校验仓库、分支、HEAD 和工作区快照后才执行，并在成功后交换 Undo/Redo 栈。
- `public/js/features/git-actions-loader.js`：首屏 Git 操作门面；保留当前分支、工作区、未完成操作与远端配置快照，追加状态、文件选择辅助和“储藏并签出”返回原分支后的自动恢复，第一次实际执行 Git 动作时载入完整实现。
- `public/js/features/git-actions.js`：按需载入的提交、签出、合并、变基、储藏、远端、单文件与批量文件等完整 Git 操作实现；载入后通过 `ForklineGitActions` 注册给首屏门面，并发入口共用加载 Promise，失败资源移除后可重试。
- `public/js/features/commit-actions-loader.js`：首屏提交操作门面；保留提交详情和菜单渲染需要的历史编辑配置、队列信息、远端提交 URL、复制与弹窗关闭辅助。空历史队列直接渲染；已有计划或队列时先显示加载状态，并行载入完整实现与 `commit-actions.css`，两者完成后自动重绘，失败时只重试失败资源。
- `public/js/features/commit-actions.js`：按需载入的提交上下文动作、历史编辑执行与计划/队列渲染、补丁、Tag、PR 与分支比较实现；载入后通过 `ForklineCommitActions` 注册给首屏门面，并与历史编辑专用样式共用加载边界。
- `public/js/panels/inspector.js`：按当前标签页分派右侧面板渲染，并保留文件历史与逐行追踪的轻量打开入口。
- `public/js/panels/inspector-panel-loader.js`：右栏次要面板的共享按需加载器，负责脚本与可选专用样式的资源去重、共享样式键、独立失败重试和快速切页保护；带专用样式的面板会等待脚本和样式都就绪后再渲染。
- `public/js/panels/file-insights.js`：文件历史与逐行追踪的渲染、API 请求和页面动作；两个页签共用一个按需模块和 `file-insights.css`。
- `public/js/panels/workspaces.js`：按需载入的分支整理、工作树和子模块面板；三个页签共用 `workspaces.css`。
- `public/js/panels/sync.js`：首屏保留的同步状态合并、轻量刷新和推送保护，供顶栏与 Git 动作直接调用。
- `public/js/panels/auth.js`：按需载入的完整同步页，负责页面布局、待拉取/待推送提交预览、upstream 与远端管理、连接诊断、认证助手和系统凭据入口；页面样式来自共享 `repository-panels.css`。
- `public/js/panels/stashes.js`、`compare.js`：分别负责按需载入的储藏和分支/引用比较面板，共用 `repository-panels.css`；比较请求入口由首屏 `commit-actions-loader.js` 提供，完整请求实现在首次比较时载入，页面模块只负责结果展示与页内动作。
- `public/js/panels/tags.js`、`recovery.js`、`logs.js`、`settings.js`：分别负责 Tag、恢复点与 reflog、按需载入的 Git 操作日志与界面诊断页面、应用设置与在线更新面板；Tag 与恢复点共用 `repository-panels.css`，日志页共用 `logs.css`，操作取消核心不属于 `logs.js`。
- `public/js/features/file-tree.js`、`diff-renderer.js`、`worktree-refresh.js`：分别负责工作区/提交文件树、供同步/比较等页面共用的双栏 Diff 基础渲染，以及工作区签名和焦点轮询。文件树通过 `WeakMap` 为每个长期存在的容器只绑定一组 click/dblclick/contextmenu/scroll 委托监听，右侧详情容器重用时只替换当前模式配置，不随文件行数量重复创建监听器。工作区与暂存区超过 800 个文件时先渲染首批，接近底部滚动或点击“继续显示”后按小批次合并目录节点；追加只更新渲染高度缓存，不强制改写原生 `scrollTop`，因此高速滚轮事件不会被程序化位置校正吞掉，也不会因一次追加只能停在单个批次。顶层目录很多时按固定高度块组织目录，块离开视口时暂时卸载子节点、回到视口时恢复，滚动判断使用渲染高度缓存而不是在每个滚动事件读取整棵树的 `scrollHeight`；目录合并按 `data-tree-path` 建立一次索引，避免分散目录增长时重复线性扫描，目录数量仍按完整文件集合计算。目录节点的左侧箭头只负责展开/折叠，工作区和暂存区使用文件夹行按钮选择该目录下的全部当前范围改动，选中状态用文件夹图标和行高亮表达，不使用 checkbox；普通文件单击只更新选择和文件上下文，不读取隐藏 Diff。
- `public/js/features/diff-workbench-loader.js`：首屏 Diff 轻量门面，保留文件状态/范围判断、活动 Diff 清理、弹窗关闭和焦点恢复能力；第一次显式打开“查看对照”时并行载入 `diff-workbench.css` 与有序脚本链 `diff-selection.js`、`diff-workbench.js`，三者完成后才进入工作台。并发入口共用一个 Promise，脚本或样式失败时只移除并重试失败资源。
- `public/js/features/diff-workbench.js`、`diff-selection.js`：按需载入后负责工作区 Diff 读取、反馈、最大化渲染、按块/按行操作和滚动位置恢复。已从布局移除的内联对照容器只保留活动 Diff 状态并清空旧节点，不再生成隐藏副本；实际行节点只在最大化弹窗中按首批最多 1000 行渲染。
- `public/js/features/file-editor-loader.js`：首屏文件编辑器门面；第一次打开文件时先复用右键菜单样式，并等待 `file-editor.css` 与 CodeMirror 样式全部就绪。脚本按依赖层载入：同层 CodeMirror 插件和语言模式并行请求，`JSX / HTMLMixed / Markdown / Dockerfile` 等待各自基础模式，PHP 再等待 HTMLMixed 与 C-like；五个 Forkline 编辑器模块继续按原顺序执行。所有入口共享同一个进行中的加载 Promise；同一仓库、文件、来源和查看上下文的切换/打开请求还共享同一个进行中的打开 Promise，避免单击与双击在文件尚未显示时重复创建编辑器。仓库切换、文件或来源变化会形成不同请求，失败后只重试未成功资源，再绑定编辑器专属事件。
- `public/js/features/file-editor-utils.js`、`file-editor-actions.js`、`file-editor-window.js`、`file-editor-search.js`、`file-editor.js`：按需载入后分别负责文件类型与轻量对照判断、暂存/还原和冲突块应用、浮窗生命周期、查找替换，以及打开/加载/保存和编辑器初始化。Web 与 Electron 独立窗口的普通冲突都使用三栏 MergeView，复杂冲突使用三个轻量 CodeMirror；所有路径都只允许编辑中间的合并结果。
- 工作区、Web 历史文件与 Electron 独立历史窗口共用复杂度判断：内容达到 `768 KiB`、行数达到 `20,000`，或连续差异达到 `2,000` 行/`32` 个区段时，在创建 `MergeView` 前直接进入轻量双栏 CodeMirror；普通小文件保留完整差异连线、行对齐、语法高亮和暂存能力。
- `public/app.js`：旧入口兼容占位，不在这里新增功能代码。
- `public/js/bootstrap.js`：启动顺序，对外暴露 `Forkline.start`，并在全部脚本加载后启动应用。
- `public/index.html`：静态结构和有序脚本加载。
- `public/styles.css`：主题 Token、页面布局和通用组件的全局样式表。
- `public/commit-actions.css`：历史编辑预检、影响提交列表、队列项和改信息表单的完整布局；不进入首屏，由提交操作门面首次使用时与完整实现并行载入。
- `public/context-menu.css`：右键菜单定位、尺寸、按钮、分隔线、危险和禁用状态的完整布局；不进入首屏，由菜单门面首次右键时与实现并行载入，文件编辑器首次打开时也会复用。全局样式只保留 `.context-menu { display: none; }`，避免静态菜单闪现。
- `public/diff-workbench.css`：最大化 Diff、逐行/按块操作、操作反馈和目标高亮的完整布局；不进入首屏，由 Diff 门面首次显式查看对照时与实现并行载入。全局样式只保留静态 `.diff-modal { display: none; }`，避免页面启动时出现未初始化弹窗。
- `public/file-editor.css`：文件编辑器浮窗、CodeMirror 覆盖和编辑器窄屏规则；不进入首屏，由文件编辑器加载器首次打开文件时载入。
- `public/file-insights.css`：文件历史、状态标记和逐行归属布局；不进入首屏，由右栏加载器首次打开文件历史或逐行追踪时与 `file-insights.js` 一起载入。
- `public/folder-command.css`：目录选择器和命令面板的内层布局；不进入首屏，由目录/命令门面首次打开任一入口时与完整实现并行载入。
- `public/logs.css`：Git 操作日志、运行中操作和界面诊断布局；不进入首屏，由右栏加载器首次打开操作日志时与 `logs.js` 一起载入。
- `public/repository-panels.css`：储藏、Tag、恢复点、同步认证和分支比较的共享布局；不进入首屏，由右栏加载器首次打开任一对应页签时载入，并通过共享样式键跨五个面板复用。
- `public/settings.css`：设置页卡片、更新状态、主题预览和窄右栏规则；不进入首屏，由右栏加载器首次打开设置页时与 `settings.js` 一起载入。
- `public/workspaces.css`：分支整理、工作树和子模块的摘要、列表、状态与操作布局；不进入首屏，由右栏加载器首次打开三个页签中的任一个时与 `workspaces.js` 一起载入。

## Electron 桌面壳层

- `electron/main.js`：单实例、随机回环端口后台服务、窗口生命周期、缩放、窗口位置、外部链接、渲染器健康事件、稳定最近仓库/界面偏好迁移和受监督自更新退出的编排。第二实例收到的参数不能直接改后台仓库，必须交给当前页面走现有切仓流程；自更新退出消息只接受当前后台子进程。首次迁移期间即使隐藏读取窗口关闭，也不能触发应用提前退出。
- `electron/recent-repository-store.js`：规范化桌面最近仓库记录，按时间排序、Windows 路径形式去重并限制为 `10` 条；稳定文件无效或不存在时，只从旧 LevelDB 定位随机回环来源，再由主进程提供的 Chromium 来源读取器获取固定 `localStorage` 键。原始 LevelDB 不在 Node 中直接解析或改写。
- `electron/desktop-preference-store.js`：只接受 `9` 个固定界面偏好键和不超过 `128 KiB` 的字符串值，读写 `%APPDATA%\forkline\desktop-ui-preferences.json`。更新时先完整写入同目录临时文件，再重命名替换稳定文件；任一步失败都保留旧文件并清理临时文件。首次迁移仅在单一旧来源具有唯一最新业务时间证据时选择普通偏好；界面诊断跨来源按时间合并去重，任一来源读取失败时不写入部分结果。
- `electron/server-process-shutdown.js`：通过 IPC 请求后台服务优雅退出并等待进程结束；超时后只使用当前 Electron 实例持有的服务进程句柄做有界兜底。
- `electron/self-update-health.js`：只允许新 Electron 实例在系统临时目录写入限定名称的更新健康标记，记录目标版本和当前 PID。
- `electron/startup-repository.js`：从首次或后续启动参数中识别本机目录，并排除 Electron 应用根目录。
- `electron/repository-open-coordinator.js`：保存页面尚未就绪时的最新仓库请求；只有渲染器完成加载后才通过受限通道交付，连续请求按最新路径合并。
- `electron/renderer-health.js`：区分短暂无响应与渲染进程停止；只有用户在无响应弹窗中明确放弃时先清草稿再重载，崩溃后的普通重载保留草稿供页面恢复。
- `electron/renderer-draft-store.js`：规范化并复制单份渲染器恢复草稿，限制为当前仓库、提交信息和工作区文件字段，总量不超过 `8 MiB`；仅保存在主进程内存，不落盘。
- `electron/preload.js`：在上下文隔离和沙箱开启的前提下，只暴露缩放、未保存状态上报、草稿读写、最近仓库读写、固定界面偏好读写和仓库路径接收接口；主进程只接受当前 `mainWindow.webContents` 的调用，不提供任意 IPC 通道。
- `public/js/core.js`：以固定 `600 ms` 节流采集提交信息和文件编辑器草稿；文件草稿保留原始快照与查看位置，快照变化时继续保存旧快照，避免后续重载把草稿误判为可覆盖的新版本。
- `public/js/bootstrap.js`：在异步应用初始化前登记桌面仓库路径监听和偏好持久化失败提示，并在语言、主题、布局、恢复策略和诊断初始化前先读取 Electron 稳定界面偏好，在恢复最近仓库前读取稳定仓库记录；初始化完成后读取 Electron 草稿，再允许第二实例路径切仓。初始化完成前只保留最新路径，完成后串行调用 `openRepo`。
- `public/js/features/repositories.js`：Electron 环境从受限桌面接口读写稳定记录，普通 Web 环境继续使用当前来源的 `localStorage`；两者共用过滤、最多 `10` 条、切仓和清除界面。所有实际切仓继续由 `openRepo` 执行；文件编辑器或提交信息框有未保存内容时先确认。克隆和初始化勾选“完成后打开”时复用同一保护。
- `server/shutdown-controller.js`：统一桌面 IPC、自更新、父进程断开和终止信号的关闭流程，先关闭 HTTP 接入并清理 Git 运行时，再退出服务进程。
- `server/git-runtime.js`：除操作日志中的可取消命令外，还登记普通文本和二进制 Git 查询；关闭期间拒绝新命令，并只终止本运行时持有的子进程。

## 加载顺序

`index.html` 必须按以下顺序加载脚本：

1. `js/core.js`
2. `js/desktop-preference-storage.js`
3. `js/i18n-loader.js`
4. `js/i18n.js`
5. `js/api.js`
6. `js/app/performance-diagnostics.js`
7. `js/app/init.js`
8. `js/features/branches.js`
9. `js/features/worktree-changes.js`
10. `js/features/history-list.js`
11. `js/features/folder-command.js`
12. `js/features/context-menu-loader.js`
13. `js/features/commit-actions-loader.js`
14. `js/features/graph.js`
15. `js/panels/inspector.js`
16. `js/panels/sync.js`
17. `js/panels/inspector-panel-loader.js`
18. `js/features/recovery-policy.js`
19. `js/features/recovery-undo.js`
20. `js/features/file-editor-loader.js`
21. `js/features/diff-workbench-loader.js`
22. `js/features/file-tree.js`
23. `js/features/diff-renderer.js`
24. `js/features/worktree-refresh.js`
25. `js/features/repositories.js`
26. `js/features/git-actions-loader.js`
27. `js/app/layout-utils.js`
28. `js/app/events.js`
29. `app.js`
30. `js/bootstrap.js`

`desktop-preference-storage.js` 必须紧跟 `core.js`，使后续语言、主题、布局、恢复策略和界面诊断统一取得稳定桌面偏好门面；它在普通 Web 环境只保留原生 `localStorage` 行为。`performance-diagnostics.js` 仍需尽早安装全局监听，启动早期记录先留在内存，`bootstrap.js` 等待稳定偏好读取完成后再合并持久诊断。

前端仍使用经典浏览器全局变量，因为应用直接由本地服务提供，不经过打包器。`i18n-loader.js` 和 `i18n.js` 必须先于功能和面板脚本加载；完整 `i18n-catalog.js` 不再进入首屏清单，由语言加载器在恢复英语设置或第一次切换英语时载入。`performance-diagnostics.js` 必须在后续功能脚本之前安装全局错误和长任务监听；首屏保留的右侧面板模块、`inspector-panel-loader.js`、`recovery-policy.js` 和恢复点撤销必须先于 `js/app/events.js`。`panels/stashes.js`、`panels/settings.js`、`panels/tags.js`、`panels/workspaces.js`、`panels/recovery.js`、`panels/file-insights.js`、`panels/auth.js`、`panels/compare.js` 与 `panels/logs.js` 不进入首屏，由 `inspector-panel-loader.js` 在第一次打开页签时载入、去重并支持失败重试；`settings.css`、`workspaces.css`、`file-insights.css`、`logs.css` 与 `repository-panels.css` 同样不进入首屏，对应面板会并行加载脚本与样式，并在两者都完成后渲染，任一资源失败只清理失败项，下一次重试复用已经完成的资源。`workspaces.js` 与 `workspaces.css` 对应分支整理、工作树和子模块三个页签，`file-insights.js` 与 `file-insights.css` 对应文件历史和逐行追踪两个页签，`logs.js` 与 `logs.css` 对应操作日志和界面诊断页；储藏、Tag、恢复点、`auth.js` 完整同步页和 `compare.js` 比较页共享 `repository-panels.css` 及同一个样式加载 Promise，但各自脚本仍保持独立。每组页签共用自己的脚本加载键，加载完成后必须按当前 `state.selectedTab` 分派渲染，不能让用户快速切页期间的旧页面覆盖当前右栏。文件追踪的轻量打开入口留在 `inspector.js`；模块和样式就绪后才请求实际数据，同一仓库、引用和文件的重复打开共用进行中的 Promise，切仓或新请求会丢弃旧结果。`commit-actions-loader.js` 在首屏提供 `openCompareBranch()` 门面；第一次比较先载入完整提交操作实现，再切到比较页并发起 API，后续 `renderInspector()` 仍只复用当前比较状态和对应面板加载 Promise。同步核心 `sync.js` 仍在首屏，保证顶栏抓取/拉取/推送、命令面板和 Git 动作可以随时调用同步刷新与推送保护；同步页面布局、提交预览、upstream/远端管理、PR 入口和认证诊断全部延后到 `auth.js` 载入。长操作轮询和 `cancelRunningOperation()` 保留在首屏 `api.js`，因此日志页面尚未载入时，克隆窗口和运行中操作提示仍可取消；`logs.js` 只负责日志列表、界面诊断和页面刷新。恢复点页面模块只包含列表、筛选、reflog 和页面操作；启动、设置和危险操作需要的策略函数保留在轻量 `recovery-policy.js` 中，避免按需模块反向成为启动依赖。标签行及其右键菜单只会在标签模块完成加载并渲染后出现，因此事件委托继续在运行时调用模块提供的标签操作函数。`file-editor-loader.js` 必须先于文件树、仓库切换和事件模块；CodeMirror 资源按显式依赖层并行载入，五个 Forkline 编辑器模块仍按原顺序执行并绑定专属事件。`js/bootstrap.js` 依赖布局、恢复点策略、工作区刷新、追加状态和初始化辅助函数，并等待保存语言对应的词典就绪后再启动。

`context-menu-loader.js` 必须在提交、分支、文件树、文件编辑器加载器和事件入口使用右键菜单之前加载；完整 `context-menus.js` 与 `context-menu.css` 不进入首屏，第一次打开提交、分支、文件、Tag、远端或 reflog 菜单时并行载入，两者都完成后才显示菜单。普通提交点选由首屏 `history-list.js` 提供，菜单定位和关闭函数也保留在加载器中；文件编辑器专属右键不依赖完整菜单脚本，但首次打开编辑器时必须等待并复用同一份菜单样式。脚本或样式任一失败只移除失败项，下一次重试复用已经完成或仍在加载的另一项。

`commit-actions-loader.js` 必须先于图谱、提交详情和事件绑定加载，因为这些路径会立即读取历史编辑配置、队列提交信息和远端提交 URL，并在启动时绑定 Tag 与 merge 主线弹窗的关闭事件。完整 `commit-actions.js` 与 `commit-actions.css` 不进入首屏；挑选、还原、重置、历史编辑执行、补丁、Tag、PR 和分支比较第一次使用时并行载入两者，并通过 `ForklineCommitActions` 向门面注册。历史编辑计划或非空队列进入详情时也会触发同一个加载 Promise，门面先返回使用全局基础样式的轻量加载提示，脚本和样式都完成后才重绘完整界面；普通空队列继续使用全局基础样式且不触发资源请求。任一资源失败只移除失败项，重试复用已完成或仍在加载的另一项。

首屏 `folder-command.js` 必须先于 `inspector.js`、历史选择和事件绑定加载，因为这些路径立即需要 `switchInspectorTab()`、`setInspectorContext()` 与 `renderInspectorTabs()`。目录读取、目录弹窗、命令搜索和命令执行位于 `folder-command-implementation.js`，内层布局位于 `folder-command.css`；第一次点击“选择”或打开命令面板时并行载入两者，并发入口共用加载 Promise，脚本与样式都完成后才打开。任一资源失败只移除失败项，下一次重试复用已经完成或仍在加载的另一项。通用 `.checkout-modal`、`.checkout-dialog` 和 `.command-hint` 继续保留在全局样式，保证静态弹窗默认隐藏且菜单提示不依赖按需样式。

`diff-workbench-loader.js` 必须先于文件树、工作区渲染和事件绑定加载，提供这些首屏路径需要的文件状态判断与清理函数。`diff-workbench.js`、`diff-selection.js` 和 `diff-workbench.css` 不进入首屏；单击工作区文件不触发 `/api/worktree-diff`，只有显式“查看对照”、最大化或 Diff 操作入口才并行载入专用样式与有序脚本链并读取差异。脚本先完成时不得提前打开无样式弹窗，任一资源失败只重试失败项。工作区对照的隐藏宿主不得生成行 DOM，最大化弹窗是唯一可见渲染面；`diff-renderer.js` 继续留在首屏供同步、储藏和分支比较等按需面板复用，在工作台实现尚未载入时不得调用其工作区专属反馈函数。

`git-actions-loader.js` 必须先于布局、事件绑定和启动模块加载，因为这些路径立即需要快照校验、追加状态、远端查找、文件选择统计和自动恢复切换储藏。完整 `git-actions.js` 不进入首屏；提交、签出、合并、变基、储藏、远端和文件写操作第一次执行时才载入，并通过 `ForklineGitActions` 向门面注册。所有入口共用同一个加载 Promise，失败脚本必须移除并允许下一次操作重试。

恢复点策略由首屏 `public/js/features/recovery-policy.js` 提供，保存在浏览器 `forkline-recovery-policy` 的版本化结构中，以规范化仓库路径作为 `repositories` 键；首次加载和仓库切换都必须先调用 `loadRecoveryPolicyForRepo()` 再渲染面板。旧的全局策略只迁移到首次打开的真实仓库，示例仓库不持久化，也不触发操作后整理检查。`recovery-undo.js` 将提交前恢复点和暂存前后 index tree 分成两类页面级历史；暂存撤销只调用 `restoreIndexTree`，不会写工作区文件。仓库、分支、HEAD 或 index 关联的工作区快照变化后，旧的暂存 Undo/Redo 会自动失效；提交恢复在工作区有未提交改动时保留恢复点但禁用按钮。

## 国际化规则

- 中文是默认语言，设置页可切换英语；当前语言保存在浏览器的 `forkline-locale` 中。
- 默认中文首屏只载入 `i18n-loader.js` 的原文门面；恢复英语设置或第一次切换英语时才请求 `i18n-catalog.js`。并发请求共用一个 Promise，加载失败移除失败脚本并允许下一次重试。
- 界面源码继续以中文作为主文案，英文统一维护在 `public/js/i18n-catalog.js`，不要在功能文件中并排写两套文案。
- 固定文案使用 `t()`；模板静态片段可使用 `tt`，插值中的分支名、提交信息、作者、路径、引用和 SHA 必须保持原值。
- API 请求通过 `X-Forkline-Locale` 传递语言。服务端只本地化克隆后的响应，不修改服务端全局仓库状态。
- 后端错误、操作日志、诊断结果、动作标签、相对时间和可识别的操作结果跟随语言；Git 命令、原始 Git 输出、路径、分支名、Tag、引用、SHA 和提交信息不得翻译。
- 未知英文错误使用统一英文提示；带 `Git 输出：` 的错误只翻译提示和标签，后面的原始 Git 输出保持不变。
- `README.md`、`docs/` 和 `progress.md` 继续使用中文。

## 修改规则

- 新增右侧面板页面放入 `public/js/panels/`。
- 新增用户操作流程放入 `public/js/features/`。
- 提交“详情”页保持轻量：聚合多文件 Diff 最多渲染 400 行并显示完整行数，逐文件查看继续放在“文件”页；不能因为 API 已返回完整 Diff 就把全部内容绑定到详情 DOM。
- 共享启动、布局和事件胶水放入 `public/js/app/`。
- `public/app.js` 只保留兼容用途。
- 新增脚本文件时，必须同步更新 `public/index.html`、本文档和 `progress.md`。

## 本地服务

- `node server.js` 默认在 `127.0.0.1:5177` 启动 Forkline，并在 Windows 上自动打开应用。
- 本地验证不需要自动打开浏览器时，设置 `FORKLINE_NO_OPEN=1`。

## 文件编辑器

- `GET /api/worktree-file` 发现未合并状态时，从 Git index stage 2 和 stage 3 分别读取当前版本与对方版本；工作区文件继续作为可编辑的合并结果。缺失版本、编码错误、二进制和 `16 MiB` 上限沿用普通文件读取边界。
- `GET /api/commit` 以一条 `show -s` 同时取得提交元数据、父提交和完整正文，并与第一父提交文件清单、可选 Diff 同轮启动；根提交和合并提交的展示语义保持不变。结果会把 `仓库路径 + 提交 SHA -> 第一父提交` 写入 512 项 LRU；`GET /api/commit-file` 优先复用，未命中时仍执行一次 `rev-list --parents -n 1 <sha>^{commit}` 并回填。根提交用空父提交值缓存，仓库间不会共享结果，文件内容仍分别通过 `cat-file blob` 并行读取。
- Web 普通冲突创建“当前版本 / 合并结果 / 对方版本”三栏 MergeView，左右差异块按钮只把对应内容应用到中间；按钮观察器只能在文案或定位真实变化时更新 DOM，避免观察器回调再次触发自身。复杂 Web 冲突使用三个轻量 CodeMirror。
- Electron 独立历史窗口创建双栏 MergeView；普通冲突窗口创建三栏 MergeView，左右只读、中间可编辑保存。复杂文件仍创建轻量 CodeMirror 双栏或三栏。独立窗口在 Electron 主进程中不设置父窗口并显式允许任务栏显示；页面检测到独立窗口后禁用 Web 浮窗定位，使最大化视口直接决定编辑器尺寸。关闭、切换文件或切换仓库时必须解除滚动监听、销毁 MergeView 并清空编辑器 DOM。
- MergeView 与轻量 CodeMirror 共用受控滚动同步：捕获阶段的非被动滚轮监听先于 CodeMirror 内置滚轮预处理执行，并阻止同一事件继续传播，只推动当前来源栏的可见滚动条。普通 `scroll` 事件在每次输入后重置 `200 ms` 计时器，稳定后只按最终比例或行对齐位置回写其他栏一次；每个目标栏的程序滚动期望队列阻止它反向成为来源。MergeView 保留同步滚动开关，三栏按滚动比例保持相同文档进度；关闭或切换时解除监听并取消计时器。
- 保存接口只写工作区并保持编码、BOM、换行和快照保护，不自动执行 `git add`；新内容先写入目标文件同目录的独占临时文件并执行 `fsync`，替换前再次核对原文件 SHA-256，最后使用同文件系统原子重命名替换。写入、刷盘、快照复核或重命名失败时删除临时文件并保留原文件；用户仍需在冲突解决后显式暂存文件，再继续合并、变基、挑选或还原。
- 普通 MergeView 同步测量构建耗时；超过 `250 ms` 时立即销毁并按当前文件类型重建为轻量双栏或三栏，同时把仓库、版本和文件快照键保存在 `sessionStorage`。同一浏览器会话再次打开相同版本时跳过 MergeView，普通工作区文件的轻量右栏仍可编辑和保存。

## 状态与诊断

- 网页主动打开仓库时向 `POST /api/open` 传入 `progressive: true`：首轮只读仓库、本地/远端分支、当前同步摘要和当前分支历史，并用空集合占位工作区、工作树、子模块、Tag、储藏和恢复点。前端首次 `renderAll()` 后请求 `/api/open-details` 补齐工作区快照、Tag 和完整分支元数据，合并时保留用户在载入期间已切换的引用、提交和历史分页。
- 渐进核心状态未完成时 `state.repoHydrating = true`，工作区必须显示“正在载入”而不是空状态；共享 API 封装拒绝除新的 `/api/open` 之外的 POST 写请求。`/api/open` 是只读且幂等的仓库切换入口，只有它遇到浏览器级网络错误时允许自动重试一次，其他 POST 不得自动重放。`/api/open-details` 失败后前端必须读取当前查看引用的 `/api/state?details=core` 作为本地回退；回退成功时结束载入并显示中文降级提示。两次详情读取都失败时保留已经载入的提交历史，设置明确的本地服务错误并继续阻止写入，不能让整个仓库页面失效。所有响应继续按仓库路径和打开请求编号丢弃过期结果。
- `/api/state` 默认继续返回完整仓库业务状态，保持现有动作与调用方兼容；`details=core` 省略 `branchCleanup`、`worktrees`、`submodules`、`stashes` 和 `recoveryPoints`。核心状态仍执行轻量 `git worktree list --porcelain` 并携带 `worktreePruneSnapshot`，供左侧分支占用提示和失效 worktree 清理安全校验使用，但不读取其他 worktree 的工作区状态。
- 常用 Git 动作完成后的统一状态入口 `loadStateForRepoPath()` 必须请求 `/api/state?ref=<ref>&details=core`。只有响应仍属于请求发起时的仓库，才递增 `repoDetailRequestId`、清空 `repoDetailLoads` 并允许调用方替换 `state.data`；因此旧仓库响应不能使新仓库的详情请求失效，操作前已经发出的详情响应也不能回写到新核心状态。核心响应省略的页签字段由当前页签渲染时重新通过 `state-details` 读取。只改变工作区的全部暂存/丢弃继续使用 `/api/worktree`，已经返回 `result.state` 的储藏、补丁等路径继续直接复用结果，不能退化为额外完整状态读取。
- 分支整理、工作树、子模块、储藏和恢复点分别通过 `GET /api/state-details?section=<区块>` 按页签加载。前端以仓库路径和每次请求编号绑定结果，同一区块后发请求优先，切仓或被新请求替代的旧响应不能写回；面板区分读取中、读取失败和空结果，失败时提供重试。
- 本机工具探测、远端连通性检查和其他可选诊断不能在每次历史或工作区刷新时执行。
- `/api/state`、`/api/ref-state`、文件历史、逐行追踪和分支比较只解析本地已有引用；查看 `origin/<branch>` 使用最近一次抓取留下的 remote-tracking ref，不执行 `ls-remote` 或隐式 `fetch`。远端是否仍存在只在签出、合并、变基、创建分支/worktree、设置 upstream、删除远端分支等写操作前，以及用户主动执行连接诊断时检查。
- `/api/compare` 同时读取当前分支名和 HEAD 是否存在；有效引用通过一次 `rev-parse <base>^{commit} <head>^{commit} <base>...<head>` 取得两侧提交 SHA 和共同祖先，再把左右计数、两侧最多 40 条日志、文件列表和完整 Diff 同轮启动。后续范围只使用固定 SHA，保证一次请求内的比较快照一致。快照展开失败时回退到带“比较基准 / 比较目标”标签的逐项校验，并单独读取共同祖先；无共同祖先继续使用双点 Diff。响应中的引用名和展示命令保持用户输入。
- 文件路径解析会同时返回目标文件是否已经存在于指定引用中；`/api/file-blame` 直接复用这个结果，只有未找到时才继续检查父提交。正常文件因此只执行一次 `cat-file -e`，重命名工作区路径仍先解析旧路径，无提交引用和父提交兜底保持不变。
- `public/js/app/performance-diagnostics.js` 记录超过 `200 ms` 的 Long Tasks、`error` 和 `unhandledrejection`，最多保存最近 40 条；Electron 写入稳定界面偏好文件，普通 Web 和 Web 便携版仍写当前来源的 `localStorage`。稳定偏好初始化前的启动错误先保存在内存，初始化后再与历史记录按时间合并去重；记录包含当前仓库、引用、页签和编辑器模式，但不发送到服务器。操作日志页负责查看、复制和清空这些记录。
- 默认全量状态读取会同时启动独立 Git 读取，再复用分支、HEAD、tracking、远端和工作区快照生成同步/工作树数据；基础快照完成后，工作树增强、子模块增强、工作区文件快照和同步详情可并行执行。当前分支优先从 worktree 的 `.git/HEAD` 同步读取，缺失或结构异常时才回退 `symbolic-ref` / `rev-parse`。本地与远端分支使用一次保留 `branch.sort` 语义的 `git branch --all` 格式化快照，同时产出引用名、tracking、提交元数据和 remote-tracking SHA；渐进首屏和默认状态不得再为这些字段启动独立 `for-each-ref`。tracking 已提供的 upstream、ahead、behind 和 gone 状态会连同 remote-tracking SHA 传入同步详情，完整快照存在时不得再次执行同义 `rev-list` 或 upstream 解析。核心模式跳过 `branch --merged`、stash、恢复点、子模块配置/状态以及 worktree 增强，只保留冷启动与常用写操作所需的数据。
- 渐进打开的 `POST /api/open` 已返回仓库、分支、远端、同步和当前历史；第二阶段使用 `GET /api/open-details`，只补 tracking/分支元数据、Tag、worktree 占用与工作区状态，并返回未完成操作和安全快照。补充接口用一次 `for-each-ref refs/heads refs/tags` 取得完整引用快照，再拆成原有 tracking、分支元数据和 Tag 解析格式；工作区快照在 `status` 完成后立即开始，不等待引用和 worktree 命令收尾。它不得重复读取当前分支、HEAD、远端、同步或历史，也不得携带五个延迟页签的数据。前端合并结果时保留用户当前查看引用、提交和历史分页，同时移除渐进响应中的延迟页签空占位，保证首次打开页签仍会触发真实加载。`/api/state?details=core` 继续保留给冷启动和其他完整核心状态调用。
- 工作区读取缓存按标准化仓库绝对路径隔离，最多保留最近两个仓库；每项独立保存非持久递归 watcher、事件代次、变化路径和最近完整文件列表/快照。切换仓库不会关闭仍在 LRU 内的 watcher，第三个仓库进入时关闭最久未使用项，仓库上下文清空时关闭全部。后台仓库的文件事件同样会让自己的缓存失效；`.git/index`、监听错误和 60 秒安全期限仍要求完整扫描。文件内容 SHA-256 的 8192 项绝对路径 LRU 也跨切仓保留，但每次命中仍用文件元数据验证。
- `/api/open-details`、默认状态和 worktree 详情中的只读 `git status` 使用 `GIT_OPTIONAL_LOCKS=0`，避免 Git 自己刷新索引产生 watcher 事件并把刚建立的缓存立即判为失效。该缓存只优化界面状态读取；Git 写操作继续通过 `git-operations-service` 重新读取 HEAD、upstream、工作区和单文件强快照，缓存过期最多导致页面操作被拒绝，不得绕过写前校验。
- 工作区索引快照不查询未跟踪路径；已跟踪路径按不超过 24 KiB 的参数批次读取，最多并行 4 个只读 `ls-files`，避免 Windows 命令行过长。文件元数据和内容 SHA-256 最多并发读取 32 个，缓存上限为 8192 项，保证 4000 文件压力仓库重复刷新不反复读取全部内容。缓存为空时，同一文件只打开一次，并用同一个句柄完成 `stat`、内容读取、SHA-256 和关闭；缓存已有时仍先用路径 `stat` 快速验证元数据，变化后重新读取并生成哈希。内容 SHA-256 继续参与工作区写操作的过期保护，不能退化为只比较大小或时间戳。
- 五秒一次的 `/api/worktree` 轮询只在页面可见且浏览器有焦点时运行；重新获得焦点或可见状态时立即静默刷新。800 个以上文件连续无变化时前端按 `5 -> 10 -> 20 -> 30` 秒退避，检测到变化后恢复 5 秒。后端每次仍以 `GIT_OPTIONAL_LOCKS=0` 执行轻量 `git status`；递归、非持久 `fs.watch` 保存规范化后的变化路径和监听代次。状态文本、仓库、快照一致且最近完整扫描未超过 60 秒时，没有事件就直接复用完整文件快照；具体文件事件只重算对应状态项，只有父目录事件时重算该目录覆盖的状态项，重复事件和已有具体子路径的祖先事件会合并。`.git/index`、`.git/index.lock`、模糊路径、状态文本变化、监听错误、对应仓库缓存被淘汰或安全期限到达都会完整重扫；其他 `.git` 内部对象事件忽略，监听不可用时自动退回原扫描路径。增量刷新会更新快照和监听代次，但保留上一次完整扫描时间，不能通过持续文件事件无限延期 60 秒安全校验。工作区签名包含文件内容快照以及索引/工作区标记，同一 porcelain 状态下继续编辑仍会刷新列表和当前 Diff。
- 运行子模块配置/状态命令前先检查仓库根目录是否存在 `.gitmodules`；没有配置时直接返回空子模块列表。
- HEAD 引用日志属于恢复面板数据，真实仓库通过 `GET /api/reflog` 按需加载；`/api/state` 不携带固定 80 条 reflog。前端按仓库路径、分支和 HEAD SHA 绑定结果，并丢弃键变化后的旧响应。
- “储藏并签出”恢复提醒按仓库路径、实际检出分支和当前查看引用绑定；当前查看全部分支或储藏所属的检出分支时可以提示，查看其他引用或异步查询期间上下文变化时丢弃旧结果。
- “储藏并签出”恢复检查统一为自动模式；本地/远端签出、应用启动和仓库打开入口共用相同的仓库、实际分支与查看引用校验，匹配时直接恢复，不匹配时丢弃结果，前端不再保留确认弹窗。
- 仓库上下文通过 `X-Forkline-Repo-Path` 传递。浏览器把 Unicode 路径编码为 `v1:` 加 `encodeURIComponent(path)`，服务端只解码带版本前缀的形式，并兼容旧版 ASCII 原始值。
- 服务只监听 `127.0.0.1`，并校验 `Host` 必须是当前端口的 `127.0.0.1`、`localhost` 或 `::1`，阻止 DNS 重绑定借用其他域名访问本地服务。`/api/*` 还会拒绝非本地同源 `Origin`，以及 `Sec-Fetch-Site` 为 `same-site` 或 `cross-site` 的浏览器请求；没有浏览器来源头的本机 CLI/测试请求继续允许。POST 仍只接受 `application/json`。
- JSON 和静态响应统一发送 `Cross-Origin-Resource-Policy: same-origin` 与 `X-Content-Type-Options: nosniff`；静态页面额外使用 `frame-ancestors 'none'` 和 `X-Frame-Options: DENY`，避免 Forkline 被其他页面嵌入诱导操作。
- JSON API 必须保持 `Cache-Control: no-store`。静态文件使用由大小和毫秒修改时间组成的弱 ETag、`Last-Modified` 与 `Cache-Control: private, no-cache`；匹配 `If-None-Match` 时优先返回 `304`，仅在没有 ETag 条件时使用 `If-Modified-Since`。不能改成长期 `immutable`，因为应用更新会在相同路径替换脚本和样式。
- Git 写操作执行前的当前分支 HEAD、upstream、工作区、单文件和失效 worktree 快照属于强制安全门；对应 Git 读取失败时必须原样中止操作，不能把错误降级为空 HEAD、空状态或空列表。未设置 upstream 使用成功返回空值的 `for-each-ref` 查询，避免把“确实未设置”和“命令执行失败”混为一类。
- 认证环境只在同步面板需要时通过 `GET /api/auth-diagnostics` 加载，并要求正常的仓库上下文请求头。
- 认证结果按标准化仓库路径和完整远端 fetch/push URL 配置缓存 60 秒，最多保留 12 条；远端 URL 变化会形成新键，`?refresh=1` 会绕过缓存。
- Windows 系统凭据入口使用 `POST /api/system-credentials/open`，只启动固定的 Windows Credential Manager 系统界面，不接受命令或凭据参数，也不读取、修改或删除凭据；非 Windows 平台明确返回不支持。
- `public/js/panels/auth.js` 负责完整同步页渲染、认证诊断的懒加载和加载/错误界面、远端连接入口、已知托管平台状态页和系统凭据按钮；仓库路径、远端签名和请求编号用于丢弃仓库或远端变化后的旧响应。

## 长时间 Git 操作

- `/api/action` 开始执行时由 `beginOperation` 分配进程内操作 ID，并记录动作、开始时间、仓库切换属性、可取消能力、命令和输出尾部。操作完成后进入最多 40 条的操作日志，运行中记录不会写入持久文件。
- `executeGit` 会把当前子进程登记到操作记录，监听 `stdout` / `stderr` 并保留最近 `24 KiB` 原始输出；命令结束后移除子进程引用。命令文本会隐藏 URL 中的用户凭据。
- `GET /api/operations` 返回完成日志和运行中操作；前端在 `/api/action` 请求未结束时每 `700 ms` 轮询，并只在操作日志可见时原位刷新面板、保持右侧栏滚动位置。
- `POST /api/operations/cancel` 只允许取消白名单中的长时间动作。Windows 优先使用 `taskkill /PID <pid> /T /F` 终止 Git 及其 SSH/凭据等子进程；若受限环境拒绝 `taskkill`，运行时只对当前操作登记的 Git 子进程句柄发送 `SIGTERM`，并关闭该句柄继承的标准输入、标准输出和标准错误流，避免辅助进程继续占用管道而让原 `/api/action` 一直等待。回退不会按进程名扫描或终止其他 Git/SSH。其他平台直接发送 `SIGTERM`。请求被标记取消后，原 `/api/action` 响应返回 `cancelled`，日志状态为“已取消”，不按普通错误记录。
- 取消是进程级停止，不是事务回滚：远端已经接收的数据不会撤回，克隆目标目录也可能保留部分内容。新的长时间动作只有在确实能安全终止并有回归测试时才加入可取消白名单。

## 应用自更新

- `server/update-service.js` 负责 Release、本地安全预检和运行壳层元数据装配；预检失败会写入结构化结果，但不会关闭服务或修改 Forkline 文件。
- 安装 POST 等待预检和 Release fetch 时，服务会先写入准备状态；前端每 `250 ms` 读取该状态。Git fetch 强制输出稳定英文进度，状态记录对象百分比、已接收字节和当前尝试次数；连接重置、超时、DNS/TLS、RPC/early EOF 等瞬时错误最多重试 3 次，非瞬时错误不重试。
- `app-self-update.js` 和 `self-update-runner.js` 按准备、停止旧服务、重新校验、写入版本、重启和健康检查 6 个阶段更新状态。Web 模式等待服务进程退出、在原端口重启 `server.js` 并检查首页；Electron 模式等待主进程退出、重启桌面入口，并要求受限临时健康标记中的 PID 与目标版本同时匹配。
- 失败结果同时记录 `failedStage`、`rollbackState` 和 `serviceState`。自动恢复只在 HEAD 仍等于更新目标时执行 `git reset --keep`；如果提交位置出现额外变化则拒绝覆盖，并把文件回退与服务恢复结果分开显示。
- Electron 新实例启动失败时只终止本次更新器启动的进程树，代码回退后仍通过同一桌面入口恢复旧版本；Web 更新和 Electron 更新不会互相替换重启方式。

## 集成测试

- 执行 `npm test`，使用 Node 内置测试运行器，并按测试文件串行运行。
- `tests/git-api.test.js` 在随机本地端口启动真实 Forkline 子进程，并使用临时 Git 仓库驱动 HTTP API。
- `tests/app-self-update.test.js` 使用真实本地 Git 远端验证快进、回退、Web 服务重启、Electron 桌面入口重启和桌面启动失败恢复，并覆盖 Release fetch 字节进度解析、瞬时网络错误重试和准备状态契约；`tests/electron-shell.test.js` 固定主进程元数据、退出消息来源和健康标记边界；`tests/layout-ui.test.js` 固定准备阶段轮询与中文进度显示。
- `tests/recent-repository-store.test.js` 固定随机端口变化后的桌面记录持久化、Web `localStorage` 边界、记录规范化以及旧回环来源的一次性迁移；`tests/desktop-preference-store.test.js` 与 `tests/desktop-preference-storage.test.js` 固定偏好白名单/大小限制、保守迁移、失败重试、原子替换、最后确认值回滚、连续失败和跨来源持久化；`tests/settings-preference-copy.test.js` 与 `tests/layout-ui.test.js` 固定 Electron/Web 文案分流、英文翻译和失败提示；`tests/electron-shell.test.js` 同时固定受限 IPC、迁移期窗口生命周期和启动顺序。
- 测试夹具隔离全局/系统 Git 配置，使用仓库级身份和子模块设置，并在测试后清理临时目录。
- 认证测试覆盖 `/api/state` 不执行本机认证探测、诊断接口要求仓库上下文、缓存命中、手动刷新、远端 URL 变化后的缓存失效、托管平台识别，以及 Windows/非 Windows 系统凭据入口边界。
- 状态优化测试覆盖 upstream、领先/落后、脏工作树、游离 HEAD、无提交分支、空子模块列表、远端离线时读取本地 remote-tracking ref，以及真实子模块安全流程。
- Reflog 测试覆盖仓库上下文边界和无提交/有提交响应；`tests/reflog-ui-state.test.js` 验证当前结果写入和旧仓库响应丢弃。
- `tests/checkout-stash-ui-state.test.js` 验证签出储藏提醒在实际分支或查看引用变化后被丢弃，保留当前分支总览中的正常提示，并验证 Forkline 主动签出后的自动恢复不显示确认框。
- `tests/worktree-refresh.test.js` 验证文件快照影响刷新签名、未跟踪路径不进入索引查询、大路径列表按 Windows 安全长度分批、轮询状态命令关闭可选 Git 锁、具体文件与目录事件只重算受影响状态项、Git 索引事件完整重扫、60 秒安全重扫、监听失败回退，以及页面隐藏或失焦时不执行周期读取。
- `tests/action-state-refresh.test.js` 固定动作完成后的统一回填只请求 `details=core`、使旧详情区块请求失效、保留切仓后的新仓库详情状态，并阻止常用动作重新直接读取完整 `/api/state`；真实 Chromium 同时记录实际请求 URL 和回填耗时。
- `tests/browser-performance.test.js` 对 4000 文件工作区记录冷 API、连续 5 次无变化 API 的中位数和响应体积，并固定冷 API 低于 `350 ms`；真实修改一个已有文件后，下一次 API 必须立即返回新快照且单次耗时低于 `300 ms`。测试同时继续测量首批/完整行数、DOM 节点、筛选、恢复、滚动分批加载、快速连续滚轮、事件循环边界与文件树新增监听器数量。首批不得超过 1000 行和 6000 个树节点，滚动后必须完整显示 4000 个文件，两个长期容器最多补齐 8 个委托监听，目录组和文件行的布局高度必须保持稳定。`tests/git-api.test.js` 还会构造前后 porcelain 文本相同的 `MM` 状态，只替换 Git index blob，确认索引监听会强制刷新工作区快照。
- `tests/backend-modules.test.js` 固定入口、门面与二级服务边界，防止实现重新回流到 `server.js` 或两个门面文件。
- `tests/backend-services.test.js` 直接覆盖补丁裁剪、路径边界、远端网页 URL、恢复点保留策略、受保护分支和历史分页等纯服务逻辑。
- `tests/git-snapshot-guards.test.js` 使用故障注入验证 HEAD、upstream、全工作区、单文件、文件全量回退和 worktree 清理快照读取失败时不会继续执行 Git 写操作。
- `tests/file-editor-atomic-save.test.js` 故障注入临时文件写入中断和替换前外部修改，验证原文件不会留下半文件或覆盖外部更新，并确认临时文件被清理。
- 本地请求边界集成测试覆盖非法 Host、静态页面 DNS 重绑定、跨站 Origin、Fetch Metadata、跨站 POST、`localhost` 别名、同源响应安全头、静态 ETag/修改时间重验证、API `no-store` 和英文错误。
- `tests/recovery-policy-ui.test.js` 覆盖旧策略迁移、按仓库隔离、操作后整理确认和示例仓库边界；`tests/recovery-undo-ui.test.js` 验证危险操作返回恢复点后会登记一键撤销并触发策略检查。
- `tests/api-repo-context.test.js` 覆盖中文仓库路径请求头编码和当前语言请求头。
- `tests/i18n.test.js` 覆盖语言标准化、中文默认、英文切换、浏览器持久化、静态文案回切，以及路径和原始 Git 输出不被翻译。
- `tests/startup-resource-budget.test.js` 解析 `public/index.html` 的首屏样式和脚本，限制最多 37 个本地资源、总量不超过 750 KiB，并固定文件编辑器、设置页、工作区管理、文件追踪、操作日志、仓库工具面板、右键菜单和 Diff 工作台专用样式、CodeMirror、编辑器实现模块、Diff 工作台与按行操作实现、完整右键菜单、目录选择与命令面板实现、设置/储藏/标签/恢复点/工作区管理/文件追踪/同步认证面板和完整英文词典继续按需加载。
- `tests/diff-workbench-loader.test.js` 覆盖 Diff 脚本与完整样式的首屏排除、专用样式与两份有序实现的并发复用、脚本/样式独立失败重试，以及实现未载入时文件列表仍需要的状态清理和范围判断。
- `tests/context-menu-loader.test.js` 覆盖完整实现和菜单样式的首屏排除、首次右键并行加载、并发入口复用，以及脚本/样式独立失败重试；文件编辑器加载器专项同时验证共享菜单样式只请求一次、单击切换与双击打开只执行一次同文件请求，以及切仓后不复用旧请求。
- `tests/folder-command-loader.test.js` 覆盖目录/命令入口并发复用、失败重试，以及完整实现未载入时右栏上下文仍可切换。
- API 集成测试覆盖中文仓库名、中文提交信息和中文分支名在英文响应中保持原值，同时验证默认中文、英文错误和不支持语言回退中文。
- `tests/diff-preview.test.js` 验证聚合提交预览最多渲染 400 行，小 Diff 保持完整。
- Git 行为缺陷优先在真实 API 边界增加回归测试，不要用无法复现 worktree、stash、ref 或子模块语义的 mock 代替。
