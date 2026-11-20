/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** The deployed backend, for the Android app (the web app uses its own origin). */
  readonly VITE_API_URL?: string;
  /** The public web address, for share links made in the Android app. */
  readonly VITE_PUBLIC_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
