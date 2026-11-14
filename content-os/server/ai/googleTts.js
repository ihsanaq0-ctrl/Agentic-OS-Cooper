import { config } from "../config.js";

const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

export function getGoogleTtsApiKey() {
  return config.googleTtsApiKey || config.geminiApiKey;
}

export function googleTtsConfigured() {
  return true; // Always ready with Google Neural/Translate TTS & Cloud TTS
}

export function defaultGoogleVoice() {
  return config.googleTtsVoice || "en-US-Journey-F";
}

/**
 * Detect language from text characters or language setting.
 */
export function detectLanguage(text = "") {
  const str = String(text || "").trim();
  if (!str) return "en";

  // Urdu & Arabic Unicode ranges
  // Specifically detect Urdu characters (ٹ، ڈ، ڑ، ں، ے، ہ، ھ، چ، پ، گ، ژ)
  if (/[\u0679\u0688\u0691\u06BA\u06D2\u06BE\u0686\u067E\u06AF\u0698]/.test(str)) {
    return "ur";
  }
  // General Arabic script (Urdu / Arabic / Persian)
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str)) {
    return "ur"; // In Cooper context, Arabic script is predominantly Urdu
  }
  // Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(str)) return "hi";
  // Japanese (Hiragana / Katakana / CJK)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(str)) return "ja";
  // Chinese (CJK Unified Ideographs without Kana)
  if (/[\u4E00-\u9FFF]/.test(str)) return "zh-CN";
  // Cyrillic (Russian)
  if (/[\u0400-\u04FF]/.test(str)) return "ru";

  return "en";
}

/**
 * Split long text into speakable sentence-sized chunks (< 180 chars)
 * to respect Google TTS chunk boundaries.
 */
function chunkText(text, maxLen = 180) {
  const clean = String(text || "")
    .replace(/[*_#`~[\]()<>]/g, "") // strip markdown
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLen) return [clean];

  // Split on sentence terminators: . ? ! Urdu Danda (۔) or question marks (؟) or newlines
  const sentences = clean.split(/(?<=[.?!۔؟\n])\s+/);
  const chunks = [];
  let cur = "";

  for (const s of sentences) {
    if (!s) continue;
    if ((cur + " " + s).trim().length <= maxLen) {
      cur = (cur ? cur + " " + s : s).trim();
    } else {
      if (cur) chunks.push(cur);
      // If a single sentence is longer than maxLen, split by comma or space
      if (s.length > maxLen) {
        const words = s.split(/\s+/);
        let sub = "";
        for (const w of words) {
          if ((sub + " " + w).trim().length <= maxLen) {
            sub = (sub ? sub + " " + w : w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) chunks.push(sub);
        cur = "";
      } else {
        cur = s;
      }
    }
  }
  if (cur) chunks.push(cur);
  return chunks.filter(Boolean);
}

/**
 * Zero-key, ultra-reliable Google Neural/Translate TTS engine.
 * Supports Urdu (ur), Hindi (hi), Arabic (ar), English (en), and 40+ languages.
 */
export async function synthesizeNeuralTranslateSpeech(text, { lang } = {}) {
  const targetLang = lang || detectLanguage(text);
  const chunks = chunkText(text, 180);
  if (!chunks.length) throw new Error("No speakable text provided");

  const bufs = [];
  for (const c of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(c)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`Google Translate TTS failed HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf && buf.length > 0) bufs.push(buf);
  }

  const combined = Buffer.concat(bufs);
  if (!combined.length) throw new Error("Empty audio received from Google Neural TTS");

  return {
    b64: combined.toString("base64"),
    mime: "audio/mp3",
    source: "google_neural",
    lang: targetLang,
  };
}

/**
 * Synthesize speech using Google Cloud Text-to-Speech API,
 * with automatic language-script adaptation and fallback to Google Neural TTS.
 */
export async function synthesizeGoogleSpeech(text, { voice, speakingRate = 1.0, pitch = 0.0 } = {}) {
  const detectedLang = detectLanguage(text);
  const apiKey = getGoogleTtsApiKey();

  // If text is Urdu and voice is an English voice, adapt to an Urdu voice
  let voiceName = voice || defaultGoogleVoice();
  if (detectedLang === "ur" && !voiceName.startsWith("ur-")) {
    voiceName = "ur-PK-Standard-A";
  } else if (detectedLang === "hi" && !voiceName.startsWith("hi-")) {
    voiceName = "hi-IN-Standard-A";
  } else if (detectedLang === "ar" && !voiceName.startsWith("ar-")) {
    voiceName = "ar-XA-Standard-A";
  }

  // Attempt Google Cloud TTS API if an API key is available
  if (apiKey) {
    try {
      const langMatch = voiceName.match(/^([a-z]{2,3}-[A-Z]{2})/);
      const languageCode = langMatch ? langMatch[1] : (detectedLang === "ur" ? "ur-PK" : "en-US");

      const payload = {
        input: { text: String(text).slice(0, 4800) },
        voice: {
          languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate,
          pitch,
        },
      };

      const res = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.audioContent) {
        return {
          b64: json.audioContent,
          mime: "audio/mp3",
          source: "google_cloud",
          lang: languageCode,
        };
      }
    } catch {
      // Fall through to Neural Translate TTS
    }
  }

  // Fallback to high-reliability Google Neural Translate TTS (supports Urdu flawlessly)
  return await synthesizeNeuralTranslateSpeech(text, { lang: detectedLang });
}
