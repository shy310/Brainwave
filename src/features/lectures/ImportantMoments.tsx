import { Play, Star } from 'lucide-react';
import { useT } from '@/i18n';
import { Card } from '@/ui/Card';
import { markSegment } from '@shared/marks';
import type { Segment } from '@shared/lectures';
import { formatTime } from './audio';

/** The moments the student marked while recording, each with what was said and a way to hear it again. */
export const ImportantMoments = ({ marks, segments, onPlay, onShow }: {
  marks: number[]; segments: Segment[]; onPlay?: (start: number) => void; onShow: (segmentStart: number) => void;
}) => {
  const t = useT();
  const tm = t.lectures.marks;
  if (!marks.length || !segments.length) return null;
  return (
    <Card className="space-y-3 border-accent-300/70 bg-accent-300/10 p-4 dark:border-accent-500/30 dark:bg-accent-500/5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Star className="size-4 fill-accent-400 text-accent-500" aria-hidden="true" />{tm.title}</h2>
        <p className="mt-0.5 text-sm text-muted">{tm.body}</p>
      </div>
      <ol className="space-y-2">
        {marks.map((m) => {
          const seg = segments[markSegment(segments, m)];
          return (
            <li key={m} className="flex gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-soft)]">
              {onPlay ? (
                <button type="button" onClick={() => onPlay(Math.max(0, m - 20))} aria-label={tm.play(formatTime(m))}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-accent-400 px-2 text-xs font-semibold tabular-nums text-slate-950 hover:bg-accent-300">
                  <Play className="size-3 fill-current" aria-hidden="true" />{formatTime(m)}
                </button>
              ) : <span className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-accent-600 dark:text-accent-300">{formatTime(m)}</span>}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-3 text-sm" dir="auto">{seg.text}</p>
                <button type="button" onClick={() => onShow(seg.start)} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">{tm.showInTranscript}</button>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};
