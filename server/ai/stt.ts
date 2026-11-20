import { env } from '../env.js';
import { AiError } from './openrouter.js';

// Dedicated speech-to-text through OpenRouter's /audio/transcriptions endpoint.
// Same key as chat completions. Audio is sent as raw base64 (not a data URL).

export interface SttSegment { start: number; end: number; text: string }
export interface SttResult {
  text: string;
  /** What the provider charged, in USD, when it reports it. */
  cost: number | null;
  /** Seconds of audio billed, when reported. */
  seconds: number | null;
  /** Timestamps within the audio, when the model returns them (verbose_json). */
  segments: SttSegment[];
}

export interface SttRequest {
  model: string;
  /** Raw base64 audio. */
  audio?: string;
  /** Or a URL the provider downloads itself (only some providers support it). */
  url?: string;
  format?: 'wav' | 'mp3' | 'm4a' | 'ogg' | 'webm';
  /** ISO-639-1 code; omit to let the model detect it. */
  language?: string;
  /** Context that improves accuracy: lecture topic and key terms. */
  prompt?: string;
}

export const sttUrl = () =>
  process.env.OPENROUTER_STT_URL ?? env.openrouterUrl.replace(/\/chat\/completions\/?$/, '/audio/transcriptions');

interface RawResponse {
  text?: string;
  segments?: { start?: number; end?: number; text?: string }[];
  usage?: { cost?: number; seconds?: number; total_cost?: number };
}

/** Normalise the provider's reply. Exported for tests. */
export const parseStt = (raw: RawResponse): SttResult => ({
  text: (raw.text ?? '').trim(),
  cost: typeof raw.usage?.cost === 'number' ? raw.usage.cost : typeof raw.usage?.total_cost === 'number' ? raw.usage.total_cost : null,
  seconds: typeof raw.usage?.seconds === 'number' ? raw.usage.seconds : null,
  segments: (raw.segments ?? [])
    .filter((s) => typeof s.start === 'number' && typeof s.text === 'string')
    .map((s) => ({ start: s.start!, end: s.end ?? s.start!, text: s.text!.trim() })),
});

export const transcribeSpeech = async (r: SttRequest, key = env.openrouterKey, signal?: AbortSignal): Promise<SttResult> => {
  if (!key) throw new AiError('The AI service is not configured on the server.', 503);
  if (!r.audio === !r.url) throw new AiError('Send either audio or a URL.', 400);
  const body = {
    model: r.model,
    input_audio: r.url ? { url: r.url, format: r.format ?? 'wav' } : { data: r.audio, format: r.format ?? 'wav' },
    ...(r.language ? { language: r.language } : {}),
    ...(r.prompt ? { prompt: r.prompt.slice(0, 800) } : {}),
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
    temperature: 0,
  };
  const res = await fetch(sttUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://brainwave.app',
      'X-Title': 'BrainWave',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('OpenRouter transcription error', res.status, detail.slice(0, 600));
    if (res.status === 429) throw new AiError('The AI is busy right now. Please try again in a moment.', 429, 429);
    if (res.status === 402) throw new AiError('The AI account is out of credits.', 402, 402);
    if (res.status === 401 || res.status === 403) throw new AiError('The AI key was rejected by the provider.', 503, res.status);
    throw new AiError('Transcription had a problem. Please try again.', 502, res.status);
  }
  return parseStt((await res.json()) as RawResponse);
};
