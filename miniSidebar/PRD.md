# Product Requirements Document (PRD): miniSidebar Extension v1.0

## Overview
miniSidebar is a browser extension that provides a non-disruptive, floating context window. It allows users to query a local Large Language Model (LLM) using the Ollama API without breaking their chain of thought or disrupting the primary LLM conversation in the main browser window.

## Target Audience
Single users interacting locally in their browser, looking to multitask, ask small clarifying questions, or seek side-assistance without switching contexts or disrupting an ongoing AI chat.

## Goal
To build a tool that acts as an extension to open a chat/context window to easily converse with an off-screen Local LLM (`Ollama` running on `localhost:11434`), preserving privacy and context.

## Key Features

### 1. **Trigger Mechanism**
- **Keyboard Shortcut**: `Alt+Shift+S` to instantly toggle the miniSidebar.
- **Extension Action**: Clicking the browser extension icon toggles the UI (no popup).

### 2. **Multi-Chat Capabilities**
- The UI supports a floating chat window overlay on *any* web page.
- Users can open multiple parallel chat threads within the extension.
- Chat tabs appear in the header when 2+ chats exist for quick switching.

### 3. **Native & Non-Disruptive UI**
- Built with React, TypeScript, and Vite, animated using GSAP.
- Dark glassmorphism design matching the reference screenshots.
- The sidebar overlays on the DOM without disrupting the page layout.
- Draggable and repositionable chat window.
- Context-aware input with `@Mentions` and `Media` attachment menu.

### 4. **Local LLM Integration**
- **Endpoint**: Connects to `http://localhost:11434/api/chat` (conversation-aware).
- **Dynamic Model Selection**: Users can pick any installed Ollama model from a dropdown.
- **Health Check**: Connectivity indicator (green/red dot) shows Ollama status.
- **Streaming**: Real-time token streaming with a live elapsed-time thinking indicator.
- **Privacy First**: All queries happen locally from the browser Background Worker.

### 5. **Response Rendering**
- Basic markdown rendering for LLM responses (bold, italic, code blocks, inline code, lists).
- Streaming typewriter effect during response generation.

### 6. **Architecture**
- **Frontend (Content Script)**: React + Tailwind CSS + GSAP injected via Shadow DOM.
- **Background Worker**: Service Worker acting as local proxy for model communication, bypassing CSP.
- **Storage**: IndexedDB (via Dexie.js) for persistent chat history.

## Non-Functional Requirements
- Less than 500ms time-to-interactivity when triggered.
- 60-second request timeout with AbortController support.
- Clean error handling when Ollama is offline (actionable error messages).
- Zero external cloud dependencies — fully local operation.
- Styles isolated via Shadow DOM — no CSS bleeding to/from host page.

## System Requirements
- Node.js to build (npm + Vite + esbuild).
- Local installation of Ollama with at least one model pulled.
- Target Browsers: Chromium-based (Chrome, Edge, Brave, Arc).

## Cost Profile
- **Monthly running cost: $0** — all processing is local.
- See `changes.md` for full cost breakdown.

## Out of Scope (v1.0)
- Cloud API support (OpenAI, Anthropic, Gemini).
- Cross-device chat synchronization.
- Full conversation history sent to `/api/chat` (currently sends per-message context only).
- Image/file upload processing.
