# Forkline 界面设计系统

本文档是 Forkline 界面开发的设计约束。目标不是引入新的 UI 框架，而是让现有 HTML、CSS 和 JavaScript 组件成为唯一可信来源，避免后续功能各自创造颜色、按钮、弹窗和布局规则。

## 1. 唯一可信来源

| 内容 | 代码位置 | 说明 |
| --- | --- | --- |
| 主题与语义 Token | `public/styles.css` 顶部 `:root` 和 `html[data-theme]` | 颜色、字体、阴影、布局尺寸和 Diff 状态 |
| 主题目录与预览色 | `public/js/app/layout-utils.js` | 主题 ID、名称、说明和设置页色板 |
| 基础结构 | `public/index.html` | 顶栏、三栏工作区、底部工作台、菜单和通用弹窗 |
| 动态组件 | `public/js/features/`、`public/js/panels/` | 提交、分支、文件树、Diff 和右侧面板 |
| 中英文文本 | `public/js/i18n-catalog.js` | 用户可见文本的英文映射 |
| 界面回归 | `tests/design-system.test.js`、`tests/themes.test.js`、`tests/layout-ui.test.js` | Token、组件、主题和响应式结构守卫 |
| 真实浏览器回归 | `tests/browser-performance.test.js` | 大仓库、DOM、滚动、监听器和浏览器性能边界 |

设计发生冲突时，以当前可运行代码和测试为准；本文档必须与代码同步更新，不能建立第二套脱离代码的设计稿规范。

## 2. 设计原则

1. 先复用，后新增。新增页面或操作前先搜索现有 Token、组件类和相似面板。
2. 语义优先。使用 `--danger`、`--muted`、`--row-selected` 等含义明确的变量，不按某个主题的实际颜色命名用途。
3. 不改变 Git 语义。视觉调整不得改变按钮对应的 Git 操作、确认边界和禁用条件。
4. 中文是主要验收界面。英文必须同步可用，但不能用缩短中文文本来掩盖布局问题。
5. 响应式是功能要求。最大化、窄屏、竖屏和 Windows 高 DPI 下不得出现文字重叠、控件越界或不可点击。
6. 动态布局使用 CSS 自定义属性。运行时只传入深度、列宽、位置、进度或数据色，不在模板里重新定义组件视觉。

## 3. Token 分层

### 3.1 主题表面与文字

- 页面与容器：`--bg`、`--panel`、`--panel-2`、`--panel-3`、`--surface`、`--card`、`--topbar`、`--field`。
- 边界：`--line`、`--line-soft`、`--line-strong`。
- 文字：`--text`、`--muted`、`--quiet`。
- 行状态：`--row`、`--row-alt`、`--row-hover`、`--row-selected`。

### 3.2 状态与操作

- 主操作：`--primary`、`--teal`、`--on-primary`。
- 信息与图谱：`--blue`、`--violet`、`--graph-*`。
- 成功与新增：`--green`。
- 警告与重命名：`--amber`、`--on-amber`、`--warning-strong`、`--on-warning-strong`。
- 危险与删除：`--danger`、`--coral`。
- Diff：`--diff-add-bg`、`--diff-add-text`、`--diff-del-bg`、`--diff-del-text`。

### 3.3 效果、排版与布局

- 焦点和阴影：`--focus-ring`、`--shadow-soft`、`--shadow-panel`、`--glow-teal`、`--surface-raised`。
- 字体：`--font-ui`、`--font-code`。
- 主布局：`--sidebar-w`、`--inspector-w`、`--stage-h`、`--graph-w`、`--row-h`、`--header-h`、`--history-cols`。

主题只覆盖视觉 Token；结构尺寸默认由 `:root`、用户布局偏好和响应式规则控制。新增主题时必须同时更新主题目录、CSS 主题块和主题测试。

## 4. 组件目录

