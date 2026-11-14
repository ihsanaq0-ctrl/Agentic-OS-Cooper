// ── Jarvis-CV & IronHands: 3D Holographic Arc Reactor Core ───────────
// High-fidelity procedural Mark-1 Arc Reactor in Three.js with full IronHands
// kinetic manipulation (multi-axis rotation, pan, zoom, and holographic explode).
//
// Dynamically reacts to:
// 1. Cooper's AI cognitive states (idle, listening, thinking, speaking)
// 2. IronHands kinetic hand tracking (Pinch Rotate, Fist Pan, Dynamic Zoom)
// 3. Holographic Explode / Disassembly (radially expands coils, armor & core in 3D)

import * as THREE from "three";

class ArcReactor {
  constructor() {
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Component Groups
    this.reactorGroup = null;
    this.coilsGroup = null;
    this.coilMeshes = [];
    this.outerRing = null;
    this.housing = null;
    this.innerRing = null;
    this.triangleMesh = null;
    this.coreMesh = null;
    this.particles = null;
    this.glowRings = [];

    // State & Dynamics
    this.isRunning = false;
    this.speed = 0.015;
    this.targetSpeed = 0.015;
    this.powerLevel = 1.0; // 0.0 - 1.0
    this.aiState = "idle";
    this.mode = "globe"; // globe | arc_reactor

    // IronHands 3D Spatial Transforms
    this.currentTransform = {
      x: 0,
      y: 0,
      z: 0,
      rotX: 0.22,
      rotY: -0.22,
      rotZ: 0,
      scale: 1.0,
      explodeFactor: 0.0, // 0.0 assembled -> 1.0 exploded
    };

    this.targetTransform = { ...this.currentTransform };
  }

  init(canvas) {
    if (!canvas) canvas = document.getElementById("arcReactorCanvas");
    if (!canvas) return;
    this.canvas = canvas;

    const wrap = canvas.parentElement || document.getElementById("globeClick");
    const w = wrap?.clientWidth || 360;
    const h = wrap?.clientHeight || 360;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.z = 3.6;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);

    this.buildReactor();

    window.addEventListener("resize", () => this.resize());
    if (wrap && window.ResizeObserver) {
      new ResizeObserver(() => this.resize()).observe(wrap);
    }

    // Hook assistant AI state
    window.addEventListener("assistant:state", (ev) => {
      this.setAIState(ev.detail?.state || "idle");
    });

