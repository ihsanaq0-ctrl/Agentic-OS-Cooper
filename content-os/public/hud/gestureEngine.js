// ── Unified Tony Stark Gesture Control Engine ──────────────────────────
// Tri-Modal System Controller (Voice, Text, Hand Gestures).
// Combines:
// 1. Air Mouse: Real-time fingertip pointer + dynamic pinch virtual click.
// 2. Air Scroll: Vertical scroll via two-finger point or palm drag.
// 3. Human-In-The-Loop Approvals: Gestural Thumbs Up (👍) / Thumbs Down (👎).
// 4. Voice Trigger: Peace Sign (✌️) wakes Cooper speech recognition hands-free.
// 5. Tactical OS Mute & Dismiss: Closed Fist (✊) dismisses modals / mutes audio.
// 6. Navigation Swipes: Palm left/right flicks cycle HUD views and carousel slides.
// 7. Spatial Holograms: Fist grab 3D rotation & two-hand pinch zoom.
// 8. Picture-In-Picture: Toggleable cybernetic HUD hand skeleton preview.

class GestureEngine {
  constructor() {
    this.videoEl = null;
    this.pipCanvas = null;
    this.pipCtx = null;
    this.hands = null;
    this.camera = null;
    this.isActive = false;
    this.isEnabled = true;
    this.isAirMouseEnabled = true;
    this.showPipPreview = false;

    // Air Mouse Pointer State
    this.cursorEl = null;
    this.pointerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.targetPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.isPinching = false;
    this.lastPinchClickTime = 0;

    // Stability & Anti-Jitter State (JarvisFlow)
    this.gestureHistory = []; // Debounce buffer (last 4 frames)
    this.activeGesture = "IDLE";
    this.lastActionTime = 0;
    this.cooldownMs = 1200; // 1.2s pause after discrete actions
    this.prevPalmCenter = null;
    this.prevPinchDist = null;
    this.fistStartTime = 0;
    this.palmHoldStartTime = 0;
    this.prevTwoHandDist = null;
    this.prevFingerY = null;

    this.audioCtx = null;
    this.badgeTimeout = null;
    this.pillTimeout = null;
  }

  /**
   * Initialize unified gesture engine
   */
  async init() {
    console.log("[GestureEngine] Initializing Stark Tri-Modal Gesture Controller...");

    // Hidden offscreen video element for webcam feed
    if (!this.videoEl) {
      this.videoEl = document.createElement("video");
      this.videoEl.setAttribute("playsinline", "");
      this.videoEl.style.display = "none";
      document.body.appendChild(this.videoEl);
    }

    this.createAirMouseCursor();
    this.createFeedbackPill();
    this.createPipPreview();

    if (typeof window.Hands === "undefined") {
      this.loadMediaPipeScripts(() => this.setupHands());
    } else {
      this.setupHands();
    }

    // Start cursor animation loop
    this.startCursorLoop();
  }

  createAirMouseCursor() {
    if (document.getElementById("airMouseCursor")) {
      this.cursorEl = document.getElementById("airMouseCursor");
      return;
    }
    const cur = document.createElement("div");
    cur.id = "airMouseCursor";
    cur.className = "air-mouse-cursor hidden";
    document.body.appendChild(cur);
    this.cursorEl = cur;
  }

  createFeedbackPill() {
    if (document.getElementById("gestureHudPill")) return;
    const pill = document.createElement("div");
    pill.id = "gestureHudPill";
    pill.className = "gesture-hud-pill hidden";
    pill.innerHTML = `
      <span class="gesture-icon" id="gestureHudIcon">⚡</span>
      <span class="gesture-label" id="gestureHudLabel">GESTURE</span>
    `;
    document.body.appendChild(pill);
  }

