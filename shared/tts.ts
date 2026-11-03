import { z } from 'zod';
import type { Locale } from './locales.js';

/** Natural voices offered through the server (Microsoft Azure neural voices). */
export const CLOUD_VOICES = ['en-US-AvaNeural', 'en-US-AndrewNeural', 'he-IL-HilaNeural', 'he-IL-AvriNeural'] as const;
export type CloudVoice = (typeof CLOUD_VOICES)[number];

/** [narrator / first host, second host] for each language. */
export const VOICE_PAIRS: Record<Locale, [CloudVoice, CloudVoice]> = {
  en: ['en-US-AvaNeural', 'en-US-AndrewNeural'],
  he: ['he-IL-HilaNeural', 'he-IL-AvriNeural'],
};

export const MAX_TTS_CHARS = 1500;

export const TtsInputSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
  voice: z.enum(CLOUD_VOICES),
});
export type TtsInput = z.infer<typeof TtsInputSchema>;
