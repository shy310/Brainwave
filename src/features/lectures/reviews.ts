import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { cardKey, dueCount, review, type CardState, type Rating } from '@shared/srs';
import type { StudyLecture } from './repo';
import { track } from '@/features/stats/activity';

const DEMO_KEY = 'bw.cardReviews';
const readDemo = (): Record<string, CardState> => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '{}') as Record<string, CardState>; } catch { return {}; }
};

interface Row { card_key: string; lecture_id: string; box: number; due_at: string; reviews: number; lapses: number; last_at: string; first_at: string }
const fromRow = (r: Row): CardState => ({
  key: r.card_key, lectureId: r.lecture_id, box: r.box, due: Date.parse(r.due_at), reviews: r.reviews, lapses: r.lapses,
  last: Date.parse(r.last_at), first: Date.parse(r.first_at),
});
const toRow = (s: CardState) => ({
  card_key: s.key, lecture_id: s.lectureId, box: s.box, due_at: new Date(s.due).toISOString(), reviews: s.reviews,
  lapses: s.lapses, last_at: new Date(s.last).toISOString(), first_at: new Date(s.first).toISOString(),
});

/** Flashcard review schedules. In Supabase, or this browser in demo mode. */
export const reviewRepo = {
  async list(): Promise<Map<string, CardState>> {
    if (!supabase) return new Map(Object.entries(readDemo()));
    const { data, error } = await supabase.from('card_reviews').select('card_key, lecture_id, box, due_at, reviews, lapses, last_at, first_at');
    if (error) {
      console.warn('Card reviews unavailable (migration 0010 not run?)', error.message);
      return new Map();
    }
    return new Map((data as Row[]).map((r) => [r.card_key, fromRow(r)]));
  },

  async save(s: CardState) {
    if (!supabase) { storage.set(DEMO_KEY, JSON.stringify({ ...readDemo(), [s.key]: s })); return; }
    const { error } = await supabase.from('card_reviews').upsert(toRow(s));
    if (error) console.warn('Could not save the card review', error.message);
  },
};

/** A flashcard with what's needed to schedule it. */
export interface ReviewCard { key: string; lectureId: string; lectureTitle: string; front: string; back: string }

/** Every flashcard of these lectures, de-duplicated by key. */
export const reviewCards = (lectures: StudyLecture[], title: (l: StudyLecture) => string): ReviewCard[] => {
  const seen = new Set<string>();
  const out: ReviewCard[] = [];
  for (const l of lectures) {
    for (const c of l.flashcards?.cards ?? []) {
      const key = cardKey(l.id, c.front);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, lectureId: l.id, lectureTitle: title(l), front: c.front, back: c.back });
    }
  }
  return out;
};

/** Record a rating now and return the new state. */
export const rate = async (states: Map<string, CardState>, card: { key: string; lectureId: string }, rating: Rating) => {
  const next = review(states.get(card.key), rating, Date.now(), card.key, card.lectureId);
  states.set(card.key, next);
  track({ cards: 1 });
  await reviewRepo.save(next);
  return next;
};

/** How many flashcards are due for review now, across all lectures (0 while loading or on error). */
export const useDueCount = () => {
  const [due, setDue] = useState(0);
  useEffect(() => {
    let alive = true;
    void import('./repo').then(({ lectureRepo }) => Promise.all([lectureRepo.studyMaterial('all'), reviewRepo.list()]))
      .then(([lectures, states]) => { if (alive) setDue(dueCount(reviewCards(lectures, (l) => l.title), states, Date.now())); })
      .catch(() => { if (alive) setDue(0); });
    return () => { alive = false; };
  }, []);
  return due;
};
