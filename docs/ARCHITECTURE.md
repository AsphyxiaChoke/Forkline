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
- Keep the commit Details tab lightweight. Its aggregate multi-file diff preview renders at most 400 lines and reports the full count; per-file inspection remains on the Files tab. Do not bind the entire commit diff to the inspector DOM merely because the API already returned it.
- Put shared startup/layout/event glue in `public/js/app/`.
- Keep `public/app.js` as a compatibility file only.
- If a new file is added, update `public/index.html`, this document, and `progress.md`.

## Local Service

- `node server.js` starts Forkline on `127.0.0.1:5177` by default and opens the app on Windows.
- Set `FORKLINE_NO_OPEN=1` when running local verification that should not open a browser window automatically.

## State And Diagnostics

- Keep `/api/state` focused on repository state. Local tool probes, remote connectivity checks, and other optional diagnostics must not run on every history or worktree refresh.
- The full state reader starts its independent Git reads together, then reuses the resulting branch, HEAD, tracking, remote, and status snapshots while building sync/worktree data. Worktree enrichment, submodule enrichment, working-file snapshots, and sync details run in parallel because they are read-only and independent after the base snapshot.
- The five-second `/api/worktree` poll runs only while the document is visible and the browser window is focused. Focus and visibility recovery trigger an immediate silent refresh. The frontend worktree signature includes each file snapshot as well as index/worktree flags, so content edits that keep the same porcelain status still redraw the list and active diff.
- Check for a root `.gitmodules` file before running submodule config/status commands. Repositories without submodule configuration must return an empty submodule list without starting `git submodule status --recursive`; repositories with `.gitmodules` keep the full recursive path.
- HEAD reflog entries are recovery-panel data, not base repository state. Real repositories load them through `GET /api/reflog`; `/api/state` omits the 80-entry reflog payload. The frontend keys loaded data by repository path, branch, and HEAD SHA, exposes a manual refresh, and rejects stale responses after the key changes. Sample mode may keep inline reflog entries.
- Repository context travels in `X-Forkline-Repo-Path`. The browser writes Unicode paths as `v1:` plus `encodeURIComponent(path)` so every header code point is ASCII. The server decodes only the versioned form, rejects malformed escapes or decoded control characters, and accepts unprefixed ASCII values for compatibility with older pages and tests.
- Authentication environment data is loaded through `GET /api/auth-diagnostics` only when the Sync panel needs it. The endpoint requires the normal `X-Forkline-Repo-Path` context header.
- Authentication results are cached for 60 seconds by normalized repository path plus the complete remote fetch/push URL configuration. The cache is bounded to 12 entries, remote URL changes use a new key, and `?refresh=1` bypasses an existing entry.
- `public/js/panels/sync.js` owns the lazy request and loading/error UI. Repository path, remote signature, and request id checks discard stale responses after a repository or remote configuration change.

## Integration Tests

- Run `npm test` to execute the built-in Node test runner with one test file at a time.
- `tests/git-api.test.js` starts a real Forkline child process on a random local port and drives the HTTP API against temporary Git repositories.
- Fixtures isolate global/system Git configuration, use repository-local identity and submodule settings, and remove their temporary directories after each test.
- Authentication coverage verifies that `/api/state` remains free of local authentication probes, the diagnostics endpoint requires repository context, cache hits reuse the same check, manual refresh bypasses cache, and changed remote URLs do not reuse stale data.
- State optimization coverage verifies tracked upstream/ahead/behind data, dirty current-worktree summaries, detached HEAD, unborn branches, empty submodule lists, and the existing real-submodule safety workflows.
- Reflog coverage verifies the repository-context API boundary and real unborn/committed responses. `tests/reflog-ui-state.test.js` runs the panel script in a Node VM to prove that current results are stored and responses from a previous repository are discarded.
- `tests/worktree-refresh.test.js` runs the diff workbench in a Node VM to verify that file snapshots affect refresh signatures and hidden or unfocused pages do not run the periodic worktree read.
- `tests/api-repo-context.test.js` exercises the real browser header-construction boundary with a Chinese repository path. The API integration suite verifies server decoding against a real Unicode-named Git repository, malformed versioned values, and legacy ASCII headers.
- `tests/diff-preview.test.js` verifies that aggregate commit previews stop at 400 rendered lines while small diffs remain complete.
- Add regression coverage at the real API boundary for Git behavior bugs; avoid replacing these tests with mocks that cannot reproduce worktree, stash, ref, or submodule semantics.
