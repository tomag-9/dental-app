import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The invoice and job flows chain a dozen sequential API round trips through
  // the Vite dev server and legitimately need 30-40 s even on an idle machine,
  // so 30 s was not a real budget — it just made those specs fail. CI retries
  // once, which covers the shared runner being busy.
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5367',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Do not start a dev server automatically — run the stack via docker compose first.
  webServer: undefined,
});
