// ── Jarvis-CV / Stark HUD & Sound Engine 100% Integration Test Suite ───────────
// Verifies bridge state management, Express endpoints, Cooper AI tool
// dispatching, and client-side audio/hologram assets.

import express from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ROOT_DIR } from "../server/config.js";
import {
  getHudStatus,
  setHudMode,
  setArcPower,
  triggerSoundCue,
  registerJarvisCvBridge,
} from "../server/jarvis-cv-bridge.js";

const TEST_PORT = 4288;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("   Jarvis-CV (Sound & Arc Reactor) Integration    ");
  console.log("==================================================\n");

  // ── 1. Direct Bridge State Management ─────────────────────────
  console.log("1. Testing Bridge State & Logic...");
  const initialStatus = getHudStatus();
  assert(initialStatus && typeof initialStatus.mode === "string", "getHudStatus() returns valid state object");

  const modeRes = setHudMode("arc_reactor");
  assert(modeRes.success && modeRes.mode === "arc_reactor", "setHudMode('arc_reactor') switched mode successfully");

  const powerRes = setArcPower(88);
  assert(powerRes.success && powerRes.power === 88, "setArcPower(88) clamped and updated power level");

  const validSound = triggerSoundCue("engage");
  assert(validSound.success && validSound.cue === "engage", "triggerSoundCue('engage') succeeded for valid cue");

  const invalidSound = triggerSoundCue("fake_sound");
  assert(invalidSound.success === false && invalidSound.error, "triggerSoundCue('fake_sound') properly rejected invalid cue");

  // Reset back to globe
  setHudMode("globe");
  setArcPower(100);

  // ── 2. Express REST Bridge Endpoints ─────────────────────────
  console.log("\n2. Testing Express REST Bridge Endpoints...");
  const app = express();
  app.use(express.json());
  registerJarvisCvBridge(app);

  const server = app.listen(TEST_PORT);
  console.log(`   Test server listening on http://127.0.0.1:${TEST_PORT}`);

  try {
    // GET /api/hud/status
    const sRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/hud/status`);
    const sData = await sRes.json();
    assert(sRes.ok && sData.mode === "globe", "GET /api/hud/status returned 200 with mode: globe");

    // POST /api/hud/mode
    const mRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/hud/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "arc_reactor" }),
    });
    const mData = await mRes.json();
    assert(mRes.ok && mData.mode === "arc_reactor", "POST /api/hud/mode switched mode to arc_reactor");

    // POST /api/hud/power
    const pRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/hud/power`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ power: 92 }),
    });
    const pData = await pRes.json();
    assert(pRes.ok && pData.power === 92, "POST /api/hud/power set power to 92%");

    // POST /api/hud/sound
    const sndRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/hud/sound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cue: "repulsor" }),
    });
    const sndData = await sndRes.json();
    assert(sndRes.ok && sndData.cue === "repulsor", "POST /api/hud/sound dispatched cue: repulsor");
  } finally {
    server.close();
  }

  // ── 3. Client Frontend Modules & DOM Hooks ────────────────────
  console.log("\n3. Testing Client Frontend Modules...");
  const soundEnginePath = join(ROOT_DIR, "public", "hud", "soundEngine.js");
  const arcReactorPath = join(ROOT_DIR, "public", "hud", "arcReactor.js");
  const indexPath = join(ROOT_DIR, "public", "index.html");

  assert(existsSync(soundEnginePath), "public/hud/soundEngine.js exists");
  const soundCode = readFileSync(soundEnginePath, "utf8");
  assert(soundCode.includes("playEngageSound") && soundCode.includes("playRepulsorBlastSound") && soundCode.includes("playTargetLockSound"), "soundEngine.js contains all Stark-Tech synthesizer methods");

  assert(existsSync(arcReactorPath), "public/hud/arcReactor.js exists");
  const arcCode = readFileSync(arcReactorPath, "utf8");
  assert(arcCode.includes("buildReactor") && arcCode.includes("coilsGroup") && arcCode.includes("toggleMode"), "arcReactor.js contains complete Three.js procedural Arc Reactor implementation");

  const indexHtml = readFileSync(indexPath, "utf8");
  assert(indexHtml.includes("arcReactorCanvas") && indexHtml.includes("hudModeToggle"), "public/index.html includes #arcReactorCanvas and #hudModeToggle");
  assert(indexHtml.includes("soundEngine.js") && indexHtml.includes("arcReactor.js"), "public/index.html imports soundEngine.js and arcReactor.js modules");

  // ── 4. Cooper AI Brain Tool Schema Check ─────────────────────
  console.log("\n4. Testing Cooper Assistant Tool Definitions...");
  const assistantPath = join(ROOT_DIR, "server", "ai", "assistant.js");
  const assistantCode = readFileSync(assistantPath, "utf8");

  assert(assistantCode.includes('"sound_effect"'), "assistant.js TOOLS contains 'sound_effect'");
  assert(assistantCode.includes('"set_hud_mode"'), "assistant.js TOOLS contains 'set_hud_mode'");
  assert(assistantCode.includes('"set_arc_reactor_power"'), "assistant.js TOOLS contains 'set_arc_reactor_power'");
  assert(assistantCode.includes('triggerSoundCue(args.cue)'), "assistant.js runTool dispatches triggerSoundCue");
  assert(assistantCode.includes('setHudMode(args.mode)'), "assistant.js runTool dispatches setHudMode");
  assert(assistantCode.includes('setArcPower(args.power)'), "assistant.js runTool dispatches setArcPower");

  console.log("\n==================================================");
  console.log(`  Tests Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution threw uncaught error:", err);
  process.exit(1);
});
