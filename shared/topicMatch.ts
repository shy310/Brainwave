// Which Learn topics a lecture is about. A cheap word-overlap shortlist is
// made here (English, Hebrew, Arabic and Russian); the notes model then picks the topics the
// lecture really covers from that shortlist.

import { COURSES, findTopic } from './curriculum.js';
import { LOCALES } from './locales.js';

const STOP = new Set(('the and for are but not you all any can her was one our out has have this that with from they will what when which their there about into than then them these those your more some such also only very just over most other '
  + 'של את על עם זה זו גם או אם כי לא כל יש אין הוא היא הם הן אנחנו אתם מה איך למה כמו בין אחרי לפני עוד רק כבר מאוד '
  + 'التي الذي هذا هذه ذلك تلك على إلى من في عن مع كان كانت لكن أيضا كيف لماذا ماذا بين بعد قبل '
  + 'это как что для или так все его она они при уже ещё еще есть был была были чтобы если когда только').split(' '));

/** Words of 3+ letters, lowercased; Hebrew one-letter prefixes (ה, ו, ב, ל, מ, ש, כ) are also tried without them. */
export const words = (text: string): string[] => {
  const out: string[] = [];
  for (const raw of text.toLocaleLowerCase().normalize('NFKC').replace(/[֑-ׇ]/g, '').split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    out.push(raw);
    if (/^[הובלמשכ][א-ת]{3,}$/.test(raw)) out.push(raw.slice(1));
    if (/^[a-z]{5,}s$/.test(raw)) out.push(raw.slice(0, -1)); // derivatives → derivative
    // Arabic "the" (ال), also after "and" (وال): الخلية → خلية.
    const al = raw.match(/^و?ال([؀-ۿ]{3,})$/);
    if (al) out.push(al[1]);
    // Russian endings change a lot (клетка, клетки, клеток): long words also match on their first letters.
    if (/^[а-яё]{6,}$/.test(raw)) out.push(`${raw.slice(0, 5)}…`);
  }
  return out;
};

interface Indexed { id: string; title: string[]; body: Set<string> }
let index: Indexed[] | null = null;
const topicsIndex = () => {
  index ??= COURSES.flatMap((c) => c.units.flatMap((u) => u.topics.map((t) => ({
    id: t.id,
    title: [...new Set(LOCALES.flatMap((l) => words(t.title[l])))],
    body: new Set(LOCALES.flatMap((l) => [...words(t.title[l]), ...words(t.description[l]), ...words(u.title[l])])),
  }))));
  return index;
};

/** Up to `limit` topic ids whose words appear in the text, best first (title words count most). */
export const candidateTopics = (text: string, limit = 30): string[] => {
  const counts = new Map<string, number>();
  for (const w of words(text)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const scored = topicsIndex().map((t) => {
    let score = 0;
    for (const w of t.body) if (counts.has(w)) score += Math.min(3, counts.get(w)!);
    for (const w of t.title) if (counts.has(w)) score += 4;
    return { id: t.id, score };
  }).filter((x) => x.score >= 4).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.id);
};

/** Keep only real topic ids, without repeats, at most 4. */
export const cleanTopicIds = (ids: string[] | undefined): string[] =>
  [...new Set((ids ?? []).filter((id) => findTopic(id)))].slice(0, 4);
