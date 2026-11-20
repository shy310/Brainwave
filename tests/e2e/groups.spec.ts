import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'Shared summary about derivatives.', sections: [{ heading: 'H', points: ['A shared point.'] }], keyTerms: [], reminders: [] };
const QUIZ = { questions: [{ kind: 'choice', prompt: 'Shared question?', options: ['Yes', 'No'], correctIndex: 0, answer: 'Yes', accepted: [], check: '', hint: '', explanation: 'Because.' }] };
const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'Secret transcript text.' }], slides_text: null, notes: NOTES, quiz: QUIZ,
  flashcards: { cards: [{ front: 'Shared card?', back: 'Shared answer.' }] }, created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tg = t.groups;

  test(`study groups: create, invite, share a lecture, open it, remove it (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/');
    await page.getByRole('link', { name: new RegExp(tg.title) }).click();
    await expect(page.getByText(tg.empty)).toBeVisible();
    await page.getByRole('button', { name: tg.create }).click();
    await page.getByRole('textbox', { name: tg.name }).fill('Calculus study group');
    await page.getByRole('button', { name: tg.make }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Calculus study group' })).toBeVisible();
    await expect(page.getByText(tg.members(1)).first()).toBeVisible();
    const link = await page.getByRole('textbox', { name: tg.invite }).inputValue();
    expect(link).toMatch(/\/join\/[a-f0-9]{24}$/);

    // Share a lecture: the group gets notes, flashcards and quiz — never the transcript.
    await page.getByRole('button', { name: tg.shareLecture }).click();
    await page.getByRole('combobox', { name: tg.pickLecture }).selectOption('lec1');
    await page.getByRole('button', { name: tg.shareIt, exact: true }).click();
    await expect(page.getByText('Derivatives')).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('bw.groups') ?? '');
    expect(stored).toContain('Shared summary');
    expect(stored).not.toContain('Secret transcript');

    await page.getByRole('link', { name: tg.open }).click();
    await expect(page.getByText('A shared point.')).toBeVisible();
    await page.getByRole('radio', { name: tg.tabs.cards }).click();
    await expect(page.getByText('Shared card?')).toBeVisible();
    await page.getByRole('radio', { name: tg.tabs.quiz }).click();
    await expect(page.getByText('Shared question?')).toBeVisible();
    await page.goBack();

    await page.getByRole('button', { name: `${tg.removeShare}: Derivatives` }).click();
    await expect(page.getByText(tg.noShares)).toBeVisible();

    // A new invite link replaces the old one.
    await page.getByRole('button', { name: tg.newLink }).click();
    await expect(page.getByText(tg.newLinkDone)).toBeVisible();
    await expect(page.getByRole('textbox', { name: tg.invite })).not.toHaveValue(link);
    await page.goto(new URL(link).pathname);
    await expect(page.getByText(tg.badInvite)).toBeVisible();

    await page.goBack();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: tg.deleteGroup }).click();
    await expect(page.getByText(tg.empty)).toBeVisible();
  });

  test(`an invite link survives signing in and onboarding (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/groups');
    await page.getByRole('button', { name: tg.create }).click();
    await page.getByRole('textbox', { name: tg.name }).fill('Physics');
    await page.getByRole('button', { name: tg.make }).click();
    const path = new URL(await page.getByRole('textbox', { name: tg.invite }).inputValue()).pathname;
    // Sign out (keep the demo groups), then open the invite link.
    await page.evaluate(() => { localStorage.removeItem('bw.demoUser'); localStorage.removeItem('bw.demoProfile'); });
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin$/);
    await page.getByRole('button', { name: /Try BrainWave|נסו את BrainWave/ }).click();
    await page.getByRole('textbox').fill('Dana');
    await page.getByRole('button', { name: t.onboarding.finish }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { name: tg.joinTitle('Physics') })).toBeVisible();
    await page.getByRole('button', { name: tg.joinButton }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Physics' })).toBeVisible();
  });
}
