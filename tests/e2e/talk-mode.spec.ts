import type { Page } from '@playwright/test';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const NOTES = { title: 'x', summary: 'The derivative is the slope of the tangent line.', mode: 'detailed', sections: [{ heading: 'A', points: ['b'] }], keyTerms: [], reminders: [] };
const lecture = { id: 'lec1', title: 'Derivatives', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'Today: the derivative as the slope of the tangent line.' }], slides_text: null, notes: NOTES, quiz: null, flashcards: null,
  created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

/** A pretend microphone: each time recognition starts, it "hears" the next phrase in window.__say. */
const fakeMic = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __say: string[]; __heard: number; SpeechRecognition: unknown };
  w.__say = []; w.__heard = 0;
  class FakeRecognition {
    lang = ''; interimResults = false; continuous = false;
    onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onerror: ((e: unknown) => void) | null = null;
    private timer = 0;
    start() {
      this.timer = window.setTimeout(() => {
        const words = w.__say.shift();
        if (words) { w.__heard++; this.onresult?.({ results: [Object.assign([{ transcript: words }], { isFinal: true })] }); }
        this.onend?.();
      }, 400);
    }
    stop() { clearTimeout(this.timer); this.onend?.(); }
    abort() { clearTimeout(this.timer); }
  }
  w.SpeechRecognition = FakeRecognition;
});

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tt = t.tutor.talk;

  test(`talk mode: speak, hear the answer, it listens again for a follow-up (${lang})`, async ({ page }) => {
    await fakeMic(page);
    const asked: { spoken?: boolean; lecture?: { text: string }; messages: { role: string; content: string }[] }[] = [];
    await page.route('**/api/ai/tutor', (route) => {
      asked.push(route.request().postDataJSON().input);
      const reply = asked.length === 1 ? 'A derivative is a rate of change. Want an example?' : 'Sure. Speed is the derivative of position.';
      return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: reply.split(' ').map((w) => `data: ${JSON.stringify({ text: `${w} ` })}\n\n`).join('') + 'data: [DONE]\n\n' });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/lec1');
    await page.getByRole('button', { name: t.lectures.askPanel.open, exact: true }).click();
    await page.evaluate(() => { (window as unknown as { __say: string[] }).__say.push('What is a derivative?', 'Yes please'); });
    await page.getByRole('button', { name: tt.open }).click();

    const talk = page.getByRole('dialog', { name: tt.title });
    await expect(talk).toBeVisible();
    // It listened right away, answered out loud (shown too), then listened again for the follow-up.
    await expect(talk.getByText('A derivative is a rate of change. Want an example?')).toBeVisible();
    await expect(talk.getByText('Speed is the derivative of position.')).toBeVisible({ timeout: 20_000 });
    expect(asked[0]).toMatchObject({ spoken: true, messages: [{ role: 'user', content: 'What is a derivative?' }] });
    expect(asked[0].lecture?.text).toContain('slope of the tangent line');
    expect(asked[1].messages.map((m) => m.content.trim())).toEqual(['What is a derivative?', 'A derivative is a rate of change. Want an example?', 'Yes please']);

    // Escape ends talk mode; the Ask panel is still there.
    await page.keyboard.press('Escape');
    await expect(talk).toBeHidden();
    await expect(page.getByRole('dialog', { name: t.lectures.askPanel.title })).toBeVisible();
  });
}

test('talk mode: tap to interrupt the answer and talk again', async ({ page }) => {
  await fakeMic(page);
  let calls = 0;
  await page.route('**/api/ai/tutor', (route) => {
    calls++;
    return route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: `data: ${JSON.stringify({ text: 'One long sentence that keeps going for quite a while so you can cut in. And another one after it. And a third.' })}\n\ndata: [DONE]\n\n` });
  });
  await onboard(page);
  await page.goto('/tutor');
  await page.evaluate(() => { (window as unknown as { __say: string[] }).__say.push('Explain fractions'); });
  await page.getByRole('button', { name: en.tutor.talk.open }).click();
  const talk = page.getByRole('dialog', { name: en.tutor.talk.title });
  await expect(talk.getByText(en.tutor.talk.speaking)).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __say: string[] }).__say.push('Wait, simpler please'); });
  await talk.getByRole('button', { name: en.tutor.talk.interrupt }).click();
  await expect.poll(() => calls).toBe(2);
  await talk.getByRole('button', { name: en.tutor.talk.end }).click();
  await expect(talk).toBeHidden();
});
