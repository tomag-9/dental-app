#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE=(
  docker compose
  --env-file "$ROOT_DIR/env/dev.env.example"
  -f "$ROOT_DIR/compose/docker-compose.yml"
)

echo "[rebuild-dev] Rebuilding and restarting Docker dev stack..."
"${COMPOSE[@]}" down --remove-orphans
DOCKER_BUILDKIT=0 "${COMPOSE[@]}" build

echo "[rebuild-dev] Running Django migrations..."
"${COMPOSE[@]}" up -d db
"${COMPOSE[@]}" run --rm backend python manage.py migrate --noinput

echo "[rebuild-dev] Starting application services..."
"${COMPOSE[@]}" up -d

echo "[rebuild-dev] Service status:"
"${COMPOSE[@]}" ps

echo "[rebuild-dev] Done. Frontend: http://localhost:5367  Backend: http://localhost:8810"
