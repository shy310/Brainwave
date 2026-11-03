import { env } from '../env.js';

// OpenAI-compatible message shapes accepted by OpenRouter.
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: 'mp3' | 'wav' } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** JSON Schema for structured output (response_format json_schema). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  stream?: boolean;
  hasPdf?: boolean;
}

export class AiError extends Error {
  constructor(message: string, public status = 502, public upstreamStatus?: number) { super(message); }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const request = (model: string, o: ChatOptions) =>
  fetch(env.openrouterUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://brainwave.app',
      'X-Title': 'BrainWave',
    },
    body: JSON.stringify({
      model,
      messages: o.messages,
      max_tokens: Math.min(o.maxTokens ?? 4096, 16000),
      temperature: o.temperature ?? 0.4,
      stream: o.stream ?? false,
      ...(o.jsonSchema
        ? { response_format: { type: 'json_schema', json_schema: { name: o.jsonSchema.name, strict: false, schema: o.jsonSchema.schema } } }
        : {}),
      ...(o.hasPdf ? { plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }] } : {}),
    }),
  });

/** Call OpenRouter with one retry on rate limits / 5xx, then a fallback model. */
export const callModel = async (o: ChatOptions): Promise<Response> => {
  if (!env.openrouterKey) throw new AiError('The AI service is not configured on the server.', 503);
  let res = await request(env.model, o);
  if (res.status === 429 || res.status >= 500) {
    await sleep(1500);
    res = await request(env.model, o);
  }
  // The fallback model can't read PDFs or audio, so only use it for text and images.
  const media = o.messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'file' || p.type === 'input_audio'));
  if ((res.status === 429 || res.status >= 500) && env.fallbackModel && !media) {
    res = await request(env.fallbackModel, o);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('OpenRouter error', res.status, body.slice(0, 600));
    if (res.status === 429) throw new AiError('The AI is busy right now. Please try again in a moment.', 429, 429);
    if (res.status === 402) throw new AiError('The AI account is out of credits.', 402, 402);
    if (res.status === 401 || res.status === 403) throw new AiError('The AI key was rejected by the provider.', 503, res.status);
    throw new AiError('The AI service had a problem. Please try again.', 502, res.status);
  }
  return res;
};

/** Non-streaming call returning the assistant text. */
export const completeText = async (o: ChatOptions): Promise<string> => {
  const res = await callModel({ ...o, stream: false });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
};
