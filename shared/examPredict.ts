// Exam predictor: from an exam's lectures, the AI guesses which topics are
// most likely to be examined (what the lecturer stressed, repeated, marked
// with ⭐ or tied to "this will be on the exam") and writes a mock exam that
// leans on them. Choosing what text to send and tidying the answer is done
// here (pure, tested).
import { z } from 'zod';
import { QuestionSchema, type Question } from './learn.js';

export const LIKELIHOODS = ['high', 'medium', 'low'] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

export const MAX_PREDICT_LECTURES = 12;
export const MAX_PREDICT_CHARS = 90_000;

export const ExamPredictInputSchema = z.object({
  exam: z.string().max(200),
  lectures: z.array(z.object({
    n: z.number().int().min(1).max(MAX_PREDICT_LECTURES),
    title: z.string().max(200),
    /** Notes and transcript lines, each line "[mm:ss] text"; ⭐ marks what the student flagged. */
    text: z.string().max(MAX_PREDICT_CHARS),
  })).min(1).max(MAX_PREDICT_LECTURES),
  count: z.number().int().min(5).max(12).default(10),
});
export type ExamPredictInput = z.input<typeof ExamPredictInputSchema>;

const EvidenceSchema = z.object({
  lecture: z.number().int(),
  quote: z.string().max(300),
  /** Seconds into the lecture, when the quote is from the transcript. */
  at: z.number().nullable().optional(),
});

export const ExamPredictOutputSchema = z.object({
  topics: z.array(z.object({
    title: z.string().min(1).max(120),
    likelihood: z.enum(LIKELIHOODS),
    why: z.string().max(300),
    evidence: z.array(EvidenceSchema).max(3).default([]),
  })).min(1).max(14),
  questions: z.array(QuestionSchema).min(1).max(14),
});
export type ExamPredictOutput = z.infer<typeof ExamPredictOutputSchema>;

/** What is saved with the exam: lecture numbers turned into lecture ids. */
export interface PredictedTopic {
  title: string;
  likelihood: Likelihood;
  why: string;
  evidence: { lectureId: string; quote: string; at?: number }[];
}
export interface Prediction { createdAt: string; topics: PredictedTopic[]; questions: Question[] }

/** Words lecturers use when something will be examined, in the app's languages. */
export const EXAM_CUE = /\b(exam|test|quiz|important|remember|make sure|you need to know|will be asked)\b|מבחן|בחינה|בוחן|חשוב|תזכרו|שימו לב|امتحان|اختبار|مهم|تذكروا|экзамен|зач[её]т|важно|запомните/i;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * One lecture as text for the predictor, within `budget` characters: its notes
 * first, then the transcript with times. When the transcript is too long, the
 * lines that matter most for an exam are kept — marked (⭐) ones and ones
 * with exam cues — and the rest is sampled evenly, in order.
 */
export const predictionText = (
  l: { notes?: { summary: string; sections: { heading: string; points: string[] }[]; reminders: string[] } | null; segments: { start: number; text: string }[] },
  marked: boolean[],
  budget: number,
): string => {
  const notes = l.notes
    ? ['Notes:', l.notes.summary, ...l.notes.sections.flatMap((s) => [`# ${s.heading}`, ...s.points.map((p) => `- ${p}`)]),
      ...(l.notes.reminders.length ? ['Reminders the lecturer gave:', ...l.notes.reminders.map((r) => `- ${r}`)] : [])].join('\n')
    : '';
  const lines = l.segments.map((s, i) => ({ i, text: s.text.trim(), line: `[${clock(s.start)}] ${marked[i] ? '⭐ ' : ''}${s.text.trim()}` })).filter((x) => x.text);
  const head = notes ? `${notes.slice(0, Math.floor(budget * 0.35))}\n\nTranscript:\n` : 'Transcript:\n';
  let room = budget - head.length;
  const all = lines.map((x) => x.line).join('\n');
  if (all.length <= room) return head + all;
  // Too long: keep the telling lines, then fill evenly.
  const keep = new Set<number>();
  for (const x of lines) {
    if (!(marked[x.i] || EXAM_CUE.test(x.text)) || x.line.length + 1 > room) continue;
    keep.add(x.i);
    room -= x.line.length + 1;
  }
  const rest = lines.filter((x) => !keep.has(x.i));
  const avg = rest.length ? rest.reduce((n, x) => n + x.line.length + 1, 0) / rest.length : 1;
  const step = Math.max(1, Math.ceil(rest.length / Math.max(1, Math.floor(room / avg))));
  for (let k = 0; k < rest.length; k += step) {
    if (rest[k].line.length + 1 > room) break;
    keep.add(rest[k].i);
    room -= rest[k].line.length + 1;
  }
  return head + lines.filter((x) => keep.has(x.i)).map((x) => x.line).join('\n');
};

const RANK: Record<Likelihood, number> = { high: 0, medium: 1, low: 2 };

/**
 * Tidy the AI's prediction: topics ordered high → low with no repeats,
 * evidence only from lectures that exist (numbers become ids, times are
 * kept only when sensible).
 */
export const cleanPrediction = (out: Pick<ExamPredictOutput, 'topics'>, lectureIds: string[], durations: number[]): PredictedTopic[] => {
  const seen = new Set<string>();
  return out.topics
    .map((t) => ({
      title: t.title.trim(),
      likelihood: t.likelihood,
      why: t.why.trim(),
      evidence: t.evidence.flatMap((e) => {
        const id = lectureIds[e.lecture - 1];
        const quote = e.quote.replace(/⭐/g, '').trim();
        if (!id || !quote) return [];
        const at = typeof e.at === 'number' && e.at >= 0 && e.at <= (durations[e.lecture - 1] ?? 0) ? Math.floor(e.at) : undefined;
        return [{ lectureId: id, quote, ...(at !== undefined ? { at } : {}) }];
      }),
    }))
    .filter((t) => t.title && !seen.has(t.title.toLocaleLowerCase()) && seen.add(t.title.toLocaleLowerCase()))
    .sort((a, b) => RANK[a.likelihood] - RANK[b.likelihood]);
};

/** The exam's lectures, the ones the likely topics come from first (for the study plan). */
export const rankLectures = (ids: string[], topics: PredictedTopic[]): string[] => {
  const weight = new Map<string, number>();
  for (const t of topics) for (const e of t.evidence) weight.set(e.lectureId, (weight.get(e.lectureId) ?? 0) + (3 - RANK[t.likelihood]));
  return ids.map((id, i) => ({ id, i, w: weight.get(id) ?? 0 })).sort((a, b) => b.w - a.w || a.i - b.i).map((x) => x.id);
};

/** Time for the mock exam: about 1.5 minutes a question (3 for written answers). */
export const mockMinutes = (questions: Pick<Question, 'kind'>[]) =>
  Math.max(5, Math.round(questions.reduce((m, q) => m + (q.kind === 'open' ? 3 : 1.5), 0)));
