import { afterEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { pushTickHandler, reminderMessage } from '../../server/push';
import { env } from '../../server/env';
import { keyBytes } from '../../src/features/schedule/webPush';

const res = () => {
  const r = { code: 200, body: undefined as unknown, status(c: number) { r.code = c; return r; }, json(b: unknown) { r.body = b; return r; } };
  return r;
};
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

const keys = webpush.generateVAPIDKeys();
const config = { vapid_public: keys.publicKey, vapid_private: keys.privateKey, cron_secret: 's'.repeat(64) };
const due = [
  { user_id: 'u1', kind: 'study', locale: 'he', class_id: null, class_name: null, subscriptions: [{ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }, { endpoint: 'https://push.example/gone', p256dh: 'p', auth: 'a' }] },
  { user_id: 'u2', kind: 'class', locale: 'en', class_id: 'c1', class_name: 'Calculus', subscriptions: [{ endpoint: 'https://push.example/2', p256dh: 'p', auth: 'a' }] },
];

const fakeDb = () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  globalThis.fetch = (async (u: string, init: RequestInit = {}) => {
    calls.push({ url: u, method: init.method ?? 'GET', body: init.body as string | undefined });
    if (u.includes('push_config')) return new Response(JSON.stringify([config]), { status: 200 });
    if (u.includes('claim_due_reminders')) return new Response(JSON.stringify(due), { status: 200 });
    return new Response('[]', { status: 200 });
  }) as typeof fetch;
  return calls;
};

describe('web push', () => {
  it('words reminders in the student\'s language and opens the right page', () => {
    expect(reminderMessage({ kind: 'study', locale: 'en', class_id: null, class_name: null })).toMatchObject({ title: 'Time to study', url: '/lectures/review', tag: 'bw-study' });
    expect(reminderMessage({ kind: 'class', locale: 'he', class_id: 'c 1', class_name: 'חשבון' })).toMatchObject({ title: 'חשבון מתחיל בקרוב', url: '/lectures/new?class=c%201', tag: 'class-c 1' });
  });

  it('only the database\'s minute job (with the secret) can send', async () => {
    Object.assign(env, { supabaseUrl: 'https://proj.supabase.co', supabaseServiceKey: 'sb_secret_x' });
    fakeDb();
    const send = vi.fn(async () => ({}) as never);
    const r1 = res();
    await pushTickHandler({ headers: {} } as never, r1 as never, send);
    expect(r1.code).toBe(401);
    const r2 = res();
    await pushTickHandler({ headers: { 'x-cron-secret': 'x'.repeat(64) } } as never, r2 as never, send);
    expect(r2.code).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends each due reminder to every device, and forgets devices that are gone', async () => {
    Object.assign(env, { supabaseUrl: 'https://proj.supabase.co', supabaseServiceKey: 'sb_secret_x' });
    const calls = fakeDb();
    const send = vi.fn(async (sub: { endpoint: string }, _payload: string, _options: unknown) => {
      if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      return {} as never;
    });
    const r = res();
    await pushTickHandler({ headers: { 'x-cron-secret': config.cron_secret } } as never, r as never, send as never);
    expect(r.body).toEqual({ sent: 2, gone: 1 });
    const payloads = send.mock.calls.map((c) => JSON.parse(c[1]) as { title: string });
    expect(payloads.filter((p) => p.title === 'הגיע הזמן ללמוד')).toHaveLength(2); // both of u1's devices, in Hebrew
    expect(payloads.filter((p) => p.title === 'Calculus starts soon')).toHaveLength(1);
    const options = send.mock.calls[0][2] as { vapidDetails: { publicKey: string }; TTL: number };
    expect(options.vapidDetails.publicKey).toBe(keys.publicKey);
    expect(options.TTL).toBe(3600);
    const del = calls.find((c) => c.method === 'DELETE')!;
    expect(decodeURIComponent(del.url)).toContain('push_subscriptions?endpoint=in.("https://push.example/gone")');
  });

  it('reads the server key the browser subscribes with', () => {
    const bytes = keyBytes(keys.publicKey);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4); // an uncompressed P-256 point
  });
});
