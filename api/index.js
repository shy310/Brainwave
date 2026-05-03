import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// ─── OpenRouter configuration ──────────────────────────────────────────────
// OpenRouter is OpenAI-compatible and gives access to many models including
// free tiers. We use DeepSeek-V3 (same model that worked great for multilingual)
// via OpenRouter's free tier.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Primary model: DeepSeek-V3 free — excellent multilingual structured output.
// Fallbacks: tried in order if the primary returns an error.
const MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

if (!OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is not set in environment variables');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Strip image/document content blocks (free text models don't support vision).
function stripAttachments(messages) {
  return messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    if (!Array.isArray(msg.content)) return msg;

    const textParts = [];
    let attachmentCount = 0;
    for (const block of msg.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'image' || block.type === 'document') {
        attachmentCount++;
      }
    }
    if (attachmentCount > 0) {
      textParts.unshift(`[${attachmentCount} attachment(s) provided — text content only]`);
    }
    return { role: msg.role, content: textParts.join('\n\n') || '.' };
  });
}

async function callOpenRouter({ messages, system, max_tokens, temperature, stream = false, model }) {
  const finalMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...stripAttachments(messages),
  ];

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // OpenRouter optional headers for analytics/leaderboard
      'HTTP-Referer': 'https://brainwave-kappa-livid.vercel.app',
      'X-Title': 'BrainWave',
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      max_tokens: max_tokens ?? 4096,
      temperature: temperature ?? 0.7,
      stream,
    }),
  });

  if (!stream) {
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenRouter API error ${response.status} on ${model}: ${errText.slice(0, 500)}`);
    }
    return await response.json();
  }
  return response;
}

// Try primary model, fall back through alternatives on failure.
async function callWithFallback(opts) {
  let lastError;
  for (const model of MODELS) {
    try {
      const result = await callOpenRouter({ ...opts, model });
      // For non-stream: ensure we got actual content
      if (!opts.stream) {
        const text = result?.choices?.[0]?.message?.content;
        if (text && text.trim()) return result;
        lastError = new Error(`Model ${model} returned empty content`);
        continue;
      }
      // For stream: check it opened ok before returning
      if (result.ok) return result;
      const errText = await result.text().catch(() => '');
      lastError = new Error(`Stream open failed on ${model}: ${result.status} ${errText.slice(0, 200)}`);
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} failed, trying next:`, err.message);
    }
  }
  throw lastError ?? new Error('All models failed');
}

// ─── Express app ────────────────────────────────────────────────────────────

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
  models: MODELS,
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

// ─── AI proxy (kept at /api/claude for frontend compatibility) ─────────────
app.post('/api/claude', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  const { messages, system, max_tokens, temperature } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    const data = await callWithFallback({ messages, system, max_tokens, temperature, stream: false });
    const text = data.choices?.[0]?.message?.content ?? '';
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('OpenRouter error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── AI streaming proxy (SSE) ──────────────────────────────────────────────
app.post('/api/claude-stream', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  const { messages, system, max_tokens, temperature } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await callWithFallback({ messages, system, max_tokens, temperature, stream: true });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        try {
          const obj = JSON.parse(data);
          const text = obj.choices?.[0]?.delta?.content ?? '';
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch { /* skip malformed chunks */ }
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
