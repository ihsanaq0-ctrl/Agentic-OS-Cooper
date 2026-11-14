# 🤖 Tony Stark / Jarvis Gesture Control & Multi-User Face Biometrics

Comprehensive Architectural Blueprint & Implementation Plan for **Agentic OS (Cooper)**.

---

## 🎯 Executive Summary & Objectives

This plan details the implementation of a **Tony Stark / Jarvis-level interaction and security system** for Agentic OS (Cooper) based on the local computer vision repositories in `content-os/Iron man gestures/`:

1. **Invisible Hand Gesture Control**:
   - Control Cooper HUD, 3D Globe, view navigation, and system commands via real-time webcam hand tracking.
   - **Strict Requirement**: The hand landmarks/dots and skeleton connectors must be **100% invisible** on screen. Detection runs silently in memory without rendering visual dots over the user's hands.
   - Core gestures: **Open Palm Swipe** (switch views), **Two-Hand Pinch** (zoom 3D globe/HUD), **Fist / Grab** (rotate globe / mute audio), **Victory ✌️** (toggle System Mode), **Open Palm Hold** (summon proactive briefing).

2. **Multi-User Facial Recognition & Biometric Lock**:
   - Powered by `face-api.js` (weights and pre-built distribution locally available).
   - Multi-user enrollment and storage in SQLite database (`users` table).
   - **Admin Management Portal**: Add, preview, test, and delete authorized users with instant facial embedding extraction.
   - **Stark-Tech Biometric Lock Screen**: Automatically protects Cooper on startup/idle. Locks interface until an enrolled face is recognized. On positive recognition, plays futuristic Jarvis greeting voice (*"Welcome back, Ihsan. Cooper systems initialized."*) and unlocks the OS.

---

## 🧱 Architectural Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AGENTIC OS (HUD / WEB)                          │
├──────────────────────────────────────┬──────────────────────────────────────┤
│           LOCK SCREEN LAYER          │          MAIN HUD & OS LAYER         │
│   • face-api.js Neural Matcher       │   • Invisible MediaPipe Gesture Engine│
│   • Local weights (/models/face/)    │   • Off-screen canvas (No dots/mesh) │
│   • Real-time Face Descriptor (128D) │   • Gesture -> Event Bus -> Actions  │
│   • Unlocks OS upon identity match   │   • Cooper 3D Globe & Tabs Control   │
└──────────────────┬───────────────────┴──────────────────┬───────────────────┘
                   │                                      │
                   ▼                                      ▼
       ┌───────────────────────────┐          ┌───────────────────────────┐
       │   Express Server API      │          │   Local Face-API Assets   │
       ├───────────────────────────┤          ├───────────────────────────┤
       │ • GET /api/users          │          │ • /vendor/face-api/       │
       │ • POST /api/users/enroll  │          │ • /models/face/           │
       │ • DELETE /api/users/:id   │          │   (ssd_mobilenet, tiny,   │
       │ • POST /api/auth/verify   │          │    landmarks, recognition)│
       └─────────────┬─────────────┘          └───────────────────────────┘
                     │
                     ▼
       ┌───────────────────────────┐
       │   SQLite Database (db.js) │
       │   Table: `users`          │
       │   - 128D face descriptor  │
       │   - avatar thumbnail      │
       │   - role & permissions    │
       └───────────────────────────┘
