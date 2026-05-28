import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const apiClientPath = path.join(rootDir, 'frontend', 'public', 'design', 'api-client.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

async function loadClient(fetchImpl) {
  const localStorage = createStorage();
  const events = [];
  const context = {
    window: {
      __API_BASE_URL: 'http://test.local/api',
      dispatchEvent: (event) => events.push(event.type),
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
  context.window.fetch = fetchImpl;
  vm.createContext(context);
  vm.runInContext(await readFile(apiClientPath, 'utf8'), context, {
    filename: apiClientPath,
  });
  return { api: context.window.MolarisAPI, localStorage, events };
}

async function testCleanStorageShowsLoggedOut() {
  const { api } = await loadClient(async () => jsonResponse({}));
  assert(api.savedUser() === null, 'savedUser must be null with clean storage');
  assert(api.isAuthenticated() === false, 'clean storage must not authenticate');
}

async function testLoginStoresTokensAndUser() {
  const requests = [];
  const { api, localStorage } = await loadClient(async (url, options = {}) => {
    requests.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (url.endsWith('/token/')) {
      return jsonResponse({ access: 'access-token', refresh: 'refresh-token' });
    }
    if (url.endsWith('/core/users/me/')) {
      return jsonResponse({
        id: 7,
        username: 'admin',
        email: 'admin@test.sk',
        role: 'admin',
        first_name: 'Ada',
        last_name: 'Admin',
        lab_details: { id: 1, name: 'Lab' },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  const user = await api.login('admin', 'pw');

  assert(user.name === 'Ada Admin', 'login should normalize user name');
  assert(localStorage.getItem('molaris.access') === 'access-token', 'access token must be stored');
  assert(localStorage.getItem('molaris.refresh') === 'refresh-token', 'refresh token must be stored');
  assert(requests[0].body.username === 'admin', 'login should send username');
  assert(!('totp_code' in requests[0].body), 'login should omit empty totp_code');
}

async function testTotpPayloadAndErrors() {
  const payloads = [];
  const { api } = await loadClient(async (url, options = {}) => {
    payloads.push(options.body ? JSON.parse(options.body) : null);
    if (url.endsWith('/token/')) {
      return jsonResponse({ detail: 'TOTP code required.' }, 401);
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  try {
    await api.login('admin', 'pw', '123456');
    throw new Error('2FA-required login should fail in this fixture');
  } catch (error) {
    assert(error.requiresTotp === true, 'TOTP-required error must be flagged');
  }
  assert(payloads[0].totp_code === '123456', 'login should send totp_code when present');

  const invalid = await loadClient(async (url) => {
    if (url.endsWith('/token/')) {
      return jsonResponse({ detail: 'Invalid TOTP code.' }, 401);
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  try {
    await invalid.api.login('admin', 'pw', '000000');
    throw new Error('Invalid 2FA login should fail in this fixture');
  } catch (error) {
    assert(error.invalidTotp === true, 'Invalid TOTP error must be flagged');
  }
}

async function testLogoutAnd401ClearStorage() {
  const { api, localStorage, events } = await loadClient(async () => jsonResponse({ detail: 'Unauthorized' }, 401));
  localStorage.setItem('molaris.access', 'access-token');
  localStorage.setItem('molaris.refresh', 'refresh-token');
  localStorage.setItem('molaris.user', '{"id":1}');

  try {
    await api.fetchMe();
    throw new Error('401 fetch should throw');
  } catch (error) {
    assert(error.status === 401, '401 status should be preserved');
  }

  assert(localStorage.getItem('molaris.access') === null, '401 should clear access token');
  assert(localStorage.getItem('molaris.refresh') === null, '401 should clear refresh token');
  assert(localStorage.getItem('molaris.user') === null, '401 should clear saved user');
  assert(events.includes('molaris-auth-expired'), '401 should dispatch auth-expired event');

  localStorage.setItem('molaris.access', 'again');
  api.logout();
  assert(localStorage.getItem('molaris.access') === null, 'logout should clear access token');
}

await testCleanStorageShowsLoggedOut();
await testLoginStoresTokensAndUser();
await testTotpPayloadAndErrors();
await testLogoutAnd401ClearStorage();

console.log('auth smoke OK');
