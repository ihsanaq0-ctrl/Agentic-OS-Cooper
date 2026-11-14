// Cooper's unified cognitive memory subsystem.
// Coordinates Tier 1 (AgentMemory :3111), Tier 2 (OpenViking :1933 / viking://),
// and Tier 3 (Local SQLite fallback with Ollama/keyword embeddings).

import { getMemoryCount } from "../db.js";
import { config } from "../config.js";
import {
  unifiedRemember,
  unifiedRecall,
  unifiedHybridSearch,
  readContext,
  exploreContextTree,
  getUnifiedMemoryStatus,
} from "./memoryRouter.js";

/**
 * Store a memory fragment across the unified cognitive memory hierarchy.
 * Backwards compatible with Cooper's existing signatures:
 *   remember(text, "chat", { concepts, project })
 *   remember(text, { type: "note", concepts: [...] })
 *
 * @param {string} text - Memory content
 * @param {string|object} [typeOrOpts="chat"] - Type or options object
 * @param {object} [metadata={}] - Optional extra context
 * @returns {Promise<object>}
 */
export async function remember(text, typeOrOpts = "chat", metadata = {}) {
  return unifiedRemember(text, typeOrOpts, metadata);
}

/**
 * Recall memories and deep context relevant to a query.
 * Routes to OpenViking for repo/docs queries, AgentMemory for fast-path conversational
 * facts, and SQLite for offline fallback.
 *
 * @param {string} query - What to search for
 * @param {object} [opts={}] - { type, limit, project, hybrid, targetUri, viking }
 * @returns {Promise<Array<{text, type, similarity, created_at, source, uri?, level?}>>}
 */
export async function recall(query, opts = {}) {
  return unifiedRecall(query, opts);
}

/**
 * Get memory stats for Cooper's system prompt context.
 */
export function memoryStats() {
  return {
    total: getMemoryCount(),
    hasEmbeddings: Boolean(config.ollamaBaseUrl),
  };
}

// Re-export router functions for direct programmatic access
export {
  unifiedRemember,
  unifiedRecall,
  unifiedHybridSearch,
  readContext,
  exploreContextTree,
  getUnifiedMemoryStatus,
};
