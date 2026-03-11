# Product Requirements Document (PRD): miniSidebar Extension

## Overview
miniSidebar is a browser extension that provides a non-disruptive, floating context window. It allows users to query a local Large Language Model (LLM) using the Ollama API without breaking their chain of thought or disrupting the primary LLM conversation in the main browser window.

## Target Audience
Single users interacting locally in their browser, looking to multitask, ask small clarifying questions, or seek side-assistance without switching contexts or disrupting an ongoing AI chat.

## Goal
To build a tool that acts as an extension to open a chat/context window to easily converse with an off-screen Local LLM (`Ollama` running on `localhost:11434`), preserving privacy and context.

## Key Features

### 1. **Trigger Mechanism**
- **Keyboard Shortcut**: `Alt+Shift+S` to instantly toggle the miniSidebar.
- **Extension Action**: Clicking the browser extension icon toggles the UI.

### 2. **Multi-Chat Capabilities**
- The UI must support opening a non-intrusive "mini sidebar" or floating chat window over *any* web page.
- Users can open multiple parallel chat threads/windows within the extension to multitask (e.g., asking for a technology stack in one thread, while writing an implementation plan in another).

### 3. **Native & Non-Disruptive UI**
- Built with React, TypeScript, and Vite, animated using GSAP for a premium, smooth glassmorphism design.
- The sidebar should overlay on the DOM rather than squishing or disrupting the current page layout.
- The user can drag to reposition or resize the chat window.

### 4. **Local LLM Integration**
- **Endpoint**: Directly connects to `http://localhost:11434/api/generate` and `http://localhost:11434/api/chat`.
- **Supported Models**: `llama3`, `mistral`, `gemma`, etc., available via the local Ollama instance.
- **Privacy First**: All queries happen locally directly from the browser Background Worker.

### 5. **Architecture**
- **Frontend (Content Script/UI layer)**: React + Tailwind CSS + GSAP elements injected into the DOM via shadow root or overlay container to isolate styles.
- **Background Worker**: Acts as the local proxy for model communication bypassing Content Security Policies constraints of the hostile target web page.
- **Storage**: IndexedDB (via Dexie.js or native) for persistent chat history mapping on a per-profile basis.

## System Requirements
- Node.js environment to build (using `npm` and `vite`).
- Local installation of Ollama.
- Target Browsers: Chromium-based (Chrome, Edge, Brave, Cursor, arc).

## Success Metrics
- Less than 500ms time-to-interactivity when triggered.
- Cleanly connects to local Ollama API without CORS/CSP blocking.
- Preserves chats across page reloads using browser local DB storage.

## Open Questions & Out of Scope (For Now)
- Supporting Cloud APIs (OpenAI, Anthropic). Kept out of scope for version 1 per user request.
- Synchronizing chats between different desktop devices.
