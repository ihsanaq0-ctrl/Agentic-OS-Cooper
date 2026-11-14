import { isOpenVikingAlive, getOpenVikingStatus } from "../ai/openvikingClient.js";

const DEFAULT_VIKING_URL = process.env.OPENVIKING_URL || "http://127.0.0.1:1933";

let vikingProcess = null;

/**
 * Ensures the OpenViking context database service is reachable.
 * @returns {Promise<object>}
 */
export async function ensureOpenVikingRunning() {
  const alive = await isOpenVikingAlive();
  if (alive) {
    return {
      running: true,
      url: DEFAULT_VIKING_URL,
      baseUri: "viking://",
      message: "OpenViking context daemon is running.",
    };
  }

  // If server is not currently reachable, report status gracefully
  return {
    running: false,
    url: DEFAULT_VIKING_URL,
    baseUri: "viking://",
    message: "OpenViking context server is not currently running. Cooper is utilizing Tier 1 AgentMemory and Tier 3 SQLite fallback.",
  };
}

/**
 * Retrieves connection and status info for OpenViking.
 * @returns {Promise<object>}
 */
export async function getOpenVikingInfo() {
  const status = await getOpenVikingStatus();
  return {
    alive: status.alive,
    url: status.url,
    baseUri: status.baseUri,
    version: status.version,
    healthy: status.healthy,
  };
}

