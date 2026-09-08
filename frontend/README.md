# Frontend

Fresh Vite shell for the Molaris React UI.

```bash
npm install
npm run dev
npm run build
```

The development server defaults to http://localhost:5367 and talks to the Django API via `VITE_API_URL`.

## Checks

```bash
npm run lint                 # eslint over src/
npm run typecheck            # tsc --noEmit (src/api only)
npm run test:unit            # node:test unit tests in tests/unit/ — no stack needed
npm run smoke:no-prod-mocks  # guards against demo data in src/ — no stack needed
npm run test:e2e             # Playwright specs in e2e/ — needs a running stack
npm run smoke:visual         # manual screenshot pass — needs a running stack, not in CI
```

Everything except `smoke:visual` runs in CI (`.github/workflows/ci.yml`).
