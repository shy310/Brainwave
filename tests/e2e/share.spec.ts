import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = {
  title: 'Derivatives', summary: 'The derivative is a **rate of change**.', mode: 'detailed',
  sections: [{ heading: 'Definition', points: ['$f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}$'] }],
  keyTerms: [{ term: 'Tangent', definition: 'A line touching the curve at one point.' }], reminders: ['Problem set 3 is due Sunday.'],
};
const lecture = { id: 'lec1', title: 'נגזרות — שבוע 3', source: 'text', language: 'he', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'x' }], slides_text: null, notes: NOTES, quiz: null, flashcards: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`save notes as PDF through a clean print page (${lang})`, async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/lec1');
    await page.getByRole('toolbar').getByRole('button', { name: t.lectures.options.title }).click();
    await page.getByRole('dialog').getByRole('button', { name: t.lectures.share.savePdf }).click();
    await expect(page).toHaveURL(/\/lectures\/lec1\/print$/);
    await expect(page.getByRole('heading', { level: 1, name: lecture.title })).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible();
    await expect(page.getByText('Problem set 3 is due Sunday.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
    // No app menus on the printed page.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    if (lang === 'he') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: t.lectures.share.print })).toBeHidden();
  });

  test(`sharing explains it needs an account in demo mode; bad links are handled (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/lec1');
    await page.getByRole('button', { name: t.lectures.share.share, exact: true }).click();
    await page.getByRole('menuitem', { name: t.lectures.actions.link }).click();
    await expect(page.getByText(t.lectures.share.needsAccount)).toBeVisible();

    // A share link opens without signing in (sign out, keep the language).
    await page.evaluate(() => localStorage.removeItem('bw.demoUser'));
    await page.goto('/s/not-a-real-token-1234567890');
    await expect(page.getByText(t.lectures.share.notFound)).toBeVisible();
    await expect(page).toHaveURL(/\/s\/not-a-real-token/);
  });
}
