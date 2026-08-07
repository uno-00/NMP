#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

copy_env_example() {
  local dir="$1"
  local example="$dir/.env.example"
  local env_file="$dir/.env"

  if [[ ! -f "$example" ]]; then
    echo "Warning: Missing $example" >&2
    return
  fi
  if [[ -f "$env_file" ]]; then
    echo "Keep existing: $env_file"
    return
  fi
  cp "$example" "$env_file"
  echo "Created: $env_file"
}

copy_env_example "$ROOT/backend"
copy_env_example "$ROOT/frontend"

echo ""
echo "Next:"
echo "  Terminal 1: cd backend; bun install; bun run seed; bun run dev"
echo "  Terminal 2: cd frontend; bun install; bun run dev"
echo "  App: http://on-prem.x-dcb.net:5173"
