import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface ContextItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean }
export interface ContextMenuState { x: number; y: number; items: ContextItem[]; label: string }

/**
 * A menu that opens where you right-clicked (or long-pressed, or at the card
 * when opened from the keyboard). Arrow keys move, Enter picks, Escape or a
 * click outside closes; it stays inside the screen.
 */
export const ContextMenu = ({ menu, onClose }: { menu: ContextMenuState | null; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.max(pad, Math.min(menu.x, window.innerWidth - r.width - pad)),
      top: Math.max(pad, Math.min(menu.y, window.innerHeight - r.height - pad)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const els = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const opener = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => els()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      const all = els(); const i = all.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') { e.preventDefault(); onClose(); opener?.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); all[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); all.at(-1)?.focus(); }
      else if (e.key === 'Tab') onClose();
    };
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    // Scrolling the page away closes it (small layout nudges don't).
    const startY = window.scrollY;
    const onScroll = () => { if (Math.abs(window.scrollY - startY) > 24) onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('scroll', onScroll); };
  }, [menu, onClose]);

  if (!menu) return null;
  // In a portal so a transformed ancestor (entry animations) can't shift the fixed position.
  return createPortal(
    <div ref={ref} role="menu" aria-label={menu.label}
      // It grows out of the spot you clicked or pressed.
      style={pos ? { left: pos.left, top: pos.top, transformOrigin: `${menu.x - pos.left}px ${menu.y - pos.top}px` } : { left: -9999, top: -9999 }}
      className="fixed z-[60] min-w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)] animate-pop-in">
      {menu.items.map((it, i) => (
        <button key={i} type="button" role="menuitem" tabIndex={-1}
          onClick={() => { onClose(); it.onSelect(); }}
          className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium outline-none hover:bg-surface-2 focus-visible:bg-surface-2',
            it.danger && 'text-rose-600 dark:text-rose-400', it.danger && i > 0 && 'mt-1 border-t border-line pt-3')}>
          <span className={cn('[&>svg]:size-4', it.danger ? '' : 'text-muted')} aria-hidden="true">{it.icon}</span>{it.label}
        </button>
      ))}
    </div>,
    document.body,
  );
};

/**
 * Open on right-click, on a long press (touch), or with the Menu key / Shift+F10
 * from the keyboard. A long press also swallows the tap that ends it, so the
 * card under the finger doesn't open as well.
 */
export const useContextTriggers = () => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; start.current = null; };
  return useCallback((open: (x: number, y: number) => void) => ({
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); cancel(); open(e.clientX, e.clientY); },
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        if (start.current) { fired.current = true; open(start.current.x, start.current.y); }
        timer.current = null;
      }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        open(r.left + 16, r.top + 16);
      }
    },
  }), []);
};
