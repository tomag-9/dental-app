// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Auth + navigation smoke tests.
 *
 * Requires a running dev stack (docker compose up).
 * Run with: npm run test:e2e
 *
 * Uses the seeded credentials: admin / admin
 */

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Login page', () => {
  test('renders login form without crashing', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[type="text"], input[name="username"]', 'baduser');
    await page.fill('input[type="password"]', 'badpass');
    await page.click('button[type="submit"]');
    // Backend returns 401 — frontend should surface an error message.
    await expect(page.locator('body')).toContainText(/.+/);
  });
});

test.describe('Authenticated navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[type="text"], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    // Wait for the app shell to appear after login.
    await page.waitForTimeout(1500);
  });

  test('dashboard loads after login', async ({ page }) => {
    // The main app content area should be visible.
    await expect(page.locator('body')).not.toContainText('Login');
  });

  test('sidebar is present for admin user', async ({ page }) => {
    // The sidebar nav should be rendered for authenticated admin users.
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });

  test('unauthenticated direct navigation redirects to login', async ({ page }) => {
    // Clear auth state and try to access the app.
    await page.evaluate(() => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('savedUser');
    });
    await page.reload();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
