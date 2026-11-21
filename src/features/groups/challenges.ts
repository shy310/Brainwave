import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { utcDay, weekStart, type BoardRow } from '@shared/challenge';
import { groupsRepo } from './groupsRepo';

export type Game = 'glide' | 'rush';

// Demo mode: one student, so the boards live in this browser.
interface DemoScores { [k: string]: number } // `${groupId}|${week}|${game}` → best
interface DemoDaily { [k: string]: boolean } // `${groupId}|${day}` → correct
const SCORES = 'bw.groupScores', DAILY = 'bw.groupDaily';
const read = <T,>(k: string): T => { try { return JSON.parse(storage.get(k) ?? '{}') as T; } catch { return {} as T; } };

/** A finished game: its score goes on this week's board of every group the student is in. Never throws. */
export const submitGameScore = async (game: Game, score: number): Promise<void> => {
  try {
    if (!supabase) {
      const groups = await groupsRepo.list();
      if (!groups.length) return;
      const s = read<DemoScores>(SCORES);
      for (const g of groups) { const k = `${g.id}|${weekStart()}|${game}`; s[k] = Math.max(s[k] ?? 0, score); }
      storage.set(SCORES, JSON.stringify(s));
      return;
    }
    const { error } = await supabase.rpc('submit_game_score', { p_game: game, p_score: Math.max(0, Math.round(score)) });
    if (error) console.warn('Score not posted to groups (migration 0024 not run?)', error.message);
  } catch (err) { console.warn('Score not posted to groups', err); }
};

/** This week's best scores in a group, per game. */
export const loadBoard = async (groupId: string, me: { id: string; name: string }): Promise<Record<Game, BoardRow[]>> => {
  const empty: Record<Game, BoardRow[]> = { glide: [], rush: [] };
  if (!supabase) {
    const s = read<DemoScores>(SCORES);
    for (const game of ['glide', 'rush'] as const) {
      const best = s[`${groupId}|${weekStart()}|${game}`];
      if (best !== undefined) empty[game] = [{ userId: me.id, name: me.name, best }];
    }
    return empty;
  }
  const { data, error } = await supabase.from('group_scores').select('user_id, display_name, game, best').eq('group_id', groupId).eq('week', weekStart());
  if (error) return empty;
  for (const r of data as { user_id: string; display_name: string; game: Game; best: number }[]) empty[r.game]?.push({ userId: r.user_id, name: r.display_name, best: r.best });
  return empty;
};

export interface DailyAnswer { userId: string; name: string; correct: boolean }

/** Who answered the group's question today. */
export const loadDaily = async (groupId: string, me: { id: string; name: string }): Promise<DailyAnswer[]> => {
  if (!supabase) {
    const v = read<DemoDaily>(DAILY)[`${groupId}|${utcDay()}`];
    return v === undefined ? [] : [{ userId: me.id, name: me.name, correct: v }];
  }
  const { data, error } = await supabase.from('group_daily').select('user_id, display_name, correct').eq('group_id', groupId).eq('day', utcDay());
  if (error) return [];
  return (data as { user_id: string; display_name: string; correct: boolean }[]).map((r) => ({ userId: r.user_id, name: r.display_name, correct: r.correct }));
};

export const answerDaily = async (groupId: string, correct: boolean): Promise<void> => {
  if (!supabase) {
    const d = read<DemoDaily>(DAILY);
    const k = `${groupId}|${utcDay()}`;
    if (d[k] === undefined) d[k] = correct;
    storage.set(DAILY, JSON.stringify(d));
    return;
  }
  const { error } = await supabase.rpc('answer_group_daily', { p_group: groupId, p_correct: correct });
  if (error) throw error;
};
