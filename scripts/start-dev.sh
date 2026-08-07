#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""
FRONTEND_PORT=5173

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

api_ready() {
  curl -sf --max-time 2 "http://on-prem.x-dcb.net:4000/api/health" >/dev/null 2>&1
}

frontend_ready() {
  local port="${1:-$FRONTEND_PORT}"
  curl -sf --max-time 2 "http://on-prem.x-dcb.net:${port}/api/health" >/dev/null 2>&1
}

echo ""
echo "NMP Ticketing - starting dev environment"
echo ""

if [[ ! -f "$ROOT/backend/.env" ]]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "Created backend/.env"
fi
if [[ ! -f "$ROOT/frontend/.env" ]]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
  echo "Created frontend/.env"
fi

if ! api_ready; then
  echo "Seeding database (needs MongoDB)..."
  (
    cd "$ROOT/backend"
    bun run seed
  ) || {
    echo ""
    echo "ERROR: Seed failed. Start MongoDB first, then run: bun run start"
    exit 1
  }

  echo "Starting backend..."
  (
    cd "$ROOT/backend"
    echo "BACKEND - keep this process running"
    bun run dev
  ) &
  BACKEND_PID=$!

  echo "Waiting for API on port 4000..."
  ready=false
  for _ in $(seq 1 45); do
    sleep 1
    if api_ready; then
      ready=true
      break
    fi
  done
  if [[ "$ready" != true ]]; then
    echo "ERROR: API did not start. Check MongoDB and the backend logs."
    exit 1
  fi
  echo "API ready: http://on-prem.x-dcb.net:4000/api/health"
else
  echo "API already running: http://on-prem.x-dcb.net:4000"
fi

if ! frontend_ready "$FRONTEND_PORT"; then
  echo "Starting frontend..."
  (
    cd "$ROOT/frontend"
    echo "FRONTEND - keep this process running"
    bun run dev
  ) &
  FRONTEND_PID=$!

  echo "Waiting for frontend on port $FRONTEND_PORT..."
  fe_ready=false
  for _ in $(seq 1 60); do
    sleep 1
    if frontend_ready "$FRONTEND_PORT" || frontend_ready 5174; then
      fe_ready=true
      break
    fi
  done
  if [[ "$fe_ready" != true ]]; then
    echo "WARNING: Frontend slow to start. Check frontend logs for the URL."
  fi
else
  echo "Frontend already running on port $FRONTEND_PORT"
fi

echo ""
echo "Open in browser:"
echo "  http://on-prem.x-dcb.net:${FRONTEND_PORT}/"
echo "  Sign in: http://on-prem.x-dcb.net:${FRONTEND_PORT}/login"
echo "  Admin:   admin@nmp.gov.ph / admin123"
echo "  Records: records@nmp.gov.ph / records123"
echo "  Client:  user@nmp.gov.ph / user123"
echo ""
echo "Workflow: Admin submits form -> Records reviews (separate tab) -> Client submits request"
echo "All three portals can stay logged in at the same time."
echo ""
echo "Press Ctrl+C to stop services started by this script."
echo ""

# Keep script alive while child processes run
wait
