import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Clapperboard, Copy, Download, FileDown, Headphones, Layers, Link2, ListChecks, MessageCircleQuestion, MessageSquareText, NotebookText, Pencil, RefreshCw, Share2, Sparkles, Trash2, Users, MoreHorizontal } from 'lucide-react';
import { publicUrl } from '@/lib/platform';
import { useI18n, useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
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
import { FlashcardDeck, MasteryBar } from './Flashcards';
import { TranscriptPanel } from './TranscriptPanel';
import { RecordingPlayer, recordingExtension, useRecordingUrl } from './RecordingPlayer';
import { LectureDock, type DockAction } from './LectureDock';
import { recordingRepo } from './recording';
import { useHideTabBar } from '@/app/chrome';
import { NotesView } from './NotesView';
import { notifyIfAway } from '@/features/schedule/notify';
import { AskPanel, type AskPanelHandle } from './AskPanel';
import { ShareToGroupPanel } from './ShareToGroupPanel';
import { rate, reviewRepo } from './reviews';
import { cardKey, masteryCounts, type CardState } from '@shared/srs';
import { folderRepo, type Folder } from './folders';
import { lectureTitle } from './LecturesPage';
import { notesMode, switchNotes, withNewNotes } from './notesVersions';
import { lectureRepo, transcriptOf, type Lecture, type LecturePatch } from './repo';

type Tab = 'notes' | 'transcript' | 'quiz' | 'cards' | 'ask';
const TAB_ICONS = { notes: NotebookText, transcript: MessageSquareText, quiz: ListChecks, cards: Layers, ask: MessageCircleQuestion };

export interface NotesLabels { summary: string; keyTerms: string; reminders: string; practice: string; mistakes: string }

export const notesToMarkdown = (title: string, n: Notes, labels: NotesLabels) => [
  `# ${title}`, '', `## ${labels.summary}`, n.summary, '',
  ...n.sections.flatMap((s) => [`## ${s.heading}`, ...s.points.map((p) => `- ${p}`), '']),
  ...(n.keyTerms.length ? [`## ${labels.keyTerms}`, ...n.keyTerms.map((k) => `- **${k.term}** — ${k.definition}`), ''] : []),
  ...(n.practice?.length ? [`## ${labels.practice}`, ...n.practice.map((p, i) => `${i + 1}. ${p.question}\n   ${p.answer}`), ''] : []),
  ...(n.mistakes?.length ? [`## ${labels.mistakes}`, ...n.mistakes.map((m) => `- ${m}`), ''] : []),
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
  const [groupSharing, setGroupSharing] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('notes');
  const audio = useRef<HTMLAudioElement>(null);
  const ask = useRef<AskPanelHandle>(null);
  // The lecture has its own bar at the bottom (actions and player) instead of the app's tabs.
  useHideTabBar();
  const recordingUrl = useRecordingUrl({ id, audio_path: lecture?.audio_path });
  /** Set by the new-lecture page when the kept recording couldn't be saved. */
  const recordingProblem = (useLocation().state as { recordingProblem?: 'too-big' | 'limit' } | null)?.recordingProblem;
  const [busy, setBusy] = useState<'' | 'notes' | 'quiz' | 'cards'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [quizRound, setQuizRound] = useState(0);
  const autoNotes = useRef(false);
  /** Notes and transcript: text here can be selected and asked about. */
  const content = useRef<HTMLDivElement>(null);
  /** The transcript was edited after notes, a quiz or flashcards were made. */
  const [stale, setStale] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const reviewStates = useRef<Promise<Map<string, CardState>> | null>(null);
  /** Practising here also updates the spaced-repetition schedule. */
  // Review state of this lecture's cards, for the progress bar (new / learning / almost / mastered).
  const [cardStates, setCardStates] = useState<Map<string, CardState> | null>(null);
  const hasCards = Boolean(lecture?.flashcards);
  useEffect(() => {
    if (tab !== 'cards' || !hasCards) return;
    reviewStates.current ??= reviewRepo.list();
    void reviewStates.current.then((st) => setCardStates(new Map(st))).catch(() => {});
  }, [tab, hasCards]);
  const mastery = useMemo(() => lecture?.flashcards && cardStates
    ? masteryCounts(lecture.flashcards.cards.map((c) => cardStates.get(cardKey(id, c.front)))) : null, [lecture?.flashcards, cardStates, id]);

  const onCardAnswer = (i: number, knew: boolean) => {
    const card = lecture?.flashcards?.cards[i];
    if (!card) return;
    reviewStates.current ??= reviewRepo.list();
    void reviewStates.current.then(async (st) => {
      await rate(st, { key: cardKey(id, card.front), lectureId: id }, knew ? 'good' : 'again');
      setCardStates(new Map(st));
    });
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

  /**
   * Make notes, a quiz or flashcards. For notes, `mode` picks the style (else
   * the one shown, else the student's default); `fresh` means the transcript
   * changed, so notes saved in other styles are dropped.
   */
  const generate = useCallback(async (kind: 'notes' | 'quiz' | 'cards', mode?: SummaryMode, fresh = false) => {
    if (!input || transcript.length < 20) return;
    setBusy(kind);
    setError('');
    try {
      if (kind === 'notes') {
        const current = lecture?.notes ?? null;
        const notes = await callAi<Notes>('lectureNotes', { ...input, mode: mode ?? current?.mode ?? profile?.summary_mode ?? 'detailed' });
        await patch({ notes: withNewNotes(current, notes, !fresh), ...(lecture?.title ? {} : { title: notes.title.slice(0, 200) }) });
        void notifyIfAway(t.notify.notesReady, lecture?.title || notes.title, `/lectures/${id}`, (p) => navigate(p));
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
  }, [input, transcript, patch, lecture?.title, lecture?.notes, profile?.summary_mode, toMessage, t, id, navigate]);

  /** Make again whatever was made from the old transcript. */
  const updateFromEdits = async () => {
    if (!lecture) return;
    const had = { notes: Boolean(lecture.notes), quiz: Boolean(lecture.quiz), cards: Boolean(lecture.flashcards) };
    setUpdating(true);
    if (had.notes) await generate('notes', undefined, true);
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
  const labels: NotesLabels = { summary: t.lectures.summary, keyTerms: t.lectures.keyTerms, reminders: t.lectures.reminders, practice: t.lectures.practice, mistakes: t.lectures.mistakes };

  const remove = async () => {
    if (!window.confirm(t.lectures.confirmDelete)) return;
    await lectureRepo.remove(id);
    navigate('/lectures', { replace: true });
  };

  const removeRecording = async () => {
    if (!window.confirm(t.lectures.keepRecording.confirmDelete)) return;
    audio.current?.pause();
    try {
      await recordingRepo.remove(lecture);
      setLecture((l) => (l ? { ...l, audio_path: null, audio_type: null, audio_bytes: null } : l));
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    }
  };

  const openShare = (kind: 'link' | 'group') => {
    setTab('notes');
    setSharing(kind === 'link');
    setGroupSharing(kind === 'group');
    if (kind === 'link') setShareNote('');
  };

  const tk = t.lectures.keepRecording;
  const dockActions: DockAction[] = [
    { key: 'share', label: t.lectures.share.share, icon: <Share2 />, tone: 'bg-accent-500', disabled: !lecture.notes, items: [
      { label: t.lectures.actions.link, icon: <Link2 />, onSelect: () => openShare('link') },
      { label: t.lectures.shareGroup.button, icon: <Users />, onSelect: () => openShare('group') },
    ] },
    { key: 'ask', label: t.lectures.askPanel.open, icon: <MessageCircleQuestion />, tone: 'bg-brand-600', onSelect: (el) => {
      // On the Ask tab the conversation is already open: go to its message box.
      if (tab === 'ask') content.current?.parentElement?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      else ask.current?.open(el);
    } },
    { key: 'copy', label: copied ? t.lectures.copied : t.lectures.copy, icon: <Copy />, tone: 'bg-sky-600', disabled: !lecture.notes, onSelect: () => void copyNotes() },
    { key: 'pdf', label: t.lectures.actions.pdf, name: t.lectures.share.savePdf, icon: <FileDown />, tone: 'bg-amber-500', disabled: !lecture.notes, onSelect: () => navigate(`/lectures/${id}/print`) },
    { key: 'more', label: t.lectures.actions.more, icon: <MoreHorizontal />, tone: 'bg-fg/70 dark:bg-fg/25', items: [
      ...(lecture.notes ? [
        { label: t.lectures.download, icon: <Download />, onSelect: () => download(`${title}.md`, notesToMarkdown(title, lecture.notes!, labels)) },
        { label: t.lectures.regenerate, icon: <RefreshCw />, onSelect: () => void generate('notes') },
      ] : []),
      ...(lecture.audio_path && recordingUrl ? [{ label: tk.download, icon: <Download />, onSelect: () => {
        Object.assign(document.createElement('a'), { href: recordingUrl, download: `${title}.${recordingExtension(lecture.audio_type)}` }).click();
      } }] : []),
      ...(lecture.audio_path ? [{ label: tk.deleteRecording, icon: <Trash2 />, danger: true, onSelect: () => void removeRecording() }] : []),
      { label: t.lectures.delete, icon: <Trash2 />, danger: true, onSelect: () => void remove() },
    ] },
  ];

  const copyNotes = async () => {
    if (!lecture.notes) return;
    await navigator.clipboard.writeText(notesToMarkdown(title, lecture.notes, labels)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    // Room at the bottom so the dock never covers the end of the page.
    <div className={cn('mx-auto max-w-3xl space-y-6', lecture.audio_path ? 'pb-64' : 'pb-32')}>
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

      {recordingProblem && <Alert tone="error">{t.lectures.keepRecording.problems[recordingProblem]}</Alert>}

      {lecture.status === 'transcribing' && (
        <Alert>
          <p className="flex items-center gap-2"><AlertTriangle className="size-4" aria-hidden="true" />{t.lectures.interrupted}</p>
          <Button size="sm" className="mt-2" onClick={() => patch({ status: 'ready' })}>{t.lectures.useWhatWeHave}</Button>
        </Alert>
      )}

      {!transcript && lecture.status === 'ready' ? <Alert>{t.lectures.emptyTranscript}</Alert> : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Segmented scroll label={title} value={tab} onChange={setTab}
              options={(['notes', 'transcript', 'quiz', 'cards', 'ask'] as const).map((v) => ({ value: v, label: t.lectures.tabsView[v], icon: TAB_ICONS[v] }))} />
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          <AskPanel sessionKey={`bw.lectureChat.${id}`} context={chatContext} within={content} hidden={tab === 'ask'} handle={ask} />

          {stale && (
            <Alert>
              <p>{t.lectures.transcriptTools.stale}</p>
              <Button size="sm" className="mt-2" icon={<RefreshCw className="size-4" />} loading={updating} onClick={() => void updateFromEdits()}>
                {updating ? t.lectures.transcriptTools.updating : t.lectures.transcriptTools.updateAll}
              </Button>
            </Alert>
          )}

          <div ref={content} className="space-y-6">
          {tab === 'notes' && (
            busy === 'notes' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" />{t.lectures.writingNotes}</Card>
            : lecture.notes ? (
              <article className="space-y-4">
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <Segmented<SummaryMode> label={t.lectures.notesStyle} value={lecture.notes.mode ?? 'detailed'}
                    onChange={(m) => {
                      if (!lecture.notes || m === notesMode(lecture.notes)) return;
                      // A style written before is shown again as it was; only a new style asks the AI.
                      const saved = switchNotes(lecture.notes, m);
                      if (saved) void patch({ notes: saved }); else void generate('notes', m);
                    }}
                    options={SUMMARY_MODES.map((m) => ({ value: m, label: t.lectures.summaryModes[m] }))} />
                </div>
                <NotesView notes={lecture.notes} />
                {groupSharing && <ShareToGroupPanel lecture={lecture} />}
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
              onPlay={lecture.audio_path ? (start) => {
                const a = audio.current;
                if (!a) return;
                a.currentTime = start;
                void a.play().catch(() => {});
              } : undefined}
              onSave={async (segments: Segment[]) => {
                await patch({ segments });
                if (lecture.notes || lecture.quiz || lecture.flashcards) setStale(true);
              }} />
          )}

          </div>

          {tab === 'quiz' && (
            busy === 'quiz' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" />{t.lectures.makingQuiz}</Card>
            : lecture.quiz ? (
              <QuizRunner key={quizRound} questions={lecture.quiz.questions} context={transcript}
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
                {mastery && <MasteryBar counts={mastery} />}
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

      <LectureDock actions={dockActions}
        player={lecture.audio_path ? <RecordingPlayer url={recordingUrl} audioRef={audio} fallbackDuration={lecture.duration_sec} /> : undefined} />
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
