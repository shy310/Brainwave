import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Textarea } from '@/ui/Field';
import { HIGHLIGHT_COLORS, MAX_COMMENT, addHighlight, locate, type HighlightColor, type NoteHighlight } from '@shared/highlights';

export const SWATCH: Record<HighlightColor, string> = {
  yellow: 'bg-[#ffe08a]', green: 'bg-[#a7f3c9]', blue: 'bg-[#bcd2ff]', pink: 'bg-[#ffc4d6]',
};

/** The text-node position of character `at` inside `el`. */
const pointAt = (el: Element, at: number): [Node, number] | null => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (at <= seen + len) return [n, at - seen];
    seen += len;
  }
  return null;
};

/** The DOM range a highlight covers now, or null if its text isn't in the notes any more. */
export const rangeFor = (root: ParentNode, h: NoteHighlight): Range | null => {
  const el = root.querySelector(`[data-block="${CSS.escape(h.block)}"]`);
  if (!el) return null;
  const start = locate(el.textContent ?? '', h.quote, h.offset);
  if (start < 0) return null;
  const a = pointAt(el, start), b = pointAt(el, start + h.quote.length);
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a[0], a[1]);
  r.setEnd(b[0], b[1]);
  return r;
};

const supported = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** Characters from the start of `block` to (node, offset). */
const offsetIn = (block: Element, node: Node, offset: number) => {
  const pre = document.createRange();
  pre.setStart(block, 0);
  pre.setEnd(node, offset);
  return pre.toString().length;
};

type Pending = { block: string; quote: string; offset: number; x: number; y: number; below: boolean };
type Editing = { id: string; x: number; y: number; below: boolean; writing: boolean };

/**
 * Wraps the notes: select text to highlight it in a colour or comment on it;
 * tap a highlight to recolour it, edit its comment or remove it. Highlights
 * are painted with the CSS Custom Highlight API, so the notes' own markup
 * (formatting, maths) is never touched.
 */
