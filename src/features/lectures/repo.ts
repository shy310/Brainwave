import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { Quiz } from '@shared/learn';
import type { Flashcards, LectureLanguage, LectureSource, Notes, Segment } from '@shared/lectures';

export interface Lecture {
  id: string;
  title: string;
  source: LectureSource;
  language: LectureLanguage;
  status: 'transcribing' | 'ready' | 'error';
  duration_sec: number;
  segments: Segment[];
  slides_text: string | null;
  notes: Notes | null;
  quiz: Quiz | null;
  flashcards: Flashcards | null;
  created_at: string;
  updated_at: string;
}

export type LectureSummary = Pick<Lecture, 'id' | 'title' | 'source' | 'status' | 'duration_sec' | 'created_at'>;
export type NewLecture = Pick<Lecture, 'title' | 'source' | 'language'> & Partial<Pick<Lecture, 'segments' | 'slides_text' | 'status' | 'duration_sec'>>;
export type LecturePatch = Partial<Omit<Lecture, 'id' | 'created_at' | 'updated_at'>>;

export const transcriptOf = (l: Pick<Lecture, 'segments'>) => l.segments.map((s) => s.text.trim()).filter(Boolean).join('\n\n');

const DEMO_KEY = 'bw.lectures';
const readDemo = (): Lecture[] => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as Lecture[]; } catch { return []; }
};
const writeDemo = (all: Lecture[]) => storage.set(DEMO_KEY, JSON.stringify(all));

const LIST_COLUMNS = 'id, title, source, status, duration_sec, created_at';

/** Lectures live in Supabase; in demo mode they live in this browser. */
export const lectureRepo = {
  async list(): Promise<LectureSummary[]> {
    if (!supabase) return readDemo().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await supabase.from('lectures').select(LIST_COLUMNS).order('created_at', { ascending: false });
    if (error) throw error;
    return data as LectureSummary[];
  },

  async get(id: string): Promise<Lecture | null> {
    if (!supabase) return readDemo().find((l) => l.id === id) ?? null;
    const { data, error } = await supabase.from('lectures').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Lecture | null;
  },

  async create(input: NewLecture): Promise<Lecture> {
    const now = new Date().toISOString();
    const base = { segments: [], slides_text: null, status: 'transcribing' as const, duration_sec: 0, ...input };
    if (!supabase) {
      const lecture: Lecture = { id: crypto.randomUUID(), notes: null, quiz: null, flashcards: null, created_at: now, updated_at: now, ...base };
      writeDemo([lecture, ...readDemo()]);
      return lecture;
    }
    const { data, error } = await supabase.from('lectures').insert(base).select('*').single();
    if (error) throw error;
    return data as Lecture;
  },

  async update(id: string, patch: LecturePatch): Promise<void> {
    const updated_at = new Date().toISOString();
    if (!supabase) {
      writeDemo(readDemo().map((l) => (l.id === id ? { ...l, ...patch, updated_at } : l)));
      return;
    }
    const { error } = await supabase.from('lectures').update({ ...patch, updated_at }).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    if (!supabase) { writeDemo(readDemo().filter((l) => l.id !== id)); return; }
    const { error } = await supabase.from('lectures').delete().eq('id', id);
    if (error) throw error;
  },
};
