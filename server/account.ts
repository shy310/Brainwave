import type { Response } from 'express';
import { env } from './env.js';
import { forgetUser, type AuthedRequest } from './auth.js';

/** The word the student types to confirm; the app sends it in English whatever the language. */
export const DELETE_CONFIRMATION = 'DELETE';

/**
 * Delete the signed-in student's account. Removing the Supabase Auth user
 * cascades to every table (profiles, lectures, folders, reviews, schedule,
 * usage…), so nothing of theirs is left. Required by Google Play.
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
