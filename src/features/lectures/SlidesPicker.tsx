import { useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';

export interface Slides { name: string; text: string }
const MAX_BYTES = 2.2 * 1024 * 1024;

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** Optional lecture slides: the PDF's text is extracted once and kept with the lecture. */
export const SlidesPicker = ({ value, onChange }: { value: Slides | null; onChange: (s: Slides | null) => void }) => {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    if (file.type !== 'application/pdf') { setError(t.tutor.fileType); return; }
    if (file.size > MAX_BYTES) { setError(t.lectures.slidesTooBig); return; }
    setReading(true);
    try {
      const { text } = await callAi<{ text: string }>('slidesText', { name: file.name, dataUrl: await readAsDataUrl(file) });
      onChange({ name: file.name, text });
    } catch {
      setError(t.lectures.slidesFailed);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{t.lectures.slides}</p>
      <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? (
        <p className="flex items-center gap-2 text-sm">
          <FileText className="size-4 text-brand-600" aria-hidden="true" />
          <span className="truncate">{t.lectures.slidesReady(value.name)}</span>
          <button type="button" aria-label={t.tutor.remove} onClick={() => onChange(null)} className="rounded p-0.5 hover:bg-surface-2"><X className="size-4" aria-hidden="true" /></button>
        </p>
      ) : reading ? (
        <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" />{t.lectures.slidesReading}</p>
      ) : (
        <Button variant="secondary" size="sm" icon={<FileText className="size-4" />} onClick={() => input.current?.click()}>{t.lectures.addSlides}</Button>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};
