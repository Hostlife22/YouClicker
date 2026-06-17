# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

YouClicker Personal is an Electron desktop app that translates a YouTube video's **title, description, and subtitles** into many languages. There is no credit/payment system: translation runs on the user's own **local Claude Code** subscription through `@anthropic-ai/claude-agent-sdk` (it shells out to the signed-in `claude` CLI), and YouTube access runs on the user's own Google Cloud OAuth client. See `README.md` for the one-time Google Cloud / OAuth setup.

## Commands

```bash
npm run dev        # Vite + Electron with hot reload (sets VITE_DEV_SERVER_URL)
npm run build      # tsc -b && vite build && electron-builder
npm run build:mac  # same, produces a .dmg (arm64 + x64)
npm run typecheck  # tsc -b --noEmit — run this to verify type correctness
npm run preview    # vite preview (renderer only)
```

There is **no test runner, linter, or formatter configured** — `typecheck` is the only automated gate. Verify changes by running `npm run typecheck` and `npm run dev`.

## Architecture

Three TypeScript layers, wired together by a single typed IPC contract.

### The IPC contract is the spine
`shared/api.ts` defines the `Api` type and `ProgressEvent`. Three files must stay in lockstep when you add or change any cross-process call:
1. `shared/api.ts` — the `Api` type (the contract)
2. `electron/preload.ts` — implements `Api` via `ipcRenderer.invoke`, exposed as `window.api` through `contextBridge`
3. `electron/main.ts` — `registerIpc()` wires each channel string (e.g. `"youtube:videos"`) to a main-process function

The renderer reaches the contract through `src/api.ts` (`api()` → typed `window.api` accessor). `contextIsolation` is on and `nodeIntegration` is off, so the renderer can only touch the main process through this bridge — never import `electron`/`googleapis`/`keytar`/Node modules from `src/`.

### Main process (`electron/`, Node)
- `main.ts` — BrowserWindow + `registerIpc()`. Loads `VITE_DEV_SERVER_URL` in dev, `dist/index.html` in prod.
- `oauth.ts` — **multi-account** Google OAuth via a loopback `http` server on a random port (`127.0.0.1:<port>/oauth/callback`), CSRF-protected with a `state` nonce. One shared OAuth client (id/secret in settings) authorizes many Google accounts: `addAccount()` runs the flow with `prompt: 'select_account consent'` and stores that account's **refresh token in keytar keyed by `refresh:<email>`**; the **email list lives in `Settings.accounts`** (non-secret). `getAuthClient(email)` caches an `OAuth2Client` per account in a `Map`. `removeAccount(email)` clears keytar + settings + cache; `migrateLegacyAccount()` upgrades the old single-account layout on startup.
- `cache.ts` — persisted TTL cache (`electron-store`, `youclicker-cache`) for read-only YouTube responses. Keys are **namespaced by account** (`channels:<email>`, `videos:<email>:…`, `video:<email>:…`, `captions:<email>:…`); writes invalidate the affected keys. Exists for UX latency, not quota.
- `youtube.ts` — YouTube Data API v3 wrapper (`googleapis`). Every call takes the acting account's email as its first arg. `listAllChannels()` aggregates channels across all connected accounts and is **tolerant of one account failing** (expired token → reported in `errors`, not thrown). Videos are listed via the channel's uploads playlist, then hydrated with `videos.list part=snippet,localizations`. `updateVideoLocalizations` **merges** new localizations into existing ones (never replaces the map). Each `Channel` carries `accountId` (its owning email).
- `translator.ts` — all Claude Agent SDK calls go through `runClaude()` (model `claude-haiku-4-5-20251001`, `maxTurns: 1`, no tools, `bypassPermissions`). Change the model constant here to use Sonnet. Structured outputs (title/description JSON, cue-batch JSON) are wrapped in `stripJsonFences()` + `JSON.parse`, with a defensive fallback (two-shot for title/description).
- `subtitles.ts` — SRT parse/serialize + batched translation. **Timecodes are parsed in code and never sent to the model**; only `{i, t}` cue text is. Cues are translated in batches of 40, concurrency 3, reassembled by index.
- `orchestrator.ts` — the multi-language job runner invoked by the `translate:*` IPC handlers. Fans out across `targetLanguages` and `emit()`s `ProgressEvent`s to all windows over the `"translation:progress"` channel. Title/description runs concurrently (PQueue, concurrency 3) then writes once; subtitles run sequentially per language (skipping the source language).
- `store.ts` — non-secret `Settings` persistence via `electron-store` with a JSON schema, including the `accounts` list (connected Google emails). **OAuth client id/secret are settings here; refresh tokens are NOT — those are keytar, one per account.**

### Renderer (`src/`, React 19)
- `App.tsx` — a `switch` over `screen` is the entire router; no react-router. Screens live in `src/screens/`.
- `store.ts` — zustand global store holding `screen`, `settings`, auth, selected channel/video/languages, and live `progress`. Navigation = `setScreen(...)`.
- `i18n.ts` + `src/i18n/*.json` — react-i18next, UI languages `en/de/fr/uk/ru` (default `ru`). This is **UI chrome translation**, distinct from the Claude-powered content translation.

### Shared (`shared/`)
`types.ts` (domain types), `api.ts` (IPC contract), `languages.ts` (~110 target content languages + the 5 UI languages; `findLanguage(code)` is used to build translation prompts).

## Conventions

- Path aliases: `@/` → `src/`, `@shared/` → `shared/` (defined in `vite.config.ts` and the tsconfigs).
- The build externalizes native/Node deps (`electron`, `keytar`, `electron-store`, `googleapis`, `@anthropic-ai/claude-agent-sdk`) — keep these in the main process only.
- The preload is emitted as **`preload.cjs`** (CommonJS, inlined); `main.ts` references it by that exact name.
- Errors thrown across IPC are surfaced by string code (`MISSING_OAUTH_CREDENTIALS`, `NOT_AUTHENTICATED`, `NO_SOURCE_CAPTIONS`, `CUE_TRANSLATION_PARSE_FAILED`, etc.) — the renderer keys off these. Preserve the codes when refactoring.
- Logging uses `electron-log/main` in the main process.

## Important constraints

- **YouTube quota** is ~10,000 units/day per project: `videos.update` ≈ 50, `captions.insert` ≈ 400. Subtitle uploads are the expensive path — be mindful when batching languages.
- In OAuth "Testing" publishing mode, refresh tokens expire every 7 days; the app re-prompts sign-in when that happens.
- Captions: the source track is chosen by source language → first `standard` track → first available. Source-language targets are skipped, not re-translated.
