import { chatWithTools, chat, generateImageV2, researchWeb, imageContentModel, assistantFastModel } from "./openrouter.js";
import { fetchLiveNews } from "./newsService.js";
import { fetchWeather } from "./weatherService.js";
import { remember, recall, memoryStats, getUnifiedMemoryStatus } from "./memory.js";
import { captureAndAnalyze } from "./vision.js";
import { getOrGenerateBriefing } from "./briefing.js";
import { listProjects, gitStatus, openProject } from "../system/projects.js";
import { runProject, stopProject } from "../system/projectRunner.js";
import { captureScreenshot, startRecording, stopRecording, getRecordingStatus } from "../system/mediaCapture.js";
import { recordProjectDemo } from "../system/demoSequencer.js";
import { runBrowserTask } from "../system/browserAgentBridge.js";
import { getAgentMemoryInfo, ensureAgentMemoryRunning } from "../system/agentmemoryService.js";
import { getVoiceStudioInfo, ensureVoiceStudioRunning } from "../system/voiceStudioService.js";
import { generateDiagram } from "./diagramGenerator.js";
import {
  revenueVsExpense, sumByCategory, listTransactions,
  listMailMessages, upsertMailMessage, getGmailTokens, listTasks, createTask, updateTask, getSetting, setSetting, createDraft,
  listAccounts,
} from "../db.js";
import { broadcastGlobal } from "../sse.js";
import { fetchRecentMessages } from "../google/gmail.js";
import {
  isSystemModeEnabled, setSystemModeEnabled, requestApproval,
  openBrowser, launchSoftware, powerControl, runCommand, isHighRiskCommand,
  playYouTube,
} from "../system/controller.js";
import { validateCommand } from "../system/sandbox.js";
import {
  lockSystem, getAuthStatus, listEnrolledOperators, isSystemLocked,
  triggerOpenBiometricPortal, getCurrentOperator, assertUnlocked,
} from "../system/security.js";
import {
  presentCard, addCard, resetBoard, getBoardState, isBarehandsRunning,
} from "../barehands-bridge.js";
import {
  triggerSoundCue, setHudMode, setArcPower, getHudStatus,
} from "../jarvis-cv-bridge.js";
import {
  generateBrainstormSession, openBrainstormCanvas, getCurrentBrainstormSession,
} from "../jarvisflow-bridge.js";
import {
  updateIronHandsTransform, setIronHandsTarget, setIronHandsExplode,
  resetIronHandsTransform, getIronHandsState,
} from "../ironhands-bridge.js";
import {
  startGevDaemon, stopGevDaemon, dispatchGevCommand,
  getFreeFlightTelemetry, getFreeSatelliteTelemetry,
  getFreeEarthquakeTelemetry, getFreeWeatherTelemetry,
} from "../godseye-bridge.js";
import { executeGestureAction } from "../system/gestureActionRouter.js";
import { searchScientificLiterature, getScientificEngineStatus } from "./scientificResearch.js";
import {
  listGithubRepos, getGithubNotifications,
  githubCreateRepo, githubCreateIssue
} from "../publishers/github.js";

function systemPrompt() {
  const tz = getSetting("timezone") || "Asia/Karachi";
  const sysMode = isSystemModeEnabled() ? "ENABLED" : "STANDBY";
  const sec = getAuthStatus();
  const operatorName = getCurrentOperator()?.name || "Unverified Operator";
  const mem = memoryStats();
  const preferredLang = getSetting("assistant_language") || "English";
  return (
    "You are Cooper, the live assistant of Agentic OS — the personal AI automation platform of Ihsan Ullah, " +
    "an AI / Machine Learning Engineer from Peshawar, Pakistan, who builds multi-agent systems, RAG pipelines, " +
    "and AI security tools (GhostForge AI, Agentic OS, YTForge). You serve Ihsan and follow all of his instructions. " +
    "You are concise, calm, and precise — a sci-fi AI butler. Replies are often read aloud, so answer in " +
    "1-2 short sentences with no markdown, lists, code, or emoji. Answer ONLY what was asked — never " +
    "volunteer extra facts, summaries, or follow-up suggestions the user didn't request. If a yes/no or " +
    "one-word answer is correct, give just that. " +
    `CURRENT PERSISTENT CONVERSATIONAL LANGUAGE: ${preferredLang}. You MUST conduct this entire conversation, respond, and speak in ${preferredLang} until Ihsan explicitly instructs you to switch to another language. Do NOT revert to English or any other language unless explicitly commanded. If ${preferredLang} is Urdu (اردو), reply in polite, fluent, natural Urdu (using respectful butler terms like جناب or حضور) and keep spoken responses concise (1-2 sentences) so they speak cleanly via voice. ` +
    "You can play songs/videos on YouTube, check real-time weather, " +
    "fetch live news via NewsAPI / web, control PC power (shutdown, restart, sleep, lock screen, abort shutdown), " +
    "launch installed software, open websites in the browser, execute system commands, read Ihsan's finances, " +
    "mail, tasks, connected social media accounts, add or check off tasks, and draft content.\n" +
    "NEW CAPABILITIES: You can recall past conversations and research from long-term memory (recall_memory), " +
    "capture and analyze the screen with vision AI (capture_screen), take screenshots to gallery (take_screenshot), record the screen for demos (start_screen_recording, stop_screen_recording), list and inspect git projects (list_projects, " +
    "git_status), open projects in VS Code (open_project), run local projects automatically (run_project, stop_project), record autonomous project demos for social media (record_project_demo), get a morning/evening briefing (get_briefing), " +
    "and analyze spending patterns and anomalies (analyze_spending).\n" +
    "BIOMETRICS & SECURITY: Local neural face presence (MediaPipe) is active. " +
    `Status: ${sec.locked ? "LOCKED (biometric visor active)" : "UNLOCKED"}. ` +
    `Current operator: ${operatorName}. Authorized profiles: ${sec.userCount}.\n` +
    `You have ${mem.total} memories stored. ${mem.hasEmbeddings ? "Semantic recall is active." : "Keyword recall active."}\n` +
    "When asked to play a song, music, or video on YouTube, ALWAYS call the play_youtube tool with the song query.\n" +
    "When asked for weather or temperature, ALWAYS call the get_weather tool.\n" +
    "When asked for live news or current headlines, ALWAYS call the get_live_news tool.\n" +
    "When asked to recall, remember, or 'what was that thing about X', use the recall_memory tool.\n" +
    "When asked to remember, note, or store a fact, preference, or concept into your long-term memory or knowledge graph, use the store_memory tool.\n" +
    "When asked about memory health, memory stats, or the knowledge graph viewer, use get_memory_status.\n" +
    "When asked to look at the screen, see what's on screen, or analyze an error on screen, use the capture_screen tool.\n" +
    "When asked about projects, repos, git status, or to open a project, use the project tools.\n" +
    "When asked to test, start, run, or open a local project app, use run_project.\n" +
    "When asked to record a video, make a demo, or take a screen recording, use start_screen_recording, stop_screen_recording, or record_project_demo.\n" +
    "When asked to automate browser actions, interact with a website or local web app (e.g. click buttons, switch tabs, fill forms, demonstrate UI features), use run_browser_task.\n" +
    "When asked to lock Cooper, lock the screen, or engage security, ALWAYS call lock_cooper.\n" +
    "When asked who is logged in, who has access, or about security status, call get_security_status or list_enrolled_operators.\n" +
    "When asked to enroll a new face or add an operator, call open_biometric_portal.\n" +
    "SPATIAL HOLOGRAPHIC STAGE (Bare Hands): You can project cards, plans, notes, and briefings onto the spatial AR glass stage (barehands_present, barehands_add_card, barehands_clear_board, barehands_get_board_state). When Ihsan asks you to show, display, or present something on the glass board or holographic stage, call barehands_present. To wipe or clear the board, call barehands_clear_board.\n" +
    "STARK HUD & PROCEDURAL SOUND ENGINE (Jarvis-CV): You can play tactical sci-fi sound effects (sound_effect: engage, select, repulsor, scan, lock, error), toggle the 3D HUD centerpiece between the Wireframe Globe and the 3D Arc Reactor (set_hud_mode: globe | arc_reactor), and adjust Arc Reactor power output (set_arc_reactor_power: 0-100%).\n" +
    "JARVIS FLOW GESTURE MIND-MAPPING: You can brainstorm concepts and generate interactive 4-quadrant spatial mind maps attached to fingertips (brainstorm_topic, open_brainstorm_canvas, get_brainstorm_tree). When Ihsan asks you to brainstorm, map out an idea, or plan a project visually, call brainstorm_topic.\n" +
    "IRONHANDS 3D SPATIAL KINETIC CONTROL: You can manipulate 3D holographic models in real time (ironhands_transform, ironhands_set_target, ironhands_explode_model, ironhands_reset_transform). When Ihsan asks to rotate, scale, pan, or explode/deconstruct the Arc Reactor or Globe components in 3D, execute the IronHands tools.\n" +
    "GODS EYE VIEW (3D SATELLITE & GLOBAL RECONNAISSANCE): You can launch the 3D spy-satellite Earth console (godseye_launch), orbit the satellite camera to any city, coordinate, or landmark worldwide (godseye_orbit), switch real-time sensor optics to FLIR thermal, night vision, or CRT scanlines (godseye_set_optics), toggle intelligence layers (godseye_toggle_layer: flights, militaryFlights, satellites, earthquakes, cables, weather), scan live airspace (godseye_scan_airspace), and track the ISS orbit (godseye_iss_tracker).\n" +
    "TRI-MODAL CONTROL (Voice, Text, Gestures): Cooper supports complete hands-free operation via Hand Gestures (MediaPipe Hands). Gestures available: Index Point + Pinch = Air Mouse & Click; Two-Finger Vertical = Air Scroll; Swipes = View/Tab Navigation; Peace Sign (✌️) = Voice Wake; Thumbs-Up (👍) = Approve system command; Thumbs-Down (👎) = Reject command; Closed Fist (✊) = Mute audio / Dismiss modal. Use get_gesture_controller_status or trigger_gesture_action when asked about gesture control.\n" +
    "When asked to shutdown or restart the PC, state that you've submitted the action for confirmation. " +
    "When asked to lock the screen, sleep, launch software, open a website, play music, or run safe commands, execute them directly.\n" +
    "When asked to push code, commit changes, or manage git, use run_system_command to execute git commands directly. When asked to create a new remote repository or issue, use the github_create_repo or github_create_issue tools.\n" +
    `Today's date is ${todayISO()} (timezone ${tz}). Resolve relative dates against this date.`
  );
}

