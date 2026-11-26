import { useRef, useState } from 'react';
import { ClipboardPaste, FileUp } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Input, Textarea } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { Shimmer } from '@/ui/Feedback';
import { localDay } from '@shared/activity';
import { dateLocale } from '@shared/locales';
import type { Syllabus } from '@shared/syllabus';
import { DocumentError, docKind, documentText } from '@/features/lectures/documentText';
import { loadPdf, pageText } from '@/features/lectures/documents';
import { examRepo } from '@/features/exams/examRepo';
import { scheduleRepo } from '@/features/schedule/scheduleRepo';
import { deadlineRepo } from './deadlineRepo';

const MAX_PAGES = 20;
const MAX_CHARS = 40_000;

/** The text of a syllabus file: PDF pages, or Word, PowerPoint and text files. */
const fileText = async (file: File, slide: (n: number) => string) => {
  if (docKind(file.name, file.type) === 'pdf') {
    const doc = await loadPdf(file);
    const pages = await Promise.all(Array.from({ length: Math.min(doc.numPages, MAX_PAGES) }, (_, i) => pageText(doc, i + 1)));
    return pages.join('\n\n');
  }
  return documentText(file, slide);
};

type Picked = { classes: boolean[]; exams: boolean[]; deadlines: boolean[] };

/**
 * Import a syllabus: read it (file or pasted text), let the AI find the class
 * times, exams and deadlines, then tick what to keep and add it all at once.
 */
export const SyllabusImport = ({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (firstDate: string | null) => void }) => {
  const { t, locale } = useI18n();
  const ts = t.calendar.syllabus;
  const toMessage = useAiError();
  const input = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'reading' | 'adding'>('');
  const [error, setError] = useState('');
  const [found, setFound] = useState<Syllabus | null>(null);
  const [course, setCourse] = useState('');
  const [picked, setPicked] = useState<Picked>({ classes: [], exams: [], deadlines: [] });
  const [remind, setRemind] = useState(true);

  const reset = () => { setFound(null); setText(''); setPasting(false); setError(''); setBusy(''); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const read = async (body: string) => {
    const clean = body.trim().slice(0, MAX_CHARS);
    if (clean.length < 40) { setError(ts.tooShort); return; }
    setBusy('reading');
    setError('');
    try {
      const s = await callAi<Syllabus>('syllabus', { text: clean, today: localDay() });
      if (!s.meetings.length && !s.exams.length && !s.deadlines.length) { setError(ts.nothing); return; }
      setFound(s);
      setCourse(s.course);
      // Dates already past start unticked.
      const today = localDay();
      setPicked({ classes: s.meetings.map(() => true), exams: s.exams.map((e) => e.date >= today), deadlines: s.deadlines.map((d) => d.date >= today) });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally { setBusy(''); }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (docKind(file.name, file.type) === 'image') { setError(ts.noPhotos); return; }
    setBusy('reading');
    try { await read(await fileText(file, t.lectures.doc.slide)); } catch (err) {
      setBusy('');
      setError(err instanceof DocumentError ? t.lectures.doc[err.reason] : ts.unreadable);
    }
  };

  const add = async () => {
    if (!found) return;
    setBusy('adding');
    setError('');
    const name = course.trim().slice(0, 80) || ts.untitled;
    try {
      const meetings = found.meetings.filter((_, i) => picked.classes[i]);
      const exams = found.exams.filter((_, i) => picked.exams[i]);
      const deadlines = found.deadlines.filter((_, i) => picked.deadlines[i]);
      for (const m of meetings) {
        await scheduleRepo.save({ name: (m.label ? `${name} · ${m.label}` : name).slice(0, 80), weekday: m.weekday, starts: m.starts, ends: m.ends, folderId: null, remindMinutes: remind ? 15 : 0 });
      }
      for (const e of exams) await examRepo.create({ title: `${name} — ${e.title}`.slice(0, 120), date: e.date, folderId: null, lectureIds: [] });
      await deadlineRepo.create(deadlines.map((d) => ({ title: d.title, date: d.date, kind: d.kind, course: name })));
      const today = localDay();
      const first = [...exams, ...deadlines].map((x) => x.date).filter((d) => d >= today).sort()[0] ?? null;
      reset();
      onAdded(first);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setBusy('');
    }
  };

  const count = picked.classes.filter(Boolean).length + picked.exams.filter(Boolean).length + picked.deadlines.filter(Boolean).length;
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' });
  const weekday = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toLocaleDateString(dateLocale(locale), { weekday: 'long', timeZone: 'UTC' }); // 1 Nov 2026 is a Sunday
  const toggle = (k: keyof Picked, i: number) => setPicked((p) => ({ ...p, [k]: p[k].map((v, j) => (j === i ? !v : v)) }));

  // A plain function (not a component), so ticking a box doesn't remount the list and lose focus.
  const group = (k: keyof Picked, title: string, rows: string[]) => rows.length > 0 && (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-semibold text-muted">{title}</legend>
      {rows.map((label, i) => (
        <label key={i} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
          <input type="checkbox" checked={picked[k][i]} onChange={() => toggle(k, i)} className="size-5 accent-brand-600" />
          <span className="min-w-0 flex-1 text-sm" dir="auto">{label}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <Sheet open={open} onClose={close} title={ts.title}
      footer={found && !busy ? <Button size="lg" block disabled={!count} onClick={() => void add()}>{ts.add(count)}</Button> : undefined}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {busy ? (
          <p className="py-8 text-center text-muted" aria-live="polite"><Shimmer text={busy === 'reading' ? ts.reading : ts.adding} /></p>
        ) : found ? (
          <>
            <p className="text-sm text-muted">{ts.review}</p>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{ts.course}</span>
              <Input value={course} onChange={(e) => setCourse(e.target.value)} maxLength={80} dir="auto" />
            </label>
            {group('classes', ts.classes, found.meetings.map((m) => `${weekday(m.weekday)} ${m.starts}–${m.ends}${m.label ? ` · ${m.label}` : ''}`))}
            {found.meetings.length > 0 && (
              <label className="flex items-center gap-3 px-2 text-sm">
                <input type="checkbox" checked={remind} onChange={() => setRemind(!remind)} className="size-5 accent-brand-600" />{ts.remind}
              </label>
            )}
            {group('exams', ts.exams, found.exams.map((e) => `${fmt(e.date)} · ${e.title}`))}
            {group('deadlines', ts.deadlines, found.deadlines.map((d) => `${fmt(d.date)} · ${d.title}`))}
          </>
        ) : pasting ? (
          <div className="space-y-3">
            <Textarea aria-label={ts.pastePlaceholder} placeholder={ts.pastePlaceholder} rows={10} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_CHARS} dir="auto" autoFocus />
            <Button size="lg" block onClick={() => void read(text)}>{ts.read}</Button>
            <button type="button" onClick={() => setPasting(false)} className="mx-auto block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t.lectures.doc.file}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">{ts.body}</p>
            <input ref={input} type="file" accept=".pdf,.docx,.pptx,.odt,.txt,.md" className="hidden" aria-label={ts.choose}
              onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="lg" block icon={<FileUp className="size-5" />} onClick={() => input.current?.click()}>{ts.choose}</Button>
            <button type="button" onClick={() => setPasting(true)} className="mx-auto flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              <ClipboardPaste className="size-4" aria-hidden="true" />{t.lectures.doc.paste}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
};
