import { supabase } from '@/lib/supabase';
import { audioStore } from './audioStore';
import { storage } from '@/lib/storage';
import { track } from '@/features/stats/activity';
import type { SavedNotes } from './notesVersions';
import type { SearchableLecture } from '@shared/search';
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
  notes: SavedNotes | null;
  quiz: Quiz | null;
  flashcards: Flashcards | null;
  /** Set while the notes are shared by link (needs migration 0009). */
  share_token?: string | null;
  /** The folder it's in, if any (needs migration 0007). */
  folder_id?: string | null;
  /** The kept recording (needs migration 0016): a Supabase Storage path, or `local:<id>` for demo lectures. */
  audio_path?: string | null;
  audio_type?: string | null;
  audio_bytes?: number | null;
  /** Moments marked as important while recording, in seconds (needs migration 0021). */
  marks?: number[] | null;
  /** Starred in the library (needs migration 0019). */
  favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export type LectureSummary = Pick<Lecture, 'id' | 'title' | 'source' | 'status' | 'duration_sec' | 'created_at' | 'folder_id' | 'favorite'>;
export type NewLecture = Pick<Lecture, 'title' | 'source' | 'language'> & Partial<Pick<Lecture, 'segments' | 'slides_text' | 'status' | 'duration_sec' | 'folder_id'>>;
/** What a share link shows: the notes and flashcards, nothing else. */
export interface SharedLecture { title: string; source: LectureSource; notes: Notes; flashcards: Flashcards | null; created_at: string }

/** A long random token for a share link (128 bits, URL-safe). */
export const newShareToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

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
    // Newest columns first; fall back when a migration hasn't been run yet.
    for (const cols of [`${LIST_COLUMNS}, folder_id, favorite`, `${LIST_COLUMNS}, folder_id`, LIST_COLUMNS]) {
      const { data, error } = await supabase.from('lectures').select(cols).order('created_at', { ascending: false });
      if (missingColumn(error)) continue;
      if (error) throw error;
      return data as unknown as LectureSummary[];
    }
    return [];
  },

  /** Every lecture's transcript and notes, for searching across all of them. */
  async searchable(): Promise<SearchableLecture[]> {
    if (!supabase) return readDemo().map((l) => ({ id: l.id, title: l.title, segments: l.segments, notes: l.notes, created_at: l.created_at }));
    const { data, error } = await supabase.from('lectures').select('id, title, segments, notes, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return data as SearchableLecture[];
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
      track({ lectures: 1 });
      return lecture;
    }
    let { data, error } = await supabase.from('lectures').insert(base).select('*').single();
    // Before migration 0008, the database only allows record/upload/text: save PDF and photo notes as text.
    if (error?.code === '23514' && (base.source === 'pdf' || base.source === 'image')) {
      ({ data, error } = await supabase.from('lectures').insert({ ...base, source: 'text' }).select('*').single());
    }
    if (error) throw error;
    track({ lectures: 1 });
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

  /** Turn on a share link. Needs an account (demo lectures live only in this browser). */
  async share(id: string): Promise<string> {
    if (!supabase) throw new Error('sharing-needs-account');
    const token = newShareToken();
    const { error } = await supabase.from('lectures').update({ share_token: token }).eq('id', id);
    if (error) throw error;
    return token;
  },

  async unshare(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('lectures').update({ share_token: null }).eq('id', id);
    if (error) throw error;
  },

  /** A shared lecture, for anyone with the link (no sign-in). */
  async getShared(token: string): Promise<SharedLecture | null> {
    if (!supabase || token.length < 20) return null;
    const { data, error } = await supabase.rpc('shared_lecture', { p_token: token });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as SharedLecture | undefined;
    return row ?? null;
  },

  /** Delete a lecture and its kept recording. */
  async remove(id: string): Promise<void> {
    if (!supabase) {
      writeDemo(readDemo().filter((l) => l.id !== id));
      if (audioStore.available()) await audioStore.deleteKept(id).catch(() => {});
      return;
    }
    // Storage files don't go with the row, so delete the recording first.
    const kept = await supabase.from('lectures').select('audio_path').eq('id', id).maybeSingle();
    const path = (kept.data as { audio_path?: string | null } | null)?.audio_path;
    if (path) {
      const { error } = await supabase.storage.from('lecture-audio').remove([path]);
      if (error) console.warn('Could not delete the recording', error);
    }
    const { error } = await supabase.from('lectures').delete().eq('id', id);
    if (error) throw error;
  },
};
