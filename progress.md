## 2026-06-20 - Task: highlight current branch and HEAD commit
### What was done
- Added current repository HEAD SHA to the full state and lightweight ref state API so the UI can identify the real HEAD independently from the selected commit.
- Highlighted the checked-out branch in the left branch list and top branch strip, and added a `HEAD` badge plus row highlight for the current HEAD commit.
- Kept branch/Tag view switching on the lightweight `/api/ref-state` path so changing the viewed ref does not reload unrelated repository state.
- Updated the continuation document so another Codex session can see this feature is already complete.
### Testing
- Pending: run JavaScript syntax checks, API checks, and browser UI verification after implementation.
### Notes
- `server.js`: exposes `repo.headSha` from both `/api/state` and `/api/ref-state`, and serves the lightweight ref state endpoint.
- `public/app.js`: adds current branch/current HEAD detection and related classes/badges during rendering; `selectRef` now refreshes only repo/commit data through `/api/ref-state`.
- `public/styles.css`: styles current branch rows/chips and current HEAD commit rows without replacing the selected state.
- `docs/CONTINUE.md`: records the completed current branch and HEAD commit highlight feature.
- Rollback: revert this task's edits in the files above, or reset this working tree to the commit before this task once the changes are committed.

## 2026-06-20 - Task: verify current branch and HEAD commit highlight
### What was done
- Verified the implementation against the real `D:\桌面\forkline-web` worktree on branch `codex/remote-latest`.
- Restarted the local Forkline service on `http://127.0.0.1:5177` so the running app uses the updated code.
### Testing
- `node --check server.js` passed with the Codex runtime Node.
- `node --check public/app.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- `/api/state` and `/api/ref-state?ref=` on `http://127.0.0.1:5177` both returned `repo.headSha = f83a9c2b0177`, and the commit list contained that SHA.
- Browser verification on `http://127.0.0.1:5177` confirmed one `.branch-row.current-branch`, one `.branch-chip.current-branch`, and one `.commit-row.current-head` with a `.head-badge`; console errors/warnings were empty.
- Screenshot capture timed out in the browser automation layer, but DOM and console checks passed on the live page.
### Notes
- `server.js`: verified `repo.headSha` and `/api/ref-state` on the live service.
- `public/app.js`: verified current branch/current HEAD render classes and badge markup in the live page.
- `public/styles.css`: verified the live page applies the current branch and HEAD classes.
- `docs/CONTINUE.md`: verified the handoff note includes this feature.
- `progress.md`: appended this verification record.
- Rollback: revert this task's edits in `server.js`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`; the live service can then be restarted on port 5177.

## 2026-06-20 - Task: auto-open browser on Windows server start
### What was done
- Added Windows-only automatic browser opening after the local server starts.
- Reused `execFile` through `cmd /c start` and kept non-Windows startup behavior unchanged.
- Documented the startup behavior in the continuation notes.
### Testing
- Pending: run server syntax check and verify the server still starts.
### Notes
- `server.js`: opens `http://127.0.0.1:<PORT>` automatically on Windows after `server.listen` succeeds.
- `docs/CONTINUE.md`: records that Windows startup now opens the local app URL automatically.
- `progress.md`: appended this implementation record.
- Rollback: remove `openLocalAppInBrowser` and its call in `server.js`, then remove this startup note from `docs/CONTINUE.md`.

## 2026-06-20 - Task: verify auto-open browser startup
### What was done
- Verified the Windows startup change with syntax checks and a temporary service start.
### Testing
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Temporary service `http://127.0.0.1:5290` started successfully, listened on port 5290, and `/api/state` returned sample repo state with `repo.headSha`.
- Existing service `http://127.0.0.1:5177` remained running while the temporary service was verified.
### Notes
- `server.js`: verified the server still starts after adding Windows auto-open.
- `docs/CONTINUE.md`: startup behavior remains documented.
- `progress.md`: appended this verification record.
- Rollback: revert the `server.js`, `docs/CONTINUE.md`, and `progress.md` edits from this task; the temporary 5290 service was stopped.

## 2026-06-20 - Task: restore folder picker and improve merge graph readability
### What was done
- Restored the top-bar "选择" folder picker beside the repository path input.
- Fixed the path bar grid so the newly restored "选择" button does not force the "打开" button into a hidden second row.
- Added an internal directory browser modal with path jump, parent navigation, drive roots, and common shortcuts for desktop, downloads, documents, and user home.
- Added `/api/browse` so the UI can list local directories, identify Git repositories, and hide `.git` from the visible folder list.
- Widened the commit graph lane area and made merge commits easier to read with larger merge nodes, `M2` / `M3` parent-count labels, and dashed secondary-parent lines.
- Updated the continuation document so the restored picker and merge graph change are visible to future sessions.
### Testing
- `node --check server.js` passed with the Codex runtime Node.
- `node --check public/app.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Temporary HTTP/API verification returned `/api/browse` for `D:\桌面\forkline-web` with `isGit = true`, shortcuts `桌面,下载,文档,用户目录`, no `.git` entry, and the expected modal/button HTML.
- Browser preview verification on `http://127.0.0.1:5290/` confirmed the "选择" button opens the folder modal, shortcuts render, `.git` is hidden, and the merge graph contains `M2`, a dashed secondary-parent path, and `viewBox = 0 0 156 ...`.
- Browser layout verification on `http://127.0.0.1:5291/` confirmed `repoInput`, recent repo select, clear, "选择", "克隆", "初始化", and "打开" all remain on one row with no overlapping boxes at desktop width and at 1180px viewport width.
- Browser console errors/warnings were empty during the preview verification.
### Notes
- `server.js`: added the local directory browser helpers and `/api/browse`.
- `public/index.html`: restored the "选择" button and folder picker modal markup.
- `public/app.js`: wired folder picker state/events and enhanced merge graph rendering.
- `public/styles.css`: styled the folder picker and widened the graph column.
- `docs/CONTINUE.md`: documented the restored folder picker and merge graph readability change.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`; no persistent test data was created.

## 2026-06-20 - Task: simplify workspace changes panel
### What was done
- Removed the duplicate left-sidebar workspace file list.
- Renamed the bottom unstaged changes area to "工作区" and moved the workspace file filter into that panel.
- Kept the existing workspace filtering behavior, including path/status matching, count display, and clear action.
- Updated the continuation document so future sessions know the workspace filter now lives in the bottom changes panel.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Static checks confirmed `worktreeList`, the old left `<section class="worktree">`, and `file-stack` are no longer referenced in `public/`.
- Live `http://127.0.0.1:5177/` verification confirmed the left sidebar only shows local and remote branches, the bottom panel title is "工作区", and the filter input is inside the bottom changes panel with no console errors.
- Temporary in-memory preview `http://127.0.0.1:5293/` verified sample workspace filtering: entering `workbench` reduced the change list to `src/styles/workbench.css`, showed `1/5`, and the clear button restored all 5 rows with no console errors. The preview server was stopped after testing.
### Notes
- `public/index.html`: removed the old sidebar workspace block and placed the workspace filter in the bottom changes panel.
- `public/app.js`: removed the old sidebar list rendering path, renamed the unstaged section to "工作区", and keeps filter metadata synchronized during stage rendering.
- `public/styles.css`: removed obsolete sidebar workspace/file-stack styles and sized the bottom changes grid for the new filter row.
- `docs/CONTINUE.md`: updated the current feature note to say the workspace filter now lives in the bottom changes panel.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`.

## 2026-06-20 - Task: redesign branch graph modes
### What was done
- Split the commit graph into two clearer modes: all-branch overview and single-branch focus.
- All-branch view keeps multiple lanes, branch labels, merge parent-count labels, and dashed secondary-parent merge lines so branch merge relationships are visible.
- Single-branch view now uses first-parent history and draws one main timeline; merge commits keep a side hint and "合并" label without expanding every merged side-branch commit into the branch view.
- Widened the graph column to make merge labels and branch lanes easier to read.
- Updated the continuation document with the new graph behavior.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Real Git command verification on `D:\桌面\GitTest` confirmed `git log --first-parent main` returns the main branch timeline while retaining merge commits.
- Browser preview verification on `http://127.0.0.1:5295/` confirmed all-branch view uses `graph-lines overview`, 2 lane guides, `M2`, and a dashed secondary-parent path.
- Browser preview verification confirmed switching to `main` uses `graph-lines focus`, one lane guide, 3 first-parent commits (`Merge feature/login`, `main update`, `base commit`), a side merge hint, and no console errors. The preview server was stopped after testing.
### Notes
- `server.js`: single-ref log requests now use `--first-parent`, and sample ref-state returns a first-parent style commit list.
- `public/app.js`: separates overview and focused graph rendering, keeps side-branch lanes in all-branch mode, and draws focused branch history as a mainline graph.
- `public/styles.css`: widens the graph column to match the new SVG width.
- `docs/CONTINUE.md`: documents the new all-branch versus single-branch graph behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`.

## 2026-06-20 - Task: remove merge text labels from graph
### What was done
- Removed the visible merge text labels from both all-branch and single-branch graph modes, so merge commits no longer show `M2`, `M3`, or "合并" next to the node.
- Kept merge commit nodes, overview merge curves, dashed secondary-parent lines, and single-branch side merge hints so merge relationships remain visible without extra text.
- Updated the continuation document to describe that merge commits are represented by nodes and lines instead of text labels.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Static assertion confirmed `mergeLabel`, `graph-merge-label`, and merge-label calls are gone from `public/app.js`, while merge nodes and branch merge hints remain.
- Browser validation was attempted through the in-app browser on `http://127.0.0.1:5296/` and `http://localhost:5296/`, but the browser client blocked localhost navigation with `net::ERR_BLOCKED_BY_CLIENT`; this was not counted as a visual pass.
### Notes
- `public/app.js`: removed merge text label rendering and the now-unused helper.
- `docs/CONTINUE.md`: updated the graph behavior note to say merge commits use nodes and lines rather than text labels.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `docs/CONTINUE.md`, and `progress.md`.

## 2026-06-20 - Task: align all-branch graph colors with branch colors
### What was done
- Updated all-branch graph layout so each lane keeps the branch name it represents and uses that branch's existing color instead of the lane index color.
- Updated overview lane guides and secondary merge-parent lines to use the represented branch color, keeping graph nodes, labels, and helper lines visually consistent with the branch list.
- Updated the continuation document so future sessions know graph colors are branch-color based.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Logic verification with a constructed branch order confirmed `main` uses `refColor("main")` even when it is rendered on lane 0, and no longer falls back to `laneColor(0)`.
- Browser verification on `http://127.0.0.1:5301/` confirmed the app renders, the overview graph is present, `main` branch color is `#ff7a67`, the graph `main` label stroke is `#ff7a67`, overview lane guides include `#ff7a67`, and browser console errors/warnings are empty.
### Notes
- `public/app.js`: records branch names during all-branch graph layout and derives overview graph colors from branch colors.
- `docs/CONTINUE.md`: documents that all-branch graph colors now match branch list colors.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `docs/CONTINUE.md`, and `progress.md`; stop any temporary verification service on port 5301 if still running.

