import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const QUIZ = { questions: [{ kind: 'choice', prompt: 'Shared question?', options: ['Yes', 'No'], correctIndex: 0, answer: 'Yes', accepted: [], check: '', hint: '', explanation: 'Because.' }] };
const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: null,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: QUIZ, flashcards: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

const makeGroup = async (page: Page, t: typeof en) => {
  await page.goto('/groups');
  await page.getByRole('button', { name: t.groups.create }).click();
  await page.getByRole('textbox', { name: t.groups.name }).fill('Calc crew');
  await page.getByRole('button', { name: t.groups.make }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calc crew' })).toBeVisible();
  await page.getByRole('button', { name: t.groups.shareLecture }).click();
  await page.getByRole('combobox', { name: t.groups.pickLecture }).selectOption('lec1');
  await page.getByRole('button', { name: t.groups.shareIt, exact: true }).click();
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tc = t.groups.challenge;

  test(`group challenges: question of the day and this week's game board (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he', name: 'Maya' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await makeGroup(page, t);
    const groupUrl = page.url();

    // The question of the day comes from what the group shared; answering shows who got it.
    await expect(page.getByRole('heading', { name: tc.daily })).toBeVisible();
    await expect(page.getByText('Shared question?')).toBeVisible();
    await page.getByRole('group', { name: tc.daily }).getByRole('button', { name: /Yes/ }).click();
    await expect(page.getByText(tc.answered(1, 1))).toBeVisible();
    await expect(page.getByText(`Maya (${tc.you})`).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('group', { name: tc.daily }).getByRole('button', { name: /Yes/ })).toBeDisabled();

    // No scores yet; a finished game puts you on the board.
    await expect(page.getByText(tc.noScores)).toBeVisible();
    await page.clock.install();
    await page.goto('/play/glide?folder=all');
    await page.getByRole('button', { name: t.game.start }).click();
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 40 && !(await page.getByRole('dialog').isVisible()); i++) await page.clock.runFor(500);
      await page.getByRole('dialog').getByRole('button', { name: /No/ }).click();
      await page.clock.runFor(1100);
    }
    await expect(page.getByRole('heading', { name: t.game.over })).toBeVisible();

    await page.goto(groupUrl);
    const board = page.getByRole('list', { name: `${tc.board}: ${t.game.glide.name}` });
    await expect(board.getByRole('listitem')).toHaveCount(1);
    await expect(board.getByRole('listitem')).toContainText(`Maya (${tc.you})`);
    await expect(board.getByRole('listitem')).toContainText('🥇');
    await page.getByRole('radio', { name: t.game.rush.name }).click();
    await expect(page.getByText(tc.noScores)).toBeVisible();
  });
}
