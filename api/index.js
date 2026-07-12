import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions';
// Gemini 2.5 Flash: strong at maths, multimodal (handles image uploads too), cheap.
const TEXT_MODEL = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash';
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL ?? 'google/gemini-2.5-flash';
// Model used automatically when the main model is rate-limited or unavailable.
// Set OPENROUTER_FALLBACK_MODEL="" to disable the fallback entirely.
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL ?? 'openai/gpt-4o-mini';

// Keep output reservations tight — they drive cost and latency.
const DEFAULT_MAX_TOKENS = 4096;
const MAX_TOKENS_CAP = 6000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseRetryAfterSeconds(errBody, headers) {
  const headerVal = Number(headers?.get?.('retry-after'));
  if (Number.isFinite(headerVal) && headerVal > 0) return headerVal;
  const m = /try again in ([\d.]+)s/i.exec(errBody || '');
  return m ? parseFloat(m[1]) : null;
}

if (!OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is not set in environment variables');
}

// Convert Anthropic-style messages → OpenAI-compatible chat format
// - system prompt → a leading { role: 'system' } message
// - image blocks → image_url with a base64 data URI
// - document blocks → dropped (not supported by chat completions)
function toChatMessages(messages, system) {
  let hasImage = false;
  const out = [];
  if (system) out.push({ role: 'system', content: system });
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    if (typeof msg.content === 'string') {
      out.push({ role, content: msg.content });
      continue;
    }
    const parts = msg.content
      .filter(block => block.type !== 'document')
      .map(block => {
        if (block.type === 'text') return { type: 'text', text: block.text };
        if (block.type === 'image') {
          hasImage = true;
          return {
            type: 'image_url',
            image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
          };
        }
        return null;
      })
      .filter(Boolean);
    out.push({ role, content: parts });
  }
  return { messages: out, hasImage };
}

async function openRouterRequest(model, chatMessages, maxTokens, stream) {
  return fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://brainwave.app',
      'X-Title': 'BrainWave',
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      max_tokens: maxTokens,
      stream,
    }),
  });
}

async function callOpenRouter({ messages, system, max_tokens, stream = false }) {
  const { messages: chatMessages, hasImage } = toChatMessages(messages, system);
  const model = hasImage ? VISION_MODEL : TEXT_MODEL;
  const maxTokens = Math.min(max_tokens ?? DEFAULT_MAX_TOKENS, MAX_TOKENS_CAP);

  let response = await openRouterRequest(model, chatMessages, maxTokens, stream);

  // Rate limited → wait out short limits, then retry once on the same model.
  if (response.status === 429) {
    const errBody = await response.text().catch(() => '');
    const waitSec = parseRetryAfterSeconds(errBody, response.headers);
    if (waitSec !== null && waitSec <= 12) {
      await sleep((waitSec + 0.5) * 1000);
      response = await openRouterRequest(model, chatMessages, maxTokens, stream);
    }
    // Still limited (or the wait was too long) → fall back to the secondary
    // model (also multimodal, so image requests can fall back too).
    if (response.status === 429 && FALLBACK_MODEL && FALLBACK_MODEL !== model) {
      console.warn(`OpenRouter rate limit on ${model} — falling back to ${FALLBACK_MODEL}`);
      response = await openRouterRequest(FALLBACK_MODEL, chatMessages, maxTokens, stream);
    }
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    const err = new Error(
      response.status === 429
        ? 'The AI is receiving too many requests right now. Please wait a few seconds and try again.'
        : `OpenRouter API ${response.status}: ${errBody.slice(0, 500)}`
    );
    err.status = response.status;
    throw err;
  }
  return response;
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  hasKey: !!OPENROUTER_API_KEY,
  provider: 'openrouter',
  model: TEXT_MODEL,
}));

// ─── User data (ephemeral /tmp on Vercel) ──────────────────────────────────
const DATA_DIR = '/tmp';
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function readUsersDb() {
  try {
    await fs.promises.access(USERS_FILE);
    const data = await fs.promises.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch { return {}; }
}

async function writeUsersDb(db) {
  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(USERS_FILE, JSON.stringify(db, null, 2));
  } catch (err) { console.error('Failed to write users DB:', err); }
}

app.post('/api/user/save', async (req, res) => {
  const { userId, userData } = req.body;
  if (!userId || typeof userId !== 'string' || !userData || typeof userData !== 'object') {
    return res.status(400).json({ error: 'userId (string) and userData (object) are required.' });
  }
  try {
    const db = await readUsersDb();
    db[userId] = { ...db[userId], ...userData };
    await writeUsersDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Failed to save user data.' });
  }
});

// ─── Leaderboard ────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  try {
    const db = await readUsersDb();
    const board = Object.entries(db)
      .map(([id, u]) => {
        const totalXp = Number(u?.totalXp) || 0;
        // First name only for privacy.
        const name = String(u?.name || 'Learner').trim().split(/\s+/)[0] || 'Learner';
        return {
          id,
          name,
          totalXp,
          streakDays: Number(u?.streakDays) || 0,
          level: Math.floor(totalXp / 1000) + 1,
        };
      })
      .filter(e => e.totalXp > 0)
      .sort((a, b) => b.totalXp - a.totalXp)
      .slice(0, limit);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Failed to build leaderboard.' });
  }
});

app.get('/api/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const db = await readUsersDb();
    const user = db[userId];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Failed to read user data.' });
  }
});

// ─── AI proxy ─────────────────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  const { messages, system, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    const response = await callOpenRouter({ messages, system, max_tokens });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('OpenRouter error:', err);
    res.status(err.status ?? 500).json({ error: err.message ?? String(err) });
  }
});

// ─── AI streaming proxy (SSE) ──────────────────────────────────────────────
app.post('/api/claude-stream', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  const { messages, system, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const response = await callOpenRouter({ messages, system, max_tokens, stream: true });

    // Re-emit the OpenAI-style SSE stream as the { text } events the client expects.
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const payload = line.startsWith('data: ') ? line.slice(6).trim() : null;
        if (!payload || payload === '[DONE]') continue;
        try {
          const text = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch { /* ignore malformed keep-alive lines */ }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('OpenRouter stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message ?? String(err) })}\n\n`);
    res.end();
  }
});

export default app;
