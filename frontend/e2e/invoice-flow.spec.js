// @ts-check
import { test, expect } from '@playwright/test';
import { loginAs, waitForWorkspace } from './helpers.js';

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
      const description = `Invoice smoke-test job ${Date.now()}`;
      const job = await window.MolarisAPI.createJob({
        patient: workspace.patients[0].id,
        clinic: workspace.clinics[0].id,
        doctor: workspace.doctors && workspace.doctors.length ? workspace.doctors[0].id : null,
        start_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        priority: 'normal',
        description,
        items: [{ price_list_code: workspace.priceList[0].code, tooth: '36', quantity: 1 }],
      });
      // Status machine: new → in_progress → completed
      await window.MolarisAPI.transitionJobStatus(job.id, 'in_progress');
      await window.MolarisAPI.transitionJobStatus(job.id, 'completed');
      return { jobId: job.id, clinicId: workspace.clinics[0].id, description };
    }, ws);

    expect(setupResult.jobId).toBeTruthy();

    // 2. Navigate to Invoices and open the "New Invoice" drawer
    await page.getByText('Faktúry').first().click();
    await page.waitForTimeout(800);
    await page.getByText('Nová faktúra').click();
    await page.waitForTimeout(500);

    // 3. Select the clinic and verify that the matching completed job is
    //    selected in the current checklist-based invoice form.
    await page.locator('select[name="clinic_id"]').selectOption(String(setupResult.clinicId));
    const jobOption = page.locator('label').filter({ hasText: setupResult.description });
    await expect(jobOption).toBeVisible();
    const jobCheckbox = jobOption.locator('input[type="checkbox"]');
    if (!(await jobCheckbox.isChecked())) await jobCheckbox.check();
    await page.getByRole('button', { name: 'Vytvoriť faktúru', exact: true }).click();

    // 4. Wait for the workspace async reload triggered by createRecord()
    //    (createRecord sets __MOLARIS_WORKSPACE = null, then fires a reload event;
    //     a fixed timeout is not reliable — poll until invoices list is available)
    await page.waitForFunction((jobId) => (
      window.__MOLARIS_WORKSPACE?.invoices?.some((invoice) => (
        invoice.raw?.related_jobs?.some((job) => String(job.id) === String(jobId))
      ))
    ), setupResult.jobId, { timeout: 10_000 });
    const wsAfter = await page.evaluate(() => window.__MOLARIS_WORKSPACE);

    // InvoiceSerializer exposes the linked jobs under the 'related_jobs' key
    const invoice = wsAfter.invoices && wsAfter.invoices.find((i) => {
      const relJobs = i.raw && i.raw.related_jobs;
      return Array.isArray(relJobs) && relJobs.some((j) => String(j.id) === String(setupResult.jobId));
    });
    expect(invoice).toBeTruthy();

    // 5. Mark invoice issued then paid via API
    await page.evaluate(async (invoiceId) => {
      await window.MolarisAPI.updateInvoiceStatus(invoiceId, 'issued');
      await window.MolarisAPI.updateInvoiceStatus(invoiceId, 'paid');
    }, invoice.id);
    await page.evaluate(() => window.dispatchEvent(new Event('molaris-workspace-refresh')));
    await page.waitForFunction(({ jobId, statuses }) => {
      const job = window.__MOLARIS_WORKSPACE?.jobs?.find((item) => String(item.id) === String(jobId));
      return job && statuses.includes(job.raw?.status || job.status);
    }, {
      jobId: setupResult.jobId,
      statuses: ['closed', 'finished_factured'],
    }, { timeout: 10_000 });

    // 6. Navigate to Jobs and find the specific job row by ID, then check its status
    await page.getByText('Práce').first().click();
    await page.waitForTimeout(1500);

    const jobIdStr = String(setupResult.jobId);
    await expect(page.locator('body')).toContainText(jobIdStr, { timeout: 8000 });

    // Scope the status check to the row that contains the test job's ID so we
    // don't accidentally pass because another job on-screen carries a closed status.
    const jobRow = page.locator(`tr, [data-row], li`).filter({ hasText: jobIdStr }).first();
    const closedStatuses = ['closed', 'finished_factured', 'Uzavreté', 'Hotové / fakturované'];
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
        discount_percent: 10,
      });
      return inv.id;
    }, ws);

    expect(invoiceId).toBeTruthy();

    // Direct API mutations do not automatically refresh the React workspace.
    await page.evaluate(() => window.dispatchEvent(new Event('molaris-workspace-refresh')));
    await page.waitForFunction((id) => (
      window.__MOLARIS_WORKSPACE?.invoices?.some((invoice) => String(invoice.id) === String(id))
    ), invoiceId, { timeout: 10_000 });
    const createdInvoice = await page.evaluate((id) => (
      window.__MOLARIS_WORKSPACE.invoices.find((invoice) => String(invoice.id) === String(id))
    ), invoiceId);
    expect(createdInvoice).toBeTruthy();

    // Navigate to Invoices
    await page.getByText('Faktúry').first().click();
    await page.waitForTimeout(1000);

    // Open the exact invoice created by this test, not an older seeded row.
    await page.locator('tr').filter({ hasText: createdInvoice.number }).click();
    await page.waitForTimeout(500);

    // The backend issues a newly-created invoice immediately, so its next
    // primary action is marking it as paid.
    await expect(page.locator('body')).toContainText('Zatvoriť', { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Zaplatená', exact: true })).toBeVisible({ timeout: 5000 });

    // Preview uses the exact backend-calculated discounted total.
    await page.getByRole('button', { name: 'Náhľad PDF', exact: true }).click();
    const formattedTotal = new Intl.NumberFormat('sk-SK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(createdInvoice.raw.total_amount));
    await expect(page.locator('.molaris-print-content')).toContainText(`${formattedTotal} €`, { timeout: 5000 });
    await page.getByRole('button', { name: '✕ Zatvoriť', exact: true }).click();

    // The confirmation names the exact clinic recipient and sends to the
    // dedicated action endpoint.
    const recipient = createdInvoice.raw.clinic_email;
    expect(recipient).toBeTruthy();
    let sendPayload = null;
    await page.route(`**/api/invoices/${invoiceId}/send-email/`, async (route) => {
      sendPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent_to: recipient, invoice: createdInvoice.number }),
      });
    });
    await page.getByRole('button', { name: 'Poslať klinike', exact: true }).click();
    await expect(page.locator('body')).toContainText(recipient);
    await page.getByRole('button', { name: 'Poslať e-mail', exact: true }).click();
    await expect.poll(() => sendPayload).not.toBeNull();
    expect(sendPayload).toEqual({});
  });
});
