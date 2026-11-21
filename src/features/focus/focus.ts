// Focus mode: a study timer that hides distractions. The state lives in this
// browser (it survives reloads and page changes); focused minutes count as
// study time.

import { useSyncExternalStore } from 'react';
import { storage } from '@/lib/storage';

export const FOCUS_CHOICES = [25, 50] as const;
export const BREAK_MINUTES = 5;

export type FocusPhase = 'focus' | 'break' | 'focusDone' | 'breakDone';
export interface FocusState {
  phase: FocusPhase;
  /** When the running phase ends (ms). Unused while paused or done. */
  endsAt: number;
  /** Remaining ms while paused, else null. */
  pausedLeft: number | null;
  /** Length of the focus phase (ms). */
  focusMs: number;
  /** Focus time already counted as study minutes (ms). */
  credited: number;
}

const MIN = 60_000;

/** Pure state changes, for tests. */
export const focusLogic = {
  start: (minutes: number, now: number): FocusState => ({ phase: 'focus', endsAt: now + minutes * MIN, pausedLeft: null, focusMs: minutes * MIN, credited: 0 }),
  left: (s: FocusState, now: number) => (s.pausedLeft ?? Math.max(0, s.endsAt - now)),
  pause: (s: FocusState, now: number): FocusState => (s.pausedLeft !== null ? s : { ...s, pausedLeft: Math.max(0, s.endsAt - now) }),
  resume: (s: FocusState, now: number): FocusState => (s.pausedLeft === null ? s : { ...s, endsAt: now + s.pausedLeft, pausedLeft: null }),
  /** How much focus time has passed (ms). */
  focused: (s: FocusState, now: number) => (s.phase === 'focus' ? s.focusMs - focusLogic.left(s, now) : s.focusMs),
  /** Whole new minutes of focus not yet counted. */
  newMinutes: (s: FocusState, now: number) => Math.floor((focusLogic.focused(s, now) - s.credited) / MIN),
  /** A running phase whose time is up moves to its "done" phase. */
  tick: (s: FocusState, now: number): FocusState => {
    if (s.pausedLeft !== null || now < s.endsAt) return s;
    if (s.phase === 'focus') return { ...s, phase: 'focusDone' };
    if (s.phase === 'break') return { ...s, phase: 'breakDone' };
    return s;
  },
  startBreak: (s: FocusState, now: number): FocusState => ({ ...s, phase: 'break', endsAt: now + BREAK_MINUTES * MIN, pausedLeft: null }),
};

// ── Store (one per tab, kept in localStorage) ──
const KEY = 'bw.focus';
const read = (): FocusState | null => { try { return JSON.parse(storage.get(KEY) ?? 'null') as FocusState | null; } catch { return null; } };
let state: FocusState | null = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const focusStore = {
  get: () => state,
  set(next: FocusState | null) {
    state = next;
    if (next) storage.set(KEY, JSON.stringify(next)); else storage.remove(KEY);
    emit();
  },
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
};

export const useFocus = () => useSyncExternalStore(focusStore.subscribe, focusStore.get, () => null);

/** True while a focus phase is running: the regular study timer leaves those minutes to focus mode. */
export const isFocusing = () => state?.phase === 'focus' && state.pausedLeft === null;
