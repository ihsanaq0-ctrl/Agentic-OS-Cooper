// ── Jarvis-CV / Stark HUD & Sound Engine Bridge ─────────────────────
// Connects Cooper's AI brain to the procedural Web Audio Synthesizer,
// 3D Arc Reactor Hologram, and tactical HUD state.

import { broadcastGlobal } from "./sse.js";

let hudState = {
  mode: "globe", // "globe" | "arc_reactor"
  powerLevel: 100, // 0 - 100%
  threatLevel: "MINIMAL", // MINIMAL | LOW | MEDIUM | HIGH
  systemStatus: "NOMINAL", // NOMINAL | WARNING | CRITICAL
  soundEnabled: true,
};

const VALID_SOUND_CUES = new Set([
  "engage",
  "select",
  "hover",
  "error",
  "repulsor",
  "scan",
  "lock",
  "unlock",
  "pulse",
]);

/**
 * Get current HUD state
 */
export function getHudStatus() {
  return { ...hudState };
}

/**
 * Set active HUD centerpiece mode (globe vs arc_reactor)
 */
export function setHudMode(mode) {
  const target = String(mode || "").toLowerCase().trim();
  if (target === "arc" || target === "arc_reactor" || target === "reactor") {
    hudState.mode = "arc_reactor";
  } else {
    hudState.mode = "globe";
  }
  broadcastGlobal({ type: "hud:mode", mode: hudState.mode });
  return { success: true, mode: hudState.mode };
}

/**
 * Set Arc Reactor simulated power output (0-100%)
 */
export function setArcPower(power) {
  const num = Math.max(0, Math.min(100, Number(power) || 100));
  hudState.powerLevel = num;
  broadcastGlobal({ type: "hud:power", power: num });
  return { success: true, power: num };
}

/**
 * Trigger a client-side procedural sound cue
 */
export function triggerSoundCue(cue, options = {}) {
  const c = String(cue || "select").toLowerCase().trim();
  if (!VALID_SOUND_CUES.has(c)) {
    return { success: false, error: `Invalid sound cue "${cue}". Valid: ${Array.from(VALID_SOUND_CUES).join(", ")}` };
  }
  broadcastGlobal({ type: "hud:sound", cue: c, ...options });
  return { success: true, cue: c };
}

/**
 * Register Jarvis-CV bridge endpoints on the Express application
 */
export function registerJarvisCvBridge(app) {
  // Get HUD status
  app.get("/api/hud/status", (_req, res) => {
    res.json(getHudStatus());
  });

  // Switch HUD centerpiece mode
  app.post("/api/hud/mode", (req, res) => {
    const { mode } = req.body || {};
    const result = setHudMode(mode);
    res.json(result);
  });

  // Adjust Arc Reactor power output
  app.post("/api/hud/power", (req, res) => {
    const { power } = req.body || {};
    const result = setArcPower(power);
    res.json(result);
  });

  // Trigger procedural audio cue
  app.post("/api/hud/sound", (req, res) => {
    const { cue } = req.body || {};
    const result = triggerSoundCue(cue, req.body);
    res.json(result);
  });
}
