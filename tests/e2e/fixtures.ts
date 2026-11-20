import { test as base, expect, type Page } from '@playwright/test';

/** Block third-party requests (fonts) so tests are fast and offline-safe. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await use(page);
  },
});
export { expect };

/** Fresh demo student who completes onboarding. */
export const onboard = async (page: Page, opts: { name?: string; hebrew?: boolean } = {}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/signin');
  await page.getByRole('button', { name: /Try BrainWave|נסו את BrainWave/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  if (opts.hebrew) await page.getByRole('radio', { name: /עברית/ }).click();
  await page.getByRole('textbox').fill(opts.name ?? 'Maya');
  await page.getByRole('button', { name: /Start learning|מתחילים ללמוד/ }).click();
  await expect(page).toHaveURL(/\/$/);
};

/** True when the page scrolls sideways (a layout bug on phones). */
export const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

/** A short WAV file with a tone, built in the test. */
export const wavFile = (seconds: number) => {
  const rate = 16000, n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2);
  return { name: 'week3.wav', mimeType: 'audio/wav', buffer: buf };
};
