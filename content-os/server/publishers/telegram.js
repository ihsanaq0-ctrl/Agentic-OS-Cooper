// Telegram Bot API publisher — 100% free, zero app review.
// Sends posts (text + optional image) to a Telegram channel via the Bot API.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config, ROOT_DIR } from "../config.js";

const API_BASE = "https://api.telegram.org/bot";

export function telegramConfigured() {
  return Boolean(config.telegramBotToken && config.telegramChannelId);
}

function requireConfig() {
  if (!telegramConfigured()) {
    throw new Error("Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env");
  }
}

/**
 * Send a text-only message to the Telegram channel.
 */
async function sendMessage(text) {
  requireConfig();
  const res = await fetch(`${API_BASE}${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChannelId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram sendMessage failed: ${data.description || "Unknown error"}`);
  }
  return data.result;
}

/**
 * Send a photo with caption to the Telegram channel.
 * Uses multipart/form-data to upload the image directly.
 */
async function sendPhoto(caption, imagePath) {
  requireConfig();
  const cleanPath = imagePath.replace(/^\//, "");
  const fullPath = join(ROOT_DIR, cleanPath);

  if (!existsSync(fullPath)) {
    // Fall back to text-only if image doesn't exist
    return sendMessage(caption);
  }

  const imageBytes = readFileSync(fullPath);
  const ext = imagePath.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const formData = new FormData();
  formData.append("chat_id", config.telegramChannelId);
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");
  formData.append("photo", new Blob([imageBytes], { type: mime }), `image.${ext}`);

  const res = await fetch(`${API_BASE}${config.telegramBotToken}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram sendPhoto failed: ${data.description || "Unknown error"}`);
  }
  return data.result;
}

/**
 * Publish a post to the Telegram channel.
 * @param {object} opts - { content: string, mediaPath?: string }
 * @returns {object} { id, status, platform, url }
 */
export async function publishTelegramPost({ content, mediaPath }) {
  let result;
  if (mediaPath) {
    result = await sendPhoto(content, mediaPath);
  } else {
    result = await sendMessage(content);
  }

  return {
    id: String(result.message_id),
    status: "published",
    platform: "telegram",
    url: config.telegramChannelId.startsWith("@")
      ? `https://t.me/${config.telegramChannelId.slice(1)}`
      : `https://t.me/c/${String(config.telegramChannelId).replace("-100", "")}`,
  };
}
