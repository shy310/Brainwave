import { z } from 'zod';
import { GRADES } from './grades.js';
import { LOCALES } from './locales.js';
import { LECTURE_LANGUAGES, SUMMARY_MODES, type SummaryMode } from './lectures.js';

export const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string().trim().min(1).max(60),
  grade: z.enum(GRADES),
  locale: z.enum(LOCALES),
  tutor_style: z.string().max(500).nullable().optional(),
  onboarded: z.boolean().default(false),
  /** How lecture notes are written by default. Null until chosen (then 'detailed'). */
  summary_mode: z.enum(SUMMARY_MODES).nullable().optional(),
  /** What the student mainly wants (chosen in onboarding). */
  study_goal: z.enum(['understand', 'exams', 'quick']).nullable().optional(),
  /** Usual language of their lectures: the default for new recordings. */
  lecture_language: z.enum(LECTURE_LANGUAGES).nullable().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileUpdateSchema = ProfileSchema.omit({ id: true }).partial();
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const STUDY_GOALS = ['understand', 'exams', 'quick'] as const;
export type StudyGoal = (typeof STUDY_GOALS)[number];

/** The notes style that suits a goal. */
export const summaryModeForGoal = (goal: StudyGoal): SummaryMode =>
  goal === 'exams' ? 'exam' : goal === 'quick' ? 'short' : 'detailed';
