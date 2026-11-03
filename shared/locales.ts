export const LOCALES = ['en', 'he'] as const;
export type Locale = (typeof LOCALES)[number];
export const isLocale = (v: unknown): v is Locale => v === 'en' || v === 'he';
export const isRtl = (l: Locale) => l === 'he';
/** Language name used inside AI prompts. */
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', he: 'Hebrew' };
