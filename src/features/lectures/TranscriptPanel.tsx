import { Fragment, useMemo, useState } from 'react';
import { Copy, Download, Pencil, Play, Search, Star, X } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input, Textarea } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import type { Segment } from '@shared/lectures';
import { formatTime } from './audio';

/** Case-insensitive matches of `query` in `text`, as [start, end) ranges. */
export const findMatches = (text: string, query: string): [number, number][] => {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const hay = text.toLocaleLowerCase();
  const out: [number, number][] = [];
  for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + q.length)) out.push([i, i + q.length]);
  return out;
};

/** Plain-text transcript for copying; with [m:ss] times for recordings when exporting. */
export const transcriptText = (segments: Segment[], withTimes: boolean) =>
  segments.filter((s) => s.text.trim())
    .map((s) => (withTimes ? `[${formatTime(s.start)}] ${s.text.trim()}` : s.text.trim()))
    .join('\n\n');

const Highlighted = ({ text, query }: { text: string; query: string }) => {
  const ranges = findMatches(text, query);
  let at = 0;
  return (
    <p className="min-w-0 flex-1 whitespace-pre-wrap" dir="auto">
      {ranges.map(([a, b], i) => {
        const before = text.slice(at, a);
        at = b;
        return <Fragment key={i}>{before}<mark className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-700/60">{text.slice(a, b)}</mark></Fragment>;
      })}
      {text.slice(at)}
    </p>
  );
};

interface Props {
  segments: Segment[];
  /** Recordings show times; pasted text doesn't. */
  timed: boolean;
  fileName: string;
  onSave: (segments: Segment[]) => Promise<void>;
  /** Play the kept recording from this time; when set, each time is a play button. */
  onPlay?: (start: number) => void;
  /** Which segments were marked as important while recording. */
  marked?: boolean[];
}

/** The transcript with search, copy, export and editing. */
export const TranscriptPanel = ({ segments, timed, fileName, onSave, onPlay, marked }: Props) => {
  const t = useT();
  const tt = t.lectures.transcriptTools;
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => segments.filter((s) => s.text.trim()), [segments]);
  const matching = useMemo(() => (query.trim() ? visible.filter((s) => findMatches(s.text, query).length) : visible), [visible, query]);
  const count = useMemo(() => visible.reduce((n, s) => n + findMatches(s.text, query).length, 0), [visible, query]);

  const copy = async () => {
    await navigator.clipboard.writeText(transcriptText(visible, false)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([transcriptText(visible, timed)], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${fileName}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(visible.map((s, i) => ({ start: s.start, text: draft[i].trim() })).filter((s) => s.text));
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  if (draft) {
    return (
      <Card className="space-y-4 p-6">
        <p className="text-sm text-muted">{tt.editHint}</p>
        {visible.map((s, i) => (
          <div key={i} className="flex gap-3">
            {timed && <span className="w-12 shrink-0 pt-3 text-xs tabular-nums text-muted">{formatTime(s.start)}</span>}
            <Textarea aria-label={tt.part(formatTime(s.start))} dir="auto" rows={Math.min(12, Math.max(3, Math.ceil(draft[i].length / 70)))}
              value={draft[i]} onChange={(e) => setDraft((d) => d!.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button loading={saving} onClick={() => void save()}>{tt.saveEdits}</Button>
          <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>{tt.cancel}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input type="search" aria-label={tt.search} placeholder={tt.search} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9 pe-10 [&::-webkit-search-cancel-button]:appearance-none" dir="auto" />
          {query && (
            <button type="button" aria-label={tt.clear} onClick={() => setQuery('')}
              className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2">
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Copy className="size-4" />} onClick={() => void copy()}>{copied ? t.lectures.copied : t.lectures.copy}</Button>
          <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={download}>{t.lectures.download}</Button>
          <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={() => setDraft(visible.map((s) => s.text))}>{tt.edit}</Button>
        </div>
      </div>
      {query.trim() && <p className="text-sm text-muted" aria-live="polite">{count ? tt.matches(count) : tt.noMatches}</p>}
      {onPlay && <p className="text-xs text-muted">{tt.tapToPlay}</p>}
      {matching.map((s) => (
        <div key={s.start} id={`seg-${s.start}`}
          className={cn('flex gap-3', marked?.[segments.indexOf(s)] && '-mx-2 rounded-xl border-s-4 border-accent-400 bg-accent-300/15 px-2 py-1.5 dark:bg-accent-500/10')}>
          {timed && onPlay ? (
            <button type="button" onClick={() => onPlay(s.start)} aria-label={tt.playFrom(formatTime(s.start))}
              className="group -my-1 inline-flex h-7 w-16 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs tabular-nums text-brand-700 hover:bg-brand-500/10 dark:text-brand-300">
              <Play className="size-3 shrink-0 fill-current" aria-hidden="true" />{formatTime(s.start)}
            </button>
          ) : timed && <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted">{formatTime(s.start)}</span>}
          {query.trim() ? <Highlighted text={s.text} query={query} /> : <Rich text={s.text} className="min-w-0 flex-1" />}
          {marked?.[segments.indexOf(s)] && <Star className="mt-1 size-4 shrink-0 fill-accent-400 text-accent-500" role="img" aria-label={t.lectures.marks.badge} />}
        </div>
      ))}
    </Card>
  );
};
