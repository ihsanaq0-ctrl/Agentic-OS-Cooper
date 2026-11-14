import { WebSocketServer } from "ws";
import { setRingState } from "../barehands-bridge.js";
import { askAssistantStream } from "../ai/assistant.js";
import { transcribeAudio, textToSpeech } from "../ai/openrouter.js";
import { config } from "../config.js";

// Import VAD only if available
let Silero;
try {
  const vadNode = await import("@ricky0123/vad-node");
  Silero = vadNode.Silero;
} catch (e) {
  console.warn("[Stream] @ricky0123/vad-node not found, using client-side VAD.");
}

export async function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/api/stream" });
  
  let vad;
  if (Silero) {
    try {
      vad = await Silero.new(Silero.Model.SILERO_VAD, {
        positiveSpeechThreshold: 0.5,
        minSpeechFrames: 3,
        preSpeechPadFrames: 10,
        minSilenceFrames: 10,
      });
      console.log("[Stream] Silero VAD engine loaded.");
    } catch (err) {
      console.warn("[Stream] Failed to load Silero VAD:", err.message);
    }
  }

  wss.on("connection", (ws) => {
    console.log("[Stream] Client connected");
    let audioBuffer = [];
    
    ws.on("message", async (msg) => {
      // Binary message = audio chunk
      if (Buffer.isBuffer(msg)) {
        audioBuffer.push(msg);
        
        // If we had real-time VAD processing per chunk:
        // if (vad) {
        //   const frame = convertBufferToFloat32(msg);
        //   const res = await vad.processAudio(frame);
        //   if (res.isSpeech === false && res.speechEnd) { /* trigger speech end */ }
        // }
      }
      
      // String message = command / metadata
      if (typeof msg === "string") {
        try {
          const data = JSON.parse(msg);
          
          if (data.type === "speech_end") {
            const fullAudio = Buffer.concat(audioBuffer);
            audioBuffer = []; // reset for next utterance
            
            if (fullAudio.length === 0) return;

            const b64 = fullAudio.toString("base64");
            setRingState("thinking");
            ws.send(JSON.stringify({ phase: "thinking" }));
            
            try {
              // 1. Transcribe
              ws.send(JSON.stringify({ phase: "transcribing" }));
              const text = await transcribeAudio(b64, data.format || "webm", {});
              ws.send(JSON.stringify({ phase: "transcribed", text }));
              
              if (!text || text.trim() === "") {
                setRingState("idle");
                return;
              }

              // 2. Generate Assistant Response
              let finalAnswer = "";
              for await (const ev of askAssistantStream(text, data.history || [])) {
                ws.send(JSON.stringify(ev));
                if (ev.phase === "speaking" || ev.phase === "answer") {
                  setRingState("speaking");
                  finalAnswer += ev.content;
                }
              }
              
              // 3. Generate TTS
              ws.send(JSON.stringify({ phase: "tts_generating" }));
              const { b64: ttsAudio, mime } = await textToSpeech(finalAnswer, {});
              
              // 4. Send back audio
              ws.send(JSON.stringify({ phase: "tts_ready", audio: ttsAudio, mime }));
              setRingState("idle");
            } catch (err) {
              setRingState("idle");
              ws.send(JSON.stringify({ phase: "error", error: err.message }));
            }
          }
        } catch (e) {
          console.error("[Stream] Message parse error:", e);
        }
      }
    });

    ws.on("close", () => {
      console.log("[Stream] Client disconnected");
    });
  });
}
