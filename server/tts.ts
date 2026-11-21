import type { Response } from 'express';
import type { AuthedRequest } from './auth.js';
import { env, ttsService } from './env.js';
import { TtsInputSchema, VOICE_PAIRS, type CloudVoice } from '../shared/tts.js';

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

/** The OpenRouter voice for one of our voice slots: the first or second voice of its language. */
export const openRouterVoice = (voice: CloudVoice) => {
  const second = Object.values(VOICE_PAIRS).some((pair) => pair[1] === voice);
  return env.ttsVoices[second ? 1 : 0] ?? env.ttsVoices[0];
};

const fail = (res: Response, upstreamStatus: number) => {
  // 402 (no credit) and 429 tell the browser to switch to device voices for this visit.
  const status = upstreamStatus === 429 ? 429 : upstreamStatus === 402 ? 402 : upstreamStatus === 401 || upstreamStatus === 403 ? 503 : 502;
  return res.status(status).json({ error: 'The voice service had a problem.', code: upstreamStatus });
};

const azureSpeech = (text: string, voice: CloudVoice) =>
  fetch(`https://${env.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.azureSpeechKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'BrainWave',
    },
    body: ssml(text, voice),
  });

/** OpenRouter's OpenAI-compatible speech endpoint; it answers with the MP3 bytes. */
const openRouterSpeech = (text: string, voice: CloudVoice) =>
  fetch(process.env.OPENROUTER_TTS_URL ?? env.openrouterUrl.replace(/\/chat\/completions\/?$/, '/audio/speech'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openrouterKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'BrainWave',
    },
    body: JSON.stringify({ model: env.ttsModel, input: text, voice: openRouterVoice(voice), response_format: 'mp3' }),
  });

/** POST /api/tts — turn one sentence or line into MP3 with a natural voice. */
export const ttsHandler = async (req: AuthedRequest, res: Response) => {
  const service = ttsService();
  if (!service) return res.status(503).json({ error: 'Natural voices are not set up on this server.' });
  const parsed = TtsInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request.' });
  const { text, voice } = parsed.data;

  if (!req.demo && !(await consumeTts(req.userId!, text.length))) {
    return res.status(429).json({ error: 'You have used today’s narration allowance. The device voice will be used instead.' });
  }

  try {
    const upstream = await (service === 'azure' ? azureSpeech(text, voice) : openRouterSpeech(text, voice));
    if (!upstream.ok) {
      console.error(`TTS error (${service})`, upstream.status, (await upstream.text().catch(() => '')).slice(0, 300));
      return fail(res, upstream.status);
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') ?? '';
    if (!audio.length || /json|text/.test(type)) {
      console.error(`TTS answered without audio (${service})`, type, audio.toString('utf8', 0, 300));
      return fail(res, 502);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.send(audio);
  } catch (err) {
    console.error(`TTS failed (${service})`, err);
    return res.status(502).json({ error: 'The voice service had a problem.' });
  }
};