| 类别 | 现有组件 | 使用规则 |
| --- | --- | --- |
| 主要按钮 | `.btn`、`.btn.primary` | `.btn` 是默认次级按钮，`.primary` 用于表单提交、打开仓库等明确主动作；HTML 中现有 `ghost` 仅作语义标记，没有独立视觉规则 |
| 紧凑按钮 | `.mini-btn`、`.mini-btn.danger` | 面板内部和列表工具动作 |
| 顶栏按钮 | `.icon-btn`、`.icon-btn.danger` | 顶栏、编辑器标题栏等固定工具区 |
| 弹窗选择 | `.checkout-choice` 及 `.primary`、`.danger` | 弹窗底部的并列决策，不另造按钮样式 |
| 标签导航 | `.tab`、`.tab.active` | 右侧详情页切换 |
| 列表导航 | `.nav-item`、`.branch-chip`、`.file-row` | 分支、工作树和文件选择；状态通过修饰类表达 |
| 菜单 | `.context-menu`、`.context-separator` | 右键操作；危险项使用 `.danger` |
| 弹窗 | `.checkout-modal`、`.checkout-dialog` | 通用遮罩和容器；功能差异使用后缀类扩展 |
| 表单 | `.edit-field`、`.search`、`.branch-filter`、`.worktree-filter` | 复用现有输入边框、焦点和错误状态 |
| 状态 | `.status-dot`、`.badge`、`.state-pill` | 状态颜色必须来自语义 Token |
| 卡片与面板 | `.repo-card`、`.settings-card`、`.sync-card`、`.panel-title` | 使用现有表面、边界和标题层级 |

同类组件只有在现有结构无法表达真实业务差异时才允许新增。仅因间距、颜色或文字不同，不构成新组件理由。

## 5. 编码约束

- 禁止在普通 CSS 规则中新增十六进制语义色；颜色值应定义在 Token 声明中，再通过 `var(...)` 使用。
- JavaScript 模板不得直接写按钮、卡片、弹窗的视觉样式。允许的内联样式仅限运行时几何值和 CSS 自定义属性，例如 `--depth`、`--avatar`、`--branch`、`--theme-swatch`、Diff 字符宽度、滚动位置和进度百分比。
- 主题预览色和图谱泳道色属于数据色目录，集中维护在 `layout-utils.js`，不得散落到面板模块。
- 新增用户可见文字时同步更新英文目录；Git 命令和文件路径保持原文。
- 新增交互控件必须声明正确的 `type`，并按用途提供 `title`、`aria-label`、状态文本或禁用原因。
- 不为整理样式而全量拆分 `styles.css`。只有出现真实维护冲突且能独立验证时，才按组件边界逐步拆分。
- 当前不引入 Figma Code Connect 或前端组件框架。只有 Figma 成为持续维护的产品来源后，才评估建立第二端映射。

## 6. AI 修改界面的固定流程

1. 阅读本文档，并查看 `styles.css` 顶部 Token 和目标组件现有选择器。
2. 搜索相同业务角色的组件，优先复用类名和 DOM 结构。
3. 明确本次界面成功标准，包括正常、悬停、聚焦、禁用、危险和加载状态。
4. 只修改当前功能需要的组件；不顺手统一相邻页面。
5. 运行 `tests/design-system.test.js`、`tests/themes.test.js` 和相关 UI 测试。
6. 使用真实 Chromium 检查目标页面，并记录视口、主题、溢出、控制台和资源清理结果。
7. 将行为、验证和回滚方式追加到 `progress.md`；影响后续开发时同步更新本文档或 `docs/CONTINUE.md`。

## 7. 视觉验收矩阵

每次只覆盖本轮实际影响的状态；修改全局 Token、按钮、输入框、弹窗或布局基础时，必须覆盖完整矩阵。

| 维度 | 必测值 |
| --- | --- |
| 主题 | 深色、浅色、高对比；修改主题系统时覆盖全部六套主题 |
| 横屏 | 约 `1910×1075`，模拟最大化主窗口 |
| 竖屏 | 约 `1075×1910`，确认详情栏下沉和拖动边界 |
| 窄屏 | `800×720`，确认顶栏、提交列和底部工作台 |
| 高 DPI | Windows 125% 和 150%，重点检查中文文字、按钮和表单标签 |
| 关键状态 | 主提交图、底部三栏、设置/同步/恢复点、右键菜单、通用弹窗、命令面板、文件编辑器和最大化 Diff |

验收必须同时满足：页面非设计内横向溢出为 0、文字不重叠、主要操作可见且可点击、焦点状态可辨认、控制台无 Forkline 错误。性能相关改动还要确认 DOM、监听器和 JS 堆不会持续增长。
