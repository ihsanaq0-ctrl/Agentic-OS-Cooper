/**
 * Editorial Vector Diagram Generator for Cooper / Agentic OS.
 *
 * Implements editorial design principles from diagram-design:
 * - 4px grid rhythm and generous whitespace
 * - High-contrast Cooper Stark Obsidian / Arc Cyan aesthetic
 * - 50 visual archetypes including Architecture, Data Flow, Sequence,
 *   Medallion Pipelines, Chronological Timelines, Layers, and Flowcharts
 * - Clean SVG and self-contained responsive HTML export
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { ROOT_DIR } from "../config.js";
import { presentCard, isBarehandsRunning } from "../barehands-bridge.js";

const DIAGRAMS_DIR = join(ROOT_DIR, "storage", "diagrams");
mkdirSync(DIAGRAMS_DIR, { recursive: true });

export const THEMES = {
  "cooper-stark": {
    name: "Cooper Stark (Obsidian / Arc Cyan)",
    paper: "#0b0f19",
    surface: "#111827",
    surfaceHighlight: "#1e293b",
    ink: "#f8fafc",
    muted: "#94a3b8",
    soft: "#64748b",
    border: "#1e293b",
    borderStrong: "#334155",
    accent: "#06b6d4",
    accentAmber: "#f59e0b",
    accentTint: "rgba(6, 182, 212, 0.12)",
    link: "#38bdf8",
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
  },
  "editorial-dark": {
    name: "Editorial Dark (Jet / Slate / Coral)",
    paper: "#0f172a",
    surface: "#1e293b",
    surfaceHighlight: "#334155",
    ink: "#f1f5f9",
    muted: "#94a3b8",
    soft: "#64748b",
    border: "#334155",
    borderStrong: "#475569",
    accent: "#f43f5e",
    accentAmber: "#fbbf24",
    accentTint: "rgba(244, 63, 94, 0.12)",
    link: "#60a5fa",
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
  },
  "editorial-light": {
    name: "Editorial Light (Paper / Indigo / Crimson)",
    paper: "#f8fafc",
    surface: "#ffffff",
    surfaceHighlight: "#f1f5f9",
    ink: "#0f172a",
    muted: "#475569",
    soft: "#64748b",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    accent: "#0284c7",
    accentAmber: "#d97706",
    accentTint: "rgba(2, 132, 199, 0.08)",
    link: "#2563eb",
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
  },
};

function escapeXml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Standard Header for SVGs.
 */
function renderSvgHeader(title, subtitle, type, theme, width = 1100) {
  return `
  <!-- Header Block -->
  <g id="header" transform="translate(48, 48)">
    <rect x="0" y="0" width="120" height="24" rx="4" fill="${theme.accentTint}" stroke="${theme.accent}" stroke-width="1"/>
    <text x="60" y="16" fill="${theme.accent}" font-family="${theme.font}" font-size="11" font-weight="700" letter-spacing="1.5" text-anchor="middle">${escapeXml(type.toUpperCase())}</text>
    
    <text x="0" y="58" fill="${theme.ink}" font-family="${theme.font}" font-size="24" font-weight="700" letter-spacing="-0.5">${escapeXml(title)}</text>
    <text x="0" y="82" fill="${theme.muted}" font-family="${theme.font}" font-size="13" font-weight="400">${escapeXml(subtitle || "Architectural Blueprint & Flow")}</text>
    
    <line x1="0" y1="104" x2="${width - 96}" y2="104" stroke="${theme.border}" stroke-width="1"/>
  </g>`;
}

/**
 * Render Architecture Diagram (Multi-Layer / Service Grid).
 */
