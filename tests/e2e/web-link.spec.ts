import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const TEXT = 'Cells are the basic unit of life. '.repeat(20).trim();

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const td = t.lectures.doc;

  test(`a lecture from a link to an article (${lang})`, async ({ page }) => {
    const asked: string[] = [];
    await page.route('**/api/webpage**', async (route) => {
      const url = new URL(route.request().url()).searchParams.get('url')!;
      asked.push(url);
      if (url.includes('private')) return route.fulfill({ status: 422, json: { error: 'There isn’t enough text on that page.' } });
      return route.fulfill({ json: { url, title: 'Cells — Biology for everyone', text: TEXT, cut: false } });
    });
    await page.route('**/api/ai/lectureNotes', (r) => r.fulfill({ json: { data: { title: '🧫 Cells', summary: 'Cells are the unit of life.', sections: [{ heading: 'Cells', points: ['Basic unit'] }], keyTerms: [], reminders: [] } } }));
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.modes.document }).click();

    // A page without enough text says what to do instead.
    await page.getByRole('textbox', { name: td.link }).fill('example.edu/private');
    await page.getByRole('button', { name: td.read }).click();
    await expect(page.getByText(td.linkErrors.noText)).toBeVisible();
    expect(asked[0]).toBe('https://example.edu/private'); // https added

    await page.getByRole('textbox', { name: td.link }).fill('https://example.edu/cells');
    await page.getByRole('button', { name: td.read }).click();
    await expect(page).toHaveURL(/\/lectures\/[\w-]+$/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bw.lectures')!)[0]);
    expect(saved).toMatchObject({ source: 'document', source_url: 'https://example.edu/cells' });
    expect(saved.segments[0].text).toBe(TEXT);
    await expect(page.getByText('Cells are the unit of life.')).toBeVisible();
  });
}
