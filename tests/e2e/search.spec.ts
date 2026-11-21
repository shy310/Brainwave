import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Limits and derivatives.', sections: [{ heading: 'Derivatives', points: ['A derivative measures a rate of change'] }], keyTerms: [], reminders: [], mode: 'detailed' };
const lectures = [
  { id: 'calc', title: 'Calculus', source: 'record', language: 'auto', status: 'ready', duration_sec: 600,
    segments: [{ start: 0, text: 'Welcome back.' }, { start: 95, text: 'The derivative is the slope of the tangent line.' }, { start: 300, text: 'Homework is on page 12.' }],
    slides_text: null, notes: NOTES, quiz: null, flashcards: null, created_at: '2026-11-20T10:00:00.000Z', updated_at: '' },
  { id: 'heb', title: 'מבוא', source: 'record', language: 'he', status: 'ready', duration_sec: 120,
    segments: [{ start: 12, text: 'פונקציה לינארית היא קו ישר.' }, { start: 70, text: 'השיפוע הוא קצב השינוי.' }],
    slides_text: null, notes: null, quiz: null, flashcards: null, created_at: '2026-11-19T10:00:00.000Z', updated_at: '' },
];

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const ts = t.search;

  test(`search all lectures, jump to the moment, and ask with sources (${lang})`, async ({ page }) => {
    let asked: { question: string; passages: { n: number; text: string }[] } | null = null;
    await page.route('**/api/ai/askLectures', async (route) => {
      asked = route.request().postDataJSON().input;
      await route.fulfill({ json: { data: { answer: 'The derivative is the slope of the tangent line [1].', cited: [1], found: true } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((ls) => localStorage.setItem('bw.lectures', JSON.stringify(ls)), lectures);

    await page.goto('/lectures');
    await page.getByRole('link', { name: ts.open }).click();
    await expect(page.getByRole('heading', { level: 1, name: ts.title })).toBeVisible();
    await page.getByRole('searchbox', { name: ts.title }).fill('tangent slope');
    const hit = page.getByRole('link', { name: /The derivative is the slope of the tangent line/ });
    await expect(hit).toContainText(ts.at('1:35'));
    await expect(hit.locator('mark').first()).toBeVisible();

    // Ask: the AI gets the best passages and answers with a numbered source.
    await page.getByRole('button', { name: ts.ask }).click();
    await expect(page.getByRole('heading', { name: ts.answer })).toBeVisible();
    expect(asked!.question).toBe('tangent slope');
    expect(asked!.passages[0]).toMatchObject({ n: 1, text: 'The derivative is the slope of the tangent line.' });
    await expect(page.getByRole('link', { name: `${ts.sources} 1: Calculus` })).toHaveAttribute('href', '/lectures/calc?t=95');

    // Opening the hit shows that moment in the transcript.
    await hit.click();
    await expect(page).toHaveURL(/\/lectures\/calc\?t=95/);
    await expect(page.getByRole('radio', { name: t.lectures.tabsView.transcript })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#seg-95')).toBeInViewport();

    // Hebrew text is found too, and Back keeps the query.
    await page.goBack();
    await expect(page.getByRole('searchbox', { name: ts.title })).toHaveValue('tangent slope');
    await page.getByRole('searchbox', { name: ts.title }).fill('שיפוע');
    await expect(page.getByRole('link', { name: /השיפוע הוא קצב השינוי/ })).toContainText(ts.at('1:10'));
    await page.getByRole('searchbox', { name: ts.title }).fill('photosynthesis');
    await expect(page.getByText(ts.none('photosynthesis'))).toBeVisible();
  });
}
