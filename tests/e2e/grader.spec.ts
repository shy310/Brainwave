import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const grade = (score: number) => ({
  score, verdict: score >= 70 ? 'correct' : 'partial', feedback: `Feedback for ${score}.`,
  criteria: [{ name: 'Thesis', score: Math.round(score / 10), comment: 'A clear claim.' }, { name: 'Evidence', score: 5, comment: 'Add a source.' }],
  strengths: ['Clear structure'], improvements: ['Use a quotation'], improved: 'An improved essay.',
});

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tg = t.grader;

  test(`grade my answer: score, criteria, attempts and a saved draft (${lang})`, async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    const scores = [55, 80, 40];
    await page.route('**/api/ai/gradeAnswer', (route) => {
      sent.push((route.request().postDataJSON() as { input: Record<string, unknown> }).input);
      return route.fulfill({ json: { data: grade(scores[sent.length - 1]) } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    // Grade my answer is in Home's More menu.
    await page.getByRole('navigation', { name: t.home.quick.title }).getByRole('button', { name: t.home.more }).click();
    await page.getByRole('menuitem', { name: t.home.quick.grade }).click();
    await expect(page.getByRole('heading', { level: 1, name: tg.title })).toBeVisible();

    await page.getByLabel(tg.question).fill('Was the French Revolution inevitable? Argue your view.');
    await page.getByLabel(tg.answer).fill('Yes, because of debt.');
    await page.getByLabel(tg.rubric).fill('Thesis 50%, evidence 50%');
    // The draft survives closing the page.
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByLabel(tg.answer)).toHaveValue('Yes, because of debt.');

    await page.getByRole('button', { name: tg.grade, exact: true }).click();
    await expect(page.getByText('55/100')).toBeVisible();
    await expect(page.getByText(tg.verdicts.partial)).toBeVisible();
    await expect(page.getByText('Thesis', { exact: true })).toBeVisible();
    await expect(page.getByText('6/10')).toBeVisible();
    await expect(page.getByText('Use a quotation')).toBeVisible();
    expect(sent[0]).toMatchObject({ kind: 'essay', rubric: 'Thesis 50%, evidence 50%' });
    await page.getByRole('button', { name: tg.showImproved }).click();
    await expect(page.getByText('An improved essay.')).toBeVisible();

    // A better second attempt shows the improvement.
    await page.getByRole('button', { name: tg.tryAgain }).click();
    await page.getByLabel(tg.answer).fill('Yes: debt, bad harvests and Enlightenment ideas made change hard to stop.');
    await page.getByRole('button', { name: tg.grade, exact: true }).click();
    await expect(page.getByText(tg.verdicts.correct)).toBeVisible();
    await expect(page.getByText(tg.attempts)).toBeVisible();
    await expect(page.getByText(tg.better(25))).toBeVisible();

    // A new question; the old one is in the list and can be reopened.
    await page.getByRole('button', { name: tg.newTask }).click();
    await page.getByLabel(tg.question).fill('Explain photosynthesis.');
    await page.getByLabel(tg.answer).fill('Plants make sugar from light.');
    await page.getByRole('button', { name: tg.grade, exact: true }).click();
    await expect(page.getByText(tg.pastTasks)).toBeVisible();
    await page.getByRole('button', { name: tg.reopen }).click();
    await expect(page.getByLabel(tg.question)).toHaveValue('Was the French Revolution inevitable? Argue your view.');
    await expect(page.getByText(tg.better(25))).toBeVisible();
  });
}
