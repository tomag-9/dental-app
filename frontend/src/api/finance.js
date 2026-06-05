/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request, API_BASE, _refreshWorkspace } from './core.js';
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

/**
 * Download the invoice PDF via a raw fetch (blob response — cannot use request()).
 * @param {number} id
 * @param {string} [filename]
 */
export async function downloadInvoicePdf(id, filename) {
  const response = await fetch(`${API_BASE}/invoices/${id}/pdf/`, { credentials: 'include' });
  if (!response.ok) throw new Error('PDF download failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `invoice-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { normalizeInvoice, normalizePriceItem };
