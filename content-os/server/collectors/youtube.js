// YouTube video transcript collector.
// Given a YouTube URL, fetches the video metadata and auto-generated transcript,
// then summarizes the content via LLM into a feed article.
import { chat } from "../ai/openrouter.js";
import { getSetting } from "../db.js";

const YT_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url) {
  const m = String(url).match(YT_REGEX);
  return m ? m[1] : null;
}

/**
 * Fetch video metadata via YouTube oEmbed (no API key needed)
 */
async function fetchMetadata(videoId) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return { title: "Unknown Video", author: "Unknown" };
  const data = await res.json();
  return {
    title: data.title || "Unknown Video",
    author: data.author_name || "Unknown",
    thumbnail: data.thumbnail_url || null,
  };
}

/**
 * Attempt to fetch auto-generated transcript from YouTube.
 * This scrapes the captions track URL from the video page.
 */
async function fetchTranscript(videoId) {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    // Extract captions track URL from the page source
    const captionMatch = html.match(/"captionTracks":\[(\{.*?\})\]/);
    if (!captionMatch) return null;

    // Parse the first caption track
    const trackData = JSON.parse(`[${captionMatch[1]}]`);
    const track = trackData.find((t) => t.languageCode === "en") || trackData[0];
    if (!track?.baseUrl) return null;

    // Fetch the transcript XML
    const captionUrl = track.baseUrl.replace(/\\u0026/g, "&");
    const capRes = await fetch(captionUrl);
    if (!capRes.ok) return null;
    const xml = await capRes.text();

    // Parse XML text nodes: <text start="..." dur="...">content</text>
    const lines = [];
    const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
    for (const m of textMatches) {
      const clean = m[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<[^>]+>/g, "")
        .trim();
      if (clean) lines.push(clean);
    }

    return lines.length > 0 ? lines.join(" ") : null;
  } catch {
    return null;
  }
}

/**
 * Summarize transcript via LLM into an article.
 */
async function summarizeTranscript(title, author, transcript) {
  const niche = getSetting("niche_keywords") || "AI, machine learning";
  const prompt =
    `You are a content analyst. Summarize this YouTube video transcript into a structured article.\n\n` +
    `Video: "${title}" by ${author}\n\n` +
    `Transcript (first 6000 chars):\n${transcript.slice(0, 6000)}\n\n` +
    `Output a JSON object with these fields:\n` +
    `- "summary": 2-3 paragraph summary of key points and takeaways\n` +
    `- "tags": array of relevant topic tags (max 5, from: ${niche})\n` +
    `Return ONLY the JSON object, no extra text.`;

  try {
    const raw = await chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.3 }
    );
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
  } catch { /* fall through */ }

  return { summary: transcript.slice(0, 500), tags: [] };
}

/**
 * Collect articles from a YouTube video URL.
 * Returns an array of article-shaped objects for the feed.
 */
export async function collectYouTube(url, { tags = [] } = {}) {
  const videoId = extractVideoId(url);
  if (!videoId) return [];

  const meta = await fetchMetadata(videoId);
  const transcript = await fetchTranscript(videoId);

  let summary = `Video by ${meta.author}. Transcript unavailable — watch at https://www.youtube.com/watch?v=${videoId}`;
  let autoTags = [...tags];

  if (transcript && transcript.length > 100) {
    const result = await summarizeTranscript(meta.title, meta.author, transcript);
    summary = result.summary || summary;
    autoTags = [...new Set([...tags, ...(result.tags || [])])];
  }

  return [{
    title: meta.title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    summary,
    topic_tags: autoTags,
    source_type: "youtube",
  }];
}
