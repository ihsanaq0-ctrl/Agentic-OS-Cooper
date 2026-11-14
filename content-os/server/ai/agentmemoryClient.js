import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const AGENTMEMORY_BASE_URL = process.env.AGENTMEMORY_URL || "http://localhost:3111";

/**
 * Retrieves the local daemon secret for authenticating with agentmemory.
 */
function getAgentMemorySecret() {
  if (process.env.AGENTMEMORY_SECRET) {
    return process.env.AGENTMEMORY_SECRET.trim();
  }
  const secretPath = join(homedir(), ".agentmemory", "secret");
  try {
    if (existsSync(secretPath)) {
      return readFileSync(secretPath, "utf8").trim();
    }
  } catch {
    // Secret file unreadable or not created yet
  }
  return null;
}

/**
 * Checks whether the AgentMemory server is running and responsive.
 * @returns {Promise<boolean>}
 */
export async function isAgentMemoryAlive() {
  try {
    const res = await fetch(`${AGENTMEMORY_BASE_URL}/agentmemory/livez`, {
      method: "GET",
      signal: AbortSignal.timeout(1500)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Saves a memory into AgentMemory with concepts and project attribution.
 * @param {string} content - Memory text content
 * @param {object} options
 * @param {string} [options.type="fact"] - pattern | preference | architecture | bug | workflow | fact
 * @param {string[]} [options.concepts] - Extracted keywords/entities
 * @param {string} [options.project] - Project folder/repository name
 * @returns {Promise<object|null>}
 */
export async function saveToAgentMemory(content, options = {}) {
  try {
    const secret = getAgentMemorySecret();
    const headers = { "Content-Type": "application/json" };
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }

    const payload = {
      content: content.trim(),
      type: options.type || "fact",
      concepts: Array.isArray(options.concepts) ? options.concepts : [],
      project: options.project || "cooper"
    };

    const res = await fetch(`${AGENTMEMORY_BASE_URL}/agentmemory/remember`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // AgentMemory service may be offline — fail silently
  }
  return null;
}

/**
 * Searches memories via AgentMemory's smart search (BM25 + Graph + Vectors).
 * @param {string} query - Search query
 * @param {object} options
 * @param {number} [options.limit=5]
 * @param {string} [options.project]
 * @returns {Promise<Array<object>|null>}
 */
export async function searchAgentMemory(query, options = {}) {
  try {
    const secret = getAgentMemorySecret();
    const headers = { "Content-Type": "application/json" };
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }

    const payload = {
      query: query.trim(),
      limit: options.limit || 5,
      format: "full"
    };
    if (options.project) {
      payload.project = options.project;
    }

    const res = await fetch(`${AGENTMEMORY_BASE_URL}/agentmemory/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      const rawResults = Array.isArray(data.results) ? data.results : [];
      return rawResults.map((r) => {
        const obs = r.observation || {};
        const content = obs.narrative || (Array.isArray(obs.facts) && obs.facts[0]) || obs.title || "";
        return {
          text: content,
          type: obs.memoryType || obs.type || "fact",
          similarity: typeof r.score === "number" ? Math.round(r.score * 100) / 100 : 1.0,
          concepts: obs.concepts || [],
          project: obs.project || null,
          created_at: obs.timestamp || new Date().toISOString(),
          source: "agentmemory"
        };
      });
    }
  } catch (err) {
    // AgentMemory service may be offline — fall back to local database
  }
  return null;
}

/**
 * Retrieves the full health and status report from AgentMemory.
 * @returns {Promise<object|null>}
 */
export async function getAgentMemoryStatus() {
  try {
    const secret = getAgentMemorySecret();
    const headers = {};
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }
    const res = await fetch(`${AGENTMEMORY_BASE_URL}/agentmemory/status`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    return null;
  }
}
