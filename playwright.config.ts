import { defineConfig, devices } from '@playwright/test';

// E2E runs against the built app served by the local Express server in demo
// mode (no Supabase), with every AI call mocked inside the tests.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // A fake microphone (a steady tone) lets the lecture recorder run in tests.
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
    permissions: ['microphone'],
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && PORT=4173 ALLOW_DEMO_MODE=true VITE_SUPABASE_URL= npx tsx server/dev.ts',
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
