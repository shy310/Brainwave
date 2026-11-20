import type { Locator, Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const lecture = { id: 'l1', title: 'Lecture', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, segments: [{ start: 0, text: 'x' }],
  slides_text: null, notes: null, quiz: null, flashcards: null, folder_id: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };
const folders = ['Math', 'Physics', 'History'].map((name, position) => ({ id: name.toLowerCase(), name, position, created_at: String(position) }));

const setup = async (page: Page, hebrew: boolean) => {
  await onboard(page, { hebrew });
  await page.evaluate(([l, f]) => { localStorage.setItem('bw.lectures', JSON.stringify([l])); localStorage.setItem('bw.lectureFolders', JSON.stringify(f)); }, [lecture, folders] as const);
  await page.goto('/lectures');
};
const center = async (l: Locator) => { const b = (await l.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const savedOrder = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('bw.lectureFolders')!) as { name: string; position: number }[])
  .sort((a, b) => a.position - b.position).map((f) => f.name));

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`drag a folder to a new place with the mouse (${lang})`, async ({ page }) => {
    await setup(page, lang === 'he');
    const nav = page.getByRole('navigation', { name: t.lectures.library.folders });
    const from = await center(nav.getByRole('button', { name: /Math/ }));
    const to = await center(nav.getByRole('button', { name: /History/ }));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + (to.x - from.x) / 2, from.y, { steps: 5 });
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => savedOrder(page)).toEqual(['Physics', 'History', 'Math']);
    // The drag didn't count as choosing the folder.
    await expect(nav.getByRole('button', { name: /Math/ })).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(nav.getByRole('button').nth(1)).toContainText('Physics');
    await expect(nav.getByRole('button').nth(3)).toContainText('Math');
  });

  test(`long-press and drag on touch; a quick swipe doesn't reorder (${lang})`, async ({ page }) => {
    await setup(page, lang === 'he');
    const nav = page.getByRole('navigation', { name: t.lectures.library.folders });
    const chip = nav.getByRole('button', { name: /History/ });
    const from = await center(chip);
    const to = await center(nav.getByRole('button', { name: /Math/ }));
    const touch = (type: string, x: number) => chip.dispatchEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: from.y, bubbles: true });

    // A quick swipe: no reordering.
    await touch('pointerdown', from.x);
    await touch('pointermove', from.x - 60);
    await touch('pointerup', from.x - 60);
    expect(await savedOrder(page)).toEqual(['Math', 'Physics', 'History']);

    // Long press, then drag onto Math.
    await touch('pointerdown', from.x);
    await page.waitForTimeout(450);
    await touch('pointermove', (from.x + to.x) / 2);
    await touch('pointermove', to.x);
    await touch('pointerup', to.x);
    await expect.poll(() => savedOrder(page)).toEqual(['History', 'Math', 'Physics']);
  });
}
