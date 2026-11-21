import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';

const NOTES = { title: 'x', summary: 'Saved notes.', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [], mode: 'detailed' };
const lecture = { id: 'a', title: 'Calculus', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: NOTES, quiz: null, flashcards: null,
  created_at: '2026-11-03T10:00:00.000Z', updated_at: '2026-11-20T10:00:00.000Z' };

test('on a phone, drag a sheet down to close it; a small drag springs back', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'drag-to-dismiss is for phone-sized screens');
  await onboard(page);
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
  await page.goto('/lectures/a');
  const open = () => page.getByRole('toolbar').getByRole('button', { name: en.lectures.options.title }).click();
  const sheet = page.getByRole('dialog', { name: en.lectures.options.title });
  const title = sheet.getByRole('heading', { name: en.lectures.options.title });

  await open();
  await expect(sheet).toBeVisible();
  let box = (await title.boundingBox())!;
  // A small drag: it follows the finger, then settles back.
  await page.mouse.move(box.x + 10, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 45, { steps: 8 });
  await expect.poll(async () => (await title.boundingBox())!.y).toBeGreaterThan(box.y + 20);
  await page.waitForTimeout(200); // slow finger: no flick
  await page.mouse.up();
  await expect.poll(async () => Math.round((await title.boundingBox())!.y)).toBe(Math.round(box.y));
  await expect(sheet).toBeVisible();

  // A long drag down closes it.
  box = (await title.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 600, { steps: 12 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();

  // It opens again normally afterwards.
  await open();
  await expect(sheet).toBeVisible();
  await expect.poll(async () => Math.round((await title.boundingBox())!.y)).toBe(Math.round(box.y));
});

test('the confirm dialog leaves the way it came: Escape cancels and nothing is deleted', async ({ page }) => {
  await onboard(page);
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
  await page.goto('/lectures/a');
  await page.getByRole('toolbar').getByRole('button', { name: en.lectures.options.title }).click();
  await page.getByRole('dialog', { name: en.lectures.options.title }).getByRole('button', { name: en.lectures.delete }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(en.lectures.confirmDelete);
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Calculus' })).toBeVisible();
});
