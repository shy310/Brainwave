import { z } from 'zod';
import { GRADES } from './grades';
import { LOCALES } from './locales';

export const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string().trim().min(1).max(60),
  grade: z.enum(GRADES),
  locale: z.enum(LOCALES),
  tutor_style: z.string().max(500).nullable().optional(),
  onboarded: z.boolean().default(false),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileUpdateSchema = ProfileSchema.omit({ id: true }).partial();
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
