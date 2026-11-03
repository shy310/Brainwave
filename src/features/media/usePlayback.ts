import { useCallback, useEffect, useRef, useState } from 'react';
import { speak } from './speech';

export interface Unit { text: string; voice: SpeechSynthesisVoice | null; pitch?: number; pauseAfter?: number }

/**
 * Plays a list of text units one after another with speech (or timed captions),
 * and lets the UI pause, resume and jump. Resuming restarts the current sentence.
 */
export const usePlayback = (units: Unit[], rate: number) => {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const unitsRef = useRef(units);
  unitsRef.current = units;

  useEffect(() => {
    if (!playing) return;
    const unit = unitsRef.current[index];
    if (!unit) { setPlaying(false); setEnded(true); return; }
    let gap: ReturnType<typeof setTimeout> | undefined;
    const stop = speak(unit.text, { voice: unit.voice, rate, pitch: unit.pitch }, () => {
      gap = setTimeout(() => {
        if (index + 1 < unitsRef.current.length) setIndex(index + 1);
        else { setPlaying(false); setEnded(true); }
      }, unit.pauseAfter ?? 150);
    });
    return () => { stop(); clearTimeout(gap); };
  }, [playing, index, rate]);

  useEffect(() => () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); }, []);

  const play = useCallback(() => {
    if (ended) { setIndex(0); setEnded(false); }
    setPlaying(true);
  }, [ended]);
  const pause = useCallback(() => setPlaying(false), []);
  const seek = useCallback((i: number) => {
    setEnded(false);
    setIndex(Math.max(0, Math.min(i, unitsRef.current.length - 1)));
  }, []);

  return { index, playing, ended, play, pause, seek, toggle: playing ? pause : play };
};
