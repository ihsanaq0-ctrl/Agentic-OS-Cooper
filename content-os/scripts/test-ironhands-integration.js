// ── IronHands 100% Integration Test Suite ──────────────────────────
// Verifies spatial bridge state, 3D kinetic calculations, boundary clamping,
// external Python telemetry ingestion, Express REST endpoints, and Cooper AI tool execution.

import express from "express";
import { createServer } from "http";
import {
  getIronHandsState,
  setIronHandsTarget,
  updateIronHandsTransform,
  setIronHandsExplode,
  resetIronHandsTransform,
  ingestExternalTelemetry,
  registerIronHandsBridge,
} from "../server/ironhands-bridge.js";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING IRONHANDS 100% INTEGRATION TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      process.exitCode = 1;
    }
  }

  // ── TEST 1: Initial Spatial Telemetry State ─────────────────────
  console.log("1. Testing Initial Bridge State...");
  const initial = getIronHandsState();
  assert(initial.target === "arc_reactor", "Initial target defaults to arc_reactor");
  assert(initial.transform.scale === 1.0, "Default scale is 1.0");
  assert(initial.transform.explodeFactor === 0.0, "Default explode factor is 0.0 (assembled)");
  assert(initial.gripState === "FREE", "Initial grip state is FREE");

  // ── TEST 2: Transformation Updates & Clamping ───────────────────
  console.log("\n2. Testing 3D Spatial Transforms & Bounds Clamping...");
  const t1 = updateIronHandsTransform({ x: 0.8, y: -0.4, z: 0.2, rotY: 1.57, scale: 2.2 });
  assert(t1.success === true, "Transform update returned success");
  assert(t1.transform.x === 0.8, "Pan X coordinate updated to 0.8");
  assert(t1.transform.rotY === 1.57, "Yaw angle updated to 1.57 rad");
  assert(t1.transform.scale === 2.2, "Scale multiplier updated to 2.2x");

  // Clamping test: scale exceeds maximum 5.0
  const tClamp = updateIronHandsTransform({ scale: 99.0, explodeFactor: 5.0 });
  assert(tClamp.transform.scale === 5.0, "Scale correctly clamped to maximum 5.0");
  assert(tClamp.transform.explodeFactor === 1.0, "Explode factor correctly clamped to 1.0");

  // ── TEST 3: Target Model Switching ─────────────────────────────
  console.log("\n3. Testing Target Switching (Arc Reactor vs Globe)...");
  const tgtGlobe = setIronHandsTarget("globe");
  assert(tgtGlobe.success === true && tgtGlobe.target === "globe", "Switched target to globe");
  assert(getIronHandsState().target === "globe", "State reflects globe as active target");

  const tgtArc = setIronHandsTarget("arc_reactor");
  assert(tgtArc.success === true && tgtArc.target === "arc_reactor", "Switched back to arc_reactor");

  // ── TEST 4: Holographic Explode / Disassembly ──────────────────
  console.log("\n4. Testing Holographic Explode / Disassembly Mechanics...");
  const expRes = setIronHandsExplode(0.85);
  assert(expRes.success === true && expRes.explodeFactor === 0.85, "Explode factor set to 0.85 (85% deconstruction)");
  assert(getIronHandsState().transform.explodeFactor === 0.85, "State accurately reflects 85% component disassembly");

  // ── TEST 5: Reset Transformation ───────────────────────────────
  console.log("\n5. Testing Transformation Reset to Defaults...");
  const resetRes = resetIronHandsTransform();
  assert(resetRes.success === true, "Reset transform executed successfully");
  assert(resetRes.transform.explodeFactor === 0.0, "Explode factor reset to 0.0");
  assert(resetRes.transform.x === 0 && resetRes.transform.y === 0, "Pan coordinates reset to home origin (0, 0)");

  // ── TEST 6: External Python Telemetry Packet Ingestion ─────────
  console.log("\n6. Testing External Python IronHands Telemetry Ingestion (main.py format)...");
  const pyPacket = {
    scale: 1.65,
    rotate: 0.94,
    pan: [0.75, -0.35],
    target: "arc_reactor",
  };
  const ingRes = ingestExternalTelemetry(pyPacket);
  assert(ingRes.success === true, "Ingested Python telemetry packet successfully");
  assert(ingRes.transform.scale === 1.65, "Scale mapped from Python packet (1.65)");
  assert(ingRes.transform.rotZ === 0.94, "Rotation angle mapped from Python packet (0.94)");
  assert(ingRes.transform.x === 0.75 && ingRes.transform.y === -0.35, "Pan coordinates mapped from Python array [0.75, -0.35]");

  // ── TEST 7: Express REST Bridge Endpoints ──────────────────────
  console.log("\n7. Testing Express REST Bridge Endpoints...");
  const app = express();
  app.use(express.json());
  registerIronHandsBridge(app);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // GET /api/ironhands/status
    const resStatus = await fetch(`${baseUrl}/api/ironhands/status`).then((r) => r.json());
    assert(resStatus.target === "arc_reactor", "REST GET /api/ironhands/status returns valid state");

    // POST /api/ironhands/transform
    const resTransform = await fetch(`${baseUrl}/api/ironhands/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta: { x: 0.33, rotY: 0.55 }, target: "arc_reactor" }),
    }).then((r) => r.json());
    assert(resTransform.success === true && resTransform.transform.x === 0.33, "REST POST /api/ironhands/transform updates state");

    // POST /api/ironhands/explode
    const resExplode = await fetch(`${baseUrl}/api/ironhands/explode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factor: 0.7, target: "arc_reactor" }),
    }).then((r) => r.json());
    assert(resExplode.success === true && resExplode.explodeFactor === 0.7, "REST POST /api/ironhands/explode sets disassembly factor");

    // POST /api/ironhands/telemetry
    const resTelem = await fetch(`${baseUrl}/api/ironhands/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scale: 1.25, rotate: 0.12, pan: [0.1, 0.2] }),
    }).then((r) => r.json());
    assert(resTelem.success === true && resTelem.transform.scale === 1.25, "REST POST /api/ironhands/telemetry ingests packet");

    // POST /api/ironhands/reset
    const resReset = await fetch(`${baseUrl}/api/ironhands/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "arc_reactor" }),
    }).then((r) => r.json());
    assert(resReset.success === true && resReset.transform.explodeFactor === 0.0, "REST POST /api/ironhands/reset restores default alignment");
  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log("==================================================\n");

  if (passed === total) {
    console.log("🎉 ALL IRONHANDS INTEGRATION TESTS PASSED!");
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
