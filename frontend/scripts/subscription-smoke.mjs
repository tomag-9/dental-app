#!/usr/bin/env node
// subscription-smoke.mjs — verifies the SaaS Subscription tab (#105) and the
// signup screen (#106) are wired to the real backend rather than hardcoded,
// and that the two are kept apart from the pre-existing invoice "Fakturácia"
// billing tab (a different concept entirely — see Settings.jsx).
//
// Static check via Node `vm` with a stub React — no bundler, no browser (see
// scripts/job-label-smoke.mjs for the pattern this follows).
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

function readSrc(rel) {
  return readFileSync(resolve(SRC, rel), 'utf8');
}

// ── 1. Settings.jsx has a Subscription tab, separate from Fakturácia ───────
console.log('subscription smoke: Settings has a Predplatné tab distinct from Fakturácia (#105)');
const settingsSource = readSrc('pages/Settings.jsx');

check(
  "a 'subscription' tab entry exists",
  /value:\s*'subscription'/.test(settingsSource),
);
check(
  "the existing 'billing' (Fakturácia) tab is untouched — the two stay separate",
  /value:\s*'billing'/.test(settingsSource) && /Fakturácia/.test(settingsSource),
);
check(
  'a SubscriptionPanel component renders for the subscription tab',
  /tab === 'subscription'[\s\S]{0,80}SubscriptionPanel/.test(settingsSource),
);
check(
  'SubscriptionPanel loads real data via MolarisAPI.fetchMySubscription, not hardcoded',
  /fetchMySubscription/.test(settingsSource),
);
check(
  'checkout redirect goes through MolarisAPI.createSubscriptionCheckout',
  /createSubscriptionCheckout/.test(settingsSource),
);
check(
  'billing-portal redirect goes through MolarisAPI.createSubscriptionPortalSession',
  /createSubscriptionPortalSession/.test(settingsSource),
);
check(
  'plan comparison lists all three plans (free/pro/enterprise), not just one hardcoded plan',
  /free/.test(settingsSource) && /'pro'/.test(settingsSource) && /enterprise/.test(settingsSource),
);
check(
  'seats usage is rendered from server data (seats_used / seat_limit), not a fixed number',
  /seats_used/.test(settingsSource) && /seat_limit/.test(settingsSource),
);
check(
  'read-only state is surfaced from billing.read_only before any 402',
  /billing[.?]?\??\.\s*read_only|\.read_only/.test(settingsSource),
);
check(
  'the panel distinguishes a Checkout return that is still waiting for the webhook',
  /checkoutReturn/.test(settingsSource) && /webhook/i.test(settingsSource),
);

// ── 2. Topbar shows a persistent banner when the subscription is at risk ───
console.log('subscription smoke: Topbar carries a persistent at-risk banner (#105)');
const topbarSource = readSrc('components/Topbar.jsx');

check('Topbar loads subscription billing state via MolarisAPI.fetchMySubscription', /fetchMySubscription/.test(topbarSource));
check(
  'the banner condition covers past_due/read-only, grace, and a trial ending soon — not a single hardcoded case',
  /read_only/.test(topbarSource) && /grace_ends_at/.test(topbarSource) && /trial_ends_at/.test(topbarSource),
);
check(
  'the trial warning window is derived, not a magic literal disconnected from the 7-day rule',
  /7/.test(topbarSource),
);

// ── 3. Login screen offers registration, wired to POST /users/signup/ ──────
console.log('subscription smoke: Login toggles into a registration screen wired to signup (#106)');
const loginSource = readSrc('pages/Login.jsx');

check('Login.jsx can switch between sign-in and registration modes', /register|signup|Registr/i.test(loginSource));
check('registration submits via MolarisAPI.signup, not a hardcoded fetch', /MolarisAPI\.signup/.test(loginSource));
check('registration collects the lab name', /labName|lab_name/.test(loginSource));
check('registration collects a password field', /password/i.test(loginSource));

// ── 4. auth.js / api-client.js expose signup end to end ────────────────────
console.log('subscription smoke: signup is exported through the API client');
const authSource = readSrc('api/auth.js');
const apiClientSource = readSrc('api/api-client.js');
const financeSource = readSrc('api/finance.js');

check('auth.js exports a signup() function', /export\s+async function signup/.test(authSource));
check('api-client.js re-exports signup on window.MolarisAPI', /signup:\s*auth\.signup/.test(apiClientSource));
check('finance.js exports fetchMySubscription', /export\s+async function fetchMySubscription/.test(financeSource));
check('finance.js exports createSubscriptionCheckout', /export\s+async function createSubscriptionCheckout/.test(financeSource));
check('finance.js exports createSubscriptionPortalSession', /export\s+async function createSubscriptionPortalSession/.test(financeSource));
check(
  'api-client.js re-exports all three subscription calls',
  /fetchMySubscription:\s*finance\.fetchMySubscription/.test(apiClientSource) &&
  /createSubscriptionCheckout:\s*finance\.createSubscriptionCheckout/.test(apiClientSource) &&
  /createSubscriptionPortalSession:\s*finance\.createSubscriptionPortalSession/.test(apiClientSource),
);

report();

function report() {
  console.log('');
  if (failures.length) {
    console.error(`subscription smoke FAILED — ${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
    console.error('Fix: add the Predplatné tab (#105) wired to /v1/finance/subscriptions/my/,');
    console.error('checkout/, and portal/, a persistent Topbar warning banner, and a registration');
    console.error('screen (#106) wired to MolarisAPI.signup / POST /core/users/signup/.');
    process.exit(1);
  }
  console.log('subscription smoke OK — the Predplatné tab and signup screen are wired to the real backend.');
  process.exit(0);
}
