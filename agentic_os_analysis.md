# Agentic OS — Repository & Architecture Breakdown

Agentic OS (also referred to as **Content Agent OS**) is a self-hosted personal dashboard and content automation cockpit. It bridges web ingestion, AI-driven content ranking/synthesis, social media scheduling, personal task tracking, and email-based automated financial analysis.

---

## 1. High-Level Architecture

The platform runs as a Node.js monorepo containing a full-stack SPA and specialized development skills:

```
                  ┌──────────────────────────────────────────────┐
                  │              Web Browser (SPA)               │
                  │   (Vanilla JS + Three.js Jarvis HUD + CSS)   │
                  └──────────────────────┬───────────────────────┘
                                         │ REST / SSE
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          Express.js Web Server               │
                  └──────────────────────┬───────────────────────┘
                                         │
                  ┌──────────────────────┴───────────────────────┐
                  │                 Services                     │
                  │   ┌──────────────────────────────────────┐   │
                  │   │   SQLite DB (WASM virtual system)    │   │
                  │   ├──────────────────────────────────────┤   │
                  │   │   OpenRouter AI Integration          │   │
                  │   │   - Chat (Jarvis, Studio agent)      │   │
                  │   │   - Image Gen (DALL-E 3, Gemini)     │   │
                  │   │   - Speech (Whisper, Kokoro TTS)     │   │
                  │   ├──────────────────────────────────────┤   │
                  │   │   Ingestion & Collectors             │   │
                  │   │   - RSS Feeds / Firecrawl Scraper    │   │
                  │   │   - Perplexity Sonar Web Research    │   │
                  │   ├──────────────────────────────────────┤   │
                  │   │   Financial Ledger                   │   │
                  │   │   - Gmail OAuth Ingest               │   │
                  │   │   - LLM Transaction Extractor        │   │
                  │   ├──────────────────────────────────────┤   │
                  │   │   Social Publishing (Zernio)         │   │
                  │   │   - Instagram, LinkedIn, X/Twitter   │   │
                  │   └──────────────────────────────────────┘   │
                  └──────────────────────────────────────────────┘
```

---

## 2. Key Technology Stack

* **Frontend SPA**: Vanilla JavaScript, Custom CSS styling, Google Fonts, and **Three.js** to render a 3D responsive rotating globe representing the Jarvis AI node.
* **Server**: Node.js (ESM) + Express.js.
* **Database**: SQLite backed by `node-sqlite3-wasm`.
  > [!NOTE]
  > Using a pure WebAssembly VFS for SQLite avoids native C++ binary builds (like `better-sqlite3`), meaning this entire system can run seamlessly on any platform, including VPS and shared PHP/Node hosting providers (like Hostinger).
* **AI Provider**: **OpenRouter** API. It acts as a single gateway for multiple models:
  * Fast conversational chat (Gemini 2.5 Flash)
  * Smart agentic reasoning & tool-calling (Claude 3.5 Sonnet / GPT-4o)
  * Web research (Perplexity Sonar)
  * Voice transcription (Whisper Large)
  * Natural Text-to-Speech (Kokoro 82m)
  * Image generation (Gemini Image, DALL-E)
* **Scraping**: `rss-parser` (for RSS/Atom feeds) and **Firecrawl** (for JS-rendered page scraping).
* **Social Scheduling Gateway**: **Zernio API** (provides hosted OAuth credentials, media uploading, and single-payload multi-platform scheduling).

---

## 3. Core Functions & Capabilities

### A. JARVIS AI Assistant (HUD Panel)
* **Voice & Text Control**: Tap the rotating globe to speak instructions (transcribed via Whisper). Jarvis can reply with synthesized voice (via Kokoro TTS) or text.
* **Tool-Capable Agent**: Jarvis has direct access to system-level database and web search APIs. It can:
  * Query your financial stats.
  * Scan and list recent email summaries.
  * Create, check off, or reopen tasks.
  * Perform ad-hoc web research.
  * Draft ready-to-post social copy or generate custom aspect-ratio graphics.

### B. Ingestion & AI Priority Feed
* **Multi-Format Ingestion**: Register ingestion sources (arbitrary web pages, RSS feeds, or topic search queries) to run at intervals (hours, days, months) or cron schedules.
* **AI Article Ranker**: A background worker scrapes new sources, computes dedup hashes, runs an LLM parser to rate the article out of 100 based on your target *niche keywords*, explains the score, and recommends a *posting angle* customized to your *brand voice*.
* **Bypass Freshness**: Let's you filter the article feed by date/freshness windows (e.g. within 24h) or toggle it off to view historical indexed items.

### C. Content Studio
* **Content Generation**: Turn shortlisted articles into social media drafts.
* **Refining Agent**: Tell the editor agent to rewrite captions (e.g. *"shorten this and make the CTA stronger"*). The editor keeps a version snapshot history of all changes.
* **AI Graphic Design**: Generate custom aspect ratio banners (`1:1`, `4:5`, `3:4`, `9:16`, `4:3`, `16:9`) with structured information on your topic.

### D. Multi-Platform Publishing
* **OAuth Connections**: Sync accounts through Zernio for Instagram (Creator/Business), LinkedIn (Page/Profile), and X/Twitter.
* **One-Click Scheduling**: Automatically upload draft graphics to the media gateway, select target accounts, set a scheduled posting time, and publish to all platforms in one call.

