import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storage } from '@/lib/storage';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'bw.theme';

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

const apply = (theme: Theme) => {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  if (root.classList.contains('dark') === dark) return;
  // Ease between light and dark instead of a sudden flash (only when it actually changes after load).
  if (root.dataset.themed) {
    root.classList.add('theme-fade');
    window.setTimeout(() => root.classList.remove('theme-fade'), 320);
  }
  root.dataset.themed = '1';
  root.classList.toggle('dark', dark);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => (storage.get(KEY) as Theme) || 'system');

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (t: Theme) => { setThemeState(t); storage.set(KEY, t); };
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
