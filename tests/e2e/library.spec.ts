import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Saved notes.', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [], mode: 'detailed' };
const lecture = (id: string, title: string, day: number) => ({
  id, title, source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: `${title} transcript.` }], slides_text: null, notes: NOTES, quiz: null, flashcards: null,
  created_at: `2026-11-${String(day).padStart(2, '0')}T10:00:00.000Z`, updated_at: '2026-11-20T10:00:00.000Z',
});

/** Three saved lectures in demo storage. */
const seed = (page: Page) => page.evaluate((all) => localStorage.setItem('bw.lectures', JSON.stringify(all)), [
  lecture('a', 'Calculus week 2', 3), lecture('b', 'Calculus week 10', 9), lecture('c', 'World history', 5),
]);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tl = t.lectures.library;

  test(`folders, moving, search and sort (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await seed(page);
    await page.goto('/lectures');
    const cards = page.locator('main a[href^="/lectures/"]:not([href="/lectures/new"]):not([href^="/lectures/study"]):not([href="/lectures/review"])');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('Calculus week 10'); // newest first

    // Sort A–Z puts week 2 before week 10.
    await page.getByRole('combobox', { name: tl.sort }).selectOption('title');
    await expect(cards.nth(0)).toContainText('Calculus week 2');
    await expect(cards.nth(1)).toContainText('Calculus week 10');

    // Search.
    await page.getByRole('searchbox', { name: tl.search }).fill('HISTORY');
    await expect(cards).toHaveCount(1);
    await page.getByRole('searchbox', { name: tl.search }).fill('chemistry');
    await expect(page.getByText(tl.noResults('chemistry'))).toBeVisible();
    await page.getByRole('searchbox', { name: tl.search }).fill('');

    // Two folders.
    for (const name of ['Math', 'Humanities']) {
      await page.getByRole('button', { name: tl.newFolder }).click();
      await page.getByRole('textbox', { name: tl.folderName }).fill(name);
      await page.getByRole('button', { name: tl.create }).click();
    }
    const folders = page.getByRole('navigation', { name: tl.folders });
    await expect(folders.getByRole('button', { name: /Humanities/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(tl.emptyFolder)).toBeVisible();

    // Move a lecture into Math from its page.
    await folders.getByRole('button', { name: new RegExp(tl.all) }).click();
    await cards.filter({ hasText: 'Calculus week 2' }).click();
    await page.getByRole('combobox').selectOption({ label: 'Math' });
    await page.goto('/lectures');
    await folders.getByRole('button', { name: /Math/ }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Calculus week 2');
    await expect(folders.getByRole('button', { name: /Math/ })).toContainText('1');

    // Rename and reorder.
    await page.getByRole('button', { name: tl.rename }).click();
    await page.getByRole('textbox', { name: tl.folderName }).fill('Calculus');
    await page.getByRole('button', { name: t.common.save }).click();
    await expect(folders.getByRole('button', { name: /Calculus/ })).toBeVisible();
    await expect(page.getByRole('button', { name: tl.moveEarlier })).toBeDisabled();
    await page.getByRole('button', { name: tl.moveLater }).click();
    await expect(folders.getByRole('button').nth(1)).toContainText('Humanities');
    await expect(folders.getByRole('button').nth(2)).toContainText('Calculus');

    // The view (folder, sort) is remembered.
    await page.reload();
    await expect(folders.getByRole('button', { name: /Calculus/ })).toHaveAttribute('aria-pressed', 'true');

    // Deleting a folder keeps its lectures.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: tl.remove }).click();
    await expect(folders.getByRole('button', { name: /Calculus/ })).toHaveCount(0);
    await expect(cards).toHaveCount(3);
  });
}
