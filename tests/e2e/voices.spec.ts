import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';

/** 0.3 s of a quiet tone as WAV — stands in for Azure's MP3 in tests. */
const tone = () => {
  const rate = 16000, n = rate * 0.3, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(2000 * Math.sin((2 * Math.PI * 300 * i) / rate)), 44 + i * 2);
  return buf;
};

const line = (speaker: number, text: string, chapter = '') => ({ speaker, text, chapter });
const PODCAST = {
  title: 'Black holes',
  hosts: [{ name: 'Noa', role: 'host' }, { name: 'Daniel', role: 'expert' }],
  lines: [line(0, 'What is a black hole?', 'Basics'), line(1, 'Gravity so strong light cannot escape.'), line(0, 'Wow.'),
    line(1, 'Yes.'), line(0, 'How do they form?'), line(1, 'Big stars collapse.'), line(0, 'Thanks!'), line(1, 'Bye.')],
};

const mockNaturalVoices = async (page: Page) => {
  const voices: string[] = [];
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, ai: true, tts: true, auth: false, demo: true } }));
  await page.route('**/api/tts', (r) => {
    voices.push((r.request().postDataJSON() as { voice: string }).voice);
    return r.fulfill({ body: tone(), headers: { 'Content-Type': 'audio/wav' } });
  });
  await page.route('**/api/ai/podcastScript', (r) => r.fulfill({ json: { data: PODCAST } }));
  return voices;
};

test('podcasts use two natural voices and can be downloaded as MP3', async ({ page }) => {
  const voices = await mockNaturalVoices(page);
  await onboard(page, { hebrew: true });
  await page.goto('/podcasts');
  await page.locator('#media-prompt').fill('חורים שחורים');
  await page.getByRole('button', { name: 'יצירת הפרק' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Black holes' })).toBeVisible();

  // Play: natural Hebrew voices for both hosts, and the line moves on as audio ends.
  await page.getByRole('button', { name: 'הפעלה', exact: true }).click();
  await expect(page.getByRole('slider')).not.toHaveValue('0', { timeout: 10_000 });
  expect(voices).toContain('he-IL-HilaNeural');
  expect(voices).toContain('he-IL-AvriNeural');
  await page.getByRole('button', { name: 'השהיה' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת MP3' }).click();
  expect((await download).suggestedFilename()).toBe('Black holes.mp3');
});

test('without natural voices the device voice is used and nothing is requested', async ({ page }) => {
  let ttsCalls = 0;
  await page.route('**/api/tts', (r) => { ttsCalls++; return r.fulfill({ status: 503, json: { error: 'off' } }); });
  await page.route('**/api/ai/podcastScript', (r) => r.fulfill({ json: { data: PODCAST } }));
  await onboard(page);
  await page.goto('/podcasts');
  await page.locator('#media-prompt').fill('black holes');
  await page.getByRole('button', { name: 'Make the episode' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(ttsCalls).toBe(0);
  await expect(page.getByRole('button', { name: 'Download MP3' })).toHaveCount(0);
});

test('if a natural voice fails, the device voice says the line instead of going silent', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { spoken: string[] }).spoken = spoken;
    const voice = { name: 'Test voice', lang: 'en-US', localService: true, default: true, voiceURI: 'test' };
    window.SpeechSynthesisUtterance = class { onend: (() => void) | null = null; onerror = null; voice = null; lang = ''; rate = 1; pitch = 1; constructor(public text: string) {} } as unknown as typeof SpeechSynthesisUtterance;
    speechSynthesis.getVoices = () => [voice as unknown as SpeechSynthesisVoice];
    speechSynthesis.speak = (u) => { spoken.push(u.text); setTimeout(() => u.onend?.call(u, new Event('end') as SpeechSynthesisEvent), 50); };
    speechSynthesis.cancel = () => {};
  });
  let ttsCalls = 0;
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, ai: true, tts: true, auth: false, demo: true } }));
  await page.route('**/api/tts', (r) => { ttsCalls++; return r.fulfill({ status: 502, json: { error: 'The voice service had a problem.' } }); });
  await page.route('**/api/ai/podcastScript', (r) => r.fulfill({ json: { data: PODCAST } }));
  await onboard(page);
  await page.goto('/podcasts');
  await page.locator('#media-prompt').fill('black holes');
  await page.getByRole('button', { name: 'Make the episode' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(['What is a black hole?', 'Gravity so strong light cannot escape.']));
  expect(ttsCalls).toBeGreaterThan(0);
});

test('the podcast and video language can differ from the app language, and the choice is kept', async ({ page }) => {
  const voices = await mockNaturalVoices(page);
  const locales: string[] = [];
  await page.route('**/api/ai/videoScript', (r) => {
    locales.push((r.request().postDataJSON() as { locale: string }).locale);
    return r.fulfill({ json: { data: { title: 'נגזרות', scenes: Array.from({ length: 3 }, (_, i) => ({
      kind: 'title', heading: `סצנה ${i + 1}`, items: [], latex: '', fn: '', xMin: 0, xMax: 1, narration: 'נגזרת היא קצב שינוי.',
    })) } } });
  });
  page.on('request', (r) => { if (r.url().endsWith('/api/ai/podcastScript')) locales.push((r.postDataJSON() as { locale: string }).locale); });
  await onboard(page); // the app is in English

  await page.goto('/podcasts');
  await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
  await page.getByRole('radio', { name: 'עברית' }).click();
  await page.locator('#media-prompt').fill('black holes');
  await page.getByRole('button', { name: 'Make the episode' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Black holes' })).toBeVisible();
  expect(locales).toEqual(['he']);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => voices).toContain('he-IL-HilaNeural');
  expect(voices.every((v) => v.startsWith('he-IL'))).toBe(true);
  await page.getByRole('button', { name: 'Pause' }).click();

  // The choice is remembered, for videos too, and the app itself stays in English.
  await page.goto('/videos');
  await expect(page.getByRole('radio', { name: 'עברית' })).toBeChecked();
  await page.locator('#media-prompt').fill('derivatives');
  await page.getByRole('button', { name: 'Make the video' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'נגזרות' })).toBeVisible();
  expect(locales).toEqual(['he', 'he']);
  await expect(page.getByRole('link', { name: 'Podcasts' }).first()).toBeVisible();

  await page.goto('/videos');
  await page.getByRole('radio', { name: 'English' }).click();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
});
