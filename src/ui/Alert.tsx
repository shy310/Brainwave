import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  info: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100',
  error: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
};

export const Alert = ({ tone = 'info', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', TONES[tone], className)}>
    {children}
  </div>
);
