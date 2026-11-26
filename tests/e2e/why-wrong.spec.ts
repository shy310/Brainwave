import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const question = { kind: 'choice', prompt: 'What does a derivative measure?', options: ['A rate of change', 'An area', 'A total'], correctIndex: 0,
  answer: 'A rate of change', accepted: [], check: '', hint: '', explanation: 'It is the slope.' };
const lecture = { id: 'calc', title: 'Calculus', source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: null,
  segments: [{ start: 0, text: 'The derivative tells you how fast something changes; the integral adds up area.' }], slides_text: null, notes: null,
  quiz: { questions: [question, { ...question, prompt: 'Second?' }] }, flashcards: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

const sse = (...parts: string[]) => parts.map((p) => `data: ${JSON.stringify({ text: p })}\n\n`).join('') + 'data: [DONE]\n\n';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tw = t.quiz.whyWrong;

  test(`after a wrong answer, AI explains the mistake and answers a follow-up (${lang})`, async ({ page }) => {
    const sent: { given: string; correct: string; options?: string[]; context?: string; followUps: { role: string; content: string }[] }[] = [];
    await page.route('**/api/ai/whyWrong', (route) => {
      sent.push(route.request().postDataJSON().input);
      return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' },
        body: sent.length === 1 ? sse('An area is what an **integral** adds up. ', 'A derivative is a rate of change.') : sse('Speed is a rate of change.') });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/calc');
    await page.getByRole('radio', { name: t.lectures.tabsView.quiz }).click();

    // A right answer offers no "why".
    await page.getByRole('radio', { name: /A rate of change/ }).click();
    await page.getByRole('button', { name: t.quiz.check }).click();
    await expect(page.getByText(t.quiz.correct)).toBeVisible();
    await expect(page.getByRole('button', { name: tw.ask })).toBeHidden();
    await page.getByRole('button', { name: t.quiz.next }).click();

    // A wrong one does: it explains from the lecture, then takes a follow-up.
    await page.getByRole('radio', { name: /An area/ }).click();
    await page.getByRole('button', { name: t.quiz.check }).click();
    await page.getByRole('button', { name: tw.ask }).click();
    const box = page.getByRole('region', { name: tw.title });
    await expect(box.getByText('A derivative is a rate of change.', { exact: false })).toBeVisible();
    expect(sent[0]).toMatchObject({ given: 'An area', correct: 'A rate of change', options: ['A rate of change', 'An area', 'A total'], followUps: [] });
    expect(sent[0].context).toContain('how fast something changes');
    await box.getByRole('textbox', { name: tw.followUp }).fill('So what is speed?');
    await box.getByRole('textbox', { name: tw.followUp }).press('Enter');
    await expect(box.getByText('Speed is a rate of change.')).toBeVisible();
    expect(sent[1].followUps).toEqual([
      { role: 'assistant', content: 'An area is what an **integral** adds up. A derivative is a rate of change.' },
      { role: 'user', content: 'So what is speed?' },
    ]);
  });
}
