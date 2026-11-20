import { storage } from '@/lib/storage';
import type { GradeAnswer } from '@shared/grading';

export interface Attempt { at: number; answer: string; grade: GradeAnswer }
export interface Task { id: string; question: string; rubric: string; attempts: Attempt[] }

const KEY = 'bw.grader.history';
const MAX_TASKS = 20, MAX_ATTEMPTS = 10;

/** Same question (ignoring case and spacing) → same task, so attempts add up. */
export const taskId = (question: string) => {
  let h = 0x811c9dc5;
  for (const ch of question.trim().toLocaleLowerCase().replace(/\s+/g, ' ')) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

export const loadTasks = (): Task[] => {
  try { return JSON.parse(storage.get(KEY) ?? '[]') as Task[]; } catch { return []; }
};

/** Add an attempt; the task moves to the top. Keeps the last few tasks and attempts. */
export const addAttempt = (tasks: Task[], question: string, rubric: string, attempt: Attempt): Task[] => {
  const id = taskId(question);
  const prev = tasks.find((t) => t.id === id);
  const task: Task = { id, question, rubric, attempts: [...(prev?.attempts ?? []), attempt].slice(-MAX_ATTEMPTS) };
  const next = [task, ...tasks.filter((t) => t.id !== id)].slice(0, MAX_TASKS);
  storage.set(KEY, JSON.stringify(next));
  return next;
};
