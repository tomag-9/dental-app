// @ts-check
import { test, expect } from '@playwright/test';

const manufacturers = [{ id: 1, name: 'Ivoclar Vivadent', prefix: 'IVO', country: 'Lichtenštajnsko', note: 'Keramika, lisovacie systémy' }];
const catalog = [{ id: 1, code: 'IVO-0421', name: 'IPS e.max CAD blok C14', manufacturer: 1, manufacturer_name: 'Ivoclar Vivadent', category: 'keramika', unit: 'ks', mdr_class: 'IIa', mode: 'single', allow_in_job: true, stock_code: 'KER-001', note: '' }];
const lot = { id: 101, catalog: 1, catalog_details: catalog[0], short_code: 'Š-2401', lot: 'LX2405', received: '2026-01-12', expiry: '2027-03-01', opened: null, qty_received: '5.000', qty_remaining: '5.000', status: 'active', location: 'Sklad A · Regál 1', expiry_state: 'ok' };
const recipes = [{ id: 1, name: 'Celokeramická korunka e.max', product_type: 'single', mdr: true, lines: [{ id: 1, catalog: 1, catalog_details: catalog[0], qty: '1.000', note: 'CAD blok' }] }];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('molaris.user', JSON.stringify({ id: 1, name: 'Ján Novák', role: 'admin', initials: 'JN' })));
  await page.route('http://localhost:8810/api/**', async route => {
    const url = route.request().url();
    if (url.includes('/v1/materials/manufacturers/')) return route.fulfill({ json: manufacturers });
    if (url.includes('/v1/materials/catalog/')) return route.fulfill({ json: catalog });
    if (url.includes('/v1/materials/lots/')) return route.fulfill({ json: [lot] });
    if (url.includes('/v1/materials/recipes/')) return route.fulfill({ json: recipes });
    if (url.includes('/v1/materials/usage/')) return route.fulfill({ json: [] });
    if (url.includes('/jobs/jobs/')) return route.fulfill({ json: [{ id: 12, patient: 'M. Kováčová', status: 'in_progress' }] });
    return route.fulfill({ json: [] });
  });
});

test('materials matches the designed tabs, cards and MDR interactions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Materiály' }).click();
  await expect(page.getByRole('heading', { name: 'Materiály', exact: true })).toBeVisible();
  await expect(page.getByText('Dohľadateľnosť materiálov a šarží (LOT) podľa MDR')).toBeVisible();
  await expect(page.getByText('Aktívne šarže')).toBeVisible();
  await expect(page.getByText('LOT LX2405')).toBeVisible();
  await expect(page.getByText('MDR IIa').first()).toBeVisible();

  await page.getByText('LOT LX2405').click();
  await expect(page.getByRole('dialog')).toContainText('Zostatok šarže');
  await expect(page.getByRole('dialog')).toContainText('Prehlásenie o zhode');
  await page.getByTitle('Zatvoriť').click();

  await page.getByRole('button', { name: 'Štítok' }).click();
  await expect(page.getByRole('dialog')).toContainText('MDR identifikácia');
  await expect(page.getByRole('dialog')).toContainText('LX2405');
  await page.getByRole('button', { name: 'Zavrieť' }).click();

  for (const tab of ['Katalóg', 'Výrobcovia', 'Recepty', 'Použitie & MDR']) {
    await page.getByRole('button', { name: tab }).click();
    await expect(page.getByRole('button', { name: tab })).toBeVisible();
  }
  await expect(page.getByText('Audit log použitia')).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
});

test('receive lot and FEFO drawers preserve the prototype layout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Materiály' }).click();
  await page.getByRole('button', { name: 'Príjem šarže' }).click();
  await expect(page.getByRole('dialog')).toContainText('Nová skladová šarža s dohľadateľnosťou');
  await expect(page.getByRole('dialog').locator('input').nth(0)).toBeVisible();
  await page.getByTitle('Zatvoriť').click();
  await page.getByRole('button', { name: 'Priradiť na zákazku' }).click();
  await expect(page.getByRole('dialog')).toContainText('FEFO výber šarží');
  await expect(page.getByRole('dialog').locator('select')).toHaveCount(2);
});
