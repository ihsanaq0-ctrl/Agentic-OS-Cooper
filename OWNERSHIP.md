# Agentic OS — Ownership Guide (Ihsan Ullah)

This system now belongs to **Ihsan Ullah** (Peshawar, Pakistan). The old owner's
API keys and all their data have been removed. This file explains how to make it
fully yours.

---

## 1. Status: what was done

- **Old API keys cleared** — `FIRECRAWL_API_KEY`, `OPENROUTER_API_KEY`,
  `ZERNIO_API_KEY` in `content-os/.env` were emptied. Nothing of the previous
  owner is used anymore.
- **All previous-owner data wiped** — sources, articles, drafts, scheduled
  posts, connected social accounts, Gmail tokens, mail, transactions, and
  tasks were deleted from `content-os/data/content-os.sqlite`.
- **Personalized defaults** (code + live database):
  - Timezone: `Asia/Karachi`
  - Currency: `PKR` (expenses/mail/ledger), locale `en-PK`
  - Niche keywords: AI, machine learning, multi-agent systems, RAG, LLM,
    AI security, agentic AI, automation, LLM agents
  - Brand voice: "Ihsan Ullah — AI/ML engineer based in Peshawar, Pakistan..."
  - Jarvis now knows it serves Ihsan and speaks about his domain.
- **India traces removed** — no `Asia/Kolkata`, no `₹`, no `en-IN` anywhere in
  the app or the `.cursor` skill docs.

---

## 2. Add YOUR API keys (required for the app to work)

The dashboard works, but scraping/AI/publishing are disabled until you add your
own keys. Open `content-os/.env` in any editor and fill these three:

| Key | Where to get it (your own account) |
|-----|-------------------------------------|
| `FIRECRAWL_API_KEY` | https://firecrawl.dev → Sign up → Dashboard → API key (free tier) |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys → Sign up → Create key (free models available) |
| `ZERNIO_API_KEY` | https://zernio.com → Sign up → Dashboard → API key (IG/LinkedIn/X publishing) |

Example:

```env
FIRECRAWL_API_KEY=fc-your-key
OPENROUTER_API_KEY=sk-or-your-key
ZERNIO_API_KEY=zn-your-key
```

**Never commit `.env` to git** (it's already gitignored). Add real keys only in
your local `.env` or the hosting panel.

Optional (free) extras:

- **Gmail ledger** (mail + auto-expense extraction): Google Cloud console →
  enable Gmail API → create OAuth client (`GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`), redirect `http://localhost:3950/api/gmail/callback`.

---

## 3. Restart after adding keys

```bash
cd content-os
npm start          # then open http://localhost:3950
```

The header pill will show `firecrawl ✓  openrouter ✓  zernio ✓` once detected.

---

## 4. Tip: stuck "database is locked"?

This app's WASM SQLite locks the DB with a `content-os.sqlite.lock` folder.
If you ever see `database is locked` at startup and **no** server is running,
delete that folder and restart:

```bash
cd content-os/data
rm -rf content-os.sqlite.lock
```

---

## 5. What Ihsan-specific content is in the system

- Jarvis persona: serves Ihsan Ullah, AI/ML engineer, Peshawar, Pakistan;
  knows about GhostForge AI, Agentic OS, YTForge.
- Feed ranking: tuned to your niche (multi-agent systems, RAG, AI security...).
- Brand voice: grounded, engineering-focused, no hype.
- Timezone: PKT; dates/amounts render in Pakistan format.
