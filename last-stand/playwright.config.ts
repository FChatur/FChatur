/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build (`npm run build` first; `npm run test:e2e` does both).
 * Browsers: E2E_BROWSERS=chromium (default) or a comma list, e.g. "chromium,firefox,webkit" in CI.
 */
const browsers = (process.env.E2E_BROWSERS ?? 'chromium').split(',').map((b) => b.trim());
const all = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: browsers.map((name) => ({ name, use: { ...all[name as keyof typeof all], viewport: { width: 1600, height: 900 } } })),
  webServer: {
    command: 'npx vite preview --port 4300 --strictPort',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env.CI,
  },
});
