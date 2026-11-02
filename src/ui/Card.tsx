import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]', className)} {...rest} />
);
