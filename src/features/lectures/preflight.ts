// Before an uploaded file is decoded (which holds the whole recording in
// memory), read its length from the media metadata, tell the student what it
// will cost, and refuse files this device can't handle.

import { storage } from '@/lib/storage';
import { CHUNK_SECONDS, MAX_CHUNK_SECONDS } from '@shared/lectures';

/** Read the duration of an audio or video file without decoding it. Null if unknown. */
export const probeDuration = (file: Blob, timeoutMs = 15_000): Promise<number | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    let settled = false;
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    el.onerror = () => done(null);
    el.src = url;
  });

/**
 * Longest recording (minutes) this device can safely decode in the browser.
 * Decoding keeps the whole recording in memory, which can crash a phone.
 */
export const inBrowserMaxMinutes = (deviceMemoryGb?: number): number => {
  const override = Number(storage.get('bw.test.uploadMaxMinutes'));
  if (override > 0) return override;
  if (deviceMemoryGb == null) return 30; // Safari and Firefox don't say; stay careful
  if (deviceMemoryGb >= 8) return 120;
  if (deviceMemoryGb >= 4) return 45;
  return 20;
};

export interface UploadPlan {
  /** Null when the length couldn't be read from the metadata. */
  minutes: number | null;
  mb: number;
  /** AI units (one per piece of about a minute). */
  units: number | null;
  /** Rough minutes to transcribe: 3 pieces at a time, ~12 s each. */
  etaMinutes: number | null;
  maxMinutes: number;
  allowed: boolean;
  long: boolean;
}

export const planUpload = (durationSec: number | null, bytes: number, maxMinutes: number): UploadPlan => {
  const mb = Math.max(1, Math.round(bytes / (1024 * 1024)));
  if (durationSec == null) return { minutes: null, mb, units: null, etaMinutes: null, maxMinutes, allowed: true, long: false };
  const minutes = Math.max(1, Math.round(durationSec / 60));
  // Pieces end between 50 and 70 s, and the last one can be up to 70 s.
  const pieces = Math.max(1, Math.ceil((durationSec - (MAX_CHUNK_SECONDS - CHUNK_SECONDS)) / CHUNK_SECONDS));
  return {
    minutes, mb, units: pieces,
    etaMinutes: Math.max(1, Math.ceil((Math.ceil(pieces / 3) * 12) / 60)),
    maxMinutes,
    allowed: durationSec <= maxMinutes * 60 + 30,
    long: minutes >= 20,
  };
};
