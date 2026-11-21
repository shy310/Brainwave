export const LOCALES = ['en', 'he', 'ar', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly unknown[]).includes(v);
export const isRtl = (l: Locale) => l === 'he' || l === 'ar';
/** Language name used inside AI prompts. */
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', he: 'Hebrew', ar: 'Arabic', ru: 'Russian' };
/** Each language's name in itself, for language pickers. */
export const NATIVE_NAME: Record<Locale, string> = { en: 'English', he: 'עברית', ar: 'العربية', ru: 'Русский' };
/** Locale for dates and times. Arabic keeps Western digits, like the rest of the app. */
export const DATE_LOCALE: Record<Locale, string> = { en: 'en-GB', he: 'he-IL', ar: 'ar-u-nu-latn', ru: 'ru-RU' };
export const dateLocale = (l: string): string => (isLocale(l) ? DATE_LOCALE[l] : DATE_LOCALE.en);
/** The app language that best matches the browser's, e.g. "ar-EG" → "ar". */
export const localeFromBrowser = (lang: string | undefined): Locale => {
  const code = (lang ?? '').toLowerCase().slice(0, 2);
  return code === 'iw' ? 'he' : isLocale(code) ? code : 'en';
};
