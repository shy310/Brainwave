import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { ClassSlot } from '@shared/schedule';

const DEMO_KEY = 'bw.classSlots';
const readDemo = (): ClassSlot[] => { try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as ClassSlot[]; } catch { return []; } };
const writeDemo = (all: ClassSlot[]) => storage.set(DEMO_KEY, JSON.stringify(all));

interface Row { id: string; name: string; weekday: number; starts: string; ends: string; folder_id: string | null; remind_minutes: number }
const fromRow = (r: Row): ClassSlot => ({ id: r.id, name: r.name, weekday: r.weekday, starts: r.starts, ends: r.ends, folderId: r.folder_id, remindMinutes: r.remind_minutes });
const toRow = (s: Omit<ClassSlot, 'id'>) => ({ name: s.name, weekday: s.weekday, starts: s.starts, ends: s.ends, folder_id: s.folderId, remind_minutes: s.remindMinutes });
const order = (a: ClassSlot, b: ClassSlot) => a.weekday - b.weekday || a.starts.localeCompare(b.starts);

/** The class timetable: Supabase, or this browser in demo mode. */
export const scheduleRepo = {
  async list(): Promise<ClassSlot[]> {
    if (!supabase) return readDemo().sort(order);
    const { data, error } = await supabase.from('class_slots').select('id, name, weekday, starts, ends, folder_id, remind_minutes');
    if (error) { console.warn('Class schedule unavailable (migration 0012 not run?)', error.message); return []; }
    return (data as Row[]).map(fromRow).sort(order);
  },
  async save(slot: Omit<ClassSlot, 'id'> & { id?: string }): Promise<ClassSlot> {
    if (!supabase) {
      const saved = { ...slot, id: slot.id ?? crypto.randomUUID() } as ClassSlot;
      writeDemo([...readDemo().filter((s) => s.id !== saved.id), saved]);
      return saved;
    }
    const q = slot.id
      ? supabase.from('class_slots').update(toRow(slot)).eq('id', slot.id)
      : supabase.from('class_slots').insert(toRow(slot));
    const { data, error } = await q.select('id, name, weekday, starts, ends, folder_id, remind_minutes').single();
    if (error) throw error;
    return fromRow(data as Row);
  },
  async remove(id: string) {
    if (!supabase) { writeDemo(readDemo().filter((s) => s.id !== id)); return; }
    const { error } = await supabase.from('class_slots').delete().eq('id', id);
    if (error) throw error;
  },
};
