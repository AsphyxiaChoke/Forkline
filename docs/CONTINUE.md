# Forkline 继续开发记录

## 当前状态

- 远端 `origin/main` 已拉取并基于最新代码开发。
- 已完成“远端分支 checkout”：远端分支列表现在有可见的“签出”按钮，右键菜单也支持“签出为本地分支”。
- 签出规则：`origin/feature/a` 会创建或切换到本地 `feature/a`；如果本地分支已存在就直接切换；工作区有修改时继续使用“保留 / 储藏 / 强制”的中文确认流程。
- 远端分支解析已改为读取 `refs/remotes/*`，不再只依赖 `origin` / `upstream` 这两个远端名。
- `git-svn` 这类无法推导本地分支名的远端引用会显示在远端列表里，但“签出”会禁用，避免误点后报错。
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

## GitTest 测试数据

`D:\桌面\GitTest` 是功能测试沙盒，可以继续随便改。当前故意保留：

- 已暂存：`forkline-fixtures/staged-demo.txt`
- 未暂存：`forkline-fixtures/worktree-demo.txt`
- 未跟踪：`forkline-fixtures/untracked-demo.txt`
- 储藏：`Forkline 测试储藏：可应用/弹出/删除`
- 测试分支：`forkline/merge-clean`、`forkline/merge-conflict`、`forkline/cherry-pick-ready`、`forkline/revert-reset-lab`，以及多组 `forkline/cherry-*`、`forkline/merge-*`、`forkline/ui-cherry-*`、`forkline/ui-merge-*` 临时验证分支。
- 测试 Tag：`forkline-v0.1.0`

## 下一步建议

按原计划继续完善：

1. Merge commit 主线选择：为 cherry-pick / revert merge commit 增加主线选择弹窗，对应 `-m <parent-number>`。
2. Rebase / 历史编辑队列：把 reword 之外的 squash / fixup / drop 做成可视化队列，接近 GitKraken 的交互式 rebase 体验。
3. 远端操作补强：删除远端分支、推送当前分支并设置 upstream、展示 ahead/behind 数量。
