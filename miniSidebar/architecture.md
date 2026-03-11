# miniSidebar Architecture

## Overview
The miniSidebar focuses on providing a non-disruptive native extension that opens a mini context window for making quick inquiries to a local Small/Large Language Model (SLM/LLM) based on current page context or user-selected snippets without altering the page layout or relying on external cloud endpoints.

## User Flow
- **Single User Operation:** The application is meant for the single user of the current browser interacting locally. User preferences are securely persisted using the `chrome.storage.sync` API. No centralized auth backend is needed.
- **Trigger event:** Use browser keyboard shortcuts (`Alt+Shift+S`) or extension popup buttons to display the mini context UI directly over any web page.

## Database (Optimal Choice)
The most optimal database for a purely local context persistence within a browser extension is **IndexedDB**. 
We can use a lightweight wrapper such as Dexie.js if queries become complex, but the built-in browser IndexedDB API natively maintains persistent context per active profile. For simple state (e.g. auto-open config), `chrome.storage` is the preferred optimal key-value database.

## External API / Model Layer
- **Model API:** The optimal solution is the **Ollama API** (`http://localhost:11434/api/generate`). It allows maintaining privacy constraints while acting effectively alongside extension-native applications.
- **Local Model Usage:** Only models available securely on your local device (like `llama3`, `mistral`, `gemma`) will be queried over a standard HTTP POST request. You do not need to install additional API libraries or remote SDKs—native `fetch` is used in the Background Service Worker to communicate directly with your local LLM server.

## Architecture Tiers
1. **Content Script Layer (React/Vite/GSAP UI):** Reads DOM context securely and injects an isolated non-disruptive interface. Emits messages to background workers.
2. **Background Worker (TypeScript):** Resides effectively as a localized proxy. Intercepts local content events and directly makes HTTP `fetch` requests to `localhost:11434`.
3. **Database / Storage Logic:** Runs isolated to the browser instance to temporarily cache histories natively.
