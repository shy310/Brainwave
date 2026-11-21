import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, expect, onboard } from './fixtures';

// axe-core on the main screens, light and dark, in all four languages: contrast, names, roles, headings.
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'The derivative is the slope.' }], slides_text: null,
  notes: { title: 'D', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [{ term: 'T', definition: 'D' }], reminders: ['r'], mode: 'exam', practice: [{ question: 'Q?', answer: 'A.' }], mistakes: ['m'] },
  quiz: null, flashcards: { cards: [{ front: 'F', back: 'B' }] }, folder_id: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };
const SCREENS = ['/', '/learn', '/lectures', '/lectures/lec1', '/lectures/review', '/exams', '/practice', '/play', '/groups', '/tutor', '/grader', '/videos', '/settings'];

for (const [lang, scheme] of [['en', 'light'], ['he', 'dark'], ['ar', 'light'], ['ru', 'dark']] as const) {
  test(`no accessibility violations on the main screens (${lang}, ${scheme})`, async ({ page }) => {
    test.slow();
    // Reduced motion: measure finished screens, not text mid-fade.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await onboard(page, { locale: lang });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    for (const path of SCREENS) {
      await page.goto(path);
      await page.locator('main h1').first().waitFor();
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run(document, { resultTypes: ['violations'], runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] });
        return r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`);
      });
      expect(violations, path).toEqual([]);
    }
  });
}
