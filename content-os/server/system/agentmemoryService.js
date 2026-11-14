import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { isAgentMemoryAlive, getAgentMemoryStatus } from "../ai/agentmemoryClient.js";

const III_BIN = join(homedir(), ".agentmemory", "bin", process.platform === "win32" ? "iii.exe" : "iii");
const COMPOSE_YAML = join(
  process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
  "agentmemory",
  "compose",
  "worker-compose.yaml"
);

const CLI_PATH = join(
  process.env.LOCALAPPDATA || "",
  "npm-cache",
  "_npx",
  "2dd97692f449bcf0",
  "node_modules",
  "@agentmemory",
  "agentmemory",
  "dist",
  "cli.mjs"
);

let daemonProcess = null;

/**
 * Ensures the AgentMemory server is running, auto-starting it if needed.
 * @returns {Promise<object>}
 */
export async function ensureAgentMemoryRunning() {
  const alive = await isAgentMemoryAlive();
  if (alive) {
    return {
      running: true,
      restUrl: "http://localhost:3111",
      viewerUrl: "http://localhost:3113",
      message: "AgentMemory daemon is already running."
    };
  }

  console.log(`[AgentMemoryService] Starting AgentMemory background daemon...`);
  try {
    if (existsSync(III_BIN) && existsSync(COMPOSE_YAML)) {
      daemonProcess = spawn(
        III_BIN,
        ["compose", "--namespace", "agentmemory-3111", "--up", "--file", COMPOSE_YAML],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
          env: { ...process.env, CI: "1" }
        }
      );
    } else if (existsSync(CLI_PATH)) {
      daemonProcess = spawn(process.execPath, [CLI_PATH], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: { ...process.env, CI: "1" }
      });
    } else {
      return {
        running: false,
        error: "AgentMemory runtime binary or CLI not found."
      };
    }

    daemonProcess.unref();

    // Give it a brief moment to spin up
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isAgentMemoryAlive()) break;
    }

    const checkAlive = await isAgentMemoryAlive();
    return {
      running: checkAlive,
      restUrl: "http://localhost:3111",
      viewerUrl: "http://localhost:3113",
      message: checkAlive
        ? "AgentMemory daemon started successfully."
        : "AgentMemory daemon starting up in background."
    };
  } catch (err) {
    return {
      running: false,
      error: `Failed to spawn AgentMemory: ${err.message}`
    };
  }
}

/**
 * Returns connection and status info for Cooper.
 */
export async function getAgentMemoryInfo() {
  const alive = await isAgentMemoryAlive();
  const status = alive ? await getAgentMemoryStatus() : null;
  return {
    alive,
    restUrl: "http://localhost:3111",
    viewerUrl: "http://localhost:3113",
    status
  };
}