## 2026-06-21 - Task: keep top bar fixed and switch inspector tabs by selection context
### What was done
- Decoupled the top bar grid from the right inspector width so dragging the inspector only resizes the lower workspace and does not move the repository path area or top-right controls.
- Added a top-right "更多" selector for worktrees, submodules, stashes, recovery points, and operation logs.
- Updated the inspector tab rules so commit selection shows only "详情 / 文件 / 标签列表", worktree or staged file selection shows only "历史 / 逐行", and branch selection shows only "分支整理 / 同步情况 / 分支比较".
- Updated the continuation document with the new top-bar and inspector navigation behavior.
### Testing
- `node --check public/app.js` passed with the Codex runtime Node.
- `node --check server.js` passed with the Codex runtime Node.
- `git diff --check` passed; Git only reported existing LF-to-CRLF conversion warnings.
- Browser verification on `http://127.0.0.1:5303/` confirmed dragging the right inspector changed the workspace grid from `190px 7px 816px 7px 260px` to `190px 7px 666px 7px 410px`, while topbar, repo bar, and actions coordinates stayed stable.
- Browser verification confirmed commit tabs show `详情, 文件, 标签列表`; file selection shows `历史, 逐行` with "文件历史" active; branch selection shows `分支整理, 同步情况, 分支比较`; selecting `操作日志` from "更多" hides the inspector tab row and opens the operation log panel.
- Browser page console errors/warnings were empty; the Browser plugin emitted unrelated Statsig network timeout messages outside the app page.
### Notes
- `public/index.html`: added the top-right "更多" inspector selector and renamed visible inspector tab labels.
- `public/app.js`: added inspector context rules, context-aware tab filtering, file/branch/commit selection switching, and "更多" selection handling.
- `public/styles.css`: fixed the topbar grid, styled the "更多" selector, and hid inspector tabs in more-context panels.
- `docs/CONTINUE.md`: documented fixed topbar and context-based inspector tabs.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`; stop any temporary verification service on port 5303 if still running.

## 2026-06-21 - Task: improve dark dropdown readability
### What was done
- Updated the top-right "更多" selector so the closed select and its native options use the dark panel background and light text in dark mode.
- Kept light mode on the browser's light color scheme so the same control remains readable there.
### Testing
- Browser verification on `http://127.0.0.1:5304/` confirmed the app loads in dark mode, the "更多" selector can switch to "操作日志", and the right panel changes to the operation log view.
- Computed style verification confirmed both the select and the "操作日志" option use `rgb(29, 34, 43)` background, `rgb(231, 236, 243)` text, and dark `color-scheme`.
- Browser page console errors/warnings were empty.
### Notes
- `public/styles.css`: changed the "更多" selector and option colors for readable dark-mode dropdown text.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/styles.css` and `progress.md`; stop any temporary verification service on port 5304 if still running.

## 2026-06-21 - Task: fix more panel clipping in inspector
### What was done
- Fixed the right inspector content area so panels opened from the top-right "更多" selector occupy the full remaining inspector height instead of collapsing into the hidden tab row.
- Kept long "更多" panels scrollable inside the right sidebar, while normal commit detail tabs continue to show their tab row.
### Testing
- Browser verification on `http://127.0.0.1:5305/` reproduced the issue before the fix: after selecting "操作日志", `#detailBody` was only `28px` high while the inspector had `588px` of available content space.
- Browser verification after the fix confirmed "操作日志" and "恢复点" both render with `#detailBody` at `588px` high, with long content scrolling inside the right sidebar.
- Browser verification confirmed the normal commit detail view still renders the tab row and `#detailBody` at `548px` high.
- Browser page console errors/warnings were empty.
### Notes
- `public/styles.css`: pins the inspector detail body to the third grid row so hiding the tab row does not collapse the content viewport.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/styles.css` and `progress.md`; stop any temporary verification service on port 5305 if still running.

## 2026-06-21 - Task: remove default worktree file highlight
### What was done
- Removed the automatic selection of the first worktree file when rendering the workspace change list.
- The work diff panel now stays in the "未选择文件" state until the user explicitly clicks a file.
- Manual file selection still highlights the clicked row, loads its diff, and switches the inspector to file history/blame tabs.
### Testing
- Browser verification on `http://127.0.0.1:5306/` confirmed the initial workspace change list has no `.selected` or `.multi-selected` file row.
- Browser verification confirmed the diff panel initially shows "未选择文件".
- Browser verification confirmed clicking `src/views/HistoryPanel.tsx` selects only that row, loads `HistoryPanel.tsx · 未暂存`, and opens the file-history inspector tabs.
- Browser page console errors/warnings were empty.
### Notes
- `public/app.js`: stops auto-selecting the first visible worktree file during stage rendering and only loads worktree diff after an explicit selection.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js` and `progress.md`; stop any temporary verification service on port 5306 if still running.

## 2026-06-21 - Task: clear worktree highlight on deselect
### What was done
- Updated worktree file selection so Ctrl-clicking an already selected file clears both the multi-select state and the focused file highlight.
- When the last selected worktree file is deselected, the work diff panel returns to "未选择文件" instead of keeping the previous file highlighted.
### Testing
- Browser verification on `http://127.0.0.1:5307/` confirmed the initial worktree list has no selected rows and the diff panel shows "未选择文件".
- Browser verification confirmed clicking `src/views/HistoryPanel.tsx` selects and highlights that row, loads `HistoryPanel.tsx · 未暂存`, and opens file history.
- Browser verification confirmed Ctrl-clicking the same row clears both `.selected` and `.multi-selected`, empties the diff path, and restores the diff text to "未选择文件".
- Browser page console errors/warnings were empty.
### Notes
- `public/app.js`: derives the focused worktree file from the current selection after each click, so deselection clears the visual highlight.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js` and `progress.md`; stop any temporary verification service on port 5307 if still running.

## 2026-06-21 - Task: move conflict choice buttons into conflict prompt
### What was done
- Removed all bottom Diff panel buttons except "最大化".
- Moved per-file conflict choice actions into the workspace conflict prompt, showing "当前 --ours" and "对方 --theirs" for each unresolved conflict file.
- Kept the existing file right-click conflict actions intact.
### Testing
- `node --check public/app.js` passed.
- `node --check server.js` passed.
- `git diff --check` passed.
- Search confirmed no visible bottom Diff action/scope selectors remain: `data-work-diff-action`, `data-work-diff-scope`, and `.work-diff-scope` are absent from `public/`.
- Browser verification on `http://127.0.0.1:5177/` confirmed the bottom Diff panel only has "最大化" and no console warnings/errors.
- Browser verification with a temporary merge-conflict repo confirmed the workspace conflict prompt renders `conflict.txt` with "当前 --ours" and "对方 --theirs" buttons, while the bottom Diff panel still only has "最大化".
- The temporary conflict repo was removed, and `http://127.0.0.1:5177/` was restored to `D:/桌面/GitTest` after verification.
### Notes
- `public/index.html`: removed the old bottom Diff panel action/scope buttons and kept only the maximize button.
- `public/app.js`: renders conflict choice buttons inside the conflict prompt and routes them to the existing single-file conflict resolution action.
- `public/styles.css`: adds compact conflict choice row styling and removes unused bottom scope-button styling.
- `docs/CONTINUE.md`: updates the conflict-resolution usage note so future work looks for the buttons in the conflict prompt instead of the bottom Diff panel.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: optimize render performance and UI colors
### What was done
- Debounced commit search rendering so rapid typing no longer redraws the commit list and SVG graph on every keypress.
- Batched commit row insertion with a document fragment to reduce DOM append work on large histories.
- Refined the dark and light palettes, with clearer panel separation, selected commit rows, current HEAD rows, active branch chips, search focus state, active tabs, and hover states.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 after starting the local service.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns repository state successfully.
- In-app Browser visual verification was intentionally skipped after repeated 5177 page opens made the Codex session unstable; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/app.js`: adds cancellable delayed commit search rendering and batches commit row DOM insertion.
- `public/styles.css`: updates color tokens and key active/selected/focus styles for clearer UI hierarchy.
- `docs/CONTINUE.md`: records the search performance and palette updates for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: continue performance and UI color polish
### What was done
- Reduced redundant inspector rendering during commit list refreshes: full refresh and commit clicks now avoid double-rendering the right panel, and search refreshes only update the inspector when the selected commit actually changes.
- Reused one compiled commit-search highlight pattern per render instead of rebuilding the same regular expression for every highlighted commit field.
- Strengthened worktree file-row colors so hover, current file, multi-selected file, current multi-selected file, and conflict states are easier to distinguish.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- HTTP static resource verification confirmed `/app.js` contains `renderCommitInspector` and `commitSearchPattern`.
- HTTP static resource verification confirmed `/styles.css` contains the updated multi-selected and conflict file-row color rules.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/app.js`: avoids redundant inspector refreshes on commit renders and reuses the commit-search highlight regex for each render.
- `public/styles.css`: updates worktree file-row hover, selected, multi-selected, selected-multi, and conflict color states.
- `docs/CONTINUE.md`: documents the additional render-performance and worktree color refinements.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: refine top-right toolbar UI
### What was done
- Grouped the top-right actions into compact utility, sync, and more-panel controls instead of leaving every button as a separate loose item.
- Changed the "more" panel selector into a single button-like select with "更多" as the default label, removing the old "更多 + 选择" double-label layout.
- Restyled the top-right toolbar area with quieter grouped backgrounds, tighter inner button spacing, clearer hover states, and a softer danger state for force push.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes `topbar-action-group` plus the new "更多" default option.
- HTTP static resource verification confirmed `/styles.css` returns the new `.topbar-action-group`, `.topbar-sync-actions`, `.topbar-more::after`, and scoped top-right danger-hover styles.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/index.html`: wraps right-top actions into grouped toolbar sections and simplifies the more-panel select label.
- `public/styles.css`: adds grouped toolbar styling, compact nested button states, and polished more-select styling.
- `docs/CONTINUE.md`: records the right-top toolbar UI cleanup for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: keep repository path chooser visible
### What was done
- Reworked the top path opener so the path input, recent repository selector, and repository action buttons are separate layout groups.
- Kept the "选择" directory button as a fixed-width action inside the path button group, so it is not squeezed out by the input or recent repository dropdown.
- Moved the medium-width topbar breakpoint earlier and added narrower topbar layouts so the path area and top-right actions do not overlap or deform each other.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes `recent-repo-group`, `path-actions`, and `id="browseRepo"`.
- HTTP static resource verification confirmed `/styles.css` returns `.path-actions`, `.recent-repo-group`, and the earlier responsive topbar breakpoints.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- Headless browser screenshot verification was unavailable because no browser executable was exposed as `msedge`, `chrome`, or `chromium`; in-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session.
### Notes
- `public/index.html`: groups the recent repository controls and path action buttons so the directory chooser remains an explicit button.
- `public/styles.css`: updates path opener grid columns, button sizing, and topbar responsive breakpoints to prevent overlap and deformation.
- `docs/CONTINUE.md`: updates the path selector note with the fixed visible chooser and responsive layout behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-21 - Task: add settings panel
### What was done
- Added a "设置" entry to the top-right "更多" selector and command palette.
- Added a right-side settings panel for browser-local preferences: theme selection, recent repository cleanup, repository directory chooser shortcut, recovery retention policy, and layout width/height reset.
- Wired settings controls to the existing localStorage-backed theme, recent repository, recovery policy, and layout preferences without adding new backend configuration.
### Testing
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes the `settings` option.
- HTTP static resource verification confirmed `/app.js` returns `renderSettingsTab`, `data-settings-action`, and `tabSettings`.
- HTTP static resource verification confirmed `/styles.css` returns `.settings-layout`, `.settings-card`, and `.settings-choice`.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used static checks plus local HTTP/API verification instead.
### Notes
- `public/index.html`: adds the settings option to the top-right more selector.
- `public/app.js`: registers the settings tab, renders the settings panel, and handles settings actions.
- `public/styles.css`: adds compact settings panel layout and row styles.
- `docs/CONTINUE.md`: documents the settings panel and its current browser-local scope.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: split frontend framework files
### What was done
- Split the previous single frontend script into ordered framework layers: `public/js/core.js`, `public/js/api.js`, existing `public/app.js`, and `public/js/bootstrap.js`.
- Moved shared state, DOM handles, constants, API wrapper, and startup sequence out of the legacy feature file while keeping existing feature behavior in place.
- Added the `window.Forkline` namespace so later modules can depend on a stable framework object instead of adding new globals.
- Added `docs/ARCHITECTURE.md` to document the loading order and next split targets.
### Testing
- `node --check public/js/core.js` passed using the bundled Node executable.
- `node --check public/js/api.js` passed using the bundled Node executable.
- `node --check public/app.js` passed using the bundled Node executable.
- `node --check public/js/bootstrap.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- `git diff --check` passed.
- Started the local service and confirmed `http://127.0.0.1:5177/` returns 200 with the new `core.js`, `api.js`, and `bootstrap.js` script order.
- HTTP static resource checks confirmed `/js/core.js`, `/js/api.js`, and `/js/bootstrap.js` return the expected framework markers.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
### Notes
- `public/index.html`: now loads frontend scripts in framework order before startup.
- `public/js/core.js`: contains shared state, constants, DOM handles, and `window.Forkline`.
- `public/js/api.js`: contains the shared API wrapper and exposes `Forkline.api`.
- `public/app.js`: keeps the existing feature implementation and no longer owns shared state, API setup, or startup calls.
- `public/js/bootstrap.js`: owns the startup sequence and exposes `Forkline.start`.
- `docs/ARCHITECTURE.md`: documents the frontend layers, loading order, and next migration targets.
- `docs/CONTINUE.md`: records the framework split for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/js/core.js`, `public/js/api.js`, `public/js/bootstrap.js`, `docs/ARCHITECTURE.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: complete frontend module split
### What was done
- Split the remaining legacy frontend feature code out of `public/app.js` into ordered `public/js/app/`, `public/js/features/`, and `public/js/panels/` modules.
- Updated `public/index.html` so the direct browser loading model now loads all feature and panel modules before the compatibility placeholder and bootstrap script.
- Kept `public/app.js` as a small compatibility file only, so new feature work has clear module locations.
- Updated architecture and continuation notes to describe the final split, loading order, and future file placement rules.
### Testing
- `node --check` passed for all 21 frontend JavaScript files under `public/` using the bundled Node executable.
- `git diff --check` passed; Git only reported CRLF normalization warnings for touched text files.
- Static entry verification confirmed all 21 `<script>` paths in `public/index.html` exist on disk.
- HTTP verification confirmed `http://127.0.0.1:5177/` returns 200 and includes the new module script paths.
- HTTP static resource checks confirmed `/js/app/init.js`, `/js/features/branches.js`, `/js/panels/recovery-settings.js`, `/js/features/diff-workbench.js`, `/js/app/events.js`, and `/js/bootstrap.js` return 200.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used syntax, static entry, local HTTP, and API verification instead.
### Notes
- `public/index.html`: loads all split frontend modules in dependency order before startup.
- `public/app.js`: now only documents legacy compatibility and no longer contains feature code.
- `public/js/app/init.js`: contains initial data loading and top-level render orchestration.
- `public/js/app/layout-utils.js`: contains theme, layout resizing, escaping, initials, and toast helpers.
- `public/js/app/events.js`: contains DOM event binding and top-level delegated handlers.
- `public/js/features/branches.js`: contains branch list rendering and branch create/rename/delete helpers.
- `public/js/features/worktree-changes.js`: contains worktree, stage, conflict banner, and change-list rendering.
- `public/js/features/history-list.js`: contains commit list rendering and commit search helpers.
- `public/js/features/folder-command.js`: contains directory picker, command palette, and inspector-tab switching helpers.
- `public/js/features/context-menus.js`: contains commit, branch, file, tag, remote, and reflog context menus.
- `public/js/features/commit-actions.js`: contains commit tools, history rewrite queue, cherry-pick, revert, reset, tag, patch, and remote-link actions.
- `public/js/features/graph.js`: contains commit graph rendering and commit-detail loading.
- `public/js/features/diff-workbench.js`: contains file tree, diff selection, workbench diff rendering, hunk actions, and worktree auto-refresh.
- `public/js/features/repositories.js`: contains recent repositories, clone, init, patch, and repository-open workflows.
- `public/js/features/git-actions.js`: contains ref checkout, merge, rebase, topbar Git actions, stash creation, file actions, and commit submit flows.
- `public/js/panels/inspector.js`: contains commit details, files, file history, file blame, and history rewrite panel rendering.
- `public/js/panels/workspaces.js`: contains branch cleanup, worktree, and submodule panels.
- `public/js/panels/sync.js`: contains stash, sync, compare, remote, auth, and diagnosis panels.
- `public/js/panels/recovery-settings.js`: contains tags, recovery points, reflog, logs, settings, and recovery-policy flows.
- `docs/ARCHITECTURE.md`: documents the final frontend layers, script order, and module placement rules.
- `docs/CONTINUE.md`: records that the frontend feature split is complete.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/index.html`, `public/app.js`, `public/js/app/`, `public/js/features/`, `public/js/panels/`, `docs/ARCHITECTURE.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: stage selected diff lines
### What was done
- Added line selection to the bottom worktree Diff so added/deleted Diff rows can be selected without checkboxes.
- Added a "暂存所选行" action that stages only selected unstaged Diff rows; paired modification rows stage the delete/add pair together.
- Added a backend `stageSelectedLines` action that rereads the real repository Diff and builds a minimal patch for selected lines before applying it to the index.
- Added `FORKLINE_NO_OPEN=1` for local verification runs that should restart the service without opening a browser automatically.
### Testing
- `node --check server.js` passed using the bundled Node executable.
- `node --check` passed for all 21 frontend JavaScript files under `public/` using the bundled Node executable.
- `git diff --check` passed; Git only reported CRLF normalization warnings for touched text files.
- Temporary Git repository API verification passed: selected only the added `line5 added` row and confirmed the cached diff contained that addition while the `line2 changed` modification remained unstaged.
- Temporary Git repository API verification passed: selected the paired delete/add rows for `line2 changed` and confirmed both remaining selected lines moved into the cached diff, leaving no unstaged diff.
- Temporary Git repository API verification passed for an untracked file: selected only the `three` row and confirmed the index contained that selected line without staging the other new-file rows.
- Restarted `http://127.0.0.1:5177/` with `FORKLINE_NO_OPEN=1`; HTTP verification confirmed the page returns 200 without opening a browser automatically.
- HTTP static resource checks confirmed `/js/features/diff-workbench.js`, `/js/app/events.js`, and `/styles.css` return the new line-selection markers.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used syntax, local HTTP/API, and temporary Git repository behavior verification instead.
### Notes
- `server.js`: adds `stageSelectedLines`, selected-line patch generation, operation labeling, and the `FORKLINE_NO_OPEN=1` local startup guard.
- `public/js/core.js`: stores selected Diff line state.
- `public/js/features/diff-workbench.js`: renders the selected-line toolbar, selectable Diff rows, selection state, and selected-line staging request.
- `public/js/app/events.js`: routes Diff row clicks and selected-line staging button clicks.
- `public/styles.css`: styles the selected-line toolbar, hover state, and selected Diff rows.
- `docs/ARCHITECTURE.md`: documents the local no-auto-open verification environment variable.
- `docs/CONTINUE.md`: records that Diff selected-line staging is available and content editing remains out of scope.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/core.js`, `public/js/features/diff-workbench.js`, `public/js/app/events.js`, `public/styles.css`, `docs/ARCHITECTURE.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: enable selected-line staging in maximized diff
### What was done
- Added selected-line staging controls to the maximized Diff modal for worktree diffs.
- Reused the same selected-line state between the bottom Diff and maximized Diff so row highlights stay in sync.
- Updated the maximized Diff after a selected-line staging action; if no diff remains, the modal closes instead of showing stale content.
### Testing
- `node --check public/js/features/diff-workbench.js` passed using the bundled Node executable.
- `node --check public/js/app/events.js` passed using the bundled Node executable.
- `node --check server.js` passed using the bundled Node executable.
- HTTP static resource verification confirmed `/js/features/diff-workbench.js` contains `diffModalOptions`, `syncDiffLineSelectionRows`, and `stageSelectedLines`.
- HTTP static resource verification confirmed `/js/app/events.js` contains the `diffModalBody` selected-line click handler.
- In-app Browser visual verification was intentionally skipped because repeated localhost opens can destabilize the Codex session; this task used syntax and local HTTP static verification instead.
### Notes
- `public/js/features/diff-workbench.js`: passes line-selection options into the maximized worktree Diff and synchronizes selected rows across both Diff containers.
- `public/js/app/events.js`: handles selected-line clicks and "暂存所选行" inside the maximized Diff body.
- `docs/CONTINUE.md`: records that both bottom and maximized Diff support selected-line staging.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `public/js/app/events.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-28 - Task: unstage selected diff lines
### What was done
- Added selected-line unstaging for the staged Diff view, using the same bottom and maximized Diff selection behavior.
- Changed the selected-line toolbar so unstaged Diff shows "暂存所选行" and staged Diff shows "取消暂存所选行".
- After selected-line staging, the workbench now switches to the staged Diff when staged content exists, making the newly staged lines visible immediately.
- After selected-line unstaging, the workbench switches back to the unstaged Diff when worktree content exists.
### Testing
- `node --check server.js` passed using the bundled Node executable.
- `node --check public/js/features/diff-workbench.js` passed using the bundled Node executable.
- `node --check public/js/app/events.js` passed using the bundled Node executable.
- Temporary Git repository API verification passed: selected only the staged `line5 added` row and confirmed it moved back to the worktree while the staged `line2 changed` modification remained staged.
- Temporary Git repository API verification passed: selected the staged delete/add pair for `line2 changed` and confirmed the cached diff became empty while both changes were present in the worktree diff.
- Restarted `http://127.0.0.1:5177/` with `FORKLINE_NO_OPEN=1`; HTTP static verification confirmed `/js/features/diff-workbench.js` contains `unstageSelectedLines`, `取消暂存所选行`, and `selectedDiffLineAction`.
- API verification confirmed `http://127.0.0.1:5177/api/state` returns 200.
### Notes
- `server.js`: adds `unstageSelectedLines` and selected-line patch generation mode for reversing staged lines safely.
- `public/js/features/diff-workbench.js`: chooses the correct selected-line action by Diff scope and switches views after staging or unstaging.
- `docs/CONTINUE.md`: records the staged selected-line unstaging behavior and automatic view switch.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: pull remote and keep right detail order
### What was done
- Pulled `origin/main` from `d87f396` to `e32a801`.
- Preserved the local right detail panel layout intent after the remote frontend module split by moving the selected commit message section above the operation section in the new inspector module.
- Kept the existing operation buttons, history editing area, edit queue, and diff preview behavior unchanged.
### Testing
- `node --check public/js/panels/inspector.js` passed.
- `node --check public/app.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/panels/inspector.js`: reorders the detail tab markup so commit information appears before commit operations.
- `public/app.js`: kept the remote compatibility placeholder from the module split.
- `progress.md`: resolved the pull/stash conflict and appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/panels/inspector.js` and `progress.md`, or reset back to the pre-pull commit `d87f396` if the remote pull itself must be undone.

## 2026-06-29 - Task: keep selected-line diff view after action
### What was done
- Changed selected-line staging and unstaging so the bottom or maximized Diff stays in the user's current view after the action.
- Kept the automatic fallback to the other Diff side when the current side has no remaining changes.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- Browser verification on a temporary repository confirmed staging one selected line kept the bottom Diff at `view-stay.txt · 未暂存` while unselected lines remained visible.
- Browser verification on a temporary repository confirmed cancelling one selected staged line kept the bottom Diff at `staged-view.txt · 已暂存` while the remaining staged line stayed visible.
### Notes
- `public/js/features/diff-workbench.js`: preserves the active Diff scope after selected-line staging or unstaging instead of jumping to the result side.
- `docs/CONTINUE.md`: records the current selected-line view retention behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: avoid empty diff after staging a hunk
### What was done
- Added a fallback when loading a worktree Diff: if the requested side returns no lines but the same file still has changes on the other side, Forkline now loads that other side instead.
- This fixes staging the last visible hunk showing "没有可显示的差异" while the file is still present in the change list.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- API verification on a temporary repository confirmed staging the only unstaged hunk makes `scope=unstaged` return 0 Diff lines while `scope=staged` returns the staged Diff with the selected change.
- HTTP verification confirmed the local service still returns 200 for `/` and `/api/state`.
- In-app Browser verification was attempted, but the Browser control connection timed out while loading localhost; API/HTTP verification covered the bug condition directly.
### Notes
- `public/js/features/diff-workbench.js`: retries the opposite worktree Diff scope when the requested scope is empty and the file still has changes there.
- `docs/CONTINUE.md`: records the empty-Diff fallback behavior after hunk operations.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: refresh staged and unstaged file state accurately
### What was done
- Updated the worktree refresh signature so it distinguishes index status, worktree status, and staged/unstaged flags instead of only the combined display status.
- Changed change-list rows to render scope-specific status text, so a partially staged file can show `工作区 M` in the worktree section and `暂存区 A` or `暂存区 M` in the staged section.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- Frontend function regression check confirmed an unstaged `M` file and staged `M` file now produce different refresh signatures.
- Frontend function regression check confirmed an `AM` file renders as `工作区 M` in the unstaged section and `暂存区 A` in the staged section.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/diff-workbench.js`: includes index/worktree status in refresh signatures and renders scope-specific file row status.
- `docs/CONTINUE.md`: records the more accurate staged/unstaged refresh and display behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: prevent stale diff fallback without file state
### What was done
- Fixed `fileChangeFlags` so a missing selected file no longer defaults to `hasUnstaged = true`.
- This prevents stale Diff fallback from switching to an unstaged view after the selected file disappears from the working file list.
### Testing
- Boundary regression check confirmed missing file state now returns `hasUnstaged = false`, `hasStaged = false`, and no fallback scope.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- Frontend diff-state regression checks confirmed `AM` files still render differently by section and staged/unstaged `M` files still produce different refresh signatures.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/diff-workbench.js`: guards `fileChangeFlags` against missing file state.
- `docs/CONTINUE.md`: records the missing-file fallback guard.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: keep file selection aligned after staging
### What was done
- Changed file-row status text to show the section identity directly as `未暂存`, `已暂存`, or `未跟踪`, so the same path in both change sections no longer looks identical.
- Added post-action selection sync for single-file and multi-file staging actions: after staging, unstaging, or discarding, Forkline reselects the file in the latest valid section.
- Kept the existing backend Git state behavior unchanged; this change only fixes the frontend selection and display after refresh.
### Testing
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `node --check server.js` passed.
- Frontend logic regression check passed: `stageFile` moves selection from `unstaged:<file>` to `staged:<file>`, `unstageFile` moves it back to `unstaged:<file>`, and `MM` status renders different `未暂存` / `已暂存` labels.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/diff-workbench.js`: changed scoped file-row labels from raw status text to clearer section labels.
- `public/js/features/git-actions.js`: added selection synchronization after single and batch file actions.
- `public/styles.css`: makes scoped file-row labels visually distinct by section.
- `README.md`: documents that staging actions keep the selected file aligned with its latest section.
- `docs/CONTINUE.md`: records the current staged/unstaged display and selection behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `public/js/features/git-actions.js`, `public/styles.css`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: keep selected row after stage all refresh
### What was done
- Found a remaining selection bug in the top-level "暂存全部" path: the selected file's Diff scope changed to staged, but the change-list selection key was pruned and not recreated.
- Added a render-layer guard so any still-visible `selectedFile` is reattached to the current valid change section after refresh.
- This makes full refreshes, including "暂存全部", keep the list highlight aligned with the bottom Diff.
### Testing
- Reproduction check failed before the fix: rendering a file that moved from `unstaged:a.txt` to staged-only left `selectedChanges = []`.
- Regression check passed after the fix: the same render now leaves `workDiffScope = staged` and `selectedChanges = ['staged:a.txt']`.
- `node --check public/js/features/worktree-changes.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/worktree-changes.js` contains `ensureSelectedFileChangeKey`.
### Notes
- `public/js/features/worktree-changes.js`: reattaches the selected file to the current valid staged/unstaged section after pruning stale selection keys.
- `docs/CONTINUE.md`: records that single-file, batch, and stage-all paths keep selection aligned.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/worktree-changes.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-29 - Task: scope file context menu for duplicate paths
### What was done
- Found a right-click menu bug for the Git state where the same path appears twice, such as staged deletion plus untracked recreation.
- Changed the file context menu to choose the working-file record that matches the row scope, instead of always taking the first record with the same path.
- This keeps "暂存 / 丢弃" enabled on the worktree row and "取消暂存 / 丢弃已暂存" enabled on the staged row for the duplicate-path case.
### Testing
- Reproduction check failed before the fix: right-clicking the `unstaged` row for duplicate `same.txt` left "暂存" disabled because the menu used the staged deletion record.
- Regression check passed after the fix: the `unstaged` row enables stage/discard worktree and ignore-file actions, while the `staged` row enables unstage/discard-staged and does not expose the untracked ignore action.
- API verification on a temporary Git repository confirmed Git/Forkline returns two `same.txt` records for staged deletion plus untracked recreation.
- `node --check public/js/features/context-menus.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/context-menus.js` contains `contextWorkingFileInfo`.
### Notes
- `public/js/features/context-menus.js`: resolves file information by the row scope before enabling file-menu actions.
- `docs/CONTINUE.md`: records duplicate-path context-menu behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/context-menus.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: open context diff in the clicked file section
### What was done
- Found a right-click "查看对照" bug for files that have both unstaged and staged changes.
- The context menu previously selected the file but kept the old Diff scope, so right-clicking an already-staged row could still open the unstaged Diff.
- Updated the file context menu Diff action to inherit the clicked row scope before loading the worktree Diff.
### Testing
- Reproduction check failed before the fix: `runFileContextAction('diff')` with `context.scope = staged` loaded `scope = unstaged`.
- Regression check passed after the fix: the staged context row loads `scope = staged`.
- Regression check also passed for the reverse case: the unstaged context row loads `scope = unstaged` even if the previous Diff scope was staged.
- `node --check public/js/features/context-menus.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/context-menus.js` contains the scope handoff for context Diff.
### Notes
- `public/js/features/context-menus.js`: sets `state.workDiffScope` from the clicked row scope before loading file Diff from the context menu.
- `docs/CONTINUE.md`: records that right-click "查看对照" opens the corresponding staged or unstaged Diff.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/context-menus.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: enable hunk actions in maximized diff
### What was done
- Found that maximized worktree Diff reused selected-line controls but did not expose the same hunk actions shown in the bottom Diff.
- Added hunk actions to maximized worktree Diff rendering.
- Routed hunk-action clicks inside the maximized Diff body through the existing hunk operation flow, and refreshes or closes the modal after the action.
### Testing
- Reproduction check failed before the fix: `diffModalOptions()` for a worktree Diff did not include `hunkActions`.
- Regression check passed after the fix: maximized worktree Diff options include `hunkActions = true`.
- Render regression check passed: maximized unstaged Diff HTML contains `data-hunk-action="stageHunk"` and `暂存此块`.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check public/js/app/events.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/diff-workbench.js` contains `hunkActions: true` and `/js/app/events.js` handles modal hunk-action clicks.
### Notes
- `public/js/features/diff-workbench.js`: adds hunk actions to maximized worktree Diff and refreshes the modal after hunk operations.
- `public/js/app/events.js`: handles hunk-action clicks inside the maximized Diff body.
- `docs/CONTINUE.md`: records that maximized Diff supports both hunk and selected-line operations.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `public/js/app/events.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: use modal file for maximized diff operations
### What was done
- Found a follow-up edge case in maximized Diff operations: hunk and selected-line actions depended on global `selectedFile`.
- Added a shared file resolver that prefers the current worktree `activeDiff.path`, then falls back to `selectedFile`.
- The operation now reselects the modal file before calling the existing hunk or selected-line action flow.
### Testing
- Reproduction check failed before the fix: maximized hunk action with `activeDiff.path = modal-file.txt` and empty `selectedFile` did not send `modal-file.txt` to the API.
- Regression check passed after the fix: maximized hunk action sends `file = modal-file.txt` and updates `selectedFile`.
- Regression check passed for maximized selected-line action: it sends `file = modal-lines.txt` and updates `selectedFile`.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/diff-workbench.js` contains `activeWorktreeDiffFile`.
### Notes
- `public/js/features/diff-workbench.js`: resolves maximized hunk and selected-line operations from the active worktree Diff path before falling back to the selected file.
- `docs/CONTINUE.md`: records that maximized Diff operations use the current modal file.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: render diff actions by current scope
### What was done
- Found a duplicate-path rendering bug for staged deletion plus untracked recreation.
- Hunk and selected-line buttons were looking up file state through the global `workDiffScope`, so rendering a staged Diff while the global scope was unstaged could hide `取消暂存此块`.
- Changed hunk and selected-line action rendering to resolve file state using the Diff scope currently being rendered.
### Testing
- Reproduction check failed before the fix: `workDiffHunkActionButtons('same.txt', 'staged', 0)` returned no staged hunk action when global scope was unstaged.
- Regression check passed after the fix: staged Diff renders `data-hunk-action="unstageHunk"` and untracked Diff renders `data-hunk-action="stageHunk"`.
- Regression check passed for selected-line actions: staged Diff returns `unstageSelectedLines`, untracked Diff returns `stageSelectedLines`.
- `node --check public/js/features/diff-workbench.js` passed.
- `node --check` passed for all 21 frontend JavaScript files under `public/`.
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
- HTTP static verification confirmed `/js/features/diff-workbench.js` resolves selected file info with the current render scope.
### Notes
- `public/js/features/diff-workbench.js`: renders hunk and selected-line actions from the current Diff scope instead of the global worktree scope.
- `docs/CONTINUE.md`: records that duplicate-path Diff buttons follow the active Diff section.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: fix duplicate-path worktree diff backend
### What was done
- Found a backend bug where the same path could appear as both a staged deletion and an untracked recreation.
- The worktree Diff API and block/line operations previously selected the first status record for the path, so the unstaged side could show an empty Diff or operate on the wrong side.
- Added scope-aware status selection for worktree Diff, ignore, discard, conflict resolution, hunk actions, and selected-line actions.
- Fixed virtual untracked-file Diff generation so a file ending with a newline no longer creates an extra blank added line.
### Testing
- Reproduced the failure on `C:\tmp\forkline-duplicate-path-diff-20260630`: `/api/worktree-diff?file=same.txt&scope=unstaged` returned `scope = unstaged` with `diff = []` while the staged side returned the deletion Diff.
- Regression check passed after the fix: the same unstaged request returns `scope = untracked`, one `+recreated` line, and no extra blank added line; the staged request still returns `scope = staged` with `-original`.
- Hunk action verification passed on `C:\tmp\forkline-duplicate-path-action2-20260630`: `stageHunk` with `scope = untracked` returned “已暂存此未跟踪文件改动块”, `git status --short` became `M  same.txt`, and `git diff -- same.txt` was empty.
- Selected-line verification passed on `C:\tmp\forkline-duplicate-path-lines-20260630`: `stageSelectedLines` with `scope = untracked` returned “已暂存所选 1 行”, `git status --short` became `M  same.txt`, and `git diff -- same.txt` was empty.
- `node --check server.js` passed.
### Notes
- `server.js`: selects status records by requested worktree scope and fixes trailing-newline handling in virtual untracked-file Diff generation.
- `docs/CONTINUE.md`: records the backend duplicate-path and trailing-newline behavior for worktree Diff operations.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve duplicate-path recreation when discarding staged side
### What was done
- Found a follow-up data-loss bug in the duplicate-path state: staged deletion plus untracked recreation.
- `discardStagedFile` restored both index and worktree, so clicking "丢弃已暂存" on the staged deletion overwrote the untracked recreated file with the HEAD version.
- Changed the duplicate-path branch to restore only the staged index entry when an untracked twin exists, preserving the worktree recreation.
### Testing
- Reproduction check failed before the fix: `discardStagedFile` on duplicate `same.txt` left the repo clean and changed the file content back to `original`.
- Regression check passed after the fix: `discardStagedFile` on duplicate `same.txt` returns “已暂存改动已丢弃”, leaves `git status --short` as `M same.txt`, preserves file content `recreated`, and leaves cached diff empty.
- Control check passed for a plain staged deletion without untracked twin: `discardStagedFile` still restores the file to `original` and leaves the repo clean.
- Adjacent duplicate-path check passed for `ignoreWorktreePath`: it appends `/same.txt` to `.gitignore` and keeps the staged deletion.
- `node --check server.js` passed.
### Notes
- `server.js`: protects duplicate-path staged discard from overwriting the untracked recreation.
- `docs/CONTINUE.md`: records the staged-discard behavior for duplicate-path recreation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve unstaged content when discarding staged added files
### What was done
- Found another staged-discard data-loss case: a new file staged as `A` and then edited in the worktree as `AM`.
- `discardStagedFile` used `git rm -f` for every staged add, which deleted the worktree file and lost the unstaged edit.
- Changed staged-add discard to use `git rm --cached -f` when the same file also has a worktree status, preserving the worktree file as untracked.
### Testing
- Reproduction check failed before the fix: `AM new.txt` with content `worktree` became clean and the file was deleted after `discardStagedFile`.
- Regression check passed after the fix: `AM new.txt` becomes `?? new.txt`, keeps content `worktree`, and has no cached diff.
- Control check passed for plain staged add `A new.txt`: `discardStagedFile` still deletes the file and leaves the repo clean.
- Control check passed for staged add then worktree delete `AD new.txt`: `discardStagedFile` removes the staged entry and leaves the repo clean.
- Duplicate-path stage checks passed: `stageFile` and `stageAll` both convert staged deletion plus untracked recreation into one staged modification with no worktree diff.
- `node --check server.js` passed.
### Notes
- `server.js`: preserves worktree-side edits when discarding the staged side of an added file.
- `docs/CONTINUE.md`: records the staged-add discard behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clarify staged discard confirmation
### What was done
- Found that the frontend confirmation for "丢弃已暂存" still claimed the operation would also discard related worktree content.
- That message no longer matched the backend behavior for duplicate-path recreation or staged-add-plus-worktree-edit cases, where Forkline preserves unstaged content.
- Updated the confirmation copy to say staged content is discarded, unstaged content is kept when present, and only files without unstaged content may be restored to HEAD or deleted.
### Testing
- `node --check public/js/features/git-actions.js` passed.
- HTTP static verification confirmed `/js/features/git-actions.js` contains the updated confirmation text "如果同一文件还有未暂存内容，会保留在工作区".
- `node --check server.js` passed.
- `git diff --check` passed, with only Windows LF/CRLF notices.
### Notes
- `public/js/features/git-actions.js`: updates the staged-discard confirmation message to match the protected backend behavior.
- `docs/CONTINUE.md`: records that the confirmation explains unstaged content preservation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/git-actions.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep git diff metadata out of content rows
### What was done
- Found a side-by-side Diff rendering bug during browser verification: Git metadata such as `index ...` and `\ No newline at end of file` was treated as file content, so it appeared with line numbers like normal code.
- Classified common Git patch metadata lines as Diff metadata in the backend parser.
- Limited hunk action buttons to actual `@@` hunk header rows so metadata rows do not gain block-operation buttons.
- Removed trailing empty split rows from parsed Diff output so the side-by-side view no longer renders a fake blank content row.
### Testing
- Playwright UI verification on `C:\tmp\forkline-ui-stage-all-selection-20260630` reproduced the issue before the fix: the staged Diff rendered metadata in content rows and produced an extra blank content row.
- API verification after the fix confirmed `/api/worktree-diff?file=file.txt&scope=staged` returns `index ...` and `\ No newline at end of file` as `type = meta`, with no empty `ctx` row.
- Playwright UI verification after the fix confirmed content rows only contain the real `before` and `after` file lines; `index ...` and `\ No newline at end of file` appear only in metadata rows; hunk actions appear only on the `@@` row.
- Playwright UI hunk-flow verification passed: bottom Diff kept `unstaged:file.txt` selected after staging one hunk, and maximized Diff switched to `staged:file.txt` after staging the final hunk.
- Playwright UI stage-all verification passed: selecting an unstaged file and clicking "暂存全部" moved selection to `staged:file.txt` and kept the bottom Diff on the staged view.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: classifies Git patch metadata and removes trailing empty parsed Diff rows.
- `public/js/features/diff-workbench.js`: shows hunk action buttons only on real hunk headers.
- `docs/CONTINUE.md`: records that Git metadata stays out of line-numbered content rows.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: render binary diff as metadata only
### What was done
- Found a follow-up Diff rendering bug for binary files: `Binary files ... differ` was still parsed as a normal content row.
- Classified binary patch lines such as `Binary files ... differ`, `GIT binary patch`, `literal`, and `delta` as Diff metadata.
- Hid the selected-line toolbar when the current Diff has no selectable added/deleted lines, so binary and metadata-only Diff views do not show unusable "暂存所选行" actions.
### Testing
- Reproduced the issue on `C:\tmp\forkline-binary-diff-20260630`: `/api/worktree-diff?file=blob.bin&scope=unstaged` returned `Binary files a/blob.bin and b/blob.bin differ` as `type = ctx`.
- API regression passed after the fix: the same line is returned as `type = meta`.
- Playwright UI verification passed: the binary Diff renders no content rows, shows `Binary files ... differ` only in metadata rows, shows no hunk actions, and hides the selected-line toolbar.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: classifies binary patch output as Diff metadata.
- `public/js/features/diff-workbench.js`: renders selected-line controls only when a Diff contains selectable add/delete lines.
- `docs/CONTINUE.md`: records binary and metadata-only Diff behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: align no-newline selected-line indexes
### What was done
- Found a selected-line staging bug for files without trailing newlines.
- The frontend skipped `\ No newline at end of file` metadata when assigning selectable line keys, but the backend counted those metadata lines when matching selected line indexes.
- This made clicking the visible added line send an index that the backend interpreted as metadata; after a partial fix it could produce an invalid staged patch such as `beforeafter`.
- Updated backend selected-line matching to skip backslash metadata lines, and updated side-by-side rendering to pair delete/add lines even when `No newline` metadata sits between them.
### Testing
- Reproduction check failed before the fix: selecting the visible `+after` line in a no-newline diff returned “请选择新增或删除行”.
- Follow-up reproduction confirmed the unsafe partial behavior: staging only the shifted add index produced `beforeafter` in the index.
- API regression passed after the fix: selecting line indexes `0` and `1` for `before -> after` stages the correct patch, leaves no worktree diff, and keeps file content `after`.
- Playwright UI regression passed: the no-newline modification row exposes one selectable row with keys `0:0,0:1`; clicking it selects both sides; “暂存所选行” succeeds and moves the selected file to the staged view.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: ignores `\ No newline at end of file` metadata when matching selected line indexes.
- `public/js/features/diff-workbench.js`: pairs modified lines across no-newline metadata so a replacement is selected as one row.
- `docs/CONTINUE.md`: records no-newline selected-line behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clear false dirty state after discarding a hunk
### What was done
- Found a worktree Diff bug where `discardWorktreeHunk` could report success but leave the file visible as modified while `git diff` was already empty.
- The reproduced case was a tracked text file without a trailing newline on Windows with `core.autocrlf=true`; after reverse-applying the hunk, Git's index stat remained stale.
- Updated the hunk discard path to refresh the file's index stat after a successful worktree hunk discard, without changing stage or unstage behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/no-newline-discard-status-20260630`: before the fix, `discardWorktreeHunk` returned success, `git diff -- <file>` was empty, but `git status --short -- <file>` still returned ` M ...`; running `git update-index --refresh -- <file>` cleared it.
- Regression passed after the fix on temporary branch `forkline/no-newline-discard-fixed-20260630`: `discardWorktreeHunk` returned `工作区改动块已丢弃`, `statusAfterAction` was empty, and `diffEmpty = true`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
- Confirmed the restarted local service is open on `D:/桌面/GitTest`, branch `123`, dirty count `0`.
### Notes
- `server.js`: refreshes index stat for the affected file after successful worktree hunk discard.
- `docs/CONTINUE.md`: records that hunk discard now clears the false modified/no-diff state.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: support selected-line unstage for staged new files
### What was done
- Found a selected-line unstage bug for staged new files: selecting one line in the staged Diff and running `unstageSelectedLines` returned `error: new file ... depends on old contents`.
- Added a dedicated patch generation path for staged new-file diffs so selected lines are removed from the index as normal file edits instead of reverse-applying a `/dev/null -> file` new-file patch.
- Preserved the full-file behavior: if every added line is selected, the file is removed from the index and returns to untracked status.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/unstage-lines-new-file-error-20260630`: a staged three-line new file failed with HTTP 400 and `new file ... depends on old contents`.
- Regression passed on temporary branch `forkline/unstage-lines-new-file-fixed-20260630`: selecting only line 2 returned `已取消暂存所选 1 行`, left status `AM`, kept `line 1` and `line 3` staged, and moved `line 2` to the worktree Diff.
- Batch regression passed on temporary branch `forkline/unstage-lines-regression-20260630`: partial new-file unstage, all-line new-file unstage, and normal modified-file unstage all produced the expected index/worktree split.
- No-trailing-newline regression passed on temporary branch `forkline/unstage-new-file-no-newline-20260630`: selected line was removed from the index, unselected line stayed staged, and the worktree Diff retained the `No newline` metadata.
- `node --check server.js` passed.
### Notes
- `server.js`: detects staged new-file diffs and generates file-to-file or file-to-null cached patches for selected-line unstage.
- `docs/CONTINUE.md`: records that staged new files support selected-line unstage.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: support selected-line stage for worktree deleted files
### What was done
- Found a selected-line staging bug for files deleted in the worktree: selecting one deleted line and running `stageSelectedLines` returned `error: deleted file ... still has contents`.
- Added a dedicated patch generation path for deleted-file diffs so selected deleted lines are staged as normal file edits; selecting every deleted line still stages the full file deletion.
- Found and fixed a related patch contamination bug: successful `git diff` commands could append stderr CRLF warnings into the generated patch, producing `corrupt patch` during selected-line staging.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/stage-lines-deleted-file-scan-20260630`: deleting a three-line file and staging only line 2 failed with HTTP 400 and `deleted file ... still has contents`.
- Regression passed on temporary branch `forkline/stage-lines-deleted-file-fixed-20260630`: staging only line 2 returned `已暂存所选 1 行`, left status `MD`, put `-line 2` in cached Diff, and left `-line 1` / `-line 3` in worktree Diff.
- Batch regression passed on temporary branch `forkline/stage-lines-deleted-regression-20260630b`: all-line deleted-file staging produced `D`, no-trailing-newline deleted-file staging produced the expected `MD` split, and normal modified-file selected-line staging still produced a clean cached change.
- Confirmed adjacent cases: staged deleted-file selected-line unstage, staged new-file hunk unstage, and untracked all-line selected staging behaved correctly.
- `node --check server.js` passed.
### Notes
- `server.js`: detects deleted-file diffs and generates file-to-file or file-to-null cached patches for selected-line stage; diff-reading for worktree/staged patches now uses stdout only on successful Git commands.
- `docs/CONTINUE.md`: records selected-line support for deleted files and the stdout-only Diff patch behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve rename metadata in worktree Diff
### What was done
- Found a worktree Diff bug for staged renames: Forkline parsed `git status -z` as only the new path, so `/api/worktree-diff` queried Git with only that path.
- Git then returned a `new file mode` patch for the renamed file instead of rename metadata, making the UI look like a new file was added.
- Updated status parsing to keep the old path as `previousFile` for rename/copy records, and updated worktree Diff reads to pass both old and new paths with rename/copy detection enabled.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/rename-diff-repro-20260630`: `git mv forkline-fixtures/rename old.txt forkline-fixtures/rename new.txt` produced raw status `R  new\0old\0`, but Forkline returned no `previousFile` and showed `new file mode`.
- Regression passed after the fix: `/api/worktree` returned `previousFile: "forkline-fixtures/rename old.txt"`, and `/api/worktree-diff?scope=auto` plus `scope=staged` returned `rename from` / `rename to` metadata instead of a new-file patch.
- Ordinary modified-file Diff regression passed by opening the Forkline repo in the local service and reading `/api/worktree-diff?file=server.js&scope=unstaged`; it returned a normal `diff --git a/server.js b/server.js` patch with no `previousFile`.
- `node --check server.js` passed.
- `git diff --check` passed with only the existing LF/CRLF warning.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree, and the restarted local service is pointed back to `D:/桌面/GitTest`.
### Notes
- `server.js`: keeps rename/copy previous paths in status objects and uses both paths when reading worktree Diff for renamed/copied files.
- `docs/CONTINUE.md`: records the rename/copy worktree Diff behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: discard staged rename without losing the old file
### What was done
- Found a destructive edge case in `discardStagedFile`: staged renames were looked up with a path-limited `git status`, which made Git report the new path as `A` instead of `R`.
- The old behavior ran the staged-new-file discard path, deleted the new file, and left the old file staged as deleted.
- Updated staged discard to use full status parsing and, when `previousFile` exists, restore both old and new paths from `HEAD` in one operation.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/discard-staged-rename-repro-20260630`: after `git mv old new`, calling `/api/action` with `discardStagedFile` returned success but left status `D  old` and both old/new files missing.
- Regression passed after the fix: the same action returned `已暂存改动已丢弃`, left `git status --short` empty, restored the old file, and removed the new path.
- Ordinary staged-new-file discard regression passed: a staged new file was removed and status stayed clean.
- Ordinary staged-modified-file discard regression passed: the tracked file content returned to the committed version and status stayed clean.
- `node --check server.js` passed.
### Notes
- `server.js`: uses full status for staged discard and restores rename/copy pairs with both `previousFile` and current file path.
- `docs/CONTINUE.md`: records the staged rename discard behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep rename metadata when unstaging
### What was done
- Found a staged rename unstage bug: `unstageFile` reset only the new path, which left the old path as a staged deletion and the new path as untracked.
- Updated full-file unstage to read full status and reset both `previousFile` and current file when the selected file is a staged rename/copy.
- Found a related selected-line bug: unstaging one staged content line from a rename+edit diff also unstaged the whole rename.
- Added a rename/copy-aware selected-line unstage patch path that applies a file-to-file cached patch against the new path, so only selected content lines move back to the worktree.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/unstage-rename-repro-20260630`: after `git mv old new`, calling `/api/action` with `unstageFile` returned success but left `D  old` staged and `?? new` untracked.
- Regression passed after the fix: full-file unstage returned success and left ` D old` plus `?? new`, meaning the rename was fully moved out of the index and kept in the worktree.
- Ordinary staged-new-file and staged-modified-file unstage regressions passed: the new file became untracked, and the modified file became an unstaged modification.
- Reproduced the selected-line issue on the same branch with staged rename+content: unstaging only the content line previously removed the whole rename from the index.
- Regression passed for selected added and deleted lines: staged Diff stayed as pure `rename from` / `rename to`, while the selected content change moved back to the unstaged Diff.
- `node --check server.js` passed.
### Notes
- `server.js`: full-file unstage now handles rename/copy path pairs; selected-line unstage now preserves rename/copy metadata while moving only selected content lines.
- `docs/CONTINUE.md`: records full-file and selected-line unstage behavior for staged renames.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: follow uncommitted renames in file history and blame
### What was done
- Found that the right-side “历史 / 逐行” views could not follow a staged-but-uncommitted rename.
- `/api/file-history` for the new path returned zero commits because `HEAD` still only contained the old path.
- `/api/file-blame` for the new path returned a 400 “文件 ... 在 HEAD 中不存在” error even though the status row had `previousFile`.
- Added a shared ref-file resolver for history and blame: if the selected path is not present at the requested ref, Forkline checks the current worktree status and falls back to `previousFile` when that old path exists at the ref.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/worktree-rename-copy-scan-20260630`: a staged rename from `forkline-fixtures/worktree old.txt` to `forkline-fixtures/worktree new.txt` made `/api/file-history?file=new` return `0` commits, while `/api/file-history?file=old` returned the fixture commit.
- Reproduced the matching blame failure: `/api/file-blame?file=new` returned HTTP 400 before the fix.
- Regression passed after the fix: `/api/file-history?file=new` returned `historyFile: "forkline-fixtures/worktree old.txt"`, `previousFile: "forkline-fixtures/worktree old.txt"`, and one historical commit.
- Blame regression passed after the fix: `/api/file-blame?file=new` returned two lines from the old path with `historyFile` and `previousFile` populated.
- Ordinary old-path history/blame regression passed with `historyFile` equal to the requested file and no `previousFile`.
- `node --check server.js` passed.
### Notes
- `server.js`: history and blame now resolve staged rename/copy previous paths when the selected path does not exist in the requested ref.
- `docs/CONTINUE.md`: records the uncommitted rename fallback for “历史 / 逐行”.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep rename metadata when unstaging hunks
### What was done
- Found that `unstageHunk` still treated staged rename+content diffs as one full reverse patch.
- Unstaging only one content hunk from a staged rename removed the entire rename from the index, leaving the old file as a worktree deletion and the new file untracked.
- Added a rename/copy-aware hunk unstage patch path that rewrites the selected hunk as a file-to-file cached patch against the new path, so only the selected content hunk moves back to the worktree.
- Normalized moved-file patch path headers and skipped the split trailing blank line so paths with spaces do not produce corrupt patches.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/unstage-hunk-rename-repro-20260630`: after staging a rename+content hunk, `/api/action` `unstageHunk` returned success but left `D old` plus `?? new`.
- Regression passed for an added-line hunk: after `stageHunk` then `unstageHunk`, status stayed `RM`, staged Diff contained only `rename from` / `rename to`, and the added line moved to the unstaged Diff.
- Regression passed for a deleted-line hunk with the same expected split: staged Diff stayed pure rename and the deleted line moved to unstaged Diff.
- Ordinary modified-file hunk staging/unstaging regression passed: the final status was a normal unstaged modification.
- `node --check server.js` passed.
### Notes
- `server.js`: `unstageHunk` now preserves rename/copy metadata while moving only selected content hunks back to the worktree.
- `docs/CONTINUE.md`: records that staged rename content can be cancelled by line or hunk without cancelling the rename.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: blame deleted files from their parent commit
### What was done
- Found that commit-detail “逐行追踪” failed for files deleted by the selected commit.
- `/api/file-history` correctly showed the delete commit and earlier add commit, but `/api/file-blame` used the delete commit itself, where the file no longer exists, and returned HTTP 400.
- Added a blame-only fallback: if the requested ref does not contain the selected file and no worktree rename fallback applies, Forkline checks the commit parents and uses the first parent that still contains the file for `git blame`.
- The response now keeps `ref` as the user-requested commit and adds `blameRef` for the actual commit used by the blame command.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/deleted-file-blame-repro-20260630`: after adding and then deleting `forkline-fixtures/deleted blame.txt`, `/api/file-blame?file=...&ref=<deleteSha>` returned HTTP 400 before the fix.
- Regression passed after the fix: the same request returned two blame lines, kept `ref` as the delete commit, and reported `blameRef` as the parent add commit.
- Existing-file blame regression passed: requesting the parent add commit returned `blameRef` equal to the requested `ref`.
- Committed-rename blame regression passed on temporary branch `forkline/committed-rename-blame-regression-20260630`: a renamed file still blamed at the rename commit itself and did not incorrectly fall back to a parent.
- `node --check server.js` passed.
### Notes
- `server.js`: `readFileBlame` now resolves a parent blame ref for deleted files while preserving the requested ref in the response.
- `docs/CONTINUE.md`: records the deleted-file blame fallback.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: show committed renames as renames in file lists
### What was done
- Found that `/api/commit` parsed `git show --name-status --find-renames` too coarsely.
- A committed rename such as `R100 old -> new` was returned as `{ state: "M", file: "new", extra: "R" }`, so the right-side commit file list could label it as a normal modification and had no old path.
- Updated name-status parsing to preserve R/C states, `previousFile`, and the full status text such as `R100`.
- Updated the shared file tree status mapping to render R/C badges and Chinese labels instead of collapsing them to M.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/commit-rename-status-repro-20260630`: a rename commit returned `state: "M"` and no `previousFile` before the fix.
- Regression passed after the fix: `/api/commit?sha=<renameSha>` returned `state: "R"`, `file: "forkline-fixtures/commit new.txt"`, `previousFile: "forkline-fixtures/commit old.txt"`, and `extra: "R100"`.
- Add/delete commit parsing regressions passed: add still returned `A`, delete still returned `D`.
- `node --check server.js` passed.
- `node --check public/js/features/diff-workbench.js` passed.
### Notes
- `server.js`: `parseNameStatus` now preserves rename/copy metadata from Git name-status output.
- `public/js/features/diff-workbench.js`: file tree status mapping now recognizes rename/copy rows.
- `public/styles.css`: adds a badge color for rename/copy rows.
- `docs/CONTINUE.md`: records committed rename/copy file list behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `public/styles.css`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: count worktree renames as renames
### What was done
- Found that staged worktree renames were still reported as `state: "M"` even though `indexStatus` and `extra` were `R`.
- This made the bottom worktree summary count a rename as a normal modification and omitted it from rename-specific status labels.
- Updated status parsing to return `state: "R"` for rename rows, and updated the frontend worktree summary/count helpers to include a rename count.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/worktree-rename-state-repro-20260630`: after `git mv old new`, `/api/worktree` returned `state: "M"`, `extra: "R"`, and `previousFile`.
- Regression passed after the fix: the same staged rename returned `state: "R"` with the same `previousFile`.
- Ordinary worktree state regressions passed: modified files returned `M`, untracked files returned `A`, and deleted files returned `D`.
- `node --check server.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `node --check public/js/features/worktree-changes.js` passed.
### Notes
- `server.js`: returns rename state for worktree status rows.
- `public/js/features/git-actions.js`: initializes rename counts in file state summaries.
- `public/js/features/worktree-changes.js`: includes rename count and rename search labels in the worktree summary/filter data.
- `docs/CONTINUE.md`: records worktree rename counting behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/git-actions.js`, `public/js/features/worktree-changes.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: block selected stash for staged renames
### What was done
- Found that “储藏所选” on a staged rename passed only the selected new path to `git stash push`.
- Git then created a stash for the new path but left the old path deletion behind, or produced a half-success pathspec error when both old and new paths were passed.
- Added a backend preflight for selected stashes: if the selected path belongs to a staged rename/copy pair, Forkline now stops before running Git and returns a Chinese explanation telling the user to use “储藏全部” or unstage first.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/stash-selected-rename-repro-20260630`: selecting only `forkline-fixtures/stash new.txt` and running `createStash` left `D  forkline-fixtures/stash old.txt` in the worktree.
- Verified Git's native behavior: `git stash push -- old new` can create a stash and still report a pathspec error, so automatic path expansion is unsafe.
- Regression passed after the fix: the same API call returned HTTP 400 with a Chinese staged-rename explanation, stash count stayed unchanged, and status remained the original staged rename.
- Full stash regression passed: `createStash` without selected files saved the staged rename as `R100 old -> new` and left the worktree clean.
- Ordinary selected-file stash regression passed: a normal modified file could still be stashed by selected path and left the worktree clean.
- `node --check server.js` passed.
### Notes
- `server.js`: selected stash requests now reject staged rename/copy pairs before invoking `git stash push`.
- `docs/CONTINUE.md`: records the selected-stash staged rename protection.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: preserve worktree content when discarding staged changes
### What was done
- Found a broader data-loss bug in `discardStagedFile`: a normal file with both staged and unstaged edits (`MM`) lost the worktree edit when discarding the staged side.
- This contradicted the existing confirmation text and previous protections for staged-add plus worktree-edit and staged-delete plus untracked recreation.
- Updated staged discard so files with a worktree-side status clear only the index side and leave the current worktree content untouched.
- Applied the same rule to staged renames with additional worktree edits: the staged rename is moved back to the worktree instead of deleting the new file content.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/discard-staged-preserve-worktree-repro-20260630`: an `MM` file with staged `one -> ONE` and unstaged `two -> TWO` became clean and reverted to `one/two/three` after `discardStagedFile`.
- Regression passed after the fix: the same action leaves status ` M`, clears cached diff, and preserves current worktree content `ONE/TWO/three`.
- Rename+worktree-edit regression passed: staged rename plus unstaged added line becomes worktree `D old` plus `?? new`, preserving the new file content.
- Control checks passed: pure staged modification still restores the HEAD content and leaves the repo clean; pure staged rename still restores the old path, removes the new path, and leaves the repo clean.
- `node --check server.js` passed.
### Notes
- `server.js`: `discardStagedFile` now preserves worktree-side content when the same file also has unstaged changes, including staged rename rows with worktree edits.
- `docs/CONTINUE.md`: records the mixed staged/unstaged discard behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: block stash duplicate path states
### What was done
- Found that Git can create an unusable stash when the same path has both a staged deletion and an untracked recreation.
- `git stash push -u` reported success, but `git stash show --include-untracked` failed with `worktree and untracked commit have duplicate entries`.
- Added a backend stash preflight that rejects full stash and selected stash before invoking Git when that duplicate-path state is present.
- Kept the existing selected staged-rename guard intact.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-rename-worktree-20260630`: staged deletion plus untracked recreation of `forkline-fixtures/rename-old.txt` created a stash that `git stash show --include-untracked` could not unpack.
- Regression passed on temporary service `http://127.0.0.1:5281`: full `createStash` returned a Chinese duplicate-path error, status stayed `D` plus `??`, and no stash was created.
- Selected stash regression passed: `createStash` with `files = ["forkline-fixtures/rename-old.txt"]` returned the same Chinese duplicate-path error without creating a stash.
- Normal stash regression passed: a regular modified tracked file still created a stash, `git stash show --name-status` could read it, and the temporary stash was dropped.
- Existing selected staged-rename regression passed: selecting only the new path of a staged rename still returns the staged-rename explanation and leaves the status unchanged.
### Notes
- `server.js`: `createStash` now parses status once and rejects stash requests that would create duplicate untracked/worktree entries.
- `docs/CONTINUE.md`: records the duplicate-path stash protection.
- `README.md`: documents why Forkline refuses that stash state and what the user should do.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: explain existing duplicate-entry stashes
### What was done
- Found that a duplicate-entry stash created by an older Forkline build or manual `git stash -u` still appears in the stash list, but opening its detail returned raw English Git output.
- Added a unified friendly error translation for `duplicate entries` plus `failed to unpack trees`, so stash detail, apply, and pop failures explain the problem in Chinese.
- The message explains that Git cannot expand the stash because the same path exists as both worktree and untracked records, and suggests deleting the stash after confirming it is no longer needed.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-bad-stash-detail-20260630`: created a duplicate-entry stash and `/api/stash?ref=stash@{0}` returned raw `worktree and untracked commit have duplicate entries`.
- Regression passed after restarting local service `http://127.0.0.1:5177`: the same `/api/stash` request returned a Chinese duplicate-entry explanation naming `forkline-fixtures/bad-stash.txt`.
- Normal stash detail regression passed: a regular modified tracked file stash returned `files = 1`, non-empty diff, and `ref = stash@{0}`.
### Notes
- `server.js`: translates existing duplicate-entry stash unpack failures into Chinese guidance.
- `docs/CONTINUE.md`: records the existing bad-stash explanation behavior.
- `README.md`: documents what happens when a repository already contains this kind of bad stash.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: protect stash-and-checkout from duplicate path stashes
### What was done
- Found that the earlier duplicate-path stash protection only covered the explicit stash action.
- The “储藏并签出” paths for local and remote branch checkout still called `git stash push -u` directly, so they could create the same unusable duplicate-entry stash and then report checkout success.
- Updated both checkout paths to parse the current status and run the same stash preflight before invoking Git.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-checkout-stash-20260630`: `checkoutBranch` with `mode = stash` created a stash, switched to `123`, and `git stash show --include-untracked` failed with duplicate entries.
- Local checkout regression passed after the fix: the same `checkoutBranch` request returned the Chinese duplicate-path error, stash count stayed `0`, and the current branch stayed on the temporary source branch.
- Remote checkout regression passed: `checkoutRemoteBranch` with `ref = origin/main` and `mode = stash` returned the same Chinese duplicate-path error, stash count stayed `0`, and the branch did not switch.
- Normal checkout stash regression passed: a regular tracked-file modification still created one readable stash, switched to `123`, and the temporary stash was dropped afterward.
### Notes
- `server.js`: local and remote stash-and-checkout now share the duplicate-path stash preflight before running `git stash push -u`.
- `docs/CONTINUE.md`: records that stash-and-checkout uses the same duplicate-path protection.
- `README.md`: documents that this protection also applies to stash-and-checkout.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: prefer duplicate-path stash warning for selected rename targets
### What was done
- Found a misleading message in the staged-rename plus old-path recreation case.
- Selecting the renamed new path for “储藏所选” was blocked as a partial staged rename and told the user to try “储藏全部”, but full stash is also unsafe in this exact state.
- Updated the duplicate-path preflight so a selected staged-rename target is treated as related to its old path. Forkline now shows the same duplicate-path warning when the old path was recreated.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-rename-old-recreate-20260630`: staged rename `rename-old-path.txt -> rename-new-path.txt` plus untracked `rename-old-path.txt`.
- Full stash returned the duplicate-path warning and did not create a stash.
- Selected old path returned the duplicate-path warning and did not create a stash.
- Selected new path regression passed after the fix: it also returned the duplicate-path warning instead of the partial-rename “use full stash” suggestion, and stash count stayed `0`.
- Unrelated selected path was not blocked by the duplicate-path preflight.
### Notes
- `server.js`: duplicate-path stash detection now treats a selected staged-rename target and its old path as related.
- `docs/CONTINUE.md`: records the selected renamed-path warning behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clarify stash apply overwrite errors
### What was done
- Found that applying or popping a stash over local worktree modifications reused the generic overwrite warning.
- The old text mentioned branch switching and force checkout, which is not useful when the user is restoring a stash.
- Added a stash-specific friendly error for `applyStash`, `popStash`, and `restoreCheckoutStash` when Git reports local changes would be overwritten.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-stash-apply-conflict-20260630`: `applyStash` over a local edit returned the generic “这个操作会覆盖本地修改...如果是切换分支...” message.
- Regression passed after restarting `http://127.0.0.1:5177`: both `applyStash` and `popStash` returned the stash-specific Chinese warning and stash count stayed `1`.
- Normal flow regression passed: on a clean worktree, `applyStash` applied the change and kept the stash, while `popStash` applied the change and dropped the stash.
### Notes
- `server.js`: stash apply/pop/checkout-stash restore overwrite errors now use a stash-specific Chinese message.
- `docs/CONTINUE.md`: records the stash overwrite warning behavior.
- `README.md`: documents the user-facing warning.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: reject selected stash when selected files are unchanged
### What was done
- Found that “储藏所选” could report success when the selected files had no actual changes, as long as some other file in the worktree was dirty.
- Git returned `No local changes to save`, Forkline marked the operation as success, and no stash was created.
- Added a backend preflight for selected stashes: at least one selected path, or its rename counterpart, must appear in the current Git status before Forkline runs `git stash push`.
### Testing
- Reproduced on `D:\桌面\GitTest` using temporary branch `forkline/bughunt-selected-stash-empty-20260630`: only `stash-dirty.txt` was modified, but `createStash` selected unchanged `stash-clean.txt`.
- Before the fix, the API returned `ok = true` with `No local changes to save`, stash count stayed `0`, and the dirty file remained modified.
- Regression passed after restarting `http://127.0.0.1:5177`: selecting unchanged `stash-clean.txt` returned the Chinese “所选文件没有可储藏的改动” error and stash count stayed `0`.
- Normal selected stash regression passed: selecting modified `stash-dirty.txt` created one readable stash, then the temporary stash was dropped.
### Notes
- `server.js`: selected stash requests now reject stale or unchanged selected paths before invoking Git.
- `docs/CONTINUE.md`: records the selected-stash stale-selection behavior.
- `README.md`: documents the user-facing message.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: clear stale checkout-stash restore reminders
### What was done
- Found that the browser can keep a stale `forkline-checkout-stashes` record after the underlying stash was deleted manually or by another path.
- When the user returned to the original branch, Forkline still prompted to restore that stash; clicking restore failed with “没有找到可恢复的 Forkline 储藏”, but the stale record stayed in localStorage and would prompt again later.
- Updated the frontend restore error path to forget the remembered checkout stash and ignore it for the current session when the missing-stash error is returned.
### Testing
- Reproduced in the in-app browser on `http://127.0.0.1:5177`: injected a stale checkout-stash record for `D:/桌面/GitTest` and branch `123`, triggered `maybeRestoreCheckoutStash("123")`, and clicked “恢复更改”.
- Before the fix, localStorage still contained the stale record after the missing-stash error.
- Regression passed after reloading the page: the same flow showed the restore modal, returned the missing-stash toast, and `forkline-checkout-stashes` became `[]`.
- `node --check public/js/features/git-actions.js` passed.
### Notes
- `public/js/features/git-actions.js`: missing checkout-stash restore errors now clear the stale remembered record.
- `docs/CONTINUE.md`: records stale checkout-stash reminder cleanup.
- `README.md`: documents the user-facing behavior.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/git-actions.js`, `docs/CONTINUE.md`, `README.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: translate missing stash references
### What was done
- Found that stale stash references returned raw English Git errors such as `stash@{0} is not a valid reference`.
- Added a friendly Chinese error for missing stash references, covering stale stash detail, apply, pop, and branch-from-stash flows.
- Documented that users should refresh the stash list and reselect when a stash has already been popped, deleted, or cleared externally.
### Testing
- `node --check server.js` passed.
- `node --check public/js/features/git-actions.js` passed.
- `git diff --check` passed.
- Verified on temporary service `http://127.0.0.1:5283` with `D:\桌面\GitTest` open and an empty stash list: `applyStash`, `popStash`, `branchFromStash`, and `/api/stash?ref=stash@{0}` all returned the Chinese missing-stash message.
- Confirmed `branchFromStash` did not create `forkline/missing-stash-result`, and GitTest stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: translates missing `stash@{n}` references into a Chinese refresh-and-reselect message.
- `README.md`: documents stale stash-list behavior for users.
- `docs/CONTINUE.md`: records the missing-stash reference behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep overview graph primary line on exact main branch
### What was done
- Found that the overview commit graph treated any ref ending in `/main` as the primary `main` branch.
- Reproduced the issue with a temporary local branch named `forkline/main`: the graph primary-line selector chose `forkline/main` instead of the real local `main`.
- Updated the graph primary-ref check so local primary refs must match `main` / `master` exactly, while remote primary refs must match a known remote name such as `origin/main`.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating temporary branch `forkline/main`; the old selector chose `HEAD -> forkline/main` as the primary tip while the exact `main` tip was `5c1167c`.
- Regression passed with the patched `public/js/features/graph.js`: in the same temporary `forkline/main` scenario, the real `main` commit stayed on lane `0`, and `forkline/main` moved to lane `1`.
- `node --check public/js/features/graph.js` passed.
- `node --check public/app.js` passed.
- `git diff --check` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after the repro and regression checks.
### Notes
- `public/js/features/graph.js`: primary-line detection now distinguishes exact local primary refs from remote primary refs and no longer uses broad suffix matching.
- `README.md`: documents that overview graph primary detection only treats exact local or known remote main/master refs as primary.
- `docs/CONTINUE.md`: records the graph primary-line fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/graph.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: handle slash-containing remote names
### What was done
- Found that Git allows remote names containing `/`, such as `team/origin`.
- Reproduced that signing out `team/origin/forkline/slash-remote-checkout-20260630` created the wrong local branch `origin/forkline/slash-remote-checkout-20260630`.
- Updated backend remote checkout parsing to split remote branch refs using the real `git remote` names, matching the existing remote-delete backend parser.
- Updated frontend remote branch helpers so checkout labels and delete confirmation commands also use the real remote name.
### Testing
- Reproduced on `D:\桌面\GitTest` with a temporary bare remote at `C:\tmp\forkline-slash-remote.git` and temporary remote name `team/origin`; before the fix, Forkline checked out local branch `origin/forkline/slash-remote-checkout-20260630`.
- Regression passed after restarting the temporary service: the same remote ref checked out local branch `forkline/slash-remote-checkout-20260630`, and the incorrect `origin/forkline/...` branch was not created.
- Frontend helper regression passed in a Node VM: `remoteCheckoutBranch("team/origin/forkline/slash-remote-checkout-20260630")` returned `forkline/slash-remote-checkout-20260630`, and the delete command rendered as `git push team/origin --delete forkline/slash-remote-checkout-20260630`.
- `node --check server.js`, `node --check public/js/features/branches.js`, and `node --check public/js/features/diff-workbench.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree, and the temporary remote and bare repository were removed.
### Notes
- `server.js`: remote checkout now derives the local branch by splitting with known remote names.
- `public/js/features/diff-workbench.js`: adds a shared frontend remote-branch splitter that respects `repo.remoteNames`.
- `public/js/features/branches.js`: delete confirmation command now uses the shared frontend splitter.
- `README.md`: documents slash-containing remote name handling for branch operations.
- `docs/CONTINUE.md`: records the remote-name parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/features/diff-workbench.js`, `public/js/features/branches.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: infer PR target with slash-containing remote names
### What was done
- Found another slash-remote parsing path in PR/MR link generation.
- Reproduced that a current branch tracking `team/origin/main` generated a Pull Request target of `origin/main` instead of `main`.
- Updated PR target inference to split the upstream ref using the real `git remote` names, matching the remote checkout and delete parsing rules.
### Testing
- Reproduced on `D:\桌面\GitTest` by temporarily adding web remote `team/origin`, creating `refs/remotes/team/origin/main`, and setting temporary branch `forkline/slash-pr-source-20260630` to track `team/origin/main`; before the fix, Forkline generated target `origin/main` and URL `compare/origin%2Fmain...`.
- Regression passed after restarting the temporary service: the same setup generated target `main` and URL `https://github.com/AsphyxiaChoke/Forkline/compare/main...forkline%2Fslash-pr-source-20260630?expand=1`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree, and the temporary remote and tracking ref were removed.
### Notes
- `server.js`: PR/MR target inference now derives the upstream branch with `splitRemoteBranchRef`.
- `README.md`: documents correct PR target inference for slash-containing remote names.
- `docs/CONTINUE.md`: records the PR/MR upstream parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: use remote main when local main is absent
### What was done
- Found that the overview graph only considered local branch names when choosing the primary line.
- Reproduced that deleting local `main` while keeping `origin/main` made the graph choose current branch `123` as the primary branch, putting `origin/main` on lane `1`.
- Updated primary branch selection so exact local `main` / `master` still wins, but a known remote `main` / `master` is used when the local primary branch is absent.
### Testing
- Reproduced on `D:\桌面\GitTest` by temporarily deleting local `main` while keeping `origin/main`; before the fix, `origin/main` was lane `1` and the current branch `123` was chosen as primary.
- Regression passed with the patched `public/js/features/graph.js`: with local `main` temporarily absent, `primaryBranchName()` returned `origin/main` and the `origin/main` commit was lane `0`.
- Re-ran the previous `forkline/main` regression: with local `main` restored and a temporary `forkline/main` branch present, `primaryBranchName()` returned `main`, real `main` stayed lane `0`, and `forkline/main` stayed lane `1`.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after both checks.
### Notes
- `public/js/features/graph.js`: primary branch selection now falls back to known remote `main` / `master` refs when no local primary branch exists.
- `README.md`: clarifies local primary branches win and remote primary branches are used only as fallback.
- `docs/CONTINUE.md`: records the remote-main fallback behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/graph.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: allow slash-containing remote names in remote management
### What was done
- Found that Git allows remote names containing `/`, but Forkline rejected them during remote management with `远端名不能包含 /`.
- Removed the extra slash-specific remote-name rejection while keeping existing ref-name validation.
- This lets add, edit, test, and delete slash-containing remotes work consistently with checkout, delete, and PR parsing fixes.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary bare remote `C:\tmp\forkline-add-slash-remote.git`: `addRemote team/origin` returned `远端名不能包含 /`.
- Regression passed on temporary service `http://127.0.0.1:5288`: `addRemote team/origin`, `setRemoteUrl team/origin`, `testRemote team/origin`, and `deleteRemote team/origin` all succeeded.
- Confirmed `git remote` returned only original `origin` after cleanup.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree and temporary bare repos removed.
### Notes
- `server.js`: `normalizeRemoteName` now allows slash-containing names that pass existing ref-name validation.
- `README.md`: documents slash-containing remote names in remote management.
- `docs/CONTINUE.md`: records the remote-management fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: stop truncating worktree file status at 120 entries
### What was done
- Found that Forkline parsed only the first 120 `git status` records, so worktree panels could miss files when a repository had many unstaged or untracked changes.
- Removed the hardcoded 120-file cap from both plain and NUL-delimited status parsers.
- Documented that worktree file lists are no longer silently capped at the backend parser.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 130 temporary untracked files under `forkline-status-limit-repro-20260630`; before the fix, `/api/worktree` returned `api_count=120`, ended at `file-120.txt`, and did not include `file-130.txt`.
- Regression passed on temporary service `http://127.0.0.1:5293`: the same 130-file setup returned `api_count=130`, included `file-130.txt`, and ended at `file-130.txt`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: removed the 120-entry cap in `parseStatus` and `parseStatusRecords`.
- `README.md`: documents that large worktree change lists are not silently truncated.
- `docs/CONTINUE.md`: records the status parser behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: keep later files visible in large commit diffs
### What was done
- Found that Forkline parsed only the first 320 lines of any Git diff.
- Reproduced that a commit with a 360-line first file and a second small file listed both files, but `/api/commit` returned no diff block for the second file.
- Removed the global 320-line parser cap so file-specific historical diff lookup can still find later files in the same commit.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/diff-cap-repro-20260630`: `/api/commit` returned `files_count=2`, `diff_count=320`, `late_file_listed=1`, `late_diff_present=0`, and the last diff line was `+big line 314`.
- Regression passed on temporary service `http://127.0.0.1:5295`: the same setup returned `files_count=2`, `diff_count=373`, `late_file_listed=1`, `late_diff_present=2`, and the last diff line was `+late file should still have diff`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: removed the global 320-line cap in `parseDiff`.
- `README.md`: documents that later files in large historical diffs remain viewable.
- `docs/CONTINUE.md`: records the large-commit diff visibility fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-06-30 - Task: stop truncating name-status file lists at 160 entries
### What was done
- Found that Forkline parsed only the first 160 `git show --name-status` / `git diff --name-status` entries.
- Reproduced that a commit touching 170 files returned only the first 160 files in `/api/commit`, so later files disappeared from the commit file list.
- Removed the hardcoded 160-entry cap from `parseNameStatus`, which also benefits compare and stash file lists that use the same parser.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/name-status-cap-repro-20260630`: `/api/commit` returned `files_count=160`, `contains_file_170=0`, and ended at `forkline-name-status-cap-repro-20260630/file-160.txt`.
- Regression passed on temporary service `http://127.0.0.1:5297`: the same 170-file setup returned `files_count=170`, `contains_file_170=1`, and ended at `forkline-name-status-cap-repro-20260630/file-170.txt`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: removed the 160-entry cap in `parseNameStatus`.
- `README.md`: documents that large historical file lists remain viewable.
- `docs/CONTINUE.md`: records the name-status parser behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating branch lists at 32 entries
### What was done
- Found that `/api/state` returned only the first 32 local branches and first 32 remote branches.
- Reproduced that repositories with many branches could hide later branches from the left branch list and related actions.
- Removed the hardcoded 32-entry caps for local and remote branch arrays while keeping existing branch parsing and filtering behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 40 temporary local branches named `zzzz/forkline-branch-cap-20260701-*`; before the fix, `/api/state` returned `api_branch_count=32`, `contains_branch_040=0`, and ended at `zzzz/forkline-branch-cap-20260701-028`.
- Regression passed on temporary service `http://127.0.0.1:5299`: the same local branch setup returned `api_branch_count=44`, `contains_branch_040=1`, and ended at `zzzz/forkline-branch-cap-20260701-040`.
- Remote branch regression passed on temporary service `http://127.0.0.1:5300` with 40 temporary `refs/remotes/origin/zzzz/forkline-remote-cap-20260701-*` refs: `/api/state` returned `api_remote_count=44` and `contains_remote_040=1`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: `/api/state` now returns full `branches` and `remotes` arrays instead of slicing them to 32 entries.
- `README.md`: documents that large local/remote branch lists are not silently truncated.
- `docs/CONTINUE.md`: records the branch list behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating tag lists at 160 entries
### What was done
- Found that Forkline parsed only the first 160 local Tag refs.
- Reproduced that repositories with many Tags could hide older Tags from the right-side Tag panel and related actions.
- Removed the hardcoded 160-entry cap from `parseTags` while keeping existing Tag sorting and metadata parsing behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 170 temporary annotated Tags named `forkline-tag-cap-20260701-*` with stable tagger dates; before the fix, `/api/state` returned `api_tag_count=160`, `matching_tag_count=160`, `contains_tag_001=0`, and the oldest matching returned Tag was `forkline-tag-cap-20260701-011`.
- Regression passed on temporary service `http://127.0.0.1:5302`: the same Tag setup returned `api_tag_count=171`, `matching_tag_count=170`, `contains_tag_001=1`, and the oldest matching Tag was `forkline-tag-cap-20260701-001`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: `parseTags` now returns all parsed Tag refs instead of slicing to 160 entries.
- `README.md`: documents that large local Tag lists are not silently truncated.
- `docs/CONTINUE.md`: records the Tag list behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating stash lists at 80 entries
### What was done
- Found that Forkline parsed only the first 80 stash entries.
- Reproduced that repositories with many stashes could hide older stashes from the right-side stash panel and related recovery actions.
- Removed the hardcoded 80-entry cap from `parseStashList` while keeping existing stash subject parsing behavior.
### Testing
- Reproduced on `D:\桌面\GitTest` by creating 85 temporary stashes named `Forkline stash cap repro 20260701-*`; before the fix, `/api/state` returned `api_stash_count=80`, `matching_stash_count=80`, `contains_stash_001=0`, and the oldest matching stash was `On 123: Forkline stash cap repro 20260701-006`.
- Regression passed on temporary service `http://127.0.0.1:5304`: the same stash setup returned `api_stash_count=85`, `matching_stash_count=85`, `contains_stash_001=1`, and the oldest matching stash was `On 123: Forkline stash cap repro 20260701-001`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree and no matching temporary stashes left after cleanup.
### Notes
- `server.js`: `parseStashList` now returns all parsed stash entries instead of slicing to 80 entries.
- `README.md`: documents that large stash lists are not silently truncated.
- `docs/CONTINUE.md`: records the stash list behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve full long lines in diff output
### What was done
- Found that Forkline truncated every parsed diff line to 280 characters.
- Reproduced that a changed line longer than 280 characters lost its tail in `/api/commit`, hiding the end of long configuration or JSON-style lines.
- Removed the per-line diff text truncation so the API returns complete diff line text.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/diff-long-line-repro-20260701`: a committed line with trailing marker `TAIL_MARKER_20260701` returned `add_text_length=280`, `contains_tail=False`, and a suffix of only `x` characters.
- Regression passed on temporary service `http://127.0.0.1:5306`: the same long line returned `add_text_length=381`, `contains_tail=True`, and suffix `xxxxxxxxxxxxTAIL_MARKER_20260701`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree after cleanup.
### Notes
- `server.js`: `parseDiff` now keeps full diff line text instead of slicing each line to 280 characters.
- `README.md`: documents that long diff lines remain fully visible.
- `docs/CONTINUE.md`: records the long-line diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating selected stash files at 120 entries
### What was done
- Found that Forkline silently kept only the first 120 selected files when creating a selected-file stash.
- Reproduced that selecting 130 files created a stash but left files 121-130 in the worktree.
- Removed the 120-file cap from selected stash file normalization while keeping path normalization and de-duplication.
### Testing
- Reproduced on `D:\桌面\GitTest` with 130 temporary untracked files under `forkline-stash-selected-cap-20260701`; before the fix, `requested_files=130`, `remaining_file_count=10`, with remaining files from `file-121.txt` to `file-130.txt`.
- Regression passed on temporary service `http://127.0.0.1:5309`: the same setup returned `requested_files=130` and `remaining_file_count=0`.
- `node --check server.js` passed.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree and no matching temporary stashes left after cleanup.
### Notes
- `server.js`: `normalizeStashFiles` now keeps all selected files after normalization and de-duplication instead of slicing to 120.
- `README.md`: documents that selected-file stash does not silently drop later selected files.
- `docs/CONTINUE.md`: records the selected-stash behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: stop truncating untracked text file virtual diffs at 420 lines
### What was done
- Found that Forkline generated virtual Diff blocks for untracked text files from only the first 420 lines.
- Reproduced that a 430-line untracked file lost its tail line in `/api/worktree-diff`, so the user could not see or select that content from the Diff panel.
- Removed the 420-line cap while keeping the existing 40-line virtual hunk size.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-untracked-long-20260701.txt` containing 430 lines and tail marker `LINE_430_TAIL_MARKER_20260701`; before the fix, temporary service `http://127.0.0.1:5311` returned `add_count=420`, `contains_tail=false`, and `last_add=+line-420`.
- Regression passed on temporary service `http://127.0.0.1:5312`: the same file returned `add_count=430`, `contains_tail=true`, and `last_add=+LINE_430_TAIL_MARKER_20260701`.
- `node --check server.js` passed.
- Stopped both temporary services and deleted the temporary file.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now builds virtual hunks from all text lines instead of slicing to the first 420.
- `README.md`: documents that untracked text file virtual Diff content is complete.
- `docs/CONTINUE.md`: records the untracked virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep empty untracked files from becoming fake blank-line diffs
### What was done
- Found that Forkline's virtual Diff for an empty untracked text file generated one fake added blank line.
- Reproduced that running hunk staging on that fake line created a 1-byte staged blob while the worktree file stayed 0 bytes, leaving the file as `AM`.
- Changed virtual Diff line splitting so a truly empty file has no content hunks, while files that actually contain a newline still show that blank line.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary empty file `forkline-empty-untracked-20260701.txt`; before the fix, `/api/worktree-diff` on temporary service `http://127.0.0.1:5313` returned `diff_count=6`, `add_count=1`, and `add_texts=+`.
- Confirmed the bad operation before the fix: `stageHunk` on the fake hunk produced status `AM` and a cached blob size of `1`.
- Regression passed on temporary service `http://127.0.0.1:5314`: the same empty file returned `diff_count=4`, `add_count=0`, and a forced `stageHunk` call left status as `??`.
- Full-file staging regression passed: `stageFile` staged the empty file as status `A` with cached blob size `0`.
- `node --check server.js` passed.
- Stopped temporary services and deleted the temporary file.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now treats empty file text as zero lines instead of one empty line.
- `README.md`: documents that empty untracked files do not render fake added blank lines.
- `docs/CONTINUE.md`: records the empty untracked file virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve missing trailing newlines in untracked virtual diffs
### What was done
- Found that Forkline's virtual Diff for untracked text files without a trailing newline did not include the standard `No newline at end of file` marker.
- Reproduced that hunk staging such a file added a newline to the staged blob, leaving the worktree file unchanged and the path in `AM` state.
- Added the missing no-newline marker to the final virtual hunk when the source file really has no trailing newline.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-no-newline-untracked-20260701.txt` containing `NO_NEWLINE_TAIL_20260701` with no trailing newline; before the fix, temporary service `http://127.0.0.1:5315` returned `no_newline_marker_count=0`.
- Confirmed the bad operation before the fix: `stageHunk` returned success, status became `AM`, worktree size was `24`, and cached blob size was `25`.
- Regression passed on temporary service `http://127.0.0.1:5316`: the same virtual Diff returned `marker_count=1`.
- Hunk staging regression passed: cached blob size stayed `24` and status was `A`.
- Selected-line staging regression passed: cached blob size stayed `24` and status was `A`.
- `node --check server.js` passed.
- Stopped temporary services and deleted the temporary file.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now appends `\ No newline at end of file` to the final virtual hunk for untracked text files that lack a trailing newline.
- `README.md`: documents that hunk and line staging do not add a trailing newline to untracked files.
- `docs/CONTINUE.md`: records the no-trailing-newline virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: avoid corrupting non-UTF-8 untracked files in virtual diffs
### What was done
- Found that Forkline decoded untracked files with `Buffer.toString("utf8")` before building virtual Diff hunks.
- Reproduced that a GBK/ANSI-style file without NUL bytes was displayed with replacement characters and could be staged through hunk actions as corrupted UTF-8 content.
- Added strict UTF-8 decoding for virtual untracked text diffs; files that cannot be decoded safely no longer generate selectable virtual content hunks.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary GBK file `forkline-gbk-untracked-20260701.txt`; before the fix, temporary service `http://127.0.0.1:5317` returned an added line containing replacement characters.
- Confirmed the bad operation before the fix: `stageHunk` returned success, status became `AM`, original file size was `13`, and cached blob size became `29`.
- Regression passed on temporary service `http://127.0.0.1:5318`: the same GBK file returned `gbk_add_count=0`; a forced hunk action left status as `??`.
- Selected-line forced call regression passed: the GBK file stayed untracked and was not added to the index.
- Full-file staging regression passed: `stageFile` still staged the GBK file with cached blob size `13`, preserving original bytes.
- UTF-8 untracked file regression passed: a normal UTF-8 file still staged through `stageHunk` as status `A`.
- `node --check server.js` passed.
- Stopped the temporary service and deleted the temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff` now uses strict UTF-8 decoding and skips virtual content hunks when decoding fails.
- `README.md`: documents that non-UTF-8 untracked files are protected from virtual hunk/line staging corruption.
- `docs/CONTINUE.md`: records the strict UTF-8 virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve UTF-8 BOM bytes in untracked virtual diffs
### What was done
- Found that strict UTF-8 virtual Diff decoding still used TextDecoder's default BOM handling, which removed the UTF-8 BOM from untracked file content.
- Reproduced that hunk staging a BOM-prefixed untracked file silently dropped the first three bytes and left the path in `AM` state.
- Updated strict UTF-8 decoding to keep BOM bytes as content when building virtual Diff hunks.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-bom-untracked-20260701.txt` containing UTF-8 BOM plus `BOM_TEXT`; before the fix, temporary service `http://127.0.0.1:5319` returned first content codepoint `66`, staged hunk status `AM`, original size `11`, and cached blob size `8`.
- Regression passed on temporary service `http://127.0.0.1:5320`: virtual Diff first content codepoint was `65279`, proving the BOM was preserved.
- Hunk staging regression passed: cached blob size stayed `11` and status was `A`.
- Selected-line staging regression passed: cached blob size stayed `11` and status was `A`.
- Non-UTF-8 guard regression passed with temporary GBK file `forkline-gbk-bom-regression-20260701.txt`: `gbk_add_count=0` and forced hunk staging left status `??`.
- `node --check server.js` passed.
- Stopped the temporary service and deleted the temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: strict UTF-8 decoding now uses `ignoreBOM: true` so BOM bytes remain part of virtual Diff content.
- `README.md`: documents that UTF-8 BOM is preserved during untracked virtual hunk/line staging.
- `docs/CONTINUE.md`: records the BOM-preserving virtual Diff behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve CRLF bytes in untracked virtual patches
### What was done
- Found that Forkline normalized CRLF to LF while generating and extracting virtual Diff patches for untracked text files.
- Reproduced that when `.gitattributes` marked a new file as `-text`, hunk staging a CRLF file staged LF content instead of the original CRLF bytes.
- Removed CRLF normalization from virtual Diff generation and patch extraction so carriage returns in file content stay part of the generated patch.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary `.gitattributes` rule `forkline-crlf-raw-20260701.txt -text` and CRLF file `forkline-crlf-raw-20260701.txt`; before the fix, temporary service `http://127.0.0.1:5321` staged hunk status `AM`, original size `12`, and cached blob size `10`.
- First attempted fix only changed patch extraction and still failed on temporary service `http://127.0.0.1:5322`, proving virtual Diff generation was also normalizing CRLF.
- Regression passed on temporary service `http://127.0.0.1:5323`: hunk staging kept cached blob size `12` and status `A`.
- Selected-line staging regression passed: selected-line staging kept cached blob size `12` and status `A`.
- Adjacent regressions passed: UTF-8 LF untracked hunk staging still worked, UTF-8 BOM stayed preserved, and GBK/non-UTF-8 files still produced no virtual add lines.
- `node --check server.js` passed.
- Stopped temporary services and deleted temporary `.gitattributes` and test files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readNewFileDiff`, `extractSingleHunkPatch`, `extractMovedFileUnstageHunkPatch`, and `extractSelectedLinePatch` no longer normalize CRLF to LF while building patches.
- `README.md`: documents that `-text` CRLF untracked files do not lose CR bytes during hunk/line staging.
- `docs/CONTINUE.md`: records the CRLF-preserving virtual patch behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve leading spaces in repository file paths
### What was done
- Found that `normalizeRepoFile` trimmed file paths before using them for worktree Diff and hunk actions.
- Reproduced that a valid Windows file whose name starts with a space lost that leading space in `/api/worktree-diff`, so Forkline showed an empty Diff and hunk staging could not find the file.
- Removed path trimming from repository file normalization while keeping absolute path, NUL byte, and `..` path rejection.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file ` forkline-leading-space-20260701.txt`; before the fix, temporary service `http://127.0.0.1:5326` returned `diff_file_returned=forkline-leading-space-20260701.txt`, `diff_count=0`, and hunk staging failed with “这个文件当前没有可操作的改动。”
- Regression passed on temporary service `http://127.0.0.1:5327`: the same file returned `diff_file_returned= forkline-leading-space-20260701.txt`, `diff_count=6`, `add_count=1`, and hunk staging produced status `A`.
- Normal path regression passed with `forkline-normal-path-regression-20260701.txt`, which still staged as status `A`.
- `node --check server.js` passed.
- Stopped temporary services and deleted the temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `normalizeRepoFile` no longer trims leading or trailing whitespace from repository-relative paths.
- `README.md`: documents that leading spaces in filenames are preserved.
- `docs/CONTINUE.md`: records the leading-space path behavior for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: block encoded backslash traversal in static file serving
### What was done
- Found that the local static file server checked `filePath.startsWith(PUBLIC_DIR)` after joining and normalizing the requested path.
- Reproduced that on Windows an encoded backslash traversal URL could read a file next to `public/`.
- Changed static serving to resolve both the public root and requested file to absolute paths, then require the target to equal the public root or start with the public root plus a path separator.
### Testing
- Reproduced with temporary file `public-leak-20260701.txt` containing `FORKLINE_STATIC_LEAK_20260701`: before the fix, temporary service `http://127.0.0.1:5328/%2e%2e%5cpublic-leak-20260701.txt` returned `200` and the file body.
- Regression passed on temporary service `http://127.0.0.1:5329`: the same traversal URL returned `403`, while `http://127.0.0.1:5329/` returned `200` and contained `Forkline`.
- `node --check server.js` passed.
- Stopped the temporary service and removed the temporary leak file.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `serveStatic` now checks static file paths with resolved absolute paths and a path-separator boundary.
- `README.md`: documents that static serving is restricted to `public/` and traversal requests return `403`.
- `docs/CONTINUE.md`: records the static path boundary hardening for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep plus-prefixed diff content selectable
### What was done
- Found that Forkline's Diff parser treated every line beginning with `+++` or `---` as metadata.
- Reproduced that an untracked file containing a real added line `++PLUS_PREFIX_SHOULD_BE_ADD` returned that Diff row as `meta` instead of `add`, leaving it unavailable for line selection.
- Changed Diff parsing so file headers are detected outside hunks, while lines inside hunks are classified first by their real Diff prefix.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary file `forkline-plus-prefix-20260701.txt`; before the fix, `/api/worktree-diff?scope=unstaged` returned scope `untracked`, but the row `+++PLUS_PREFIX_SHOULD_BE_ADD` was classified as `meta` and only one line was selectable as `add`.
- Regression passed on temporary service `http://127.0.0.1:5335`: the same row was classified as `add`, `hunkIndex = 0`, selectable add line count became `2`, and `stageSelectedLines` staged only `++PLUS_PREFIX_SHOULD_BE_ADD` into the index.
- Regression passed on temporary service `http://127.0.0.1:5336`: a staged new file with the worktree line `--MINUS_PREFIX_SHOULD_BE_DEL` removed returned the Diff row `---MINUS_PREFIX_SHOULD_BE_DEL` as `del`, `hunkIndex = 0`, with one selectable delete line.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `parseDiff` now gives hunk content lines priority over file-header metadata patterns.
- `README.md`: documents that content lines producing `+++...` / `---...` Diff text remain selectable.
- `docs/CONTINUE.md`: records the Diff line classification fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve spaces in submodule status paths
### What was done
- Found that Forkline parsed `git submodule status --recursive` by splitting the status line on whitespace.
- Reproduced that a configured submodule at `forkline-fixtures/submodule space 20260701` appeared as two records: the real configured path stuck at `configured`, plus a fake truncated path `forkline-fixtures/submodule` marked `ok`.
- Updated submodule status parsing to use paths already read from `.gitmodules` as known path boundaries before falling back to whitespace parsing.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary local submodule source `C:\tmp\forkline-submodule-space-source-20260701` and submodule path `forkline-fixtures/submodule space 20260701`; before the fix, Forkline API returned two submodules, including bogus path `forkline-fixtures/submodule`.
- Regression passed on temporary service `http://127.0.0.1:5338`: Forkline API returned exactly one submodule with path `forkline-fixtures/submodule space 20260701`, `status = ok`, `statusLabel = 已就绪`, `exists = true`, and `initialized = true`.
- Cleaned the temporary submodule, `.gitmodules` changes, gitlink, `.git/modules` metadata, and temporary source repository.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `parseSubmoduleStatusLine` now accepts configured submodule paths and matches the longest known path before using whitespace fallback parsing.
- `README.md`: documents that submodule paths containing spaces merge with their status correctly.
- `docs/CONTINUE.md`: records the submodule path parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve leading spaces in submodule paths
### What was done
- Found that Forkline read `.gitmodules` with plain `git config --get-regexp` text output and trimmed config values.
- Reproduced that a submodule path starting with a space, ` leading-submodule-20260701`, was displayed as `leading-submodule-20260701` and marked `exists = false` even though the real submodule directory existed.
- Switched `.gitmodules` reads to `git config -z` and added NUL-record parsing so path values keep leading spaces; status parsing now keeps the path tail's leading space for configured-path matching.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary local submodule source `C:\tmp\forkline-submodule-leading-space-source-20260701` and submodule path ` leading-submodule-20260701`; before the fix, Forkline API returned path `leading-submodule-20260701`, `status = ok`, but `exists = false` and `initialized = false`.
- Regression passed on temporary service `http://127.0.0.1:5340`: Forkline API returned exactly one submodule with path ` leading-submodule-20260701`, `status = ok`, `statusLabel = 已就绪`, `exists = true`, and `initialized = true`.
- Cleaned the temporary submodule, `.gitmodules` changes, gitlink, `.git/modules` metadata, and temporary source repository.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `.gitmodules` reads now use `submoduleConfigArgs()` with `git config -z`, and `parseSubmoduleConfigEntries` preserves path leading spaces.
- `README.md`: documents that submodule paths with leading spaces are preserved.
- `docs/CONTINUE.md`: records the leading-space submodule path parsing fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep leading-space submodule paths during single update
### What was done
- Found that after preserving leading spaces in the submodule list, the single-submodule update action still trimmed `body.path`.
- Reproduced that Forkline listed ` leading-update-submodule-20260701`, but calling `updateSubmodules` for that listed path failed with “子模块不存在：leading-update-submodule-20260701”.
- Removed trimming from the single-submodule update path so the Git pathspec receives the exact configured submodule path.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary local submodule source `C:\tmp\forkline-submodule-update-leading-space-source-20260701` and submodule path ` leading-update-submodule-20260701`; before the fix, the update action failed after trimming the path.
- Regression passed on temporary service `http://127.0.0.1:5342`: `updateSubmodules` with path ` leading-update-submodule-20260701` returned `已更新 leading-update-submodule-20260701`, and the returned state kept path ` leading-update-submodule-20260701`, `exists = true`, `initialized = true`.
- Cleaned the temporary submodule, `.gitmodules` changes, gitlink, `.git/modules` metadata, and temporary source repository.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `updateSubmodules` now preserves the exact `body.path` string instead of trimming it.
- `README.md`: documents that single-submodule update path arguments preserve leading spaces.
- `docs/CONTINUE.md`: records the single-submodule update path fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: avoid prefix collisions when selecting a file diff
### What was done
- Found that the front-end `diffForFile` helper matched diff blocks with string `includes`.
- Reproduced that when one commit changed both `dir a/foo.txt` and `foo.txt`, selecting `foo.txt` matched the earlier `dir a/foo.txt` block and showed the wrong file's content.
- Changed diff block matching to extract candidate paths from `diff --git`, `---/+++`, `rename from/to`, and `copy from/to` lines, then compare paths exactly.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary commit `Forkline diff path match repro 20260701` adding `dir a/foo.txt` and `foo.txt`; before the fix, the same matching logic selected header `diff --git a/dir a/foo.txt b/dir a/foo.txt` and add line `+nested misleading diff` for target `foo.txt`.
- Regression passed on temporary service `http://127.0.0.1:5346`: selecting target `foo.txt` matched header `diff --git a/foo.txt b/foo.txt` and add line `+root target diff`.
- Rolled back the temporary commit with `git reset --hard HEAD~1` and cleaned temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `public/js/features/diff-workbench.js`: `diffBlockMatchesFile` now uses exact path candidates instead of substring matching.
- `README.md`: documents that single-file history/sync/compare diffs avoid prefix path collisions.
- `docs/CONTINUE.md`: records the exact diff path matching fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/diff-workbench.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: show file changes for merge commit details
### What was done
- Found that Forkline's commit detail endpoint used plain `git show` for merge commits.
- Reproduced that a two-parent no-ff merge commit bringing in `forkline-merge-diff-20260701.txt` returned `filesCount = 0` and `diffCount = 0`, so the UI would show no merge commit changes.
- Updated `readCommit` to detect multi-parent commits and build the file list and Diff with `git diff <first-parent> <merge-commit>`.
### Testing
- Reproduced on `D:\桌面\GitTest` with temporary branch `forkline/merge-diff-repro-20260701` and a no-ff merge into `123`; before the fix, `/api/commit?sha=<merge>` returned no files and no Diff.
- Regression passed on temporary service `http://127.0.0.1:5351`: the merge commit returned `filesCount = 1`, `diffCount = 7`, file `forkline-merge-diff-20260701.txt`, and add line `+merge diff content`.
- Rolled back the temporary merge commit, deleted the temporary branch, and cleaned temporary files.
- Confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `readCommit` now compares merge commits against their first parent for commit detail files and Diff.
- `README.md`: documents that merge commit details show changes introduced relative to the first parent.
- `docs/CONTINUE.md`: records the merge commit detail Diff fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: open file-history commits outside the graph
### What was done
- Fixed file history actions so commits returned by `git log --follow` can open in the right details panel even when they are not present in the currently loaded commit graph.
- The graph render now preserves a selected file-history commit that is outside the graph, and the inspector can use the file-history record as a temporary commit summary while `/api/commit` loads the real file list and Diff.
- Updated the README and continuation notes for this file history behavior.
### Testing
- Forkline API on `http://127.0.0.1:5281` opened `D:\桌面\GitTest` on branch `123`; `/api/state?ref=123` returned 12 graph commits, while `/api/file-history?file=配置文件3.txt&ref=123` returned 5 file-history commits, including 2 commits missing from the graph.
- Verified `/api/commit` for graph-missing commit `7dd4c624dd9bbee6615e7cd2910805f5bdf90307` returned 1 changed file, 10 Diff lines, and message `移除功能`.
- HTTP static resource check confirmed latest `history-list.js` contains `selectedLoadedInGraph`, and latest `inspector.js` contains `commitRecordForSha` plus `openHistoryCommit`.
- `node --check public\js\features\history-list.js` passed.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
### Notes
- `public/js/features/history-list.js`: avoids forcing a graph-missing file-history commit back to the first visible graph commit during graph rerender.
- `public/js/panels/inspector.js`: adds a temporary detail source for file-history commits and lets "查看提交 / 文件改动" open graph-missing commits by SHA.
- `README.md`: documents that file-history commits outside the current graph can still open in the right details panel.
- `docs/CONTINUE.md`: records the file-history jump fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/history-list.js`, `public/js/panels/inspector.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: open file-blame commits outside the graph
### What was done
- Found that the file blame row action still required the clicked commit to exist in the currently loaded commit graph.
- Reproduced with `D:\桌面\GitTest`: `.gitignore` blame contains commit `9e97a7e46d993e6f47d4ec8db9201685e0f2d85c`, while the current `123` first-parent graph does not include that SHA.
- Extended the inspector commit fallback so blame rows can supply a temporary commit summary, then open the real commit detail by SHA.
### Testing
- Scanned `D:\桌面\GitTest` on branch `123` and confirmed `.gitignore` has a blame line from graph-missing commit `9e97a7e`.
- Verified the latest static `inspector.js` contains the blame fallback path and routes blame row clicks through `openHistoryCommit`.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/panels/inspector.js`: file blame rows now use the shared graph-missing commit fallback instead of failing when the SHA is not in `state.data.commits`.
- `README.md`: documents that blame-line commits outside the current graph can still open in the right details panel.
- `docs/CONTINUE.md`: records the file-blame jump fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/panels/inspector.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep graph-missing commit tools working
### What was done
- Found that graph-missing commits opened from file history or file blame could render in the right details panel, but commit tools still looked up commits only in `state.data.commits`.
- Updated commit tool actions and the reword form to resolve commits through the shared `commitRecordForSha` fallback before acting.
- Updated the README and continuation notes so the documented file history / blame behavior covers opening details and using the existing commit tools.
### Testing
- Front-end function harness loaded `inspector.js`, `commit-actions.js`, and `git-actions.js` with an empty graph commit list plus one file-history commit; `runCommitToolAction("copyPatch", sha)` copied a patch for the graph-missing SHA, and `rewordSelectedCommit` sent `rewordCommit` for the same graph-missing SHA.
- This covers the previous failure mode where both paths returned before reaching the action because the SHA was not in `state.data.commits`.
- `node --check public\js\features\commit-actions.js` passed.
- `node --check public\js\features\git-actions.js` passed.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/features/commit-actions.js`: commit context/tool/history-plan actions now resolve graph-missing commits through `commitRecordForSha`.
- `public/js/features/git-actions.js`: the commit message reword form now uses the same fallback and avoids negative-index reselection after reload.
- `README.md`: clarifies that file history and blame commits outside the current graph can still use commit actions.
- `docs/CONTINUE.md`: records the graph-missing commit tool fix for follow-up development.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/commit-actions.js`, `public/js/features/git-actions.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep graph-missing branch starts exact
### What was done
- Found that "新建分支" from a graph-missing commit could open the branch modal but then resolve the start commit only from `state.data.commits`.
- Fixed the branch modal to use `commitRecordForSha`, so graph-missing commits opened from file history or blame keep their SHA as the branch start.
- Updated the command palette selected-commit helper to use the same fallback, keeping the "新建分支" hint aligned with the actual start commit.
### Testing
- Front-end function harness loaded `inspector.js`, `branches.js`, and `folder-command.js` with an empty graph commit list plus one file-history commit; `openBranchModal()` set `state.branchStartSha` to `7dd4c624dd9bbee6615e7cd2910805f5bdf90307` and rendered text for `7dd4c62`.
- The same harness verified `selectedCommandCommit()` returns the graph-missing file-history commit instead of falling back to the first graph commit or HEAD.
- `node --check public\js\features\branches.js` passed.
- `node --check public\js\features\folder-command.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/features/branches.js`: branch creation modal now resolves graph-missing selected commits through `commitRecordForSha`.
- `public/js/features/folder-command.js`: command palette branch hint now uses the same selected commit fallback.
- `docs/CONTINUE.md`: records the graph-missing branch start fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/branches.js`, `public/js/features/folder-command.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: keep graph-missing merge mainline submit working
### What was done
- Found that graph-missing merge commits could open the cherry-pick/revert mainline modal, but submitting the modal looked up the commit only in `state.data.commits`.
- Updated mainline submission to resolve the commit through `commitRecordForSha`, matching the modal open path and other graph-missing commit tools.
### Testing
- Front-end function harness loaded `inspector.js` and `commit-actions.js` with an empty graph commit list plus one file-history merge commit; `submitMainlineForm()` sent `revertCommit` for the graph-missing merge SHA with `mainline = 2`.
- This covers the previous failure mode where the same submit path saw no commit and only showed “请选择主线”.
- `node --check public\js\features\commit-actions.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/features/commit-actions.js`: mainline modal submit now uses the same graph-missing commit fallback as the rest of the commit tool path.
- `docs/CONTINUE.md`: records the graph-missing merge mainline submit fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/features/commit-actions.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: return metadata for graph-missing commit details
### What was done
- Found that `/api/commit` returned only `files`, `diff`, and full `message`.
- Reproduced with `D:\桌面\GitTest`: graph-missing blame commit `9e97a7e46d993e6f47d4ec8db9201685e0f2d85c` has real parent `1d2f5d6a8fa9c781ce69cf443ee895100c7d732b`, but the API response had no `parents`, so the right details panel could present it as a root commit.
- Added basic commit metadata to `/api/commit` and kept full message separate from the summary used by temporary graph-missing commit records.
### Testing
- Current API before the fix returned keys `diff,files,message` for `9e97a7e`, while `git rev-list --parents -n 1` showed a real parent.
- After the fix, `/api/commit?sha=9e97a7e...` returned parent metadata and summary while preserving the full message field.
- `node --check server.js` passed.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `readCommit` now returns `sha`, `short`, `author`, `time`, `parents`, and `summary` alongside files, diff, and full message.
- `public/js/panels/inspector.js`: graph-missing file-history/blame commit records merge loaded metadata without replacing their one-line title with the full commit body.
- `docs/CONTINUE.md`: records the graph-missing commit metadata fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `public/js/panels/inspector.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: clear stale file selection for empty commits
### What was done
- Found that the commit files tab preserved `state.selectedCommitFile` when the selected commit had no changed files.
- Reproduced with a front-end harness: rendering an empty commit after `old.txt` was selected kept `old.txt` selected and rendered the old file path into the history workbench.
- Updated the files tab to clear the selected commit file when `detail.files` is empty, and to render the bottom diff area as an explicit empty commit state.
### Testing
- Front-end harness passed: `renderFilesTab()` for an empty commit clears `state.selectedCommitFile`, does not call stale `diffForFile` / `renderHistoryDiffInWorkbench`, and sends “这个提交没有文件改动” to the workbench.
- Real GitTest repro passed: temporary branch `forkline/empty-commit-repro-*` created an `--allow-empty` commit; `/api/commit?sha=<empty>` returned `files=0`, `diff=0`, and the empty commit message. The temporary branch was deleted and GitTest returned to `123`.
- `node --check public\js\panels\inspector.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `public/js/panels/inspector.js`: empty commit file tabs now clear stale file selection and show an explicit empty workbench message.
- `docs/CONTINUE.md`: records the empty commit file-tab fix.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `public/js/panels/inspector.js`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve selected non-final line endings in untracked line staging
### What was done
- Found that an untracked text file without a trailing newline could lose the selected line's real newline when only a non-final line was staged.
- Reproduced with `D:\桌面\GitTest`: staging only `alpha` from `alpha\nbeta` produced a staged blob size of `5`, meaning the staged content became `alpha` instead of `alpha\n`.
- Updated selected-line patch generation so `\ No newline at end of file` metadata is kept only when the previous diff line is actually included in the generated patch.
### Testing
- Before the fix, Forkline `stageSelectedLines` on `forkline-fixtures/no-newline-line-stage-20260701.txt` staged only the first line with blob size `5`.
- After the fix, the same API flow staged the first line with blob size `6`, preserving `alpha\n`.
- Verified the true final line still stays without a trailing newline: staging only `beta` produced blob size `4`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Cleaned the temporary file and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: selected-line patch generation now skips stale no-newline metadata when the line it belonged to was omitted from the patch.
- `README.md`: documents the non-final line no-newline boundary.
- `docs/CONTINUE.md`: records the same worktree Diff boundary for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: return all Git worktrees
### What was done
- Found that Forkline silently returned only the first 24 worktrees from `git worktree list --porcelain`.
- Reproduced with `D:\桌面\GitTest` by creating 25 temporary detached worktrees under `C:\tmp\forkline-wt-limit-20260701`: raw Git listed 26 worktrees including the main worktree, but `/api/state` returned only 24 and ended at `wt-23`.
- Removed the backend slice so worktree enrichment keeps every parsed worktree row.
### Testing
- Before the fix, `/api/state` returned `API_WORKTREE_COUNT=24` while raw Git returned `RAW_WORKTREE_COUNT=26`.
- After the fix, the same repository returned `API_WORKTREE_COUNT=26`, with the last API row at `C:/tmp/forkline-wt-limit-20260701/wt-25`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Removed all 25 temporary worktrees, deleted the temporary directory, and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `enrichWorktreeList` now enriches all parsed worktree rows instead of slicing to the first 24.
- `README.md`: documents that large worktree lists are not silently truncated.
- `docs/CONTINUE.md`: records the worktree list limit fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: return all configured submodules
### What was done
- Found that Forkline silently returned only the first 80 configured submodules from `.gitmodules`.
- Reproduced with `D:\桌面\GitTest` by creating a temporary `.gitmodules` containing 81 configured submodule paths; before the fix, `/api/state` returned 80 submodules and ended at `forkline-fixtures/submodule-limit-080`.
- Removed the backend slice so submodule enrichment keeps every parsed submodule row.
### Testing
- Before the fix, `CONFIG_SUBMODULE_PATHS=81` but `API_SUBMODULE_COUNT=80` and `HAS_081=False`.
- After the fix, the same temporary configuration returned `API_SUBMODULE_COUNT=81`, `LAST_API=forkline-fixtures/submodule-limit-081`, and `HAS_081=True`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Removed the temporary `.gitmodules` file and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `enrichSubmodules` now enriches all parsed submodule rows instead of slicing to the first 80.
- `README.md`: documents that large submodule lists are not silently truncated.
- `docs/CONTINUE.md`: records the submodule list limit fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve tabs in Tag subjects
### What was done
- Found that Forkline parsed Tag metadata with a plain tab split, so an annotated Tag subject containing a tab shifted the object type field.
- Reproduced with `D:\桌面\GitTest`: temporary Tag `forkline-tab-subject-20260701` had raw subject `subject\tpart`, but `/api/state` returned `subject = subject` and `type = part`.
- Updated Tag parsing so the first fields stay fixed, the last field remains the object type, and any middle fields are joined back into the subject.
### Testing
- Before the fix, the temporary Tag returned `SUBJECT_MATCH=False` and `TYPE_MATCH=False`.
- After the fix, the same Tag returned `API_SUBJECT=subject\tpart`, `API_TYPE=tag`, `SUBJECT_MATCH=True`, and `TYPE_MATCH=True`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Deleted the temporary Tag and confirmed `D:\桌面\GitTest` stayed on branch `123` with a clean worktree.
### Notes
- `server.js`: `parseTags` now preserves tabs inside Tag subjects without shifting the object type field.
- `README.md`: documents the Tab-in-subject Tag parsing boundary.
- `docs/CONTINUE.md`: records the Tag subject parsing fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-01 - Task: preserve tabs in recovery point subjects
### What was done
- Found that Forkline parsed recovery point metadata with a plain tab split, so a recovery point whose target commit subject contained a tab lost everything after that tab.
- Reproduced with `D:\桌面\GitTest`: temporary recovery ref `refs/forkline/recovery/20260701-999999/forkline_tab_subject/recovery-tab-test` pointed at a commit titled `recovery\tpart`, but `/api/state` returned `subject = recovery`.
- Updated recovery point parsing so all fields after the short SHA are joined back into the subject.
### Testing
- Before the fix, the temporary recovery point returned `API_SUBJECT=recovery` and `SUBJECT_MATCH=False`.
- After the fix, the same recovery point returned `API_SUBJECT=recovery\tpart` and `SUBJECT_MATCH=True`.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Deleted the temporary recovery ref, deleted the temporary branch, and confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: `parseRecoveryPoints` now preserves tabs inside recovery point subjects.
- `README.md`: documents that recovery point search keeps Tab-containing commit subjects intact.
- `docs/CONTINUE.md`: records the recovery point subject parsing fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.

