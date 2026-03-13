---
description: how to run ollama with CORS for the miniSidebar extension
---

To run Ollama correctly for this extension, you need to ensure `OLLAMA_ORIGINS` is set to allow requests from browser extensions.

### Quick Start (Current Session)

// turbo
1. Run the following command in your terminal:
```bash
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*" && nohup ollama serve > /tmp/ollama.log 2>&1 &
```

### Explanation

- `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"`: This tells Ollama to accept requests from any Chrome extension. Without this, you will get a `403 Forbidden` error.
- `nohup ... &`: This runs Ollama in the background and keeps it running even if you close the terminal.
- `> /tmp/ollama.log 2>&1`: This redirects all logs to a temporary file so they don't clutter your terminal.

### Verifying it works

Run this command to check if Ollama is responding:
```bash
curl http://localhost:11434/api/tags
```

If you see a JSON response with models, it's working!
