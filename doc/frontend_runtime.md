# Frontend runtime decision

Updated: 2026-05-26

## Decision

The `new/version` branch keeps the current Vite shell with script-loaded files
from `frontend/public/design`.

This branch intentionally treats the design runtime as the product surface for
now:

- `frontend/src/main.js` owns bootstrapping and loads the ordered design files.
- Shared UI primitives live in `frontend/public/design/Shared.jsx`.
- Page-level screens live in `frontend/public/design/*.jsx`.
- The older modular React tree from `develop` is not the active runtime on this
  branch.

## Why

The active branch contains the newest backend contracts, API wiring, export
flows, dashboard/search/notification work, and dental workflow UI inside
`public/design`. Moving back to the older modular tree would be a larger
frontend migration and would risk losing current parity work.

## Follow-up rule

New frontend work on this branch should extend the existing design runtime
until a dedicated migration task is opened. If the app later moves back to
module-based React pages, do it as a separate migration with route-by-route
parity checks.
