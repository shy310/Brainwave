import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteAccountHandler } from '../../server/account';
import { env } from '../../server/env';

const res = () => {
  const r = { code: 200, body: undefined as unknown, status(c: number) { r.code = c; return r; }, json(b: unknown) { r.body = b; return r; } };
  return r;
};
const call = async (req: Record<string, unknown>) => { const r = res(); await deleteAccountHandler(req as never, r as never); return r; };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe('delete account', () => {
  it('refuses demo accounts and unconfirmed requests', async () => {
    expect((await call({ demo: true, userId: 'demo', body: { confirm: 'DELETE' } })).code).toBe(400);
    expect((await call({ userId: 'u1', body: {} })).code).toBe(400);
  });

  it('says so when the server cannot delete accounts yet', async () => {
    const saved = env.supabaseServiceKey;
    env.supabaseServiceKey = '';
    expect((await call({ userId: 'u1', body: { confirm: 'DELETE' } })).code).toBe(503);
    env.supabaseServiceKey = saved;
  });

  it('deletes the Supabase user with the service key (new-style key only in apikey)', async () => {
    const saved = { url: env.supabaseUrl, key: env.supabaseServiceKey };
    Object.assign(env, { supabaseUrl: 'https://proj.supabase.co', supabaseServiceKey: 'sb_secret_x' });
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = fetchSpy as typeof fetch;
    const r = await call({ userId: 'user/1', body: { confirm: 'DELETE' } });
    expect(r).toMatchObject({ code: 200, body: { ok: true } });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://proj.supabase.co/auth/v1/admin/users/user%2F1');
    expect(init).toMatchObject({ method: 'DELETE', headers: { apikey: 'sb_secret_x' } });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();

    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    expect((await call({ userId: 'u2', body: { confirm: 'DELETE' } })).code).toBe(502);
    Object.assign(env, { supabaseUrl: saved.url, supabaseServiceKey: saved.key });
  });
});
