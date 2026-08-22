/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request, _refreshWorkspace } from './core.js';
import { normalizePatient, normalizeClinic, normalizeDoctor } from './normalize.js';

/** @returns {Promise<Schemas['Patient'][]>} */
export async function fetchPatients() {
  return request('/crm/patients/');
}

/** @param {number | string} id */
export async function fetchPatientDetail(id) {
  return request(`/crm/patients/${id}/`);
}

/** @param {number | string} id */
export async function fetchPatientToothMap(id) {
  return request(`/crm/patients/${id}/cumulative_tooth_map/`);
}

let _insurersCache = null;

/**
 * Celoštátny číselník zdravotných poisťovní — read-only, cachovaný na reláciu.
 * @returns {Promise<Array<{ id: number, code: string, name: string, short_name: string }>>}
 */
export async function fetchInsurers() {
  if (_insurersCache) return _insurersCache;
  const data = await request('/crm/insurers/');
  _insurersCache = Array.isArray(data) ? data : (data.results || []);
  return _insurersCache;
}

/** @returns {Promise<Schemas['Clinic'][]>} */
export async function fetchClinics() {
  return request('/crm/clinics/');
}

/** @returns {Promise<Schemas['Doctor'][]>} */
export async function fetchDoctors() {
  return request('/crm/doctors/');
}

/**
 * @param {string} path
 * @param {Record<string, unknown>} payload
 */
export async function createRecord(path, payload) {
  const record = await request(path, { method: 'POST', body: JSON.stringify(payload) });
  _refreshWorkspace();
  return record;
}

export { normalizePatient, normalizeClinic, normalizeDoctor };
