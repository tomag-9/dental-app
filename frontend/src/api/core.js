/// <reference path="./globals.d.ts" />
const rawBase = window.__API_BASE_URL && !window.__API_BASE_URL.includes('%')
  ? window.__API_BASE_URL
  : 'http://localhost:8810/api';

export const API_BASE = rawBase.replace(/\/$/, '').endsWith('/api')
  ? rawBase.replace(/\/$/, '')
  : `${rawBase.replace(/\/$/, '')}/api`;

let _onUnauthorized = null;
/** @param {() => void} fn */
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

let _refreshInFlight = null;
async function _silentRefresh() {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = fetch(`${API_BASE}/token/refresh/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': getCsrfToken() },
  })
    .then((resp) => resp.ok)
    .catch(() => false)
    .finally(() => { _refreshInFlight = null; });
  return _refreshInFlight;
}

/** @param {string} path @param {RequestInit & { _retried?: boolean }} [options] */
export async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const csrfSafe = /^(GET|HEAD|OPTIONS|TRACE)$/.test(method);
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(!csrfSafe ? { 'X-CSRFToken': getCsrfToken() } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const data = await readJson(response);
  if (!response.ok) {
    if (response.status === 401 && !options._retried && !path.startsWith('/token/')) {
      const refreshed = await _silentRefresh();
      if (refreshed) {
        return request(path, { ...options, _retried: true });
      }
    }
    if (response.status === 401) {
      if (_onUnauthorized) _onUnauthorized();
      window.dispatchEvent(new CustomEvent('molaris-auth-expired'));
    }
    const error = /** @type {ApiError} */ (new Error(data && data.detail ? data.detail : 'API request failed'));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/** @param {string} path @param {string} filename */
export async function downloadBlob(path, filename) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const data = await readJson(response);
    const error = /** @type {ApiError} */ (new Error(data && data.detail ? data.detail : 'Download failed'));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _refreshWorkspace() {
  window.__MOLARIS_WORKSPACE = null;
  window.dispatchEvent(new CustomEvent('molaris-workspace-refresh'));
}

export { _refreshWorkspace };
