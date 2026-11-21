import { test, expect, onboard, answerKeepRecording } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const mockAi = (page: import('@playwright/test').Page) => {
  let n = 0;
  return page.route('**/api/ai/*', (r) => {
    const op = new URL(r.request().url()).pathname.split('/').pop();
    return r.fulfill({ json: { data: op === 'transcribe' ? { text: `Part ${++n} of the lecture.` }
      : { title: 'T', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] } } });
  });
};

const record = async (page: import('@playwright/test').Page, t: typeof en, seconds: number) => {
  await page.evaluate(() => localStorage.setItem('bw.test.pieces', JSON.stringify({ min: 1, target: 1.5, max: 2.4, checkpoint: 0.5 })));
  await page.goto('/lectures/new');
  await page.getByRole('button', { name: t.lectures.start }).click();
  await expect(page.getByText(t.lectures.recording, { exact: true })).toBeVisible();
  await page.waitForTimeout(seconds * 1000);
  await page.getByRole('button', { name: t.lectures.stop }).click();
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tk = t.lectures.keepRecording;

  test(`keep the recording: asked after stopping, then play from any time in the transcript (${lang})`, async ({ page }) => {
    await mockAi(page);
    await onboard(page, { hebrew: lang === 'he' });
    await record(page, t, 6);

    const dialog = page.getByRole('dialog', { name: tk.title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(tk.either)).toBeVisible();
    await expect(dialog.getByText(/MB/)).toBeVisible();
    // Escape doesn't skip the question.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await answerKeepRecording(page, tk, true);
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });

    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    const player = page.getByRole('region', { name: tk.player });
    await expect(player).toBeVisible();
    const audio = player.locator('audio');
    // The browser works out how long it is (about 6 s).
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.duration), { timeout: 10_000 }).toBeGreaterThan(4);
    expect(await audio.evaluate((a: HTMLAudioElement) => a.duration)).toBeLessThan(12);

    await expect(page.getByText(t.lectures.transcriptTools.tapToPlay)).toBeVisible();
    const times = page.getByRole('button', { name: new RegExp(t.lectures.transcriptTools.playFrom('').trim()) });
    expect(await times.count()).toBeGreaterThanOrEqual(2);
    const second = times.nth(1);
    const label = (await second.getAttribute('aria-label'))!;
    const [m, s] = label.match(/(\d+):(\d+)/)!.slice(1).map(Number);
    await second.click();
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThanOrEqual(m * 60 + s - 0.2);
    expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(false);

    // The player has its own controls too.
    await player.getByRole('button', { name: tk.pause }).click();
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    const before = await audio.evaluate((a: HTMLAudioElement) => a.currentTime);
    await player.getByRole('button', { name: tk.back(15) }).click();
    expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeLessThan(Math.max(0.01, before));
    await player.getByRole('button', { name: tk.speed(1) }).click();
    expect(await audio.evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(1.25);

    // Delete only the recording (from More); the transcript stays.
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('toolbar', { name: t.lectures.actions.toolbar }).getByRole('button', { name: t.lectures.actions.more }).click();
    await page.getByRole('menuitem', { name: tk.deleteRecording }).click();
    await expect(player).toHaveCount(0);
    await expect(page.getByText(t.lectures.transcriptTools.tapToPlay)).toHaveCount(0);
    await expect(page.getByText('Part 1 of the lecture.')).toBeVisible();
    await page.reload();
    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    await expect(page.getByRole('region', { name: tk.player })).toHaveCount(0);
  });
}

test('delete the recording: the lecture is saved without audio', async ({ page }) => {
  await mockAi(page);
  await onboard(page);
  await record(page, en, 3);
  await answerKeepRecording(page, en.lectures.keepRecording, false);
  await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
  await page.getByRole('radio', { name: en.lectures.tabsView.transcript }).click();
  await expect(page.getByText('Part 1 of the lecture.')).toBeVisible();
  await expect(page.getByRole('region', { name: en.lectures.keepRecording.player })).toHaveCount(0);
  const lecture = await page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectures') ?? '[]') as { audio_path?: string }[])[0]);
  expect(lecture.audio_path ?? null).toBeNull();
});
