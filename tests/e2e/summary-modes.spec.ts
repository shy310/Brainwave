import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const TEXT = 'Today we start derivatives. The derivative of a function at a point tells us how fast it is changing. '
  + 'Geometrically it is the slope of the tangent line. Problem set three is due on Sunday.';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`notes follow the student's chosen style, and can be rewritten in another (${lang})`, async ({ page }) => {
    const modes: string[] = [];
    await page.route('**/api/ai/*', async (route) => {
      const body = route.request().postDataJSON() as { input: { mode?: string } };
      modes.push(body.input.mode ?? '');
      const mode = body.input.mode;
      return route.fulfill({ json: { data: {
        title: 'Derivatives', summary: `Notes in ${mode} style.`, sections: [{ heading: 'Main idea', points: ['Slope of the tangent.'] }],
        keyTerms: [], reminders: [], mode,
        ...(mode === 'exam' ? {
          practice: [{ question: 'What is the derivative of $x^2$?', answer: 'It is $2x$.' }],
          mistakes: ['Mixing up the slope of the secant and of the tangent.'],
        } : {}),
      } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    // A new style is chosen in the Customize sheet and applied with Apply.
    const pickStyle = async (name: string) => {
      await page.getByRole('toolbar').getByRole('button', { name: t.lectures.options.customize }).click();
      const sheet = page.getByRole('dialog', { name: t.lectures.options.customizeTitle });
      await sheet.getByRole('radio', { name: new RegExp(`^${name}`) }).click();
      await sheet.getByRole('button', { name: t.lectures.options.apply }).click();
      await expect(sheet).toBeHidden();
    };

    await page.goto('/settings');
    await page.getByRole('button', { name: t.lectures.notesStyle }).click();
    await page.getByRole('radio', { name: t.lectures.summaryModes.exam }).click();
    await expect(page.getByRole('radio', { name: t.lectures.summaryModes.exam })).toBeChecked();

    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.tabs.text }).click();
    await page.getByPlaceholder(t.lectures.textPlaceholder).fill(TEXT);
    await page.getByRole('button', { name: t.lectures.create }).click();
    await expect(page.getByText('Notes in exam style.')).toBeVisible();
    expect(modes).toEqual(['exam']);
    await expect(page.getByRole('button', { name: `${t.lectures.options.customize}: ${t.lectures.summaryModes.exam}` })).toBeVisible();

    // Exam prep has its own parts: practice questions (answer hidden until asked) and common mistakes.
    await expect(page.getByRole('heading', { name: t.lectures.practice })).toBeVisible();
    await expect(page.getByText('Mixing up the slope of the secant and of the tangent.')).toBeVisible();
    await expect(page.getByText('It is')).toBeHidden();
    await page.getByRole('button', { name: t.lectures.showAnswer }).click();
    await expect(page.getByText('It is')).toBeVisible();
    await expect(page.getByRole('button', { name: t.lectures.hideAnswer })).toHaveAttribute('aria-expanded', 'true');

    await pickStyle(t.lectures.summaryModes.short);
    await expect(page.getByText('Notes in short style.')).toBeVisible();
    await expect(page.getByRole('heading', { name: t.lectures.practice })).toHaveCount(0);
    expect(modes).toEqual(['exam', 'short']);

    // "Write again" keeps this lecture's style.
    await page.getByRole('toolbar').getByRole('button', { name: t.lectures.options.title }).click();
    await page.getByRole('dialog', { name: t.lectures.options.title }).getByRole('button', { name: t.lectures.regenerate }).click();
    await expect.poll(() => modes).toEqual(['exam', 'short', 'short']);
    await expect(page.getByText('Notes in short style.')).toBeVisible();

    // Going back to a style already written shows it again, without asking the AI.
    await pickStyle(t.lectures.summaryModes.exam);
    await expect(page.getByText('Notes in exam style.')).toBeVisible();
    await expect(page.getByRole('heading', { name: t.lectures.practice })).toBeVisible();
    await pickStyle(t.lectures.summaryModes.short);
    await expect(page.getByText('Notes in short style.')).toBeVisible();
    // ...and they are still there after a reload.
    await page.reload();
    await pickStyle(t.lectures.summaryModes.exam);
    await expect(page.getByText('Notes in exam style.')).toBeVisible();
    expect(modes).toEqual(['exam', 'short', 'short']);

    // A style not written yet still asks the AI.
    await pickStyle(t.lectures.summaryModes.detailed);
    await expect(page.getByText('Notes in detailed style.')).toBeVisible();
    expect(modes).toEqual(['exam', 'short', 'short', 'detailed']);
  });
}