### E. Financial Ledger & Expense Extractor
* **Gmail Sync**: Securely connect a Google account.
* **Automated Bookkeeping**: Background workers scan emails matching financial criteria (`receipt`, `invoice`, `paid`, `salary`, `debited`, etc.) and feed them into a transactional transaction extractor.
* **Categorized Ledger**: Transactions are classified (expense vs income), categorized (Food, Bills, Shopping, Transfer, Travel, etc.), and currency-converted.
* **Financial Charts**: The HUD displays clean summaries, net gains, and category charts for arbitrary timeframes (day, week, month, year).

### F. Minimal Task Tracker
* Keep track of daily objectives. Tasks are editable, priority-sorted, and manageable directly via conversational commands to Jarvis.

---

## 4. Codebase Directory Map

```
agentic-os-personal/
├── .cursor/skills/                   # Project Cursor automation rules
│   ├── hostinger-deploy/             # MCP commands to deploy to Hostinger VPS
│   ├── scraper-intake/               # Ingest routing guidelines (script vs dashboard)
│   ├── scraper-dashboard/            # UI browser queues/exports
│   ├── scraper-script/               # Headless scraping templates
│   └── scraper-kit/                  # Proxies, User-Agents, anti-bot rules
│
├── content-os/                       # Main application workspace
│   ├── data/                         # Persistent SQLite DB folder (gitignored)
│   ├── storage/images/               # Generated draft graphics (gitignored)
│   ├── deploy/                       # System configuration files (e.g., Nginx config)
│   ├── public/                       # Front-end Assets
│   │   ├── hud/                      # HUD logic & Three.js Rotating Globe
│   │   ├── index.html                # Main SPA markup layout
│   │   ├── styles.css                # Dark-theme command dashboard styling
│   │   └── app.js                    # SPA state-router and controller
│   ├── scripts/                      # Integration self-tests
│   └── server/                       # Backend Application Logic
│       ├── ai/                       # OpenRouter LLM, STT, TTS, and Image executors
│       ├── collectors/               # Firecrawl and RSS scraping scrapers
│       ├── google/                   # Google OAuth client & Gmail fetchers
│       ├── webhooks/                 # Zernio publishing updates callback endpoint
│       ├── db.js                     # Schema and CRUD operations (SQLite)
│       ├── index.js                  # Express endpoints, routing, and scheduler
│       ├── jobRunner.js              # Concurrency-throttled queue for scrapes
│       ├── sourceScheduler.js        # Scheduled polling daemon
│       └── zernio.js                 # Zernio account, media, and post dispatch
│
├── package.json                      # Monorepo dependencies & scripts
└── server.js                         # Root entrypoint
```

---

## 5. Summary of API Endpoints

| Category | Endpoint | Method | Description |
|---|---|---|---|
| **Health** | `/api/health` | GET | Server state, queue size, and platform status |
| **Settings** | `/api/settings` | GET/PUT | Retrieve / update model parameters and timezone configurations |
| **Sources** | `/api/sources` | GET/POST | Fetch and register new web/RSS monitoring streams |
| **Sources** | `/api/sources/:id/run` | POST | Force manual run of an ingestion queue |
| **Research** | `/api/research` | POST | Instant ad-hoc Perplexity search without saving a source |
| **Jobs** | `/api/jobs` | GET | List historical and active scrape job logs |
| **Events**| `/api/events` | GET | SSE stream broadcasting global update ticks |
| **Articles** | `/api/articles` | GET | Fetch scraped items (with priority scoring) |
| **Articles** | `/api/articles/rank` | POST | Request AI ranking for unrated posts |
| **Drafts** | `/api/drafts` | GET/POST | Manage social media copy drafts |
| **Drafts** | `/api/drafts/:id/refine` | POST | Request the editing agent to refine the copy |
| **Drafts** | `/api/drafts/:id/image` | POST | Trigger background image generation |
| **Accounts** | `/api/accounts/connect/:platform` | GET | Get Zernio OAuth URL for LinkedIn, IG, or X |
| **Accounts** | `/api/accounts/sync` | POST | Re-fetch linked profiles from Zernio |
| **Publishing** | `/api/drafts/:id/schedule` | POST | Send media & copy scheduling requests to Zernio |
| **Tasks** | `/api/tasks` | GET/POST | HUD task list management |
| **Gmail** | `/api/gmail/connect` | GET | Generate Google OAuth link for Gmail readonly scopes |
| **Expenses** | `/api/expenses/sync` | POST | Trigger transaction scanner on connected Gmail inbox |
| **Expenses** | `/api/expenses` | GET | Fetch grouped transaction analytics and histories |
| **Jarvis** | `/api/assistant/chat` | POST | Post chat queries to Jarvis |
| **Jarvis** | `/api/assistant/stream`| POST | Streamed assistant responses (emits NDJSON events) |
| **Jarvis** | `/api/assistant/transcribe`| POST | Audio transcription (Whisper) |
| **Jarvis** | `/api/assistant/speak` | POST | Text-to-Speech audio synthesis (Kokoro) |
