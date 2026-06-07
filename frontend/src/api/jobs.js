/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request, _refreshWorkspace, downloadBlob } from './core.js';
import { normalizeJob, normalizeTechnician, normalizeCalendarEvent } from './normalize.js';

/** @typedef {{ search?: string; status?: string; priority?: string }} JobFilters */

/** @param {JobFilters} [filters] */
export async function fetchJobs(filters = {}) {
  const qs = new URLSearchParams();
  if (filters.search) qs.set('search', filters.search);
  if (filters.status && filters.status !== 'all') qs.set('status', filters.status);
  if (filters.priority) qs.set('priority', filters.priority);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  /** @type {Schemas['Job'][]} */
  const jobs = await request(`/jobs/jobs/${suffix}`);
  return jobs.map(normalizeJob);
}

/** @param {Record<string, unknown>} payload */
export async function createJob(payload) {
  const job = await request('/jobs/jobs/', { method: 'POST', body: JSON.stringify(payload) });
  _refreshWorkspace();
  return job;
}

/** @param {number} id @param {Record<string, unknown>} payload */
export async function updateJob(id, payload) {
  const job = await request(`/jobs/jobs/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  _refreshWorkspace();
  return job;
}

/** @param {number} id */
export async function deleteJob(id) {
  await request(`/jobs/jobs/${id}/`, { method: 'DELETE' });
  _refreshWorkspace();
}

/** @param {number} id @param {string} status @param {string} [note] */
export async function transitionJobStatus(id, status, note) {
  const job = await request(`/jobs/jobs/${id}/transition-status/`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
  _refreshWorkspace();
  return job;
}

/** @returns {Promise<Schemas['Technician'][]>} */
export async function fetchTechnicians() {
  return request('/jobs/technicians/');
}

/** @param {'csv'|'xlsx'} [format] */
export async function downloadJobsExport(format = 'csv') {
  const suffix = format === 'xlsx' ? '?export_format=xlsx' : '';
  return downloadBlob(`/jobs/jobs/export/${suffix}`, format === 'xlsx' ? 'prace.xlsx' : 'prace.csv');
}

export { normalizeJob, normalizeTechnician, normalizeCalendarEvent };
