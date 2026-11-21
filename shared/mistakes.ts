// Weak spots: questions the student got wrong (in lecture quizzes, practice
// exams and folder quizzes) and flashcards they keep forgetting, practised
// together until they stick. Pure and tested.
import type { Question } from './learn.js';
import type { CardState } from './srs.js';

/** Right this many times in a row after a miss, and it's no longer a weak spot. */
export const RESOLVE_STREAK = 2;
export const SESSION_SIZE = 10;

export interface Mistake {
  key: string;
  lectureId: string | null;
  question: Question;
  /** Times answered wrong. */
  wrong: number;
  /** Right answers in a row since the last miss. */
  streak: number;
  lastWrong: number;
  resolved: boolean;
}

/** A stable key for a question (its lecture and wording). */
export const mistakeKey = (lectureId: string | null, prompt: string): string => {
  let h = 5381;
  const s = `${lectureId ?? '-'}|${prompt.trim().toLowerCase()}`;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `q${h.toString(36)}${s.length.toString(36)}`;
};

/**
 * What an answer does to a question's record: a miss adds (or reopens) it, a
 * right answer counts toward clearing it. A right answer to a question never
 * missed leaves no record.
 */
export const recordAnswer = (prev: Mistake | undefined, question: Question, lectureId: string | null, correct: boolean, now: number): Mistake | undefined => {
  if (!prev) {
    if (correct) return undefined;
    return { key: mistakeKey(lectureId, question.prompt), lectureId, question, wrong: 1, streak: 0, lastWrong: now, resolved: false };
  }
  if (!correct) return { ...prev, question, wrong: prev.wrong + 1, streak: 0, lastWrong: now, resolved: false };
  const streak = prev.streak + 1;
  return { ...prev, streak, resolved: streak >= RESOLVE_STREAK };
};

/** Flashcards the student keeps forgetting: forgotten at least once and not yet well known. */
export const isWeakCard = (s: CardState | undefined) => !!s && s.lapses > 0 && s.box <= 1;

/** Open weak spots, most missed and most recent first. */
export const openMistakes = (all: Mistake[]): Mistake[] =>
  all.filter((m) => !m.resolved).sort((a, b) => b.wrong - a.wrong || b.lastWrong - a.lastWrong);

/** One practice round: missed questions and weak flashcards taken in turns, up to `size`. */
export const weakSession = <A, B>(mistakes: A[], cards: B[], size = SESSION_SIZE): (A | B)[] => {
  const out: (A | B)[] = [];
  for (let i = 0; out.length < size && (i < mistakes.length || i < cards.length); i++) {
    if (i < mistakes.length) out.push(mistakes[i]);
    if (out.length < size && i < cards.length) out.push(cards[i]);
  }
  return out;
};
