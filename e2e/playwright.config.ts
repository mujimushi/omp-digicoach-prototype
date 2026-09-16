import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, TEST_SERVER_ENV } from './support/env.ts';

export default defineConfig({
  testDir: './tests',
  // Test files reset the shared database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['blob']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testDir: './support',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'phone-chromium',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },
    {
      name: 'phone-webkit',
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // Builds the app, resets the omp_e2e database and starts the server in test mode.
    command: 'npm run start:test',
    cwd: '..',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: TEST_SERVER_ENV,
  },
});
