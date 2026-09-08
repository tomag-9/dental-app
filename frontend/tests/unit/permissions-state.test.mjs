// permissions-state.test.mjs — role/permission matrix mapping.
//
// Replaces the only part of scripts/permissions-smoke.mjs that was not already
// covered elsewhere (#127): the pure mapping between the backend permission
// matrix + per-lab overrides and the three-state UI toggle (edit / view / none).
// The rest of that script — the API endpoint shapes and the per-role sidebar —
// is covered by e2e/permissions.spec.js and tests/unit/role-nav.test.mjs.

import { strict as assert } from 'node:assert';
import test from 'node:test';

import { loadGlobalScript } from './harness.mjs';

const win = await loadGlobalScript('pages/Permissions.jsx', {
  window: { MolarisAPI: { savedUser: () => ({ role: 'admin' }) } },
});
const utils = win.__MOLARIS_PERMISSION_TESTS;

if (!utils) {
  throw new Error('src/pages/Permissions.jsx no longer exposes __MOLARIS_PERMISSION_TESTS');
}

// Values produced inside the sandbox come from another realm, so their
// prototypes are not identical to this realm's — normalize before deep-comparing.
const plain = (value) => JSON.parse(JSON.stringify(value));

const MATRIX = {
  matrix: {
    admin: { actions: ['job:read', 'job:write'] },
    user: { actions: ['job:read', 'job:write'] },
    technician: { actions: ['job:read'] },
  },
};

test('buildPermissionState: base matrix maps read+write to edit, read-only to view', () => {
  const state = utils.buildPermissionState(MATRIX, []);
  assert.equal(state.admin.job, 'edit');
  assert.equal(state.user.job, 'edit');
  assert.equal(state.technician.job, 'view');
});

test('buildPermissionState: lab overrides win over the base matrix', () => {
  const state = utils.buildPermissionState(MATRIX, [
    { role: 'user', action: 'job:write', allowed: false },
    { role: 'technician', action: 'job:write', allowed: true },
  ]);
  assert.equal(state.user.job, 'view', 'write=false downgrades to view');
  assert.equal(state.technician.job, 'edit', 'write=true upgrades to edit');
  assert.equal(state.admin.job, 'edit', 'other roles are untouched');
});

test('buildPermissionState: denying read drops the module to none', () => {
  const state = utils.buildPermissionState(MATRIX, [
    { role: 'user', action: 'job:read', allowed: false },
    { role: 'user', action: 'job:write', allowed: false },
  ]);
  assert.equal(state.user.job, 'none');
});

test('buildPermissionState: an empty matrix yields none for every role', () => {
  const state = utils.buildPermissionState({}, []);
  for (const role of ['admin', 'user', 'technician']) {
    assert.equal(state[role].job, 'none', `${role} should have no access without a matrix`);
  }
});

test('actionsForState: each state maps to the right read/write flags', () => {
  const flags = (state) => Object.fromEntries(utils.actionsForState('job', state).map((a) => [a.name, a.allowed]));
  assert.deepEqual(plain(flags('edit')), { 'job:read': true, 'job:write': true });
  assert.deepEqual(plain(flags('view')), { 'job:read': true, 'job:write': false });
  assert.deepEqual(plain(flags('none')), { 'job:read': false, 'job:write': false });
});

test('collectPermissionChanges: only changed, unlocked roles are reported', () => {
  const baseline = utils.buildPermissionState(MATRIX, []);
  const current = JSON.parse(JSON.stringify(baseline));
  current.user.job = 'view';
  current.admin.job = 'none'; // admin is locked — must be ignored
  const changes = utils.collectPermissionChanges(baseline, current);
  assert.deepEqual(plain(changes), [{ roleId: 'user', modId: 'job', before: 'edit', next: 'view' }]);
});

test('collectPermissionChanges: identical states produce no changes', () => {
  const baseline = utils.buildPermissionState(MATRIX, []);
  assert.deepEqual(plain(utils.collectPermissionChanges(baseline, baseline)), []);
});
