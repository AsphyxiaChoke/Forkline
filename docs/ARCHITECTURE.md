# Forkline 前端架构

## 当前分层

- `public/js/core.js`：共享状态、存储键、常量、DOM 引用和 `window.Forkline` 命名空间。
- `public/js/i18n-catalog.js`：中英文文案目录、语言标准化、模板插值和已知服务端文本翻译；同时支持浏览器和 CommonJS 测试/服务端引用。
- `public/js/i18n.js`：浏览器语言状态、静态页面文案捕获、语言切换和本地持久化。
- `public/js/api.js`：共享 API 请求封装，对外暴露 `Forkline.api`，并携带仓库上下文和当前语言请求头。
- `public/js/app/`：启动附近的界面编排、事件绑定、布局工具和首轮渲染辅助。
- `public/js/features/`：分支、工作区更改、历史列表、图谱渲染、仓库操作、Git 操作、右键菜单和 Diff 工作台等业务流程。
- `public/js/panels/`：提交详情、工作树/子模块、同步/比较、恢复点、日志、标签和设置等右侧面板。
- `public/app.js`：旧入口兼容占位，不在这里新增功能代码。
- `public/js/bootstrap.js`：启动顺序，对外暴露 `Forkline.start`，并在全部脚本加载后启动应用。
- `public/index.html`：静态结构和有序脚本加载。
- `public/styles.css`：当前全局样式表。

## 加载顺序

`index.html` 必须按以下顺序加载脚本：

1. `js/core.js`
2. `js/i18n-catalog.js`
3. `js/i18n.js`
4. `js/api.js`
5. `js/app/init.js`
6. `js/features/branches.js`
7. `js/features/worktree-changes.js`
8. `js/features/history-list.js`
9. `js/features/folder-command.js`
10. `js/features/context-menus.js`
11. `js/features/commit-actions.js`
12. `js/features/graph.js`
13. `js/panels/inspector.js`
14. `js/panels/workspaces.js`
15. `js/panels/sync.js`
16. `js/panels/recovery-settings.js`
17. `js/features/diff-workbench.js`
18. `js/features/repositories.js`
19. `js/features/git-actions.js`
20. `js/app/layout-utils.js`
21. `js/app/events.js`
22. `app.js`
23. `js/bootstrap.js`

前端仍使用经典浏览器全局变量，因为应用直接由本地服务提供，不经过打包器。`i18n-catalog.js` 和 `i18n.js` 必须先于 API、功能和面板脚本加载；`js/app/events.js` 之前必须已经存在全部事件处理函数；`js/bootstrap.js` 依赖布局、恢复点策略、工作区刷新、追加提交和初始化辅助函数。

## 国际化规则

- 中文是默认语言，设置页可切换英语；当前语言保存在浏览器的 `forkline-locale` 中。
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

## 状态与诊断

- `/api/state` 只负责仓库核心状态；本机工具探测、远端连通性检查和其他可选诊断不能在每次历史或工作区刷新时执行。
- 全量状态读取会同时启动独立 Git 读取，再复用分支、HEAD、tracking、远端和工作区快照生成同步/工作树数据；基础快照完成后，工作树增强、子模块增强、工作区文件快照和同步详情可并行执行。
- 五秒一次的 `/api/worktree` 轮询只在页面可见且浏览器有焦点时运行；重新获得焦点或可见状态时立即静默刷新。工作区签名包含文件内容快照以及索引/工作区标记，同一 porcelain 状态下继续编辑仍会刷新列表和当前 Diff。
- 运行子模块配置/状态命令前先检查仓库根目录是否存在 `.gitmodules`；没有配置时直接返回空子模块列表。
- HEAD 引用日志属于恢复面板数据，真实仓库通过 `GET /api/reflog` 按需加载；`/api/state` 不携带固定 80 条 reflog。前端按仓库路径、分支和 HEAD SHA 绑定结果，并丢弃键变化后的旧响应。
- “储藏并签出”恢复提醒按仓库路径、实际检出分支和当前查看引用绑定；当前查看全部分支或储藏所属的检出分支时可以提示，查看其他引用或异步查询期间上下文变化时丢弃旧结果。
- “储藏并签出”恢复检查统一为自动模式；本地/远端签出、应用启动和仓库打开入口共用相同的仓库、实际分支与查看引用校验，匹配时直接恢复，不匹配时丢弃结果，前端不再保留确认弹窗。
- 仓库上下文通过 `X-Forkline-Repo-Path` 传递。浏览器把 Unicode 路径编码为 `v1:` 加 `encodeURIComponent(path)`，服务端只解码带版本前缀的形式，并兼容旧版 ASCII 原始值。
- 认证环境只在同步面板需要时通过 `GET /api/auth-diagnostics` 加载，并要求正常的仓库上下文请求头。
- 认证结果按标准化仓库路径和完整远端 fetch/push URL 配置缓存 60 秒，最多保留 12 条；远端 URL 变化会形成新键，`?refresh=1` 会绕过缓存。
- `public/js/panels/sync.js` 负责认证诊断的懒加载和加载/错误界面；仓库路径、远端签名和请求编号用于丢弃仓库或远端变化后的旧响应。

## 集成测试

- 执行 `npm test`，使用 Node 内置测试运行器，并按测试文件串行运行。
- `tests/git-api.test.js` 在随机本地端口启动真实 Forkline 子进程，并使用临时 Git 仓库驱动 HTTP API。
- 测试夹具隔离全局/系统 Git 配置，使用仓库级身份和子模块设置，并在测试后清理临时目录。
- 认证测试覆盖 `/api/state` 不执行本机认证探测、诊断接口要求仓库上下文、缓存命中、手动刷新和远端 URL 变化后的缓存失效。
- 状态优化测试覆盖 upstream、领先/落后、脏工作树、游离 HEAD、无提交分支、空子模块列表和真实子模块安全流程。
- Reflog 测试覆盖仓库上下文边界和无提交/有提交响应；`tests/reflog-ui-state.test.js` 验证当前结果写入和旧仓库响应丢弃。
- `tests/checkout-stash-ui-state.test.js` 验证签出储藏提醒在实际分支或查看引用变化后被丢弃，保留当前分支总览中的正常提示，并验证 Forkline 主动签出后的自动恢复不显示确认框。
- `tests/worktree-refresh.test.js` 验证文件快照影响刷新签名，以及页面隐藏或失焦时不执行周期读取。
- `tests/api-repo-context.test.js` 覆盖中文仓库路径请求头编码和当前语言请求头。
- `tests/i18n.test.js` 覆盖语言标准化、中文默认、英文切换、浏览器持久化、静态文案回切，以及路径和原始 Git 输出不被翻译。
- API 集成测试覆盖中文仓库名、中文提交信息和中文分支名在英文响应中保持原值，同时验证默认中文、英文错误和不支持语言回退中文。
- `tests/diff-preview.test.js` 验证聚合提交预览最多渲染 400 行，小 Diff 保持完整。
- Git 行为缺陷优先在真实 API 边界增加回归测试，不要用无法复现 worktree、stash、ref 或子模块语义的 mock 代替。
