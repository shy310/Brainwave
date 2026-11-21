import type { Question } from '@shared/learn';
import type { StudyLecture } from '@/features/lectures/repo';
import { buildGame, shuffle, type Rand } from '@/features/game/game';

export const PRACTICE_SIZE = 12;

/**
 * A practice exam from the lectures: flashcards as 4-option questions, and the
 * lectures' own quiz questions (multiple choice and typed answers). Shuffled,
 * at most `size` questions. Written answers are left out (they need AI grading).
 */
export const practiceQuestions = (lectures: StudyLecture[], title: (l: StudyLecture) => string, from: (title: string) => string,
  rand: Rand = Math.random, size = PRACTICE_SIZE): Question[] => {
  const choice: Question[] = buildGame(lectures, title, rand, 500).map((g) => ({
    kind: 'choice', prompt: g.prompt, options: g.options, correctIndex: g.correct, answer: g.options[g.correct] ?? '',
    accepted: [], check: '', hint: '', explanation: from(g.from),
  }));
  const typed: Question[] = lectures.flatMap((l) => (l.quiz?.questions ?? [])
    .filter((q) => q.kind === 'input' && q.answer.trim())
    .map((q) => ({ ...q, explanation: q.explanation || from(title(l)) })));
  return shuffle([...choice, ...typed], rand).slice(0, size);
};
