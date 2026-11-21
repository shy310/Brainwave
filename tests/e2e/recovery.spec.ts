import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, onboard, answerKeepRecording } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

// Phase 1A: a lecture is never lost. Pieces are shortened to ~1.5 s (instead
// of ~60 s) so the tests run quickly; the logic is the same.
const PIECES = JSON.stringify({ min: 1, target: 1.5, max: 2, checkpoint: 0.5 });

type Mode = 'ok' | 'limit' | 'offline';

const NOTES = {
  title: 'Recovered lecture', summary: 'A summary.', sections: [{ heading: 'Part', points: ['A point.'] }], keyTerms: [], reminders: [],
};

/** Mock the AI. `mode` decides how transcription answers; the test can switch it. */
const mockAi = async (page: Page, state: { mode: Mode; transcribed: number }) => {
  await page.route('**/api/ai/*', async (route) => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    if (op === 'transcribe') {
      if (state.mode === 'limit') return route.fulfill({ status: 429, json: { error: 'You have reached your AI limit for now.' } });
      if (state.mode === 'offline') return route.abort('internetdisconnected');
      state.transcribed++;
      return route.fulfill({ json: { data: { text: `Piece ${state.transcribed} of the lecture.` } } });
    }
    if (op === 'lectureNotes') return route.fulfill({ json: { data: NOTES } });
    return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
  });
};

const setup = async (page: Page, hebrew: boolean) => {
  await onboard(page, { hebrew });
  await page.evaluate((v) => localStorage.setItem('bw.test.pieces', v), PIECES);
};

/** The saved lecture, read from demo storage. */
const savedLecture = (page: Page) => page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('bw.lectures') ?? '[]') as { status: string; segments: { start: number; text: string }[] }[];
  return all[0];
});

/** Segments start one piece apart: no gap longer than a piece (2 s max here). */
const expectNoGaps = (segments: { start: number }[], recordedSec: number) => {
  const starts = segments.map((s) => s.start);
  expect(starts[0]).toBe(0);
  for (let i = 1; i < starts.length; i++) {
    expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    expect(starts[i] - starts[i - 1]).toBeLessThanOrEqual(2.05);
  }
  expect(starts.at(-1)!).toBeGreaterThanOrEqual(recordedSec - 3);
};

