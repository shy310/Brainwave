import { z } from 'zod';
import { QuizSchema } from './learn.js';

export const LECTURE_LANGUAGES = ['auto', 'en', 'he'] as const;
export type LectureLanguage = (typeof LECTURE_LANGUAGES)[number];

export const LECTURE_SOURCES = ['record', 'upload', 'text'] as const;
export type LectureSource = (typeof LECTURE_SOURCES)[number];

/**
 * Audio is sent in pieces of about a minute. Each piece ends at the quietest
 * moment between 50 and 70 seconds so words are not cut in half.
 * 16 kHz mono 16-bit WAV ≈ 1.9 MB per minute; 70 s ≈ 3.0 MB as base64.
 */
export const CHUNK_SECONDS = 60;
export const MIN_CHUNK_SECONDS = 50;
export const MAX_CHUNK_SECONDS = 70;
/** Bytes of 16 kHz mono 16-bit audio per minute, used for storage checks. */
export const BYTES_PER_MINUTE = 16_000 * 2 * 60;
export const MAX_AUDIO_BASE64 = 3_400_000;
export const MAX_TRANSCRIPT_CHARS = 300_000;
export const MAX_SLIDES_CHARS = 60_000;

export const TranscribeInputSchema = z.object({
  audio: z.string().min(100).max(MAX_AUDIO_BASE64).regex(/^[A-Za-z0-9+/]+=*$/, 'Expected base64 WAV audio'),
  language: z.enum(LECTURE_LANGUAGES).default('auto'),
  topic: z.string().max(200).optional(),
});
export const TranscriptPieceSchema = z.object({ text: z.string().max(40_000) });

export const LectureTextInputSchema = z.object({
  transcript: z.string().min(20).max(MAX_TRANSCRIPT_CHARS),
  slides: z.string().max(MAX_SLIDES_CHARS).optional(),
  title: z.string().max(200).optional(),
});

/** How notes are written: a quick overview, full notes, or focused on the exam. */
export const SUMMARY_MODES = ['short', 'detailed', 'exam'] as const;
export type SummaryMode = (typeof SUMMARY_MODES)[number];

export const NotesInputSchema = LectureTextInputSchema.extend({
  mode: z.enum(SUMMARY_MODES).default('detailed'),
});

export const NotesSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(3000),
  sections: z.array(z.object({
    heading: z.string().max(200),
    points: z.array(z.string().max(1500)).min(1).max(15),
  })).min(1).max(20),
  keyTerms: z.array(z.object({ term: z.string().max(200), definition: z.string().max(1000) })).max(30),
  /** Homework, deadlines and exam hints the lecturer mentioned. */
  reminders: z.array(z.string().max(500)).max(15),
  /** Which style these notes were written in (set by the server, not the model). */
  mode: z.enum(SUMMARY_MODES).optional(),
});
export type Notes = z.infer<typeof NotesSchema>;

export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string().min(1).max(500), back: z.string().min(1).max(1500) })).min(1).max(40),
});
export type Flashcards = z.infer<typeof FlashcardsSchema>;

export const LectureQuizInputSchema = LectureTextInputSchema.extend({
  count: z.number().int().min(3).max(10).default(6),
});
export const FlashcardsInputSchema = LectureTextInputSchema.extend({
  count: z.number().int().min(5).max(30).default(15),
});

export const SlidesInputSchema = z.object({
  name: z.string().max(200),
  dataUrl: z.string().max(3_000_000).regex(/^data:application\/pdf;base64,/),
});
export const SlidesTextSchema = z.object({ text: z.string().max(MAX_SLIDES_CHARS) });

/** A transcript piece with its start time in seconds. */
export const SegmentSchema = z.object({ start: z.number().min(0), text: z.string() });
export type Segment = z.infer<typeof SegmentSchema>;

export { QuizSchema };
