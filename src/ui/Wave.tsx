import { cn } from '@/lib/cn';

/**
 * The brainwave: BrainWave's signature line (the logo's waveform, the
 * mascot's forehead). One rounded sine stroke, used sparingly: a coloured
 * field's lower edge, a connector between steps, a loader. Decorative.
 */

/** A sine path from x=0 to `width`, `waves` full periods, around y=`mid`. */
export const sinePath = (width: number, waves: number, amp: number, mid: number) => {
  const step = width / (waves * 2);
  let d = `M0 ${mid}`;
  for (let i = 0; i < waves * 2; i++) d += ` q${step / 2} ${i % 2 ? amp * 2 : -amp * 2} ${step} 0`;
  return d;
};

/** The lower edge of a coloured field: the field ends in a gentle wave instead of a straight line. */
export const WaveEdge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className={cn('pointer-events-none block h-10 w-full sm:h-16', className)} aria-hidden="true">
    <path d="M0 64 V30 C180 -6 360 66 540 30 S900 -6 1080 30 S1300 60 1440 26 V64 Z" fill="currentColor" />
  </svg>
);

/** A drawn brainwave line; `draw` animates it in once (respecting reduced motion). */
export const WaveLine = ({ width = 320, waves = 4, amp = 8, stroke = 4, draw, className }: {
  width?: number; waves?: number; amp?: number; stroke?: number; draw?: boolean; className?: string;
}) => (
  <svg viewBox={`0 0 ${width} ${amp * 2 + stroke * 2}`} className={cn('overflow-visible', className)} aria-hidden="true">
    <path d={sinePath(width, waves, amp, amp + stroke)} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
      pathLength={1} className={draw ? 'wave-draw' : undefined} />
  </svg>
);

/** A small loader: a brainwave travelling along. Use where something is being prepared. */
export const WaveLoader = ({ className, label }: { className?: string; label?: string }) => (
  <span role={label ? 'status' : undefined} aria-label={label} className={cn('inline-block h-4 w-12 overflow-hidden text-brand-700 dark:text-brand-300', className)}>
    <svg viewBox="0 0 96 16" className="wave-loader h-full w-[200%]" aria-hidden="true">
      <path d={sinePath(96, 4, 5, 8)} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  </span>
);

/** A page or section that is still loading: the brainwave travels beside the words. */
export const Loading = ({ label, className }: { label: string; className?: string }) => (
  <p role="status" className={cn('flex items-center gap-3 py-2 text-sm font-medium text-muted', className)}>
    <WaveLoader />{label}
  </p>
);
