import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean }

/**
 * A button that opens a short list of actions (menu-button pattern): arrow keys
 * move, Enter picks, Escape or a click outside closes and returns focus.
 */
/** Draws a custom opener (e.g. a round dock button); it must forward `ref` and spread `props`. */
export type MenuTrigger = (p: { ref: RefObject<HTMLButtonElement | null>; props: ButtonHTMLAttributes<HTMLButtonElement> }) => ReactNode;

export const Menu = ({ label, icon, items, align = 'start', above, trigger }: {
  label: string; icon?: ReactNode; items: MenuItem[]; align?: 'start' | 'end';
  /** Open upwards (for menus near the bottom of the screen). */
  above?: boolean;
  trigger?: MenuTrigger;
}) => {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = (focus = true) => { setOpen(false); if (focus) button.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const els = () => [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    els()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const all = els(); const i = all.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); all[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); all.at(-1)?.focus(); }
      else if (e.key === 'Tab') close(false);
    };
    const onDown = (e: PointerEvent) => { if (!list.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      {trigger
        ? trigger({ ref: button, props: { 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': open ? id : undefined, onClick: () => setOpen((v) => !v) } })
        : (
          <Button ref={button} variant="secondary" size="sm" icon={icon} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
            onClick={() => setOpen((v) => !v)}>{label}</Button>
        )}
      {open && (
        <div ref={list} id={id} role="menu" aria-label={label}
          className={cn('absolute z-50 min-w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)] animate-pop-in',
            above ? 'bottom-full mb-2' : 'top-11', align === 'end' ? 'end-0' : 'start-0')}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" tabIndex={-1}
              onClick={() => { close(); it.onSelect(); }}
              className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium outline-none hover:bg-surface-2 focus-visible:bg-surface-2',
                it.danger && 'text-rose-600 dark:text-rose-400')}>
              <span className="text-muted [&>svg]:size-4" aria-hidden="true">{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
