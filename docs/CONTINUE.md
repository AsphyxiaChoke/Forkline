# Forkline 继续开发记录

## 当前状态

- 远端 `origin/main` 已拉取并基于最新代码开发。
- 已完成“远端分支 checkout”：远端分支列表现在有可见的“签出”按钮，右键菜单也支持“签出为本地分支”。
- 签出规则：`origin/feature/a` 会创建或切换到本地 `feature/a`；如果本地分支已存在就直接切换；工作区有修改时继续使用“保留 / 储藏 / 强制”的中文确认流程。
- 远端分支解析已改为读取 `refs/remotes/*`，不再只依赖 `origin` / `upstream` 这两个远端名。
- `git-svn` 这类无法推导本地分支名的远端引用会显示在远端列表里，但“签出”会禁用，避免误点后报错。

## 已验证

- `node --check server.js`
- `node --check public/app.js`
- 测试仓库：`D:\桌面\GitTest`
- 给 GitTest 增加了本地测试远端：`D:\桌面\GitTestRemote.git`
- 验证远端分支：`origin/forkline/remote-checkout-demo`
- API 验证结果：可签出成本地 `forkline/remote-checkout-demo`，并保留 GitTest 中故意留下的已暂存、未暂存、未跟踪改动。
- UI 验证结果：远端分支行显示“签出”和“合并”按钮。

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

1. Stash：把创建储藏、应用、弹出、删除和查看 Diff 的入口整理到工作区按钮与右键菜单中。
2. Revert / Reset：先做提交右键菜单入口，并给 reset 增加 soft / mixed / hard 的清晰中文确认。
3. Cherry-pick：提交右键新增“挑选此提交”，冲突时给中文提示并在工作区展示冲突状态。
