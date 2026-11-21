import type { Locale } from './locales.js';
import { CURRICULUM_AR } from './curriculumAr.js';
import { CURRICULUM_RU } from './curriculumRu.js';

export const SUBJECTS = ['math', 'science', 'geography', 'history', 'coding', 'economics'] as const;
export type Subject = (typeof SUBJECTS)[number];

/** Grade bands that courses are written for. */
export const BANDS = ['k', '1-3', '4-6', '7-8', '9-10', '11-12', 'college'] as const;
export type Band = (typeof BANDS)[number];

/** A string in every supported language. */
export type Text = Record<Locale, string>;

export interface Topic {
  id: string;
  title: Text;
  description: Text;
  prerequisites: string[];
}

export interface Unit {
  id: string;
  title: Text;
  topics: Topic[];
}

export interface Course {
  id: string;
  subject: Subject;
  band: Band;
  units: Unit[];
}

/** "id|title|description" lines → id → [title, description]. */
const parse = (text: string) => new Map(text.trim().split('\n').map((line) => {
  const [id, title, description] = line.split('|');
  return [id, [title, description ?? ''] as const];
}));
const AR = parse(CURRICULUM_AR);
const RU = parse(CURRICULUM_RU);

/** A title or description in every language; English stands in if a translation is missing. */
const text = (id: string, i: 0 | 1, en: string, he: string): Text => ({
  en, he, ar: AR.get(id)?.[i] || en, ru: RU.get(id)?.[i] || en,
});

export const t = (id: string, title: [string, string], description: [string, string], prerequisites: string[]): Topic => ({
  id,
  title: text(id, 0, title[0], title[1]),
  description: text(id, 1, description[0], description[1]),
  prerequisites,
});

export const u = (id: string, title: [string, string], topics: Topic[]): Unit => ({
  id,
  title: text(id, 0, title[0], title[1]),
  topics,
});

export const isBand = (v: unknown): v is Band => typeof v === 'string' && (BANDS as readonly string[]).includes(v);
