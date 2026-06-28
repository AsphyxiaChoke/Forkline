# Forkline Frontend Architecture

## Current Layers

- `public/js/core.js`: shared state, storage keys, constants, DOM handles, and the `window.Forkline` namespace.
- `public/js/api.js`: shared API request wrapper. It exposes `Forkline.api`.
- `public/js/app/`: startup-adjacent UI orchestration, event binding, layout utilities, and initial render helpers.
- `public/js/features/`: feature workflows such as branches, worktree changes, history list, graph rendering, repository actions, Git actions, context menus, and the diff workbench.
- `public/js/panels/`: right-inspector panels such as commit details, worktrees/submodules, sync/compare, recovery, logs, tags, and settings.
- `public/app.js`: legacy compatibility placeholder. Do not add new feature code here.
- `public/js/bootstrap.js`: startup sequence. It exposes `Forkline.start` and starts the app after all scripts are loaded.
- `public/index.html`: static markup and ordered script loading.
- `public/styles.css`: current global stylesheet.

## Loading Order

`index.html` must load scripts in this order:

1. `js/core.js`
2. `js/api.js`
3. `js/app/init.js`
4. `js/features/branches.js`
5. `js/features/worktree-changes.js`
6. `js/features/history-list.js`
7. `js/features/folder-command.js`
8. `js/features/context-menus.js`
9. `js/features/commit-actions.js`
10. `js/features/graph.js`
11. `js/panels/inspector.js`
12. `js/panels/workspaces.js`
13. `js/panels/sync.js`
14. `js/panels/recovery-settings.js`
15. `js/features/diff-workbench.js`
16. `js/features/repositories.js`
17. `js/features/git-actions.js`
18. `js/app/layout-utils.js`
19. `js/app/events.js`
20. `app.js`
21. `js/bootstrap.js`

The frontend still uses classic browser globals because the app is served directly without a bundler. Keep dependencies available before `js/app/events.js` and `js/bootstrap.js`: event binding expects every feature handler to exist, and bootstrap expects layout, recovery-policy, worktree-refresh, amend-mode, and init helpers to be loaded.

## Change Rules

- Put new right-panel pages in `public/js/panels/`.
- Put new user workflows in `public/js/features/`.
- Put shared startup/layout/event glue in `public/js/app/`.
- Keep `public/app.js` as a compatibility file only.
- If a new file is added, update `public/index.html`, this document, and `progress.md`.
