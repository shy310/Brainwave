import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { Locale } from '@shared/locales';
import type { MediaKind, MediaOrigin } from '@shared/media';

export interface Media<S = unknown> {
  id: string;
  kind: MediaKind;
  title: string;
  origin: MediaOrigin;
  locale: Locale;
  script: S;
  created_at: string;
}

const DEMO_KEY = 'bw.media';
const readDemo = (): Media[] => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as Media[]; } catch { return []; }
};

/** Saved videos and podcasts live in Supabase; in demo mode they live in this browser. */
export const mediaRepo = {
  async list(kind: MediaKind): Promise<Omit<Media, 'script'>[]> {
    if (!supabase) return readDemo().filter((m) => m.kind === kind).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await supabase.from('media').select('id, kind, title, origin, locale, created_at')
      .eq('kind', kind).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Omit<Media, 'script'>[];
  },

  async get<S>(id: string): Promise<Media<S> | null> {
    if (!supabase) return (readDemo().find((m) => m.id === id) as Media<S> | undefined) ?? null;
    const { data, error } = await supabase.from('media').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Media<S> | null;
  },

  async create<S>(item: Omit<Media<S>, 'id' | 'created_at'>): Promise<Media<S>> {
    if (!supabase) {
      const saved = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Media<S>;
      storage.set(DEMO_KEY, JSON.stringify([saved, ...readDemo()]));
      return saved;
    }
    const { data, error } = await supabase.from('media').insert(item).select('*').single();
    if (error) throw error;
    return data as Media<S>;
  },

  async remove(id: string): Promise<void> {
    if (!supabase) { storage.set(DEMO_KEY, JSON.stringify(readDemo().filter((m) => m.id !== id))); return; }
    const { error } = await supabase.from('media').delete().eq('id', id);
    if (error) throw error;
  },
};
