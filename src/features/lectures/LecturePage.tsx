import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Clapperboard, Copy, Download, FileDown, Headphones, Link2, Pencil, RefreshCw, Share2, Sparkles, Trash2 } from 'lucide-react';
import { publicUrl } from '@/lib/platform';
import { useI18n, useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input, Select } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { ChatPanel } from '@/features/tutor/ChatPanel';
import { MAX_SLIDES_CHARS, MAX_TRANSCRIPT_CHARS, SUMMARY_MODES, type Flashcards, type Notes, type Segment, type SummaryMode } from '@shared/lectures';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Quiz } from '@shared/learn';
import { FlashcardDeck } from './Flashcards';
import { TranscriptPanel } from './TranscriptPanel';
import { NotesView } from './NotesView';
import { rate, reviewRepo } from './reviews';
import { cardKey, type CardState } from '@shared/srs';
import { folderRepo, type Folder } from './folders';
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
  const { profile, demo } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('notes');
  const [busy, setBusy] = useState<'' | 'notes' | 'quiz' | 'cards'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [quizRound, setQuizRound] = useState(0);
  const autoNotes = useRef(false);
  /** The transcript was edited after notes, a quiz or flashcards were made. */
  const [stale, setStale] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const reviewStates = useRef<Promise<Map<string, CardState>> | null>(null);
  /** Practising here also updates the spaced-repetition schedule. */
  const onCardAnswer = (i: number, knew: boolean) => {
    const card = lecture?.flashcards?.cards[i];
    if (!card) return;
    reviewStates.current ??= reviewRepo.list();
    void reviewStates.current.then((st) => rate(st, { key: cardKey(id, card.front), lectureId: id }, knew ? 'good' : 'again'));
  };

  useEffect(() => {
    lectureRepo.get(id).then(setLecture).catch(() => setLecture(null));
    folderRepo.list().then(setFolders).catch(() => setFolders([]));
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

  const generate = useCallback(async (kind: 'notes' | 'quiz' | 'cards', mode?: SummaryMode) => {
    if (!input || transcript.length < 20) return;
    setBusy(kind);
    setError('');
    try {
      if (kind === 'notes') {
        // Keep the style these notes were in, else the student's default.
        const notes = await callAi<Notes>('lectureNotes', { ...input, mode: mode ?? lecture?.notes?.mode ?? profile?.summary_mode ?? 'detailed' });
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
  }, [input, transcript, patch, lecture?.title, lecture?.notes?.mode, profile?.summary_mode, toMessage]);

  /** Make again whatever was made from the old transcript. */
  const updateFromEdits = async () => {
    if (!lecture) return;
    const had = { notes: Boolean(lecture.notes), quiz: Boolean(lecture.quiz), cards: Boolean(lecture.flashcards) };
    setUpdating(true);
    if (had.notes) await generate('notes');
    if (had.quiz) await generate('quiz');
    if (had.cards) await generate('cards');
    setUpdating(false);
    setStale(false);
  };

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
        {folders.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t.lectures.library.folder}</span>
            <Select className="h-9 w-auto min-w-40 py-0" value={lecture.folder_id ?? ''}
              onChange={(e) => void patch({ folder_id: e.target.value || null })}>
              <option value="">{t.lectures.library.noFolder}</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </label>
        )}
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

          {stale && (
            <Alert>
              <p>{t.lectures.transcriptTools.stale}</p>
              <Button size="sm" className="mt-2" icon={<RefreshCw className="size-4" />} loading={updating} onClick={() => void updateFromEdits()}>
                {updating ? t.lectures.transcriptTools.updating : t.lectures.transcriptTools.updateAll}
              </Button>
            </Alert>
          )}

          {tab === 'notes' && (
            busy === 'notes' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" />{t.lectures.writingNotes}</Card>
            : lecture.notes ? (
              <article className="space-y-4">
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <Segmented<SummaryMode> label={t.lectures.notesStyle} value={lecture.notes.mode ?? 'detailed'}
                    onChange={(m) => { if (m !== (lecture.notes?.mode ?? 'detailed')) void generate('notes', m); }}
                    options={SUMMARY_MODES.map((m) => ({ value: m, label: t.lectures.summaryModes[m] }))} />
                </div>
                <NotesView notes={lecture.notes} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" icon={<Copy className="size-4" />} onClick={copyNotes}>{copied ? t.lectures.copied : t.lectures.copy}</Button>
                  <Button variant="secondary" size="sm" icon={<Download className="size-4" />}
                    onClick={() => download(`${title}.md`, notesToMarkdown(title, lecture.notes!, labels))}>{t.lectures.download}</Button>
                  <Link to={`/lectures/${id}/print`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2">
                    <FileDown className="size-4" aria-hidden="true" />{t.lectures.share.savePdf}
                  </Link>
                  <Button variant="secondary" size="sm" icon={<Share2 className="size-4" />} aria-expanded={sharing} onClick={() => { setSharing((v) => !v); setShareNote(''); }}>{t.lectures.share.share}</Button>
                  <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => generate('notes')}>{t.lectures.regenerate}</Button>
                </div>
                {sharing && <SharePanel lectureId={id} token={lecture.share_token ?? null} demo={demo} note={shareNote}
                  onChange={(token, note) => { setLecture((l) => (l ? { ...l, share_token: token } : l)); setShareNote(note); }} />}
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm text-muted">
                  <span>{t.lectures.turnInto}:</span>
                  <Link to={`/videos?lecture=${id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 font-medium text-fg hover:bg-surface-2">
                    <Clapperboard className="size-4" aria-hidden="true" />{t.lectures.video}
                  </Link>
                  <Link to={`/podcasts?lecture=${id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 font-medium text-fg hover:bg-surface-2">
                    <Headphones className="size-4" aria-hidden="true" />{t.lectures.podcast}
                  </Link>
                </div>
              </article>
            ) : (
              <Card className="flex flex-col items-center gap-3 p-8">
                <Button icon={<Sparkles className="size-4" />} onClick={() => generate('notes')}>{error ? t.common.tryAgain : t.lectures.regenerate}</Button>
              </Card>
            )
          )}

          {tab === 'transcript' && (
            <TranscriptPanel segments={lecture.segments} timed={lecture.source === 'record' || lecture.source === 'upload'} fileName={title}
              onSave={async (segments: Segment[]) => {
                await patch({ segments });
                if (lecture.notes || lecture.quiz || lecture.flashcards) setStale(true);
              }} />
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
                <FlashcardDeck deck={lecture.flashcards} onAnswer={onCardAnswer} />
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


/** Turn a share link on or off, and copy or send it. */
const SharePanel = ({ lectureId, token, demo, note, onChange }: {
  lectureId: string; token: string | null; demo: boolean; note: string; onChange: (token: string | null, note: string) => void;
}) => {
  const t = useT();
  const ts = t.lectures.share;
  const [busy, setBusy] = useState(false);
  const url = token ? publicUrl(`/s/${token}`) : '';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch { onChange(token, ts.failed); } finally { setBusy(false); }
  };

  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">{ts.title}</h3>
      {demo ? <p className="text-sm text-muted">{ts.needsAccount}</p> : (
        <>
          <p className="text-sm text-muted">{ts.body}</p>
          {token ? (
            <>
              <Input readOnly aria-label={ts.link} value={url} dir="ltr" onFocus={(e) => e.target.select()} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<Link2 className="size-4" />} onClick={() => void navigator.clipboard.writeText(url).then(() => onChange(token, ts.copied), () => {})}>{ts.copyLink}</Button>
                {typeof navigator.share === 'function' && (
                  <Button size="sm" variant="secondary" icon={<Share2 className="size-4" />} onClick={() => void navigator.share({ url }).catch(() => {})}>{ts.send}</Button>
                )}
                <Button size="sm" variant="ghost" loading={busy} onClick={() => void run(async () => { await lectureRepo.unshare(lectureId); onChange(null, ts.stopped); })}>{ts.stop}</Button>
              </div>
            </>
          ) : (
            <Button size="sm" loading={busy} icon={<Link2 className="size-4" />} onClick={() => void run(async () => onChange(await lectureRepo.share(lectureId), ''))}>{ts.makeLink}</Button>
          )}
        </>
      )}
      {note && <p className="text-sm" role="status">{note}</p>}
    </Card>
  );
};
