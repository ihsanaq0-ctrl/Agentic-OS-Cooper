// ── God's Eye View: Holographic Orbital War Room Overlay ──────────────
// Manages the embedded 3D spy-satellite Earth console, tactical sensor optics
// (FLIR Thermal, NVG, CRT), quick orbit chips, intelligence layer toggles, and pop-out.

class GodsEyeOverlay {
  constructor() {
    this.modal = null;
    this.iframe = null;
    this.port = 4173;
    this.isOpen = false;
    this.isRunning = false;
    this.activeOptics = "normal";
    this.activeTarget = "Austin";

    this.targets = [
      { name: "Peshawar", lat: 34.0151, lon: 71.5249, alt: 14000 },
      { name: "Islamabad", lat: 33.6844, lon: 73.0479, alt: 14000 },
      { name: "Tokyo", lat: 35.6762, lon: 139.6503, alt: 12000 },
      { name: "New York", lat: 40.7128, lon: -74.0060, alt: 10000 },
      { name: "London", lat: 51.5074, lon: -0.1278, alt: 12000 },
      { name: "Dubai", lat: 25.2048, lon: 55.2708, alt: 11000 },
      { name: "ISS Orbit", lat: 0, lon: 0, alt: 420000 },
    ];
  }

  init() {
    console.log("[GodsEyeOverlay] Initializing Orbital War Room Overlay...");
    this.createModal();
    this.checkStatus();
  }

  createModal() {
    if (document.getElementById("godsEyeModal")) return;

    const modal = document.createElement("div");
    modal.id = "godsEyeModal";
    modal.className = "godseye-modal hidden";
    modal.innerHTML = `
      <div class="godseye-hud-header">
        <div class="godseye-head-left">
          <span class="pulse-dot active"></span>
          <span class="godseye-title">🛰️ GOD'S EYE VIEW // ORBITAL INTELLIGENCE CONSOLE</span>
          <span class="godseye-badge" id="gevStatusBadge">STANDBY</span>
        </div>
        <div class="godseye-head-right">
          <button id="gevReloadBtn" class="godseye-btn" title="Reload Orbital Stream">⟳ Reload</button>
          <button id="gevPopoutBtn" class="godseye-btn" title="Open in Dedicated Multi-Monitor Window">⧉ Pop Out</button>
          <button id="gevCloseBtn" class="godseye-btn close" title="Dismiss Orbital View">✕</button>
        </div>
      </div>

      <!-- Quick Orbit Navigation Bar -->
      <div class="godseye-orbit-bar" id="gevOrbitBar"></div>

      <!-- Main 3D Satellite Viewport -->
      <div class="godseye-viewport-wrap">
        <div class="godseye-crosshair"></div>
        <div class="godseye-scanlines"></div>
        <div id="gevLoaderScreen" class="godseye-loader-screen">
          <div class="gev-spinner"></div>
          <div class="gev-loader-text" id="gevLoaderText">ESTABLISHING ORBITAL SATELLITE UPLINK...</div>
          <div class="gev-loader-sub">CesiumJS Photorealistic Engine // Port 4173</div>
        </div>
        <iframe id="godsEyeIframe" class="godseye-frame" src="about:blank" allow="geolocation; microphone; camera"></iframe>
      </div>

      <!-- Floating Tactical Sensor Optics Dock -->
      <div class="godseye-optics-dock">
        <span class="optics-label">SENSOR OPTICS:</span>
        <button class="optics-btn active" data-optics="normal">🔘 Normal</button>
        <button class="optics-btn" data-optics="thermal">🔥 FLIR Thermal</button>
        <button class="optics-btn" data-optics="night_vision">🟢 NVG Night Vision</button>
        <button class="optics-btn" data-optics="crt">📺 CRT Tactical</button>
        <button class="optics-btn" data-optics="noir">🕶️ Noir</button>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
    this.iframe = document.getElementById("godsEyeIframe");

    // Populate quick orbit targets
    const bar = document.getElementById("gevOrbitBar");
    if (bar) {
      bar.innerHTML = this.targets
        .map((t) => `<button class="orbit-chip" data-name="${t.name}" data-lat="${t.lat}" data-lon="${t.lon}" data-alt="${t.alt}">📍 ${t.name}</button>`)
        .join("");

      bar.querySelectorAll(".orbit-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          const name = btn.dataset.name;
          const lat = Number(btn.dataset.lat);
          const lon = Number(btn.dataset.lon);
          const alt = Number(btn.dataset.alt);
          this.flyToTarget(name, lat, lon, alt);
        });
      });
    }

    // Bind Optics buttons
    modal.querySelectorAll(".optics-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.optics;
        this.setOptics(mode);
        modal.querySelectorAll(".optics-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Close, Popout and Reload
    document.getElementById("gevCloseBtn")?.addEventListener("click", () => this.close());
    document.getElementById("gevPopoutBtn")?.addEventListener("click", () => this.popOut());
    document.getElementById("gevReloadBtn")?.addEventListener("click", () => this.reload());

    // ESC to exit
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }

  showLoader(text = "ESTABLISHING ORBITAL SATELLITE UPLINK...") {
    const loader = document.getElementById("gevLoaderScreen");
    const loaderText = document.getElementById("gevLoaderText");
    if (loaderText) loaderText.textContent = text;
    if (loader) loader.classList.remove("hidden");
  }

  hideLoader() {
    const loader = document.getElementById("gevLoaderScreen");
    if (loader) loader.classList.add("hidden");
  }

  async checkStatus() {
    try {
      const res = await fetch("/api/godseye/status");
      const data = await res.json();
      this.isRunning = data.running;
      this.updateBadge(this.isRunning ? "ONLINE (KEYLESS ESRI)" : "STANDBY");
      return data.running;
    } catch {
      this.isRunning = false;
      return false;
    }
  }

  updateBadge(text) {
    const b = document.getElementById("gevStatusBadge");
    if (b) b.textContent = text;
  }

  getGevUrl() {
    const host = window.location.hostname || "127.0.0.1";
    return `http://${host}:${this.port}`;
  }