## 2026-07-02 - Task: preserve control separators in commit subjects
### What was done
- Found that Forkline used `0x1f` as the internal Git log field separator for commit graph, file history, compare preview, history rewrite previews, and sync commit previews.
- Reproduced with `D:\桌面\GitTest`: temporary branch `forkline/unit-separator-subject-20260701` contained a commit titled `unit\x1fsep`; before the fix, `/api/state` returned `message = unit`, `refs = sep`, and a bogus parent count of 3.
- Changed commit log field separation to NUL-delimited formatting and updated the shared commit parsers to split on that delimiter.
### Testing
- After the fix, `/api/state` for the same commit returned the full `message = unit\x1fsep`, `refs = HEAD -> forkline/unit-separator-subject-20260701`, and `parents.length = 1`.
- `/api/commit?sha=<temporary commit>` returned `summary = unit\x1fsep`.
- `/api/file-history?file=forkline-fixtures/unit-separator-subject-20260701.txt&ref=forkline/unit-separator-subject-20260701` returned the same full message.
- `node --check server.js` passed.
- `git diff --check` passed; Git only reported Windows LF-to-CRLF working-copy warnings.
- Deleted the temporary branch and test file, and confirmed `D:\桌面\GitTest` returned to branch `123` with a clean worktree.
### Notes
- `server.js`: commit log formatting now uses NUL field separators for commit graph, file history, compare preview, history rewrite previews, and sync commit previews.
- `README.md`: documents that special commit-title separators no longer break graph parsing.
- `docs/CONTINUE.md`: records the commit subject separator parsing fix for future continuation.
- `progress.md`: appended this implementation and verification record.
- Rollback: revert this task's edits in `server.js`, `README.md`, `docs/CONTINUE.md`, and `progress.md`, or revert the commit created for this task after it is committed.
## 2026-07-02 - Task: 修复储藏列表和引用日志内部控制分隔符解析错位
### What was done
- 复现并修复 HEAD reflog 说明里包含内部控制分隔符时的解析错位：之前会把提交标题后半段误当作者，把作者误当时间。
- 将 reflog 和 stash 列表的 Git 输出字段分隔符从 `0x1f` 改为 NUL，避免用户提交标题或储藏说明中的控制字符冲断字段。
- 同步 README 和继续开发文档，说明储藏列表、引用日志在异常说明文本下不会错位。

