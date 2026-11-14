// ── Bare Hands ↔ Cooper Bridge & Daemon Manager ─────────────────────
// Auto-spawns and manages the Bare Hands Python server (server.py),
// syncs Cooper's AI state to the ring, and proxies board commands so
// Cooper can project cards, plans, and notes onto the holographic glass stage.

import { join } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { spawn, execSync } from "child_process";
import { config, ROOT_DIR } from "./config.js";
import { broadcastGlobal } from "./sse.js";

const BH_ROOT = join(ROOT_DIR, "Github Repos", "barehands");
const BH_STATE_DIR = join(BH_ROOT, "state");
const BH_PORT = 8794;

// Ensure the state directory exists
if (!existsSync(BH_STATE_DIR)) {
  mkdirSync(BH_STATE_DIR, { recursive: true });
}

let cachedPythonCmd = null;
let bhChildProcess = null;

/**
 * Find a functioning Python 3 interpreter on Windows or Unix
 */
export function findPythonCommand() {
  if (cachedPythonCmd) return cachedPythonCmd;

  const candidates = ["py -3", "python", "python3"];
  for (const candidate of candidates) {
    try {
      execSync(`${candidate} -c "pass"`, { stdio: "ignore", timeout: 1500 });
      cachedPythonCmd = candidate;
      return candidate;
    } catch {
      // try next
    }
  }

  // Fallback default
  cachedPythonCmd = "python";
  return cachedPythonCmd;
}

/**
 * Check if the Bare Hands server is reachable on port 8794
 */
export async function isBarehandsRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${BH_PORT}/config`, {
      signal: AbortSignal.timeout(1200),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start Bare Hands Python daemon as a managed background child process
 */
export async function startBarehands() {
  if (await isBarehandsRunning()) {
    return { running: true, alreadyRunning: true, port: BH_PORT };
  }

  const py = findPythonCommand();
  const isPyLauncher = py.startsWith("py ");
  const executable = isPyLauncher ? "py" : py;
  const args = isPyLauncher ? ["-3", "server.py"] : ["server.py"];

  console.log(`[BareHands] Spawning daemon via '${py} server.py' in ${BH_ROOT}`);

  try {
    bhChildProcess = spawn(executable, args, {
      cwd: BH_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: false,
    });

    bhChildProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[BareHands:stdout] ${msg}`);
    });

    bhChildProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.warn(`[BareHands:stderr] ${msg}`);
    });

    bhChildProcess.on("exit", (code) => {
      console.log(`[BareHands] Process exited with code ${code}`);
      bhChildProcess = null;
      broadcastGlobal({ type: "barehands:status", running: false });
    });

    // Poll for up to 4.5 seconds until server answers /config
    const start = Date.now();
    while (Date.now() - start < 4500) {
      await new Promise((r) => setTimeout(r, 250));
      if (await isBarehandsRunning()) {
        console.log("[BareHands] Daemon active and listening on port", BH_PORT);
        broadcastGlobal({ type: "barehands:status", running: true, port: BH_PORT });
        return { running: true, started: true, pid: bhChildProcess?.pid, port: BH_PORT };
      }
    }

    return { running: false, error: "Timed out waiting for Bare Hands server on port " + BH_PORT };
  } catch (err) {
    console.error("[BareHands] Failed to spawn daemon:", err);
    return { running: false, error: err.message };
  }
}

/**
 * Stop the managed Bare Hands daemon
 */
export async function stopBarehands() {
  if (bhChildProcess) {
    try {
      bhChildProcess.kill();
    } catch {
      // ignore
    }
    bhChildProcess = null;
  }
  broadcastGlobal({ type: "barehands:status", running: false });
  return { success: true, running: false };
}

/**
 * Ensure Bare Hands is running before dispatching commands
 */
export async function ensureBarehandsRunning() {
  if (await isBarehandsRunning()) return true;
  const res = await startBarehands();
  return Boolean(res.running);
}

