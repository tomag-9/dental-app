# Visual smoke and accessibility checklist

Updated: 2026-05-26

## Scope

Use this checklist before merging frontend changes on `new/version`.

Critical screens:

- Dashboard
- Jobs
- Patients
- Finance
- Inventory
- Settings

Responsive viewports:

- Desktop: 1440 x 900
- Mobile: 390 x 844

## Checks

- Page renders without a blank screen.
- Main content fits the viewport without incoherent overlap.
- Horizontal overflow is limited to intentional tables or data grids.
- Empty, loading, and error states are readable.
- Dialogs and drawers close with `Escape`.
- Dialogs and drawers restore focus to the opener when closed.
- Popovers and command palette close with `Escape` or outside click.
- Command palette supports `ArrowUp`, `ArrowDown`, and `Enter`.
- Focus is visible on buttons, links, inputs, and table rows.
- UI copy does not rely on emoji glyphs.

## Screenshot command

```bash
cd frontend
npm run smoke:visual
```

Screenshots are written to `doc/qa/visual-smoke/2026-05-26/`.

## Latest run

The latest run captured desktop and mobile screenshots for Dashboard, Jobs,
Patients, Finance, Inventory, and Settings.
