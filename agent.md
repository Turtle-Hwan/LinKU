# Agent Instructions

## Repo

- This repo is a `React + Vite + TypeScript` `Chrome Extension (MV3)`.
- It builds both the popup UI and the background service worker.
- `gh-pages` output is mainly for static assets/banner hosting, not the main app runtime.

## Build

- For local verification, prefer `pnpm run dev` or `pnpm run build:local && pnpm run preview`.
- Prefer `build:local` over `build` when you only need local checks.
- `pnpm run build` updates the manifest version, so do not use it as the default local smoke-test command.

## Testing

Always check whether the required local server is already running before starting tests.

- If the server is already running and reusable, reuse the existing server.
- If the server is already running but cannot be reused safely, stop that process first and then start a fresh server.
- If the server is not running, start a new server before testing.
- Decide first whether you are testing `dev` or `preview`, then only manage the server for that mode.
- For local UI checks, at minimum verify initial render, the `Todo List` tab, and the absence of runtime console errors.
- In local web mode, `Todo/eCampus` may use sample fallback data instead of real external responses.

When running automated or manual tests, prefer this order:

1. Check whether the expected port/process is already active.
2. Reuse the existing server when it matches the needed command and environment.
3. If reuse is not possible, terminate the stale/conflicting server process.
4. Start the correct server.
5. Run the test only after confirming the server is reachable.

## Guardrails

- In local web runtime, assume extension APIs may be unavailable; prefer shared wrappers and environment guards over direct `chrome.*` access.
- Do not confuse extension-only behavior with local web verification behavior.
- Treat production/real extension flows separately from local fallback flows such as the current `Todo/eCampus` sample mode.
- Local web runtime skips Google Analytics event sending.
