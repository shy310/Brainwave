import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Derivatives and integrals.', mode: 'detailed', sections: [{ heading: 'Derivatives', points: ['Slope of a curve'] }], keyTerms: [], reminders: [] };
const MAP = {
  nodes: [
    { id: 'calc', label: 'Calculus', kind: 'main', note: 'The maths of change.' },
    { id: 'der', label: 'Derivative', kind: 'concept', note: 'How fast something changes.' },
    { id: 'int', label: 'Integral', kind: 'concept', note: 'The area under a curve.' },
    { id: 'slope', label: 'Slope', kind: 'detail', note: '' },
  ],
  edges: [{ from: 'calc', to: 'der', label: 'includes' }, { from: 'calc', to: 'int', label: 'includes' }, { from: 'der', to: 'slope', label: 'measures' }],
};

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tm = t.lectures.map;

  test(`concept map: draw it, tap an idea, zoom, read it as a list (${lang})`, async ({ page }) => {
    let sent = '';
    await page.route('**/api/ai/conceptMap', async (route) => { sent = route.request().postDataJSON().input.text; await route.fulfill({ json: { data: MAP } }); });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((n) => localStorage.setItem('bw.lectures', JSON.stringify([{ id: 'c', title: 'Calculus 101', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
      segments: [{ start: 0, text: 'x' }], slides_text: null, notes: n, quiz: null, flashcards: null, created_at: '2026-11-20T10:00:00.000Z', updated_at: '' }])), NOTES);

    await page.goto('/lectures/c');
    await page.getByRole('toolbar', { name: t.lectures.actions.toolbar }).getByRole('button', { name: t.lectures.options.title }).click();
    await page.getByRole('dialog').getByRole('button', { name: tm.open }).click();
    await expect(page.getByRole('heading', { level: 1, name: tm.title })).toBeVisible();
    await page.getByRole('button', { name: tm.make }).click();
    expect(sent).toContain('Slope of a curve'); // made from the notes

    const diagram = page.getByRole('img', { name: tm.diagram('Calculus 101') });
    await expect(diagram).toBeVisible();
    for (const label of ['Calculus', 'Derivative', 'Integral', 'Slope']) await expect(diagram.getByRole('button', { name: label, exact: true })).toBeVisible();

    // Tap an idea: its note and links.
    await diagram.getByRole('button', { name: 'Derivative', exact: true }).click();
    await expect(page.getByText('How fast something changes.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Slope · measures/ })).toBeVisible();
    await page.getByRole('button', { name: /Slope · measures/ }).click();
    await expect(diagram.getByRole('button', { name: 'Slope', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Zoom in changes the drawing's scale; Fit resets it.
    const scale = () => diagram.locator('g').first().getAttribute('transform');
    const before = await scale();
    await page.getByRole('button', { name: tm.zoomIn }).click();
    expect(await scale()).not.toBe(before);
    await page.getByRole('button', { name: tm.reset }).click();
    expect(await scale()).toBe(before);

    // The same map as a list, and it's saved with the lecture.
    await page.getByRole('radio', { name: tm.list }).click();
    await expect(page.getByText('The area under a curve.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('img', { name: tm.diagram('Calculus 101') })).toBeVisible();
    await expect(page.getByRole('button', { name: tm.redo })).toBeVisible();
  });
}
