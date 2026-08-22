/// <reference path="./globals.d.ts" />
// superadmin.js — platform-level (cross-tenant) reads for the Superadmin screens.
//
// Every endpoint here is superadmin-only on the backend and raises 403 for
// anybody else, so the callers render a permission state rather than data.
import { request } from './core.js';

/** DRF list endpoints answer either a bare array or {results: []}. */
function listRows(payload) {
  if (Array.isArray(payload)) return payload;
  return (payload && payload.results) || [];
}

/**
 * Platform aggregates: lab/user counts, subscription mix, MRR/ARR, churn and
 * the 10 most recent audit-log entries.
 * @returns {Promise<any>}
 */
export async function fetchSuperadminMetrics() {
  return request('/v1/core/superadmin-metrics/');
}

/** All labs (tenants); superadmin bypasses the tenant filter. */
export async function fetchAllLabs() {
  return listRows(await request('/v1/core/labs/'));
}

/** All users across every tenant. */
export async function fetchAllUsers() {
  return listRows(await request('/v1/core/users/'));
}

/** Platform subscriptions — what labs pay us. */
export async function fetchSubscriptions() {
  return listRows(await request('/v1/finance/subscriptions/'));
}

/** Service health checks, runtime info and platform counters. */
export async function fetchSystemHealth() {
  return request('/v1/core/system-health/');
}

/**
 * Paginated audit log. Passing `page` forces DRF pagination on
 * (OptionalPageNumberPagination only paginates when asked).
 * @param {{ page?: number, pageSize?: number }} [options]
 * @returns {Promise<{ results: any[], count: number, next: string|null, previous: string|null }>}
 */
export async function fetchAuditLogs(options = {}) {
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const payload = await request(`/v1/core/audit-logs/?page=${page}&page_size=${pageSize}`);
  if (Array.isArray(payload)) {
    return { results: payload, count: payload.length, next: null, previous: null };
  }
  return {
    results: (payload && payload.results) || [],
    count: (payload && payload.count) || 0,
    next: (payload && payload.next) || null,
    previous: (payload && payload.previous) || null,
  };
}
