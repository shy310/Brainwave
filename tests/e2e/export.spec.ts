import { readFile } from 'node:fs/promises';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Derivatives measure change.', mode: 'detailed', sections: [{ heading: 'Rules', points: ['Power rule: $x^n$'] }], keyTerms: [{ term: 'Slope', definition: 'Rise over run' }], reminders: [] };
const CARDS = { cards: [{ front: 'Derivative of $x^2$?', back: '$2x$' }, { front: 'Slope?', back: 'Rise over run' }] };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const te = t.lectures.export;

  test(`export: flashcards to Anki, notes to Google Docs (.docx) and Notion (${lang})`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate(([n, c]) => localStorage.setItem('bw.lectures', JSON.stringify([{ id: 'e', title: 'Calculus 101', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
      segments: [{ start: 0, text: 'x' }], slides_text: null, notes: n, quiz: null, flashcards: c, created_at: '2026-11-20T10:00:00.000Z', updated_at: '' }])), [NOTES, CARDS] as const);
    await page.goto('/lectures/e');
    const openExport = async () => {
      await page.getByRole('toolbar', { name: t.lectures.actions.toolbar }).getByRole('button', { name: t.lectures.options.title }).click();
      await page.getByRole('dialog').getByRole('button', { name: te.open }).click();
      await expect(page.getByRole('dialog', { name: te.title })).toBeVisible();
    };
    const grab = async (label: string) => {
      const dl = page.waitForEvent('download');
      await page.getByRole('dialog', { name: te.title }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
      const d = await dl;
      return { name: d.suggestedFilename(), body: await readFile((await d.path())!) };
    };

    await openExport();
    const anki = await grab(te.anki);
    expect(anki.name).toBe('Calculus 101.txt');
    expect(anki.body.toString()).toContain('Derivative of \\(x^2\\)?\t\\(2x\\)\tBrainWave::Calculus_101');

    const docx = await grab(te.docs);
    expect(docx.name).toBe('Calculus 101.docx');
    expect(docx.body.subarray(0, 2).toString()).toBe('PK'); // a zip, as .docx files are
    expect(docx.body.toString('latin1')).toContain('word/document.xml');

    const md = await grab(te.notion);
    expect(md.name).toBe('Calculus 101.md');
    expect(md.body.toString()).toContain('# Calculus 101');
    expect(md.body.toString()).toContain('- **Slope** — Rise over run');

    await page.getByRole('dialog', { name: te.title }).getByRole('button', { name: te.copyNotion }).click();
    await expect(page.getByRole('button', { name: te.copied })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('## Rules');
  });
}
