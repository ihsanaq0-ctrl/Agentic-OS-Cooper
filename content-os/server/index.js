import express from "express";
import { join } from "path";
import { readdirSync, existsSync } from "fs";
import { config, ROOT_DIR, serviceStatus } from "./config.js";
import {
  getAllSettings, setSetting,
  listSources, createSource, updateSource, deleteSource, getSource,
  listJobs, getJobWithDetails, recoverStaleJobs,
  listArticles, getArticle, setArticleStatus, getFreshnessHours,
  listDrafts, getDraft, createDraft, updateDraft, listVersions,
  addDraftImage, listDraftImages,
  listScheduledPosts, createScheduledPost, updateScheduledPost,
  listAccounts, upsertAccount, deleteAccount, getAccountById, getAccountByPlatform,
  createTask, listTasks, updateTask, deleteTask, getTask,
  getGmailTokens, clearGmailTokens,
  listMailMessages, getSetting,
  insertTransaction, listTransactions, sumByCategory, revenueVsExpense,
  insertArticle,
  createUser, listUsers, getUser, deleteUser, updateUserLogin, getUserCount, getAllFaceDescriptors,
} from "./db.js";
import { enqueueSourceJob, queueSize } from "./jobRunner.js";
import { subscribeJob, subscribeGlobal, broadcastGlobal } from "./sse.js";
import { startScheduler, computeNextRun, nextCronRun } from "./sourceScheduler.js";
import { collectResearch } from "./collectors/research.js";
import { generateCaption, refineCaption, generateDraftImage } from "./ai/contentAgent.js";
import { listImageModels, transcribeAudio, textToSpeech } from "./ai/openrouter.js";
import { rankPendingArticles } from "./ai/rankArticles.js";
import {
  linkedinConfigured, buildAuthUrl as buildLinkedInAuthUrl, exchangeCode as exchangeLinkedInCode, publishLinkedInPost,
} from "./publishers/linkedin.js";
import { telegramConfigured, publishTelegramPost } from "./publishers/telegram.js";
import {
  githubConfigured, buildAuthUrl as buildGithubAuthUrl, exchangeCode as exchangeGithubCode,
} from "./publishers/github.js";
import { discordConfigured, publishDiscordPost } from "./publishers/discord.js";
import { twitterConfigured, publishTwitterPost } from "./publishers/twitter.js";
import { generateBriefing, getOrGenerateBriefing } from "./ai/briefing.js";
import { markBriefingPlayed, listBriefings, getLatestBriefing } from "./db.js";
import { askAssistant, askAssistantStream } from "./ai/assistant.js";
import { buildAuthUrl, exchangeCode, gmailConfigured } from "./google/oauth.js";
import { syncMail, syncExpenses, startAutoSync } from "./autoSync.js";
import { isSystemModeEnabled } from "./system/controller.js";

import voiceRouter from "./routes/voice.js";
import { setupWebSocket } from "./websockets/stream.js";

import { generateCarouselContent, renderCarouselPdf } from "./ai/carousel.js";
import { parseBankStatementPdf } from "./ai/bankStatementParser.js";
import { registerBarehandsBridge, setRingState } from "./barehands-bridge.js";
import { registerJarvisCvBridge } from "./jarvis-cv-bridge.js";
import { registerJarvisFlowBridge } from "./jarvisflow-bridge.js";
import { registerIronHandsBridge } from "./ironhands-bridge.js";
import { registerGodsEyeBridge } from "./godseye-bridge.js";
import { registerGestureActionRoutes } from "./system/gestureActionRouter.js";
import { getAgentMemoryInfo, ensureAgentMemoryRunning } from "./system/agentmemoryService.js";
import { getOpenVikingInfo, ensureOpenVikingRunning } from "./system/openvikingService.js";
import { getVoiceStudioInfo, ensureVoiceStudioRunning } from "./system/voiceStudioService.js";
import { googleTtsConfigured } from "./ai/googleTts.js";
import { getUnifiedMemoryStatus, recall } from "./ai/memory.js";
import { generateDiagram } from "./ai/diagramGenerator.js";
import { runBrowserTask, getBrowserAgentStatus } from "./system/browserAgentBridge.js";
import { searchScientificLiterature, getScientificEngineStatus } from "./ai/scientificResearch.js";
import {
  getAuthStatus, isSystemLocked, lockSystem, unlockWithFace, unlockWithPin,
  triggerOpenBiometricPortal, getCurrentOperator, listEnrolledOperators,
} from "./system/security.js";

