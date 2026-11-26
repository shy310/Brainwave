import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Copy, Printer, RefreshCw, ScrollText } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { useHideTabBar } from '@/app/chrome';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RichInline } from '@/ui/Rich';
import { Segmented } from '@/ui/Segmented';
import { Shimmer } from '@/ui/Feedback';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { CHEAT_FORMATS, type CheatFormat, type CheatSheet } from '@shared/cheatSheet';
import { lectureRepo, studyText, type Lecture } from './repo';
import { lectureTitle } from './LecturesPage';

/** The cheat sheet as plain text, for copying. */
export const sheetText = (title: string, s: CheatSheet) => [
  title,
  ...s.blocks.flatMap((b) => [
    '', b.heading.toLocaleUpperCase(),
    ...b.items.map((i) => `• ${i}`),
    ...(b.table ? [b.table.head.join(' | '), ...b.table.rows.map((r) => r.join(' | '))] : []),
  ]),
  ...(s.formulas.length ? ['', '∑', ...s.formulas.map((f) => `• ${f}`)] : []),
].join('\n').replace(/\*\*/g, '');

/** An exam cheat sheet of the lecture: dense bullets, two columns or tables, 1–2 printed pages. */
export default function CheatSheetPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const tc = t.lectures.cheat;
  const toMessage = useAiError();
  useHideTabBar();
  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined);
  const [format, setFormat] = useState<CheatFormat>('bullets');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    lectureRepo.get(id).then((l) => { setLecture(l); if (l?.cheat_sheet?.format) setFormat(l.cheat_sheet.format); }).catch(() => setLecture(null));
  }, [id]);

  const save = (sheet: CheatSheet) => {
    setLecture((l) => (l ? { ...l, cheat_sheet: sheet } : l));
    void lectureRepo.update(id, { cheat_sheet: sheet }).catch((err) => console.error(err));
  };

  const make = async (f: CheatFormat) => {
    if (!lecture) return;
    setBusy(true);
    setError('');
    try {
      save(await callAi<CheatSheet>('cheatSheet', { title: lecture.title || undefined, text: studyText(lecture).slice(0, 30_000), format: f }));
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally { setBusy(false); }
  };

  if (lecture === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (!lecture) return <Alert tone="error">{t.lectures.notFound}</Alert>;
  const title = lectureTitle(lecture, t.lectures.untitled, locale);
  const sheet = lecture.cheat_sheet;
  const canMake = studyText(lecture).trim().length >= 20;
  // Bullets and two columns are the same content laid out differently; tables are written differently.
  const needsRemake = !!sheet && (format === 'tables') !== (sheet.format === 'tables');

  const pick = (f: CheatFormat) => {
    setFormat(f);
    if (sheet && (f === 'tables') === (sheet.format === 'tables')) save({ ...sheet, format: f });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-2">
      <div className="space-y-4 print:hidden">
        <BackLink to={`/lectures/${id}`} label={title} />
        <header className="flex flex-wrap items-end gap-3">
          <div className="min-w-[min(100%,18rem)] flex-1 space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{tc.title}</h1>
            <p className="text-muted">{tc.body}</p>
          </div>
          {sheet && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Copy className="size-4" />}
                onClick={() => void navigator.clipboard.writeText(sheetText(title, sheet)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
                {copied ? t.lectures.copied : t.lectures.copy}
              </Button>
              <Button variant="secondary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>{tc.print}</Button>
            </div>
          )}
        </header>
        <Segmented fill label={tc.format} value={format} onChange={pick}
          options={CHEAT_FORMATS.map((f) => ({ value: f, label: tc.formats[f] }))} />
        {error && <Alert tone="error">{error}</Alert>}
        {sheet && (needsRemake || busy) && (
          <div className="flex items-center gap-3">
            <Button size="sm" icon={<RefreshCw className="size-4" />} loading={busy} onClick={() => void make(format)}>{tc.remake(tc.formats[format])}</Button>
            {busy && <Shimmer text={tc.making} className="text-sm text-muted" />}
          </div>
        )}
      </div>

      {!sheet && (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-700 dark:text-brand-300"><ScrollText className="size-7" aria-hidden="true" /></span>
          {busy ? <Shimmer text={tc.making} /> : canMake
            ? <Button size="lg" onClick={() => void make(format)}>{tc.make}</Button>
            : <p className="text-muted">{t.lectures.map.needsText}</p>}
        </Card>
      )}

      {sheet && <SheetView sheet={sheet} title={title} formulasLabel={tc.formulas} />}
      {sheet && !needsRemake && !busy && (
        <div className="print:hidden">
          <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => void make(format)}>{tc.redo}</Button>
        </div>
      )}
    </div>
  );
}

/** The sheet itself: paper-like on screen, compact on paper. */
const SheetView = ({ sheet, title, formulasLabel }: { sheet: CheatSheet; title: string; formulasLabel: string }) => {
  const columns = sheet.format === 'columns';
  return (
    <article aria-label={title}
      className="cheat-sheet rounded-[var(--radius-card)] border border-line bg-surface p-5 text-sm leading-snug shadow-[var(--shadow-soft)] animate-fade-up sm:p-7 print:rounded-none print:border-0 print:p-0 print:text-[9.5pt] print:shadow-none">
      <h2 className="mb-3 border-b-2 border-fg pb-1.5 text-lg font-bold tracking-tight" dir="auto">{title}</h2>
      <div className={cn(columns ? 'gap-6 sm:columns-2 print:columns-2' : 'grid grid-flow-row-dense gap-x-6 gap-y-4 sm:grid-cols-2 print:grid-cols-2')}>
        {sheet.blocks.map((b, i) => (
          <section key={i} className={cn('break-inside-avoid', columns ? 'mb-3' : '', b.table && !columns && 'sm:col-span-2 print:col-span-2')}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300 print:text-black" dir="auto">{b.heading}</h3>
            {b.items.length > 0 && (
              <ul className="space-y-0.5 ps-3.5 [list-style:'–_'] marker:text-muted">
                {b.items.map((it, j) => <li key={j} dir="auto" className="ps-0.5"><RichInline text={it} /></li>)}
              </ul>
            )}
            {b.table && (
              <div className="mt-1 overflow-x-auto">
                <table className="w-full border-collapse text-start text-[0.95em]">
                  <thead>
                    <tr>{b.table.head.map((h, k) => <th key={k} scope="col" className="border-b border-line bg-surface-2 px-2 py-1 text-start font-semibold print:bg-transparent" dir="auto"><RichInline text={h} /></th>)}</tr>
                  </thead>
                  <tbody>
                    {b.table.rows.map((r, k) => (
                      <tr key={k} className="even:bg-surface-2/50">
                        {r.map((c, m) => <td key={m} className={cn('border-b border-line px-2 py-1 align-top', m === 0 && 'font-medium')} dir="auto"><RichInline text={c} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
      {sheet.formulas.length > 0 && (
        <section className="mt-4 break-inside-avoid rounded-xl bg-brand-500/8 p-3 print:bg-transparent print:p-0 print:pt-2">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300 print:text-black">{formulasLabel}</h3>
          <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {sheet.formulas.map((f, i) => <li key={i} dir="auto"><RichInline text={f} /></li>)}
          </ul>
        </section>
      )}
    </article>
  );
};
