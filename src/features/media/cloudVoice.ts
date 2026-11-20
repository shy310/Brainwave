// Natural narration voices served by our API (Microsoft Azure neural voices).
// Audio is fetched one sentence at a time, prefetched ahead, and kept in the
// browser's Cache Storage so replaying a lesson costs nothing.

import { useEffect, useState } from 'react';
import { ApiError, fetchSpeech } from '@/lib/api';
import { encodeWav } from '@/features/lectures/audio';
import type { CloudVoice } from '@shared/tts';

let available: Promise<boolean> | null = null;
let broken = false;
const listeners = new Set<() => void>();

/** Does the server offer natural voices? Asked once per page load. */
export const cloudVoicesAvailable = (): Promise<boolean> => {
  available ??= fetch('/api/health').then((r) => r.json()).then((h: { tts?: boolean }) => Boolean(h.tts)).catch(() => false);
  return available;
};

/** Stop using natural voices for this session (no credit, not configured, daily allowance used). */
export const markCloudBroken = () => { broken = true; listeners.forEach((l) => l()); };

export const useCloudVoices = (): boolean => {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const update = () => { void cloudVoicesAvailable().then((v) => { if (alive) setOk(v && !broken); }); };
    update();
    listeners.add(update);
    return () => { alive = false; listeners.delete(update); };
  }, []);
  return ok;
};

const memory = new Map<string, Promise<Blob>>();
const CACHE = 'bw-tts-v1';

const cacheKey = async (voice: string, text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voice}|${text}`));
  return `/__tts/${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}.mp3`;
};

/** Get (and remember) the MP3 for one sentence. */
export const loadSpeech = (text: string, voice: CloudVoice): Promise<Blob> => {
  const k = `${voice}|${text}`;
  const hit = memory.get(k);
  if (hit) return hit;
  const p = (async () => {
    let url = '';
    try {
      url = await cacheKey(voice, text);
      const cached = await (await caches.open(CACHE)).match(url);
      if (cached) return await cached.blob();
    } catch { /* Cache Storage unavailable */ }
    const blob = await fetchSpeech(text, voice);
    try { if (url) await (await caches.open(CACHE)).put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })); } catch { /* ignore */ }
    return blob;
  })();
  p.catch((err) => {
    memory.delete(k);
    if (err instanceof ApiError && [401, 402, 429, 503].includes(err.status)) markCloudBroken();
  });
  memory.set(k, p);
  if (memory.size > 300) memory.delete(memory.keys().next().value!);
  return p;
};

// One shared <audio> element. It is "unlocked" during a tap so phones allow
// later sentences to play automatically.
let shared: HTMLAudioElement | null = null;
export const audioElement = () => (shared ??= new Audio());

export const primeAudio = () => {
  const el = audioElement();
  if (el.dataset.primed) return;
  el.dataset.primed = '1';
  const url = URL.createObjectURL(new Blob([encodeWav(new Float32Array(800)).buffer as ArrayBuffer], { type: 'audio/wav' }));
  el.src = url;
  void el.play().catch(() => {}).finally(() => URL.revokeObjectURL(url));
};
