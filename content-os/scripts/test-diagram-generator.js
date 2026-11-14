import { generateDiagram, THEMES } from "../server/ai/diagramGenerator.js";
import { existsSync, readFileSync } from "fs";

async function runTest() {
  console.log("=== Testing Phase 3: Editorial Vector Diagram Design Subsystem ===");

  console.log("\n1. Testing Themes Palette:");
  for (const [key, t] of Object.entries(THEMES)) {
    console.log(`  Theme '${key}': ${t.name} (Paper: ${t.paper}, Accent: ${t.accent})`);
  }

  console.log("\n2. Generating Architecture Diagram (Cooper Stark Theme):");
  const archResult = await generateDiagram({
    type: "architecture",
    title: "Cooper Stark Multi-Agent Subsystem Architecture",
    subtitle: "Unified 6-Tier High-Precision Orchestration Engine",
    theme: "cooper-stark",
    nodes: [
      { id: "core", label: "Cooper Kernel", subtitle: "Express :3950 Core", role: "core", accent: true, tag: "COORDINATOR" },
      { id: "voice", label: "VoiceStudio", subtitle: "OmniVoice :3900", role: "engine", tag: "OFFLINE TTS" },
      { id: "memory", label: "AgentMemory", subtitle: "BM25 + KG :3111", role: "storage", tag: "FAST PATH" },
      { id: "viking", label: "OpenViking", subtitle: "viking:// Filesystem :1933", role: "storage", tag: "DEEP DOCS" },
      { id: "harness", label: "Harness Gates", subtitle: "Deterministic Verification", role: "gateway", tag: "GOVERNANCE" },
      { id: "diagram", label: "Diagram Design", subtitle: "Editorial SVGs & HTML", role: "visuals", tag: "4PX GRID" },
    ],
    links: [
      { from: "core", to: "voice", label: "Speech I/O" },
      { from: "core", to: "memory", label: "Fast Recall" },
      { from: "core", to: "viking", label: "Codebase Context" },
      { from: "core", to: "harness", label: "Tool Contracts" },
      { from: "core", to: "diagram", label: "Visual Stage" },
    ],
    projectOnStage: false,
  });

  console.log("  Architecture Diagram generated:");
  console.log("    ID:", archResult.id);
  console.log("    SVG file exists:", existsSync(archResult.svgPath));
  console.log("    HTML file exists:", existsSync(archResult.htmlPath));
  console.log("    Public URL:", archResult.publicUrl);
  console.log("    SVG Size (bytes):", archResult.svg.length);

  console.log("\n3. Generating Sequential Process Flowchart:");
  const flowResult = await generateDiagram({
    type: "flowchart",
    title: "Autonomous Content Scraping & Social Distribution Pipeline",
    subtitle: "From Ingestion to Holographic Review & Multi-Platform Dispatch",
    theme: "cooper-stark",
    nodes: [
      { label: "Scrape Intake", subtitle: "RSS & Firecrawl", accent: false },
      { label: "AI Priority Rank", subtitle: "LLM Scoring", accent: false },
      { label: "Post & Slide Deck", subtitle: "Content & Carousel PDF", accent: true },
      { label: "Holographic Review", subtitle: "Bare Hands Stage", accent: false },
      { label: "Publish", subtitle: "LinkedIn / X / IG", accent: true },
    ],
    projectOnStage: false,
  });

  console.log("  Flowchart Diagram generated:");
  console.log("    ID:", flowResult.id);
  console.log("    Public URL:", flowResult.publicUrl);

  console.log("\n4. Generating Layer Stack Diagram:");
  const layersResult = await generateDiagram({
    type: "layers",
    title: "Agentic OS Deep Architectural Hierarchy",
    subtitle: "Core System Infrastructure Layers",
    theme: "cooper-stark",
    layers: [
      { label: "Holographic Presentation Layer", subtitle: "Bare Hands Glass Stage (:8794) • Jarvis CV • Content Studio Carousels" },
      { label: "Cognitive Memory & Reasoning Layer", subtitle: "AgentMemory (:3111) • OpenViking (:1933) • SQLite Vector Embeddings" },
      { label: "Private Speech & Butler Identity Layer", subtitle: "VoiceStudio OmniVoice (:3900) • On-Device Whisper STT" },
      { label: "Autonomous Agent & Harness Layer", subtitle: "browser-use CDP Controller • Awesome-Harness Verification Gates" },
      { label: "Operating System & Hardware Kernel", subtitle: "Node 20+ Express Runtime • SQLite WASM • Windows Proactor Loop" },
    ],
    projectOnStage: false,
  });

  console.log("  Layer Stack Diagram generated:");
  console.log("    ID:", layersResult.id);
  console.log("    Public URL:", layersResult.publicUrl);

  console.log("\n=== Phase 3 Verification Completed Successfully! ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
