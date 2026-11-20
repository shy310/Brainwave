import { cn } from '@/lib/cn';

interface Option<T extends string> { value: T; label: string }

/** Accessible single-choice toggle group (radio semantics). */
export const Segmented = <T extends string>({ value, options, onChange, label }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; label: string;
}) => (
  <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        onClick={() => onChange(o.value)}
        className={cn(
          'min-h-9 rounded-lg px-3 text-sm font-medium transition-colors',
          value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);
