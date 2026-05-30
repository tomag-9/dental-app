# BACKLOG
<!-- 2 done / 43 total — 41 tasks left -->

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low
Effort:   💀 Hard · ⚡ Medium · ✅ Easy

---

## PR 1 — Security quick wins
> 🔴 Critical · ✅ Easy · Do these first, independent of everything else.

- [x] Enable `rest_framework_simplejwt.token_blacklist` in `INSTALLED_APPS` and call `token.blacklist()` on logout and password change (`api-client.js:248` + logout view)
- [x] Add `AnonRateThrottle` scoped to `/api/token/` to block brute-force login attempts

---

## PR 2 — CI hardening
> 🟠 High · ✅ Easy · All independent one-liners or small config changes.

- [ ] Add `python manage.py migrate --check` as a CI step after checkout — missing migrations pass tests (Django builds test DB from scratch) but break on deploy
- [ ] Add `--fail-under=80` (or chosen threshold) to the `coverage report` step so CI fails on coverage regression
- [ ] Replace `black` + `flake8` with `ruff` — handles formatting, linting, and import ordering in one tool, faster in CI
- [ ] Update `docker/login-action@v2` → v3 and `docker/build-push-action@v4` → v6 in `ci.yml`

---

## PR 3 — Production security headers
> 🔴 Critical · ✅ Easy · Split settings, add headers, add CSP.

- [ ] Split `backend/config/settings.py` into `settings/base.py` + `settings/production.py` + `settings/dev.py`
- [ ] Add Django security headers in `production.py`: `SECURE_HSTS_SECONDS`, `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS`, `SECURE_SSL_REDIRECT`
- [ ] Add `Content-Security-Policy` header (via Django middleware or nginx config) — primary XSS blast-radius reduction before cookie migration lands

---

## PR 4 — Frontend source restructure
> 🟠 High · ⚡ Medium · Move files, update imports, verify build.

- [ ] Move all production React code from `frontend/public/design/` into `frontend/src/` with a proper module layout (`components/`, `hooks/`, `pages/`, `api/`)
- [ ] Update `vite.config.js` entry points and verify `npm run build` passes after move
- [ ] Update all relative import paths broken by the move

---

## PR 5 — Finance service extraction
> 🟠 High · 💀 Hard · Modular monolith phase 1 — see `doc/modular_monolith_roadmap.md`.

- [ ] Create `apps/finance/services.py`; extract invoice creation into `create_invoice_from_jobs(*, user, clinic_id, job_ids, document_type, discount_percent)`
- [ ] Extract invoice number generation into `next_invoice_number(lab)` service function
- [ ] Extract status change into `update_invoice_status(*, user, invoice, status)` — keep `transaction.atomic`, keep audit log call via `core.services.write_audit_log`
- [ ] `InvoiceViewSet.create()` and `InvoiceViewSet.status()` delegate to service; ViewSet only validates HTTP input and returns serializer response

---

## PR 6 — Jobs service extraction
> 🟠 High · 💀 Hard · Modular monolith phase 1 — finance stops writing directly to `Job`.

- [ ] Create `apps/jobs/services.py`; extract job status transitions into `transition_job_status(*, user, job, new_status, note=None)`
- [ ] Add finance-facing functions: `mark_jobs_invoiced(job_ids, *, invoice_status)` and `mark_jobs_invoice_cancelled(job_ids)` so finance never does `Job.objects.update(...)` directly
- [ ] Update `apps/finance/views.py` `_sync_jobs_for_invoice_status` to call `jobs.services` instead of direct ORM writes

---

## PR 7 — Tenant selectors
> 🟠 High · ⚡ Medium · Modular monolith phase 2 — one source of truth for tenant scoping.

- [ ] Create `apps/jobs/selectors.py`: `jobs_for_user(user)`, `technicians_for_user(user)`, `calendar_events_for_user(user)`
- [ ] Create `apps/finance/selectors.py`: `invoices_for_user(user)`, `price_list_for_user(user)`
- [ ] Create `apps/crm/selectors.py`: `patients_for_user(user)`, `clinics_for_user(user)`, `doctors_for_user(user)`; ViewSet `get_queryset()` methods use selectors instead of repeating tenant filter logic

---

## PR 8 — JWT httpOnly cookie migration
> 🔴 Critical · 💀 Hard · Full auth surface change — do after service extraction stabilises.

- [ ] Backend: configure `JWTCookieAuthentication` (via `dj-rest-auth` or manual SimpleJWT cookie view) to set `access` and `refresh` as `httpOnly; Secure; SameSite=Strict` cookies
- [ ] Frontend: remove `localStorage.setItem/getItem` for tokens in `api-client.js`; remove `Authorization` header injection; rely on browser cookie auto-send
- [ ] Re-enable `CsrfViewMiddleware` for state-changing endpoints; send CSRF token in request header from frontend; verify `CORS_ALLOW_CREDENTIALS = True` is still correct

