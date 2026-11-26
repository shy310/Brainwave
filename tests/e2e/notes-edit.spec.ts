import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Derivatives measure how fast things change.', mode: 'detailed',
  sections: [{ heading: 'Rules', points: ['The chain rule handles compositions', 'The product rule handles products'] }], keyTerms: [], reminders: [] };
const lecture = { id: 'n', title: 'Calculus', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, segments: [{ start: 0, text: 'x' }],
  slides_text: null, notes: NOTES, quiz: null, flashcards: null, created_at: '2026-11-20T10:00:00.000Z', updated_at: '',
  highlights: [{ id: 'h1', block: 's0.1', quote: 'product rule', offset: 4, color: 'green', createdAt: 1 }] };

const select = (page: Page, text: string) => page.evaluate((needle) => {
  const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.textContent!.indexOf(needle);
    if (i >= 0) {
      const r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + needle.length);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(r);
      return true;
    }
  }
  return false;
}, text);
const stored = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectures')!) as { notes: typeof NOTES; highlights: { block: string }[] }[])[0]);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const te = t.lectures.edit;

  test(`select part of the notes and let AI expand it, then undo (${lang})`, async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await page.route('**/api/ai/notesEdit', async (route) => {
      sent.push(route.request().postDataJSON().input);
      await route.fulfill({ json: { data: { points: ['For sin(x²) the outside is sin and the inside is x²', 'Multiply the two derivatives'] } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/n');
    await page.locator('[data-block="summary"]').waitFor();
  await page.locator('[data-block="summary"]').waitFor();

    expect(await select(page, 'chain rule')).toBe(true);
    await page.getByRole('toolbar', { name: t.lectures.highlights.toolbar }).getByRole('button', { name: t.lectures.highlights.edit }).click();
    const sheet = page.getByRole('dialog', { name: te.title });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('chain rule', { exact: true })).toBeVisible();
    await sheet.getByRole('radio', { name: te.actions.example }).click();
    await sheet.getByRole('radio', { name: te.places.after }).click();
    await sheet.getByRole('radio', { name: te.depths.detailed }).click();
    await sheet.getByRole('button', { name: te.write }).click();

    // It writes into the notes, right after the point, and the green highlight below stays on its text.
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-block="s0.1"]')).toHaveText('For sin(x²) the outside is sin and the inside is x²');
    await expect(page.locator('[data-block="s0.2"]')).toHaveText('Multiply the two derivatives');
    expect(sent[0]).toMatchObject({ action: 'example', place: 'after', depth: 'detailed', quote: 'chain rule', block: 'The chain rule handles compositions', heading: 'Rules' });
    await expect.poll(async () => (await stored(page)).notes.sections[0].points.length).toBe(4);
    expect((await stored(page)).highlights[0].block).toBe('s0.3');

    // Undo puts the notes back.
    await page.getByRole('status').getByRole('button', { name: te.undo }).click();
    await expect.poll(async () => (await stored(page)).notes.sections[0].points.length).toBe(2);
    expect((await stored(page)).highlights[0].block).toBe('s0.1');
    await expect(page.locator('[data-block="s0.1"]')).toHaveText('The product rule handles products');
  });
}

test('your own instruction replaces the selected words', async ({ page }) => {
  let input: Record<string, unknown> = {};
  await page.route('**/api/ai/notesEdit', async (route) => {
    input = route.request().postDataJSON().input;
    await route.fulfill({ json: { data: { points: ['how quickly'] } } });
  });
  await onboard(page);
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
  await page.goto('/lectures/n');
  await page.locator('[data-block="summary"]').waitFor();
  await select(page, 'how fast');
  await page.getByRole('button', { name: en.lectures.highlights.edit }).click();
  const sheet = page.getByRole('dialog', { name: en.lectures.edit.title });
  await sheet.getByRole('textbox', { name: en.lectures.edit.custom }).fill('a synonym');
  await sheet.getByRole('radio', { name: en.lectures.edit.places.replace }).click();
  await sheet.getByRole('textbox', { name: en.lectures.edit.custom }).press('Enter');
  await expect(page.locator('[data-block="summary"]')).toHaveText('Derivatives measure how quickly things change.');
  expect(input).toMatchObject({ action: 'custom', instruction: 'a synonym', place: 'replace' });
});
