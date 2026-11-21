import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A friendly empty state: an icon, what's missing, and (optionally) how to fill it. */
export const EmptyState = ({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title?: string; body: ReactNode; action?: ReactNode; className?: string }) => (
  <div className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-6 py-8 text-center', className)}>
    <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
      <Icon className="size-6" aria-hidden="true" />
    </span>
    {title && <p className="font-semibold">{title}</p>}
    <p className="max-w-sm text-sm text-muted">{body}</p>
    {action}
  </div>
);
