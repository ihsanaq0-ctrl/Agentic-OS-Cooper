// ── Cooper Unified Gesture Action Router ──────────────────────────────
// Translates computer vision hand gestures (Air Mouse, Thumbs Up/Down,
// Swipes, Victory, Fist Mute) directly into Cooper OS actions and approvals.

import {
  getLatestPendingApproval,
  executeApproval,
  denyApproval,
  isSystemModeEnabled,
  setSystemModeEnabled,
  adjustVolume,
  launchSoftware,
  playYouTube,
  openBrowser,
} from "./controller.js";
import { broadcastGlobal } from "../sse.js";

let gestureTrackingActive = false;
let airMouseActive = true;
let lastGestureAction = null;
let lastActionTime = 0;

/**
 * Execute a system action triggered by a hand gesture
 */
export async function executeGestureAction(actionType, payload = {}) {
  const action = String(actionType || "").toUpperCase().trim();
  const now = Date.now();
  lastGestureAction = action;
  lastActionTime = now;

  console.log(`[GestureActionRouter] Executing: ${action}`, payload);

  switch (action) {
    case "THUMBS_UP":
    case "APPROVE": {
      const pending = getLatestPendingApproval();
      if (pending) {
        const res = await executeApproval(pending.id);
        broadcastGlobal({
          type: "gesture:executed",
          action: "APPROVE",
          summary: `Approved via Thumbs-Up 👍: ${pending.summary || pending.tool}`,
          result: res,
        });
        return { success: true, action: "APPROVE", message: `Approved ${pending.tool}` };
      }
      broadcastGlobal({
        type: "gesture:executed",
        action: "THUMBS_UP",
        message: "No pending approval requests.",
      });
      return { success: true, action: "THUMBS_UP", message: "Thumbs-Up acknowledged." };
    }

    case "THUMBS_DOWN":
    case "DENY": {
      const pending = getLatestPendingApproval();
      if (pending) {
        const res = denyApproval(pending.id);
        broadcastGlobal({
          type: "gesture:executed",
          action: "DENY",
          summary: `Rejected via Thumbs-Down 👎: ${pending.summary || pending.tool}`,
          result: res,
        });
        return { success: true, action: "DENY", message: `Rejected ${pending.tool}` };
      }
      broadcastGlobal({
        type: "gesture:executed",
        action: "THUMBS_DOWN",
        message: "No pending approval requests to reject.",
      });
      return { success: true, action: "THUMBS_DOWN", message: "Thumbs-Down acknowledged." };
    }

    case "VICTORY":
    case "VOICE_WAKE": {
      // Wake Cooper speech listener hands-free
      broadcastGlobal({
        type: "voice:wake",
        source: "gesture_victory",
        message: "Cooper voice listening activated via Peace gesture ✌️",
      });
      return { success: true, action: "VOICE_WAKE", message: "Voice listening engaged." };
    }

    case "SYSTEM_MODE_TOGGLE": {
      const current = isSystemModeEnabled();
      const updated = setSystemModeEnabled(!current);
      broadcastGlobal({
        type: "system:mode",
        enabled: updated,
        source: "gesture",
      });
      return { success: true, systemMode: updated };
    }

    case "VOLUME_UP": {
      await adjustVolume("up").catch(() => {});
      broadcastGlobal({ type: "gesture:feedback", action: "VOLUME_UP", label: "🔊 VOLUME UP" });
      return { success: true, action: "VOLUME_UP" };
    }

    case "VOLUME_DOWN": {
      await adjustVolume("down").catch(() => {});
      broadcastGlobal({ type: "gesture:feedback", action: "VOLUME_DOWN", label: "🔉 VOLUME DOWN" });
      return { success: true, action: "VOLUME_DOWN" };
    }

    case "VOLUME_MUTE":
    case "MUTE": {
      await adjustVolume("mute").catch(() => {});
      broadcastGlobal({ type: "gesture:feedback", action: "VOLUME_MUTE", label: "🔇 AUDIO MUTED" });
      return { success: true, action: "VOLUME_MUTE" };
    }

    case "DISMISS":
    case "FIST_TAP": {
      broadcastGlobal({ type: "hud:dismiss", source: "gesture_fist" });
      return { success: true, action: "DISMISS" };
    }

    case "BRIEFING":
    case "PALM_HOLD": {
      broadcastGlobal({ type: "hud:briefing", source: "gesture_palm" });
      return { success: true, action: "BRIEFING" };
    }

    case "LAUNCH_APP": {
      if (payload.app) {
        const res = await launchSoftware(payload.app);
        return { success: true, ...res };
      }
      return { success: false, error: "Missing app name" };
    }

    case "PLAY_YOUTUBE": {
      const res = await playYouTube(payload.query || "Lofi Beats");
      return { success: true, ...res };
    }

    case "SET_AIR_MOUSE": {
      airMouseActive = Boolean(payload.enabled);
      broadcastGlobal({ type: "gesture:airmouse", enabled: airMouseActive });
      return { success: true, airMouseActive };
    }

    default:
      return { success: false, error: `Unknown gesture action: ${action}` };
  }
}

/**
 * Register gesture action routes in Express
 */
export function registerGestureActionRoutes(app) {
  // Trigger gesture action from HUD or external tracker
  app.post("/api/gesture/action", async (req, res) => {
    try {
      const { action, payload } = req.body || {};
      const result = await executeGestureAction(action, payload);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get gesture controller status
  app.get("/api/gesture/status", (_req, res) => {
    res.json({
      trackingActive: gestureTrackingActive,
      airMouseActive,
      lastGestureAction,
      lastActionTime,
    });
  });

  // Toggle tracking state
  app.post("/api/gesture/toggle", (req, res) => {
    const { active, airMouse } = req.body || {};
    if (typeof active === "boolean") gestureTrackingActive = active;
    if (typeof airMouse === "boolean") airMouseActive = airMouse;
    broadcastGlobal({
      type: "gesture:state",
      trackingActive: gestureTrackingActive,
      airMouseActive,
    });
    res.json({
      trackingActive: gestureTrackingActive,
      airMouseActive,
    });
  });
}
