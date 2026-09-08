/// <reference path="./globals.d.ts" />
import { API_BASE, getCsrfToken, request } from './core.js';

const userKey = 'molaris.user';

/** @param {unknown} err */
export function isTotpRequiredError(err) {
  const e = /** @type {ApiError} */ (err);
  const detail = String((e && e.data && /** @type {any} */(e.data).detail) || e.message || '');
  const code = String((e && e.data && /** @type {any} */(e.data).code) || /** @type {any} */(e).code || '');
  return e && e.status === 401 && (
    code === 'totp_required' ||
    detail.toLowerCase().includes('totp code required')
  );
}

/** @param {unknown} err */
export function isTotpInvalidError(err) {
  const e = /** @type {ApiError} */ (err);
  const detail = String((e && e.data && /** @type {any} */(e.data).detail) || e.message || '');
  const code = String((e && e.data && /** @type {any} */(e.data).code) || /** @type {any} */(e).code || '');
  return e && e.status === 401 && (
    code === 'totp_invalid' ||
    detail.toLowerCase().includes('invalid totp code')
  );
}

/**
 * @param {string} username
 * @param {string} password
 * @param {string} [totpCode]
 */
export async function login(username, password, totpCode = '') {
  const payload = { username, password };
  if (totpCode) payload.totp_code = totpCode;
  try {
    await request('/token/', { method: 'POST', body: JSON.stringify(payload), headers: {} });
  } catch (error) {
    if (isTotpRequiredError(error)) error.requiresTotp = true;
    if (isTotpInvalidError(error)) error.invalidTotp = true;
    throw error;
  }
  return storeCurrentUser();
}

/** Load /users/me/ after a successful token exchange and cache the session user. */
async function storeCurrentUser() {
  const me = await request('/core/users/me/');
  const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.nickname || me.username;
  const user = {
    id: me.id,
    name,
    email: me.email || '',
    username: me.username,
    role: me.role || 'admin',
    initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U',
    lab: me.lab_details || null,
  };
  localStorage.setItem(userKey, JSON.stringify(user));
  return user;
}

export function logout() {
  fetch(`${API_BASE}/core/auth/logout/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': getCsrfToken() },
  }).catch(() => {});
  localStorage.removeItem(userKey);
}

export function savedUser() {
  try { return JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { return null; }
}

export function isAuthenticated() {
  return !!localStorage.getItem(userKey);
}

/** @param {string} path */
export function authUrl(path) {
  return `${API_BASE}${path}`;
}

export async function fetchMe() {
  return request('/core/users/me/');
}

export async function fetchCurrentLab() {
  const labs = await request('/labs/');
  return Array.isArray(labs) ? labs[0] : labs;
}

/** @param {Record<string, unknown>} [payload] */
export async function updateMe(payload) {
  return request('/core/users/me/', { method: 'PUT', body: JSON.stringify(payload || {}) });
}

/** @param {number} id @param {Record<string, unknown>} [payload] */
export async function updateLab(id, payload) {
  if (!id) throw new Error('Lab ID is required');
  return request(`/core/labs/${id}/`, { method: 'PATCH', body: JSON.stringify(payload || {}) });
}

/** @param {number} [limit] */
export async function fetchLabMembers(limit = 100) {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/users/${suffix}`);
}

export async function fetchPermissionsMatrix() {
  return request('/core/permissions/matrix/');
}

/** @param {number} labId */
export async function fetchLabRolePermissions(labId) {
  if (!labId) throw new Error('Lab ID is required');
  return request(`/core/labs/${labId}/permissions/`);
}

