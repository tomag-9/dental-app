#!/usr/bin/env bash
# Run project checks inside the running Docker Compose dev stack.
# Usage: ./check-all.sh
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE=(
    docker compose
    --env-file env/dev.env.example
    -f compose/docker-compose.yml
)

FAILED=()
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

service_running() {
    local service="$1"
    local container_id
    container_id="$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null || true)"
    [ -n "$container_id" ] && [ "$(docker inspect -f '{{.State.Running}}' "$container_id" 2>/dev/null || true)" = "true" ]
}

require_service() {
    local service="$1"
    if ! service_running "$service"; then
        echo "❌ Service '$service' is not running."
        echo "   Start the dev stack first:"
        echo "   docker compose --env-file env/dev.env.example -f compose/docker-compose.yml up"
        exit 1
    fi
}

run_step() {
    local label="$1"
    shift
    local log_file="$TMP_DIR/${label// /_}.log"

    if "$@" >"$log_file" 2>&1; then
        echo "✅ $label OK"
    else
        echo "❌ $label FAILED"
        echo "   Posledných 30 riadkov logu:"
        tail -n 30 "$log_file"
        FAILED+=("$label")
    fi
}

run_backend_tests() {
    # Optional module argument, e.g. "apps.core apps.crm" for a quick local run
    local modules="${*:-}"
    local label="backend tests${modules:+ ($modules)}"
    local log_file="$TMP_DIR/backend_tests.log"
    local spinner='|/-\'
    local i=0
    local exit_code=0

    # shellcheck disable=SC2086
    "${COMPOSE[@]}" exec -T \
        -e DJANGO_SETTINGS_MODULE=config.settings.dev \
        -e SECRET_KEY=ci-cd-testing-secret-key-123 \
        backend python manage.py test --noinput --verbosity=2 $modules >"$log_file" 2>&1 &
    local pid=$!

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r⏳ %s running %c" "$label" "${spinner:i++%${#spinner}:1}"
        sleep 0.2
    done

    if wait "$pid"; then
        exit_code=0
    else
        exit_code=$?
    fi
    printf "\r\033[K"

    if [ "$exit_code" -eq 0 ]; then
        local summary
        summary="$(grep -E 'Ran [0-9]+ test' "$log_file" | tail -n 1 || true)"
        if [ -n "$summary" ]; then
            echo "✅ $label OK ($summary)"
        else
            echo "✅ $label OK"
        fi
    else
        echo "❌ $label FAILED"
        echo "   Failed testy:"
        if grep -Eq '^(FAIL|ERROR): ' "$log_file"; then
            grep -E '^(FAIL|ERROR): ' "$log_file" | sed -E 's/^(FAIL|ERROR): /   - [\1] /'
        elif grep -Eq 'FAILED|ERROR' "$log_file"; then
            grep -E 'FAILED|ERROR' "$log_file" | tail -n 20 | sed 's/^/   - /'
        else
            echo "   - Nepodarilo sa načítať zoznam failed testov, posledných 30 riadkov:"
            tail -n 30 "$log_file"
        fi
        FAILED+=("$label")
    fi
}

echo "========================================"
echo " Running all checks against dev stack"
echo "========================================"

require_service backend
require_service frontend
require_service db

run_step "docker compose config" "${COMPOSE[@]}" config --quiet
run_step "eslint" "${COMPOSE[@]}" exec -T frontend npm run lint

mkdir -p frontend/.tmp
run_step "frontend build" "${COMPOSE[@]}" exec -T frontend npm run build

run_step "black (format check)" "${COMPOSE[@]}" exec -T backend black apps config manage.py seed_data.py --check --exclude '/migrations/'
run_step "flake8" "${COMPOSE[@]}" exec -T backend flake8 apps config manage.py seed_data.py --max-line-length=120 --exclude=migrations --extend-ignore=E203,W503

# Run basic tests locally. Full suite (jobs, finance, inventory role matrix, etc.) runs in CI.
run_backend_tests apps.core apps.crm

echo ""
echo "ℹ️  Full test suite (all apps) runs in CI only."
echo "   To run locally: docker compose ... exec backend python manage.py test --noinput"
echo ""
echo "========================================"
if [ "${#FAILED[@]}" -eq 0 ]; then
    echo "✅ All checks passed!"
    exit 0
fi

echo "❌ Failed checks: ${FAILED[*]}"
exit 1
