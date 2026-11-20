import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, isDemo } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { setAiContext } from '@/lib/api';
import { useI18n } from '@/i18n';
import { profileRepo } from './profileRepo';
import type { Profile, ProfileUpdate } from '@shared/profile';

interface AuthUser { id: string; email: string | null }

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  demo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const DEMO_USER_KEY = 'bw.demoUser';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setLocale } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: AuthUser | null) => {
    if (!u) { setProfile(null); return; }
    try {
      const p = await profileRepo.get(u.id);
      setProfile(p);
      if (p?.onboarded) setLocale(p.locale);
    } catch (err) {
      console.error('Could not load profile', err);
      setProfile(null);
    }
  }, [setLocale]);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      const id = storage.get(DEMO_USER_KEY);
      const u = id ? { id, email: null } : null;
      setUser(u);
      loadProfile(u).finally(() => active && setLoading(false));
      return () => { active = false; };
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session ? { id: data.session.user.id, email: data.session.user.email ?? null } : null;
      if (!active) return;
      setUser(u);
      await loadProfile(u);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session ? { id: session.user.id, email: session.user.email ?? null } : null;
      setUser(prev => (prev?.id === u?.id ? prev : u));
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') loadProfile(u);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // Keep the AI context (language + level) in sync with the profile.
  useEffect(() => {
    if (profile) setAiContext({ locale: profile.locale, grade: profile.grade });
  }, [profile]);

  const value = useMemo<AuthState>(() => ({
    user, profile, loading, demo: isDemo,
    async signIn(email, password) {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password) {
      if (!supabase) return { needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    },
    async resetPassword(email) {
      if (!supabase) return;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/settings` });
      if (error) throw error;
    },
    startDemo() {
      const id = storage.get(DEMO_USER_KEY) ?? `demo-${crypto.randomUUID?.() ?? Date.now()}`;
      storage.set(DEMO_USER_KEY, id);
      const u = { id, email: null };
      setUser(u);
      loadProfile(u);
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      else storage.remove(DEMO_USER_KEY);
      setUser(null);
      setProfile(null);
    },
    async updateProfile(patch) {
      if (!user) return;
      const next = await profileRepo.update(user.id, patch);
      setProfile(next);
      if (patch.locale) setLocale(patch.locale);
    },
  }), [user, profile, loading, loadProfile, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
