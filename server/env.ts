// Server configuration. Everything here is read from environment variables and
// never sent to the browser.
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const env = {
  isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
  openrouterKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterUrl: process.env.OPENROUTER_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions',
  model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL ?? 'openai/gpt-4o-mini',
  /**
   * How lecture audio is transcribed:
   *  - 'llm' (default): an audio-capable chat model, with a cleanup prompt.
   *  - 'stt': a dedicated speech-to-text model (OpenRouter /audio/transcriptions),
   *    falling back to 'llm' if it fails.
   */
  transcribeMode: (process.env.TRANSCRIBE_MODE === 'stt' ? 'stt' : 'llm') as 'stt' | 'llm',
  transcribeModel: process.env.TRANSCRIBE_MODEL ?? 'openai/gpt-4o-mini-transcribe',
  /** In 'stt' mode, also run the LLM cleanup prompt on the text (fillers, math as LaTeX). */
  transcribeCleanup: process.env.TRANSCRIBE_CLEANUP === 'true',
  supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  dailyLimit: num(process.env.AI_DAILY_LIMIT, 200),
  perMinuteLimit: num(process.env.AI_PER_MINUTE_LIMIT, 20),
  allowDemo: process.env.ALLOW_DEMO_MODE === 'true',
  // Natural narration voices (Microsoft Azure AI Speech). Optional: without them
  // the app falls back to the device's built-in voices.
  azureSpeechKey: process.env.AZURE_SPEECH_KEY ?? '',
  azureSpeechRegion: (process.env.AZURE_SPEECH_REGION ?? '').trim().toLowerCase(),
  ttsDailyChars: num(process.env.TTS_DAILY_CHARS, 60_000),
};

export const ttsConfigured = () => Boolean(env.azureSpeechKey && /^[a-z0-9]+$/.test(env.azureSpeechRegion));

export const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Demo mode lets the app run with no Supabase project (local development and
 * automated tests). It is never allowed in production, so the AI endpoints can
 * never be used anonymously on the live site.
 */
export const demoModeActive = () => !supabaseConfigured() && !env.isProduction && env.allowDemo;
