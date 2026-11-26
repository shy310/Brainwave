import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';
import { cardKey } from '../../shared/srs';

const lecture = { id: 'c', title: 'Capitals', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, segments: [{ start: 0, text: 'x' }],
  slides_text: null, notes: null, quiz: null, flashcards: { cards: [{ front: 'Capital of France?', back: 'Paris' }, { front: 'Capital of Peru?', back: 'Lima' }] },
  created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };
const cards = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectures')!) as { flashcards: { cards: { front: string; back: string }[] } }[])[0].flashcards.cards);
const reviews = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('bw.cardReviews') ?? '{}') as Record<string, { box: number }>);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tc = t.lectures.cardEdit;

  test(`edit, delete and add flashcards, keeping progress (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    // France is already mastered.
    const key = cardKey('c', 'Capital of France?');
    await page.evaluate(([l, k]) => {
      localStorage.setItem('bw.lectures', JSON.stringify([l]));
      localStorage.setItem('bw.cardReviews', JSON.stringify({ [k as string]: { key: k, lectureId: 'c', box: 5, due: Date.now() + 9e8, reviews: 6, lapses: 0, last: Date.now(), first: Date.now() - 9e8 } }));
    }, [lecture, key] as const);
    await page.goto('/lectures/c');
    await page.getByRole('radio', { name: t.lectures.tabsView.cards }).click();
    await page.getByRole('radio', { name: tc.all(2) }).click();
    const list = page.getByRole('list').filter({ hasText: 'Capital of Peru?' });
    await expect(list.getByRole('img', { name: t.lectures.mastery.mastered })).toHaveCount(1);
    await expect(list.getByRole('img', { name: t.lectures.mastery.new })).toHaveCount(1);

    // Fix a card: its progress comes along.
    await list.getByRole('listitem').first().getByRole('button', { name: tc.edit }).click();
    await page.getByRole('textbox', { name: tc.front }).fill('What is the capital of France?');
    await page.getByRole('textbox', { name: tc.back }).fill('Paris, on the Seine');
    await page.getByRole('button', { name: tc.save }).click();
    await expect.poll(() => cards(page)).toEqual([{ front: 'What is the capital of France?', back: 'Paris, on the Seine' }, { front: 'Capital of Peru?', back: 'Lima' }]);
    await expect.poll(async () => (await reviews(page))[cardKey('c', 'What is the capital of France?')]?.box).toBe(5);
    await expect(list.getByRole('img', { name: t.lectures.mastery.mastered })).toHaveCount(1);

    // Add one: it goes first.
    await page.getByRole('button', { name: tc.add }).click();
    await expect(page.getByRole('button', { name: tc.save })).toBeDisabled();
    await page.getByRole('textbox', { name: tc.front }).fill('Capital of Japan?');
    await page.getByRole('textbox', { name: tc.back }).fill('Tokyo');
    await page.getByRole('button', { name: tc.save }).click();
    await expect.poll(async () => (await cards(page))[0]).toEqual({ front: 'Capital of Japan?', back: 'Tokyo' });
    await expect(page.getByRole('radio', { name: tc.all(3) })).toBeVisible();

    // Delete one, after confirming.
    await page.getByRole('listitem').filter({ hasText: 'Capital of Peru?' }).getByRole('button', { name: tc.delete }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: t.common.delete }).click();
    await expect.poll(async () => (await cards(page)).map((c) => c.front)).toEqual(['Capital of Japan?', 'What is the capital of France?']);

    // Studying uses the edited deck.
    await page.getByRole('radio', { name: tc.study }).click();
    await expect(page.getByText('Capital of Japan?')).toBeVisible();
  });
}

test('a lecture without cards: write your own', async ({ page }) => {
  await onboard(page);
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([{ ...l, flashcards: null }])), lecture);
  await page.goto('/lectures/c');
  await page.getByRole('radio', { name: en.lectures.tabsView.cards }).click();
  await page.getByRole('button', { name: en.lectures.cardEdit.own }).click();
  await page.getByRole('button', { name: en.lectures.cardEdit.add }).click();
  await page.getByRole('textbox', { name: en.lectures.cardEdit.front }).fill('Q?');
  await page.getByRole('textbox', { name: en.lectures.cardEdit.back }).fill('A');
  await page.getByRole('button', { name: en.lectures.cardEdit.save }).click();
  await expect.poll(() => cards(page)).toEqual([{ front: 'Q?', back: 'A' }]);
});
