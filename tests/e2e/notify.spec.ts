import type { Page } from '@playwright/test';
import { test, expect, onboard, wavFile } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

/** Record notifications instead of showing them, and let the test hide the page. */
const fakeNotifications = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { shown: string[]; hidden: boolean; Notification: unknown };
  w.shown = []; w.hidden = false;
  class FakeNotification { static permission = 'granted'; static requestPermission = async () => 'granted'; onclick: (() => void) | null = null;
    constructor(title: string) { w.shown.push(title); } close() {} }
  w.Notification = FakeNotification;
  Object.defineProperty(document, 'visibilityState', { get: () => (w.hidden ? 'hidden' : 'visible') });
});
const shown = (page: Page) => page.evaluate(() => (window as unknown as { shown: string[] }).shown);
/** Jump ahead hour by hour (fires each due timer once; much faster than running every tick). */
const hoursLater = async (page: Page, hours: number) => { for (let i = 0; i < hours; i++) await page.clock.fastForward('01:00:00'); };
const hide = (page: Page, hidden: boolean) => page.evaluate((h) => { (window as unknown as { hidden: boolean }).hidden = h; }, hidden);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tn = t.notify;

  test(`daily study reminder, skipped once you've studied (${lang})`, async ({ page }) => {
    await fakeNotifications(page);
    await page.clock.install({ time: new Date(2026, 10, 20, 18, 50) });
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/settings');
    await page.getByLabel(tn.time).fill('19:00');
    await page.getByRole('button', { name: tn.turnOn }).click();
    await expect(page.getByText(tn.on('19:00'))).toBeVisible();
    // A demo account has no push: reminders show while the site is open.
    await expect(page.getByText(t.schedule.webNote)).toBeVisible();
    await page.clock.runFor(11 * 60_000);
    await expect.poll(() => shown(page)).toEqual([tn.studyTitle]);

    // Next day, after studying: no reminder.
    await page.evaluate(() => localStorage.setItem('bw.studyDays', JSON.stringify([{ day: '2026-11-21', minutes: 30, cards: 0, quizzes: 0, lectures: 0 }])));
    await page.reload();
    await hoursLater(page, 24);
    expect(await shown(page)).toEqual([]);

    // Control: the day after, without studying, it fires again.
    await hoursLater(page, 24);
    await expect.poll(() => shown(page)).toEqual([tn.studyTitle]);
  });

  test(`"ready" notifications only when you're away (${lang})`, async ({ page }) => {
    await fakeNotifications(page);
    await page.route('**/api/ai/*', (r) => {
      const op = new URL(r.request().url()).pathname.split('/').pop();
      if (op === 'transcribe') return r.fulfill({ json: { data: { text: 'The derivative is a rate of change.' } } });
      return r.fulfill({ json: { data: { title: 'Derivatives', summary: 'S', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] } } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.tabs.upload }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: t.lectures.chooseFile }).click();
    await (await chooser).setFiles(wavFile(5));
    await hide(page, true); // the student switches to another tab
    await page.getByRole('button', { name: t.lectures.transcribeFile, exact: true }).click();
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    await expect.poll(() => shown(page)).toEqual([tn.lectureReady, tn.notesReady]);

    // In front of the page: no notification.
    await hide(page, false);
    await page.getByRole('button', { name: t.lectures.actions.more }).click();
    await page.getByRole('menuitem', { name: t.lectures.regenerate }).click();
    await page.waitForTimeout(500);
    expect(await shown(page)).toHaveLength(2);
  });
}
