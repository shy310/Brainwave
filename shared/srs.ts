// Spaced repetition for flashcards (a Leitner system). Each card sits in a
// box; knowing it moves it up a box and shows it again after a longer gap,
// forgetting it sends it back to the start. Pure functions, shared by the app
// and tests.

export type Rating = 'again' | 'good' | 'easy';

export interface CardState {
  /** Stable id: lecture id + a hash of the card's front. */
  key: string;
  lectureId: string;
  /** 0 = learning, up to MAX_BOX. */
  box: number;
  /** When the card is next due (ms since epoch). */
  due: number;
  reviews: number;
  lapses: number;
  /** Last review (ms since epoch). */
  last: number;
  /** First review (ms since epoch): new cards started today count against the daily limit. */
  first: number;
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Days until the next review, by box. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60, 120] as const;
export const MAX_BOX = INTERVAL_DAYS.length - 1;
/** A card you got wrong comes back in the same session. */
export const RELEARN_MS = 10 * MIN;
/** New cards a day, so a big set doesn't flood the review. */
export const NEW_PER_DAY = 20;

/** FNV-1a over the normalised text: the same card keeps its schedule when cards are regenerated in another order. */
export const cardKey = (lectureId: string, front: string): string => {
  let h = 0x811c9dc5;
  for (const ch of front.trim().toLocaleLowerCase().replace(/\s+/g, ' ')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${lectureId}:${h.toString(36)}`;
};

/** The box a rating moves a card to. */
const nextBox = (box: number, rating: Rating) =>
  rating === 'again' ? 0 : Math.min(MAX_BOX, box + (rating === 'easy' ? 2 : 1));

/** Apply a rating. `prev` is undefined for a card never seen before. */
export const review = (prev: CardState | undefined, rating: Rating, now: number, key: string, lectureId: string): CardState => {
  const box = nextBox(prev?.box ?? 0, rating);
  return {
    key, lectureId, box,
    due: rating === 'again' ? now + RELEARN_MS : now + INTERVAL_DAYS[Math.max(1, box)] * DAY,
    reviews: (prev?.reviews ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (rating === 'again' && prev ? 1 : 0),
    last: now,
    first: prev?.first ?? now,
  };
};

/** What a rating would do, for the button labels ("Good · 3 days"). */
export const preview = (prev: CardState | undefined, rating: Rating): { minutes?: number; days?: number } => {
  if (rating === 'again') return { minutes: RELEARN_MS / MIN };
  return { days: INTERVAL_DAYS[Math.max(1, nextBox(prev?.box ?? 0, rating))] };
};

const startOfDay = (now: number) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * Today's queue: cards that are due (most overdue first), then new cards up to
 * the daily limit (minus new cards already started today).
 */
export const buildQueue = <C extends { key: string }>(cards: C[], states: Map<string, CardState>, now: number, newPerDay = NEW_PER_DAY): C[] => {
  const today = startOfDay(now);
  const due = cards.filter((c) => { const s = states.get(c.key); return s && s.due <= now; })
    .sort((a, b) => states.get(a.key)!.due - states.get(b.key)!.due);
  const startedToday = [...states.values()].filter((s) => s.first >= today).length;
  const fresh = cards.filter((c) => !states.has(c.key)).slice(0, Math.max(0, newPerDay - startedToday));
  return [...due, ...fresh];
};

/** How many cards are waiting right now (due + new allowed today). */
export const dueCount = (cards: { key: string }[], states: Map<string, CardState>, now: number) => buildQueue(cards, states, now).length;

/** Where a card stands, from its review box: new (never reviewed), still learning, almost done, mastered (2+ weeks apart). */
export type MasteryLevel = 'new' | 'learning' | 'almost' | 'mastered';
export const MASTERY_LEVELS: MasteryLevel[] = ['new', 'learning', 'almost', 'mastered'];
export const masteryLevel = (s: CardState | undefined): MasteryLevel =>
  !s ? 'new' : s.box <= 1 ? 'learning' : s.box <= 3 ? 'almost' : 'mastered';
export const masteryCounts = (states: (CardState | undefined)[]): Record<MasteryLevel, number> => {
  const out: Record<MasteryLevel, number> = { new: 0, learning: 0, almost: 0, mastered: 0 };
  for (const s of states) out[masteryLevel(s)]++;
  return out;
};