recoverStaleJobs();

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.static(join(ROOT_DIR, "public")));
app.use("/storage", express.static(join(ROOT_DIR, "storage")));

// Register Bare Hands gesture bridge
registerBarehandsBridge(app);

// Register Jarvis-CV Stark HUD & Sound Engine bridge
registerJarvisCvBridge(app);

// Register JarvisFlow Gesture Mind-Mapping bridge
registerJarvisFlowBridge(app);

// Register IronHands 3D Spatial Kinetic bridge
registerIronHandsBridge(app);

// Register God's Eye View Geospatial Intelligence bridge
registerGodsEyeBridge(app);

// Register Unified Hand Gesture System Action Controller
registerGestureActionRoutes(app);

// Mount Voice & Assistant Routes
app.use("/api", voiceRouter);

const ok = (res, data) => res.json(data);
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const asyncRoute = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => fail(res, 500, err.message));

// "Today" as a YYYY-MM-DD string in the configured timezone. Transaction
// occurred_at and task due_date are stored as date-only strings, so plain
// string comparison against these bounds is correct.
function todayISODate() {
  const tz = getAllSettings().timezone || config.defaults.timezone;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function shiftDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Number of days a range spans, ending today — used to size the Gmail
// `newer_than:Nd` window so a "Process" covers the whole selected period.
function daysForRange(range, customFrom, customTo) {
  const { from, to } = rangeToDates(range, customFrom, customTo);
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
}

// Resolve a range keyword (today|week|month|year|custom) into {from, to} dates.
function rangeToDates(range, customFrom, customTo) {
  const today = todayISODate();
  switch (range) {
    case "today": return { from: today, to: today };
    case "week": return { from: shiftDays(today, -6), to: today };
    case "year": return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom": return { from: customFrom || `${today.slice(0, 4)}-01-01`, to: customTo || today };
    case "month":
    default: return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

// ── Health ───────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => ok(res, {
  ok: true,
  time: new Date().toISOString(),
  services: serviceStatus(),
  queue: queueSize(),
  platforms: ["linkedin", "instagram", "twitter"],
  systemMode: isSystemModeEnabled(),
}));

// ── Settings ─────────────────────────────────────────────────────
app.get("/api/settings", (_req, res) => ok(res, getAllSettings()));

app.put("/api/settings", (req, res) => {
  const body = req.body || {};
  // Auto-update cadence: clamp to a whole number of hours, min 1 (0 = disabled).
  if ("auto_update_hours" in body) {
    const n = Math.floor(Number(body.auto_update_hours));
    body.auto_update_hours = Number.isFinite(n) && n > 0 ? String(Math.max(1, n)) : "0";
  }
  for (const [key, value] of Object.entries(body)) setSetting(key, value);
  ok(res, getAllSettings());
});

app.get("/api/models/images", asyncRoute(async (_req, res) => ok(res, await listImageModels())));

// ── Sources ──────────────────────────────────────────────────────
app.get("/api/sources", (_req, res) => ok(res, listSources()));

app.post("/api/sources", (req, res) => {
  const { name, url } = req.body || {};
  if (!url || String(url).trim().length < 2) return fail(res, 400, "URL or search query is required");
  const source = createSource({
    name: name?.trim() || String(url).trim(),
    url: String(url).trim(),
    type: req.body.type || "auto",
    interval_value: req.body.interval_value,
    interval_unit: req.body.interval_unit,
    topic_tags: req.body.topic_tags,
    freshness_override_hours: req.body.freshness_override_hours ?? null,
    enabled: req.body.enabled,
    cron_expression: req.body.cron_expression?.trim() || null,
    research_depth: req.body.research_depth,
  });
  const next = source.cron_expression
    ? (nextCronRun(source.cron_expression) || computeNextRun(new Date(), source.interval_value, source.interval_unit))
    : computeNextRun(new Date(), source.interval_value, source.interval_unit);
  updateSource(source.id, { next_run_at: next });
  res.status(201).json(getSource(source.id));
});

app.put("/api/sources/:id", (req, res) => {
  if (!getSource(req.params.id)) return fail(res, 404, "Source not found");
  ok(res, updateSource(req.params.id, req.body || {}));
});

app.delete("/api/sources/:id", (req, res) => {
  deleteSource(req.params.id);
  ok(res, { ok: true });
});

