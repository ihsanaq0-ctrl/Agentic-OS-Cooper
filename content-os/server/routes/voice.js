import { Router } from "express";
import { setRingState } from "../barehands-bridge.js";
import { askAssistant, askAssistantStream } from "../ai/assistant.js";
import { transcribeAudio, textToSpeech } from "../ai/openrouter.js";
import { isSystemModeEnabled, setSystemModeEnabled, executeApproval, denyApproval } from "../system/controller.js";
import { broadcastGlobal } from "../sse.js";
import { getAllSettings } from "../db.js";
import { ok, fail, asyncRoute } from "./utils.js";

const router = Router();

router.get("/system/status", (_req, res) => ok(res, { enabled: isSystemModeEnabled() }));

router.post("/system/toggle", (req, res) => {
  const current = isSystemModeEnabled();
  const next = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : !current;
  const enabled = setSystemModeEnabled(next);
  broadcastGlobal({ type: "system:mode", enabled });
  ok(res, { enabled });
});

router.post("/assistant/approve", asyncRoute(async (req, res) => {
  const { id } = req.body || {};
  if (!id) return fail(res, 400, "Approval ID is required");
  const result = await executeApproval(id);
  ok(res, result);
}));

router.post("/assistant/deny", (req, res) => {
  const { id } = req.body || {};
  if (!id) return fail(res, 400, "Approval ID is required");
  ok(res, denyApproval(id));
});

router.post("/assistant/chat", asyncRoute(async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return fail(res, 400, "text is required");
  setRingState("thinking");
  try {
    const result = await askAssistant(text, Array.isArray(req.body?.history) ? req.body.history : []);
    setRingState("idle");
    ok(res, result);
  } catch (err) {
    setRingState("idle");
    throw err;
  }
}));

router.post("/assistant/stream", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return fail(res, 400, "text is required");
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  setRingState("thinking");
  try {
    for await (const ev of askAssistantStream(text, history)) {
      if (ev.phase === "speaking" || ev.phase === "answer") setRingState("speaking");
      res.write(JSON.stringify(ev) + "\n");
    }
  } catch (err) {
    res.write(JSON.stringify({ phase: "error", error: err.message }) + "\n");
  }
  setRingState("idle");
  res.end();
});

router.post("/assistant/transcribe", asyncRoute(async (req, res) => {
  const { audio, format } = req.body || {};
  if (!audio) return fail(res, 400, "audio (base64) is required");
  const text = await transcribeAudio(String(audio), format || "webm", {});
  ok(res, { text });
}));

router.post("/assistant/speak", asyncRoute(async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return fail(res, 400, "text is required");
  if (getAllSettings().tts_provider === "browser") {
    return fail(res, 409, "TTS provider is set to browser");
  }
  const { b64, mime } = await textToSpeech(text, {});
  ok(res, { audio: b64, mime });
}));

export default router;
