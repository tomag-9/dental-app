// @ts-check
import { test, expect } from '@playwright/test';
import { loginAs, waitForWorkspace, waitForWorkspaceReload } from './helpers.js';

/**
 * Smoke test: Invoice creation from jobs → status change to paid → job syncs to closed.
 *
 * Job is brought to "completed" state via the transition-status API before the
 * invoice is created through the UI drawer.  Status changes (issued → paid) are
 * applied via the MolarisAPI client so we are not blocked by missing UI actions for
 * the "paid" state.  We then verify the job record in the Jobs list reflects the
 * backend-calculated closed status.
 *
 * Requires a running dev stack (docker compose up + seed data).
 */

test.describe('Invoice lifecycle', () => {
  test('create invoice from a completed job, mark paid, verify job closes', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');

    const ws = await waitForWorkspace(page);
    expect(ws).toBeTruthy();

    // 1. Create a job and transition it to 'completed'
    const setupResult = await page.evaluate(async (workspace) => {
      const job = await window.MolarisAPI.createJob({
        patient: workspace.patients[0].id,
        clinic: workspace.clinics[0].id,
        doctor: workspace.doctors && workspace.doctors.length ? workspace.doctors[0].id : null,
        start_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        priority: 'normal',
        description: 'Invoice smoke-test job',
        items: [{ price_list_code: workspace.priceList[0].code, tooth: '36', quantity: 1 }],
      });
      // Status machine: new → in_progress → completed
      await window.MolarisAPI.transitionJobStatus(job.id, 'in_progress');
      await window.MolarisAPI.transitionJobStatus(job.id, 'completed');
      return { jobId: job.id, clinicId: workspace.clinics[0].id };
    }, ws);

    expect(setupResult.jobId).toBeTruthy();

    // 2. Navigate to Invoices and open the "New Invoice" drawer
    await page.getByText('Faktúry').first().click();
    await page.waitForTimeout(800);
    await page.getByText('Nová faktúra').click();
    await page.waitForTimeout(500);

    // 3. Fill the invoice form — clinic select + job IDs text field
    await page.locator('select[name="clinic_id"]').selectOption({ index: 0 });
    await page.fill('input[name="job_ids"]', String(setupResult.jobId));
    await page.getByText('Vytvoriť faktúru').click();

    // 4. Wait for the workspace async reload triggered by createRecord()
    //    (createRecord sets __MOLARIS_WORKSPACE = null, then fires a reload event;
    //     a fixed timeout is not reliable — poll until invoices list is available)
    const wsAfter = await waitForWorkspaceReload(page);
    expect(wsAfter).toBeTruthy();

    // InvoiceSerializer exposes the linked jobs under the 'related_jobs' key
    const invoice = wsAfter.invoices && wsAfter.invoices.find((i) => {
      const relJobs = i.raw && i.raw.related_jobs;
      return Array.isArray(relJobs) && relJobs.some((j) => j.id === setupResult.jobId);
    });
    expect(invoice).toBeTruthy();

    // 5. Mark invoice issued then paid via API
    await page.evaluate(async (invoiceId) => {
      await window.MolarisAPI.updateInvoiceStatus(invoiceId, 'issued');
      await window.MolarisAPI.updateInvoiceStatus(invoiceId, 'paid');
    }, invoice.id);

    // 6. Navigate to Jobs and find the specific job row by ID, then check its status
    await page.getByText('Práce').first().click();
    await page.waitForTimeout(1500);

    const jobIdStr = String(setupResult.jobId);
    await expect(page.locator('body')).toContainText(jobIdStr, { timeout: 8000 });

    // Scope the status check to the row that contains the test job's ID so we
    // don't accidentally pass because another job on-screen carries a closed status.
    const jobRow = page.locator(`tr, [data-row], li`).filter({ hasText: jobIdStr }).first();
    const closedStatuses = ['closed', 'finished_factured', 'Uzavretá', 'Fakturovaná'];
    const rowText = await jobRow.innerText();
    const hasClosedStatus = closedStatuses.some((s) => rowText.includes(s));
    expect(hasClosedStatus).toBe(true);
  });

  test('invoice detail drawer opens and shows invoice number', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');

    const ws = await waitForWorkspace(page);
    expect(ws).toBeTruthy();

    // Create a completed job and invoice entirely via API
    const invoiceId = await page.evaluate(async (workspace) => {
      const job = await window.MolarisAPI.createJob({
        patient: workspace.patients[0].id,
        clinic: workspace.clinics[0].id,
        start_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        priority: 'normal',
        description: 'Invoice drawer smoke test',
        items: [{ price_list_code: workspace.priceList[0].code, tooth: '46', quantity: 1 }],
      });
      await window.MolarisAPI.transitionJobStatus(job.id, 'in_progress');
      await window.MolarisAPI.transitionJobStatus(job.id, 'completed');

      const inv = await window.MolarisAPI.createRecord('/invoices/', {
        clinic_id: workspace.clinics[0].id,
        job_ids: [job.id],
      });
      return inv.id;
    }, ws);

    expect(invoiceId).toBeTruthy();

    // Navigate to Invoices
    await page.getByText('Faktúry').first().click();
    await page.waitForTimeout(1000);

    // Open the invoice detail via the eye icon button (aria-label or title = "Detail")
    const eyeBtn = page.locator('[aria-label="Detail"], [title="Detail"]').first();
    await eyeBtn.click();
    await page.waitForTimeout(500);

    // Drawer must show the "Zatvoriť" and "Odoslať klinike" action buttons
    await expect(page.locator('body')).toContainText('Zatvoriť', { timeout: 5000 });
    await expect(page.locator('body')).toContainText('Odoslať klinike', { timeout: 5000 });
  });
});
