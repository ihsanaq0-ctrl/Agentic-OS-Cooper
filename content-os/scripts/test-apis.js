// Live diagnostic for the three external services. Reads keys from .env via config.
// Usage: node scripts/test-apis.js
import { config, serviceStatus } from "../server/config.js";

const OPENROUTER = "https://openrouter.ai/api/v1";
const FIRECRAWL = "https://api.firecrawl.dev/v2";

const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);

function trunc(obj, n = 240) {
  const s = typeof obj === "string" ? obj : JSON.stringify(obj);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function testFirecrawl() {
  console.log("\nFirecrawl");
  if (!config.firecrawlApiKey) return fail("FIRECRAWL_API_KEY not set");
  try {
    const res = await fetch(`${FIRECRAWL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.firecrawlApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success !== false) pass(`scrape ok (markdown ${(json.data?.markdown || "").length} chars)`);
    else fail(`scrape failed: ${trunc(json)}`);
  } catch (e) { fail(e.message); }
}

async function testOpenRouter() {
  const isGroq = Boolean(config.groqApiKey);
  console.log(isGroq ? "\nGroq AI" : "\nOpenRouter");
  const apiKey = config.groqApiKey || config.openrouterApiKey;
  const baseUrl = isGroq ? "https://api.groq.com/openai/v1" : OPENROUTER;
  if (!apiKey) return fail("API key not set");
  try {
    if (!isGroq) {
      const res = await fetch(`${OPENROUTER}/models?output_modalities=image`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) pass(`models ok (${json.data?.length ?? 0} image-capable models)`);
      else return fail(`models failed: ${trunc(json)}`);
    }

    // Tiny chat to confirm the key can actually complete.
    const model = isGroq ? "groq/compound" : config.defaults.textModel;
    const chat = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 5 }),
    });
    const cjson = await chat.json().catch(() => ({}));
    if (chat.ok) pass(`chat ok with ${model} → ${trunc(cjson.choices?.[0]?.message?.content)}`);
    else fail(`chat failed (${model}): ${trunc(cjson)}`);
  } catch (e) { fail(e.message); }
}

async function testLinkedIn() {
  console.log("\nLinkedIn Direct (Official Free Developer API)");
  if (!config.linkedinClientId || !config.linkedinClientSecret) {
    return fail("LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not set in .env");
  }
  pass(`LinkedIn Developer App configured (Client ID: ${config.linkedinClientId.slice(0, 6)}...)`);
  info(`Redirect URI: ${config.linkedinRedirectUri}`);
}

async function testGemini() {
  console.log("\nGoogle Gemini");
  if (!config.geminiApiKey) {
    info("GEMINI_API_KEY not set in .env (optional if using OpenRouter/Groq)");
    return;
  }
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.geminiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 50,
      }),
    });
    const json = await res.json().catch(() => ({}));
    console.log("Gemini raw response:", JSON.stringify(json));
    if (res.ok) pass(`Gemini 3.6 Flash chat ok → ${trunc(json.choices?.[0]?.message?.content || json)}`);
    else fail(`Gemini chat failed: ${trunc(json)}`);
  } catch (e) { fail(e.message); }
}

async function testGoogleTts() {
  console.log("\nGoogle Cloud Text-to-Speech");
  const key = config.googleTtsApiKey || config.geminiApiKey;
  if (!key) {
    info("GOOGLE_TTS_API_KEY or GEMINI_API_KEY not set in .env (optional if using OpenRouter or browser voice)");
    return;
  }
  try {
    const { synthesizeGoogleSpeech } = await import("../server/ai/googleTts.js");
    const result = await synthesizeGoogleSpeech("Hello from Agentic OS", { voice: config.googleTtsVoice || "en-US-Journey-F" });
    if (result.b64) pass(`Google TTS synthesize ok (${result.mime}, voice: ${config.googleTtsVoice || "en-US-Journey-F"})`);
    else fail("Google TTS returned no audio data");
  } catch (e) { fail(e.message); }
}

(async () => {
  console.log("Service config:", serviceStatus());
  await testFirecrawl();
  await testGemini();
  await testGoogleTts();
  await testOpenRouter();
  await testLinkedIn();
  console.log("\nDone.\n");
})();
