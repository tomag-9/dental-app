// visual-smoke.mjs — MANUAL QA tool, deliberately not part of CI (#127).
//
// It needs a running backend + frontend stack and a real browser, and it makes
// no assertions: it only captures screenshots of the main screens in two
// viewports for a human to look at. Regressions that can be asserted belong in
// e2e/*.spec.js instead.
//
// Usage:
//   docker compose … up -d               # or npm run dev in another shell
//   npm run smoke:visual                 # writes doc/qa/visual-smoke/<today>/
// Env: VISUAL_SMOKE_URL, VISUAL_SMOKE_OUT, VITE_API_URL.

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
// The output directory used to be a hardcoded date, so every run overwrote the
// same historical folder. Default to today's run instead.
const outDir = process.env.VISUAL_SMOKE_OUT
  || path.join(rootDir, 'doc', 'qa', 'visual-smoke', new Date().toISOString().slice(0, 10));
const baseUrl = process.env.VISUAL_SMOKE_URL || 'http://127.0.0.1:5367';

const screens = [
  { name: 'dashboard', page: 'dashboard' },
  { name: 'jobs', page: 'jobs' },
  { name: 'patients', page: 'patients' },
  { name: 'finance', page: 'finance' },
  { name: 'inventory', page: 'inventory' },
  { name: 'settings', page: 'settings' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function startServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5367'], {
    cwd: path.join(rootDir, 'frontend'),
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, VITE_API_URL: process.env.VITE_API_URL || 'http://127.0.0.1:8000/api' },
  });
  child.unref();
  return child;
}

async function waitForServer(page) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });
      if (response && response.ok()) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function openScreen(page, screen) {
  await page.evaluate((targetPage) => {
    window.dispatchEvent(new CustomEvent('molaris-visual-navigate', { detail: { page: targetPage } }));
  }, screen.page);
  await page.waitForTimeout(500);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const server = startServer();
  const browser = await chromium.launch();
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await waitForServer(page);
      for (const screen of screens) {
        await openScreen(page, screen);
        await page.screenshot({
          path: path.join(outDir, `${screen.name}-${viewport.name}.png`),
          fullPage: true,
        });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