const elapsedSeconds = async (page: Page) => {
  const text = (await page.locator('p.text-5xl').textContent()) ?? '0:00';
  const [m, s] = text.split(':').map(Number);
  return m * 60 + s;
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test.describe(`never lose a lecture (${lang})`, () => {
    test('kill the tab mid-recording, reopen, recover: full transcript, no gaps', async ({ page, context }) => {
      const state = { mode: 'ok' as Mode, transcribed: 0 };
      await mockAi(page, state);
      await setup(page, lang === 'he');
      await page.goto('/lectures/new');
      await page.getByRole('button', { name: t.lectures.start }).click();
      await expect(page.getByText(t.lectures.recording, { exact: true })).toBeVisible();
      await expect.poll(() => state.transcribed, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
      // Let some audio build up that is only in a checkpoint, then kill the tab.
      state.mode = 'offline';
      await page.waitForTimeout(3000);
      const recorded = await elapsedSeconds(page);
      await page.close();

      const again = await context.newPage();
      state.mode = 'ok';
      await mockAi(again, state);
      await again.goto('/');
      const banner = again.getByRole('region', { name: t.lectures.recoverTitle });
      await expect(banner).toBeVisible();
      await banner.getByRole('link', { name: t.lectures.recover }).click();
      // The copy saved before the tab was closed can still be kept.
      await answerKeepRecording(again, t.lectures.keepRecording, true);

      await expect(again).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
      const lecture = await savedLecture(again);
      expect(lecture.status).toBe('ready');
      expectNoGaps(lecture.segments, recorded);
      expect((lecture as { audio_path?: string }).audio_path).toMatch(/^local:/);
      // Nothing is left to recover.
      await again.goto('/');
      await expect(again.getByRole('region', { name: t.lectures.recoverTitle })).toHaveCount(0);
    });

    test('offline while recording: pieces wait, then catch up when back online', async ({ page, context }) => {
      const state = { mode: 'ok' as Mode, transcribed: 0 };
      await mockAi(page, state);
      await setup(page, lang === 'he');
      await page.goto('/lectures/new');
      await page.getByRole('button', { name: t.lectures.start }).click();
      await expect.poll(() => state.transcribed, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

      await goOffline(context, page, state);
      await expect(page.getByText(t.lectures.blocked.offline)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(3000); // recording continues
      await expect(page.getByText(t.lectures.recording, { exact: true })).toBeVisible();
      const waiting = state.transcribed;

      await goOnline(context, page, state);
      await expect(page.getByText(t.lectures.blocked.offline)).toBeHidden({ timeout: 15_000 });
      // The banner goes as soon as the retry starts; the waiting pieces arrive just after.
      await expect.poll(() => state.transcribed, { timeout: 10_000 }).toBeGreaterThan(waiting);
      const recorded = await elapsedSeconds(page);
      await page.getByRole('button', { name: t.lectures.stop }).click();
      await answerKeepRecording(page, t.lectures.keepRecording, false);
      await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
      expectNoGaps((await savedLecture(page)).segments, recorded);
    });

    test('AI limit reached: audio is kept, and transcribed once the limit resets', async ({ page }) => {
      const state = { mode: 'limit' as Mode, transcribed: 0 };
      await mockAi(page, state);
      await setup(page, lang === 'he');
      await page.goto('/lectures/new');
      await page.getByRole('button', { name: t.lectures.start }).click();
      await expect(page.getByText(t.lectures.blocked.limit)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(2000);
      const recorded = await elapsedSeconds(page);
      await page.getByRole('button', { name: t.lectures.stop }).click();
      await answerKeepRecording(page, t.lectures.keepRecording, false);

      // Still blocked: the student can leave and come back later.
      await expect(page.getByRole('button', { name: t.lectures.finishLater })).toBeVisible();
      await page.getByRole('button', { name: t.lectures.finishLater }).click();
      await expect(page).toHaveURL(/\/lectures/);
      expect(state.transcribed).toBe(0);

      // The limit resets; the recording is recovered and finished.
      state.mode = 'ok';
      await page.goto('/lectures');
      await page.getByRole('region', { name: t.lectures.recoverTitle }).getByRole('link', { name: t.lectures.recover }).click();
      await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
      const lecture = await savedLecture(page);
      expect(lecture.status).toBe('ready');
      expectNoGaps(lecture.segments, recorded);
    });

    test('Retry sends waiting pieces right away', async ({ page }) => {
      const state = { mode: 'limit' as Mode, transcribed: 0 };
      await mockAi(page, state);
      await setup(page, lang === 'he');
      await page.goto('/lectures/new');
      await page.getByRole('button', { name: t.lectures.start }).click();
      await expect(page.getByText(t.lectures.blocked.limit)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(t.lectures.pending(1))).toBeVisible();
      state.mode = 'ok';
      await page.getByRole('button', { name: t.lectures.retry }).click();
      await expect.poll(() => state.transcribed, { timeout: 10_000 }).toBeGreaterThan(0);
      await expect(page.getByText(t.lectures.blocked.limit)).toBeHidden();
    });
  });
}

/** Cut the connection: the browser reports offline and requests fail. */
const goOffline = async (context: BrowserContext, _page: Page, state: { mode: Mode }) => {
  state.mode = 'offline';
  await context.setOffline(true);
};
const goOnline = async (context: BrowserContext, _page: Page, state: { mode: Mode }) => {
  state.mode = 'ok';
  await context.setOffline(false);
};
