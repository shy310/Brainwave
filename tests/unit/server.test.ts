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

const q = (prompt: string, over: Record<string, unknown> = {}) => ({
  kind: 'input', prompt, options: [], correctIndex: -1, answer: '4', accepted: [], check: '2+2', hint: '', explanation: 'Two plus two.', ...over,
});

describe('learn operations', () => {
  it('rejects unknown topics', async () => {
    const res = await post('/api/ai/quiz', { input: { topicId: 'nope' } });
    expect(res.status).toBe(400);
  });

  it('verifies and trims generated quizzes', async () => {
    const questions = [q('What is 2+2?'), q('Add two and two', { answer: '5' }), q('What is undefined?'), q('Double 2?'), q('2 squared?')];
    mockModel([JSON.stringify({ questions })]);
    const res = await post('/api/ai/quiz', { input: { topicId: 'math-k-t3', count: 3 } });
    const { data } = await res.json() as { data: { questions: { prompt: string; answer: string }[] } };
    expect(data.questions).toHaveLength(3);
    expect(data.questions.map(x => x.answer)).toEqual(['4', '4', '4']);
    expect(data.questions.some(x => x.prompt.includes('undefined'))).toBe(false);
  });

  it('builds tutor prompts with mode, topic and attachments', async () => {
    const { tutorOp } = await import('../../server/ai/ops/tutor');
    const input = tutorOp.input.parse({
      messages: [{ role: 'user', content: 'help' }], mode: 'custom', custom: 'Use pirate talk', topicId: 'math-h1-t1',
      attachment: { kind: 'pdf', name: 'hw.pdf', dataUrl: 'data:application/pdf;base64,AAAA' },
    });
    const msgs = tutorOp.build(input, { userId: 'u', demo: true, locale: 'he', grade: '10' });
    const sys = String(msgs[0].content);
    expect(sys).toContain('pirate talk');
    expect(sys).toContain('Quadratic Equations');
    expect(sys).toContain('Hebrew');
    expect(Array.isArray(msgs[1].content) && msgs[1].content[1].type).toBe('file');
  });

  it('refuses oversized or non-image attachments', () => {
    return import('../../shared/learn').then(({ AttachmentSchema }) => {
      expect(AttachmentSchema.safeParse({ kind: 'image', name: 'x', dataUrl: 'data:text/html;base64,AAAA' }).success).toBe(false);
    });
  });
});

describe('structured output fallbacks', () => {
  it('sends a provider-friendly schema and also puts it in the prompt', async () => {
    const spy = mockModel(['{"echo":"ok"}']);
    await post('/api/ai/testEcho', { input: { word: 'x' } });
    const call = spy.mock.calls.find(c => !String(c[0]).startsWith(base))!;
    const body = JSON.parse(String((call[1] as RequestInit).body));
    const schemaText = JSON.stringify(body.response_format.json_schema.schema);
    expect(body.response_format.json_schema.strict).toBe(false);
    expect(schemaText).not.toMatch(/minLength|maxLength|additionalProperties|\$schema/);
    expect(body.messages[0]).toMatchObject({ role: 'system' });
    expect(body.messages[0].content).toContain('"echo"');
  });

  it('retries without response_format when the provider rejects the schema', async () => {
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith(base)) return realFetch(url, init);
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      if (body.response_format) return new Response('{"error":{"message":"Invalid schema"}}', { status: 422 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"echo":"plain"}' } }] }), { status: 200 });
    }) as typeof fetch;
    const res = await post('/api/ai/testEcho', { input: { word: 'x' } });
    expect(await res.json()).toEqual({ data: { echo: 'plain' } });
    expect(bodies.at(-1)!.response_format).toBeUndefined();
  });

  it('reports out-of-credits clearly', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith(base) ? realFetch(url, init) : new Response('{}', { status: 402 })) as typeof fetch;
    const res = await post('/api/ai/testEcho', { input: { word: 'x' } });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: 402 });
  });
});

