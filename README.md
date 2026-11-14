# ⚡ Agentic OS — Cooper (Stark Butler Edition)

<div align="center">

![Agentic OS Cooper Banner](https://img.shields.io/badge/Agentic_OS-Cooper_v1.0-00f2fe?style=for-the-badge&logo=electron&logoColor=black)
![Node.js Version](https://img.shields.io/badge/node.js-v20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)
![MediaPipe Hands](https://img.shields.io/badge/MediaPipe-Hands_Vision-007acc?style=for-the-badge&logo=google&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-3D_Globe-black?style=for-the-badge&logo=three.js&logoColor=white)
![SQLite WASM](https://img.shields.io/badge/SQLite-WASM_Virtual_FS-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

**The Autonomous AI Operating System bridging Real-Time Voice, Vision Hand Gestures, Geospatial Reconnaissance, Dual-Engine Cognitive Memory, and Local System Automation.**

[Quick Start](#-quick-start) • [Tri-Modal Control](#-tri-modal-interaction-engine) • [God's Eye View](#-gods-eye-view--geospatial-reconnaissance) • [Cognitive Memory](#-dual-engine-cognitive-long-term-memory) • [Gesture Guide](#-hand-gesture-reference-card) • [Architecture](#-system-architecture)

</div>

---

## 🌌 Overview

**Cooper** is an agentic, sci-fi-grade AI personal operating system and command center. Designed as a real-world Jarvis/Stark Butler, Cooper orchestrates multi-modal sensor inputs (speech, vision gestures, and telemetry) to control your digital workspace, automate research, maintain lifelong memory graphs, track real-time aerospace vectors, and manage daily operations.

Built with a high-performance **Node.js ESM** backend and a reactive **Sci-Fi HUD frontend**, Cooper runs completely self-hosted with pure WebAssembly virtual storage (`node-sqlite3-wasm`), zero native C++ compilation requirements, and client-side computer vision privacy.

---

## ⚡ Core Capabilities

### 🎙️ Tri-Modal Interaction Engine
Interact with Cooper through whichever modality fits your workflow:
- **Voice Intelligence**: High-fidelity conversational speech powered by **Whisper STT**, **VoiceStudio OmniVoice (`:3900`)**, and an automatic **Zero-Key Google Neural TTS Fallback**.
- **Conversational Language Persistence**: Multi-lingual fluency across English, Urdu (`اردو`), Hindi, and Arabic. When instructed to speak in a specific language (e.g. *"مجھ سے اردو میں بات کرو"*), Cooper locks into that language conversationally across all future turns until explicitly requested to switch, mirroring Gemini Live Voice behavior.
- **Natural Screen & Text Chat**: Streaming Markdown LLM synthesis with tool-calling capabilities (Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o, Groq Llama 3.3, and offline Ollama).

### 🖐️ BareHands / IronHands Gesture Engine
Touchless computer-vision navigation powered by **MediaPipe Hands** running at 60 FPS entirely client-side:
- **Air Mouse**: Real-time cursor navigation via smooth index-finger tip raycasting with Exponential Moving Average (EMA) jitter filtering.
- **Pinch-to-Click**: Natural thumb-to-index finger proximity pinch triggers instantaneous UI clicks.
- **Air Scroll**: Dual-finger (Index + Middle) vertical translation for smooth document and HUD scrolling.
- **Peace Sign (✌️)**: Wake-word trigger to instantly toggle Cooper's listening state.
- **Thumbs Up / Down (👍 / 👎)**: Visual confirmation gate to approve or cancel high-risk system commands.
- **Closed Fist (✊)**: Instant audio mute and emergency stop kill switch.

### 🛰️ God's Eye View & Geospatial Reconnaissance
- **3D Interactive Orbital Globe**: Hardware-accelerated globe powered by **Three.js** and **Cesium**.
- **ADS-B Live Airspace Tracking**: Live aircraft transponder vectors, altitudes, speeds, and flight paths plotted directly onto the orbital sphere.
- **CelesTrak Satellite Reconnaissance**: Real-time orbital propagation and trajectory tracking for active satellites and ISS passes.
- **Planar Geo-Clustering**: Geospatial intelligence overlays for global weather patterns and asset monitoring.

### 🧠 Dual-Engine Cognitive Long-Term Memory
Cooper maintains context across days, weeks, and months through a layered memory architecture:
- **AgentMemory (`:3111`, `:3113`)**: Dynamic knowledge graph with hybrid BM25 and vector semantic retrieval, accompanied by a real-time web graph explorer.
- **OpenViking (`:1933`)**: Hierarchical context database (`viking://`) supporting L0/L1/L2 progressive context disclosure and repo indexing.
- **Local SQLite WASM Cache**: High-speed local store with automatic memory consolidation, conversation pruning, and offline resiliency.

### 🔬 Scientific Research & Academic Synthesis
- **OpenAlex Integration**: Real-time programmatic discovery across 250M+ scholarly works, author profiles, and institutional knowledge graphs.
- **arXiv Paper Retrieval**: Automated retrieval of preprints, full abstracts, PDF links, and citation graph generation.

### 📬 Live Personal Ops & Workspace Control
- **Live Gmail Integration**: Real-time Gmail inbox scanning, searching, and auto-sync with zero stale caching (orders newest emails first and parses body content).
- **Automated Bookkeeping & Expense Ledger**: LLM transaction extractor automatically parses email receipts and invoices into categorized financial statements.
- **Task Orchestration**: Minimalist priority-driven task board managed conversationally.
- **Local System Sandbox**: Execute desktop actions safely—capture screen screenshots, launch local VS Code repositories, adjust master volume, or initiate sleep/lock sequences.

### 📢 Content Studio & Multi-Platform Publishing
- **Autonomous Feed Ingestion**: Scrape RSS feeds and arbitrary URLs using **Firecrawl** with AI relevance ranking (0–100 score).
- **AI Graphic Design**: Automated generation of multi-aspect ratio social media graphics (`1:1`, `4:5`, `3:4`, `9:16`, `16:9`).
- **One-Click Multi-Publishing**: Schedule and publish posts directly to **LinkedIn, X (Twitter), Instagram, Telegram, and Discord**.

---

## 🏛️ System Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │           COOPER SCI-FI HUD (SPA)            │
                       │   Three.js Arc Reactor • MediaPipe Hands     │
                       │     Cesium 3D Globe   • Audio Synthesizer    │
                       └──────────────────────┬───────────────────────┘
                                              │ REST / SSE / WebSockets
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │        COOPER MASTER CORE (PORT 3950)        │
                       │            Node.js (ESM) + Express           │
                       └──────┬───────────────┬───────────────┬───────┘
                              │               │               │
         ┌────────────────────┴───┐   ┌───────┴──────┐   ┌────┴──────────────────┐
         │     AI & COGNITIVE     │   │ SENSOR & OPS │   │ PERSISTENCE & SIDECAR │
         ├────────────────────────┤   ├──────────────┤   ├───────────────────────┤
         │ • Google Gemini 2.5    │   │ • MediaPipe  │   │ • SQLite WASM VFS     │
         │ • OpenRouter (Claude)  │   │ • Gmail API  │   │ • AgentMemory (:3111) │
         │ • Groq Llama 3.3       │   │ • Weather    │   │ • OpenViking (:1933)  │
         │ • Zero-Key Neural TTS  │   │ • OpenAlex   │   │ • VoiceStudio (:3900) │
         │ • Ollama Local (11434) │   │ • ADS-B / Sat│   │ • Cesium Orbital Hub  │
         └────────────────────────┘   └──────────────┘   └───────────────────────┘
```

---

## 🌐 Port Directory & Micro-Services Matrix

| Service | Port | Endpoint / URL | Description |
|---|---|---|---|
| **Cooper Master Hub** | `3950` | `http://localhost:3950` | Primary HUD, REST API, WebSocket streams, and static dashboard. |
| **AgentMemory API** | `3111` | `http://localhost:3111` | Semantic memory daemon and knowledge graph query engine. |
| **AgentMemory Viewer** | `3113` | `http://localhost:3113` | Interactive visual knowledge graph explorer. |
| **OpenViking Daemon** | `1933` | `http://127.0.0.1:1933` | Hierarchical context database (`viking://`) filesystem. |
| **VoiceStudio OmniVoice** | `3900` | `http://127.0.0.1:3900` | Local zero-latency neural TTS & Butler voice synthesis. |
| **Ollama (Optional)** | `11434` | `http://localhost:11434` | Local offline LLM fallback (Llama 3.3, Mistral, Qwen). |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Webcam**: Standard USB or built-in webcam (for hand gesture tracking)
- **Microphone**: Standard audio input (for voice interaction)
- **OS**: Windows, macOS, or Linux (Fully portable via pure WASM SQLite)

---

### Option A: One-Click Launch (Windows)

Simply double-click `COOPER.bat` in the repository root:
```cmd
COOPER.bat
```
*`COOPER.bat` cleans up stale SQLite WASM locks, checks Node.js availability, boots the Master Hub on port `3950`, and automatically opens the HUD in your default browser.*

---

### Option B: Manual Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ihsanaq0-ctrl/Agentic-OS-Cooper.git
   cd Agentic-OS-Cooper/content-os
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your API keys in `.env` (at minimum, provide `GEMINI_API_KEY` or `OPENROUTER_API_KEY`):
   ```env
   PORT=3950
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: OpenRouter key
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

4. **Boot Cooper**:
   ```bash
   npm start
   ```

5. **Access the HUD**:
   Open **`http://localhost:3950`** in Google Chrome or Microsoft Edge.

---

## 🖐️ Hand Gesture Reference Card

Position your hand clearly in front of the webcam within the active camera boundary:

| Gesture | Posture | Detection Logic | HUD Action |
|:---:|:---:|---|---|
| 👆 **Air Mouse** | Index finger extended, others folded | Smooth tracking of index tip (`Landmark 8`) | Moves the virtual cursor across the HUD |
| 🤏 **Pinch Click** | Index tip touching Thumb tip | Euclidean distance `< 0.045` | Emits a left mouse click at current cursor position |
| ✌️ **Air Scroll** | Index + Middle extended together | Proximity `< 0.05`, vertical delta tracking | Smooth vertical page and feed scrolling |
| ✌️ **Voice Wake** | Peace Sign (V-Shape) | Index & Middle spread (`distance > 0.07`) | Activates Cooper's voice listener |
| 👍 **Confirm** | Thumb pointing strictly upward | Thumb tip above knuckles, other fingers curled | Approves pending system actions (e.g. run command) |
| 👎 **Reject** | Thumb pointing strictly downward | Thumb tip below knuckles, other fingers curled | Cancels pending system actions |
| ✊ **Emergency Mute**| Closed Fist | All fingertips curled into palm | Mutes voice audio immediately & stops TTS playback |

---

## 🗣️ Voice & Language Commands

Cooper supports dynamic bi-directional voice conversation with language locking:

### Urdu (`اردو`) Examples
- *"مجھ سے اردو میں بات کرو"* — Switches Cooper to Urdu and persists this preference across all subsequent conversations.
- *"آج کا موسم کیسا ہے؟"* — Fetches live weather conditions for your current location.
- *"میری حالیہ ای میلز چیک کرو"* — Reads the most recent unread Gmail messages live.
- *"میرے اخراجات کا حساب کتاب دکھاؤ"* — Analyzes and displays financial ledger summaries.

### English Examples
- *"Switch back to English"* — Reverts language lock back to English.
- *"What's the status of the ISS and active orbital satellites?"* — Activates God's Eye View satellite telemetry.
- *"Search scientific literature on CRISPR gene drive mechanisms"* — Queries OpenAlex and arXiv for recent academic papers.
- *"Open project Agentic-OS in VS Code"* — Launches the local development environment.

---

## ⚙️ Configuration & Environment Variables

Key parameters in `content-os/.env.example`:

```ini
# Core Server Configuration
PORT=3950
DEFAULT_TIMEZONE=Asia/Karachi

# Primary Intelligence (Choose Gemini or OpenRouter)
GEMINI_API_KEY=                     # Google AI Studio API Key (Recommended)
OPENROUTER_API_KEY=                 # OpenRouter API Key (Claude 3.5, GPT-4o)
GROQ_API_KEY=                       # Optional: Ultra-fast Groq Llama inference

# Voice & Speech Synthesis
GOOGLE_TTS_API_KEY=                 # Optional: Google Cloud TTS (or uses zero-key neural fallback)
GOOGLE_TTS_VOICE=en-US-Journey-F    # Default neural voice profile
VOICESTUDIO_URL=http://127.0.0.1:3900 # Local VoiceStudio server

# Google Ecosystem (Gmail & Calendar)
GOOGLE_CLIENT_ID=                   # Google OAuth 2.0 Client ID
GOOGLE_CLIENT_SECRET=               # Google OAuth 2.0 Client Secret
GOOGLE_REDIRECT_URI=http://localhost:3950/api/gmail/callback

# Cognitive Sidecars
AGENTMEMORY_URL=http://localhost:3111 # Long-Term Knowledge Graph
OPENVIKING_URL=http://127.0.0.1:1933  # Viking Context Virtual Filesystem

# Research & Scraping
FIRECRAWL_API_KEY=                  # Deep web extraction
NEWS_API_KEY=                       # Live breaking news headlines
```

---

## 🔒 Security & Privacy Posture

- **Client-Side Vision**: Hand gesture analysis is processed 100% locally in your browser via WebAssembly and WebGL through Google MediaPipe. Camera frames are never transmitted over the network or saved to disk.
- **WASM SQLite Storage**: Uses `node-sqlite3-wasm` with encrypted virtual filesystem support, keeping personal data strictly on your local device without external database dependencies.
- **Command Confirmation Gates**: Destructive shell commands, system power states, and sensitive modifications require explicit affirmative confirmation (via voice or **Thumbs Up 👍** gesture).
- **Zero-Secret Commits**: All sensitive API keys, tokens, and personal configurations are strictly isolated in `.env` (enforced via `.gitignore`).

---

## 🛠️ Tech Stack

- **Runtime & Server**: Node.js (v20+ ESM), Express.js, WebSockets (`ws`), Server-Sent Events (SSE).
- **Database**: SQLite3 via `node-sqlite3-wasm` (In-process, zero C++ compiler dependencies).
- **Frontend HUD**: Vanilla JavaScript (ES Modules), Custom Cyberpunk/Stark CSS, Three.js, Cesium.
- **Vision Engine**: Google MediaPipe Hands (`@mediapipe/hands`).
- **AI Integrations**: Google Gemini API, OpenRouter, Groq Cloud, Ollama, Google Neural TTS.
- **APIs & Protocols**: Google Gmail API, OpenAlex Scholarly API, arXiv API, ADS-B Exchange, CelesTrak.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">

**Built with ⚡ for high-agency engineers.**  
*Cooper — Ready for your command, Sir.*

</div>
