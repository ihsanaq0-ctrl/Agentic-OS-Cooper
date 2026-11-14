// ── JarvisFlow ↔ Cooper Bridge & Brainstorm Session Manager ──────────
// Bridges Cooper's AI brain with the gesture-controlled mind-mapping stage,
// managing topic expansion trees and real-time SSE broadcasts.

import { expandTopic } from "./ai/brainstorm.js";
import { broadcastGlobal } from "./sse.js";

let currentSession = null;
let activeNode = "root";

/**
 * Generate a new brainstorm topic session
 */
export async function generateBrainstormSession(topic = "") {
  const tree = await expandTopic(topic);
  currentSession = tree;
  activeNode = tree.root?.id || "root";

  broadcastGlobal({
    type: "brainstorm:ready",
    topic: tree.title || tree.topic,
    session: tree,
  });

  return tree;
}

/**
 * Get the currently active brainstorm session
 */
export async function getCurrentBrainstormSession() {
  if (!currentSession) {
    currentSession = await expandTopic("");
  }
  return currentSession;
}

/**
 * Signal the HUD to open the JarvisFlow gesture brainstorm canvas
 */
export async function openBrainstormCanvas(topic = "") {
  let session = currentSession;
  if (topic || !session) {
    session = await generateBrainstormSession(topic);
  }

  broadcastGlobal({
    type: "brainstorm:open",
    topic: session.title || session.topic,
    session,
  });

  return { success: true, session };
}

/**
 * Select a specific node in the active tree
 */
export function selectBrainstormNode(nodeId) {
  activeNode = nodeId;
  broadcastGlobal({
    type: "brainstorm:node-selected",
    nodeId,
  });
  return { success: true, nodeId };
}

/**
 * Register JarvisFlow bridge routes on the Express app
 */
export function registerJarvisFlowBridge(app) {
  // Generate or expand brainstorm topic
  app.post("/api/brainstorm", async (req, res) => {
    try {
      const { topic } = req.body || {};
      const tree = await generateBrainstormSession(topic);
      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get current brainstorm session
  app.get("/api/brainstorm/current", async (_req, res) => {
    const session = await getCurrentBrainstormSession();
    res.json({ session, activeNode });
  });

  // Open JarvisFlow canvas on HUD
  app.post("/api/brainstorm/open", async (req, res) => {
    const { topic } = req.body || {};
    const result = await openBrainstormCanvas(topic);
    res.json(result);
  });

  // Select node
  app.post("/api/brainstorm/select", (req, res) => {
    const { nodeId } = req.body || {};
    const result = selectBrainstormNode(nodeId);
    res.json(result);
  });
}
