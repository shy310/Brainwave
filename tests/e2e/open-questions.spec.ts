import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] };
const QUIZ = { questions: [
  { kind: 'choice', prompt: 'A derivative is a…', options: ['rate of change', 'sum'], correctIndex: 0, answer: 'rate of change', accepted: [], check: '', explanation: 'From the lecture.',
    hint: 'Think about speed.', moreHints: ['It describes how fast something changes.', 'Speed is the derivative of position.'] },
  { kind: 'open', prompt: 'Why is the derivative the slope of the tangent line?', options: [], correctIndex: -1, answer: 'Because it is the limit of the slopes of secant lines as h goes to 0.',
    accepted: [], check: '', hint: 'Think of secant lines.', explanation: 'Secants approach the tangent.' },
] };
const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'The derivative is the limit of secant slopes, which is the slope of the tangent line.' }],
  slides_text: null, notes: NOTES, quiz: QUIZ, flashcards: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`hints one at a time, and written answers graded with feedback (${lang})`, async ({ page }) => {
    const graded: Record<string, unknown>[] = [];
    let fail = true;
    await page.route('**/api/ai/gradeAnswer', (route) => {
      graded.push((route.request().postDataJSON() as { input: Record<string, unknown> }).input);
      if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: 'down' } }); }
      return route.fulfill({ json: { data: {
        score: 65, verdict: 'partial', feedback: 'You have the idea, but say what happens as h shrinks.',
        criteria: [{ name: 'Correctness', score: 7, comment: 'The tangent idea is right.' }, { name: 'Explanation', score: 5, comment: 'Mention the limit.' }],
        strengths: ['Clear'], improvements: ['Mention the limit'], improved: 'x',
      } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/lec1');
    await page.getByRole('radio', { name: t.lectures.tabsView.quiz }).click();

    // Three hints, one at a time.
    await page.getByRole('button', { name: t.quiz.hint, exact: true }).click();
    await expect(page.getByText(t.quiz.hintOf(1, 3))).toBeVisible();
    await expect(page.getByText('It describes how fast')).toHaveCount(0);
    await page.getByRole('button', { name: t.quiz.anotherHint }).click();
    await expect(page.getByText('It describes how fast something changes.')).toBeVisible();
    await page.getByRole('button', { name: t.quiz.anotherHint }).click();
    await expect(page.getByText(t.quiz.hintOf(3, 3))).toBeVisible();
    await expect(page.getByRole('button', { name: t.quiz.anotherHint })).toHaveCount(0);
    await page.getByRole('radio').filter({ hasText: 'rate of change' }).click();
    await page.getByRole('button', { name: t.quiz.check }).click();
    await page.getByRole('button', { name: t.quiz.next }).click();

    // A written answer. The first try fails (service down): the answer is kept, not marked wrong.
    await page.getByLabel(t.quiz.writeAnswer).fill('Because the tangent touches the curve at that point.');
    await page.getByRole('button', { name: t.quiz.check }).click();
    await expect(page.getByText(t.quiz.gradeFailed)).toBeVisible();
    await page.getByRole('button', { name: t.quiz.check }).click();
    await expect(page.getByText(t.quiz.outOf100(65))).toBeVisible();
    await expect(page.getByText(t.quiz.partial)).toBeVisible();
    await expect(page.getByText('Correctness 7/10')).toBeVisible();
    await expect(page.getByText(t.quiz.modelAnswer)).toBeVisible();
    expect(graded[1]).toMatchObject({ kind: 'quiz', reference: QUIZ.questions[1].answer, answer: 'Because the tangent touches the curve at that point.' });
    expect(String(graded[1].context)).toContain('limit of secant slopes');
    await page.getByRole('button', { name: t.quiz.finish }).click();
    await expect(page.getByText('50%')).toBeVisible(); // partly right isn't counted as correct
  });
}
