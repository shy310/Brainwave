import { z } from 'zod';
import { GRADES } from './grades.js';
import { LOCALES } from './locales.js';
import { SUMMARY_MODES } from './lectures.js';

export const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string().trim().min(1).max(60),
  grade: z.enum(GRADES),
  locale: z.enum(LOCALES),
  tutor_style: z.string().max(500).nullable().optional(),
  onboarded: z.boolean().default(false),
  /** How lecture notes are written by default. Null until chosen (then 'detailed'). */
  summary_mode: z.enum(SUMMARY_MODES).nullable().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileUpdateSchema = ProfileSchema.omit({ id: true }).partial();
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
