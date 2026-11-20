import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { bumpDay, localDay, type ActivityDelta, type DayActivity } from '@shared/activity';

const DEMO_KEY = 'bw.studyDays';
const readDemo = (): DayActivity[] => {
  try { return JSON.parse(storage.get(DEMO_KEY) ?? '[]') as DayActivity[]; } catch { return []; }
};

/** Study activity per day, in Supabase or (demo mode) this browser. Failures never interrupt studying. */
export const activityRepo = {
  async bump(delta: ActivityDelta) {
    const day = localDay();
    if (!supabase) { storage.set(DEMO_KEY, JSON.stringify(bumpDay(readDemo(), day, delta))); return; }
    const { error } = await supabase.rpc('bump_study_day', {
      p_day: day, p_minutes: delta.minutes ?? 0, p_cards: delta.cards ?? 0, p_quizzes: delta.quizzes ?? 0, p_lectures: delta.lectures ?? 0,
    });
    if (error) console.warn('Study activity not saved (migration 0011 not run?)', error.message);
  },

  async list(sinceDays = 400): Promise<DayActivity[]> {
    if (!supabase) return readDemo();
    const since = new Date(); since.setDate(since.getDate() - sinceDays);
    const { data, error } = await supabase.from('study_days').select('day, minutes, cards, quizzes, lectures').gte('day', localDay(since)).order('day');
    if (error) { console.warn('Study activity unavailable', error.message); return []; }
    return data as DayActivity[];
  },
};

/** Record without waiting (study actions never wait for stats). */
export const track = (delta: ActivityDelta) => { void activityRepo.bump(delta).catch(() => {}); };

const IDLE_AFTER_MS = 2 * 60_000;

/**
 * Count minutes studied: time the app is visible and the student did
 * something (typed, tapped, scrolled) in the last two minutes.
 */
export const useStudyTimer = () => {
  useEffect(() => {
    let lastInput = Date.now();
    let activeMs = 0;
    let tick = Date.now();
    const onInput = () => { lastInput = Date.now(); };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    const id = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastInput < IDLE_AFTER_MS) activeMs += Math.min(now - tick, 15_000);
      tick = now;
      if (activeMs >= 60_000) { activeMs -= 60_000; track({ minutes: 1 }); }
    }, 5_000);
    return () => { clearInterval(id); events.forEach((e) => window.removeEventListener(e, onInput)); };
  }, []);
};
