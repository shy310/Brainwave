import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { LogOut, Trash2, TriangleAlert } from '@/ui/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { animateOut, resetAnimations } from './motion';

export interface ConfirmOptions {
  message: string;
  /** The word on the confirm button: what will happen ("Delete", "Leave"). */
  action: 'delete' | 'leave' | 'remove';
}

interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Ask before doing something that can't be undone, in the app's own dialog
 * (not the browser's). Resolves true when the person confirms.
 */
export const askConfirm = (o: ConfirmOptions): Promise<boolean> => new Promise((resolve) => {
  pending?.resolve(false);
  pending = { ...o, resolve };
  emit();
});

const settle = (ok: boolean) => {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
};

const ICON = { delete: Trash2, remove: Trash2, leave: LogOut } as const;

/** Mounted once at the root; shows whatever askConfirm() is waiting on. */
export const ConfirmHost = () => {
  const t = useT();
  const live = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => pending, () => null);
  // The last question stays on screen while the dialog animates out.
  const last = useRef<Pending | null>(null);
  if (live) last.current = live;
  const p = live ?? last.current;
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (live) resetAnimations(d);
    if (live && !d.open) { d.showModal?.(); cancelRef.current?.focus(); }
    if (!live && d.open) void animateOut(d, 'pop').then(() => { if (!pending) { d.close(); resetAnimations(d); } });
  }, [live]);

  const Icon = p ? ICON[p.action] : TriangleAlert;
  return (
    <dialog ref={ref} role="alertdialog" aria-labelledby={id} aria-modal="true"
      onCancel={(e) => { e.preventDefault(); settle(false); }}
      onClick={(e) => { if (e.target === e.currentTarget) settle(false); }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-3xl border border-line bg-surface p-0 text-fg shadow-[var(--shadow-lift)] backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px] open:animate-pop-in">
      {p && (
        <div className="space-y-5 p-6 text-center">
          <span className={cn('mx-auto flex size-12 items-center justify-center rounded-2xl',
            p.action === 'leave' ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300' : 'bg-rose-500/12 text-rose-600 dark:text-rose-400')}>
            <Icon className={cn('size-6', p.action === 'leave' && 'rtl:rotate-180')} aria-hidden="true" />
          </span>
          <p id={id} className="text-lg font-semibold leading-snug" dir="auto">{p.message}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button ref={cancelRef} variant="secondary" size="lg" onClick={() => settle(false)}>{t.common.cancel}</Button>
            <Button variant={p.action === 'leave' ? 'primary' : 'danger'} size="lg" onClick={() => settle(true)}>{t.common[p.action]}</Button>
          </div>
        </div>
      )}
    </dialog>
  );
};
