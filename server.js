import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Startup guard ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('\n✗ FATAL: GEMINI_API_KEY is not set.\n  Add it to .env.local for local dev,\n  or to Railway Variables for production.\n');
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

// ── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const TEXT_MODEL = 'gemini-2.0-flash';

// Convert Anthropic-style messages → Gemini contents format
// - role 'assistant' → 'model'
// - content array → parts array
// - image blocks → inlineData
// - document blocks → dropped (Gemini handles PDFs differently)
function toGeminiContents(messages) {
  return messages.map(msg => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (typeof msg.content === 'string') {
      return { role, parts: [{ text: msg.content }] };
    }
    const parts = msg.content
      .filter(block => block.type !== 'document')
      .map(block => {
        if (block.type === 'text') return { text: block.text };
        if (block.type === 'image') {
          return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
        }
        return null;
      })
      .filter(Boolean);
    return { role, parts };
  });
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

// ── AI proxy ──────────────────────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const { messages, system, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      ...(system ? { systemInstruction: system } : {}),
    });

    const result = await model.generateContent({
      contents: toGeminiContents(messages),
      generationConfig: { maxOutputTokens: max_tokens ?? 12000 },
    });

    const text = result.response.text();
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('Gemini error:', err);
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
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      ...(system ? { systemInstruction: system } : {}),
    });

    const result = await model.generateContentStream({
      contents: toGeminiContents(messages),
      generationConfig: { maxOutputTokens: max_tokens ?? 12000 },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Gemini stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message ?? String(err) })}\n\n`);
    res.end();
  }
});

// ── Static frontend (after API routes) ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}  (Gemini 2.5 Flash)`);
});
