/**
 * Unified Cognitive Memory Router for Cooper / Agentic OS.
 *
 * Coordinates Cooper's three cognitive memory tiers:
 *   Tier 1 (Fast-Path Working Memory): AgentMemory (:3111) — sub-50ms conversational facts,
 *          user preferences, and BM25 + Knowledge Graph associations.
 *   Tier 2 (Deep Context Filesystem): OpenViking (:1933, viking://) — hierarchical repo
 *          indexing, documentation trees, and L0/L1/L2 progressive context retrieval.
 *   Tier 3 (Resilient Offline Storage): Local SQLite (content-os.sqlite) — 100% offline
 *          durable persistence with vector embeddings & keyword fallback.
 */

import { insertMemory, searchMemory, listMemories, getMemoryCount } from "../db.js";
import { config } from "../config.js";
import {
  saveToAgentMemory,
  searchAgentMemory,
  isAgentMemoryAlive,
  getAgentMemoryStatus,
} from "./agentmemoryClient.js";
import {
  findOpenViking,
  searchOpenViking,
  readOpenVikingUri,
  listOpenVikingUri,
  getOpenVikingTree,
  addOpenVikingResource,
  isOpenVikingAlive,
  getOpenVikingStatus,
  normalizeUri,
} from "./openvikingClient.js";

/**
 * Compute embeddings via Ollama (local, free) if configured.
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function computeEmbedding(text) {
  if (config.ollamaBaseUrl) {
    try {
      const baseUrl = config.ollamaBaseUrl.replace(/\/v1\/?$/, "");
      const res = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nomic-embed-text",
          prompt: text.slice(0, 2000),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.embedding && Array.isArray(data.embedding)) {
          return data.embedding;
        }
      }
    } catch {
      // Ollama not available
    }
  }
  return null;
}

/**
 * Compute cosine similarity between two float arrays.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Detects whether a query is directed towards deep repository or file context.
 * @param {string} query
 * @param {object} [opts={}]
 * @returns {boolean}
 */
function isDeepContextQuery(query, opts = {}) {
  if (opts.viking || opts.targetUri || opts.deep) return true;
  if (typeof query !== "string") return false;
  const q = query.toLowerCase();
  if (q.startsWith("viking://")) return true;
  const deepKeywords = [
    "codebase", "repository", "repo", "architecture",
    "openviking", "skill tree", "file structure", "documentation",
    "ast", "directory structure"
  ];
  return deepKeywords.some((kw) => q.includes(kw));
}

/**
 * Stores a memory fragment across the unified memory hierarchy:
 * 1. Always commits to local SQLite (Tier 3) for durability.
 * 2. Mirrors to AgentMemory (Tier 1) for fast BM25 + Knowledge Graph indexing.
 * 3. Optionally mirrors to OpenViking (Tier 2) if resource or URI is provided.
 *
 * @param {string} text - Memory content
 * @param {string|object} [typeOrOpts="chat"] - Memory type or options object
 * @param {object} [metadata={}] - Extra metadata (concepts, project, uri, etc.)
 * @returns {Promise<object>}
 */
