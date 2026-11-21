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
    await page.getByRole('link', { name: t.home.quick.groups, exact: true }).click();
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

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const ts = t.lectures.shareGroup;

  test(`share a lecture with a group from the lecture itself, without other note styles (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    // Notes saved in another style stay private.
    const withStyles = { ...lecture, notes: { ...NOTES, mode: 'detailed', other: { short: { ...NOTES, summary: 'Private short notes.', mode: 'short' } } } };
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), withStyles);

    // Not in a group yet: the panel offers to make one.
    await page.goto('/lectures/lec1');
    await page.getByRole('button', { name: t.lectures.share.share, exact: true }).click();
    await page.getByRole('menuitem', { name: ts.button }).click();
    await expect(page.getByText(ts.none)).toBeVisible();
    await page.getByRole('link', { name: ts.create }).click();
    await page.getByRole('button', { name: t.groups.create }).click();
    await page.getByLabel(t.groups.name).fill('Calculus');
    await page.getByRole('button', { name: t.groups.make }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Calculus' })).toBeVisible();

    await page.goto('/lectures/lec1');
    await page.getByRole('button', { name: t.lectures.share.share, exact: true }).click();
    await page.getByRole('menuitem', { name: ts.button }).click();
    await expect(page.getByLabel(ts.pick)).toHaveValue(/.+/); // the only group is picked
    await page.getByRole('button', { name: ts.share }).click();
    await expect(page.getByText(ts.done('Calculus'))).toBeVisible();
    await page.getByRole('link', { name: ts.open }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Calculus' })).toBeVisible();
    await expect(page.getByText('Derivatives', { exact: true })).toBeVisible();
    const shared = await page.evaluate(() => JSON.parse(localStorage.getItem('bw.groups') ?? '{}').shares[0]);
    expect(shared.notes.summary).toBe(NOTES.summary);
    expect(shared.notes).not.toHaveProperty('other');
    expect(JSON.stringify(shared)).not.toContain('Secret transcript text.');
  });
}

test('the Lectures page has the study tools: review, Summit, study groups and the class schedule', async ({ page }) => {
  await onboard(page);
  await page.goto('/lectures');
  const tools = page.getByRole('region', { name: en.lectures.tools.title });
  for (const [name, path] of [[en.lectures.tools.review, '/lectures/review'], [en.lectures.tools.summit, '/play'], [en.lectures.tools.groups, '/groups'], [en.lectures.tools.schedule, '/lectures/schedule']]) {
    await expect(tools.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', path);
  }
  await tools.getByRole('link', { name: new RegExp(en.lectures.tools.summit) }).click();
  await expect(page.getByRole('heading', { level: 1, name: en.game.name })).toBeVisible();
});
