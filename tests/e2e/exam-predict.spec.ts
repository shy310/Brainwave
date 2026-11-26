import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const lecture = (id: string, title: string, segments: { start: number; text: string }[], marks: number[] = []) => ({
  id, title, source: 'record', language: 'auto', status: 'ready', duration_sec: 3000, folder_id: null, segments, marks, slides_text: null,
  notes: null, quiz: null, flashcards: null, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' });
const LECTURES = [
  lecture('cell', 'Cell division', [{ start: 0, text: 'Today: how cells divide.' }, { start: 580, text: 'Remember the order of the phases, I always ask it on the exam.' }, { start: 700, text: 'Now, meiosis.' }, { start: 1350, text: 'Meiosis makes four haploid cells.' }], [1360]),
  lecture('dna', 'DNA replication', [{ start: 0, text: 'DNA replicates in the S phase.' }, { start: 1125, text: 'Make sure you can explain the lagging strand.' }]),
];
const q = (prompt: string, options: string[]) => ({ kind: 'choice', prompt, options, correctIndex: 0, answer: options[0], accepted: [], check: '', hint: '', explanation: 'From lecture 1.' });
const PREDICTION = {
  topics: [
    { title: 'DNA replication', likelihood: 'medium', why: 'Marked as something to explain', evidence: [{ lecture: 2, quote: 'Make sure you can explain the lagging strand.', at: 1125 }] },
    { title: 'Phases of mitosis', likelihood: 'high', why: 'Said it is always on the exam', evidence: [{ lecture: 1, quote: 'I always ask it on the exam', at: 580 }] },
  ],
  questions: [q('Order of mitosis?', ['PMAT', 'TAMP', 'MAPT']), q('Meiosis makes how many cells?', ['Four', 'Two', 'One']), q('Where does DNA replicate?', ['S phase', 'G1', 'M phase'])],
};
const inAWeek = (page: Page) => page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tp = t.exams.predict;

  test(`predict an exam from what the lecturer stressed, then take the mock exam (${lang})`, async ({ page }) => {
    const sent: { lectures: { n: number; title: string; text: string }[] }[] = [];
    await page.route('**/api/ai/examPredict', async (route) => { sent.push(route.request().postDataJSON().input); await route.fulfill({ json: { data: PREDICTION } }); });
    await onboard(page, { hebrew: lang === 'he' });
    const date = await inAWeek(page);
    await page.evaluate(([ls, d]) => {
      localStorage.setItem('bw.lectures', JSON.stringify(ls));
      localStorage.setItem('bw.exams', JSON.stringify([{ id: 'e1', title: 'Biology midterm', date: d, folderId: null, lectureIds: [], bestScore: null, attempts: 0 }]));
    }, [LECTURES, date] as const);
    await page.goto('/exams/e1');

    await page.getByRole('button', { name: tp.make }).click();
    const section = page.getByRole('region', { name: tp.title });
    // Likely topics first, each with why.
    await expect(section.getByRole('listitem').first()).toContainText('Phases of mitosis');
    await expect(section.getByRole('listitem').first()).toContainText(tp.likelihood.high);
    // The AI got timed transcripts, with the marked moment starred.
    expect(sent[0].lectures.map((l) => l.title)).toEqual(['Cell division', 'DNA replication']);
    expect(sent[0].lectures[0].text).toContain('[9:40] Remember the order of the phases');
    expect(sent[0].lectures[0].text).toContain('[22:30] ⭐ Meiosis makes four haploid cells.');

    // The evidence links to that moment of the lecture.
    await section.getByRole('button', { name: /Phases of mitosis/ }).click();
    await expect(section.getByRole('link', { name: /Cell division · 9:40/ })).toHaveAttribute('href', '/lectures/cell?t=580');

    // The plan now starts with the lecture behind the likely topic; it survives a reload.
    await page.reload();
    await expect(page.getByRole('region', { name: tp.title }).getByText('Phases of mitosis')).toBeVisible();

    // Take the mock exam: timed, three questions.
    await page.getByRole('button', { name: tp.mock }).click();
    await expect(page.getByRole('timer', { name: tp.timeLeft })).toContainText(/5:00|4:5\d/);
    for (const [prompt, right] of [['Order of mitosis?', 'PMAT'], ['Meiosis makes how many cells?', 'Four'], ['Where does DNA replicate?', 'S phase']]) {
      const shown = await page.locator('main').innerText();
      if (!shown.includes(prompt)) continue;
      await page.getByRole('radio', { name: new RegExp(right) }).click();
      await page.getByRole('button', { name: t.quiz.check }).click();
      await page.getByRole('button', { name: new RegExp(`^(${t.quiz.next}|${t.quiz.finish})`) }).click();
    }
    await expect(page.getByRole('heading', { name: t.quiz.resultTitle })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bw.exams')!)[0].attempts)).toBe(1);
  });
}
