import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
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
    // Allow requests with no origin (Capacitor native WebView, curl, etc.)
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
app.options('*', cors(corsOptions)); // preflight for all routes
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Groq client (singleton) ───────────────────────────────────────────────────
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ── Models ────────────────────────────────────────────────────────────────────
const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-90b-vision-preview';

function hasImages(messages) {
  return messages.some(msg =>
    Array.isArray(msg.content) &&
    msg.content.some(block => block.type === 'image' || block.type === 'document')
  );
}

// Convert Anthropic-style content blocks → Groq/OpenAI format
// - image    → image_url  (Groq vision supports jpeg/png/gif/webp)
// - document → dropped    (Groq has no PDF support)
// - text     → unchanged
function convertMessages(messages) {
  return messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    const converted = msg.content
      .filter(block => block.type !== 'document')
      .map(block => {
        if (block.type === 'image') {
          const { media_type, data } = block.source;
          return { type: 'image_url', image_url: { url: `data:${media_type};base64,${data}` } };
        }
        return block;
      });
    return { role: msg.role, content: converted };
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

// Save or update a single user's data
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

// Load a single user's data
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

  // Validate request body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    const fullMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...convertMessages(messages),
    ];

    const model = hasImages(messages) ? VISION_MODEL : TEXT_MODEL;

    const response = await groq.chat.completions.create({
      model,
      max_tokens: max_tokens ?? 12000,
      messages: fullMessages,
    });

    const text = response.choices[0]?.message?.content ?? '';
    // Return in Anthropic-compatible shape so the frontend needs no changes
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
    const fullMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...convertMessages(messages),
    ];

    const stream = await groq.chat.completions.create({
      model: TEXT_MODEL,
      max_tokens: max_tokens ?? 12000,
      messages: fullMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
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
  console.log(`✓ Server running on port ${PORT}  (Groq · key: ...${GROQ_API_KEY.slice(-6)})`);
});
