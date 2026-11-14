// ArXiv cs.AI / cs.MA daily paper feed collector.
// Fetches the Atom/RSS feed from arxiv.org and parses paper metadata
// (title, authors, abstract, link) into articles for the priority feed.

const ARXIV_FEEDS = {
  "cs.AI": "https://rss.arxiv.org/rss/cs.AI",
  "cs.MA": "https://rss.arxiv.org/rss/cs.MA",
  "cs.CL": "https://rss.arxiv.org/rss/cs.CL",  // Computation & Language (NLP/LLM)
  "cs.LG": "https://rss.arxiv.org/rss/cs.LG",  // Machine Learning
};

/**
 * Parse ArXiv RSS/RDF XML into structured items.
 * ArXiv uses RDF with dc: and content: namespaces.
 */
function parseArxivRss(xml) {
  const items = [];
  // Match <item> blocks
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const block = m[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()
      ?.replace(/<[^>]+>/g, "")
      ?.replace(/\s+/g, " ") || "Untitled";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
    const description = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim()
      ?.replace(/<[^>]+>/g, "")
      ?.replace(/&lt;/g, "<")
      ?.replace(/&gt;/g, ">")
      ?.replace(/&amp;/g, "&")
      ?.replace(/\s+/g, " ") || "";
    const creator = block.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/)?.[1]?.trim()
      ?.replace(/<[^>]+>/g, "") || "";

    if (link && title !== "Untitled") {
      items.push({
        title: title.replace(/^\(.*?\)\s*/, ""), // Remove ArXiv (arXiv:xxx) prefix
        url: link,
        summary: description.slice(0, 800),
        authors: creator,
      });
    }
  }
  return items;
}

/**
 * Collect papers from ArXiv feeds.
 * @param {string} url - The ArXiv feed URL or category code (e.g., "cs.AI")
 * @param {object} opts - Options including topic tags
 * @returns {Array} Article-shaped objects for the feed
 */
export async function collectArxiv(url, { tags = [], maxItems = 15 } = {}) {
  // Support both full URLs and category codes
  const feedUrl = url.startsWith("http") ? url : (ARXIV_FEEDS[url] || ARXIV_FEEDS["cs.AI"]);

  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "AgenticOS/2.0 (Research Feed)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) {
      console.warn(`ArXiv feed fetch failed: HTTP ${res.status} for ${feedUrl}`);
      return [];
    }
    const xml = await res.text();
    const papers = parseArxivRss(xml);

    return papers.slice(0, maxItems).map((p) => ({
      title: p.title,
      url: p.url,
      summary: p.authors
        ? `${p.authors}\n\n${p.summary}`
        : p.summary,
      topic_tags: [...tags, "research", "arxiv"],
      source_type: "arxiv",
    }));
  } catch (err) {
    console.warn("ArXiv collector error:", err.message);
    return [];
  }
}

/**
 * Available ArXiv feed categories for the UI source type selector.
 */
export const ARXIV_CATEGORIES = Object.keys(ARXIV_FEEDS);
