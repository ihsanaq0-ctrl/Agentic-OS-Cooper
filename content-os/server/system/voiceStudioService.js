import { isVoiceStudioAlive, getVoiceStudioStatus, listVoiceStudioVoices } from "../ai/voiceStudioClient.js";

const DEFAULT_PORT = 3900;
const DEFAULT_URL = process.env.VOICESTUDIO_URL || `http://127.0.0.1:${DEFAULT_PORT}`;

/**
 * Ensures the VoiceStudio daemon is running, reporting status and configuration.
 * @returns {Promise<object>}
 */
export async function ensureVoiceStudioRunning() {
  const alive = await isVoiceStudioAlive();
  if (alive) {
    const voices = await listVoiceStudioVoices();
    return {
      running: true,
      port: DEFAULT_PORT,
      url: DEFAULT_URL,
      voice: process.env.VOICESTUDIO_VOICE || "jarvis-prime",
      voicesAvailable: voices.length,
      message: "VoiceStudio OmniVoice speech engine is active.",
    };
  }

  return {
    running: false,
    port: DEFAULT_PORT,
    url: DEFAULT_URL,
    message: "VoiceStudio server not running. Cooper is utilizing Tier 2 Google Cloud TTS and Tier 3 OpenRouter fallback.",
    launchCommand: "uv run python -m backend.main",
  };
}

/**
 * Retrieves full connection and voice profile information for Cooper.
 * @returns {Promise<object>}
 */
export async function getVoiceStudioInfo() {
  const status = await getVoiceStudioStatus();
  return {
    alive: status.alive,
    url: status.url,
    defaultVoice: status.defaultVoice,
    activeEngine: status.activeEngine,
    voices: status.voices || [],
    fallbackActive: !status.alive,
  };
}
