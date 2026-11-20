import { useEffect, useRef, useState, type RefObject } from 'react';
import { MessageCircleQuestion, X } from 'lucide-react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { ChatPanel, type ChatPanelHandle } from '@/features/tutor/ChatPanel';
import type { TutorInput } from '@shared/learn';

interface Props {
  sessionKey: string;
  context: () => Omit<TutorInput, 'messages' | 'attachment'>;
  /** Text in here can be selected and asked about. */
  within: RefObject<HTMLElement | null>;
  /** Hide the floating button (e.g. while the full Ask tab is open). */
  hidden?: boolean;
}

const MAX_QUOTE = 400;

/**
 * "Ask about this lecture" from anywhere on the lecture page: a floating
 * button opens the tutor in a panel, and selecting text in the notes or
 * transcript offers "Ask about this" with the selection quoted.
 */
export const AskPanel = ({ sessionKey, context, within, hidden }: Props) => {
  const t = useT();
  const ta = t.lectures.askPanel;
  const [open, setOpen] = useState(false);
  const [chip, setChip] = useState<{ text: string; x: number; y: number } | null>(null);
  const chat = useRef<ChatPanelHandle>(null);
  const pending = useRef('');
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Offer "Ask about this" when text inside the lecture is selected.
  useEffect(() => {
    const update = () => {
      const sel = document.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!sel || sel.rangeCount === 0 || text.length < 3 || !within.current?.contains(sel.anchorNode)) { setChip(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setChip({ text: text.slice(0, MAX_QUOTE), x: Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2)), y: rect.bottom + 8 });
    };
    const hide = () => setChip(null);
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', hide, { passive: true });
    return () => { document.removeEventListener('selectionchange', update); window.removeEventListener('scroll', hide); };
  }, [within]);

  // Escape closes; focus moves into the panel and back to the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      if (pending.current) { chat.current?.prefill(pending.current); pending.current = ''; }
      else panel.current?.querySelector<HTMLElement>('textarea')?.focus();
    });
    return () => { document.removeEventListener('keydown', onKey); opener.current?.focus(); };
  }, [open]);

  const askAbout = (text: string) => {
    pending.current = ta.quote(text.replace(/\s+/g, ' '));
    document.getSelection()?.removeAllRanges();
    setChip(null);
    if (open) { chat.current?.prefill(pending.current); pending.current = ''; } else setOpen(true);
  };

  return (
    <>
      {chip && !open && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => askAbout(chip.text)}
          style={{ left: chip.x, top: chip.y }}
          className="fixed z-50 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-fg px-3 py-1.5 text-sm font-medium text-bg shadow-lg print:hidden">
          <MessageCircleQuestion className="size-4" aria-hidden="true" />{ta.aboutSelection}
        </button>
      )}

      {!open && !hidden && (
        <button ref={opener} type="button" onClick={() => setOpen(true)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] end-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-5 font-medium text-white shadow-[var(--shadow-lift)] hover:bg-brand-700 md:bottom-6 md:end-6 print:hidden">
          <MessageCircleQuestion className="size-5" aria-hidden="true" />{ta.open}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 print:hidden" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div ref={panel} role="dialog" aria-modal="true" aria-label={ta.title}
            className="flex h-full w-full flex-col bg-bg shadow-2xl sm:max-w-md sm:border-s sm:border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="flex-1 font-semibold">{ta.title}</h2>
              <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={ta.close} onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
              <ChatPanel ref={chat} inPanel sessionKey={sessionKey} context={context} emptyTitle={t.lectures.askEmpty} starters={t.lectures.askStarters} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
