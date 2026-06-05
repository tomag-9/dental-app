// @ts-check
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

/**
 * Smoke tests: role-based access control in the UI.
 *
 *  · Non-admin (role=user) cannot reach admin-only pages — App.jsx
 *    `normalizePageForRole` redirects them to dashboard.
 *  · Admin sees the "Oprávnenia" sidebar item; user/technician do not.
 *  · Cross-lab isolation: the seeded dataset contains only one lab, so a
 *    full cross-lab UI test is not possible here.  Backend isolation is
 *    covered by test_role_matrix.py.  The UI test only verifies that the
 *    workspace returns jobs without leaking an unexpected lab id.
 *
 * Requires a running dev stack (docker compose up + seed data).
 * Seeded credentials: admin / admin  and  user / user
 */

test.describe('Admin role — full access', () => {
  test('sidebar shows Oprávnenia link for admin', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await expect(page.getByText('Oprávnenia')).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Permissions page', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await page.getByText('Oprávnenia').click();
    await page.waitForTimeout(600);
    // The Permissions page renders role definitions and module matrix
    await expect(page.locator('body')).toContainText('Administrátor', { timeout: 6000 });
    await expect(page.locator('body')).toContainText('Používateľ');
  });

  test('admin sees Faktúry (Invoices) in sidebar', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await expect(page.getByText('Faktúry')).toBeVisible({ timeout: 5000 });
  });

  test('admin sees Sklad (Inventory) in sidebar', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await expect(page.getByText('Sklad')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('User role — restricted access', () => {
  test('sidebar does not show Oprávnenia for user role', async ({ page }) => {
    await loginAs(page, 'user', 'user');
    await expect(page.getByText('Oprávnenia')).not.toBeVisible({ timeout: 4000 });
  });

  test('user navigating to permissions via event lands on dashboard, not Permissions page', async ({ page }) => {
    await loginAs(page, 'user', 'user');

    // Dispatch a visual-navigate event to "permissions" — the app normalises it
    // to "dashboard" via normalizePageForRole.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('molaris-visual-navigate', { detail: { page: 'permissions' } }));
    });
    await page.waitForTimeout(600);

    // Still authenticated
    await expect(page.locator('[title="Odhlásiť sa"]')).toBeVisible();
    // Not on the Permissions page — the role matrix should be absent
    await expect(page.getByText('Oprávnenia').first()).not.toBeVisible();
    // On the Dashboard — which always renders a time-of-day greeting:
    // "Dobré ráno" / "Dobrý deň" / "Dobrý večer" / "Dobrý noc"
    await expect(page.locator('body')).toContainText(/Dobr(ý|é)/, { timeout: 4000 });
  });

  test('user does not see Faktúry in sidebar', async ({ page }) => {
    await loginAs(page, 'user', 'user');
    await expect(page.getByText('Faktúry')).not.toBeVisible({ timeout: 4000 });
  });

  test('user does not see Sklad in sidebar', async ({ page }) => {
    await loginAs(page, 'user', 'user');
    await expect(page.getByText('Sklad')).not.toBeVisible({ timeout: 4000 });
  });

  test('user can view the Jobs list (shared access)', async ({ page }) => {
    await loginAs(page, 'user', 'user');
    await page.getByText('Práce').first().click();
    await page.waitForTimeout(800);
    await expect(page.locator('[title="Odhlásiť sa"]')).toBeVisible();
  });

  test('user can view the Patients list (shared access)', async ({ page }) => {
    await loginAs(page, 'user', 'user');
    await page.getByText('Pacienti').first().click();
    await page.waitForTimeout(800);
    await expect(page.locator('[title="Odhlásiť sa"]')).toBeVisible();
  });
});

test.describe('Cross-lab isolation in UI', () => {
  test('user workspace jobs all carry the expected lab id', async ({ page }) => {
    await loginAs(page, 'user', 'user');

    // Retrieve the lab id from the saved user record
    const userLab = await page.evaluate(() => {
      const u = JSON.parse(localStorage.getItem('molaris.user') || '{}');
      return u && u.lab ? u.lab.id : null;
    });
    expect(userLab).toBeTruthy();

    await page.getByText('Práce').first().click();
    await page.waitForTimeout(1200);

    // Every job in the workspace must carry the user's lab id (or no lab field
    // at all — the backend only returns same-lab data so the field may be absent
    // from the normalised object).
    // NOTE: the seeded dataset contains only one lab, so this test cannot
    // detect isolation bugs between two distinct labs.  Full cross-lab
    // isolation is verified server-side in test_role_matrix.py.
    const mismatch = await page.evaluate((expectedLabId) => {
      const ws = window.__MOLARIS_WORKSPACE;
      if (!ws || !ws.jobs) return 0;
      return ws.jobs.filter((j) => {
        const raw = j.raw || j;
        // Only flag jobs that explicitly carry a lab id that differs from ours
        return raw.lab && raw.lab !== expectedLabId;
      }).length;
    }, userLab);

    expect(mismatch).toBe(0);
  });
});
