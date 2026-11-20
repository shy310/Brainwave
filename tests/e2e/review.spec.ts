import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] };
const lecture = {
  id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: NOTES, quiz: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '',
  flashcards: { cards: [{ front: 'Card one?', back: 'One.' }, { front: 'Card two?', back: 'Two.' }, { front: 'Card three?', back: 'Three.' }] },
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tr = t.lectures.review;

  test(`spaced repetition: review due cards, missed ones come back, then they are spaced out (${lang})`, async ({ page, context }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures');
    await page.getByRole('link', { name: new RegExp(tr.due(3)) }).click();
    await expect(page.getByRole('heading', { level: 1, name: tr.title })).toBeVisible();

    const flip = () => page.getByRole('button', { pressed: false }).filter({ hasText: /Card/ }).click();
    const rateAs = (name: string) => page.getByRole('button', { name: new RegExp(`^${name} · `) }).click();

    await expect(page.getByText(tr.left(3))).toBeVisible();
    await expect(page.getByText(tr.isNew)).toBeVisible();
    await flip();
    await expect(page.getByRole('button', { name: `${tr.good} · ${tr.inDays(1)}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${tr.again} · ${tr.inMinutes(10)}` })).toBeVisible();
    await rateAs(tr.good);
    await flip(); await rateAs(tr.again);           // card two: missed, comes back at the end
    await flip(); await rateAs(tr.easy);
    await expect(page.getByText(tr.left(1))).toBeVisible();
    await expect(page.getByText('Card two?')).toBeVisible();
    await flip(); await rateAs(tr.good);
    await expect(page.getByText(tr.done)).toBeVisible();
    await expect(page.getByText(tr.doneBody(4))).toBeVisible();
    await expect(page.getByText(new RegExp(tr.next('').trim()))).toBeVisible();

    // Nothing is due until tomorrow.
    await page.goto('/lectures');
    await expect(page.getByRole('link', { name: new RegExp(tr.start) })).toHaveCount(0);

    // Two days later, the cards known once are due again; the "easy" one (3 days) is not.
    const later = await context.newPage();
    await later.clock.install({ time: Date.now() + 2 * 86_400_000 + 60_000 });
    await later.goto('/lectures');
    await expect(later.getByRole('link', { name: new RegExp(tr.due(2)) })).toBeVisible();
  });

  test(`practising a lecture's flashcards schedules them too (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/lec1');
    await page.getByRole('radio', { name: t.lectures.tabsView.cards }).click();
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { pressed: false }).filter({ hasText: /Card/ }).click();
      await page.getByRole('button', { name: t.lectures.knewIt }).click();
    }
    await page.goto('/lectures');
    await expect(page.getByRole('link', { name: new RegExp(tr.start) })).toHaveCount(0);
  });
}
