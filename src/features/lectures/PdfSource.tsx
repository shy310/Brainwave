import { useEffect, useRef, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { Spinner } from '@/ui/Spinner';
import { MAX_PDF_PAGES, MAX_TRANSCRIPT_CHARS, type LectureLanguage, type Segment } from '@shared/lectures';
import { SCANNED_BELOW, formatPageRange, loadPdf, mapLimit, pageImage, pageText, parsePageRange } from './documents';
import { lectureRepo } from './repo';

const MAX_PDF_BYTES = 100 * 1024 * 1024;
/** Page buttons are shown up to this many pages; longer PDFs use the range box only. */
const MAX_BUTTONS = 300;

export interface SourceProps {
  title: string;
  language: LectureLanguage;
  onBusy: (busy: boolean) => void;
  onDone: (lectureId: string) => void;
}

/** A lecture made from chosen pages of a PDF. */
export const PdfSource = ({ title, language, onBusy, onDone }: SourceProps) => {
  const t = useT();
  const toMessage = useAiError();
  const input = useRef<HTMLInputElement>(null);
  const doc = useRef<Awaited<ReturnType<typeof loadPdf>> | null>(null);
  /** Text already read, by page: a retry after an error doesn't pay twice. */
  const done = useRef(new Map<number, string>());
  const [file, setFile] = useState<{ name: string; pages: number } | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [range, setRange] = useState('');
  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => { void doc.current?.destroy(); }, []);

  const choose = (pages: number[]) => { setChosen(pages); setRange(formatPageRange(pages)); };

  const open = async (f?: File) => {
    if (!f) return;
    setError('');
    if (f.size > MAX_PDF_BYTES) { setError(t.lectures.pdfTooBig); return; }
    setOpening(true);
    try {
      await doc.current?.destroy();
      doc.current = await loadPdf(f);
      done.current.clear();
      const pages = doc.current.numPages;
      setFile({ name: f.name.replace(/\.pdf$/i, ''), pages });
      choose(Array.from({ length: Math.min(pages, MAX_PDF_PAGES) }, (_, i) => i + 1));
    } catch (err) {
      console.error(err);
      setError(t.lectures.pdfFailed);
    } finally {
      setOpening(false);
    }
  };

  const toggle = (p: number) => choose(chosen.includes(p) ? chosen.filter((x) => x !== p) : [...chosen, p].sort((a, b) => a - b));

  const make = async () => {
    const pdf = doc.current;
    if (!pdf || !file || !chosen.length || chosen.length > MAX_PDF_PAGES) return;
    setError('');
    onBusy(true);
    setProgress({ done: 0, total: chosen.length });
    let count = 0;
    try {
      const texts = await mapLimit(chosen, 2, async (p) => {
        let text = done.current.get(p);
        if (text === undefined) {
          text = await pageText(pdf, p);
          if (text.replace(/\s/g, '').length < SCANNED_BELOW) {
            // A scan: read the page from a picture.
            text = (await callAi<{ text: string }>('imageText', { image: await pageImage(pdf, p), kind: 'page', language })).text.trim();
          }
          done.current.set(p, text);
        }
        setProgress({ done: ++count, total: chosen.length });
        return text;
      });
      let room = MAX_TRANSCRIPT_CHARS;
      const segments: Segment[] = [];
      chosen.forEach((p, i) => {
        const text = texts[i].slice(0, room);
        if (text.trim()) { segments.push({ start: p, text }); room -= text.length + 2; }
      });
      if (!segments.length) { setError(t.lectures.pdfEmpty); return; }
      const lecture = await lectureRepo.create({
        title: (title.trim() || file.name).slice(0, 200), source: 'pdf', language, segments, status: 'ready',
      });
      onDone(lecture.id);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally {
      setProgress(null);
      onBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-line pt-5">
      <p className="text-sm text-muted">{t.lectures.pdfHint}</p>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <Alert tone="error">{error}</Alert>}

      {!file && (
        <Button size="lg" block loading={opening} icon={<FileUp className="size-5" />} onClick={() => input.current?.click()}>{t.lectures.choosePdf}</Button>
      )}

      {file && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="min-w-0 truncate font-medium" dir="auto">{file.name}</p>
            <p className="text-sm text-muted">{t.lectures.pdfPages(file.pages)}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm font-medium">{t.lectures.pages}</span>
              <Input value={range} placeholder={t.lectures.pagesHint} dir="ltr" inputMode="numeric" disabled={!!progress}
                onChange={(e) => { setRange(e.target.value); setChosen(parsePageRange(e.target.value, file.pages)); }} />
            </label>
            <Button variant="secondary" disabled={!!progress} onClick={() => choose(Array.from({ length: Math.min(file.pages, MAX_PDF_PAGES) }, (_, i) => i + 1))}>{t.lectures.allPages}</Button>
            <Button variant="secondary" disabled={!!progress} onClick={() => choose([])}>{t.lectures.noPages}</Button>
          </div>
          {file.pages <= MAX_BUTTONS && (
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label={t.lectures.pages}>
              {Array.from({ length: file.pages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" aria-pressed={chosen.includes(p)} aria-label={t.lectures.pageN(p)} disabled={!!progress} onClick={() => toggle(p)}
                  className={cn('h-9 min-w-9 rounded-lg border px-2 text-sm tabular-nums transition-colors',
                    chosen.includes(p) ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-surface-2')}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <p className={cn('text-sm', chosen.length > MAX_PDF_PAGES ? 'text-rose-600' : 'text-muted')} aria-live="polite">
            {chosen.length > MAX_PDF_PAGES ? t.lectures.tooManyPages(MAX_PDF_PAGES) : t.lectures.selectedPages(chosen.length)}
          </p>
          {progress ? (
            <p className="flex items-center gap-2 text-muted" aria-live="polite"><Spinner className="size-5" />{t.lectures.readingPage(progress.done, progress.total)}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" icon={<Sparkles className="size-5" />} disabled={!chosen.length || chosen.length > MAX_PDF_PAGES} onClick={() => void make()}>{t.lectures.makeNotes}</Button>
              <Button size="lg" variant="secondary" onClick={() => input.current?.click()}>{t.lectures.choosePdf}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