describe('lecture operations', () => {
  it('sends audio to the main model only, never the fallback', async () => {
    const models: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith(base)) return realFetch(url, init);
      const body = JSON.parse(String(init?.body));
      models.push(body.model);
      expect(JSON.stringify(body.messages)).toContain('"input_audio"');
      return new Response('{}', { status: 503 });
    }) as typeof fetch;
    const res = await post('/api/ai/transcribe', { input: { audio: 'UklGR'.padEnd(200, 'A'), language: 'he' } });
    expect(res.status).toBe(502);
    expect(new Set(models).size).toBe(1);
  });

  it('rejects audio that is not base64', async () => {
    const res = await post('/api/ai/transcribe', { input: { audio: '<script>'.repeat(30) } });
    expect(res.status).toBe(400);
  });

  it('writes notes in the student language and grounds the tutor in a lecture', async () => {
    const { lectureNotesOp } = await import('../../server/ai/ops/lectures');
    const msgs = lectureNotesOp.build({ transcript: 'Today we talk about derivatives and limits.' }, { userId: 'u', demo: true, locale: 'he', grade: 'college' });
    expect(String(msgs[0].content)).toContain('Hebrew');
    const { tutorOp } = await import('../../server/ai/ops/tutor');
    const tutorMsgs = tutorOp.build(tutorOp.input.parse({
      messages: [{ role: 'user', content: 'what was the main idea?' }],
      lecture: { title: 'Week 3', text: 'The derivative measures rate of change.' },
    }), { userId: 'u', demo: true, locale: 'en', grade: 'college' });
    expect(String(tutorMsgs[0].content)).toContain('The derivative measures rate of change.');
  });

  it('verifies lecture quiz questions', async () => {
    const questions = [q('What is 2+2?'), q('2 times 2?', { answer: '5' }), q('What is undefined?'), q('Four?')];
    mockModel([JSON.stringify({ questions })]);
    const res = await post('/api/ai/lectureQuiz', { input: { transcript: 'We learned that two plus two is four, always.', count: 3 } });
    const { data } = await res.json() as { data: { questions: { answer: string }[] } };
    expect(data.questions.map(x => x.answer)).toEqual(['4', '4', '4']);
  });
});

describe('video operations', () => {
  const sc = (over: Record<string, unknown>) => ({ kind: 'title', heading: 'H', items: [], latex: '', fn: '', xMin: -5, xMax: 5, narration: 'Hello.', ...over });

  it('makes every scene drawable', async () => {
    mockModel([JSON.stringify({ title: 'Parabolas', scenes: [
      sc({ kind: 'title' }), sc({ kind: 'graph', fn: 'process.exit()', items: ['a'] }), sc({ kind: 'graph', fn: 'x^2' }),
    ] })]);
    const res = await post('/api/ai/videoScript', { input: { source: { prompt: 'parabolas' } } });
    const { data } = await res.json() as { data: { scenes: { kind: string }[] } };
    expect(data.scenes.map(s => s.kind)).toEqual(['title', 'bullets', 'graph']);
  });

  it('needs exactly one source and a real topic', async () => {
    expect((await post('/api/ai/videoScript', { input: { source: {} } })).status).toBe(400);
    mockModel(['{}']);
    expect((await post('/api/ai/videoScript', { input: { source: { topicId: 'nope' } } })).status).toBe(400);
  });

  it('grounds "ask about this moment" in the paused scene', async () => {
    const { tutorOp } = await import('../../server/ai/ops/tutor');
    const msgs = tutorOp.build(tutorOp.input.parse({
      messages: [{ role: 'user', content: 'why?' }],
      material: { kind: 'video', title: 'Parabolas', text: 'Scene 1…', focus: 'The vertex is the lowest point.' },
    }), { userId: 'u', demo: true, locale: 'en', grade: '10' });
    expect(String(msgs[0].content)).toContain('The vertex is the lowest point.');
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
