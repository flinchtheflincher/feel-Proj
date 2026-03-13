# Project Changes

## 1. Clean Up
- **Removed Unused Artifacts:** Trashed the bloated or misallocated `all-files.txt` entirely along with root directory redundancies like duplicate `package-lock.json` files outside the explicit `files/` source structure.

## 2. Updated Logic Flow in `background/index.ts`
- **Replaced Stubbed LLM Flow:** Before, `AskSlmPayload` generated a dummy array of text context via `buildStubAnswer`.
- Added a `fetch` POST HTTP query to the default local AI API endpoint expected to be running via **Ollama** (`http://localhost:11434/api/generate`). 
- Integrated a generic local model query schema for parameters (model: `llama3`, `system` prompts mapping string context mapping securely to user selection).
- Asynchronous resolution on standard WebExtension events. Used `.then()` correctly in the asynchronous event receiver listener loop, explicitly returning `true`.
- **Linting Fix:** Extracted a redundant utility variable callback `clip` outside of isolated module environments.

## 3. Added Scope Documentations 
- Generated documentation specifying optimal environment structure (SQLite/IndexedDB database usage mapped via single UI storage context).
- Created a markdown definition of stack technologies directly required (skills folder format structure).

---

## 4. Production-Ready Upgrade (2026-03-12)

### 4.1 Code Cleanup & DRY
- **Deduplicated utility functions**: Removed `clip`, `normalize`, `nextId` from `MiniContextApp.tsx` — now imported from `shared/utils.ts`.
- **Fixed manifest.json**: Removed duplicate `"storage"` permission.
- **Deleted legacy popup**: Removed `PopupApp.tsx`, `popup/main.tsx`, `popup.html` — extension uses click-to-toggle sidebar (no popup needed).
- **Updated build script**: Removed popup entry from `build.mjs`.
- **Updated dev page**: Removed popup references from `index.html`.

### 4.2 Background Worker Hardening
- **Switched to `/api/chat`**: Background worker now uses the conversation-aware Ollama chat endpoint instead of stateless `/api/generate`.
- **Added AbortController**: Requests auto-cancel after 60 seconds. Previous requests for the same chat are cancelled when a new one starts.
- **Dynamic model selection**: Model is read from `chrome.storage.sync` instead of hardcoded `'llama3'`.
- **Added `LIST_MODELS` handler**: Fetches `http://localhost:11434/api/tags` to return available model names.
- **Added `HEALTH_CHECK` handler**: Pings Ollama root endpoint to verify connectivity.
- **Improved error handling**: Distinguishes connection errors from API errors with actionable messages.

### 4.3 New Message Types
- Added to `messages.ts`: `SLM_ERROR`, `LIST_MODELS`, `MODELS_RESULT`, `HEALTH_CHECK`, `HEALTH_RESULT`.
- Added corresponding payload interfaces.

### 4.4 Constants & Config
- Added `SELECTED_MODEL` storage key, `DEFAULT_MODEL`, and `OLLAMA_BASE_URL` to `constants.ts`.

### 4.5 UI Features (MiniContextApp.tsx)
- **Model selector dropdown**: In the input bar, shows all installed Ollama models. Selected model persists across sessions.
- **Ollama connectivity indicator**: Green/red dot next to model name showing live connection status.
- **Real thinking timer**: Shows actual elapsed seconds instead of hardcoded "Thought for 10s".
- **Markdown rendering**: LLM responses render bold, italic, code blocks, inline code, and lists.
- **Chat tabs**: When 2+ chats exist, tabs appear in the header for quick switching.
- **Improved relative timestamps**: "Past chats" list shows "now", "5m", "2h", "1d" format.
- **Removed hardcoded tool-use block**: Deleted the static "Check architecture.md" display.
- **Error state handling**: Displays SLM_ERROR messages from background worker.

### 4.6 PRD Updated
- Updated `PRD.md` to v1.0 reflecting all implemented features, added Non-Functional Requirements section.

---

## 5. Cost Breakdown

| Category | Cost | Notes |
|----------|------|-------|
| **API Calls** | $0/month | All inference runs locally via Ollama — no cloud APIs |
| **Hosting** | $0/month | Browser extension — no server infrastructure needed |
| **LLM Inference** | $0/month | Models run on user's own hardware (CPU/GPU) |
| **Database** | $0/month | IndexedDB is built into the browser |
| **Dependencies** | $0 | All npm packages are free/MIT-licensed |
| **Chrome Web Store** | $5 one-time | Developer registration fee (only if publishing) |
| **Domain/SSL** | $0 | Not applicable for extensions |
| **CDN/Storage** | $0 | No remote assets served |
| **Total Monthly** | **$0/month** | Fully local, zero recurring costs |
| **Total One-Time** | **$5** | Only if publishing to Chrome Web Store |

> **Note:** The user provides their own hardware for running Ollama models. GPU (recommended for speed) or CPU-only is supported. Typical VRAM usage is 4-8 GB depending on the model.
