# Forkline 继续开发记录

## 当前状态

- 远端 `origin/main` 已拉取并基于最新代码开发。
- 已完成“远端分支 checkout”：远端分支列表现在有可见的“签出”按钮，右键菜单也支持“签出为本地分支”。
- 签出规则：`origin/feature/a` 会创建或切换到本地 `feature/a`；如果本地分支已存在就直接切换；工作区有修改时继续使用“保留 / 储藏 / 强制”的中文确认流程。
- 远端分支解析已改为读取 `refs/remotes/*`，并按 `git remote` 返回的真实远端名过滤；`git-svn` 这类松散 remote-tracking ref 不再混入“远端分支”列表。
- 本地分支列表已显示 upstream、领先/落后数量和上游丢失状态；当前分支没有 upstream 时显示“未设置 upstream”。
- 顶部“推送”已改为智能推送：已有 upstream 时执行 `git push`；没有 upstream 时优先执行 `git push -u origin <当前分支>`，没有 `origin` 则使用第一个远端。
- Fetch / Pull / Push 同步摘要已接入：操作完成后会显示当前分支 upstream、同步状态、领先/落后变化，以及远端新增/更新/删除引用；无 upstream 智能推送会显示“跟踪变化：未设置 -> origin/... ”。
- 安全强推已接入：顶部工具栏新增“强推”，当前本地分支右键菜单新增“安全强推当前分支”，后端执行 `git push --force-with-lease <远端> HEAD:<分支>`；普通 push 非快进拒绝和 force-with-lease stale 拒绝都有中文提示。
- 右侧“同步”页已接入：显示当前分支 upstream、同步状态、操作建议、待拉取提交和待推送提交，并提供抓取 / 拉取 / 推送 / 安全强推入口。
- 同步页远端仓库管理已接入：显示 `git remote -v` 的 fetch / push URL，支持添加远端、抓取单个远端、修改 URL、删除远端；远端行右键菜单也提供抓取、修改 URL、复制 URL、删除远端，并显示对应 Git 指令。
- 当前分支 upstream 管理已接入：同步页显示远端分支下拉框，支持 `git branch --set-upstream-to=<远端分支> <当前分支>` 和 `git branch --unset-upstream <当前分支>`；远端分支右键菜单也支持“设为当前分支 upstream”，当前本地分支右键菜单支持“取消当前分支 upstream”。
- 普通推送保护已接入：如果当前分支落后 upstream，或本地领先同时落后形成分叉，后端会阻止普通 `git push` 并返回中文“推送被保护”；同步页会显示保护条、禁用普通推送按钮，并保留安全强推入口。
- 变基拉取已接入：同步页新增“变基拉取”按钮，当前本地分支右键菜单新增“变基拉取当前分支”，后端执行 `git pull --rebase`；执行前会检查本地分支、upstream、未完成操作和干净工作区，确认弹窗说明会重写本地未推送提交 SHA。
- 同步提交预览已接入：同步页中的待拉取 / 待推送提交现在可直接点击，在同步页内预览该提交的文件列表和 Diff，并复用最大化对照。
- 本地静态资源响应已加 `Cache-Control: no-store`，避免开发验证时浏览器继续使用旧版 `app.js` / `styles.css`。
- 远端分支右键菜单已接入“删除远端分支”，后端执行 `git push <远端> --delete <分支>` 并随后 `fetch --prune`；无效远端引用不会给出删除入口。
- 左侧分支行已瘦身：列表里只保留“切换/签出”主按钮，合并、重命名、删除等二级操作放右键菜单，避免低宽度侧边栏里文字和按钮挤压重叠。
- Tag 管理已接入：右侧新增“标签”页，显示本地 Tag 列表和详情，支持查看 Tag 提交、复制名称、推送 Tag、删除本地 Tag、删除远端 Tag；Tag 行右键菜单也提供同样的相关动作和 Git 指令提示。
- “合并分支”已改为 `--no-ff --no-edit`，即使可以快进也会保留 merge commit，方便在“全部分支”图谱里看到分支回归主线的样式。
- Stash 入口已补齐：工作区顶部有“储藏”按钮，文件右键菜单支持“储藏所选”，储藏列表继续支持查看 Diff、应用、弹出和删除。
- Stash 体验已调整：储藏成功后会自动打开右侧“储藏”页，并提示“工作区更改已移到右侧储藏列表”；工作区顶部按钮文案改短并补 tooltip，避免按钮挤在一起。
- `index.lock` 提示已增强：写入操作失败时会显示刚才执行的 Forkline 操作名、锁文件路径/时间、活跃 Forkline 操作和可检测到的 Git 进程；toast 支持多行并延长显示时间。
- 提交右键菜单和提交详情面板都已加入“还原”和软 / 混合 / 硬重置入口，并在文案旁标注 `git revert`、`git reset --soft`、`git reset --mixed`、`git reset --hard`。还原会创建反向提交；硬重置入口标红且确认文案会提示会丢弃工作区改动。
- GitKraken 风格学习方向：图谱保持主视觉区域，左栏承载仓库/分支/工作区导航，右栏承载所选提交的上下文详情；右键菜单按动作类别分组，左侧中文动作、右侧灰色等宽 Git 指令提示，危险动作明确标红。
- 还原冲突体验已补强：`path 'xxx' is unmerged` 会翻译为中文冲突提示；工作区会识别 `REVERT_HEAD` 并显示“还原提交发生冲突”，冲突文件用红色标识，提供“继续还原 (git revert --continue)”和“中止还原 (git revert --abort)”入口。
- “继续还原”现在会先检查是否仍存在 `REVERT_HEAD`；没有正在进行的还原时返回中文提示，不再显示 Git 原始的 `nothing to commit, working tree clean`。
- Cherry-pick 已接入：提交右键菜单和提交详情面板都有“挑选此提交 / 挑选”入口，并标注 `git cherry-pick`；后端支持 `cherryPickCommit`、`continueCherryPick`、`skipCherryPick`、`abortCherryPick`。遇到 `CHERRY_PICK_HEAD` 时工作区显示“挑选提交发生冲突”，冲突文件用红色标识，并提供“继续挑选 / 跳过挑选 / 中止挑选”。
- Merge 冲突工作流已接入：遇到 `MERGE_HEAD` 时工作区显示“合并发生冲突”，冲突文件用红色标识，并提供“继续合并 (git merge --continue)”和“中止合并 (git merge --abort)”入口；继续合并使用无交互编辑器，避免 Git 打开编辑器卡住。
- Merge commit 主线选择已接入：对 merge 提交执行 cherry-pick / revert 时不再禁用，而是弹出“选择主线”弹窗，显示父提交 1、父提交 2 的短 SHA，并把选择传给后端 `mainline` 参数，对应 `git cherry-pick -m` / `git revert -m`。
- Rebase 分支工作流已接入：分支右键菜单新增“变基当前分支到此分支”，标注 `git rebase`；后端支持 `rebaseOntoRef`、`continueRebase`、`skipRebase`、`abortRebase`。遇到 `.git/rebase-merge` 或 `.git/rebase-apply` 时工作区显示“变基发生冲突”，冲突文件用红色标识，并提供“继续变基 / 跳过变基 / 中止变基”。
- Rebase 风险提示已补齐：执行前会中文确认“会重写当前分支提交 SHA”，工作区不干净时阻止；冲突、没有正在变基、仍有未解决冲突等常见 Git 输出会转为中文提示。
- 基础交互式历史编辑已接入：提交详情和提交右键菜单新增“压缩进父提交 / 修补进父提交 / 丢弃此提交”，分别标注 `git rebase -i squash`、`git rebase -i fixup`、`git rebase -i drop`；后端新增 `rewriteHistoryCommit`，会检查工作区干净、当前处于本地分支、目标提交属于当前分支历史，并拒绝自动处理 merge 提交或包含 merge 的历史段。
- 历史编辑计划预检已接入：点击“压缩进父提交 / 修补进父提交 / 丢弃此提交”不再立即弹原生确认框，而是在提交详情中展开计划卡片；后端 `/api/history-rewrite-preview` 返回当前分支、目标提交、父提交、重放范围、影响提交数量、前几条影响提交、阻塞原因和恢复点提示，只有预检通过时才启用“确认执行”。
- 自动恢复点已接入：追加提交、变基拉取、分支变基、修改提交信息、交互式历史编辑和 reset 前会自动创建 `refs/forkline/recovery/...` 隐藏引用；右侧新增“恢复点”页，可查看、恢复或删除恢复点。恢复动作会先再创建一个恢复前恢复点。
- 工作区 Diff 面板已接入当前文件快捷操作：查看未提交文件对照时，面板标题右侧可直接执行“暂存 / 取消 / 丢弃 / 丢已暂存 / 最大化”，并会按未暂存、已暂存状态自动启用或禁用；标题区支持换行，右侧栏缩窄时不会挤压路径和按钮。

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
- `index.lock` 验证：在 `D:\桌面\GitTest\.git\index.lock` 临时创建测试锁后调用 `stageAll`，API 返回“刚才的‘暂存全部更改’没有执行成功”，并显示锁文件路径、锁文件时间和 Git 进程检测说明；测试锁随后已删除。
- Revert / Reset 验证：在 GitTest 临时分支 `forkline/revert-reset-api-20260612134014` 上创建两个测试提交，API 调用 `revertCommit` 生成 `Revert "Forkline revert target ..."` 提交；随后分别验证 `resetToCommit` 的 soft、mixed、hard 模式可移动 HEAD，最终测试分支工作区干净。
- Cherry-pick API 验证：在 GitTest 临时分支 `forkline/cherry-source-*` / `forkline/cherry-target-*` 验证普通挑选成功；在 `forkline/cherry-conflict-*` 验证冲突后返回中文提示、`operation.type = cherryPick`、冲突文件可识别，并验证 `abortCherryPick` 可恢复干净。
- Cherry-pick 流程验证：在 `forkline/cherry-skip-*` 验证冲突后 `skipCherryPick` 会移除 `CHERRY_PICK_HEAD` 并恢复干净；在 `forkline/cherry-continue-*` 验证手动解决并暂存冲突后 `continueCherryPick` 返回中文“已继续挑选并创建提交 <sha>”。
- UI 验证：浏览器打开 `http://127.0.0.1:5177`，GitTest 提交右键菜单显示“挑选此提交 git cherry-pick”；进入 `forkline/ui-cherry-conflict-*` 冲突状态后，工作区横幅显示“挑选提交发生冲突”，按钮状态为“继续挑选”禁用、“跳过挑选”和“中止挑选”可用。
- Merge API 验证：在 GitTest 临时分支 `forkline/merge-conflict-*` 验证冲突后返回中文提示、`operation.type = merge`、冲突文件可识别，并验证 `abortMerge` 可移除 `MERGE_HEAD` 且恢复干净。
- Merge 继续验证：在 `forkline/merge-continue-*` 验证手动解决并暂存冲突后 `continueMerge` 返回中文“已继续合并并创建合并提交 <sha>”，最终 HEAD 是两父 merge commit，工作区干净。
- Merge UI 验证：进入 `forkline/ui-merge-conflict-*` 冲突状态后，工作区横幅显示“合并发生冲突”，按钮状态为“继续合并”禁用、“中止合并”可用，并显示 `git merge --continue` / `git merge --abort` 指令提示。
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
- Tag API 验证：在 GitTest 创建临时附注 Tag `forkline-tag-workflow-20260612162546`，`/api/state` 能列出；通过 Forkline `pushTag` 推送到 `origin` 后 `git ls-remote --tags origin <tag>` 可查到；通过 `deleteRemoteTag` 删除远端 Tag 后远端查不到；通过 `deleteTag` 删除本地 Tag 后 `/api/state` 不再列出。临时 Tag 已清理。
- Tag UI 验证：浏览器打开 `http://127.0.0.1:5184`，GitTest 右侧“标签”页显示 `forkline-v0.1.0`，详情按钮为“查看提交 / 复制名称 / 推送 Tag / 删除本地 / 删除远端”；Tag 行右键菜单显示“查看此 Tag 提交 / 复制 Tag 名称 / 推送 Tag / 删除本地 Tag / 删除远端 Tag”，控制台无错误。
- Rebase API 验证：在 GitTest 上验证普通 `rebaseOntoRef` 成功，topic 分支父提交变为目标分支 HEAD；冲突场景会返回中文变基冲突提示，`repo.operation.type = rebase`，冲突文件可识别。
- Rebase 冲突流程验证：在 GitTest 上分别验证 `abortRebase` 可恢复干净状态，手动解决并暂存后 `continueRebase` 可继续并让 topic 父提交等于目标 HEAD，`skipRebase` 可跳过当前冲突提交并结束变基。
- Rebase UI 验证：浏览器打开 `http://127.0.0.1:5186`，GitTest 分支右键菜单显示“变基当前分支到此分支 git rebase”；进入变基冲突后，工作区横幅显示“变基发生冲突”，未解决冲突时“继续变基”禁用，“跳过变基”和“中止变基”可用，控制台无错误。
- 历史编辑 API 验证：浏览器服务 `http://127.0.0.1:5187` 打开 GitTest 后，通过 `/api/action` 验证 `rewriteHistoryCommit` 的 `squash`、`fixup`、`drop`。`squash` 和 `fixup` 都把两次提交压成 1 次并保留第二次提交的文件改动；`fixup` 保留父提交标题；`drop` 删除目标提交引入的第二行改动，最终工作区干净。
- 历史编辑 UI 验证：浏览器打开 `http://127.0.0.1:5187`，GitTest 提交详情显示“压缩进父提交 / 修补进父提交 / 丢弃此提交”；提交右键菜单显示同样动作和 Git 指令提示。右键菜单与详情按钮无横向溢出，控制台无 Forkline 错误。
- 历史编辑计划预检 API 验证：浏览器服务 `http://127.0.0.1:5199` 打开 GitTest 后，请求 `/api/history-rewrite-preview?sha=4fbce18&mode=fixup` 返回 `branch = 123`、`affectedCount = 2`、`canRun = true`、无阻塞项；临时创建未跟踪文件后再次请求同一预检返回 `canRun = false`、`dirtyCount = 1`，阻塞原因为“当前还有 1 个未提交改动。请先提交、储藏或丢弃后再编辑历史。”测试文件已删除，GitTest 已恢复 `123` 分支干净状态。

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

1. 交互式历史编辑队列增强：现在已有单提交 squash / fixup / drop，下一步可以做成可视化队列，支持一次调整多个提交、拖拽排序和执行前预览。
2. 远端同步体验继续补：同步摘要、force-with-lease、远端 URL 管理、upstream 管理、推送前分叉保护、变基拉取和同步提交预览已完成，后续可继续做认证失败指引。
3. 恢复点体验增强：现在已有自动恢复点和恢复页，后续可以增加按分支/动作筛选、批量清理和保留策略。