  async reload() {
    this.showLoader("RECONNECTING TO ORBITAL DAEMON...");
    if (this.iframe) this.iframe.src = "about:blank";
    await fetch("/api/godseye/start", { method: "POST" }).catch(() => {});
    await this.waitForReadyAndAttach();
  }

  async waitForReadyAndAttach() {
    const url = this.getGevUrl();
    for (let i = 0; i < 25; i++) {
      const isUp = await this.checkStatus();
      if (isUp) {
        this.isRunning = true;
        this.updateBadge("ONLINE (KEYLESS ESRI)");
        if (this.iframe) {
          this.iframe.src = url;
          this.iframe.onload = () => this.hideLoader();
          // Fallback hide after 2.5s
          setTimeout(() => this.hideLoader(), 2500);
        }
        return true;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    // If timed out, attach direct anyway
    if (this.iframe) this.iframe.src = url;
    this.hideLoader();
    return false;
  }

  async open() {
    if (!this.modal) this.createModal();
    this.isOpen = true;
    this.modal.classList.remove("hidden");
    this.showLoader("BOOTING KEYLESS ORBITAL ENGINE...");

    if (window.soundEngine) {
      window.soundEngine.play("engage");
    }

    this.updateBadge("BOOTING KEYLESS ORBITAL ENGINE...");

    try {
      await fetch("/api/godseye/start", { method: "POST" });
    } catch {}

    await this.waitForReadyAndAttach();
  }

  close() {
    if (!this.modal) return;
    this.isOpen = false;
    this.modal.classList.add("hidden");

    if (window.soundEngine) {
      window.soundEngine.play("select");
    }
  }

  popOut() {
    window.open(this.getGevUrl(), "_blank", "width=1400,height=900,menubar=no,toolbar=no");
    if (window.soundEngine) {
      window.soundEngine.play("select");
    }
  }

  flyToTarget(name, lat, lon, alt) {
    this.activeTarget = name;
    if (window.soundEngine) {
      window.soundEngine.play("scan");
    }

    fetch("/api/godseye/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "flyTo",
        location: name,
        lat,
        lon,
        altitude: alt,
      }),
    }).catch(() => {});

    // Post to iframe window directly if loaded
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage(
        { type: "gev:flyTo", location: name, lat, lon, altitude: alt },
        "*"
      );
    }
  }

  setOptics(mode) {
    this.activeOptics = mode;
    if (window.soundEngine) {
      window.soundEngine.play("scan");
    }

    fetch("/api/godseye/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setOptics", mode }),
    }).catch(() => {});

    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({ type: "gev:setOptics", mode }, "*");
    }
  }
}

export const godsEyeOverlay = new GodsEyeOverlay();
window.godsEyeOverlay = godsEyeOverlay;

document.addEventListener("DOMContentLoaded", () => {
  godsEyeOverlay.init();

  const launchBtn = document.getElementById("launchGodsEyeBtn");
  if (launchBtn) {
    launchBtn.addEventListener("click", () => godsEyeOverlay.open());
  }
});
