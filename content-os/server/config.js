import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Hand-rolled .env loader (no dotenv dependency, per repo convention).
export function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnv();

export const ROOT_DIR = ROOT;

export const config = {
  // Hostinger routes traffic to process.env.PORT (often 3000). Default 3000 in prod.
  port: Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3950)),
  scrapeConcurrency: Number(process.env.SCRAPE_CONCURRENCY ?? 5),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT || 3000}`,

  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",

  geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "",
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "",
  googleTtsVoice: process.env.GOOGLE_TTS_VOICE ?? "en-US-Journey-F",

  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : "https://openrouter.ai/api/v1"),
  openrouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "",
  openrouterSiteName: process.env.OPENROUTER_SITE_NAME ?? "Content Agent OS",

  groqApiKey: process.env.GROQ_API_KEY ?? "",

  // News API & Weather API
  newsApiKey: process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY || process.env.NEWSDATA_API_KEY || "",
  weatherApiKey: process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY || "",

  // LinkedIn Direct Developer API (100% free)
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID ?? "",
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  linkedinRedirectUri:
    process.env.LINKEDIN_REDIRECT_URI ??
    `${process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT || 3000}`}/api/auth/linkedin/callback`,

  // GitHub OAuth App
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  githubRedirectUri:
    process.env.GITHUB_REDIRECT_URI ??
    `${process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT || 3000}`}/api/auth/github/callback`,

  // Telegram Bot (100% free, zero app review)
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID ?? "",

  // Discord Webhook (100% free, instant setup)
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? "",

  // Twitter/X API v2 (Free tier: 1,500 tweets/month)
  twitterApiKey: process.env.TWITTER_API_KEY ?? "",
  twitterApiSecret: process.env.TWITTER_API_SECRET ?? "",
  twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN ?? "",
  twitterAccessSecret: process.env.TWITTER_ACCESS_SECRET ?? "",

  // Instagram (Free via Meta Graph API)
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
  instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID ?? "",

  // Local LLM fallback (Ollama / LM Studio)
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.3",

  // Projects directory for Cooper's dev tools
  projectsDir: process.env.PROJECTS_DIR ?? "",

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT || 3000}`}/api/gmail/callback`,

  // Seed defaults — the live values are stored in app_settings (DB) and
  // editable from the Settings tab. These only seed the first run.
  defaults: {
    freshnessHours: Number(process.env.DEFAULT_FRESHNESS_HOURS ?? 24),
    textModel: process.env.OPENROUTER_TEXT_MODEL ?? (process.env.GEMINI_API_KEY ? "gemini-3.5-flash" : (process.env.GROQ_API_KEY ? "openai/gpt-oss-120b" : "gemini-3.5-flash")),
    imageModel: process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-2.5-flash-image",
    timezone: process.env.DEFAULT_TIMEZONE ?? "Asia/Karachi",
  },
};

export function serviceStatus() {
  return {
    firecrawl: Boolean(config.firecrawlApiKey),
    gemini: Boolean(config.geminiApiKey),
    googleTts: Boolean(config.googleTtsApiKey),
    openrouter: Boolean(config.openrouterApiKey),
    groq: Boolean(config.groqApiKey),
    ollama: Boolean(config.ollamaBaseUrl),
    linkedin: Boolean(config.linkedinClientId && config.linkedinClientSecret),
    github: Boolean(config.githubClientId && config.githubClientSecret),
    telegram: Boolean(config.telegramBotToken && config.telegramChannelId),
    discord: Boolean(config.discordWebhookUrl),
    twitter: Boolean(config.twitterApiKey && config.twitterAccessToken),
    instagram: Boolean(config.instagramAccessToken && config.instagramAccountId),
    gmail: Boolean(config.googleClientId && config.googleClientSecret),
    news: Boolean(config.newsApiKey || process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY),
    weather: Boolean(config.weatherApiKey || process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY),
  };
}
