import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { ProfileSchema, type Profile, type ProfileUpdate } from '@shared/profile';

const DEMO_KEY = 'bw.demoProfile';

/** Settings added by later migrations. Until a migration is run, saving goes on without them. */
const OPTIONAL_COLUMNS = ['summary_mode', 'study_goal', 'lecture_language'] as const;

/**
 * If the database doesn't have a column yet (its migration wasn't run), the
 * patch without it; otherwise null. Pure, for tests.
 */
export const withoutMissingColumn = (patch: ProfileUpdate, error: { code?: string; message?: string } | null): ProfileUpdate | null => {
  if (!error || (error.code !== 'PGRST204' && error.code !== '42703')) return null;
  const message = error.message ?? '';
  const column = OPTIONAL_COLUMNS.find((c) => c in patch && (message.includes(`'${c}'`) || message.includes(`"${c}"`)));
  if (!column) return null;
  const { [column]: _, ...rest } = patch;
  return rest;
};

/** Profiles live in Supabase; in demo mode they live in this browser. */
export const profileRepo = {
  async get(userId: string): Promise<Profile | null> {
    if (!supabase) {
      const raw = storage.get(DEMO_KEY);
      if (!raw) return null;
      const parsed = ProfileSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    }
    const { data, error } = await supabase
      .from('profiles')
      // '*' keeps working before and after a migration adds a column.
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const parsed = ProfileSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },

  async update(userId: string, patch: ProfileUpdate): Promise<Profile> {
    if (!supabase) {
      const current = (await profileRepo.get(userId)) ?? { id: userId, display_name: 'Student', grade: '9', locale: 'en', onboarded: false };
      const next = ProfileSchema.parse({ ...current, ...patch });
      storage.set(DEMO_KEY, JSON.stringify(next));
      return next;
    }
    let rest = patch;
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...rest, updated_at: new Date().toISOString() })
        // '*' keeps working before and after a migration adds a column.
        .select('*')
        .single();
      if (!error) return ProfileSchema.parse(data);
      // A newer setting whose migration hasn't been run: save the rest, so signing up never gets stuck.
      const smaller = attempt < OPTIONAL_COLUMNS.length ? withoutMissingColumn(rest, error) : null;
      if (!smaller) throw error;
      console.warn('Profile column missing (migration not run?); saved without it:', error.message);
      rest = smaller;
    }
  },
};