### Testing
- `node --check server.js` 通过。
- `git diff --check` 通过；仅提示 Windows 工作区 LF 将被 CRLF 替换。
- 在 `D:\桌面\GitTest` 临时分支 `forkline/reflog-separator-20260702` 创建标题为 `forkline-reflog\x1fsubject` 的空提交；修复前 `/api/state` 的首条 reflog 显示 `message = commit: forkline-reflog`、`author = subject`、`time = Forkline Tester`，确认 bug 可复现。
- 修复后用临时服务 `http://127.0.0.1:5293` 打开 GitTest，`/api/state` 的首条 reflog 返回 `message = commit: forkline-reflog\x1fsubject`、`author = Forkline Tester`、`time = 2026-07-02 10:16:43`。
- 用 Git 索引临时加入 `forkline-fixtures/stash-separator-index-20260702.txt` 并创建说明为 `forkline-stash\x1fsubject` 的临时 stash；`/api/state` 的 `stashes[0].message` 保留完整说明，`time` 仍为正常相对时间。
- 调用 `/api/action` 的 `findCheckoutStash`，使用同一条 `forkline-stash\x1fsubject` 能正确找到 `stash@{0}`。
- 已删除临时 stash、切回 `123` 并删除临时分支；`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：将 stash 列表、签出储藏查找、reflog 读取和对应解析统一改为 NUL 字段分隔。
- `README.md`：补充储藏列表和引用日志对内部控制分隔符的可靠性说明。
- `docs/CONTINUE.md`：补充本轮解析边界修复与验证背景，便于后续继续排查同类问题。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复同秒同类恢复点被覆盖
### What was done
- 复现并修复恢复点 ref 只由秒级时间、分支和动作组成导致的覆盖问题：同一秒内连续执行两次同类危险操作时，第二个恢复点会覆盖第一个。
- 恢复点创建改为只在 ref 不存在时写入；若同秒同分支同动作已存在，则使用同级后缀 `-2`、`-3` 等继续创建，保留所有恢复点。
- 恢复点解析会把 `reset-hard-2` 这类后缀识别回原动作 `reset-hard`，右侧标签仍显示“硬重置前”。
- 同步 README 和继续开发文档，说明同秒连续危险操作不会覆盖更早恢复点。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/recovery-collision-20260702` 创建 A/B/C 三个空提交。
- 修复前用临时服务 `http://127.0.0.1:5300` 连续调用两次 `resetToCommit` hard：先从 C 重置到 B，再从 B 重置到 A。两次响应都返回同一个恢复点 ref `.../reset-hard`，第二次把 ref 从 `eca5c5f` 覆盖为 `b839200`，最终只剩 1 个恢复点。
- 修复后用临时服务 `http://127.0.0.1:5302` 重复同样两次 reset，响应分别返回 `.../reset-hard`（`eca5c5f`）和 `.../reset-hard-2`（`b839200`），`for-each-ref refs/forkline/recovery` 同时列出两条恢复点。
- `/api/state` 返回两条恢复点的 `action = reset-hard`、`actionLabel = 硬重置前`，证明带后缀的恢复点仍按原动作显示。
- `node --check server.js` 通过。
- 已删除测试恢复点、切回 `123` 并删除临时分支；`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`refs/forkline/recovery` 为空。

### Notes
- `server.js`：新增恢复点唯一创建逻辑，同秒冲突时使用同级后缀，且解析动作时忽略数字后缀。
- `README.md`：补充同秒同类危险操作会保留多个恢复点。
- `docs/CONTINUE.md`：记录恢复点同秒覆盖修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 拦截修改旧提交信息时跨 merge 重放导致拓扑被展平
### What was done
- 复现并修复单个“修改提交信息”执行入口缺少 merge 范围检查的问题：目标提交本身不是 merge，但它后面的重放范围包含 merge 时，旧代码会直接执行 `git rebase -i` 并把 merge 拓扑展平成单父历史。
- 给 `rewordCommit` 增加与历史编辑预检一致的线性范围检查；修改 HEAD 提交仍走 amend，不受影响。
- 同步 README 和继续开发文档，说明修改旧提交信息会拦截包含 merge 的重放范围。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/reword-merge-range-20260702` 构造 `A -> B -> merge(side)`，目标 A 为非 merge 提交，`A^..HEAD` 内有 1 个 merge。
- 修复前用临时服务 `http://127.0.0.1:5297` 调用 `/api/action` 的 `rewordCommit` 修改 A，API 返回成功；随后 HEAD 从双父 merge 变成单父提交，全仓库 merge 数从 4 变成 3，确认拓扑被展平。
- 修复后重新构造同样历史，用临时服务 `http://127.0.0.1:5298` 调用相同 `rewordCommit`，API 返回中文错误“这段历史里包含 merge 提交 34df391...”，HEAD 仍为双父 merge，`A^..HEAD` 内 merge 数仍为 1。
- `node --check server.js` 通过。
- 已删除临时恢复点、临时分支 `forkline/reword-merge-range-20260702` / `forkline/reword-merge-side-20260702`，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`refs/forkline/recovery` 为空。

