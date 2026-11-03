// Narration with the browser's built-in voices (free, works offline on most
// devices). When no suitable voice exists, playback falls back to a timer and
// captions, so lessons still play everywhere.

import { useEffect, useState } from 'react';
import type { Locale } from '@shared/locales';
import type { CloudVoice } from '@shared/tts';
import { audioElement, loadSpeech } from './cloudVoice';

/** A natural server voice, a built-in device voice, or none (timed captions). */
export type Voice = { cloud: CloudVoice } | SpeechSynthesisVoice | null;
const isCloud = (v: Voice): v is { cloud: CloudVoice } => Boolean(v && 'cloud' in v);

export const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Split narration into sentences so long texts don't get cut off and pausing is precise. */
export const splitSentences = (text: string): string[] => {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)\s*/g) ?? [];
  const out = parts.map((s) => s.trim()).filter(Boolean);
  return out.length ? out : [text.trim()].filter(Boolean);
};

/** How long a sentence takes to say, for timing captions when there is no voice. */
export const estimateMs = (text: string, rate = 1) => Math.max(1200, (text.split(/\s+/).length * 380) / rate + 250);

const matchesLocale = (v: SpeechSynthesisVoice, locale: Locale) => {
  const lang = v.lang.toLowerCase();
  return locale === 'he' ? lang.startsWith('he') || lang.startsWith('iw') : lang.startsWith('en');
};

const quality = (v: SpeechSynthesisVoice) =>
  (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) + (/google|microsoft/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);

/** The voices available for a language, best first. Loads asynchronously in some browsers. */
export const useVoices = (locale: Locale): SpeechSynthesisVoice[] => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!hasSpeech()) return;
    const load = () => setVoices(speechSynthesis.getVoices().filter((v) => matchesLocale(v, locale)).sort((a, b) => quality(b) - quality(a)));
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, [locale]);
  return voices;
};

/**
 * Say one sentence. Calls `onEnd` exactly once when it finishes (or when the
 * fallback timer runs out). Returns a function that stops it without calling onEnd.
 */
export const speak = (text: string, opts: { voice: Voice; rate: number; pitch?: number }, onEnd: () => void): (() => void) => {
  let done = false;
  let safety: ReturnType<typeof setTimeout> | undefined;
  const finish = () => { if (!done) { done = true; clearTimeout(safety); onEnd(); } };
  const expected = estimateMs(text, opts.rate);
  const voice = opts.voice;

  if (isCloud(voice)) {
    const audio = audioElement();
    let url = '';
    // If the natural voice fails, keep going with timed captions for this sentence.
    const fallback = () => { if (!done) { clearTimeout(safety); safety = setTimeout(finish, expected); } };
    safety = setTimeout(finish, expected * 3 + 15000);
    loadSpeech(text, voice.cloud).then((blob) => {
      if (done) return;
      url = URL.createObjectURL(blob);
      audio.onended = finish;
      audio.onerror = fallback;
      audio.src = url;
      audio.playbackRate = opts.rate;
      void audio.play().catch(fallback);
    }).catch(fallback);
    return () => {
      done = true;
      clearTimeout(safety);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      if (url) URL.revokeObjectURL(url);
    };
  }

  if (!voice || !hasSpeech()) {
    safety = setTimeout(finish, expected);
    return () => { done = true; clearTimeout(safety); };
  }

  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = opts.rate;
  u.pitch = opts.pitch ?? 1;
  u.onend = finish;
  u.onerror = finish;
  // Some browsers occasionally never fire onend — never let playback hang.
  safety = setTimeout(finish, expected * 2.5 + 4000);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return () => { done = true; clearTimeout(safety); speechSynthesis.cancel(); };
};

/** Start downloading a sentence before it is needed, so there is no gap. */
export const prefetch = (text: string, voice: Voice) => {
  if (isCloud(voice)) void loadSpeech(text, voice.cloud).catch(() => {});
};
