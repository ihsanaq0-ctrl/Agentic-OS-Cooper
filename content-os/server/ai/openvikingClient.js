/**
 * OpenViking Context Database Client for Cooper / Agentic OS.
 * Connects to OpenViking HTTP server (default: http://127.0.0.1:1933)
 * providing hierarchical context indexing, L0/L1/L2 progressive retrieval,
 * and virtual filesystem (viking://) management.
 */

const OPENVIKING_BASE_URL = (
  process.env.OPENVIKING_URL ||
  process.env.OPVIKING_URL ||
  "http://127.0.0.1:1933"
).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Normalizes a path or URI to the canonical viking:// URI format.
 * @param {string} uri
 * @returns {string}
 */
export function normalizeUri(uri) {
  if (!uri || typeof uri !== "string") return "viking://";
  const trimmed = uri.trim();
  if (trimmed.startsWith("viking://")) return trimmed;
  return `viking://${trimmed.replace(/^\/+/, "")}`;
}

/**
 * Builds HTTP headers including authentication for OpenViking.
 * @param {object} [extraHeaders={}]
 * @returns {Record<string, string>}
 */
function getHeaders(extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (process.env.OPENVIKING_API_KEY) {
    headers["X-API-Key"] = process.env.OPENVIKING_API_KEY.trim();
  }
  if (process.env.OPENVIKING_ACCOUNT) {
    headers["X-OpenViking-Account"] = process.env.OPENVIKING_ACCOUNT.trim();
  }
  if (process.env.OPENVIKING_USER) {
    headers["X-OpenViking-User"] = process.env.OPENVIKING_USER.trim();
  }

  return headers;
}

/**
 * Checks whether the OpenViking server is running and healthy.
 * @returns {Promise<boolean>}
 */
