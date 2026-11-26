import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const line = (speaker: number, text: string, chapter = '') => ({ speaker, text, chapter });
const SCRIPT = {
  title: 'Black holes, explained',
  hosts: [{ name: 'Maya', role: 'Curious host' }, { name: 'Sam', role: 'Physicist' }],
  lines: [
    line(0, 'Sam, what actually is a black hole?', 'The basics'), line(1, 'A place where not even light can escape.'),
    line(0, 'Like a cosmic vacuum cleaner?'), line(1, 'Not quite. It does not suck things in from far away.'),
    line(0, 'How do they form?', 'How they form'), line(1, 'When a huge star runs out of fuel, its core collapses.'),
    line(0, 'And that makes the black hole?'), line(1, 'Exactly. Strong gravity, no light escapes.'),
  ],
};
const ANSWER = { lines: [line(0, 'Great question, Dana!'), line(1, 'From far away it pulls like any star of the same mass.'), line(0, 'Okay, back to where we were.')].map(({ speaker, text }) => ({ speaker, text })) };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const th = t.podcasts.hand;

  test(`raise your hand: pause, ask, the hosts answer, the episode carries on (${lang})`, async ({ page }) => {
    const asked: Record<string, unknown>[] = [];
    await page.route('**/api/ai/*', async (route) => {
      const op = new URL(route.request().url()).pathname.split('/').pop()!;
      if (op === 'podcastScript') return route.fulfill({ json: { data: SCRIPT } });
      if (op === 'podcastAnswer') { asked.push(route.request().postDataJSON().input); return route.fulfill({ json: { data: ANSWER } }); }
      return route.fulfill({ status: 404, json: { error: 'Unknown operation.' } });
    });
    await onboard(page, { hebrew: lang === 'he', name: 'Dana Levi' });
    await page.evaluate(([script, l]) => localStorage.setItem('bw.media', JSON.stringify([{ id: 'p1', kind: 'podcast', title: script.title,
      origin: { type: 'prompt', label: 'Black holes' }, locale: l, script, created_at: '2026-11-20T10:00:00.000Z' }])), [SCRIPT, lang] as const);
    await page.goto('/podcasts/p1');
    await expect(page.getByRole('heading', { level: 1, name: 'Black holes, explained' })).toBeVisible();

    // Jump to line 4 and raise a hand there: the episode pauses.
    await page.getByRole('navigation', { name: t.podcasts.chapters }).getByRole('button', { name: /How they form/ }).click();
    await page.getByRole('button', { name: th.raise }).click();
    await expect(page.getByRole('button', { name: t.podcasts.play, exact: true })).toBeVisible();
    const panel = page.getByRole('region', { name: th.title });
    await expect(panel).toBeVisible();

    await panel.getByRole('textbox', { name: th.type }).fill('Would the Sun pull harder if it became a black hole?');
    await panel.getByRole('textbox', { name: th.type }).press('Enter');
    await expect(panel.getByText('Great question, Dana!')).toBeVisible();
    expect(asked[0]).toMatchObject({ question: 'Would the Sun pull harder if it became a black hole?', listener: 'Dana', locale: lang,
      hosts: SCRIPT.hosts, title: 'Black holes, explained', earlier: [] });
    expect(asked[0].focus).toContain('How do they form?');

    // When the answer ends, the episode plays on from where it paused.
    await expect(panel).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: t.podcasts.pause, exact: true })).toBeVisible();
    await expect.poll(async () => Number(await page.getByRole('slider').inputValue())).toBeGreaterThanOrEqual(4);
    await page.getByText(th.yours(1)).click();
    await expect(page.getByText('From far away it pulls like any star of the same mass.')).toBeVisible();

    // A second question carries the first one as context.
    await page.getByRole('button', { name: th.raise }).click();
    await page.getByRole('textbox', { name: th.type }).fill('And light?');
    await page.getByRole('textbox', { name: th.type }).press('Enter');
    await expect.poll(() => asked.length).toBe(2);
    expect(asked[1].earlier).toEqual([{ question: 'Would the Sun pull harder if it became a black hole?', answer: ANSWER.lines.map((l) => l.text).join(' ') }]);
    await page.getByRole('button', { name: th.back }).click();
    await expect(page.getByRole('region', { name: th.title })).toBeHidden();
  });
}
