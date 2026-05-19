# Test Coverage Summary

## Current Status

`./check-all.sh` currently runs the full project gate against the Docker Compose dev stack:

- Docker Compose config validation
- Frontend ESLint
- Frontend production build
- Backend Black format check
- Backend flake8
- Full Django test suite

Latest verified result: **121 Django tests passing**.

> Note: numeric line/branch coverage is not available yet because `coverage.py` / `pytest-cov` is not installed in the backend image. This document tracks functional coverage by test area.

## Backend Test Files

| Area | File | Current focus |
|---|---|---|
| API contracts | `backend/apps/core/test_contracts.py` | Auth, users, jobs, invoices, dashboard response contracts |
| Core | `backend/apps/core/tests.py` | Labs, users, tenant scoping, profile/auth behavior |
| CRM | `backend/apps/crm/tests.py` | Patients, clinics, doctors, cumulative tooth map |
| Jobs | `backend/apps/jobs/tests.py` | Jobs, technicians, vacations, job items, FDI validation, status workflow |
| Finance | `backend/apps/finance/tests.py` | Invoices, price list, subscriptions, invoice/job sync |
| Inventory | `backend/apps/inventory/tests.py` | Warehouse CRUD, tenant scoping, superadmin behavior |

## Design-Parity Coverage Added

- Dashboard stats contract includes `today_schedule`.
- Dashboard schedule now has behavior coverage for due open jobs and exclusion of completed jobs.
- Job items are covered for nested create, price snapshots, quantity, tooth/range and total persistence.
- Job timeline is covered for create and status transition audit events.
- Status workflow is covered through the transition endpoint and invalid direct update rejection.
- Delete protection is covered for invoiced jobs.
- Dental notation helpers are covered for valid FDI teeth, same-arch ranges, reversed ranges and invalid/cross-arch ranges.
- Job item API validation is covered for invalid FDI values and valid bridge ranges.

## Remaining Gaps

- Frontend has lint/build checks but no component or E2E test runner yet.
- No numeric coverage report is produced yet.
- UI-only behavior such as command palette, drawer keyboard flow, responsive layout and tooth-map click interactions needs Playwright or component tests.
- PDF/export behavior should be covered when invoice document work is implemented.
- Superadmin platform features need broader workflow tests as those design issues are implemented.

## Recommended Next Steps

1. Add `coverage` or `pytest-cov` equivalent for Django tests if a numeric coverage gate is desired.
2. Add Playwright smoke tests for login, dashboard, jobs list, new job wizard, job detail and tooth-map quick entry.
3. Add workflow tests for patient -> job -> invoice once invoice drawer/PDF work is complete.