export async function unifiedRemember(text, typeOrOpts = "chat", metadata = {}) {
  if (!text || text.trim().length < 5) return null;

  let type = "chat";
  let meta = metadata || {};

  if (typeof typeOrOpts === "object" && typeOrOpts !== null) {
    type = typeOrOpts.type || "chat";
    meta = { ...typeOrOpts, ...(metadata || {}) };
  } else if (typeof typeOrOpts === "string") {
    type = typeOrOpts;
  }

  // Tier 3: Resilient SQLite local persistence
  const embedding = await computeEmbedding(text);
  const localRecord = insertMemory({
    text: text.trim(),
    embedding,
    type,
    metadata: meta,
  });

  // Tier 1: AgentMemory Mirroring
  try {
    const concepts = Array.isArray(meta.concepts)
      ? meta.concepts
      : (meta.topic ? [meta.topic] : []);
    const project = meta.project || "cooper";

    const amRecord = await saveToAgentMemory(text, {
      type: type === "chat" ? "fact" : (type === "note" ? "fact" : type),
      concepts,
      project,
    }).catch(() => null);

    if (amRecord?.memory?.id) {
      localRecord.agentmemory_stored = true;
      localRecord.agentmemory_id = amRecord.memory.id;
    }
  } catch {
    // Non-blocking fail-safe
  }

  // Tier 2: OpenViking Ingestion (if uri or resource specified)
  if (meta.uri || meta.resource || meta.toViking) {
    try {
      const targetUri = meta.uri ? normalizeUri(meta.uri) : undefined;
      const ovRes = await addOpenVikingResource(meta.resource || text, {
        to: targetUri,
        instruction: meta.instruction,
        tags: meta.concepts,
      }).catch(() => null);

      if (ovRes) {
        localRecord.openviking_synced = true;
      }
    } catch {
      // Non-blocking fail-safe
    }
  }

  return localRecord;
}

/**
 * Recalls memories and context matching a query across the multi-tier cognitive architecture.
 *
 * @param {string} query - The query to recall
 * @param {object} [options={}]
 * @param {string} [options.type] - Memory type filter
 * @param {number} [options.limit=5] - Maximum number of results
 * @param {string} [options.project] - Project filter
 * @param {string} [options.targetUri] - OpenViking scoped URI
 * @param {boolean} [options.hybrid=false] - Concurrently blend AgentMemory and OpenViking
 * @param {boolean} [options.viking=false] - Force OpenViking context lookup
 * @returns {Promise<Array<object>>}
 */
export async function unifiedRecall(query, options = {}) {
  if (!query || query.trim().length < 3) return [];

  const limit = options.limit || 5;
  const isDeep = isDeepContextQuery(query, options);

  // If Hybrid Mode requested, run both engines concurrently
  if (options.hybrid) {
    return unifiedHybridSearch(query, options);
  }

  // Strategy A: Deep Context / Repo / Architecture -> OpenViking
  if (isDeep) {
    const vikingAlive = await isOpenVikingAlive();
    if (vikingAlive) {
      const ovResults = await findOpenViking(query, {
        limit,
        targetUri: options.targetUri,
        level: options.level || [0, 1],
      });
      if (ovResults && ovResults.length > 0) {
        return ovResults.map((r) => ({
          text: r.text,
          type: "deep_context",
          similarity: r.score,
          uri: r.uri,
          level: r.level,
          title: r.title,
          source: "openviking",
          created_at: new Date().toISOString(),
        }));
      }
    }
  }

  // Strategy B: AgentMemory Fast-Path Working Memory (BM25 + Graph + Vectors)
  try {
    const amResults = await searchAgentMemory(query, {
      limit,
      project: options.project,
    });
    if (amResults && amResults.length > 0) {
      return amResults;
    }
  } catch {
    // AgentMemory daemon offline or unreachable
  }

  // Strategy C: Local SQLite with Ollama Embeddings
  const queryEmbedding = await computeEmbedding(query);
  if (queryEmbedding) {
    const allMemories = listMemories({ type: options.type, limit: 200 });
    const withEmbeddings = allMemories.filter((m) => m.embedding);

    if (withEmbeddings.length > 0) {
      const scored = withEmbeddings.map((m) => {
        const memEmb = JSON.parse(m.embedding);
        return {
          ...m,
          similarity: cosineSimilarity(queryEmbedding, memEmb),
        };
      });
      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, limit).map((m) => ({
        text: m.text,
        type: m.type,
        similarity: Math.round(m.similarity * 100) / 100,
        created_at: m.created_at,
        source: "sqlite-vector",
      }));
    }
  }

  // Strategy D: Local SQLite Keyword/BM25 Fallback
  const localResults = searchMemory({
    query,
    type: options.type,
    limit,
  });

  return localResults.map((m) => ({
    text: m.text,
    type: m.type,
    similarity: null,
    created_at: m.created_at,
    source: "sqlite-keyword",
  }));
}