app.post("/api/sources/:id/run", (req, res) => {
  if (!getSource(req.params.id)) return fail(res, 404, "Source not found");
  const job = enqueueSourceJob(req.params.id, "manual");
  res.status(201).json(job);
});

// Ad-hoc "Research now" — research a query immediately via Perplexity Sonar,
// insert results into the feed, and rank, without saving a source.
app.post("/api/research", asyncRoute(async (req, res) => {
  const query = String(req.body?.query || "").trim();
  if (query.length < 2) return fail(res, 400, "A research query is required");
  const depth = req.body?.depth === "sonar-pro" ? "sonar-pro" : "sonar";
  const tags = Array.isArray(req.body?.topic_tags) ? req.body.topic_tags : [];
  const items = await collectResearch(query, { tags, depth });
  let added = 0;
  for (const it of items) {
    const r = insertArticle({ ...it, scraped_at: new Date().toISOString() });
    if (r.inserted) added += 1;
  }
  let ranked = 0;
  try { ranked = await rankPendingArticles(); } catch { /* ranking optional */ }
  ok(res, { found: items.length, added, ranked });
}));

// ── Jobs + live streams ──────────────────────────────────────────
app.get("/api/jobs", (_req, res) => ok(res, listJobs(50)));

app.get("/api/jobs/:id", (req, res) => {
  const job = getJobWithDetails(req.params.id);
  if (!job) return fail(res, 404, "Job not found");
  ok(res, job);
});

function sseHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

app.get("/api/jobs/:id/stream", (req, res) => { sseHeaders(res); subscribeJob(req.params.id, res); });
app.get("/api/events", (_req, res) => { sseHeaders(res); subscribeGlobal(res); });

// ── Articles (Feed) ──────────────────────────────────────────────
app.get("/api/articles", (req, res) => {
  const bypass = req.query.bypassFreshness === "true";
  const statuses = req.query.statuses ? String(req.query.statuses).split(",") : null;
  const withinHours = bypass ? null : getFreshnessHours();
  ok(res, listArticles({ withinHours, statuses, limit: 300 }));
});

app.post("/api/articles/rank", asyncRoute(async (_req, res) => {
  const count = await rankPendingArticles();
  ok(res, { ranked: count });
}));

app.post("/api/articles/:id/status", (req, res) => {
  const article = getArticle(req.params.id);
  if (!article) return fail(res, 404, "Article not found");
  const { status } = req.body || {};
  if (!["new", "shortlisted", "used", "dismissed"].includes(status)) {
    return fail(res, 400, "Invalid status");
  }
  ok(res, setArticleStatus(req.params.id, status));
});

// Create a draft from an article and optionally auto-generate a caption.
app.post("/api/articles/:id/draft", asyncRoute(async (req, res) => {
  const article = getArticle(req.params.id);
  if (!article) return fail(res, 404, "Article not found");
  let caption = "";
  if (req.body?.generate !== false && config.openrouterApiKey) {
    caption = await generateCaption(article.id, req.body?.platform || "general");
  }
  const draft = createDraft({ article_id: article.id, title: article.title, caption });
  setArticleStatus(article.id, "used");
  res.status(201).json(draft);
}));

// ── Drafts (Studio) ──────────────────────────────────────────────
app.get("/api/drafts", (_req, res) => ok(res, listDrafts()));

app.get("/api/drafts/:id", (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return fail(res, 404, "Draft not found");
  ok(res, { ...draft, versions: listVersions(draft.id), images: listDraftImages(draft.id) });
});

app.post("/api/drafts", (req, res) => {
  const draft = createDraft({
    title: req.body?.title,
    caption: req.body?.caption ?? "",
    article_id: req.body?.article_id ?? null,
  });
  res.status(201).json(draft);
});

app.put("/api/drafts/:id", (req, res) => {
  if (!getDraft(req.params.id)) return fail(res, 404, "Draft not found");
  ok(res, updateDraft(req.params.id, req.body || {}));
});

app.post("/api/drafts/:id/caption", asyncRoute(async (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return fail(res, 404, "Draft not found");
  if (!draft.article_id) return fail(res, 400, "Draft has no source article");
  const caption = await generateCaption(draft.article_id, req.body?.platform || "general");
  ok(res, updateDraft(draft.id, { caption }));
}));

app.post("/api/drafts/:id/refine", asyncRoute(async (req, res) => {
  const instruction = String(req.body?.instruction || "").trim();
  if (!instruction) return fail(res, 400, "Instruction is required");
  const caption = await refineCaption(req.params.id, instruction);
  ok(res, { caption, versions: listVersions(req.params.id) });
}));

