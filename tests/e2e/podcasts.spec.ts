import type { Page } from '@playwright/test';
import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';

const line = (speaker: number, text: string, chapter = '') => ({ speaker, text, chapter });
const SCRIPT = {
  title: 'Black holes, explained',
  hosts: [{ name: 'Maya', role: 'Curious host' }, { name: 'Sam', role: 'Physicist' }],
  lines: [
    line(0, 'Sam, what actually is a black hole?', 'The basics'),
    line(1, 'It is a place where gravity is so strong that not even light can escape.'),
    line(0, 'So it is like a cosmic vacuum cleaner?'),
    line(1, 'Not quite. It does not suck things in from far away.'),
    line(0, 'How do they form?', 'How they form'),
    line(1, 'When a huge star runs out of fuel, its core collapses.'),
    line(0, 'And that collapse makes the black hole?'),
    line(1, 'Exactly. Let us recap: strong gravity, no light escapes, born from collapsing stars.'),
  ],
};

const mockAi = async (page: Page) => {
  const calls: Record<string, { input: Record<string, unknown> }[]> = {};
  await page.route('**/api/ai/*', async (route) => {
    const op = new URL(route.request().url()).pathname.split('/').pop()!;
    (calls[op] ??= []).push(route.request().postDataJSON());
    if (op === 'podcastScript') return route.fulfill({ json: { data: SCRIPT } });
    if (op === 'tutor') return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: 'data: {"text":"A black hole does not suck things in from afar."}\n\ndata: [DONE]\n\n' });
    return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
  });
  return calls;
};

test('make an episode, follow the transcript, jump chapters and ask about a line', async ({ page }) => {
  const calls = await mockAi(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Podcasts', exact: true }).first().click();
  await page.getByRole('button', { name: 'How do black holes form?' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Black holes, explained' })).toBeVisible();
  expect(calls.podcastScript[0].input).toEqual({ source: { prompt: 'How do black holes form?' }, length: 'short' });
  await expect(page.getByText('Maya · Sam')).toBeVisible();

  // Chapters jump through the transcript.
  await page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /How they form/ }).click();
  await expect(page.getByRole('slider')).toHaveValue('4');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Previous chapter' }).click();
  await expect(page.getByRole('slider')).toHaveValue('0');

  // Ask about a specific line.
  await page.getByRole('button', { name: 'Ask about this' }).nth(3).click();
  await page.getByRole('button', { name: 'Is that always true?' }).click();
  await expect(page.getByText('A black hole does not suck things in from afar.')).toBeVisible();
  const material = (calls.tutor[0].input as { material: { kind: string; focus: string } }).material;
  expect(material.kind).toBe('podcast');
  expect(material.focus).toContain('Sam: Not quite.');

  await page.getByRole('link', { name: 'Podcasts' }).first().click();
  await expect(page.getByRole('link', { name: /Black holes, explained/ })).toBeVisible();
});

test('a lecture can be turned into a podcast', async ({ page }) => {
  const calls = await mockAi(page);
  await page.route('**/api/ai/lectureNotes', (r) => r.fulfill({ json: { data: {
    title: 'Stars', summary: 'Stars live and die.', sections: [{ heading: 'Life', points: ['Stars fuse hydrogen.'] }], keyTerms: [], reminders: [],
  } } }));
  await onboard(page);
  await page.goto('/lectures/new');
  await page.getByRole('radio', { name: 'Paste text' }).click();
  await page.getByPlaceholder('Paste the lecture text here…').fill('Stars are born in clouds of gas. They fuse hydrogen into helium for billions of years, and the biggest ones end as black holes.');
  await page.getByRole('button', { name: 'Create lecture' }).click();
  await expect(page.getByText('Stars fuse hydrogen.')).toBeVisible();
  await page.getByRole('link', { name: 'Podcast', exact: true }).click();
  await expect(page.getByText('From:')).toBeVisible();
  await page.getByRole('button', { name: 'Make the episode' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Black holes, explained' })).toBeVisible();
  const source = calls.podcastScript[0].input.source as { lecture: { title: string; text: string } };
  expect(source.lecture.title).toBe('Stars');
  expect(source.lecture.text).toContain('fuse hydrogen into helium');
});

test('podcasts fit a phone in Hebrew', async ({ page }) => {
  await mockAi(page);
  await onboard(page, { hebrew: true });
  await page.goto('/podcasts');
  await page.getByRole('button', { name: 'מה זה אינפלציה?' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Black holes, explained' })).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
