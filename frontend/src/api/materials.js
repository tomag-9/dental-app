/// <reference path="./globals.d.ts" />
import { downloadBlob, request } from './core.js';

const BASE = '/v1/materials';

function collection(data) {
  return Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
}

function resource(name) {
  return {
    list: async () => collection(await request(`${BASE}/${name}/`)),
    create: (payload) => request(`${BASE}/${name}/`, { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`${BASE}/${name}/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (id) => request(`${BASE}/${name}/${id}/`, { method: 'DELETE' }),
  };
}

export const manufacturers = resource('manufacturers');
export const catalog = resource('catalog');
export const lots = resource('lots');
export const recipes = resource('recipes');

export async function fetchUsage() {
  return collection(await request(`${BASE}/usage/`));
}

export async function createUsage(payload) {
  return request(`${BASE}/usage/`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function fetchFefo(recipeId, jobId) {
  const params = new URLSearchParams({ recipe: String(recipeId) });
  if (jobId) params.set('job', String(jobId));
  return request(`${BASE}/fefo/?${params}`);
}

export function downloadLotLabel(id, shortCode) {
  return downloadBlob(`${BASE}/lots/${id}/label-pdf/`, `stitok_${shortCode || id}.pdf`);
}

export function downloadLotConformity(id, shortCode) {
  return downloadBlob(`${BASE}/lots/${id}/conformity-pdf/`, `zhoda_${shortCode || id}.pdf`);
}

export function downloadUsageConformity(id) {
  return downloadBlob(`${BASE}/usage/${id}/conformity-pdf/`, `zhoda_pouzitie_${id}.pdf`);
}
