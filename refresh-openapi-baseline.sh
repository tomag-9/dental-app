#!/usr/bin/env bash
# Regenerates doc/openapi-baseline.yaml (and the frontend copies derived from
# it) from the current backend code, on Postgres — matching exactly how CI's
# "Check OpenAPI schema baseline" step produces its comparison file.
#
# Run this after ANY change to a serializer, view, or URL — CI has caught
# drift here three separate times because the regeneration got deferred and
# then forgotten at merge time. If in doubt, just run it; it's a no-op diff
# when nothing changed.
set -euo pipefail
cd "$(dirname "$0")"

export BACKEND_CI_IMAGE="${BACKEND_CI_IMAGE:-local/dental-backend-ci:pm-final}"
# docker-compose.ci.yml declares an explicit top-level `name: dental-app` —
# the SAME project name docker-compose.yml (the dev stack) uses. That name
# beats a plain COMPOSE_PROJECT_NAME env var, so without `-p` here, the
# `down -v` below tears down whatever "dental-app" project happens to be up
# — including a live dev stack's database. `-p` on the CLI is the only thing
# that reliably overrides the file's own `name:`. Learned the hard way: this
# wiped a freshly-seeded dev DB while diagnosing a query-performance issue.
COMPOSE_PROJECT="dental-app-openapi-refresh"

echo "==> building backend image ($BACKEND_CI_IMAGE)"
docker build -q -t "$BACKEND_CI_IMAGE" ./backend >/dev/null

echo "==> generating schema on postgres"
docker compose -p "$COMPOSE_PROJECT" --env-file env/dev.env.example -f compose/docker-compose.ci.yml \
  run --no-deps --rm backend python manage.py generateschema > /tmp/openapi-refresh.yaml
docker compose -p "$COMPOSE_PROJECT" --env-file env/dev.env.example -f compose/docker-compose.ci.yml down -v >/dev/null 2>&1 || true

if diff -q doc/openapi-baseline.yaml /tmp/openapi-refresh.yaml >/dev/null 2>&1; then
  echo "==> no drift, baseline already up to date"
  rm -f /tmp/openapi-refresh.yaml
  exit 0
fi

cp /tmp/openapi-refresh.yaml doc/openapi-baseline.yaml
rm -f /tmp/openapi-refresh.yaml

echo "==> regenerating frontend/src/api/openapi.json + schema.d.ts"
python3 -c "
import json, yaml
d = yaml.safe_load(open('doc/openapi-baseline.yaml'))
json.dump(d, open('frontend/src/api/openapi.json', 'w'), indent=2, ensure_ascii=False, sort_keys=True)
"
( cd frontend && npm run gen:types )

echo "==> done. Review and commit:"
echo "      doc/openapi-baseline.yaml"
echo "      frontend/src/api/openapi.json"
echo "      frontend/src/api/schema.d.ts"
