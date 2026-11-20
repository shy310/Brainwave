import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const TOPIC = { id: 'sci-h-t3', en: 'Photosynthesis & Cellular Respiration', he: 'פוטוסינתזה ונשימה תאית' };
const NOTES = { title: 'Photosynthesis', summary: 'How plants make sugar from light.', sections: [{ heading: 'H', points: ['Chloroplasts capture light.'] }],
  keyTerms: [], reminders: [], mode: 'detailed', topics: [TOPIC.id, 'no-such-topic'] };
const lecture = { id: 'bio', title: 'Photosynthesis', source: 'text', language: 'auto', status: 'ready', duration_sec: 0,
  segments: [{ start: 0, text: 'Plants use light to make glucose.' }], slides_text: null, notes: NOTES, quiz: null, flashcards: null,
  created_at: '2026-11-03T10:00:00.000Z', updated_at: '' };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`lecture notes link to the related Learn topic (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.evaluate((l) => localStorage.setItem('bw.lectures', JSON.stringify([l])), lecture);
    await page.goto('/lectures/bio');
    const related = page.getByRole('navigation', { name: t.lectures.relatedTopics });
    await expect(related.getByRole('link')).toHaveCount(1); // the made-up id is ignored
    await related.getByRole('link', { name: TOPIC[lang] }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/topic/${TOPIC.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: TOPIC[lang] })).toBeVisible();
  });
}
