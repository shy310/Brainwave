import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

/** A WAV with a tone, made in the test. */
const wavFile = (seconds: number) => {
  const rate = 16000, n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2);
  return { name: 'week3.wav', mimeType: 'audio/wav', buffer: buf };
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test.describe(`upload preflight (${lang})`, () => {
    test('a file too long for this device gets a clear message and nothing is sent', async ({ page }) => {
      let calls = 0;
      await page.route('**/api/ai/*', (r) => { calls++; return r.fulfill({ json: { data: { text: 'x' } } }); });
      await onboard(page, { hebrew: lang === 'he' });
      // Pretend this device can only decode 1 minute, so a 2-minute file is "too long".
      await page.evaluate(() => localStorage.setItem('bw.test.uploadMaxMinutes', '1'));
      await page.goto('/lectures/new?tab=upload');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: t.lectures.chooseFile }).click();
      await (await chooser).setFiles(wavFile(130));
      await expect(page.getByRole('alert')).toHaveText(t.lectures.tooLongHere(2, 1));
      await expect(page.getByRole('button', { name: t.lectures.chooseFile })).toBeVisible(); // can pick another
      expect(calls).toBe(0);
    });

    test('shows length, cost and time, and lets the student pick another file', async ({ page }) => {
      await onboard(page, { hebrew: lang === 'he' });
      await page.goto('/lectures/new?tab=upload');
      let chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: t.lectures.chooseFile }).click();
      await (await chooser).setFiles(wavFile(130));
      await expect(page.getByText(t.lectures.preflight(2, 4))).toBeVisible();
      await expect(page.getByText(t.lectures.preflightCost(2, 1))).toBeVisible();
      chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: t.lectures.chooseAnother }).click();
      await (await chooser).setFiles(wavFile(20));
      await expect(page.getByText(t.lectures.preflight(1, 1))).toBeVisible();
      await expect(page.getByRole('button', { name: t.lectures.transcribeFile, exact: true })).toBeVisible();
    });
  });
}
