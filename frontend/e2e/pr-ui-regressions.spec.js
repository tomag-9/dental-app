// @ts-check
import { test, expect } from '@playwright/test';
import { loginAs, waitForWorkspace } from './helpers.js';

const tomorrowSk = () => {
  const date = new Date(Date.now() + 86400000);
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
};

test.describe('PR UI regressions', () => {
  test('new-job flow preserves scope and tooth colour and validates tooth numbers', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    const workspace = await waitForWorkspace(page);
    expect(workspace).toBeTruthy();

    const patient = workspace.patients[0];
    const clinic = workspace.clinics[0];
    const doctor = workspace.doctors.find((item) => item.raw?.clinic === clinic.id);
    const price = workspace.priceList[0];
    const note = `UI regression ${Date.now()}`;

    await page.getByRole('button', { name: 'Nová práca', exact: true }).click();
    const patientSearch = page.getByPlaceholder('Hľadať podľa priezviska, mena alebo rodného čísla…');
    await patientSearch.fill(patient.last);
    await page.getByText(`${patient.last} ${patient.first}`, { exact: true }).click();

    await page.getByText('Vybrať kliniku…', { exact: true }).click();
    await page.getByText(clinic.name, { exact: true }).last().click();
    if (doctor) {
      await page.getByText('Vybrať lekára…', { exact: true }).click();
      const doctorName = `${doctor.title ? `${doctor.title} ` : ''}${doctor.first} ${doctor.last}`.trim();
      await page.getByText(doctorName, { exact: true }).last().click();
    }
    await page.getByRole('button', { name: 'Ďalej', exact: true }).click();

    await page.getByText('Vybrať výkon z cenníka…', { exact: true }).click();
    const procedureSearch = page.getByPlaceholder('Vybrať výkon z cenníka…');
    await procedureSearch.fill(price.code);
    await page.getByText(price.name, { exact: true }).last().click();
    await page.getByRole('button', { name: 'Pridať', exact: true }).last().click();

    const toothInput = page.locator('input[inputmode="numeric"]').last();
    await toothInput.fill('2');
    await expect(page.getByRole('button', { name: 'Ďalej', exact: true })).toBeDisabled();
    await toothInput.fill('26');
    await expect(page.getByRole('button', { name: 'Ďalej', exact: true })).toBeEnabled();

    await page.getByText('—', { exact: true }).last().click();
    await page.getByText('Kvadrant 1', { exact: true }).last().click();
    await expect(toothInput).toBeDisabled();
    await page.getByRole('button', { name: 'Ďalej', exact: true }).click();

    await page.getByPlaceholder('D. M. RRRR').fill(tomorrowSk());
    await page.getByPlaceholder('Vyberte alebo napíšte…').fill('A2');
    await page.getByPlaceholder('Špecifické požiadavky, alergie pacienta, materiál…').fill(note);
    await page.getByRole('button', { name: 'Ďalej', exact: true }).click();
    await expect(page.locator('body')).toContainText('Kvadrant 1');
    await expect(page.locator('body')).toContainText('A2');
    const createResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST' && response.url().includes('/api/jobs/jobs/')
    ));
    await page.getByRole('button', { name: 'Vytvoriť prácu', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();

    await page.waitForFunction((description) => (
      window.__MOLARIS_WORKSPACE?.jobs?.some((job) => (job.raw?.description || job.type) === description)
    ), note, { timeout: 10_000 });
    const created = await page.evaluate((description) => (
      window.__MOLARIS_WORKSPACE.jobs.find((job) => (job.raw?.description || job.type) === description)
    ), note);
    expect(created.raw.tooth_color).toBe('A2');
    expect(created.raw.items[0].tooth_scope).toBe('Q1');
    expect(created.raw.items[0].tooth).toBeNull();
  });

  test('jobs export works and responsive sidebar expands again', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await page.getByRole('navigation').getByRole('button', { name: 'Práce', exact: true }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV export', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);

    const sidebar = page.getByRole('navigation').locator('..');
    await page.setViewportSize({ width: 900, height: 800 });
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(64);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(224);

    const completedTab = page.getByRole('button', { name: /^Dokončené \(\d+\)$/ });
    await completedTab.click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });
});
