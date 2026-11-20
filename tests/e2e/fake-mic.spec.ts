import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

/** Samples (−1…1) of a base64 16-bit PCM WAV. */
const samples = (b64: string) => {
  const buf = Buffer.from(b64, 'base64');
  const out = new Float32Array((buf.length - 44) / 2);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return out;
};
const rms = (s: Float32Array) => Math.sqrt(s.reduce((a, v) => a + v * v, 0) / Math.max(1, s.length));

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`recording speech-like audio: every piece ends in a pause, not mid-word (${lang})`, async ({ page }) => {
    const pieces: string[] = [];
    await page.route('**/api/ai/*', (r) => {
      const op = new URL(r.request().url()).pathname.split('/').pop();
      if (op === 'transcribe') pieces.push((r.request().postDataJSON() as { input: { audio: string } }).input.audio);
      return r.fulfill({ json: { data: op === 'transcribe' ? { text: `Words ${pieces.length}.` }
        : { title: 'T', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    // Short pieces (1–2.4 s) so the test is quick; every such window contains a pause in the test file.
    await page.evaluate(() => localStorage.setItem('bw.test.pieces', JSON.stringify({ min: 1, target: 1.5, max: 2.4, checkpoint: 0.5 })));
    await page.goto('/lectures/new');
    await page.getByRole('button', { name: t.lectures.start }).click();
    await expect.poll(() => pieces.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
    await page.getByRole('button', { name: t.lectures.stop }).click();
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });

    const RATE = 16_000;
    // Every piece but the last (which ends when recording stops) was cut by the recorder.
    for (const b64 of pieces.slice(0, -1)) {
      const s = samples(b64);
      const seconds = s.length / RATE;
      expect(seconds).toBeGreaterThanOrEqual(0.95);
      expect(seconds).toBeLessThanOrEqual(2.45);
      expect(rms(s)).toBeGreaterThan(0.03); // it carries the "speech"
      expect(rms(s.subarray(s.length - Math.round(0.03 * RATE)))).toBeLessThan(0.01); // and ends in a pause
    }
  });
}
