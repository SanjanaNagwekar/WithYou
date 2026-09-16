import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      WITHYOU_VOICE_PROVIDER: 'mock',
      WITHYOU_ALLOW_MOCK_PROVIDER: 'true',
      WITHYOU_TRANSLATION_PROVIDER: 'mock',
      WITHYOU_ALLOW_MOCK_TRANSLATION: 'true',
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: '{}',
      WITHYOU_PERSIST_PATH: '.wrangler/e2e-state',
      BETTER_AUTH_URL: baseURL,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
