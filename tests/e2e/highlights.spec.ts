import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Derivatives measure how fast things change.', mode: 'detailed',
  sections: [{ heading: 'Rules', points: ['The chain rule handles compositions', 'The product rule handles products'] }], keyTerms: [], reminders: [] };
const lecture = { id: 'n', title: 'Calculus', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, segments: [{ start: 0, text: 'x' }],
  slides_text: null, notes: NOTES, quiz: null, flashcards: null, created_at: '2026-11-20T10:00:00.000Z', updated_at: '' };

/** Select `text` inside the notes, like a student dragging over it. */
const select = (page: Page, text: string) => page.evaluate((needle) => {
  const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.textContent!.indexOf(needle);
    if (i >= 0) {
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + needle.length);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
    }
  }
  return false;
}, text);
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectures')!) as { highlights?: { quote: string; color: string; comment?: string; block: string }[] }[])[0].highlights ?? []);
const painted = (page: Page, name: string) => page.evaluate((n) => (CSS.highlights.get(n)?.size ?? 0), name);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const th = t.lectures.highlights;

  test(`highlight text in the notes and comment on it (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/n');
    await expect(page.getByText(th.hint)).toBeVisible();

    // Select → a toolbar with colours: green.
    expect(await select(page, 'chain rule')).toBe(true);
    const bar = page.getByRole('toolbar', { name: th.toolbar });
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: th.color(th.colors.green) }).click();
    await expect(bar).toBeHidden();
    await expect.poll(() => saved(page)).toEqual([expect.objectContaining({ quote: 'chain rule', color: 'green', block: 's0.0' })]);
    await expect.poll(() => painted(page, 'bw-green')).toBe(1);

    // Select → Comment: highlighted in yellow with a comment.
    await select(page, 'how fast things change');
    await bar.getByRole('button', { name: th.comment }).click();
    await page.getByRole('textbox', { name: th.addComment }).fill('Exam question!');
    await page.getByRole('button', { name: th.save }).first().click();
    await expect.poll(() => saved(page)).toContainEqual(expect.objectContaining({ quote: 'how fast things change', color: 'yellow', comment: 'Exam question!', block: 'summary' }));
    await expect.poll(() => painted(page, 'bw-comment')).toBe(1);

    // The list shows both, in the order of the notes, and survives a reload.
    await page.reload();
    const list = page.getByRole('heading', { name: new RegExp(th.title) }).locator('..');
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list.getByRole('listitem').first()).toContainText('how fast things change');
    await expect(list.getByRole('listitem').first()).toContainText('Exam question!');
    await expect.poll(() => painted(page, 'bw-yellow')).toBe(1);

    // Tap a highlight to recolour or remove it.
    const box = await page.evaluate(() => {
      const li = document.querySelector('[data-block="s0.0"]')!;
      const r = document.createRange();
      const n = [...li.querySelectorAll('*'), li].flatMap((e) => [...e.childNodes]).find((c) => c.nodeType === 3 && c.textContent!.includes('chain rule'))!;
      const i = n.textContent!.indexOf('chain rule');
      r.setStart(n, i + 2); r.setEnd(n, i + 3);
      const b = r.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: th.color(th.colors.pink) }).click();
    await expect.poll(async () => (await saved(page)).find((h) => h.quote === 'chain rule')?.color).toBe('pink');
    await bar.getByRole('button', { name: th.remove }).click();
    await expect.poll(async () => (await saved(page)).length).toBe(1);
  });
}
