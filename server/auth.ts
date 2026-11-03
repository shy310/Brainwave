import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { env, supabaseConfigured, demoModeActive } from './env.js';

export interface AuthedRequest extends Request {
  userId?: string;
  demo?: boolean;
}

// Short cache so a burst of requests doesn't hit Supabase for every call.
const cache = new Map<string, { userId: string; exp: number }>();
const CACHE_MS = 60_000;

/** Verify a Supabase access token by asking Supabase Auth who it belongs to. */
export const verifyToken = async (token: string): Promise<string | null> => {
  const key = createHash('sha256').update(token).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.userId;
  const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user?.id) return null;
  cache.set(key, { userId: user.id, exp: Date.now() + CACHE_MS });
  if (cache.size > 5000) cache.clear();
  return user.id;
};

/** Every AI route goes through this: no valid sign-in, no AI. */
export const requireUser = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    if (!supabaseConfigured()) {
      if (demoModeActive()) {
        req.userId = 'demo';
        req.demo = true;
        return next();
      }
      return res.status(503).json({ error: 'Server is not configured for sign-in yet.' });
    }
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const userId = await verifyToken(token);
    if (!userId) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    req.userId = userId;
    return next();
  } catch (err) {
    console.error('auth error', err);
    return res.status(500).json({ error: 'Could not verify sign-in.' });
  }
};
