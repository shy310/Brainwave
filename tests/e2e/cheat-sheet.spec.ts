import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Derivatives measure how fast things change.', mode: 'detailed',
  sections: [{ heading: 'Rules', points: ['The chain rule handles compositions'] }], keyTerms: [{ term: 'Limit', definition: 'What a function approaches' }], reminders: [] };
const lecture = { id: 'n', title: 'Calculus', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, segments: [{ start: 0, text: 'x' }],
  slides_text: null, notes: NOTES, quiz: null, flashcards: null, created_at: '2026-11-20T10:00:00.000Z', updated_at: '' };
const BULLETS = { format: 'bullets', formulas: ['$(fg)\' = f\'g + fg\'$'], blocks: [{ heading: 'Rules', items: ['**Chain rule**: outside × inside', '**Product rule**: swap and add'], table: null }] };
const TABLES = { format: 'tables', formulas: [], blocks: [{ heading: 'Rules', items: [], table: { head: ['Rule', 'Use'], rows: [['Chain', 'Compositions']] } }] };
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectures')!) as { cheat_sheet?: { format: string } }[])[0].cheat_sheet);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tc = t.lectures.cheat;

  test(`make a cheat sheet in a format, switch layout and print (${lang})`, async ({ page }) => {
    const asked: { format: string; text: string }[] = [];
    await page.route('**/api/ai/cheatSheet', async (route) => {
      const input = route.request().postDataJSON().input;
      asked.push(input);
      await route.fulfill({ json: { data: input.format === 'tables' ? TABLES : { ...BULLETS, format: input.format } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/n');
    await page.getByRole('link', { name: tc.short }).click();
    await expect(page.getByRole('heading', { name: tc.title, level: 1 })).toBeVisible();

    await page.getByRole('button', { name: tc.make }).click();
    const sheet = page.getByRole('article', { name: 'Calculus' });
    await expect(sheet.getByText('outside × inside')).toBeVisible();
    expect(asked[0]).toMatchObject({ format: 'bullets' });
    expect(asked[0].text).toContain('The chain rule handles compositions');
    await expect.poll(async () => (await saved(page))?.format).toBe('bullets');

    // Two columns is the same sheet laid out differently: no new AI call.
    await page.getByRole('radio', { name: tc.formats.columns }).click();
    await expect.poll(async () => (await saved(page))?.format).toBe('columns');
    expect(asked).toHaveLength(1);

    // Tables are written differently: remake.
    await page.getByRole('radio', { name: tc.formats.tables }).click();
    await page.getByRole('button', { name: tc.remake(tc.formats.tables) }).click();
    await expect(sheet.getByRole('cell', { name: 'Compositions' })).toBeVisible();
    expect(asked[1]).toMatchObject({ format: 'tables' });

    // It stays after a reload, and prints without the app around it.
    await page.reload();
    await expect(page.getByRole('cell', { name: 'Compositions' })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('heading', { name: tc.title, level: 1 })).toBeHidden();
    await expect(page.locator('header').first()).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Compositions' })).toBeVisible();
  });
}
