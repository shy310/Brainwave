import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { Exam } from '@shared/exam';
import type { StudyLecture } from '@/features/lectures/repo';

const DEMO_KEY = 'bw.exams';
const readDemo = (): Exam[] => { try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as Exam[]; } catch { return []; } };
const writeDemo = (all: Exam[]) => storage.set(DEMO_KEY, JSON.stringify(all));

interface Row { id: string; title: string; exam_date: string; folder_id: string | null; lecture_ids: string[]; best_score: number | null; attempts: number; prediction?: Exam['prediction'] }
const BASE = 'id, title, exam_date, folder_id, lecture_ids, best_score, attempts';
/** With the prediction (migration 0028); falls back to without it if that hasn't run yet. */
const COLUMNS = `${BASE}, prediction`;
const fromRow = (r: Row): Exam => ({ id: r.id, title: r.title, date: r.exam_date, folderId: r.folder_id, lectureIds: r.lecture_ids ?? [], bestScore: r.best_score, attempts: r.attempts, prediction: r.prediction ?? null });
const toRow = (e: Omit<Exam, 'id'>) => ({ title: e.title, exam_date: e.date, folder_id: e.folderId, lecture_ids: e.lectureIds, best_score: e.bestScore, attempts: e.attempts });
const byDate = (a: Exam, b: Exam) => a.date.localeCompare(b.date);

export type NewExam = Pick<Exam, 'title' | 'date' | 'folderId' | 'lectureIds'>;

/** Exams: in Supabase, or this browser in demo mode. */
export const examRepo = {
  async list(): Promise<Exam[]> {
    if (!supabase) return readDemo().sort(byDate);
    let { data, error } = await supabase.from('exams').select(COLUMNS);
    if (error) ({ data, error } = await supabase.from('exams').select(BASE));
    if (error) { console.warn('Exams unavailable (migration 0020 not run?)', error.message); return []; }
    return (data as Row[]).map(fromRow).sort(byDate);
  },
  async get(id: string): Promise<Exam | null> {
    if (!supabase) return readDemo().find((e) => e.id === id) ?? null;
    let { data, error } = await supabase.from('exams').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) ({ data, error } = await supabase.from('exams').select(BASE).eq('id', id).maybeSingle());
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  },
  async create(e: NewExam): Promise<Exam> {
    const full = { ...e, bestScore: null, attempts: 0 };
    if (!supabase) {
      const saved: Exam = { ...full, id: crypto.randomUUID() };
      writeDemo([...readDemo(), saved]);
      return saved;
    }
    const { data, error } = await supabase.from('exams').insert(toRow(full)).select(BASE).single();
    if (error) throw error;
    return fromRow(data as Row);
  },
  async update(id: string, patch: Partial<Omit<Exam, 'id'>>): Promise<void> {
    if (!supabase) { writeDemo(readDemo().map((e) => (e.id === id ? { ...e, ...patch } : e))); return; }
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.date !== undefined) row.exam_date = patch.date;
    if (patch.folderId !== undefined) row.folder_id = patch.folderId;
    if (patch.lectureIds !== undefined) row.lecture_ids = patch.lectureIds;
    if (patch.bestScore !== undefined) row.best_score = patch.bestScore;
    if (patch.attempts !== undefined) row.attempts = patch.attempts;
    if (patch.prediction !== undefined) row.prediction = patch.prediction;
    const { error } = await supabase.from('exams').update(row).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!supabase) { writeDemo(readDemo().filter((e) => e.id !== id)); return; }
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) throw error;
  },
};

/** The lectures an exam covers: the picked ones, or its folder, or all of them. */
export const examLectures = (exam: Pick<Exam, 'folderId' | 'lectureIds'>, pool: StudyLecture[]): StudyLecture[] => {
  if (exam.lectureIds.length) {
    const ids = new Set(exam.lectureIds);
    return pool.filter((l) => ids.has(l.id));
  }
  return exam.folderId ? pool.filter((l) => l.folder_id === exam.folderId) : pool;
};
