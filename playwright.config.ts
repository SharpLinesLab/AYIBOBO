import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build served by the real server (service worker,
 * code-splitting and caching headers included). `npm run test:e2e` builds first.
 */
const PORT = Number(process.env.E2E_PORT ?? 4319);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node dist-server/index.js`,
    // Its own throwaway database, and room for many parallel browsers sharing one IP.
    env: { PORT: String(PORT), NODE_ENV: 'production', DATABASE_FILE: join(tmpdir(), `asf-e2e-${PORT}.db`), UPLOADS_DIR: join(tmpdir(), `asf-e2e-${PORT}-uploads`), DATA_FILE: join(tmpdir(), `asf-e2e-${PORT}.json`), RATE_LIMIT_MULTIPLIER: '50', SESSION_SECRET: 'e2e-only-session-secret-0123456789abcdef', PUBLIC_URL: `http://localhost:${PORT}` },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
