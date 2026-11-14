import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { ROOT_DIR } from "../config.js";
import { saveToAgentMemory } from "../ai/agentmemoryClient.js";
import { addOpenVikingResource } from "../ai/openvikingClient.js";
import { remember } from "../ai/memory.js";

// Locate Python executable from the browser-use virtual environment
const VENV_PYTHON = join(
  ROOT_DIR,
  "Github Repos",
  "browser-use-main",
  "browser-use-main",
  ".venv",
  "Scripts",
  "python.exe"
);

const BROWSER_AGENT_SCRIPT = join(ROOT_DIR, "server", "system", "browser_agent.py");

export function getPythonExecutable() {
  if (existsSync(VENV_PYTHON)) {
    return VENV_PYTHON;
  }
  return process.platform === "win32" ? "python" : "python3";
}

/**
 * Checks whether the autonomous browser-use agent runtime is ready.
 * @returns {object}
 */
export function getBrowserAgentStatus() {
  const venvReady = existsSync(VENV_PYTHON);
  const scriptReady = existsSync(BROWSER_AGENT_SCRIPT);

  return {
    ready: venvReady && scriptReady,
    runtime: "browser-use 1.0.2 (Raw CDP)",
    python: venvReady ? VENV_PYTHON : (process.platform === "win32" ? "python" : "python3"),
    script: BROWSER_AGENT_SCRIPT,
  };
}

/**
 * Runs an autonomous browser task using browser-use.
 * Auto-commits extracted research and results into OpenViking and AgentMemory.
 *
 * @param {object} options
 * @param {string} options.prompt - The instruction for what to do in the browser
 * @param {string} [options.url] - Optional URL to start with
 * @param {string} [options.browser="chromium"] - "chrome" or "chromium"
 * @param {boolean} [options.headless=false] - Run headless or visible
 * @param {number} [options.durationSeconds] - Target duration in seconds for interactive walkthroughs
 * @param {string} [options.model] - Optional LLM model override
 * @returns {Promise<object>} { success, result, steps, duration_s, memory_indexed, error }
 */
export function runBrowserTask({
  prompt,
  url = null,
  browser = "chromium",
  headless = false,
  durationSeconds = null,
  model = null,
}) {
  return new Promise((resolve) => {
    if (!prompt || typeof prompt !== "string") {
      return resolve({
        success: false,
        error: "A valid prompt is required for the browser agent.",
      });
    }

    const pythonBin = getPythonExecutable();
    const args = [BROWSER_AGENT_SCRIPT, "--prompt", prompt];

    if (url) {
      args.push("--url", url);
    }
    if (browser) {
      args.push("--browser", browser);
    }
    if (headless) {
      args.push("--headless");
    }
    if (durationSeconds) {
      args.push("--duration", String(durationSeconds));
    }
    if (model) {
      args.push("--model", model);
    }

    console.log(`[BrowserAgent] Spawning: ${pythonBin} ${args.join(" ")}`);

    const child = spawn(pythonBin, args, {
      cwd: ROOT_DIR,
      env: { ...process.env },
    });

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      const errStr = chunk.toString();
      stderrData += errStr;
      console.warn(`[BrowserAgent:err]`, errStr.trim());
    });

    child.on("error", (err) => {
      console.error(`[BrowserAgent] Process spawn error:`, err);
      resolve({
        success: false,
        error: `Failed to launch Python browser agent: ${err.message}`,
      });
    });

    child.on("close", async (code) => {
      console.log(`[BrowserAgent] Process exited with code ${code}`);

      // Try to find and parse the JSON line from stdout
      const lines = stdoutData.trim().split("\n");
      let parsed = null;

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith("{") && line.endsWith("}")) {
          try {
            parsed = JSON.parse(line);
            break;
          } catch {
            // continue looking
          }
        }
      }

      const outcome = parsed || {
        success: code === 0,
        result: stdoutData.trim(),
        error: code !== 0 ? (stderrData.trim() || `Process exited with code ${code}`) : null,
      };

      // Auto-commit findings into Cooper's Cognitive Memory
      if (outcome.success && outcome.result && String(outcome.result).trim().length > 10) {
        try {
          const resultText = String(outcome.result).trim();
          const dateSlug = new Date().toISOString().split("T")[0];
          const taskSlug = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
          const targetUri = `viking://research/web/${dateSlug}-${taskSlug}`;

          // 1. Commit to local SQLite
          const localMem = await remember(resultText, {
            type: "research",
            concepts: ["browser-task", "web-research", url ? new URL(url).hostname : "web"],
            project: "browser-agent",
            source: "browser-use",
          });

          // 2. Commit to AgentMemory Knowledge Graph
          const amReceipt = await saveToAgentMemory(resultText, {
            type: "fact",
            concepts: ["browser-task", "web-research"],
            project: "browser-agent",
          }).catch(() => null);

          // 3. Commit to OpenViking virtual filesystem
          const ovReceipt = await addOpenVikingResource(resultText, {
            to: targetUri,
            instruction: `Autonomous web research for prompt: "${prompt}"`,
            tags: ["web-research", "browser-task"],
          }).catch(() => null);

          outcome.memory_indexed = true;
          outcome.sqlite_id = localMem?.id || null;
          outcome.agentmemory_id = amReceipt?.memory?.id || null;
          outcome.openviking_uri = targetUri;
        } catch (memErr) {
          console.warn("[BrowserAgent] Non-blocking memory indexing warning:", memErr.message);
        }
      }

      resolve(outcome);
    });
  });
}
