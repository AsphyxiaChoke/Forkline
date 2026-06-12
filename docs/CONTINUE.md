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

## GitTest 测试数据

`D:\桌面\GitTest` 是功能测试沙盒，可以继续随便改。当前故意保留：

- 已暂存：`forkline-fixtures/staged-demo.txt`
- 未暂存：`forkline-fixtures/worktree-demo.txt`
- 未跟踪：`forkline-fixtures/untracked-demo.txt`
- 储藏：`Forkline 测试储藏：可应用/弹出/删除`
- 测试分支：`forkline/merge-clean`、`forkline/merge-conflict`、`forkline/cherry-pick-ready`、`forkline/revert-reset-lab`
- 测试 Tag：`forkline-v0.1.0`

## 下一步建议

按原计划继续完善：

1. Revert / Reset：先做提交右键菜单入口，并给 reset 增加 soft / mixed / hard 的清晰中文确认。
2. Cherry-pick：提交右键新增“挑选此提交”，冲突时给中文提示并在工作区展示冲突状态。