/**
 * Write Cooper's assistant state to the Bare Hands ring.
 * The Bare Hands server polls state/state at ~120ms intervals.
 * Valid values: idle | listening | thinking | speaking
 */
export function setRingState(state) {
  try {
    writeFileSync(join(BH_STATE_DIR, "state"), state, "utf8");
  } catch {
    // Non-critical — Bare Hands directory may be locked
  }
}

/**
 * Send a board command to Bare Hands (add_card, present, reset, etc.)
 */
export async function sendBoardCommand(cmd) {
  try {
    await ensureBarehandsRunning();
    const res = await fetch(`http://127.0.0.1:${BH_PORT}/cmd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get current board state (what cards are on the glass)
 */
export async function getBoardState() {
  try {
    const res = await fetch(`http://127.0.0.1:${BH_PORT}/state`, { cache: "no-store" });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

/**
 * Present content on the glass stage (spotlit center stage)
 */
export async function presentCard(title, body) {
  const ok = await sendBoardCommand({
    a: "present",
    title: title || "Cooper",
    body: body || "",
  });

  if (ok) {
    broadcastGlobal({
      type: "barehands:presented",
      title,
      body,
      url: `http://127.0.0.1:${BH_PORT}/stage.html`,
    });
  }
  return ok;
}

/**
 * Add a card to the glass stage
 */
export async function addCard(title, body, options = {}) {
  const ok = await sendBoardCommand({
    a: "add_card",
    title: title || "Cooper",
    body: body || "",
    ...options,
  });

  if (ok) {
    broadcastGlobal({
      type: "barehands:card-added",
      title,
      body,
    });
  }
  return ok;
}

/**
 * Clear / reset the glass board
 */
export async function resetBoard() {
  const ok = await sendBoardCommand({ a: "reset" });
  if (ok) {
    broadcastGlobal({ type: "barehands:cleared" });
  }
  return ok;
}

/**
 * Register Bare Hands bridge routes on the Express app
 */
export function registerBarehandsBridge(app) {
  // Status check
  app.get("/api/barehands/status", async (_req, res) => {
    const running = await isBarehandsRunning();
    res.json({
      running,
      port: BH_PORT,
      url: `http://127.0.0.1:${BH_PORT}/stage.html`,
      pid: bhChildProcess?.pid || null,
    });
  });

  // Start Bare Hands daemon
  app.post("/api/barehands/start", async (_req, res) => {
    const result = await startBarehands();
    res.json(result);
  });

  // Stop Bare Hands daemon
  app.post("/api/barehands/stop", async (_req, res) => {
    const result = await stopBarehands();
    res.json(result);
  });

  // Proxy board commands from Cooper → Bare Hands
  app.post("/api/barehands/cmd", async (req, res) => {
    const ok = await sendBoardCommand(req.body);
    res.json({ sent: ok });
  });

  // Get board state
  app.get("/api/barehands/board", async (_req, res) => {
    const state = await getBoardState();
    res.json({ state });
  });

  // Set ring state (called by Cooper's AI when it changes state)
  app.post("/api/barehands/ring", (req, res) => {
    const { state } = req.body || {};
    if (state) setRingState(state);
    res.json({ ok: true });
  });

  // Present content on the Bare Hands glass (high-level helper)
  app.post("/api/barehands/present", async (req, res) => {
    const { title, body } = req.body || {};
    const presented = await presentCard(title, body);
    res.json({ presented });
  });

  // Add a card to the Bare Hands board
  app.post("/api/barehands/card", async (req, res) => {
    const { title, body, x, y } = req.body || {};
    const added = await addCard(title, body, { x, y });
    res.json({ added });
  });

  // Reset the board
  app.post("/api/barehands/reset", async (_req, res) => {
    const reset = await resetBoard();
    res.json({ reset });
  });
}

// Set initial idle state
setRingState("idle");
