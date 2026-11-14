// ── IronHands: Kinetic 3D Spatial Manipulation Controller ──────────────
// Manages real-time multi-axis transformation, hand-tracking math,
// Stark kinetic telemetry HUD readout, and holographic explode disassembly.

class IronHandsController {
  constructor() {
    this.activeTarget = "arc_reactor"; // "arc_reactor" | "globe"
    this.gripState = "FREE";           // "FREE" | "PINCH" | "FIST_LOCKED" | "EXPLODING"
    this.isEnabled = true;

    // Current transformation state
    this.transform = {
      x: 0,
      y: 0,
      z: 0,
      rotX: 0.22,
      rotY: -0.22,
      rotZ: 0,
      scale: 1.0,
      explodeFactor: 0.0,
    };

    // Tracking anchors
    this.lastPalmPos = null;
    this.lastPinchDist = null;
    this.lastTwoHandDist = null;
    this.lastSyncTime = 0;

    // UI Elements
    this.telemetryEl = null;
  }

  init() {
    console.log("[IronHands] Initializing Kinetic 3D Spatial Controller...");
    this.createTelemetryWidget();
    this.setupMouseFallback();
    this.syncWithServer();

    document.getElementById("hudExplodeBtn")?.addEventListener("click", () => this.toggleExplode());
  }

  /**
   * Set target 3D model
   */
  setTarget(target) {
    const norm = String(target || "").toLowerCase();
    this.activeTarget = norm.includes("globe") ? "globe" : "arc_reactor";
    this.updateTelemetryUI();

    if (window.arcReactor && typeof window.arcReactor.setMode === "function") {
      window.arcReactor.setMode(this.activeTarget);
    }

    if (window.soundEngine) {
      window.soundEngine.play("select");
    }
  }

  /**
   * Ingest gesture landmarks directly from gestureEngine
   */
  processHandTracking(results) {
    if (!this.isEnabled) return;
    const multiLandmarks = results.multiHandLandmarks;

    if (!multiLandmarks || multiLandmarks.length === 0) {
      this.lastPalmPos = null;
      this.lastPinchDist = null;
      this.lastTwoHandDist = null;
      if (this.gripState !== "FREE") {
        this.setGripState("FREE");
      }
      return;
    }

    // ── DUAL-HAND GESTURE: HOLOGRAPHIC EXPLODE DISASSEMBLY ──────────
    if (multiLandmarks.length >= 2) {
      const h1 = multiLandmarks[0];
      const h2 = multiLandmarks[1];
      const currentDist = Math.hypot(h1[9].x - h2[9].x, h1[9].y - h2[9].y);

      if (this.lastTwoHandDist !== null) {
        const delta = currentDist - this.lastTwoHandDist;
        // Spreading hands apart explodes components; pulling together reassembles
        if (Math.abs(delta) > 0.015) {
          this.setGripState("EXPLODING");
          const nextExplode = Math.max(0.0, Math.min(1.0, this.transform.explodeFactor + delta * 3.5));
          this.setExplodeFactor(nextExplode);
        }
      }
      this.lastTwoHandDist = currentDist;
      return;
    } else {
      this.lastTwoHandDist = null;
    }

    // ── SINGLE-HAND KINETIC MANIPULATION ───────────────────────────
    const lm = multiLandmarks[0];
    const palmX = lm[9].x;
    const palmY = lm[9].y;

    // Detect posture
    const isPinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) < 0.06;
    const isFist = lm[8].y > lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y;

    // 1. CLOSED FIST: 3D TRANSLATION / PAN
    if (isFist) {
      this.setGripState("FIST_LOCKED");
      if (this.lastPalmPos) {
        const dx = (palmX - this.lastPalmPos.x) * 3.2;
        const dy = (this.lastPalmPos.y - palmY) * 3.2; // Invert screen Y

        this.transform.x = Math.max(-2.2, Math.min(2.2, this.transform.x + dx));
        this.transform.y = Math.max(-1.8, Math.min(1.8, this.transform.y + dy));
        this.applyTransform();
      }
      this.lastPalmPos = { x: palmX, y: palmY };
      return;
    }

