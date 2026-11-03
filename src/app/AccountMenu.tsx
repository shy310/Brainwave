import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useT } from '@/i18n';

/** Click/keyboard-operable account menu (not hover-only). */
export const AccountMenu = () => {
  const t = useT();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (profile?.display_name || '?').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.nav.account}
        onClick={() => setOpen(o => !o)}
        className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 font-semibold text-white"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-12 z-50 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] animate-fade-in">
          <div className="px-3 py-2 text-sm">
            <p className="truncate font-medium">{profile?.display_name}</p>
          </div>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2">
            <Settings className="size-4" aria-hidden="true" /> {t.nav.settings}
          </Link>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); signOut(); }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-600 hover:bg-surface-2 dark:text-rose-400">
            <LogOut className="size-4 rtl:rotate-180" aria-hidden="true" /> {t.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
};
