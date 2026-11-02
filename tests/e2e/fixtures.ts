import { test as base, expect, type Page } from '@playwright/test';

/** Block third-party requests (fonts) so tests are fast and offline-safe. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await use(page);
  },
});
export { expect };

/** Fresh demo student who completes onboarding. */
export const onboard = async (page: Page, opts: { name?: string; hebrew?: boolean } = {}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/signin');
  await page.getByRole('button', { name: /Try BrainWave|נסו את BrainWave/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  if (opts.hebrew) await page.getByRole('radio', { name: /עברית/ }).click();
  await page.getByRole('textbox').fill(opts.name ?? 'Maya');
  await page.getByRole('button', { name: /Start learning|מתחילים ללמוד/ }).click();
  await expect(page).toHaveURL(/\/$/);
};

/** True when the page scrolls sideways (a layout bug on phones). */
export const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
