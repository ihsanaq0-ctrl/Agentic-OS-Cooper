// ── Bare Hands 100% Integration Test Suite ──────────────────────────
// Verifies daemon lifecycle, Python detection, state ring sync,
// command delivery, REST endpoints, and Cooper AI tool integration.

import express from "express";
import {
  findPythonCommand,
  isBarehandsRunning,
  startBarehands,
  stopBarehands,
  setRingState,
  sendBoardCommand,
  getBoardState,
  presentCard,
  addCard,
  resetBoard,
  registerBarehandsBridge,
} from "../server/barehands-bridge.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ROOT_DIR } from "../server/config.js";

const BH_ROOT = join(ROOT_DIR, "Github Repos", "barehands");
const BH_STATE_FILE = join(BH_ROOT, "state", "state");
const TEST_PORT = 4199;

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
  console.log("  Bare Hands Holographic Stage Integration Test   ");
  console.log("==================================================\n");

  // Test 1: Python Discovery
  console.log("1. Testing Python 3 interpreter discovery...");
  const py = findPythonCommand();
  console.log(`   Found interpreter: "${py}"`);
  assert(typeof py === "string" && py.length > 0, `Python interpreter resolved: ${py}`);

  // Test 2: Daemon Start (Direct Bridge)
  console.log("\n2. Testing Bare Hands Daemon Lifecycle (Start)...");
  const startResult = await startBarehands();
  console.log("   Start result:", startResult);
  assert(startResult.running === true, "Daemon started successfully and is reporting running");

  const runningNow = await isBarehandsRunning();
  assert(runningNow === true, "isBarehandsRunning() reports true on port 8794");

  // Test 3: Direct HTTP Config Check
  console.log("\n3. Testing Direct HTTP reachability (/config)...");
  try {
    const res = await fetch("http://127.0.0.1:8794/config");
    const cfg = await res.json();
    console.log("   Server config response:", JSON.stringify(cfg));
    assert(res.ok && cfg.name === "Cooper" && Array.isArray(cfg.orbs), "Server answered HTTP /config on port 8794 with valid config");
  } catch (err) {
    assert(false, `Failed to reach /config: ${err.message}`);
  }

  // Test 4: AI State Ring Synchronization
  console.log("\n4. Testing AI State Ring Sync (state/state)...");
  setRingState("thinking");
  assert(existsSync(BH_STATE_FILE), "state/state file created in barehands/state");
  const written = readFileSync(BH_STATE_FILE, "utf8");
  assert(written === "thinking", `state/state contains "thinking" (got: "${written}")`);

  try {
    const orbRes = await fetch("http://127.0.0.1:8794/orb");
    const orbData = await orbRes.json();
    console.log("   /orb endpoint data:", JSON.stringify(orbData));
    assert(orbData.state === "thinking", `GET /orb reflects ring state "thinking"`);
  } catch (err) {
    assert(false, `GET /orb check failed: ${err.message}`);
  }

  setRingState("idle");
  assert(readFileSync(BH_STATE_FILE, "utf8") === "idle", "Reset state back to 'idle'");

  // Test 5: Holographic Card Commands
  console.log("\n5. Testing Direct Holographic Stage Card Commands...");
  const presentOk = await presentCard(
    "Cooper Test Spotlight",
    "Agentic OS holographic glass stage is 100% operational."
  );
  assert(presentOk === true, "presentCard() sent spotlight card successfully");

  const addOk = await addCard(
    "Cooper Memory Note",
    "Pinch to grab, flick to throw, clap to clear."
  );
  assert(addOk === true, "addCard() sent floating card successfully");

  const clearOk = await resetBoard();
  assert(clearOk === true, "resetBoard() sent board clear command successfully");

  // Test 6: Board State Query
  console.log("\n6. Testing Board State Query...");
  const boardState = await getBoardState();
  assert(boardState !== null, "getBoardState() returned valid board response object");

  // Test 7: Express REST Bridge Endpoints
  console.log("\n7. Testing Cooper Express REST Bridge Endpoints...");
  const app = express();
  app.use(express.json());
  registerBarehandsBridge(app);

  const server = app.listen(TEST_PORT);
  console.log(`   Test Express server listening on http://127.0.0.1:${TEST_PORT}`);

  try {
    // GET /api/barehands/status
    const statusRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/barehands/status`);
    const statusData = await statusRes.json();
    assert(statusRes.ok && statusData.running === true, "GET /api/barehands/status returned running: true");

    // POST /api/barehands/present
    const presRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/barehands/present`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "REST Spotlight", body: "Dispatched via Express bridge" }),
    });
    const presData = await presRes.json();
    assert(presRes.ok && presData.presented === true, "POST /api/barehands/present succeeded");

    // POST /api/barehands/card
    const cardRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/barehands/card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "REST Note Card", body: "Floating glass note" }),
    });
    const cardData = await cardRes.json();
    assert(cardRes.ok && cardData.added === true, "POST /api/barehands/card succeeded");

    // POST /api/barehands/reset
    const resetRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/barehands/reset`, {
      method: "POST",
    });
    const resetData = await resetRes.json();
    assert(resetRes.ok && resetData.reset === true, "POST /api/barehands/reset succeeded");

    // POST /api/barehands/stop
    const stopApiRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/barehands/stop`, {
      method: "POST",
    });
    const stopApiData = await stopApiRes.json();
    assert(stopApiRes.ok && stopApiData.success === true, "POST /api/barehands/stop succeeded");
  } finally {
    server.close();
  }

  // Allow socket cleanup
  await new Promise((r) => setTimeout(r, 600));
  const runningAfterStop = await isBarehandsRunning();
  assert(runningAfterStop === false, "Daemon stopped cleanly after API stop command");

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
