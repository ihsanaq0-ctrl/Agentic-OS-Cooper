// Proactive morning/evening briefing engine.
// Generates a personalized briefing combining weather, tasks, news, and expenses.
// Can optionally generate audio via TTS for playback in the HUD.
import { fetchWeather } from "./weatherService.js";
import { fetchLiveNews } from "./newsService.js";
import { chat, tts } from "./openrouter.js";
import {
  listTasks, revenueVsExpense, insertBriefing,
  getLatestBriefing, getSetting,
} from "../db.js";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT_DIR } from "../config.js";

// Ensure briefings storage directory exists
const BRIEFINGS_DIR = join(ROOT_DIR, "storage", "briefings");
mkdirSync(BRIEFINGS_DIR, { recursive: true });

/**
 * Generate a proactive briefing.
 *
 * @param {string} type - "morning" | "evening" | "custom"
 * @param {object} opts - { generateAudio: boolean }
 * @returns {object} The saved briefing record
 */
export async function generateBriefing(type = "morning", { generateAudio = true } = {}) {
  const tz = getSetting("timezone") || "Asia/Karachi";
  const brandVoice = getSetting("brand_voice") || "";

  // 1. Gather context data
  const [weather, tasks, news, finances] = await Promise.allSettled([
    fetchWeather(""),
    Promise.resolve(listTasks({ status: "open" })),
    fetchLiveNews("AI"),
    Promise.resolve(revenueVsExpense({})),
  ]);

  const weatherData = weather.status === "fulfilled" ? weather.value : null;
  const taskList = tasks.status === "fulfilled" ? tasks.value : [];
  const newsItems = news.status === "fulfilled" ? news.value : [];
  const financeData = finances.status === "fulfilled" ? finances.value : { income: 0, expense: 0 };

  const data = {
    weather: weatherData,
    tasks: taskList.slice(0, 5),
    news: newsItems.slice(0, 4),
    finances: financeData,
    generated_at: new Date().toISOString(),
  };

  // 2. Compose briefing via LLM
  const prompt = composeBriefingPrompt(type, data, brandVoice, tz);
  let briefingText;
  try {
    briefingText = await chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.6 }
    );
  } catch {
    briefingText = composeStaticBriefing(type, data);
  }

  // 3. Generate audio (optional)
  let audioPath = null;
  if (generateAudio) {
    try {
      const audioResult = await tts(briefingText.slice(0, 1500));
      if (audioResult?.b64) {
        const filename = `${type}-${Date.now()}.mp3`;
        const filePath = join(BRIEFINGS_DIR, filename);
        writeFileSync(filePath, Buffer.from(audioResult.b64, "base64"));
        audioPath = `/storage/briefings/${filename}`;
      }
    } catch {
      // Audio generation failed — text-only briefing
    }
  }

  // 4. Save to DB
  const record = insertBriefing({
    type,
    text: briefingText,
    audio_path: audioPath,
    data,
  });

  return {
    ...record,
    text: briefingText,
    audio_path: audioPath,
    data,
  };
}

function composeBriefingPrompt(type, data, brandVoice, timezone) {
  const timeOfDay = type === "evening" ? "evening" : "morning";
  const w = data.weather;
  const weatherStr = w
    ? `Weather: ${w.temp_c}°C, ${w.condition} in ${w.location}. Feels like ${w.feels_like_c}°C. Humidity: ${w.humidity}%.`
    : "Weather: unavailable.";

  const taskStr = data.tasks.length > 0
    ? `Open tasks:\n${data.tasks.map((t) => `  - ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ""}`).join("\n")}`
    : "No open tasks.";

  const newsStr = data.news.length > 0
    ? `Top AI headlines:\n${data.news.map((n) => `  - ${n.title} (${n.source})`).join("\n")}`
    : "No recent news.";

  const finStr = `Finances: Income ${data.finances.income.toLocaleString()} PKR, Expenses ${data.finances.expense.toLocaleString()} PKR.`;

  return (
    `You are Cooper, Ihsan's AI assistant. Generate a concise ${timeOfDay} briefing.\n\n` +
    `Context:\n${weatherStr}\n${taskStr}\n${newsStr}\n${finStr}\n\n` +
    `Timezone: ${timezone}\n` +
    `Voice: ${brandVoice || "Clear, confident, concise. Engineering-focused."}\n\n` +
    `Rules:\n` +
    `- Keep it under 200 words\n` +
    `- Start with a greeting appropriate for ${timeOfDay}\n` +
    `- Mention weather briefly\n` +
    `- Highlight top 1-2 tasks if any\n` +
    `- Mention 1-2 interesting AI news headlines\n` +
    `- End with a motivational or practical note\n` +
    `- Speak naturally as if talking to Ihsan directly`
  );
}

function composeStaticBriefing(type, data) {
  const greeting = type === "evening" ? "Good evening" : "Good morning";
  const w = data.weather;
  const weatherLine = w
    ? `It's ${w.temp_c}°C and ${w.condition} in ${w.location}.`
    : "";
  const taskLine = data.tasks.length > 0
    ? `You have ${data.tasks.length} open task${data.tasks.length > 1 ? "s" : ""}: ${data.tasks[0].title}.`
    : "Your task list is clear.";

  return `${greeting}, Ihsan. ${weatherLine} ${taskLine} Let's make it count.`;
}

/**
 * Get the latest briefing, or generate a new one if stale.
 * A briefing is considered stale if it's more than 10 hours old.
 */
export async function getOrGenerateBriefing(type = "morning") {
  const latest = getLatestBriefing(type);
  if (latest) {
    const age = Date.now() - new Date(latest.created_at).getTime();
    if (age < 10 * 3600_000) return latest; // Less than 10 hours old
  }
  return generateBriefing(type);
}