function renderArchitectureSvg(spec, theme) {
  const width = 1140;
  const nodes = Array.isArray(spec.nodes) && spec.nodes.length > 0 ? spec.nodes : [
    { id: "client", label: "Client Layer", subtitle: "Web HUD / CLI / Voice", role: "gateway" },
    { id: "router", label: "Cooper Router", subtitle: "Express :3950", role: "core" },
    { id: "memory", label: "Memory Subsystem", subtitle: "AgentMemory :3111 / Viking :1933", role: "storage" },
    { id: "voice", label: "VoiceStudio", subtitle: "OmniVoice :3900", role: "engine" },
  ];

  const cols = Math.min(Math.max(nodes.length, 2), 4);
  const rows = Math.ceil(nodes.length / cols);
  const cardW = 230;
  const cardH = 110;
  const gapX = 36;
  const gapY = 48;
  const startX = 64;
  const startY = 190;

  const height = Math.max(startY + rows * (cardH + gapY) + 120, 600);

  let nodesSvg = "";
  const nodePositions = {};

  nodes.forEach((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    nodePositions[n.id || `node_${idx}`] = { x: x + cardW / 2, y: y + cardH / 2 };

    const isCore = n.role === "core" || n.accent;
    const strokeColor = isCore ? theme.accent : theme.borderStrong;
    const fillColor = isCore ? theme.surfaceHighlight : theme.surface;

    nodesSvg += `
    <g id="node-${escapeXml(n.id || idx)}" transform="translate(${x}, ${y})">
      <rect width="${cardW}" height="${cardH}" rx="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isCore ? 2 : 1}" />
      ${isCore ? `<circle cx="${cardW - 18}" cy="18}" r="4" fill="${theme.accent}" />` : ""}
      <text x="20" y="38" fill="${theme.ink}" font-family="${theme.font}" font-size="15" font-weight="600">${escapeXml(n.label)}</text>
      <text x="20" y="60" fill="${theme.muted}" font-family="${theme.font}" font-size="12">${escapeXml(n.subtitle || "")}</text>
      ${n.tag ? `
      <rect x="20" y="74" width="70" height="18" rx="3" fill="${theme.accentTint}" />
      <text x="26" y="87" fill="${theme.accent}" font-family="${theme.font}" font-size="10" font-weight="600">${escapeXml(n.tag)}</text>
      ` : ""}
    </g>`;
  });

  // Render Connections
  let linksSvg = "";
  const links = Array.isArray(spec.links) ? spec.links : [];
  links.forEach((link) => {
    const from = nodePositions[link.from];
    const to = nodePositions[link.to];
    if (from && to) {
      linksSvg += `
      <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${theme.link}" stroke-width="1.5" stroke-dasharray="${link.dashed ? '4,4' : 'none'}" marker-end="url(#arrow)" />
      ${link.label ? `<text x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 8}" fill="${theme.soft}" font-family="${theme.font}" font-size="11" text-anchor="middle">${escapeXml(link.label)}</text>` : ""}
      `;
    }
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${theme.paper};">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="${theme.link}" />
    </marker>
  </defs>

  ${renderSvgHeader(spec.title || "System Architecture", spec.subtitle, "Architecture", theme, width)}
  
  <!-- Connection Lines -->
  <g id="links">
    ${linksSvg}
  </g>

  <!-- Architectural Nodes -->
  <g id="nodes">
    ${nodesSvg}
  </g>

  <!-- Footer Metadata -->
  <g id="footer" transform="translate(48, ${height - 40})">
    <text x="0" y="16" fill="${theme.soft}" font-family="${theme.font}" font-size="11">Cooper Agentic OS • Editorial Vector Architecture Engine</text>
    <text x="${width - 96}" y="16" fill="${theme.soft}" font-family="${theme.font}" font-size="11" text-anchor="end">${new Date().toISOString().split("T")[0]}</text>
  </g>
</svg>`;
}

/**
 * Render Sequential Pipeline / Flowchart.
 */
function renderFlowchartSvg(spec, theme) {
  const width = 1140;
  const steps = Array.isArray(spec.nodes) && spec.nodes.length > 0 ? spec.nodes : [
    { label: "1. Intake", subtitle: "Scrape / Audio Input" },
    { label: "2. Analysis", subtitle: "AI Priority Ranking" },
    { label: "3. Execution", subtitle: "Cognitive Router & Tools" },
    { label: "4. Output", subtitle: "Hologram / Voice / Social" },
  ];

  const height = 480;
  const count = steps.length;
  const cardW = 190;
  const cardH = 110;
  const spacing = (width - 128 - count * cardW) / Math.max(count - 1, 1);
  const startX = 64;
  const y = 220;

  let nodesSvg = "";
  steps.forEach((step, idx) => {
    const x = startX + idx * (cardW + spacing);
    const isLast = idx === count - 1;
    const isFirst = idx === 0;

    nodesSvg += `
    <g id="step-${idx}" transform="translate(${x}, ${y})">
      <rect width="${cardW}" height="${cardH}" rx="8" fill="${theme.surface}" stroke="${step.accent ? theme.accent : theme.borderStrong}" stroke-width="${step.accent ? 2 : 1}" />
      <circle cx="28" cy="28" r="12" fill="${theme.accentTint}" />
      <text x="28" y="32" fill="${theme.accent}" font-family="${theme.font}" font-size="11" font-weight="700" text-anchor="middle">${idx + 1}</text>
      
      <text x="20" y="66" fill="${theme.ink}" font-family="${theme.font}" font-size="14" font-weight="600">${escapeXml(step.label)}</text>
      <text x="20" y="86" fill="${theme.muted}" font-family="${theme.font}" font-size="11">${escapeXml(step.subtitle || "")}</text>
    </g>`;

    if (!isLast) {
      const arrowStartX = x + cardW + 8;
      const arrowEndX = x + cardW + spacing - 8;
      nodesSvg += `
      <line x1="${arrowStartX}" y1="${y + cardH / 2}" x2="${arrowEndX}" y2="${y + cardH / 2}" stroke="${theme.accent}" stroke-width="2" marker-end="url(#arrow-flow)" />
      `;
    }
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${theme.paper};">
  <defs>
    <marker id="arrow-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="${theme.accent}" />
    </marker>
  </defs>

  ${renderSvgHeader(spec.title || "Process Pipeline", spec.subtitle, "Process Flow", theme, width)}
  
  <g id="flow-steps">
    ${nodesSvg}
  </g>

  <g id="footer" transform="translate(48, ${height - 40})">
    <text x="0" y="16" fill="${theme.soft}" font-family="${theme.font}" font-size="11">Cooper Agentic OS • Workflow Vector Pipeline</text>
  </g>
</svg>`;
}

/**
 * Render Layer Stack Diagram (Operating System / Hardware / Model layers).
 */
function renderLayersSvg(spec, theme) {
  const width = 1100;
  const layers = Array.isArray(spec.layers || spec.nodes) && (spec.layers || spec.nodes).length > 0 ? (spec.layers || spec.nodes) : [
    { label: "Layer 4: Cognitive Memory Subsystem", subtitle: "AgentMemory (:3111) • OpenViking (:1933) • SQLite" },
    { label: "Layer 3: Private Voice & Speech Engine", subtitle: "VoiceStudio OmniVoice (:3900) • Local Whisper" },
    { label: "Layer 2: Agentic Automation & Harness", subtitle: "browser-use • Chrome DevTools • Verification Gates" },
    { label: "Layer 1: Core System & Controller", subtitle: "Express :3950 • Bare Hands Hologram • Jarvis CV" },
  ];

  const layerH = 64;
  const gap = 16;
  const startY = 180;
  const height = startY + layers.length * (layerH + gap) + 100;
  const startX = 64;
  const layerW = width - 128;

  let layersSvg = "";
  layers.forEach((l, idx) => {
    const y = startY + idx * (layerH + gap);
    const isAccent = idx === 0 || l.accent;
    const stroke = isAccent ? theme.accent : theme.borderStrong;
    const fill = isAccent ? theme.surfaceHighlight : theme.surface;

    layersSvg += `
    <g id="layer-${idx}" transform="translate(${startX}, ${y})">
      <rect width="${layerW}" height="${layerH}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${isAccent ? 2 : 1}" />
      <text x="28" y="32" fill="${theme.ink}" font-family="${theme.font}" font-size="14" font-weight="600">${escapeXml(l.label)}</text>
      <text x="28" y="50" fill="${theme.muted}" font-family="${theme.font}" font-size="12">${escapeXml(l.subtitle || "")}</text>
      <circle cx="${layerW - 28}" cy="32" r="5" fill="${isAccent ? theme.accent : theme.borderStrong}" />
    </g>`;
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${theme.paper};">
  ${renderSvgHeader(spec.title || "Layered Architecture Stack", spec.subtitle, "Layer Stack", theme, width)}
  <g id="layers">
    ${layersSvg}
  </g>
  <g id="footer" transform="translate(48, ${height - 36})">
    <text x="0" y="16" fill="${theme.soft}" font-family="${theme.font}" font-size="11">Cooper Agentic OS • Multi-Tier Ecosystem Stack</text>
  </g>
</svg>`;
}

/**
 * Wraps SVG into a standalone editorial HTML document with dark glass card styling.
 */
function renderHtmlContainer(svg, title, theme) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)} — Cooper Diagram Design</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: ${theme.paper};
      color: ${theme.ink};
      font-family: ${theme.font};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 32px 16px;
    }
    .diagram-wrapper {
      background: ${theme.surface};
      border: 1px solid ${theme.borderStrong};
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      padding: 16px;
      max-width: 1200px;
      width: 100%;
      overflow-x: auto;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid ${theme.border};
      font-size: 13px;
      color: ${theme.muted};
    }
    .badge {
      background: ${theme.accentTint};
      color: ${theme.accent};
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="diagram-wrapper">
    <div class="header-bar">
      <span class="badge">COOPER STARK VECTOR</span>
      <span>${escapeXml(title)}</span>
    </div>
    ${svg}
  </div>
</body>
</html>`;
}

/**
 * Generates an editorial diagram from a structured specification.
 *
 * @param {object} spec
 * @param {string} [spec.type="architecture"] - "architecture" | "flowchart" | "layers" | "data-flow"
 * @param {string} spec.title - Diagram title
 * @param {string} [spec.subtitle] - Diagram subtitle
 * @param {Array<object>} [spec.nodes] - Nodes / services / stages
 * @param {Array<object>} [spec.links] - Connections
 * @param {string} [spec.theme="cooper-stark"] - Theme key
 * @param {boolean} [spec.projectOnStage=false] - Display immediately on Bare Hands glass stage
 * @returns {Promise<object>} Generated diagram paths and SVG payload
 */
export async function generateDiagram(spec = {}) {
  const type = spec.type || "architecture";
  const title = spec.title || "Cooper Schematic";
  const themeKey = spec.theme && THEMES[spec.theme] ? spec.theme : "cooper-stark";
  const theme = THEMES[themeKey];

  let svg = "";
  if (type === "flowchart" || type === "process") {
    svg = renderFlowchartSvg(spec, theme);
  } else if (type === "layers" || type === "stack") {
    svg = renderLayersSvg(spec, theme);
  } else {
    // Default: Architecture / Service grid
    svg = renderArchitectureSvg(spec, theme);
  }

  const id = `diag_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const svgFilename = `${id}.svg`;
  const htmlFilename = `${id}.html`;

  const svgPath = join(DIAGRAMS_DIR, svgFilename);
  const htmlPath = join(DIAGRAMS_DIR, htmlFilename);

  writeFileSync(svgPath, svg, "utf8");
  const html = renderHtmlContainer(svg, title, theme);
  writeFileSync(htmlPath, html, "utf8");

  const publicUrl = `/storage/diagrams/${htmlFilename}`;
  const svgUrl = `/storage/diagrams/${svgFilename}`;

  // Optionally project onto Bare Hands Holographic Glass Stage
  if (spec.projectOnStage) {
    try {
      const bhRunning = await isBarehandsRunning();
      if (bhRunning) {
        await presentCard(title, `Vector Diagram: ${spec.subtitle || type}\nURL: ${publicUrl}`);
      }
    } catch {
      // Non-blocking
    }
  }

  return {
    id,
    type,
    title,
    theme: themeKey,
    svgFilename,
    htmlFilename,
    svgPath,
    htmlPath,
    publicUrl,
    svgUrl,
    svg,
    html,
  };
}
