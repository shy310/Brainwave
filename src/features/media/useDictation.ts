import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@shared/locales';

// The browser's own speech recognition (Chrome, Edge, Safari). Where it is
// missing, the question is typed instead.

interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const LANG: Record<Locale, string> = { en: 'en-US', he: 'he-IL', ar: 'ar-SA', ru: 'ru-RU' };

/** Speak instead of typing: `text` fills in as you talk; `onDone` gets the final words. */
export const useDictation = (locale: Locale) => {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [denied, setDenied] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const supported = !!ctor();

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback((onDone: (words: string) => void) => {
    const Ctor = ctor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = LANG[locale];
    r.interimResults = true;
    r.continuous = false;
    let words = '';
    r.onresult = (e) => {
      words = Array.from(e.results).map((res) => res[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
      setText(words);
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setDenied(true); };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      if (words) onDone(words);
    };
    rec.current = r;
    setText('');
    setDenied(false);
    setListening(true);
    try { r.start(); } catch { rec.current = null; setListening(false); }
  }, [locale]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, text, denied, start, stop };
};
