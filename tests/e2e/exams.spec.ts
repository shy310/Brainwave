import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const CARDS: Record<string, string> = { 'Capital of France?': 'Paris', 'Capital of Japan?': 'Tokyo', 'Capital of Italy?': 'Rome', 'Capital of Peru?': 'Lima', 'Capital of Kenya?': 'Nairobi' };
const lecture = (id: string, title: string, cards: Record<string, string>) => ({ id, title, source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: null,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '',
  flashcards: { cards: Object.entries(cards).map(([front, back]) => ({ front, back })) } });

/** Answer every practice question right. */
const answerAll = async (page: Page, t: typeof en) => {
  for (let i = 0; i < 20; i++) {
    const done = page.getByRole('heading', { name: t.quiz.resultTitle });
    if (await done.isVisible()) return;
    const shown = await page.locator('main').innerText();
    const asked = Object.keys(CARDS).find((p) => shown.includes(p))!;
    await page.getByRole('radio', { name: new RegExp(CARDS[asked]) }).click();
    await page.getByRole('button', { name: t.quiz.check }).click();
    await page.getByRole('button', { name: new RegExp(`^(${t.quiz.next}|${t.quiz.finish})`) }).click();
  }
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const te = t.exams;

  test(`exam mode: add an exam, follow the plan, take a practice exam, see readiness (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((ls) => localStorage.setItem('bw.lectures', JSON.stringify(ls)),
      [lecture('geo', 'Geography', CARDS), lecture('hist', 'History', { 'Year of the French Revolution?': '1789' })]);
    const inAWeek = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

    await page.goto('/lectures');
    await page.getByRole('region', { name: t.lectures.tools.title }).getByRole('link', { name: new RegExp(t.lectures.tools.exams) }).click();
    await expect(page.getByRole('heading', { level: 1, name: te.title })).toBeVisible();
    await expect(page.getByText(te.empty)).toBeVisible();

    // Add: name, date, and just the Geography lecture.
    await page.getByRole('button', { name: te.add }).click();
    const sheet = page.getByRole('dialog', { name: te.add });
    await sheet.getByLabel(te.name).fill('Geography test');
    await sheet.getByLabel(te.date).fill(inAWeek);
    await sheet.getByLabel(te.covers).selectOption({ label: te.pickLectures });
    await expect(sheet.getByText(te.pickOne)).toBeVisible();
    await sheet.getByRole('checkbox', { name: 'Geography' }).click();
    await sheet.getByRole('button', { name: te.save }).click();
    await expect(sheet).toBeHidden();
    const row = page.getByRole('link', { name: /Geography test/ });
    await expect(row).toContainText(te.inDays(7));
    await expect(row.getByRole('img', { name: te.ready(0) })).toBeVisible();

    // The plan: seven days, the lecture on day one, practice at the end.
    await row.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Geography test' })).toBeVisible();
    const plan = page.getByRole('region', { name: te.plan });
    await expect(plan.getByRole('listitem')).toHaveCount(7);
    await expect(plan.getByRole('listitem').first()).toContainText(te.today);
    await expect(plan.getByRole('listitem').first().getByRole('link', { name: te.learn('Geography') })).toHaveAttribute('href', '/lectures/geo');
    await expect(plan.getByRole('listitem').last().getByRole('button', { name: te.practice })).toBeVisible();
    await expect(plan.getByText(te.learn('History'))).toHaveCount(0);

    // A practice exam from the lecture's flashcards; a perfect score lifts readiness to 40%.
    await page.getByRole('button', { name: te.start }).click();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(te.practiceTitle) })).toBeVisible();
    await answerAll(page, t);
    await expect(page.getByText('100%')).toBeVisible();
    await page.getByRole('button', { name: te.back }).last().click();
    await expect(page.getByRole('img', { name: te.ready(40) })).toBeVisible();
    await expect(page.getByText(`${te.best(100)} · ${te.attempts(1)}`)).toBeVisible();

    // Home shows the coming exam.
    await page.goto('/');
    await expect(page.getByRole('link', { name: new RegExp(`Geography test · ${te.inDays(7)}`) })).toBeVisible();

    // Delete, with the app's confirm.
    await page.getByRole('link', { name: /Geography test/ }).click();
    await page.getByRole('button', { name: te.delete }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: t.common.delete }).click();
    await expect(page.getByText(te.empty)).toBeVisible();
  });
}
