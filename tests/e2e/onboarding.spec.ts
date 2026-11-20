import { test, expect } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`onboarding choices set the defaults: exam-prep notes, Hebrew lectures (${lang})`, async ({ page }) => {
    const modes: string[] = [];
    await page.route('**/api/ai/lectureNotes', (r) => {
      modes.push((r.request().postDataJSON() as { input: { mode: string } }).input.mode);
      return r.fulfill({ json: { data: { title: 'T', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] } } });
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/signin');
    await page.getByRole('button', { name: /Try BrainWave|נסו את BrainWave/ }).click();
    if (lang === 'he') await page.getByRole('radio', { name: /עברית/ }).click();
    await page.getByRole('textbox').fill('Noa');
    await page.getByLabel(t.home.goal).selectOption('exams');
    await page.getByLabel(t.home.lectureLanguage).selectOption('he');
    await page.getByRole('button', { name: t.onboarding.finish }).click();
    await expect(page).toHaveURL(/\/$/);

    // New recordings default to Hebrew.
    await page.goto('/lectures/new');
    await expect(page.getByRole('radio', { name: t.lectures.languages.he })).toBeChecked();

    // Notes are written for exam prep.
    await page.getByRole('radio', { name: t.lectures.tabs.text }).click();
    await page.getByPlaceholder(t.lectures.textPlaceholder).fill('Today we start derivatives. The derivative of a function tells us how fast it changes. It is the slope of the tangent line.');
    await page.getByRole('button', { name: t.lectures.create }).click();
    await expect.poll(() => modes).toEqual(['exam']);

    // Both can be changed in Settings.
    await page.goto('/settings');
    await expect(page.getByRole('radio', { name: t.lectures.summaryModes.exam })).toBeChecked();
    await expect(page.getByLabel(t.home.lectureLanguage)).toHaveValue('he');
  });
}
