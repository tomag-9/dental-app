/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */
import { request, _refreshWorkspace, downloadBlob } from './core.js';
import { normalizeInvoice, normalizePriceItem } from './normalize.js';

/** @returns {Promise<Schemas['Invoice'][]>} */
export async function fetchInvoices() {
  const payload = await request('/invoices/');
  return Array.isArray(payload) ? payload : (payload.results || []);
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

/** @param {number} id */
export async function fetchInvoiceDetail(id) {
  return request(`/invoices/${id}/`);
}

/** @param {number} id @param {string} [email] */
export async function sendInvoiceEmail(id, email) {
  const result = await request(`/invoices/${id}/send-email/`, {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  });
  _refreshWorkspace();
  return result;
}

/** @param {'csv'|'xlsx'} [format] */
export async function downloadInvoicesExport(format = 'csv') {
  const suffix = format === 'xlsx' ? '?export_format=xlsx' : '';
  return downloadBlob(`/invoices/export/${suffix}`, format === 'xlsx' ? 'faktury.xlsx' : 'faktury.csv');
}

// --- SaaS subscription / Stripe billing (#105, #106) -----------------------
// Not to be confused with `fetchPriceList` above (the lab's own price list for
// clinics) — this is the lab's own Molaris subscription.

/** Own lab subscription + billing block (read-only flag, grace end, seat usage). */
export async function fetchMySubscription() {
  return request('/v1/finance/subscriptions/my/');
}

/** @param {'pro'|'enterprise'} plan @returns {Promise<{url: string}>} */
export async function createSubscriptionCheckout(plan) {
  return request('/v1/finance/subscriptions/checkout/', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

/** @returns {Promise<{url: string}>} */
export async function createSubscriptionPortalSession() {
  return request('/v1/finance/subscriptions/portal/', { method: 'POST' });
}

export { normalizeInvoice, normalizePriceItem };
