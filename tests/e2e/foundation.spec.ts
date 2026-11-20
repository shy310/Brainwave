import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';

test('signed-out visitors are sent to sign-in', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/learn');
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole('heading', { name: 'Learn anything, your way.' })).toBeVisible();
});

test('onboarding → home with the four pillars', async ({ page }) => {
  await onboard(page, { name: 'Maya' });
  await expect(page.getByRole('heading', { name: 'Hi, Maya' })).toBeVisible();
  for (const name of ['Learn', 'Lectures', 'Video lessons', 'Podcasts']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test('Hebrew switches the whole app to right-to-left', async ({ page }) => {
  await onboard(page, { name: 'נועה', hebrew: true });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { name: 'היי, נועה' })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
  // Persists across reloads.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('navigation, deep links and the back button work', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: /Video lessons/ }).first().click();
  await expect(page).toHaveURL(/\/videos/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/podcasts');
  await expect(page.getByRole('heading', { level: 1, name: 'Podcasts' })).toBeVisible();
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('settings: theme, language and profile', async ({ page }) => {
  await onboard(page, { name: 'Sam' });
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);

  const name = page.getByLabel('What should we call you?');
  await name.fill('Samuel');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  await page.getByRole('radio', { name: /עברית/ }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('account menu works with the keyboard and signs out', async ({ page }) => {
  await onboard(page);
  const trigger = page.getByRole('button', { name: 'Account' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin/);
});
