// GitHub trending AI repositories collector.
// Fetches trending repos from GitHub's search API (sorted by stars, recent)
// filtered by AI/ML topics, and returns them as articles for the feed.

const GITHUB_SEARCH_API = "https://api.github.com/search/repositories";

// Default AI-related query terms for trending repo discovery
const AI_TOPICS = "topic:ai OR topic:machine-learning OR topic:llm OR topic:agents OR topic:rag OR topic:deep-learning";

/**
 * Compute a date N days ago in YYYY-MM-DD format.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Collect trending AI GitHub repos created or updated in the last N days.
 * Uses GitHub's public search API (no token required, 10 requests/min).
 *
 * @param {string} query - Optional custom search query (overrides default AI topics)
 * @param {object} opts - Options: tags, maxItems, daysBack
 * @returns {Array} Article-shaped objects for the feed
 */
export async function collectGitHub(query, { tags = [], maxItems = 12, daysBack = 7 } = {}) {
  const since = daysAgo(daysBack);
  const searchQuery = query && !query.startsWith("http")
    ? `${query} pushed:>${since}`
    : `${AI_TOPICS} pushed:>${since}`;

  const url = `${GITHUB_SEARCH_API}?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${maxItems}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "AgenticOS/2.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      // Rate-limited or error
      if (res.status === 403) {
        console.warn("GitHub API rate limit reached. Try again later or add a GITHUB_TOKEN.");
      }
      console.warn(`GitHub search failed: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const repos = data.items || [];

    return repos.slice(0, maxItems).map((repo) => {
      const stars = repo.stargazers_count || 0;
      const starsStr = stars > 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars);
      const lang = repo.language || "Unknown";
      const topics = (repo.topics || []).slice(0, 5);

      const summary = [
        repo.description || "No description.",
        "",
        `⭐ ${starsStr} stars · ${lang} · Updated ${repo.pushed_at?.slice(0, 10) || "recently"}`,
        topics.length ? `Topics: ${topics.join(", ")}` : "",
      ].filter(Boolean).join("\n");

      return {
        title: `${repo.full_name} — ${repo.description?.slice(0, 80) || "AI Repository"}`,
        url: repo.html_url,
        summary,
        topic_tags: [...new Set([...tags, ...topics.slice(0, 3), "github", "open-source"])],
        source_type: "github",
      };
    });
  } catch (err) {
    console.warn("GitHub collector error:", err.message);
    return [];
  }
}
