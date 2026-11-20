import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { writeLectureAudio } from './tests/e2e/audio-fixture';

// The fake microphone plays a speech-like recording (words and pauses) instead of beeps.
const lectureWav = writeLectureAudio(path.resolve('test-results/.fixtures/lecture.wav'));

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
    // A fake microphone playing a speech-like test file lets the lecture recorder run in tests.
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${lectureWav}`],
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
