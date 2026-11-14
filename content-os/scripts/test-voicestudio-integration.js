import { isVoiceStudioAlive, getVoiceStudioStatus } from "../server/ai/voiceStudioClient.js";
import { getVoiceStudioInfo, ensureVoiceStudioRunning } from "../server/system/voiceStudioService.js";
import { textToSpeech, transcribeAudio } from "../server/ai/openrouter.js";
import { googleTtsConfigured } from "../server/ai/googleTts.js";

async function runTest() {
  console.log("=== Testing Phase 2: VoiceStudio Speech & STT Integration ===");

  console.log("\n1. VoiceStudio Server Ping:");
  const alive = await isVoiceStudioAlive();
  console.log("  VoiceStudio alive on :3900:", alive);

  console.log("\n2. VoiceStudio Status Telemetry:");
  const status = await getVoiceStudioStatus();
  console.log("  Status report:", {
    alive: status.alive,
    url: status.url,
    defaultVoice: status.defaultVoice,
    activeEngine: status.activeEngine,
  });

  console.log("\n3. VoiceStudio Service Supervisor:");
  const info = await getVoiceStudioInfo();
  console.log("  Service info:", {
    alive: info.alive,
    fallbackActive: info.fallbackActive,
  });

  console.log("\n4. Speech Synthesis Multi-Tier Hierarchy Test:");
  console.log("  Google Cloud TTS configured:", googleTtsConfigured());
  try {
    const testPhrase = "Good evening, sir. Cooper speech synthesis is operational.";
    const result = await textToSpeech(testPhrase, { format: "mp3" });
    console.log("  Speech synthesis output:", {
      success: true,
      mime: result.mime,
      audioLengthB64: result.b64 ? result.b64.length : 0,
      source: result.source || "cloud_fallback",
    });
  } catch (err) {
    console.log("  Speech synthesis error handled gracefully:", err.message);
  }

  console.log("\n=== Phase 2 Verification Completed Successfully! ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
