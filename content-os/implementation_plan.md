# Bare Hands Integration into Cooper OS

## Goal
Integrate Jared Rhodenizer's **Bare Hands** gesture engine directly INTO the Cooper OS dashboard, so that Cooper's existing HUD panels (Expenses, Tasks, Mail, Globe, Content System, Chat) become grabbable, throwable, scalable glass cards that you can manipulate with your bare hands — exactly like in the video.

## Background

Bare Hands (`stage.html`) is a 3,158-line monolithic HTML file containing:
- **MediaPipe Tasks Vision HandLandmarker** (newer, more accurate API than `@mediapipe/hands` we were using)
- **Distance-invariant pinch gates** with hysteresis (`ratio < 0.34` = pinch-in, `ratio > 0.55` = release) — tuned over weeks of live testing
- **3D CSS perspective layer** (`perspective: 1200px`) — every card can rotate in 3D space
- **The Claw** — a multi-dimensional gesture requiring hooked fingers, a C-gap, and an aim ray
- **Deliberate Clap** — both palms open + upward + rapid inward convergence
- **Velocity-based throw/fling** with momentum physics
- **Speed-aware release** — fast-moving hands need to open wider to release (prevents phantom drops)

**Critical**: The Bare Hands gesture math is far superior to our current `gestureEngine.js` because it uses **distance-invariant ratios** (finger distance / palm scale), **hysteresis gates** (different thresholds for entering vs leaving a state), and **EMA smoothing** (exponential moving averages) instead of raw frame checks.

---

## User Review Required

> [!IMPORTANT]
> **This is a massive integration** — the Bare Hands engine alone is 3,158 lines of battle-tested gesture math. We have two approaches:

### Option A: Embed Bare Hands as an Overlay Layer (Recommended)
- Keep Bare Hands running as its own transparent overlay on top of Cooper's dashboard
- Cooper's panels become glass cards that Bare Hands can manipulate
- The Bare Hands Python server (port 8794) runs alongside Cooper's Node server (port 3950)
- Cooper sends commands to Bare Hands to create/update cards, and Bare Hands sends gesture events back to Cooper
- **Pro**: Preserves the full, battle-tested 3,158 lines without touching them
- **Pro**: Get the Claw, Clap, 3D rotate, throw — all of it — immediately
- **Con**: Two servers running (Node + Python)

### Option B: Full Port — Extract Gesture Engine into Cooper's JS
- Port the entire gesture math (pinch ratios, hysteresis, claw detection, clap detection, throw physics) from `stage.html` into a new `public/hud/barehandsEngine.js`
- Replace Cooper's CSS grid with a `perspective: 1200px` layer where HUD panels become free-floating glass cards
- Use the exact same MediaPipe Tasks Vision `HandLandmarker` API (not the older `@mediapipe/hands`)
- **Pro**: Single server, single page, everything inside Cooper
- **Pro**: Tighter integration — gestures can directly control Cooper views, voice, and AI
- **Con**: Porting and testing ~2,000 lines of gesture math takes significant effort
- **Con**: Risk of losing the nuance in Jared's hand-tuned thresholds

---

## Open Questions

> [!IMPORTANT]
> 1. **Option A or Option B?** — Option A gets you working Bare Hands gestures TODAY with zero risk of breaking Jared's tuning. Option B is cleaner long-term but is a multi-day effort.
> 2. **Which Cooper panels should be grabbable?** — All of them (Expenses, Tasks, Mail, Globe, Content System, Chat)? Or start with specific ones?
> 3. **Should the Cooper Ring replace the Bare Hands ring?** — Cooper already has a 3D globe. Should it become the "ring" that Bare Hands orbs bloom from? Or keep both?

---

## Proposed Changes (Option A — Recommended)

### Phase 1: Remove Old Gesture Engine & Clean Dashboard
- [x] Remove the blue Tony Stark banner from `index.html`
- [x] Remove the gesture engine panel from `index.html`
- [ ] Remove `gestureEngine.js` script tag from `index.html` (it's now replaced)

### Phase 2: Bridge Cooper ↔ Bare Hands
#### [NEW] `server/barehands-bridge.js`
- Express middleware that proxies commands between Cooper (port 3950) and Bare Hands (port 8794)
- When Cooper AI generates content → sends `POST /cmd` to Bare Hands → card appears on glass
- When Bare Hands detects gestures → sends events to Cooper → Cooper reacts

#### [MODIFY] `server/index.js`
- Add `/api/barehands/cmd` proxy endpoint
- Add `/api/barehands/state` endpoint for Cooper's assistant state → Bare Hands ring
- Write Cooper's AI state (`idle`/`thinking`/`speaking`) to `Iron man gestures/barehands/state/state`

#### [NEW] `public/hud/barehandsOverlay.js`
- Opens Bare Hands `stage.html` in an iframe or new window layer
- Syncs Cooper's panel data as glass cards on the Bare Hands board
- Listens for Bare Hands gesture events via `postMessage`

### Phase 3: Cooper Ring Integration
#### [MODIFY] Bare Hands `barehands.json`
- Point the ring's name to "Cooper"
- Point a notes orb to Cooper's content/notes folder
- Point a media orb to Cooper's assets

### Phase 4: Unified Gesture Actions
- Map Bare Hands gestures to Cooper actions:
  - **Pinch-tap the Ring** → Bloom Cooper's sections (Expenses, Tasks, Mail, etc.) as orbs
  - **Pinch-drag a card** → Move it freely on screen
  - **Hold still 1s** → 3D rotate the card
  - **Two-hand stretch** → Scale the card bigger/smaller
  - **Flick/throw** → Dismiss the card
  - **Clap** → Reset to default dashboard layout
  - **Claw + Snap** → Force-pull a distant card to your hand

---

## Proposed Changes (Option B — Full Port)

### Phase 1: Extract Gesture Engine
#### [NEW] `public/hud/barehandsEngine.js` (~1,500 lines)
Extract from `stage.html`:
- `HandLandmarker` initialization (lines 293-294, newer API)
- Distance-invariant pinch ratio math (lines 2100-2250)
- Hysteresis + EMA smoothing (lines 2165-2210)
- Claw detection with curl dot products (lines 2353-2500)
- Clap detection with deliberate-ness checks (lines 2760-2870)
- Throw velocity + momentum physics
- Two-hand scale computation
- 3D rotate latch (hold-still → drift re-anchor)

### Phase 2: Replace Cooper's Layout
#### [MODIFY] `public/styles.css`
- Add `perspective: 1200px` to the main container
- Convert HUD panels to absolutely-positioned glass cards
- Add glass-era styling (translucent fills, luminous edges, halo text-shadows)

### Phase 3: Wire Gesture Actions
- Same gesture→action mapping as Option A

---

## Verification Plan

### Manual Verification
1. Open Cooper at `http://localhost:3950/`
2. Confirm the blue Tony Stark banner is GONE
3. Open Bare Hands at `http://127.0.0.1:8794/stage.html`
4. Confirm the ring says "COOPER" and responds to Cooper's AI state
5. Test: pinch-drag a card, 3D rotate it, throw it off screen
6. Test: clap to reset, claw to force-pull
7. Test: Cooper sends a card to the glass board
