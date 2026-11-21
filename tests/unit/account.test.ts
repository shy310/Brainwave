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
    const [url, init] = (fetchSpy.mock.calls as unknown as [string][]).find(([u]) => u.includes('/auth/')) as unknown as [string, RequestInit];
    expect(url).toBe('https://proj.supabase.co/auth/v1/admin/users/user%2F1');
    expect(init).toMatchObject({ method: 'DELETE', headers: { apikey: 'sb_secret_x' } });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();

    fetchSpy.mockResolvedValueOnce(new Response('[]', { status: 200 })).mockResolvedValueOnce(new Response('boom', { status: 500 }));
    expect((await call({ userId: 'u2', body: { confirm: 'DELETE' } })).code).toBe(502);
    Object.assign(env, { supabaseUrl: saved.url, supabaseServiceKey: saved.key });
  });

  it('deletes the student\'s kept recordings first, and stops if that fails', async () => {
    const saved = { url: env.supabaseUrl, key: env.supabaseServiceKey };
    Object.assign(env, { supabaseUrl: 'https://proj.supabase.co', supabaseServiceKey: 'sb_secret_x' });
    const calls: { url: string; method?: string; body?: string }[] = [];
    let listed = 0;
    globalThis.fetch = (async (u: string, init: RequestInit = {}) => {
      calls.push({ url: u, method: init.method, body: init.body as string | undefined });
      if (u.includes('/object/list/')) return new Response(JSON.stringify(listed++ ? [] : [{ name: 'l1.webm' }, { name: 'l2.m4a' }]), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    expect((await call({ userId: 'u1', body: { confirm: 'DELETE' } })).code).toBe(200);
    expect(JSON.parse(calls[0].body!)).toMatchObject({ prefix: 'u1' });
    expect(calls[1]).toMatchObject({ url: 'https://proj.supabase.co/storage/v1/object/lecture-audio', method: 'DELETE' });
    expect(JSON.parse(calls[1].body!)).toEqual({ prefixes: ['u1/l1.webm', 'u1/l2.m4a'] });
    expect(calls.at(-1)!.url).toContain('/auth/v1/admin/users/u1');

    // No bucket yet: nothing to delete. A storage failure keeps the account.
    globalThis.fetch = (async (u: string) => new Response('{}', { status: u.includes('/object/list/') ? 400 : 200 })) as typeof fetch;
    expect((await call({ userId: 'u1', body: { confirm: 'DELETE' } })).code).toBe(200);
    const authCalls: string[] = [];
    globalThis.fetch = (async (u: string) => { if (u.includes('/auth/')) authCalls.push(u); return new Response('x', { status: u.includes('/object/list/') ? 500 : 200 }); }) as typeof fetch;
    expect((await call({ userId: 'u1', body: { confirm: 'DELETE' } })).code).toBe(502);
    expect(authCalls).toEqual([]);
    Object.assign(env, { supabaseUrl: saved.url, supabaseServiceKey: saved.key });
  });
});
