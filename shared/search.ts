// Search across every lecture: transcripts (with times) and notes. Pure and
// tested; works the same for English, Hebrew, Arabic and Russian.
import { z } from 'zod';
import type { Notes, Segment } from './lectures.js';

export interface SearchableLecture { id: string; title: string; segments: Segment[]; notes: Notes | null; created_at: string }

export interface Passage {
  lectureId: string;
  lectureTitle: string;
  /** Where it is: a time in the transcript, or a part of the notes. */
  kind: 'transcript' | 'notes';
  start?: number;
  text: string;
}

export interface Hit extends Passage { score: number }

/** Lowercase, without accents, niqqud or Arabic diacritics, so "Café" finds "cafe" and "שָׁלוֹם" finds "שלום". */
export const normalize = (s: string) => s.normalize('NFKD').replace(/[̀-֑ͯ-ׇً-ٰٟ]/g, '').toLocaleLowerCase();

const WORD = /[\p{L}\p{N}]+/gu;
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'is', 'are', 'was', 'what', 'how', 'why', 'did', 'do', 'we', 'about', 'on', 'for', 'with',
  'של', 'את', 'על', 'מה', 'איך', 'למה', 'זה', 'היא', 'הוא', 'עם', 'גם', 'אם', 'في', 'من', 'على', 'ما', 'كيف', 'لماذا', 'عن', 'и', 'в', 'на', 'что', 'как', 'почему', 'о', 'с']);

/** The words that matter in a query (2+ letters, common little words dropped). */
export const terms = (query: string): string[] => [...new Set((normalize(query).match(WORD) ?? []).filter((w) => w.length >= 2 && !STOP.has(w)))];

/** Every searchable piece of a lecture: each transcript paragraph, and the notes' summary, points and key terms. */
export const passages = (l: SearchableLecture): Passage[] => {
  const base = { lectureId: l.id, lectureTitle: l.title };
  const out: Passage[] = l.segments.filter((s) => s.text.trim()).map((s) => ({ ...base, kind: 'transcript' as const, start: s.start, text: s.text.trim() }));
  if (l.notes) {
    if (l.notes.summary) out.push({ ...base, kind: 'notes', text: l.notes.summary });
    for (const sec of l.notes.sections) for (const p of sec.points) out.push({ ...base, kind: 'notes', text: `${sec.heading}: ${p}` });
    for (const k of l.notes.keyTerms) out.push({ ...base, kind: 'notes', text: `${k.term} — ${k.definition}` });
  }
  return out;
};

/**
 * How well a passage matches: each query word found counts (a word that
 * starts with it counts a bit less, for Hebrew/Arabic prefixes and plurals),
 * all words found and the exact phrase score extra.
 */
export const scorePassage = (text: string, qTerms: string[], phrase: string): number => {
  if (!qTerms.length) return 0;
  const words: string[] = normalize(text).match(WORD) ?? [];
  let found = 0, score = 0;
  for (const q of qTerms) {
    if (words.includes(q)) { found++; score += 3; }
    else if (words.some((w) => w.startsWith(q) || (q.length >= 4 && w.includes(q)) || (w.length >= 3 && q.length > w.length && q.endsWith(w)))) { found++; score += 2; }
  }
  if (!found) return 0;
  if (found === qTerms.length) score += 4;
  if (phrase.length >= 4 && normalize(text).includes(phrase)) score += 6;
  return score;
};

/** The best matching passages across all lectures, best first. */
export const search = (lectures: SearchableLecture[], query: string, limit = 30): Hit[] => {
  const qTerms = terms(query);
  const phrase = normalize(query).trim();
  return lectures.flatMap(passages)
    .map((p) => ({ ...p, score: scorePassage(p.text, qTerms, phrase) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.text.length - b.text.length)
    .slice(0, limit);
};

/** Where to show the query's words in a passage, as [from, to) ranges (for <mark>). */
export const highlights = (text: string, query: string): [number, number][] => {
  const qTerms = terms(query);
  if (!qTerms.length) return [];
  const norm = normalize(text);
  // Normalizing can change the length (niqqud removed), so only highlight when it doesn't.
  if (norm.length !== text.length) return [];
  const out: [number, number][] = [];
  for (const m of norm.matchAll(WORD)) {
    const w = m[0];
    if (qTerms.some((q) => w === q || w.startsWith(q))) out.push([m.index!, m.index! + w.length]);
  }
  return out;
};

// ── Asking the AI about all lectures ────────────────────────────────────────

export const AskLecturesInputSchema = z.object({
  question: z.string().min(2).max(500),
  passages: z.array(z.object({ n: z.number().int().min(1).max(20), lecture: z.string().max(200), text: z.string().max(1500) })).min(1).max(12),
});
export type AskLecturesInput = z.infer<typeof AskLecturesInputSchema>;

export const AskLecturesOutputSchema = z.object({
  /** The answer, citing passages as [1], [2]… */
  answer: z.string().min(1).max(4000),
  /** Which passages were used. */
  cited: z.array(z.number().int()).max(12),
  /** False when the lectures don't answer it. */
  found: z.boolean(),
});
export type AskLecturesOutput = z.infer<typeof AskLecturesOutputSchema>;
