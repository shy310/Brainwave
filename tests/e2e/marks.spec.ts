import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'Derivatives', summary: 'Slopes and rates of change.', sections: [{ heading: 'Derivatives', points: ['A rate of change'] }], keyTerms: [], reminders: [], mode: 'detailed' };

test('tap "Important" while recording: the moment is saved, the AI is told, and the notes show it', async ({ page }) => {
  const sent: Record<string, string[]> = {};
  await page.route('**/api/ai/*', async (route) => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    (sent[op] ??= []).push(String(route.request().postDataJSON()?.input?.transcript ?? ''));
    if (op === 'transcribe') return route.fulfill({ json: { data: { text: 'The chain rule will be on the exam.' } } });
    if (op === 'lectureNotes') return route.fulfill({ json: { data: NOTES } });
    return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
  });
  await onboard(page);
  await page.goto('/lectures/new');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);

  const mark = page.getByRole('button', { name: new RegExp(`^${en.lectures.marks.mark}`) });
  await mark.click();
  await expect(page.getByRole('status').filter({ hasText: /Marked at 0:0\d/ })).toBeVisible();
  await expect(mark).toContainText('1');
  await page.keyboard.press('m'); // the same moment: still one mark
  await expect(mark).toContainText('1');

  await page.getByRole('button', { name: 'Stop and finish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete recording', exact: true }).click();
  await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });

  // The notes are written with the marked part flagged for the AI.
  await expect.poll(() => sent.lectureNotes?.[0] ?? '').toContain('⭐ The chain rule will be on the exam.');
  const card = page.getByRole('heading', { name: en.lectures.marks.title });
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: en.lectures.marks.showInTranscript }).click();
  await expect(page.getByRole('img', { name: en.lectures.marks.badge })).toBeVisible();

  // Saved with the lecture.
  const marks = await page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectures')!) as { marks?: number[] }[])[0].marks);
  expect(marks).toHaveLength(1);
});

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  test(`important moments show on the lecture and in the transcript (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((n) => localStorage.setItem('bw.lectures', JSON.stringify([{ id: 'm', title: 'Calculus', source: 'record', language: 'auto', status: 'ready', duration_sec: 400,
      segments: [{ start: 0, text: 'Intro.' }, { start: 60, text: 'Limits.' }, { start: 200, text: 'The chain rule is on the exam!' }, { start: 320, text: 'Homework.' }],
      marks: [230], slides_text: null, notes: n, quiz: null, flashcards: null, created_at: '2026-11-20T10:00:00.000Z', updated_at: '' }])), NOTES);
    await page.goto('/lectures/m');
    await expect(page.getByRole('heading', { name: t.lectures.marks.title })).toBeVisible();
    await expect(page.getByText('The chain rule is on the exam!')).toBeVisible();
    await expect(page.getByText('3:50')).toBeVisible();
    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    await expect(page.getByRole('img', { name: t.lectures.marks.badge })).toHaveCount(1);
  });
}
