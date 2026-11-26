import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const day = (page: Page, offset: number) => page.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, offset);
const SYLLABUS = 'BIOL 101 — Cell Biology. Lectures Mondays 10:00–11:30. Midterm on the date below. Problem set 1 due soon. '.repeat(3);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tc = t.calendar;

  test(`import a syllabus into the calendar, see a day, tick off a deadline (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    const inThree = await day(page, 3), inTen = await day(page, 10);
    const weekday = await page.evaluate((d) => new Date(`${d}T12:00:00`).getDay(), inThree);
    let sent: { text: string; today: string } | null = null;
    await page.route('**/api/ai/syllabus', async (route) => {
      sent = route.request().postDataJSON().input;
      await route.fulfill({ json: { data: {
        course: 'BIOL 101',
        meetings: [{ weekday, starts: '10:00', ends: '11:30', label: 'Lecture' }],
        exams: [{ title: 'Midterm', date: inTen }],
        deadlines: [{ title: 'Problem set 1', date: inThree, kind: 'assignment' }, { title: 'Lab report', date: inTen, kind: 'assignment' }],
      } } });
    });

    await page.goto('/lectures');
    await page.getByRole('region', { name: t.lectures.tools.title }).getByRole('link', { name: new RegExp(t.lectures.tools.calendar) }).click();
    await expect(page.getByRole('heading', { level: 1, name: tc.title })).toBeVisible();
    await expect(page.getByText(tc.empty)).toBeVisible();

    // Import: paste, review (untick the lab report), add.
    await page.getByRole('button', { name: tc.syllabus.open }).click();
    const sheet = page.getByRole('dialog', { name: tc.syllabus.title });
    await sheet.getByRole('button', { name: t.lectures.doc.paste }).click();
    await sheet.getByRole('textbox').fill(SYLLABUS);
    await sheet.getByRole('button', { name: tc.syllabus.read }).click();
    await expect(sheet.getByText(tc.syllabus.review)).toBeVisible();
    expect(sent!.text).toContain('BIOL 101');
    expect(sent!.today).toBe(await day(page, 0));
    await sheet.getByRole('checkbox', { name: /Lab report/ }).uncheck();
    await sheet.getByRole('button', { name: tc.syllabus.add(3) }).click();
    await expect(sheet).toBeHidden();

    // Saved: a weekly class with a reminder, an exam, one deadline.
    const stored = await page.evaluate(() => ({
      classes: JSON.parse(localStorage.getItem('bw.classSlots') ?? '[]'),
      exams: JSON.parse(localStorage.getItem('bw.exams') ?? '[]'),
      deadlines: JSON.parse(localStorage.getItem('bw.deadlines') ?? '[]'),
    }));
    expect(stored.classes).toEqual([expect.objectContaining({ name: 'BIOL 101 · Lecture', weekday, starts: '10:00', ends: '11:30', remindMinutes: 15 })]);
    expect(stored.exams).toEqual([expect.objectContaining({ title: 'BIOL 101 — Midterm', date: inTen })]);
    expect(stored.deadlines).toEqual([expect.objectContaining({ title: 'Problem set 1', date: inThree, kind: 'assignment', course: 'BIOL 101', done: false })]);

    // The calendar jumped to the first date: the class and the deadline are on it.
    await expect(page.getByText('BIOL 101 · Lecture')).toBeVisible();
    await page.getByRole('checkbox', { name: tc.done('Problem set 1') }).check();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bw.deadlines')!)[0].done)).toBe(true);

    // The exam day shows the exam, linking to it.
    await page.getByRole('gridcell', { name: new RegExp(tc.kinds.exam) }).first().click();
    await expect(page.getByRole('link', { name: 'BIOL 101 — Midterm' })).toBeVisible();
  });
}

test('add a deadline by hand', async ({ page }) => {
  await onboard(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: en.calendar.addDeadline }).click();
  const sheet = page.getByRole('dialog', { name: en.calendar.addDeadline });
  await sheet.getByRole('textbox', { name: en.calendar.what }).fill('Essay draft');
  await sheet.getByRole('combobox', { name: en.calendar.kind }).selectOption('project');
  await sheet.getByRole('button', { name: en.calendar.save }).click();
  await expect(page.getByText('Essay draft')).toBeVisible();
  await expect(page.getByRole('region').getByText(en.calendar.kindsOf.project, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.calendar.remove('Essay draft') }).click();
  await expect(page.getByText('Essay draft')).toBeHidden();
});
