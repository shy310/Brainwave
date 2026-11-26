import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Mascot, type Mood } from './Mascot';

/**
 * A friendly empty state: Wave (curious by default), what's missing, and
 * (optionally) how to fill it. The icon, when given, sits on Wave's badge so
 * the page's subject is still clear at a glance.
 */
export const EmptyState = ({ icon: Icon, mood = 'curious', title, body, action, className }: {
  icon?: LucideIcon; mood?: Mood; title?: string; body: ReactNode; action?: ReactNode; className?: string;
}) => (
  <div className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-6 py-8 text-center', className)}>
    <span className="relative">
      <Mascot mood={mood} size={96} />
      {Icon && (
        <span className="absolute -bottom-1 -end-1 flex size-8 items-center justify-center rounded-full bg-accent-400 text-brand-950 ring-4 ring-surface">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
    </span>
    {title && <p className="font-display text-lg font-bold">{title}</p>}
    <p className="max-w-sm text-sm text-muted">{body}</p>
    {action}
  </div>
);
