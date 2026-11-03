import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertTriangle, Clapperboard, Copy, Download, Headphones, Pencil, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Field';
import { Rich, RichInline } from '@/ui/Rich';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { ChatPanel } from '@/features/tutor/ChatPanel';
import { MAX_SLIDES_CHARS, MAX_TRANSCRIPT_CHARS, type Flashcards, type Notes } from '@shared/lectures';
import type { Quiz } from '@shared/learn';
import { formatTime } from './audio';
import { FlashcardDeck } from './Flashcards';
import { lectureTitle } from './LecturesPage';
import { lectureRepo, transcriptOf, type Lecture, type LecturePatch } from './repo';

type Tab = 'notes' | 'transcript' | 'quiz' | 'cards' | 'ask';

export const notesToMarkdown = (title: string, n: Notes, labels: { summary: string; keyTerms: string; reminders: string }) => [
  `# ${title}`, '', `## ${labels.summary}`, n.summary, '',
  ...n.sections.flatMap((s) => [`## ${s.heading}`, ...s.points.map((p) => `- ${p}`), '']),
  ...(n.keyTerms.length ? [`## ${labels.keyTerms}`, ...n.keyTerms.map((k) => `- **${k.term}** — ${k.definition}`), ''] : []),
  ...(n.reminders.length ? [`## ${labels.reminders}`, ...n.reminders.map((r) => `- ${r}`), ''] : []),
].join('\n');

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function LecturePage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('notes');
  const [busy, setBusy] = useState<'' | 'notes' | 'quiz' | 'cards'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [quizRound, setQuizRound] = useState(0);
  const autoNotes = useRef(false);

  useEffect(() => {
    lectureRepo.get(id).then(setLecture).catch(() => setLecture(null));
  }, [id]);

  const patch = useCallback(async (p: LecturePatch) => {
    setLecture((l) => (l ? { ...l, ...p } : l));
    await lectureRepo.update(id, p).catch((err) => console.error('Could not save lecture', err));
  }, [id]);

  const transcript = useMemo(() => (lecture ? transcriptOf(lecture) : ''), [lecture]);
  const input = useMemo(() => lecture && ({
    transcript: transcript.slice(0, MAX_TRANSCRIPT_CHARS),
    slides: lecture.slides_text?.slice(0, MAX_SLIDES_CHARS) || undefined,
    title: lecture.title || undefined,
  }), [lecture, transcript]);

  const generate = useCallback(async (kind: 'notes' | 'quiz' | 'cards') => {
    if (!input || transcript.length < 20) return;
    setBusy(kind);
    setError('');
    try {
      if (kind === 'notes') {
        const notes = await callAi<Notes>('lectureNotes', input);
        await patch({ notes, ...(lecture?.title ? {} : { title: notes.title.slice(0, 200) }) });
      } else if (kind === 'quiz') {
        const quiz = await callAi<Quiz>('lectureQuiz', { ...input, count: 6 });
        await patch({ quiz });
        setQuizRound((r) => r + 1);
      } else {
        const flashcards = await callAi<Flashcards>('flashcards', { ...input, count: 15 });
        await patch({ flashcards });
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy('');
    }
  }, [input, transcript, patch, lecture?.title, toMessage]);

  // Write notes automatically the first time a finished lecture is opened.
  useEffect(() => {
    if (lecture && lecture.status === 'ready' && !lecture.notes && transcript.length >= 20 && !autoNotes.current) {
      autoNotes.current = true;
      void generate('notes');
    }
  }, [lecture, transcript, generate]);

  const chatContext = useCallback(() => ({
    mode: 'explain' as const,
    lecture: { title: lecture?.title || t.lectures.untitled, text: [transcript, lecture?.slides_text].filter(Boolean).join('\n\n').slice(0, 200_000) },
  }), [lecture, transcript, t]);

  if (lecture === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (lecture === null) return <Alert tone="error">{t.lectures.notFound}</Alert>;

  const title = lectureTitle(lecture, t.lectures.untitled, locale);
  const labels = { summary: t.lectures.summary, keyTerms: t.lectures.keyTerms, reminders: t.lectures.reminders };

  const remove = async () => {
    if (!window.confirm(t.lectures.confirmDelete)) return;
    await lectureRepo.remove(id);
    navigate('/lectures', { replace: true });
  };

  const copyNotes = async () => {
    if (!lecture.notes) return;
    await navigator.clipboard.writeText(notesToMarkdown(title, lecture.notes, labels)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />

      <header className="space-y-2">
        {renaming ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void patch({ title: name.trim().slice(0, 200) }); setRenaming(false); }}>
            <Input aria-label={t.lectures.rename} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus dir="auto" />
            <Button type="submit">{t.lectures.save}</Button>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-3xl font-semibold tracking-tight" dir="auto">{title}</h1>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.lectures.rename} onClick={() => { setName(lecture.title); setRenaming(true); }}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.lectures.delete} onClick={remove}>
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
        <p className="text-sm text-muted">
          {t.lectures.sources[lecture.source]}
          {lecture.duration_sec > 0 && ` · ${t.lectures.minutes(Math.max(1, Math.round(lecture.duration_sec / 60)))}`}
          {' · '}{new Date(lecture.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB')}
        </p>
      </header>

      {lecture.status === 'transcribing' && (
        <Alert>
          <p className="flex items-center gap-2"><AlertTriangle className="size-4" aria-hidden="true" />{t.lectures.interrupted}</p>
          <Button size="sm" className="mt-2" onClick={() => patch({ status: 'ready' })}>{t.lectures.useWhatWeHave}</Button>
        </Alert>
      )}

      {!transcript && lecture.status === 'ready' ? <Alert>{t.lectures.emptyTranscript}</Alert> : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Segmented label={title} value={tab} onChange={setTab}
              options={(['notes', 'transcript', 'quiz', 'cards', 'ask'] as const).map((v) => ({ value: v, label: t.lectures.tabsView[v] }))} />
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          {tab === 'notes' && (
            busy === 'notes' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" />{t.lectures.writingNotes}</Card>
            : lecture.notes ? (
              <article className="space-y-4">
                <Card className="space-y-5 p-6">
                  <section>
                    <h2 className="mb-2 text-lg font-semibold">{t.lectures.summary}</h2>
                    <Rich text={lecture.notes.summary} />
                  </section>
                  {lecture.notes.sections.map((s, i) => (
                    <section key={i}>
                      <h2 className="mb-2 text-lg font-semibold" dir="auto">{s.heading}</h2>
                      <ul className="list-disc space-y-1.5 ps-6">{s.points.map((p, j) => <li key={j} dir="auto"><RichInline text={p} /></li>)}</ul>
                    </section>
                  ))}
                </Card>
                {lecture.notes.keyTerms.length > 0 && (
                  <Card className="p-6">
                    <h2 className="mb-3 text-lg font-semibold">{t.lectures.keyTerms}</h2>
                    <dl className="space-y-2">
                      {lecture.notes.keyTerms.map((k, i) => (
                        <div key={i}><dt className="font-medium" dir="auto"><RichInline text={k.term} /></dt><dd className="text-sm text-muted" dir="auto"><RichInline text={k.definition} /></dd></div>
                      ))}
                    </dl>
                  </Card>
                )}
                {lecture.notes.reminders.length > 0 && (
                  <Alert>
                    <p className="mb-1 font-semibold">{t.lectures.reminders}</p>
                    <ul className="list-disc space-y-1 ps-5">{lecture.notes.reminders.map((r, i) => <li key={i} dir="auto">{r}</li>)}</ul>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" icon={<Copy className="size-4" />} onClick={copyNotes}>{copied ? t.lectures.copied : t.lectures.copy}</Button>
                  <Button variant="secondary" size="sm" icon={<Download className="size-4" />}
                    onClick={() => download(`${title}.md`, notesToMarkdown(title, lecture.notes!, labels))}>{t.lectures.download}</Button>
                  <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => generate('notes')}>{t.lectures.regenerate}</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm text-muted">
                  <span>{t.lectures.turnInto}:</span>
                  {[{ icon: Clapperboard, label: t.lectures.video }, { icon: Headphones, label: t.lectures.podcast }].map(({ icon: Icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1">
                      <Icon className="size-4" aria-hidden="true" />{label}
                      <span className="rounded-full bg-surface-2 px-1.5 text-[10px] uppercase">{t.lectures.soon}</span>
                    </span>
                  ))}
                </div>
              </article>
            ) : (
              <Card className="flex flex-col items-center gap-3 p-8">
                <Button icon={<Sparkles className="size-4" />} onClick={() => generate('notes')}>{error ? t.common.tryAgain : t.lectures.regenerate}</Button>
              </Card>
            )
          )}

          {tab === 'transcript' && (
            <Card className="space-y-4 p-6">
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={() => download(`${title}.txt`, transcript)}>{t.lectures.download}</Button>
              </div>
              {lecture.segments.filter((s) => s.text.trim()).map((s, i) => (
                <div key={i} className="flex gap-3">
                  {lecture.source !== 'text' && <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted">{formatTime(s.start)}</span>}
                  <Rich text={s.text} className="min-w-0 flex-1" />
                </div>
              ))}
            </Card>
          )}

          {tab === 'quiz' && (
            busy === 'quiz' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" />{t.lectures.makingQuiz}</Card>
            : lecture.quiz ? (
              <QuizRunner key={quizRound} questions={lecture.quiz.questions}
                resultActions={<>
                  <Button variant="secondary" onClick={() => setQuizRound((r) => r + 1)}>{t.quiz.retry}</Button>
                  <Button icon={<Sparkles className="size-4" />} onClick={() => generate('quiz')}>{t.lectures.newQuiz}</Button>
                </>} />
            ) : (
              <Card className="flex flex-col items-center gap-3 p-8">
                <Button size="lg" icon={<Sparkles className="size-5" />} onClick={() => generate('quiz')}>{t.lectures.makeQuiz}</Button>
              </Card>
            )
          )}

          {tab === 'cards' && (
            busy === 'cards' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" />{t.lectures.makingCards}</Card>
            : lecture.flashcards ? (
              <Card className="space-y-4 p-6">
                <FlashcardDeck deck={lecture.flashcards} />
                <div className="border-t border-line pt-3">
                  <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => generate('cards')}>{t.lectures.newCards}</Button>
                </div>
              </Card>
            ) : (
              <Card className="flex flex-col items-center gap-3 p-8">
                <Button size="lg" icon={<Sparkles className="size-5" />} onClick={() => generate('cards')}>{t.lectures.makeCards}</Button>
              </Card>
            )
          )}

          {tab === 'ask' && (
            <ChatPanel sessionKey={`bw.lectureChat.${id}`} context={chatContext} emptyTitle={t.lectures.askEmpty} starters={t.lectures.askStarters} />
          )}
        </>
      )}
    </div>
  );
}

