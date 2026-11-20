import type { HTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';

export const Card = ({ className, ref, ...rest }: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) => (
  <div ref={ref} className={cn('rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]', className)} {...rest} />
);
