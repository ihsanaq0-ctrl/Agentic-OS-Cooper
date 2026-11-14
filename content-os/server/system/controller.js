import { exec } from "child_process";
import { randomUUID } from "crypto";
import { getSetting, setSetting } from "../db.js";

// Pending approvals queue: requestId -> { id, tool, args, summary, createdAt, status }
const pendingApprovals = new Map();

// Clean up expired approvals (> 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, req] of pendingApprovals.entries()) {
    if (now - req.createdAt > 120000) {
      pendingApprovals.delete(id);
    }
  }
}, 30000);

/**
 * Check whether system automation mode is enabled
 */
export function isSystemModeEnabled() {
  const val = getSetting("system_access_enabled");
  return val === "1" || val === "true" || val === true;
}

/**
 * Set system automation mode status
 */
export function setSystemModeEnabled(enabled) {
  setSetting("system_access_enabled", enabled ? "1" : "0");
  return isSystemModeEnabled();
}

/**
 * Determines if a system command poses a security risk, runs scripts,
 * modifies system files, or changes system/network/registry configurations.
 */
export function isHighRiskCommand(commandStr) {
  const cmd = String(commandStr || "").trim();
  if (!cmd) return false;

  // Running script files (.ps1, .bat, .cmd, .vbs, .sh, .py, .reg)
  if (/\b\w+\.(ps1|bat|cmd|vbs|sh|reg)\b/i.test(cmd)) return true;
  if (/powershell(\.exe)?\s+(-executionpolicy|-file|-command|-c)\b/i.test(cmd)) return true;
  if (/\b(cscript|wscript|bash|sh|zsh)\b/i.test(cmd)) return true;

  // Modifying or touching sensitive system paths / files
  if (/[\\/](windows|system32|syswow64|program\s*files|appdata[\\/]roaming[\\/]microsoft[\\/]windows[\\/]start\s*menu|boot)[\\/]/i.test(cmd)) return true;

  // Destructive file / disk operations
  if (/\b(format|diskpart|vssadmin|bcdedit)\b/i.test(cmd)) return true;
  if (/\b(del|erase|rd|rmdir|rm)\b.*(\/s|\/q|-r|-f|--force)/i.test(cmd)) return true;
  if (/\b(Remove-Item|Clear-Item|Clear-Content)\b.*(-Recurse|-Force)/i.test(cmd)) return true;

  // System, security, and registry configuration changes
  if (/\b(reg\s+(add|delete|import|restore|copy|save)|regedit)\b/i.test(cmd)) return true;
  if (/\b(netsh|sc\s+(config|create|delete|start|stop)|net\s+(user|localgroup|share|stop|start))\b/i.test(cmd)) return true;
  if (/\b(icacls|takeown|attrib\s+[+-][shr])\b/i.test(cmd)) return true;
  if (/\b(setx|Set-ExecutionPolicy|Disable-NetFirewallRule|Enable-NetFirewallRule)\b/i.test(cmd)) return true;

  return false;
}

/**
 * Register a tool call that requires explicit Human-In-The-Loop approval
 */
export function requestApproval(tool, args, summary) {
  const id = randomUUID().slice(0, 8);
  const record = {
    id,
    tool,
    args,
    summary,
    createdAt: Date.now(),
    status: "pending",
  };
  pendingApprovals.set(id, record);
  return record;
}

/**
 * Retrieve a pending approval record
 */
export function getPendingApproval(id) {
  return pendingApprovals.get(id);
}

/**
 * Retrieve the latest pending approval record (for gestural Thumbs Up/Down)
 */