    this.animate = this.animate.bind(this);
    this.isRunning = true;
    requestAnimationFrame(this.animate);
  }

  buildReactor() {
    this.reactorGroup = new THREE.Group();
    this.scene.add(this.reactorGroup);

    const CYAN = new THREE.Color(0x00f3ff);
    const COPPER = new THREE.Color(0xf59e0b);
    const WHITE = new THREE.Color(0xffffff);
    const DARK_STEEL = new THREE.Color(0x0a192f);

    // 1. Outer Heavy Armor Casing
    this.outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.06, 16, 64),
      new THREE.MeshBasicMaterial({ color: DARK_STEEL, wireframe: true })
    );
    this.reactorGroup.add(this.outerRing);

    // 2. Segmented Segment Housing Ring
    this.housing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.15, 64),
      new THREE.MeshBasicMaterial({ color: 0x071526, side: THREE.DoubleSide })
    );
    this.reactorGroup.add(this.housing);

    // 3. 10 Copper Electromagnetic Toroids / Coils (with individual explode anchors)
    this.coilsGroup = new THREE.Group();
    this.reactorGroup.add(this.coilsGroup);
    this.coilMeshes = [];

    const coilCount = 10;
    for (let i = 0; i < coilCount; i++) {
      const angle = (i / coilCount) * Math.PI * 2;
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.038, 12, 28),
        new THREE.MeshBasicMaterial({ color: COPPER, wireframe: false })
      );
      coil.position.x = Math.cos(angle) * 1.0;
      coil.position.y = Math.sin(angle) * 1.0;
      coil.rotation.z = angle + Math.PI / 2;
      this.coilsGroup.add(coil);

      this.coilMeshes.push({
        mesh: coil,
        baseAngle: angle,
        baseRadius: 1.0,
      });
    }

    // 4. Inner Glowing Palladium Ring
    this.innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 48),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    this.reactorGroup.add(this.innerRing);
    this.glowRings.push(this.innerRing);

    // 5. Triangular Heart Core Frame
    const triGeom = new THREE.RingGeometry(0.32, 0.52, 3);
    this.triangleMesh = new THREE.Mesh(
      triGeom,
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    this.triangleMesh.rotation.z = Math.PI; // Inverted triangle
    this.reactorGroup.add(this.triangleMesh);
    this.glowRings.push(this.triangleMesh);

    // 6. Central High-Intensity Crystallite Lens
    this.coreMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 32),
      new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.95 })
    );
    this.reactorGroup.add(this.coreMesh);

    // 7. Concentric Energy Wave Rings
    for (let r = 0; r < 3; r++) {
      const pulseRing = new THREE.Mesh(
        new THREE.RingGeometry(1.26 + r * 0.08, 1.28 + r * 0.08, 64),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      this.reactorGroup.add(pulseRing);
      this.glowRings.push(pulseRing);
    }

    // 8. Swirling Energy Particles
    const particleCount = 90;
    const particleGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const a = (i / particleCount) * Math.PI * 2;
      const rad = 0.45 + Math.random() * 0.65;
      positions[i * 3] = Math.cos(a) * rad;
      positions[i * 3 + 1] = Math.sin(a) * rad;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    particleGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    this.particles = new THREE.Points(
      particleGeom,
      new THREE.PointsMaterial({ color: CYAN, size: 0.024, transparent: true, opacity: 0.75 })
    );
    this.reactorGroup.add(this.particles);

    // Apply default starting transformation
    this.applyTransformDirect(this.currentTransform);
  }

  resize() {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const wrap = this.canvas.parentElement;
    const w = wrap?.clientWidth || 360;
    const h = wrap?.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setAIState(state) {
    this.aiState = String(state).toLowerCase();
    switch (this.aiState) {
      case "listening":
        this.targetSpeed = 0.035;
        break;
      case "thinking":
        this.targetSpeed = 0.095; // Fast turbine spin
        break;
      case "speaking":
        this.targetSpeed = 0.045;
        break;
      case "idle":
      default:
        this.targetSpeed = 0.015;
        break;
    }
  }

  setPower(level) {
    this.powerLevel = Math.max(0, Math.min(1, Number(level) / 100));
    if (this.coreMesh) {
      this.coreMesh.scale.setScalar(0.7 + this.powerLevel * 0.4);
    }
  }

  /**
   * Update IronHands 3D spatial transformation targets
   */
  setTransform(t = {}) {
    if (typeof t.x === "number") this.targetTransform.x = t.x;
    if (typeof t.y === "number") this.targetTransform.y = t.y;
    if (typeof t.z === "number") this.targetTransform.z = t.z;
    if (typeof t.rotX === "number") this.targetTransform.rotX = t.rotX;
    if (typeof t.rotY === "number") this.targetTransform.rotY = t.rotY;
    if (typeof t.rotZ === "number") this.targetTransform.rotZ = t.rotZ;
    if (typeof t.scale === "number") this.targetTransform.scale = Math.max(0.2, Math.min(4.0, t.scale));
    if (typeof t.explodeFactor === "number") {
      this.targetTransform.explodeFactor = Math.max(0.0, Math.min(1.0, t.explodeFactor));
    }
  }

  /**
   * Set holographic explode/disassembly factor (0.0 to 1.0)
   */
  setExplode(factor) {
    const ef = Math.max(0.0, Math.min(1.0, Number(factor) || 0));
    this.targetTransform.explodeFactor = ef;
  }

  /**
   * Toggle explode factor between 0.0 and 0.85
   */
  toggleExplode() {
    const next = this.targetTransform.explodeFactor > 0.1 ? 0.0 : 0.85;
    this.setExplode(next);
    if (window.soundEngine) {
      window.soundEngine.play(next > 0 ? "repulsor" : "lock");
    }
    fetch("/api/ironhands/explode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factor: next, target: "arc_reactor" }),
    }).catch(() => {});
    return next;
  }

  /**
   * Reset 3D transformation to default position
   */
  resetTransform() {
    this.targetTransform = {
      x: 0,
      y: 0,
      z: 0,
      rotX: 0.22,
      rotY: -0.22,
      rotZ: 0,
      scale: 1.0,
      explodeFactor: 0.0,
    };
    if (window.soundEngine) {
      window.soundEngine.play("select");
    }
  }

  applyTransformDirect(t) {
    if (!this.reactorGroup) return;
    this.reactorGroup.position.set(t.x, t.y, t.z);
    this.reactorGroup.rotation.set(t.rotX, t.rotY, t.rotZ);
  }

  setMode(mode) {
    this.mode = mode === "arc_reactor" ? "arc_reactor" : "globe";
    const globeEl = document.getElementById("globeCanvas");
    const arcEl = document.getElementById("arcReactorCanvas");
    const toggleBtn = document.getElementById("hudModeToggle");

    if (this.mode === "arc_reactor") {
      if (globeEl) globeEl.classList.add("hidden");
      if (arcEl) arcEl.classList.remove("hidden");
      if (toggleBtn) {
        toggleBtn.textContent = "🌍 Show Globe";
        toggleBtn.style.color = "#6fe5d6";
        toggleBtn.style.borderColor = "rgba(111, 229, 214, 0.6)";
      }
      this.resize();
    } else {
      if (arcEl) arcEl.classList.add("hidden");
      if (globeEl) globeEl.classList.remove("hidden");
      if (toggleBtn) {
        toggleBtn.textContent = "⚡ Arc Reactor";
        toggleBtn.style.color = "#f59e0b";
        toggleBtn.style.borderColor = "rgba(245, 158, 11, 0.6)";
      }
    }
  }

  toggleMode() {
    const nextMode = this.mode === "arc_reactor" ? "globe" : "arc_reactor";
    this.setMode(nextMode);
    fetch("/api/hud/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: nextMode }),
    }).catch(() => {});
    if (window.soundEngine) {
      window.soundEngine.play(nextMode === "arc_reactor" ? "engage" : "select");
    }
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate);

    // Ease speed
    this.speed += (this.targetSpeed - this.speed) * 0.06;

    // Rotate coils and particles
    if (this.coilsGroup) this.coilsGroup.rotation.z += this.speed;
    if (this.particles) this.particles.rotation.z -= this.speed * 1.4;

    // Smooth lerp kinetic transforms (IronHands damping)
    const lerp = (a, b, factor = 0.12) => a + (b - a) * factor;
    const ct = this.currentTransform;
    const tt = this.targetTransform;

    ct.x = lerp(ct.x, tt.x);
    ct.y = lerp(ct.y, tt.y);
    ct.z = lerp(ct.z, tt.z);
    ct.rotX = lerp(ct.rotX, tt.rotX);
    ct.rotY = lerp(ct.rotY, tt.rotY);
    ct.rotZ = lerp(ct.rotZ, tt.rotZ);
    ct.scale = lerp(ct.scale, tt.scale);
    ct.explodeFactor = lerp(ct.explodeFactor, tt.explodeFactor);

    // Breathing pulse
    const now = performance.now() / 1000;
    const breath = 1 + Math.sin(now * (this.aiState === "thinking" ? 8 : 2.5)) * 0.04 * this.powerLevel;

    if (this.reactorGroup) {
      this.reactorGroup.position.set(ct.x, ct.y, ct.z);
      this.reactorGroup.rotation.set(ct.rotX, ct.rotY, ct.rotZ);
      this.reactorGroup.scale.setScalar(breath * ct.scale);
    }

    // Holographic Explode / Disassembly in 3D Space
    const ef = ct.explodeFactor;

    // 1. Outer armor casing pulls backward along Z and expands
    if (this.outerRing) {
      this.outerRing.position.z = -ef * 0.45;
      this.outerRing.scale.setScalar(1 + ef * 0.22);
    }

    // 2. Segmented housing ring steps slightly back
    if (this.housing) {
      this.housing.position.z = -ef * 0.18;
      this.housing.scale.setScalar(1 + ef * 0.15);
    }

    // 3. 10 Coils push outward radially and tilt forward
    if (this.coilMeshes && this.coilMeshes.length) {
      for (const c of this.coilMeshes) {
        const r = c.baseRadius + ef * 0.65;
        c.mesh.position.x = Math.cos(c.baseAngle) * r;
        c.mesh.position.y = Math.sin(c.baseAngle) * r;
        c.mesh.position.z = ef * 0.35;
        c.mesh.rotation.x = ef * 0.4 * Math.sin(c.baseAngle);
        c.mesh.rotation.y = ef * 0.4 * Math.cos(c.baseAngle);
      }
    }

    // 4. Inner glowing ring floats forward
    if (this.innerRing) {
      this.innerRing.position.z = ef * 0.38;
    }

    // 5. Triangle core frame elevates
    if (this.triangleMesh) {
      this.triangleMesh.position.z = ef * 0.62;
    }

    // 6. Central crystal lens pushes forward
    if (this.coreMesh) {
      this.coreMesh.position.z = ef * 0.88;
      this.coreMesh.scale.setScalar((0.7 + this.powerLevel * 0.4) * (1 + ef * 0.35));
    }

    // 7. Particle cloud expands
    if (this.particles) {
      this.particles.scale.setScalar(1 + ef * 0.65);
    }

    if (this.renderer && this.scene && this.camera && this.mode === "arc_reactor") {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

export const arcReactor = new ArcReactor();
window.arcReactor = arcReactor;

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("arcReactorCanvas");
  if (canvas) {
    arcReactor.init(canvas);
  }

  const toggleBtn = document.getElementById("hudModeToggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => arcReactor.toggleMode());
  }
});