### Notes
- `server.js`：`rewordCommit` 在非 HEAD 目标上执行前调用 `ensureLinearRewriteRange`，阻止跨 merge 的普通 rebase reword。
- `README.md`：补充修改旧提交信息会保护分支拓扑。
- `docs/CONTINUE.md`：记录单个 reword 执行入口的 merge 范围保护。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复文件历史提交标题内部记录分隔符导致记录丢失
### What was done
- 复现并修复文件历史解析中使用 `0x1e` 分隔提交记录的问题：当提交标题本身包含该控制字符时，`/api/file-history` 会把一条提交拆成两段并丢弃。
- 将文件历史解析改为逐行识别提交头行，不再依赖可能出现在提交标题中的记录分隔符。
- 同步 README 和继续开发文档，说明文件历史不会因为提交标题中的内部记录分隔符漏掉提交。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/file-history-separator-20260702` 创建提交 `82df96e`，标题为 `forkline-file-history\x1esubject`，并修改 `.gitignore`。
- 修复前临时服务 `http://127.0.0.1:5294` 打开 GitTest 后，请求 `/api/file-history?file=.gitignore` 只返回更早的 `9e97a7e`、`6db540c`，没有最新的 `82df96e`。
- 修复后临时服务 `http://127.0.0.1:5295` 打开 GitTest 后，同一请求首条返回 `82df96e`，`message = forkline-file-history\x1esubject`，文件状态为 `M .gitignore`。
- `node --check server.js` 通过。
- 已恢复 `.gitignore` 工作区内容、切回 `123`、删除临时分支；`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：文件历史 `git log` 输出不再注入 `0x1e` 记录分隔符，`parseFileHistoryLog` 改为按提交头行收集文件状态行。
- `README.md`：补充文件历史对内部记录分隔符的可靠性说明。
- `docs/CONTINUE.md`：记录文件历史解析边界修复，便于后续继续查同类问题。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支同步操作误报游离 HEAD
### What was done
- 复现并修复当前分支还没有首个提交时，推送入口把本地分支误判为游离 HEAD 的问题。
- 同步状态新增 `unborn` 标记，右侧同步页、命令面板和分支右键菜单会阻止普通推送 / 安全强推，并提示先创建首个提交。
- 快进拉取入口补充 upstream 预检，直接 API 调用时也返回中文原因，不再透出 Git 英文提示。
- 同步 README 和继续开发文档，说明无提交分支的同步保护行为。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-push-20260702` 复现；修复前 `/api/state` 没有 `unborn` 标记，调用 `/api/action push` 返回“当前处于游离 HEAD”。
- 修复后重启临时服务 `http://127.0.0.1:5291`，打开 GitTest 后 `/api/state` 返回 `sync.branch = forkline/unborn-push-20260702`、`detached = false`、`unborn = true`。
- 修复后调用 `/api/action push` 返回“当前分支 forkline/unborn-push-20260702 还没有任何提交，不能推送”；调用 `/api/action forcePushLease` 返回“还没有任何提交，不能强推”；调用 `/api/action pull` 返回“当前分支没有 upstream，不能拉取”。
- `node --check server.js`、`node --check public\js\panels\sync.js`、`node --check public\js\features\context-menus.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\features\folder-command.js` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：推送 / 安全强推改用真实分支名判断，新增 HEAD commit 检查、同步 `unborn` 状态和拉取 upstream 预检，并补充 refspec 失败中文兜底。
- `public/js/panels/sync.js`：同步页显示“还没有首个提交”，并禁用普通推送入口。
- `public/js/features/context-menus.js`：当前分支右键菜单在无提交分支上禁用安全强推。
- `public/js/features/git-actions.js`：推送和安全强推确认文案加入无提交分支的下一步提示。
- `public/js/features/folder-command.js`：命令面板按同步状态禁用拉取、推送和安全强推。
- `README.md`：补充无提交分支需要先创建首个提交后再推送。
- `docs/CONTINUE.md`：记录无提交分支同步保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/panels/sync.js public/js/features/context-menus.js public/js/features/git-actions.js public/js/features/folder-command.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支设置 upstream 透出英文错误
### What was done
- 复现并修复当前分支还没有首个提交时，点击“设置 upstream”会透出 Git 英文错误的问题。
- 后端在执行 `git branch --set-upstream-to` 前检查 `unborn` 状态，返回中文“先创建首个提交”。
- 同步页和远端分支右键菜单在无提交分支上禁用设置 upstream，避免界面给出不可执行入口。
- README 和继续开发文档同步说明：设置 upstream 需要当前本地分支已有提交。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-upstream-20260702` 复现；修复前调用 `/api/action setUpstream` 到 `origin/123` 返回英文 `fatal: no commit on branch ... yet`。
- 修复后重启临时服务 `http://127.0.0.1:5292`，同一请求返回中文“当前分支 forkline/unborn-upstream-20260702 还没有任何提交，不能设置 upstream。请先创建首个提交后再设置。”。
- `node --check server.js`、`node --check public\js\panels\sync.js`、`node --check public\js\features\context-menus.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`setCurrentBranchUpstream` 增加无提交分支中文拦截，并为 `no commit on branch` 增加通用中文兜底。
- `public/js/panels/sync.js`：无提交分支上禁用同步页 upstream 设置控件。
- `public/js/features/context-menus.js`：远端分支右键菜单在当前分支无提交时禁用“设为 upstream”。
- `README.md`：说明设置 upstream 需要当前本地分支已有提交。
- `docs/CONTINUE.md`：补充无提交分支同步保护覆盖设置 upstream。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/panels/sync.js public/js/features/context-menus.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支合并和变基错误提示
### What was done
- 复现并修复当前分支还没有首个提交时，合并分支透出 `empty head` 英文错误、变基误报“游离 HEAD”的问题。
- 后端 `mergeRef` / `rebaseOntoRef` 改用真实当前分支判断，并在无提交分支上返回中文“先创建首个提交”。
- 分支右键菜单在当前分支无提交时禁用“合并分支”和“变基当前分支到此分支”，避免给出不可执行入口。
- README 和继续开发文档同步说明无提交分支会先阻止合并和变基。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-branch-actions-20260702` 复现；修复前 `/api/action mergeRef` 到 `origin/123` 返回英文 `fatal: Non-fast-forward commit does not make sense into an empty head`，`/api/action rebaseOntoRef` 返回误导性的“当前处于游离 HEAD”。
- 修复后重启临时服务 `http://127.0.0.1:5293`，同样请求 `mergeRef` 返回“当前分支 forkline/unborn-branch-actions-20260702 还没有任何提交，不能合并分支”，`rebaseOntoRef` 返回“还没有任何提交，不能变基”。
- `node --check server.js`、`node --check public\js\features\context-menus.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`mergeRef` / `rebaseOntoRef` 使用 `currentLocalBranch` 和 `hasHeadCommit` 进行无提交分支中文拦截，并为 `empty head` 增加通用中文兜底。
- `public/js/features/context-menus.js`：当前分支无提交时禁用合并和变基目标菜单项。
- `README.md`：说明当前分支没有首个提交时会先阻止合并和变基。
- `docs/CONTINUE.md`：记录无提交分支合并 / 变基保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/features/context-menus.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-02 - Task: 修复无提交分支新建分支和比较边界提示
### What was done
- 复现并修复当前分支还没有首个提交时，新建分支取消“创建后切换”会透出 `not a valid object name` 英文错误的问题。
- 后端在无提交分支上拒绝“不切换”的新建分支，并提示勾选“创建后切换”或从已有提交/分支创建。
- 分支弹窗在无提交分支上固定勾选并禁用“创建后切换”，避免界面给出不可执行选项。
- 比较接口在默认基准落到当前无提交分支时返回明确中文提示；手动选择两个已有提交引用仍可正常比较。
- README 和继续开发文档同步说明无提交分支的新建分支和比较限制。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-compare-branch-20260702`，并通过 `createBranch checkout=true` 进入 `forkline/unborn-created-checkout-20260702` 复现无提交分支状态。
- 修复前调用 `/api/action createBranch`，`checkout=false`，返回英文 `fatal: not a valid object name: 'forkline/unborn-compare-branch-20260702'`。
- 修复后重启临时服务 `http://127.0.0.1:5294`，同类 `checkout=false` 请求返回中文“当前分支还没有任何提交，不能创建不切换的新分支。请勾选‘创建后切换’，或从已有提交/分支创建。”。
- 修复后请求 `/api/compare?head=origin/123` 返回中文“当前分支 ... 还没有任何提交，不能作为比较基准”；请求 `/api/compare?base=origin/123&head=origin/main` 成功返回 `ok=true` 和 `git diff origin/123...origin/main`。
- `node --check server.js`、`node --check public\js\features\branches.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`readCompare` 在当前无提交分支参与比较时给出中文原因；`createBranch` 在无起点、无提交且不切换时提前中文拦截；补充 `not a valid object name` 中文兜底。
- `public/js/features/branches.js`：无提交分支打开新建分支弹窗时固定勾选并禁用“创建后切换”，并显示对应说明。
- `README.md`：说明无提交分支会阻止不切换的新建分支，比较需要已有提交引用。
- `docs/CONTINUE.md`：记录无提交分支新建分支 / 比较保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/features/branches.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支储藏和丢弃全部工作区操作
### What was done
- 复现并修复当前分支还没有首个提交时，“储藏工作区”透出英文 `You do not have the initial commit yet` 的问题。
- 修复无提交分支上“丢弃全部”先执行 `git reset --hard HEAD` 导致失败、未跟踪文件无法清理的问题。
- 后端在无提交分支上阻止创建储藏并给出中文原因；“丢弃全部”改为清空索引后执行 `git clean -fd`。
- 前端在无提交分支上禁用顶部和命令面板的储藏入口，并在直接调用储藏时给出中文提示。
- README 和继续开发文档同步说明无提交分支下储藏与丢弃全部的行为。

### Testing
- 在 `D:\桌面\GitTest` 从干净 `123` 分支切到临时孤儿分支 `forkline/unborn-worktree-actions-20260703` 复现；该状态下 `/api/state` 返回 `sync.unborn = true`，工作区有 14 个未跟踪文件。
- 修复前调用 `/api/action createStash` 返回英文 `You do not have the initial commit yet`；调用 `/api/action discardAll` 返回 `fatal: ambiguous argument 'HEAD'`，未跟踪文件没有被清理。
- 修复后重启临时服务 `http://127.0.0.1:5295`，`createStash` 返回中文“当前分支还没有任何提交，不能创建储藏”；`discardAll` 返回“已丢弃全部未提交更改”。
- 修复后同一无提交分支 `git status --short --branch` 只剩 `## No commits yet on forkline/unborn-worktree-actions-20260703`，Forkline `/api/state` 返回 `workingCount = 0`。
- `node --check server.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\features\folder-command.js`、`node --check public\js\features\worktree-changes.js` 和 `git diff --check` 均通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，临时孤儿分支没有留下本地分支引用。