    // 2. PINCH: MULTI-AXIS ROTATION (PITCH & YAW)
    if (isPinch) {
      this.setGripState("PINCH");
      if (this.lastPalmPos) {
        const dYaw = (palmX - this.lastPalmPos.x) * 4.5;
        const dPitch = (palmY - this.lastPalmPos.y) * 4.5;

        this.transform.rotY += dYaw;
        this.transform.rotX += dPitch;
        this.applyTransform();
      }
      this.lastPalmPos = { x: palmX, y: palmY };
      return;
    }

    // Hand open / idle
    this.setGripState("FREE");
    this.lastPalmPos = null;
    this.lastPinchDist = null;
  }

  setGripState(state) {
    if (this.gripState === state) return;
    const prevState = this.gripState;
    this.gripState = state;
    this.updateTelemetryUI();

    if (window.soundEngine) {
      if (state === "FIST_LOCKED" && prevState !== "FIST_LOCKED") {
        window.soundEngine.play("lock");
      } else if (state === "EXPLODING" && prevState !== "EXPLODING") {
        window.soundEngine.play("pulse");
      }
    }
  }

  setExplodeFactor(factor) {
    this.transform.explodeFactor = Math.max(0.0, Math.min(1.0, factor));
    this.applyTransform();
  }

  toggleExplode() {
    const next = this.transform.explodeFactor > 0.1 ? 0.0 : 0.85;
    this.setExplodeFactor(next);
    if (window.soundEngine) {
      window.soundEngine.play(next > 0 ? "repulsor" : "lock");
    }
    this.notifyServer();
    return next;
  }

  reset() {
    this.transform = {
      x: 0,
      y: 0,
      z: 0,
      rotX: 0.22,
      rotY: -0.22,
      rotZ: 0,
      scale: 1.0,
      explodeFactor: 0.0,
    };
    this.setGripState("FREE");
    this.applyTransform();

    if (window.soundEngine) {
      window.soundEngine.play("select");
    }

    this.notifyServer();
  }

  applyTransform() {
    // 1. If Arc Reactor active
    if (window.arcReactor && typeof window.arcReactor.setTransform === "function") {
      window.arcReactor.setTransform(this.transform);
    }

    // 2. If Globe active
    if (this.activeTarget === "globe" && window.cooperGlobe) {
      if (typeof window.cooperGlobe.rotate === "function") {
        window.cooperGlobe.rotate(this.transform.rotY * 0.05, this.transform.rotX * 0.05);
      }
    }

    this.updateTelemetryUI();

    // Throttled server notify
    const now = Date.now();
    if (now - this.lastSyncTime > 400) {
      this.lastSyncTime = now;
      this.notifyServer();
    }
  }

  notifyServer() {
    fetch("/api/ironhands/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: this.activeTarget,
        delta: this.transform,
        gripState: this.gripState,
      }),
    }).catch(() => {});
  }

  syncWithServer() {
    fetch("/api/ironhands/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.transform) {
          this.transform = { ...this.transform, ...data.transform };
          this.activeTarget = data.target || "arc_reactor";
          this.applyTransform();
        }
      })
      .catch(() => {});
  }

  /**
   * Mouse / Drag controls fallback on the 3D viewport
   */
  setupMouseFallback() {
    const wrap = document.getElementById("globeClick");
    if (!wrap) return;

    let isDragging = false;
    let dragMode = "rotate"; // rotate (left click) or pan (right click / shift)
    let startX = 0;
    let startY = 0;

    wrap.addEventListener("mousedown", (e) => {
      // Don't intercept clicks on buttons or inputs
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dragMode = e.shiftKey || e.button === 2 ? "pan" : "rotate";
      this.setGripState(dragMode === "pan" ? "FIST_LOCKED" : "PINCH");
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = (e.clientX - startX) * 0.008;
      const dy = (e.clientY - startY) * 0.008;
      startX = e.clientX;
      startY = e.clientY;

      if (dragMode === "rotate") {
        this.transform.rotY += dx * 2.0;
        this.transform.rotX += dy * 2.0;
      } else {
        this.transform.x += dx * 1.5;
        this.transform.y -= dy * 1.5;
      }
      this.applyTransform();
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.setGripState("FREE");
      }
    });

    // Wheel zoom
    wrap.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.08 : 0.08;
      this.transform.scale = Math.max(0.4, Math.min(3.0, this.transform.scale + zoomDelta));
      this.applyTransform();
    }, { passive: false });
  }

  /**
   * Stark Kinetic Telemetry HUD Widget
   */
  createTelemetryWidget() {
    if (document.getElementById("ironhandsTelemetry")) return;

    const wrap = document.querySelector(".globe-stage") || document.getElementById("globeClick");
    if (!wrap) return;

    const widget = document.createElement("div");
    widget.id = "ironhandsTelemetry";
    widget.className = "ironhands-hud-widget";
    widget.innerHTML = `
      <div class="ih-hud-head">
        <span class="ih-tag">IRONHANDS KINETIC HUD</span>
        <span class="ih-grip-badge" id="ihGripBadge">FREE</span>
      </div>
      <div class="ih-readouts">
        <div class="ih-row">
          <span>TARGET</span>
          <b id="ihTargetVal">ARC REACTOR</b>
        </div>
        <div class="ih-row">
          <span>PAN X/Y</span>
          <b id="ihPanVal">+0.00 / +0.00</b>
        </div>
        <div class="ih-row">
          <span>ROT (YAW/PITCH)</span>
          <b id="ihRotVal">-12° / +12°</b>
        </div>
        <div class="ih-row">
          <span>SCALE</span>
          <b id="ihScaleVal">1.00x</b>
        </div>
        <div class="ih-row">
          <span>EXPLODE</span>
          <b id="ihExplodeVal">0%</b>
        </div>
      </div>
      <div class="ih-quick-actions">
        <button id="ihExplodeBtn" class="ih-btn" title="Toggle Disassembly Explode">💥 Explode</button>
        <button id="ihResetBtn" class="ih-btn" title="Reset Spatial Alignment">↺ Reset</button>
      </div>
    `;

    wrap.appendChild(widget);
    this.telemetryEl = widget;

    document.getElementById("ihExplodeBtn")?.addEventListener("click", () => this.toggleExplode());
    document.getElementById("ihResetBtn")?.addEventListener("click", () => this.reset());
    this.updateTelemetryUI();
  }

  updateTelemetryUI() {
    const gripEl = document.getElementById("ihGripBadge");
    const targetEl = document.getElementById("ihTargetVal");
    const panEl = document.getElementById("ihPanVal");
    const rotEl = document.getElementById("ihRotVal");
    const scaleEl = document.getElementById("ihScaleVal");
    const explodeEl = document.getElementById("ihExplodeVal");
    const explodeBtn = document.getElementById("ihExplodeBtn");

    if (gripEl) {
      gripEl.textContent = this.gripState;
      gripEl.className = `ih-grip-badge grip-${this.gripState.toLowerCase()}`;
    }
    if (targetEl) {
      targetEl.textContent = this.activeTarget === "arc_reactor" ? "ARC REACTOR" : "TACTICAL GLOBE";
    }
    if (panEl) {
      const signX = this.transform.x >= 0 ? "+" : "";
      const signY = this.transform.y >= 0 ? "+" : "";
      panEl.textContent = `${signX}${this.transform.x.toFixed(2)} / ${signY}${this.transform.y.toFixed(2)}`;
    }
    if (rotEl) {
      const degX = Math.round((this.transform.rotX * 180) / Math.PI);
      const degY = Math.round((this.transform.rotY * 180) / Math.PI);
      rotEl.textContent = `${degY >= 0 ? "+" : ""}${degY}° / ${degX >= 0 ? "+" : ""}${degX}°`;
    }
    if (scaleEl) {
      scaleEl.textContent = `${this.transform.scale.toFixed(2)}x`;
    }
    if (explodeEl) {
      const pct = Math.round(this.transform.explodeFactor * 100);
      explodeEl.textContent = `${pct}%`;
      explodeEl.style.color = pct > 0 ? "#f59e0b" : "#94a3b8";
    }
    if (explodeBtn) {
      explodeBtn.textContent = this.transform.explodeFactor > 0.1 ? "⚡ Assemble" : "💥 Explode";
    }
  }
}

export const ironHandsController = new IronHandsController();
window.ironHandsController = ironHandsController;

document.addEventListener("DOMContentLoaded", () => {
  ironHandsController.init();
});
