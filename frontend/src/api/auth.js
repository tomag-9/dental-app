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