### Notes
- `server.js`：`discardAll` 在无提交分支上跳过 `reset HEAD`，改为清空索引并 clean；`createStash` 在无提交分支上中文拦截，并补充 initial commit / HEAD unknown 的中文兜底。
- `public/js/features/git-actions.js`：无提交分支直接调用储藏时给出中文提示。
- `public/js/features/folder-command.js`：命令面板在无提交分支上禁用“储藏工作区”。
- `public/js/features/worktree-changes.js`：顶部“储藏”按钮在无提交分支上禁用并显示原因。
- `README.md`：说明无提交分支不能创建储藏，以及“丢弃全部”会清理未跟踪文件。
- `docs/CONTINUE.md`：记录无提交分支工作区操作修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前可执行 `git checkout -- server.js public/js/features/git-actions.js public/js/features/folder-command.js public/js/features/worktree-changes.js README.md docs/CONTINUE.md progress.md`；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支默认 HEAD 创建 worktree 的英文错误
### What was done
- 复现并修复当前分支还没有首个提交时，工作树表单使用默认 `HEAD` 起点创建 worktree 会透出英文 Git 错误的问题。
- 后端在执行 `git worktree add` 前识别 `HEAD`、`@`、当前无提交分支名和 `refs/heads/<当前分支>`，直接返回中文提示。
- 保留从已有本地分支、Tag 或提交 SHA 创建 worktree 的能力，避免把合法的跨引用工作树创建误拦截。
- README 和继续开发文档同步说明无提交分支下 worktree 起点的限制。

### Testing
- 在 `D:\桌面\GitTest` 的临时无提交分支 `forkline/unborn-staged-file-20260703` 上复现；修复前调用 `/api/action createWorktree`，`ref = HEAD` 返回英文 `fatal: 'HEAD' is not a valid branch name`。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同一请求返回中文“当前分支 forkline/unborn-staged-file-20260703 还没有任何提交，不能从 HEAD 创建工作树”。
- 修复后用当前无提交分支名作为 `ref` 创建 worktree，同样返回中文拦截；用已有分支 `123` 作为 `ref` 并创建临时分支 `forkline/worktree-from-123-unborn-20260703` 成功。
- `node --check server.js` 通过。
- 已删除临时 worktree `C:\tmp\forkline-worktree-unborn-allowed-20260703` 和临时分支 `forkline/worktree-from-123-unborn-20260703`；`D:\桌面\GitTest` 已切回 `123`，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：`createWorktree` 在无提交分支上拦截依赖当前 `HEAD` 的起点，并提示改用已有引用。
- `README.md`：说明无提交分支不能用默认 `HEAD` 或当前无提交分支名创建 worktree。
- `docs/CONTINUE.md`：记录无提交分支的工作树起点保护已接入。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支追加提交误用图谱首条提交
### What was done
- 复现并修复当前分支还没有首个提交时，“追加”可能拿全部分支图谱第一条提交当作上一次提交的问题。
- 前端改为只根据当前仓库真实 `repo.headSha` 填充追加提交信息；没有 HEAD 提交或 `sync.unborn = true` 时禁用“追加”复选框。
- 后端在 `amendCommit` 创建恢复点前检查当前分支是否已有 HEAD 提交，没有则返回中文提示，不再透出 `fatal: Needed a single revision`。
- README 和继续开发文档同步说明无提交分支下追加提交会被禁用。

### Testing
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-amend-20260703` 上复现：`/api/open` 返回 `headSha = ""`、`sync.unborn = true`，但 `commits[0]` 是 `main` 的 `5c1167c Merge branch 'local_debug'`。
- 修复前调用 `/api/action amendCommit` 返回英文 `fatal: Needed a single revision`。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同一 `amendCommit` 请求返回中文“forkline/unborn-amend-20260703 还没有上一次提交，不能追加提交。请先创建首个提交。”。
- 静态检查确认前端 `fillLatestCommitMessage` 使用 `currentHeadCommitForAmend()`，`updateAmendMode` 会根据 `repo.headSha` 和 `sync.unborn` 设置 `amendToggle.disabled`。
- `node --check server.js`、`node --check public\js\features\git-actions.js`、`node --check public\js\app\init.js` 均通过。
- 已对 `D:\桌面\GitTest` 执行 `reset --hard HEAD` 和 `clean -fd` 清理测试文件，最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：`amendCommit` 在无 HEAD 提交时返回中文拦截。
- `public/js/features/git-actions.js`：追加提交填充逻辑改用真实 HEAD 提交，并在无提交分支禁用复选框。
- `public/js/app/init.js`：全量渲染时同步刷新追加提交复选框状态。
- `README.md`：说明无提交分支会禁用追加提交，追加只读取当前真实 HEAD。
- `docs/CONTINUE.md`：记录无提交分支追加提交保护。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`public/js/features/git-actions.js`、`public/js/app/init.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支文件历史和逐行追踪误导提示
### What was done
- 复现并修复当前分支还没有首个提交时，工作区文件打开“文件历史”或“逐行追踪”提示“刷新分支列表后再试”的误导问题。
- 后端现在会识别 `HEAD`、`@`、当前无提交分支名和 `refs/heads/<当前分支>`，并提示先创建首个提交，或选择已有分支、Tag、提交 SHA。
- 保留显式查询已有引用的能力，例如当前分支无提交时仍可对 `123` 分支上的文件查看历史和 blame。
- README 和继续开发文档同步说明无提交分支下文件历史 / 逐行追踪的限制。

### Testing
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-history-20260703` 上复现：`/api/file-history` 和 `/api/file-blame` 使用当前无提交分支名作为 `ref` 时，修复前分别返回“不是有效提交引用。请刷新分支列表后再试。”。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同样请求分别返回“当前分支还没有任何提交，不能在 ... 上查看文件历史”和“不能在 ... 上逐行追踪”。
- 回归确认显式引用 `123` 不受影响：`/api/file-history?file=189.txt&ref=123` 和 `/api/file-blame?file=189.txt&ref=123` 均返回 200。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，并执行 `reset --hard HEAD` 与 `clean -fd` 清理测试文件；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：文件历史和逐行追踪在当前无提交引用上返回明确中文提示。
- `README.md`：说明无提交分支不能用当前 `HEAD` 查看文件历史或逐行追踪。
- `docs/CONTINUE.md`：记录无提交分支文件历史 / 逐行追踪提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支强制签出仍依赖 HEAD
### What was done
- 复现并修复当前分支还没有首个提交时，“强制签出”先执行 `git reset --hard HEAD` 导致无法切到目标分支的问题。
- 强制签出现在复用“丢弃全部”的清理逻辑：有 HEAD 时执行 `reset --hard HEAD`，无 HEAD 时清空索引，再执行 `git clean -fd`，随后切换目标分支。
- “储藏并签出”在无提交分支上改为提前给出明确中文提示，说明 Git 不能在无首提交时创建储藏，并建议先提交或改用强制签出。
- README 和继续开发文档同步说明无提交分支下储藏并签出 / 强制签出的行为。

### Testing
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-checkout-20260703` 上复现：存在未跟踪文件 `forkline-fixtures/unborn-checkout.txt`。
- 修复前调用 `/api/action checkoutBranch`，`branch = 123`、`mode = force` 返回“当前分支还没有首个提交，HEAD 暂时不是有效引用...”且没有切换。
- 修复后重启临时服务 `http://127.0.0.1:5296`，同样的强制签出请求返回 200 “已丢弃本地更改并强制切换分支”。
- 修复后同一场景下 `mode = stash` 返回明确中文“当前分支 forkline/unborn-checkout-20260703 还没有任何提交，不能储藏并签出。请先创建首个提交，或改用‘强制签出’丢弃这些改动。”。
- `node --check server.js` 通过。
- 强制签出后 `D:\桌面\GitTest` 回到 `123`，`git status --short --branch` 返回 `## 123`，测试文件路径不存在。

### Notes
- `server.js`：新增统一的工作区清理函数，并让丢弃全部、本地强制签出和远端强制签出走同一套无 HEAD 兼容清理；储藏并签出在无提交分支上提前中文拦截。
- `README.md`：说明无提交分支不能储藏并签出，但可以强制签出丢弃当前改动。
- `docs/CONTINUE.md`：记录无提交分支强制签出修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；这些文件已有其他未提交改动，不要用整文件 checkout 回滚。提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支重置到提交时的英文错误
### What was done
- 复现当前分支还没有首个提交时，对历史提交执行硬重置会在创建恢复点阶段失败，并透出 `fatal: Needed a single revision`。
- `resetToCommit` 现在只有在当前分支已有 `HEAD` 提交时才创建“重置前恢复点”；无提交分支会继续执行 reset，并在结果里说明本次没有可保存的旧 HEAD。
- README 和继续开发文档同步说明无提交分支执行 reset 时不会创建重置前恢复点。

### Testing
- 先验证远端强制签出回归：在 `D:\桌面\GitTest` 临时无提交分支上模拟 `origin/forkline-remote-only-checkout-20260703`，调用 `/api/action checkoutRemoteBranch`，`mode = force` 返回 200 “已强制签出本地分支 forkline-remote-only-checkout-20260703”。
- 在 `D:\桌面\GitTest` 临时无提交分支 `forkline/unborn-reset-20260703` 上复现：修复前调用 `/api/action resetToCommit`，`mode = hard` 返回 `fatal: Needed a single revision`。
- 修复后重启临时服务 `http://127.0.0.1:5298`，同一 hard reset 请求返回 200 “已硬重置到 4fbce18 / 当前分支原本还没有提交，无法创建重置前恢复点。”。
- 同一服务继续验证 `mode = mixed` 和 `mode = soft`，均返回 200，并显示对应的“无法创建重置前恢复点”中文说明。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，删除本轮临时本地分支和临时远端跟踪引用；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：无提交分支执行 reset 时跳过恢复点创建，避免依赖不存在的 `HEAD`。
- `README.md`：说明无提交分支 reset 到已有提交会继续执行，但不会创建重置前恢复点。
- `docs/CONTINUE.md`：记录无提交分支 reset 修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复变基已不存在远端分支时误用过期 tracking
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会把当前分支变基到这个过期提交。
- `rebaseOntoRef` 现在在目标是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝变基。
- README 和继续开发文档同步说明过期远端分支不会再作为变基目标。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-rebase-20260703`，添加一个空提交 `9a1d73a`，推送并抓取出 `origin/forkline/stale-remote-rebase-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5327` 打开 GitTest 后，修复前调用 `rebaseOntoRef origin/forkline/stale-remote-rebase-20260703` 返回成功，并把当前 `123` 分支移动到过期提交 `9a1d73a`。
- 已用 `git reset --hard 4fbce18...` 将 GitTest 恢复到基准提交；修复后重启临时服务 `http://127.0.0.1:5328` 再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认当前 HEAD 仍为 `4fbce18bd7ae1b652dc7c550321acac3de9093b3`，本地过期 `origin/forkline/stale-remote-rebase-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：变基远端分支前校验真实远端分支仍存在，过期时自动 prune 并拒绝变基。
- `README.md`：补充过期远端分支会拒绝变基。
- `docs/CONTINUE.md`：记录变基过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复无提交分支恢复到 Forkline 恢复点的英文错误
### What was done
- 复现当前分支还没有首个提交时，恢复到 Forkline 恢复点会在创建“恢复前恢复点”阶段失败，并透出 `fatal: Needed a single revision`。
- `restoreRecoveryPoint` 现在只有在当前分支已有 `HEAD` 提交时才创建恢复前恢复点；无提交分支会继续执行 `reset --hard <恢复点提交>`，并在结果里说明本次没有可保存的旧 HEAD。
- README 和继续开发文档同步说明无提交分支恢复到 Forkline 恢复点时不会创建恢复前恢复点。

### Testing
- 在 `D:\桌面\GitTest` 手动创建临时恢复点 `refs/forkline/recovery/20260703-122700/forkline_unborn-restore-20260703/manual`，指向 `123` 分支的 `4fbce18`。
- 在临时无提交分支 `forkline/unborn-restore-20260703` 上复现：修复前调用 `/api/action restoreRecoveryPoint` 返回 `fatal: Needed a single revision`。
- 修复后重启临时服务 `http://127.0.0.1:5302`，在无提交分支 `forkline/unborn-reflog-restore-20260703` 上调用同一恢复点，返回 200 “已恢复到 4fbce18 / 当前分支原本还没有提交，无法创建恢复前恢复点。”。
- 探查引用日志恢复路径：无提交分支下 `git log -g ... HEAD` 返回 `fatal: ambiguous argument 'HEAD'`，Forkline 没有可选择的 HEAD reflog 记录，因此本轮未改 reflog 恢复逻辑。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，删除本轮临时分支和临时恢复点 ref；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：无提交分支恢复到 Forkline 恢复点时跳过恢复前恢复点创建，避免依赖不存在的 `HEAD`。
- `README.md`：说明无提交分支恢复到 Forkline 恢复点时会继续恢复，但不会创建恢复前恢复点。
- `docs/CONTINUE.md`：记录无提交分支恢复点恢复修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复还原和挑选覆盖本地修改时的误导提示
### What was done
- 复现工作区存在暂存修改时，`revertCommit` 被 Git 阻止后 Forkline 返回通用“切换分支可储藏并签出/强制签出”提示，和还原场景不匹配。
- 错误提示映射现在会区分 `revertCommit` 和 `cherryPickCommit`：还原 / 挑选会覆盖本地修改时，分别提示先提交、储藏或丢弃当前修改后再还原 / 挑选。
- README 和继续开发文档同步说明还原 / 挑选覆盖本地修改时的专用中文提示。

### Testing
- 在 `D:\桌面\GitTest` 临时分支 `forkline/dirty-revert-20260703` 上创建并暂存 `forkline-fixtures/dirty-revert-20260703.txt`。
- 修复前调用 `/api/action revertCommit`，返回通用提示“这个操作会覆盖本地修改...如果是切换分支，也可以使用‘储藏并签出/强制签出’”。
- 修复后重启临时服务 `http://127.0.0.1:5304`，同一还原请求返回“还原提交会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些修改后再还原。”。
- 同一脏工作区下调用 `/api/action cherryPickCommit` 返回“挑选提交会覆盖当前工作区的本地修改。请先提交、储藏或丢弃这些修改后再挑选。”。
- `node --check server.js` 通过。
- 已切回 `D:\桌面\GitTest` 的 `123` 分支，删除本轮临时分支；最终 `git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：覆盖本地修改错误映射新增还原 / 挑选专用提示。
- `README.md`：补充还原 / 挑选覆盖本地修改时会提示先处理当前工作区。
- `docs/CONTINUE.md`：记录还原 / 挑选覆盖本地修改提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复本地分支列表过期时的英文错误
### What was done
- 复现当前前端分支列表已过期时，继续删除或重命名一个已经不存在的本地分支会透出 Git 英文错误。
- 错误提示映射新增 `branch not found` / `no branch named` 场景，统一提示本地分支已经不存在，需要刷新分支列表后重新选择。
- README 和继续开发文档同步说明删除 / 重命名过期分支时的中文刷新提示。

### Testing
- 临时服务 `http://127.0.0.1:5305` 打开 `D:\桌面\GitTest` 后，调用 `/api/action deleteBranch`，`branch = forkline/missing-stale-20260703`，修复前返回 `error: branch 'forkline/missing-stale-20260703' not found`。
- 同一服务调用 `/api/action renameBranch`，`branch = forkline/missing-stale-20260703`，修复前返回 `fatal: no branch named 'forkline/missing-stale-20260703'`。
- 修复后重启临时服务 `http://127.0.0.1:5306`，同样的删除和重命名请求都返回“这个本地分支已经不存在，可能是分支列表还没有刷新。请刷新分支列表后重新选择。”。
- `node --check server.js` 通过。
- 本轮没有创建或修改 GitTest 分支；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：为已不存在本地分支的 Git 错误增加中文刷新提示。
- `README.md`：说明外部删除分支后再删除 / 重命名会提示刷新分支列表。
- `docs/CONTINUE.md`：记录本地分支列表过期提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复远端 Tag 失败提示误用 Tag 名
### What was done
- 排查 Tag 列表过期场景：删除不存在的本地 Tag 已有中文预检“本地 Tag ... 不存在”，无需修改。
- 复现删除远端 Tag 时，如果远端仓库不可读，Forkline 会把 `body.name` 里的 Tag 名显示成远端名，提示“远端 <Tag名> 无法读取”。
- 远端错误提示现在优先使用 `body.remote`，再回退到 `body.name`，避免 `deleteRemoteTag` / `pushTag` 这类请求把 Tag 名误当远端。
- README 和继续开发文档同步说明远端 Tag 操作失败时会按实际远端名显示认证、路径或网络提示。

### Testing
- 临时服务 `http://127.0.0.1:5307` 打开 `D:\桌面\GitTest` 后，调用 `/api/action deleteTag`，`name = forkline-missing-tag-20260703`，确认已有中文“本地 Tag ... 不存在”。
- 同一服务调用 `/api/action deleteRemoteTag`，`name = forkline-missing-remote-tag-20260703`、`remote = origin`；由于 GitTest 的 `origin` 路径当前不可读，修复前返回“远端 forkline-missing-remote-tag-20260703 无法读取”。
- 通过原始 Git 命令确认失败原因是 `D:\桌面\GitTestRemote.git` 不可读，而不是 Tag 名本身。
- 修复后重启临时服务 `http://127.0.0.1:5309`，同一请求返回“远端 origin 无法读取。请确认远端 URL 正确、仓库存在，并且你拥有访问权限。”。
- `node --check server.js` 通过。
- 本轮没有创建或修改 GitTest 分支 / Tag；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：远端错误提示优先使用 `body.remote`，避免 Tag 名覆盖远端名。
- `README.md`：补充远端 Tag 操作失败时按实际远端名显示提示。
- `docs/CONTINUE.md`：记录远端 Tag 失败提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复删除不存在远端 Tag 误报成功
### What was done
- 复现远端可访问但目标 Tag 不存在时，Git 会返回成功并带 `deleting a non-existent ref` warning，Forkline 也误报“已删除远端 Tag”。
- `deleteRemoteTag` 现在执行删除前先用 `git ls-remote --tags <远端> refs/tags/<Tag>` 确认远端 Tag 仍存在；不存在时返回中文“请刷新 Tag 列表后重新选择”。
- 保留远端不可读时的原有远端错误提示；正常存在的远端 Tag 仍可删除成功。
- README 和继续开发文档同步说明删除远端 Tag 会先确认远端仍存在该 Tag。

### Testing
- 在 `C:\tmp\forkline-remote-tag-missing-20260703.git` 创建临时 bare 远端，并临时添加到 `D:\桌面\GitTest`，远端名 `forkline-temp-tag-missing`。
- 修复前通过 Forkline API 调用 `deleteRemoteTag` 删除不存在的 `forkline-missing-existing-remote-tag-20260703`，返回 200 “已删除远端 Tag...”，但 Git 输出包含 `remote: warning: deleting a non-existent ref`。
- 修复后重启临时服务 `http://127.0.0.1:5311`，同一请求返回“远端 Tag ... 不存在或已经被删除。请刷新 Tag 列表后重新选择。”。
- 正常路径验证：创建本地临时 Tag `forkline-temp-existing-remote-tag-20260703`，通过 Forkline `pushTag` 推送到临时远端，再通过 `deleteRemoteTag` 删除成功；`ls-remote --tags` 确认远端 Tag 不存在。
- `node --check server.js` 通过。
- 已删除本地临时 Tag、移除临时远端、删除 `C:\tmp` 临时 bare 仓库；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`remote -v` 只剩 `origin`。

### Notes
- `server.js`：删除远端 Tag 前新增远端 Tag 存在性预检，避免 Git warning 被误当成功。
- `README.md`：说明删除远端 Tag 会先确认远端仍存在该 Tag。
- `docs/CONTINUE.md`：记录删除不存在远端 Tag 误报成功的修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复推送同名远端 Tag 冲突的误导提示
### What was done
- 复现远端已有同名 Tag、但本地 Tag 指向另一个提交时，`pushTag` 被 Git 拒绝后 Forkline 误报“这个远端名已经存在”。
- 错误提示映射现在会优先识别 `pushTag` 的 `tag already exists` 场景，明确说明远端已经存在同名 Tag，Git 拒绝覆盖。
- README 和继续开发文档同步说明远端同名 Tag 冲突时，需要先确认是否删除远端 Tag 或改用新 Tag 名。

### Testing
- 在 `C:\tmp\forkline-remote-tag-exists-20260703.git` 创建临时 bare 远端，并临时添加到 `D:\桌面\GitTest`，远端名 `forkline-temp-tag-exists`。
- 在 GitTest 创建本地 Tag `forkline-temp-existing-push-tag-20260703` 指向 `123`，通过 Forkline `pushTag` 推送到临时远端成功。
- 将本地同名 Tag 改指向 `3a90fbb` 后再次调用 `pushTag`；修复前返回“这个远端名已经存在。请换一个名称，或在同步页修改已有远端的 URL。”。
- 修复后重启临时服务 `http://127.0.0.1:5313`，同一请求返回“远端 forkline-temp-tag-exists 已经存在 Tag forkline-temp-existing-push-tag-20260703，Git 已拒绝覆盖...”。
- `node --check server.js` 通过。
- 已删除本地临时 Tag、移除临时远端、删除 `C:\tmp` 临时 bare 仓库；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`remote -v` 只剩 `origin`。

### Notes
- `server.js`：为 `pushTag` 的远端同名 Tag 冲突增加专用中文提示。
- `README.md`：补充远端已有同名 Tag 且 Git 拒绝覆盖时的处理说明。
- `docs/CONTINUE.md`：记录推送同名远端 Tag 冲突提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复重复推送相同远端 Tag 的误导提示
### What was done
- 复现远端已经存在完全相同的 Tag 时，重复执行 `pushTag` 返回 `Everything up-to-date`，但 Forkline 总结仍显示“已推送 Tag...”。
- `pushTag` 现在识别 `Everything up-to-date` 输出，并总结为“远端 ... 已有相同 Tag ...，无需重复推送”。
- README 和继续开发文档同步说明重复推送相同远端 Tag 时会提示无需重复推送。

