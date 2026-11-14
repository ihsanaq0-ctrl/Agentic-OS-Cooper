// ── Jarvis-CV Procedural Web Audio Synthesizer ──────────────────────
// Zero external audio files. 100% synthesized Stark-Tech audio cues
// using the Web Audio API with sub-millisecond latency.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isEnabled = true;
    this.volume = 0.15;
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  ensureContext() {
    return this.init();
  }

  createOscillator(freq, type, duration, vol = this.volume) {
    const ctx = this.ensureContext();
    if (!ctx || !this.isEnabled) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  playSelectSound() {
    this.createOscillator(1200, "sine", 0.08, 0.05);
    setTimeout(() => this.createOscillator(2000, "sine", 0.08, 0.03), 40);
  }

  playHoverSound() {
    this.createOscillator(220, "sine", 0.04, 0.015);
  }

  playEngageSound() {
    const ctx = this.ensureContext();
    if (!ctx || !this.isEnabled) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(640, ctx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  }

  playErrorSound() {
    this.createOscillator(160, "sawtooth", 0.18, 0.06);
    setTimeout(() => this.createOscillator(110, "sawtooth", 0.2, 0.06), 90);
  }

  playScanSound() {
    const ctx = this.ensureContext();
    if (!ctx || !this.isEnabled) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  playTargetLockSound() {
    // Tactical Iron Man triple chirp
    [0, 65, 130].forEach((delay, idx) => {
      setTimeout(() => {
        this.createOscillator(1800 + idx * 350, "sine", 0.05, 0.06);
      }, delay);
    });
  }

  playRepulsorBlastSound() {
    const ctx = this.ensureContext();
    if (!ctx || !this.isEnabled) return;

    try {
      const now = ctx.currentTime;
      // High sweep charge
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.18);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);

      // Low punch impact
      setTimeout(() => {
        if (!this.ctx) return;
        const lowOsc = this.ctx.createOscillator();
        const lowGain = this.ctx.createGain();
        lowOsc.type = "triangle";
        lowOsc.frequency.setValueAtTime(120, this.ctx.currentTime);
        lowOsc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

        lowGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        lowGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        lowOsc.connect(lowGain);
        lowGain.connect(this.ctx.destination);
        lowOsc.start();
        lowOsc.stop(this.ctx.currentTime + 0.3);
      }, 180);
    } catch {}
  }

  playUnlockSound() {
    // Upward harmonic progression
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, i) => {
      setTimeout(() => {
        this.createOscillator(f, "sine", 0.12, 0.05);
      }, i * 50);
    });
  }

  playPulseSound() {
    this.createOscillator(80, "sine", 0.2, 0.05);
  }

  play(cue) {
    this.init();
    switch (String(cue).toLowerCase()) {
      case "select":
        return this.playSelectSound();
      case "hover":
        return this.playHoverSound();
      case "engage":
        return this.playEngageSound();
      case "error":
        return this.playErrorSound();
      case "scan":
        return this.playScanSound();
      case "lock":
      case "target_lock":
        return this.playTargetLockSound();
      case "repulsor":
      case "blast":
        return this.playRepulsorBlastSound();
      case "unlock":
        return this.playUnlockSound();
      case "pulse":
        return this.playPulseSound();
      default:
        return this.playSelectSound();
    }
  }
}

export const soundEngine = new SoundEngine();
window.soundEngine = soundEngine;

// Unlock AudioContext on first user click anywhere and attach button feedback
if (typeof window !== "undefined") {
  const unlock = () => {
    soundEngine.init();
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock);

  // Automatic subtle sound feedback for button interactions
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, .nav-item, .chip-btn, .header-btn");
    if (btn) {
      soundEngine.playSelectSound();
    }
  });
}
