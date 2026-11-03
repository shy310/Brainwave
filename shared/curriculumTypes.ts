import type { Locale } from './locales.js';

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

export const t = (id: string, title: [string, string], description: [string, string], prerequisites: string[]): Topic => ({
  id,
  title: { en: title[0], he: title[1] },
  description: { en: description[0], he: description[1] },
  prerequisites,
});

export const u = (id: string, title: [string, string], topics: Topic[]): Unit => ({
  id,
  title: { en: title[0], he: title[1] },
  topics,
});

export const isBand = (v: unknown): v is Band => typeof v === 'string' && (BANDS as readonly string[]).includes(v);
