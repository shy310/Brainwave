// Study activity per day: minutes in the app, cards reviewed, quizzes
// finished, lectures added. Streaks and the weekly summary are computed from
// it with pure functions (tested).

export interface DayActivity {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  minutes: number;
  cards: number;
  quizzes: number;
  lectures: number;
}
export type ActivityDelta = Partial<Omit<DayActivity, 'day'>>;

/** YYYY-MM-DD in the student's own time zone. */
export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
};

/** A day counts towards the streak with a little real study, not just opening the app. */
export const counts = (a?: DayActivity) => !!a && (a.minutes >= 5 || a.cards > 0 || a.quizzes > 0 || a.lectures > 0);

/**
 * Days in a row with study, ending today — or yesterday, so the streak isn't
 * shown as lost before today is over. Also the best streak ever.
 */
export const streaks = (days: DayActivity[], today: string) => {
  const by = new Map(days.map((d) => [d.day, d]));
  const studiedToday = counts(by.get(today));
  let current = 0;
  for (let d = studiedToday ? today : addDays(today, -1); counts(by.get(d)); d = addDays(d, -1)) current++;
  let best = 0, run = 0, prev = '';
  for (const d of [...days].filter(counts).map((x) => x.day).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), studiedToday };
};

/** The last 7 days (oldest first) with totals. */
export const lastWeek = (days: DayActivity[], today: string) => {
  const by = new Map(days.map((d) => [d.day, d]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return by.get(day) ?? { day, minutes: 0, cards: 0, quizzes: 0, lectures: 0 };
  });
  const total = week.reduce((s, d) => ({
    minutes: s.minutes + d.minutes, cards: s.cards + d.cards, quizzes: s.quizzes + d.quizzes, lectures: s.lectures + d.lectures,
  }), { minutes: 0, cards: 0, quizzes: 0, lectures: 0 });
  return { week, total, activeDays: week.filter(counts).length };
};

/** Add a delta to a day (for the demo store and tests). */
export const bumpDay = (days: DayActivity[], day: string, delta: ActivityDelta): DayActivity[] => {
  const cur = days.find((d) => d.day === day) ?? { day, minutes: 0, cards: 0, quizzes: 0, lectures: 0 };
  const next = {
    day, minutes: cur.minutes + (delta.minutes ?? 0), cards: cur.cards + (delta.cards ?? 0),
    quizzes: cur.quizzes + (delta.quizzes ?? 0), lectures: cur.lectures + (delta.lectures ?? 0),
  };
  return [...days.filter((d) => d.day !== day), next].sort((a, b) => a.day.localeCompare(b.day));
};

/** Minutes of study that make today's time goal. */
export const DAILY_MINUTES = 10;

export type GoalId = 'review' | 'minutes' | 'lecture';
export interface Goal { id: GoalId; done: boolean }

/**
 * Today's three small goals: review the cards that are due (done when you
 * reviewed some today, or nothing is due), study for 10 minutes, and add a
 * lecture. Pure, so it's easy to test.
 */
export const dailyGoals = (today: DayActivity | undefined, due: number): { goals: Goal[]; done: number } => {
  const d = today ?? { minutes: 0, cards: 0, quizzes: 0, lectures: 0 };
  const goals: Goal[] = [
    { id: 'review', done: d.cards > 0 || due === 0 },
    { id: 'minutes', done: d.minutes >= DAILY_MINUTES },
    { id: 'lecture', done: d.lectures > 0 },
  ];
  return { goals, done: goals.filter((g) => g.done).length };
};
