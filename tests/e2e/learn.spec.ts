import type { Page, Route } from '@playwright/test';
import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';

const q = (over: Record<string, unknown>) => ({
  kind: 'choice', prompt: 'Q', options: [], correctIndex: -1, answer: '', accepted: [], check: '', hint: '', explanation: 'Because.', ...over,
});

const LESSON = {
  title: 'Adding and Taking Away',
  hook: 'What happens when **3 friends** join 2 more?',
  sections: [{ heading: 'Putting together', body: 'Adding means putting groups together: $2 + 3 = 5$.' }],
  example: { problem: 'Sam has 2 apples and gets 3 more.', steps: ['Start with 2.', 'Count on 3: 3, 4, 5.'], answer: '5 apples' },
  keyPoints: ['Adding puts groups together.', 'Taking away makes a group smaller.'],
  checkpoint: q({ prompt: 'What is 1 + 1?', options: ['1', '2', '3'], correctIndex: 1, check: '1+1' }),
};

const QUIZ = {
  questions: [
    q({ prompt: 'What is 2 + 2?', options: ['3', '4', '5'], correctIndex: 1, check: '2+2' }),
    q({ kind: 'input', prompt: 'Half of 10?', answer: '5', check: '10/2' }),
    q({ kind: 'input', prompt: 'What do we call taking away?', answer: 'subtraction', accepted: ['minus'] }),
  ],
};

/** Fake the AI gateway. Returns the list of request bodies per operation. */
const mockAi = async (page: Page, overrides: Record<string, (route: Route) => unknown> = {}) => {
  const calls: Record<string, unknown[]> = {};
  await page.route('**/api/ai/*', async (route) => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    (calls[op] ??= []).push(route.request().postDataJSON());
    if (overrides[op]) return overrides[op](route);
    const json = (data: unknown) => route.fulfill({ json: { data } });
    switch (op) {
      case 'lesson': return json(LESSON);
      case 'quiz': return json(QUIZ);
      case 'grade': return json({ correct: true, feedback: 'Yes — that is subtraction.' });
      case 'steps': return json({ steps: [{ title: 'Split in two', body: '$10 \\div 2 = 5$' }], answer: '5' });
      case 'practice': return json({ question: q({ prompt: 'What is 3 + 3?', options: ['6', '5'], correctIndex: 0, check: '3+3' }) });
      case 'tutor': return route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"text":"Great question! "}\n\ndata: {"text":"What do you get when you add $2+2$?"}\n\ndata: [DONE]\n\n',
      });
      default: return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
    }
  });
  return calls;
};

test('browse, take a lesson and a quiz, and see progress saved', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Learn', exact: true }).first().click();
  await page.getByRole('radio', { name: 'Kindergarten' }).click();
  await page.getByRole('link', { name: /^Math/ }).click();
  await page.getByRole('link', { name: /Adding and Taking Away/ }).click();

  await page.getByRole('button', { name: 'Start the lesson' }).click();
  await expect(page.getByText('Putting together')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  expect((calls.lesson[0] as { input: { topicId: string } }).input.topicId).toBe('math-k-t3');

  // Checkpoint question marks the lesson as done.
  await page.getByRole('radio', { name: /2/ }).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await expect(page.getByText('Lesson complete')).toBeVisible();

  // Worked steps and a practice question are one click away.
  await page.getByRole('button', { name: 'Show the steps' }).click();
  await expect(page.getByText('Split in two')).toBeVisible();
  await page.getByRole('button', { name: 'Similar question' }).click();
  await expect(page.getByText('What is 3 + 3?')).toBeVisible();

  // The lesson is cached: reloading doesn't call the AI again.
  await page.reload();
  await expect(page.getByText('Putting together')).toBeVisible();
  expect(calls.lesson).toHaveLength(1);

  await page.getByRole('link', { name: 'Take the quiz' }).first().click();
  await page.getByRole('button', { name: 'Start quiz' }).click();

  await expect(page.getByText('Question 1 of 3')).toBeVisible();
  await page.getByRole('radio', { name: /4/ }).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await page.getByRole('button', { name: 'Next question' }).click();

  // Numeric answers are checked locally: 10/2 written as "5.0" is right.
  await page.getByPlaceholder('Type your answer').fill('5.0');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await page.getByRole('button', { name: 'Next question' }).click();

  // Worded answers the checker can't decide go to the AI grader.
  await page.getByPlaceholder('Type your answer').fill('taking things off');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Yes — that is subtraction.')).toBeVisible();
  expect(calls.grade).toHaveLength(1);
  await page.getByRole('button', { name: 'See results' }).click();

  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText('You’ve mastered this topic. Great work!')).toBeVisible();

  await page.getByRole('link', { name: 'Back to topic' }).click();
  await expect(page.getByText('Mastered', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Math · Kindergarten/ }).click();
  await expect(page.getByText('100%')).toBeVisible();
});

test('the tutor streams replies and sends mode and topic', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.goto('/tutor?topic=math-h1-t1');
  await expect(page.getByText('Quadratic Equations')).toBeVisible();
  await page.getByRole('radio', { name: 'Explain' }).click();
  await page.getByRole('textbox', { name: 'Ask a question…' }).fill('How do I factor x^2+5x+6?');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Great question!')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  const body = calls.tutor[0] as { input: { mode: string; topicId: string; messages: unknown[] } };
  expect(body.input).toMatchObject({ mode: 'explain', topicId: 'math-h1-t1' });
  expect(body.input.messages).toHaveLength(1);

  await page.getByRole('button', { name: 'New chat' }).click();
  await expect(page.getByText('What are you working on?')).toBeVisible();
});

test('AI failures show a friendly message and can be retried', async ({ page }) => {
  let fail = true;
  await mockAi(page, {
    lesson: (route) => fail
      ? route.fulfill({ status: 429, json: { error: 'Too many requests' } })
      : route.fulfill({ json: { data: LESSON } }),
  });
  await onboard(page);
  await page.goto('/learn/topic/math-k-t3');
  await page.getByRole('button', { name: 'Start the lesson' }).click();
  await expect(page.getByRole('alert')).toContainText('AI limit');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Putting together')).toBeVisible();
});

test('learn works in Hebrew, right to left, on any screen', async ({ page }) => {
  await mockAi(page);
  await onboard(page, { hebrew: true });
  await page.goto('/learn');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'לומדים' })).toBeVisible();
  await page.getByRole('link', { name: /מתמטיקה/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'מתמטיקה' })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
  await page.goto('/learn/topic/math-h1-t1');
  await expect(page.getByRole('heading', { name: 'משוואות ריבועיות' })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
  await page.goto('/tutor');
  await expect(page.getByRole('heading', { name: 'מורה פרטי' })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
