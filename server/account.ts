import type { Response } from 'express';
import { env } from './env.js';
import { forgetUser, type AuthedRequest } from './auth.js';

/** The word the student types to confirm; the app sends it in English whatever the language. */
export const DELETE_CONFIRMATION = 'DELETE';

const AUDIO_BUCKET = 'lecture-audio';

/**
 * Delete the student's kept lecture recordings. Storage files don't go with
 * the account, so they are removed first: 100 at a time, from the student's
 * own folder. A missing bucket (migration 0016 not run) means there are none.
 */
export const deleteRecordings = async (userId: string, key: string) => {
  const headers = { apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) };
  const base = `${env.supabaseUrl}/storage/v1/object`;
  for (let round = 0; round < 50; round++) {
    const list = await fetch(`${base}/list/${AUDIO_BUCKET}`, { method: 'POST', headers, body: JSON.stringify({ prefix: userId, limit: 100, offset: 0 }) });
    if (list.status === 400 || list.status === 404) return;
    if (!list.ok) throw new Error(`listing recordings failed: ${list.status}`);
    const items = await list.json().catch(() => []) as unknown;
    const names = Array.isArray(items) ? items.map((o: { name?: string }) => o.name).filter((n): n is string => !!n).map((n) => `${userId}/${n}`) : [];
    if (!names.length) return;
    const removed = await fetch(`${base}/${AUDIO_BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: names }) });
    if (!removed.ok) throw new Error(`deleting recordings failed: ${removed.status}`);
  }
};

/**
 * Delete the signed-in student's account. Removing the Supabase Auth user
 * cascades to every table (profiles, lectures, folders, reviews, schedule,
 * usage…), and their kept recordings are deleted first, so nothing of theirs is left. Required by Google Play.
 */
export const deleteAccountHandler = async (req: AuthedRequest, res: Response) => {
  if (req.demo) return res.status(400).json({ error: 'Demo accounts live only in this browser.' });
  if ((req.body as { confirm?: unknown } | undefined)?.confirm !== DELETE_CONFIRMATION) {
    return res.status(400).json({ error: 'Please confirm the deletion.' });
  }
  if (!env.supabaseServiceKey) {
    return res.status(503).json({ error: 'Account deletion is not set up on this server yet. Please contact support.' });
  }
  const key = env.supabaseServiceKey;
  try {
    await deleteRecordings(req.userId!, key);
  } catch (err) {
    console.error('account deletion: recordings', err);
    return res.status(502).json({ error: 'Could not delete the account. Please try again or contact support.' });
  }
  const upstream = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(req.userId!)}`, {
    method: 'DELETE',
    headers: { apikey: key, ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) },
  });
  if (!upstream.ok && upstream.status !== 404) {
    console.error('account deletion failed', upstream.status, await upstream.text().catch(() => ''));
    return res.status(502).json({ error: 'Could not delete the account. Please try again or contact support.' });
  }
  forgetUser(req.userId!);
  return res.json({ ok: true });
};
