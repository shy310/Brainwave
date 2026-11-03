import type { Response } from 'express';
import type { AuthedRequest } from './auth.js';
import { env, ttsConfigured } from './env.js';
import { TtsInputSchema } from '../shared/tts.js';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const ssml = (text: string, voice: string) => {
  const lang = voice.slice(0, 5);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
};

/** Per-student daily narration budget in characters, kept apart from the AI budget. */
const consumeTts = async (userId: string, chars: number): Promise<boolean> => {
  if (!env.supabaseServiceKey) return true;
  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/consume_tts`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceKey,
      ...(env.supabaseServiceKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${env.supabaseServiceKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user: userId, p_chars: chars, p_daily_chars: env.ttsDailyChars }),
  }).catch(() => null);
  if (!res?.ok) return true; // fail open (e.g. migration 0005 not run yet)
  return (await res.json()) === true;
};

/** POST /api/tts — turn one sentence or line into MP3 with a natural voice. */
export const ttsHandler = async (req: AuthedRequest, res: Response) => {
  if (!ttsConfigured()) return res.status(503).json({ error: 'Natural voices are not set up on this server.' });
  const parsed = TtsInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request.' });
  const { text, voice } = parsed.data;

  if (!req.demo && !(await consumeTts(req.userId!, text.length))) {
    return res.status(429).json({ error: 'You have used today’s narration allowance. The device voice will be used instead.' });
  }

  try {
    const upstream = await fetch(`https://${env.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.azureSpeechKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'BrainWave',
      },
      body: ssml(text, voice),
    });
    if (!upstream.ok) {
      console.error('Azure TTS error', upstream.status, (await upstream.text().catch(() => '')).slice(0, 300));
      const status = upstream.status === 429 ? 429 : upstream.status === 401 || upstream.status === 403 ? 503 : 502;
      return res.status(status).json({ error: 'The voice service had a problem.', code: upstream.status });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.send(audio);
  } catch (err) {
    console.error('Azure TTS failed', err);
    return res.status(502).json({ error: 'The voice service had a problem.' });
  }
};
