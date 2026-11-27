import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Mascot } from './Mascot';

export type StepState = 'done' | 'now' | 'todo';

export interface PathStep {
  key: string;
  to: string;
  icon: LucideIcon;
  /** Gradient for the step's key (e.g. TOOL_META.review.tile). */
  tint: string;
  title: ReactNode;
  sub?: ReactNode;
  state: StepState;
  /** Read by screen readers after the title (e.g. "Done", "Up next"). */
  status: string;
}

const ROW = 116;                   // px per step (room for a two-line title and a two-line note)
const NODE = 68;                   // the round key
const OFFSETS = [0, 44, 76, 44];   // the gentle zig-zag, from the start edge

/**
 * A study path: round keycap steps in a gentle zig-zag, joined by a curving line
 * that turns mint up to the last finished step. The step to do now is lit in its
 * tool's colour with Wave beside it; finished ones are mint with a check.
 * Each step is a link; the list is an ordered list, so it reads in order.
 */
export const StudyPath = ({ steps, label, showWave = true, className }: {
  steps: PathStep[]; label: string; showWave?: boolean; className?: string;
}) => {
  const xs = steps.map((_, i) => OFFSETS[i % OFFSETS.length] + NODE / 2);
  const ys = steps.map((_, i) => i * ROW + NODE / 2);
  const seg = (i: number) => `M${xs[i]} ${ys[i]} C${xs[i]} ${ys[i] + ROW / 2} ${xs[i + 1]} ${ys[i + 1] - ROW / 2} ${xs[i + 1]} ${ys[i + 1]}`;
  const width = Math.max(...OFFSETS) + NODE;
  const lastDone = steps.reduce((n, s, i) => (s.state === 'done' ? i : n), -1);
  return (
    <ol aria-label={label} className={cn('study-path relative', className)} style={{ minHeight: (steps.length - 1) * ROW + NODE }}>
      <svg aria-hidden="true" className="pointer-events-none absolute start-0 top-0 overflow-visible rtl:-scale-x-100" width={width} height={(steps.length - 1) * ROW + NODE}>
        {steps.slice(0, -1).map((_, i) => (
          <path key={i} d={seg(i)} fill="none" strokeLinecap="round"
            className={i < lastDone ? 'stroke-emerald-400' : 'stroke-line'} strokeWidth={i < lastDone ? 6 : 5}
            strokeDasharray={i < lastDone ? undefined : '1 11'} />
        ))}
      </svg>
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex items-center" style={{ height: i === steps.length - 1 ? NODE : ROW, alignItems: 'flex-start' }}>
          <Link to={s.to} className="group relative flex min-w-0 flex-1 items-center gap-4 rounded-[28px] focus-visible:outline-offset-4"
            style={{ marginInlineStart: OFFSETS[i % OFFSETS.length] }}>
            <span className={cn('path-node relative flex shrink-0 items-center justify-center rounded-full',
              s.state === 'done' && 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-white',
              s.state === 'now' && cn('bg-gradient-to-br text-white', s.tint),
              s.state === 'todo' && 'border-2 border-line bg-surface text-muted')}
              style={{ width: NODE, height: NODE }} aria-hidden="true">
              {s.state === 'done' ? <Check className="size-8" strokeWidth={3.2} /> : <s.icon className="size-7" strokeWidth={2.2} fill={s.state === 'now' ? 'currentColor' : 'none'} fillOpacity={0.2} />}
              {s.state === 'now' && <span className="path-pulse absolute inset-0 rounded-full" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('line-clamp-2 font-display text-lg font-bold leading-tight group-hover:text-brand-700 dark:group-hover:text-brand-300', s.state === 'done' && 'text-muted line-through decoration-2')} dir="auto">{s.title}</span>
              {s.sub && <span className="mt-0.5 line-clamp-2 text-sm text-muted" dir="auto">{s.sub}</span>}
              <span className="sr-only">, {s.status}</span>
            </span>
          </Link>
          {showWave && s.state === 'now' && <Mascot mood="excited" size={72} className="-mt-2 shrink-0 max-[420px]:hidden" />}
        </li>
      ))}
    </ol>
  );
};
