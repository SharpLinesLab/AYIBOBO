import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, SERVER_ENV } from './tests/e2e/data';

/**
 * End-to-end tests run against the production build served by the real server (service worker,
 * code-splitting and caching headers included). `npm run test:e2e` builds first. The `setup`
 * project publishes the songs the tests play (tests/e2e/publish.setup.ts) before the others run.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'setup', testMatch: /\.setup\.ts$/ },
    { name: 'desktop', dependencies: ['setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', dependencies: ['setup'], use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node dist-server/index.js`,
    env: SERVER_ENV,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
