import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const designDir = path.join(rootDir, 'frontend', 'public', 'design');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

async function loadApi(fetchImpl) {
  const localStorage = createStorage();
  localStorage.setItem('molaris.access', 'token');
  const context = {
    window: {
      __API_BASE_URL: 'http://test.local/api',
      dispatchEvent: () => {},
    },
    localStorage,
    fetch: fetchImpl,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    URL,
    document: {},
    setTimeout,
  };
  context.window.localStorage = localStorage;
  vm.createContext(context);
  vm.runInContext(await readFile(path.join(designDir, 'api-client.js'), 'utf8'), context);
  return context.window.MolarisAPI;
}

async function testPermissionApiClient() {
  const requests = [];
  const api = await loadApi(async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (url.endsWith('/core/permissions/matrix/')) {
      return jsonResponse({ matrix: { admin: { actions: ['lab:read'] } } });
    }
    if (url.endsWith('/core/labs/7/permissions/') && !options.method) {
      return jsonResponse([{ id: 1, role: 'user', action: 'job:write', allowed: false }]);
    }
    if (url.endsWith('/core/labs/7/permissions/') && options.method === 'POST') {
      return jsonResponse({ id: 2, ...JSON.parse(options.body) }, 201);
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  await api.fetchPermissionsMatrix();
  await api.fetchLabRolePermissions(7);
  await api.saveLabRolePermission(7, { role: 'user', action: 'job:write', allowed: false });

  assert(requests[0].url.endsWith('/core/permissions/matrix/'), 'matrix endpoint should be requested');
  assert(requests[1].url.endsWith('/core/labs/7/permissions/'), 'lab permissions endpoint should include lab id');
  assert(requests[2].method === 'POST', 'permission save should POST');
  assert(requests[2].body.role === 'user', 'permission save should send role');
  assert(requests[2].body.action === 'job:write', 'permission save should send action');
  assert(requests[2].body.allowed === false, 'permission save should send allowed flag');
}

async function loadPermissionsUtilities() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(await readFile(path.join(designDir, 'Permissions.jsx'), 'utf8'), context);
  return context.window.__MOLARIS_PERMISSION_TESTS;
}

async function testPermissionStateMapping() {
  const utils = await loadPermissionsUtilities();
  const state = utils.buildPermissionState({
    matrix: {
      admin: { actions: ['job:read', 'job:write'] },
      user: { actions: ['job:read', 'job:write'] },
      technician: { actions: ['job:read'] },
    },
  }, [
    { role: 'user', action: 'job:write', allowed: false },
    { role: 'technician', action: 'job:write', allowed: true },
  ]);

  assert(state.admin.job === 'edit', 'admin base actions should map to edit');
  assert(state.user.job === 'view', 'write=false override should map user job to view');
  assert(state.technician.job === 'edit', 'write=true override should map technician job to edit');

  const actions = utils.actionsForState('job', 'none');
  assert(actions.some(item => item.name === 'job:read' && item.allowed === false), 'none should deny read');
  assert(actions.some(item => item.name === 'job:write' && item.allowed === false), 'none should deny write');
}

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
  const tree = context.window.Sidebar({
    currentPage: role === 'superadmin' ? 'sa_overview' : 'dashboard',
    onNavigate: () => {},
    onLogout: () => {},
    user: { role, name: role, initials: role.slice(0, 2).toUpperCase() },
  });
  return collectText(tree).join(' ');
}

async function testRoleNavigation() {
  const admin = await renderSidebar('admin');
  assert(admin.includes('Financie'), 'admin should see finance navigation');
  assert(admin.includes('Konfigurácia'), 'admin should see config navigation');
  assert(admin.includes('Oprávnenia'), 'admin should see permissions navigation');

  const user = await renderSidebar('user');
  assert(!user.includes('Financie'), 'regular user should not see finance navigation');
  assert(!user.includes('Konfigurácia'), 'regular user should not see config navigation');
  assert(!user.includes('Oprávnenia'), 'regular user should not see permissions navigation');
  assert(!user.includes('Superadmin'), 'regular user should not see superadmin navigation');

  const technician = await renderSidebar('technician');
  assert(technician.includes('Práce'), 'technician should see jobs navigation');
  assert(technician.includes('Kalendár'), 'technician should see calendar navigation');
  assert(!technician.includes('Pacienti'), 'technician should not see patients navigation');
  assert(!technician.includes('Sklad'), 'technician should not see inventory navigation');
  assert(!technician.includes('Nastavenia'), 'technician should not see settings navigation');

  const superadmin = await renderSidebar('superadmin');
  assert(superadmin.includes('Tenanti'), 'superadmin should see platform navigation');
  assert(!superadmin.includes('Práce'), 'superadmin should not see tenant operations navigation');
}

async function testDirectNavigationGuard() {
  const context = {
    window: {},
    React: createReactHarness(),
    ReactDOM: { createRoot: () => ({ render: () => {} }) },
    document: { getElementById: () => ({}) },
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

  assert(context.window.normalizePageForRole('jobs', 'superadmin') === 'sa_overview', 'superadmin tenant page should redirect');
  assert(context.window.normalizePageForRole('sa_users', 'user') === 'dashboard', 'tenant user platform page should redirect');
  assert(context.window.normalizePageForRole('finance', 'user') === 'dashboard', 'regular user finance page should redirect');
  assert(context.window.normalizePageForRole('patients', 'technician') === 'dashboard', 'technician patient page should redirect');
  assert(context.window.normalizePageForRole('calendar', 'technician') === 'calendar', 'technician calendar page should be allowed');
}

await testPermissionApiClient();
await testPermissionStateMapping();
await testRoleNavigation();
await testDirectNavigationGuard();

console.log('permissions smoke OK');