---

## PR 9 — Role matrix and permissions tests
> 🟠 High · ⚡ Medium · Expand existing test matrix — tenant isolation is a security rule.

- [ ] Add cross-lab access tests: verify superadmin sees all labs, admin/user/technician see only their own lab across all main endpoints
- [ ] Add write-operation role tests: non-admin roles cannot create/update/delete in CRM, jobs, finance, inventory
- [ ] Add tests for root-level API aliases (`/api/invoices/`, `/api/warehouse/`, `/api/vacations/`) to confirm they enforce the same tenant isolation as app-scoped routes

---

## PR 10 — Playwright smoke tests
> 🟡 Medium · ⚡ Medium · Covers user journeys that lint+build cannot catch.

- [ ] Login / logout flow (valid credentials, wrong password, session expiry)
- [ ] Create patient → create job → assign technician flow
- [ ] Invoice creation from jobs → status change to paid → verify job status syncs to `closed`
- [ ] Permissions screen: verify non-admin cannot access admin-only actions; verify cross-lab isolation in UI

---

## PR 11 — Frontend domain API client
> 🟡 Medium · ⚡ Medium · Replace flat `api-client.js` with namespaced domain modules.

- [ ] Reorganise `api-client.js` into domain modules: `api.crm`, `api.jobs`, `api.finance`, `api.inventory` — no raw `fetch()` outside the API client except download/upload
- [ ] Generate TypeScript types from the OpenAPI schema at `/api/docs/` using `openapi-typescript`; wire into the domain client so API shape mismatches surface at build time

---

## PR 12 — API versioning
> 🟡 Medium · ✅ Easy · Add now, before the dashboard endpoint is built — retrofit later costs much more.

- [ ] Prefix all app-scoped routes with `/api/v1/` in `config/urls.py` and per-app `urls.py`; keep existing unversioned root aliases as deprecated backward-compat routes with a comment

---

## PR 13 — CI image caching and OpenAPI snapshot
> ⚪ Low · ⚡ Medium

- [ ] Configure `docker buildx` with `--cache-from`/`--cache-to` (local or registry cache) so `lint`, `backend-tests`, and `frontend-check` share image layers instead of each rebuilding from scratch
- [ ] Add a CI step that generates the OpenAPI schema (`manage.py generateschema`) and diffs it against a committed `doc/openapi-baseline.yaml`; fail if the schema changed without an updated baseline

---

## PR 14 — Observability and structured logging
> 🟡 Medium · ⚡ Medium · Required before any real production traffic.

- [ ] Add `django-structlog` (or `python-json-logger`) to emit JSON log lines with request ID, user, lab, and duration on every request
- [ ] Add a `GET /api/health/` endpoint that checks DB connectivity and returns 200/503 — needed for load balancer and uptime monitoring
- [ ] Document environment variables in `env/dev.env.example` with inline comments: required vs optional, default value, example

---

## PR 15 — Frontend component decomposition
> 🟡 Medium · 💀 Hard · High-churn screens need splitting before they get larger.

- [ ] Split job detail screen into: `JobHeader`, `JobStatusActions`, `JobItemsTable`, `JobAttachments`, `JobAuditLog` — each with its own data hook
- [ ] Split invoice/finance screen into: `InvoiceForm`, `InvoiceLineItems`, `InvoiceStatusBadge`, `InvoiceActions`
- [ ] Add consistent loading, empty, error, and permission-denied states across all list and detail screens

---

## PR 16 — Slovak localization
> 🟡 Medium · 💀 Hard · Target market consistency — every user-facing string should be Slovak.

- [ ] Audit and unify all UI labels, status names, validation error messages, date/currency formatting to Slovak conventions throughout all screens
- [ ] Ensure invoice PDFs and CSV exports use Slovak column headers, date format (DD.MM.YYYY), and currency format (EUR with comma decimal)

---

## PR 17 — Product and UX improvements
> ⚪ Low · ⚡ Medium · Quality-of-life for dental lab users.

- [ ] Make invoice and job lifecycle states explicit in the UI — users should not need to infer the difference between `finished_factured`, `finished_unfactured`, `closed`, and `cancelled`
- [ ] Add confirmation dialogs and audit trail display for destructive or financial actions (delete invoice, cancel job, status rollback)
- [ ] Add role-specific dashboard views: technicians see their open jobs; admins see revenue summary and overdue invoices; superadmin sees cross-lab overview
- [ ] Treat invoice PDFs and CSV job exports as first-class features with a defined format and download flow
