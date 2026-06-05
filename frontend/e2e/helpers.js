// @ts-check
import { expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

export async function loginAs(page, username, password) {
  await page.goto(BASE);
  await page.locator('input[type="text"]').first().fill(username);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[title="Odhlásiť sa"]', { timeout: 12000 });
}

/**
 * Poll until window.__MOLARIS_WORKSPACE is populated with the required
 * collections (patients, clinics, priceList) and return the workspace object.
 * Resolves null after ~8 seconds if data never arrives.
 */
export async function waitForWorkspace(page, extraKeys = []) {
  return page.evaluate(async (keys) => {
    const required = ['patients', 'clinics', 'priceList', ...keys];
    return new Promise((resolve) => {
      let tries = 0;
      const poll = setInterval(() => {
        const w = window.__MOLARIS_WORKSPACE;
        if (w && required.every((k) => w[k] && w[k].length)) {
          clearInterval(poll);
          resolve(w);
        }
        if (++tries > 40) { clearInterval(poll); resolve(null); }
      }, 200);
    });
  }, extraKeys);
}

/**
 * Wait until __MOLARIS_WORKSPACE is non-null (i.e. the async reload
 * triggered by a mutation has completed and data is available again).
 * Uses the same polling approach as waitForWorkspace.
 */
export async function waitForWorkspaceReload(page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      let tries = 0;
      const poll = setInterval(() => {
        const w = window.__MOLARIS_WORKSPACE;
        if (w && w.invoices !== undefined) {
          clearInterval(poll);
          resolve(w);
        }
        if (++tries > 50) { clearInterval(poll); resolve(null); }
      }, 200);
    });
  });
}

export { expect, BASE };
