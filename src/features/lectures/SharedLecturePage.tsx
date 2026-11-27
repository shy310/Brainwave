import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Printer } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Loading } from '@/ui/Wave';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { LanguageToggle } from '@/app/LanguageToggle';
import { FlashcardDeck } from './Flashcards';
import { NotesView } from './NotesView';
import { lectureTitle } from './LecturesPage';
import { lectureRepo, type SharedLecture } from './repo';

/** Notes someone shared with a link. Anyone can open it; no sign-in. */
export default function SharedLecturePage() {
  const { token = '' } = useParams();
  const { t, locale } = useI18n();
  const [lecture, setLecture] = useState<SharedLecture | null | undefined>(undefined);

  useEffect(() => { lectureRepo.getShared(token).then(setLecture).catch(() => setLecture(null)); }, [token]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-bg/80 print:hidden">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link to="/" aria-label="BrainWave"><Logo /></Link>
          <div className="ms-auto"><LanguageToggle /></div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6 print:p-0">
        {lecture === undefined && <Loading label={t.common.loading} />}
        {lecture === null && <Alert tone="error">{t.lectures.share.notFound}</Alert>}
        {lecture && (
          <>
            <header className="space-y-1">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{t.lectures.share.madeWith}</p>
              <h1 className="text-3xl font-bold" dir="auto">{lectureTitle(lecture, t.lectures.untitled, locale)}</h1>
            </header>
            <NotesView notes={lecture.notes} />
            {lecture.flashcards && lecture.flashcards.cards.length > 0 && (
              <Card className="space-y-3 p-6 print:hidden">
                <h2 className="text-lg font-semibold">{t.lectures.tabsView.cards}</h2>
                <FlashcardDeck deck={lecture.flashcards} />
              </Card>
            )}
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>{t.lectures.share.print}</Button>
              <Link to="/signin" className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">{t.lectures.share.tryIt}</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
