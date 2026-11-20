import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router';
import { Mic, Pause, Play, Square, Upload } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAiError } from '@/lib/useAiError';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Textarea } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { LECTURE_LANGUAGES, MAX_TRANSCRIPT_CHARS, type LectureLanguage, type LectureSource, type Segment } from '@shared/lectures';
import { LiveRecorder, SAMPLE_RATE, decodeFile, formatTime, splitIntoChunks } from './audio';
import { Transcriber, type Piece } from './transcriber';
import { lectureRepo } from './repo';
import { SlidesPicker, type Slides } from './SlidesPicker';

type Phase = 'setup' | 'recording' | 'paused' | 'decoding' | 'transcribing' | 'review' | 'finishing';
const MAX_FILE_BYTES = 500 * 1024 * 1024;

export default function NewLecturePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const [tab, setTab] = useState<LectureSource>('record');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<LectureLanguage>('auto');
  const [slides, setSlides] = useState<Slides | null>(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [live, setLive] = useState<Segment[]>([]);

  const lectureId = useRef<string | null>(null);
  const segments = useRef(new Map<number, Segment>());
  const failed = useRef<Piece[]>([]);
  const transcriber = useRef<Transcriber | null>(null);
  const recorder = useRef<LiveRecorder | null>(null);
  const duration = useRef(0);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const pieceIndex = useRef(0);

  const busy = phase !== 'setup';
  const leaving = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    busy && !leaving.current && currentLocation.pathname !== nextLocation.pathname && !window.confirm(t.lectures.leaveWarning));
  useEffect(() => { if (blocker.state === 'blocked') blocker.reset(); }, [blocker]);

  useEffect(() => {
    if (!busy || phase === 'finishing') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, phase]);

  useEffect(() => () => {
    transcriber.current?.stop();
    void recorder.current?.stop();
    void wakeLock.current?.release().catch(() => {});
  }, []);

  // Slides can finish reading after the lecture was created.
  useEffect(() => {
    if (lectureId.current && slides) void lectureRepo.update(lectureId.current, { slides_text: slides.text });
  }, [slides]);

  const ordered = () => [...segments.current.values()].sort((a, b) => a.start - b.start);

  const save = useCallback(() => {
    if (!lectureId.current) return;
    void lectureRepo.update(lectureId.current, { segments: ordered(), duration_sec: Math.round(duration.current) })
      .catch((err) => console.error('Could not save progress', err));
  }, []);

  const makeTranscriber = () => new Transcriber({
    language,
    topic: title.trim() || undefined,
    onPiece: (piece, pieceText, didFail) => {
      if (didFail) { failed.current.push(piece); setFailedCount(failed.current.length); }
      else if (pieceText) segments.current.set(piece.index, { start: piece.start, text: pieceText });
      setDone((d) => d + 1);
      setLive(ordered());
      save();
    },
  });

  const create = async (source: LectureSource, extra: Partial<Parameters<typeof lectureRepo.create>[0]> = {}) => {
    const lecture = await lectureRepo.create({ title: title.trim(), source, language, slides_text: slides?.text ?? null, ...extra });
    lectureId.current = lecture.id;
    return lecture;
  };

  const finalize = async () => {
    setPhase('finishing');
    try {
      await lectureRepo.update(lectureId.current!, { segments: ordered(), status: 'ready', duration_sec: Math.round(duration.current) });
      leaving.current = true;
      navigate(`/lectures/${lectureId.current}`, { replace: true });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setPhase('review');
    }
  };

  const finish = async () => {
    setPhase('transcribing');
    await transcriber.current?.idle();
    const fatal = transcriber.current?.fatal;
    if (fatal) setError(toMessage(fatal));
    if (failed.current.length) setPhase('review');
    else await finalize();
  };

  const retryFailed = async () => {
    const pieces = failed.current.splice(0);
    setFailedCount(0);
    setError('');
    setDone((d) => d - pieces.length);
    transcriber.current = makeTranscriber();
    pieces.forEach((p) => transcriber.current!.add(p));
    await finish();
  };

  // ── Record ──
  const startRecording = async () => {
    setError('');
    const rec = new LiveRecorder({
      onChunk: (samples, start) => {
        const index = pieceIndex.current++;
        duration.current = start + samples.length / SAMPLE_RATE;
        setTotal((n) => n + 1);
        transcriber.current?.add({ index, start, samples });
      },
      onLevel: setLevel,
    });
    try {
      await rec.start();
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(name === 'NotAllowedError' ? t.lectures.micDenied : name === 'NotFoundError' ? t.lectures.micMissing : t.auth.errors.generic);
      return;
    }
    try {
      await create('record');
    } catch (err) {
      await rec.stop();
      setError(toMessage(err) || t.auth.errors.generic);
      return;
    }
    recorder.current = rec;
    transcriber.current = makeTranscriber();
    setPhase('recording');
    wakeLock.current = await navigator.wakeLock?.request('screen').catch(() => null) ?? null;
  };

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setElapsed(recorder.current?.elapsed ?? 0), 500);
    return () => clearInterval(id);
  }, [phase]);

  const togglePause = async () => {
    if (phase === 'recording') { await recorder.current?.pause(); setPhase('paused'); setLevel(0); }
    else { await recorder.current?.resume(); setPhase('recording'); }
  };

  const stopRecording = async () => {
    await recorder.current?.stop();
    duration.current = Math.max(duration.current, recorder.current?.elapsed ?? 0);
    recorder.current = null;
    void wakeLock.current?.release().catch(() => {});
    setLevel(0);
    await finish();
  };

  // ── Upload ──
  const onFile = async (file?: File) => {
    if (!file) return;
    setError('');
    if (file.size > MAX_FILE_BYTES) { setError(t.lectures.fileTooBig); return; }
    setPhase('decoding');
    let samples: Float32Array;
    try {
      samples = await decodeFile(file);
    } catch {
      setError(t.lectures.decodeFailed);
      setPhase('setup');
      return;
    }
    try {
      await create('upload', { title: title.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 200) });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setPhase('setup');
      return;
    }
    duration.current = samples.length / SAMPLE_RATE;
    const pieces = splitIntoChunks(samples);
    setTotal(pieces.length);
    transcriber.current = makeTranscriber();
    pieces.forEach((p, i) => transcriber.current!.add({ index: i, start: i * 60, samples: p }));
    await finish();
  };

  // ── Paste ──
  const createFromText = async () => {
    const body = text.trim();
    if (body.length < 80) { setError(t.lectures.textTooShort); return; }
    setError('');
    setPhase('finishing');
    try {
      const lecture = await create('text', { segments: [{ start: 0, text: body.slice(0, MAX_TRANSCRIPT_CHARS) }], status: 'ready' });
      leaving.current = true;
      navigate(`/lectures/${lecture.id}`, { replace: true });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setPhase('setup');
    }
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const recordingActive = phase === 'recording' || phase === 'paused';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />
      <h1 className="text-3xl font-semibold tracking-tight">{t.lectures.newTitle}</h1>

      <Card className="space-y-5 p-6">
        <Segmented label={t.lectures.newTitle} value={tab} onChange={(v) => { if (!busy) { setTab(v); setError(''); } }}
          options={(['record', 'upload', 'text'] as const).map((v) => ({ value: v, label: t.lectures.tabs[v] }))} />

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

        <SlidesPicker value={slides} onChange={setSlides} />

        {error && <Alert tone="error">{error}</Alert>}

        {tab === 'record' && (
          <div className="space-y-4 border-t border-line pt-5">
            {!recordingActive && phase === 'setup' && (
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
                <div className="flex justify-center gap-2">
                  <Button variant="secondary" icon={phase === 'recording' ? <Pause className="size-4" /> : <Play className="size-4" />} onClick={togglePause}>
                    {phase === 'recording' ? t.lectures.pause : t.lectures.resume}
                  </Button>
                  <Button variant="danger" icon={<Square className="size-4" />} onClick={stopRecording}>{t.lectures.stop}</Button>
                </div>
                <p className="text-xs text-muted">{t.lectures.keepOpen}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && phase === 'setup' && (
          <div className="space-y-3 border-t border-line pt-5">
            <p className="text-sm text-muted">{t.lectures.uploadHint}</p>
            <input ref={fileInput} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="lg" block icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>{t.lectures.chooseFile}</Button>
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-3 border-t border-line pt-5">
            <p className="text-sm text-muted">{t.lectures.textHint}</p>
            <Textarea aria-label={t.lectures.textPlaceholder} placeholder={t.lectures.textPlaceholder} rows={10} dir="auto"
              value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TRANSCRIPT_CHARS} disabled={busy} />
            <Button size="lg" block loading={phase === 'finishing'} onClick={createFromText}>{t.lectures.create}</Button>
          </div>
        )}

        {phase === 'decoding' && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.lectures.decoding}</p>}

        {(phase === 'transcribing' || (tab !== 'text' && phase === 'finishing')) && (
          <div className="space-y-2" aria-live="polite">
            <p className="flex items-center gap-2 text-muted">
              <Spinner className="size-5" />{phase === 'finishing' ? t.lectures.finishing : t.lectures.progress(Math.min(done, total), total)}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {phase === 'review' && (
          <Alert tone="error">
            <p>{t.lectures.failedPieces(failedCount)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={retryFailed}>{t.lectures.retryFailed}</Button>
              <Button size="sm" variant="secondary" onClick={finalize}>{t.lectures.continueAnyway}</Button>
            </div>
          </Alert>
        )}
      </Card>

      {tab === 'record' && (recordingActive || phase === 'transcribing') && (
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
