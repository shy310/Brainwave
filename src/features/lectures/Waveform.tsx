import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const BARS = 40;

/**
 * Keeps the last few seconds of microphone levels (0…1), one per bar. New
 * levels come in about ten times a second; the oldest drop off the start.
 */
export const useLevelHistory = (level: number, running: boolean) => {
  const [history, setHistory] = useState<number[]>([]);
  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    const now = performance.now();
    if (now - last.current < 90) return; // about 11 bars a second, whatever the level rate
    last.current = now;
    setHistory((h) => [...h.slice(-(BARS - 1)), level]);
  }, [level, running]);
  return history;
};

/** "Can we hear you?" from the last couple of seconds of levels. */
export const hearing = (history: number[]): 'good' | 'quiet' | 'starting' => {
  const recent = history.slice(-22);
  if (recent.length < 22) return 'starting';
  const loud = recent.filter((l) => l > 0.06).length;
  return loud >= 3 ? 'good' : 'quiet';
};

/** A moving sound wave: dots where nothing is recorded yet, bars for what was heard. */
export const Waveform = ({ history, paused }: { history: number[]; paused: boolean }) => {
  const slots = Array.from({ length: BARS }, (_, i) => history[history.length - BARS + i]);
  return (
    <div aria-hidden="true" dir="ltr" className={cn('flex h-28 items-center justify-center gap-[3px] transition-opacity duration-300', paused && 'opacity-40')}>
      {slots.map((l, i) => (
        l === undefined
          ? <span key={i} className="size-[3px] shrink-0 rounded-full bg-muted/40" />
          : (
            <span key={i} className="w-[3px] shrink-0 rounded-full bg-fg/80 transition-[height] duration-150 ease-out"
              // A floor so silence still shows as a line, and a curve so quiet speech is visible.
              style={{ height: `${Math.round(6 + Math.sqrt(Math.min(1, l)) * 106)}px` }} />
          )
      ))}
    </div>
  );
};
