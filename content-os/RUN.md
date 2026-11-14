# How to Run Content Agent OS

This guide covers running **Content Agent OS** — the agentic content system that
scrapes RSS feeds and URLs, AI-ranks articles, generates posts with 4:3 images,
and schedules them to Instagram, LinkedIn, and X via Zernio.

---

## 0. Important: run from `content-os/`, not the repo root

This repository is a **monorepo** — the app lives in the `content-os/` folder.
Always `cd content-os` first. Running `npm start` from the repo root starts a
wrapper that resolves paths relative to the app folder, and mixing the two
causes exactly the "database is locked" confusion below.

## 1. Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | **20 or newer** (ESM app) | `node --version` |
| npm | ships with Node | `npm --version` |

On Windows: install from https://nodejs.org (LTS 20+). No compilers, `make`,
or native build tools are needed — the SQLite driver is pure WebAssembly
(`node-sqlite3-wasm`), so installs work on any machine, including shared hosting.

> **Windows + PowerShell note:** if `npm` fails with
> `running scripts is disabled on this system`, either run it via
> `cmd.exe /c "npm start"` or allow scripts once:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

---

## 2. First-time setup (do once)

```bash
# 1) Enter the app directory (the app lives in content-os/, not the repo root)
cd content-os

# 2) Create the .env file from the template
cp .env.example .env
# Windows (PowerShell):
#   Copy-Item .env.example .env

# 3) Install dependencies
npm install
```

### Required API keys (`.env`)

The app **starts without keys**, but the matching feature will return a clear
"not configured" error until the key is set:

| Key | Where to get it | Needed for |
|-----|-----------------|------------|
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys | AI ranking, caption edits, image generation |
| `FIRECRAWL_API_KEY` | https://firecrawl.dev | scraping arbitrary URLs / web search |
| `ZERNIO_API_KEY` | https://zernio.com dashboard | publishing to Instagram / LinkedIn / X |

Optional but useful:

| Key | Purpose |
|-----|---------|
| `PUBLIC_BASE_URL` | public URL of this app — used for the Zernio OAuth callback + webhook. `http://localhost:3950` is fine for local dev (use an ngrok/tunnel for OAuth flows) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail integration on the HUD dashboard (needs OAuth setup in Google Cloud Console) |
| `DEFAULT_FRESHNESS_HOURS` | freshness window for the feed (default `24`) |
| `OPENROUTER_TEXT_MODEL` / `OPENROUTER_IMAGE_MODEL` | model selection (overridable in Settings) |
| `DEFAULT_TIMEZONE` | e.g. `Asia/Karachi` |
| `PORT` | dashboard port (default `3950`) |

Never commit your real `.env` — it is gitignored.

---

## 3. Run it

### Local / dev

```bash
npm start        # production-ish run → http://localhost:3950
npm run dev      # dev mode: auto-restart on file changes (node --watch)
```

Open **http://localhost:3950** in your browser. You should see the dark
dashboard with **Sources**, **Feed**, **Studio**, **Schedule**, and
**Settings** tabs.

> Only **one instance** may run at a time — the SQLite database can't be
> shared. A second `npm start` now exits immediately with a clear message
> instead of crashing with "database is locked".

### If startup fails: run the fixer

```powershell
powershell -ExecutionPolicy Bypass -File .\fix-content-os.ps1
```

It checks the port, removes a stale `.lock` left by a killed instance, and
tells you the exact command to start fresh. Safe to re-run any time.

> First boot creates `data/content-os.sqlite` (SQLite DB) and
> `storage/images/` automatically. Both are gitignored and hold all state.

### Production (PM2 — what the Hostinger VPS uses)

```bash
npm ci --omit=dev                      # clean install, prod deps only
pm2 start ecosystem.config.cjs         # starts server/index.js, restarts on crash
pm2 save                               # persist the process list
pm2 startup                            # keep alive across reboots (follow printed command)

pm2 logs content-os                    # watch logs
pm2 restart content-os                 # restart
pm2 stop content-os                    # stop
```

### Verify the integrations (uses your `.env` keys)

```bash
npm run test:apis
```

