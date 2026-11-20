import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control = 'w-full rounded-xl border border-line bg-surface px-3.5 text-fg placeholder:text-muted/70 transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60';

interface FieldProps { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode }

export const Field = ({ label, hint, error, children }: FieldProps) => {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">{label}</label>
      {children(id, describedBy)}
      {error ? <p id={`${id}-err`} className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} className={cn(control, 'h-11', className)} {...rest} />,
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => <textarea ref={ref} className={cn(control, 'py-2.5 resize-y', className)} {...rest} />,
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...rest }, ref) => <select ref={ref} className={cn(control, 'h-11 pe-8', className)} {...rest} />,
);
Select.displayName = 'Select';
