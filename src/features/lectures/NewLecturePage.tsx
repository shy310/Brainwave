import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/ui/PageHeader';
import { LectureThumb } from './LectureThumb';
import { useBlocker, useNavigate, useSearchParams } from 'react-router';
import { Check, Ear, Mic, Pause, Play, RefreshCw, Square, Star, Trash2, Upload } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { useAiError } from '@/lib/useAiError';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Select } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import { Spinner } from '@/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  BYTES_PER_MINUTE, LECTURE_LANGUAGES, type LectureLanguage, type Segment,
} from '@shared/lectures';
import { DEFAULT_LIMITS, LiveRecorder, SAMPLE_RATE, decodeFile, formatTime, splitAtQuietPoints, type PieceLimits } from './audio';
import { audioStore, checkStorage } from './audioStore';
import { LectureSession } from './session';
import type { QueueStatus } from './transcriber';
import { SlidesPicker, type Slides } from './SlidesPicker';
import { useKeepAwake } from './useKeepAwake';
import { YouTubeSource } from './YouTubeSource';
import { DocumentSource } from './DocumentSource';
import { scheduleRepo } from '@/features/schedule/scheduleRepo';
import { classLectureTitle } from '@shared/schedule';
import { notifyIfAway } from '@/features/schedule/notify';
import { NativeRecorder, nativeRecorderAvailable, recoverNative } from './nativeRecorder';
import { inBrowserMaxMinutes, planUpload, probeDuration, type UploadPlan } from './preflight';
import { KeepRecorder } from './recording';
import { KeepRecordingDialog } from './KeepRecordingDialog';
import { Waveform, hearing, useLevelHistory } from './Waveform';
import { askConfirm } from '@/ui/Confirm';

const MODES = ['audio', 'youtube', 'document'] as const;
type Mode = (typeof MODES)[number];
/** The source each choice stands for, for its tile. */
const MODE_SOURCE = { audio: 'record', youtube: 'youtube', document: 'document' } as const;
const modeFor = (tab: string | null): Mode => (tab === 'youtube' ? 'youtube' : tab && ['pdf', 'image', 'text', 'document'].includes(tab) ? 'document' : 'audio');

type Phase = 'setup' | 'checking' | 'preflight' | 'recording' | 'paused' | 'decoding' | 'transcribing' | 'finishing' | 'recovering';
const MAX_FILE_BYTES = 500 * 1024 * 1024;
/** Warn before recording when the device can't hold this many minutes of audio. */
const LOW_STORAGE_MINUTES = 120;
const IDLE: QueueStatus = { pending: 0, pendingSeconds: 0, blocked: null, retryAt: null };

/** End-to-end tests use short pieces so they don't have to record for minutes. */
const pieceSettings = (): { limits: PieceLimits; checkpointEvery: number } => {
  try {
    const raw = storage.get('bw.test.pieces');
    if (raw) {
      const v = JSON.parse(raw) as PieceLimits & { checkpoint?: number };
      if (v.min > 0 && v.max >= v.min) return { limits: { min: v.min, target: v.target ?? v.min, max: v.max }, checkpointEvery: v.checkpoint ?? 1 };
    }
  } catch { /* ignore */ }
  return { limits: DEFAULT_LIMITS, checkpointEvery: 5 };
};

/** What the page needs from a recorder: the web one (LiveRecorder) or the Android one (NativeRecorder). */
type Recorder = Pick<LiveRecorder, 'start' | 'stop' | 'pause' | 'resume' | 'elapsed' | 'lastFrameAt' | 'state'>;

