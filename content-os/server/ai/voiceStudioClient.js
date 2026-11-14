/**
 * VoiceStudio OmniVoice Client for Cooper / Agentic OS.
 *
 * Connects to local VoiceStudio backend on port :3900 (or VOICESTUDIO_URL),
 * providing zero-latency, 100% private on-device speech synthesis,
 * authentic JARVIS butler voice cloning, and local Whisper STT transcription.
 */

const VOICESTUDIO_BASE_URL = (
  process.env.VOICESTUDIO_URL ||
  "http://127.0.0.1:3900"
).replace(/\/+$/, "");

const DEFAULT_VOICE = process.env.VOICESTUDIO_VOICE || "jarvis-prime";
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Checks whether VoiceStudio local server is running and healthy.
 * @returns {Promise<boolean>}
 */
export async function isVoiceStudioAlive() {
  try {
    const res = await fetch(`${VOICESTUDIO_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data?.status === "ok" || res.status === 200;
    }
  } catch {
    // Offline
  }
  return false;
}

/**
 * Retrieves full health and capabilities report from VoiceStudio.
 * @returns {Promise<object>}
 */
export async function getVoiceStudioStatus() {
  const alive = await isVoiceStudioAlive();
  if (!alive) {
    return {
      alive: false,
      url: VOICESTUDIO_BASE_URL,
      defaultVoice: DEFAULT_VOICE,
      activeEngine: "offline (falling back to Google TTS / Cloud Whisper)",
      voices: [],
    };
  }

  let voices = [];
  try {
    const vRes = await fetch(`${VOICESTUDIO_BASE_URL}/v1/audio/voices`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (vRes.ok) {
      const vData = await vRes.json();
      voices = Array.isArray(vData?.voices) ? vData.voices : (Array.isArray(vData) ? vData : []);
    }
  } catch {
    // Voices list query failed, still alive
  }

  return {
    alive: true,
    url: VOICESTUDIO_BASE_URL,
    defaultVoice: DEFAULT_VOICE,
    activeEngine: "OmniVoice Local Speech Engine (:3900)",
    voices,
  };
}

/**
 * Synthesizes speech audio using VoiceStudio's local OmniVoice engine.
 * Compatible with OpenAI POST /v1/audio/speech.
 *
 * @param {string} text - Text to speak
 * @param {object} [options={}]
 * @param {string} [options.voice] - Voice ID or profile (e.g. "jarvis-prime")
 * @param {string} [options.model="tts-1"] - Model engine
 * @param {string} [options.format="mp3"] - Output format ("mp3" | "wav" | "pcm")
 * @param {number} [options.speed=1.0] - Speech speed multiplier
 * @returns {Promise<{ b64: string, mime: string, source: "voicestudio" }>}
 */
export async function synthesizeVoiceStudioSpeech(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error("Cannot synthesize empty text");
  }

  const voice = options.voice || DEFAULT_VOICE;
  const model = options.model || "tts-1";
  const format = options.format || "mp3";
  const speed = options.speed || 1.0;

  const payload = {
    model,
    input: String(text).slice(0, 4800),
    voice,
    response_format: format,
    speed,
  };

  const res = await fetch(`${VOICESTUDIO_BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData?.detail || errData?.error?.message || `HTTP ${res.status}`;
    throw new Error(`VoiceStudio Speech Error: ${message}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    b64: buffer.toString("base64"),
    mime: format === "wav" ? "audio/wav" : (format === "pcm" ? "audio/pcm" : "audio/mp3"),
    source: "voicestudio",
  };
}

/**
 * Transcribes audio via VoiceStudio's local Whisper STT engine.
 * Compatible with OpenAI POST /v1/audio/transcriptions.
 *
 * @param {string} b64 - Base64-encoded audio
 * @param {string} [format="webm"] - Audio file extension ("webm", "wav", "mp3")
 * @param {object} [options={}]
 * @param {string} [options.model="whisper-1"]
 * @param {string} [options.language="en"]
 * @returns {Promise<{ text: string, source: "voicestudio" }>}
 */
export async function transcribeVoiceStudioAudio(b64, format = "webm", options = {}) {
  const audioBuffer = Buffer.from(b64, "base64");
  const blob = new Blob([audioBuffer], { type: `audio/${format}` });

  const formData = new FormData();
  formData.append("file", blob, `input.${format}`);
  formData.append("model", options.model || "whisper-1");
  formData.append("language", options.language || "en");

  const res = await fetch(`${VOICESTUDIO_BASE_URL}/v1/audio/transcriptions`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData?.detail || errData?.error?.message || `HTTP ${res.status}`;
    throw new Error(`VoiceStudio Transcribe Error: ${message}`);
  }

  const json = await res.json();
  return {
    text: json.text || "",
    source: "voicestudio",
  };
}

/**
 * Lists all voice profiles available in VoiceStudio.
 * @returns {Promise<Array<object>>}
 */
export async function listVoiceStudioVoices() {
  try {
    const res = await fetch(`${VOICESTUDIO_BASE_URL}/v1/audio/voices`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.voices) ? data.voices : (Array.isArray(data) ? data : []);
    }
  } catch {
    // Non-blocking
  }
  return [];
}

/**
 * Clones a voice sample into a new VoiceStudio profile.
 *
 * @param {string} name - Profile name (e.g. "jarvis-prime")
 * @param {Buffer|Blob} audioData - Reference audio file
 * @param {object} [options={}]
 * @returns {Promise<object|null>}
 */
export async function cloneVoiceProfile(name, audioData, options = {}) {
  try {
    const formData = new FormData();
    formData.append("name", name);
    if (options.description) formData.append("description", options.description);
    const blob = audioData instanceof Blob ? audioData : new Blob([audioData], { type: "audio/wav" });
    formData.append("file", blob, `${name}.wav`);

    const res = await fetch(`${VOICESTUDIO_BASE_URL}/api/profiles/clone`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(20_000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Non-blocking fail-safe
  }
  return null;
}
