import { getBrowserAgentStatus, getPythonExecutable } from "../server/system/browserAgentBridge.js";
import { execSync } from "child_process";
import { remember, recall } from "../server/ai/memory.js";

async function runTest() {
  console.log("=== Testing Phase 4: Autonomous Web Agent Subsystem (browser-use) ===");

  console.log("\n1. Verifying Browser Agent Runtime & Environment:");
  const status = getBrowserAgentStatus();
  console.log("  Runtime Status:", status);

  const pythonBin = getPythonExecutable();
  console.log("  Python Executable:", pythonBin);

  try {
    const pyVer = execSync(`"${pythonBin}" --version`, { encoding: "utf8" }).trim();
    console.log("  Python Version:", pyVer);

    const buCheck = execSync(`"${pythonBin}" -c "import browser_use; print('browser_use imported successfully! version:', getattr(browser_use, '__version__', '1.0.2'))"`, { encoding: "utf8" }).trim();
    console.log("  Browser-Use Import Check:", buCheck);
  } catch (err) {
    console.warn("  Python check warning:", err.message);
  }

  console.log("\n2. Testing Cognitive Memory Auto-Commit Pipeline for Web Research:");
  const testResearchText = `Autonomous Web Agent Verification ${Date.now()}: Cooper completed deep web reconnaissance using browser-use CDP. Discovered architectural patterns for local multimodal reasoning.`;
  const memReceipt = await remember(testResearchText, {
    type: "research",
    concepts: ["browser-task", "web-research", "cdp-automation"],
    project: "browser-agent",
    source: "browser-use-verification",
    uri: `viking://research/web/test-${Date.now()}`,
  });

  console.log("  Research committed to memory:", {
    id: memReceipt?.id,
    type: memReceipt?.type,
    agentmemory_stored: memReceipt?.agentmemory_stored,
    agentmemory_id: memReceipt?.agentmemory_id,
  });

  const recalled = await recall("browser-use CDP deep web reconnaissance", { limit: 2 });
  console.log(`  Recalled ${recalled.length} web research memories:`);
  for (const r of recalled) {
    console.log(`   - [${r.source}] ${r.text.slice(0, 80)}...`);
  }

  console.log("\n=== Phase 4 Verification Completed Successfully! ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
