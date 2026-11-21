import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';

test('a page whose code is gone after an update reloads once, then shows a friendly screen (not a crash)', async ({ page }) => {
  await onboard(page);
  let blocked = 0;
  // Pretend the app was redeployed: the Podcasts page's old code file no longer exists.
  await page.route(/\/assets\/PodcastsPage-[\w-]+\.js$/, (route) => { blocked++; return route.fulfill({ status: 404, body: 'gone' }); });
  const loads: string[] = [];
  page.on('load', () => loads.push(page.url()));
  await page.getByRole('link', { name: en.nav.podcasts, exact: true }).first().click();

  await expect(page.getByRole('alert')).toContainText(en.errors.updated);
  await expect(page.getByText(en.errors.updatedHint)).toBeVisible();
  await expect(page.getByText('Unexpected Application Error')).toHaveCount(0);
  expect(loads.length).toBe(1); // it loaded the new version once on its own, then stopped
  await expect(page).toHaveURL(/\/podcasts$/); // the page they were going to, not the one they left
  expect(blocked).toBeGreaterThanOrEqual(2);

  // With the new version available, Reload works.
  await page.unroute(/\/assets\/PodcastsPage-[\w-]+\.js$/);
  await page.getByRole('button', { name: en.errors.reload }).click();
  await expect(page.getByRole('heading', { level: 1, name: en.podcasts.title })).toBeVisible();
});
