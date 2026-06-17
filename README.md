# YouClicker Personal

Personal Electron port of YouClicker — translates YouTube **title, description, and subtitles** into many languages. No credits, no subscription. Translation is done by your **local Claude Code** subscription via the Claude Agent SDK.

## Requirements

- macOS (or any platform Electron 33 supports)
- Node.js ≥ 20
- A working `claude` CLI (Claude Code) signed in on your machine — the app shells out to it through `@anthropic-ai/claude-agent-sdk`
- A free Google Cloud project with a YouTube Data API v3 OAuth client

## Install & run

```bash
npm install
npm run dev        # dev with hot reload
npm run build:mac  # produce a .dmg in release/
```

## One-time Google Cloud setup

1. Go to <https://console.cloud.google.com/> and create a new project.
2. In **APIs & Services → Library**, enable **YouTube Data API v3**.
3. In **APIs & Services → OAuth consent screen**:
   - User type: **External**, Publishing status: **Testing** is fine
   - Add your own Google account as a test user
   - Add scopes: `youtube.readonly`, `youtube.force-ssl`, `youtube.upload`
4. In **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app**
   - Copy the **Client ID** and **Client Secret**
5. Open the app → ⚙ Settings → paste Client ID + Client Secret → Save.
6. On the Login screen, click **Sign in with Google** — your browser opens, you approve, the app stores a refresh token in your system keychain (via `keytar`).

> In Testing mode, refresh tokens expire every 7 days. The app will ask you to sign in again when that happens.

## How translation works

- **Title + description**: one prompt to Claude per language, written back via `videos.update part=localizations`.
- **Subtitles**: the existing caption track is downloaded as SRT, parsed, sent to Claude in JSON batches of 40 cues (timecodes stay in code, never in the model's context), reassembled, and uploaded as a new caption track per language via `captions.insert`.

The Claude model defaults to Haiku 4.5 — change it in `electron/translator.ts` if you want Sonnet for higher quality.

## Project layout

```
electron/         Main-process code (Node, runs in Electron main)
├── main.ts          Window + IPC registration
├── preload.ts       Renderer bridge (contextBridge)
├── oauth.ts         Google OAuth loopback + keytar storage
├── youtube.ts       YouTube Data API v3 wrapper
├── translator.ts    Claude Agent SDK calls
├── subtitles.ts     SRT parse/serialize + batched translation
├── orchestrator.ts  Multi-language job runner + IPC progress events
└── store.ts         Settings persistence (electron-store)

shared/           Code shared between main and renderer
├── types.ts         Domain types
├── api.ts           IPC bridge contract
└── languages.ts     ~110 target languages + 5 UI languages

src/              React renderer
├── App.tsx          Switch-based screen router
├── store.ts         zustand global UI state
├── api.ts           window.api typed accessor
├── i18n.ts          react-i18next setup
├── i18n/*.json      UI translations (en, de, fr, uk, ru)
├── components/      AppFrame (window chrome + footer)
├── screens/         7 screens mirroring the original app
└── styles.css       Tailwind 4 + dark theme tokens
```

## Quotas

YouTube Data API gives you ~10,000 units/day per project:

- `videos.update` ≈ 50 units
- `captions.insert` ≈ 400 units

That comfortably covers a few hundred title+description translations per day, or ~20 caption uploads. Plan accordingly.

## What is NOT cloned from the original

- Credit/balance/payment flow — there are no credits, everything runs on your own keys.
- The original's email/password login — only Google sign-in is supported.
- Telegram support group link — left as a generic footer placeholder.
