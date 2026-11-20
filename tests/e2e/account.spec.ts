import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const ta = t.account;

  test(`delete my data: typed confirmation, everything on the device removed (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate(() => {
      localStorage.setItem('bw.lectures', '[{"id":"x"}]');
      localStorage.setItem('bw.cardReviews', '{}');
      indexedDB.open('bw-lecture-audio', 1);
    });
    await page.goto('/settings');
    await page.getByRole('button', { name: ta.deleteDemo }).click();
    const confirm = page.getByRole('button', { name: ta.deleteNow });
    await expect(confirm).toBeDisabled();
    await page.getByLabel(ta.typeToConfirm(ta.confirmWord)).fill('nope');
    await expect(confirm).toBeDisabled();
    await page.getByLabel(ta.typeToConfirm(ta.confirmWord)).fill(ta.confirmWord.toLowerCase());
    await confirm.click();

    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByText(ta.deleted)).toBeVisible();
    const left = await page.evaluate(async () => ({
      keys: Object.keys(localStorage).filter((k) => k.startsWith('bw.')),
      dbs: (await indexedDB.databases()).map((d) => d.name),
    }));
    expect(left.keys.every((k) => ['bw.locale', 'bw.theme'].includes(k))).toBe(true);
    expect(left.dbs).not.toContain('bw-lecture-audio');
  });

  test(`a public page explains how to delete an account (${lang})`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((l) => localStorage.setItem('bw.locale', l), lang);
    await page.goto('/delete-account');
    await expect(page.getByRole('heading', { level: 1, name: ta.publicTitle })).toBeVisible();
    await expect(page.getByText(ta.publicSteps[2])).toBeVisible();
  });
}
