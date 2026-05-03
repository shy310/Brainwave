import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// ─── DeepSeek configuration (OpenAI-compatible API) ────────────────────────
// DeepSeek-V3 (deepseek-chat) is excellent at multilingual structured output,
// dramatically better than Llama for Hebrew/Arabic JSON generation.
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const TEXT_MODEL = 'deepseek-chat';        // DeepSeek-V3 — fast, cheap, multilingual
const REASONER_MODEL = 'deepseek-reasoner'; // DeepSeek-R1 — for complex reasoning (slower)

if (!DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY is not set in environment variables');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Strip image/document content blocks (DeepSeek-chat is text-only).
// The model gets a text marker instead so it knows attachments existed.
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

async function callDeepSeek({ messages, system, max_tokens, temperature, stream = false }) {
  const finalMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...stripAttachments(messages),
  ];

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: finalMessages,
      max_tokens: max_tokens ?? 4096,
      temperature: temperature ?? 0.7,
      stream,
    }),
  });

  if (!stream) {
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`DeepSeek API error ${response.status}: ${errText.slice(0, 500)}`);
    }
    return await response.json();
  }
  return response;
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
  hasKey: !!DEEPSEEK_API_KEY,
  provider: 'deepseek',
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

// ─── AI proxy (kept at /api/claude for frontend compatibility) ─────────────
app.post('/api/claude', async (req, res) => {
  if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
  const { messages, system, max_tokens, temperature } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  try {
    const data = await callDeepSeek({ messages, system, max_tokens, temperature });
    const text = data.choices?.[0]?.message?.content ?? '';
    // Return in the shape the frontend expects (Anthropic-style content blocks)
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('DeepSeek error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── AI streaming proxy (SSE) ──────────────────────────────────────────────
app.post('/api/claude-stream', async (req, res) => {
  if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
  const { messages, system, max_tokens, temperature } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty messages array.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await callDeepSeek({ messages, system, max_tokens, temperature, stream: true });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: `Upstream error ${upstream.status}: ${errText.slice(0, 300)}` })}\n\n`);
      return res.end();
    }

    // DeepSeek returns OpenAI-format SSE: each line is "data: {json}\n\n"
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
    console.error('DeepSeek stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message ?? String(err) })}\n\n`);
    res.end();
  }
});

export default app;
