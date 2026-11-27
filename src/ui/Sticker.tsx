import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const TONES = {
  sun: 'bg-accent-400 text-brand-950',
  blue: 'bg-brand-600 text-white',
  mint: 'bg-emerald-600 text-white',
  purple: 'bg-violet-600 text-white',
  coral: 'bg-coral-600 text-white',
  plain: 'bg-surface text-fg',
} as const;

/**
 * A stat sticker: a rounded badge with a white keyline and a small lift, for
 * real numbers only (streak, minutes today, cards due, days to an exam).
 */
export const Sticker = ({ icon: Icon, tone = 'plain', children, className, label }: {
  icon?: LucideIcon; tone?: keyof typeof TONES; children: ReactNode; className?: string;
  /** Read out instead of the visible text, when the text alone is too short to understand. */
  label?: string;
}) => (
  <span aria-label={label} role={label ? 'img' : undefined}
    className={cn('sticker inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold tabular-nums', TONES[tone], className)}>
    {Icon && <Icon className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />}
    <span aria-hidden={label ? true : undefined}>{children}</span>
  </span>
);
