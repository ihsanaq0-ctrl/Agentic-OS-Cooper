// ── JarvisFlow: Fingertip Gesture Mind-Mapping Canvas Overlay ────────
// Attaches 5 floating topic cards to hand landmarks (Thumb..Pinky) over webcam,
// renders kinetic Bezier connection trails, and opens holographic breakdown panels
// when nodes cross the horizontal trigger line or on click/keyboard.

class JarvisFlowOverlay {
  constructor() {
    this.modal = null;
    this.session = null;
    this.activePageIdx = 0;
    this.openNode = null;
    this.isOpen = false;
    this.svgEl = null;

    this.defaultPositions = {
      center: { x: 0.5, y: 0.35 },
      up: { x: 0.5, y: 0.14 },
      right: { x: 0.82, y: 0.38 },
      down: { x: 0.5, y: 0.72 },
      left: { x: 0.18, y: 0.38 },
    };

    this.currentPositions = { ...this.defaultPositions };
    this.animFrameId = null;
    this.isTrackingHands = false;
  }

  init() {
    this.modal = document.getElementById("jarvisFlowModal");
    this.svgEl = document.getElementById("flowSvgCanvas");

    // Header launch button
    const launchBtn = document.getElementById("launchJarvisFlowBtn");
    if (launchBtn) {
      launchBtn.addEventListener("click", () => this.open());
    }

    // Modal close button
    const closeBtn = document.getElementById("flowCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    // Detail panel close
    const detailCloseBtn = document.getElementById("flowDetailCloseBtn");
    if (detailCloseBtn) {
      detailCloseBtn.addEventListener("click", () => this.closeDetail());
    }

    // Navigation buttons
    const prevBtn = document.getElementById("flowPrevPageBtn");
    const nextBtn = document.getElementById("flowNextPageBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => this.prevPage());
    if (nextBtn) nextBtn.addEventListener("click", () => this.nextPage());

    // Node click listeners
    ["center", "up", "right", "down", "left"].forEach((dir) => {
      const el = document.getElementById(`flow-node-${dir}`);
      if (el) {
        el.addEventListener("click", () => this.triggerNode(dir));
      }
    });

    // Keyboard navigation
    window.addEventListener("keydown", (e) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") {
        if (this.openNode) this.closeDetail();
        else this.close();
      } else if (e.key === "1") this.triggerNode("center");
      else if (e.key === "2") this.triggerNode("up");
      else if (e.key === "3") this.triggerNode("right");
      else if (e.key === "4") this.triggerNode("down");
      else if (e.key === "5") this.triggerNode("left");
      else if (e.key === "ArrowRight" || e.key === "]") this.nextPage();
      else if (e.key === "ArrowLeft" || e.key === "[") this.prevPage();
    });

    // Hook into Cooper gesture loop if available
    window.addEventListener("gesture:frame", (ev) => {
      if (this.isOpen && ev.detail?.landmarks) {
        this.updateFromLandmarks(ev.detail.landmarks);
      }
    });
  }

  async open(topic = "") {
    if (!this.modal) this.modal = document.getElementById("jarvisFlowModal");
    if (!this.modal) return;

    if (window.soundEngine) window.soundEngine.play("engage");

    this.isOpen = true;
    this.modal.classList.remove("hidden");
    this.modal.style.display = "flex";

    if (topic || !this.session) {
      this.loadTopic(topic);
    } else {
      this.render();
    }

    this.startRenderLoop();
  }

  close() {
    if (!this.modal) return;
    if (window.soundEngine) window.soundEngine.play("select");
    this.isOpen = false;
    this.modal.classList.add("hidden");
    this.modal.style.display = "none";
    this.closeDetail();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }

