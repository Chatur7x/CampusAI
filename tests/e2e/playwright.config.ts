/**
 * Playwright configuration for the end-to-end suite.
 *
 * Playwright is deliberately NOT a dependency of this repo — adding it (and,
 * worse, downloading its browser binaries on every machine) needs explicit
 * approval. Until that approval lands, this file and the specs under
 * `specs/` are inert source: `npm test` never touches them, and CI skips the
 * whole e2e job unless the credentials below are present.
 *
 * To run them, see the header of tests/README.md. Short version:
 *
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test --config tests/e2e/playwright.config.ts
 *
 * Nothing here reaches a real system unless E2E=1 is set.
 */
import { defineConfig, devices } from '@playwright/test';

/**
 * Where the app under test is listening.
 *
 * Defaults to the Vite dev server so that `npm run dev` in another terminal is
 * enough. Point it at a deployed preview instead to run against staging.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Only start a server for ourselves when we were asked to run at all.
 *
 * `webServer` is omitted entirely unless E2E=1, because otherwise `playwright
 * test` would try to boot Vite on a machine that deliberately has no
 * dependencies installed — the "graceful degradation" requirement.
 */
const shouldRun = process.env.E2E === '1';

export default defineConfig({
  testDir: './specs',
  outputDir: './.artifacts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Failures are noisy and share traces; retries are deliberately off so a
  // flaky e2e run is reported as flaky rather than hidden.
  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The suite creates data (leave rows, attendance marks, avatars). Running
    // against staging is only safe when the operator says so explicitly.
    actionTimeout: 15_000,
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  ...(shouldRun
    ? {
        webServer: {
          command: 'npm run dev -- --port 5173 --strictPort',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});