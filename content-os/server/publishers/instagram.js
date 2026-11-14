// Instagram Graph API publisher — Free via Meta Developer Portal.
// Requires an Instagram Creator/Business account linked to a Facebook Page.
// Uses the Content Publishing API (container → publish flow).
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config, ROOT_DIR } from "../config.js";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export function instagramConfigured() {
  return Boolean(config.instagramAccessToken && config.instagramAccountId);
}

function requireConfig() {
  if (!instagramConfigured()) {
    throw new Error(
      "Instagram not configured — set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID in .env"
    );
  }
}

/**
 * Create a media container on Instagram.
 * For image posts, the image must be publicly accessible via URL.
 * Since we host locally, we need to use a public URL or base64 approach.
 *
 * Note: Instagram Graph API requires a PUBLIC image URL. If you're running
 * locally, you'll need to expose your server (e.g., via Tailscale or ngrok)
 * or upload the image to a temporary hosting service first.
 */
async function createContainer({ caption, imageUrl }) {
  requireConfig();

  const params = new URLSearchParams({
    caption: caption.slice(0, 2200), // Instagram caption limit
    access_token: config.instagramAccessToken,
  });

  if (imageUrl) {
    params.append("image_url", imageUrl);
  }

  const res = await fetch(
    `${GRAPH_API}/${config.instagramAccountId}/media?${params.toString()}`,
    { method: "POST" }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error(`Instagram container error: ${data.error.message}`);
  }
  return data.id;
}

/**
 * Publish a media container (makes it live on the feed).
 */
async function publishContainer(containerId) {
  requireConfig();

  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: config.instagramAccessToken,
  });

  const res = await fetch(
    `${GRAPH_API}/${config.instagramAccountId}/media_publish?${params.toString()}`,
    { method: "POST" }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error(`Instagram publish error: ${data.error.message}`);
  }
  return data.id;
}

/**
 * Publish a post to Instagram.
 * Note: Instagram requires a PUBLIC image URL. For local development,
 * expose your server via Tailscale/ngrok and pass the full public URL.
 *
 * @param {object} opts - { content: string, mediaPath?: string, imageUrl?: string }
 * @returns {object} { id, status, platform, url }
 */
export async function publishInstagramPost({ content, mediaPath, imageUrl }) {
  // Prefer explicit imageUrl. If only mediaPath is given, construct local URL.
  // (This only works if the server is publicly accessible)
  let finalImageUrl = imageUrl;
  if (!finalImageUrl && mediaPath) {
    const publicBase = config.publicBaseUrl || `http://localhost:${config.port}`;
    finalImageUrl = `${publicBase}${mediaPath.startsWith("/") ? "" : "/"}${mediaPath}`;
  }

  if (!finalImageUrl) {
    throw new Error(
      "Instagram requires an image. Generate an image first, then publish."
    );
  }

  const containerId = await createContainer({
    caption: content,
    imageUrl: finalImageUrl,
  });

  // Wait for the container to be ready (Instagram processes it async)
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const mediaId = await publishContainer(containerId);

  return {
    id: mediaId || `ig-${Date.now()}`,
    status: "published",
    platform: "instagram",
    url: `https://www.instagram.com/`,
  };
}