// Supported output ratios — passed through verbatim to the image model.
const IMAGE_RATIOS = ["1:1", "4:5", "3:4", "4:3", "9:16", "16:9"];

// Image generation runs in the background so the "generating" state persists in
// the DB and survives refreshes. Progress is broadcast over SSE; the client can
// also poll GET /api/drafts/:id (image_status).
app.post("/api/drafts/:id/image", (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return fail(res, 404, "Draft not found");
  if (draft.image_status === "generating") return fail(res, 409, "An image is already generating for this draft");

  const aspectRatio = IMAGE_RATIOS.includes(req.body?.aspectRatio) ? req.body.aspectRatio : "1:1";
  const research = Boolean(req.body?.research);
  const customPrompt = req.body?.prompt;

  updateDraft(draft.id, { image_status: "generating" });
  broadcastGlobal({ type: "draft-image", draftId: draft.id, status: "generating" });

  (async () => {
    try {
      const r = await generateDraftImage(draft.id, customPrompt, { aspectRatio, research });
      addDraftImage(draft.id, { image_path: r.imagePath, prompt: r.prompt, aspect_ratio: aspectRatio });
      updateDraft(draft.id, { image_path: r.imagePath, image_prompt: r.prompt, image_status: "ready" });
      broadcastGlobal({ type: "draft-image", draftId: draft.id, status: "ready", imagePath: r.imagePath });
    } catch (err) {
      updateDraft(draft.id, { image_status: "failed" });
      broadcastGlobal({ type: "draft-image", draftId: draft.id, status: "failed", error: err.message });
    }
  })();

  res.status(202).json({ status: "generating", aspectRatio });
});

// ── PDF Carousel Generator (LinkedIn Document Slides) ───────────
app.post("/api/drafts/:id/carousel", asyncRoute(async (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return fail(res, 404, "Draft not found");

  const carouselData = await generateCarouselContent(draft.caption || draft.title || "AI Systems Architecture", {
    brandVoice: getAllSettings().brand_voice,
    numSlides: Number(req.body?.numSlides) || 5,
  });

  const r = await renderCarouselPdf(carouselData, { authorName: "IHSAN ULLAH" });
  updateDraft(draft.id, {
    image_path: r.relativePath,
    image_prompt: `Carousel: ${carouselData.title}`,
    image_status: "ready",
  });
  broadcastGlobal({ type: "draft-image", draftId: draft.id, status: "ready", imagePath: r.relativePath });
  ok(res, { ok: true, carouselPath: r.relativePath, title: carouselData.title, slides: carouselData.slides });
}));

// ── Accounts (Settings → connect LinkedIn / IG / X) ──────────────
app.get("/api/accounts", (_req, res) => {
  const accounts = listAccounts();
  const all = [...accounts];
  if (telegramConfigured() && !all.some((a) => a.platform === "telegram")) {
    all.push({
      id: "direct-telegram",
      platform: "telegram",
      display_name: config.telegramChannelId || "Telegram Channel",
      username: config.telegramChannelId || "Channel",
      status: "active",
    });
  }
  if (discordConfigured() && !all.some((a) => a.platform === "discord")) {
    all.push({
      id: "direct-discord",
      platform: "discord",
      display_name: "Discord Webhook",
      username: "Webhook",
      status: "active",
    });
  }
  if (twitterConfigured() && !all.some((a) => a.platform === "twitter")) {
    all.push({
      id: "direct-twitter",
      platform: "twitter",
      display_name: "X (Twitter)",
      username: "Direct API",
      status: "active",
    });
  }
  ok(res, all);
});

