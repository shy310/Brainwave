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
      } } });
    });
    await onboard(page, { hebrew: lang === 'he' });

    await page.goto('/settings');
    await page.getByRole('radio', { name: t.lectures.summaryModes.exam }).click();
    await expect(page.getByRole('radio', { name: t.lectures.summaryModes.exam })).toBeChecked();

    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.tabs.text }).click();
    await page.getByPlaceholder(t.lectures.textPlaceholder).fill(TEXT);
    await page.getByRole('button', { name: t.lectures.create }).click();
    await expect(page.getByText('Notes in exam style.')).toBeVisible();
    expect(modes).toEqual(['exam']);
    await expect(page.getByRole('radio', { name: t.lectures.summaryModes.exam })).toBeChecked();

    await page.getByRole('radio', { name: t.lectures.summaryModes.short }).click();
    await expect(page.getByText('Notes in short style.')).toBeVisible();
    expect(modes).toEqual(['exam', 'short']);

    // "Write again" keeps this lecture's style.
    await page.getByRole('button', { name: t.lectures.regenerate }).click();
    await expect.poll(() => modes).toEqual(['exam', 'short', 'short']);
  });
}
