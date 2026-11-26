// Syllabus import and the study calendar. The AI reads a syllabus and lists
// the class times, exams and deadlines it finds; checking them and laying out
// the calendar is done here (pure, tested). Dates are local days "YYYY-MM-DD".
import { z } from 'zod';

export const DEADLINE_KINDS = ['assignment', 'quiz', 'project', 'other'] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

export interface Deadline { id: string; title: string; date: string; kind: DeadlineKind; course: string | null; done: boolean }

export const SyllabusInputSchema = z.object({
  text: z.string().min(40).max(40_000),
  /** Today, so dates without a year land in the right one. */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SyllabusInput = z.infer<typeof SyllabusInputSchema>;

export const SyllabusSchema = z.object({
  course: z.string().max(120).default(''),
  meetings: z.array(z.object({ weekday: z.number().int(), starts: z.string().max(5), ends: z.string().max(5), label: z.string().max(60).default('') })).max(10).default([]),
  exams: z.array(z.object({ title: z.string().max(120), date: z.string().max(10) })).max(10).default([]),
  deadlines: z.array(z.object({ title: z.string().max(160), date: z.string().max(10), kind: z.enum(DEADLINE_KINDS).catch('other') })).max(40).default([]),
});
export type Syllabus = z.infer<typeof SyllabusSchema>;

const DAY = 86_400_000;
const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(toUtc(d)).toISOString().slice(0, 10) === d;
const time = (t: string) => (/^([01]?\d|2[0-3]):[0-5]\d$/.test(t) ? t.padStart(5, '0') : null);
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/**
 * Keep what the AI found that makes sense: real dates (sorted, no repeats,
 * nothing more than a month in the past), class times that are valid and end
 * after they start (75 minutes when the end is missing).
 */
export const cleanSyllabus = (s: Syllabus, today: string): Syllabus => {
  const recent = (d: string) => isDay(d) && toUtc(d) >= toUtc(today) - 31 * DAY;
  const seen = new Set<string>();
  const once = (key: string) => !seen.has(key) && !!seen.add(key);
  const meetings = s.meetings.flatMap((m) => {
    const starts = time(m.starts);
    if (!starts || m.weekday < 0 || m.weekday > 6) return [];
    let ends = time(m.ends);
    if (!ends || minutes(ends) <= minutes(starts)) {
      const e = Math.min(minutes(starts) + 75, 23 * 60 + 59);
      ends = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
    }
    return once(`m${m.weekday}${starts}`) ? [{ weekday: m.weekday, starts, ends, label: m.label.trim() }] : [];
  }).sort((a, b) => a.weekday - b.weekday || a.starts.localeCompare(b.starts));
  const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
  return {
    course: s.course.trim(),
    meetings,
    exams: s.exams.map((e) => ({ title: e.title.trim(), date: e.date })).filter((e) => e.title && recent(e.date) && once(`e${e.date}${e.title.toLowerCase()}`)).sort(byDate),
    deadlines: s.deadlines.map((d) => ({ ...d, title: d.title.trim() })).filter((d) => d.title && recent(d.date) && once(`d${d.date}${d.title.toLowerCase()}`)).sort(byDate),
  };
};

/** The first day of the week where the student lives: Monday in Russian, Sunday otherwise. */
export const weekStart = (locale: string) => (locale === 'ru' ? 1 : 0);

export const addDay = (d: string, n: number) => new Date(toUtc(d) + n * DAY).toISOString().slice(0, 10);
export const weekdayOf = (d: string) => new Date(toUtc(d)).getUTCDay();

/** Six weeks of days covering a month ("YYYY-MM"), starting on the week's first day. */
export const monthGrid = (month: string, firstDay: number): string[] => {
  const first = `${month}-01`;
  const back = (weekdayOf(first) - firstDay + 7) % 7;
  const start = addDay(first, -back);
  return Array.from({ length: 42 }, (_, i) => addDay(start, i));
};

export const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export interface DayItems<C, E, D, P> { classes: C[]; exams: E[]; deadlines: D[]; plan: P[] }

/** What happens on a day: the week's classes, exams, deadlines and study-plan tasks for it. */
export const itemsOn = <C extends { weekday: number }, E extends { date: string }, D extends { date: string }, P extends { date: string }>(
  day: string, all: { classes: C[]; exams: E[]; deadlines: D[]; plan: P[] },
): DayItems<C, E, D, P> => ({
  classes: all.classes.filter((c) => c.weekday === weekdayOf(day)),
  exams: all.exams.filter((e) => e.date === day),
  deadlines: all.deadlines.filter((d) => d.date === day),
  plan: all.plan.filter((p) => p.date === day),
});
