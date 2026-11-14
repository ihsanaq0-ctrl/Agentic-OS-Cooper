// Discord Webhook publisher — 100% free, instant setup.
// Sends posts (text + optional image embed) to a Discord channel via a webhook URL.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config, ROOT_DIR } from "../config.js";

export function discordConfigured() {
  return Boolean(config.discordWebhookUrl);
}

function requireConfig() {
  if (!discordConfigured()) {
    throw new Error("Discord not configured — set DISCORD_WEBHOOK_URL in .env");
  }
}

/**
 * Publish a post to a Discord channel via webhook.
 * Uses multipart/form-data to attach the image directly.
 *
 * @param {object} opts - { content: string, mediaPath?: string }
 * @returns {object} { id, status, platform }
 */
export async function publishDiscordPost({ content, mediaPath }) {
  requireConfig();

  const formData = new FormData();

  // Discord webhook payload as JSON in the "payload_json" field
  const payload = {
    content: content.slice(0, 2000), // Discord message limit
  };

  let hasImage = false;
  if (mediaPath) {
    const cleanPath = mediaPath.replace(/^\//, "");
    const fullPath = join(ROOT_DIR, cleanPath);
    if (existsSync(fullPath)) {
      const imageBytes = readFileSync(fullPath);
      const ext = mediaPath.split(".").pop().toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      formData.append("files[0]", new Blob([imageBytes], { type: mime }), `image.${ext}`);
      hasImage = true;
    }
  }

  // If we have an image attached, we don't need embeds — Discord auto-previews it
  formData.append("payload_json", JSON.stringify(payload));

  const res = await fetch(config.discordWebhookUrl + "?wait=true", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Discord webhook failed: ${err.message || `HTTP ${res.status}`}`);
  }

  const data = await res.json().catch(() => ({}));

  return {
    id: data.id || `discord-${Date.now()}`,
    status: "published",
    platform: "discord",
    url: config.discordWebhookUrl.split("?")[0], // Webhook URL (no token)
  };
}
