import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { Deadline } from '@shared/syllabus';

const DEMO_KEY = 'bw.deadlines';
const readDemo = (): Deadline[] => { try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as Deadline[]; } catch { return []; } };
const writeDemo = (all: Deadline[]) => storage.set(DEMO_KEY, JSON.stringify(all));

interface Row { id: string; title: string; due_date: string; kind: Deadline['kind']; course: string | null; done: boolean }
const COLUMNS = 'id, title, due_date, kind, course, done';
const fromRow = (r: Row): Deadline => ({ id: r.id, title: r.title, date: r.due_date, kind: r.kind, course: r.course, done: r.done });
const byDate = (a: Deadline, b: Deadline) => a.date.localeCompare(b.date);

export type NewDeadline = Omit<Deadline, 'id' | 'done'>;

/** Deadlines (assignments, quizzes, projects): Supabase, or this browser in demo mode. */
export const deadlineRepo = {
  async list(): Promise<Deadline[]> {
    if (!supabase) return readDemo().sort(byDate);
    const { data, error } = await supabase.from('deadlines').select(COLUMNS);
    if (error) { console.warn('Deadlines unavailable (migration 0029 not run?)', error.message); return []; }
    return (data as Row[]).map(fromRow).sort(byDate);
  },
  async create(items: NewDeadline[]): Promise<Deadline[]> {
    if (!items.length) return [];
    if (!supabase) {
      const saved = items.map((d) => ({ ...d, id: crypto.randomUUID(), done: false }));
      writeDemo([...readDemo(), ...saved]);
      return saved;
    }
    const { data, error } = await supabase.from('deadlines')
      .insert(items.map((d) => ({ title: d.title.slice(0, 160), due_date: d.date, kind: d.kind, course: d.course?.slice(0, 120) || null })))
      .select(COLUMNS);
    if (error) throw error;
    return (data as Row[]).map(fromRow);
  },
  async update(id: string, patch: Partial<Pick<Deadline, 'done' | 'title' | 'date'>>): Promise<void> {
    if (!supabase) { writeDemo(readDemo().map((d) => (d.id === id ? { ...d, ...patch } : d))); return; }
    const row: Record<string, unknown> = {};
    if (patch.done !== undefined) row.done = patch.done;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.date !== undefined) row.due_date = patch.date;
    const { error } = await supabase.from('deadlines').update(row).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!supabase) { writeDemo(readDemo().filter((d) => d.id !== id)); return; }
    const { error } = await supabase.from('deadlines').delete().eq('id', id);
    if (error) throw error;
  },
};
