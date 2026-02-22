import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Text model for normal requests; vision model when images are attached
const TEXT_MODEL  = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-90b-vision-preview';

function hasImages(messages) {
  return messages.some(msg =>
    Array.isArray(msg.content) &&
    msg.content.some(block => block.type === 'image' || block.type === 'document')
  );
}

// Convert Anthropic-style content blocks → Groq/OpenAI format
// - image  → image_url  (Groq vision model supports jpeg/png/gif/webp)
// - document (PDF) → stripped; Groq has no PDF support, drop the binary
// - text   → unchanged
function convertMessages(messages) {
  return messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    const converted = msg.content
      .filter(block => block.type !== 'document') // drop PDF blobs — Groq can't read them
      .map(block => {
        if (block.type === 'image') {
          const { media_type, data } = block.source;
          return { type: 'image_url', image_url: { url: `data:${media_type};base64,${data}` } };
        }
        return block; // text blocks are identical
      });
    return { role: msg.role, content: converted };
  });
}

app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env.local' });
  }

  try {
    const groq = new Groq({ apiKey });
    const { messages, system, max_tokens } = req.body;

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
    // Return in Anthropic-compatible format so the frontend needs no changes
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('Groq error:', err);
    res.status(err.status ?? 500).json({ error: err.message ?? String(err) });
  }
});

// Serve the built React app for every non-API route
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('\n⚠  WARNING: GROQ_API_KEY is not set in .env.local\n   Add: GROQ_API_KEY=gsk_...\n');
  } else {
    console.log(`✓ Server running on port ${PORT}  (Groq · key: ...${key.slice(-6)})`);
  }
});
