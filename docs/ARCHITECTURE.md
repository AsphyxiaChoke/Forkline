# Forkline Frontend Architecture

## Current Layers

- `public/js/core.js`: shared state, storage keys, constants, DOM handles, and the `window.Forkline` namespace.
- `public/js/api.js`: shared API request wrapper. It exposes `Forkline.api`.
- `public/app.js`: legacy feature implementation. New feature work should avoid growing this file unless the change belongs to existing legacy code.
- `public/js/bootstrap.js`: startup sequence. It exposes `Forkline.start` and starts the app after all scripts are loaded.
- `public/index.html`: static markup and ordered script loading.
- `public/styles.css`: current global stylesheet.

## Loading Order

`index.html` must load scripts in this order:

1. `js/core.js`
2. `js/api.js`
3. `app.js`
4. `js/bootstrap.js`

The feature code still uses legacy global names during the transition. The shared objects are also available through `window.Forkline` so later modules can depend on a stable namespace instead of adding new globals.

## Next Split Targets

- Move self-contained right-panel pages into `public/js/panels/`, starting with settings, logs, stashes, and recovery.
- Move repository path/recent-repository behavior into `public/js/repositories/`.
- Move Git action orchestration into `public/js/actions/`.
- Move graph rendering and search rendering into `public/js/history/`.

Each migration should keep the old behavior working, update this document if the loading order changes, and add matching notes to `progress.md`.
