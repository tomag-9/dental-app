/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request, _refreshWorkspace, downloadBlob, fetchBlobUrl } from './core.js';
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

// ---------------------------------------------------------------------------
// Protetický štítok (#98 backend, #100 UI)
// ---------------------------------------------------------------------------

/**
 * JSON preview of the prosthetic label — same data the PDF is rendered from.
 * Rejects with `err.status === 400` and `err.data.missing_fields` when the job
 * is missing mandatory label data (see `apps/jobs/prosthetic_label.py`).
 * @param {number} id
 */
export async function fetchProstheticLabelPreview(id) {
  return request(`/jobs/jobs/${id}/prosthetic-label/?format=json`);
}

/**
 * Download the prosthetic label PDF for one job. Issues the label number on
 * first call; subsequent calls reuse the same number.
 * @param {number} id @param {string} [filename]
 */
export async function downloadProstheticLabelPdf(id, filename) {
  await downloadBlob(`/jobs/jobs/${id}/prosthetic-label/`, filename || `protetický_štítok_${id}.pdf`);
  _refreshWorkspace();
}

/**
 * Open the prosthetic label PDF as an object URL — for "Tlačiť", which should
 * not force a file download the way `downloadProstheticLabelPdf` does.
 * @param {number} id
 * @returns {Promise<string>} object URL; caller revokes it once the print
 * window/tab no longer needs it.
 */
export async function fetchProstheticLabelPdfUrl(id) {
  const url = await fetchBlobUrl(`/jobs/jobs/${id}/prosthetic-label/`);
  _refreshWorkspace();
  return url;
}

/**
 * Bulk export: one PDF, one job per page (100 jobs max, see MAX_BULK_LABELS).
 * @param {number[]} ids @param {string} [filename]
 */
export async function downloadProstheticLabelsBulk(ids, filename) {
  const suffix = encodeURIComponent(ids.join(','));
  await downloadBlob(`/jobs/jobs/prosthetic-labels/?ids=${suffix}`, filename || `protetické_štítky_${ids.length}.pdf`);
  _refreshWorkspace();
}

export { normalizeJob, normalizeTechnician, normalizeCalendarEvent };
