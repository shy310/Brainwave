import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { mistakeKey, recordAnswer, type Mistake } from '@shared/mistakes';
import type { Question } from '@shared/learn';

const DEMO_KEY = 'bw.mistakes';
const readDemo = (): Record<string, Mistake> => { try { return JSON.parse(storage.get(DEMO_KEY) ?? '{}') as Record<string, Mistake>; } catch { return {}; } };

interface Row { key: string; lecture_id: string | null; question: Question; wrong: number; streak: number; last_wrong: string; resolved: boolean }
const fromRow = (r: Row): Mistake => ({ key: r.key, lectureId: r.lecture_id, question: r.question, wrong: r.wrong, streak: r.streak, lastWrong: Date.parse(r.last_wrong), resolved: r.resolved });
const toRow = (m: Mistake) => ({ key: m.key, lecture_id: m.lectureId, question: m.question, wrong: m.wrong, streak: m.streak, last_wrong: new Date(m.lastWrong).toISOString(), resolved: m.resolved });

/** Missed questions: in Supabase, or this browser in demo mode. */
export const mistakeRepo = {
  async list(): Promise<Mistake[]> {
    if (!supabase) return Object.values(readDemo());
    const { data, error } = await supabase.from('mistakes').select('key, lecture_id, question, wrong, streak, last_wrong, resolved');
    if (error) { console.warn('Weak spots unavailable (migration 0022 not run?)', error.message); return []; }
    return (data as Row[]).map(fromRow);
  },
  async save(m: Mistake): Promise<void> {
    if (!supabase) { storage.set(DEMO_KEY, JSON.stringify({ ...readDemo(), [m.key]: m })); return; }
    const { error } = await supabase.from('mistakes').upsert(toRow(m));
    if (error) console.warn('Could not save the weak spot', error.message);
  },
};

let cache: Promise<Map<string, Mistake>> | null = null;
const all = () => (cache ??= mistakeRepo.list().then((l) => new Map(l.map((m) => [m.key, m]))).catch(() => new Map()));
/** Forget the cached list (after signing out, in tests). */
export const resetMistakes = () => { cache = null; };

/**
 * Remember how a quiz question went: a miss becomes a weak spot, right
 * answers count toward clearing it. Never throws (a quiz shouldn't fail
 * because this couldn't be saved).
 */
export const recordQuizAnswer = async (question: Question, lectureId: string | null, correct: boolean): Promise<void> => {
  try {
    const map = await all();
    const key = mistakeKey(lectureId, question.prompt);
    const next = recordAnswer(map.get(key), question, lectureId, correct, Date.now());
    if (!next) return;
    map.set(key, next);
    window.dispatchEvent(new Event('bw-mistakes'));
    await mistakeRepo.save(next);
  } catch (err) { console.warn('Could not record the answer', err); }
};

export const loadMistakes = async (): Promise<Mistake[]> => [...(await all()).values()];
