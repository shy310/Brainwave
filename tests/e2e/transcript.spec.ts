import { readFile } from 'node:fs/promises';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'Derivatives, week 3', summary: 'Rates of change.', sections: [{ heading: 'Definition', points: ['Slope.'] }], keyTerms: [], reminders: [] };
const TEXT = 'Today we start derivatives. The derivative of a function at a point tells us how fast it is changing. '
  + 'Geometrically it is the slope of the tangent line. Problem set three is due on Sunday.';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tt = t.lectures.transcriptTools;

  test(`search, export and edit the transcript, then update the notes (${lang})`, async ({ page }) => {
    const notesInputs: string[] = [];
    await page.route('**/api/ai/*', async (route) => {
      const op = new URL(route.request().url()).pathname.split('/').pop();
      if (op === 'lectureNotes') {
        notesInputs.push((route.request().postDataJSON() as { input: { transcript: string } }).input.transcript);
        return route.fulfill({ json: { data: NOTES } });
      }
      return route.fulfill({ status: 404, json: { error: 'no' } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.modes.document }).click();
    await page.getByRole('button', { name: t.lectures.doc.paste }).click();
    await page.getByPlaceholder(t.lectures.textPlaceholder).fill(TEXT);
    await page.getByRole('button', { name: t.lectures.create }).click();
    await expect(page.getByRole('heading', { level: 1, name: NOTES.title })).toBeVisible();
    expect(notesInputs).toHaveLength(1);

    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    const search = page.getByRole('searchbox', { name: tt.search });
    await search.fill('TANGENT');
    await expect(page.getByText(tt.matches(1))).toBeVisible();
    await expect(page.locator('mark')).toHaveText('tangent');
    await search.fill('integral');
    await expect(page.getByText(tt.noMatches)).toBeVisible();
    await page.getByRole('button', { name: tt.clear }).click();

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: t.lectures.download }).click();
    const file = await downloading;
    expect(file.suggestedFilename()).toBe(`${NOTES.title}.txt`);
    expect(await readFile((await file.path())!, 'utf8')).toBe(TEXT);

    // Fix a word that was heard wrong, then make the notes again from the edited text.
    await page.getByRole('button', { name: tt.edit }).click();
    const box = page.getByRole('textbox', { name: tt.part('0:00') });
    await box.fill(TEXT.replace('Problem set three', 'Problem set 3'));
    await page.getByRole('button', { name: tt.saveEdits }).click();
    await expect(page.getByText('Problem set 3 is due on Sunday.')).toBeVisible();
    await expect(page.getByText(tt.stale)).toBeVisible();
    await page.getByRole('button', { name: tt.updateAll }).click();
    await expect(page.getByText(tt.stale)).toBeHidden();
    expect(notesInputs).toHaveLength(2);
    expect(notesInputs[1]).toContain('Problem set 3 is due');

    // The edit was saved: it is still there after reopening.
    await page.reload();
    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    await expect(page.getByText('Problem set 3 is due on Sunday.')).toBeVisible();
  });
}
