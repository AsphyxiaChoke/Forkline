# Forkline 继续开发记录

## 当前状态

- 远端 `origin/main` 已拉取并基于最新代码开发。
- 已完成“远端分支 checkout”：远端分支列表现在有可见的“签出”按钮，右键菜单也支持“签出为本地分支”。
- 查看其他分支的切换速度已优化：分支/Tag 视图切换改用轻量 `/api/ref-state`，只刷新提交图数据，不再每次重跑同步、认证、子模块、恢复点和工作区全量状态。
- 当前分支和当前 HEAD 提交已高亮：左侧分支列表、顶部分支条会标出真实检出分支；提交图会用 `HEAD` 徽标和独立行高亮标出当前仓库 HEAD。
- Windows 下启动 `node server.js` 后会自动打开 `http://127.0.0.1:<PORT>`，非 Windows 环境保持只启动服务。
- 顶部路径选择器已恢复：路径输入框旁新增“选择”，可在内置目录弹窗中进入上级目录、跳转输入路径，并通过桌面、下载、文档、用户目录和磁盘根目录快捷入口选择本机 Git 仓库；目录列表会隐藏 `.git`。
- 提交图谱已按视图重做：`全部分支` 显示多分支提交、分叉和 merge 回线，merge 提交通过节点和回线表达，不额外显示文字标识；全部分支图谱的节点、标签、辅助线会跟随对应分支在分支列表中的颜色；单独分支改用 `--first-parent` 主线，只显示该分支自己的提交轨迹，merge 提交保留侧向虚线提示来源。
- 右侧栏已改为上下文页签：点提交只显示“详情 / 文件 / 标签列表”；点工作区或暂存区文件只显示“历史 / 逐行”；点分支只显示“分支整理 / 同步情况 / 分支比较”；工作树、子模块、储藏、恢复点、操作日志统一放到顶部右上“更多”下拉中选择进入。
- 顶部栏已固定为独立布局，右侧栏拖拽只改变下方工作区宽度，不再推动顶部仓库路径区和右上按钮区。
- 新建分支入口已显性化：提交详情和提交右键菜单都支持从选中提交新建分支并标注 `git branch`，命令面板文案会说明当前是从选中提交还是 HEAD 创建。
- 补丁工作流已接入：提交详情、提交右键菜单和命令面板支持把选中提交导出为 `git format-patch` 文本、复制补丁或下载 `.patch`；命令面板新增“应用补丁”，可粘贴 `.patch` / `git diff` 内容并选择用 `git apply` 写入工作区或用 `git apply --index` 直接暂存。
- 签出规则：`origin/feature/a` 会创建或切换到本地 `feature/a`；如果本地分支已存在就直接切换；工作区有修改时继续使用“保留 / 储藏 / 强制”的中文确认流程。
- 远端分支解析已改为读取 `refs/remotes/*`，并按 `git remote` 返回的真实远端名过滤；`git-svn` 这类松散 remote-tracking ref 不再混入“远端分支”列表。
- 本地分支列表已显示 upstream、领先/落后数量和上游丢失状态；当前分支没有 upstream 时显示“未设置 upstream”。
- 顶部“推送”已改为智能推送：已有 upstream 时执行 `git push`；没有 upstream 时优先执行 `git push -u origin <当前分支>`，没有 `origin` 则使用第一个远端。
- Fetch / Pull / Push 同步摘要已接入：操作完成后会显示当前分支 upstream、同步状态、领先/落后变化，以及远端新增/更新/删除引用；无 upstream 智能推送会显示“跟踪变化：未设置 -> origin/... ”。
- 安全强推已接入：顶部工具栏新增“强推”，当前本地分支右键菜单新增“安全强推当前分支”，后端执行 `git push --force-with-lease <远端> HEAD:<分支>`；普通 push 非快进拒绝和 force-with-lease stale 拒绝都有中文提示。
- 右侧“同步”页已接入：显示当前分支 upstream、同步状态、操作建议、待拉取提交和待推送提交，并提供抓取 / 拉取 / 推送 / 安全强推入口。
- 同步页远端仓库管理已接入：显示 `git remote -v` 的 fetch / push URL，支持添加远端、抓取单个远端、修改 URL、删除远端；远端行右键菜单也提供抓取、修改 URL、复制 URL、删除远端，并显示对应 Git 指令。
- 远端连接检查已接入：同步页远端行和远端右键菜单新增“检查连接”，后端执行只读 `git ls-remote --heads <远端>`，成功时显示 fetch/push URL 和可读取分支数；认证、权限、DNS、网络、证书等常见失败会转成中文排查提示。前端同步页现在会保留最近一次检查结果，显示 URL、检查命令、成功/失败状态、Git 输出摘要和下一步建议，不再只依赖 toast。
- 远端诊断向导已接入：同步页和远端右键菜单把“检查连接”升级为“诊断连接”，失败结果会按 SSH、HTTPS、权限/仓库、DNS/网络、证书、URL/本地路径或未知问题分类，显示中文判断、排查步骤和可复制诊断命令；失败响应也会带回结构化 `remoteCheck`，前端不再只能靠错误字符串猜测。
- 同步认证助手已接入：同步页会根据远端 URL 区分 SSH / HTTPS / 本地路径，读取本机 `~/.ssh` 中可见的 key 文件名和配对状态，检测 `ssh-agent`、Git Credential Manager，并提供 `git remote -v`、`ssh-add -l`、`ssh -T git@host`、`git credential-manager diagnose` 等可复制命令；不会读取或展示私钥内容。
- PR/MR 快捷入口已接入：同步页会为当前本地分支生成 Pull Request / Merge Request 创建链接，支持 GitHub、GitLab、Bitbucket 和常见 Gitea / Forgejo 网页远端；可在同步页、命令面板、当前分支右键菜单中打开或复制链接，本地路径远端会显示中文不可用原因。
- 当前分支 upstream 管理已接入：同步页显示远端分支下拉框，支持 `git branch --set-upstream-to=<远端分支> <当前分支>` 和 `git branch --unset-upstream <当前分支>`；远端分支右键菜单也支持“设为当前分支 upstream”，当前本地分支右键菜单支持“取消当前分支 upstream”。
- 普通推送保护已接入：如果当前分支落后 upstream，或本地领先同时落后形成分叉，后端会阻止普通 `git push` 并返回中文“推送被保护”；同步页会显示保护条、禁用普通推送按钮，并保留安全强推入口。
- 变基拉取已接入：同步页新增“变基拉取”按钮，当前本地分支右键菜单新增“变基拉取当前分支”，后端执行 `git pull --rebase`；执行前会检查本地分支、upstream、未完成操作和干净工作区，确认弹窗说明会重写本地未推送提交 SHA。
- 同步提交预览已接入：同步页中的待拉取 / 待推送提交现在可直接点击，在同步页内预览该提交的文件列表和 Diff，并复用最大化对照。
- 本地静态资源响应已加 `Cache-Control: no-store`，避免开发验证时浏览器继续使用旧版 `app.js` / `styles.css`。
- 远端分支右键菜单已接入“删除远端分支”，后端执行 `git push <远端> --delete <分支>` 并随后 `fetch --prune`；无效远端引用不会给出删除入口。
- 左侧分支行已瘦身：列表里只保留“切换/签出”主按钮，合并、重命名、删除等二级操作放右键菜单，避免低宽度侧边栏里文字和按钮挤压重叠。
- 分支比较已接入：本地/远端分支右键菜单新增“与当前分支比较”，右侧新增“比较”页；后端 `/api/compare` 返回两边独有提交数量、最多 40 条独有提交、目标分支相对共同祖先的文件列表和 Diff，并复用最大化对照。
- 分支整理已接入：右侧“分支”页现在汇总本地分支的已合并、上游丢失和长期未动状态，显示最后提交、upstream、领先/落后、保护/占用原因；分支右键菜单和命令面板可直接打开分支整理，列表中可查看、比较、安全删除单个分支，也可批量安全删除已合并分支。
- 分支整理删除策略：后端新增 `deleteBranches`，批量删除仍逐个执行 `git branch -d`；当前分支、`main` / `master` / `develop` / `dev` / `trunk` 这类主干分支、以及其他 worktree 占用分支会在 UI 禁用，未完全合并的分支仍由 Git 拦截并返回中文原因。
- Git worktree 管理已接入：右侧新增“工作树”页，读取 `git worktree list --porcelain` 并对存在的工作树补充干净/有改动摘要；支持从任意引用创建工作树、可选同时创建新分支、打开已有工作树、复制路径、刷新列表和执行 `git worktree prune --verbose` 清理失效记录。
- Git submodule 管理已接入：右侧新增“子模块”页，读取 `.gitmodules` 和 `git submodule status --recursive`，显示子模块路径、URL、目标提交、初始化状态、提交不一致和本地改动数量；支持初始化全部、更新全部、更新单个子模块、同步 URL、复制路径和复制 URL。
- 比较页任意引用选择器已接入：右侧“比较”页现在显示“基准引用 / 目标引用”两个输入框，带本地分支、远端分支、Tag 和 `HEAD` 候选，也可直接输入提交 SHA；支持开始比较、刷新、交换 base/head，分支右键比较仍会自动填入并运行。
- Tag 管理已接入：右侧新增“标签”页，显示本地 Tag 列表和详情，支持查看 Tag 提交、复制名称、推送 Tag、删除本地 Tag、删除远端 Tag；Tag 行右键菜单也提供同样的相关动作和 Git 指令提示。
- “合并分支”已改为 `--no-ff --no-edit`，即使可以快进也会保留 merge commit，方便在“全部分支”图谱里看到分支回归主线的样式。
- Stash 入口已补齐：工作区顶部有“储藏”按钮，文件右键菜单支持“储藏所选”，储藏列表继续支持查看 Diff、应用、弹出和删除。
- Stash 体验已调整：储藏成功后会自动打开右侧“储藏”页，并提示“工作区更改已移到右侧储藏列表”；工作区顶部按钮文案改短并补 tooltip，避免按钮挤在一起。
- 从储藏创建分支已接入：右侧“储藏”详情新增“建分支”，后端新增 `branchFromStash`，执行 `git stash branch <分支> <储藏>`；会要求工作区干净、拒绝已存在本地分支，成功后切到新分支、应用储藏改动并从储藏列表移除对应 stash；成功提示保持中文，原始 Git 输出放在 `gitOutput` 中。
- `index.lock` 提示已增强：写入操作失败时会显示刚才执行的 Forkline 操作名、锁文件路径/时间、活跃 Forkline 操作和可检测到的 Git 进程；toast 支持多行并延长显示时间。
- 提交右键菜单和提交详情面板都已加入“还原”和软 / 混合 / 硬重置入口，并在文案旁标注 `git revert`、`git reset --soft`、`git reset --mixed`、`git reset --hard`。还原会创建反向提交；硬重置入口标红且确认文案会提示会丢弃工作区改动。
- GitKraken 风格学习方向：图谱保持主视觉区域，左栏承载仓库/分支/工作区导航，右栏承载所选提交的上下文详情；右键菜单按动作类别分组，左侧中文动作、右侧灰色等宽 Git 指令提示，危险动作明确标红。
- 还原冲突体验已补强：`path 'xxx' is unmerged` 会翻译为中文冲突提示；工作区会识别 `REVERT_HEAD` 并显示“还原提交发生冲突”，冲突文件用红色标识，提供“继续还原 (git revert --continue)”和“中止还原 (git revert --abort)”入口。
- 冲突文件一键取舍已接入：工作区底部 Diff 面板和文件右键菜单会在冲突文件上启用“使用当前版本 / 使用对方版本”，后端新增 `resolveConflictFile`，执行 `git checkout --ours/--theirs -- <文件>` 后自动 `git add <文件>`，用于 merge / cherry-pick / revert / rebase 冲突中的文件级快速解决。
- “继续还原”现在会先检查是否仍存在 `REVERT_HEAD`；没有正在进行的还原时返回中文提示，不再显示 Git 原始的 `nothing to commit, working tree clean`。
- Cherry-pick 已接入：提交右键菜单和提交详情面板都有“挑选此提交 / 挑选”入口，并标注 `git cherry-pick`；后端支持 `cherryPickCommit`、`continueCherryPick`、`skipCherryPick`、`abortCherryPick`。遇到 `CHERRY_PICK_HEAD` 时工作区显示“挑选提交发生冲突”，冲突文件用红色标识，并提供“继续挑选 / 跳过挑选 / 中止挑选”。
- Merge 冲突工作流已接入：遇到 `MERGE_HEAD` 时工作区显示“合并发生冲突”，冲突文件用红色标识，并提供“继续合并 (git merge --continue)”和“中止合并 (git merge --abort)”入口；继续合并使用无交互编辑器，避免 Git 打开编辑器卡住。
- Merge commit 主线选择已接入：对 merge 提交执行 cherry-pick / revert 时不再禁用，而是弹出“选择主线”弹窗，显示父提交 1、父提交 2 的短 SHA，并把选择传给后端 `mainline` 参数，对应 `git cherry-pick -m` / `git revert -m`。
- Rebase 分支工作流已接入：分支右键菜单新增“变基当前分支到此分支”，标注 `git rebase`；后端支持 `rebaseOntoRef`、`continueRebase`、`skipRebase`、`abortRebase`。遇到 `.git/rebase-merge` 或 `.git/rebase-apply` 时工作区显示“变基发生冲突”，冲突文件用红色标识，并提供“继续变基 / 跳过变基 / 中止变基”。
- Rebase 风险提示已补齐：执行前会中文确认“会重写当前分支提交 SHA”，工作区不干净时阻止；冲突、没有正在变基、仍有未解决冲突等常见 Git 输出会转为中文提示。
- 基础交互式历史编辑已接入：提交详情和提交右键菜单新增“压缩进父提交 / 修补进父提交 / 丢弃此提交”，分别标注 `git rebase -i squash`、`git rebase -i fixup`、`git rebase -i drop`；后端新增 `rewriteHistoryCommit`，会检查工作区干净、当前处于本地分支、目标提交属于当前分支历史，并拒绝自动处理 merge 提交或包含 merge 的历史段。
- 历史编辑计划预检已接入：点击“压缩进父提交 / 修补进父提交 / 丢弃此提交”不再立即弹原生确认框，而是在提交详情中展开计划卡片；后端 `/api/history-rewrite-preview` 返回当前分支、目标提交、父提交、重放范围、影响提交数量、前几条影响提交、阻塞原因和恢复点提示，只有预检通过时才启用“确认执行”。
- 历史编辑队列已接入：提交详情和提交右键菜单新增“加入队列：压缩 / 修补 / 丢弃”；右侧详情会显示队列动作、统一预检、影响范围、阻塞原因和执行按钮；队列项支持直接改动作、上移/下移整理显示顺序，并在预览区标出按当前分支历史生成的实际执行顺序；后端新增 `/api/history-rewrite-queue-preview` 与 `rewriteHistoryQueue`，一次执行多条 `squash` / `fixup` / `drop`，执行前创建 `history-queue` 恢复点，并拦截脏工作区、重复提交、merge 提交、包含 merge 的重放范围，以及前一条被 drop 但后一条还要 squash/fixup 的危险组合。
- 历史编辑队列批量改信息已接入：提交详情和提交右键菜单新增“加入队列：改信息”，队列项可切换为“修改提交信息”并填写新的摘要/正文；后端支持队列里的 `reword`，会按当前分支历史顺序给 `git rebase -i` 的编辑器写入对应提交信息。当前先允许 `reword` 与 `drop` 混用，暂时拦截 `reword` 与 `squash/fixup` 混用，避免提交信息编辑器和压缩提交信息交织产生意外结果。
- 自动恢复点已接入：追加提交、变基拉取、分支变基、修改提交信息、交互式历史编辑和 reset 前会自动创建 `refs/forkline/recovery/...` 隐藏引用；右侧新增“恢复点”页，可查看、恢复或删除恢复点。恢复动作会先再创建一个恢复前恢复点。
- 恢复点管理已增强：右侧“恢复点”页支持搜索、按分支筛选、按动作筛选、显示筛选数量，并支持删除当前筛选结果；后端新增 `deleteRecoveryPoints`，会先验证所有 ref 都在 `refs/forkline/recovery/...` 下再批量删除。
- 恢复点保留策略已接入：右侧“恢复点”页新增“保留策略”，支持设置“保留最近 N 天”和“每个分支保留 N 个”；策略会保存到当前浏览器的 `forkline-recovery-policy`；前端会预览将清理/保留数量并展开最多 6 个将清理候选，后端执行前重新读取真实 `refs/forkline/recovery/...` 并只删除 Forkline 管理范围内的恢复引用。
- 引用日志恢复已接入：右侧“恢复点”页新增 HEAD reflog 区块，读取 `git log -g HEAD`，可查看 reflog 提交、从某条 reflog 创建 Forkline 恢复点，或在本地分支且工作区干净时恢复到该记录；reflog 行右键菜单也提供“查看提交 / 复制 SHA / 创建恢复点 / 恢复到此处”。
- 工作区 Diff 面板已接入当前文件快捷操作：查看未提交文件对照时，面板标题右侧可直接执行“暂存 / 取消 / 丢弃 / 丢已暂存 / 最大化”，并会按未暂存、已暂存状态自动启用或禁用；标题区支持换行，右侧栏缩窄时不会挤压路径和按钮。
- 工作区 Diff 视图切换和按块操作已接入：底部工作区对照可在“未暂存 / 已暂存”之间切换，同一文件两边都有改动时也能查看对应 Diff；hunk 头会显示“暂存此块 / 丢弃此块”或“取消暂存此块”。后端新增 `stageHunk`、`unstageHunk`、`discardWorktreeHunk`，会重新读取真实 `git diff` / `git diff --cached` 并通过 `git apply` 只应用选中 hunk。未跟踪文本文件会按 40 行左右生成虚拟块，支持只暂存选中的块；未跟踪文件块级丢弃暂不开放。
- 右侧详情标签栏已改成横向可滚动：现在 7 个标签不会再被旧的 5 列网格挤到两行，窄侧栏下会保持单行、文本截断并允许横向滚动。
- 右侧“日志”页已接入：后端会在 `/api/state` 暴露当前正在执行的 Forkline 操作，并在每次 `/api/action` 完成后记录最近 40 条 Git 操作，包含中文操作名、动作类型、成功/失败、耗时和输出摘要；失败响应也会带回最新日志，方便判断刚才哪个操作失败或卡住。
- 提交搜索体验已增强：顶部搜索现在会按空格分词同时匹配提交信息、作者、分支/标签或 SHA，右侧显示命中数量，提交行内高亮匹配片段，并提供一键清空搜索。
- 远端提交跳转已接入：提交详情和提交右键菜单新增“在远端查看 / 远端查看”，会优先使用 `origin` 的 push/fetch URL 生成网页提交链接，支持常见 SSH / HTTPS 远端 URL，并按 GitHub/Gitea、GitLab、Bitbucket 生成对应提交路径。
- 命令面板已接入：顶部新增“命令”入口，并支持键盘打开；面板会按关键词过滤常用页面跳转、同步、工作区、分支、Tag、克隆和初始化动作，禁用当前不可用命令，危险动作标红且继续复用原确认流程。
- 左侧分支筛选已接入：仓库信息下方新增分支筛选框，可同时过滤本地分支和远端分支，匹配分支名、upstream、领先/落后/上游丢失状态，并显示命中数量；命令面板也新增“筛选分支”入口。
- 工作区文件筛选已接入：左侧不再保留重复“工作区”列表，筛选框收拢到底部“工作区”变更面板；底部变更列表可匹配完整路径、文件名、Git 状态、中文状态、未暂存/已暂存状态，并显示命中数量；命令面板新增“筛选工作区文件”入口。
- 未跟踪文件忽略已接入：工作区文件右键菜单新增“加入 .gitignore”和“忽略所在目录”，只对未跟踪文件启用；后端会确认目标仍是未跟踪文件，再向仓库根目录 `.gitignore` 追加 anchored 规则并避免重复追加。
- 常见 `pathspec ... did not match any files` 错误已转成中文提示：当文件已经删除、重命名或不在当前工作区中时，会提示“找不到文件 ...”，不再直接露出 Git 英文原文。
- 顶部最近仓库快速打开已接入：成功打开真实仓库后会写入浏览器 localStorage，顶部下拉框可快速切回最近项目，清除按钮只删除浏览器记录，不会删除本地仓库；窄屏下顶栏会换成两行避免搜索框、路径输入和按钮挤压。
- 克隆仓库入口已接入：顶部新增“克隆”，弹窗填写来源 URL/本地裸仓库路径和目标文件夹；后端新增 `cloneRepository`，执行 `git clone <来源> <保存到>`，目标必须是本机绝对路径，且会拒绝覆盖非空目录；默认克隆后直接打开新仓库并写入最近仓库。
- 初始化仓库入口已接入：顶部新增“初始化”，弹窗填写本机文件夹；后端新增 `initRepository`，执行 `git init <文件夹>`，可初始化已有普通非 Git 文件夹或创建目标文件夹，初始化后可直接打开并写入最近仓库；空仓库 `git log` 失败已容错，未出生分支会显示当前分支名。
- 文件历史已接入：右侧新增“历史”标签，工作区文件右键菜单新增“查看文件历史 git log --follow”，提交文件对照面板新增“文件历史”按钮；后端新增 `/api/file-history`，执行 `git log --follow --find-renames <引用> -- <文件>` 并返回最近 80 条相关提交、文件状态、重命名来源和跳转用 SHA。
- 逐行追踪已接入：右侧新增“逐行”标签，工作区文件右键菜单新增“逐行追踪 git blame”，提交文件对照面板新增“逐行追踪”按钮；后端新增 `/api/file-blame`，执行 `git blame --line-porcelain <引用> -- <文件>`，返回最多前 600 行的行号、提交、作者、时间、摘要和代码内容，并对文件不在当前引用中的情况给中文提示。