// Tools that take real time (web/network/image gen/permission)
const SLOW_TOOLS = new Set(["github_list_repos", "github_get_notifications", "research_web", "get_live_news", "get_weather", "play_youtube", "generate_image", "create_diagram", "draft_content", "create_content_draft", "launch_software", "open_browser", "power_control", "run_system_command", "capture_screen", "recall_memory", "search_context_database", "get_briefing", "lock_cooper", "open_biometric_portal", "barehands_present", "barehands_add_card", "barehands_clear_board", "brainstorm_topic", "godseye_launch", "godseye_orbit", "godseye_scan_airspace", "godseye_iss_tracker", "record_project_demo", "run_project", "take_screenshot", "start_screen_recording", "run_browser_task", "lookup_scientific_papers"]);

function ackForCalls(calls) {
  const names = calls.map((c) => c.function?.name);
  if (names.includes("lookup_scientific_papers")) return "Searching global scholarly literature databases for you.";
  if (names.includes("godseye_launch")) return "Booting God's Eye View orbital reconnaissance console.";
  if (names.includes("godseye_orbit")) return "Aligning orbital spy-satellite camera onto coordinates.";
  if (names.includes("godseye_set_optics")) return "Switching satellite sensor optics.";
  if (names.includes("godseye_toggle_layer")) return "Toggling intelligence layer on planetary globe.";
  if (names.includes("godseye_scan_airspace")) return "Scanning regional airspace vectors via ADS-B.";
  if (names.includes("godseye_iss_tracker")) return "Calculating International Space Station orbital pass.";
  if (names.includes("ironhands_explode_model")) return "Deconstructing Arc Reactor components for inspection.";
  if (names.includes("ironhands_transform")) return "Manipulating 3D holographic model in spatial viewport.";
  if (names.includes("ironhands_set_target")) return "Targeting holographic model for spatial manipulation.";
  if (names.includes("ironhands_reset_transform")) return "Resetting 3D holographic model to home alignment.";
  if (names.includes("brainstorm_topic")) return "Brainstorming that topic on the spatial canvas for you.";
  if (names.includes("open_brainstorm_canvas")) return "Opening the Jarvis Flow mind-mapping canvas.";
  if (names.includes("get_brainstorm_tree")) return "Retrieving active brainstorm mind-map.";
  if (names.includes("sound_effect")) return "Synthesizing audio cue.";
  if (names.includes("set_hud_mode")) return "Adjusting HUD holographic display mode.";
  if (names.includes("set_arc_reactor_power")) return "Modulating Arc Reactor power levels.";
  if (names.includes("barehands_present")) return "Presenting that on the holographic glass board for you.";
  if (names.includes("barehands_add_card")) return "Adding that card to the holographic glass board.";
  if (names.includes("barehands_clear_board")) return "Clearing the holographic glass board.";
  if (names.includes("lock_cooper")) return "Locking Cooper systems and engaging biometric visor.";
  if (names.includes("open_biometric_portal")) return "Opening biometric enrollment portal.";
  if (names.includes("get_security_status")) return "Checking biometric security status.";
  if (names.includes("list_enrolled_operators")) return "Retrieving enrolled operator profiles.";
  if (names.includes("play_youtube")) return "Playing that on YouTube for you.";
  if (names.includes("get_weather")) return "Checking current weather.";
  if (names.includes("get_live_news")) return "Fetching latest news.";
  if (names.includes("power_control")) return "Executing power command.";
  if (names.includes("generate_image")) return "On it — generating that image now. Give me a few moments.";
  if (names.includes("create_content_draft")) return "On it — researching and drafting your post. Give me a moment.";
  if (names.includes("research_web")) return "Let me look that up on the web — give me a moment.";
  if (names.includes("launch_software")) return "Launching software now.";
  if (names.includes("open_browser")) return "Opening website in browser.";
  if (names.includes("run_browser_task")) return "Engaging autonomous browser agent to execute task in Chrome.";
  if (names.includes("run_system_command")) return "Executing command.";
  if (names.includes("capture_screen")) return "Looking at your screen now.";
  if (names.includes("recall_memory")) return "Searching my memory.";
  if (names.includes("store_memory")) return "Storing that in my memory graph.";
  if (names.includes("search_context_database")) return "Searching the context database.";
  if (names.includes("get_memory_status")) return "Checking cognitive memory status.";
  if (names.includes("get_speech_engine_status")) return "Checking voice synthesis engine.";
  if (names.includes("create_diagram")) return "Drafting editorial vector diagram.";
  if (names.includes("get_briefing")) return "Generating your briefing.";
  if (names.includes("list_projects")) return "Scanning your projects.";
  if (names.includes("git_status")) return "Checking git status.";
  if (names.includes("open_project")) return "Opening project.";
  if (names.includes("run_project")) return "Booting up the project now.";
  if (names.includes("stop_project")) return "Shutting down the project.";
  if (names.includes("take_screenshot")) return "Taking a screenshot.";
  if (names.includes("start_screen_recording")) return "Starting screen recording.";
  if (names.includes("stop_screen_recording")) return "Stopping screen recording.";
  if (names.includes("record_project_demo")) return "Running project and recording a demo video for social media.";
  if (names.includes("analyze_spending")) return "Analyzing your finances.";
  if (names.includes("github_list_repos")) return "Fetching your GitHub repositories.";
  if (names.includes("github_get_notifications")) return "Checking your GitHub notifications.";
  if (names.includes("github_create_repo")) return "Creating new GitHub repository.";
  if (names.includes("github_create_issue")) return "Creating GitHub issue.";
  return "Working on that — one moment.";
}

// ── Date helpers (configured timezone) ───────────────────────────
function todayISO() {
  const tz = getSetting("timezone") || "Asia/Karachi";
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}
function rangeDates(range) {
  const today = todayISO();
  const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  if (range === "today") return { from: today, to: today };
  if (range === "week") return { from: shift(today, -6), to: today };
  if (range === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: `${today.slice(0, 7)}-01`, to: today }; // month default
}

