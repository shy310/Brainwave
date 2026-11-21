import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, Check, Clapperboard, Copy, Download, FileDown, Folder as FolderIcon, FolderInput, Headphones, Link2, MessageCircleQuestion, Pencil, RefreshCw, Share2, SlidersHorizontal, Sparkles, Trash2, Users, MoreHorizontal } from 'lucide-react';
import { Sheet } from '@/ui/Sheet';
import { ListRow, ListSection } from '@/ui/List';
import { publicUrl } from '@/lib/platform';
import { useI18n, useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { MAX_SLIDES_CHARS, MAX_TRANSCRIPT_CHARS, SUMMARY_MODES, withEmoji, type Flashcards, type Notes, type Segment, type SummaryMode } from '@shared/lectures';
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
import { dateLocale } from '@shared/locales';
import { copyNotes as copyNotesToClipboard, notesLabels, notesLocale, notesToMarkdown } from './notesExport';
import { askConfirm } from '@/ui/Confirm';
import { Shimmer } from '@/ui/Feedback';
import { recordQuizAnswer } from '@/features/weak/mistakeRepo';
import { markedSegments, transcriptWithMarks } from '@shared/marks';
import { ImportantMoments } from './ImportantMoments';
import { Highlighter } from './Highlighter';
import { HighlightsList } from './HighlightsList';

const TABS = ['notes', 'transcript', 'quiz', 'cards'] as const;
type Tab = (typeof TABS)[number];

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
  // Opened from search at a moment (?t=seconds): show it in the transcript, and cue the recording there.
  const [params] = useSearchParams();
  const jumpTo = params.get('t');
  const [jumped, setJumped] = useState(false);
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
  /** Which sheet is open: lecture options, customize the notes, or move to a folder. */
  const [sheet, setSheet] = useState<'' | 'options' | 'customize' | 'move'>('');
  /** The style picked in Customize, applied only on Apply (a new style costs an AI rewrite). */
  const [choice, setChoice] = useState<SummaryMode>('detailed');
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

  const playFrom = useCallback((start: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = start;
    void a.play().catch(() => {});
  }, []);
  // Marked moments go to the AI with a ⭐ in front, so the notes, quiz and cards give them extra weight.
  const transcript = useMemo(() => (lecture ? (lecture.marks?.length ? transcriptWithMarks(lecture.segments, lecture.marks) : transcriptOf(lecture)) : ''), [lecture]);
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
        // Titles get the notes' emoji too (🧬 Cell division), so lectures are easy to tell apart.
        await patch({ notes: withNewNotes(current, notes, !fresh), title: lecture?.title ? withEmoji(lecture.title, notes.title) : notes.title.slice(0, 200) });
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

  useEffect(() => {
    if (!lecture || jumped || jumpTo === null) return;
    const at = Number(jumpTo);
    if (!Number.isFinite(at)) return;
    setJumped(true);
    setTab('transcript');
    const seg = [...lecture.segments].reverse().find((s) => s.start <= at) ?? lecture.segments[0];
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = seg && document.getElementById(`seg-${seg.start}`);
      el?.scrollIntoView({ block: 'center' });
      el?.classList.add('animate-flash');
      if (audio.current) audio.current.currentTime = seg?.start ?? at;
    }));
  }, [lecture, jumpTo, jumped]);

  if (lecture === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (lecture === null) return <Alert tone="error">{t.lectures.notFound}</Alert>;

  const title = lectureTitle(lecture, t.lectures.untitled, locale);

  const remove = async () => {
    if (!(await askConfirm({ message: t.lectures.confirmDelete, action: 'delete' }))) return;
    await lectureRepo.remove(id);
    navigate('/lectures', { replace: true });
  };

  const removeRecording = async () => {
    if (!(await askConfirm({ message: t.lectures.keepRecording.confirmDelete, action: 'delete' }))) return;
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
  const to = t.lectures.options;
  const folder = folders.find((f) => f.id === lecture.folder_id);
  const close = () => setSheet('');
  const openCustomize = () => { setChoice(lecture.notes ? notesMode(lecture.notes) : profile?.summary_mode ?? 'detailed'); setSheet('customize'); };
  /** Run a sheet action after the sheet has closed. */
  const then = (fn: () => void) => () => { close(); fn(); };
  const pickStyle = (m: SummaryMode) => {
    close();
    if (!lecture.notes || m === notesMode(lecture.notes)) return;
    // A style written before is shown again as it was; only a new style asks the AI.
    const saved = switchNotes(lecture.notes, m);
    if (saved) void patch({ notes: saved }); else void generate('notes', m);
  };
  const dockActions: DockAction[] = [
    { key: 'share', label: t.lectures.share.share, icon: <Share2 />, tone: 'bg-[#fff3c9] text-brand-700 dark:bg-[#2a2410] dark:text-accent-300', disabled: !lecture.notes, items: [
      { label: t.lectures.actions.link, icon: <Link2 />, onSelect: () => openShare('link') },
      { label: t.lectures.shareGroup.button, icon: <Users />, onSelect: () => openShare('group') },
    ] },
    { key: 'ask', label: t.lectures.askPanel.open, icon: <MessageCircleQuestion />, tone: 'bg-brand-600 text-white', onSelect: (el) => ask.current?.open(el) },
    { key: 'customize', label: to.customize, icon: <SlidersHorizontal />, tone: 'bg-brand-500/12 text-brand-700 dark:bg-brand-400/18 dark:text-brand-300', disabled: !lecture.notes, onSelect: () => openCustomize() },
    { key: 'copy', label: copied ? t.lectures.copied : t.lectures.copy, icon: <Copy />, tone: 'bg-brand-500/12 text-brand-700 dark:bg-brand-400/18 dark:text-brand-300', disabled: !lecture.notes, onSelect: () => void copyNotes() },
    { key: 'more', label: t.lectures.actions.more, name: to.title, icon: <MoreHorizontal />, tone: 'bg-surface-2 text-fg ring-1 ring-line', onSelect: () => setSheet('options') },
  ];

  const copyNotes = async () => {
    if (!lecture.notes) return;
    await copyNotesToClipboard(title, lecture.notes, locale).catch(() => {});
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
            <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight" dir="auto">{title}</h1>
          </div>
        )}
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
          <span>{t.lectures.sources[lecture.source]}</span>
          {lecture.duration_sec > 0 && <><span aria-hidden="true">·</span><span>{t.lectures.minutes(Math.max(1, Math.round(lecture.duration_sec / 60)))}</span></>}
          <span aria-hidden="true">·</span><span>{new Date(lecture.created_at).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {folder && (
            <button type="button" onClick={() => setSheet('move')} className="ms-1 inline-flex h-7 max-w-[12rem] items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-medium text-fg hover:bg-line">
              <FolderIcon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{folder.name}</span>
            </button>
          )}
        </p>
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
          <Segmented fill label={title} value={tab} onChange={setTab}
            options={TABS.map((v) => ({ value: v, label: t.lectures.tabsView[v] }))} />

          {error && <Alert tone="error">{error}</Alert>}
          <AskPanel sessionKey={`bw.lectureChat.${id}`} context={chatContext} within={content} handle={ask} />

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
            busy === 'notes' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" /><Shimmer text={t.lectures.writingNotes} /></Card>
            : lecture.notes ? (
              <article className="space-y-4">
                {/* The notes' style is a setting of the notes: a chip that opens Customize, not a second row of tabs. */}
                <div className="flex justify-end">
                  <button type="button" onClick={() => openCustomize()} aria-label={`${to.customize}: ${t.lectures.summaryModes[notesMode(lecture.notes)]}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2">
                    <SlidersHorizontal className="size-4 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                    {t.lectures.summaryModes[notesMode(lecture.notes)]}
                  </button>
                </div>
                <ImportantMoments marks={lecture.marks ?? []} segments={lecture.segments} onPlay={lecture.audio_path ? playFrom : undefined}
                  onShow={(start) => { setTab('transcript'); requestAnimationFrame(() => document.getElementById(`seg-${start}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })); }} />
                <Highlighter highlights={lecture.highlights ?? []} onChange={(highlights) => void patch({ highlights })}>
                  <NotesView notes={lecture.notes} />
                </Highlighter>
                <HighlightsList highlights={lecture.highlights ?? []} onChange={(highlights) => void patch({ highlights })} />
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
              marked={lecture.marks?.length ? markedSegments(lecture.segments, lecture.marks) : undefined}
              onPlay={lecture.audio_path ? playFrom : undefined}
              onSave={async (segments: Segment[]) => {
                await patch({ segments });
                if (lecture.notes || lecture.quiz || lecture.flashcards) setStale(true);
              }} />
          )}

          </div>

          {tab === 'quiz' && (
            busy === 'quiz' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" /><Shimmer text={t.lectures.makingQuiz} /></Card>
            : lecture.quiz ? (
              <QuizRunner key={quizRound} questions={lecture.quiz.questions} context={transcript}
                onQuestion={(q, ok) => void recordQuizAnswer(q, id, ok)}
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
            busy === 'cards' ? <Card className="flex items-center gap-3 p-6 text-muted"><Spinner className="size-5" /><Shimmer text={t.lectures.makingCards} /></Card>
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

        </>
      )}

      <Sheet open={sheet === 'options'} onClose={close} title={to.title}>
        <div className="space-y-4">
          {/* The three things people do most, as big shortcuts; everything else is a list; delete is last. */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t.lectures.rename, icon: Pencil, onClick: then(() => { setName(lecture.title); setRenaming(true); }) },
              { label: to.customize, icon: SlidersHorizontal, onClick: () => openCustomize(), disabled: !lecture.notes },
              { label: to.move, icon: FolderInput, onClick: () => setSheet('move') },
            ].map((a) => (
              <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled}
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-2 text-center text-sm font-medium hover:bg-line disabled:opacity-40">
                <a.icon className="size-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />{a.label}
              </button>
            ))}
          </div>
          <ListSection>
            {lecture.notes && <ListRow icon={FileDown} label={t.lectures.share.savePdf} onClick={then(() => navigate(`/lectures/${id}/print`))} chevron={false} />}
            {lecture.notes && <ListRow icon={Download} label={t.lectures.download} onClick={then(() => download(`${title}.md`, notesToMarkdown(title, lecture.notes!, notesLabels(notesLocale(lecture.notes!, locale)))))} chevron={false} />}
            {lecture.notes && <ListRow icon={RefreshCw} label={t.lectures.regenerate} onClick={then(() => void generate('notes'))} chevron={false} />}
            {lecture.audio_path && recordingUrl && (
              <ListRow icon={Download} label={tk.download} chevron={false} onClick={then(() => {
                Object.assign(document.createElement('a'), { href: recordingUrl, download: `${title}.${recordingExtension(lecture.audio_type)}` }).click();
              })} />
            )}
          </ListSection>
          <ListSection>
            {lecture.audio_path && <ListRow icon={Trash2} danger label={tk.deleteRecording} onClick={then(() => void removeRecording())} chevron={false} />}
            <ListRow icon={Trash2} danger label={t.lectures.delete} onClick={then(() => void remove())} chevron={false} />
          </ListSection>
        </div>
      </Sheet>

      <Sheet open={sheet === 'customize'} onClose={close} title={to.customizeTitle}
        footer={<Button block size="lg" onClick={() => pickStyle(choice)}>{to.apply}</Button>}>
        <div role="radiogroup" aria-label={t.lectures.notesStyle} className="space-y-2">
          {SUMMARY_MODES.map((m) => {
            const on = choice === m;
            return (
              <button key={m} type="button" role="radio" aria-checked={on} onClick={() => setChoice(m)}
                className={cn('flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition-colors',
                  on ? 'border-brand-600 bg-brand-500/10' : 'border-line hover:bg-surface-2')}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.lectures.summaryModes[m]}</span>
                  <span className="block text-sm text-muted">{to.styleHelp[m]}</span>
                </span>
                {on && <Check className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />}
              </button>
            );
          })}
          <p className="pt-1 text-sm text-muted">{t.lectures.notesStyleHint}</p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'move'} onClose={close} title={to.move}>
        <div role="radiogroup" aria-label={to.move}>
          <ListSection>
            {[{ id: '', name: t.lectures.library.noFolder }, ...folders].map((f) => (
              <button key={f.id || 'none'} type="button" role="radio" aria-checked={(lecture.folder_id ?? '') === f.id}
                onClick={then(() => void patch({ folder_id: f.id || null }))}
                className="flex min-h-14 w-full items-center gap-3 px-4 text-start hover:bg-surface-2">
                <FolderIcon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium" dir="auto">{f.name}</span>
                {(lecture.folder_id ?? '') === f.id && <Check className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />}
              </button>
            ))}
          </ListSection>
        </div>
      </Sheet>

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