  createPipPreview() {
    if (document.getElementById("gesturePipWrap")) return;
    const wrap = document.createElement("div");
    wrap.id = "gesturePipWrap";
    wrap.className = "gesture-pip-wrap hidden";
    wrap.innerHTML = `
      <div class="gesture-pip-header">
        <span>🖐️ GESTURE VISION HUD</span>
        <button id="closePipBtn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:11px;">✕</button>
      </div>
      <div class="gesture-pip-body">
        <canvas id="gesturePipCanvas" class="gesture-pip-canvas" width="220" height="137"></canvas>
        <span class="gesture-pip-tag" id="gesturePipTag">AIR MOUSE // ON</span>
      </div>
    `;
    document.body.appendChild(wrap);

    this.pipCanvas = document.getElementById("gesturePipCanvas");
    if (this.pipCanvas) this.pipCtx = this.pipCanvas.getContext("2d");

    document.getElementById("closePipBtn")?.addEventListener("click", () => {
      this.togglePip(false);
    });
  }

  togglePip(show = null) {
    const wrap = document.getElementById("gesturePipWrap");
    if (!wrap) return;
    this.showPipPreview = show !== null ? show : wrap.classList.contains("hidden");
    if (this.showPipPreview) {
      wrap.classList.remove("hidden");
    } else {
      wrap.classList.add("hidden");
    }
  }

  loadMediaPipeScripts(callback) {
    let loaded = 0;
    const checkDone = () => {
      loaded++;
      if (loaded === 2 && callback) callback();
    };

    const s1 = document.createElement("script");
    s1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
    s1.crossOrigin = "anonymous";
    s1.onload = checkDone;
    document.head.appendChild(s1);

    const s2 = document.createElement("script");
    s2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
    s2.crossOrigin = "anonymous";
    s2.onload = checkDone;
    document.head.appendChild(s2);
  }

  setupHands() {
    try {
      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });

