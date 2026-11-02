import { supabase } from './supabase';
import type { Locale } from '@shared/locales';
import type { Grade } from '@shared/grades';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: number) { super(message); }
}

// Locale and grade are attached to every AI call so the server can tailor prompts.
let aiContext: { locale: Locale; grade: Grade } = { locale: 'en', grade: '9' };
export const setAiContext = (ctx: { locale: Locale; grade: Grade }) => { aiContext = ctx; };

const authHeaders = async (): Promise<Record<string, string>> => {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const post = async (path: string, body: unknown, signal?: AbortSignal) =>
  fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
    signal,
  });

const failure = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  const body = data as { error?: string; code?: number };
  return new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.code ?? res.status);
};

/** Run a named AI operation that returns structured data. */
export const callAi = async <T,>(op: string, input: unknown, signal?: AbortSignal): Promise<T> => {
  const res = await post(`/api/ai/${op}`, { input, ...aiContext }, signal);
  if (!res.ok) throw await failure(res);
  return ((await res.json()) as { data: T }).data;
};

/** Run a streaming AI operation; `onText` receives each chunk as it arrives. */
export const streamAi = async (
  op: string, input: unknown, onText: (chunk: string) => void, signal?: AbortSignal,
): Promise<string> => {
  const res = await post(`/api/ai/${op}`, { input, ...aiContext }, signal);
  if (!res.ok || !res.body) throw await failure(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const ev of events) {
      const line = ev.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return full;
      const msg = JSON.parse(payload) as { text?: string; error?: string };
      if (msg.error) throw new ApiError(msg.error, 502);
      if (msg.text) { full += msg.text; onText(msg.text); }
    }
  }
  return full;
};
