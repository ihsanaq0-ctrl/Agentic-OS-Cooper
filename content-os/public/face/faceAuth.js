// ── Biometric Presence Detection (MediaPipe) ───────────────────
import { FaceDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

class FaceAuthEngine {
  constructor() {
    this.detector = null;
    this.stream = null;
    this.videoEl = null;
    this.isScanning = false;
    this.isAuthenticated = false;
    this.scanInterval = null;
  }

  async loadModels() {
    if (this.detector) return true;
    try {
      console.log("[Presence] Loading MediaPipe Face Detector...");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      this.detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "VIDEO"
      });
      console.log("[Presence] MediaPipe Face Detector loaded.");
      return true;
    } catch (err) {
      console.error("[Presence] Failed to load MediaPipe:", err);
      return false;
    }
  }

  async init() {
    try {
      const res = await fetch("/api/auth/status");
      const status = await res.json();
      const forceLock = window.location.search.includes("lock=1");

      if (!forceLock && (!status.authRequired || status.userCount === 0)) {
        console.log("[Presence] No lock required.");
        this.hideLockScreen();
        return;
      }

      this.showLockScreen();
      await this.startBiometricScanner();
    } catch (err) {
      console.error("[Presence] Init error:", err);
    }
  }

  async startBiometricScanner() {
    if (this.isScanning) return;
    await this.loadModels();

    this.videoEl = document.getElementById("lockCamVideo");
    const statusEl = document.getElementById("lockStatusText");

    if (!this.videoEl) return;

    try {
      if (statusEl) statusEl.textContent = "INITIALIZING SENSORS...";
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();

      this.isScanning = true;
      if (statusEl) statusEl.textContent = "SCANNING FOR OPERATOR PRESENCE...";

      let lastVideoTime = -1;
      const scanLoop = () => {
        if (!this.isScanning) return;
        if (this.videoEl.currentTime !== lastVideoTime && this.detector) {
          lastVideoTime = this.videoEl.currentTime;
          const detections = this.detector.detectForVideo(this.videoEl, performance.now());
          this.handleDetections(detections);
        }
        requestAnimationFrame(scanLoop);
      };
      scanLoop();

    } catch (err) {
      console.error("[Presence] Camera error:", err);
      if (statusEl) statusEl.innerHTML = "<span style='color:#ff4d4f;'>CAMERA OFFLINE</span>";
    }
  }

  handleDetections(result) {
    const statusEl = document.getElementById("lockStatusText");
    const reticle = document.getElementById("lockReticle");

    if (result.detections.length > 0) {
      // Face detected!
      if (reticle) reticle.classList.add("reticle-tracking");
      
      const face = result.detections[0];
      // Require a bit of confidence
      if (face.categories[0].score > 0.6) {
        this.onAuthenticationSuccess("Operator");
      }
    } else {
      if (reticle) reticle.classList.remove("reticle-tracking");
      if (statusEl) statusEl.textContent = "AWAITING OPERATOR IN VIEW...";
    }
  }

  async onAuthenticationSuccess(userName) {
    if (this.isAuthenticated) return;
    this.isAuthenticated = true;
    this.stopScanner();

    const statusEl = document.getElementById("lockStatusText");
    const reticle = document.getElementById("lockReticle");

    if (reticle) {
      reticle.classList.remove("reticle-tracking");
      reticle.classList.add("reticle-success");
    }
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#00ffc2;font-weight:700;">PRESENCE VERIFIED</span><br><span style="font-size:11px;opacity:0.8;">INITIALIZING COOPER SYSTEMS...</span>`;
    }

    try {
      await fetch("/api/auth/face-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userName }),
      });
    } catch (err) {}

    setTimeout(() => {
      this.hideLockScreen();
      window.dispatchEvent(new CustomEvent("cooper:unlocked", { detail: { userName } }));
    }, 1000);
  }

  stopScanner() {
    this.isScanning = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  showLockScreen() {
    const lockScreen = document.getElementById("biometricLockScreen");
    if (lockScreen) {
      lockScreen.classList.remove("hidden");
      lockScreen.style.display = "flex";
    }
  }

  hideLockScreen() {
    const lockScreen = document.getElementById("biometricLockScreen");
    if (lockScreen) {
      lockScreen.classList.add("hidden");
      lockScreen.style.display = "none";
    }
  }

  lock() {
    this.isAuthenticated = false;
    this.showLockScreen();
    this.startBiometricScanner();
  }
}

export const faceAuth = new FaceAuthEngine();
window.faceAuth = faceAuth;

document.addEventListener("DOMContentLoaded", () => {
  const manualLockBtn = document.getElementById("manualLockBtn");
  if (manualLockBtn) manualLockBtn.addEventListener("click", () => faceAuth.lock());

  const pinToggleBtn = document.getElementById("lockPinBypassBtn");
  const pinModal = document.getElementById("lockPinModal");
  if (pinToggleBtn && pinModal) {
    pinToggleBtn.addEventListener("click", () => pinModal.classList.toggle("hidden"));
  }

  const pinSubmitBtn = document.getElementById("lockPinSubmit");
  const pinInput = document.getElementById("lockPinInput");
  if (pinSubmitBtn && pinInput) {
    pinSubmitBtn.addEventListener("click", async () => {
      const pin = pinInput.value.trim();
      if (!pin) return;
      try {
        const res = await fetch("/api/auth/pin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          faceAuth.onAuthenticationSuccess(data.user?.name || "Operator");
        } else {
          alert(data.error || "Incorrect PIN code");
        }
      } catch (err) {
        alert("PIN verification failed: " + err.message);
      }
    });
  }

  faceAuth.init();
});