export function getLatestPendingApproval() {
  const entries = Array.from(pendingApprovals.values());
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/**
 * Windows system volume adjustment via virtual keystrokes
 * @param {"up"|"down"|"mute"} action
 */
export function adjustVolume(action = "up") {
  const act = String(action).toLowerCase();
  // Virtual key codes: 0xAF = Volume Up, 0xAE = Volume Down, 0xAD = Volume Mute
  const vkCode = act === "mute" ? "0xAD" : (act === "down" ? "0xAE" : "0xAF");
  const cmd = `powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]${vkCode})"`;
  return runCommand(cmd);
}

/**
 * Approve and execute a pending tool call
 */
export async function executeApproval(id) {
  const record = pendingApprovals.get(id);
  if (!record) {
    throw new Error("Approval request not found or expired.");
  }
  pendingApprovals.delete(id);

  let result;
  if (record.tool === "launch_software") {
    result = await launchSoftware(record.args.app_name);
  } else if (record.tool === "open_browser") {
    result = await openBrowser(record.args.url);
  } else if (record.tool === "power_control") {
    result = await powerControl(record.args.action, record.args.delay_seconds);
  } else if (record.tool === "run_system_command") {
    result = await runCommand(record.args.command);
  } else {
    throw new Error(`Unknown system tool: ${record.tool}`);
  }

  return { approved: true, tool: record.tool, result };
}

/**
 * Deny and cancel a pending tool call
 */
export function denyApproval(id) {
  const record = pendingApprovals.get(id);
  if (record) {
    pendingApprovals.delete(id);
    return { denied: true, tool: record.tool, summary: record.summary };
  }
  return { denied: true, message: "Request already dismissed" };
}

/**
 * Common app aliases for Windows
 */
const APP_ALIASES = {
  chrome: "chrome",
  "google chrome": "chrome",
  edge: "msedge",
  "microsoft edge": "msedge",
  brave: "brave",
  firefox: "firefox",
  code: "code",
  "vs code": "code",
  "visual studio code": "code",
  notepad: "notepad",
  calculator: "calc",
  calc: "calc",
  spotify: "spotify",
  terminal: "wt",
  "windows terminal": "wt",
  cmd: "cmd",
  powershell: "powershell",
  explorer: "explorer",
  "file explorer": "explorer",
  vlc: "vlc",
  taskmgr: "taskmgr",
  "task manager": "taskmgr",
};

/**
 * Open a URL in default browser safely on Windows without query-string escaping bugs
 */
export function openBrowser(targetUrl) {
  return new Promise((resolve, reject) => {
    let cleanUrl = String(targetUrl || "").trim();
    if (!cleanUrl) return reject(new Error("URL is required"));
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Fix hallucinated YouTube watch URLs (e.g., watch?v=starboy)
    const ytWatchMatch = cleanUrl.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
    if (ytWatchMatch) {
      const vidId = ytWatchMatch[1];
      // Real YouTube IDs are exactly 11 characters. If it's a word/title, redirect to search
      if (vidId.length !== 11) {
        cleanUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(vidId.replace(/_/g, " "))}`;
      }
    }

    // PowerShell Start-Process reliably launches default browser with full complex URLs (including & and ?)
    const safePsUrl = cleanUrl.replace(/'/g, "''");
    const cmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${safePsUrl}'"`;

    exec(cmd, (err) => {
      if (err) {
        // Fallback to start command
        const fallbackCmd = `start "" "${cleanUrl.replace(/"/g, "")}"`;
        exec(fallbackCmd, { shell: "cmd.exe" }, (fErr) => {
          if (fErr) return reject(new Error(`Failed to open browser: ${fErr.message}`));
          resolve({ opened: true, url: cleanUrl, message: `Opened ${cleanUrl} in browser` });
        });
        return;
      }
      resolve({ opened: true, url: cleanUrl, message: `Opened ${cleanUrl} in browser` });
    });
  });
}

/**
 * Scrapes the top matching video ID from YouTube search results
 */
export async function fetchYouTubeVideoId(query) {
  try {
    const clean = String(query || "").trim();
    if (!clean) return null;
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // 1. Try match /watch?v=XXXXXXXXXXX
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return match[1];
    }
    // 2. Try JSON videoId match
    const jsonMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Directly plays a song/video on YouTube in the default browser
 */
export async function playYouTube(query) {
  const clean = String(query || "").trim();
  if (!clean) return openBrowser("https://www.youtube.com");
  
  const videoId = await fetchYouTubeVideoId(clean);
  let playUrl;
  if (videoId) {
    playUrl = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;
  } else {
    playUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
  }
  const result = await openBrowser(playUrl);
  return { ...result, videoId, message: `Playing "${clean}" on YouTube` };
}

/**
 * Launch an installed application on Windows
 */
export function launchSoftware(appName) {
  return new Promise((resolve, reject) => {
    const raw = String(appName || "").trim().toLowerCase();
    if (!raw) return reject(new Error("Application name is required"));

    const executable = APP_ALIASES[raw] || raw.replace(/[^a-zA-Z0-9_\-.]/g, "");
    const cmd = `start "" "${executable}"`;

    exec(cmd, { shell: "cmd.exe" }, (err) => {
      if (err) return reject(new Error(`Failed to launch "${appName}": ${err.message}`));
      resolve({ launched: true, app: executable, message: `Launched ${appName}` });
    });
  });
}

/**
 * Run a safe bounded system command with timeout
 */
export function runCommand(commandStr) {
  return new Promise((resolve, reject) => {
    const cmd = String(commandStr || "").trim();
    if (!cmd) return reject(new Error("Command string is required"));

    exec(cmd, { timeout: 15000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Command failed: ${err.message}`));
      resolve({ stdout: stdout.slice(0, 1000), stderr: stderr.slice(0, 500) });
    });
  });
}

/**
 * Windows power management (shutdown, restart, sleep, lock, abort)
 */
export function powerControl(action, delaySeconds = 5) {
  return new Promise((resolve, reject) => {
    const act = String(action || "").trim().toLowerCase();
    let cmd = "";
    let message = "";

    switch (act) {
      case "shutdown":
      case "poweroff":
        cmd = `shutdown /s /t ${Math.max(1, Number(delaySeconds) || 5)} /c "Shutdown initiated by Agentic OS Cooper"`;
        message = `Initiating PC shutdown in ${delaySeconds} seconds.`;
        break;
      case "restart":
      case "reboot":
        cmd = `shutdown /r /t ${Math.max(1, Number(delaySeconds) || 5)} /c "Restart initiated by Agentic OS Cooper"`;
        message = `Initiating PC restart in ${delaySeconds} seconds.`;
        break;
      case "lock":
      case "lock_screen":
        cmd = `rundll32.exe user32.dll,LockWorkStation`;
        message = "Screen locked.";
        break;
      case "sleep":
      case "hibernate":
        cmd = `rundll32.exe powrprof.dll,SetSuspendState 0,1,0`;
        message = "Putting PC to sleep.";
        break;
      case "abort":
      case "abort_shutdown":
      case "cancel":
        cmd = `shutdown /a`;
        message = "Scheduled shutdown/restart cancelled.";
        break;
      default:
        return reject(new Error(`Unsupported power action: ${action}. Use shutdown, restart, sleep, lock, or abort.`));
    }

    exec(cmd, { shell: "cmd.exe" }, (err) => {
      if (err) return reject(new Error(`Power action failed: ${err.message}`));
      resolve({ success: true, action: act, message });
    });
  });
}

