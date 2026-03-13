# Mini Context Browser Extension

This project is a Manifest V3 browser extension scaffold that provides:

- A React popup for controls
- A React content-script mini context window on LLM sites
- GSAP-based open/close animation for the mini window
- A background service worker for keyboard-command and message routing

## Features

- Auto-injects on major LLM chat websites
- Opens a mini "side question" context box without touching the main chat input
- Supports quick open/toggle via popup and keyboard shortcut
- Captures context from selection and recent conversation DOM snippets
- Keeps a mini side-thread history inside the in-page panel
- Uses subtle GSAP transitions (mount, open/close, status/answer reveals, micro-hover)
- Integrated with local Ollama API for private LLM inference

## Prerequisites

- **Ollama**: Must be installed and running locally on `http://localhost:11434`.

### Ollama Configuration (CORS)

Because browser extensions access Ollama from a `chrome-extension://` origin, you **must** configure Ollama to allow these requests:

**On macOS:**
1. Open Terminal.
2. Run: `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"`
3. Quit Ollama (from the menu bar icon) and restart it.

**On Linux:**
1. Run: `systemctl edit ollama.service`
2. Add under `[Service]`: `Environment="OLLAMA_ORIGINS=chrome-extension://*"`
3. Run: `systemctl daemon-reload` and `systemctl restart ollama`

**On Windows:**
1. Open Environment Variables in System Properties.
2. Add a new User Variable: `OLLAMA_ORIGINS` with value `chrome-extension://*`
3. Restart Ollama from the system tray.

## Tech Stack

- JavaScript (build script and extension packaging)
- TypeScript
- React
- GSAP

## Scripts

- `npm run dev`: Runs Vite for popup-only local preview
- `npm run typecheck`: Type-checks TypeScript sources
- `npm run build`: Builds extension files into `dist/`
- `npm run lint`: Runs ESLint

## Build and Load

1. Run `npm run build`
2. Open `chrome://extensions` (or Edge extensions page)
3. Enable Developer Mode
4. Click "Load unpacked"
5. Select the `dist/` folder

## Keyboard Shortcut

- `Alt+Shift+S`: Toggle the in-page mini context window

## Main Files

- `public/manifest.json`: Extension manifest
- `src/content/MiniContextApp.tsx`: Floating mini context component
- `src/content/index.tsx`: Content-script mount entry
- `src/popup/PopupApp.tsx`: Extension popup app
- `src/background/index.ts`: Background service worker
- `scripts/build.mjs`: esbuild packaging script