      this.hands.onResults((results) => this.processFrame(results));
      console.log("[GestureEngine] MediaPipe Hands online and calibrated.");
    } catch (err) {
      console.error("[GestureEngine] MediaPipe setup failed:", err);
    }
  }

  async startCamera() {
    if (!this.videoEl || !window.Camera) return false;

    try {
      this.camera = new window.Camera(this.videoEl, {
        onFrame: async () => {
          if (this.isActive && this.isEnabled && this.hands) {
            await this.hands.send({ image: this.videoEl });
          }
        },
        width: 640,
        height: 480,
      });

      await this.camera.start();
      this.isActive = true;
      this.updateLiveBadges("TRACKING");
      this.playSciFiTone(440, 880);
      this.showFeedbackPill("GESTURE SYSTEM ONLINE 🖐️", "⚡");
      return true;
    } catch (err) {
      console.warn("[GestureEngine] Camera start error:", err);
      return false;
    }
  }

  stopCamera() {
    if (this.camera) {
      try { this.camera.stop(); } catch {}
    }
    this.isActive = false;
    if (this.cursorEl) this.cursorEl.classList.add("hidden");
    this.updateLiveBadges("OFFLINE");
  }

  startCursorLoop() {
    const render = () => {
      if (this.isActive && this.isAirMouseEnabled && this.cursorEl) {
        // Smooth exponential interpolation (lerp)
        this.pointerPos.x += (this.targetPos.x - this.pointerPos.x) * 0.45;
        this.pointerPos.y += (this.targetPos.y - this.pointerPos.y) * 0.45;

        this.cursorEl.style.left = `${this.pointerPos.x}px`;
        this.cursorEl.style.top = `${this.pointerPos.y}px`;
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /**
   * Main computer vision processing loop
   */
  processFrame(results) {
    if (!this.isEnabled) return;

    // Optional picture-in-picture visualization
    if (this.showPipPreview && this.pipCtx && this.pipCanvas) {
      this.drawPipPreview(results);
    }

    const multiHandLandmarks = results.multiHandLandmarks;
    const now = Date.now();

    // Hand lost reset
    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      if (this.cursorEl) this.cursorEl.classList.add("hidden");
      this.prevPalmCenter = null;
      this.prevPinchDist = null;
      this.prevFingerY = null;
      this.palmHoldStartTime = 0;
      this.fistStartTime = 0;
      this.gestureHistory = [];
      return;
    }

    // ── 1. TWO-HAND GESTURES (SCALE & EXPLODE) ─────────────────────
    if (multiHandLandmarks.length === 2) {
      if (this.cursorEl) this.cursorEl.classList.add("hidden");
      const h1 = multiHandLandmarks[0];
      const h2 = multiHandLandmarks[1];
      const currentDist = Math.hypot(h1[9].x - h2[9].x, h1[9].y - h2[9].y);

      if (this.prevTwoHandDist !== null) {
        const delta = currentDist - this.prevTwoHandDist;
        if (Math.abs(delta) > 0.025) {
          if (window.cooperGlobe && window.cooperGlobe.zoom) {
            window.cooperGlobe.zoom(delta * 1.8);
          }
        }
      }
      this.prevTwoHandDist = currentDist;
      return;
    } else {
      this.prevTwoHandDist = null;
    }

    // ── 2. SINGLE-HAND CLASSIFICATION & AIR MOUSE ─────────────────
    const landmarks = multiHandLandmarks[0];
    const rawGesture = this.classifyRaw(landmarks);

    // Debounce buffer (4 frames)
    this.gestureHistory.push(rawGesture);
    if (this.gestureHistory.length > 4) this.gestureHistory.shift();

    const isStable = this.gestureHistory.length === 4 && this.gestureHistory.every((g) => g === rawGesture);
    const stableGesture = isStable ? rawGesture : this.activeGesture;
    this.activeGesture = stableGesture;

    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const palmCenter = { x: landmarks[9].x, y: landmarks[9].y };

    // ── AIR MOUSE TRACKING ────────────────────────────────────────
    if (this.isAirMouseEnabled && (stableGesture === "POINT" || stableGesture === "PINCH" || stableGesture === "PALM_OPEN")) {
      if (this.cursorEl) this.cursorEl.classList.remove("hidden");
      // Mirrored horizontal coordinates across screen
      const screenX = (1 - indexTip.x) * window.innerWidth;
      const screenY = indexTip.y * window.innerHeight;

      this.targetPos.x = screenX;
      this.targetPos.y = screenY;

      // Virtual Click via Pinch (Thumb + Index distance < 0.04)
      const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      if (pinchDist < 0.042) {
        if (!this.isPinching) {
          this.isPinching = true;
          if (this.cursorEl) this.cursorEl.classList.add("pinched");
          if (now - this.lastPinchClickTime > 400) {
            this.executeVirtualClick(this.pointerPos.x, this.pointerPos.y);
            this.lastPinchClickTime = now;
          }
        }
      } else {
        if (this.isPinching) {
          this.isPinching = false;
          if (this.cursorEl) this.cursorEl.classList.remove("pinched");
        }
      }
    } else {
      if (this.cursorEl && stableGesture !== "PINCH") this.cursorEl.classList.add("hidden");
    }

    // ── AIR SCROLL (TWO FINGERS EXTENDED) ─────────────────────────
    if (stableGesture === "TWO_FINGER_SCROLL") {
      if (this.prevFingerY !== null) {
        const deltaY = indexTip.y - this.prevFingerY;
        if (Math.abs(deltaY) > 0.008) {
          this.executeAirScroll(deltaY * 1200);
        }
      }
      this.prevFingerY = indexTip.y;
    } else {
      this.prevFingerY = null;
    }

    // ── THUMBS UP (APPROVE HUMAN-IN-THE-LOOP COMMAND) ─────────────
    if (stableGesture === "THUMBS_UP" && now - this.lastActionTime > this.cooldownMs) {
      this.triggerGestureAction("THUMBS_UP", "THUMBS UP 👍 HITL COMMAND APPROVED", "👍");
      this.lastActionTime = now;
      return;
    }

    // ── THUMBS DOWN (REJECT HUMAN-IN-THE-LOOP COMMAND) ───────────
    if (stableGesture === "THUMBS_DOWN" && now - this.lastActionTime > this.cooldownMs) {
      this.triggerGestureAction("THUMBS_DOWN", "THUMBS DOWN 👎 HITL COMMAND REJECTED", "👎");
      this.lastActionTime = now;
      return;
    }

    // ── PEACE / VICTORY SIGN (VOICE WAKE HANDS-FREE) ──────────────
    if (stableGesture === "VICTORY" && now - this.lastActionTime > this.cooldownMs) {
      this.triggerGestureAction("VICTORY", "PEACE ✌️ WAKING COOPER VOICE LISTENER", "✌️");
      this.wakeVoiceListener();
      this.lastActionTime = now;
      return;
    }

    // ── CLOSED FIST (MUTE AUDIO & DISMISS ACTIVE MODAL) ───────────
    if (stableGesture === "FIST") {
      if (!this.fistStartTime) this.fistStartTime = now;
      // Hold fist > 1.2s -> System Mute
      if (now - this.fistStartTime > 1200 && now - this.lastActionTime > this.cooldownMs) {
        this.triggerGestureAction("VOLUME_MUTE", "CLOSED FIST ✊ SYSTEM AUDIO MUTED", "🔇");
        this.lastActionTime = now;
        this.fistStartTime = 0;
      }
    } else {
      // Tap fist (quick release 250-700ms) -> Dismiss active modal
      if (this.fistStartTime && now - this.fistStartTime >= 250 && now - this.fistStartTime <= 700) {
        if (now - this.lastActionTime > this.cooldownMs) {
          this.executeBackAction();
          this.lastActionTime = now;
        }
      }
      this.fistStartTime = 0;
    }

    // ── OPEN PALM HORIZONTAL SWIPES (TAB SWITCHING) ──────────────
    if (stableGesture === "PALM_OPEN") {
      if (this.prevPalmCenter && now - this.lastActionTime > this.cooldownMs) {
        const deltaX = palmCenter.x - this.prevPalmCenter.x;
        if (Math.abs(deltaX) > 0.18) {
          if (deltaX < 0) {
            this.executeAction("SWIPE_RIGHT", "SWIPE RIGHT → NEXT TAB", "👉");
            this.cycleView(1);
          } else {
            this.executeAction("SWIPE_LEFT", "SWIPE LEFT ← PREV TAB", "👈");
            this.cycleView(-1);
          }
          this.lastActionTime = now;
          this.prevPalmCenter = null;
          return;
        }
      }

      // Palm Hold > 2.5s -> Proactive Daily Briefing
      if (!this.palmHoldStartTime) {
        this.palmHoldStartTime = now;
      } else if (now - this.palmHoldStartTime > 2500 && now - this.lastActionTime > this.cooldownMs) {
        this.triggerGestureAction("BRIEFING", "PALM HOLD ✋ PROACTIVE BRIEFING", "📋");
        this.triggerBriefing();
        this.lastActionTime = now;
        this.palmHoldStartTime = 0;
      }
    } else {
      this.palmHoldStartTime = 0;
    }

    this.prevPalmCenter = palmCenter;
  }

  /**
   * Classify 21 hand landmarks into high-fidelity gesture semantics
   */
  classifyRaw(landmarks) {
    const wrist = landmarks[0];
    const isExt = (tip, pip) =>
      Math.hypot(landmarks[tip].x - wrist.x, landmarks[tip].y - wrist.y) >
      Math.hypot(landmarks[pip].x - wrist.x, landmarks[pip].y - wrist.y);

    const indexExt = isExt(8, 6);
    const middleExt = isExt(12, 10);
    const ringExt = isExt(16, 14);
    const pinkyExt = isExt(20, 18);

    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];
    const wristY = wrist.y;

    const pinchDist = Math.hypot(thumbTip.x - landmarks[8].x, thumbTip.y - landmarks[8].y);

    // 1. Thumbs Up: Thumb pointing upward, other fingers curled
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
      if (thumbTip.y < thumbIp.y && thumbIp.y < thumbMcp.y && thumbTip.y < wristY - 0.1) {
        return "THUMBS_UP";
      }
      // 2. Thumbs Down: Thumb pointing downward, other fingers curled
      if (thumbTip.y > thumbIp.y && thumbIp.y > thumbMcp.y && thumbTip.y > wristY + 0.05) {
        return "THUMBS_DOWN";
      }
      return "FIST";
    }

    // 3. Pinch: Thumb tip touching index tip
    if (pinchDist < 0.045 && !ringExt && !pinkyExt) {
      return "PINCH";
    }

    // 4. Two-finger scroll: Index and Middle extended side-by-side
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
      const fingerSpread = Math.hypot(landmarks[8].x - landmarks[12].x, landmarks[8].y - landmarks[12].y);
      if (fingerSpread < 0.08) {
        return "TWO_FINGER_SCROLL";
      }
      return "VICTORY";
    }

    // 5. Point: Only index extended
    if (indexExt && !middleExt && !ringExt && !pinkyExt) {
      return "POINT";
    }

    // 6. Open Palm: All fingers extended
    if (indexExt && middleExt && ringExt && pinkyExt) {
      return "PALM_OPEN";
    }

    return "IDLE";
  }

  /**
   * Synthesize real DOM click at air mouse coordinate
   */
  executeVirtualClick(x, y) {
    this.playSciFiTone(800, 1200);
    this.showFeedbackPill("AIR MOUSE: VIRTUAL CLICK ⚡", "🎯");

    const target = document.elementFromPoint(x, y);
    if (!target) return;

    // Dispatch pointer and click events
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));

    // If input or textarea, focus it
    if (typeof target.focus === "function") {
      target.focus();
    }
  }

  /**
   * Smooth vertical page/container scroll
   */
  executeAirScroll(deltaY) {
    window.scrollBy({ top: deltaY, behavior: "smooth" });
  }

  /**
   * Wake Cooper voice listener in HUD
   */
  wakeVoiceListener() {
    this.playSciFiTone(520, 1040);
    // Find voice mic button in HUD or call speech engine
    const micBtn = document.getElementById("speechMicBtn") || document.getElementById("micBtn");
    if (micBtn) {
      micBtn.click();
    } else if (window.voiceStudioClient && typeof window.voiceStudioClient.startRecording === "function") {
      window.voiceStudioClient.startRecording();
    }
  }

  /**
   * Dispatch action to backend gesture router and trigger local UI hooks
   */
  async triggerGestureAction(actionKey, label, icon = "⚡") {
    this.playSciFiTone(actionKey.includes("DOWN") ? 320 : 680, actionKey.includes("DOWN") ? 200 : 960);
    this.showFeedbackPill(label, icon);
    this.updateLiveBadges(actionKey);

    // If Thumbs Up or Down, also auto-click approval modals if visible
    if (actionKey === "THUMBS_UP") {
      const approveBtn = document.getElementById("approveToolBtn") || document.querySelector(".btn-approve");
      if (approveBtn) approveBtn.click();
    } else if (actionKey === "THUMBS_DOWN") {
      const denyBtn = document.getElementById("denyToolBtn") || document.querySelector(".btn-deny");
      if (denyBtn) denyBtn.click();
    }

    // Dispatch to Cooper Express gesture bridge
    try {
      await fetch("/api/gesture/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionKey }),
      });
    } catch {}
  }

  executeAction(actionKey, label, icon = "⚡") {
    this.playSciFiTone(640, 880);
    this.showFeedbackPill(label, icon);
    this.updateLiveBadges(actionKey);
  }

  executeBackAction() {
    this.playSciFiTone(350, 180);
    this.showFeedbackPill("CLOSED FIST: DISMISS / CLOSE", "✊");

    // Close any active modal
    const openModal = document.querySelector(".godseye-modal:not(.hidden), .modal:not(.hidden)");
    if (openModal) {
      openModal.classList.add("hidden");
      return;
    }

    if (window.showView) window.showView("home");
  }

  cycleView(dir) {
    const views = ["home", "studio", "sources", "settings"];
    let currentIdx = views.findIndex((v) => document.getElementById(`view-${v}`)?.classList.contains("active"));
    if (currentIdx === -1) currentIdx = 0;
    const nextIdx = (currentIdx + dir + views.length) % views.length;
    if (window.showView) window.showView(views[nextIdx]);
  }

  triggerBriefing() {
    const playBtn = document.getElementById("briefingPlayBtn") || document.getElementById("refreshBriefingBtn");
    if (playBtn) playBtn.click();
  }

  drawPipPreview(results) {
    if (!this.pipCtx || !this.pipCanvas || !this.videoEl) return;
    const ctx = this.pipCtx;
    const w = this.pipCanvas.width;
    const h = this.pipCanvas.height;

    ctx.drawImage(this.videoEl, 0, 0, w, h);

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        ctx.fillStyle = "#00f3ff";
        ctx.strokeStyle = "rgba(0, 243, 255, 0.4)";
        ctx.lineWidth = 1.5;

        // Draw connections
        for (let i = 0; i < landmarks.length; i++) {
          const pt = landmarks[i];
          const px = pt.x * w;
          const py = pt.y * h;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  playSciFiTone(freqStart, freqEnd) {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      gain.gain.setValueAtTime(0.035, now);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  showFeedbackPill(label, icon = "⚡") {
    const pill = document.getElementById("gestureHudPill");
    const labelEl = document.getElementById("gestureHudLabel");
    const iconEl = document.getElementById("gestureHudIcon");
    if (!pill || !labelEl) return;

    labelEl.textContent = label;
    if (iconEl) iconEl.textContent = icon;
    pill.classList.remove("hidden");
    pill.classList.add("pill-active");

    clearTimeout(this.pillTimeout);
    this.pillTimeout = setTimeout(() => {
      pill.classList.remove("pill-active");
      setTimeout(() => pill.classList.add("hidden"), 300);
    }, 1400);
  }

  updateLiveBadges(text) {
    const badge = document.getElementById("gestureLiveBadge");
    if (badge) {
      badge.textContent = text.replace(/_/g, " ");
      badge.style.background = "rgba(0, 243, 255, 0.4)";
      badge.style.color = "#fff";
      clearTimeout(this.badgeTimeout);
      this.badgeTimeout = setTimeout(() => {
        if (badge) {
          badge.textContent = this.isActive ? "TRACKING" : "IDLE";
          badge.style.background = "rgba(0, 243, 255, 0.15)";
          badge.style.color = "#00f3ff";
        }
      }, 1500);
    }
  }
}

export const gestureEngine = new GestureEngine();
window.gestureEngine = gestureEngine;

document.addEventListener("DOMContentLoaded", () => {
  gestureEngine.init();

  const camStartBtn = document.getElementById("gestureCamStartBtn");
  if (camStartBtn) {
    camStartBtn.addEventListener("click", async () => {
      if (gestureEngine.isActive) {
        gestureEngine.stopCamera();
        camStartBtn.textContent = "🖐️ Gestures: OFF";
        camStartBtn.style.color = "#94a3b8";
        camStartBtn.style.borderColor = "rgba(100, 116, 139, 0.4)";
      } else {
        camStartBtn.textContent = "Connecting Vision...";
        const ok = await gestureEngine.startCamera();
        if (ok) {
          camStartBtn.textContent = "🖐️ Gestures: ON";
          camStartBtn.style.color = "#00f3ff";
          camStartBtn.style.borderColor = "#00f3ff";
        } else {
          camStartBtn.textContent = "⚠️ Camera Denied";
        }
      }
    });
  }

  const pipToggleBtn = document.getElementById("toggleGesturePipBtn");
  if (pipToggleBtn) {
    pipToggleBtn.addEventListener("click", () => {
      gestureEngine.togglePip();
    });
  }
});