const minutes = (sec: number) => Math.max(1, Math.round(sec / 60));
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export default function NewLecturePage() {
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const [params] = useSearchParams();
  const resumeId = params.get('resume');
  const classId = params.get('class');
  /** Folder for the lecture, when started from a class in the schedule. */
  const [folderId, setFolderId] = useState<string | null>(null);
  // Three ways to add a lecture. ?tab= picks one, e.g. from Home's quick actions (old names still work:
  // upload → Audio, pdf/image/text → Document).
  const [mode, setMode] = useState<Mode>(() => modeFor(params.get('tab')));
  /** Within Audio: recording live, or a file being uploaded. */
  const [tab, setTab] = useState<'record' | 'upload'>(() => (params.get('tab') === 'upload' ? 'upload' : 'record'));
  const [title, setTitle] = useState('');
  // The student's usual lecture language (from onboarding or Settings).
  const [language, setLanguage] = useState<LectureLanguage>(profile?.lecture_language ?? 'auto');
  const [slides, setSlides] = useState<Slides | null>(null);
  const [phase, setPhase] = useState<Phase>(resumeId ? 'recovering' : 'setup');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState<QueueStatus>(IDLE);
  const [duration, setDuration] = useState(0);
  const [live, setLive] = useState<Segment[]>([]);
  const [finalizeFailed, setFinalizeFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [upload, setUpload] = useState<{ file: File; plan: UploadPlan } | null>(null);

  const session = useRef<LectureSession | null>(null);
  const recorder = useRef<Recorder | null>(null);
  /** Makes the compressed copy the student can keep (web recorder only). */
  const keeper = useRef<KeepRecorder | null>(null);
  /** Shown when recording stops and a copy was made: keep it or delete it? */
  const [askKeep, setAskKeep] = useState<{ seconds: number; bytes: number } | null>(null);
  /** Finishing waits for that answer. */
  const keepAnswer = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const native = nativeRecorderAvailable();
  /** Writes to local storage happen one after another, in order. */
  const writes = useRef<Promise<void>>(Promise.resolve());

  /** A PDF or photo note is being made. */
  const [sourceBusy, setSourceBusy] = useState(false);
  const busy = phase !== 'setup' || sourceBusy;
  /** Something would be lost or interrupted by leaving now. */
  const guarded = busy && phase !== 'checking' && phase !== 'preflight';
  const recordingActive = phase === 'recording' || phase === 'paused';
  const leaving = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    guarded && !leaving.current && currentLocation.pathname !== nextLocation.pathname);
  // Leaving mid-recording asks first, in the app's own dialog.
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void askConfirm({ message: t.lectures.leaveWarning, action: 'leave' }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, t]);

  useEffect(() => {
    if (!guarded || phase === 'finishing') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [guarded, phase]);

  // Leaving the page keeps the draft on this device; it can be recovered later.
  useEffect(() => () => {
    void keeper.current?.stop();
    void recorder.current?.stop();
    session.current?.close();
  }, []);

  useEffect(() => {
    if (session.current && slides) session.current.setSlides(slides.text);
  }, [slides]);

  const events = {
    onTranscript: setLive,
    onStatus: setStatus,
  };

  /** Run a local-storage write after the ones before it. Rejects if this one failed. */
  const write = (fn: () => Promise<void>) => {
    const run = writes.current.then(fn);
    writes.current = run.catch((err: unknown) => {
      console.error('Could not save audio on this device', err);
      setError((err as DOMException)?.name === 'QuotaExceededError' ? t.lectures.storageFull : t.lectures.noDeviceStorage);
    });
    return run;
  };

  const finalize = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setPhase('finishing');
    setFinalizeFailed(false);
    try {
      const id = await s.finalize();
      // Finished while the student was in another tab or app: let them know.
      void notifyIfAway(t.notify.lectureReady, s.draft.title || t.lectures.untitled, `/lectures/${id}`, (p) => navigate(p));
      leaving.current = true;
      navigate(`/lectures/${id}`, { replace: true, state: s.recordingProblem ? { recordingProblem: s.recordingProblem } : undefined });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setFinalizeFailed(true);
      setPhase('transcribing');
    }
  }, [navigate, t, toMessage]);

  /** Ask whether to keep the recording, if a copy was made and the student hasn't said yet. */
  const askAboutRecording = async (s: LectureSession) => {
    if (s.draft.keepAudio !== undefined) return;
    const blob = await s.recording();
    if (!blob?.size) return;
    let resolve = () => {};
    const promise = new Promise<void>((r) => { resolve = r; });
    keepAnswer.current = { promise, resolve };
    setAskKeep({ seconds: s.draft.duration, bytes: blob.size });
  };

  const chooseKeep = async (keep: boolean) => {
    setAskKeep(null);
    await session.current?.setKeepAudio(keep).catch((err) => console.error(err));
    keepAnswer.current?.resolve();
    keepAnswer.current = null;
  };

  /** Wait for every saved piece to be transcribed (and the keep-recording answer), then save the lecture. */
  const finish = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setPhase('transcribing');
    setDuration(s.draft.duration);
    await s.queue.idle();
    await keepAnswer.current?.promise;
    if (session.current === s) await finalize();
  }, [finalize]);

  const finishLater = () => {
    const id = session.current?.lectureId;
    session.current?.close();
    session.current = null;
    leaving.current = true;
    navigate(id ? `/lectures/${id}` : '/lectures', { replace: true });
  };

  // Started from a class reminder or the "up next" banner: name the lecture and pick its folder.
  useEffect(() => {
    if (!classId) return;
    scheduleRepo.list().then((slots) => {
      const slot = slots.find((s) => s.id === classId);
      if (!slot) return;
      setTitle((cur) => cur || classLectureTitle(slot.name, new Date(), locale));
      setFolderId(slot.folderId);
      setTab('record');
      setMode('audio');
    }).catch(() => {});
  }, [classId, locale]);

  // ── Recover a draft left on this device ──
  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    void (async () => {
      const s = await LectureSession.resume(resumeId, events).catch(() => null);
      if (cancelled) { s?.close(); return; }
      if (!s) { setError(t.lectures.recoverMissing); setPhase('setup'); return; }
      session.current = s;
      // In the Android app, pieces the native recorder saved are moved into the queue too.
      await recoverNative(s.draft.id, (samples, start) => s.addPiece(samples, start)).catch((err) => console.error(err));
      setTitle(s.draft.title);
      setLanguage(s.draft.language);
      setTab(s.draft.source);
      setMode('audio');
      setStatus(s.status);
      if (s.draft.source === 'record') await askAboutRecording(s);
      await finish();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  // ── Record ──
  const startRecording = async () => {
    setError('');
    setNotice('');
    if (!user) return;
    if (!audioStore.available()) { setError(t.lectures.noDeviceStorage); return; }
    const space = await checkStorage(BYTES_PER_MINUTE).catch(() => null);
    if (space?.minutesFree != null && space.minutesFree < LOW_STORAGE_MINUTES) setNotice(t.lectures.lowStorage(space.minutesFree));

    let s: LectureSession;
    try {
      s = await LectureSession.start({ owner: user.id, source: 'record', title: title.trim(), language, slidesText: slides?.text ?? null, folderId }, events);
    } catch (err) {
      console.error(err);
      setError(t.lectures.noDeviceStorage);
      return;
    }
    const { limits, checkpointEvery } = pieceSettings();
    const savePiece = (samples: Float32Array, start: number) =>
      write(async () => { await s.addPiece(samples, start); setDuration(s.draft.duration); });
    const onEnded = () => { setError(t.lectures.micStopped); void stopRecording(); };
    const rec: Recorder = native
      // The Android app records in a foreground service; its files are deleted only after savePiece succeeded.
      ? new NativeRecorder(s.draft.id, title.trim(), { limits, onChunk: savePiece, onLevel: setLevel, onEnded })
      : new LiveRecorder({
        limits,
        checkpointEvery,
        onChunk: (samples, start) => { savePiece(samples, start).catch(() => {}); },
        onCheckpoint: (samples, start) => { write(() => s.checkpoint(samples, start)).catch(() => {}); },
        onLevel: setLevel,
        onEnded,
      });
    try {
      await rec.start();
    } catch (err) {
      await s.discard();
      const name = (err as DOMException)?.name;
      setError(name === 'NotAllowedError' ? t.lectures.micDenied : name === 'NotFoundError' ? t.lectures.micMissing : t.auth.errors.generic);
      return;
    }
    session.current = s;
    recorder.current = rec;
    // The copy the student may keep records the same microphone stream.
    const stream = rec instanceof LiveRecorder ? rec.mediaStream : null;
    if (stream) {
      const k = new KeepRecorder(s.draft.id);
      if (k.start(stream)) keeper.current = k;
    }
    setPhase('recording');
  };

  const history = useLevelHistory(level, phase === 'recording');

  useEffect(() => {
    if (!recordingActive) return;
    const id = setInterval(() => setElapsed(recorder.current?.elapsed ?? 0), 500);
    return () => clearInterval(id);
  }, [recordingActive]);

  // Show the recording time in the tab title, so it's visible from other tabs.
  useEffect(() => {
    if (!recordingActive) return;
    const original = document.title;
    document.title = `${phase === 'recording' ? '● ' : '❚❚ '}${formatTime(elapsed)} · ${phase === 'recording' ? t.lectures.recording : t.lectures.paused}`;
    return () => { document.title = original; };
  }, [recordingActive, phase, elapsed, t]);

  // Keep the screen on, and notice when a phone stopped the microphone in the background.
  const { wakeLockHeld } = useKeepAwake(recordingActive && !native, (hiddenFor, hiddenAt) => {
    const rec = recorder.current;
    if (!rec || phase !== 'recording') return;
    const stoppedAt = Math.max(rec.lastFrameAt, hiddenAt);
    const missed = performance.now() - stoppedAt;
    if (hiddenFor > 2000 && missed > 2000) setNotice(t.lectures.missedAudio(Math.round(missed / 1000)));
    if (rec.state !== 'running' && rec.state !== 'closed') void rec.resume();
  });

  // "Important": mark this moment of the lecture (button, or the M key).
  const [marks, setMarks] = useState<number[]>([]);
  const [markNote, setMarkNote] = useState('');
  const markNow = useCallback(() => {
    const s = session.current, rec = recorder.current;
    if (!s || !rec || !recordingActive) return;
    const at = rec.elapsed;
    void s.addMark(at).then(() => setMarks(s.draft.marks ?? []));
    setMarkNote(t.lectures.marks.marked(formatTime(at)));
    try { navigator.vibrate?.(15); } catch { /* not allowed */ }
  }, [recordingActive, t]);
  useEffect(() => {
    if (!recordingActive) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'm' || e.key === 'M') && !(e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]'))) { e.preventDefault(); markNow(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recordingActive, markNow]);

  const togglePause = async () => {
    if (phase === 'recording') { keeper.current?.pause(); await recorder.current?.pause(); setPhase('paused'); setLevel(0); }
    else { await recorder.current?.resume(); keeper.current?.resume(); setPhase('recording'); }
  };

  const stopRecording = async () => {
    const rec = recorder.current;
    const s = session.current;
    if (!rec || !s) return;
    recorder.current = null;
    const k = keeper.current;
    keeper.current = null;
    await k?.stop();
    await rec.stop(); // emits the last piece
    await write(() => s.stopRecording()).catch(() => {});
    setLevel(0);
    await askAboutRecording(s);
    await finish();
  };

  /** Throw the recording away (asked first). Nothing is saved. */
  const discardRecording = async () => {
    const rec = recorder.current;
    const s = session.current;
    if (!rec || !s || !(await askConfirm({ message: t.lectures.discardConfirm, action: 'delete' }))) return;
    recorder.current = null;
    session.current = null;
    const k = keeper.current;
    keeper.current = null;
    await k?.stop();
    await rec.stop();
    await writes.current;
    await s.discard().catch((err) => console.error(err));
    setLevel(0);
    setElapsed(0);
    setLive([]);
    setStatus(IDLE);
    setPhase('setup');
  };

  // ── Upload ──
  /** Step 1: read the length from the metadata and show what it will take. */
  const onFile = async (file?: File) => {
    if (!file || !user) return;
    setError('');
    setNotice('');
    if (file.size > MAX_FILE_BYTES) { setError(t.lectures.fileTooBig); return; }
    if (!audioStore.available()) { setError(t.lectures.noDeviceStorage); return; }
    setPhase('checking');
    const seconds = await probeDuration(file);
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const plan = planUpload(seconds, file.size, inBrowserMaxMinutes(memory));
    setUpload({ file, plan });
    setPhase(plan.allowed ? 'preflight' : 'setup');
    if (!plan.allowed) setError(t.lectures.tooLongHere(plan.minutes!, plan.maxMinutes));
  };

  /** Step 2: decode in the browser, cut into pieces, save them and transcribe. */
  const transcribeFile = async () => {
    const file = upload?.file;
    if (!file || !user) return;
    const maxMinutes = upload.plan.maxMinutes;
    setUpload(null);
    setPhase('decoding');
    let samples: Float32Array;
    try {
      samples = await decodeFile(file);
    } catch {
      setError(t.lectures.decodeFailed);
      setPhase('setup');
      return;
    }
    // The metadata didn't say how long it was: check now that we know.
    if (samples.length > (maxMinutes * 60 + 30) * SAMPLE_RATE) {
      setError(t.lectures.tooLongHere(Math.round(samples.length / SAMPLE_RATE / 60), maxMinutes));
      setPhase('setup');
      return;
    }
    let s: LectureSession;
    try {
      s = await LectureSession.start({
        owner: user.id, source: 'upload', title: title.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 200),
        language, slidesText: slides?.text ?? null,
      }, events);
      session.current = s;
      for (const piece of splitAtQuietPoints(samples, SAMPLE_RATE, pieceSettings().limits)) await s.addPiece(piece.samples, piece.start);
      await s.stopRecording();
    } catch (err) {
      console.error(err);
      setError((err as DOMException)?.name === 'QuotaExceededError' ? t.lectures.storageFull : t.lectures.noDeviceStorage);
      if (!session.current) setPhase('setup');
      return;
    }
    await finish();
  };

  // A countdown for the next automatic retry.
  useEffect(() => {
    if (!status.retryAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status.retryAt]);

  const fileInput = useRef<HTMLInputElement>(null);
  const showQueue = status.pending > 0 && (status.blocked != null || phase === 'transcribing');
  const doneShare = duration > 0 ? Math.max(0, Math.min(1, 1 - status.pendingSeconds / duration)) : 0;
  const retryInSec = status.retryAt ? Math.max(0, Math.ceil((status.retryAt - now) / 1000)) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader tool="lectures" back={{ to: '/lectures', label: t.lectures.title }} title={t.lectures.newTitle} />

      <Card className="space-y-5 p-6">
        {/* Where the lecture comes from: three big choices, each with its source's tile. */}
        <div role="radiogroup" aria-label={t.lectures.newTitle} className="grid grid-cols-3 gap-2 sm:gap-3">
          {MODES.map((v) => {
            const on = mode === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={on} disabled={busy && !on}
                onClick={() => { if (!busy) { setMode(v); setError(''); } }}
                className={cn('group relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3.5 text-sm font-semibold transition-[border-color,background-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.98] disabled:opacity-50 sm:flex-row sm:gap-3 sm:px-4 sm:text-base',
                  on ? 'border-brand-500 bg-brand-50 shadow-[var(--shadow-soft)] dark:bg-brand-900/30' : 'border-line bg-surface hover:border-brand-200 dark:hover:border-brand-800')}>
                <LectureThumb source={MODE_SOURCE[v]} className="tool-tile-hover" />
                <span className="min-w-0 truncate">{t.lectures.modes[v]}</span>
                {on && <Check className="absolute end-2 top-2 size-4 text-brand-700 animate-tick dark:text-brand-300" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <Field label={t.lectures.titleLabel}>
          {(id) => <Input id={id} maxLength={200} value={title} placeholder={t.lectures.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} disabled={busy} dir="auto" />}
        </Field>

        {mode !== 'document' && (
          <Field label={t.lectures.language}>
            {(id) => (
              <Select id={id} value={language} disabled={busy} onChange={(e) => setLanguage(e.target.value as LectureLanguage)}>
                {LECTURE_LANGUAGES.map((l) => <option key={l} value={l}>{t.lectures.languages[l]}</option>)}
              </Select>
            )}
          </Field>
        )}

        {phase !== 'recovering' && mode === 'audio' && <SlidesPicker value={slides} onChange={setSlides} />}

        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        {phase === 'recovering' && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.lectures.recovering}</p>}

        {mode === 'audio' && tab === 'record' && (
          <div className="space-y-4 border-t border-line pt-5">
            {phase === 'setup' && (
              <>
                <p className="text-sm text-muted">{t.lectures.recordHint}</p>
                <Button size="lg" block icon={<Mic className="size-5" />} onClick={startRecording}>{t.lectures.start}</Button>
                {/* Or a recording made earlier: an audio or video file. */}
                <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true"><span className="h-px flex-1 bg-line" />{t.common.or}<span className="h-px flex-1 bg-line" /></div>
                <Button size="lg" block variant="secondary" icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>{t.lectures.orUpload}</Button>
                <p className="text-center text-xs text-muted">{t.lectures.uploadHint}</p>
              </>
            )}
            {recordingActive && (
              <div className="space-y-5 text-center">
                <div className="relative overflow-hidden rounded-3xl bg-surface-2 px-4 py-6">
                  <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
                    <span className={cn('size-2.5 rounded-full', phase === 'recording' ? 'animate-pulse bg-rose-500' : 'bg-muted')} aria-hidden="true" />
                    {phase === 'recording' ? t.lectures.recording : t.lectures.paused}
                  </p>
                  <Waveform history={history} paused={phase === 'paused'} />
                </div>
                {phase === 'recording' && hearing(history) !== 'starting' && (
                  <p role="status" className={cn('mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium animate-fade-in',
                    hearing(history) === 'good'
                      ? 'bg-brand-500/12 text-brand-800 dark:text-brand-200'
                      : 'bg-amber-500/15 text-amber-800 dark:text-amber-200')}>
                    <Ear className="size-4" aria-hidden="true" />
                    {hearing(history) === 'good' ? t.lectures.micGood : t.lectures.micQuiet}
                  </p>
                )}
                <p className="text-6xl font-semibold tracking-tight tabular-nums" aria-live="off">{formatTime(elapsed)}</p>
                <div className="flex items-center justify-center gap-6">
                  <button type="button" onClick={() => void discardRecording()} aria-label={t.lectures.discard} title={t.lectures.discard}
                    className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-rose-600 transition-transform duration-150 hover:bg-line active:scale-95 dark:text-rose-400">
                    <Trash2 className="size-6" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={stopRecording} aria-label={t.lectures.stop} title={t.lectures.stop}
                    className="flex size-20 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_10px_30px_-8px_rgb(244_63_94/0.6)] ring-4 ring-rose-500/15 transition-transform duration-150 hover:bg-rose-600 active:scale-95">
                    <Square className="size-7" weight="fill" />
                  </button>
                  <button type="button" onClick={togglePause} aria-label={phase === 'recording' ? t.lectures.pause : t.lectures.resume}
                    title={phase === 'recording' ? t.lectures.pause : t.lectures.resume}
                    className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-fg transition-transform duration-150 hover:bg-line active:scale-95">
                    {phase === 'recording' ? <Pause className="size-6" weight="fill" /> : <Play className="size-6" weight="fill" />}
                  </button>
                </div>
                {/* Mark what matters: it gets extra weight in the notes, quiz and flashcards. */}
                <div className="space-y-1.5">
                  <button type="button" onClick={markNow} aria-describedby="mark-hint"
                    className="pressable mx-auto inline-flex h-11 items-center gap-2 rounded-full bg-accent-400 px-5 font-semibold text-slate-950 shadow-sm hover:bg-accent-300">
                    <Star className="size-5" weight="fill" />{t.lectures.marks.mark}
                    {marks.length > 0 && <span key={marks.length} className="animate-digit rounded-full bg-slate-950/10 px-2 text-sm tabular-nums">{marks.length}</span>}
                  </button>
                  <p id="mark-hint" className="mx-auto max-w-xs text-xs text-muted">{t.lectures.marks.markHint}</p>
                  <p className="min-h-4 text-xs font-medium text-accent-600 dark:text-accent-300" role="status">{markNote}</p>
                </div>
                <div className="space-y-1 text-xs text-muted">
                  <p>{t.lectures.keepOpen}{wakeLockHeld ? ` ${t.lectures.screenOn}` : ''}</p>
                  {native ? <p>{t.lectures.screenOffOk}</p> : coarsePointer() && <p>{t.lectures.backgroundWarning}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'audio' && tab === 'upload' && phase === 'checking' && (
          <p className="flex items-center gap-2 border-t border-line pt-5 text-muted"><Spinner className="size-5" />{t.lectures.checkingFile}</p>
        )}

        {mode === 'audio' && tab === 'upload' && phase === 'preflight' && upload && (
          <div className="space-y-3 border-t border-line pt-5" aria-live="polite">
            <p className="truncate font-medium" dir="auto">{upload.file.name}</p>
            {upload.plan.minutes != null ? (
              <>
                <p className="text-sm">{t.lectures.preflight(upload.plan.minutes, upload.plan.mb)}</p>
                <p className="text-sm text-muted">{t.lectures.preflightCost(upload.plan.units!, upload.plan.etaMinutes!)}</p>
                {upload.plan.long && <p className="text-sm text-muted">{t.lectures.longFileWarning}</p>}
              </>
            ) : <p className="text-sm text-muted">{t.lectures.unknownLength}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" icon={<Upload className="size-5" />} onClick={() => void transcribeFile()}>{t.lectures.transcribeFile}</Button>
              <Button size="lg" variant="secondary" onClick={() => { setUpload(null); setPhase('setup'); fileInput.current?.click(); }}>{t.lectures.chooseAnother}</Button>
            </div>
          </div>
        )}

        {mode === 'audio' && (
          <input ref={fileInput} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setTab('upload'); void onFile(f); e.target.value = ''; }} />
        )}
        {mode === 'audio' && tab === 'upload' && phase === 'setup' && (
          <div className="space-y-3 border-t border-line pt-5">
            <p className="text-sm text-muted">{t.lectures.uploadHint}</p>
            <Button size="lg" block icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>{t.lectures.chooseFile}</Button>
            <Button block variant="ghost" icon={<Mic className="size-4" />} onClick={() => setTab('record')}>{t.lectures.start}</Button>
          </div>
        )}

        {mode === 'youtube' && phase === 'setup' && (
          <YouTubeSource title={title} language={language} onBusy={setSourceBusy}
            onDone={(id) => { leaving.current = true; navigate(`/lectures/${id}`, { replace: true }); }} />
        )}

        {mode === 'document' && phase === 'setup' && (
          <DocumentSource title={title} language={language} onBusy={setSourceBusy} slides={slides} onSlides={setSlides}
            onDone={(id) => { leaving.current = true; navigate(`/lectures/${id}`, { replace: true }); }} />
        )}

        {phase === 'decoding' && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.lectures.decoding}</p>}

        {phase === 'transcribing' && !status.blocked && !finalizeFailed && (
          <div className="space-y-2" aria-live="polite">
            <p className="flex items-center gap-2 text-muted">
              <Spinner className="size-5" />{t.lectures.progress(minutes(status.pendingSeconds))}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${doneShare * 100}%` }} />
            </div>
          </div>
        )}
        {phase === 'finishing' && mode === 'audio' && (
          <p className="flex items-center gap-2 text-muted" aria-live="polite"><Spinner className="size-5" />{t.lectures.finishing}</p>
        )}

        {showQueue && status.blocked && (
          <Alert tone={status.blocked === 'offline' ? 'info' : 'error'}>
            <p className="font-semibold">{t.lectures.pending(minutes(status.pendingSeconds))}</p>
            <p className="mt-1">{t.lectures.blocked[status.blocked]}</p>
            <p className="mt-1 opacity-80">{t.lectures.savedOnDevice}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" icon={<RefreshCw className="size-4" />} onClick={() => session.current?.queue.retryNow()}>{t.lectures.retry}</Button>
              {phase === 'transcribing' && <Button size="sm" variant="secondary" onClick={finishLater}>{t.lectures.finishLater}</Button>}
              {retryInSec != null && <span className="text-xs opacity-80">{t.lectures.retryIn(retryInSec)}</span>}
            </div>
          </Alert>
        )}

        {finalizeFailed && phase === 'transcribing' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<RefreshCw className="size-4" />} onClick={() => void finalize()}>{t.lectures.retry}</Button>
            <Button size="sm" variant="secondary" onClick={finishLater}>{t.lectures.finishLater}</Button>
          </div>
        )}
      </Card>

      {mode === 'audio' && (recordingActive || phase === 'transcribing' || live.length > 0) && (
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{t.lectures.liveTranscript}</h2>
          {live.length === 0
            ? <p className="text-sm text-muted">{t.lectures.waitingFirst}</p>
            : live.map((s) => (
              <div key={s.start} className="flex gap-3">
                <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted">{formatTime(s.start)}</span>
                <Rich text={s.text} className="min-w-0 flex-1 text-sm" />
              </div>
            ))}
        </Card>
      )}

      {askKeep && <KeepRecordingDialog seconds={askKeep.seconds} bytes={askKeep.bytes} onChoose={(keep) => void chooseKeep(keep)} />}
    </div>
  );
}
