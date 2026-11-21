import { useEffect, useRef } from 'react';
import { Mic, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { IconTile } from '@/ui/IconTile';
import { formatTime } from './audio';

interface Props {
  /** Seconds recorded. */
  seconds: number;
  bytes: number;
  onChoose: (keep: boolean) => void;
}

export const megabytes = (bytes: number) => Math.max(0.1, Math.round(bytes / 104_857.6) / 10);

/** Asked right after recording stops: keep the audio with the lecture, or delete it. Transcription carries on behind it. */
export const KeepRecordingDialog = ({ seconds, bytes, onChoose }: Props) => {
  const t = useT();
  const tk = t.lectures.keepRecording;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    return () => dialog?.close?.();
  }, []);

  return (
    // Escape doesn't close it: the student has to pick one.
    <dialog ref={ref} aria-labelledby="keep-recording-title" aria-describedby="keep-recording-body" onCancel={(e) => e.preventDefault()}
      // A sheet from the bottom on phones, a card in the middle on bigger screens.
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-surface p-0 text-fg shadow-[var(--shadow-lift)] animate-pop-in backdrop:animate-fade-in backdrop:bg-black/40 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:animate-sheet-up">
      <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
      <div className="space-y-4 p-6 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <IconTile icon={Mic} tint="from-rose-500 to-rose-700" size="sm" />
          <h2 id="keep-recording-title" className="text-lg font-semibold">{tk.title}</h2>
        </div>
        <div id="keep-recording-body" className="space-y-2 text-sm text-muted">
          <p>{tk.body}</p>
          <p className="tabular-nums">{tk.size(formatTime(seconds), megabytes(bytes))}</p>
          <p>{tk.either}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" icon={<Trash2 className="size-4" />} onClick={() => onChoose(false)}>{tk.delete}</Button>
          <Button icon={<Mic className="size-4" />} onClick={() => onChoose(true)} autoFocus>{tk.keep}</Button>
        </div>
      </div>
    </dialog>
  );
};
