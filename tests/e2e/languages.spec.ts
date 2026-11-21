import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';
import { en } from '../../src/i18n/en';
import { ar } from '../../src/i18n/ar';
import { ru } from '../../src/i18n/ru';

test('switch the app to Arabic (right to left) and Russian from the header', async ({ page }) => {
  await onboard(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  const picker = page.getByRole('button', { name: en.onboarding.language });
  await picker.click();
  await page.getByRole('menuitem', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(ar.home.greeting('Maya'));
  await expect(page.getByRole('link', { name: ar.nav.learn }).first()).toBeVisible();

  // Courses are translated too.
  await page.goto('/learn');
  await expect(page.getByRole('heading', { level: 1, name: ar.learn.title })).toBeVisible();
  await expect(page.getByText(ar.subjects.math).first()).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);

  // The choice is remembered.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.getByRole('button', { name: ar.onboarding.language }).click();
  await page.getByRole('menuitem', { name: 'Русский' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1, name: ru.learn.title })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);

  // Settings offers all four languages.
  await page.goto('/settings');
  await page.getByRole('button', { name: ru.onboarding.language }).last().click();
  const appLanguage = page.getByRole('radiogroup', { name: ru.onboarding.language });
  for (const name of ['English', 'עברית', 'العربية', 'Русский']) await expect(appLanguage.getByRole('radio', { name })).toBeVisible();
  await expect(appLanguage.getByRole('radio', { name: 'Русский' })).toBeChecked();
});

test('AI requests and new lectures use the chosen language', async ({ page }) => {
  const sent: { locale?: string; input?: { language?: string } }[] = [];
  await page.route('**/api/ai/*', (r) => {
    sent.push(r.request().postDataJSON() as (typeof sent)[number]);
    return r.fulfill({ json: { data: { title: 'T', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] } } });
  });
  await onboard(page, { locale: 'ru' });
  await page.goto('/lectures/new');
  await page.getByRole('radio', { name: ru.lectures.modes.document }).click();
  await page.getByRole('button', { name: ru.lectures.doc.paste }).click();
  // Lectures can be in Arabic or Russian.
  await expect(page.getByLabel(ru.lectures.language)).toHaveCount(0); // not shown for pasted text
  await page.getByRole('radio', { name: ru.lectures.modes.audio }).click();
  await page.getByLabel(ru.lectures.language).selectOption('ar');
  await page.getByLabel(ru.lectures.language).selectOption('ru');
  await page.getByRole('radio', { name: ru.lectures.modes.document }).click();
  await page.getByRole('button', { name: ru.lectures.doc.paste }).click();
  await page.getByLabel(ru.lectures.textPlaceholder).fill('Сегодня мы говорили о производных. '.repeat(6));
  await page.getByRole('button', { name: ru.lectures.create }).click();
  await expect.poll(() => sent.length).toBeGreaterThan(0);
  expect(sent[0].locale).toBe('ru');
});
