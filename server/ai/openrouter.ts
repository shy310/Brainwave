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
        ? { response_format: { type: 'json_schema', json_schema: { name: o.jsonSchema.name, strict: true, schema: o.jsonSchema.schema } } }
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
  if ((res.status === 429 || res.status >= 500) && env.fallbackModel && !o.hasPdf) {
    res = await request(env.fallbackModel, o);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('OpenRouter error', res.status, body.slice(0, 400));
    throw new AiError(
      res.status === 429 ? 'The AI is busy right now. Please try again in a moment.' : 'The AI service had a problem. Please try again.',
      res.status === 429 ? 429 : 502,
      res.status,
    );
  }
  return res;
};

/** Non-streaming call returning the assistant text. */
export const completeText = async (o: ChatOptions): Promise<string> => {
  const res = await callModel({ ...o, stream: false });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
};
