import { test, expect, onboard, hasHorizontalOverflow } from './fixtures';

// A file name used as a title has no spaces to wrap at. On a 320px phone it must never push the page sideways.
const LONG = 'Thermodynamics_and_Statistical_Mechanics_Lecture_Number_Seventeen_final_v2.m4a';
const NOTES = { title: LONG, summary: LONG, sections: [{ heading: LONG, points: [LONG] }], keyTerms: [{ term: LONG, definition: LONG }], reminders: [LONG] };
const lecture = { id: 'lec1', title: LONG, source: 'upload', language: 'auto', status: 'ready', duration_sec: 5400,
  segments: [{ start: 0, text: LONG }], slides_text: null, notes: NOTES, quiz: null, folder_id: 'f1',
  flashcards: { cards: [{ front: LONG, back: LONG }] }, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

test('long names without spaces never make a 320px screen scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await onboard(page);
  await page.evaluate(({ l, LONG }) => {
    localStorage.setItem('bw.lectures', JSON.stringify([l]));
    localStorage.setItem('bw.lectureFolders', JSON.stringify([{ id: 'f1', name: LONG, position: 0, created_at: '2026-11-01T00:00:00Z' }]));
    localStorage.setItem('bw.media', JSON.stringify([{ id: 'v1', kind: 'video', title: LONG, origin: { type: 'prompt', label: LONG }, locale: 'en',
      script: { title: LONG, scenes: [] }, created_at: '2026-11-02T00:00:00Z' }]));
  }, { l: lecture, LONG });

  await page.goto('/groups');
  await page.getByRole('button', { name: 'New group' }).click();
  await page.getByLabel('Group name').fill(LONG.slice(0, 80));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/groups\//);
  expect(await hasHorizontalOverflow(page), '/groups/:id').toBe(false);

  for (const path of ['/lectures', '/lectures/lec1', '/lectures/review', '/lectures/study?folder=f1', '/groups', '/videos']) {
    await page.goto(path);
    await expect(page.getByText(/Thermodynamics_and/).first()).toBeVisible();
    expect(await hasHorizontalOverflow(page), path).toBe(false);
  }
});