### Testing
- 在 `C:\tmp\forkline-remote-tag-uptodate-20260703.git` 创建临时 bare 远端，并临时添加到 `D:\桌面\GitTest`，远端名 `forkline-temp-tag-uptodate`。
- 在 GitTest 创建本地 Tag `forkline-temp-uptodate-tag-20260703` 指向 `123`，通过 Forkline `pushTag` 第一次推送到临时远端成功。
- 第二次推送同一 Tag 时，修复前返回 200 “已推送 Tag ... / Everything up-to-date”。
- 修复后重启临时服务 `http://127.0.0.1:5315`，同一请求返回 200 “远端 forkline-temp-tag-uptodate 已有相同 Tag forkline-temp-uptodate-tag-20260703，无需重复推送 / Everything up-to-date”。
- `node --check server.js` 通过。
- 已删除本地临时 Tag、移除临时远端、删除 `C:\tmp` 临时 bare 仓库；最终 `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`，`remote -v` 只剩 `origin`。

### Notes
- `server.js`：`pushTag` 对 `Everything up-to-date` 使用无需重复推送的摘要。
- `README.md`：说明远端已有完全相同 Tag 时不会误报新推送。
- `docs/CONTINUE.md`：记录重复推送相同远端 Tag 的提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复创建 Tag 目标提交过期时的英文错误
### What was done
- 复现使用一个格式合法但仓库中不存在的提交 SHA 创建 Tag 时，Forkline 透出 Git 原始错误 `cannot update ref ... nonexistent object`。
- `createTag` 现在先解析目标 SHA 是否是有效提交；目标不存在或不是提交对象时，返回中文“Tag 目标提交不存在或不是有效提交。请刷新提交列表后重新选择。”。
- README 和继续开发文档同步说明创建 Tag 会先确认目标提交仍存在。

### Testing
- 临时服务 `http://127.0.0.1:5316` 打开 `D:\桌面\GitTest` 后，调用 `/api/action createTag`，`target = 0123456789abcdef0123456789abcdef01234567`；修复前返回 `fatal: cannot update ref ... nonexistent object ...`。
- 修复后重启临时服务 `http://127.0.0.1:5317`，同一请求返回中文“Tag 目标提交不存在或不是有效提交。请刷新提交列表后重新选择。”。
- 正常路径验证：使用真实提交 `4fbce18...` 创建临时 Tag `forkline-valid-target-tag-20260703` 成功。
- `node --check server.js` 通过。
- 已删除临时 Tag；最终 `git -C D:\桌面\GitTest tag --list "forkline-*-target-tag-20260703"` 无输出，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：创建 Tag 前使用提交解析校验目标 SHA，避免过期提交详情透出 Git 原始错误。
- `README.md`：补充创建 Tag 会确认目标提交仍存在。
- `docs/CONTINUE.md`：记录创建 Tag 目标提交过期提示修正。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复远端分支签出已有本地分支时不建立 upstream
### What was done
- 复现 `D:\桌面\GitTest` 当前 `123` 分支没有 upstream 时，通过 Forkline 签出 `origin/123` 返回成功，但本地分支仍未跟踪 `origin/123`。
- `checkoutRemoteBranch` 现在在本地同名分支已存在且没有 upstream 时，会补执行 `git branch --set-upstream-to=<远端分支> <本地分支>`。
- 如果本地同名分支已经跟踪其他 upstream，Forkline 不会静默覆盖，只会在结果中说明现有跟踪关系。

### Testing
- 临时服务 `http://127.0.0.1:5319` 打开 `D:\桌面\GitTest` 后，先确认 `git rev-parse --abbrev-ref --symbolic-full-name @{u}` 返回 `fatal: no upstream configured for branch '123'`。
- 调用 `/api/action`：`checkoutRemoteBranch`、`ref = origin/123`、`mode = keep`，修复后返回“已从 origin/123 签出本地分支 123 / 已设置 upstream：123 -> origin/123”。
- `git -C D:\桌面\GitTest rev-parse --abbrev-ref --symbolic-full-name @{u}` 返回 `origin/123`。
- `node --check server.js` 通过。
- 验证后已执行 `git -C D:\桌面\GitTest branch --unset-upstream 123`，测试仓库恢复为 `## 123`。

### Notes
- `server.js`：远端分支签出时为已存在且无 upstream 的本地同名分支补建跟踪关系。
- `README.md`：补充远端签出已有本地同名分支时的 upstream 行为说明。
- `docs/CONTINUE.md`：记录远端分支签出跟踪关系的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复本地路径远端缺失时的模糊错误提示
### What was done
- 复现 GitTest 的 `origin` 指向 `D:\桌面\GitTestRemote.git`，但该本地裸仓库不存在时，Forkline 的“诊断远端”和“抓取此远端”只提示“远端 origin 无法读取”。
- 远端错误映射现在会从 Git 原始输出中识别本地路径，并直接提示该路径不存在或不是 Git 仓库。
- README 和继续开发文档同步说明本地路径远端缺失时会显示具体路径；验证后重新创建了 `D:\桌面\GitTestRemote.git` 测试裸仓库。

### Testing
- `Test-Path -LiteralPath D:\桌面\GitTestRemote.git` 返回 `False`。
- 临时服务 `http://127.0.0.1:5320` 打开 `D:\桌面\GitTest` 后，修复前调用 `testRemote origin` 和 `fetchRemote origin` 均返回“远端 origin 无法读取。请确认远端 URL 正确、仓库存在，并且你拥有访问权限。”。
- 修复后重启同端口服务，再次调用 `testRemote origin` 和 `fetchRemote origin`，均返回“远端 origin 指向的本地路径 D:\桌面\GitTestRemote.git 不存在或不是 Git 仓库...”。
- 执行 `git clone --bare D:\桌面\GitTest D:\桌面\GitTestRemote.git` 重建测试裸仓库；`git -C D:\桌面\GitTest ls-remote --heads origin` 可读取 `123`、`local`、`local_debug` 和 `main`。
- `git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：远端错误提示新增本地路径远端缺失识别。
- `README.md`：说明本地路径远端不存在或不是 Git 仓库时会直接显示路径。
- `docs/CONTINUE.md`：记录本地路径远端缺失提示修复，并说明 GitTestRemote 已重建。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。测试裸仓库如需回滚到缺失状态，可删除 `D:\桌面\GitTestRemote.git`，但默认保留它以便后续远端功能验证。

## 2026-07-03 - Task: 修复相对本地路径远端缺失时的模糊错误提示
### What was done
- 复现 GitTest 临时远端 `forkline-relative-missing -> MissingBare.git` 不存在时，Forkline 的“诊断远端”只提示“远端无法读取”，没有指出相对本地路径。
- 本地路径远端识别现在覆盖 `MissingBare.git` 这类相对裸仓库路径，同时排除 URL 和 SSH scp 写法，避免误判远端仓库地址。
- README 和继续开发文档同步说明相对本地路径远端缺失时也会显示具体路径。

### Testing
- 临时添加 `git -C D:\桌面\GitTest remote add forkline-relative-missing MissingBare.git`，并确认 `D:\桌面\GitTest\MissingBare.git` 不存在。
- 临时服务 `http://127.0.0.1:5321` 打开 `D:\桌面\GitTest` 后，修复前调用 `testRemote forkline-relative-missing` 返回通用“远端无法读取”。
- 修复后重启同端口服务，调用 `testRemote forkline-relative-missing` 和 `fetchRemote forkline-relative-missing`，均返回“远端 forkline-relative-missing 指向的本地路径 MissingBare.git 不存在或不是 Git 仓库...”。
- 已删除临时远端；`git -C D:\桌面\GitTest remote -v` 只剩 `origin -> D:\桌面\GitTestRemote.git`，`git -C D:\桌面\GitTest status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：本地路径远端缺失识别补充相对 `.git` 路径。
- `README.md`：补充 `MissingBare.git` 这类相对裸仓库路径也会直接显示。
- `docs/CONTINUE.md`：记录相对本地路径远端缺失提示修复。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复删除已不存在远端分支后本地列表仍残留
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 删除该远端分支只返回错误“请先抓取远端刷新列表”，但没有实际刷新列表。
- `deleteRemoteBranch` 现在识别 Git 返回的 `remote ref does not exist` / `unable to delete` 场景，把目标分支视为远端已不存在，并自动执行 `git fetch <remote> --prune` 清理本地过期跟踪引用。
- README 和继续开发文档同步说明远端分支已被别人删除时会自动清理本地远端跟踪引用。

### Testing
- 在 GitTest 创建本地临时分支 `forkline/stale-remote-delete-20260703`，推送到 `origin`，并显式抓取到 `refs/remotes/origin/forkline/stale-remote-delete-20260703`。
- 直接在 `D:\桌面\GitTestRemote.git` 执行 `update-ref -d refs/heads/forkline/stale-remote-delete-20260703`，制造真实远端分支不存在、本地远端跟踪引用仍存在的过期列表状态。
- 临时服务 `http://127.0.0.1:5322` 打开 GitTest 后，修复前调用 `deleteRemoteBranch origin/forkline/stale-remote-delete-20260703` 返回错误，且 `git branch -r --list origin/forkline/stale-remote-delete-20260703` 仍能看到过期引用。
- 修复后重启同端口服务，再次调用同一动作返回 200 “远端分支 ... 已不存在，已刷新远端分支列表”，输出包含 `fetch --prune` 删除该远端跟踪引用。
- 已删除本地临时分支；`git -C D:\桌面\GitTest branch -r --list origin/forkline/stale-remote-delete-20260703` 和 `git -C D:\桌面\GitTest ls-remote --heads origin forkline/stale-remote-delete-20260703` 均无输出。

### Notes
- `server.js`：删除远端分支时对远端已不存在的分支自动执行 prune 并返回成功摘要。
- `README.md`：说明删除远端分支遇到过期列表时会自动刷新本地远端跟踪引用。
- `docs/CONTINUE.md`：记录远端删除过期列表的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复远端分支已不存在但仍可从过期列表签出
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会从过期引用创建本地分支并设置 upstream。
- `checkoutRemoteBranch` 现在在签出前使用 `git ls-remote --heads <remote> <branch>` 确认真正的远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝签出。
- README 和继续开发文档同步说明过期远端分支不会再被签出为本地分支。

### Testing
- 在 GitTest 推送 `HEAD` 到远端分支 `forkline/stale-remote-checkout-20260703`，抓取出 `origin/forkline/stale-remote-checkout-20260703` 后，直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，制造过期远端分支列表。
- 临时服务 `http://127.0.0.1:5323` 打开 GitTest 后，修复前调用 `checkoutRemoteBranch origin/forkline/stale-remote-checkout-20260703` 返回成功，并创建本地分支 `forkline/stale-remote-checkout-20260703`，upstream 指向已经不存在的远端跟踪分支。
- 修复后删除误创建的本地分支、保留过期跟踪引用，重启同端口服务再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认当前分支仍为 `123`，没有创建本地 `forkline/stale-remote-checkout-20260703`，并且本地过期 `origin/forkline/stale-remote-checkout-20260703` 已被 prune 清理。

### Notes
- `server.js`：远端分支签出前增加真实远端分支存在性校验，过期时自动 prune 并拒绝签出。
- `README.md`：补充远端分支已不存在但本地列表未刷新时会清理过期引用并拒绝签出。
- `docs/CONTINUE.md`：记录远端分支签出过期列表的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复过期远端分支仍可设为 upstream
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会把当前分支 upstream 设置到这个已不存在的远端分支，并显示“本地与上游一致”。
- `setUpstream` 现在复用远端真实存在性校验；目标远端分支已不存在时会自动 `fetch --prune` 并拒绝写入 upstream。
- README 和继续开发文档同步说明设置 upstream 前会确认远端分支仍存在。

### Testing
- 在 GitTest 推送 `HEAD` 到远端分支 `forkline/stale-upstream-20260703`，抓取出 `origin/forkline/stale-upstream-20260703` 后，直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，制造过期远端分支列表。
- 临时服务 `http://127.0.0.1:5324` 打开 GitTest 后，修复前调用 `setUpstream origin/forkline/stale-upstream-20260703` 返回成功，并把 `123` 的 upstream 写成这个已不存在的远端分支。
- 修复后先取消误写入的 upstream，保留过期跟踪引用，重启同端口服务再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后 `git -C D:\桌面\GitTest rev-parse --abbrev-ref --symbolic-full-name @{u}` 返回没有 upstream，`git branch -r --list origin/forkline/stale-upstream-20260703` 无输出，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：设置 upstream 前校验真实远端分支仍存在，过期时自动 prune 并拒绝写入配置。
- `README.md`：补充设置 upstream 会拒绝过期远端分支。
- `docs/CONTINUE.md`：记录 Upstream 过期列表的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复合并已不存在远端分支时误用过期 tracking
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会把这个过期引用合并进当前分支，创建新的 merge commit。
- `mergeRef` 现在在目标是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝合并。
- README 和继续开发文档同步说明过期远端分支不会再被合并。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-merge-20260703`，添加一个空提交 `25321cd`，推送并抓取出 `origin/forkline/stale-remote-merge-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5325` 打开 GitTest 后，修复前调用 `mergeRef origin/forkline/stale-remote-merge-20260703` 返回成功，并创建 merge commit `6ca351e`。
- 已用 `git reset --hard 4fbce18...` 将 GitTest 恢复到基准提交；修复后重启同端口服务再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认 `git log -1 --oneline --parents` 仍为 `4fbce18 cdd252a 修改2`，没有新 merge commit；本地过期 `origin/forkline/stale-remote-merge-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：合并远端分支前校验真实远端分支仍存在，过期时自动 prune 并拒绝合并。
- `README.md`：补充过期远端分支会拒绝合并。
- `docs/CONTINUE.md`：记录合并过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复从已不存在远端分支新建本地分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会从这个过期引用创建新的本地分支。
- `createBranch` 现在在起点是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝创建。
- README 和继续开发文档同步说明过期远端分支不会再作为新建分支起点。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-create-branch-20260703`，添加一个空提交 `fd3fe65`，推送并抓取出 `origin/forkline/stale-remote-create-branch-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5329` 打开 GitTest 后，修复前调用 `createBranch`，起点为 `origin/forkline/stale-remote-create-branch-20260703`，返回成功并创建本地分支 `forkline/from-stale-create-branch-20260703` 指向过期提交 `fd3fe65`。
- 已删除误创建的本地分支；修复后重启临时服务 `http://127.0.0.1:5330` 再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认没有创建本地 `forkline/from-stale-create-branch-20260703`，本地过期 `origin/forkline/stale-remote-create-branch-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：从远端分支起点新建本地分支前校验真实远端分支仍存在，过期时自动 prune 并拒绝创建。
- `README.md`：补充过期远端分支会拒绝作为新建分支起点。
- `docs/CONTINUE.md`：记录从过期远端分支创建本地分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复从已不存在远端分支创建 worktree
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，Forkline 仍会从这个过期引用创建 detached worktree。
- `createWorktree` 现在在起点是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝创建。
- README 和继续开发文档同步说明过期远端分支不会再作为 worktree 起点。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-worktree-20260703`，添加一个空提交 `0204135`，推送并抓取出 `origin/forkline/stale-remote-worktree-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5331` 打开 GitTest 后，修复前调用 `createWorktree`，起点为 `origin/forkline/stale-remote-worktree-20260703`，返回成功并在 `C:\tmp\forkline-stale-worktree-20260703` 创建 detached worktree，HEAD 指向过期提交 `0204135`。
- 已执行 `git worktree remove --force C:\tmp\forkline-stale-worktree-20260703` 清理误创建的 worktree；修复后重启临时服务 `http://127.0.0.1:5332` 再次调用同一动作，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认没有创建 `C:\tmp\forkline-stale-worktree-20260703`，`git worktree list --porcelain` 只剩主工作树，本地过期 `origin/forkline/stale-remote-worktree-20260703` 已被 prune，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：从远端分支起点创建 worktree 前校验真实远端分支仍存在，过期时自动 prune 并拒绝创建。
- `README.md`：补充过期远端分支会拒绝作为 worktree 起点。
- `docs/CONTINUE.md`：记录从过期远端分支创建 worktree 的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复比较页读取已不存在远端分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，比较页仍会读取这个过期引用并展示目标独有提交。
- `readCompare` 现在在比较基准或目标是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝比较。
- README 和继续开发文档同步说明比较页不会再展示过期远端分支的数据。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-compare-20260703`，添加文件 `forkline-fixtures/stale-compare-20260703.txt` 并提交 `e15ae70`，推送并抓取出 `origin/forkline/stale-remote-compare-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5333` 打开 GitTest 后，修复前请求 `/api/compare?base=123&head=origin/forkline/stale-remote-compare-20260703` 返回成功，`headShort = e15ae70`，`headOnlyCount = 1`。
- 修复后重启临时服务 `http://127.0.0.1:5334` 再次请求同一比较，返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”。
- 修复后确认本地过期 `origin/forkline/stale-remote-compare-20260703` 已被 prune，真实远端分支不存在，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：比较前校验基准和目标中的远端分支仍存在，过期时自动 prune 并拒绝比较。
- `README.md`：补充比较页会拒绝过期远端分支。
- `docs/CONTINUE.md`：记录比较页读取过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复文件历史和逐行追踪读取已不存在远端分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，文件历史和逐行追踪仍会读取这个过期引用并展示旧提交数据。
- `readFileHistory` 和 `readFileBlame` 现在在引用是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝读取。
- README 和继续开发文档同步说明文件历史和逐行追踪不会再展示过期远端分支的数据。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-file-read-20260703`，添加文件 `forkline-fixtures/stale-file-read-20260703.txt` 并提交 `0408d6d`，推送并抓取出 `origin/forkline/stale-remote-file-read-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5335` 打开 GitTest 后，修复前请求 `/api/file-history?file=forkline-fixtures/stale-file-read-20260703.txt&ref=origin/forkline/stale-remote-file-read-20260703` 返回 1 条过期提交 `0408d6d`。
- 同一服务请求 `/api/file-blame` 返回 2 行旧 blame，首行文本为 `stale file read line one`，首行提交为 `0408d6d`。
- 修复后重启临时服务 `http://127.0.0.1:5336`，文件历史请求返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”，并自动 prune 过期跟踪引用。
- 为单独验证逐行追踪，临时将旧提交重新挂回 `refs/remotes/origin/forkline/stale-remote-file-read-20260703`；修复后的 `/api/file-blame` 同样返回“远端分支 ... 已不存在”，并再次 prune 过期跟踪引用。
- 修复后确认本地过期 `origin/forkline/stale-remote-file-read-20260703` 已被 prune，真实远端分支不存在，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：文件历史和逐行追踪读取前校验远端分支仍存在，过期时自动 prune 并拒绝读取。
- `README.md`：补充文件历史和逐行追踪会拒绝过期远端分支。
- `docs/CONTINUE.md`：记录文件历史和逐行追踪读取过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复图谱视图读取已不存在远端分支
### What was done
- 复现远端分支已经被外部删除，但本地仍保留 `origin/...` 过期跟踪引用时，轻量图谱和全量状态接口仍会读取这个过期引用并展示旧提交图谱。
- `readState` 和 `readRefState` 现在在选中引用是远端分支时会校验真实远端分支仍存在；不存在时自动 `fetch --prune` 并拒绝读取。
- `ensureLiveRemoteBranchRef` 对空引用快速返回，避免默认状态读取多跑无意义的远端检查。
- README 和继续开发文档同步说明切到远端分支图谱时不会再展示过期 tracking 数据。

### Testing
- 在 GitTest 创建临时分支 `forkline/stale-remote-refstate-20260703`，添加文件 `forkline-fixtures/stale-refstate-20260703.txt` 并提交 `1ebb95c`，推送并抓取出 `origin/forkline/stale-remote-refstate-20260703`。
- 切回 `123`、删除本地临时分支，并直接在 `D:\桌面\GitTestRemote.git` 删除真实远端分支，只保留本地过期远端跟踪引用。
- 临时服务 `http://127.0.0.1:5337` 打开 GitTest 后，修复前请求 `/api/ref-state?ref=origin/forkline/stale-remote-refstate-20260703` 返回成功，首条提交为 `1ebb95c`；`/api/state?ref=...` 同样返回成功，`remotes` 中仍包含该过期引用。
- 修复后重启临时服务 `http://127.0.0.1:5338`，`/api/ref-state?ref=...` 返回“远端分支 ... 已不存在，已刷新远端分支列表。请刷新后重新选择。”，并自动 prune 过期跟踪引用。
- 为单独验证全量状态接口，临时将旧提交重新挂回 `refs/remotes/origin/forkline/stale-remote-refstate-20260703`；修复后的 `/api/state?ref=...` 同样返回“远端分支 ... 已不存在”，并再次 prune 过期跟踪引用。
- 修复后确认本地过期 `origin/forkline/stale-remote-refstate-20260703` 已被 prune，真实远端分支不存在，`git status --short --branch` 返回 `## 123`。

### Notes
- `server.js`：图谱状态读取前校验选中远端分支仍存在，过期时自动 prune 并拒绝读取。
- `README.md`：补充单个远端分支图谱会拒绝过期 tracking。
- `docs/CONTINUE.md`：记录图谱视图读取过期远端分支的 API 复现和验证结果。
- `progress.md`：追加本轮复现、修复、验证和清理记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换已不存在远端分支失败后前端状态错位
### What was done
- 复现单个远端分支图谱切换失败时，前端会先把当前引用、右侧页签、搜索框和提交详情缓存改成失败目标。
- `selectRef` 现在先等待 `/api/ref-state` 成功返回，再切换右侧上下文、清搜索和刷新提交图。
- README 和继续开发文档同步说明过期远端分支切换失败会保留当前视图。

### Testing
- 修复前用前端函数 harness 模拟 `/api/ref-state` 抛出“远端分支 origin/missing 已不存在”，`selectedRef` 被改成 `origin/missing`，右侧上下文被改成 `branch / branches`，搜索框被清空，提交详情缓存被清空。
- 修复后复跑同一 harness，`selectedRef` 保持 `123`，右侧上下文保持 `commit / details`，搜索框保持 `keep`，提交详情缓存保持 1 条，仅显示中文错误 toast。
- 成功路径 harness 返回 `origin/live` 和提交 `new-head` 后，仍正常切到 `branch / branches`，清空搜索，加载 `new-head` 并显示“已查看 origin/live”。

### Notes
- `public/js/features/git-actions.js`：把 `selectRef` 的状态修改移动到 `/api/ref-state` 成功之后，避免失败请求污染当前视图。
- `README.md`：补充单个远端分支图谱切换失败会保留当前视图。
- `docs/CONTINUE.md`：记录前端会保留当前视图和详情。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/git-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复文件历史和逐行追踪快速切换乱序覆盖
### What was done
- 复现连续打开两个文件的历史时，后选择的文件先返回并显示后，较慢返回的旧文件请求会再次覆盖右侧历史面板。
- 文件历史和逐行追踪现在各自使用请求序号，只允许最后一次请求写回面板。
- README 和继续开发文档同步说明快速切换文件时只保留最后选择的结果。

### Testing
- 修复前用前端函数 harness 先调用 `openFileHistory("a.txt")` 再调用 `openFileHistory("b.txt")`，模拟 `a.txt` 慢返回、`b.txt` 快返回；最终 `state.fileHistory.file` 和数据都被旧的 `a.txt` 覆盖。
- 修复后复跑同一 harness，最终 `state.fileHistory.file = b.txt`，数据也为 `b.txt`，旧的 `a.txt` 返回没有再次渲染。
- 逐行追踪使用同样乱序 harness 验证，最终 `state.fileBlame.file = b.txt`，数据也为 `b.txt`，旧请求没有覆盖最后选择。

### Notes
- `public/js/core.js`：新增文件历史和逐行追踪请求序号。
- `public/js/panels/inspector.js`：文件历史和逐行追踪写回前校验请求序号，丢弃过期响应。
- `README.md`：补充快速切换文件时历史和逐行追踪只显示最后选择结果。
- `docs/CONTINUE.md`：记录文件历史和逐行追踪乱序请求保护。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/panels/inspector.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复分支比较快速切换乱序覆盖
### What was done
- 复现连续打开两个比较目标时，后选择的比较先返回并显示后，较慢返回的旧比较请求会再次覆盖右侧比较页。
- 比较页现在使用请求序号，只允许最后一次比较请求写回结果和选中文件。
- README 和继续开发文档同步说明快速切换比较目标时只保留最后选择的结果。

### Testing
- 修复前用前端函数 harness 先调用 `openCompareBranch("slow-head", "main")` 再调用 `openCompareBranch("fast-head", "main")`，模拟 `slow-head` 慢返回、`fast-head` 快返回；最终 `state.compare.head`、数据和 `selectedCompareFile` 都被旧的 `slow-head` 覆盖。
- 修复后复跑同一 harness，最终 `state.compare.head = fast-head`，数据也为 `fast-head`，`selectedCompareFile = fast-head.txt`，旧的 `slow-head` 返回没有再次渲染。

### Notes
- `public/js/core.js`：新增比较页请求序号。
- `public/js/features/commit-actions.js`：比较结果写回前校验请求序号，丢弃过期响应。
- `README.md`：补充快速切换比较目标时只显示最后选择的比较结果。
- `docs/CONTINUE.md`：记录分支比较乱序请求保护。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/commit-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复右侧刷新面板慢返回覆盖当前引用
### What was done
- 复现分支整理刷新从 `branch-a` 发出后，用户已经切到 `branch-b`，慢返回的旧刷新仍会把 `selectedRef` 和页面数据拉回 `branch-a`。
- 分支整理、工作树、子模块和操作日志刷新现在会记录发起时的引用；如果返回时当前引用已变化，就丢弃旧响应。
- README 和继续开发文档同步说明刷新类面板不会把页面拉回旧分支。

### Testing
- 修复前用前端函数 harness 调用 `refreshBranchCleanup()` 后立即把 `selectedRef` 改为 `branch-b`；旧请求返回后 `selectedRef` 和数据都变回 `branch-a`，并触发 `renderAll`、`renderInspector` 和“分支整理已刷新”提示。
- 修复后复跑同一 harness，`selectedRef` 保持 `branch-b`，旧请求不再渲染或提示。
- 另用同样模式验证 `refreshWorktreeDashboard()`、`refreshSubmodules()` 和 `refreshLogsTab()`，旧响应都不会覆盖 `branch-b`。
- 贴近真实切换的 harness 同时把 `state.data.repo.selectedRef` 改成 `branch-b`，旧刷新返回后数据仍保持 `branch-b`。

### Notes
- `public/js/panels/workspaces.js`：分支整理、工作树和子模块刷新写回前校验当前引用是否仍是请求发起时的引用。
- `public/js/panels/recovery-settings.js`：操作日志刷新写回前校验当前引用。
- `README.md`：补充刷新类面板不会把页面拉回旧分支。
- `docs/CONTINUE.md`：记录右侧刷新类面板的旧响应丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/panels/workspaces.js`、`public/js/panels/recovery-settings.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复目录选择弹窗快速切换乱序覆盖
### What was done
- 复现路径选择弹窗先加载 `C:/slow`、马上加载 `D:/fast` 时，`D:/fast` 先显示后会被慢返回的 `C:/slow` 覆盖。
- 目录浏览现在使用请求序号，只允许最后一次 `loadFolder` 请求写回目录列表；旧错误也不会覆盖新目录。
- README 和继续开发文档同步说明快速切换目录时只保留最后选择结果。

### Testing
- 修复前用前端函数 harness 先调用 `loadFolder("C:/slow")` 再调用 `loadFolder("D:/fast")`，模拟 `C:/slow` 慢返回、`D:/fast` 快返回；最终 `state.folderBrowse.current` 和路径输入框都被旧的 `C:/slow` 覆盖。
- 修复后复跑同一 harness，最终 `state.folderBrowse.current = D:/fast`，路径输入框也保持 `D:/fast`。
- 另验证旧错误不会覆盖新成功：`C:/broken` 慢返回错误、`D:/fast` 快返回成功时，最终仍显示 `D:/fast`，不会显示“旧目录读取失败”或弹出旧错误 toast。

### Notes
- `public/js/core.js`：新增目录浏览请求序号。
- `public/js/features/folder-command.js`：目录浏览成功和失败写回前校验请求序号，丢弃过期响应。
- `README.md`：补充路径选择弹窗快速切换目录时只显示最后选择结果。
- `docs/CONTINUE.md`：记录目录弹窗旧请求和旧错误不会覆盖当前目录。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/folder-command.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复连续打开仓库乱序覆盖
### What was done
- 复现先打开 `slow-repo`、马上打开 `fast-repo` 时，`fast-repo` 先显示后会被慢返回的 `slow-repo` 覆盖。
- 打开仓库现在使用请求序号；旧的 `/api/open` 返回和旧的二次 `/api/state` 返回都不会写回页面。
- README 和继续开发文档同步说明连续打开多个仓库时只保留最后一次打开结果。

