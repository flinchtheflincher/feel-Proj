# miniSidebar Design Document

**Date:** 2026-03-10
**Topic:** miniSidebar Architecture and Implementation Design

## 1. Overview & Goals
miniSidebar is a local-first, privacy-focused browser extension providing a quick, non-disruptive context window. It allows users to query a local Ollama instance (e.g., `llama3`, `mistral`) running on `localhost:11434` without switching tabs or losing their current place on a web page. The goal is blazing fast interactivity (<500ms) with multiple parallel chat capabilities.

## 2. Architecture & Components
The extension uses the "Lazy Load Background Service" approach for optimal performance and minimal resource drain.

### 2.1 Content Script (React/Vite/Tailwind/GSAP)
- **Role:** Handles all UI and user interaction.
- **Injection:** Injected securely via a Shadow DOM to prevent CSS bleeding from the host page.
- **Trigger:** Toggled via `Alt+Shift+S` or the extension icon. Renders instantly.
- **UI Structure:** Features a floating, draggable window with tabs for maintaining multiple concurrent chats.

### 2.2 Background Service Worker (TypeScript)
- **Role:** The communication bridge to the local LLM.
- **Lifecycle:** Sleeps when inactive. Wakes up upon receiving a message from the Content Script.
- **Function:** Makes an HTTP `fetch` POST request to `http://localhost:11434/api/generate` or `/api/chat`.
- **Why this approach?** It bypasses CORS and CSP restrictions enforced by the host web page, ensuring direct, secure communication with localhost.

### 2.3 Storage Layer
- **Technology:** IndexedDB, wrapped by Dexie.js for easier asynchronous querying.
- **Location:** Managed within the React Content Script layer.
- **Function:** Persists chat histories, allowing users to switch between threads seamlessly across sessions.

## 3. Data Flow
1. **Trigger & Context:** User opens the sidebar. The Content Script immediately attempts to grab highlighted text (`window.getSelection()`). If none exists, it falls back to grabbing the main page text (`document.body.innerText`), aggressively truncating it to a safe token limit (e.g., ~3000 words).
2. **Query:** User types a message and hits send.
3. **Dispatch:** The Content Script sends a `{ query, context, history }` message to the Background Worker via `chrome.runtime.sendMessage`.
4. **LLM Request:** The Background Worker formats the prompt and sends a streaming POST request to Ollama.
5. **Streaming Response:** The Background Worker reads the stream chunk-by-chunk and forwards it via `chrome.tabs.sendMessage` back to to the active Content Script.
6. **Rendering & Saving:** The React UI renders the chunks in real-time (typewriter effect). Upon stream completion, the final message is committed to Dexie.js.

## 4. Error Handling & Edge Cases
- **Ollama Offline/Unreachable:** If the initial `fetch` fails (`ECONNREFUSED`), the Background worker returns an immediate error state. The UI displays a clear, actionable banner: *"Cannot connect to local AI. Is Ollama running on localhost:11434?"*
- **Context Overflow:** Hard limits are enforced on the text grabbed from the DOM before dispatching to the LLM to prevent `400 Bad Request` context window errors.

## 5. Technology Stack
- **Framework:** React + TypeScript + Vite (via a Vite extension plugin structure like CRXJS or similar).
- **Styling:** Tailwind CSS.
- **Animation:** GSAP (GreenSock) for smooth, premium glassmorphism pop-ins.
- **Database:** Dexie.js (IndexedDB).
- **API:** Native `fetch` (no external heavy SDKs).
