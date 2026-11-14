// ── Biometric Multi-User Admin Management ──────────────────────────────
// Manages enrolled operators, camera enrollment reticle, and facial verification testing.

class BiometricAdmin {
  constructor() {
    this.enrollStream = null;
    this.enrollVideo = null;
    this.isEnrolling = false;
  }

  init() {
    this.enrollVideo = document.getElementById("enrollCamVideo");
    this.bindEvents();
  }

  bindEvents() {
    // Open Biometric Admin Modal
    const openBtn = document.getElementById("openBioAdminBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => this.open());
    }

    // Close Modal
    const closeBtn = document.getElementById("bioAdminClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    // Start Face Capture
    const startCamBtn = document.getElementById("startEnrollCamBtn");
    if (startCamBtn) {
      startCamBtn.addEventListener("click", () => this.startEnrollCamera());
    }

    // Save / Capture User
    const saveUserBtn = document.getElementById("saveEnrollUserBtn");
    if (saveUserBtn) {
      saveUserBtn.addEventListener("click", () => this.captureAndSaveUser());
    }

    // Test Face Recognition Live
    const testRecogBtn = document.getElementById("testRecogBtn");
    if (testRecogBtn) {
      testRecogBtn.addEventListener("click", () => this.testRecognitionLive());
    }
  }

  async open() {
    const modal = document.getElementById("bioAdminModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    await this.loadUsersList();
  }

  close() {
    const modal = document.getElementById("bioAdminModal");
    if (modal) modal.classList.add("hidden");
    this.stopEnrollCamera();
  }

  async loadUsersList() {
    const listContainer = document.getElementById("enrolledUsersList");
    if (!listContainer) return;

    listContainer.innerHTML = "<div class='hint'>Loading authorized profiles...</div>";

    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const users = data.users || [];

      if (users.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state" style="padding:20px;text-align:center;color:var(--text-dim);">
            <div style="font-size:32px;margin-bottom:8px;">👤</div>
            <p>No biometric operators enrolled yet.</p>
            <p class="hint">Enroll an operator below using your webcam to enable facial login.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = users
        .map(
          (u) => `
        <div class="user-card" data-user-id="${u.id}" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:46px;height:46px;border-radius:50%;overflow:hidden;background:#1a2233;border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;">
              ${
                u.avatar_thumb
                  ? `<img src="${u.avatar_thumb}" style="width:100%;height:100%;object-fit:cover;" />`
                  : `<span style="font-size:20px;">👤</span>`
              }
            </div>
            <div>
              <div style="font-weight:600;color:var(--text);">${escapeHtml(u.name)} <span class="badge" style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,243,255,0.15);color:#00f3ff;text-transform:uppercase;">${escapeHtml(u.role)}</span></div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">
                Enrolled: ${new Date(u.created_at).toLocaleDateString()} ${
            u.last_login_at ? ` · Last Login: ${new Date(u.last_login_at).toLocaleTimeString()}` : ""
          }
              </div>
            </div>
          </div>
          <div>
            <button class="header-btn delete-user-btn" data-id="${u.id}" style="color:#ff4d4f;border-color:rgba(255,77,79,0.3);" title="Remove Operator">🗑 Delete</button>
          </div>
        </div>
      `
        )
        .join("");

      // Bind delete buttons
      listContainer.querySelectorAll(".delete-user-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          if (confirm("Revoke biometric access for this operator?")) {
            await fetch(`/api/users/${id}`, { method: "DELETE" });
            if (window.faceAuth) await window.faceAuth.refreshDescriptors();
            await this.loadUsersList();
          }
        });
      });
    } catch (err) {
      listContainer.innerHTML = `<div class="modal-error">Failed to load users: ${err.message}</div>`;
    }
  }

  async startEnrollCamera() {
    this.enrollVideo = document.getElementById("enrollCamVideo");
    const container = document.getElementById("enrollCamContainer");
    const statusMsg = document.getElementById("enrollStatusMsg");

    if (!this.enrollVideo || !container) return;

    try {
      if (statusMsg) statusMsg.textContent = "Requesting webcam access...";
      container.classList.remove("hidden");

      this.enrollStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });

      this.enrollVideo.srcObject = this.enrollStream;
      await this.enrollVideo.play();

      this.isEnrolling = true;
      if (statusMsg) statusMsg.textContent = "Webcam live. Center face in the reticle and click 'Capture & Enroll'.";
    } catch (err) {
      if (statusMsg) statusMsg.innerHTML = `<span style="color:#ff4d4f;">Webcam Error: ${err.message}</span>`;
    }
  }

  stopEnrollCamera() {
    this.isEnrolling = false;
    if (this.enrollStream) {
      this.enrollStream.getTracks().forEach((t) => t.stop());
      this.enrollStream = null;
    }
    const container = document.getElementById("enrollCamContainer");
    if (container) container.classList.add("hidden");
  }

  async captureAndSaveUser() {
    const nameInput = document.getElementById("enrollUserName");
    const roleInput = document.getElementById("enrollUserRole");
    const pinInput = document.getElementById("enrollUserPin");
    const statusMsg = document.getElementById("enrollStatusMsg");
    const name = nameInput?.value?.trim();

    if (!name) {
      alert("Please enter the operator's name.");
      nameInput?.focus();
      return;
    }

    if (!this.enrollVideo || !this.isEnrolling) {
      alert("Please start the webcam first.");
      return;
    }

    try {
      if (statusMsg) statusMsg.textContent = "Extracting 128D facial embeddings...";

      // Call faceAuth capture helper
      const { descriptor, thumbnail } = await window.faceAuth.captureForEnrollment(this.enrollVideo);

      if (statusMsg) statusMsg.textContent = "Storing biometric credentials in database...";

      const res = await fetch("/api/users/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role: roleInput?.value || "operator",
          face_descriptor: descriptor,
          avatar_thumb: thumbnail,
          pin_code: pinInput?.value || null,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Enrollment failed");

      if (statusMsg) statusMsg.innerHTML = `<span style="color:#00ffc2;font-weight:700;">✓ Operator "${name}" enrolled successfully!</span>`;
      
      // Clear inputs
      if (nameInput) nameInput.value = "";
      if (pinInput) pinInput.value = "";

      // Refresh face matcher
      if (window.faceAuth) await window.faceAuth.refreshDescriptors();
      await this.loadUsersList();
      this.stopEnrollCamera();
    } catch (err) {
      if (statusMsg) statusMsg.innerHTML = `<span style="color:#ff4d4f;">Enrollment Error: ${err.message}</span>`;
    }
  }

  async testRecognitionLive() {
    const statusMsg = document.getElementById("enrollStatusMsg");
    if (!this.enrollVideo || !this.isEnrolling) {
      alert("Please start the webcam first to test recognition.");
      return;
    }

    try {
      if (statusMsg) statusMsg.textContent = "Testing live recognition against database...";
      const { descriptor } = await window.faceAuth.captureForEnrollment(this.enrollVideo);
      
      if (!window.faceAuth.matcher) {
        if (statusMsg) statusMsg.textContent = "No matcher initialized. Please enroll at least one user.";
        return;
      }

      const match = window.faceAuth.matcher.findBestMatch(new Float32Array(descriptor));
      const confidence = ((1 - match.distance) * 100).toFixed(1);

      if (match.label !== "unknown") {
        if (statusMsg) statusMsg.innerHTML = `<span style="color:#00ffc2;font-weight:700;">✓ RECOGNIZED: ${match.label} (${confidence}% match confidence)</span>`;
      } else {
        if (statusMsg) statusMsg.innerHTML = `<span style="color:#ff9800;font-weight:700;">⚠ Unknown face detected (Confidence too low).</span>`;
      }
    } catch (err) {
      if (statusMsg) statusMsg.innerHTML = `<span style="color:#ff4d4f;">Test Error: ${err.message}</span>`;
    }
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const biometricAdmin = new BiometricAdmin();
window.biometricAdmin = biometricAdmin;

document.addEventListener("DOMContentLoaded", () => {
  biometricAdmin.init();
});

