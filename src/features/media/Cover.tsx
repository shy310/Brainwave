import { Play } from '@/ui/icons';
import { cn } from '@/lib/cn';
import { sinePath } from '@/ui/Wave';
import type { MediaKind } from '@shared/media';

/** A stable number from a string, so each video or episode keeps the same cover. */
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// Three shades per kind, all carrying white (AA). Videos are coral, podcasts purple.
const FIELDS: Record<MediaKind, string[]> = {
  video: ['linear-gradient(135deg,#c43c2a,#9e2f21)', 'linear-gradient(135deg,#b4371f,#7f2a1c)', 'linear-gradient(150deg,#c43c2a,#6a2cd4)'],
  podcast: ['linear-gradient(135deg,#7c3aed,#5524a8)', 'linear-gradient(135deg,#6a2cd4,#3f1d7a)', 'linear-gradient(150deg,#7c3aed,#263cb0)'],
};

/**
 * Generated cover art for a video lesson (16:9, a play mark on a coral field)
 * or a podcast episode (square, sound bars on a purple field). The pattern is
 * chosen from the id, so covers differ but never change. Decorative.
 */
export const Cover = ({ kind, seed, className }: { kind: MediaKind; seed: string; className?: string }) => {
  const h = hash(seed);
  const field = FIELDS[kind][h % 3];
  const flip = (h >>> 3) % 2 === 1;
  const bars = Array.from({ length: 9 }, (_, i) => 10 + ((h >>> ((i * 3) % 24)) % 26));
  return (
    <div className={cn('relative overflow-hidden text-white', kind === 'video' ? 'aspect-video' : 'aspect-square', className)} style={{ background: field }} aria-hidden="true">
      {kind === 'podcast' ? (
        // Square: a row of sound bars across the middle, the tallest one bright.
        <svg viewBox="0 0 100 100" className={cn('absolute inset-0 size-full', flip && '-scale-x-100')}>
          <circle cx={82} cy={14} r={30} fill="#fff" fillOpacity={0.08} />
          <circle cx={10} cy={96} r={22} fill="#fff" fillOpacity={0.06} />
          {bars.map((b, i) => <rect key={i} x={16 + i * 8} y={52 - b * 0.7} width={4.5} height={b * 1.4} rx={2.25} fill={i === 4 ? '#ffcb45' : '#fff'} fillOpacity={i === 4 ? 1 : 0.55} />)}
        </svg>
      ) : (
        <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className={cn('absolute inset-0 size-full', flip && '-scale-x-100')}>
          <circle cx={128} cy={14} r={34} fill="#fff" fillOpacity={0.08} />
          <circle cx={18} cy={86} r={22} fill="#fff" fillOpacity={0.06} />
          <path d={sinePath(160, 2, 5, 74)} fill="none" stroke="#ffcb45" strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      )}
      {kind === 'video' && (
        <span className="absolute start-1/2 top-[42%] flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-coral-600 shadow-[0_8px_20px_-8px_rgb(23_35_68/0.6)] transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-110 rtl:translate-x-1/2">
          <Play className="ms-0.5 size-5" weight="fill" />
        </span>
      )}
    </div>
  );
};
