// Verification script for Agentic OS 2.0 new autonomous superpowers
import { generateCarouselContent, renderCarouselPdf } from "../server/ai/carousel.js";
import { collectArxiv } from "../server/collectors/arxiv.js";
import { collectGitHub } from "../server/collectors/github.js";
import { remember, recall } from "../server/ai/memory.js";
import { generateBriefing } from "../server/ai/briefing.js";
import { existsSync } from "fs";

async function runTests() {
  console.log("==================================================");
  console.log("  AGENTIC OS 2.0 — VERIFICATION TEST SUITE");
  console.log("==================================================\n");

  // Test 1: ArXiv Collector
  console.log("[1/4] Testing ArXiv cs.AI collector...");
  try {
    const papers = await collectArxiv("cs.AI", { maxItems: 3 });
    console.log(`  ✓ ArXiv returned ${papers.length} papers`);
    if (papers.length > 0) {
      console.log(`    Sample: "${papers[0].title.slice(0, 60)}..."`);
    }
  } catch (err) {
    console.log(`  ✗ ArXiv test failed: ${err.message}`);
  }

  // Test 2: GitHub Trending AI collector
  console.log("\n[2/4] Testing GitHub Trending AI collector...");
  try {
    const repos = await collectGitHub("AI", { maxItems: 3 });
    console.log(`  ✓ GitHub returned ${repos.length} repos`);
    if (repos.length > 0) {
      console.log(`    Sample: "${repos[0].title}"`);
    }
  } catch (err) {
    console.log(`  ✗ GitHub test failed: ${err.message}`);
  }

  // Test 3: Memory System
  console.log("\n[3/4] Testing Cooper Long-Term Memory (SQLite)...");
  try {
    await remember("Multi-agent consensus framework with speculative execution researched by Ihsan", "research", { topic: "AI Agents" });
    const recalled = await recall("multi-agent consensus", { limit: 1 });
    console.log(`  ✓ Memory recalled ${recalled.length} relevant items`);
    if (recalled.length > 0) {
      console.log(`    Recalled: "${recalled[0].text.slice(0, 70)}..."`);
    }
  } catch (err) {
    console.log(`  ✗ Memory test failed: ${err.message}`);
  }

  // Test 4: PDF Carousel Generator
  console.log("\n[4/4] Testing LinkedIn PDF Carousel Generator...");
  try {
    const sampleTopic = "Multi-Agent System Architecture for Autonomous Enterprise Workflows";
    console.log("  Generating 5-slide breakdown via LLM...");
    const carouselData = await generateCarouselContent(sampleTopic, { numSlides: 5 });
    console.log(`  ✓ Generated ${carouselData.slides?.length || 0} structured slides`);
    console.log(`    Title: "${carouselData.title}"`);

    console.log("  Rendering vertical 1080x1350 PDF document...");
    const pdfRes = await renderCarouselPdf(carouselData, { authorName: "Ihsan Ullah" });
    const exists = existsSync(pdfRes.path);
    console.log(`  ✓ PDF rendered: ${pdfRes.relativePath} (File exists: ${exists})`);
  } catch (err) {
    console.log(`  ✗ Carousel test failed: ${err.message}`);
  }

  // Test 5: Proactive Morning Briefing
  console.log("\n[5/5] Testing Proactive Morning Briefing Engine...");
  try {
    const briefing = await generateBriefing("morning", { generateAudio: false });
    console.log(`  ✓ Briefing generated (ID: ${briefing.id})`);
    console.log(`    Snippet: "${briefing.text.slice(0, 100)}..."`);
  } catch (err) {
    console.log(`  ✗ Briefing test failed: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log("  TEST SUITE COMPLETE");
  console.log("==================================================");
}

runTests().catch((err) => console.error("Fatal test error:", err));
