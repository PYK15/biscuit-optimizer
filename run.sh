#!/usr/bin/env bash
# One-command demo launcher: train/validate -> serve API -> serve frontend ->
# open the browser once both are actually responding.
# Windows users: double-click "Start Biscuit Dashboard.bat" instead.
set -uo pipefail
cd "$(dirname "$0")"

API_PORT=8000
WEB_PORT=5173
API_URL="http://localhost:${API_PORT}/docs"
WEB_URL="http://localhost:${WEB_PORT}"

# --- Helpers ---------------------------------------------------------------

kill_tree() {
  local pid=$1
  [ -z "$pid" ] && return
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do kill_tree "$child"; done
  kill -9 "$pid" 2>/dev/null || true
}

stop_stale_process_on_port() {
  local port=$1
  local pids
  pids=$(lsof -ti ":${port}" 2>/dev/null || true)
  for pid in $pids; do
    local name
    name=$(ps -p "$pid" -o comm= 2>/dev/null || true)
    case "$name" in
      *python*|*node*|*uvicorn*)
        echo "Port ${port} is held by a leftover process from a previous run (${name}, PID ${pid}) - stopping it."
        kill_tree "$pid"
        sleep 0.5
        ;;
      "")
        ;;
      *)
        echo "WARNING: port ${port} is in use by an unrelated process (${name}, PID ${pid}). Close it and re-run if startup fails."
        ;;
    esac
  done
}

wait_for_http() {
  local url=$1
  local timeout_sec=$2
  local deadline=$(( $(date +%s) + timeout_sec ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -sf -o /dev/null "$url"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

open_browser() {
  local url=$1
  if command -v open >/dev/null 2>&1; then
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1
  else
    echo "Open $url in your browser."
  fi
}

# --- Pre-flight: clear any orphaned process from a previous run ------------

stop_stale_process_on_port "$API_PORT"
stop_stale_process_on_port "$WEB_PORT"

# --- Setup (unchanged business logic) ---------------------------------------

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

echo "== Data validation summary =="
python -m data.loader

echo "== Model backtest scorecard =="
python -m models.forecaster

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi

# --- Launch both services, capturing real process PIDs ----------------------

echo "== Starting API on :${API_PORT} =="
uvicorn api.main:app --port "$API_PORT" --log-level warning &
API_PID=$!

echo "== Starting frontend on :${WEB_PORT} =="
(cd frontend && npm run dev -- --port "$WEB_PORT") &
WEB_PID=$!

cleanup() {
  echo "Shutting down..."
  kill_tree "$API_PID"
  kill_tree "$WEB_PID"
  echo "Stopped."
}
trap cleanup EXIT INT TERM

echo "Waiting for backend to become ready..."
if ! wait_for_http "$API_URL" 90; then
  echo "ERROR: backend did not become ready within 90s. Scroll up for the actual error."
  exit 1
fi

echo "Waiting for frontend to become ready..."
if ! wait_for_http "$WEB_URL" 60; then
  echo "ERROR: frontend did not become ready within 60s. Scroll up for the actual error."
  exit 1
fi

echo "Both services are ready - opening the dashboard..."
open_browser "$WEB_URL"

echo ""
echo "Dashboard running at ${WEB_URL} (API at http://localhost:${API_PORT})."
echo "Press Ctrl+C to stop everything."

wait "$API_PID" "$WEB_PID"