// ── Tool schemas (OpenAI function-calling format) ────────────────
const TOOLS = [
  {
    type: "function", function: {
      name: "get_expenses",
      description: "Get the user's income vs expense totals and category breakdown for a date range.",
      parameters: { type: "object", properties: { range: { type: "string", enum: ["today", "week", "month", "year"] } }, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "get_recent_mail",
      description: "Get the user's latest real-time emails live from Gmail (sender, subject, date, snippet, body).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max messages to return (default 8, max 25)." },
          days: { type: "number", description: "Number of past days to check (default 7)." },
          query: { type: "string", description: "Optional filter query (e.g. 'is:unread', 'from:google')." }
        },
        required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "search_emails",
      description: "Search the user's Gmail live by query, sender, subject, or keyword (e.g. 'is:unread', 'from:john', 'invoice', 'flight'). Returns matching email details and body.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or keyword." },
          limit: { type: "number", description: "Max messages to return (default 8, max 25)." },
          days: { type: "number", description: "Days window (default 30)." }
        },
        required: ["query"]
      },
    }
  },
  {
    type: "function", function: {
      name: "get_tasks",
      description: "List today's tasks and their status.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "add_task",
      description: "Add a to-do task. Use an ISO date (YYYY-MM-DD) for due_date; omit to mean today.",
      parameters: { type: "object", properties: { title: { type: "string" }, due_date: { type: "string" } }, required: ["title"] },
    }
  },
  {
    type: "function", function: {
      name: "complete_task",
      description: "Mark a to-do task done / check it off (or reopen it). Match by the task's title.",
      parameters: {
        type: "object", properties: {
          title: { type: "string", description: "Title (or part of it) of the task to update." },
          done: { type: "boolean", description: "true = mark done (default), false = reopen." },
        }, required: ["title"]
      },
    }
  },
  {
    type: "function", function: {
      name: "research_web",
      description: "Research a topic on the live web (Perplexity). Returns titles, summaries, and source URLs.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    }
  },
  {
    type: "function", function: {
      name: "generate_image",
      description: "Generate an image from a prompt in the given aspect ratio.",
      parameters: { type: "object", properties: { prompt: { type: "string" }, aspect_ratio: { type: "string", enum: ["1:1", "4:5", "3:4", "9:16", "4:3", "16:9"] } }, required: ["prompt"] },
    }
  },
  {
    type: "function", function: {
      name: "draft_content",
      description: "Draft a short social media caption about a topic and return the text (does NOT save it).",
      parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] },
    }
  },
  {
    type: "function", function: {
      name: "create_content_draft",
      description: "Research a topic and create a SAVED social media post draft in the Studio, ready to edit/schedule.",
      parameters: {
        type: "object", properties: {
          topic: { type: "string" },
          research: { type: "boolean", description: "Pull live web facts to ground the post. Default true." },
        }, required: ["topic"]
      },
    }
  },
  {
    type: "function", function: {
      name: "get_connected_accounts",
      description: "Get the user's connected social media accounts (LinkedIn) including name, profile info, and status.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "open_browser",
      description: "Open a website or URL in the default web browser on the system.",
      parameters: {
        type: "object", properties: {
          url: { type: "string", description: "The website URL to open (e.g., https://youtube.com or google.com)" },
          reason: { type: "string", description: "Short reason for opening the page" },
        }, required: ["url"]
      },
    }
  },
  {
    type: "function", function: {
      name: "run_browser_task",
      description: "Autonomously control Chrome browser using AI agent (browser-use) to perform web tasks: click buttons, change tabs, fill forms, navigate pages, interact with local running web apps (e.g. trading bot dashboard), or perform complex browser workflows.",
      parameters: {
        type: "object", properties: {
          prompt: { type: "string", description: "Clear instruction for what to do in the browser (e.g., 'Go to localhost:5173, click the analytics tab, and switch to 1h chart')" },
          url: { type: "string", description: "Optional starting URL (e.g. 'http://localhost:5173' or 'https://github.com')" },
          browser: { type: "string", enum: ["chrome", "chromium"], description: "Browser to drive: 'chrome' (existing Chrome) or 'chromium' (fresh automated browser)" },
          duration_seconds: { type: "number", description: "Optional duration in seconds to interact with or explore features" },
        }, required: ["prompt"]
      },
    }
  },
  {
    type: "function", function: {
      name: "launch_software",
      description: "Launch or open an installed application/software on the system (e.g., Chrome, VS Code, Calculator, Spotify, Notepad).",
      parameters: {
        type: "object", properties: {
          app_name: { type: "string", description: "Name of the application or executable to launch" },
          reason: { type: "string", description: "Short explanation of why the app is being launched" },
        }, required: ["app_name"]
      },
    }
  },
  {
    type: "function", function: {
      name: "power_control",
      description: "Control computer power actions on Windows: shutdown the PC, restart/reboot, sleep/hibernate, lock screen, or abort/cancel a scheduled shutdown.",
      parameters: {
        type: "object", properties: {
          action: { type: "string", enum: ["shutdown", "restart", "sleep", "lock", "abort"], description: "The power action to perform" },
          delay_seconds: { type: "number", description: "Delay in seconds before shutdown or restart (default 5)" },
          reason: { type: "string", description: "Reason for the action" },
        }, required: ["action"]
      },
    }
  },
  {
    type: "function", function: {
      name: "run_system_command",
      description: "Execute a safe system command or shell operation on the machine.",
      parameters: {
        type: "object", properties: {
          command: { type: "string", description: "The shell command to execute" },
          reason: { type: "string", description: "Brief explanation of the command" },
        }, required: ["command"]
      },
    }
  },
  {
    type: "function", function: {
      name: "get_live_news",
      description: "Fetch live news headlines or search current breaking news by topic or category using NewsAPI and live web.",
      parameters: {
        type: "object", properties: {
          topic: { type: "string", description: "Topic, keyword, or region to search news for (e.g., 'AI', 'technology', 'Pakistan', 'crypto'). Omit for top headlines." },
          category: { type: "string", enum: ["general", "technology", "business", "science", "health", "sports", "entertainment"], description: "News category" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "get_weather",
      description: "Get real-time live weather conditions, temperature, humidity, wind, and forecast for any city or location.",
      parameters: {
        type: "object", properties: {
          location: { type: "string", description: "City or location name (e.g., 'Peshawar', 'London', 'Karachi', 'New York'). Omit for default location." },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "play_youtube",
      description: "Search and play a song, music video, artist, audio track, or podcast on YouTube in the browser. Always call this when asked to play music or YouTube songs.",
      parameters: {
        type: "object", properties: {
          query: { type: "string", description: "The song title, music artist, or video query (e.g., 'Starboy The Weeknd', 'Shape of You Ed Sheeran', 'Coke Studio Pasoori')" },
        }, required: ["query"]
      },
    }
  },
  {
    type: "function", function: {
      name: "toggle_system_mode",
      description: "Turn System Automation Mode ON or OFF.",
      parameters: {
        type: "object", properties: {
          enabled: { type: "boolean", description: "true to enable system access mode, false to disable" },
        }, required: ["enabled"]
      },
    }
  },
  // ── Agentic OS v2 Tools ──────────────────────────────────────
  {
    type: "function", function: {
      name: "recall_memory",
      description: "Search Cooper's long-term memory for past conversations, research, drafts, or notes. Use when the user asks 'what was that thing about X' or 'do you remember'.",
      parameters: {
        type: "object", properties: {
          query: { type: "string", description: "What to search for in memory" },
          type: { type: "string", enum: ["chat", "research", "draft", "note"], description: "Filter by memory type" },
        }, required: ["query"]
      },
    }
  },
  {
    type: "function", function: {
      name: "store_memory",
      description: "Save an important fact, user preference, conversation note, project decision, or concept directly into Cooper's long-term AgentMemory knowledge graph.",
      parameters: {
        type: "object", properties: {
          content: { type: "string", description: "The fact, note, or information to remember" },
          type: { type: "string", enum: ["chat", "research", "draft", "note"], description: "Type of memory (default: note)" },
          concepts: { type: "array", items: { type: "string" }, description: "Key conceptual tags or entity names to link in the knowledge graph (e.g. ['cooper', 'trading', 'crypto'])" },
          project: { type: "string", description: "Optional project name to associate with this memory" },
        }, required: ["content"]
      },
    }
  },
  {
    type: "function", function: {
      name: "get_memory_status",
      description: "Check the status of Cooper's unified cognitive memory subsystem across Tier 1 (AgentMemory :3111), Tier 2 (OpenViking :1933 / viking://), and Tier 3 (Local SQLite fallback).",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "search_context_database",
      description: "Query OpenViking's virtual filesystem (viking://) for repository context, architectural specifications, and documentation with progressive L0/L1/L2 retrieval.",
      parameters: {
        type: "object", properties: {
          query: { type: "string", description: "Search query or concept to find across repositories and documentation" },
          targetUri: { type: "string", description: "Optional scoped URI (e.g., 'viking://repos/diagram-design')" },
          tier: { type: "string", enum: ["l0", "l1", "l2", "auto"], description: "Progressive context tier: l0 (abstract), l1 (overview), l2 (full)" },
          limit: { type: "number", description: "Max results to return (default: 5)" },
        }, required: ["query"]
      },
    }
  },
  {
    type: "function", function: {
      name: "get_speech_engine_status",
      description: "Check the status of Cooper's speech synthesis and transcription engines across Tier 1 VoiceStudio (:3900), Tier 2 Google Cloud TTS, and Tier 3 cloud Whisper.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "create_diagram",
      description: "Generate an editorial vector diagram (architecture, flowchart, layers, pipeline) using Cooper's 4px grid design engine. Outputs standalone SVG and interactive HTML.",
      parameters: {
        type: "object", properties: {
          title: { type: "string", description: "Title of the diagram" },
          subtitle: { type: "string", description: "Subtitle or description" },
          type: { type: "string", enum: ["architecture", "flowchart", "layers", "process", "stack"], description: "Type of diagram (default: architecture)" },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                subtitle: { type: "string" },
                role: { type: "string" },
                accent: { type: "boolean" },
                tag: { type: "string" },
              },
              required: ["label"],
            },
            description: "Components, services, or stages in the diagram",
          },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                label: { type: "string" },
                dashed: { type: "boolean" },
              },
              required: ["from", "to"],
            },
            description: "Directional arrows between nodes",
          },
          theme: { type: "string", enum: ["cooper-stark", "editorial-dark", "editorial-light"], description: "Design theme (default: cooper-stark)" },
          projectOnStage: { type: "boolean", description: "Project immediately onto Bare Hands holographic stage (default: true)" },
        }, required: ["title"]
      },
    }
  },
  {
    type: "function", function: {
      name: "capture_screen",
      description: "Take a screenshot of the user's screen and analyze it with vision AI. Use when asked to look at the screen, identify errors, or see what's happening on the desktop.",
      parameters: {
        type: "object", properties: {
          question: { type: "string", description: "What to look for or analyze in the screenshot (e.g., 'is there an error?', 'what app is open?')" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "list_projects",
      description: "List all git repositories and projects in the user's projects directory.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "git_status",
      description: "Check git status for a specific project — branch, uncommitted changes, and last commit.",
      parameters: {
        type: "object", properties: {
          project: { type: "string", description: "Project folder name (e.g., 'agentic-os-personal', 'GhostForge')" },
        }, required: ["project"]
      },
    }
  },
  {
    type: "function", function: {
      name: "open_project",
      description: "Open a project in VS Code.",
      parameters: {
        type: "object", properties: {
          project: { type: "string", description: "Project folder name to open in VS Code" },
        }, required: ["project"]
      },
    }
  },
  {
    type: "function", function: {
      name: "run_project",
      description: "Start running a local project (e.g. npm run dev, uvicorn). Automatically detects and opens the app.",
      parameters: {
        type: "object", properties: {
          project: { type: "string", description: "Project folder name (e.g. 'trading bot', 'content-os')" },
        }, required: ["project"]
      },
    }
  },
  {
    type: "function", function: {
      name: "stop_project",
      description: "Stop a running local project.",
      parameters: {
        type: "object", properties: {
          project: { type: "string", description: "Project folder name" },
        }, required: ["project"]
      },
    }
  },
  {
    type: "function", function: {
      name: "take_screenshot",
      description: "Take a persistent screenshot and save it to the media gallery.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "start_screen_recording",
      description: "Start recording the screen/desktop to a video file.",
      parameters: {
        type: "object", properties: {
          max_duration_seconds: { type: "number", description: "Auto-stop safeguard time. Default 600s." },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "stop_screen_recording",
      description: "Stop the ongoing screen recording and save the video.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "record_project_demo",
      description: "Autonomously run a project, record a demo video of it, and draft a LinkedIn post. Use this when asked to make a video demo of a project.",
      parameters: {
        type: "object", properties: {
          project: { type: "string", description: "Project folder name" },
          duration_seconds: { type: "number", description: "Length of the demo in seconds (default 20)" },
        }, required: ["project"]
      },
    }
  },
  {
    type: "function", function: {
      name: "analyze_spending",
      description: "Analyze the user's spending patterns, burn rate, and detect anomalies over a period.",
      parameters: {
        type: "object", properties: {
          range: { type: "string", enum: ["week", "month", "year"], description: "Time range to analyze" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "get_briefing",
      description: "Get the proactive morning or evening briefing (weather, tasks, news, finances summary).",
      parameters: {
        type: "object", properties: {
          type: { type: "string", enum: ["morning", "evening"], description: "Briefing type. Default is morning." },
        }, required: []
      },
    }
  },
  // ── Biometrics & Security Agent Tools (MediaPipe) ────────────
  {
    type: "function", function: {
      name: "lock_cooper",
      description: "Lock Cooper OS and activate the biometric face recognition visor lock screen on the HUD.",
      parameters: {
        type: "object", properties: {
          reason: { type: "string", description: "Reason for locking Cooper" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "get_security_status",
      description: "Get current biometric lock state, active authenticated operator, and enrolled user count.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "list_enrolled_operators",
      description: "List all operators enrolled in Cooper's local facial recognition database with their roles.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "open_biometric_portal",
      description: "Open the Biometric Enrollment modal on Cooper's HUD to enroll an operator or manage facial profiles.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  // ── Spatial Holographic Stage Tools (barehands) ───────────────
  {
    type: "function", function: {
      name: "barehands_present",
      description: "Present content, plans, or briefings center-stage on the spatial AR holographic glass board.",
      parameters: {
        type: "object", properties: {
          title: { type: "string", description: "Title of the holographic card" },
          body: { type: "string", description: "Content or body text to display on the glass board" },
        }, required: ["title", "body"]
      },
    }
  },
  {
    type: "function", function: {
      name: "barehands_add_card",
      description: "Add a floating card or note to the spatial AR holographic glass board.",
      parameters: {
        type: "object", properties: {
          title: { type: "string", description: "Title of the note card" },
          body: { type: "string", description: "Body text of the note card" },
        }, required: ["title", "body"]
      },
    }
  },
  {
    type: "function", function: {
      name: "barehands_clear_board",
      description: "Clear and reset all cards from the spatial holographic glass board.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "barehands_get_board_state",
      description: "Inspect the current cards and objects floating on the spatial holographic glass board.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  // ── Stark HUD & Sound Engine Tools (Jarvis-CV) ────────────────
  {
    type: "function", function: {
      name: "sound_effect",
      description: "Play a real-time procedural Stark-Tech audio cue on Cooper's HUD via the Web Audio synthesizer. Supported cues: engage, select, hover, error, repulsor, scan, lock, unlock, pulse.",
      parameters: {
        type: "object", properties: {
          cue: { type: "string", enum: ["engage", "select", "hover", "error", "repulsor", "scan", "lock", "unlock", "pulse"], description: "The sci-fi audio cue to play" },
        }, required: ["cue"]
      },
    }
  },
  {
    type: "function", function: {
      name: "set_hud_mode",
      description: "Switch Cooper's 3D HUD centerpiece between the tactical rotating Wireframe Globe and the 3D Arc Reactor core.",
      parameters: {
        type: "object", properties: {
          mode: { type: "string", enum: ["globe", "arc_reactor"], description: "The HUD display mode to engage" },
        }, required: ["mode"]
      },
    }
  },
  {
    type: "function", function: {
      name: "set_arc_reactor_power",
      description: "Adjust the energy output percentage of the 3D Arc Reactor core (0 to 100%).",
      parameters: {
        type: "object", properties: {
          power: { type: "number", description: "Power level percentage (0 to 100)" },
        }, required: ["power"]
      },
    }
  },
  // ── JarvisFlow Gesture Mind-Mapping Tools ─────────────────────
  {
    type: "function", function: {
      name: "brainstorm_topic",
      description: "Decompose any topic, technical concept, or project roadmap into an interactive 4-quadrant mind map (Root + Up/Right/Down/Left directions + subpages) attached to fingertips on the gesture canvas.",
      parameters: {
        type: "object", properties: {
          topic: { type: "string", description: "The core concept, problem, or project to brainstorm" },
        }, required: ["topic"]
      },
    }
  },
  {
    type: "function", function: {
      name: "open_brainstorm_canvas",
      description: "Launch the fullscreen JarvisFlow gesture mind-mapping stage on the HUD.",
      parameters: {
        type: "object", properties: {
          topic: { type: "string", description: "Optional topic to brainstorm immediately" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "get_brainstorm_tree",
      description: "Retrieve the current active brainstorm mind-map tree with its directional branches.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  // ── IronHands 3D Spatial Kinetic Manipulation Tools ──────────
  {
    type: "function", function: {
      name: "ironhands_transform",
      description: "Rotate, scale, or translate the active 3D holographic model (arc_reactor or globe) in 3D space.",
      parameters: {
        type: "object", properties: {
          target: { type: "string", enum: ["arc_reactor", "globe"], description: "Model to manipulate" },
          scale: { type: "number", description: "Zoom / scale multiplier (e.g. 0.5 to 3.0)" },
          rotX: { type: "number", description: "Pitch rotation angle in radians" },
          rotY: { type: "number", description: "Yaw rotation angle in radians" },
          rotZ: { type: "number", description: "Roll rotation angle in radians" },
          x: { type: "number", description: "Pan X horizontal translation" },
          y: { type: "number", description: "Pan Y vertical translation" },
          z: { type: "number", description: "Depth Z translation" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "ironhands_set_target",
      description: "Switch the active 3D manipulation target between arc_reactor and globe.",
      parameters: {
        type: "object", properties: {
          target: { type: "string", enum: ["arc_reactor", "globe"], description: "The 3D model to target" },
        }, required: ["target"]
      },
    }
  },
  {
    type: "function", function: {
      name: "ironhands_explode_model",
      description: "Deconstruct or explode the holographic Arc Reactor components radially and axially in 3D space for component inspection (Tony Stark lab style).",
      parameters: {
        type: "object", properties: {
          target: { type: "string", enum: ["arc_reactor", "globe"], description: "Target model" },
          factor: { type: "number", description: "Explode factor from 0.0 (assembled) to 1.0 (fully disassembled)" },
        }, required: ["factor"]
      },
    }
  },
  {
    type: "function", function: {
      name: "ironhands_reset_transform",
      description: "Reset the 3D holographic model orientation, scale, pan, and explode factor back to resting defaults.",
      parameters: {
        type: "object", properties: {
          target: { type: "string", enum: ["arc_reactor", "globe"], description: "Target model to reset" },
        }, required: []
      },
    }
  },
  // ── God's Eye View Geospatial Intelligence Tools ─────────────
  {
    type: "function", function: {
      name: "godseye_launch",
      description: "Launch or open the God's Eye View 3D spy-satellite Earth console on Cooper's HUD.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "godseye_orbit",
      description: "Fly and orbit the satellite camera to any target location, city, mountain, or landmark worldwide.",
      parameters: {
        type: "object", properties: {
          location: { type: "string", description: "City, country, or landmark name (e.g. Islamabad, Peshawar, Tokyo, New York, Alps)" },
          altitude: { type: "number", description: "Camera altitude in meters (e.g. 5000 to 50000)" },
          pitch: { type: "number", description: "Camera pitch angle in degrees (e.g. -25 to -45)" },
        }, required: ["location"]
      },
    }
  },
  {
    type: "function", function: {
      name: "godseye_set_optics",
      description: "Switch real-time satellite sensor shader optics (FLIR thermal, NVG night vision, CRT scanlines, noir, or normal).",
      parameters: {
        type: "object", properties: {
          mode: { type: "string", enum: ["normal", "thermal", "night_vision", "crt", "noir"], description: "Optics shader mode" },
        }, required: ["mode"]
      },
    }
  },
  {
    type: "function", function: {
      name: "godseye_toggle_layer",
      description: "Toggle an intelligence layer on the 3D planetary globe (commercial flights, military flights, satellites, earthquakes, cables, weather).",
      parameters: {
        type: "object", properties: {
          layer: { type: "string", enum: ["flights", "militaryFlights", "satellites", "earthquakes", "cables", "weather"], description: "Layer to toggle" },
          enabled: { type: "boolean", description: "True to enable, false to disable" },
        }, required: ["layer"]
      },
    }
  },
  {
    type: "function", function: {
      name: "godseye_scan_airspace",
      description: "Scan real-time commercial or military aircraft in any region via keyless ADS-B telemetry.",
      parameters: {
        type: "object", properties: {
          lat: { type: "number", description: "Latitude center point" },
          lon: { type: "number", description: "Longitude center point" },
          militaryOnly: { type: "boolean", description: "True to filter for military flights only" },
        }, required: []
      },
    }
  },
  {
    type: "function", function: {
      name: "godseye_iss_tracker",
      description: "Retrieve the current orbital telemetry and coordinates of the International Space Station (ISS).",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "github_list_repos",
      description: "List the recent repositories for the connected GitHub account.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "github_get_notifications",
      description: "Retrieve the latest notifications for the connected GitHub account.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "github_create_repo",
      description: "Create a new GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the repository" },
          description: { type: "string", description: "Description of the repository" },
          is_private: { type: "boolean", description: "Whether the repo is private" },
        },
        required: ["name"]
      },
    }
  },
  {
    type: "function", function: {
      name: "github_create_issue",
      description: "Create an issue in a specific GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          repo_full_name: { type: "string", description: "Full name of the repo (e.g. username/repo)" },
          title: { type: "string", description: "Title of the issue" },
          body: { type: "string", description: "Body/description of the issue" },
        },
        required: ["repo_full_name", "title"]
      },
    }
  },
  // ── Unified Hand Gesture Control Tools ─────────────────────────
  {
    type: "function", function: {
      name: "get_gesture_controller_status",
      description: "Get the real-time operational status of Cooper's computer vision hand gesture tracking, Air Mouse, and action mappings.",
      parameters: { type: "object", properties: {}, required: [] },
    }
  },
  {
    type: "function", function: {
      name: "trigger_gesture_action",
      description: "Programmatically trigger or simulate a hand gesture action (e.g. APPROVE, DENY, VOLUME_UP, VOLUME_DOWN, VOLUME_MUTE, VOICE_WAKE, DISMISS, BRIEFING).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["APPROVE", "DENY", "VOLUME_UP", "VOLUME_DOWN", "VOLUME_MUTE", "VOICE_WAKE", "DISMISS", "BRIEFING"],
            description: "Gesture action to trigger"
          }
        },
        required: ["action"]
      },
    }
  },
  // ── Scientific & Scholarly Intelligence Tools ──────────────────
  {
    type: "function", function: {
      name: "lookup_scientific_papers",
      description: "Search 250M+ scientific and scholarly research papers across OpenAlex, arXiv, and Europe PMC. Returns peer-reviewed findings, abstracts, citations, DOIs, and open-access PDF links, auto-committing the top finding to Cooper's Dual-Engine Cognitive Memory.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Scientific or research query (e.g. 'transformers in protein folding', 'crispr dCas9 epigenome editing', 'autonomous agent architecture')" },
          database: { type: "string", enum: ["all", "openalex", "arxiv"], description: "Scholarly database to query (defaults to 'all')" },
          limit: { type: "number", description: "Maximum number of papers to retrieve (1 to 10, defaults to 5)" }
        },
        required: ["query"]
      },
    }
  },
  // ── Language Settings Tool ─────────────────────────────────────
  {
    type: "function", function: {
      name: "set_assistant_language",
      description: "Permanently switch Cooper's conversational response language (e.g. 'Urdu', 'English', 'Spanish'). Persists across all future conversations until changed.",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string", description: "Language name (e.g. 'Urdu', 'English', 'Spanish', 'French', 'Hindi', 'German')" }
        },
        required: ["language"]
      }
    }
  },
];

// ── Tool executors ───────────────────────────────────────────────
const generatedImages = [];
const createdDrafts = [];
const pendingRequests = [];

export async function runTool(name, args) {
  switch (name) {
    case "github_list_repos":
      return await listGithubRepos();
    case "github_get_notifications":
      return await getGithubNotifications();
    case "github_create_repo":
      return await githubCreateRepo(args);
    case "github_create_issue":
      return await githubCreateIssue(args);
    case "get_connected_accounts": {
      const accounts = listAccounts();
      if (!accounts.length) {
        return { connected_count: 0, accounts: [], message: "No social media accounts connected yet." };
      }
      return {
        connected_count: accounts.length,
        accounts: accounts.map((a) => ({
          platform: a.platform,
          display_name: a.display_name || a.username || "Connected User",
          username: a.username,
          is_active: Boolean(a.is_active),
          auth_type: a.auth_type || "direct",
          direct_api_free: true,
          connected_at: a.connected_at,
        })),
      };
    }
    case "get_expenses": {
      const { from, to } = rangeDates(args.range || "month");
      const totals = revenueVsExpense({ from, to });
      return {
        range: args.range || "month", from, to,
        income: totals.income, expense: totals.expense, net: totals.income - totals.expense,
        topExpenseCategories: sumByCategory({ from, to, type: "expense" }).slice(0, 6),
        recent: listTransactions({ from, to, limit: 8 }),
      };
    }
    case "get_recent_mail": {
      const limit = Math.min(args.limit || 8, 25);
      const tokens = getGmailTokens();
      if (tokens?.refresh_token) {
        try {
          const fresh = await fetchRecentMessages({
            days: args.days || 7,
            maxResults: limit,
            query: args.query,
            withBody: true,
          });
          for (const m of fresh) upsertMailMessage(m);
          if (fresh.length > 0) {
            return fresh.map((m) => ({
              id: m.id,
              from: m.from_name ? `${m.from_name} <${m.from_addr}>` : (m.from_addr || "Unknown"),
              subject: m.subject || "(No subject)",
              date: m.internal_date ? new Date(m.internal_date).toLocaleString() : "Recent",
              snippet: m.snippet,
              body: m.body ? m.body.slice(0, 800) : m.snippet,
              unread: (m.labels || []).includes("UNREAD"),
            }));
          }
        } catch (err) {
          console.warn("[Assistant] Live Gmail fetch failed, falling back to local DB:", err.message);
        }
      }
      return listMailMessages({ limit })
        .map((m) => ({
          id: m.id,
          from: m.from_name ? `${m.from_name} <${m.from_addr}>` : (m.from_addr || "Unknown"),
          subject: m.subject || "(No subject)",
          date: m.internal_date ? new Date(m.internal_date).toLocaleString() : "Cached",
          snippet: m.snippet,
        }));
    }
    case "search_emails": {
      const q = String(args.query || "").trim();
      if (!q) return { error: "query parameter is required." };
      const tokens = getGmailTokens();
      if (!tokens?.refresh_token) {
        return { error: "Gmail is not connected. Please connect Gmail in Settings." };
      }
      try {
        const msgs = await fetchRecentMessages({
          days: args.days || 30,
          maxResults: Math.min(args.limit || 8, 25),
          query: q,
          withBody: true,
        });
        for (const m of msgs) upsertMailMessage(m);
        return msgs.map((m) => ({
          id: m.id,
          from: m.from_name ? `${m.from_name} <${m.from_addr}>` : (m.from_addr || "Unknown"),
          subject: m.subject || "(No subject)",
          date: m.internal_date ? new Date(m.internal_date).toLocaleString() : "Recent",
          snippet: m.snippet,
          body: m.body ? m.body.slice(0, 1000) : m.snippet,
          unread: (m.labels || []).includes("UNREAD"),
        }));
      } catch (err) {
        return { error: `Failed to search Gmail: ${err.message}` };
      }
    }
    case "get_tasks":
      return listTasks({ dueDate: todayISO() }).map((t) => ({ id: t.id, title: t.title, status: t.status }));
    case "add_task": {
      const t = createTask({ title: args.title, due_date: args.due_date || todayISO() });
      return { added: true, title: t.title, due_date: t.due_date };
    }
    case "complete_task": {
      const tasks = listTasks({ dueDate: todayISO() });
      const q = String(args.title || "").trim().toLowerCase();
      const target =
        (args.id && tasks.find((t) => t.id === args.id)) ||
        tasks.find((t) => t.title.toLowerCase() === q) ||
        tasks.find((t) => t.title.toLowerCase().includes(q)) ||
        (q && tasks.find((t) => q.includes(t.title.toLowerCase())));
      if (!target) return { completed: false, error: `No task today matching "${args.title}".` };
      const status = args.done === false ? "open" : "done";
      updateTask(target.id, { status });
      return { completed: status === "done", reopened: status === "open", title: target.title, status };
    }
    case "research_web":
      return (await researchWeb(args.query, { count: 5 })).map((i) => ({ title: i.title, summary: i.summary, url: i.url }));
    case "generate_image": {
      const path = await generateImageV2(args.prompt, { aspectRatio: args.aspect_ratio || "1:1", model: imageContentModel() });
      generatedImages.push(path);
      return { generated: true, imagePath: path };
    }
    case "draft_content": {
      const draft = await chat([
        { role: "system", content: "You are a social copywriter. Write one concise, ready-to-post caption. No preamble." },
        { role: "user", content: `Write a social post about: ${args.topic}` },
      ]);
      return { draft: draft.trim() };
    }
    case "create_content_draft": {
      const topic = String(args.topic || "").trim();
      let factNote = "";
      if (args.research !== false) {
        try {
          const found = await researchWeb(topic, { count: 4 });
          if (found.length) {
            factNote = "\n\nGround the post in these real, current facts (cite the most relevant source URL):\n" +
              found.map((f) => `- ${f.title}: ${f.summary} (${f.url})`).join("\n");
          }
        } catch { /* research is best-effort */ }
      }
      const caption = (await chat([
        {
          role: "system", content:
            `You are a social media copywriter. Brand voice: ${getSetting("brand_voice") || "clear, confident, concise"}. ` +
            "Write ONE ready-to-post caption grounded in the facts — accurate, specific, no invented claims. " +
            "End with the most relevant source URL on its own line. No preamble."
        },
        { role: "user", content: `Write a social post about: ${topic}${factNote}` },
      ])).trim();
      const draft = createDraft({ title: topic, caption });
      createdDrafts.push({ id: draft.id, title: draft.title });
      return { created: true, draftId: draft.id, title: draft.title, caption };
    }
    case "toggle_system_mode": {
      const enabled = Boolean(args.enabled);
      setSystemModeEnabled(enabled);
      return { success: true, system_mode: enabled ? "enabled" : "disabled" };
    }
    case "open_browser": {
      try {
        const res = await openBrowser(args.url);
        return { opened: true, url: res.url, message: res.message };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "run_browser_task": {
      try {
        const res = await runBrowserTask({
          prompt: args.prompt,
          url: args.url,
          browser: args.browser || "chromium",
          durationSeconds: args.duration_seconds,
        });
        if (!res.success) {
          return { error: res.error || "Browser task failed." };
        }
        return {
          success: true,
          task: args.prompt,
          result: res.result,
          steps: res.steps,
          duration_s: res.duration_s,
          memory_indexed: res.memory_indexed ?? false,
          openviking_uri: res.openviking_uri || null,
          message: "Browser agent completed the task successfully and indexed findings into cognitive memory.",
        };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "launch_software": {
      if (isSystemLocked()) return { error: "Biometric lock engaged. Please authenticate via facial recognition or PIN first." };
      try {
        const res = await launchSoftware(args.app_name);
        return { launched: true, app: res.app, message: res.message };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "power_control": {
      const act = String(args.action || "lock").toLowerCase();
      if (act === "lock") {
        lockSystem("Power control lock");
        return { success: true, action: "lock", message: "Cooper locked. Biometric visor scanner engaged." };
      }
      if (isSystemLocked()) return { error: "Biometric lock engaged. Please authenticate via facial recognition or PIN first." };
      const delay = Math.max(1, Number(args.delay_seconds) || 5);
      // High-risk power operations (shutdown, restart) require confirmation
      if (act === "shutdown" || act === "restart" || act === "poweroff" || act === "reboot") {
        const summary = (act === "shutdown" || act === "poweroff")
          ? `Shutdown PC in ${delay}s`
          : `Restart PC in ${delay}s`;
        const req = requestApproval("power_control", { action: act, delay_seconds: delay }, summary);
        pendingRequests.push(req);
        return {
          permission_required: true,
          approval_id: req.id,
          summary,
          message: `Confirmation required: ${summary}. Please confirm in the dashboard.`,
        };
      }
      // Safe power operations (sleep, abort) execute immediately
      try {
        const res = await powerControl(act, delay);
        return { success: true, action: act, message: res.message };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "run_system_command": {
      if (isSystemLocked()) return { error: "Biometric lock engaged. Please authenticate via facial recognition or PIN first." };
      const cmd = String(args.command || "").trim();

      const sandboxCheck = validateCommand(cmd);
      if (!sandboxCheck.safe) {
        return { error: `Command rejected by security sandbox: ${sandboxCheck.reason}` };
      }

      if (isHighRiskCommand(cmd)) {
        const summary = `Execute high-risk command/script: ${cmd}`;
        const req = requestApproval("run_system_command", { command: cmd }, summary);
        pendingRequests.push(req);
        return {
          permission_required: true,
          approval_id: req.id,
          summary,
          message: `Permission requested: ${summary}. Please confirm in the dashboard.`,
        };
      }
      try {
        const res = await runCommand(cmd);
        return { success: true, command: cmd, output: res.stdout || res.stderr || "Command executed successfully." };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "get_live_news": {
      try {
        const articles = await fetchLiveNews(args.topic, args.category);
        if (!articles || !articles.length) {
          return { found: false, message: `No recent news articles found for "${args.topic || "headlines"}".` };
        }
        return {
          found: true,
          count: articles.length,
          topic: args.topic || "top headlines",
          news: articles,
        };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "get_weather": {
      try {
        const report = await fetchWeather(args.location);
        return { success: true, weather: report };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "play_youtube": {
      try {
        const res = await playYouTube(args.query);
        return { success: true, query: args.query, url: res.url, message: `Playing "${args.query}" on YouTube in your browser.` };
      } catch (err) {
        return { error: err.message };
      }
    }
    // ── Agentic OS v2 Tool Executors ─────────────────────────────
    case "recall_memory": {
      try {
        const results = await recall(args.query, { type: args.type, limit: 5 });
        if (!results.length) {
          return { found: false, message: `No memories found matching "${args.query}".` };
        }
        return {
          found: true,
          count: results.length,
          memories: results.map((m) => ({
            text: m.text.slice(0, 300),
            type: m.type,
            similarity: m.similarity,
            when: m.created_at,
          })),
        };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "store_memory": {
      try {
        const mem = await remember(args.content, {
          type: args.type || "note",
          concepts: args.concepts || [],
          project: args.project || null,
          source: "user_instruction",
        });
        return {
          success: true,
          message: "Stored in long-term memory.",
          stored: {
            id: mem.id,
            type: mem.type,
            stored_in_agentmemory: mem.agentmemory_stored ?? false,
            agentmemory_id: mem.agentmemory_id || null,
            concepts: args.concepts || [],
          },
        };
      } catch (err) {
        return { error: `Failed to store memory: ${err.message}` };
      }
    }
    case "get_memory_status": {
      try {
        const unified = await getUnifiedMemoryStatus();
        return {
          success: true,
          mode: unified.mode,
          tiers: unified.tiers,
        };
      } catch (err) {
        return { error: `Failed to get memory status: ${err.message}` };
      }
    }
    case "search_context_database": {
      try {
        const results = await recall(args.query, {
          viking: true,
          targetUri: args.targetUri,
          limit: args.limit || 5,
        });
        if (!results.length) {
          return { found: false, message: `No context resources found matching "${args.query}".` };
        }
        return {
          found: true,
          count: results.length,
          results: results.map((r) => ({
            text: (r.text || "").slice(0, 400),
            source: r.source,
            uri: r.uri || "viking://",
            level: r.level ?? 0,
            similarity: r.similarity,
          })),
        };
      } catch (err) {
        return { error: `Failed to search context database: ${err.message}` };
      }
    }
    case "get_speech_engine_status": {
      try {
        const vsInfo = await getVoiceStudioInfo();
        return {
          success: true,
          voice_engine: vsInfo,
          active_pipeline: vsInfo.alive ? "Local VoiceStudio OmniVoice (:3900)" : "Google Cloud TTS + Groq Whisper",
        };
      } catch (err) {
        return { error: `Failed to get speech engine status: ${err.message}` };
      }
    }
    case "create_diagram": {
      try {
        const result = await generateDiagram({
          title: args.title,
          subtitle: args.subtitle,
          type: args.type || "architecture",
          nodes: args.nodes,
          links: args.links,
          theme: args.theme || "cooper-stark",
          projectOnStage: args.projectOnStage ?? true,
        });
        return {
          success: true,
          id: result.id,
          title: result.title,
          type: result.type,
          theme: result.theme,
          publicUrl: result.publicUrl,
          svgUrl: result.svgUrl,
          message: `Editorial vector diagram generated: ${result.title}. Available at ${result.publicUrl}`,
        };
      } catch (err) {
        return { error: `Failed to create diagram: ${err.message}` };
      }
    }
    case "capture_screen": {
      try {
        const result = await captureAndAnalyze(args.question);
        return {
          success: true,
          analysis: result.analysis,
          screenshot: result.screenshotPath,
        };
      } catch (err) {
        return { error: `Screen capture failed: ${err.message}` };
      }
    }
    case "list_projects": {
      const projects = listProjects();
      return {
        count: projects.length,
        projects: projects.map((p) => ({
          name: p.name,
          git: p.hasGit ? "yes" : "no",
        })),
      };
    }
    case "git_status": {
      const status = gitStatus(args.project);
      return status;
    }
    case "open_project": {
      const result = openProject(args.project);
      return result;
    }
    case "run_project": {
      try {
        const result = await runProject(args.project);
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "stop_project": {
      try {
        const result = stopProject(args.project);
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "take_screenshot": {
      try {
        const result = await captureScreenshot();
        return { success: true, message: "Screenshot saved", imagePath: result.relativePath };
      } catch (err) {
        return { error: err.message };
      }
    }
    case "start_screen_recording": {
      try {
        const result = startRecording({ maxDurationSeconds: args.max_duration_seconds });
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "stop_screen_recording": {
      try {
        const result = await stopRecording();
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "record_project_demo": {
      try {
        const result = await recordProjectDemo(args.project, args.duration_seconds || 20);
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "analyze_spending": {
      const { from, to } = rangeDates(args.range || "month");
      const totals = revenueVsExpense({ from, to });
      const categories = sumByCategory({ from, to, type: "expense" });
      const recent = listTransactions({ from, to, type: "expense", limit: 20 });
      // Calculate daily burn rate
      const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400_000));
      const dailyBurn = Math.round(totals.expense / days);
      // Find anomalies: transactions > 2x the average
      const avgTxn = recent.length ? totals.expense / recent.length : 0;
      const anomalies = recent.filter((t) => t.amount > avgTxn * 2);
      return {
        range: args.range || "month",
        from, to,
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        dailyBurn,
        daysAnalyzed: days,
        topCategories: categories.slice(0, 5),
        anomalies: anomalies.map((a) => ({ amount: a.amount, merchant: a.merchant, category: a.category, date: a.occurred_at })),
        insight: dailyBurn > 0
          ? `Daily burn rate: ${dailyBurn} PKR/day. ${anomalies.length ? `${anomalies.length} unusual transaction(s) detected.` : "No anomalies."}`
          : "No expenses recorded in this period.",
      };
    }
    case "get_briefing": {
      try {
        const briefing = await getOrGenerateBriefing(args.type || "morning");
        return {
          success: true,
          text: briefing.text,
          audio: briefing.audio_path || null,
          generated_at: briefing.created_at,
        };
      } catch (err) {
        return { error: `Briefing failed: ${err.message}` };
      }
    }
    // ── Biometrics & Security Agent Tool Executors (MediaPipe) ──
    case "lock_cooper": {
      const res = lockSystem(args.reason || "Operator requested lock");
      return { success: true, locked: true, message: "Cooper systems locked. Biometric visor scanner active." };
    }
    case "get_security_status": {
      const status = getAuthStatus();
      return {
        locked: status.locked,
        active_operator: status.currentUser ? status.currentUser.name : "None",
        role: status.currentUser ? status.currentUser.role : "None",
        enrolled_operators_count: status.userCount,
        auth_required: status.authRequired,
        last_unlocked: status.lastUnlockedAt || "None",
      };
    }
    case "list_enrolled_operators": {
      const ops = listEnrolledOperators();
      return {
        count: ops.length,
        operators: ops.map((o) => ({ id: o.id, name: o.name, role: o.role, enrolled_at: o.createdAt })),
      };
    }
    case "open_biometric_portal": {
      triggerOpenBiometricPortal();
      return { success: true, message: "Biometric face enrollment portal opened on the HUD." };
    }
    // ── Spatial Holographic Stage Tool Executors (barehands) ─────
    case "barehands_present": {
      const ok = await presentCard(args.title, args.body);
      return ok
        ? { success: true, presented: true, title: args.title, message: `Presented "${args.title}" on the holographic glass stage.` }
        : { success: false, error: "Failed to present card on Bare Hands stage. Ensure daemon can start." };
    }
    case "barehands_add_card": {
      const ok = await addCard(args.title, args.body);
      return ok
        ? { success: true, added: true, title: args.title, message: `Added card "${args.title}" to the holographic glass stage.` }
        : { success: false, error: "Failed to add card on Bare Hands stage." };
    }
    case "barehands_clear_board": {
      const ok = await resetBoard();
      return ok
        ? { success: true, cleared: true, message: "Holographic glass board cleared." }
        : { success: false, error: "Failed to clear holographic glass board." };
    }
    case "barehands_get_board_state": {
      const state = await getBoardState();
      return state
        ? { success: true, state }
        : { success: false, message: "Bare Hands board is either empty or daemon is starting up." };
    }
    // ── Stark HUD & Sound Engine Tool Executors (Jarvis-CV) ──────
    case "sound_effect": {
      const res = triggerSoundCue(args.cue);
      return res.success
        ? { success: true, cue: args.cue, message: `Procedural audio cue "${args.cue}" synthesized.` }
        : { success: false, error: res.error };
    }
    case "set_hud_mode": {
      const res = setHudMode(args.mode);
      return { success: true, mode: res.mode, message: `HUD display switched to ${res.mode}.` };
    }
    case "set_arc_reactor_power": {
      const res = setArcPower(args.power);
      return { success: true, power: res.power, message: `Arc Reactor power set to ${res.power}%.` };
    }
    // ── JarvisFlow Gesture Mind-Mapping Tool Executors ───────────
    case "brainstorm_topic": {
      const tree = await generateBrainstormSession(args.topic);
      await openBrainstormCanvas(args.topic);
      return {
        success: true,
        topic: tree.title || tree.topic,
        root: tree.root?.label,
        branches: {
          up: tree.directions?.up?.label,
          right: tree.directions?.right?.label,
          down: tree.directions?.down?.label,
          left: tree.directions?.left?.label,
        },
        message: `Generated spatial mind map for "${tree.title || tree.topic}" with 4 directional branches.`,
      };
    }
    case "open_brainstorm_canvas": {
      const res = await openBrainstormCanvas(args.topic);
      return { success: true, message: "JarvisFlow gesture mind-mapping canvas opened on the HUD." };
    }
    case "get_brainstorm_tree": {
      const session = await getCurrentBrainstormSession();
      return { success: true, session };
    }
    // ── IronHands 3D Spatial Kinetic Tool Executors ─────────────
    case "ironhands_transform": {
      const res = updateIronHandsTransform(args, args.target);
      return { success: true, target: res.target, transform: res.transform, message: `3D model ${res.target} transformed in spatial viewport.` };
    }
    case "ironhands_set_target": {
      const res = setIronHandsTarget(args.target);
      return { success: true, target: res.target, message: `Active 3D manipulation target switched to ${res.target}.` };
    }
    case "ironhands_explode_model": {
      const res = setIronHandsExplode(args.factor, args.target);
      return { success: true, target: res.target, explodeFactor: res.explodeFactor, message: `Arc Reactor components ${res.explodeFactor > 0 ? "disassembled to " + Math.round(res.explodeFactor * 100) + "%" : "reassembled"}.` };
    }
    case "ironhands_reset_transform": {
      const res = resetIronHandsTransform(args.target);
      return { success: true, target: res.target, message: `3D model ${res.target} reset to resting alignment.` };
    }
    // ── God's Eye View Geospatial Intelligence Executors ─────────
    case "godseye_launch": {
      await startGevDaemon();
      dispatchGevCommand({ action: "open" });
      return { success: true, message: "God's Eye View orbital reconnaissance console launched." };
    }
    case "godseye_orbit": {
      await startGevDaemon();
      const res = dispatchGevCommand({ action: "flyTo", location: args.location, altitude: args.altitude, pitch: args.pitch });
      return { success: true, location: args.location, state: res.state, message: `Satellite camera aligned and orbiting over ${args.location}.` };
    }
    case "godseye_set_optics": {
      const res = dispatchGevCommand({ action: "setOptics", mode: args.mode });
      return { success: true, mode: args.mode, message: `Satellite sensor optics switched to ${args.mode} mode.` };
    }
    case "godseye_toggle_layer": {
      const res = dispatchGevCommand({ action: "toggleLayer", layer: args.layer, enabled: args.enabled });
      return { success: true, layer: args.layer, enabled: res.state.layers[args.layer], message: `Intelligence layer ${args.layer} is now ${res.state.layers[args.layer] ? "active" : "disabled"}.` };
    }
    case "godseye_scan_airspace": {
      const flights = await getFreeFlightTelemetry(args.lat, args.lon, 250, args.militaryOnly);
      return { success: true, count: flights.count, aircraft: flights.aircraft?.slice(0, 10), message: `Scanned ${flights.count} active aircraft in airspace.` };
    }
    case "godseye_iss_tracker": {
      const sats = await getFreeSatelliteTelemetry("stations");
      const iss = sats.satellites?.find((s) => s.name?.includes("ISS")) || sats.satellites?.[0];
      return { success: true, iss, message: iss ? `ISS located (NORAD ID ${iss.noradId}). Orbiting at ~27,600 km/h.` : "Unable to acquire ISS telemetry signal." };
    }
    case "get_gesture_controller_status": {
      return {
        success: true,
        controller: "MediaPipe Hands Vision Engine",
        airMouse: "Active (Pinch Click, Two-Finger Scroll)",
        actionsSupported: ["Point (Air Mouse)", "Pinch (Virtual Click)", "Two-Finger (Air Scroll)", "Swipe Left/Right (Tab Cycle)", "Peace ✌️ (Voice Wake)", "Thumbs Up 👍 (Approve)", "Thumbs Down 👎 (Deny)", "Closed Fist ✊ (Mute/Dismiss)", "Two-Hand (Zoom)"],
      };
    }
    case "trigger_gesture_action": {
      return await executeGestureAction(args.action);
    }
    case "lookup_scientific_papers": {
      return await searchScientificLiterature(args);
    }
    case "set_assistant_language": {
      const lang = String(args.language || "English").trim();
      setSetting("assistant_language", lang);
      try { broadcastGlobal({ type: "settings:update", settings: { assistant_language: lang } }); } catch {}
      return { success: true, language: lang, message: `Conversational language permanently set to ${lang}. Cooper will now converse in ${lang} continuously.` };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// ── Text-form tool-call handling ─────────────────────────────────
const TEXT_CALL_RE = /<?function=([A-Za-z_][A-Za-z0-9_]*)\s*>([\s\S]*?)<\/function>/i;

function extractTextToolCall(content) {
  if (!content || typeof content !== "string") return null;
  const m = content.match(TEXT_CALL_RE);
  return m ? { name: m[1], raw: m[2] } : null;
}

function argsForTextCall(name, raw) {
  try { return JSON.parse(raw.trim()); } catch { /* fall through */ }
  const tool = TOOLS.find((t) => t.function.name === name);
  const firstKey = tool
    ? Object.keys(tool.function.parameters?.properties ?? {})[0]
    : null;
  return firstKey ? { [firstKey]: raw.trim() } : {};
}

function cleanMarkup(text) {
  return String(text || "")
    .replace(TEXT_CALL_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SMALL_TALK =
  /^(hi|hii+|hello|hey|heyy+|yo|hola|salam|assalamu(\s*alaikum)?|wa\s*alaikum|good\s*(morning|afternoon|evening|night)|how\s+(are|r)\s+(you|u)|how'?s\s+it\s+going|whats?\s*up|thanks?|thank\s+you|ok|okay|nice|great)(\s*(cooper|ultron|buddy|bro|man|dude))?[\s!?.]*$/i;

/**
 * Detect language switch commands or ongoing Urdu conversation,
 * and permanently persist to SQLite settings so Cooper remains in that language.
 */
export function checkAndPersistLanguageSwitch(query) {
  const q = String(query || "").trim().toLowerCase();

  // 1. Urdu switch triggers (Urdu script, English commands, Roman Urdu)
  const isUrduSwitch =
    /(مجھ سے\s*)?اردو میں\s*(بات|بولو|کہو|جواب)/i.test(query) ||
    /speak\s*(in\s*)?urdu/i.test(q) ||
    /switch\s*(to\s*)?urdu/i.test(q) ||
    /talk\s*(in|to me in)\s*urdu/i.test(q) ||
    /urdu\s*mein\s*(baat|bolo)/i.test(q);

  // 2. English switch triggers
  const isEnglishSwitch =
    /(مجھ سے\s*)?(انگلش|انگریزی)\s*میں\s*(بات|بولو|کہو)/i.test(query) ||
    /speak\s*(in\s*)?english/i.test(q) ||
    /switch\s*(to\s*)?english/i.test(q) ||
    /talk\s*(in|to me in)\s*english/i.test(q) ||
    /english\s*mein\s*(baat|bolo)/i.test(q);

  if (isUrduSwitch) {
    setSetting("assistant_language", "Urdu");
    try { broadcastGlobal({ type: "settings:update", settings: { assistant_language: "Urdu" } }); } catch {}
    return "Urdu";
  }

  if (isEnglishSwitch) {
    setSetting("assistant_language", "English");
    try { broadcastGlobal({ type: "settings:update", settings: { assistant_language: "English" } }); } catch {}
    return "English";
  }

  // 3. Auto-persist if user writes or speaks in Urdu script (e.g. conversational prompt)
  const hasUrduScript = /[\u0679\u0688\u0691\u06BA\u06D2\u06BE\u0686\u067E\u06AF\u0698\u0600-\u06FF]/.test(query);
  const currentLang = getSetting("assistant_language") || "English";
  if (hasUrduScript && currentLang !== "Urdu") {
    setSetting("assistant_language", "Urdu");
    try { broadcastGlobal({ type: "settings:update", settings: { assistant_language: "Urdu" } }); } catch {}
    return "Urdu";
  }

  return currentLang;
}

/**
 * Agentic cooper turn as an async generator. Yields events:
 *   { phase: "ack",  reply }
 *   { phase: "permission", approvalId, tool, args, summary }
 *   { phase: "final", type, reply, imagePath?, actions, pendingApproval? }
 */
export async function* askAssistantStream(text, history = []) {
  const query = String(text || "").trim();
  if (!query) throw new Error("Empty query");

  // Persist language choice across turns (e.g. locks in Urdu until asked for English)
  checkAndPersistLanguageSwitch(query);

  generatedImages.length = 0;
  createdDrafts.length = 0;
  pendingRequests.length = 0;
  const actions = [];
  const model = assistantFastModel();
  const messages = [
    { role: "system", content: systemPrompt() },
    ...history.slice(-6).filter((m) => m && m.role && m.content),
    { role: "user", content: query },
  ];

  let ackSent = false;
  for (let step = 0; step < 5; step++) {
    const msg = await chatWithTools(messages, TOOLS, { model });
    const calls = msg.tool_calls || [];

    if (!calls.length) {
      const textCall = extractTextToolCall(msg.content);
      if (textCall) {
        if (SMALL_TALK.test(query)) {
          const reply = cleanMarkup(msg.content) || "Hello, Ihsan. At your service.";
          yield { phase: "final", type: "text", reply, actions };
          return;
        }
        calls.push({ id: `text_${Date.now().toString(36)}`, type: "function", function: { name: textCall.name, arguments: JSON.stringify(argsForTextCall(textCall.name, textCall.raw)) } });
        msg.content = cleanMarkup(msg.content);
      }
    }

    if (!calls.length) {
      const reply = cleanMarkup(msg.content).trim();
      const imagePath = generatedImages[generatedImages.length - 1];
      const draftId = createdDrafts[createdDrafts.length - 1]?.id;
      const pendingApproval = pendingRequests[pendingRequests.length - 1];
      yield imagePath
        ? { phase: "final", type: "image", reply: reply || "Done — here is the image.", imagePath, actions, draftId, pendingApproval }
        : { phase: "final", type: "text", reply, actions, draftId, pendingApproval };
      return;
    }

    if (!ackSent && calls.some((c) => SLOW_TOOLS.has(c.function?.name))) {
      ackSent = true;
      yield { phase: "ack", reply: ackForCalls(calls) };
    }

    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* tolerate */ }
      let result;
      try { result = await runTool(call.function.name, args); }
      catch (e) { result = { error: e.message }; }
      actions.push(call.function.name);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });

      if (result?.permission_required && result?.approval_id) {
        yield {
          phase: "permission",
          approvalId: result.approval_id,
          summary: result.summary,
          tool: call.function.name,
          args,
        };
      }
    }
  }

  const finalText = await chat([...messages, { role: "user", content: "Give your final concise spoken answer now." }], { model });
  const clean = cleanMarkup(finalText).trim();
  const imagePath = generatedImages[generatedImages.length - 1];
  const draftId = createdDrafts[createdDrafts.length - 1]?.id;
  const pendingApproval = pendingRequests[pendingRequests.length - 1];
  yield imagePath
    ? { phase: "final", type: "image", reply: clean, imagePath, actions, draftId, pendingApproval }
    : { phase: "final", type: "text", reply: clean, actions, draftId, pendingApproval };
}

/**
 * Non-streaming wrapper
 */
export async function askAssistant(text, history = []) {
  let final = { type: "text", reply: "", actions: [] };
  for await (const ev of askAssistantStream(text, history)) {
    if (ev.phase === "final") final = ev;
  }
  return final;
}
