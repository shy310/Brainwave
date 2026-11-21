import { test, expect, onboard, answerKeepRecording } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const pad = (n: number) => String(n).padStart(2, '0');

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const ts = t.schedule;

  test(`class schedule: reminder, "up next" and recording straight into the class folder (${lang})`, async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await page.addInitScript(() => {
      const shown: string[] = [];
      (window as unknown as { shown: string[] }).shown = shown;
      class FakeNotification { static permission = 'granted'; static requestPermission = async () => 'granted'; onclick: (() => void) | null = null;
        constructor(title: string) { shown.push(title); } close() {} }
      (window as unknown as { Notification: unknown }).Notification = FakeNotification;
    });
    const now = new Date(2026, 10, 20, 9, 40); // Friday 09:40
    await page.clock.install({ time: now });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate(() => localStorage.setItem('bw.lectureFolders', JSON.stringify([{ id: 'calc', name: 'Calculus', position: 0, created_at: '1' }])));

    await page.goto('/lectures');
    await page.getByRole('link', { name: ts.open }).click();
    await expect(page.getByText(ts.empty)).toBeVisible();
    await page.getByRole('button', { name: ts.add }).click();
    await page.getByLabel(ts.name).fill('Calculus 1');
    await page.getByLabel(ts.day).selectOption(String(now.getDay()));
    await page.getByLabel(ts.starts).fill(`${pad(now.getHours())}:55`);
    await page.getByLabel(ts.ends).fill(`${pad(now.getHours())}:30`);
    await page.getByRole('button', { name: ts.save }).click();
    await expect(page.getByText(ts.endBeforeStart)).toBeVisible();
    await page.getByLabel(ts.ends).fill(`${pad(now.getHours() + 1)}:30`);
    await page.getByLabel(ts.folder).selectOption('calc');
    await page.getByLabel(ts.remind).selectOption('10');
    await page.getByRole('button', { name: ts.save }).click();
    await expect(page.getByText('Calculus 1')).toBeVisible();
    await expect(page.getByText(ts.remindOption(10))).toBeVisible();

    // Five minutes later the reminder fires (10 minutes before 09:55).
    await page.goto('/');
    await expect(page.getByText(ts.soon('Calculus 1', '09:55'))).toBeVisible();
    await page.clock.runFor(6 * 60_000);
    await expect.poll(() => page.evaluate(() => (window as unknown as { shown: string[] }).shown)).toEqual([ts.reminderTitle('Calculus 1')]);

    // "Record it" names the lecture and files it in the class folder.
    await page.getByRole('link', { name: ts.record, exact: true }).click();
    await expect(page.getByLabel(t.lectures.titleLabel)).toHaveValue(/^Calculus 1 — /);
    await page.clock.resume();
    await page.route('**/api/ai/*', (r) => r.fulfill({ json: { data: { text: 'The derivative is a rate of change.' } } }));
    await page.evaluate(() => localStorage.setItem('bw.test.pieces', JSON.stringify({ min: 1, target: 1.5, max: 2, checkpoint: 0.5 })));
    await page.getByRole('button', { name: t.lectures.start }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: t.lectures.stop }).click();
      await answerKeepRecording(page, t.lectures.keepRecording, false);
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bw.lectures') ?? '[]')[0]);
    expect(saved).toMatchObject({ folder_id: 'calc', title: expect.stringMatching(/^Calculus 1 — /) });

    // Edit and delete.
    await page.goto('/lectures/schedule');
    await page.getByRole('button', { name: `${ts.edit}: Calculus 1` }).click();
    await page.getByLabel(ts.name).fill('Calculus I');
    await page.getByRole('button', { name: ts.save }).click();
    await expect(page.getByText('Calculus I', { exact: true })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: `${ts.remove}: Calculus I` }).click();
    await expect(page.getByText(ts.empty)).toBeVisible();
  });
}
