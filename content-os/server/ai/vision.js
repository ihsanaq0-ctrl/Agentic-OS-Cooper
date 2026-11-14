// Screen capture + Vision AI analysis for Cooper.
// Uses PowerShell to capture the screen on Windows, then sends the
// screenshot to a vision-capable model for analysis.
import screenshot from "screenshot-desktop";
import { readFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { ROOT_DIR, config } from "../config.js";

const SCREENSHOTS_DIR = join(ROOT_DIR, "storage", "screenshots");
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

/**
 * Capture the current screen using PowerShell.
 * Returns the path to the saved screenshot.
 */
export async function captureScreen() {
  const filename = `screen-${Date.now()}.png`;
  const filePath = join(SCREENSHOTS_DIR, filename);

  try {
    await screenshot({ filename: filePath });
  } catch (err) {
    throw new Error(`Screen capture failed: ${err.message}`);
  }

  if (!existsSync(filePath)) {
    throw new Error("Screenshot was not saved.");
  }

  return {
    path: filePath,
    relativePath: `/storage/screenshots/${filename}`,
    filename,
  };
}

/**
 * Capture screen and analyze it with a vision model.
 *
 * @param {string} question - What to look for / analyze in the screenshot
 * @returns {object} { analysis, screenshotPath }
 */
export async function captureAndAnalyze(question = "Describe what you see on the screen.") {
  // 1. Take screenshot
  const screenshot = await captureScreen();

  // 2. Read image as base64
  const imageBytes = readFileSync(screenshot.path);
  const b64 = imageBytes.toString("base64");

  // 3. Send to vision model
  const prompt = question || "Analyze this screenshot. Describe what's on screen, identify any errors, and provide helpful observations.";

  // Determine the vision model and base URL
  const baseUrl = config.groqApiKey
    ? "https://api.groq.com/openai/v1"
    : (config.openrouterApiKey ? "https://openrouter.ai/api/v1" : config.ollamaBaseUrl);
  const apiKey = config.groqApiKey || config.openrouterApiKey;
  const model = config.groqApiKey ? "llama-3.2-90b-vision-preview" : "google/gemini-2.0-flash-001";

  if (!baseUrl || !apiKey) {
    return {
      analysis: "Vision analysis unavailable — no AI provider configured.",
      screenshotPath: screenshot.relativePath,
    };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${b64}` },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const analysis = data.choices?.[0]?.message?.content || "Could not analyze the screenshot.";

    try {
      unlinkSync(screenshot.path);
    } catch (e) {
      console.error(`Failed to delete screenshot: ${e.message}`);
    }

    return {
      analysis,
      screenshotPath: screenshot.relativePath,
    };
  } catch (err) {
    try {
      unlinkSync(screenshot.path);
    } catch (e) {
      console.error(`Failed to delete screenshot: ${e.message}`);
    }

    return {
      analysis: `Vision analysis error: ${err.message}`,
      screenshotPath: screenshot.relativePath,
    };
  }
}
