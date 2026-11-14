import { config, loadEnv } from "../config.js";
import { getSetting } from "../db.js";
import { researchWeb } from "./openrouter.js";

function getNewsApiKey() {
  loadEnv();
  return process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY || process.env.NEWSDATA_API_KEY || config.newsApiKey || getSetting("news_api_key") || "";
}

/**
 * Fetch live breaking news or search news by topic from NewsAPI / live web.
 */
export async function fetchLiveNews(query = "", category = "") {
  const apiKey = getNewsApiKey();
  const cleanQuery = String(query || "").trim();
  const cleanCategory = String(category || "").trim().toLowerCase();

  // 1. Try official NewsAPI if key is available
  if (apiKey) {
    try {
      let url = "";
      if (cleanQuery) {
        url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(cleanQuery)}&language=en&sortBy=publishedAt&pageSize=6&apiKey=${apiKey}`;
      } else {
        const catParam = cleanCategory ? `&category=${encodeURIComponent(cleanCategory)}` : "";
        url = `https://newsapi.org/v2/top-headlines?language=en${catParam}&pageSize=6&apiKey=${apiKey}`;
      }

      const res = await fetch(url, { headers: { "User-Agent": "AgenticOS/2.0" } });
      const data = await res.json();
      if (res.ok && Array.isArray(data.articles) && data.articles.length > 0) {
        return data.articles.slice(0, 6).map((a) => ({
          title: a.title,
          summary: a.description || a.content || "No summary available.",
          source: a.source?.name || "News",
          url: a.url,
          publishedAt: a.publishedAt,
        }));
      }
    } catch (err) {
      console.warn("NewsAPI fetch failed, attempting live web fallback:", err.message);
    }
  }

  // 2. Intelligent fallback: use Perplexity live search
  try {
    const searchQuery = cleanQuery
      ? `latest breaking news about ${cleanQuery}`
      : `top breaking world news and tech headlines today`;
    const webResults = await researchWeb(searchQuery, { count: 5 });
    if (webResults && webResults.length > 0) {
      return webResults.map((item) => ({
        title: item.title,
        summary: item.summary,
        source: "Live Web",
        url: item.url,
        publishedAt: new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn("Live web news fallback error:", err.message);
  }

  return [];
}
