import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { AudioLines, MessageCircleQuestion, X } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { ChatPanel, type ChatPanelHandle } from '@/features/tutor/ChatPanel';
import { TalkMode } from '@/features/tutor/TalkMode';
import type { TutorInput } from '@shared/learn';

interface Props {
  sessionKey: string;
  context: () => Omit<TutorInput, 'messages' | 'attachment'>;
  /** Text in here can be selected and asked about. */
  within: RefObject<HTMLElement | null>;
  /** Hide the floating button (e.g. while the full Ask tab is open). */
  hidden?: boolean;
  /** Something else opens the panel (the lecture dock): no floating button. */
  handle?: RefObject<AskPanelHandle | null>;
}

export interface AskPanelHandle {
  open: (opener?: HTMLElement | null) => void;
  /** Open and ask the tutor to explain these words from the lecture. */
  explain: (quote: string) => void;
}

const MAX_QUOTE = 400;
const WIDE = '(min-width: 1024px)';

/** A wide screen, where the panel sits beside the page. */
const useWide = () => {
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(WIDE).matches);
  useEffect(() => {
    const m = matchMedia(WIDE);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
};

/**
 * "Ask about this lecture" from anywhere on the lecture page: a floating
 * button opens the tutor in a panel, and selecting text in the notes or
 * transcript offers "Ask about this" with the selection quoted.
 */
export const AskPanel = ({ sessionKey, context, within, hidden, handle }: Props) => {
  const t = useT();
  const ta = t.lectures.askPanel;
  const [open, setOpen] = useState(false);
  const [talking, setTalking] = useState(false);
  const [chip, setChip] = useState<{ text: string; x: number; y: number } | null>(null);
  const chat = useRef<ChatPanelHandle>(null);
  const pending = useRef('');
  const pendingAsk = useRef('');
  const opener = useRef<HTMLElement | null>(null);
  useImperativeHandle(handle, () => ({
    open: (from) => { if (from) opener.current = from; setOpen(true); },
    explain: (quote) => {
      const q = ta.explain(quote.replace(/\s+/g, ' ').trim().slice(0, MAX_QUOTE));
      if (chat.current) chat.current.ask(q); else { pendingAsk.current = q; setOpen(true); }
    },
  }), [ta]);
  const panel = useRef<HTMLDivElement>(null);
  const docked = useWide();

  // Docked: the page makes room for the panel instead of going under it.
  useEffect(() => {
    if (!open || !docked) return;
    document.documentElement.classList.add('ask-docked');
    return () => document.documentElement.classList.remove('ask-docked');
  }, [open, docked]);

  // Offer "Ask about this" when text inside the lecture is selected.
  useEffect(() => {
    const update = () => {
      const sel = document.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!sel || sel.rangeCount === 0 || text.length < 3 || !within.current?.contains(sel.anchorNode)) { setChip(null); return; }
      // The notes have their own toolbar (highlight, Ask AI, Edit with AI).
      const at = sel.anchorNode?.nodeType === 1 ? sel.anchorNode as Element : sel.anchorNode?.parentElement;
      if (at?.closest('.bw-highlighter')) { setChip(null); return; }
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
      if (pendingAsk.current) { chat.current?.ask(pendingAsk.current); pendingAsk.current = ''; }
      else if (pending.current) { chat.current?.prefill(pending.current); pending.current = ''; }
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

      {!open && !hidden && !handle && (
        <button ref={(el) => { opener.current = el; }} type="button" onClick={() => setOpen(true)}
          className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] end-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-5 font-medium text-white shadow-[var(--shadow-lift)] hover:bg-brand-700 md:bottom-6 md:end-6 print:hidden">
          <MessageCircleQuestion className="size-5" aria-hidden="true" />{ta.open}
        </button>
      )}

      {open && (
        // On a phone it covers the page; on a wide screen it docks beside the notes, which stay readable and selectable.
        <div className={cn('fixed inset-0 z-50 flex justify-end print:hidden', docked ? 'pointer-events-none' : 'bg-black/30')}
          onClick={(e) => { if (!docked && e.target === e.currentTarget) setOpen(false); }}>
          <div ref={panel} role="dialog" aria-modal={!docked} aria-label={ta.title}
            className="pointer-events-auto flex h-full w-full flex-col bg-bg shadow-2xl animate-panel-in sm:max-w-md sm:border-s sm:border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="flex-1 font-semibold">{ta.title}</h2>
              <Button variant="secondary" size="sm" icon={<AudioLines className="size-4" />} onClick={() => setTalking(true)}>{t.tutor.talk.open}</Button>
              <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={ta.close} onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
              <ChatPanel ref={chat} inPanel sessionKey={sessionKey} context={context} emptyTitle={t.lectures.askEmpty} starters={t.lectures.askStarters} />
            </div>
          </div>
        </div>
      )}
      <TalkMode open={talking} onClose={() => setTalking(false)} context={context} title={(talking && context().lecture?.title) || ta.title} />
    </>
  );
};