/** @param {number} labId @param {Record<string, unknown>} [payload] */
export async function saveLabRolePermission(labId, payload) {
  if (!labId) throw new Error('Lab ID is required');
  return request(`/core/labs/${labId}/permissions/`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

/** @param {number} [limit] */
export async function fetchNotifications(limit = 8) {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/notifications/${suffix}`);
}

export async function fetchUnreadCount() {
  return request('/notifications/unread-count/');
}

/** @param {number} id */
export async function markNotificationRead(id) {
  return request(`/notifications/${id}/mark-read/`, { method: 'POST' });
}

export async function markAllNotificationsRead() {
  return request('/notifications/mark-all-read/', { method: 'POST' });
}

/** @param {string} [query] @param {number} [limit] */
export async function searchGlobal(query, limit = 8) {
  const qs = new URLSearchParams();
  if (query) qs.set('q', query);
  if (limit) qs.set('limit', String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/search/${suffix}`);
}

// --- Two-factor authentication (TOTP) -------------------------------------

/** Current 2FA status of the signed-in user. */
export async function fetchTwoFactorStatus() {
  return request('/v1/core/2fa/');
}

/** Generate a new TOTP secret; returns { secret, provisioning_uri }. */
export async function setupTwoFactor() {
  return request('/v1/core/2fa/?action=setup', { method: 'POST', body: JSON.stringify({}) });
}

/** Confirm a TOTP code and activate 2FA. @param {string} code */
export async function verifyTwoFactor(code) {
  return request('/v1/core/2fa/?action=verify', {
    method: 'POST',
    body: JSON.stringify({ code: String(code || '') }),
  });
}

/** Deactivate 2FA (requires a valid TOTP code). @param {string} code */
export async function disableTwoFactor(code) {
  return request('/v1/core/2fa/?action=disable', {
    method: 'POST',
    body: JSON.stringify({ code: String(code || '') }),
  });
}

// --- Active sessions ------------------------------------------------------

/** Active (non-revoked, non-expired) sessions of the signed-in user. */
export async function fetchSessions() {
  return request('/v1/core/sessions/');
}

/** Revoke a single session. @param {number|string} id */
export async function revokeSession(id) {
  if (!id && id !== 0) throw new Error('Session ID is required');
  return request(`/v1/core/sessions/${id}/`, { method: 'DELETE' });
}

/** Revoke every session of the user, including the current one. */
export async function revokeAllSessions() {
  return request('/v1/core/sessions/revoke-all/', { method: 'DELETE' });
}


// --- Sign in with Google (#107, #108) -------------------------------------

/** @param {unknown} err */
function errorCode(err) {
  const e = /** @type {ApiError} */ (err);
  return String((e && e.data && /** @type {any} */(e.data).code) || '');
}

/** The Google e-mail belongs to no account in any lab — an invitation is needed. */
/** @param {unknown} err */
export function isGoogleUnknownAccountError(err) {
  return errorCode(err) === 'google_account_unknown';
}

/** Google sign-in is not configured on this server (missing client ID). */
/** @param {unknown} err */
export function isGoogleUnconfiguredError(err) {
  return errorCode(err) === 'google_not_configured';
}

/**
 * Public Google sign-in config. Never throws: on any failure the button stays
 * hidden, so dev and CI do not depend on Google being reachable.
 */
export async function fetchGoogleAuthConfig() {
  try {
    const data = await request('/v1/core/auth/google/');
    return {
      configured: !!(data && data.configured && data.client_id),
      clientId: (data && data.client_id) || '',
    };
  } catch {
    return { configured: false, clientId: '' };
  }
}

/**
 * Exchange a Google ID token for the httpOnly JWT cookies.
 * @param {string} credential Google ID token from Google Identity Services
 * @param {string} [totpCode] required when the account has 2FA enabled
 */
export async function loginWithGoogle(credential, totpCode = '') {
  const payload = { credential };
  if (totpCode) payload.totp_code = totpCode;
  try {
    await request('/v1/core/auth/google/', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {},
    });
  } catch (error) {
    if (isTotpRequiredError(error)) error.requiresTotp = true;
    if (isTotpInvalidError(error)) error.invalidTotp = true;
    throw error;
  }
  return storeCurrentUser();
}

/** Link the signed-in account to a Google identity. @param {string} credential */
export async function linkGoogleAccount(credential) {
  return request('/v1/core/auth/google/link/', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

/** Unlink Google from the signed-in account (refused when no password is set). */
export async function unlinkGoogleAccount() {
  return request('/v1/core/auth/google/link/', { method: 'DELETE' });
}
