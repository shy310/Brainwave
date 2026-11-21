// Web Push: reminders that reach the browser even when BrainWave is closed.
//
// The database (migration 0017) keeps the devices, the reminder times and a
// one-row config with the signing keys (VAPID) and the minute job's secret.
// Only this server reads that row, with the service key. The keys are made
// here the first time a student turns reminders on, so nobody handles them.

import type { Request, Response } from 'express';
import webpush from 'web-push';
import { env } from './env.js';
import type { AuthedRequest } from './auth.js';

interface Config { vapid_public: string | null; vapid_private: string | null; cron_secret: string }
interface Due { user_id: string; kind: 'study' | 'class'; locale: string; class_id: string | null; class_name: string | null; subscriptions: { endpoint: string; p256dh: string; auth: string }[] }

const headers = () => {
  const key = env.supabaseServiceKey;
  return { apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) };
};
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${env.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) } });

let cached: { config: Config; at: number } | null = null;

const readConfig = async (): Promise<Config | null> => {
  const res = await rest('push_config?select=vapid_public,vapid_private,cron_secret&id=eq.true');
  if (!res.ok) return null; // migration 0017 not run yet
  return ((await res.json()) as Config[])[0] ?? null;
};

/** The config row, with signing keys made on first use. Cached for five minutes. */
export const pushConfig = async (): Promise<Config | null> => {
  if (cached && Date.now() - cached.at < 5 * 60_000 && cached.config.vapid_public) return cached.config;
  let config = await readConfig();
  if (!config) return null;
  if (!config.vapid_public || !config.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    // Only fills empty keys: if two servers race, the first one's keys win and both read them back.
    await rest('push_config?id=eq.true&vapid_public=is.null', {
      method: 'PATCH', body: JSON.stringify({ vapid_public: keys.publicKey, vapid_private: keys.privateKey }),
    });
    config = await readConfig();
  }
  if (config) cached = { config, at: Date.now() };
  return config;
};

export const pushReady = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);

/** GET /api/push/key: the public key browsers subscribe with. */
export const pushKeyHandler = async (req: AuthedRequest, res: Response) => {
  if (req.demo || !pushReady()) return res.status(503).json({ error: 'Reminders on the website need an account and the server set up.' });
  const config = await pushConfig();
  if (!config?.vapid_public) return res.status(503).json({ error: 'Reminders are not set up on this server yet.' });
  return res.json({ publicKey: config.vapid_public });
};

const TEXT = {
  en: {
    study: { title: 'Time to study', body: 'A few minutes today keeps your streak going. Your cards are waiting.' },
    class: (name: string) => ({ title: `${name} starts soon`, body: 'Tap to record it and get notes when it ends.' }),
  },
  he: {
    study: { title: 'הגיע הזמן ללמוד', body: 'כמה דקות היום שומרות על הרצף. הכרטיסיות מחכות.' },
    class: (name: string) => ({ title: `${name} מתחיל בקרוב`, body: 'הקישו כדי להקליט ולקבל סיכום בסוף.' }),
  },
};

/** What a reminder says and where tapping it goes. Pure. */
export const reminderMessage = (d: Pick<Due, 'kind' | 'locale' | 'class_id' | 'class_name'>) => {
  const text = d.locale === 'he' ? TEXT.he : TEXT.en;
  if (d.kind === 'class') {
    return { ...text.class(d.class_name ?? ''), url: `/lectures/new?class=${encodeURIComponent(d.class_id ?? '')}`, tag: `class-${d.class_id}` };
  }
  return { ...text.study, url: '/lectures/review', tag: 'bw-study' };
};

/** A secret compared in constant time. */
const sameSecret = (a: string, b: string) => {
  if (a.length !== b.length || !a) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/**
 * POST /api/push/tick: called every minute by the database's job, with the
 * secret only the database and this server know. Sends the due reminders and
 * forgets devices the browser says are gone.
 */
export const pushTickHandler = async (req: Request, res: Response, send: typeof webpush.sendNotification = webpush.sendNotification.bind(webpush)) => {
  if (!pushReady()) return res.status(503).json({ error: 'not set up' });
  const config = await pushConfig();
  const given = String(req.headers['x-cron-secret'] ?? '');
  if (!config || !sameSecret(given, config.cron_secret)) return res.status(401).json({ error: 'unauthorised' });
  if (!config.vapid_public || !config.vapid_private) return res.json({ sent: 0 });

  const due = await rest('rpc/claim_due_reminders', { method: 'POST', body: '{}' });
  if (!due.ok) return res.status(502).json({ error: 'could not read reminders' });
  const rows = (await due.json()) as Due[];
  const vapidDetails = { subject: env.pushSubject, publicKey: config.vapid_public, privateKey: config.vapid_private };
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(rows.flatMap((row) => row.subscriptions.map(async (s) => {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(reminderMessage(row)), { vapidDetails, TTL: 60 * 60, urgency: 'normal' });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(s.endpoint);
      else console.warn('push failed', status);
    }
  })));
  if (gone.length) {
    await rest(`push_subscriptions?endpoint=in.(${gone.map((e) => `"${e.replace(/"/g, '')}"`).join(',')})`, { method: 'DELETE' }).catch(() => {});
  }
  return res.json({ sent, gone: gone.length });
};
