import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Startup guard ─────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('\n✗ FATAL: GROQ_API_KEY is not set.\n  Add it to .env.local for local dev,\n  or to Railway Variables for production.\n');
  process.exit(1);
}

const PORT = process.env.PORT ?? 3000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://brainwave.up.railway.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

const app = express();
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Groq client (OpenAI-compatible chat completions, no SDK needed) ──────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

// Convert Anthropic-style messages → OpenAI/Groq chat format
// - system prompt → a leading { role: 'system' } message
// - image blocks → image_url with a base64 data URI
// - document blocks → dropped (not supported by Groq chat completions)
// Returns the message list plus whether any image was present (for model routing).
function toGroqMessages(messages, system) {
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

async function callGroq({ messages, system, max_tokens, stream = false }) {
  const { messages: groqMessages, hasImage } = toGroqMessages(messages, system);
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: hasImage ? VISION_MODEL : TEXT_MODEL,
      messages: groqMessages,
      max_completion_tokens: max_tokens ?? 12000,
      stream,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    const err = new Error(`Groq API ${response.status}: ${errBody.slice(0, 500)}`);
    err.status = response.status;
    throw err;
  }
  return response;
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── User data persistence ──────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
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

// ── Leaderboard ─────────────────────────────────────────────────────────────
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

// ── AI proxy ──────────────────────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const { messages, system, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    const response = await callGroq({ messages, system, max_tokens });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('Groq error:', err);
    res.status(err.status ?? 500).json({ error: err.message ?? String(err) });
  }
});

// ── AI streaming proxy (SSE) ──────────────────────────────────────────────────
app.post('/api/claude-stream', async (req, res) => {
  const { messages, system, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const response = await callGroq({ messages, system, max_tokens, stream: true });

    // Re-emit Groq's OpenAI-style SSE stream as the { text } events the client expects.
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
    console.error('Groq stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message ?? String(err) })}\n\n`);
    res.end();
  }
});

// ── Static frontend (after API routes) ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}  (Groq: ${TEXT_MODEL})`);
});
