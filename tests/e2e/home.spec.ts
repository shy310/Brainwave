import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';

const lecture = (id: string, title: string, days: number) => ({ id, title, source: 'record', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: null, folder_id: null,
  flashcards: { cards: [{ front: `${title} card?`, back: 'Yes.' }] }, created_at: new Date(Date.now() - days * 864e5).toISOString(), updated_at: '' });

test('home: quick actions go straight to the task, due cards show a badge, recent lectures continue', async ({ page }) => {
  await onboard(page);
  await page.evaluate((L) => localStorage.setItem('bw.lectures', JSON.stringify(L)),
    [lecture('a', 'Newest', 0), lecture('b', 'Middle', 1), lecture('c', 'Older', 2), lecture('d', 'Oldest', 3)]);
  await page.reload();
  const quick = page.getByRole('navigation', { name: en.home.quick.title });
  await expect(quick.getByRole('link', { name: new RegExp(en.lectures.review.due(4)) })).toBeVisible(); // 4 new cards to learn
  await expect(quick.getByRole('link', { name: en.home.quick.upload })).toHaveAttribute('href', '/lectures/new?tab=upload');

  // The three most recent lectures, newest first.
  const recent = page.getByRole('region', { name: en.home.recent });
  const lectures = recent.getByRole('link').filter({ hasNotText: en.home.seeAll });
  await expect(lectures).toHaveCount(3);
  await expect(lectures.first()).toContainText('Newest');
  await expect(recent.getByText('Oldest')).toHaveCount(0);

  // "Upload" opens the new-lecture page on the Upload tab.
  await quick.getByRole('link', { name: en.home.quick.upload }).click();
  await expect(page.getByRole('radio', { name: en.lectures.tabs.upload })).toBeChecked();
});

test('lecture actions: Share and More menus work with the keyboard', async ({ page }) => {
  await onboard(page);
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])),
    { ...lecture('a', 'Derivatives', 0), notes: { title: 'D', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [], mode: 'detailed' } });
  await page.goto('/lectures/a');
  const more = page.getByRole('button', { name: en.lectures.actions.more });
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: en.lectures.actions.more });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: en.lectures.download })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: en.lectures.share.savePdf })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();

  await page.getByRole('button', { name: en.lectures.share.share, exact: true }).click();
  await page.getByRole('menuitem', { name: en.lectures.shareGroup.button }).click();
  await expect(page.getByRole('heading', { name: en.lectures.shareGroup.title })).toBeVisible();
});
