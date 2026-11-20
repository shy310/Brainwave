import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './auth.js';
import { env } from './env.js';

/**
 * Per-student AI budget, enforced in Postgres (works across serverless
 * instances). Calls the `consume_quota` SQL function with the service-role key.
 */
export const consumeQuota = async (userId: string, op: string, cost: number): Promise<boolean> => {
  if (!env.supabaseServiceKey) return true; // quota disabled until the key is set
  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/consume_quota`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceKey,
      // New-style keys (sb_secret_…) are not JWTs and go only in `apikey`;
      // legacy service_role JWTs also need the Bearer header.
      ...(env.supabaseServiceKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${env.supabaseServiceKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_user: userId, p_op: op, p_cost: cost,
      p_daily_limit: env.dailyLimit, p_rpm: env.perMinuteLimit,
    }),
  });
  if (!res.ok) {
    console.error('quota check failed', res.status, await res.text().catch(() => ''));
    return true; // fail open on infra errors so students aren't blocked by an outage
  }
  return (await res.json()) === true;
};

export const quota = (op: string, cost = 1) =>
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.demo) return next();
    const ok = await consumeQuota(req.userId!, op, cost);
    if (!ok) return res.status(429).json({ error: 'You have reached your AI limit for now. Please try again later.' });
    return next();
  };
