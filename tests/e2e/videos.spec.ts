import type { Page } from '@playwright/test';
import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';

const sc = (over: Record<string, unknown>) => ({ kind: 'title', heading: 'H', items: [], latex: '', fn: '', xMin: -5, xMax: 5, narration: 'Hello.', ...over });
const SCRIPT = {
  title: 'Parabolas in two minutes',
  scenes: [
    sc({ kind: 'title', heading: 'Meet the parabola', items: ['The shape of a thrown ball'], narration: 'Throw a ball and watch its path. That curve is a parabola.' }),
    sc({ kind: 'equation', heading: 'The simplest parabola', latex: 'y = x^2', narration: 'The simplest one is y equals x squared.' }),
    sc({ kind: 'graph', heading: 'Its graph', fn: 'x^2', xMin: -3, xMax: 3, narration: 'Here is its graph. The lowest point is called the vertex.' }),
    sc({ kind: 'summary', heading: 'Remember', items: ['U-shaped curve', 'Lowest point: the vertex'], narration: 'A parabola is U-shaped. Its lowest point is the vertex.' }),
  ],
};

const mockAi = async (page: Page) => {
  const calls: Record<string, { input: Record<string, unknown> }[]> = {};
  await page.route('**/api/ai/*', async (route) => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    (calls[op] ??= []).push(route.request().postDataJSON());
    if (op === 'videoScript') return route.fulfill({ json: { data: SCRIPT } });
    if (op === 'tutor') return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: 'data: {"text":"The vertex is where the curve turns."}\n\ndata: [DONE]\n\n' });
    return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
  });
  return calls;
};

test('make a video from a request, play it, jump scenes and ask about a moment', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Video lessons', exact: true }).first().click();
  await page.getByLabel('What do you want to learn?').fill('parabolas');
  await page.getByRole('radio', { name: /Longer/ }).click();
  await page.getByRole('button', { name: 'Make the video' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Parabolas in two minutes' })).toBeVisible();
  expect(calls.videoScript[0].input).toEqual({ source: { prompt: 'parabolas' }, length: 'long' });
  await expect(page.getByText('Meet the parabola')).toBeVisible();

  // Play: captions show the narration sentence by sentence.
  await page.getByRole('button', { name: 'Play' }).first().click();
  await expect(page.getByText('Throw a ball and watch its path.')).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: 'Next scene' }).click();
  await expect(page.getByText('Scene 2 of 4').first()).toBeVisible();
  await expect(page.locator('.katex-display')).toBeVisible();
  await page.getByRole('button', { name: 'Next scene' }).click();
  await expect(page.locator('svg[role="img"] path')).toHaveCount(1);

  await page.getByRole('button', { name: 'Ask about this moment' }).click();
  await page.getByRole('button', { name: 'Give me another example' }).click();
  await expect(page.getByText('The vertex is where the curve turns.')).toBeVisible();
  const material = (calls.tutor[0].input as { material: { focus: string } }).material;
  expect(material.focus).toContain('Its graph');

  // Saved and listed.
  await page.getByRole('link', { name: 'Video lessons' }).first().click();
  await expect(page.getByRole('link', { name: /Parabolas in two minutes/ })).toBeVisible();
});

test('a topic page opens the video maker for that topic', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.goto('/learn/topic/math-h1-t1');
  await page.getByRole('link', { name: 'Watch a video lesson' }).click();
  await expect(page.getByText('Quadratic Equations')).toBeVisible();
  await page.getByRole('button', { name: 'Make the video' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Parabolas in two minutes' })).toBeVisible();
  expect(calls.videoScript[0].input.source).toEqual({ topicId: 'math-h1-t1' });
});

test('the video player fits a phone in Hebrew', async ({ page }) => {
  await mockAi(page);
  await onboard(page, { hebrew: true });
  await page.goto('/videos');
  await page.getByRole('button', { name: 'מה זו נגזרת?' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Parabolas in two minutes' })).toBeVisible();
  await page.getByRole('button', { name: 'לסצנה הבאה' }).click();
  await expect(page.getByText('סצנה 2 מתוך 4').first()).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
