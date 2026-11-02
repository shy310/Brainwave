import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { ProfileSchema, type Profile, type ProfileUpdate } from '@shared/profile';

const DEMO_KEY = 'bw.demoProfile';

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
      .select('id, display_name, grade, locale, tutor_style, onboarded')
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
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() })
      .select('id, display_name, grade, locale, tutor_style, onboarded')
      .single();
    if (error) throw error;
    return ProfileSchema.parse(data);
  },
};
