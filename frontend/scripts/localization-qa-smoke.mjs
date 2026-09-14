#!/usr/bin/env node
// localization-qa-smoke.mjs — static QA checks for issue #65 (localization,
// content rules, required-field markers, loading/error states, focus traps).
//
// Static source checks via plain regex — no bundler, no browser, matching the
// pattern of scripts/tooth-chart-smoke.mjs / job-label-smoke.mjs but simpler
// since these are source-text invariants rather than runtime derivations.
//
// Exit codes: 0 = all assertions pass, 1 = a check failed.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '..', 'src');

const failures = [];
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

function read(rel) {
  return readFileSync(resolve(SRC, rel), 'utf8');
}

// ── 1. No leftover English UI strings ───────────────────────────────────────
console.log('localization-qa smoke: no leftover English UI strings');

const newJobSource = read('components/NewJob.jsx');
check(
  "priority picker uses 'Urgentná', not the English 'Urgent'",
  !/label:\s*'Urgent'/.test(newJobSource) && /'Urgentná'/.test(newJobSource),
);

const coreApiSource = read('api/core.js');
check(
  'api/core.js default request-failure message is Slovak, not "API request failed"',
  !/'API request failed'/.test(coreApiSource),
);

// ── 4. Required fields marked with a red asterisk ───────────────────────────
console.log('localization-qa smoke: required fields are marked');

const settingsSource = read('pages/Settings.jsx');
check(
  'Lab name field (LabPanel) is marked required',
  /label:\s*'Názov laboratória'[\s\S]{0,200}?required:\s*true/.test(settingsSource),
);
check(
  'password-change fields (current/next/confirm) are marked required',
  ['current', 'next', 'confirm'].every((field) => new RegExp(
    `value:\\s*form\\.${field},[\\s\\S]{0,200}?required:\\s*true`,
  ).test(settingsSource)),
);

// ── 3. Date formatting consistency (d. M. yyyy — no zero-padded variants) ──
console.log('localization-qa smoke: date formatting is consistent across pages');

check(
  'Settings.jsx date helpers no longer zero-pad day/month (day: "2-digit")',
  !/day:\s*'2-digit'/.test(settingsSource),
);

const superadminSource = read('pages/Superadmin.jsx');
check(
  'Superadmin.jsx date helper no longer zero-pads day/month',
  !/day:\s*'2-digit'/.test(superadminSource),
);

// ── 5. Dashboard shows loading/error state instead of silently showing zeros ─
console.log('localization-qa smoke: Dashboard surfaces workspace loading/error state');

const dashboardSource = read('pages/Dashboard.jsx');
check('Dashboard reads workspace.loading', /workspace\.loading/.test(dashboardSource));
check('Dashboard reads workspace.error', /workspace\.error/.test(dashboardSource));
check(
  'Dashboard "Obnoviť" button is wired to a refresh handler, not inert',
  !/'Obnoviť'\)/.test(dashboardSource) || /onClick:\s*\(\)\s*=>.*refresh/i.test(dashboardSource) || /molaris-workspace-refresh/.test(dashboardSource),
);

// ── 7. Focus is trapped inside modal dialogs (Tab cannot escape to the page) ─
console.log('localization-qa smoke: modal dialogs trap Tab focus');

const sharedSource = read('components/Shared.jsx');
check(
  'Drawer traps Tab focus within the dialog',
  /function Drawer/.test(sharedSource) && /trapFocus|focusableSelector/.test(sharedSource),
);
check(
  'ConfirmDialog traps Tab focus within the dialog',
  /function ConfirmDialog/.test(sharedSource) && (sharedSource.match(/trapFocus|focusableSelector/g) || []).length >= 2,
);

const materialsSource = read('pages/Materials.jsx');
check(
  'MatModal closes on Escape like the other modals in the app',
  /function MatModal/.test(materialsSource) && /Escape/.test(materialsSource.slice(materialsSource.indexOf('function MatModal'))),
);

// ── Summary ──────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\nlocalization-qa smoke: ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nlocalization-qa smoke: all checks passed');
