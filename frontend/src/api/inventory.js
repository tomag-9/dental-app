/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request } from './core.js';
import { normalizeWarehouseItem } from './normalize.js';

/** @returns {Promise<Schemas['WarehouseItem'][]>} */
export async function fetchWarehouse() {
  return request('/warehouse/');
}

export { normalizeWarehouseItem };