export async function isOpenVikingAlive() {
  try {
    const res = await fetch(`${OPENVIKING_BASE_URL}/api/v1/health`, {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data?.status === "ok" || data?.healthy === true;
    }
    // Fallback: try root or /health
    const fallback = await fetch(`${OPENVIKING_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(1000),
    });
    return fallback.ok;
  } catch {
    return false;
  }
}

/**
 * Retrieves the OpenViking server health and version status.
 * @returns {Promise<object>}
 */
export async function getOpenVikingStatus() {
  try {
    const res = await fetch(`${OPENVIKING_BASE_URL}/api/v1/health`, {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        alive: true,
        url: OPENVIKING_BASE_URL,
        baseUri: "viking://",
        version: data.version || "0.1.0",
        authMode: data.auth_mode || "api_key",
        healthy: data.healthy ?? true,
      };
    }
  } catch {
    // OpenViking server is offline
  }

  return {
    alive: false,
    url: OPENVIKING_BASE_URL,
    baseUri: "viking://",
    version: null,
    healthy: false,
  };
}

/**
 * Semantic find without active session context.
 * Useful for finding code, skills, or documentation across viking://.
 *
 * @param {string} query - The search query
 * @param {object} [options={}]
 * @param {string} [options.targetUri] - Scope to specific viking:// path
 * @param {number} [options.limit=5]
 * @param {number} [options.scoreThreshold]
 * @param {number[]} [options.level] - e.g. [0] for L0 abstracts, [1] for L1 overviews, [2] for L2 content
 * @returns {Promise<Array<object>>}
 */
export async function findOpenViking(query, options = {}) {
  if (!query || typeof query !== "string" || !query.trim()) return [];

  try {
    const payload = {
      query: query.trim(),
      limit: options.limit || 5,
    };
    if (options.targetUri) {
      payload.target_uri = normalizeUri(options.targetUri);
    }
    if (typeof options.scoreThreshold === "number") {
      payload.score_threshold = options.scoreThreshold;
    }
    if (Array.isArray(options.level)) {
      payload.level = options.level;
    }

    const res = await fetch(`${OPENVIKING_BASE_URL}/api/v1/search/find`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      const rawResults = Array.isArray(data.result)
        ? data.result
        : (Array.isArray(data.results) ? data.results : []);

      return rawResults.map((item) => ({
        uri: item.uri || item.target_uri || "viking://",
        text: item.content || item.abstract || item.overview || item.text || "",
        score: typeof item.score === "number" ? Math.round(item.score * 100) / 100 : 1.0,
        level: item.level ?? 0,
        source: "openviking",
        title: item.title || item.name || null,
        metadata: item.metadata || {},
      }));
    }
  } catch {
    // Non-blocking fail-safe
  }

  return [];
}

/**
 * Searches relevant context with optional session awareness.
 *
 * @param {string} query
 * @param {object} [options={}]
 * @param {string} [options.targetUri]
 * @param {string} [options.sessionId]
 * @param {number} [options.limit=5]
 * @param {string} [options.searchType="hybrid"] - "hybrid" | "vector" | "keyword"
 * @returns {Promise<Array<object>>}
 */
export async function searchOpenViking(query, options = {}) {
  if (!query || typeof query !== "string" || !query.trim()) return [];

  try {
    const payload = {
      query: query.trim(),
      limit: options.limit || 5,
      search_type: options.searchType || "hybrid",
    };
    if (options.targetUri) {
      payload.target_uri = normalizeUri(options.targetUri);
    }
    if (options.sessionId) {
      payload.session_id = options.sessionId;
    }

    const res = await fetch(`${OPENVIKING_BASE_URL}/api/v1/search/search`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      const rawResults = Array.isArray(data.result)
        ? data.result
        : (Array.isArray(data.results) ? data.results : []);

      return rawResults.map((item) => ({
        uri: item.uri || item.target_uri || "viking://",
        text: item.content || item.abstract || item.overview || item.text || "",
        score: typeof item.score === "number" ? Math.round(item.score * 100) / 100 : 1.0,
        level: item.level ?? 0,
        source: "openviking",
        title: item.title || null,
        metadata: item.metadata || {},
      }));
    }
  } catch {
    // Non-blocking fail-safe
  }

  return [];
}

/**
 * Reads content from OpenViking progressive context tiers:
 * - "l0": Abstract (< 50 tokens)
 * - "l1": Overview (~ 200 tokens structural outline)
 * - "l2": Full deep document content
 *
 * @param {string} uri - e.g. "viking://repos/project/README.md"
 * @param {"l0"|"l1"|"l2"|"full"} [tier="l0"]
 * @param {object} [options={}]
 * @param {number} [options.offset=0]
 * @param {number} [options.limit=-1]
 * @returns {Promise<string|null>}
 */
export async function readOpenVikingUri(uri, tier = "l0", options = {}) {
  if (!uri) return null;
  const canonicalUri = normalizeUri(uri);
  const normalizedTier = String(tier).toLowerCase();

  let endpoint = "/api/v1/content/abstract";
  if (normalizedTier === "l1" || normalizedTier === "overview") {
    endpoint = "/api/v1/content/overview";
  } else if (normalizedTier === "l2" || normalizedTier === "full" || normalizedTier === "read") {
    endpoint = "/api/v1/content/read";
  }

  try {
    const url = new URL(`${OPENVIKING_BASE_URL}${endpoint}`);
    url.searchParams.set("uri", canonicalUri);
    if (endpoint === "/api/v1/content/read") {
      if (typeof options.offset === "number") url.searchParams.set("offset", String(options.offset));
      if (typeof options.limit === "number") url.searchParams.set("limit", String(options.limit));
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof data.result === "string") return data.result;
      if (typeof data.content === "string") return data.content;
      if (typeof data === "string") return data;
      return JSON.stringify(data.result || data);
    }
  } catch {
    // Fail silently
  }

  return null;
}

/**
 * Lists nodes under a given virtual filesystem URI in viking://.
 *
 * @param {string} [uri="viking://"]
 * @param {object} [options={}]
 * @returns {Promise<Array<object>>}
 */
export async function listOpenVikingUri(uri = "viking://", options = {}) {
  const canonicalUri = normalizeUri(uri);

  try {
    const url = new URL(`${OPENVIKING_BASE_URL}/api/v1/fs/ls`);
    url.searchParams.set("uri", canonicalUri);
    if (options.limit) url.searchParams.set("node_limit", String(options.limit));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.result)
        ? data.result
        : (Array.isArray(data.items) ? data.items : []);
    }
  } catch {
    // Fail silently
  }

  return [];
}

/**
 * Retrieves the hierarchical directory tree under a viking:// URI.
 *
 * @param {string} [uri="viking://"]
 * @param {object} [options={}]
 * @param {number} [options.depth=3]
 * @returns {Promise<object|null>}
 */
export async function getOpenVikingTree(uri = "viking://", options = {}) {
  const canonicalUri = normalizeUri(uri);

  try {
    const url = new URL(`${OPENVIKING_BASE_URL}/api/v1/fs/tree`);
    url.searchParams.set("uri", canonicalUri);
    if (options.depth) url.searchParams.set("depth", String(options.depth));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(options.timeout || DEFAULT_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      return data.result || data;
    }
  } catch {
    // Fail silently
  }

  return null;
}

/**
 * Adds a local file path, directory, or remote URL as a resource in OpenViking.
 *
 * @param {string} source - Local file/dir path or remote URL
 * @param {object} [options={}]
 * @param {string} [options.to] - Target viking:// path
 * @param {string} [options.instruction] - Ingestion instruction
 * @param {string[]} [options.tags] - Categorization tags
 * @returns {Promise<object|null>}
 */
export async function addOpenVikingResource(source, options = {}) {
  if (!source) return null;

  try {
    const payload = {
      path: source,
      instruction: options.instruction || undefined,
      tags: options.tags || undefined,
      wait: options.wait ?? false,
    };
    if (options.to) {
      payload.to = normalizeUri(options.to);
    }

    const res = await fetch(`${OPENVIKING_BASE_URL}/api/v1/resources`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeout || 10_000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fail silently
  }

  return null;
}