## 已验证

- `node --check server.js`
- `node --check public/app.js`
- 测试仓库：`D:\桌面\GitTest`
- 给 GitTest 增加了本地测试远端：`D:\桌面\GitTestRemote.git`
- 验证远端分支：`origin/forkline/remote-checkout-demo`
- API 验证结果：可签出成本地 `forkline/remote-checkout-demo`，并保留 GitTest 中故意留下的已暂存、未暂存、未跟踪改动。
- UI 验证结果：远端分支行显示“签出”和“合并”按钮。
- 合并图谱验证：通过 Forkline API 将 `forkline/merge-clean` 合并到 `main` 后生成两父 merge commit `2f1ec54`，API 返回 `parents.Count = 2`，页面首行显示 `Merge branch 'forkline/merge-clean'`，SVG 图谱进入 `overview` 模式并有回归连线数据。
- Stash 验证：通过 Forkline API 对 `forkline-fixtures/stash-api-temp.txt` 执行所选文件储藏，临时文件被 stash 移除，stash 数量从 1 增至 2；随后已删除临时 stash，GitTest 原有测试改动保持不变。UI 验证：工作区顶部显示“储藏”，文件右键菜单显示“储藏所选”，并能按未暂存/已暂存状态禁用不适用动作。
- Stash 说明：储藏会把改动从工作区移到 Git stash，所以工作区改动消失是正常行为；用户可在右侧“储藏”页恢复。
- 从储藏创建分支 API 验证：临时服务 `http://127.0.0.1:5208` 打开 GitTest 后创建临时 stash `Forkline stash branch api test 2 20260613`，调用 `branchFromStash` 从 `stash@{0}` 创建 `forkline/stash-branch-api-2-20260613`；API 返回中文“已从 stash@{0} 创建并切换到分支...”，`gitOutput` 单独保存 Git 原始输出；新分支工作区出现临时未跟踪文件，stash 列表移除该项。另验证已存在分支会中文拒绝“本地分支 ... 已存在”。临时文件、临时分支已清理，GitTest 已恢复 `123` 分支干净状态。
- `index.lock` 验证：在 `D:\桌面\GitTest\.git\index.lock` 临时创建测试锁后调用 `stageAll`，API 返回“刚才的‘暂存全部更改’没有执行成功”，并显示锁文件路径、锁文件时间和 Git 进程检测说明；测试锁随后已删除。
- Revert / Reset 验证：在 GitTest 临时分支 `forkline/revert-reset-api-20260612134014` 上创建两个测试提交，API 调用 `revertCommit` 生成 `Revert "Forkline revert target ..."` 提交；随后分别验证 `resetToCommit` 的 soft、mixed、hard 模式可移动 HEAD，最终测试分支工作区干净。
- Cherry-pick API 验证：在 GitTest 临时分支 `forkline/cherry-source-*` / `forkline/cherry-target-*` 验证普通挑选成功；在 `forkline/cherry-conflict-*` 验证冲突后返回中文提示、`operation.type = cherryPick`、冲突文件可识别，并验证 `abortCherryPick` 可恢复干净。
- Cherry-pick 流程验证：在 `forkline/cherry-skip-*` 验证冲突后 `skipCherryPick` 会移除 `CHERRY_PICK_HEAD` 并恢复干净；在 `forkline/cherry-continue-*` 验证手动解决并暂存冲突后 `continueCherryPick` 返回中文“已继续挑选并创建提交 <sha>”。
- UI 验证：浏览器打开 `http://127.0.0.1:5177`，GitTest 提交右键菜单显示“挑选此提交 git cherry-pick”；进入 `forkline/ui-cherry-conflict-*` 冲突状态后，工作区横幅显示“挑选提交发生冲突”，按钮状态为“继续挑选”禁用、“跳过挑选”和“中止挑选”可用。
- Merge API 验证：在 GitTest 临时分支 `forkline/merge-conflict-*` 验证冲突后返回中文提示、`operation.type = merge`、冲突文件可识别，并验证 `abortMerge` 可移除 `MERGE_HEAD` 且恢复干净。
- Merge 继续验证：在 `forkline/merge-continue-*` 验证手动解决并暂存冲突后 `continueMerge` 返回中文“已继续合并并创建合并提交 <sha>”，最终 HEAD 是两父 merge commit，工作区干净。
- Merge UI 验证：进入 `forkline/ui-merge-conflict-*` 冲突状态后，工作区横幅显示“合并发生冲突”，按钮状态为“继续合并”禁用、“中止合并”可用，并显示 `git merge --continue` / `git merge --abort` 指令提示。
- 冲突文件一键取舍 API 验证：临时服务 `http://127.0.0.1:5231` 打开 GitTest 后，创建 merge 冲突分支 `forkline/conflict-resolve-merge-20260613041454`，调用 `resolveConflictFile side=ours` 后文件内容保留当前分支版本、冲突标记清除；另创建 cherry-pick 冲突分支 `forkline/conflict-resolve-cherry-20260613041454-target`，调用 `resolveConflictFile side=theirs` 后文件内容保留被挑选提交版本、冲突标记清除并暂存。临时分支已删除，GitTest 已恢复 `123` 分支干净状态。
- Merge mainline API 验证：在 `forkline/mainline-*` 分支创建两父 merge commit `5b478cc`；调用 `revertCommit` 不传 `mainline` 会返回“请选择 merge 提交主线：1-2”；传 `mainline=1` 后 `revertCommit` 创建反向提交并移除合并引入的文件，`cherryPickCommit` 可把同一 merge 提交挑选到新分支并保留文件。
- Merge mainline UI 验证：浏览器选择 merge commit `5b478cc` 后，提交详情“挑选 / 还原”按钮不再禁用，命令提示分别显示 `git cherry-pick -m` / `git revert -m`；点击“挑选”会弹出“挑选 merge 提交”主线弹窗，列出父提交 1、父提交 2 并默认选父提交 1。
- 远端追踪 API 验证：在 GitTest 创建 `forkline/remote-workflow-20260612155930`，第一次通过 Forkline `push` 自动设置 upstream 为 `origin/forkline/remote-workflow-20260612155930`；再次空提交后 API 返回 `ahead = 1`；第二次 `push` 后远端更新成功。
- 远端删除 API 验证：通过 Forkline `deleteRemoteBranch` 删除 `origin/forkline/remote-workflow-20260612155930`，远端分支列表已移除，保留的本地分支显示 `upstreamGone = true` / `[gone]`。
- 远端 UI 验证：浏览器打开 `http://127.0.0.1:5183`，GitTest 左侧本地分支显示“未设置 upstream / origin/... / 上游丢失”徽标；分支行无重叠，控制台无错误；远端分支右键菜单显示“删除远端分支”，且对 `origin/1111` 启用。
- 同步摘要 API 验证：浏览器服务 `http://127.0.0.1:5188` 打开 GitTest 后，验证 `fetch` 能显示“新增远端分支 origin/forkline/sync-fetch-*”；验证远端领先时 `fetch` 显示“落后 0 -> 1”，随后 `pull` 显示“落后 1 -> 0”；验证本地领先时 `push` 显示“领先 1 -> 0”；验证无 upstream 分支 `push` 会设置 upstream，并显示“跟踪变化：未设置 -> origin/...”。测试后 GitTest 已切回 `123` 且工作区干净。
- 安全强推 API 验证：浏览器服务 `http://127.0.0.1:5190` 打开 GitTest 后，在 `forkline/lease-force-*` 分支验证改写历史后普通 `push` 返回非快进中文拒绝，`forcePushLease` 成功并显示“领先 1 -> 0，落后 1 -> 0”和“强制更新”；在 `forkline/lease-stale-*` 分支验证远端被其他克隆推进后 `forcePushLease` 被 `--force-with-lease` 拒绝并返回中文 stale 提示。
- 安全强推 UI 验证：浏览器打开 `http://127.0.0.1:5190`，顶部工具栏显示“强推”且无横向溢出；当前分支右键菜单显示“安全强推当前分支 git push --force-with-lease”，按钮启用，菜单无横向溢出，控制台无 Forkline 错误。
- 同步详情 API 验证：浏览器服务 `http://127.0.0.1:5191` 打开 GitTest 后，在 `forkline/sync-panel-*` 分支验证 `sync.ahead = 1`、`sync.behind = 1`，`incoming` 包含远端提交 `Forkline sync panel remote incoming ...`，`outgoing` 包含本地提交 `Forkline sync panel local outgoing ...`。
- 同步详情 UI 验证：右侧“同步”标签显示“分叉：领先 1，落后 1”，待拉取和待推送列表各显示一条提交，抓取 / 拉取 / 推送 / 安全强推按钮可见且无横向溢出，控制台无 Forkline 错误。
- 远端仓库管理 API 验证：浏览器服务 `http://127.0.0.1:5192` 打开 GitTest 后，添加临时远端 `forkline-temp-*` 指向 `D:\桌面\GitTestRemote.git`，验证 `addRemote`、`fetchRemote`、`setRemoteUrl`、`deleteRemote` 均成功；临时远端已删除，GitTest 最终只剩 `origin`。
- 远端连接检查 API 验证：浏览器服务 `http://127.0.0.1:5201` 打开 GitTest 后，调用 `testRemote origin` 返回“远端 origin 连接正常”、fetch/push URL 和 18 个可读取分支；临时添加坏远端 `forkline-bad-remote-test` 后调用 `testRemote` 返回中文“无法读取，请确认远端 URL 正确、仓库存在，并且你拥有访问权限”，随后坏远端已删除。
- 远端诊断 API 验证：临时服务 `http://127.0.0.1:5216` 打开 GitTest 后，调用 `testRemote origin` 返回 18 个可读取分支；临时添加坏远端 `forkline-bad-diagnostics` 指向不存在路径后，调用 `testRemote` 返回中文“远端 ... 无法读取。请确认远端 URL 正确、仓库存在，并且你拥有访问权限。”；临时坏远端已删除，GitTest 最终只剩 `origin`。内置浏览器本次仍卡在连接层，未记为视觉验证。
- 远端诊断向导 API/HTTP 验证：临时服务 `http://127.0.0.1:5242` 打开 GitTest 后，`testRemote origin` 返回 `remoteCheck.status = success`、`diagnosis.category = ok`、可读分支 18 个；临时坏远端 `forkline-bad-diagnostics-guide` 指向不存在本地路径时，失败响应仍带 `remoteCheck.status = error`、`diagnosis.category = url`、标题“远端 URL 或仓库路径”、3 条中文排查步骤和 3 条可复制命令。HTTP 静态检查确认 `复制诊断命令`、`remote-diagnosis` 和 `.remote-command-copy` 已从最新资源返回。内置浏览器打开 localhost 本次超时并重置会话，未记为视觉验证；临时坏远端已删除，GitTest 最终只剩 `origin` 且工作区干净。
- 同步认证助手 API/静态验证：临时服务 `http://127.0.0.1:5258` 打开 GitTest 后，`sync.auth` 返回 `origin` 为 `kind = local`、摘要包含“1 个本地远端”，命令只给出 `git remote -v`，没有误导到 SSH/HTTPS；同时返回可见 SSH key 文件名、`ssh-agent` 状态和 Git Credential Manager 状态。静态检查确认 `readAuthDiagnostics`、`syncAuthHtml` 和 `.auth-card` 均存在。内置 Browser 本次打开 localhost 仍卡在加载层并重置会话，未记为视觉验证；GitTest 最终保持 `123` 分支且工作区干净。
- PR/MR 快捷入口 API/静态验证：临时服务 `http://127.0.0.1:5264` 打开 GitTest 后，`sync.pullRequest.available = false`，中文原因是“当前仓库没有可识别的 GitHub / GitLab / Bitbucket / Gitea 网页远端。”，没有为本地远端 `D:\桌面\GitTestRemote.git` 误生成链接；静态检查确认同步页按钮、命令面板、当前分支右键菜单、`.pr-card` 样式和后端 `readPullRequestLink` 均已接入。内置 Browser 打开 localhost 本次仍超时并重置会话，未记为视觉验证；GitTest 最终保持 `123` 分支且工作区干净。
- Git worktree API/静态验证：临时服务 `http://127.0.0.1:5267` 打开 GitTest 后，通过 Forkline `createWorktree` 从 `123` 创建临时分支 `forkline/worktree-api-20260613b` 到 `C:\tmp\forkline-worktree-api-20260613b`；返回的 `state.worktrees` 能找到该路径，分支为临时分支、状态 `clean`、改动数 0。随后调用 `openWorktree` 成功切到该工作树，返回仓库路径和分支均正确。验证后已执行 `git worktree remove --force`、删除临时分支和临时目录，GitTest 最终保持 `123` 分支且工作区干净。静态检查确认“工作树”标签、表单、按钮、`.worktree-dashboard` 样式和后端 `parseWorktreeList/createWorktree/openWorktree/pruneAllWorktrees` 均已接入。内置 Browser 本次打开 `http://127.0.0.1:5268/?tab=worktrees` 仍超时并重置会话，未记为视觉验证。
- Git submodule API/静态验证：临时创建本地子模块源仓库 `C:\tmp\forkline-submodule-source-20260613`，并在 GitTest 中通过 `git -c protocol.file.allow=always submodule add` 临时添加到 `forkline-fixtures/submodule-api-20260613`；Forkline API 打开 GitTest 后，`state.submodules` 能列出该路径、URL、`status = ok`、`initialized = true`、`exists = true`、`dirtyCount = 0`。调用 `updateSubmodules` 单个路径返回“已更新...”，调用 `syncSubmodules` 返回 Git 的同步输出。验证后已 `submodule deinit`、`git rm`、`reset --hard`、`clean -fd`，并删除临时源仓库、子模块目录和 `.git/modules` 元数据；最终 GitTest 保持 `123` 分支且工作区干净，临时路径均不存在。静态检查确认“子模块”标签、按钮、`.submodule-dashboard` 样式和后端 `parseSubmodules/initSubmodules/updateSubmodules/syncSubmodules` 均已接入。
- Git submodule 复测：本地服务 `http://127.0.0.1:5269` 打开 GitTest 后，临时创建本地子模块源仓库 `C:\tmp\forkline-submodule-source-rerun-20260613`，并添加到 `forkline-fixtures/submodule-rerun-20260613`；Forkline API 返回该子模块 `status = ok`、`initialized = true`、`exists = true`、`dirtyCount = 0`，单个 `updateSubmodules` 返回“已更新forkline-fixtures/submodule-rerun-20260613”，`syncSubmodules` 返回 Git 的同步输出。复测后 GitTest 保持 `123` 分支且工作区干净，临时源仓库和子模块目录均已删除。内置 Browser 打开 `http://127.0.0.1:5269/?tab=submodules` 本次在连接/加载层超时并重置会话，未记为视觉验证。
- 从提交创建分支验证：本地服务 `http://127.0.0.1:5270` 打开 GitTest 后，通过 Forkline API 调用 `createBranch`，以 `HEAD~1` 的提交 SHA 创建临时分支 `forkline/branch-from-commit-api-20260613` 且 `checkout = false`；`git rev-parse` 确认临时分支指向指定提交 `cdd252a`，测试后已删除临时分支，GitTest 保持 `123` 分支且工作区干净。静态检查确认提交详情按钮、提交右键菜单 `git branch` 提示和命令面板文案均已接入。
- 补丁工作流 API/静态验证：本地服务 `http://127.0.0.1:5271` 打开 GitTest 后，在临时分支 `forkline/patch-api-verify-20260613` 创建测试提交；`/api/patch?sha=<提交>` 返回 `git format-patch -1 6a886e8 --stdout` 生成的补丁，文件名为 `6a886e8-Forkline-patch-API-verify.patch` 且包含测试文件 `forkline-fixtures/patch-api-verify-20260613.txt`。随后 `reset --hard HEAD~1` 移除该提交，再通过 `applyPatch`、`stage = true` 应用补丁，API 返回“已应用补丁并暂存改动”，`git diff --cached --name-only` 确认测试文件进入暂存区。测试后已 `reset --hard`、`clean -fd`、切回 `123` 并删除临时分支，GitTest 保持干净。静态检查确认补丁弹窗、命令面板、提交详情按钮、提交右键菜单和后端 `/api/patch` / `applyPatch` 均已接入。内置 Browser 打开 `http://127.0.0.1:5272/` 本次仍在 localhost 加载层超时并重置会话，未记为视觉验证。
- 远端仓库管理 UI 验证：浏览器服务 `http://127.0.0.1:5193` 打开 GitTest 的 `?tab=sync`，右侧同步页显示真实仓库 `origin` 的 fetch / push URL；249px 宽右侧内容无横向溢出，远端右键菜单显示“抓取此远端 / 修改 URL / 复制 fetch URL / 复制 push URL / 删除远端”，控制台无错误。
- Upstream 管理 API 验证：浏览器服务 `http://127.0.0.1:5194` 打开 GitTest 后，在当前 `123` 分支调用 `setUpstream` 设置到 `origin/123`，API 返回 `sync.upstream = origin/123` 且领先/落后均为 0；随后调用 `unsetUpstream`，API 返回 upstream 为空。验证后 GitTest 已恢复为无 upstream、工作区干净。
- Upstream 管理 UI 验证：浏览器打开 `http://127.0.0.1:5194/?tab=sync`，同步页“上游分支”下拉默认选中 `origin/123`，设置按钮可见，未设置 upstream 时取消按钮禁用；249px 右侧内容无横向溢出。远端分支 `origin/123` 右键菜单显示“设为当前分支 upstream git branch -u”，按钮启用，菜单无横向溢出，控制台无错误。
- 推送保护 API 验证：浏览器服务 `http://127.0.0.1:5195` 打开 GitTest 后，创建临时分叉分支 `forkline/push-guard-*`，让本地相对 upstream 同时 `ahead = 1`、`behind = 1`；调用 Forkline `push` 返回中文“推送被保护”，没有执行普通推送。临时本地分支、远端分支和 `C:\tmp` 临时克隆已清理。
- 推送保护 UI 验证：在临时分叉分支 `forkline/push-guard-ui-*` 上打开 `http://127.0.0.1:5195/?tab=sync`，同步页显示“普通推送已保护”保护条，普通“推送”按钮禁用且 title 显示“本地领先 1，同时落后 1，普通推送已保护”，安全强推按钮保持可用；249px 右侧内容无横向溢出，控制台无错误。临时本地分支、远端分支和 `C:\tmp` 临时克隆已清理。
- 变基拉取 API 验证：浏览器服务 `http://127.0.0.1:5196` 打开 GitTest 后，创建临时分叉分支 `forkline/pull-rebase-verify-20260612-01`，让本地相对 upstream 同时 `ahead = 1`、`behind = 1`；调用 Forkline `pullRebase` 后返回“变基拉取完成”，同步状态变为 `behind = 0`、`ahead = 1`，Git 日志顺序为本地重放提交 -> 远端提交 -> 基准提交。临时本地分支、远端分支和 `C:\\tmp` 临时克隆已清理。
- 变基拉取 UI 验证：浏览器打开 `http://127.0.0.1:5196/?tab=sync`，同步页显示“变基拉取 pull --rebase”按钮；259px 右侧内容无横向溢出，控制台无 Forkline 错误。当前分支右键菜单显示“变基拉取当前分支 git pull --rebase”，按钮启用，菜单无横向溢出。
- 同步提交预览 UI 验证：浏览器服务 `http://127.0.0.1:5197` 打开 GitTest 后，创建临时分叉分支 `forkline/sync-preview-verify-20260612-01`，远端和本地各新增一个真实文件提交；同步页点击待拉取提交后预览 `forkline-fixtures/sync-preview-remote.txt` 和 `remote preview line 1`，点击待推送提交后预览 `forkline-fixtures/sync-preview-local.txt` 和 `local preview line 1`；页面仍停留在“同步”页，无横向溢出，控制台无错误，最大化对照可打开当前同步提交 Diff。临时本地分支、远端分支和 `C:\\tmp` 临时克隆已清理。
- 自动恢复点 API/UI 验证：浏览器服务 `http://127.0.0.1:5198` 打开 GitTest 后，在临时分支 `forkline/recovery-verify-20260612-01` 创建 base/tip 两次提交；调用 `resetToCommit` hard 到 base 后，API 返回“恢复点：.../reset-hard（b5cb268）”；调用 `restoreRecoveryPoint` 后 HEAD 回到 `b5cb268`，被 hard reset 移除的文件恢复，并自动创建 `restore-recovery` 恢复点。右侧“恢复点”页显示“硬重置前 / 恢复前”两条记录，恢复/删除按钮启用，无横向溢出，控制台无错误。临时本地分支和本次隐藏恢复点已清理。
- 工作区 Diff 快捷操作 UI 验证：浏览器服务 `http://127.0.0.1:5177` 打开 GitTest 后，创建临时未跟踪文件 `forkline-workdiff-actions-test.txt`；刷新工作区后底部 Diff 面板显示该文件，“暂存 / 丢弃”启用，“取消 / 丢已暂存”禁用；点击底部“暂存”后文件进入已暂存区且按钮切换为“取消 / 丢已暂存”启用；点击底部“取消”后回到未暂存状态。测试文件已删除，GitTest 已恢复 `123` 分支干净状态。
- 工作区 Diff 按块操作 API 验证：临时服务 `http://127.0.0.1:5226` 打开 GitTest 临时分支 `forkline/hunk-actions-api-20260613035019`，创建 40 行测试文件并隔远修改第 5 行和第 35 行形成两个 hunk；调用 `stageHunk` 只暂存第 1 个 hunk，缓存区只含第 5 行改动；调用 `unstageHunk` 后缓存区清空且工作区保留两处改动；调用 `discardWorktreeHunk` 丢弃第 2 个 hunk 后第 35 行恢复、第 5 行改动保留。临时分支已删除，GitTest 已恢复 `123` 分支干净状态。
- 未跟踪文件按块暂存 API/HTTP 验证：临时服务 `http://127.0.0.1:5243` 打开 GitTest 后，创建 90 行未跟踪文本文件 `forkline-fixtures/untracked-hunk-api-20260613.txt`；`/api/worktree-diff` 返回 `scope = untracked` 且拆成 `@@ -0,0 +1,40 @@`、`@@ -0,0 +41,40 @@`、`@@ -0,0 +81,11 @@` 三个 hunk；调用 `stageHunk` 的 `scope = untracked`、`hunkIndex = 1` 后，索引只含第 41-80 行，工作区状态为 `AM`，API 返回“已暂存此未跟踪文件改动块”。HTTP 静态检查确认前端已返回 `data-hunk-scope="untracked"` 和未跟踪块暂存按钮 title；内置浏览器打开 localhost 本次仍超时并重置会话，未记为视觉验证。测试文件和索引已清理，GitTest 已恢复 `123` 分支干净状态。
- 工作区 Diff 视图切换 API 验证：临时服务 `http://127.0.0.1:5228` 打开 GitTest 临时分支 `forkline/workdiff-scope-api-20260613040156`，同一文件第 5 行为已暂存改动、第 35 行为未暂存改动；`/api/worktree-diff` 默认返回 `scope=unstaged` 且只含第 35 行，`scope=staged` 只含第 5 行；随后调用 `unstageHunk` 只取消已暂存 hunk，缓存区清空，两处改动均保留在工作区。临时分支已删除，GitTest 已恢复 `123` 分支干净状态。
- 未跟踪文件忽略 API 验证：临时服务 `http://127.0.0.1:5238` 打开 GitTest 后，创建临时未跟踪文件 `forkline-fixtures/forkline-ignore-api-*.log` 和临时目录 `forkline-fixtures/forkline-ignore-dir-*`；调用 `ignoreWorktreePath` 的 file / directory 两种模式后，`.gitignore` 分别追加 `/forkline-fixtures/forkline-ignore-api-*.log` 和 `/forkline-fixtures/forkline-ignore-dir-*/`，刷新工作区后这两个未跟踪目标不再列出。验证后已恢复原 `.gitignore`，删除临时文件和目录，GitTest 回到 `123` 分支干净状态。
- Tag API 验证：在 GitTest 创建临时附注 Tag `forkline-tag-workflow-20260612162546`，`/api/state` 能列出；通过 Forkline `pushTag` 推送到 `origin` 后 `git ls-remote --tags origin <tag>` 可查到；通过 `deleteRemoteTag` 删除远端 Tag 后远端查不到；通过 `deleteTag` 删除本地 Tag 后 `/api/state` 不再列出。临时 Tag 已清理。
- Tag UI 验证：浏览器打开 `http://127.0.0.1:5184`，GitTest 右侧“标签”页显示 `forkline-v0.1.0`，详情按钮为“查看提交 / 复制名称 / 推送 Tag / 删除本地 / 删除远端”；Tag 行右键菜单显示“查看此 Tag 提交 / 复制 Tag 名称 / 推送 Tag / 删除本地 Tag / 删除远端 Tag”，控制台无错误。
- Rebase API 验证：在 GitTest 上验证普通 `rebaseOntoRef` 成功，topic 分支父提交变为目标分支 HEAD；冲突场景会返回中文变基冲突提示，`repo.operation.type = rebase`，冲突文件可识别。
- Rebase 冲突流程验证：在 GitTest 上分别验证 `abortRebase` 可恢复干净状态，手动解决并暂存后 `continueRebase` 可继续并让 topic 父提交等于目标 HEAD，`skipRebase` 可跳过当前冲突提交并结束变基。
- Rebase UI 验证：浏览器打开 `http://127.0.0.1:5186`，GitTest 分支右键菜单显示“变基当前分支到此分支 git rebase”；进入变基冲突后，工作区横幅显示“变基发生冲突”，未解决冲突时“继续变基”禁用，“跳过变基”和“中止变基”可用，控制台无错误。
- 历史编辑 API 验证：浏览器服务 `http://127.0.0.1:5187` 打开 GitTest 后，通过 `/api/action` 验证 `rewriteHistoryCommit` 的 `squash`、`fixup`、`drop`。`squash` 和 `fixup` 都把两次提交压成 1 次并保留第二次提交的文件改动；`fixup` 保留父提交标题；`drop` 删除目标提交引入的第二行改动，最终工作区干净。
- 历史编辑 UI 验证：浏览器打开 `http://127.0.0.1:5187`，GitTest 提交详情显示“压缩进父提交 / 修补进父提交 / 丢弃此提交”；提交右键菜单显示同样动作和 Git 指令提示。右键菜单与详情按钮无横向溢出，控制台无 Forkline 错误。
- 历史编辑计划预检 API 验证：浏览器服务 `http://127.0.0.1:5199` 打开 GitTest 后，请求 `/api/history-rewrite-preview?sha=4fbce18&mode=fixup` 返回 `branch = 123`、`affectedCount = 2`、`canRun = true`、无阻塞项；临时创建未跟踪文件后再次请求同一预检返回 `canRun = false`、`dirtyCount = 1`，阻塞原因为“当前还有 1 个未提交改动。请先提交、储藏或丢弃后再编辑历史。”测试文件已删除，GitTest 已恢复 `123` 分支干净状态。
- 历史编辑队列 API 验证：临时服务 `http://127.0.0.1:5207` 打开 GitTest 临时分支 `forkline/history-queue-api-20260613-0219`，创建 A/B/C/D 四个提交；预检队列 `B -> fixup`、`C -> drop` 返回 `canRun = true`、`queueCount = 2`、`affectedCount = 4`；执行 `rewriteHistoryQueue` 后分支从 4 个提交变为 2 个提交，`B line` 被合并进 A，C 文件被删除，D 文件保留，并创建 `history-queue` 恢复点。另验证 `A -> drop`、`D -> fixup` 的危险组合返回中文阻塞“前一条 ... 会被丢弃”。临时分支和本次恢复点已清理，GitTest 已恢复 `123` 分支干净状态。
- 历史编辑队列编辑 API 验证：临时服务 `http://127.0.0.1:5214` 打开 GitTest 临时分支 `forkline/history-queue-edit-api-20260613`，创建 A/B/C/D 四个提交；请求队列故意按 `C -> drop`、`B -> fixup` 的显示顺序提交，预检仍返回 `canRun = true`、`queueCount = 2`、`affectedCount = 4`；执行后 `B line` 合入 A，C 文件被删除，D 文件保留，证明实际执行仍按 Git 历史顺序生成。临时分支和恢复点已清理，GitTest 已恢复 `123` 分支干净状态。内置浏览器本次仍卡在连接层，未记为视觉验证。
- 历史编辑队列批量改信息 API 验证：临时服务 `http://127.0.0.1:5224` 打开 GitTest 临时分支 `forkline/history-queue-reword-api-20260613033651`，创建 A/B/C 三个提交；队列 `B -> reword`、`C -> reword` 预检返回 `canRun = true`，执行后最近三条提交信息变为 `C new`、`B new`、`A`，且 B 的提交正文写入成功。另验证 `reword + fixup` 组合会被中文阻塞“暂不和压缩/修补混用”。临时分支和本次恢复点已清理，GitTest 已恢复 `123` 分支干净状态。
- 右侧标签栏静态验证：`public/styles.css` 中 `.tabs` 已从 `repeat(5, 1fr)` 改为 flex 横向滚动，`.tab` 设置 `flex: 1 0 56px`、固定高度和省略号；`node --check public/app.js`、`node --check server.js`、`git diff --check` 均通过。
- 操作日志 API 验证：浏览器服务 `http://127.0.0.1:5201` 打开 GitTest 后，调用 `findCheckoutStash` 成功返回日志项“查找 123 的签出储藏 / success / 操作已完成”；调用不存在文件的 `stageFile` 返回中文“找不到文件 ...”，并在 `operationLog` 中记录失败项。
- 恢复点批量清理 API 验证：在 GitTest 临时创建 3 条 `refs/forkline/recovery/...` 测试引用，其中 2 条分支为 `123`、1 条分支为 `other`；通过 `deleteRecoveryPoints` 删除分支 `123` 的筛选结果后只剩 `other`，随后清理剩余测试引用，最终恢复点数量为 0。
- 恢复点保留策略 API 验证：临时服务 `http://127.0.0.1:5212` 打开 GitTest 后，创建 5 条 `refs/forkline/recovery/.../forkline_policy_test/...` 测试引用；调用 `pruneRecoveryPoints`，策略为“保留最近 30 天 / 每个分支保留 2 个”，API 返回已清理 3 个并保留最新 2 个；随后已清理剩余测试引用，GitTest 恢复点 refs 为空。
- 恢复点策略偏好/候选预览静态验证：`node --check public/app.js`、`node --check server.js`、`git diff --check` 通过；HTTP 静态资源检查确认最新 `app.js` 返回 `forkline-recovery-policy`、`saveRecoveryPolicyPreference`、`recoveryRetentionPreviewHtml`，最新 `styles.css` 返回 `.recovery-retention-preview-row`。内置浏览器打开 localhost 本次仍超时并重置会话，未记为视觉验证。
- 引用日志恢复 API/UI 验证：临时服务 `http://127.0.0.1:5274` 打开 GitTest 后，在临时分支 `forkline-reflog-verify-*` 创建测试提交，再 `reset --hard HEAD~1` 制造 reflog 记录；`/api/state` 返回该临时提交的 reflog 项，`createRecoveryPointFromReflog` 创建 `refs/forkline/recovery/.../reflog-*`，`restoreReflogEntry` 恢复 HEAD 到临时提交并自动创建 `restore-reflog` 恢复前恢复点。内置浏览器打开同一服务后手动打开 GitTest，右侧“恢复点”页显示“引用日志 80 条”，reflog 行无横向溢出，右键菜单显示“查看提交 / 复制 SHA / 创建恢复点 update-ref / 恢复到此处 reset --hard”。测试后已切回 `123`、删除临时分支和测试恢复点 refs，GitTest 工作区干净。
- 分支比较 API 验证：浏览器服务 `http://127.0.0.1:5201` 打开 GitTest 后，请求 `/api/compare?base=123&head=forkline/merge-clean` 返回 `headOnlyCount = 3`、`files = 6`、`diff = 57`；请求 `/api/compare?base=123&head=origin/forkline/merge-clean` 同样返回 3 个目标独有提交和 6 个文件变化。
- 比较页任意引用选择器 API/HTTP 验证：临时服务 `http://127.0.0.1:5239` 打开 GitTest 后，请求 `/api/compare?base=123&head=forkline/merge-clean` 返回 `base = 123`、`head = forkline/merge-clean`、目标独有提交 3 个、文件变化 6 个；HTTP 静态检查确认 `comparePickerHtml`、`data-compare-run` 和 `.compare-picker` 均已从最新资源返回。内置 Browser 本次打开 localhost 仍超时，未记为视觉验证。
- 分支整理 API 验证：临时服务 `http://127.0.0.1:5256` 打开 GitTest 后，创建本地临时分支 `forkline/cleanup-api-verify` 指向当前 HEAD；`branchCleanup` 返回该分支 `mergedIntoCurrent = true`、`canDelete = true`、`statusLabel = 已合并`；调用 `deleteBranches` 后返回“已删除 1 个本地分支”，`show-ref` 确认该临时分支不存在。内置 Browser 本次打开 localhost 仍卡在连接/加载层，未记为视觉验证；GitTest 最终保持 `123` 分支且工作区干净。
- 最近仓库验证：`node --check public/app.js`、`node --check server.js`、`git diff --check` 均通过；Forkline API 可打开 `D:\桌面\GitTest`，返回仓库 `GitTest`、分支 `123`、工作区改动 0；静态检查确认最近仓库入口、localStorage、下拉复位和低宽度顶栏换行规则存在。内置浏览器打开本地页本次超时，未记为视觉验证。
- 克隆仓库 API 验证：临时服务 `http://127.0.0.1:5202` 调用 `cloneRepository`，从 `D:\桌面\GitTestRemote.git` 克隆到 `C:\tmp\forkline-clone-api-20260613`，返回 `ok=true`、新仓库 `forkline-clone-api-20260613`、分支 `main`、工作区改动 0；再次克隆到同一非空目录会中文拒绝“目标文件夹不是空的”。测试克隆目录已删除，临时服务已关闭。
- 初始化仓库 API 验证：临时服务 `http://127.0.0.1:5206` 调用 `initRepository` 初始化 `C:\tmp\forkline-init-api-20260613`，返回 `ok=true`、新仓库 `forkline-init-api-20260613`、分支 `master`、同步状态分支 `master`、提交数 0；重复初始化同一目录会中文拒绝“这个文件夹已经是 Git 仓库”。另验证已有普通非空目录 `C:\tmp\forkline-init-existing-api-20260613` 可初始化且不强制打开。HTTP 静态检查确认 `initRepo`、`initModal`、`initForm` 和“初始化仓库”入口存在；内置浏览器本次打开本地页仍超时，未记为视觉验证。临时测试目录已清理，临时服务已关闭。
- 文件历史 API 验证：临时服务 `http://127.0.0.1:5203` 打开 `D:\桌面\GitTest` 后，请求 `/api/file-history?file=配置文件1.txt&ref=123` 返回文件 `配置文件1.txt`、引用 `123`、6 条历史记录和命令 `git log --follow 123 -- 配置文件1.txt`；请求绝对路径 `D:\桌面\GitTest\配置文件1.txt` 会中文拒绝“文件路径不合法”。静态检查确认“历史”标签、文件右键菜单、提交文件面板按钮和 CSS 已接入；内置浏览器打开本地页本次仍超时，未记为视觉验证。
- 逐行追踪 API 验证：临时服务 `http://127.0.0.1:5205` 打开 `D:\桌面\GitTest` 后，请求 `/api/file-blame?file=配置文件3.txt&ref=123` 返回文件 `配置文件3.txt`、引用 `123`、1 行 blame、首行提交 `1ff8d18`、作者 `Admin`、未截断；请求 `配置文件1.txt` 返回中文“文件 配置文件1.txt 在 123 中不存在...”；请求绝对路径 `D:\桌面\GitTest\配置文件3.txt` 会中文拒绝“文件路径不合法”。静态检查确认“逐行”标签、文件右键菜单、提交文件面板按钮和 CSS 已接入。

