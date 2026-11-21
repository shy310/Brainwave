import { useEffect, useState, type RefObject } from 'react';
import { Download, Mic, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { megabytes } from './KeepRecordingDialog';
import { recordingRepo, type KeptAudio } from './recording';

const extension = (type?: string | null) => (type?.includes('mp4') ? 'm4a' : type?.includes('ogg') ? 'ogg' : 'webm');

/**
 * Recordings made by the browser often don't say how long they are, which
 * breaks the seek bar. Jumping far ahead makes the browser work it out.
 */
const learnDuration = (audio: HTMLAudioElement) => {
  if (audio.duration !== Infinity) return;
  const back = () => { audio.removeEventListener('timeupdate', back); audio.currentTime = 0; };
  audio.addEventListener('timeupdate', back);
  audio.currentTime = 1e101;
};

interface Props {
  lecture: KeptAudio;
  fileName: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  onDeleted: () => void;
}

/** The kept recording of a lecture, above its transcript. Tap a time in the transcript to play from there. */
export const RecordingPlayer = ({ lecture, fileName, audioRef, onDeleted }: Props) => {
  const t = useT();
  const tk = t.lectures.keepRecording;
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);

  const { id, audio_path: path } = lecture;
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    recordingRepo.url({ id, audio_path: path }).then((u) => {
      if (u?.startsWith('blob:')) made = u;
      if (!cancelled) setUrl(u);
    }).catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [id, path]);

  const remove = async () => {
    if (!window.confirm(tk.confirmDelete)) return;
    setDeleting(true);
    try {
      audioRef.current?.pause();
      await recordingRepo.remove(lecture);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-label={tk.player} className="sticky top-[4.5rem] z-20 space-y-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Mic className="size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{tk.player}</p>
        {lecture.audio_bytes ? <span className="text-xs tabular-nums text-muted">{tk.mb(megabytes(lecture.audio_bytes))}</span> : null}
        {url && (
          <a href={url} download={`${fileName}.${extension(lecture.audio_type)}`} aria-label={tk.download} title={tk.download}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
            <Download className="size-4" aria-hidden="true" />
          </a>
        )}
        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={tk.deleteRecording} title={tk.deleteRecording} loading={deleting} onClick={() => void remove()}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {url === undefined && <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" />{t.common.loading}</p>}
      {url === null && <p className="text-sm text-muted">{tk.unavailable}</p>}
      {url && (
        // Recordings have no captions: the transcript below is the text.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={url} controls preload="metadata" className="h-10 w-full" onLoadedMetadata={(e) => learnDuration(e.currentTarget)} />
      )}
    </section>
  );
};
