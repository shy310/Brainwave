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

function readUsersDb() {
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch { return {}; }
}

function writeUsersDb(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
  } catch (err) { console.error('Failed to write users DB:', err); }
}

// Save or update a single user's data
app.post('/api/user/save', (req, res) => {
  const { userId, userData } = req.body;
  if (!userId || typeof userId !== 'string' || !userData || typeof userData !== 'object') {
    return res.status(400).json({ error: 'userId (string) and userData (object) are required.' });
  }
  try {
    const db = readUsersDb();
    db[userId] = { ...db[userId], ...userData };
    writeUsersDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Failed to save user data.' });
  }
});

// Load a single user's data
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  try {
    const db = readUsersDb();
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
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const fullMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...convertMessages(messages),
    ];

    const model = hasImages(messages) ? VISION_MODEL : TEXT_MODEL;

    const response = await groq.chat.completions.create({
      model,
      max_tokens: max_tokens ?? 4096,
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

// ── Static frontend (after API routes) ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}  (Groq · key: ...${GROQ_API_KEY.slice(-6)})`);
});
