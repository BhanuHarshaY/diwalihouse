import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a production build on :3100, backed by a
 * throwaway database (reset in global setup) so they never touch dev data.
 */
const PORT = 3100;
const REALTIME_PORT = 8788;
const OEMBED_PORT = 3199;
export const E2E_DATABASE_URL =
  process.env.DATABASE_URL_E2E ?? 'postgres://localhost:5432/diwali_house_e2e_test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Phones run the homepage suite and one tagged party flow; together the
    // projects stay under the 10-parties-per-hour creation limit.
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: [/@phone/, /homepage|reduced motion/] },
  ],
  webServer: [
    {
      command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        DATABASE_POOLED: 'false',
        APP_SECRET: 'e2e-only-secret-not-used-anywhere-else-000000',
        PUBLIC_APP_URL: `http://localhost:${PORT}`,
        REALTIME_URL: `ws://localhost:${REALTIME_PORT}`,
      },
    },
    {
      // The realtime Worker, under workerd. Its public key comes from
      // apps/realtime/.dev.vars (pnpm --filter @diwali/realtime-protocol keys).
      command: `pnpm --filter @diwali/realtime exec wrangler dev --port ${REALTIME_PORT} --var ALLOWED_ORIGINS:http://localhost:${PORT} --var OEMBED_BASE:http://localhost:${OEMBED_PORT}`,
      url: `http://localhost:${REALTIME_PORT}`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Stands in for YouTube's oEmbed lookups, so the Mehfil tests never call YouTube.
      command: `node e2e/oembed-stub.mjs`,
      url: `http://localhost:${OEMBED_PORT}/health`,
      env: { PORT: String(OEMBED_PORT) },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
