import { useRef, useState } from 'react';
import { ClipboardPaste, FileUp } from 'lucide-react';
import { useT } from '@/i18n';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Textarea } from '@/ui/Field';
import { Spinner } from '@/ui/Spinner';
import { MAX_TRANSCRIPT_CHARS, type LectureLanguage } from '@shared/lectures';
import { DOC_ACCEPT, DocumentError, docKind, documentText } from './documentText';
import { PdfSource, type SourceProps } from './PdfSource';
import { PhotoSource } from './PhotoSource';
import { lectureRepo } from './repo';
import { SlidesPicker, type Slides } from './SlidesPicker';

const MAX_DOC_BYTES = 100 * 1024 * 1024;
const MIN_TEXT = 80;

type Picked = { kind: 'pdf' | 'image'; files: File[] } | null;

/**
 * A lecture from a document: PDF and photos go to their own screens (choose
 * pages, read handwriting); Word, PowerPoint, OpenDocument and text files are
 * read right here in the browser. Or paste the text.
 */
export const DocumentSource = ({ title, language, onBusy, onDone, slides, onSlides }: SourceProps & { slides: Slides | null; onSlides: (s: Slides | null) => void }) => {
  const t = useT();
  const td = t.lectures.doc;
  const toMessage = useAiError();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (body: string, source: 'document' | 'text', name: string, lang: LectureLanguage) => {
    const lecture = await lectureRepo.create({
      title: title.trim() || name, source, language: lang, status: 'ready', slides_text: source === 'text' ? slides?.text ?? null : null,
      segments: [{ start: 0, text: body.slice(0, MAX_TRANSCRIPT_CHARS) }],
    });
    onDone(lecture.id);
  };

  const choose = async (files: File[]) => {
    if (!files.length) return;
    setError('');
    const first = files[0];
    const kind = docKind(first.name, first.type);
    if (kind === 'pdf') { setPicked({ kind, files: [first] }); return; }
    if (kind === 'image') { setPicked({ kind, files: files.filter((f) => docKind(f.name, f.type) === 'image') }); return; }
    if (first.size > MAX_DOC_BYTES) { setError(t.lectures.fileTooBig); return; }
    setBusy(true);
    onBusy(true);
    try {
      const body = await documentText(first, td.slide);
      await save(body, 'document', first.name.replace(/\.[^.]+$/, ''), language);
    } catch (err) {
      if (err instanceof DocumentError) setError(td[err.reason]);
      else setError(toMessage(err) || t.auth.errors.generic);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };

  const fromText = async () => {
    const body = text.trim();
    if (body.length < MIN_TEXT) { setError(t.lectures.textTooShort); return; }
    setError('');
    setBusy(true);
    onBusy(true);
    try { await save(body, 'text', '', language); } catch (err) { setError(toMessage(err) || t.auth.errors.generic); } finally { setBusy(false); onBusy(false); }
  };

  if (picked) {
    const Source = picked.kind === 'pdf' ? PdfSource : PhotoSource;
    return <Source title={title} language={language} onBusy={onBusy} onDone={onDone} initialFiles={picked.files} />;
  }

  return (
    <div className="space-y-4 border-t border-line pt-5">
      <input ref={input} type="file" accept={DOC_ACCEPT} multiple className="hidden" aria-label={td.choose}
        onChange={(e) => { void choose([...(e.target.files ?? [])]); e.target.value = ''; }} />
      {error && <Alert tone="error">{error}</Alert>}
      {pasting ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t.lectures.textHint}</p>
          {/* Slides from the class can go with pasted notes too. */}
          <SlidesPicker value={slides} onChange={onSlides} />
          <Textarea aria-label={t.lectures.textPlaceholder} placeholder={t.lectures.textPlaceholder} rows={10} dir="auto"
            value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TRANSCRIPT_CHARS} disabled={busy} autoFocus />
          <Button size="lg" block loading={busy} onClick={() => void fromText()}>{t.lectures.create}</Button>
          <button type="button" onClick={() => { setPasting(false); setError(''); }} className="mx-auto block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{td.file}</button>
        </div>
      ) : busy ? (
        <p className="flex items-center gap-2 text-muted" aria-live="polite"><Spinner className="size-5" />{td.reading}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{td.hint}</p>
          <Button size="lg" block icon={<FileUp className="size-5" />} onClick={() => input.current?.click()}>{td.choose}</Button>
          <button type="button" onClick={() => { setPasting(true); setError(''); }}
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            <ClipboardPaste className="size-4" aria-hidden="true" />{td.paste}
          </button>
        </div>
      )}
    </div>
  );
};
