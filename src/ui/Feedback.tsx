import { Star } from '@/ui/icons';
import { cn } from '@/lib/cn';

/** A check mark that draws itself in, for a right answer. */
export const DrawCheck = ({ className }: { className?: string }) => (
  <span className={cn('draw-check inline-flex', className)} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-full overflow-visible">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  </span>
);

// Six dots flying out evenly around the star.
const DOTS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { px: `${Math.round(Math.cos(a) * 13)}px`, py: `${Math.round(Math.sin(a) * 13)}px`, pd: `${i % 2 ? 40 : 0}ms` };
});

/** A filled star that pops in with a little burst the moment it appears (when a lecture is starred). */
export const StarBurst = ({ label, className }: { label: string; className?: string }) => (
  <span className={cn('relative inline-flex shrink-0 text-accent-500', className)} role="img" aria-label={label}>
    <Star className="star-pop size-4" weight="fill" />
    <span className="star-burst" aria-hidden="true">
      {DOTS.map((d, i) => <i key={i} style={{ '--px': d.px, '--py': d.py, '--pd': d.pd } as React.CSSProperties} />)}
    </span>
  </span>
);

/** Text with a soft light sweeping across it, for "working on it" moments. */
export const Shimmer = ({ text, className }: { text: string; className?: string }) => (
  <span className={cn('shimmer-text', className)} data-text={text}>{text}</span>
);
