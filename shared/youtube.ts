// Lectures from a YouTube link: find the video id in any kind of link, and
// the shape of the transcript the AI writes from the video.
import { z } from 'zod';

/** The 11-character video id from a YouTube link (watch, youtu.be, shorts, embed, live, mobile), or null. */
export const youtubeId = (input: string): string | null => {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? (/^\/(shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname)?.[2] ?? null);
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
};

export const youtubeUrl = (id: string, at?: number) => `https://www.youtube.com/watch?v=${id}${at ? `&t=${Math.floor(at)}s` : ''}`;

export const YoutubeTranscriptInputSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/),
  /** The language spoken, if the student chose one ('auto' lets the AI tell). */
  language: z.enum(['auto', 'en', 'he', 'ar', 'ru']).default('auto'),
});

export const YoutubeTranscriptSchema = z.object({
  /** False when the video has no talking to transcribe (music, silence). */
  speech: z.boolean(),
  /** How long the video is, in seconds (0 if unknown). */
  length: z.number().min(0).default(0),
  /** Paragraphs, with where each starts in seconds. */
  segments: z.array(z.object({ start: z.number().min(0), text: z.string() })).max(600),
});

const MAX_PARAGRAPH = 1200;

/** 1:07 written as the number 107 → 67 seconds. */
const fromClock = (n: number) => Math.floor(n / 100) * 60 + (n % 100);
/**
 * Models sometimes write times as minutes and seconds run together (1:07 →
 * 107). Then no time ends in 61–99, which real seconds would do about 40% of
 * the time; with enough times past 100 that's a sure sign.
 */
export const looksLikeClock = (starts: number[]) => {
  const big = starts.filter((n) => n >= 100);
  return big.length >= 5 && big.filter((n) => Math.floor(n) % 100 > 60).length <= big.length * 0.05;
};

/**
 * Tidy the model's transcript: paragraphs in order; times that ran past the
 * end of the video squeezed back in; very long paragraphs split at sentence
 * ends, their times spread up to the next paragraph.
 */
export const tidyTranscript = (out: z.infer<typeof YoutubeTranscriptSchema>): YoutubeTranscript => {
  let segs = out.segments.map((s) => ({ start: s.start, text: s.text.trim() })).filter((s) => s.text).sort((a, b) => a.start - b.start);
  let length = out.length;
  if (looksLikeClock(segs.map((s) => s.start))) {
    segs = segs.map((s) => ({ ...s, start: fromClock(s.start) }));
    if (length % 100 <= 60) length = fromClock(length);
  }
  const last = segs.at(-1)?.start ?? 0;
  if (length > 0 && last > length) segs = segs.map((s) => ({ ...s, start: (s.start * length) / (last + 15) }));
  const split: { start: number; text: string }[] = [];
  segs.forEach((s, i) => {
    if (s.text.length <= MAX_PARAGRAPH) { split.push(s); return; }
    const end = segs[i + 1]?.start ?? Math.max(s.start + s.text.length / 15, length || 0);
    const sentences = s.text.match(/[^.!?。؟]+[.!?。؟]+["”’)\]]*\s*|[^.!?。؟]+$/g) ?? [s.text];
    const chunks: string[] = [];
    for (const sentence of sentences) {
      if (chunks.length && chunks.at(-1)!.length + sentence.length <= MAX_PARAGRAPH / 2) chunks[chunks.length - 1] += sentence;
      else chunks.push(sentence);
    }
    let done = 0;
    for (const c of chunks) {
      split.push({ start: s.start + ((end - s.start) * done) / s.text.length, text: c.trim() });
      done += c.length;
    }
  });
  const segments = split.filter((s) => s.text).map((s) => ({ start: Math.round(s.start * 10) / 10, text: s.text }));
  return { speech: out.speech && segments.length > 0, segments };
};

/** What the server sends back: paragraphs with start times in seconds. */
export interface YoutubeTranscript { speech: boolean; segments: { start: number; text: string }[] }
