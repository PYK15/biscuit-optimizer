# Quickstart

Double-click **`Start Biscuit Dashboard.bat`** in this folder. That's it.

## What you'll see

1. A terminal window opens and prepares everything. First run installs
   dependencies and can take a few minutes; later runs take under a minute.
2. Once both the backend and frontend are actually responding (not just
   started), your default browser opens automatically to the dashboard at
   `http://localhost:5173`.
3. Leave the terminal window open while you use the dashboard. Closing it
   (or pressing Ctrl+C inside it) stops everything cleanly - no leftover
   processes blocking the next launch.

## If something doesn't open

- **Read the terminal window** - it stays open on error and prints what
  failed.
- **"Port already in use"**: the launcher automatically stops leftover
  processes from a previous run. If you still see this, some *other*
  program on your machine is using port 8000 or 5173 - close it and
  re-launch.
- **AI rationale looks generic instead of AI-written**: the optional AI
  narration uses a local LLM via [Ollama](https://ollama.com). The
  dashboard works fully without it (recommendations just use plain
  templated explanations). To enable it: install Ollama, run
  `ollama pull llama3.1`, then re-launch the dashboard.
