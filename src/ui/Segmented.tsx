import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Option<T extends string> { value: T; label: string; icon?: LucideIcon }

/** Accessible single-choice toggle group (radio semantics). */
export const Segmented = <T extends string>({ value, options, onChange, label, scroll }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string;
  /** Stay on one line (inside a container that scrolls sideways) instead of wrapping. */
  scroll?: boolean;
}) => (
  <div role="radiogroup" aria-label={label} className={cn('inline-flex gap-1 rounded-xl bg-surface-2 p-1', scroll ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap')}>
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        onClick={() => onChange(o.value)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-[color,background-color,box-shadow] duration-200',
          value === o.value ? (o.icon ? 'bg-surface text-brand-700 shadow-sm dark:text-brand-300' : 'bg-surface text-fg shadow-sm') : 'text-muted hover:text-fg',
        )}
      >
        {o.icon && <o.icon className="size-4 shrink-0" aria-hidden="true" />}
        {o.label}
      </button>
    ))}
  </div>
);