/**
 * Concurrently queries AgentMemory and OpenViking, deduplicating and ranking the blended results.
 * @param {string} query
 * @param {object} [options={}]
 * @returns {Promise<Array<object>>}
 */
export async function unifiedHybridSearch(query, options = {}) {
  const limit = options.limit || 5;

  const [amPromise, ovPromise] = await Promise.allSettled([
    searchAgentMemory(query, { limit, project: options.project }).catch(() => []),
    findOpenViking(query, { limit, targetUri: options.targetUri }).catch(() => []),
  ]);

  const amResults = amPromise.status === "fulfilled" && Array.isArray(amPromise.value)
    ? amPromise.value
    : [];

  const ovResults = ovPromise.status === "fulfilled" && Array.isArray(ovPromise.value)
    ? ovPromise.value.map((r) => ({
        text: r.text,
        type: "deep_context",
        similarity: r.score,
        uri: r.uri,
        level: r.level,
        title: r.title,
        source: "openviking",
        created_at: new Date().toISOString(),
      }))
    : [];

  // Combine and deduplicate by text excerpt
  const seenTexts = new Set();
  const blended = [];

  for (const item of [...amResults, ...ovResults]) {
    const key = (item.text || "").trim().slice(0, 60).toLowerCase();
    if (key && !seenTexts.has(key)) {
      seenTexts.add(key);
      blended.push(item);
    }
  }

  // If both engines returned empty, fallback to SQLite
  if (blended.length === 0) {
    return unifiedRecall(query, { ...options, hybrid: false });
  }

  // Sort by similarity score descending
  blended.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  return blended.slice(0, limit);
}

/**
 * Reads progressive context tiers from OpenViking (L0 abstract, L1 overview, L2 full).
 * @param {string} uri - viking:// URI
 * @param {"l0"|"l1"|"l2"|"full"} [tier="l0"]
 * @returns {Promise<string|null>}
 */
export async function readContext(uri, tier = "l0") {
  return readOpenVikingUri(uri, tier);
}

/**
 * Explores the hierarchical directory tree under a viking:// URI.
 * @param {string} [uri="viking://"]
 * @param {number} [depth=3]
 * @returns {Promise<object|null>}
 */
export async function exploreContextTree(uri = "viking://", depth = 3) {
  return getOpenVikingTree(uri, { depth });
}

/**
 * Returns comprehensive status across all three cognitive memory tiers.
 * @returns {Promise<object>}
 */
export async function getUnifiedMemoryStatus() {
  const [amAlive, ovStatus, amStatus] = await Promise.all([
    isAgentMemoryAlive().catch(() => false),
    getOpenVikingStatus().catch(() => ({ alive: false, url: "http://127.0.0.1:1933" })),
    getAgentMemoryStatus().catch(() => null),
  ]);

  const sqliteCount = getMemoryCount();
  const hasEmbeddings = Boolean(config.ollamaBaseUrl);

  let mode = "sqlite-fallback";
  if (amAlive && ovStatus.alive) {
    mode = "dual-engine";
  } else if (amAlive) {
    mode = "agentmemory-primary";
  } else if (ovStatus.alive) {
    mode = "openviking-primary";
  }

  return {
    mode,
    timestamp: new Date().toISOString(),
    tiers: {
      tier1_agentmemory: {
        name: "AgentMemory",
        alive: amAlive,
        restUrl: "http://localhost:3111",
        viewerUrl: "http://localhost:3113",
        role: "Fast-Path Working Memory (BM25 + Knowledge Graph)",
        status: amStatus,
      },
      tier2_openviking: {
        name: "OpenViking",
        alive: ovStatus.alive,
        url: ovStatus.url,
        baseUri: "viking://",
        role: "Deep Context Filesystem (L0/L1/L2 Progressive Disclosure)",
        version: ovStatus.version,
        healthy: ovStatus.healthy,
      },
      tier3_sqlite: {
        name: "SQLite Local",
        alive: true,
        role: "Durable Offline Persistence",
        total: sqliteCount,
        hasEmbeddings,
      },
    },
  };
}

