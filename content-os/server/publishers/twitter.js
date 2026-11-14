// Twitter/X API v2 publisher — Free tier: 1,500 tweets/month.
// Uses OAuth 1.0a User Context for posting tweets with optional media.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHmac, randomBytes } from "crypto";
import { config, ROOT_DIR } from "../config.js";

const TWITTER_API = "https://api.twitter.com";

export function twitterConfigured() {
  return Boolean(
    config.twitterApiKey &&
    config.twitterApiSecret &&
    config.twitterAccessToken &&
    config.twitterAccessSecret
  );
}

function requireConfig() {
  if (!twitterConfigured()) {
    throw new Error("Twitter not configured — set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET in .env");
  }
}

/**
 * Generate OAuth 1.0a signature and Authorization header.
 */
function oauthHeader(method, url, params = {}) {
  const oauthParams = {
    oauth_consumer_key: config.twitterApiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: config.twitterAccessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...params };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join("&");

  const signingKey = `${encodeURIComponent(config.twitterApiSecret)}&${encodeURIComponent(config.twitterAccessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  oauthParams.oauth_signature = signature;

  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

/**
 * Upload media to Twitter using the v1.1 media/upload endpoint.
 * Returns the media_id_string for use in tweet creation.
 */
async function uploadMedia(imagePath) {
  const cleanPath = imagePath.replace(/^\//, "");
  const fullPath = join(ROOT_DIR, cleanPath);
  if (!existsSync(fullPath)) return null;

  const imageBytes = readFileSync(fullPath);
  const b64 = imageBytes.toString("base64");

  const uploadUrl = `${TWITTER_API}/1.1/media/upload.json`;
  const params = {
    media_data: b64,
  };

  const formData = new URLSearchParams(params);
  const auth = oauthHeader("POST", uploadUrl, params);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn("Twitter media upload failed:", err);
    return null;
  }

  const data = await res.json();
  return data.media_id_string || null;
}

/**
 * Post a tweet using the v2 tweets endpoint.
 */
async function createTweet(text, mediaId = null) {
  requireConfig();

  const tweetUrl = `${TWITTER_API}/2/tweets`;
  const body = { text: text.slice(0, 280) };

  if (mediaId) {
    body.media = { media_ids: [mediaId] };
  }

  const auth = oauthHeader("POST", tweetUrl);

  const res = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Twitter API error: ${data.detail || data.title || `HTTP ${res.status}`}`);
  }

  return data.data;
}

/**
 * Publish a post to Twitter/X.
 * @param {object} opts - { content: string, mediaPath?: string }
 * @returns {object} { id, status, platform, url }
 */
export async function publishTwitterPost({ content, mediaPath }) {
  let mediaId = null;
  if (mediaPath) {
    mediaId = await uploadMedia(mediaPath);
  }

  const tweet = await createTweet(content, mediaId);

  return {
    id: tweet?.id || `tweet-${Date.now()}`,
    status: "published",
    platform: "twitter",
    url: tweet?.id ? `https://x.com/i/status/${tweet.id}` : "https://x.com",
  };
}