app.get("/api/accounts/connect/:platform", async (req, res) => {
  const platform = req.params.platform;
  try {
    if (platform === "linkedin") {
      if (linkedinConfigured()) {
        return ok(res, { url: buildLinkedInAuthUrl() });
      }
      return fail(res, 400, "LinkedIn direct API not configured — set LINKEDIN_CLIENT_ID in .env");
    }
    if (platform === "telegram") {
      if (telegramConfigured()) {
        return ok(res, { message: `Telegram channel ${config.telegramChannelId} is active.` });
      }
      return fail(res, 400, "Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env");
    }
    if (platform === "discord") {
      if (discordConfigured()) {
        return ok(res, { message: "Discord webhook is active." });
      }
      return fail(res, 400, "Discord not configured — set DISCORD_WEBHOOK_URL in .env");
    }
    if (platform === "twitter") {
      if (twitterConfigured()) {
        return ok(res, { message: "Twitter API credentials are active." });
      }
      return fail(res, 400, "Twitter not configured — set TWITTER_API_KEY, TWITTER_API_SECRET, etc. in .env");
    }
    if (platform === "github") {
      if (githubConfigured()) {
        return ok(res, { url: buildGithubAuthUrl() });
      }
      return fail(res, 400, "GitHub not configured — set GITHUB_CLIENT_ID in .env");
    }
    return fail(res, 400, `Direct integration for ${platform} is coming next.`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GitHub OAuth Callback
app.get("/api/auth/github/callback", asyncRoute(async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}#settings`);
  }
  if (!code) {
    return res.redirect("/?error=missing_code#settings");
  }
  try {
    await exchangeGithubCode(code);
    res.redirect("/?connected=github#settings");
  } catch (e) {
    res.redirect(`/?error=${encodeURIComponent(e.message)}#settings`);
  }
}));

// LinkedIn Direct OAuth Callback
app.get("/api/auth/linkedin/callback", asyncRoute(async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}#settings`);
  }
  if (!code) {
    return res.redirect("/?error=missing_code#settings");
  }
  try {
    await exchangeLinkedInCode(String(code));
    res.redirect("/?connected=linkedin#settings");
  } catch (err) {
    console.error("LinkedIn OAuth callback error:", err.message);
    res.redirect(`/?error=${encodeURIComponent(err.message)}#settings`);
  }
}));

app.post("/api/accounts/sync", asyncRoute(async (_req, res) => {
  ok(res, listAccounts());
}));

app.delete("/api/accounts/:id", (req, res) => {
  deleteAccount(req.params.id);
  ok(res, { ok: true });
});

// System Automation routes have been extracted to routes/voice.js

// ── Scheduling ───────────────────────────────────────────────────
app.get("/api/scheduled", (_req, res) => ok(res, listScheduledPosts()));

app.post("/api/drafts/:id/schedule", asyncRoute(async (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return fail(res, 404, "Draft not found");

  const { platforms, scheduledFor, publishNow } = req.body || {};
  if (!Array.isArray(platforms) || !platforms.length) {
    return fail(res, 400, "Select at least one platform/account");
  }

  const directResults = [];

  for (const p of platforms) {
    const acct = getAccountById(p.accountId) || (p.platform ? getAccountByPlatform(p.platform) : null);
    if (p.platform === "linkedin" && (acct?.access_token || linkedinConfigured())) {
      const pubRes = await publishLinkedInPost({
        accountId: acct?.id,
        content: draft.caption,
        mediaPath: draft.image_path,
      });
      directResults.push({ platform: "linkedin", id: pubRes.id, status: pubRes.status, url: pubRes.url });
    } else if (p.platform === "telegram" && telegramConfigured()) {
      const pubRes = await publishTelegramPost({
        content: draft.caption,
        mediaPath: draft.image_path,
      });
      directResults.push({ platform: "telegram", id: pubRes.id, status: pubRes.status, url: pubRes.url });
    } else if (p.platform === "discord" && discordConfigured()) {
      const pubRes = await publishDiscordPost({
        content: draft.caption,
        mediaPath: draft.image_path,
      });
      directResults.push({ platform: "discord", id: pubRes.id, status: pubRes.status, url: pubRes.url });
    } else if (p.platform === "twitter" && twitterConfigured()) {
      const pubRes = await publishTwitterPost({
        content: draft.caption,
        mediaPath: draft.image_path,
      });
      directResults.push({ platform: "twitter", id: pubRes.id, status: pubRes.status, url: pubRes.url });
    } else {
      return fail(res, 400, `Platform ${p.platform} requires direct configuration in .env.`);
    }
  }

  const primaryPostId = directResults[0]?.id || `post-${Date.now()}`;
  const overallStatus = "published";
  const publishedNames = directResults.map((r) => r.platform).join(", ");
  const detail = `Published directly to: ${publishedNames} (ID: ${primaryPostId})`;

  const scheduled = createScheduledPost({
    draft_id: draft.id,
    zernio_post_id: primaryPostId,
    scheduled_for: scheduledFor || new Date().toISOString(),
    timezone: getAllSettings().timezone,
    platforms,
    status: overallStatus,
    status_detail: detail,
  });
  updateDraft(draft.id, { status: overallStatus });
  res.status(201).json({ ...scheduled, results: directResults });
}));

