// Server configuration. Everything here is read from environment variables and
// never sent to the browser.
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const env = {
  isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
  openrouterKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterUrl: process.env.OPENROUTER_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions',
  model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL ?? 'openai/gpt-4o-mini',
  supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  dailyLimit: num(process.env.AI_DAILY_LIMIT, 200),
  perMinuteLimit: num(process.env.AI_PER_MINUTE_LIMIT, 20),
  allowDemo: process.env.ALLOW_DEMO_MODE === 'true',
};

export const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Demo mode lets the app run with no Supabase project (local development and
 * automated tests). It is never allowed in production, so the AI endpoints can
 * never be used anonymously on the live site.
 */
export const demoModeActive = () => !supabaseConfigured() && !env.isProduction && env.allowDemo;