  async loadTopic(topic = "") {
    const titleEl = document.getElementById("flowTopicTitle");
    if (titleEl) titleEl.textContent = topic ? `Brainstorming: "${topic}"...` : "Loading Neural Mind Map...";

    try {
      const res = await fetch("/api/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      this.session = data;
      this.activePageIdx = 0;
      this.render();
    } catch (err) {
      console.error("[JarvisFlow] Failed to load topic:", err);
    }
  }

  getCurrentPage() {
    if (!this.session) return null;
    if (this.activePageIdx === 0 || !this.session.pages?.length) {
      return {
        title: this.session.title || this.session.topic,
        root: this.session.root,
        directions: this.session.directions,
      };
    }
    const page = this.session.pages[this.activePageIdx - 1];
    return page || {
      title: this.session.title,
      root: this.session.root,
      directions: this.session.directions,
    };
  }

  render() {
    const page = this.getCurrentPage();
    if (!page) return;

    const titleEl = document.getElementById("flowTopicTitle");
    if (titleEl) titleEl.textContent = page.title || "JARVIS Flow Mind Map";

    const pageCount = (this.session.pages?.length || 0) + 1;
    const pageInd = document.getElementById("flowPageIndicator");
    if (pageInd) pageInd.textContent = `${this.activePageIdx + 1} / ${pageCount}`;

    // Fill node text
    this.setNodeData("center", page.root);
    this.setNodeData("up", page.directions?.up);
    this.setNodeData("right", page.directions?.right);
    this.setNodeData("down", page.directions?.down);
    this.setNodeData("left", page.directions?.left);

    this.updateNodePositionsDOM();
    this.drawTrails();
  }

  setNodeData(dir, nodeData) {
    const nodeEl = document.getElementById(`flow-node-${dir}`);
    if (!nodeEl) return;
    const labelEl = nodeEl.querySelector(".flow-node-label");
    const dirEl = nodeEl.querySelector(".flow-node-dir");

    if (labelEl && nodeData) labelEl.textContent = nodeData.label || dir.toUpperCase();
    if (dirEl) dirEl.textContent = dir === "center" ? "CORE" : dir.toUpperCase();
  }

  triggerNode(dir) {
    const page = this.getCurrentPage();
    if (!page) return;

    const nodeData = dir === "center" ? page.root : page.directions?.[dir];
    if (!nodeData) return;

    this.openNode = { dir, data: nodeData };
    if (window.soundEngine) window.soundEngine.play("select");

    const panel = document.getElementById("flowDetailPanel");
    const panelTitle = document.getElementById("flowDetailTitle");
    const panelDir = document.getElementById("flowDetailDir");
    const panelBody = document.getElementById("flowDetailBody");

    if (panelTitle) panelTitle.textContent = nodeData.label;
    if (panelDir) panelDir.textContent = dir === "center" ? "PRIMARY FOCUS" : `QUADRANT: ${dir.toUpperCase()}`;
    if (panelBody) panelBody.textContent = nodeData.content || "Deep analytical breakdown active.";

    if (panel) panel.classList.remove("hidden");
  }

  closeDetail() {
    this.openNode = null;
    const panel = document.getElementById("flowDetailPanel");
    if (panel) panel.classList.add("hidden");
  }

  nextPage() {
    const totalPages = (this.session?.pages?.length || 0) + 1;
    if (this.activePageIdx < totalPages - 1) {
      this.activePageIdx++;
      if (window.soundEngine) window.soundEngine.play("hover");
      this.closeDetail();
      this.render();
    }
  }

  prevPage() {
    if (this.activePageIdx > 0) {
      this.activePageIdx--;
      if (window.soundEngine) window.soundEngine.play("hover");
      this.closeDetail();
      this.render();
    }
  }

  /**
   * Update 5 node positions from 21 MediaPipe hand landmarks
   */
  updateFromLandmarks(landmarks) {
    if (!landmarks || landmarks.length < 21) return;

    // Center = Palm / Wrist midpoint
    const wrist = landmarks[0];
    const middleKnuckle = landmarks[9];
    const palm = { x: (wrist.x + middleKnuckle.x) / 2, y: (wrist.y + middleKnuckle.y) / 2 };

    // Up = Middle Tip (12)
    const midTip = landmarks[12];
    // Right = Pinky Tip (20)
    const pinkyTip = landmarks[20];
    // Left = Thumb Tip (4)
    const thumbTip = landmarks[4];
    // Down = Lower wrist offset
    const downPos = { x: wrist.x, y: Math.min(0.9, wrist.y + 0.15) };

    const alpha = 0.28; // smoothing
    this.smoothPos("center", palm, alpha);
    this.smoothPos("up", midTip, alpha);
    this.smoothPos("right", pinkyTip, alpha);
    this.smoothPos("left", thumbTip, alpha);
    this.smoothPos("down", downPos, alpha);

    // Trigger line check: y >= 0.82
    const triggerThreshold = 0.82;
    ["center", "up", "right", "down", "left"].forEach((dir) => {
      const pos = this.currentPositions[dir];
      if (pos.y >= triggerThreshold && (!this.openNode || this.openNode.dir !== dir)) {
        this.triggerNode(dir);
      }
    });
  }

  smoothPos(key, target, alpha) {
    if (!this.currentPositions[key]) return;
    this.currentPositions[key].x += (target.x - this.currentPositions[key].x) * alpha;
    this.currentPositions[key].y += (target.y - this.currentPositions[key].y) * alpha;
  }

  updateNodePositionsDOM() {
    ["center", "up", "right", "down", "left"].forEach((dir) => {
      const el = document.getElementById(`flow-node-${dir}`);
      const pos = this.currentPositions[dir] || this.defaultPositions[dir];
      if (el) {
        el.style.left = `${(pos.x * 100).toFixed(1)}%`;
        el.style.top = `${(pos.y * 100).toFixed(1)}%`;
      }
    });
  }

  drawTrails() {
    if (!this.svgEl) return;
    const center = this.currentPositions.center || this.defaultPositions.center;
    const paths = [];

    ["up", "right", "down", "left"].forEach((dir) => {
      const target = this.currentPositions[dir] || this.defaultPositions[dir];
      const startX = center.x * 100;
      const startY = center.y * 100;
      const endX = target.x * 100;
      const endY = target.y * 100;
      const curveX = (endX - startX) * 0.35;
      const curveY = (endY - startY) * 0.25;

      const d = `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${(startX + curveX).toFixed(1)} ${(startY + curveY).toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;
      paths.push(`<path d="${d}" class="flow-trail-line" />`);
    });

    this.svgEl.innerHTML = paths.join("");
  }

  startRenderLoop() {
    const loop = () => {
      if (!this.isOpen) return;
      this.updateNodePositionsDOM();
      this.drawTrails();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }
}

export const jarvisFlowOverlay = new JarvisFlowOverlay();
window.jarvisFlowOverlay = jarvisFlowOverlay;

document.addEventListener("DOMContentLoaded", () => {
  jarvisFlowOverlay.init();
});
