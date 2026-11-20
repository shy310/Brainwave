import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { NotesView } from './NotesView';
import { lectureTitle } from './LecturesPage';
import { lectureRepo, type Lecture } from './repo';

/**
 * A clean page of a lecture's notes for printing or "Save as PDF". The browser
 * does the layout, so math (KaTeX) and Hebrew right-to-left text come out
 * exactly as on screen.
 */
export default function PrintLecturePage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined);

  useEffect(() => { lectureRepo.get(id).then(setLecture).catch(() => setLecture(null)); }, [id]);

  // Open the print window once the notes and fonts are on screen.
  useEffect(() => {
    if (!lecture?.notes) return;
    let cancelled = false;
    void document.fonts.ready.then(() => setTimeout(() => { if (!cancelled) window.print(); }, 300));
    return () => { cancelled = true; };
  }, [lecture]);

  if (lecture === undefined) return <p className="flex items-center gap-2 p-6 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (!lecture?.notes) return <div className="p-6"><Alert tone="error">{t.lectures.notFound}</Alert></div>;

  const title = lectureTitle(lecture, t.lectures.untitled, locale);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link to={`/lectures/${id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium hover:bg-surface-2">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />{t.common.back}
        </Link>
        <Button size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>{t.lectures.share.print}</Button>
        <p className="w-full text-sm text-muted">{t.lectures.share.printHint}</p>
      </div>
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight" dir="auto">{title}</h1>
        <p className="text-sm text-muted">{new Date(lecture.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB')} · BrainWave</p>
      </header>
      <NotesView notes={lecture.notes} />
    </div>
  );
}
