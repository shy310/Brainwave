// Questions and the shared rules of the arcade games (Glide and Lane Rush):
// lives, shield, score and the question checkpoints. Pure and tested; the
// pages only draw them.

import type { StudyLecture } from '@/features/lectures/repo';
import { cardKey } from '@shared/srs';

export interface GameQuestion {
  prompt: string;
  options: string[];
  correct: number;
  /** Lecture title, shown small under the question. */
  from: string;
  /** Flashcards feed back into spaced repetition. */
  card?: { key: string; lectureId: string };
}

export const LIVES = 3;
/** Seconds to answer a question. */
export const SECONDS = 12;
/** Points for a right answer at a checkpoint. */
export const BONUS = 50;
export const ROUND = 40;

export type Rand = () => number;
export const shuffle = <T,>(xs: T[], rand: Rand): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Questions for one game: each flashcard becomes "pick the right back" with 3
 * wrong backs from other cards; lecture quiz multiple-choice questions are used
 * as they are. Needs at least 4 distinct backs for flashcards to be used.
 */
export const buildGame = (lectures: StudyLecture[], title: (l: StudyLecture) => string, rand: Rand = Math.random, size = ROUND): GameQuestion[] => {
  const cards = lectures.flatMap((l) => (l.flashcards?.cards ?? []).map((c) => ({ ...c, lecture: l })));
  const backs = [...new Map(cards.map((c) => [c.back.trim().toLocaleLowerCase(), c.back])).values()];
  const out: GameQuestion[] = [];
  if (backs.length >= 4) {
    for (const c of cards) {
      const wrong = shuffle(backs.filter((b) => !same(b, c.back)), rand).slice(0, 3);
      const options = shuffle([c.back, ...wrong], rand);
      out.push({ prompt: c.front, options, correct: options.indexOf(c.back), from: title(c.lecture), card: { key: cardKey(c.lecture.id, c.front), lectureId: c.lecture.id } });
    }
  }
  for (const l of lectures) {
    for (const q of l.quiz?.questions ?? []) {
      if (q.kind !== 'choice' || q.options.length < 2 || q.correctIndex < 0) continue;
      out.push({ prompt: q.prompt, options: q.options, correct: q.correctIndex, from: title(l) });
    }
  }
  return shuffle(out, rand).slice(0, size);
};

/** Why a question is on screen: a regular checkpoint, or a crash you can talk your way out of. */
export type Ask = 'checkpoint' | 'rescue';

export interface Run {
  lives: number;
  /** Points from the game itself (gates, distance). */
  points: number;
  /** Points from right answers. */
  bonus: number;
  /** A shield takes the next crash for you. */
  shield: boolean;
  asked: number;
  right: number;
  /** Indexes (into the deck) of questions answered wrong. */
  missed: number[];
  over: boolean;
}

export const newRun = (): Run => ({ lives: LIVES, points: 0, bonus: 0, shield: false, asked: 0, right: 0, missed: [], over: false });
export const score = (r: Run) => r.points + r.bonus;

/**
 * A crash: the shield takes it if you have one (no question), otherwise a
 * rescue question decides whether you keep your life.
 */
export const crash = (r: Run): { run: Run; ask: Ask | null } =>
  r.shield ? { run: { ...r, shield: false }, ask: null } : { run: r, ask: 'rescue' };

/**
 * Apply an answer (`right` false for a wrong answer or a time-out).
 * Checkpoint: right gives a shield and bonus points, wrong costs a life.
 * Rescue: right keeps your life, wrong costs it.
 */
export const answer = (r: Run, ask: Ask, right: boolean, deckIndex: number): Run => {
  const next: Run = { ...r, asked: r.asked + 1 };
  if (right) {
    next.right = r.right + 1;
    if (ask === 'checkpoint') { next.shield = true; next.bonus = r.bonus + BONUS; }
  } else {
    next.lives = r.lives - 1;
    next.missed = r.missed.includes(deckIndex) ? r.missed : [...r.missed, deckIndex];
  }
  next.over = next.lives <= 0;
  return next;
};
