import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { he } from './he';
import { ar } from './ar';
import { ru } from './ru';
import { isLocale, isRtl, localeFromBrowser, type Locale } from '@shared/locales';
import { storage } from '@/lib/storage';

const DICTS: Record<Locale, Dict> = { en, he, ar, ru };
const KEY = 'bw.locale';

const initialLocale = (): Locale => {
  const saved = storage.get(KEY);
  if (isLocale(saved)) return saved;
  return localeFromBrowser(typeof navigator !== 'undefined' ? navigator.language : undefined);
};

interface I18n {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Dict;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18n | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    storage.set(KEY, l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<I18n>(
    () => ({ locale, dir: isRtl(locale) ? 'rtl' : 'ltr', t: DICTS[locale], setLocale }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
};

/** Shorthand for the current dictionary. */
export const useT = () => useI18n().t;
