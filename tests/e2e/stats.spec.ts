import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '',
  flashcards: { cards: [{ front: 'Card one?', back: 'One.' }] } };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tw = t.week;

  test(`streak, minutes and weekly totals on Home (${lang})`, async ({ page }) => {
    await page.clock.install();
    await onboard(page, { hebrew: lang === 'he' });
    // Studied the two previous days.
    await page.evaluate(() => {
      const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      localStorage.setItem('bw.studyDays', JSON.stringify([
        { day: day(2), minutes: 20, cards: 4, quizzes: 1, lectures: 0 },
        { day: day(1), minutes: 15, cards: 0, quizzes: 0, lectures: 1 },
      ]));
    });
    await page.reload();
    // The streak sits in the Today card; the week's chart and totals in "Your week".
    await expect(page.getByText(tw.streak(2))).toBeVisible();
    await expect(page.getByText(t.home.doneOf(1, 3))).toBeVisible(); // nothing due counts as reviewed
    await expect(page.getByRole('heading', { name: tw.title })).toBeVisible();
    await expect(page.getByRole('table', { name: tw.chart })).toHaveCount(1); // screen-reader table

    // Review a card today: the streak grows to 3 and the card is counted.
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/review');
    await page.getByRole('button', { pressed: false }).filter({ hasText: 'Card one?' }).click();
    await page.getByRole('button', { name: new RegExp(`^${t.lectures.review.good} · `) }).click();

    // Two minutes of activity are counted as study time.
    for (let i = 0; i < 26; i++) {
      await page.mouse.move(10 + i, 10);
      await page.mouse.down(); await page.mouse.up();
      await page.clock.runFor(5_000);
    }
    await page.goto('/');
    await expect(page.getByText(tw.streak(3))).toBeVisible();
    const cards = page.locator('dl > div').filter({ hasText: tw.totals.cards });
    await expect(cards.locator('dd')).toHaveText('5');
    const minutes = page.locator('dl > div').filter({ hasText: tw.totals.minutes }).first();
    await expect(minutes.locator('dd')).toHaveText('37');
  });
}

test('a new student sees a short nudge instead of an empty chart and four zeros', async ({ page }) => {
  await onboard(page);
  await expect(page.getByText(en.week.noStreak)).toBeVisible();
  await expect(page.getByText(en.home.dailyTitle)).toBeVisible();
  await expect(page.getByRole('table', { name: en.week.chart })).toHaveCount(0);
  await expect(page.locator('dl')).toHaveCount(0); // no totals yet
});
