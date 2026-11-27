import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from '@/ui/icons';
import { cn } from '@/lib/cn';

const TONES = {
  info: { box: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100', icon: Info, ink: 'text-brand-700 dark:text-brand-300' },
  error: { box: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100', icon: CircleAlert, ink: 'text-rose-600 dark:text-rose-300' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100', icon: CircleCheck, ink: 'text-emerald-600 dark:text-emerald-300' },
};

/** A message in the page. Each tone has its own icon, so it never relies on colour alone. */
export const Alert = ({ tone = 'info', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) => {
  const { box, icon: Icon, ink } = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-2xl border px-4 py-3 text-sm', box, className)}>
      <Icon className={cn('mt-px size-[18px] shrink-0', ink)} weight="duotone" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};
