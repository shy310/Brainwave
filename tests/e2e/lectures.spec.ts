import type { Page } from '@playwright/test';
import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';

const q = (over: Record<string, unknown>) => ({
  kind: 'choice', prompt: 'Q', options: [], correctIndex: -1, answer: '', accepted: [], check: '', hint: '', explanation: 'From the lecture.', ...over,
});

const NOTES = {
  title: 'Derivatives, week 3',
  summary: 'We met the **derivative** as an instantaneous rate of change.',
  sections: [{ heading: 'The definition', points: ['$f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}$', 'It is the slope of the tangent line.'] }],
  keyTerms: [{ term: 'Tangent line', definition: 'A line touching the curve at one point.' }],
  reminders: ['Problem set 3 is due Sunday.'],
};
const QUIZ = { questions: [
  q({ prompt: 'The derivative of $x^2$ is…', options: ['$2x$', '$x$', '$2$'], correctIndex: 0 }),
  q({ kind: 'input', prompt: 'Slope of $y = 3x$?', answer: '3', check: '3' }),
  q({ prompt: 'A derivative is a…', options: ['rate of change', 'sum'], correctIndex: 0 }),
] };
const CARDS = { cards: [{ front: 'What is a derivative?', back: 'An instantaneous rate of change.' }, { front: 'Slope of $y=3x$', back: '$3$' }] };

const LECTURE_TEXT = 'Today we start derivatives. The derivative of a function at a point tells us how fast it is changing there. '
  + 'Geometrically it is the slope of the tangent line. Remember that problem set 3 is due on Sunday.';

const mockAi = async (page: Page) => {
  const calls: Record<string, { input: Record<string, unknown> }[]> = {};
  await page.route('**/api/ai/*', async (route) => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    (calls[op] ??= []).push(route.request().postDataJSON());
    const json = (data: unknown) => route.fulfill({ json: { data } });
    switch (op) {
      case 'transcribe': return json({ text: `Part ${calls.transcribe.length}: the derivative is a rate of change.` });
      case 'lectureNotes': return json(NOTES);
      case 'lectureQuiz': return json(QUIZ);
      case 'flashcards': return json(CARDS);
      case 'tutor': return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: 'data: {"text":"In the lecture, the derivative was the slope."}\n\ndata: [DONE]\n\n' });
      default: return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
    }
  });
  return calls;
};

/** A short WAV file with a tone, built in the test. */
const wavFile = (seconds: number) => {
  const rate = 16000, n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2);
  return { name: 'week3.wav', mimeType: 'audio/wav', buffer: buf };
};

test('paste a lecture, get notes, transcript, quiz, flashcards and answers', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Lectures', exact: true }).first().click();
  await expect(page.getByText('No lectures yet')).toBeVisible();
  await page.getByRole('link', { name: 'New lecture' }).first().click();

  await page.getByRole('radio', { name: 'Paste text' }).click();
  await page.getByPlaceholder('Paste the lecture text here…').fill(LECTURE_TEXT);
  await page.getByRole('button', { name: 'Create lecture' }).click();

  // Notes are written automatically and the lecture takes the notes' title.
  await expect(page.getByRole('heading', { level: 1, name: 'Derivatives, week 3' })).toBeVisible();
  await expect(page.getByText('Problem set 3 is due Sunday.')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(calls.lectureNotes[0].input.transcript).toBe(LECTURE_TEXT);

  await page.getByRole('radio', { name: 'Transcript' }).click();
  await expect(page.getByText('Geometrically it is the slope')).toBeVisible();

  await page.getByRole('radio', { name: 'Quiz' }).click();
  await page.getByRole('button', { name: 'Make a quiz from this lecture' }).click();
  await expect(page.getByText('Question 1 of 3')).toBeVisible();
  await page.getByRole('radio').filter({ hasText: '2x' }).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();

  await page.getByRole('radio', { name: 'Flashcards' }).click();
  await page.getByRole('button', { name: 'Make flashcards' }).click();
  await page.getByRole('button', { name: /What is a derivative\?/ }).click();
  await expect(page.getByText('An instantaneous rate of change.')).toBeVisible();
  await page.getByRole('button', { name: 'I knew it' }).click();
  await expect(page.getByText('Card 2 of 2')).toBeVisible();

  await page.getByRole('radio', { name: 'Ask' }).click();
  await page.getByRole('button', { name: 'What were the main points?' }).click();
  await expect(page.getByText('In the lecture, the derivative was the slope.')).toBeVisible();
  const tutorInput = calls.tutor[0].input as { lecture: { text: string } };
  expect(tutorInput.lecture.text).toContain('slope of the tangent line');

  // Everything was saved: reopening the lecture from the list uses no AI.
  const notesCalls = calls.lectureNotes.length;
  await page.getByRole('link', { name: 'Lectures' }).first().click();
  await page.getByRole('link', { name: /Derivatives, week 3/ }).click();
  await expect(page.getByText('Problem set 3 is due Sunday.')).toBeVisible();
  expect(calls.lectureNotes).toHaveLength(notesCalls);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete lecture' }).click();
  await expect(page.getByText('No lectures yet')).toBeVisible();
});

test('upload a recording: it is cut into one-minute pieces and transcribed', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.goto('/lectures/new');
  await page.getByRole('radio', { name: 'Upload' }).click();
  await page.getByRole('radio', { name: 'Hebrew' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a file' }).click();
  await (await chooser).setFiles(wavFile(130));

  await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
  expect(calls.transcribe).toHaveLength(3);
  expect(calls.transcribe.every((c) => c.input.language === 'he')).toBe(true);
  await page.getByRole('radio', { name: 'Transcript' }).click();
  await expect(page.getByText('2:00')).toBeVisible();
  await expect(page.getByText(/Part \d: the derivative/).first()).toBeVisible();
});

test('record live with the microphone', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.goto('/lectures/new');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'Stop and finish' }).click();
  await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
  expect(calls.transcribe.length).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Derivatives, week 3' })).toBeVisible();
});

test('lectures work in Hebrew on a phone without sideways scrolling', async ({ page }) => {
  await mockAi(page);
  await onboard(page, { hebrew: true });
  await page.goto('/lectures/new');
  await expect(page.getByRole('heading', { name: 'הרצאה חדשה' })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
  await page.getByRole('radio', { name: 'הדבקת טקסט' }).click();
  await page.getByPlaceholder('הדביקו כאן את טקסט ההרצאה…').fill(LECTURE_TEXT);
  await page.getByRole('button', { name: 'יצירת הרצאה' }).click();
  await expect(page.getByText('Problem set 3 is due Sunday.')).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