Probes Firecrawl (scrape), OpenRouter (models + tiny chat), and Zernio
(profiles, accounts, connect URLs, media presign), printing a pass/fail line
per service.

---

## 4. Using the app (quick tour)

1. **Sources** — add a feed URL (or search phrase), set the interval and topic
   tags. `Auto-detect` tries RSS first, falls back to Firecrawl.
2. **Feed** — articles ranked 0–100 by AI, newest-and-highest first. Hit
   **Make post** to start a draft.
3. **Studio** — edit the caption, refine with the agent, generate a 4:3 image
   (every edit is versioned).
4. **Schedule** — pick connected accounts and a time (or publish now); the post
   goes out to all selected platforms in one call.
5. **Settings** — connect Instagram / LinkedIn / X via Zernio OAuth, choose AI
   models, set freshness window, niche keywords, brand voice, timezone.

Notes on Zernio accounts:

- Accounts are grouped under a **profile**; the app auto-creates and caches your
  default profile — no manual management needed.
- **Instagram** requires a Business or Creator account; **LinkedIn** connects a
  profile or company page.
- **X** requires a payment method on your Zernio account first (API pass-through
  costs) — otherwise the connect call returns `PAYMENT_REQUIRED`. IG and
  LinkedIn have no such requirement.
- After OAuth, click **Sync accounts** in Settings.
- Webhook endpoint for publish status: `POST {PUBLIC_BASE_URL}/api/webhooks/zernio`.

---

## 5. Troubleshooting

| Problem | Fix |
|---------|-----|
| `listen EADDRINUSE :::3950` | Another instance is running. Find and kill it: `lsof -i :3950` (mac/Linux) or PowerShell: `Get-NetTCPConnection -LocalPort 3950` then `Stop-Process <PID>`. Or change `PORT` in `.env`. |
| `SQLite3Error: database is locked` at startup | A second instance is running, or a stale lock remains from a killed instance. Fix: `powershell -ExecutionPolicy Bypass -File .\fix-content-os.ps1`, then start from `content-os/`. Or manually: kill the other instance (`Stop-Process <PID>`), `Remove-Item data\content-os.sqlite.lock -Recurse -Force`, start again. Never delete `content-os.sqlite` itself — it holds all state. |
| `npm start` says "already running (PID N)" | Good — that's the new guard. One instance may use the DB at a time. Open http://localhost:3950, or stop the other instance first. |
| `npm` fails: "running scripts is disabled" (PowerShell) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or run `cmd.exe /c "npm start"`. |
| `sqlite3 wasm` can't open existing DB | If migrating a `better-sqlite3` DB that was in WAL mode, convert once before first boot: `sqlite3 data/content-os.sqlite "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;"` then delete `-wal` / `-shm` files. Fresh deployments need none of this. |
| Scrape/rank/publish errors say "not configured" | The matching API key is missing in `.env` — restart after adding it. |
| Scrapes are slow | Lower `SCRAPE_CONCURRENCY` in `.env` (default 5). |
| OAuth callback fails | `PUBLIC_BASE_URL` must match the redirect URI registered with the provider (e.g. Zernio, Google). |

---

## 6. Where things live

```
content-os/
├── server/
│   ├── index.js              # Express routes
│   ├── config.js             # .env loader + config
│   ├── db.js                 # SQLite schema + all CRUD
│   ├── sse.js                # per-job + global event streams
│   ├── jobRunner.js          # collect → dedup → rank, p-queue
│   ├── sourceScheduler.js    # per-source hours/days/months scheduler
│   ├── collectors/           # rss.js, firecrawl.js, index.js (dispatcher)
│   ├── ai/                   # openrouter.js, rankArticles.js, contentAgent.js
│   ├── prompts/rank.md       # editable ranking prompt
│   ├── zernio.js             # connect, accounts, media, posts
│   └── webhooks/zernio.js    # publish status callbacks
├── public/                   # index.html, styles.css, app.js (SPA frontend)
├── deploy/nginx.conf.example # reverse-proxy config (VPS)
├── ecosystem.config.cjs      # PM2 process definition
├── data/                     # SQLite (gitignored)
└── storage/images/           # generated 4:3 images (gitignored)
```
