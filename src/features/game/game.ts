// "Summit": a quick climbing quiz built from the student's own flashcards and
// lecture quizzes. Pure game rules, tested; the page only draws them.

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
export const SECONDS = 12;
export const MAX_COMBO = 5;
export const ROUND = 20;
const BASE = 100;

type Rand = () => number;
const shuffle = <T,>(xs: T[], rand: Rand): T[] => {
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

export interface GameState { index: number; lives: number; score: number; combo: number; height: number; missed: number[]; over: boolean }

export const start = (): GameState => ({ index: 0, lives: LIVES, score: 0, combo: 1, height: 0, missed: [], over: false });

/** Points for a right answer: faster answers and longer combos score more. */
export const points = (combo: number, secondsLeft: number) => Math.round(BASE * combo * (1 + Math.max(0, secondsLeft) / SECONDS));

/** Apply an answer (or a timeout, `choice` = null) to question `total` long game. */
export const answer = (s: GameState, q: GameQuestion, choice: number | null, secondsLeft: number, total: number): GameState => {
  const right = choice === q.correct;
  const next: GameState = right
    ? { ...s, score: s.score + points(s.combo, secondsLeft), combo: Math.min(MAX_COMBO, s.combo + 1), height: s.height + 1 }
    : { ...s, lives: s.lives - 1, combo: 1, missed: [...s.missed, s.index] };
  next.index = s.index + 1;
  next.over = next.lives <= 0 || next.index >= total;
  return next;
};
