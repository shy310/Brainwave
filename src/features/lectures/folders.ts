import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';

export interface Folder { id: string; name: string; position: number; created_at: string }

const DEMO_KEY = 'bw.lectureFolders';
const readDemo = (): Folder[] => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as Folder[]; } catch { return []; }
};
const writeDemo = (all: Folder[]) => storage.set(DEMO_KEY, JSON.stringify(all));
const byPosition = (a: Folder, b: Folder) => a.position - b.position || a.created_at.localeCompare(b.created_at);

/** Lecture folders live in Supabase; in demo mode they live in this browser. */
export const folderRepo = {
  async list(): Promise<Folder[]> {
    if (!supabase) return readDemo().sort(byPosition);
    const { data, error } = await supabase.from('lecture_folders').select('id, name, position, created_at').order('position');
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return []; // folders migration not run yet
      throw error;
    }
    return (data as Folder[]).sort(byPosition);
  },

  async create(name: string, position: number): Promise<Folder> {
    const clean = name.trim().slice(0, 80);
    if (!supabase) {
      const folder: Folder = { id: crypto.randomUUID(), name: clean, position, created_at: new Date().toISOString() };
      writeDemo([...readDemo(), folder]);
      return folder;
    }
    const { data, error } = await supabase.from('lecture_folders').insert({ name: clean, position }).select('id, name, position, created_at').single();
    if (error) throw error;
    return data as Folder;
  },

  async rename(id: string, name: string) {
    const clean = name.trim().slice(0, 80);
    if (!supabase) { writeDemo(readDemo().map((f) => (f.id === id ? { ...f, name: clean } : f))); return; }
    const { error } = await supabase.from('lecture_folders').update({ name: clean }).eq('id', id);
    if (error) throw error;
  },

  /** Save a new order: positions follow the array. */
  async reorder(ids: string[]) {
    if (!supabase) {
      const all = readDemo();
      writeDemo(all.map((f) => ({ ...f, position: Math.max(0, ids.indexOf(f.id)) })));
      return;
    }
    const results = await Promise.all(ids.map((id, position) => supabase!.from('lecture_folders').update({ position }).eq('id', id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  },

  /** Delete a folder. Its lectures stay, outside any folder. */
  async remove(id: string) {
    if (!supabase) {
      writeDemo(readDemo().filter((f) => f.id !== id));
      // Demo lectures keep a folder_id; clear it like the database's "on delete set null".
      try {
        const lectures = JSON.parse(storage.get('bw.lectures') ?? '[]') as { folder_id?: string | null }[];
        storage.set('bw.lectures', JSON.stringify(lectures.map((l) => (l.folder_id === id ? { ...l, folder_id: null } : l))));
      } catch { /* ignore */ }
      return;
    }
    const { error } = await supabase.from('lecture_folders').delete().eq('id', id);
    if (error) throw error;
  },
};

export type SortKey = 'newest' | 'oldest' | 'title';

/** Search, filter by folder and sort the lecture list. Pure, for tests. */
export const arrangeLectures = <L extends { title: string; created_at: string; folder_id?: string | null; favorite?: boolean }>(
  items: L[], o: { query: string; folder: string | 'all' | 'none' | 'favorites'; sort: SortKey; untitled: (l: L) => string; locale: string },
): L[] => {
  const q = o.query.trim().toLocaleLowerCase();
  const name = (l: L) => (l.title || o.untitled(l));
  return items
    .filter((l) => o.folder === 'all' || (o.folder === 'favorites' ? !!l.favorite : o.folder === 'none' ? !l.folder_id : l.folder_id === o.folder))
    .filter((l) => !q || name(l).toLocaleLowerCase().includes(q))
    .sort((a, b) => {
      if (o.sort === 'title') return name(a).localeCompare(name(b), o.locale, { sensitivity: 'base', numeric: true });
      return o.sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at);
    });
};
