import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'Derivatives', summary: 'The derivative is the slope of the tangent line.', mode: 'detailed',
  sections: [{ heading: 'Definition', points: ['A derivative measures the instantaneous rate of change.'] }], keyTerms: [], reminders: [] };
const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'Today: the derivative as the slope of the tangent line.' }], slides_text: null, notes: NOTES,
  quiz: null, flashcards: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const ta = t.lectures.askPanel;

  test(`ask about the lecture from anywhere, or about selected text (${lang})`, async ({ page }) => {
    const asked: { lecture?: { text: string }; messages: { content: string }[] }[] = [];
    await page.route('**/api/ai/tutor', (route) => {
      asked.push((route.request().postDataJSON() as { input: (typeof asked)[number] }).input);
      return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: 'data: {"text":"It is the limit of secant slopes."}\n\ndata: [DONE]\n\n' });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/lec1');

    // The floating button opens the tutor with this lecture as context.
    await page.getByRole('button', { name: ta.open, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: ta.title });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: t.lectures.askStarters[0] }).click();
    await expect(dialog.getByText('It is the limit of secant slopes.')).toBeVisible();
    expect(asked[0].lecture?.text).toContain('slope of the tangent line');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Select a phrase in the notes: "Ask about this" quotes it in the message box.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('li')].find((n) => n.textContent?.includes('instantaneous rate of change'))!;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await page.getByRole('button', { name: ta.aboutSelection }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox')).toHaveValue(ta.quote('A derivative measures the instantaneous rate of change.'));
    await dialog.getByRole('textbox').pressSequentially('why instantaneous?');
    await dialog.getByRole('textbox').press('Enter');
    await expect.poll(() => asked.length).toBe(2);
    expect(asked[1].messages.at(-1)!.content).toBe(`${ta.quote('A derivative measures the instantaneous rate of change.')}why instantaneous?`);

    // The same conversation is in the Ask tab.
    await page.getByRole('button', { name: ta.close }).click();
    await page.getByRole('radio', { name: t.lectures.tabsView.ask }).click();
    await expect(page.getByText('why instantaneous?')).toBeVisible();
    await expect(page.getByRole('button', { name: ta.open, exact: true })).toHaveCount(0);
  });
}

test('the floating Ask button never covers the last buttons on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboard(page);
  // Long notes, so the page scrolls and its last row ends up next to the floating button.
  const long = { ...lecture, notes: { ...NOTES, sections: Array.from({ length: 6 }, (_, i) => ({ heading: `Part ${i + 1}`, points: ['A derivative measures the instantaneous rate of change.'] })) } };
  await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), long);
  await page.goto('/lectures/lec1');
  await page.getByRole('link', { name: 'Podcast', exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const ask = await page.getByRole('button', { name: en.lectures.askPanel.open, exact: true }).boundingBox();
  for (const link of ['Video lesson', 'Podcast']) {
    const box = await page.getByRole('link', { name: link, exact: true }).boundingBox();
    const overlap = box!.x < ask!.x + ask!.width && ask!.x < box!.x + box!.width && box!.y < ask!.y + ask!.height && ask!.y < box!.y + box!.height;
    expect(overlap, `${link} is covered by the Ask button`).toBe(false);
  }
});
