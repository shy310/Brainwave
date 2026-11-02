import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { z } from 'zod';

// Configure a local, non-production server with no Supabase and demo mode on.
process.env.NODE_ENV = 'test';
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
process.env.ALLOW_DEMO_MODE = 'true';
process.env.OPENROUTER_API_KEY = 'sk-test';

let server: Server;
let base = '';
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const { app } = await import('../../server/app');
  const { defineOp } = await import('../../server/ai/ops');
  defineOp({
    name: 'testEcho',
    input: z.object({ word: z.string().min(1) }),
    output: z.object({ echo: z.string() }),
    cost: 1, maxTokens: 50,
    build: i => [{ role: 'user', content: i.word }],
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); globalThis.fetch = realFetch; });

/** Route OpenRouter calls to a fake, let local calls through. */
const mockModel = (replies: string[]) => {
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith(base)) return realFetch(url, init);
    const content = replies.shift() ?? '{}';
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  });
  globalThis.fetch = spy as typeof fetch;
  return spy;
};

const post = (path: string, body: unknown) =>
  realFetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('AI gateway', () => {
  it('reports health', async () => {
    const res = await realFetch(`${base}/api/health`);
    expect(await res.json()).toMatchObject({ ok: true, auth: false, demo: true });
  });

  it('rejects unknown operations', async () => {
    const res = await post('/api/ai/doesNotExist', { input: {} });
    expect(res.status).toBe(404);
  });

  it('validates input', async () => {
    const res = await post('/api/ai/testEcho', { input: { word: '' } });
    expect(res.status).toBe(400);
  });

  it('returns validated structured output', async () => {
    mockModel(['{"echo":"hello"}']);
    const res = await post('/api/ai/testEcho', { input: { word: 'hello' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { echo: 'hello' } });
  });

  it('retries once when the model returns the wrong shape', async () => {
    const spy = mockModel(['{"wrong":true}', '```json\n{"echo":"fixed"}\n```']);
    const res = await post('/api/ai/testEcho', { input: { word: 'x' } });
    expect(await res.json()).toEqual({ data: { echo: 'fixed' } });
    expect(spy.mock.calls.filter(c => !String(c[0]).startsWith(base))).toHaveLength(2);
  });
});

describe('security', () => {
  it('never allows demo mode in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    const { demoModeActive } = await import('../../server/env');
    expect(demoModeActive()).toBe(false);
    process.env.NODE_ENV = 'test';
  });

  it('refuses AI without sign-in when Supabase is configured', async () => {
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    const { app } = await import('../../server/app');
    const s = app.listen(0);
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const res = await realFetch(`${url}/api/ai/testEcho`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(401);
    s.close();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });
});
