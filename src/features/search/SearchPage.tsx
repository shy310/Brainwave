import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ToolHero } from '@/ui/PageHeader';
import { Loading } from '@/ui/Wave';
import { Link, useSearchParams } from 'react-router';
import { FileText, Search, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Field';
import { Shimmer } from '@/ui/Feedback';
import { lectureRepo } from '@/features/lectures/repo';
import { formatTime } from '@/features/lectures/audio';
import { highlights, search, type AskLecturesOutput, type Hit, type SearchableLecture } from '@shared/search';

const ASK_PASSAGES = 8;

const Marked = ({ text, query }: { text: string; query: string }) => {
  const ranges = highlights(text, query);
  if (!ranges.length) return <>{text}</>;
  let last = 0;
  return (
    <>
      {ranges.map(([a, b], i) => {
        const before = text.slice(last, a);
        last = b;
        return <Fragment key={i}>{before}<mark className="rounded bg-accent-300/60 px-0.5 text-inherit dark:bg-accent-500/40">{text.slice(a, b)}</mark></Fragment>;
      })}
      {text.slice(last)}
    </>
  );
};

const hitLink = (h: Hit) => `/lectures/${h.lectureId}${h.kind === 'transcript' && h.start !== undefined ? `?t=${Math.floor(h.start)}` : ''}`;

/** Search every lecture's transcript and notes, and ask a question answered from them with sources. */
export default function SearchPage() {
  const { t } = useI18n();
  const ts = t.search;
  const toMessage = useAiError();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const deferred = useDeferredValue(query);
  const [lectures, setLectures] = useState<SearchableLecture[] | null>(null);
  const [answer, setAnswer] = useState<{ q: string; out: AskLecturesOutput; sources: Hit[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { lectureRepo.searchable().then(setLectures).catch(() => setLectures([])); }, []);
  // Keep the query in the address, so Back returns to the same results.
  useEffect(() => {
    const id = setTimeout(() => setParams(deferred.trim() ? { q: deferred.trim() } : {}, { replace: true }), 300);
    return () => clearTimeout(id);
  }, [deferred, setParams]);

  const hits = useMemo(() => (lectures && deferred.trim() ? search(lectures, deferred) : []), [lectures, deferred]);
  const titles = useMemo(() => new Map(lectures?.map((l) => [l.id, l.title || t.lectures.untitled]) ?? []), [lectures, t]);

  const ask = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || !hits.length) return;
    const sources = hits.slice(0, ASK_PASSAGES);
    setAsking(true);
    setError('');
    try {
      const out = await callAi<AskLecturesOutput>('askLectures', {
        question: q.slice(0, 500),
        passages: sources.map((h, i) => ({ n: i + 1, lecture: (titles.get(h.lectureId) ?? '').slice(0, 200), text: h.text.slice(0, 1500) })),
      });
      setAnswer({ q, out, sources });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally { setAsking(false); }
  };

  // [2] in the answer becomes a link to that passage.
  const withCitations = (text: string, sources: Hit[]) => text.split(/(\[\d+\])/g).map((part, i) => {
    const n = /^\[(\d+)\]$/.exec(part)?.[1];
    const h = n ? sources[Number(n) - 1] : undefined;
    return h ? (
      <Link key={i} to={hitLink(h)} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-500/12 px-1 align-[0.1em] text-xs font-semibold text-brand-700 hover:bg-brand-500/20 dark:text-brand-300"
        aria-label={`${t.search.sources} ${n}: ${titles.get(h.lectureId)}`}>{n}</Link>
    ) : <Fragment key={i}>{part}</Fragment>;
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ToolHero tool="search" back={{ to: '/lectures', label: t.lectures.title }} title={ts.title} subtitle={ts.subtitle} />

      <form onSubmit={ask} role="search" className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input ref={input} type="search" autoFocus aria-label={ts.title} placeholder={ts.placeholder} value={query} dir="auto"
            onChange={(e) => { setQuery(e.target.value); setAnswer(null); }} className="h-13 ps-11 text-base" />
        </div>
        {!query.trim() && <p className="px-1 text-sm text-muted">{ts.hint}</p>}
        {hits.length > 0 && (
          <Button type="submit" loading={asking} icon={<Sparkles className="size-4" />}>{ts.ask}</Button>
        )}
      </form>

      {!lectures && <Loading label={t.common.loading} />}
      {lectures?.length === 0 && <Alert>{ts.empty}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {asking && <Card className="p-5 text-muted"><Shimmer text={ts.asking} /></Card>}
      {answer && !asking && (
        <Card className="space-y-3 border-brand-200 p-5 animate-pop-in dark:border-brand-800" aria-live="polite">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-brand-700 dark:text-brand-300" aria-hidden="true" />{ts.answer}</h2>
          {!answer.out.found && <p className="text-sm font-medium text-muted">{ts.notFound}</p>}
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{withCitations(answer.out.answer, answer.sources)}</p>
          {answer.out.cited.length > 0 && (
            <div className="space-y-1.5 border-t border-line pt-3">
              <p className="text-sm font-semibold text-muted">{ts.sources}</p>
              <ol className="space-y-1 text-sm">
                {answer.out.cited.map((n) => {
                  const h = answer.sources[n - 1];
                  return h && (
                    <li key={n}>
                      <Link to={hitLink(h)} className="flex gap-2 rounded-lg px-1 py-0.5 hover:bg-surface-2">
                        <span className="font-semibold text-brand-700 dark:text-brand-300">{n}</span>
                        <span className="min-w-0 truncate" dir="auto">{titles.get(h.lectureId)}{h.start !== undefined ? ` · ${formatTime(h.start)}` : ` · ${ts.inNotes}`}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </Card>
      )}

      {deferred.trim() && lectures && (
        <section aria-label={ts.results(hits.length)} className="space-y-2">
          <p className="px-1 text-sm text-muted" aria-live="polite">{hits.length ? ts.results(hits.length) : ts.none(deferred.trim())}</p>
          <ul className="space-y-2">
            {hits.map((h, i) => (
              <li key={`${h.lectureId}-${h.kind}-${h.start ?? i}-${i}`}>
                <Link to={hitLink(h)} className="pressable lift block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted">
                    <span className="truncate font-semibold text-fg" dir="auto">{titles.get(h.lectureId)}</span>
                    <span aria-hidden="true">·</span>
                    {h.kind === 'transcript' && h.start !== undefined
                      ? <span className="shrink-0 tabular-nums text-brand-700 dark:text-brand-300">{ts.at(formatTime(h.start))}</span>
                      : <span className="flex shrink-0 items-center gap-1"><FileText className="size-3" aria-hidden="true" />{ts.inNotes}</span>}
                  </span>
                  <span className="mt-1 line-clamp-3 block text-sm leading-relaxed" dir="auto"><Marked text={h.text} query={deferred} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