// ── Proactive Briefings ──────────────────────────────────────────
app.get("/api/briefings/latest", asyncRoute(async (req, res) => {
  const type = req.query.type || "morning";
  const briefing = await getOrGenerateBriefing(type);
  ok(res, briefing);
}));

app.post("/api/briefings/generate", asyncRoute(async (req, res) => {
  const type = req.body?.type || "morning";
  const audio = req.body?.generateAudio !== false;
  const briefing = await generateBriefing(type, { generateAudio: audio });
  broadcastGlobal({ type: "briefing:ready", briefing });
  ok(res, briefing);
}));

app.post("/api/briefings/:id/played", (req, res) => {
  markBriefingPlayed(req.params.id);
  ok(res, { ok: true });
});

app.get("/api/briefings", (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 10);
  ok(res, listBriefings({ limit }));
});

// ── Local LLM (Ollama) Inspection ────────────────────────────────
app.get("/api/models/ollama", asyncRoute(async (_req, res) => {
  if (!config.ollamaBaseUrl) return ok(res, { available: false, models: [] });
  try {
    const baseUrl = config.ollamaBaseUrl.replace(/\/v1\/?$/, "");
    const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return ok(res, { available: false, models: [] });
    const data = await resp.json();
    ok(res, { available: true, models: data.models || [] });
  } catch {
    ok(res, { available: false, models: [] });
  }
}));

// ── Unified Cognitive Memory Status & Multi-Tier Search ───────────
app.get("/api/memory/status", asyncRoute(async (_req, res) => {
  const unified = await getUnifiedMemoryStatus();
  ok(res, unified);
}));

app.get("/api/memory/search", asyncRoute(async (req, res) => {
  const query = String(req.query.q || req.query.query || "").trim();
  if (!query) return fail(res, 400, "Query parameter 'q' is required");
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
  const hybrid = req.query.hybrid === "true" || req.query.hybrid === "1";
  const viking = req.query.viking === "true" || req.query.viking === "1";
  const results = await recall(query, {
    limit,
    hybrid,
    viking,
    targetUri: req.query.uri || undefined,
  });
  ok(res, { query, count: results.length, results });
}));

// ── VoiceStudio & Speech Engine Status ────────────────────────────
app.get("/api/speech/status", asyncRoute(async (_req, res) => {
  const vsInfo = await getVoiceStudioInfo();
  ok(res, {
    active_engine: vsInfo.alive ? "voicestudio" : "google_tts",
    voicestudio: vsInfo,
    google_tts: {
      configured: googleTtsConfigured(),
      voice: config.googleTtsVoice || "en-US-Journey-F",
    },
    cloud_fallback: {
      openrouter: Boolean(config.openrouterApiKey),
      groq_stt: Boolean(config.groqApiKey),
    },
  });
}));

// ── Editorial Vector Diagrams ─────────────────────────────────────
app.post("/api/diagrams/generate", asyncRoute(async (req, res) => {
  const { title, subtitle, type, nodes, links, layers, theme, projectOnStage } = req.body || {};
  if (!title) return fail(res, 400, "Title is required for diagram generation");
  const diagram = await generateDiagram({
    title,
    subtitle,
    type,
    nodes,
    links,
    layers,
    theme,
    projectOnStage: Boolean(projectOnStage),
  });
  ok(res, diagram);
}));

app.get("/api/diagrams", (_req, res) => {
  const dir = join(ROOT_DIR, "storage", "diagrams");
  if (!existsSync(dir)) return ok(res, []);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".html") || f.endsWith(".svg"))
    .map((f) => ({
      name: f,
      url: `/storage/diagrams/${f}`,
      isSvg: f.endsWith(".svg"),
      isHtml: f.endsWith(".html"),
    }));
  ok(res, files);
});

// ── Autonomous Browser Agent (browser-use) ────────────────────────
app.get("/api/browser/status", (_req, res) => {
  ok(res, getBrowserAgentStatus());
});

app.post("/api/browser/task", asyncRoute(async (req, res) => {
  const { prompt, url, browser, headless, durationSeconds, model } = req.body || {};
  if (!prompt) return fail(res, 400, "Prompt is required for autonomous browser task");
  const outcome = await runBrowserTask({
    prompt,
    url,
    browser,
    headless: Boolean(headless),
    durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
    model,
  });
  ok(res, outcome);
}));

// ── Scientific & Scholarly Intelligence (OpenAlex, arXiv, Europe PMC) ──
app.get("/api/science/status", (_req, res) => {
  ok(res, getScientificEngineStatus());
});

