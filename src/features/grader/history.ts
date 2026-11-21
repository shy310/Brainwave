import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { GradeAnswer } from '@shared/grading';

export interface Attempt { at: number; answer: string; grade: GradeAnswer }
export interface Task { id: string; question: string; rubric: string; attempts: Attempt[] }

const KEY = 'bw.grader.history';
export const MAX_TASKS = 20;
const MAX_ATTEMPTS = 10;

/** Same question (ignoring case and spacing) → same task, so attempts add up. */
export const taskId = (question: string) => {
  let h = 0x811c9dc5;
  for (const ch of question.trim().toLocaleLowerCase().replace(/\s+/g, ' ')) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

/** History saved in this browser (all of it in demo mode; a cache and offline copy otherwise). */
export const loadTasks = (): Task[] => {
  try { return JSON.parse(storage.get(KEY) ?? '[]') as Task[]; } catch { return []; }
};
const saveLocal = (tasks: Task[]) => storage.set(KEY, JSON.stringify(tasks));

const lastAt = (t: Task) => t.attempts.at(-1)?.at ?? 0;

/**
 * Combine two histories: one task per question, attempts from both (no
 * duplicates, oldest first, the last few kept), newest task first. Pure, for tests.
 */
export const mergeTasks = (a: Task[], b: Task[]): Task[] => {
  const byId = new Map<string, Task>();
  for (const t of [...a, ...b]) {
    const prev = byId.get(t.id);
    if (!prev) { byId.set(t.id, { ...t, attempts: [...t.attempts] }); continue; }
    const seen = new Set(prev.attempts.map((x) => `${x.at}|${x.answer}`));
    const attempts = [...prev.attempts, ...t.attempts.filter((x) => !seen.has(`${x.at}|${x.answer}`))]
      .sort((x, y) => x.at - y.at).slice(-MAX_ATTEMPTS);
    byId.set(t.id, { ...(lastAt(t) > lastAt(prev) ? t : prev), attempts });
  }
  return [...byId.values()].sort((x, y) => lastAt(y) - lastAt(x)).slice(0, MAX_TASKS);
};

/** Add an attempt; the task moves to the top. Keeps the last few tasks and attempts. Pure apart from the local copy. */
export const addAttempt = (tasks: Task[], question: string, rubric: string, attempt: Attempt): Task[] => {
  const id = taskId(question);
  const prev = tasks.find((t) => t.id === id);
  const task: Task = { id, question, rubric, attempts: [...(prev?.attempts ?? []), attempt].slice(-MAX_ATTEMPTS) };
  const next = [task, ...tasks.filter((t) => t.id !== id)].slice(0, MAX_TASKS);
  saveLocal(next);
  return next;
};

interface Row { task_id: string; question: string; rubric: string; attempts: Attempt[]; updated_at: string }
const toRow = (t: Task) => ({ task_id: t.id, question: t.question, rubric: t.rubric, attempts: t.attempts, updated_at: new Date(lastAt(t) || Date.now()).toISOString() });

/** "Grade my answer" history: in Supabase so it follows the student to every device; in this browser in demo mode. */
export const graderRepo = {
  /** The history from every device. Anything only in this browser is uploaded once. */
  async list(): Promise<Task[]> {
    const local = loadTasks();
    if (!supabase) return local;
    const { data, error } = await supabase.from('grader_tasks').select('task_id, question, rubric, attempts, updated_at')
      .order('updated_at', { ascending: false }).limit(MAX_TASKS);
    if (error) { console.warn('Grader history unavailable (migration 0015 not run?)', error.message); return local; }
    const remote = (data as Row[]).map((r) => ({ id: r.task_id, question: r.question, rubric: r.rubric, attempts: r.attempts ?? [] }));
    const merged = mergeTasks(remote, local);
    const remoteById = new Map(remote.map((t) => [t.id, t]));
    const missing = merged.filter((t) => (remoteById.get(t.id)?.attempts.length ?? -1) < t.attempts.length);
    if (missing.length) {
      const { error: upErr } = await supabase.from('grader_tasks').upsert(missing.map(toRow));
      if (upErr) console.warn('Could not upload grader history', upErr.message);
    }
    saveLocal(merged);
    return merged;
  },

  /** Save one task after a new attempt; older tasks past the limit are removed. */
  async save(task: Task, all: Task[]) {
    if (!supabase) return;
    const { error } = await supabase.from('grader_tasks').upsert(toRow(task));
    if (error) { console.warn('Could not save grader history', error.message); return; }
    const keep = new Set(all.slice(0, MAX_TASKS).map((t) => t.id));
    const { data } = await supabase.from('grader_tasks').select('task_id');
    const stale = ((data ?? []) as { task_id: string }[]).map((r) => r.task_id).filter((id) => !keep.has(id));
    if (stale.length) await supabase.from('grader_tasks').delete().in('task_id', stale);
  },
};
