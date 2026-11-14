// ── IronHands ↔ Cooper 3D Spatial Kinetic Bridge ──────────────────────
// Bridges Cooper's AI brain, gesture engine, and external Python/Blender scripts
// with real-time 3D spatial transformations (Pan X/Y/Z, Rotation, Scale, Explode).

import { broadcastGlobal } from "./sse.js";

// Default spatial transformation state
const defaultTransform = () => ({
  x: 0,
  y: 0,
  z: 0,
  rotX: 0.22,  // Default subtle Stark tilt
  rotY: -0.22,
  rotZ: 0,
  scale: 1.0,
  explodeFactor: 0.0, // 0.0 (assembled) to 1.0 (fully disassembled)
});

let activeState = {
  target: "arc_reactor", // "arc_reactor" | "globe"
  gripState: "FREE",     // "FREE" | "PINCH" | "FIST_LOCKED" | "EXPLODING"
  transforms: {
    arc_reactor: defaultTransform(),
    globe: defaultTransform(),
  },
  lastUpdated: Date.now(),
};

/**
 * Get the current IronHands spatial telemetry state
 */
export function getIronHandsState() {
  return {
    target: activeState.target,
    gripState: activeState.gripState,
    transform: { ...(activeState.transforms[activeState.target] || defaultTransform()) },
    allTransforms: activeState.transforms,
    lastUpdated: activeState.lastUpdated,
  };
}

/**
 * Set the active 3D manipulation target
 * @param {"arc_reactor"|"globe"} target
 */
export function setIronHandsTarget(target) {
  const norm = String(target || "").toLowerCase().trim();
  if (norm.includes("globe") || norm.includes("earth")) {
    activeState.target = "globe";
  } else {
    activeState.target = "arc_reactor";
  }
  activeState.lastUpdated = Date.now();

  broadcastGlobal({
    type: "ironhands:target",
    target: activeState.target,
    transform: activeState.transforms[activeState.target],
  });

  return { success: true, target: activeState.target };
}

/**
 * Update 3D transformation values for the active target
 */
export function updateIronHandsTransform(delta = {}, target = null) {
  const tgt = target ? (target.includes("globe") ? "globe" : "arc_reactor") : activeState.target;
  const current = activeState.transforms[tgt] || defaultTransform();

  if (typeof delta.x === "number") current.x = delta.x;
  if (typeof delta.y === "number") current.y = delta.y;
  if (typeof delta.z === "number") current.z = delta.z;
  if (typeof delta.rotX === "number") current.rotX = delta.rotX;
  if (typeof delta.rotY === "number") current.rotY = delta.rotY;
  if (typeof delta.rotZ === "number") current.rotZ = delta.rotZ;
  if (typeof delta.scale === "number") {
    current.scale = Math.max(0.1, Math.min(5.0, delta.scale));
  }
  if (typeof delta.explodeFactor === "number") {
    current.explodeFactor = Math.max(0.0, Math.min(1.0, delta.explodeFactor));
  }
  if (delta.gripState) {
    activeState.gripState = delta.gripState;
  }

  activeState.transforms[tgt] = current;
  activeState.lastUpdated = Date.now();

  broadcastGlobal({
    type: "ironhands:transform",
    target: tgt,
    transform: current,
    gripState: activeState.gripState,
  });

  return { success: true, target: tgt, transform: current };
}

/**
 * Set the holographic explode/disassembly factor (0.0 to 1.0)
 */
export function setIronHandsExplode(factor, target = null) {
  const tgt = target ? (target.includes("globe") ? "globe" : "arc_reactor") : activeState.target;
  const num = Math.max(0.0, Math.min(1.0, Number(factor) || 0));

  const current = activeState.transforms[tgt] || defaultTransform();
  current.explodeFactor = num;
  activeState.transforms[tgt] = current;
  activeState.lastUpdated = Date.now();

  broadcastGlobal({
    type: "ironhands:explode",
    target: tgt,
    explodeFactor: num,
  });

  return { success: true, target: tgt, explodeFactor: num };
}

/**
 * Reset 3D transformation to default position
 */
export function resetIronHandsTransform(target = null) {
  const tgt = target ? (target.includes("globe") ? "globe" : "arc_reactor") : activeState.target;
  activeState.transforms[tgt] = defaultTransform();
  activeState.gripState = "FREE";
  activeState.lastUpdated = Date.now();

  broadcastGlobal({
    type: "ironhands:reset",
    target: tgt,
    transform: activeState.transforms[tgt],
  });

  return { success: true, target: tgt, transform: activeState.transforms[tgt] };
}

/**
 * Ingest external telemetry packets from Python IronHands scripts (main.py)
 */
export function ingestExternalTelemetry(packet = {}) {
  const { scale, rotate, pan, target } = packet;
  const delta = {};

  if (typeof scale === "number") delta.scale = scale;
  if (typeof rotate === "number") delta.rotZ = rotate;
  if (Array.isArray(pan) && pan.length >= 2) {
    delta.x = Number(pan[0]) || 0;
    delta.y = Number(pan[1]) || 0;
  }

  return updateIronHandsTransform(delta, target);
}

/**
 * Register IronHands Express REST endpoints
 */
export function registerIronHandsBridge(app) {
  // Get active spatial status
  app.get("/api/ironhands/status", (_req, res) => {
    res.json(getIronHandsState());
  });

  // Update transformation
  app.post("/api/ironhands/transform", (req, res) => {
    try {
      const { delta, target } = req.body || {};
      const result = updateIronHandsTransform(delta || req.body, target);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Switch target model (arc_reactor vs globe)
  app.post("/api/ironhands/target", (req, res) => {
    const { target } = req.body || {};
    const result = setIronHandsTarget(target);
    res.json(result);
  });

  // Set explode / disassembly factor
  app.post("/api/ironhands/explode", (req, res) => {
    const { factor, target } = req.body || {};
    const result = setIronHandsExplode(factor, target);
    res.json(result);
  });

  // Reset 3D transformation
  app.post("/api/ironhands/reset", (req, res) => {
    const { target } = req.body || {};
    const result = resetIronHandsTransform(target);
    res.json(result);
  });

  // Ingest Python IronHands telemetry packet
  app.post("/api/ironhands/telemetry", (req, res) => {
    const result = ingestExternalTelemetry(req.body || {});
    res.json(result);
  });
}
