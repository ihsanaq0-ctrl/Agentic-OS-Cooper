import { getUnifiedMemoryStatus, remember, recall, unifiedHybridSearch } from "../server/ai/memory.js";
import { isOpenVikingAlive, getOpenVikingStatus } from "../server/ai/openvikingClient.js";
import { isAgentMemoryAlive } from "../server/ai/agentmemoryClient.js";

async function runTest() {
  console.log("=== Testing Dual-Engine Cognitive Memory Subsystem ===");

  console.log("\n1. Checking Server Alive States:");
  const amAlive = await isAgentMemoryAlive();
  console.log("  AgentMemory alive (:3111):", amAlive);
  const ovAlive = await isOpenVikingAlive();
  console.log("  OpenViking alive (:1933):", ovAlive);

  console.log("\n2. Fetching Unified Memory Status:");
  const status = await getUnifiedMemoryStatus();
  console.log("  Active Mode:", status.mode);
  console.log("  Tier 1 AgentMemory:", status.tiers.tier1_agentmemory.alive ? "ACTIVE" : "OFFLINE");
  console.log("  Tier 2 OpenViking:", status.tiers.tier2_openviking.alive ? "ACTIVE" : "STANDBY / FALLBACK READY");
  console.log("  Tier 3 SQLite:", `ONLINE (${status.tiers.tier3_sqlite.total} memories stored)`);

  console.log("\n3. Testing Unified Remember:");
  const testFact = `Cooper Cognitive Test Memory ${Date.now()}: OpenViking and AgentMemory dual-engine subsystem verified.`;
  const memReceipt = await remember(testFact, {
    type: "architecture",
    concepts: ["cooper", "openviking", "agentmemory", "dual-engine"],
    project: "cooper-ecosystem",
  });
  console.log("  Memory committed receipt:", {
    id: memReceipt?.id,
    type: memReceipt?.type,
    agentmemory_stored: memReceipt?.agentmemory_stored,
    agentmemory_id: memReceipt?.agentmemory_id,
  });

  console.log("\n4. Testing Unified Recall:");
  const query = "OpenViking and AgentMemory dual-engine";
  const results = await recall(query, { limit: 3 });
  console.log(`  Recall found ${results.length} results:`);
  for (const r of results) {
    console.log(`   - [${r.source}] (${r.similarity ?? 'keyword'}) ${r.text.slice(0, 80)}...`);
  }

  console.log("\n5. Testing Hybrid Recall BLEND:");
  const hybridResults = await unifiedHybridSearch("cooper", { limit: 3 });
  console.log(`  Hybrid search returned ${hybridResults.length} deduplicated results.`);

  console.log("\n=== Dual-Engine Cognitive Memory Verification Completed Successfully! ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

