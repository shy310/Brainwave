import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const CARDS: Record<string, string> = { 'Capital of France?': 'Paris', 'Capital of Japan?': 'Tokyo', 'Capital of Italy?': 'Rome', 'Capital of Peru?': 'Lima', 'Capital of Kenya?': 'Nairobi' };
const lecture = { id: 'geo', title: 'Geography', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: null,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '',
  flashcards: { cards: Object.entries(CARDS).map(([front, back]) => ({ front, back })) } };

const question = (page: Page) => page.getByRole('dialog');
const prompt = async (page: Page) => (await question(page).locator('h2').textContent())!.trim();
/** Run the game clock until a question comes up. */
const untilQuestion = async (page: Page, max = 40) => {
  for (let i = 0; i < max && !(await question(page).isVisible()); i++) await page.clock.runFor(500);
  await expect(question(page)).toBeVisible();
};
const answerRight = async (page: Page) => {
  const right = CARDS[await prompt(page)];
  await question(page).getByRole('button').filter({ hasText: new RegExp(`^\\d${right}$`) }).click();
};
const answerWrong = async (page: Page) => {
  const right = CARDS[await prompt(page)];
  await question(page).getByRole('button').filter({ hasNotText: right }).first().click();
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tg = t.game;

  test(`Glide: crash, answer to keep your life, lose lives to wrong answers and time-outs (${lang})`, async ({ page }) => {
    await page.clock.install();
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures');
    await page.getByRole('link', { name: tg.play }).click();
    await expect(page.getByRole('heading', { level: 1, name: tg.title })).toBeVisible();
    await page.getByRole('link', { name: new RegExp(tg.glide.name) }).click();
    await expect(page.getByRole('img', { name: new RegExp(tg.area(tg.glide.name)) })).toBeVisible();
    await page.getByRole('button', { name: tg.start }).click();

    // Not flying: the plane drops onto the desk, and a rescue question comes up.
    await untilQuestion(page);
    await expect(question(page)).toContainText(tg.rescue);
    await answerRight(page);
    await expect(question(page).getByText(tg.correct)).toBeVisible();
    await page.clock.runFor(1100);
    await expect(page.getByRole('img', { name: tg.lives(3) })).toBeVisible();

    // A wrong answer costs a life; so does running out of time (keys 1–4 also answer).
    await untilQuestion(page);
    await answerWrong(page);
    await page.clock.runFor(1100);
    await expect(page.getByRole('img', { name: tg.lives(2) })).toBeVisible();
    await untilQuestion(page);
    await page.clock.runFor(12_200);
    await expect(question(page).getByText(tg.timeUp)).toBeVisible();
    await page.clock.runFor(1000);
    await expect(page.getByRole('img', { name: tg.lives(1) })).toBeVisible();

    await untilQuestion(page);
    const last = await prompt(page);
    const wrongKey = (await question(page).getByRole('button').allTextContents()).findIndex((b) => !b.endsWith(CARDS[last])) + 1;
    await page.keyboard.press(String(wrongKey));
    await page.clock.runFor(1100);

    await expect(page.getByRole('heading', { name: tg.over })).toBeVisible();
    await expect(page.getByText(tg.answered(1, 4))).toBeVisible();
    await expect(page.getByText(tg.newBest).or(page.getByText(tg.best(0)))).toBeVisible();
    await expect(page.getByRole('heading', { name: tg.missed })).toBeVisible();
    await expect(page.locator('main li')).toHaveCount(3);

    // Missed flashcards were put back into spaced repetition.
    const reviewed = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bw.cardReviews') ?? '{}')) as { box: number }[]);
    expect(reviewed.length).toBeGreaterThan(0);
    expect(reviewed.every((r) => r.box === 0)).toBe(true);

    await page.getByRole('button', { name: tg.again }).click();
    await expect(page.getByRole('button', { name: tg.start })).toBeVisible();
  });

  test(`Lane Rush: change lanes, pause, and answer a question to keep going (${lang})`, async ({ page }) => {
    await page.clock.install();
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/play');
    // From the Lectures page there's no folder yet: choose what the questions are about first.
    await expect(page.getByText(tg.chooseFirst)).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(tg.rush.name) })).toHaveCount(0);
    await page.getByRole('radio', { name: new RegExp(tg.allLectures) }).click();
    await page.getByRole('link', { name: new RegExp(tg.rush.name) }).click();
    await page.getByRole('button', { name: tg.start }).click();
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: tg.right }).dispatchEvent('pointerdown');

    // Pause and resume.
    await page.getByRole('button', { name: tg.pause }).click();
    await expect(page.getByRole('button', { name: tg.resume }).first()).toBeVisible();
    await page.keyboard.press('p');
    await expect(page.getByRole('button', { name: tg.pause })).toBeVisible();

    await untilQuestion(page, 60);
    await answerRight(page);
    await page.clock.runFor(1100);
    await expect(question(page)).toBeHidden();
    await expect(page.getByRole('img', { name: tg.lives(3) })).toBeVisible();
  });

  test(`choose which lectures the questions come from (${lang})`, async ({ page }) => {
    await page.clock.install();
    await onboard(page, { hebrew: lang === 'he' });
    const other = { ...lecture, id: 'hist', title: 'History', flashcards: { cards: [{ front: 'Year of the French Revolution?', back: '1789' }, { front: 'First US president?', back: 'Washington' }, { front: 'Fall of Rome?', back: '476' }, { front: 'Moon landing?', back: '1969' }] } };
    await page.evaluate((ls) => localStorage.setItem('bw.lectures', JSON.stringify(ls)), [lecture, other]);
    await page.goto('/play');
    await page.getByRole('radio', { name: new RegExp(tg.pickLectures) }).click();
    await expect(page.getByText(tg.pickOne)).toBeVisible();
    await page.getByRole('checkbox', { name: /History/ }).click();
    await expect(page.getByRole('radio', { name: new RegExp(tg.pickLectures) })).toContainText(tg.questions(4));
    await page.getByRole('link', { name: new RegExp(tg.glide.name) }).click();
    await expect(page).toHaveURL(/lectures=hist/);
    await page.getByRole('button', { name: tg.start }).click();
    await untilQuestion(page);
    expect(Object.keys({ 'Year of the French Revolution?': 1, 'First US president?': 1, 'Fall of Rome?': 1, 'Moon landing?': 1 })).toContain(await prompt(page));
  });

  test(`the games explain what they need when there is nothing to play with (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/play');
    await expect(page.getByText(tg.notEnough)).toBeVisible();
    await page.goto('/play/glide');
    await expect(page.getByText(tg.notEnough)).toBeVisible();
  });
}
