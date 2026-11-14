// ── Bare Hands Overlay — connects Cooper to the Bare Hands glass stage ──
// When clicked, opens Bare Hands in a new window. Cooper can then send cards
// to the glass board and the Bare Hands ring reflects Cooper's AI state.

class BarehandsOverlay {
  constructor() {
    this.bhWindow = null;
    this.bhPort = 8794;
    this.bhUrl = `http://127.0.0.1:${this.bhPort}/stage.html`;
    this.isRunning = false;
    this.isBooting = false;
  }

  async init() {
    // Check if Bare Hands server is running
    await this.checkStatus();

    // Bind the launch button
    const btn = document.getElementById("launchBarehandsBtn");
    if (btn) {
      btn.addEventListener("click", () => this.toggle());
      this.updateButton(btn);
    }

    // Listen for custom launch / open requests
    window.addEventListener("barehands:open", () => this.openStage());
  }

  setStatus(running) {
    this.isRunning = Boolean(running);
    this.updateButton();
  }

  onPresented(data) {
    if (this.bhWindow && !this.bhWindow.closed) {
      this.bhWindow.focus();
    }
  }

  async checkStatus() {
    try {
      const res = await fetch("/api/barehands/status");
      const data = await res.json();
      this.isRunning = data.running;
      this.updateButton();
      return data.running;
    } catch {
      this.isRunning = false;
      this.updateButton();
      return false;
    }
  }

  updateButton(btn) {
    if (!btn) btn = document.getElementById("launchBarehandsBtn");
    if (!btn) return;

    if (this.isBooting) {
      btn.textContent = "⏳ Booting Daemon...";
      btn.style.background = "rgba(245, 158, 11, 0.2)";
      btn.style.borderColor = "#f59e0b";
      btn.style.color = "#f59e0b";
    } else if (this.bhWindow && !this.bhWindow.closed) {
      btn.textContent = "🖐️ Bare Hands: LIVE";
      btn.style.background = "rgba(111, 229, 214, 0.3)";
      btn.style.borderColor = "#6fe5d6";
      btn.style.color = "#6fe5d6";
    } else if (this.isRunning) {
      btn.textContent = "🖐️ Bare Hands";
      btn.style.background = "rgba(111, 229, 214, 0.15)";
      btn.style.borderColor = "rgba(111, 229, 214, 0.6)";
      btn.style.color = "#6fe5d6";
    } else {
      btn.textContent = "🖐️ Launch Bare Hands";
      btn.style.background = "rgba(100, 116, 139, 0.15)";
      btn.style.borderColor = "rgba(100, 116, 139, 0.4)";
      btn.style.color = "#94a3b8";
    }
  }

  async toggle() {
    if (this.bhWindow && !this.bhWindow.closed) {
      this.bhWindow.focus();
      return;
    }

    if (!this.isRunning) {
      await this.startDaemonAndOpen();
    } else {
      this.openStage();
    }
  }

  async startDaemonAndOpen() {
    this.isBooting = true;
    this.updateButton();
    this.showToast("Booting Bare Hands holographic daemon...", "info");

    try {
      const res = await fetch("/api/barehands/start", { method: "POST" });
      const data = await res.json();
      this.isBooting = false;

      if (data.running) {
        this.isRunning = true;
        this.showToast("Bare Hands daemon active!", "info");
        this.openStage();
      } else {
        this.isRunning = false;
        this.updateButton();
        this.showToast(`Failed to start daemon: ${data.error || "Unknown error"}`, "error");
      }
    } catch (err) {
      this.isBooting = false;
      this.isRunning = false;
      this.updateButton();
      this.showToast(`Daemon start error: ${err.message}`, "error");
    }
  }

  openStage() {
    if (this.bhWindow && !this.bhWindow.closed) {
      this.bhWindow.focus();
      return;
    }

    this.bhWindow = window.open(
      this.bhUrl,
      "barehands",
      "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no"
    );

    if (this.bhWindow) {
      this.updateButton();

      const checkClosed = setInterval(() => {
        if (!this.bhWindow || this.bhWindow.closed) {
          clearInterval(checkClosed);
          this.bhWindow = null;
          this.updateButton();
        }
      }, 1000);

      setTimeout(() => this.presentWelcome(), 2500);
    }
  }

  async presentWelcome() {
    try {
      await fetch("/api/barehands/present", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "COOPER ONLINE",
          body: "Bare Hands connected to Cooper OS.\n\nPinch to grab • Hold still to 3D rotate\nTwo hands to scale • Flick to throw\nClap to reset • Claw to force-pull\n\nTap the ring to see your folders.",
        }),
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Send Cooper data to the Bare Hands glass board as a card
   */
  async presentCard(title, body, options = {}) {
    try {
      const cmd = { a: "add_card", title, body, ...options };
      await fetch("/api/barehands/cmd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Present a spotlight card (center stage, dimming everything else)
   */
  async spotlightCard(title, body) {
    try {
      await fetch("/api/barehands/present", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
    } catch {
      // Non-critical
    }
  }

  showToast(msg, type = "info") {
    if (typeof window.toast === "function") {
      window.toast(msg, type);
      return;
    }
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = msg;
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 4000);
    }
  }
}

export const barehandsOverlay = new BarehandsOverlay();
window.barehandsOverlay = barehandsOverlay;

document.addEventListener("DOMContentLoaded", () => {
  barehandsOverlay.init();
});
