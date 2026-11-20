import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] };
const q = (prompt: string) => ({ kind: 'choice', prompt, options: ['Right', 'Wrong'], correctIndex: 0, answer: '', accepted: [], check: '', hint: '', explanation: 'Because.' });
const lecture = (id: string, title: string, day: number, extra: Record<string, unknown>) => ({
  id, title, source: 'text', language: 'auto', status: 'ready', duration_sec: 0, folder_id: 'math',
  segments: [{ start: 0, text: `${title}: the derivative is the slope of the tangent line.` }], slides_text: null,
  notes: NOTES, quiz: null, flashcards: null, created_at: `2026-11-0${day}T10:00:00.000Z`, updated_at: '', ...extra,
});

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const ts = t.lectures.study;

  test(`study a whole folder: combined flashcards and quiz (${lang})`, async ({ page }) => {
    const ops: string[] = [];
    await page.route('**/api/ai/*', (route) => {
      const op = new URL(route.request().url()).pathname.split('/').pop()!;
      ops.push(op);
      if (op === 'flashcards') return route.fulfill({ json: { data: { cards: [{ front: 'Made card A', back: 'a' }, { front: 'Made card B', back: 'b' }] } } });
      if (op === 'lectureQuiz') return route.fulfill({ json: { data: { questions: [q('Made question?')] } } });
      return route.fulfill({ status: 404, json: { error: 'no' } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((data) => {
      localStorage.setItem('bw.lectures', JSON.stringify(data.lectures));
      localStorage.setItem('bw.lectureFolders', JSON.stringify([{ id: 'math', name: 'Math', position: 0, created_at: '1' }]));
    }, { lectures: [
      lecture('a', 'Week 1', 1, { flashcards: { cards: [{ front: 'Card 1', back: 'one' }, { front: 'Card 2', back: 'two' }] }, quiz: { questions: [q('Question one?')] } }),
      lecture('b', 'Week 2', 2, { flashcards: { cards: [{ front: 'Card 3', back: 'three' }, { front: 'Card 4', back: 'four' }] } }),
      lecture('c', 'Week 3', 3, {}),
    ] });

    await page.goto('/lectures');
    await page.getByRole('navigation', { name: t.lectures.library.folders }).getByRole('button', { name: /Math/ }).click();
    await page.getByRole('link', { name: ts.studyFolder }).click();
    await expect(page.getByRole('heading', { level: 1, name: ts.title('Math') })).toBeVisible();

    // Cards from two lectures; make the missing set for the third.
    await expect(page.getByText(ts.cardsFrom(4, 2))).toBeVisible();
    await expect(page.getByText(ts.missingCards(1))).toBeVisible();
    await page.getByRole('button', { name: ts.makeMissing }).click();
    await expect(page.getByText(ts.cardsFrom(6, 3))).toBeVisible();
    expect(ops).toEqual(['flashcards']);

    // Go through the deck; miss one card once.
    await expect(page.getByText(ts.from('Week 1'))).toBeVisible();
    for (let i = 0; i < 7; i++) {
      await page.getByRole('button', { pressed: false }).filter({ hasText: /Card|Made card/ }).click();
      await page.getByRole('button', { name: i === 0 ? t.lectures.again : t.lectures.knewIt }).click();
    }
    await expect(page.getByText(t.lectures.cardsResult(5, 6))).toBeVisible();
    await expect(page.getByText(t.lectures.cardsToReview)).toBeVisible();

    // Quiz: one lecture has a quiz; make the other two.
    await page.getByRole('radio', { name: ts.quiz }).click();
    await expect(page.getByText(ts.missingQuiz(2))).toBeVisible();
    await page.getByRole('button', { name: ts.makeMissing }).click();
    await expect(page.getByText(ts.questionsFrom(3, 3))).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await page.getByRole('radio').filter({ hasText: 'Right' }).click();
      await page.getByRole('button', { name: t.quiz.check }).click();
      await page.getByRole('button', { name: i < 2 ? t.quiz.next : t.quiz.finish }).click();
    }
    await expect(page.getByText('100%', { exact: true })).toBeVisible();

    // Results are remembered for this folder.
    await page.reload();
    await expect(page.getByText(`${ts.lastTime}: ${ts.lastCards(5, 6)} · ${ts.lastQuiz(100)}`)).toBeVisible();
  });
}
