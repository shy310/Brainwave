import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned under the content (e.g. an Apply button). */
  footer?: ReactNode;
  className?: string;
}

/**
 * A sheet: slides up from the bottom on phones (with a grabber), a centred
 * card on bigger screens. Escape, the close button or a tap outside closes it;
 * focus stays inside while it's open and returns to where it was.
 */
export const Sheet = ({ open, onClose, title, children, footer, className }: Props) => {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Closing it because `open` turned false also fires "close": only report closes the person made.
  const isOpen = useRef(open);
  isOpen.current = open;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={() => { if (isOpen.current) onClose(); }}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={cn('m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl border border-line bg-surface p-0 text-fg shadow-[var(--shadow-lift)]',
        'animate-pop-in backdrop:animate-fade-in backdrop:bg-black/40',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:animate-sheet-up', className)}>
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-3">
            <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t.common.close}
              className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-fg">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
};