## GitTest 测试数据

`D:\桌面\GitTest` 是功能测试沙盒，可以继续随便改。当前故意保留：

- 当前分支：`123`
- 当前工作区：干净。
- 本地远端：`origin -> D:\桌面\GitTestRemote.git`
- 上游丢失测试分支：`forkline/remote-workflow-20260612155930`，用于验证本地分支显示 `[gone]` / “上游丢失”。
- 储藏：`Forkline 测试储藏：可应用/弹出/删除`
- 测试分支：`forkline/merge-clean`、`forkline/merge-conflict`、`forkline/cherry-pick-ready`、`forkline/revert-reset-lab`，以及多组 `forkline/cherry-*`、`forkline/merge-*`、`forkline/mainline-*`、`forkline/ui-cherry-*`、`forkline/ui-merge-*`、`forkline/rebase-*`、`forkline/history-*`、`forkline/sync-*`、`forkline/sync-panel-*`、`forkline/lease-*` 临时验证分支。
- 测试 Tag：`forkline-v0.1.0`

## 下一步建议

按原计划继续完善：

1. 工作区精细提交继续增强：现在已有未暂存/已暂存 Diff 切换、已跟踪文件按块暂存/取消暂存/丢弃，以及未跟踪文本文件按块暂存；后续可以补行级选择、未跟踪文件块级拆分预览提示，以及按块操作后的更细粒度视觉反馈。
2. 远端同步体验继续补：同步摘要、force-with-lease、远端 URL 管理、upstream 管理、推送前分叉保护、变基拉取、同步提交预览和诊断向导已完成，后续可继续做真实 SSH key 列表检测、系统凭据管理器入口和远端托管平台状态检查。
3. 恢复点策略继续增强：现在已有手动策略清理、本地偏好记忆和清理前候选列表展开；后续可以增加危险操作完成后可选自动执行保留策略，以及按仓库单独保存策略。
