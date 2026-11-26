import { useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { useT } from '@/i18n';
import { ApiError, callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { MAX_PDF_PAGES, MAX_SLIDES_CHARS } from '@shared/lectures';
import { loadPdf, looksScanned, mapLimit, pageImage, pageText } from './documents';

export interface Slides { name: string; text: string }
export const MAX_SLIDES_BYTES = 100 * 1024 * 1024;

/**
 * Optional lecture slides. The text is read in the browser (free, nothing
 * uploaded); only slides that are pictures are read by the vision model.
 * The text is kept with the lecture.
 */
export const SlidesPicker = ({ value, onChange }: { value: Slides | null; onChange: (s: Slides | null) => void }) => {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const toMessage = useAiError();
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { setError(t.tutor.fileType); return; }
    if (file.size > MAX_SLIDES_BYTES) { setError(t.lectures.slidesTooBig); return; }
    setReading({ done: 0, total: 0 });
    let pdf: Awaited<ReturnType<typeof loadPdf>> | null = null;
    try {
      pdf = await loadPdf(file);
      const doc = pdf;
      const pages = Array.from({ length: Math.min(doc.numPages, MAX_PDF_PAGES) }, (_, i) => i + 1);
      let count = 0;
      setReading({ done: 0, total: pages.length });
      const texts = await mapLimit(pages, 2, async (p) => {
        let text = await pageText(doc, p);
        if (looksScanned(text)) {
          text = (await callAi<{ text: string }>('imageText', { image: await pageImage(doc, p), kind: 'page', language: 'auto' })).text.trim();
        }
        setReading({ done: ++count, total: pages.length });
        return text;
      });
      const text = texts.map((x, i) => (x ? `Slide ${pages[i]}: ${x}` : '')).filter(Boolean).join('\n\n').slice(0, MAX_SLIDES_CHARS);
      if (!text) { setError(t.lectures.slidesFailed); return; }
      onChange({ name: file.name, text });
    } catch (err) {
      console.error(err);
      setError(err instanceof ApiError || err instanceof TypeError ? toMessage(err) : t.lectures.slidesFailed);
    } finally {
      void pdf?.destroy();
      setReading(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{t.lectures.slides}</p>
      <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? (
        <p className="flex items-center gap-2 text-sm">
          <FileText className="size-4 text-brand-700 dark:text-brand-300" aria-hidden="true" />
          <span className="truncate">{t.lectures.slidesReady(value.name)}</span>
          <button type="button" aria-label={t.tutor.remove} onClick={() => onChange(null)} className="rounded p-0.5 hover:bg-surface-2"><X className="size-4" aria-hidden="true" /></button>
        </p>
      ) : reading ? (
        <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite"><Spinner className="size-4" />
          {reading.total > 1 ? t.lectures.readingPage(reading.done, reading.total) : t.lectures.slidesReading}</p>
      ) : (
        <Button variant="secondary" size="sm" icon={<FileText className="size-4" />} onClick={() => input.current?.click()}>{t.lectures.addSlides}</Button>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};
