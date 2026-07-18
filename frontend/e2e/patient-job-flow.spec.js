// @ts-check
import { test, expect } from '@playwright/test';
import { loginAs, waitForWorkspace } from './helpers.js';

/**
 * Smoke test: Create patient → create job → assign technician.
 *
 * Patient is created through the UI drawer.
 * Job is created via the MolarisAPI JS client (the NewJob modal requires
 * a dental-chart interaction that is impractical to drive end-to-end).
 * Technician assignment is verified via job create + job detail screen.
 *
 * Requires a running dev stack (docker compose up + seed data).
 */

test.describe('Patient creation via UI', () => {
  test('admin can create a patient through the drawer', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');

    // Navigate to Patients via sidebar
    await page.getByText('Pacienti').first().click();
    await page.waitForTimeout(800);

    // Open the create-patient drawer
    await page.getByText('Pridať pacienta').click();
    await page.waitForTimeout(400);

    // Unique, syntactically valid rodné číslo (YYMMDD/XXXX) — using today's
    // date as prefix so the format passes backend validation, and a
    // timestamp-derived 4-digit serial so each run produces a distinct value.
    const suffix = Date.now();
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const birthNum = `${yy}${mm}${dd}/${String(suffix).slice(-4).padStart(4, '0')}`;

    await page.fill('input[name="first_name"]', `TestMeno${suffix}`);
    await page.fill('input[name="last_name"]', `TestPriezvisko${suffix}`);
    await page.fill('input[name="birth_number"]', birthNum);

    // Submit
    await page.getByText('Vytvoriť pacienta').click();

    // Drawer closes and the new patient row appears in the list
    await expect(page.locator('body')).toContainText(`TestMeno${suffix}`, { timeout: 8000 });
  });
});

test.describe('Job creation and technician assignment', () => {
  test('job created via API appears in the Jobs list', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');

    const ws = await waitForWorkspace(page);
    expect(ws).toBeTruthy();

    const jobId = await page.evaluate(async (workspace) => {
      const job = await window.MolarisAPI.createJob({
        patient: workspace.patients[0].id,
        clinic: workspace.clinics[0].id,
        doctor: workspace.doctors && workspace.doctors.length ? workspace.doctors[0].id : null,
        technician: workspace.technicians && workspace.technicians.length ? workspace.technicians[0].id : null,
        start_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        priority: 'normal',
        description: 'Playwright smoke-test job',
        items: [{ price_list_code: workspace.priceList[0].code, tooth: '26', quantity: 1 }],
      });
      return job.id;
    }, ws);

    expect(jobId).toBeTruthy();

    // Navigate to Jobs list and verify the new job appears
    await page.getByText('Práce').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toContainText(String(jobId), { timeout: 8000 });
  });

  test('technician assignment is reflected in job detail', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');

    const ws = await waitForWorkspace(page, ['technicians']);
    expect(ws).toBeTruthy();
    expect(ws.technicians.length).toBeGreaterThan(0);

    const result = await page.evaluate(async (workspace) => {
      const tech = workspace.technicians[0];
      const job = await window.MolarisAPI.createJob({
        patient: workspace.patients[0].id,
        clinic: workspace.clinics[0].id,
        doctor: workspace.doctors && workspace.doctors.length ? workspace.doctors[0].id : null,
        technician: tech.id,
        start_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        priority: 'normal',
        description: 'Playwright tech-assignment smoke test',
        items: [{ price_list_code: workspace.priceList[0].code, tooth: '11', quantity: 1 }],
      });
      return {
        jobId: job.id,
        techFirst: tech.first || tech.first_name || '',
        techLast: tech.last || tech.last_name || '',
      };
    }, ws);

    expect(result).toBeTruthy();
    expect(result.jobId).toBeTruthy();

    // Navigate to Jobs and open the job detail
    await page.getByText('Práce').first().click();
    await page.waitForTimeout(1000);
    const jobRow = page.locator('tr').filter({ hasText: `#${result.jobId}` });
    await expect(jobRow).toBeVisible({ timeout: 8000 });
    await jobRow.click();
    await page.waitForTimeout(800);

    // Job detail must show the assigned technician's name
    const techName = [result.techFirst, result.techLast].filter(Boolean).join(' ');
    await expect(page.locator('body')).toContainText(techName, { timeout: 6000 });
  });
});
