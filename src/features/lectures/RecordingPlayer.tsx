import { useEffect, useState, type RefObject } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Spinner } from '@/ui/Spinner';
import { formatTime } from './audio';
import { recordingRepo, type KeptAudio } from './recording';

export const recordingExtension = (type?: string | null) => (type?.includes('mp4') ? 'm4a' : type?.includes('ogg') ? 'ogg' : 'webm');
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const SKIP = 15;

/**
 * Recordings made by the browser often don't say how long they are, which
 * breaks seeking. Jumping far ahead makes the browser work it out.
 */
const learnDuration = (audio: HTMLAudioElement) => {
  if (audio.duration !== Infinity) return;
  const back = () => { audio.removeEventListener('timeupdate', back); audio.currentTime = 0; };
  audio.addEventListener('timeupdate', back);
  audio.currentTime = 1e101;
};

/** A link the recording can be played (and downloaded) from; blob links are freed after. */
export const useRecordingUrl = (lecture: KeptAudio) => {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const { id, audio_path: path } = lecture;
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    setUrl(undefined);
    recordingRepo.url({ id, audio_path: path }).then((u) => {
      if (u?.startsWith('blob:')) made = u;
      if (cancelled) { if (made) URL.revokeObjectURL(made); return; }
      setUrl(u);
    }).catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [id, path]);
  return url;
};

interface Props {
  url: string | null | undefined;
  audioRef: RefObject<HTMLAudioElement | null>;
  /** Recorded length, for before the browser knows it. */
  fallbackDuration: number;
}

/** The kept recording: seek bar, back and forward 15 s, play and speed. Times in the transcript play it from there. */
export const RecordingPlayer = ({ url, audioRef, fallbackDuration }: Props) => {
  const t = useT();
  const tk = t.lectures.keepRecording;
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const total = Number.isFinite(duration) && duration > 0 ? duration : fallbackDuration;

  const audio = () => audioRef.current;
  const skip = (by: number) => { const a = audio(); if (a) a.currentTime = Math.max(0, Math.min(total, a.currentTime + by)); };
  const toggle = () => { const a = audio(); if (!a) return; if (a.paused) void a.play().catch(() => {}); else a.pause(); };
  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    if (audio()) audio()!.playbackRate = s;
  };

  return (
    <section aria-label={tk.player} className="space-y-1.5">
      {url && (
        // The transcript is the text of the recording.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={url} preload="metadata" className="hidden"
          onLoadedMetadata={(e) => { learnDuration(e.currentTarget); setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = speed; }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime > total + 1 ? 0 : e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      )}
      {url === undefined && <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted"><Spinner className="size-4" />{t.common.loading}</p>}
      {url === null && <p className="py-3 text-center text-sm text-muted">{tk.unavailable}</p>}
      {url && (
        <>
          <div className="flex items-center gap-3 text-xs tabular-nums text-muted" dir="ltr">
            <span className="w-10">{formatTime(time)}</span>
            <input type="range" min={0} max={Math.max(1, total)} step={0.1} value={Math.min(time, total)} aria-label={tk.seek}
              aria-valuetext={`${formatTime(time)} / ${formatTime(total)}`}
              onChange={(e) => { const a = audio(); if (a) a.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-brand-600"
              style={{ background: `linear-gradient(to right, var(--color-brand-500) ${(Math.min(time, total) / Math.max(1, total)) * 100}%, var(--line) 0)`, borderRadius: 999, appearance: 'none' }} />
            <span className="w-10 text-end">{formatTime(total)}</span>
          </div>
          <div className="flex items-center justify-between" dir="ltr">
            <button type="button" onClick={nextSpeed} aria-label={tk.speed(speed)} className="h-10 w-14 rounded-full text-sm font-semibold tabular-nums text-muted hover:bg-surface-2 hover:text-fg">
              {speed % 1 ? speed : speed.toFixed(1)}×
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => skip(-SKIP)} aria-label={tk.back(SKIP)} className="relative flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2 active:scale-95">
                <RotateCcw className="size-6" aria-hidden="true" /><span className="absolute text-[9px] font-bold" aria-hidden="true">{SKIP}</span>
              </button>
              <button type="button" onClick={toggle} aria-label={playing ? tk.pause : tk.play}
                className={cn('flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_20px_-8px_var(--color-brand-600)] transition-transform duration-150 hover:bg-brand-700 active:scale-95')}>
                {playing ? <Pause className="size-6 fill-current" aria-hidden="true" /> : <Play className="size-6 translate-x-0.5 fill-current" aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => skip(SKIP)} aria-label={tk.forward(SKIP)} className="relative flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2 active:scale-95">
                <RotateCw className="size-6" aria-hidden="true" /><span className="absolute text-[9px] font-bold" aria-hidden="true">{SKIP}</span>
              </button>
            </div>
            <span className="w-14" aria-hidden="true" />
          </div>
        </>
      )}
    </section>
  );
};
