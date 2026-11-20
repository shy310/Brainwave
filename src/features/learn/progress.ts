import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';

export interface TopicProgress {
  topic_id: string;
  lesson_done: boolean;
  quiz_attempts: number;
  best_score: number;
  last_score: number | null;
  practiced: number;
  updated_at: string;
}

export type ProgressMap = Record<string, TopicProgress>;
export type TopicStatus = 'new' | 'learning' | 'mastered';

export const MASTERY_SCORE = 80;

export const topicStatus = (p?: TopicProgress): TopicStatus => {
  if (!p) return 'new';
  if (p.best_score >= MASTERY_SCORE) return 'mastered';
  return p.lesson_done || p.quiz_attempts > 0 || p.practiced > 0 ? 'learning' : 'new';
};

/** Topics tried but not yet mastered, most recent first — fed to the tutor as context. */
export const weakTopics = (map: ProgressMap, limit = 5): string[] =>
  Object.values(map)
    .filter((p) => p.quiz_attempts > 0 && p.best_score < MASTERY_SCORE)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
    .map((p) => p.topic_id);

const empty = (topicId: string): TopicProgress => ({
  topic_id: topicId, lesson_done: false, quiz_attempts: 0, best_score: 0, last_score: null, practiced: 0,
  updated_at: new Date().toISOString(),
});

const DEMO_KEY = 'bw.progress';
const COLUMNS = 'topic_id, lesson_done, quiz_attempts, best_score, last_score, practiced, updated_at';

const readDemo = (): ProgressMap => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '{}') as ProgressMap; } catch { return {}; }
};

/** Progress lives in Supabase; in demo mode it lives in this browser. */
export const progressRepo = {
  async list(userId: string): Promise<ProgressMap> {
    if (!supabase) return readDemo();
    const { data, error } = await supabase.from('topic_progress').select(COLUMNS).eq('user_id', userId);
    if (error) throw error;
    return Object.fromEntries((data as TopicProgress[]).map((p) => [p.topic_id, p]));
  },

  async update(userId: string, current: TopicProgress | undefined, topicId: string,
    change: (p: TopicProgress) => TopicProgress): Promise<TopicProgress> {
    const next = { ...change(current ?? empty(topicId)), updated_at: new Date().toISOString() };
    if (!supabase) {
      const all = readDemo();
      all[topicId] = next;
      storage.set(DEMO_KEY, JSON.stringify(all));
      return next;
    }
    const { data, error } = await supabase
      .from('topic_progress')
      .upsert({ user_id: userId, ...next })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return data as TopicProgress;
  },
};