export const Highlighter = ({ highlights, onChange, children }: { highlights: NoteHighlight[]; onChange: (next: NoteHighlight[]) => void; children: ReactNode }) => {
  const t = useT();
  const th = t.lectures.highlights;
  const root = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState('');

  // Paint every highlight, grouped by colour (and commented ones get a dotted underline).
  useLayoutEffect(() => {
    if (!supported() || !root.current) return;
    const groups = new Map<string, Range[]>();
    for (const h of highlights) {
      const r = rangeFor(root.current, h);
      if (!r) continue;
      groups.set(`bw-${h.color}`, [...(groups.get(`bw-${h.color}`) ?? []), r]);
      if (h.comment) groups.set('bw-comment', [...(groups.get('bw-comment') ?? []), r]);
    }
    const names = [...HIGHLIGHT_COLORS.map((c) => `bw-${c}`), 'bw-comment'];
    for (const n of names) {
      const ranges = groups.get(n);
      if (ranges?.length) CSS.highlights.set(n, new Highlight(...ranges));
      else CSS.highlights.delete(n);
    }
    return () => names.forEach((n) => CSS.highlights.delete(n));
  });

  const place = (rect: DOMRect) => {
    const below = rect.top < 120 || window.matchMedia('(pointer: coarse)').matches; // phones show their own menu above
    return { x: Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120), y: below ? rect.bottom + 10 : rect.top - 10, below };
  };

  // A new selection inside one part of the notes: offer the toolbar.
  const readSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !root.current) { setPending(null); return; }
    const range = sel.getRangeAt(0);
    const startBlock = (range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement)?.closest('[data-block]');
    const endBlock = (range.endContainer.nodeType === 1 ? range.endContainer as Element : range.endContainer.parentElement)?.closest('[data-block]');
    if (!startBlock || startBlock !== endBlock || !root.current.contains(startBlock)) { setPending(null); return; }
    const quote = range.toString();
    if (quote.trim().length < 2) { setPending(null); return; }
    setEditing(null);
    setPending({ block: startBlock.getAttribute('data-block')!, quote, offset: offsetIn(startBlock, range.startContainer, range.startOffset), ...place(range.getBoundingClientRect()) });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onChange = () => { clearTimeout(timer); timer = setTimeout(readSelection, 200); };
    document.addEventListener('selectionchange', onChange);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', onChange); };
  }, [readSelection]);

  const add = (color: HighlightColor, comment = false) => {
    if (!pending) return;
    const h: NoteHighlight = { id: crypto.randomUUID(), block: pending.block, quote: pending.quote, offset: pending.offset, color, createdAt: Date.now() };
    const next = addHighlight(highlights, h);
    onChange(next);
    const saved = next.find((x) => x.block === h.block && x.offset === h.offset && x.quote === h.quote);
    window.getSelection()?.removeAllRanges();
    if (comment && saved) { setDraft(saved.comment ?? ''); setEditing({ id: saved.id, x: pending.x, y: pending.y, below: pending.below, writing: true }); }
    setPending(null);
  };

  // Tapping a highlight opens it.
  const onClick = (e: React.MouseEvent) => {
    if (!window.getSelection()?.isCollapsed || !root.current) return;
    const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
    const caret = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
    const node = caret?.offsetNode ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer;
    const off = caret?.offset ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startOffset ?? 0;
    const block = (node?.nodeType === 1 ? node as Element : node?.parentElement)?.closest('[data-block]');
    if (!node || !block) return;
    const at = offsetIn(block, node, off);
    const id = block.getAttribute('data-block');
    const hit = highlights.find((h) => {
      if (h.block !== id) return false;
      const s = locate(block.textContent ?? '', h.quote, h.offset);
      return s >= 0 && at >= s && at <= s + h.quote.length;
    });
    if (!hit) { setEditing(null); return; }
    const r = rangeFor(root.current, hit);
    setDraft(hit.comment ?? '');
    setEditing({ id: hit.id, ...place(r?.getBoundingClientRect() ?? new DOMRect(e.clientX, e.clientY, 0, 0)), writing: false });
  };

  const current = editing && highlights.find((h) => h.id === editing.id);
  const update = (patch: Partial<NoteHighlight>) => current && onChange(highlights.map((h) => (h.id === current.id ? { ...h, ...patch } : h)));

  // Escape or a tap elsewhere closes the toolbar.
  useEffect(() => {
    if (!pending && !editing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPending(null); setEditing(null); } };
    const onScroll = () => { setPending(null); if (!editing?.writing) setEditing(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll); };
  }, [pending, editing]);

  const floating = (x: number, y: number, below: boolean, body: ReactNode, label: string) => createPortal(
    <div role="toolbar" aria-label={label} onPointerDown={(e) => { if ((e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}
      style={{ left: x, top: y }}
      className={cn('fixed z-[60] -translate-x-1/2 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] animate-pop-in',
        below ? 'origin-top' : '-translate-y-full origin-bottom')}>
      {body}
    </div>, document.body);

  const swatches = (onPick: (c: HighlightColor) => void, active?: HighlightColor) => HIGHLIGHT_COLORS.map((c) => (
    <button key={c} type="button" onClick={() => onPick(c)} aria-label={th.color(th.colors[c])} aria-pressed={active === c}
      className={cn('size-8 rounded-full border-2 transition-transform active:scale-90', SWATCH[c], active === c ? 'border-fg' : 'border-transparent hover:scale-110')} />
  ));

  return (
    <div ref={root} onClick={onClick} className="bw-highlighter">
      {children}
      {pending && floating(pending.x, pending.y, pending.below, (
        <div className="flex items-center gap-1">
          {swatches((c) => add(c))}
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          <button type="button" onClick={() => add('yellow', true)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium hover:bg-surface-2">
            <MessageSquarePlus className="size-4" aria-hidden="true" />{th.comment}
          </button>
        </div>
      ), th.toolbar)}
      {current && editing && floating(editing.x, editing.y, editing.below, (
        <div className="w-72 max-w-[calc(100vw-2rem)] space-y-2 p-1">
          <div className="flex items-center gap-1">
            {swatches((c) => update({ color: c }), current.color)}
            <span className="flex-1" />
            <button type="button" onClick={() => { onChange(highlights.filter((h) => h.id !== current.id)); setEditing(null); }}
              aria-label={th.remove} title={th.remove} className="flex size-8 items-center justify-center rounded-full text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
          {editing.writing ? (
            <form onSubmit={(e) => { e.preventDefault(); update({ comment: draft.trim() || undefined }); setEditing(null); }} className="space-y-2">
              <Textarea aria-label={current.comment ? th.editComment : th.addComment} value={draft} autoFocus rows={3} maxLength={MAX_COMMENT}
                placeholder={th.placeholder} onChange={(e) => setDraft(e.target.value)} dir="auto" />
              <Button type="submit" size="sm" block>{th.save}</Button>
            </form>
          ) : (
            <>
              {current.comment && <p className="whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2 text-sm" dir="auto">{current.comment}</p>}
              <button type="button" onClick={() => setEditing({ ...editing, writing: true })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium hover:bg-surface-2">
                <MessageSquarePlus className="size-4" aria-hidden="true" />{current.comment ? th.editComment : th.addComment}
              </button>
            </>
          )}
        </div>
      ), th.toolbar)}
    </div>
  );
};
