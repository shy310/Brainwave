import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';

const lecture = (id: string, title: string, days: number) => ({ id, title, source: 'record', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: null, quiz: null, folder_id: null,
  flashcards: { cards: [{ front: `${title} card?`, back: 'Yes.' }] }, created_at: new Date(Date.now() - days * 864e5).toISOString(), updated_at: '' });

test('home: today\'s path, the launcher straight to the task, recent lectures', async ({ page }) => {
  await onboard(page);
  await page.evaluate((L) => localStorage.setItem('bw.lectures', JSON.stringify(L)),
    [lecture('a', 'Newest', 0), lecture('b', 'Middle', 1), lecture('c', 'Older', 2), lecture('d', 'Oldest', 3)]);
  await page.reload();
  // Cards are due, so today's path starts with reviewing them, and that step is "now".
  const next = page.getByRole('region', { name: en.home.nextUp });
  const review = next.getByRole('link', { name: new RegExp(en.home.hero.review(4)) });
  await expect(review).toHaveAttribute('href', '/lectures/review');
  await expect(review).toContainText(en.home.nextUp);
  // The latest lecture is the next step after it.
  await expect(next.getByRole('link', { name: /Newest/ })).toHaveAttribute('href', '/lectures/a');
  const quick = page.getByRole('navigation', { name: en.home.quick.title });
  await expect(quick.getByRole('link', { name: en.home.record })).toHaveAttribute('href', '/lectures/new');
  await expect(quick.getByRole('link', { name: en.home.quick.upload })).toHaveAttribute('href', '/lectures/new?tab=upload');
  // Every other tool is one tap away on the launcher.
  await expect(quick.getByRole('link', { name: en.home.quick.grade })).toHaveAttribute('href', '/grader');
  await expect(quick.getByRole('link', { name: en.home.quick.groups })).toHaveAttribute('href', '/groups');

  // Recent lectures, newest first.
  const recent = page.getByRole('region', { name: en.home.recent });
  const lectures = recent.getByRole('link').filter({ hasNotText: en.home.seeAll });
  await expect(lectures).toHaveCount(4);
  await expect(lectures.first()).toContainText('Newest');

  // Today's goals: nothing done yet with cards due.
  await expect(page.getByText(en.home.doneOf(0, 3))).toBeVisible();

  // "Upload" opens the new-lecture page on the Upload tab.
  await quick.getByRole('link', { name: en.home.quick.upload }).click();
  await expect(page.getByRole('radio', { name: en.lectures.modes.audio })).toBeChecked();
});

test('lecture actions: the Share menu works with the keyboard, More opens the options sheet', async ({ page }) => {
  await onboard(page);
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])),
    { ...lecture('a', 'Derivatives', 0), notes: { title: 'D', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [], mode: 'detailed' } });
  await page.goto('/lectures/a');
  const bar = page.getByRole('toolbar', { name: en.lectures.actions.toolbar });
  const share = bar.getByRole('button', { name: en.lectures.share.share });
  await share.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: en.lectures.share.share });
  await expect(menu.getByRole('menuitem', { name: en.lectures.actions.link })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: en.lectures.shareGroup.button })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(share).toBeFocused();

  await bar.getByRole('button', { name: en.lectures.options.title }).click();
  const sheet = page.getByRole('dialog', { name: en.lectures.options.title });
  await expect(sheet.getByRole('button', { name: en.lectures.delete })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await share.click();
  await page.getByRole('menuitem', { name: en.lectures.shareGroup.button }).click();
  await expect(page.getByRole('heading', { name: en.lectures.shareGroup.title })).toBeVisible();
});
