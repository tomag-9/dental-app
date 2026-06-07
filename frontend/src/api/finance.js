/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request, _refreshWorkspace, downloadBlob } from './core.js';
import { normalizeInvoice, normalizePriceItem } from './normalize.js';

/** @returns {Promise<Schemas['Invoice'][]>} */
export async function fetchInvoices() {
  return request('/invoices/');
}

/** @returns {Promise<Schemas['PriceList'][]>} */
export async function fetchPriceList() {
  return request('/finance/price-list/');
}

/** @param {number} id @param {string} status */
export async function updateInvoiceStatus(id, status) {
  const invoice = await request(`/invoices/${id}/status/`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  _refreshWorkspace();
  return invoice;
}

/** @param {number} id */
export async function deleteInvoice(id) {
  await request(`/invoices/${id}/`, { method: 'DELETE' });
  _refreshWorkspace();
}

/**
 * Download the invoice PDF via a blob response.
 * @param {number} id
 * @param {string} [filename]
 */
export async function downloadInvoicePdf(id, filename) {
  return downloadBlob(`/invoices/${id}/pdf/`, filename || `invoice-${id}.pdf`);
}

/** @param {'csv'|'xlsx'} [format] */
export async function downloadInvoicesExport(format = 'csv') {
  const suffix = format === 'xlsx' ? '?export_format=xlsx' : '';
  return downloadBlob(`/invoices/export/${suffix}`, format === 'xlsx' ? 'faktury.xlsx' : 'faktury.csv');
}

export { normalizeInvoice, normalizePriceItem };
