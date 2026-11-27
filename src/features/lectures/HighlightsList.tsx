import { useState } from 'react';
import { Highlighter as HighlightIcon, Trash2 } from '@/ui/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Textarea } from '@/ui/Field';
import { MAX_COMMENT, sortHighlights, type NoteHighlight } from '@shared/highlights';
import { SWATCH, rangeFor } from './Highlighter';

/** Every highlight and comment in the notes, in order, to jump to, comment on or remove. */
export const HighlightsList = ({ highlights, onChange }: { highlights: NoteHighlight[]; onChange: (next: NoteHighlight[]) => void }) => {
  const t = useT();
  const th = t.lectures.highlights;
  const [writing, setWriting] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const list = sortHighlights(highlights);
  const found = (h: NoteHighlight) => !!rangeFor(document, h);

  const show = (h: NoteHighlight) => {
    const r = rangeFor(document, h);
    const el = r?.startContainer.parentElement?.closest('[data-block]');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.classList.remove('animate-flash');
    requestAnimationFrame(() => el?.classList.add('animate-flash'));
  };

  return (
    <Card className="space-y-3 p-4 print:hidden">
      <h2 className="flex items-center gap-2 font-semibold">
        <HighlightIcon className="size-4 text-accent-600 dark:text-accent-300" aria-hidden="true" />{th.title}
        {list.length > 0 && <span className="text-sm font-normal text-muted">· {th.count(list.length)}</span>}
      </h2>
      {!list.length && <p className="text-sm text-muted">{th.hint}</p>}
      <ul className="space-y-2">
        {list.map((h) => {
          const here = found(h);
          return (
            <li key={h.id} className="flex gap-3 rounded-xl bg-surface-2/60 p-3">
              <span className={cn('mt-1 size-3 shrink-0 rounded-full', SWATCH[h.color])} aria-label={th.colors[h.color]} role="img" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="line-clamp-3 text-sm italic" dir="auto">“{h.quote}”</p>
                {!here && <p className="text-xs text-muted">{th.missing}</p>}
                {writing === h.id ? (
                  <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); onChange(highlights.map((x) => (x.id === h.id ? { ...x, comment: draft.trim() || undefined } : x))); setWriting(null); }}>
                    <Textarea aria-label={h.comment ? th.editComment : th.addComment} value={draft} autoFocus rows={2} maxLength={MAX_COMMENT}
                      placeholder={th.placeholder} onChange={(e) => setDraft(e.target.value)} dir="auto" />
                    <Button type="submit" size="sm">{th.save}</Button>
                  </form>
                ) : h.comment && <p className="whitespace-pre-wrap text-sm" dir="auto">{h.comment}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
                  {here && <button type="button" onClick={() => show(h)} className="text-brand-700 hover:underline dark:text-brand-300">{th.show}</button>}
                  {writing !== h.id && (
                    <button type="button" onClick={() => { setDraft(h.comment ?? ''); setWriting(h.id); }} className="text-brand-700 hover:underline dark:text-brand-300">
                      {h.comment ? th.editComment : th.addComment}
                    </button>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => onChange(highlights.filter((x) => x.id !== h.id))} aria-label={th.remove} title={th.remove}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-rose-500/10 hover:text-rose-600">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
