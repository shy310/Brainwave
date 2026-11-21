// Exam mode: a day-by-day plan up to an exam, and how ready the student is.
// Pure and tested; the pages only show it. Dates are local days "YYYY-MM-DD".

export interface Exam {
  id: string;
  title: string;
  /** The day of the exam, "YYYY-MM-DD". */
  date: string;
  /** Questions come from this folder ('all' for every lecture)… */
  folderId: string | null;
  /** …or from these lectures (used when not empty). */
  lectureIds: string[];
  /** Best practice-exam score so far, 0–100. */
  bestScore: number | null;
  attempts: number;
}

const DAY = 86_400_000;
const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(toUtc(d) + n * DAY).toISOString().slice(0, 10);

/** Whole days from `today` to the exam (0 on the day itself, negative after). */
export const daysUntil = (date: string, today: string) => Math.round((toUtc(date) - toUtc(today)) / DAY);

export type PlanTask = { kind: 'learn'; lectureIds: string[] } | { kind: 'review' } | { kind: 'practice' };
export interface PlanDay { date: string; tasks: PlanTask[] }

/**
 * Study days from today up to the day before the exam:
 *  - the lectures are spread evenly over the first days (go through the notes and flashcards);
 *  - from the second day on, review the flashcards that are due;
 *  - the last day (last two days when there are four or more) is for practice exams.
 * Nothing on the exam day itself or after it.
 */
export const examPlan = (lectureIds: string[], today: string, examDate: string): PlanDay[] => {
  const n = daysUntil(examDate, today);
  if (n <= 0) return [];
  const practiceDays = n >= 4 ? 2 : 1;
  const learnDays = Math.max(1, n - practiceDays);
  const L = lectureIds.length;
  return Array.from({ length: n }, (_, d) => {
    const tasks: PlanTask[] = [];
    if (d < learnDays) {
      // Rounded up so, with more days than lectures, the lectures come first.
      const chunk = lectureIds.slice(Math.ceil((d * L) / learnDays), Math.ceil(((d + 1) * L) / learnDays));
      if (chunk.length) tasks.push({ kind: 'learn', lectureIds: chunk });
    }
    if (d >= n - practiceDays) tasks.push({ kind: 'practice' });
    if (d > 0 || !tasks.length) tasks.splice(tasks[0]?.kind === 'learn' ? 1 : 0, 0, { kind: 'review' });
    return { date: addDays(today, d), tasks };
  });
};

/**
 * How ready, 0–100: mostly how many of the exam's flashcards are well known
 * (reviewed into box 2 or higher), plus the best practice-exam score. Without
 * any practice exam it tops out at 60, so the meter asks for one.
 */
export const readiness = (cardsTotal: number, cardsKnown: number, bestScore: number | null): number => {
  const cards = cardsTotal > 0 ? Math.min(1, cardsKnown / cardsTotal) : null;
  if (cards === null) return bestScore ?? 0;
  if (bestScore === null) return Math.round(cards * 60);
  return Math.round(cards * 60 + bestScore * 0.4);
};

/** The nearest exam that hasn't happened yet (today counts). */
export const nextExam = <E extends Pick<Exam, 'date'>>(exams: E[], today: string): E | undefined =>
  exams.filter((e) => daysUntil(e.date, today) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
