import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEXT_MODEL = 'gemini-2.0-flash';

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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
  hasKey: !!GEMINI_API_KEY,
  provider: 'gemini',
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
  if (!genAI) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
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
      generationConfig: { maxOutputTokens: max_tokens ?? 8192 },
    });

    const text = result.response.text();
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── AI streaming proxy (SSE) ──────────────────────────────────────────────
app.post('/api/claude-stream', async (req, res) => {
  if (!genAI) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
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
      generationConfig: { maxOutputTokens: max_tokens ?? 8192 },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Gemini stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message ?? String(err) })}\n\n`);
    res.end();
  }
});

export default app;