### Testing
- 修复前用前端函数 harness 先调用 `openRepo("slow-repo")` 再调用 `openRepo("fast-repo")`，模拟 `slow-repo` 的 `/api/open` 慢返回；最终仓库路径、选中引用和提交都被旧的 `slow-repo` 覆盖。
- 修复后复跑同一 harness，最终保持 `fast-repo`、`fast-repo-main` 和 `fast-repo-head`，没有保存、提示或恢复 `slow-repo`。
- 另验证旧请求卡在二次 `/api/state` 阶段的情况：`slow-repo` 的 `/api/open` 先返回但 `/api/state` 慢返回，随后 `fast-repo` 完成打开；最终仍保持 `fast-repo`，旧的 `slow-repo` 状态不会覆盖。

### Notes
- `public/js/core.js`：新增打开仓库请求序号。
- `public/js/features/repositories.js`：`openRepo` 和 `applyOpenedRepoData` 写回前校验请求序号，丢弃过期打开请求。
- `README.md`：补充连续打开多个仓库时只保留最后一次打开结果。
- `docs/CONTINUE.md`：记录打开仓库旧请求不会覆盖当前仓库。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/repositories.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复克隆和初始化自动打开乱序覆盖
### What was done
- 复现克隆或初始化选择“完成后打开”时，如果用户在操作完成前又手动打开其他仓库，较慢返回的旧自动打开会覆盖当前仓库。
- 克隆和初始化现在复用打开仓库请求序号；只有仍是最后一次打开意图时，才把返回的仓库状态写回页面。
- README 和继续开发文档同步说明克隆/初始化旧自动打开不会覆盖后来手动打开的仓库。

### Testing
- 克隆自动打开 harness：先提交克隆并模拟慢返回，再手动打开 `fast-repo`；修复后最终保持 `fast-repo`、`fast-repo-main` 和 `fast-repo-head`，旧的 `clone-repo` 没有覆盖当前页面。
- 初始化自动打开 harness：先提交初始化并模拟慢返回，再手动打开 `fast-repo`；修复后最终保持 `fast-repo`、`fast-repo-main` 和 `fast-repo-head`，旧的 `init-repo` 没有覆盖当前页面。

### Notes
- `public/js/features/repositories.js`：克隆和初始化自动打开写回前校验打开仓库请求序号，过期结果不再保存最近仓库或改写路径输入框。
- `README.md`：补充克隆/初始化自动打开不会覆盖后来手动打开的仓库。
- `docs/CONTINUE.md`：记录克隆/初始化期间手动打开其他仓库时的旧自动打开丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/repositories.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧工作区刷新覆盖新仓库
### What was done
- 复现工作区刷新请求仍在等待时，用户打开另一个仓库，旧 `/api/worktree` 返回会把新仓库的变更文件列表覆盖成旧仓库结果。
- 工作区刷新现在记录请求发起时的仓库路径；返回或报错时如果当前仓库路径已经变化，就丢弃旧结果和旧错误。
- README 和继续开发文档同步说明切换仓库期间旧工作区自动刷新不会覆盖新仓库变更列表。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 发起 `refreshWorktree(true)`，随后当前状态切到 `new-repo`；旧请求返回 `old-after.txt` 后，最终 `new-repo` 的 `workingFiles` 被覆盖成 `old-after.txt`。
- 修复后复跑同一 harness，最终仍保持 `new-repo` 和 `new-before.txt`，旧请求没有触发 `renderWorkingFiles` 或 `renderStage`。
- 旧请求报错路径也用 harness 验证：仓库已切到 `new-repo` 后，旧错误不会弹出 toast。

### Notes
- `public/js/features/diff-workbench.js`：工作区刷新写回和错误提示前校验当前仓库路径，丢弃旧仓库响应。
- `README.md`：补充切换仓库期间旧工作区自动刷新不会覆盖新仓库变更列表。
- `docs/CONTINUE.md`：记录旧工作区刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/diff-workbench.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧文件动作刷新覆盖新仓库
### What was done
- 复现单文件暂存/取消暂存/丢弃等工作区文件动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/worktree` 会覆盖新仓库的变更文件列表。
- 文件动作现在记录发起时的仓库路径；动作结果、错误提示和工作区刷新写回前都会确认仍在同一仓库。
- 批量文件动作在仓库切走后会停止后续文件循环，避免继续使用旧文件列表对当前仓库发动作。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `runSingleFileAction("stageFile", "a.txt")`，随后当前状态切到 `new-repo`；旧 `/api/worktree` 返回 `old-after.txt` 后，最终 `new-repo` 的 `workingFiles` 被覆盖成 `old-after.txt`。
- 修复后复跑同一 harness，最终仍保持 `new-repo` 和 `new-before.txt`，旧刷新没有触发 `syncFileSelectionAfterAction`、`renderWorkingFiles` 或 `renderStage`。
- 旧动作在切仓库后才返回的 harness 中，不会弹出旧仓库的完成提示。
- 批量动作 harness 中，第一项动作返回后仓库切到 `new-repo`，后续旧文件动作停止执行，最终只发送 1 次文件动作请求，按钮恢复可用。

### Notes
- `public/js/features/git-actions.js`：工作区文件动作发起时记录仓库路径，并在动作结果、错误提示、批量循环和 `/api/worktree` 写回前校验当前仓库仍一致。
- `README.md`：补充旧文件动作刷新不会覆盖新仓库变更列表。
- `docs/CONTINUE.md`：记录旧文件动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/git-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧储藏动作覆盖新仓库
### What was done
- 复现储藏应用/弹出/删除动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 储藏动作现在记录发起时的仓库路径；动作结果、错误提示和状态写回前都会确认仍在同一仓库。
- 从储藏创建分支也加上同样保护，旧 `result.state` 不会覆盖新仓库页面。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `runStashAction("apply", "stash@{0}")`，随后当前状态切到 `new-repo`；旧 `/api/state` 返回后，最终页面仓库变回 `old-repo`，储藏列表变成 `old-stash`。
- 修复后复跑同一 harness，最终仍保持 `new-repo`、`new-main` 和 `new-stash`，旧状态没有触发 `renderAll`。
- 旧储藏动作在切仓库后才返回的 harness 中，不会弹出旧仓库的完成提示。
- 从储藏创建分支 harness 中，旧 `result.state` 返回后仍保持 `new-repo` 和 `new-main`，不会写回旧仓库的分支和储藏列表。

### Notes
- `public/js/core.js`：新增仓库路径快照和当前仓库校验 helper，供多个前端模块复用。
- `public/js/features/git-actions.js`：改用共享仓库路径校验 helper，保留上一轮文件动作防护。
- `public/js/panels/sync.js`：储藏动作和从储藏创建分支写回前校验当前仓库路径。
- `README.md`：补充旧储藏动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧储藏动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/core.js`、`public/js/features/git-actions.js`、`public/js/panels/sync.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧同步和远端动作覆盖新仓库
### What was done
- 复现同步动作执行后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 同步、提交、冲突继续/中止、upstream 和远端管理动作现在都会记录发起时的仓库路径；动作结果、错误提示和状态写回前都会确认仍在同一仓库。
- 远端测试成功或失败返回时也会校验当前仓库，旧仓库的 `remoteCheck` 不会污染新仓库同步页。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `runAction("fetch")`，随后当前状态切到 `new-repo`；旧 `/api/state` 返回后，最终页面仓库变回 `old-repo`，选中引用和提交也变回旧仓库。
- 修复后复跑同一 harness，最终仍保持 `new-repo`、`new-main` 和 `new-head`，旧状态没有触发 `renderAll`、`loadCommit` 或 `renderInspector`。
- 旧同步动作在切仓库后才返回的 harness 中，不会弹出旧仓库的完成提示。
- 远端测试 harness 中，旧 `testRemote` 结果在切到 `new-repo` 后返回时，`state.remoteCheck` 仍保持 `null`，不会显示旧仓库诊断结果。
- upstream 状态刷新 harness 中，旧状态返回后仍保持 `new` 仓库和原右侧页签，不会切到旧仓库同步页。

### Notes
- `public/js/features/git-actions.js`：同步/提交、冲突继续/中止、upstream 和远端动作写回前校验当前仓库路径，远端测试结果也不再跨仓库写 `remoteCheck`。
- `README.md`：补充旧同步/远端动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧同步/远端动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/git-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 阻止 Git 操作运行中切换仓库导致命令落到错误仓库
### What was done
- 复现后端使用全局 `currentRepo` 时，同一个动作前半段在旧仓库执行，用户切换仓库后，动作后半段会使用新的 `currentRepo`，存在把写入命令执行到错误仓库的致命风险。
- 后端现在在有 Git 动作运行时拒绝 `/api/open` 切换仓库；正在切换仓库时也拒绝新的 Git 动作。
- 会切换仓库的动作（打开工作树、克隆后打开、初始化后打开）不能和其他动作并发，避免中途改写全局仓库上下文。

### Testing
- 修复前用后端时序 harness 模拟 `currentRepo = repo-A` 的动作先执行 `first`，随后 `currentRepo` 切到 `repo-B`，动作后半段 `dangerous-write` 实际记录为 `repo-B:dangerous-write`。
- 修复后用锁行为 harness 验证：有操作运行时切仓库会被拒绝；切仓库进行中启动新动作会被拒绝；会切仓库的动作与其他动作并发会被拒绝；已有切仓库动作时启动普通动作会被拒绝。
- 会切仓库动作识别 harness 验证：`cloneRepository` / `initRepository` 默认会切仓库，`openAfter:false` 时不标记为切仓库，`openWorktree` 会切仓库，`fetch` 不会切仓库。
- `node --check server.js`、`node --check public/js/core.js`、`node --check public/js/features/git-actions.js`、`node --check public/js/panels/sync.js` 均通过。

### Notes
- `server.js`：新增仓库切换锁和动作并发校验，阻止运行中 Git 动作与仓库切换交叉执行。
- `README.md`：说明有 Git 操作运行时会暂时阻止切换仓库。
- `docs/CONTINUE.md`：记录后端仓库切换锁行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧历史和 reset 动作刷新覆盖新仓库
### What was done
- 复现 reset、历史编辑、挑选和还原等高风险动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 历史编辑队列、单条历史编辑、cherry-pick、revert 和 reset 现在都会记录发起时的仓库路径；动作结果、错误提示和状态刷新写回前都会确认仍在同一仓库。
- 统一的历史动作刷新逻辑在加载提交详情后也会再次校验仓库路径，避免旧提交详情刷新新仓库右侧栏。

### Testing
- 修复前用前端函数 harness 模拟旧历史动作 `reloadAfterHistoryAction()` 发出 `/api/state`，随后当前状态切到 `new` 仓库；旧状态返回后，最终页面仓库变回 `old`，选中引用和提交也变回旧仓库。
- 修复后复跑同一 harness，最终仍保持 `new`、`new` 引用和 `new-head`，没有触发旧仓库 `renderAll`。
- reset 动作结果在切仓库后才返回的 harness 中，不会弹出旧仓库的 reset 完成提示。
- `node --check public/js/features/commit-actions.js`、`node --check public/js/core.js`、`node --check server.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：高风险历史/reset 类动作和统一刷新逻辑写回前校验当前仓库路径。
- `README.md`：补充旧历史/reset 动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧历史/reset 动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/features/commit-actions.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧恢复点和引用日志动作刷新覆盖新仓库
### What was done
- 复现恢复点恢复、引用日志恢复等高风险动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 恢复点清理、批量删除、单个删除、恢复点恢复、引用日志创建恢复点和引用日志恢复现在都会记录发起时的仓库路径；动作结果、错误提示和状态刷新写回前都会确认仍在同一仓库。
- 操作日志页刷新也增加仓库路径校验，避免同名分支下旧仓库日志刷新覆盖新仓库右侧栏。

### Testing
- 修复前用前端函数 harness 模拟旧恢复点动作发出 `/api/state`，随后当前状态切到 `new` 仓库；旧状态返回后，最终页面仓库变回 `old`，选中引用和提交也变回旧仓库。
- 修复后复跑同一 harness，最终仍保持 `new`、`new` 引用和 `new-head`；旧状态没有触发新页面渲染。
- 引用日志恢复 harness 中，旧 `restoreReflogEntry` 结果在切到 `new` 后返回时，没有触发旧仓库渲染。
- 旧恢复点动作在切仓库后才返回的 harness 中，不会弹出旧仓库的恢复完成提示。
- `node --check public/js/panels/recovery-settings.js`、`node --check public/js/features/commit-actions.js`、`node --check public/js/core.js` 均通过。

### Notes
- `public/js/panels/recovery-settings.js`：恢复点和引用日志类动作写回前校验当前仓库路径。
- `README.md`：补充旧恢复点动作刷新不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录旧恢复点/引用日志动作刷新响应的丢弃行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在 `public/js/panels/recovery-settings.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧分支、Tag、worktree、子模块和补丁动作覆盖新仓库
### What was done
- 复现分支切换动作完成后，如果用户已经打开另一个仓库，旧动作随后读取的 `/api/state` 会把页面切回旧仓库状态。
- 分支切换、远端分支签出、合并、变基、创建储藏、恢复签出储藏和修改提交信息现在会记录发起时的仓库路径；动作结果、错误提示、提交详情加载和状态写回前都会确认仍在同一仓库。
- 本地/远端分支删除、批量删除已合并分支、创建/重命名分支、清理 worktree、创建 worktree、子模块操作、Tag 推送/删除和应用补丁也加上同样保护。
- 右侧分支整理、工作树和子模块刷新现在同时校验仓库路径和选中引用，避免同名分支下旧仓库刷新覆盖新仓库页面。

### Testing
- 修复前用前端函数 harness 模拟 `old-repo` 执行 `checkoutBranch("feature")`，随后当前状态切到 `repo-B`；旧 `/api/state` 返回后，最终页面仓库变回 `repo-A/feature`。
- 修复后复跑同一 harness，最终仍保持 `repo-B/dev`，旧状态没有覆盖 `state.data`、`selectedRef` 或 `selectedSha`。
- 另用同类 harness 验证 `deleteBranch("feature")` 和 `runTagAction("deleteRemote", "v1")`，旧动作返回后仍保持 `repo-B/dev`，Tag 选择保持新仓库的 `v2`。
- `node --check public/js/core.js`、`node --check public/js/features/git-actions.js`、`node --check public/js/features/branches.js`、`node --check public/js/panels/workspaces.js`、`node --check public/js/panels/recovery-settings.js` 和 `node --check public/js/features/repositories.js` 均通过；`git diff --check` 通过；`D:\桌面\GitTest` 保持 `123` 分支且工作区干净。

### Notes
- `public/js/core.js`：新增按仓库路径加载状态和渲染选中提交的共享 helper。
- `public/js/features/git-actions.js`：为分支切换、合并/变基、储藏恢复、创建储藏、提交信息填充和修改提交信息加仓库路径校验。
- `public/js/features/branches.js`：为分支创建、重命名、本地/远端删除和清理失效 worktree 记录加仓库路径校验。
- `public/js/panels/workspaces.js`：为分支整理刷新、批量删分支、worktree 和子模块动作加仓库路径校验。
- `public/js/panels/recovery-settings.js`：为 Tag 推送/删除动作加仓库路径校验。
- `public/js/features/repositories.js`：为应用补丁后的状态刷新加仓库路径校验。
- `README.md`：补充切换仓库期间旧分支/Tag/worktree/子模块/补丁动作不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录本轮旧仓库响应丢弃范围。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在上述文件和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧创建弹窗和右键菜单上下文残留
### What was done
- 复现创建 Tag 动作完成后，如果用户已经打开另一个仓库，旧动作的状态刷新会把页面拉回旧仓库，甚至出现旧仓库路径搭配新仓库提交 SHA 的错位状态。
- 复现打开新仓库后，旧仓库分支创建弹窗、Tag 创建弹窗保存的旧提交 SHA 和旧分支名仍留在状态里，用户继续提交时可能把旧目标带到新仓库。
- 创建 Tag 现在使用仓库路径快照，旧动作返回、旧错误和旧状态刷新不会覆盖新仓库页面。
- 打开新仓库时会清空分支创建/重命名、Tag 创建、merge 提交主线选择弹窗，以及提交、分支、文件、Tag、远端和 reflog 右键菜单上下文。

### Testing
- 修复前用前端函数 harness 模拟 `repo-A` 执行 `createTagFromForm()`，随后当前状态切到 `repo-B`；旧 `/api/state` 返回后，页面仓库变回 `repo-A`，但 `selectedSha` 保留 `repo-B` 的 `new-b`。
- 修复后复跑同一 harness，最终保持 `repo-B/dev`，`selectedTag` 没有被旧 Tag 写入。
- 打开仓库状态清理 harness 验证：`tagTargetSha`、`branchStartSha`、`branchRenameOld`、`mainlineAction`、`mainlineCommitSha` 和全部右键菜单上下文都会清空，分支/Tag/mainline 弹窗和右键菜单会关闭。
- `node --check public/js/features/commit-actions.js`、`node --check public/js/features/repositories.js` 和 `node --check public/js/features/branches.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：创建 Tag 后刷新状态前校验当前仓库路径。
- `public/js/features/repositories.js`：打开新仓库时清空旧仓库弹窗状态和右键菜单上下文。
- `public/js/features/branches.js`：关闭分支弹窗时同步清空分支弹窗状态。
- `README.md`：补充打开新仓库会清空旧仓库弹窗和右键菜单上下文。
- `docs/CONTINUE.md`：记录切仓库时旧上下文清理行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前仅反向删除本轮在上述文件和本日志块中的新增内容；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时后端状态读取混入两个仓库
### What was done
- 复现 `/api/state` 读取过程中如果用户切到另一个仓库，后端前半段 Git 输出来自旧仓库，后半段仓库路径、同步状态和子模块补充信息可能来自新仓库。
- 全量状态、轻量引用状态和工作区状态读取现在会在请求开始时保存仓库路径，后续 Git 命令、远端校验、引用日志、子模块补充和同步详情都使用同一个路径。
- 远端分支、远端详情、reflog、子模块和同步状态等读取 helper 增加仓库路径参数，避免内部再次读取已变化的全局仓库路径。

### Testing
- 最小后端模型复现旧行为：请求从 `repo-A` 开始后切到 `repo-B`，旧结果会返回 `repo.path = repo-B`，但分支输出仍是 `repo-A:branches`。
- 修复后复跑同一模型，结果保持 `repo.path = repo-A`、分支输出为 `repo-A:branches`、同步状态也来自 `repo-A`。
- `node --check server.js` 通过。

### Notes
- `server.js`：状态读取链路改为使用请求发起时的仓库路径快照。
- `README.md`：补充后端状态读取不会混入两个仓库的数据。
- `docs/CONTINUE.md`：记录后端状态读取的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧提交详情、文件历史、逐行追踪和比较结果覆盖新仓库
### What was done
- 复现比较、文件历史和提交详情请求发出后，如果用户先切到另一个仓库，旧仓库请求返回时仍会写入新仓库页面。
- 比较页、文件历史、逐行追踪和提交详情加载现在会记录请求发起时的仓库路径；返回或报错时如果当前仓库已经变化，就丢弃旧结果。
- 打开新仓库时同步清空还在加载中的提交详情标记，避免旧仓库的提交详情请求阻塞新仓库同 SHA 的详情加载。
- 后端提交详情、补丁导出、文件历史、逐行追踪和比较接口也改为使用请求发起时的仓库路径快照，避免同一次响应混入两个仓库的数据。

### Testing
- 前端竞态 harness 复现旧行为：`openCompareBranch()` 发起于 `repo-A` 后切到 `repo-B`，旧比较结果仍写入 `state.compare`；`openFileHistory()` 发起于旧仓库后切到 `repo-C`，旧历史提交仍写入新仓库面板。
- 修复后复跑同一 harness，旧比较、旧文件历史和旧提交详情都被丢弃，没有写入新仓库状态。
- 后端 VM harness 验证：`readCompare("main", "feature")` 发起于 `repo-A` 后把全局 `currentRepo` 改成 `repo-B`，所有 Git 调用仍只使用 `repo-A`，返回的 SHA 和文件列表也来自 `repo-A`。
- `node --check server.js`、`node --check public/js/features/commit-actions.js`、`node --check public/js/features/graph.js`、`node --check public/js/features/repositories.js` 和 `node --check public/js/panels/inspector.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：比较请求写回前校验仓库路径。
- `public/js/features/graph.js`：提交详情请求写回和错误提示前校验仓库路径。
- `public/js/features/repositories.js`：打开新仓库时清空提交详情加载标记。
- `public/js/panels/inspector.js`：文件历史和逐行追踪请求写回前校验仓库路径。
- `server.js`：提交详情、补丁、文件历史、逐行追踪和比较读取链路使用仓库路径快照。
- `README.md`：补充切换仓库期间旧历史读取不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录历史读取接口的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧工作区 Diff 和储藏详情覆盖新仓库
### What was done
- 复现工作区 Diff 请求发出后，如果用户先切到另一个仓库，旧仓库 Diff 返回时仍会写入新仓库底部对照面板。
- 复现储藏详情请求发出后切换仓库，旧仓库的 `stash@{0}` 文件列表和 Diff 仍可能写入新仓库；打开新仓库时也没有清空旧储藏详情缓存。
- 工作区 Diff 和储藏详情加载现在会记录请求发起时的仓库路径，返回或报错时如果当前仓库已经变化，就丢弃旧结果。
- 打开新仓库时会清空储藏详情缓存和当前选中储藏，避免两个仓库都有同名 `stash@{0}` 时复用旧详情。
- 后端工作区 Diff 和储藏详情读取会使用请求发起时的仓库路径快照，避免一次响应混入两个仓库的数据。

### Testing
- 前端竞态 harness 复现旧行为：`loadWorkingDiff("old.txt")` 发起于 `repo-A` 后切到 `repo-B`，旧 Diff 仍写入 `activeDiff`；`loadStashDetail("stash@{0}")` 发起于 `repo-C` 后切到 `repo-D`，旧储藏文件仍写入 `stashDetails`。
- 修复后复跑同一 harness，旧工作区 Diff 和旧储藏详情都被丢弃，没有写入新仓库状态。
- 后端 VM harness 验证：`readWorkingDiff("file.txt", "unstaged")` 和 `readStash("stash@{0}")` 都在请求发起后把全局 `currentRepo` 改成 `repo-B`，所有 Git 调用仍只使用 `repo-A`。
- `node --check server.js`、`node --check public/js/features/diff-workbench.js`、`node --check public/js/features/repositories.js` 和 `node --check public/js/panels/sync.js` 均通过。

### Notes
- `public/js/features/diff-workbench.js`：工作区 Diff 请求写回和错误提示前校验仓库路径。
- `public/js/panels/sync.js`：储藏详情请求写回和错误提示前校验仓库路径。
- `public/js/features/repositories.js`：打开新仓库时清空储藏详情缓存和选中储藏。
- `server.js`：工作区 Diff、未跟踪文件虚拟 Diff 和储藏详情读取链路使用仓库路径快照。
- `README.md`：补充切换仓库期间旧工作区 Diff 和旧储藏详情不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录工作区 Diff 和储藏详情读取的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复普通 Git 写操作可并发执行的问题
### What was done
- 复现后端只拦截切仓库类动作并发，普通写动作可以同时进入 `/api/action`：例如 `stageAll` 仍在运行时，`commit` 可以被允许启动。
- 后端现在只要已有 Git 操作正在运行，就拒绝新的 Git 操作；切仓库类动作仍保留“暂不能切换仓库”的明确提示，普通动作返回“暂不能执行新的 Git 操作”。
- 这个后端保护覆盖浏览器连点、多个页面同时操作和脚本直接调用，避免多个命令同时修改索引或工作区状态。

### Testing
- 修复前 VM harness：先 `beginOperation({ action: "stageAll" })`，再启动 `commit`，`ensureCanStartAction()` 返回允许，`activeOperations` 同时有 2 个操作。
- 修复后同一 harness：第二个普通写动作被拒绝，提示“当前还有 Git 操作正在执行，暂不能执行新的 Git 操作...”。
- 另用 VM harness 验证：已有普通操作时再启动 `openWorktree`，仍返回原来的“暂不能切换仓库”提示。
- `node --check server.js` 通过。

### Notes
- `server.js`：`ensureCanStartAction` 改为串行化所有 Git 操作。
- `README.md`：补充有 Git 操作运行时会阻止新的 Git 操作。
- `docs/CONTINUE.md`：记录后端操作串行化行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在 `server.js`、`README.md`、`docs/CONTINUE.md` 和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧历史重写预览覆盖新仓库
### What was done
- 复现历史重写单项预览和队列预览请求发出后，如果用户切到另一个仓库，旧仓库预览仍可能写入新仓库详情页。
- 历史重写单项预览和队列预览现在都会记录请求发起时的仓库路径；返回或报错时如果当前仓库已经变化，就丢弃旧结果。
- 后端历史重写单项预览和队列预览会使用请求发起时的仓库路径快照，提交解析、当前分支、未提交状态、父提交、影响范围和 merge 检查都固定在同一个仓库。

### Testing
- 旧逻辑形状 harness 复现：`historyPlan` 只校验 SHA/mode、`historyQueue` 只校验队列签名时，切到新仓库后旧预览仍写入当前状态。
- 修复后前端 harness 验证：旧单项历史重写预览和旧队列预览返回时都被丢弃，没有写入新仓库页面。
- 后端 VM harness 验证：`readHistoryRewritePreview()` 和 `readHistoryRewriteQueuePreview()` 发起于 `repo-A` 后把全局 `currentRepo` 改成 `repo-B`，所有 Git 调用仍只使用 `repo-A`。
- `node --check server.js` 和 `node --check public/js/features/commit-actions.js` 均通过。

### Notes
- `public/js/features/commit-actions.js`：历史重写单项预览和队列预览写回前校验仓库路径。
- `server.js`：历史重写预览读取链路和相关 helper 支持仓库路径快照。
- `README.md`：补充切换仓库期间旧历史重写预览不会覆盖新仓库页面。
- `docs/CONTINUE.md`：记录历史重写预览的仓库快照行为。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。

## 2026-07-03 - Task: 修复切换仓库时旧提交补丁复制下载结果泄漏
### What was done
- 复现提交补丁复制和下载请求发出后，如果用户切到另一个仓库，旧仓库补丁仍可能写入剪贴板或触发下载。
- 复制补丁和下载补丁现在会记录请求发起时的仓库路径；返回时如果当前仓库已经变化，就丢弃旧结果。
- 该保护避免用户在新仓库页面里误拿到旧仓库的 `.patch` 内容。

### Testing
- 旧逻辑形状 harness 复现：旧补丁请求返回时，`copyCommitPatch()` 会复制旧补丁，`downloadCommitPatch()` 会下载旧补丁。
- 修复后 Node harness 验证：切到 `repo-B` 后，`repo-A` 的旧复制和下载结果均被丢弃，输出 `{"copyDiscarded":true,"downloadDiscarded":true}`。
- `node --check server.js`、`node --check public/js/features/commit-actions.js`、`node --check public/js/features/diff-workbench.js`、`node --check public/js/features/graph.js`、`node --check public/js/features/repositories.js`、`node --check public/js/panels/inspector.js`、`node --check public/js/panels/sync.js` 均通过。
- `git diff --check` 通过，仅提示工作副本未来会按 Git 设置转为 CRLF。
- 调试标记扫描无命中。

### Notes
- `public/js/features/commit-actions.js`：补丁复制和下载写入前校验仓库路径。
- `README.md`：补充补丁复制/下载在切仓库时丢弃旧结果。
- `docs/CONTINUE.md`：记录旧提交补丁复制/下载结果不会覆盖新仓库页面。
- `progress.md`：追加本轮复现、修复和验证记录。
- 回滚方式：提交前反向删除本轮在上述文件和本日志块中的改动；提交后可用 `git revert <本次提交>` 回滚。
