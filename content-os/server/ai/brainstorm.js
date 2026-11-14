// ── JarvisFlow: AI 4-Quadrant Brainstorming & Topic Expansion Service ──
// Expands any technical concept, startup plan, or research query into a
// 4-quadrant directional tree (Up/Right/Down/Left) with drill-down subpages.

import { chat, assistantFastModel } from "./openrouter.js";

const STATIC_BIOLOGY_DECK = {
  id: "systems-foundations",
  title: "Multi-Agent System Foundations",
  root: {
    id: "mas-core",
    label: "Agentic OS",
    content: "Autonomous personal operating system orchestrating multi-agent workflows, computer vision, biometrics, and spatial computing.",
  },
  directions: {
    up: {
      id: "vision-autonomy",
      label: "Autonomous Vision",
      content: "Proactive assistance with zero manual prompt friction. Cooper monitors goals, schedule, and environment to act without waiting.",
    },
    right: {
      id: "arch-bridges",
      label: "Hardware & Bridges",
      content: "Decoupled bridges over Web Audio API, Three.js spatial holograms, MediaPipe hand tracking, and local neural biometrics.",
    },
    down: {
      id: "exec-orchestration",
      label: "Execution Engine",
      content: "Stateful task graphs, human-in-the-loop security gates, and streaming tool calls with instant synthesized acoustic feedback.",
    },
    left: {
      id: "sec-safeguards",
      label: "Security & Guardrails",
      content: "128D local facial vector matching, PIN fallbacks, and strict permission verification for high-risk system actions.",
    },
  },
  pages: [
    {
      id: "drilldown-vision",
      title: "Vision & Spatial UI",
      root: { id: "vision-root", label: "Spatial HUD", content: "Iron Man holographic visor, 3D Arc Reactor, and Bare Hands glass board." },
      directions: {
        up: { id: "v-up", label: "Repulsor FX", content: "Procedural Web Audio energy pulses and palm tracking reticles." },
        right: { id: "v-right", label: "Arc Reactor", content: "10-coil electromagnetic core spinning and breathing in sync with assistant states." },
        down: { id: "v-down", label: "Bare Hands", content: "Transparent spatial AR stage over webcam with claw and flick physics." },
        left: { id: "v-left", label: "Target Lock", content: "Neural face mesh visor overlay with continuous operator tracking." },
      },
    },
    {
      id: "drilldown-agents",
      title: "Agent Capabilities",
      root: { id: "agent-root", label: "Tool Suite", content: "Extensible registry of autonomous tools and system controllers." },
      directions: {
        up: { id: "a-up", label: "Memory Recall", content: "Vector and keyword hybrid memory for persistent long-term operator context." },
        right: { id: "a-right", label: "Web Intelligence", content: "Real-time Perplexity web research and news headline distillation." },
        down: { id: "a-down", label: "System Control", content: "Local shell execution, application launch, and power automation." },
        left: { id: "a-left", label: "Content Studio", content: "Automated LinkedIn PDF carousels, drafts, and social publishing." },
      },
    },
  ],
  source: "static",
};

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";
}

function parseJsonClean(text) {
  if (!text) return null;
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

/**
 * Generate algorithmic fallback when offline or LLM unavailable
 */
function createAlgorithmicFallback(topic) {
  const rootLabel = topic.trim() || "Core Objective";
  return {
    id: slugify(rootLabel),
    title: `${rootLabel} Brainstorm`,
    root: {
      id: `root-${slugify(rootLabel)}`,
      label: rootLabel,
      content: `Primary focal topic: ${rootLabel}. Strategic exploration mapped across 4 operational quadrants.`,
    },
    directions: {
      up: {
        id: `up-${slugify(rootLabel)}`,
        label: "Strategic Vision",
        content: `Core purpose, high-level objectives, and desired end-state for ${rootLabel}.`,
      },
      right: {
        id: `right-${slugify(rootLabel)}`,
        label: "Tech & Architecture",
        content: `Underlying technologies, architectural layers, and system integrations required for ${rootLabel}.`,
      },
      down: {
        id: `down-${slugify(rootLabel)}`,
        label: "Action Plan",
        content: `Immediate milestones, deliverables, and sequential execution roadmap for ${rootLabel}.`,
      },
      left: {
        id: `left-${slugify(rootLabel)}`,
        label: "Risk & Safeguards",
        content: `Critical bottlenecks, failure modes, and safety mechanisms to protect ${rootLabel}.`,
      },
    },
    pages: [],
    source: "fallback",
    topic: rootLabel,
  };
}

/**
 * Expand any topic into a 4-quadrant directional brainstorm tree
 */
export async function expandTopic(topic = "") {
  const q = String(topic || "").trim();
  if (!q) {
    return { ...STATIC_BIOLOGY_DECK, topic: "Multi-Agent System Foundations" };
  }

  const prompt = `You are Cooper, an advanced sci-fi AI automation system.
Decompose the topic "${q}" into an interactive 4-quadrant spatial mind map for gesture navigation.

Return ONLY a valid JSON object matching this schema (no markdown, no preamble):
{
  "id": "${slugify(q)}",
  "title": "${q}",
  "root": {
    "id": "root-node",
    "label": "${q}",
    "content": "One concise paragraph defining the essence of ${q}."
  },
  "directions": {
    "up": {
      "id": "node-up",
      "label": "Short Title (1-3 words for Vision/Goal)",
      "content": "Specific actionable explanation of the strategic vision."
    },
    "right": {
      "id": "node-right",
      "label": "Short Title (1-3 words for Architecture/Tech)",
      "content": "Specific technical stack and infrastructure details."
    },
    "down": {
      "id": "node-down",
      "label": "Short Title (1-3 words for Execution/Steps)",
      "content": "Concrete roadmap steps and milestones."
    },
    "left": {
      "id": "node-left",
      "label": "Short Title (1-3 words for Risk/Defense)",
      "content": "Vulnerabilities, guardrails, and mitigations."
    }
  },
  "pages": [
    {
      "id": "page-deep-dive-1",
      "title": "Sub-Domain Exploration",
      "root": { "id": "sub-1-root", "label": "Key Pillar", "content": "Detailed breakdown of the primary operational pillar." },
      "directions": {
        "up": { "id": "p1-up", "label": "Milestone A", "content": "First phase deliverable." },
        "right": { "id": "p1-right", "label": "Tooling", "content": "Key libraries and frameworks." },
        "down": { "id": "p1-down", "label": "Validation", "content": "Testing and verification plan." },
        "left": { "id": "p1-left", "label": "Constraint", "content": "Resource and latency boundaries." }
      }
    }
  ]
}`;

  try {
    const raw = await chat([
      { role: "system", content: "You output strictly valid raw JSON only. No markdown formatting, no comments." },
      { role: "user", content: prompt },
    ], { model: assistantFastModel() });

    const parsed = parseJsonClean(raw);
    if (parsed && parsed.root && parsed.directions?.up && parsed.directions?.right) {
      return {
        ...parsed,
        source: "ai",
        topic: q,
      };
    }
    return createAlgorithmicFallback(q);
  } catch (err) {
    console.warn(`[Brainstorm] LLM expansion failed for "${q}": ${err.message}. Using fallback.`);
    return createAlgorithmicFallback(q);
  }
}