app.get("/api/science/search", asyncRoute(async (req, res) => {
  const query = req.query.q || req.query.query;
  if (!query) return fail(res, 400, "Query 'q' parameter is required");
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  const database = req.query.db || req.query.database || "all";
  const results = await searchScientificLiterature({ query, database, limit });
  ok(res, results);
}));

// ── Tasks (HUD: "to do today") ───────────────────────────────────
app.get("/api/tasks", (req, res) => {
  const dueDate = req.query.due === "today" ? todayISODate() : req.query.due || undefined;
  ok(res, listTasks({ dueDate, status: req.query.status || undefined }));
});

app.post("/api/tasks", (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return fail(res, 400, "Task title is required");
  res.status(201).json(createTask({
    title,
    notes: req.body?.notes ?? null,
    due_date: req.body?.due_date ?? todayISODate(),
    priority: req.body?.priority ?? 0,
  }));
});

app.put("/api/tasks/:id", (req, res) => {
  if (!getTask(req.params.id)) return fail(res, 404, "Task not found");
  ok(res, updateTask(req.params.id, req.body || {}));
});

app.delete("/api/tasks/:id", (req, res) => {
  deleteTask(req.params.id);
  ok(res, { ok: true });
});

// ── Gmail OAuth ──────────────────────────────────────────────────
app.get("/api/gmail/status", (_req, res) => {
  const t = getGmailTokens();
  ok(res, { configured: gmailConfigured(), connected: Boolean(t?.refresh_token), email: t?.email ?? null });
});

app.get("/api/gmail/connect", (_req, res) => {
  try {
    ok(res, { url: buildAuthUrl() });
  } catch (err) {
    fail(res, 400, err.message);
  }
});

app.get("/api/gmail/callback", asyncRoute(async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/?gmail=error");
  try {
    await exchangeCode(String(code));
    res.redirect("/?gmail=1");
  } catch {
    res.redirect("/?gmail=error");
  }
}));

app.post("/api/gmail/disconnect", (_req, res) => {
  clearGmailTokens();
  ok(res, { ok: true });
});

// ── Mail ─────────────────────────────────────────────────────────
app.get("/api/mail", asyncRoute(async (req, res) => {
  // If Gmail is connected, auto-refresh recent messages in background if older than 2 minutes
  if (gmailConfigured() && getGmailTokens()?.refresh_token) {
    const last = Number(getSetting("last_mail_sync_at") || 0);
    if (Date.now() - last > 120_000 || req.query.fresh === "1") {
      setSetting("last_mail_sync_at", String(Date.now()));
      syncMail({ days: 3, maxResults: 20 }).catch(() => {});
    }
  }
  ok(res, listMailMessages({ limit: Number(req.query.limit) || 20 }));
}));

app.post("/api/mail/sync", asyncRoute(async (req, res) => {
  const days = Math.max(1, Number(req.body?.days) || 7);
  ok(res, await syncMail({ days }));
}));

// ── Expenses / income ────────────────────────────────────────────
// Process Gmail into transactions for the requested window. Pass `range`
// (today|week|month|year) to cover that entire period — so e.g. "month" pulls
// the whole month, not just the last 7 days — or an explicit `days`.
app.post("/api/expenses/sync", asyncRoute(async (req, res) => {
  const days = req.body?.range
    ? daysForRange(req.body.range, req.body.from, req.body.to)
    : Math.max(1, Number(req.body?.days) || 7);
  // Scale how many candidate mails we scan with the window length.
  const maxResults = Math.min(400, Math.max(60, days * 6));
  ok(res, await syncExpenses({ days, maxResults }));
}));

app.get("/api/expenses", (req, res) => {
  const { from, to } = rangeToDates(req.query.range, req.query.from, req.query.to);
  const totals = revenueVsExpense({ from, to });
  ok(res, {
    range: req.query.range || "month",
    from, to,
    revenue: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    byCategory: {
      income: sumByCategory({ from, to, type: "income" }),
      expense: sumByCategory({ from, to, type: "expense" }),
    },
    transactions: listTransactions({ from, to, limit: 50 }),
  });
});

app.post("/api/expenses", (req, res) => {
  const { type, amount } = req.body || {};
  if (!["income", "expense"].includes(type)) return fail(res, 400, "type must be income or expense");
  if (!Number(amount)) return fail(res, 400, "amount is required");
  res.status(201).json(insertTransaction({
    type,
    amount: Number(amount),
    currency: req.body.currency || "PKR",
    category: req.body.category || "Other",
    merchant: req.body.merchant ?? null,
    description: req.body.description ?? null,
    occurred_at: req.body.occurred_at || new Date().toISOString().slice(0, 10),
    source: "manual",
  }));
});

