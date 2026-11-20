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
  /** The folder it's in, if any (needs migration 0007). */
  folder_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type LectureSummary = Pick<Lecture, 'id' | 'title' | 'source' | 'status' | 'duration_sec' | 'created_at' | 'folder_id'>;
export type NewLecture = Pick<Lecture, 'title' | 'source' | 'language'> & Partial<Pick<Lecture, 'segments' | 'slides_text' | 'status' | 'duration_sec'>>;
export type StudyLecture = Pick<Lecture, 'id' | 'title' | 'created_at' | 'status' | 'folder_id' | 'flashcards' | 'quiz'>;
export type LecturePatch = Partial<Omit<Lecture, 'id' | 'created_at' | 'updated_at'>>;

export const transcriptOf = (l: Pick<Lecture, 'segments'>) => l.segments.map((s) => s.text.trim()).filter(Boolean).join('\n\n');

const DEMO_KEY = 'bw.lectures';
const readDemo = (): Lecture[] => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as Lecture[]; } catch { return []; }
};
const writeDemo = (all: Lecture[]) => storage.set(DEMO_KEY, JSON.stringify(all));

const LIST_COLUMNS = 'id, title, source, status, duration_sec, created_at';
/** True when a query failed because a column (from a migration not run yet) doesn't exist. */
const missingColumn = (error: { code?: string } | null) => error?.code === '42703' || error?.code === 'PGRST204';

/** Lectures live in Supabase; in demo mode they live in this browser. */
export const lectureRepo = {
  async list(): Promise<LectureSummary[]> {
    if (!supabase) return readDemo().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const first = await supabase.from('lectures').select(`${LIST_COLUMNS}, folder_id`).order('created_at', { ascending: false });
    const { data, error } = missingColumn(first.error)
      ? await supabase.from('lectures').select(LIST_COLUMNS).order('created_at', { ascending: false })
      : first;
    if (error) throw error;
    return data as LectureSummary[];
  },

  /** Lectures in a folder ('all', 'none' or a folder id) with what's needed to study them. */
  async studyMaterial(folder: string): Promise<StudyLecture[]> {
    if (!supabase) {
      return readDemo()
        .filter((l) => folder === 'all' || (folder === 'none' ? !l.folder_id : l.folder_id === folder))
        .filter((l) => l.status === 'ready');
    }
    let q = supabase.from('lectures').select('id, title, created_at, status, folder_id, flashcards, quiz').eq('status', 'ready');
    if (folder === 'none') q = q.is('folder_id', null);
    else if (folder !== 'all') q = q.eq('folder_id', folder);
    const { data, error } = await q.order('created_at');
    if (error) throw error;
    return data as StudyLecture[];
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
