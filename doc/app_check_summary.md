# App Check and Summary (2026-04-22)

## Health Check Result

Command run:

```bash
./check-all.sh
```

Result:
- PASS: 8
- FAIL: 0
- SKIP: 3

Checks passed:
- docker-compose config
- root package.json scripts
- frontend package.json scripts
- rebuild script
- backend rebuild script
- backend check helper
- django system check
- django makemigrations dry-check

Checks skipped by default:
- django smoke tests
- frontend lint
- frontend build

Run full checks (including slower checks):

```bash
RUN_SLOW_CHECKS=1 ./check-all.sh
```

## App Summary

This project is a Dockerized full-stack dental lab management app for Slovak labs.

Core stack:
- Backend: Django 5 + DRF + JWT auth
- Frontend: React 19 + Vite + Tailwind + Zustand
- Database: PostgreSQL 15
- API docs: DRF Spectacular Swagger

Main domains:
- Core: users, labs, dashboard stats
- CRM: patients, clinics, doctors
- Jobs: jobs, technicians, vacations
- Finance: invoices, price list, subscriptions
- Inventory: warehouse items

Backend API structure:
- Root endpoints under /api/ (users, labs, invoices, vacations, warehouse)
- App endpoints under /api/core/, /api/crm/, /api/jobs/, /api/finance/, /api/inventory/
- Auth endpoints under /api/token/ and /api/token/refresh/
- Docs under /api/docs/

Frontend structure:
- Protected app routes with role-based guards
- Admin/superadmin routes for clinics, doctors, technicians, finance
- Superadmin-only area for dashboard, users, labs, subscriptions

Local ports from docker-compose.yml:
- Frontend: 5280
- Backend: 8810
- Postgres: internal service (db)

## Notes

- Script entrypoints are now aligned:
  - ./check-all.sh is the main checker.
  - ./check-all-scripts and ./backend/check-all-scripts both call the same checker.
- Slow checks are intentionally opt-in to keep the default run fast.
