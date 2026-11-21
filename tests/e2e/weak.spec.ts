import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';
import { cardKey } from '../../shared/srs';

const q = (prompt: string, options: string[]) => ({ kind: 'choice', prompt, options, correctIndex: 0, answer: options[0], accepted: [], check: '', hint: '', explanation: 'Because.' });
const ANSWERS: Record<string, string> = { 'What is a derivative?': 'A rate of change', 'What is an integral?': 'An area', 'Capital of France?': 'Paris' };
const CARDS = [['Capital of France?', 'Paris'], ['Capital of Japan?', 'Tokyo'], ['Capital of Italy?', 'Rome'], ['Capital of Peru?', 'Lima']];
const lecture = { id: 'calc', title: 'Calculus', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: null,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '',
  quiz: { questions: [q('What is a derivative?', ['A rate of change', 'A number', 'A graph']), q('What is an integral?', ['An area', 'A slope', 'A limit'])] },
  flashcards: { cards: CARDS.map(([front, back]) => ({ front, back })) } };

/** Answer the question on screen; right or wrong. */
const answer = async (page: Page, t: typeof en, right: boolean) => {
  const text = await page.locator('main').innerText();
  const prompt = Object.keys(ANSWERS).find((p) => text.includes(p))!;
  const options = page.getByRole('radiogroup', { name: t.quiz.yourAnswer }).getByRole('radio');
  if (right) await options.filter({ hasText: ANSWERS[prompt] }).click();
  else await options.filter({ hasNotText: ANSWERS[prompt] }).last().click();
  await page.getByRole('button', { name: t.quiz.check }).click();
  await page.getByRole('button', { name: new RegExp(`^(${t.quiz.next}|${t.quiz.finish})`) }).click();
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tw = t.weak;

  test(`weak spots: missed questions and forgotten cards, practised until they stick (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    // One flashcard forgotten before (box 0, one lapse).
    const key = cardKey('calc', 'Capital of France?');
    await page.evaluate(([l, k]) => {
      localStorage.setItem('bw.lectures', JSON.stringify([l]));
      localStorage.setItem('bw.cardReviews', JSON.stringify({ [k as string]: { key: k, lectureId: 'calc', box: 0, due: 0, reviews: 2, lapses: 1, last: 0, first: 0 } }));
    }, [lecture, key] as const);

    // Miss one question in the lecture's quiz.
    await page.goto('/lectures/calc');
    await page.getByRole('radio', { name: t.lectures.tabsView.quiz }).click();
    const first = (await page.locator('main').innerText()).includes('What is a derivative?');
    await answer(page, t, !first); // wrong on the derivative question
    await answer(page, t, first);

    // Home and the page both show what to practise.
    await page.goto('/');
    await expect(page.getByRole('link', { name: new RegExp(tw.home) })).toContainText(tw.count(2));
    await page.getByRole('link', { name: new RegExp(tw.home) }).click();
    await expect(page.getByRole('heading', { level: 1, name: tw.title })).toBeVisible();
    await expect(page.getByText(tw.missed(1))).toBeVisible();
    await expect(page.getByText(tw.cards(1))).toBeVisible();

    // Two right rounds clear both.
    for (let round = 0; round < 2; round++) {
      await page.getByRole('button', { name: tw.start }).click();
      await answer(page, t, true);
      await answer(page, t, true);
      await expect(page.getByText('100%')).toBeVisible();
      await page.getByRole('button', { name: tw.again }).click();
    }
    await expect(page.getByText(tw.empty)).toBeVisible();
  });
}
