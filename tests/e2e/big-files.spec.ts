import fs from 'node:fs';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';
import { makePdf } from './pdf-fixture';

const MB = 1024 * 1024;
const TEXT = 'Today we start derivatives. The derivative of a function at a point tells us how fast it is changing there.';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`slides bigger than 2 MB are read in the browser; picture slides by the AI (${lang})`, async ({ page }) => {
    const calls: Record<string, { input: Record<string, unknown> }[]> = {};
    await page.route('**/api/ai/*', async (route) => {
      const op = new URL(route.request().url()).pathname.split('/').pop()!;
      (calls[op] ??= []).push(route.request().postDataJSON());
      if (op === 'imageText') return route.fulfill({ json: { data: { text: 'A graph of a tangent line.' } } });
      return route.fulfill({ json: { data: { title: 'Derivatives', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [], mode: 'detailed' } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.tabs.text }).click();
    await page.getByPlaceholder(t.lectures.textPlaceholder).fill(TEXT);

    const slides = makePdf(['Limits and continuity', null, 'The derivative'], { name: 'week3-slides.pdf', padBytes: 5 * MB });
    expect(slides.buffer.length).toBeGreaterThan(5 * MB);
    await page.locator('input[type=file][accept="application/pdf"]').setInputFiles(slides);
    await expect(page.getByText(t.lectures.slidesReady('week3-slides.pdf'))).toBeVisible({ timeout: 20_000 });
    expect(calls.slidesText).toBeUndefined(); // the file itself is never uploaded
    expect(calls.imageText).toHaveLength(1); // only the picture slide used the AI

    await page.getByRole('button', { name: t.lectures.create }).click();
    await expect.poll(() => calls.lectureNotes?.length).toBe(1);
    expect(calls.lectureNotes[0].input.slides).toBe('Slide 1: Limits and continuity\n\nSlide 2: A graph of a tangent line.\n\nSlide 3: The derivative');
  });
}

test('the tutor takes a PDF bigger than 2 MB as its text, and a big scan as page pictures', async ({ page }, testInfo) => {
  const sent: { input: { attachment?: Record<string, unknown> } }[] = [];
  await page.route('**/api/ai/tutor', async (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: 'data: {"text":"Got it."}\n\ndata: [DONE]\n\n' });
  });
  await onboard(page);
  await page.goto('/tutor');
  const input = page.locator('input[type=file]');

  await input.setInputFiles(makePdf(['Derivatives', 'Chain rule'], { name: 'textbook.pdf', padBytes: 3 * MB }));
  await expect(page.getByText('textbook.pdf')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: en.tutor.send }).click();
  await expect(page.getByText('Got it.')).toBeVisible();
  expect(sent[0].input.attachment).toEqual({ kind: 'pdfText', name: 'textbook.pdf', text: 'Page 1:\nDerivatives\n\nPage 2:\nChain rule', pages: [] });

  await input.setInputFiles(makePdf([null], { name: 'scan.pdf', padBytes: 3 * MB }));
  await expect(page.getByText('scan.pdf')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: en.tutor.send }).click();
  await expect.poll(() => sent.length).toBe(2);
  const scan = sent[1].input.attachment as { kind: string; text: string; pages: string[] };
  expect([scan.kind, scan.text, scan.pages.length]).toEqual(['pdfText', '', 1]);
  expect(scan.pages[0]).toMatch(/^data:image\/jpeg;base64,/);

  // Over 100 MB is still refused, without reading it.
  const huge = testInfo.outputPath('huge.pdf');
  fs.writeFileSync(huge, '');
  fs.truncateSync(huge, 101 * MB); // sparse: takes no real disk space
  await input.setInputFiles(huge);
  await expect(page.getByText(en.tutor.fileTooBig)).toBeVisible();
});
