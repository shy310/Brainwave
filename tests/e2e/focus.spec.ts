import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tf = t.focus;

  test(`focus mode: hides navigation, counts down, chimes into a break, and counts the minutes (${lang})`, async ({ page }) => {
    await page.clock.install();
    await onboard(page, { hebrew: lang === 'he' });
    const nav = page.getByRole('navigation', { name: 'Main' });

    await page.getByRole('button', { name: new RegExp(tf.title + '|' + tf.button) }).first().click();
    await page.getByRole('dialog', { name: tf.title }).getByRole('button', { name: tf.minutes(25) }).click();
    const bar = page.getByRole('region', { name: tf.title });
    await expect(bar.getByText(tf.focusing)).toBeVisible();
    await expect(bar.getByRole('timer')).toHaveText('25:00');
    await expect(nav.first()).toBeHidden();

    // Pause stops the clock; it survives a reload.
    await page.clock.runFor(60_000);
    await bar.getByRole('button', { name: tf.pause }).click();
    await page.clock.runFor(5 * 60_000);
    await page.reload();
    await expect(bar.getByText(tf.paused)).toBeVisible();
    await expect(bar.getByRole('timer')).toHaveText('24:00');
    await bar.getByRole('button', { name: tf.resume }).click();

    await page.clock.runFor(24 * 60_000 + 2000);
    await expect(bar.getByText(tf.doneTitle)).toBeVisible();
    const minutes = await page.evaluate(() => JSON.parse(localStorage.getItem('bw.studyDays') ?? '[]').reduce((n: number, d: { minutes: number }) => n + d.minutes, 0));
    // 25 focused minutes, plus the regular study timer's 2 minutes of activity after pressing Pause (never counted twice).
    expect(minutes).toBe(27);

    await bar.getByRole('button', { name: tf.startBreak }).click();
    await expect(bar.getByText(tf.onBreak)).toBeVisible();
    await expect(nav.first()).toBeVisible(); // breaks are free time
    await page.clock.runFor(5 * 60_000 + 2000);
    await expect(bar.getByText(tf.breakOver)).toBeVisible();
    await bar.getByRole('button', { name: tf.finish }).click();
    await expect(bar).toHaveCount(0);
  });
}
