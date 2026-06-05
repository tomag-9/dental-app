// @ts-check
import { test, expect } from '@playwright/test';
import { loginAs, BASE } from './helpers.js';

/**
 * Auth smoke tests: login / logout / session expiry.
 *
 * Requires a running dev stack (docker compose up).
 * Run with: npm run test:e2e
 *
 * Seeded credentials: admin / admin  and  user / user
 */

test.describe('Login page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows Slovak error on wrong credentials', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[type="text"]', 'nobody');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('body')).toContainText('Neplatné prihlasovacie údaje', { timeout: 8000 });
  });

  test('empty username shows client-side validation', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[type="password"]', 'something');
    await page.click('button[type="submit"]');
    await expect(page.locator('body')).toContainText('Vyplňte všetky polia', { timeout: 4000 });
  });
});

test.describe('Successful login and app shell', () => {
  test('admin login lands on dashboard with sidebar', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
    await expect(page.locator('body')).toContainText('Práce');
  });

  test('logout button is visible after login', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await expect(page.locator('[title="Odhlásiť sa"]')).toBeVisible();
  });
});

test.describe('Logout', () => {
  test('clicking logout returns to login form', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await page.click('[title="Odhlásiť sa"]');
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Session expiry', () => {
  test('auth-expired event shows login form without page reload', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('molaris-auth-expired'));
    });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 6000 });
  });

  test('clearing saved user and reloading shows login form', async ({ page }) => {
    await loginAs(page, 'admin', 'admin');
    // Auth tokens are httpOnly cookies (not cleared from JS), but the app shell
    // gates rendering on the presence of 'molaris.user' in localStorage.
    // Clearing it simulates the user never being recognised.
    await page.evaluate(() => {
      localStorage.removeItem('molaris.user');
    });
    await page.reload();
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 });
  });

  test('navigating to app URL with no saved user shows login form', async ({ page }) => {
    // Fresh page with no login — the app must not render the shell.
    // (Cookies may still exist from a previous test; what matters is that the
    // React app reads 'molaris.user' to hydrate state, not the cookie directly.)
    await page.goto(BASE);
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 });
  });
});