app.post("/api/expenses/upload-statement", asyncRoute(async (req, res) => {
  const { data, filename } = req.body || {};
  if (!data) return fail(res, 400, "Base64 encoded PDF data is required");
  const buffer = Buffer.from(data, "base64");
  const result = await parseBankStatementPdf(buffer);
  ok(res, { ok: true, filename, ...result });
}));

// Jarvis assistant routes have been extracted to routes/voice.js

// ── Dashboard aggregate (single-request HUD hydration) ───────────
app.get("/api/dashboard", (req, res) => {
  const { from, to } = rangeToDates(req.query.range, req.query.from, req.query.to);
  const totals = revenueVsExpense({ from, to });
  ok(res, {
    expenses: {
      range: req.query.range || "month",
      from, to,
      revenue: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
      byCategory: {
        income: sumByCategory({ from, to, type: "income" }),
        expense: sumByCategory({ from, to, type: "expense" }),
      },
      transactions: listTransactions({ from, to, limit: 50 }),
    },
    mail: listMailMessages({ limit: 8 }),
    tasks: listTasks({ dueDate: todayISODate() }),
    gmail: { connected: Boolean(getGmailTokens()?.refresh_token), configured: gmailConfigured() },
    voice: { tts_provider: getAllSettings().tts_provider || "openrouter" },
    autoUpdateHours: Number(getAllSettings().auto_update_hours || 0),
  });
});

// ── Multi-User Face Biometrics & Security API ────────────────────
app.get("/api/users", (_req, res) => {
  ok(res, {
    users: listUsers(),
    total: getUserCount(),
    activeOperator: getCurrentOperator(),
    securityStatus: getAuthStatus(),
  });
});

app.get("/api/users/descriptors", (_req, res) => {
  ok(res, { descriptors: getAllFaceDescriptors() });
});

app.post("/api/users/enroll", (req, res) => {
  const { name, role, face_descriptor, avatar_thumb, pin_code } = req.body || {};
  if (!name || !name.trim()) return fail(res, 400, "User name is required");
  if (!face_descriptor || !Array.isArray(face_descriptor) || face_descriptor.length !== 128) {
    return fail(res, 400, "Valid 128-dimensional face descriptor array is required");
  }
  const user = createUser({
    name: name.trim(),
    role: role || "operator",
    face_descriptor,
    avatar_thumb: avatar_thumb || null,
    pin_code: pin_code ? String(pin_code).trim() : null,
  });
  ok(res, { success: true, user });
});

app.delete("/api/users/:id", (req, res) => {
  const existing = getUser(req.params.id);
  if (!existing) return fail(res, 404, "User not found");
  deleteUser(req.params.id);
  ok(res, { success: true, deleted: req.params.id });
});

app.get("/api/auth/status", (_req, res) => {
  ok(res, getAuthStatus());
});

app.post("/api/auth/face-login", (req, res) => {
  const { userId, name } = req.body || {};
  const result = unlockWithFace(userId || name);
  if (!result.success) return fail(res, 404, result.error);
  ok(res, result);
});

app.post("/api/auth/pin-login", (req, res) => {
  const { pin } = req.body || {};
  const result = unlockWithPin(pin);
  if (!result.success) return fail(res, 401, result.error);
  ok(res, result);
});

app.post("/api/auth/lock", (_req, res) => {
  const result = lockSystem("User requested lock");
  ok(res, result);
});

app.post("/api/auth/open-portal", (_req, res) => {
  ok(res, triggerOpenBiometricPortal());
});

app.get("/admin", (_req, res) => res.sendFile(join(ROOT_DIR, "public", "admin.html")));

// ── SPA fallback ─────────────────────────────────────────────────
app.get("*", (_req, res) => res.sendFile(join(ROOT_DIR, "public", "index.html")));


const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`\n  Content Agent OS → http://localhost:${config.port}`);
  console.log(`  Services: ${Object.entries(serviceStatus()).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join("  ")}`);
  startScheduler();
  startAutoSync();
  ensureAgentMemoryRunning().catch((err) => {
    console.warn(`[AgentMemory] Startup check skipped: ${err.message}`);
  });
});

setupWebSocket(server);
