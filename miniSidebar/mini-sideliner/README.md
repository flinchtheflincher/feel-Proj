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
- Uses a placeholder SLM responder in the background script (easy to replace later)

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
