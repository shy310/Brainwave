import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const CARDS: Record<string, string> = { 'Capital of France?': 'Paris', 'Capital of Japan?': 'Tokyo', 'Capital of Italy?': 'Rome', 'Capital of Peru?': 'Lima', 'Capital of Kenya?': 'Nairobi' };
const lecture = { id: 'geo', title: 'Geography', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: null,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '',
  flashcards: { cards: Object.entries(CARDS).map(([front, back]) => ({ front, back })) } };

const prompt = async (page: Page) => (await page.locator('main h2').first().textContent())!.trim();
const option = (page: Page, text: string) => page.locator('main button').filter({ hasText: new RegExp(`^\\d${text}$`) });

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tg = t.game;

  test(`Summit: climb with right answers, lose lives to wrong answers and time-outs (${lang})`, async ({ page }) => {
    await page.clock.install();
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures');
    await page.getByRole('link', { name: tg.play }).click();
    await expect(page.getByRole('heading', { level: 1, name: tg.name })).toBeVisible();
    await page.getByRole('button', { name: tg.start }).click();

    // Two right answers (one with the keyboard).
    await expect(page.getByText(tg.question(1, 5))).toBeVisible();
    await option(page, CARDS[await prompt(page)]).click();
    await expect(page.getByText(tg.right)).toBeVisible();
    await page.clock.runFor(1200);
    const second = await prompt(page);
    const index = await page.locator('main button').filter({ hasText: CARDS[second] }).evaluate((b) => [...b.parentElement!.children].indexOf(b));
    await page.keyboard.press(String(index + 1));
    await page.clock.runFor(1200);
    await expect(page.getByText(tg.combo(3))).toBeVisible();

    // A wrong answer, then a time-out.
    const third = await prompt(page);
    await page.locator('main button').filter({ hasNotText: CARDS[third] }).filter({ hasText: /^\d/ }).first().click();
    await expect(page.getByText(tg.wrong)).toBeVisible();
    await page.clock.runFor(1200);
    await expect(page.getByRole('img', { name: tg.lives(2) })).toBeVisible();
    await page.clock.runFor(13_000);
    await expect(page.getByText(tg.timeUp)).toBeVisible();
    await page.clock.runFor(1200);

    // Last question wrong too: three misses end the climb.
    const fifth = await prompt(page);
    await page.locator('main button').filter({ hasNotText: CARDS[fifth] }).filter({ hasText: /^\d/ }).first().click();
    await page.clock.runFor(1200);
    await expect(page.getByRole('heading', { name: tg.over })).toBeVisible();
    await expect(page.getByText(tg.climbed(2))).toBeVisible();
    await expect(page.getByText(tg.newBest)).toBeVisible();
    await expect(page.getByRole('heading', { name: tg.missed })).toBeVisible();
    await expect(page.locator('main li')).toHaveCount(3);
    await expect(page.getByText(third)).toBeVisible();

    // Missed flashcards were put back into spaced repetition.
    const reviewed = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bw.cardReviews') ?? '{}')) as { box: number }[]);
    expect(reviewed).toHaveLength(3);
    expect(reviewed.every((r) => r.box === 0)).toBe(true);

    await page.getByRole('button', { name: tg.again }).click();
    await expect(page.getByText(tg.question(1, 5))).toBeVisible();
  });

  test(`Summit explains what it needs when there is nothing to play with (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/play');
    await expect(page.getByText(tg.notEnough)).toBeVisible();
  });
}
