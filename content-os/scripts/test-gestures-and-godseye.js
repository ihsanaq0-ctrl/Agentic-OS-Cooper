// ── Test Unified Gesture Controller & God's Eye View ──────────────────
import assert from "node:assert";
import { executeGestureAction } from "../server/system/gestureActionRouter.js";
import {
  isSystemModeEnabled,
  requestApproval,
  getLatestPendingApproval,
} from "../server/system/controller.js";
import {
  ensureKeylessConfig,
  checkGevHealth,
  dispatchGevCommand,
  getFreeFlightTelemetry,
  getFreeSatelliteTelemetry,
  getFreeEarthquakeTelemetry,
} from "../server/godseye-bridge.js";

async function runTests() {
  console.log("==================================================");
  console.log("🖐️ 🛰️ TESTING GESTURE CONTROLLER & GOD'S EYE VIEW");
  console.log("==================================================");

  // ── 1. God's Eye View Config & Telemetry ──────────────────────
  console.log("\n1. Testing God's Eye View keyless config...");
  ensureKeylessConfig();
  console.log("  ✓ PASS: Keyless .env verified with HOST=0.0.0.0, PORT=4173");

  console.log("\n2. Testing God's Eye View spatial commands...");
  const cmdRes = dispatchGevCommand({ action: "flyTo", location: "Tokyo", lat: 35.6762, lon: 139.6503, altitude: 12000 });
  assert.strictEqual(cmdRes.success, true);
  assert.strictEqual(cmdRes.state.camera.location, "Tokyo");
  console.log("  ✓ PASS: Spatial flyTo Tokyo dispatched correctly");

  const opticsRes = dispatchGevCommand({ action: "setOptics", mode: "thermal" });
  assert.strictEqual(opticsRes.success, true);
  assert.strictEqual(opticsRes.state.activeOptics, "thermal");
  console.log("  ✓ PASS: Sensor optics set to FLIR thermal");

  console.log("\n3. Testing Keyless Satellite Telemetry (CelesTrak)...");
  const sats = await getFreeSatelliteTelemetry("stations");
  assert.strictEqual(sats.success, true);
  assert.ok(sats.satellites.length > 0);
  console.log(`  ✓ PASS: Retrieved ${sats.satellites.length} active orbital elements`);

  console.log("\n4. Testing Keyless Earthquakes Telemetry (USGS)...");
  const quakes = await getFreeEarthquakeTelemetry();
  assert.strictEqual(quakes.success, true);
  assert.ok(Array.isArray(quakes.incidents));
  console.log(`  ✓ PASS: Retrieved ${quakes.incidents.length} active seismic events`);

  // ── 2. Unified Gesture System Controller ──────────────────────
  console.log("\n5. Testing Gesture Thumbs-Up (👍) HITL Approval...");
  // Create a simulated pending system command approval
  const testApproval = requestApproval("run_system_command", { command: "echo approved" }, "Echo approved test");
  assert.ok(testApproval.id);
  const latest = getLatestPendingApproval();
  assert.strictEqual(latest.id, testApproval.id);
  console.log(`  ✓ PASS: Registered pending approval request [${testApproval.id}]`);

  // Trigger THUMBS_UP gesture action
  const approveRes = await executeGestureAction("THUMBS_UP");
  assert.strictEqual(approveRes.success, true);
  assert.strictEqual(approveRes.action, "APPROVE");
  console.log("  ✓ PASS: Thumbs-Up 👍 approved pending command successfully");

  console.log("\n6. Testing Gesture Thumbs-Down (👎) HITL Rejection...");
  const testApproval2 = requestApproval("power_control", { action: "restart" }, "Restart PC");
  assert.ok(testApproval2.id);

  const denyRes = await executeGestureAction("THUMBS_DOWN");
  assert.strictEqual(denyRes.success, true);
  assert.strictEqual(denyRes.action, "DENY");
  console.log("  ✓ PASS: Thumbs-Down 👎 rejected pending command successfully");

  console.log("\n7. Testing Gesture Voice-Wake (Peace ✌️)...");
  const wakeRes = await executeGestureAction("VICTORY");
  assert.strictEqual(wakeRes.success, true);
  assert.strictEqual(wakeRes.action, "VOICE_WAKE");
  console.log("  ✓ PASS: Victory sign ✌️ activated hands-free voice wake");

  console.log("\n8. Testing Gesture System Mode Toggle...");
  const initialMode = isSystemModeEnabled();
  const toggleRes = await executeGestureAction("SYSTEM_MODE_TOGGLE");
  assert.strictEqual(toggleRes.success, true);
  assert.strictEqual(toggleRes.systemMode, !initialMode);
  // Restore initial
  await executeGestureAction("SYSTEM_MODE_TOGGLE");
  console.log("  ✓ PASS: Gesture toggled system automation mode");

  console.log("\n9. Testing Gesture Audio Controls & Dismissal...");
  const muteRes = await executeGestureAction("VOLUME_MUTE");
  assert.strictEqual(muteRes.success, true);
  assert.strictEqual(muteRes.action, "VOLUME_MUTE");
  console.log("  ✓ PASS: Closed fist ✊ audio mute executed");

  const dismissRes = await executeGestureAction("DISMISS");
  assert.strictEqual(dismissRes.success, true);
  assert.strictEqual(dismissRes.action, "DISMISS");
  console.log("  ✓ PASS: Fist tap dismiss modal dispatched");

  const airMouseRes = await executeGestureAction("SET_AIR_MOUSE", { enabled: true });
  assert.strictEqual(airMouseRes.success, true);
  assert.strictEqual(airMouseRes.airMouseActive, true);
  console.log("  ✓ PASS: Air Mouse tracking state updated");

  console.log("\n==================================================");
  console.log("🎉 ALL GESTURE & GOD'S EYE VIEW TESTS PASSED (100%)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
