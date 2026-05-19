# AGENTS.md — Dental Lab Management App

## Project overview

A web application for Slovak dental laboratories: manage patients, jobs (dental work orders), clinics, doctors, technicians, inventory, and invoicing.

**Target market:** Slovak dental labs (UI is partially localised in Slovak).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Django 5 + Django REST Framework, SimpleJWT |
| Frontend | React 19, Vite, Tailwind CSS, Zustand (auth store) |
| Database | PostgreSQL (via Docker) |
| Dev environment | Docker Compose |
| API docs | Swagger UI at `/api/docs/` |

## Active branch

**`develop`** is the working branch. `main` is stale (predates the Django+React refactor).

## Running the dev environment

```bash
# Start everything (backend + frontend + postgres)
docker compose up

# Or rebuild from scratch
./rebuild-dev

# Seed demo data
docker compose exec backend python manage.py runscript seed_data
# or
docker compose exec backend python seed_data.py
```

Default credentials after seeding: `admin` / `admin` and `user` / `user`.

Frontend dev server: http://localhost:5173  
Backend API: http://localhost:8000/api/  
Swagger docs: http://localhost:8000/api/docs/

## Running tests

```bash
# Backend (Django)
docker compose exec backend python manage.py test --verbosity=2

# Frontend (lint + build check — no Jest tests yet)
cd frontend && npm run lint && npm run build
```

## Architecture — Django apps

| App | Domain |
|---|---|
| `apps/core` | Users (`User` model extending `AbstractUser`), Labs, authentication |
| `apps/crm` | Patients, Clinics, Doctors |
| `apps/jobs` | Jobs (work orders), Technicians, Vacations |
| `apps/finance` | Invoices, PriceList, Subscriptions |
| `apps/inventory` | Warehouse items |

Root-level API router (`config/urls.py`) exposes shortcuts: `/api/users/`, `/api/labs/`, `/api/invoices/`, `/api/warehouse/`, `/api/vacations/`.  
App-scoped routers: `/api/crm/`, `/api/jobs/`, `/api/finance/`, `/api/inventory/`.

## Key conventions

- All ViewSets filter by `request.user.lab` so data is tenant-isolated per lab.
- Superadmin users (`role == "superadmin"`) bypass lab filters and see all data.
- Job status flow: `new` → `in_progress` → `completed` / `cancelled`. When invoiced, finance views additionally set `finished_factured`, `finished_unfactured`, or `closed` (see `apps/finance/views.py:_sync_jobs_for_invoice_status`).


## Documentation

The `doc/` directory contains:
- `requirements.md` — original Slovak requirements spec
- `testing.md` — testing strategy
- `test_coverage.md` — test coverage summary
- `github_actions_fix.md` — notes on CI pipeline


## Agent Workflows

This repo includes Claude Code skills in `.claude/skills/`. Codex can read these as normal project files.

When a task matches one of these workflows, read the relevant file first:

- Code review: `.claude/skills/review-changes.md`
- Safe refactoring: `.claude/skills/refactor-safely.md`
- Debugging: `.claude/skills/debug-issue.md`
- Codebase exploration: `.claude/skills/explore-codebase.md`

Treat these files as shared workflow guidance, but prefer the current task instructions if they conflict.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
