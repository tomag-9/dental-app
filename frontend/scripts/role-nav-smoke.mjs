/**
 * role-nav-smoke.mjs
 *
 * Smoke tests for role-based navigation guards.
 * Tests normalizePageForRole() logic from App.jsx and
 * the Sidebar link visibility per role.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const designDir = path.join(rootDir, 'frontend', 'public', 'design');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// ── React harness (no-op, just enough for Sidebar to render) ────────────────

function createReactHarness() {
  return {
    createElement(type, props, ...children) {
      return { type, props: props || {}, children: children.flat() };
    },
    Fragment: 'Fragment',
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect() {},
  };
}

function collectText(node, out = []) {
  if (typeof node === 'string') out.push(node);
  if (!node || typeof node !== 'object') return out;
  for (const child of node.children || []) collectText(child, out);
  return out;
}

// ── Loaders ─────────────────────────────────────────────────────────────────

async function loadNormalizePageForRole() {
  const context = {
    window: {},
    React: createReactHarness(),
    ReactDOM: { createRoot: () => ({ render: () => {} }) },
    document: { getElementById: () => ({}) },
    // Stub page components — App.jsx imports them but we only need the exported fn
    Login: () => null,
    Dashboard: () => null,
    Jobs: () => null,
    JobDetail: () => null,
    Patients: () => null,
    PatientDetail: () => null,
    Finance: () => null,
    Invoices: () => null,
    Pricelist: () => null,
    Inventory: () => null,
    Calendar: () => null,
    Clinics: () => null,
    Doctors: () => null,
    Technicians: () => null,
    Settings: () => null,
    Permissions: () => null,
    Superadmin: () => null,
    Sidebar: () => null,
    Topbar: () => null,
    NewJob: () => null,
    CreateEntityDrawer: () => null,
    ToothDetailModal: () => null,
  };
  context.window.MolarisAPI = {
    savedUser: () => ({ role: 'admin' }),
    logout: () => {},
  };
  vm.createContext(context);
  vm.runInContext(await readFile(path.join(designDir, 'App.jsx'), 'utf8'), context);
  return context.window.normalizePageForRole;
}

async function renderSidebar(role) {
  const context = {
    window: { innerWidth: 1024, addEventListener: () => {}, removeEventListener: () => {} },
    React: createReactHarness(),
    Icon: () => null,
    Logo: () => null,
    LogoInverse: () => null,
    LogoMark: () => null,
  };
  vm.createContext(context);
  vm.runInContext(await readFile(path.join(designDir, 'Sidebar.jsx'), 'utf8'), context);
  const startPage = role === 'superadmin' ? 'sa_overview' : 'dashboard';
  const tree = context.window.Sidebar({
    currentPage: startPage,
    onNavigate: () => {},
    onLogout: () => {},
    user: { role, name: role, initials: role.slice(0, 2).toUpperCase() },
  });
  return collectText(tree).join(' ');
}

// ── Test 1: Regular user (role: "user") ─────────────────────────────────────

async function testRegularUserPageGuards() {
  const normalize = await loadNormalizePageForRole();

  // Should NOT have access to admin-only pages
  const blockedPages = ['finance', 'invoices', 'pricelist', 'inventory', 'materials', 'clinics',
                        'doctors', 'technicians', 'permissions', 'settings'];
  for (const page of blockedPages) {
    const result = normalize(page, 'user');
    assert(result === 'dashboard', `user on '${page}' should redirect to dashboard, got '${result}'`);
  }

  // Should NOT have access to superadmin pages
  assert(normalize('sa_overview', 'user') === 'dashboard', 'user should not access sa_overview');
  assert(normalize('sa_users', 'user') === 'dashboard', 'user should not access sa_users');
  assert(normalize('superadmin', 'user') === 'dashboard', 'user should not access superadmin page');

  // Should retain access to general pages
  assert(normalize('dashboard', 'user') === 'dashboard', 'user should access dashboard');
  assert(normalize('jobs', 'user') === 'jobs', 'user should access jobs');
  assert(normalize('calendar', 'user') === 'calendar', 'user should access calendar');
  assert(normalize('patients', 'user') === 'patients', 'user should access patients');

  console.log('  PASS: regular user page guards');
}

// ── Test 2: Technician (role: "technician") ──────────────────────────────────

async function testTechnicianPageGuards() {
  const normalize = await loadNormalizePageForRole();

  // Allowed pages for technician
  assert(normalize('dashboard', 'technician') === 'dashboard', 'technician can access dashboard');
  assert(normalize('jobs', 'technician') === 'jobs', 'technician can access jobs');
  assert(normalize('calendar', 'technician') === 'calendar', 'technician can access calendar');

  // Blocked admin-only pages
  const blockedAdminPages = ['finance', 'invoices', 'pricelist', 'inventory', 'materials',
                              'clinics', 'doctors', 'technicians', 'permissions', 'settings'];
  for (const page of blockedAdminPages) {
    const result = normalize(page, 'technician');
    assert(result === 'dashboard', `technician on '${page}' should redirect to dashboard, got '${result}'`);
  }

  // Technician cannot access patient pages
  assert(normalize('patients', 'technician') === 'dashboard', 'technician should not access patients');
  assert(normalize('patient_detail', 'technician') === 'dashboard', 'technician should not access patient_detail');

  console.log('  PASS: technician page guards');
}

// ── Test 3: Superadmin (role: "superadmin") ──────────────────────────────────

async function testSuperadminPageGuards() {
  const normalize = await loadNormalizePageForRole();

  // Superadmin stays on sa_ pages
  assert(normalize('sa_overview', 'superadmin') === 'sa_overview', 'superadmin can access sa_overview');
  assert(normalize('sa_users', 'superadmin') === 'sa_users', 'superadmin can access sa_users');
  assert(normalize('sa_tenants', 'superadmin') === 'sa_tenants', 'superadmin can access sa_tenants');
  assert(normalize('sa_audit', 'superadmin') === 'sa_audit', 'superadmin can access sa_audit');
  assert(normalize('sa_system', 'superadmin') === 'sa_system', 'superadmin can access sa_system');
  assert(normalize('settings', 'superadmin') === 'settings', 'superadmin can access settings (profile)');

  // Superadmin is redirected away from tenant operational pages
  const tenantPages = ['dashboard', 'jobs', 'patients', 'finance', 'invoices',
                       'pricelist', 'inventory', 'materials', 'calendar', 'clinics', 'doctors',
                       'technicians', 'permissions'];
  for (const page of tenantPages) {
    const result = normalize(page, 'superadmin');
    assert(result === 'sa_overview', `superadmin on '${page}' should redirect to sa_overview, got '${result}'`);
  }

  console.log('  PASS: superadmin page guards');
}

// ── Test 4: Admin (role: "admin") ────────────────────────────────────────────

async function testAdminPageGuards() {
  const normalize = await loadNormalizePageForRole();

  // Admin should access all tenant pages
  const allTenantPages = ['dashboard', 'jobs', 'patients', 'finance', 'invoices',
                           'pricelist', 'inventory', 'materials', 'calendar', 'clinics', 'doctors',
                           'technicians', 'permissions', 'settings'];
  for (const page of allTenantPages) {
    const result = normalize(page, 'admin');
    assert(result === page, `admin should access '${page}', got redirect to '${result}'`);
  }

  // Admin should be redirected away from superadmin pages
  assert(normalize('sa_overview', 'admin') === 'dashboard', 'admin should not access sa_overview');
  assert(normalize('sa_users', 'admin') === 'dashboard', 'admin should not access sa_users');
  assert(normalize('superadmin', 'admin') === 'dashboard', 'admin should not access superadmin page');

  console.log('  PASS: admin page guards');
}

// ── Test 5: Sidebar link visibility ─────────────────────────────────────────

async function testSidebarVisibility() {
  // Regular user sidebar
  const userSidebar = await renderSidebar('user');
  assert(!userSidebar.includes('Financie'), 'user sidebar: no Finance section label');
  assert(!userSidebar.includes('Konfigurácia'), 'user sidebar: no Config section label');
  assert(!userSidebar.includes('Oprávnenia'), 'user sidebar: no Permissions link');
  assert(!userSidebar.includes('Nastavenia'), 'user sidebar: no Settings link');
  assert(!userSidebar.includes('Superadmin'), 'user sidebar: no Superadmin section');
  assert(userSidebar.includes('Práce'), 'user sidebar: has Jobs link');
  assert(userSidebar.includes('Kalendár'), 'user sidebar: has Calendar link');

  // Technician sidebar — only dashboard, jobs, calendar
  const techSidebar = await renderSidebar('technician');
  assert(techSidebar.includes('Práce'), 'technician sidebar: has Jobs link');
  assert(techSidebar.includes('Kalendár'), 'technician sidebar: has Calendar link');
  assert(!techSidebar.includes('Pacienti'), 'technician sidebar: no Patients link');
  assert(!techSidebar.includes('Sklad'), 'technician sidebar: no Inventory link');
  assert(!techSidebar.includes('Nastavenia'), 'technician sidebar: no Settings link');
  assert(!techSidebar.includes('Oprávnenia'), 'technician sidebar: no Permissions link');

  // Admin sidebar — should see all tenant sections
  const adminSidebar = await renderSidebar('admin');
  assert(adminSidebar.includes('Financie') || adminSidebar.includes('Prehľad'), 'admin sidebar: has Finance section');
  assert(adminSidebar.includes('Konfigurácia'), 'admin sidebar: has Config section');
  assert(adminSidebar.includes('Oprávnenia'), 'admin sidebar: has Permissions link');
  assert(adminSidebar.includes('Nastavenia'), 'admin sidebar: has Settings link');
  assert(adminSidebar.includes('Materiály'), 'admin sidebar: has Materials link');

  // Superadmin sidebar — platform pages only, no tenant operational links
  const saSidebar = await renderSidebar('superadmin');
  assert(saSidebar.includes('Tenanti'), 'superadmin sidebar: has Tenants link');
  assert(!saSidebar.includes('Práce'), 'superadmin sidebar: no Jobs link');
  assert(!saSidebar.includes('Pacienti'), 'superadmin sidebar: no Patients link');

  console.log('  PASS: sidebar role visibility');
}

// ── Run all tests ────────────────────────────────────────────────────────────

console.log('Running role-nav smoke tests...');

await testRegularUserPageGuards();
await testTechnicianPageGuards();
await testSuperadminPageGuards();
await testAdminPageGuards();
await testSidebarVisibility();

console.log('role-nav smoke OK');
