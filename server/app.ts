import express, { type Response } from 'express';
import { env, supabaseConfigured, demoModeActive } from './env.js';
import { requireUser, type AuthedRequest } from './auth.js';
import { quota } from './usage.js';
import { getOp, type OpContext } from './ai/ops.js';
import { runStructured } from './ai/run.js';
import { AiError, callModel } from './ai/openrouter.js';
import { isGrade } from '../shared/grades.js';
import { isLocale } from '../shared/locales.js';
import './ai/registry.js';

export const app = express();
app.disable('x-powered-by');
// Request bodies stay small: large files (audio, PDFs) go to Supabase Storage.
app.use(express.json({ limit: '4mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ai: Boolean(env.openrouterKey),
    auth: supabaseConfigured(),
    demo: demoModeActive(),
  });
});

const sendError = (res: Response, err: unknown) => {
  if (res.headersSent) return;
  if (err instanceof AiError) {
    console.error('AI error', err.status, err.upstreamStatus ?? '', err.message);
    return res.status(err.status).json({ error: err.message, code: err.upstreamStatus ?? err.status });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

/** One endpoint per named AI operation. */
app.post('/api/ai/:op', requireUser, (req: AuthedRequest, res, next) => {
  const op = getOp(req.params.op);
  if (!op) return res.status(404).json({ error: 'Unknown operation.' });
  return quota(op.name, op.cost)(req, res, next);
}, async (req: AuthedRequest, res) => {
  const op = getOp(req.params.op)!;
  const body = (req.body ?? {}) as { input?: unknown; locale?: unknown; grade?: unknown };
  const parsed = op.input.safeParse(body.input ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request.', details: parsed.error.issues.slice(0, 5) });
  const ctx: OpContext = {
    userId: req.userId!, demo: Boolean(req.demo),
    locale: isLocale(body.locale) ? body.locale : 'en',
    grade: isGrade(body.grade) ? body.grade : '9',
  };

  try {
    if (op.stream) {
      const messages = op.build(parsed.data, ctx);
      const hasPdf = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'file'));
      const upstream = await callModel({ messages, maxTokens: op.maxTokens, temperature: op.temperature, stream: true, hasPdf });
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      const decoder = new TextDecoder();
      let buffer = '';
      const reader = upstream.body!.getReader();
      req.on('close', () => { reader.cancel().catch(() => {}); });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const text = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch { /* keep-alive comments */ }
        }
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    const data = await runStructured(op, parsed.data, ctx);
    return res.json({ data });
  } catch (err) {
    if (op.stream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err instanceof AiError ? err.message : 'Something went wrong.' })}\n\n`);
      return res.end();
    }
    return sendError(res, err);
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
