# CLAUDE.md — Dental Lab Management App

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

## Known incomplete areas (open issues)

| # | Area | Status |
|---|---|---|
| #34 | Job status mismatch in finance views | **Fixed** — migration `0004_add_billing_job_statuses` added |
| #35 | LabSettings save was a placeholder | **Fixed** — now calls `PATCH /api/labs/<id>/` |
| #36 | Password change in ProfileSettings | **Fixed** — now calls `PUT /api/users/me/` |
| #37 | Finance dashboard is a stub | Open — needs real stats endpoint |
| #38 | Dashboard loads all data for 4 stats | Open — needs `/api/dashboard/stats/` |
| #39 | Inventory CSV import is sequential | Open — needs bulk import endpoint |
| #40 | Mixed Slovak/English UI | Open — language decision needed |
| #41 | Wrong repo URL in root package.json | **Fixed** |
| #42 | Stale branches on GitHub | Open — delete manually |
| #43 | Missing CLAUDE.md | **Fixed** (this file) |

## Documentation

The `doc/` directory contains:
- `requirements.md` — original Slovak requirements spec
- `testing.md` — testing strategy
- `test_coverage.md` — test coverage summary
- `github_actions_fix.md` — notes on CI pipeline
