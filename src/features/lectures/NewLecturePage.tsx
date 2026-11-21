import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useSearchParams } from 'react-router';
import { Mic, Pause, Play, RefreshCw, Square, Upload } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAiError } from '@/lib/useAiError';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Textarea } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { BackLink } from '@/features/learn/CoursePage';
import {
  BYTES_PER_MINUTE, LECTURE_LANGUAGES, LECTURE_SOURCES, MAX_TRANSCRIPT_CHARS, type LectureLanguage, type LectureSource, type Segment,
} from '@shared/lectures';
import { DEFAULT_LIMITS, LiveRecorder, SAMPLE_RATE, decodeFile, formatTime, splitAtQuietPoints, type PieceLimits } from './audio';
import { audioStore, checkStorage } from './audioStore';
import { LectureSession } from './session';
import type { QueueStatus } from './transcriber';
import { lectureRepo } from './repo';
import { SlidesPicker, type Slides } from './SlidesPicker';
import { useKeepAwake } from './useKeepAwake';
import { PdfSource } from './PdfSource';
import { PhotoSource } from './PhotoSource';
import { scheduleRepo } from '@/features/schedule/scheduleRepo';
import { classLectureTitle } from '@shared/schedule';
import { notifyIfAway } from '@/features/schedule/notify';
import { NativeRecorder, nativeRecorderAvailable, recoverNative } from './nativeRecorder';
import { inBrowserMaxMinutes, planUpload, probeDuration, type UploadPlan } from './preflight';

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
  // ?tab=upload (or pdf, image, text) opens that way of adding a lecture, e.g. from Home's quick actions.
  const [tab, setTab] = useState<LectureSource>(() => (LECTURE_SOURCES as readonly string[]).includes(params.get('tab') ?? '') ? params.get('tab') as LectureSource : 'record');
  const [title, setTitle] = useState('');
  // The student's usual lecture language (from onboarding or Settings).
  const [language, setLanguage] = useState<LectureLanguage>(profile?.lecture_language ?? 'auto');
  const [slides, setSlides] = useState<Slides | null>(null);
  const [text, setText] = useState('');
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
    guarded && !leaving.current && currentLocation.pathname !== nextLocation.pathname && !window.confirm(t.lectures.leaveWarning));
  useEffect(() => { if (blocker.state === 'blocked') blocker.reset(); }, [blocker]);

  useEffect(() => {
    if (!guarded || phase === 'finishing') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [guarded, phase]);

  // Leaving the page keeps the draft on this device; it can be recovered later.
  useEffect(() => () => {
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
      navigate(`/lectures/${id}`, { replace: true });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setFinalizeFailed(true);
      setPhase('transcribing');
    }
  }, [navigate, t, toMessage]);

  /** Wait for every saved piece to be transcribed, then save the lecture. */
  const finish = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    setPhase('transcribing');
    setDuration(s.draft.duration);
    await s.queue.idle();
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
      setStatus(s.status);
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
    setPhase('recording');
  };

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

  const togglePause = async () => {
    if (phase === 'recording') { await recorder.current?.pause(); setPhase('paused'); setLevel(0); }
    else { await recorder.current?.resume(); setPhase('recording'); }
  };

  const stopRecording = async () => {
    const rec = recorder.current;
    const s = session.current;
    if (!rec || !s) return;
    recorder.current = null;
    await rec.stop(); // emits the last piece
    await write(() => s.stopRecording()).catch(() => {});
    setLevel(0);
    await finish();
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

  // ── Paste ──
  const createFromText = async () => {
    const body = text.trim();
    if (body.length < 80) { setError(t.lectures.textTooShort); return; }
    setError('');
    setPhase('finishing');
    try {
      const lecture = await lectureRepo.create({
        title: title.trim(), source: 'text', language, slides_text: slides?.text ?? null,
        segments: [{ start: 0, text: body.slice(0, MAX_TRANSCRIPT_CHARS) }], status: 'ready',
      });
      leaving.current = true;
      navigate(`/lectures/${lecture.id}`, { replace: true });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setPhase('setup');
    }
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
      <BackLink to="/lectures" label={t.lectures.title} />
      <h1 className="text-3xl font-semibold tracking-tight">{t.lectures.newTitle}</h1>

      <Card className="space-y-5 p-6">
        <div className="-mx-6 overflow-x-auto px-6">
          <Segmented scroll label={t.lectures.newTitle} value={tab} onChange={(v) => { if (!busy) { setTab(v); setError(''); } }}
            options={(['record', 'upload', 'text', 'pdf', 'image'] as const).map((v) => ({ value: v, label: t.lectures.tabs[v] }))} />
        </div>

        <Field label={t.lectures.titleLabel}>
          {(id) => <Input id={id} maxLength={200} value={title} placeholder={t.lectures.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} disabled={busy} dir="auto" />}
        </Field>

        {tab !== 'text' && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t.lectures.language}</p>
            <Segmented label={t.lectures.language} value={language} onChange={(v) => { if (!busy) setLanguage(v); }}
              options={LECTURE_LANGUAGES.map((l) => ({ value: l, label: t.lectures.languages[l] }))} />
          </div>
        )}

        {phase !== 'recovering' && (tab === 'record' || tab === 'upload' || tab === 'text') && <SlidesPicker value={slides} onChange={setSlides} />}

        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        {phase === 'recovering' && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.lectures.recovering}</p>}

        {tab === 'record' && (
          <div className="space-y-4 border-t border-line pt-5">
            {phase === 'setup' && (
              <>
                <p className="text-sm text-muted">{t.lectures.recordHint}</p>
                <Button size="lg" block icon={<Mic className="size-5" />} onClick={startRecording}>{t.lectures.start}</Button>
              </>
            )}
            {recordingActive && (
              <div className="space-y-4 text-center">
                <p className="flex items-center justify-center gap-2 text-sm font-medium">
                  <span className={cn('size-2.5 rounded-full', phase === 'recording' ? 'animate-pulse bg-rose-500' : 'bg-muted')} aria-hidden="true" />
                  {phase === 'recording' ? t.lectures.recording : t.lectures.paused}
                </p>
                <p className="text-5xl font-semibold tabular-nums" aria-live="off">{formatTime(elapsed)}</p>
                <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand-500 transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:mx-auto sm:max-w-sm">
                  <Button size="lg" variant="secondary" icon={phase === 'recording' ? <Pause className="size-5" /> : <Play className="size-5" />} onClick={togglePause}>
                    {phase === 'recording' ? t.lectures.pause : t.lectures.resume}
                  </Button>
                  <Button size="lg" variant="danger" icon={<Square className="size-5" />} onClick={stopRecording}>{t.lectures.stop}</Button>
                </div>
                <div className="space-y-1 text-xs text-muted">
                  <p>{t.lectures.keepOpen}{wakeLockHeld ? ` ${t.lectures.screenOn}` : ''}</p>
                  {native ? <p>{t.lectures.screenOffOk}</p> : coarsePointer() && <p>{t.lectures.backgroundWarning}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && phase === 'checking' && (
          <p className="flex items-center gap-2 border-t border-line pt-5 text-muted"><Spinner className="size-5" />{t.lectures.checkingFile}</p>
        )}

        {tab === 'upload' && phase === 'preflight' && upload && (
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

        {tab === 'upload' && (
          <input ref={fileInput} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        )}
        {tab === 'upload' && phase === 'setup' && (
          <div className="space-y-3 border-t border-line pt-5">
            <p className="text-sm text-muted">{t.lectures.uploadHint}</p>
            <Button size="lg" block icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>{t.lectures.chooseFile}</Button>
          </div>
        )}

        {(tab === 'pdf' || tab === 'image') && phase === 'setup' && (() => {
          const Source = tab === 'pdf' ? PdfSource : PhotoSource;
          return <Source key={tab} title={title} language={language} onBusy={setSourceBusy}
            onDone={(id) => { leaving.current = true; navigate(`/lectures/${id}`, { replace: true }); }} />;
        })()}

        {tab === 'text' && (
          <div className="space-y-3 border-t border-line pt-5">
            <p className="text-sm text-muted">{t.lectures.textHint}</p>
            <Textarea aria-label={t.lectures.textPlaceholder} placeholder={t.lectures.textPlaceholder} rows={10} dir="auto"
              value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TRANSCRIPT_CHARS} disabled={busy} />
            <Button size="lg" block loading={phase === 'finishing'} onClick={createFromText}>{t.lectures.create}</Button>
          </div>
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
        {phase === 'finishing' && tab !== 'text' && (
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

      {tab !== 'text' && (recordingActive || phase === 'transcribing' || live.length > 0) && (
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
    </div>
  );
}
