// role-nav.test.mjs — role-based navigation guards.
//
// Replaces scripts/role-nav-smoke.mjs (#127). That script read the removed
// frontend/public/design/ directory and had been dying with an unhandled ENOENT;
// the logic it covered — `normalizePageForRole()` in src/App.jsx and the
// per-role Sidebar link config — is pure and belongs in a unit test with a real
// runner rather than in an ad-hoc script.

import { strict as assert } from 'node:assert';
import test from 'node:test';

import { collectText, createReactHarness, loadGlobalScript, resolveExport } from './harness.mjs';

const APP_CONTEXT = {
  ReactDOM: { createRoot: () => ({ render: () => {} }) },
  document: { getElementById: () => ({}) },
};

const normalizePageForRole = await resolveExport('App.jsx', 'normalizePageForRole', APP_CONTEXT);

const ADMIN_ONLY_PAGES = [
  'finance', 'invoices', 'pricelist', 'inventory', 'materials',
  'clinics', 'doctors', 'technicians', 'permissions', 'settings',
];
const SUPERADMIN_PAGES = ['sa_overview', 'sa_tenants', 'sa_users', 'sa_audit', 'sa_system', 'sa_billing'];
const TENANT_PAGES = ['dashboard', 'jobs', 'patients', 'calendar', ...ADMIN_ONLY_PAGES.filter((p) => p !== 'settings')];

test('normalizePageForRole: admin keeps every tenant page', () => {
  for (const page of [...TENANT_PAGES, 'settings']) {
    assert.equal(normalizePageForRole(page, 'admin'), page, `admin should stay on '${page}'`);
  }
});

test('normalizePageForRole: admin is sent back from platform pages', () => {
  for (const page of [...SUPERADMIN_PAGES, 'superadmin']) {
    assert.equal(normalizePageForRole(page, 'admin'), 'dashboard', `admin must not reach '${page}'`);
  }
});

test('normalizePageForRole: plain user loses admin-only pages but keeps shared ones', () => {
  for (const page of ADMIN_ONLY_PAGES) {
    assert.equal(normalizePageForRole(page, 'user'), 'dashboard', `user must not reach '${page}'`);
  }
  for (const page of ['dashboard', 'jobs', 'calendar', 'patients']) {
    assert.equal(normalizePageForRole(page, 'user'), page, `user should stay on '${page}'`);
  }
  for (const page of [...SUPERADMIN_PAGES, 'superadmin']) {
    assert.equal(normalizePageForRole(page, 'user'), 'dashboard', `user must not reach '${page}'`);
  }
});

test('normalizePageForRole: technician additionally loses the patient pages', () => {
  for (const page of ['dashboard', 'jobs', 'calendar']) {
    assert.equal(normalizePageForRole(page, 'technician'), page, `technician should stay on '${page}'`);
  }
  for (const page of [...ADMIN_ONLY_PAGES, 'patients', 'patient_detail']) {
    assert.equal(normalizePageForRole(page, 'technician'), 'dashboard', `technician must not reach '${page}'`);
  }
});

test('normalizePageForRole: superadmin sees only platform pages plus its own profile', () => {
  for (const page of SUPERADMIN_PAGES) {
    assert.equal(normalizePageForRole(page, 'superadmin'), page, `superadmin should stay on '${page}'`);
  }
  assert.equal(normalizePageForRole('settings', 'superadmin'), 'settings', 'superadmin keeps the profile page');
  for (const page of TENANT_PAGES) {
    assert.equal(normalizePageForRole(page, 'superadmin'), 'sa_overview', `superadmin must not reach '${page}'`);
  }
  // Pages removed in #109 must not render a blank tab.
  assert.equal(normalizePageForRole('sa_security', 'superadmin'), 'sa_overview', 'removed sa_ page falls back');
  assert.equal(normalizePageForRole('sa_integrations', 'superadmin'), 'sa_overview', 'removed sa_ page falls back');
});

test('normalizePageForRole: empty/unknown input never crashes', () => {
  assert.equal(normalizePageForRole(undefined, 'admin'), '');
  assert.equal(normalizePageForRole(null, 'user'), '');
  assert.equal(normalizePageForRole('', 'superadmin'), 'sa_overview');
});

// ── Sidebar link visibility ────────────────────────────────────────────────
// Guarding the page is only half the job: a link the role cannot use must not
// be rendered either. The e2e suite covers admin and user; technician and
// superadmin only exist here.

async function sidebarLabels(role) {
  const win = await loadGlobalScript('components/Sidebar.jsx', {
    // >= 1100 px, otherwise the sidebar auto-collapses and renders icons only.
    window: { innerWidth: 1440, addEventListener: () => {}, removeEventListener: () => {} },
    React: createReactHarness(),
    // Sidebar renders these through the global scope (see harness.mjs).
    Icon: () => null,
    MolarisMark: () => null,
    MolarisLockup: () => null,
    MolarisInverse: () => null,
  });
  const tree = win.Sidebar({
    currentPage: role === 'superadmin' ? 'sa_overview' : 'dashboard',
    onNavigate: () => {},
    onLogout: () => {},
    user: { role, name: role, initials: role.slice(0, 2).toUpperCase() },
  });
  return collectText(tree).join(' ');
}

test('Sidebar: admin sees the finance and configuration sections', async () => {
  const labels = await sidebarLabels('admin');
  for (const label of ['Financie', 'Konfigurácia', 'Oprávnenia', 'Nastavenia', 'Materiály']) {
    assert.ok(labels.includes(label), `admin sidebar should contain '${label}'`);
  }
});

test('Sidebar: plain user sees neither finance nor configuration', async () => {
  const labels = await sidebarLabels('user');
  for (const label of ['Financie', 'Konfigurácia', 'Oprávnenia', 'Nastavenia', 'Superadmin']) {
    assert.ok(!labels.includes(label), `user sidebar must not contain '${label}'`);
  }
  for (const label of ['Práce', 'Kalendár']) {
    assert.ok(labels.includes(label), `user sidebar should contain '${label}'`);
  }
});

test('Sidebar: technician sees only jobs and calendar', async () => {
  const labels = await sidebarLabels('technician');
  for (const label of ['Práce', 'Kalendár']) {
    assert.ok(labels.includes(label), `technician sidebar should contain '${label}'`);
  }
  for (const label of ['Pacienti', 'Sklad', 'Nastavenia', 'Oprávnenia']) {
    assert.ok(!labels.includes(label), `technician sidebar must not contain '${label}'`);
  }
});

test('Sidebar: superadmin sees platform links only', async () => {
  const labels = await sidebarLabels('superadmin');
  assert.ok(labels.includes('Tenanti'), 'superadmin sidebar should contain Tenanti');
  for (const label of ['Práce', 'Pacienti']) {
    assert.ok(!labels.includes(label), `superadmin sidebar must not contain '${label}'`);
  }
});
