import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config, ROOT_DIR } from "../config.js";
import { getSetting } from "../db.js";
import { synthesizeGoogleSpeech, googleTtsConfigured } from "./googleTts.js";
import {
  isVoiceStudioAlive,
  synthesizeVoiceStudioSpeech,
  transcribeVoiceStudioAudio,
  getVoiceStudioStatus,
} from "./voiceStudioClient.js";

export function getProvider(overrideModel, forceProvider) {
  if (forceProvider === "gemini" && config.geminiApiKey) {
    return {
      name: "Gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: config.geminiApiKey,
      formatModel: (m) => (m.startsWith("google/") ? m.replace(/^google\//, "") : (m.startsWith("openai/") ? "gemini-3.5-flash" : m)),
    };
  }
  if (forceProvider === "groq" && config.groqApiKey) {
    return {
      name: "Groq",
      base: "https://api.groq.com/openai/v1",
      apiKey: config.groqApiKey,
      formatModel: (m) => (m.startsWith("gemini") ? "openai/gpt-oss-120b" : m),
    };
  }
  if (forceProvider === "openrouter" && config.openrouterApiKey) {
    return {
      name: "OpenRouter",
      base: config.openrouterBaseUrl || "https://openrouter.ai/api/v1",
      apiKey: config.openrouterApiKey,
      formatModel: (m) => (m.startsWith("gemini") ? "google/gemini-2.0-flash-001" : m),
    };
  }

  const model = overrideModel || textModel();
  if (config.geminiApiKey && (!config.openrouterApiKey || model.startsWith("gemini") || model.startsWith("google/"))) {
    return {
      name: "Gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: config.geminiApiKey,
      formatModel: (m) => (m.startsWith("google/") ? m.replace(/^google\//, "") : m),
    };
  }
  if (config.groqApiKey && !config.openrouterApiKey) {
    return {
      name: "Groq",
      base: "https://api.groq.com/openai/v1",
      apiKey: config.groqApiKey,
      formatModel: (m) => m,
    };
  }
  if (config.openrouterApiKey) {
    return {
      name: "OpenRouter",
      base: config.openrouterBaseUrl || "https://openrouter.ai/api/v1",
      apiKey: config.openrouterApiKey,
      formatModel: (m) => m,
    };
  }
  if (config.geminiApiKey) {
    return {
      name: "Gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: config.geminiApiKey,
      formatModel: (m) => (m.startsWith("google/") ? m.replace(/^google\//, "") : m),
    };
  }
  if (config.groqApiKey) {
    return {
      name: "Groq",
      base: "https://api.groq.com/openai/v1",
      apiKey: config.groqApiKey,
      formatModel: (m) => m,
    };
  }
  if (config.ollamaBaseUrl) {
    return {
      name: "Ollama (Local Offline)",
      base: config.ollamaBaseUrl,
      apiKey: "ollama",
      formatModel: (m) => config.ollamaModel || "llama3.3",
    };
  }
  throw new Error("AI provider not configured — set GEMINI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, or OLLAMA_BASE_URL in .env");
}

function getApiKey() {
  return config.geminiApiKey || config.groqApiKey || config.openrouterApiKey || (config.ollamaBaseUrl ? "ollama" : "");
}

function requireKey() {
  if (!getApiKey()) {
    throw new Error("AI provider not configured — set GEMINI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, or OLLAMA_BASE_URL in .env");
  }
}

function headers(apiKey) {
  const key = apiKey || getApiKey();
  const h = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (config.openrouterSiteUrl) h["HTTP-Referer"] = config.openrouterSiteUrl;
  if (config.openrouterSiteName) h["X-OpenRouter-Title"] = config.openrouterSiteName;
  return h;
}

export function textModel() {
  return getSetting("text_model") || (config.geminiApiKey ? "gemini-3.5-flash" : config.defaults.textModel);
}

export function imageModel() {
  return getSetting("image_model") || config.defaults.imageModel;
}

// Settings-backed model getters for the v2 features (research, voice, content image,
// agentic assistant). Each falls back to a sensible default if unset.
export function researchModel() {
  return getSetting("research_model") || (config.geminiApiKey ? "gemini-3.5-flash" : (config.groqApiKey ? "groq/compound" : "perplexity/sonar"));
}
export function imageContentModel() {
  return getSetting("image_content_model") || "google/gemini-2.5-flash-image";
}
export function transcribeModel() {
  return getSetting("transcribe_model") || (config.groqApiKey ? "whisper-large-v3" : "openai/whisper-large-v3");
}
export function ttsModel() {
  const m = getSetting("tts_model");
  if (!m || m === "hexgrad/kokoro-82m") return googleTtsConfigured() ? "en-US-Journey-F" : "tts-1";
  return m;
}
export function ttsVoice() {
  const v = getSetting("tts_voice");
  if (!v || v === "bm_george") return googleTtsConfigured() ? "en-US-Journey-F" : "alloy";
  return v;
}
export function assistantModel() {
  return getSetting("assistant_model") || textModel();
}
// Low-latency conversational model for instant assistant replies.
export function assistantFastModel() {
  return getSetting("assistant_fast_model") || (config.geminiApiKey ? "gemini-3.5-flash-lite" : (config.groqApiKey ? "openai/gpt-oss-120b" : "gemini-3.5-flash"));
}

async function postChat(payload, retryCount = 0, forceProvider = null) {
  const provider = getProvider(payload.model, forceProvider);
  const formattedModel = provider.formatModel(payload.model);
  try {
    const res = await fetch(`${provider.base}/chat/completions`, {
      method: "POST",
      headers: headers(provider.apiKey),
      body: JSON.stringify({ ...payload, model: formattedModel }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 1. Quota Exceeded (429) on Gemini: Try Gemini 3.5 Flash Lite or failover to Groq/OpenRouter
      if (res.status === 429 && provider.name === "Gemini") {
        if (!payload.model.includes("flash-lite") && retryCount < 1) {
          console.warn(`[AI Engine] Gemini model quota reached — trying high-quota free gemini-3.5-flash-lite...`);
          return await postChat({ ...payload, model: "gemini-3.5-flash-lite" }, retryCount + 1, "gemini");
        }
        if (config.groqApiKey) {
          console.warn(`[AI Engine] Gemini daily quota reached (429) — seamless failover to Groq.`);
          return await postChat({ ...payload, model: "openai/gpt-oss-120b" }, 0, "groq");
        } else if (config.openrouterApiKey) {
          console.warn(`[AI Engine] Gemini daily quota reached (429) — seamless failover to OpenRouter.`);
          return await postChat({ ...payload, model: "google/gemini-2.0-flash-001" }, 0, "openrouter");
        }
      }

      // 2. Groq Rate Limit (429) Handling:
      if (res.status === 429 && provider.name === "Groq") {
        const errMsg = json?.error?.message || "";
        const match = errMsg.match(/try again in ([\d\.]+)s/i);
        const waitMs = match ? Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 800, 10000) : 4000;
        if (retryCount < 2) {
          console.warn(`[AI Engine] Groq free TPM limit reached. Auto-waiting ${waitMs}ms before free retry...`);
          await new Promise((r) => setTimeout(r, waitMs));
          return await postChat(payload, retryCount + 1, "groq");
        }
        if (config.geminiApiKey) {
          console.warn(`[AI Engine] Groq TPM limit reached — failing back to Gemini 3.5 Flash.`);
          return await postChat({ ...payload, model: "gemini-3.5-flash" }, 0, "gemini");
        }
      }

      // 3. Transient server overload (503, 502, 504)
      if ([503, 502, 504].includes(res.status) && retryCount < 1) {
        const delay = 800;
        console.warn(`[AI Engine] ${provider.name} returned ${res.status} (overloaded), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        return await postChat({ ...payload, model: "gemini-3.5-flash" }, retryCount + 1, forceProvider);
      }

      // 4. Persistent 503 on Gemini: Failover to Groq/OpenRouter
      if (res.status === 503 && provider.name === "Gemini") {
        if (config.groqApiKey) {
          console.warn(`[AI Engine] Gemini overloaded (503) — seamless failover to Groq.`);
          return await postChat({ ...payload, model: "openai/gpt-oss-120b" }, 0, "groq");
        } else if (config.openrouterApiKey) {
          console.warn(`[AI Engine] Gemini overloaded (503) — seamless failover to OpenRouter.`);
          return await postChat({ ...payload, model: "google/gemini-2.0-flash-001" }, 0, "openrouter");
        }
      }

      throw new Error(`${provider.name}: ${json?.error?.message || `HTTP ${res.status}`}`);
    }
    return json;
  } catch (err) {
    if (provider.name === "Gemini" && (err.message.includes("429") || err.message.includes("503") || err.message.includes("fetch failed"))) {
      if (config.groqApiKey) {
        console.warn(`[AI Engine] Gemini error (${err.message}) — seamless failover to Groq.`);
        return await postChat({ ...payload, model: "openai/gpt-oss-120b" }, 0, "groq");
      } else if (config.openrouterApiKey) {
        console.warn(`[AI Engine] Gemini error (${err.message}) — seamless failover to OpenRouter.`);
        return await postChat({ ...payload, model: "google/gemini-2.0-flash-001" }, 0, "openrouter");
      }
    }
    throw err;
  }
}

// Plain text completion.
export async function chat(messages, { model, temperature = 0.7, maxTokens } = {}) {
  const json = await postChat({
    model: model || textModel(),
    messages,
    temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });
  return json.choices?.[0]?.message?.content ?? "";
}

// Completion constrained to a JSON object. Falls back to brace-extraction
// if a model wraps the JSON in prose.
export async function chatJSON(messages, { model, temperature = 0.3 } = {}) {
  const json = await postChat({
    model: model || textModel(),
    messages,
    temperature,
    response_format: { type: "json_object" },
  });
  const content = json.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(content.slice(start, end + 1));
    throw new Error("OpenRouter returned non-JSON content");
  }
}

// Tool-calling turn. Returns the raw assistant message so the caller can run
// its own multi-step loop (read message.tool_calls, run them, append results).
export async function chatWithTools(messages, tools, { model, temperature = 0.4, toolChoice = "auto" } = {}) {
  const json = await postChat({
    model: model || assistantModel(),
    messages,
    tools,
    tool_choice: toolChoice,
    temperature,
  });
  return json.choices?.[0]?.message ?? {};
}

// Web-grounded research via Firecrawl and Perplexity Sonar.
// We query both engines concurrently and combine the results.
export async function researchWeb(query, { model, count = 6 } = {}) {
  const items = [];
  
  // Try Firecrawl Search
  try {
    const { searchWeb } = await import("../collectors/firecrawl.js");
    const fcResults = await searchWeb(query, { limit: Math.ceil(count / 2) });
    if (fcResults && fcResults.length > 0) {
      items.push(...fcResults.map((i) => ({ title: i.title, url: i.url, summary: i.summary })));
    }
  } catch (err) {
    console.warn("[AI Engine] Firecrawl search failed:", err.message);
  }

  // Try Perplexity / OpenRouter Search
  try {
    const research = await chat(
      [
        { role: "system", content:
          "You are a research assistant with live web access. Find the most CURRENT, specific, real " +
          `developments for the user's topic. List up to ${Math.ceil(count / 2)} items. For EACH item include its ` +
          "real source URL on its own line. Be concrete and factual." },
        { role: "user", content: query },
      ],
      { model: model || researchModel(), temperature: 0.3 }
    );

    const parsed = await chatJSON([
      { role: "system", content:
        'Convert the research notes into JSON: {"items":[{"title","url","summary","angle"}]}. ' +
        "Include ONLY items that have a real http(s) source URL from the notes. " +
        "summary = 1-2 sentences; angle = a short content angle to post about it. No invented URLs." },
      { role: "user", content: research },
    ]);
    if (Array.isArray(parsed?.items)) {
      items.push(...parsed.items.filter((i) => /^https?:\/\//.test(i.url || "")));
    }
  } catch (err) {
    console.warn("[AI Engine] Perplexity search failed:", err.message);
  }

  return items.slice(0, count);
}

// Speech-to-text supporting Local VoiceStudio Whisper and Groq/OpenAI cloud fallback.
export async function transcribeAudio(b64, format = "webm", { model, language = "en" } = {}) {
  // 1. Tier 1: Local VoiceStudio Whisper (100% private, on-device STT)
  try {
    const vsAlive = await isVoiceStudioAlive();
    if (vsAlive) {
      const res = await transcribeVoiceStudioAudio(b64, format, { model, language });
      if (res?.text) return res.text;
    }
  } catch (err) {
    console.warn("[Speech Engine] VoiceStudio STT failed, falling back to cloud STT:", err.message);
  }

  // 2. Tier 2: Groq / OpenAI Cloud Whisper
  const sttBase = config.groqApiKey ? "https://api.groq.com/openai/v1" : (config.openrouterBaseUrl || "https://openrouter.ai/api/v1");
  const sttKey = config.groqApiKey || config.openrouterApiKey;
  if (!sttKey) {
    throw new Error("STT requires GROQ_API_KEY or OPENROUTER_API_KEY in .env");
  }
  const audioBuffer = Buffer.from(b64, "base64");
  const blob = new Blob([audioBuffer], { type: `audio/${format}` });
  
  const formData = new FormData();
  formData.append("file", blob, `audio.${format}`);
  formData.append("model", model || transcribeModel());
  formData.append("language", language);

  const res = await fetch(`${sttBase}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sttKey}`,
    },
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`STT Error: ${json?.error?.message || `HTTP ${res.status}`}`);
  return json.text ?? "";
}

// Text-to-speech supporting VoiceStudio OmniVoice (Local), Google Cloud TTS, and OpenRouter/OpenAI.
export async function textToSpeech(text, { model, voice, format = "mp3" } = {}) {
  const provider = getSetting("tts_provider") || (googleTtsConfigured() ? "google" : "openrouter");

  // 1. Tier 1: Local VoiceStudio OmniVoice (JARVIS Butler voice, zero cloud latency)
  if (provider === "voicestudio" || provider === "auto" || !googleTtsConfigured()) {
    try {
      const vsAlive = await isVoiceStudioAlive();
      if (vsAlive) {
        return await synthesizeVoiceStudioSpeech(text, { model, voice, format });
      }
    } catch (err) {
      console.warn("[Speech Engine] VoiceStudio local TTS failed, falling back to cloud TTS:", err.message);
    }
  }
  
  // 2. Tier 2: Google Cloud Text-to-Speech (Journey / Studio / Neural2)
  if (provider === "google" || (googleTtsConfigured() && provider !== "openrouter" && provider !== "browser")) {
    try {
      return await synthesizeGoogleSpeech(text, { voice: voice || ttsVoice() });
    } catch (err) {
      if (!config.openrouterApiKey) throw err;
      console.warn("Google TTS failed, falling back to OpenRouter/OpenAI speech:", err.message);
    }
  }

  // 3. Tier 3: OpenRouter / OpenAI-compatible /audio/speech
  if (config.openrouterApiKey) {
    try {
      const openrouterBase = config.openrouterBaseUrl || "https://openrouter.ai/api/v1";
      const chosenModel = model || ttsModel();
      const safeModel = chosenModel === "hexgrad/kokoro-82m" ? "tts-1" : chosenModel;
      const chosenVoice = voice || ttsVoice();
      const safeVoice = chosenVoice === "bm_george" ? "alloy" : chosenVoice;

      const res = await fetch(`${openrouterBase}/audio/speech`, {
        method: "POST",
        headers: headers(config.openrouterApiKey),
        body: JSON.stringify({
          model: safeModel,
          input: text,
          voice: safeVoice,
          response_format: format,
        }),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { b64: buf.toString("base64"), mime: `audio/${format}`, source: "openrouter" };
      }
    } catch (err) {
      console.warn("[Speech Engine] OpenRouter TTS failed, falling back to Google Neural TTS:", err.message);
    }
  }

  // 4. Ultimate High-Reliability Fallback: Google Neural/Translate Multi-Language TTS (Urdu, English, etc.)
  return await synthesizeGoogleSpeech(text, { voice: voice || ttsVoice() });
}

export const tts = textToSpeech;

// Image generation via the dedicated /images endpoint (gpt-image-2 etc.).
// Returns the public path under /storage/images.
export async function generateImageV2(prompt, { model, aspectRatio = "1:1", quality = "high" } = {}) {
  const apiKey = config.openrouterApiKey;
  if (!apiKey) throw new Error("Image generation V2 requires OPENROUTER_API_KEY in .env");
  const openrouterBase = config.openrouterBaseUrl || "https://openrouter.ai/api/v1";
  const res = await fetch(`${openrouterBase}/images`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: model || imageContentModel(),
      prompt,
      aspect_ratio: aspectRatio,
      quality,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenRouter image: ${json?.error?.message || `HTTP ${res.status}`}`);

  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image model returned no image data");
  const dir = join(ROOT_DIR, "storage", "images");
  mkdirSync(dir, { recursive: true });
  const filename = `${randomUUID()}.png`;
  writeFileSync(join(dir, filename), Buffer.from(b64, "base64"));
  return `/storage/images/${filename}`;
}

// Generate an image. Returns the public path under /storage/images.
export async function generateImage(prompt, { model, aspectRatio = "4:3" } = {}) {
  const json = await postChat({
    model: model || imageModel(),
    modalities: ["image", "text"],
    image_config: { aspect_ratio: aspectRatio },
    messages: [{ role: "user", content: prompt }],
  });

  const message = json.choices?.[0]?.message ?? {};
  // Image output can arrive as message.images[] or as a data URL in content.
  let dataUrl =
    message.images?.[0]?.image_url?.url ||
    message.images?.[0]?.url ||
    null;

  if (!dataUrl && typeof message.content === "string") {
    const m = message.content.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
    if (m) dataUrl = m[0];
  }
  if (!dataUrl && Array.isArray(message.content)) {
    for (const part of message.content) {
      const url = part?.image_url?.url || part?.url;
      if (url?.startsWith("data:image")) { dataUrl = url; break; }
    }
  }

  if (!dataUrl) throw new Error("Image model returned no image data");

  const match = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error("Unexpected image data format");
  const [, ext, b64] = match;

  const dir = join(ROOT_DIR, "storage", "images");
  mkdirSync(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`;
  writeFileSync(join(dir, filename), Buffer.from(b64, "base64"));
  return `/storage/images/${filename}`;
}

// List image-capable models for the Settings picker.
export async function listImageModels() {
  const apiKey = config.openrouterApiKey;
  if (!apiKey) return [];
  const openrouterBase = config.openrouterBaseUrl || "https://openrouter.ai/api/v1";
  const res = await fetch(`${openrouterBase}/models?output_modalities=image`, { headers: headers(apiKey) });
  const json = await res.json().catch(() => ({}));
  return (json.data ?? []).map((m) => ({ id: m.id, name: m.name }));
}
