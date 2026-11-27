import { useLayoutEffect, useRef, useState } from 'react';
import type { IconType } from '@/ui/icons';
import { cn } from '@/lib/cn';

interface Option<T extends string> { value: T; label: string; icon?: IconType }

/** Accessible single-choice toggle group (radio semantics). The highlight slides to the chosen option. */
export const Segmented = <T extends string>({ value, options, onChange, label, scroll, fill }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string;
  /** Stay on one line (inside a container that scrolls sideways) instead of wrapping. */
  scroll?: boolean;
  /** Fill the width with equal segments (for a few short labels). */
  fill?: boolean;
}) => {
  const group = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Measure the chosen option so the highlight can move to it (works in both directions and when wrapping).
  useLayoutEffect(() => {
    const measure = () => {
      const el = group.current?.querySelector<HTMLElement>('[aria-checked="true"]');
      if (el) setPill({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (group.current) ro?.observe(group.current);
    return () => ro?.disconnect();
  }, [value, options.length]);

  return (
    <div ref={group} role="radiogroup" aria-label={label} className={cn('relative gap-1 rounded-2xl bg-surface-2 p-1', fill ? 'grid w-full auto-cols-fr grid-flow-col' : 'inline-flex', !fill && (scroll ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap'))}>
      {pill && (
        <span aria-hidden="true" className="pointer-events-none absolute rounded-xl bg-surface shadow-[0_2px_0_var(--line),0_6px_12px_-8px_rgb(20_26_60/0.35)] transition-[left,top,width,height] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }} />
      )}
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative inline-flex min-h-10 items-center gap-1.5 rounded-xl text-sm font-semibold transition-colors duration-200',
            fill ? 'min-w-0 justify-center px-1.5' : 'px-3',
            value === o.value ? (o.icon ? 'text-brand-700 dark:text-brand-300' : 'text-fg') : 'text-muted hover:text-fg',
            !pill && value === o.value && 'bg-surface shadow-[0_2px_0_var(--line)]',
          )}
        >
          {o.icon && <o.icon className="size-4 shrink-0" aria-hidden="true" />}
          <span className={cn(fill && 'truncate')}>{o.label}</span>
        </button>
      ))}
    </div>
  );
};