```

---

## 📋 Comprehensive Todo List

### Phase 1: Database & Server Infrastructure (Multi-User Face API)
- [ ] **1.1. Database Schema (`server/db.js`)**:
  - Add `users` table with fields: `id`, `name`, `role`, `face_descriptor` (JSON 128-float array), `avatar_thumb`, `pin_code`, `enabled`, `created_at`, `last_login_at`.
  - Add database functions: `listUsers()`, `getUser(id)`, `createUser(...)`, `deleteUser(id)`, `updateUserLogin(id)`, `getUserCount()`, `getAllFaceDescriptors()`.
- [ ] **1.2. Static Asset Routes (`server/index.js`)**:
  - Expose `/vendor/face-api` to serve `content-os/Iron man gestures/face-api.js/dist/`.
  - Expose `/models/face` to serve `content-os/Iron man gestures/face-api.js/weights/`.
- [ ] **1.3. REST Endpoints (`server/index.js`)**:
  - `GET /api/users` — List enrolled users (metadata + avatar).
  - `GET /api/users/descriptors` — Retrieve enrolled 128D descriptors for client-side matcher.
  - `POST /api/users/enroll` — Enroll new user with face descriptor & avatar snapshot.
  - `DELETE /api/users/:id` — Delete enrolled user.
  - `POST /api/auth/face-login` — Verify match on server, update login timestamp, establish session.
  - `POST /api/auth/pin-login` — Backup PIN authentication bypass.
  - `GET /api/auth/status` — Return current lock / authentication status.
  - `POST /api/auth/lock` — Instantly engage lock screen.

### Phase 2: Biometric Face Authentication & Lock Screen
- [ ] **2.1. Face Recognition Module (`public/face/faceAuth.js`)**:
  - Load `face-api.min.js` and models (`ssdMobilenetv1` or `tinyFaceDetector`, `faceLandmark68Net`, `faceRecognitionNet`) from local `/models/face/`.
  - Build `faceapi.FaceMatcher` using enrolled descriptors.
  - Continuous webcam stream processing: detect single face -> compute descriptor -> find match.
  - Trigger unlock sequence when Euclidean distance is under confidence threshold (< 0.45).
- [ ] **2.2. Stark-Tech Lock Screen Overlay (`public/index.html` & `public/styles.css`)**:
  - Sci-fi biometric visor overlay on boot if users are enrolled.
  - Live scanning reticle, subtle camera HUD, and status text (*"IDENTIFYING OPERATOR..."*).
  - Voice feedback upon match: *"Welcome back, Ihsan. Cooper systems online."*
  - Emergency PIN keypad bypass modal.

### Phase 3: Admin User Management Portal
- [ ] **3.1. Admin UI Section (`public/index.html` & `public/admin/admin.js`)**:
  - New "Security & Biometrics" modal or dedicated Admin view.
  - Enrolled user cards with avatar snapshot, name, role badge, last login time, and delete button.
- [ ] **3.2. Live Face Enrollment Workflow**:
  - Camera modal with circular face guide and real-time detection feedback.
  - One-click "Capture & Enroll" button: extracts 128D vector, grabs low-res thumbnail, saves to server.
  - Immediate verification test: verifies that the newly enrolled face is recognized instantly.

### Phase 4: Invisible Tony Stark Gesture Engine
- [ ] **4.1. Headless Gesture Tracker (`public/hud/gestureEngine.js`)**:
  - MediaPipe Hands integration (single or dual hand mode).
  - **Invisibility Principle**: Processing happens on an off-screen/hidden canvas. **No landmark dots, lines, or skeleton graphics are drawn over hands or on the UI**.
  - Lightweight background loop with configurable frame rate (30fps) for minimal CPU/GPU overhead.
- [ ] **4.2. Mathematical Gesture Classifier**:
  - **Open Palm Swipe (Left / Right)**: Measures palm center delta across consecutive frames with cooldown.
  - **Two-Hand Pinch / Zoom**: Calculates distance delta between left and right index/thumb tips to zoom globe or HUD.
  - **Fist / Grab**: Checks fingertip distances to wrist/PIP joints. Used to rotate the Cooper globe or mute active audio.
  - **Victory Sign (✌️)**: Index & middle extended, ring & pinky curled. Toggles System Mode.
  - **Open Palm Hold (3s)**: Triggers Cooper proactive morning/evening briefing.
- [ ] **4.3. HUD Feedback & Integration (`public/hud/hud.js` & `public/hud/globe.js`)**:
  - Optional subtle holographic HUD pill in bottom corner (e.g. `⚡ [SWIPE RIGHT]`, `⚡ [PINCH]`) that fades out after 1.5s.
  - Web Audio API sci-fi sound effects on gesture trigger (inspired by `Jarvis-CV/src/utils/audio.ts`).

### Phase 5: Verification, Testing & Polish
- [ ] **5.1. Integration Test Suite**:
  - Create `scripts/test-face-and-gestures.js` testing user enrollment API, descriptor validation, and authentication endpoints.
- [ ] **5.2. Browser End-to-End Test**:
  - Test model loading speeds from `/models/face/`.
  - Validate face recognition matching accuracy and false-rejection rates.
  - Verify gesture responsiveness without frame drops or visual dots.
