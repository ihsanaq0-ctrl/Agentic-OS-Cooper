// ── JarvisFlow 100% Integration Test Suite ──────────────────────────
// Verifies AI 4-quadrant topic expansion, session bridge management,
// Express REST endpoints, Cooper AI tool integration, and DOM hooks.

import express from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ROOT_DIR } from "../server/config.js";
import { expandTopic } from "../server/ai/brainstorm.js";
import {
  generateBrainstormSession,
  getCurrentBrainstormSession,
  openBrainstormCanvas,
  selectBrainstormNode,
  registerJarvisFlowBridge,
} from "../server/jarvisflow-bridge.js";

const TEST_PORT = 4388;
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
  console.log("      JarvisFlow Mind-Mapping Integration         ");
  console.log("==================================================\n");

  // ── 1. AI 4-Quadrant Brainstorm Expansion Service ────────────
  console.log("1. Testing AI Brainstorm Expansion Service...");
  const defaultDeck = await expandTopic("");
  assert(defaultDeck && defaultDeck.root && defaultDeck.directions, "Default deck generated with root and directions");
  assert(defaultDeck.directions.up && defaultDeck.directions.right && defaultDeck.directions.down && defaultDeck.directions.left, "Default deck contains all 4 quadrants (Up/Right/Down/Left)");
  assert(Array.isArray(defaultDeck.pages) && defaultDeck.pages.length > 0, "Default deck contains subpages for deep-dive exploration");

  const customDeck = await expandTopic("Autonomous Robotics");
  assert(customDeck && customDeck.root && customDeck.directions, "Custom topic generated with root and directions");
  assert(customDeck.title.includes("Autonomous Robotics") || customDeck.root.label.includes("Autonomous Robotics"), "Custom topic reflected in mind-map title/root");

  // ── 2. Session Bridge & Logic ────────────────────────────────
  console.log("\n2. Testing JarvisFlow Bridge Session Logic...");
  const session = await generateBrainstormSession("Neural Interface");
  assert(session && session.directions.up, "generateBrainstormSession() initialized active session");

  const current = await getCurrentBrainstormSession();
  assert(current && (current.title.includes("Neural Interface") || current.root.label.includes("Neural Interface")), "getCurrentBrainstormSession() returned matching active session");

  const selectRes = selectBrainstormNode("node-up");
  assert(selectRes.success && selectRes.nodeId === "node-up", "selectBrainstormNode('node-up') returned success");

  const openRes = await openBrainstormCanvas("AI Security");
  assert(openRes.success && openRes.session, "openBrainstormCanvas('AI Security') prepared session for HUD");

  // ── 3. Express REST Bridge Endpoints ─────────────────────────
  console.log("\n3. Testing Express REST Bridge Endpoints...");
  const app = express();
  app.use(express.json());
  registerJarvisFlowBridge(app);

  const server = app.listen(TEST_PORT);
  console.log(`   Test server listening on http://127.0.0.1:${TEST_PORT}`);

  try {
    // GET /api/brainstorm/current
    const curRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/brainstorm/current`);
    const curData = await curRes.json();
    assert(curRes.ok && curData.session && curData.session.root, "GET /api/brainstorm/current returned active session");

    // POST /api/brainstorm
    const bRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/brainstorm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Quantum Computing" }),
    });
    const bData = await bRes.json();
    assert(bRes.ok && bData.root && bData.directions.up, "POST /api/brainstorm generated structured mind-map");

    // POST /api/brainstorm/open
    const oRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/brainstorm/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Stark Tech" }),
    });
    const oData = await oRes.json();
    assert(oRes.ok && oData.success === true, "POST /api/brainstorm/open returned success: true");

    // POST /api/brainstorm/select
    const sRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/brainstorm/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: "node-right" }),
    });
    const sData = await sRes.json();
    assert(sRes.ok && sData.nodeId === "node-right", "POST /api/brainstorm/select updated active node");
  } finally {
    server.close();
  }

  // ── 4. Client Frontend Modules & DOM Elements ─────────────────
  console.log("\n4. Testing Client Frontend Modules & DOM Hooks...");
  const overlayPath = join(ROOT_DIR, "public", "hud", "jarvisFlowOverlay.js");
  const indexPath = join(ROOT_DIR, "public", "index.html");

  assert(existsSync(overlayPath), "public/hud/jarvisFlowOverlay.js exists");
  const overlayCode = readFileSync(overlayPath, "utf8");
  assert(overlayCode.includes("JarvisFlowOverlay") && overlayCode.includes("drawTrails") && overlayCode.includes("updateFromLandmarks"), "jarvisFlowOverlay.js contains complete gesture and bezier trail engine");

  const indexHtml = readFileSync(indexPath, "utf8");
  assert(indexHtml.includes("launchJarvisFlowBtn"), "public/index.html includes #launchJarvisFlowBtn in header");
  assert(indexHtml.includes("jarvisFlowModal"), "public/index.html includes #jarvisFlowModal stage container");
  assert(indexHtml.includes("flowSvgCanvas"), "public/index.html includes #flowSvgCanvas for kinetic trails");
  assert(indexHtml.includes("flow-node-center") && indexHtml.includes("flow-node-up") && indexHtml.includes("flow-node-right"), "public/index.html contains directional mind-map node elements");
  assert(indexHtml.includes("jarvisFlowOverlay.js"), "public/index.html imports jarvisFlowOverlay.js module");

  // ── 5. Cooper AI Brain Tool Schema Check ─────────────────────
  console.log("\n5. Testing Cooper Assistant Tool Definitions...");
  const assistantPath = join(ROOT_DIR, "server", "ai", "assistant.js");
  const assistantCode = readFileSync(assistantPath, "utf8");

  assert(assistantCode.includes('"brainstorm_topic"'), "assistant.js TOOLS contains 'brainstorm_topic'");
  assert(assistantCode.includes('"open_brainstorm_canvas"'), "assistant.js TOOLS contains 'open_brainstorm_canvas'");
  assert(assistantCode.includes('"get_brainstorm_tree"'), "assistant.js TOOLS contains 'get_brainstorm_tree'");
  assert(assistantCode.includes('generateBrainstormSession(args.topic)'), "assistant.js runTool dispatches generateBrainstormSession");
  assert(assistantCode.includes('openBrainstormCanvas(args.topic)'), "assistant.js runTool dispatches openBrainstormCanvas");
  assert(assistantCode.includes('getCurrentBrainstormSession()'), "assistant.js runTool dispatches getCurrentBrainstormSession");

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
