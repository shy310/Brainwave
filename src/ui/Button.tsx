import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun' | 'onColor';
type Size = 'sm' | 'md' | 'lg' | 'xl';

// Primary and danger buttons are tactile: a darker lip underneath that the press squashes (see .btn-lip).
const VARIANTS: Record<Variant, string> = {
  primary: 'btn-lip bg-brand-600 text-white [--lip:var(--color-brand-800)] hover:bg-brand-700',
  secondary: 'btn-lip bg-surface text-fg border border-line [--lip:var(--line)] hover:bg-surface-2 hover:border-brand-200 dark:hover:border-brand-800',
  ghost: 'text-fg hover:bg-surface-2 active:scale-[0.97]',
  danger: 'btn-lip bg-rose-600 text-white [--lip:var(--color-rose-800)] hover:bg-rose-500',
  // On a Signature Blue field: Sunshine for the main action, an outlined white one beside it.
  sun: 'btn-lip bg-accent-400 text-brand-950 [--lip:#c9961a] hover:bg-accent-300',
  onColor: 'text-white ring-1 ring-inset ring-white/50 hover:bg-brand-700 active:scale-[0.97]',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  xl: 'h-14 px-7 text-lg gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', onPointerDown, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      // The brainwave pulse on press (primary only; CSS draws it, reduced motion hides it).
      onPointerDown={(e) => {
        if (variant === 'primary' || variant === 'sun') {
          const el = e.currentTarget;
          el.removeAttribute('data-pulse');
          void el.offsetWidth;
          el.setAttribute('data-pulse', '');
          window.setTimeout(() => el.removeAttribute('data-pulse'), 560);
        }
        onPointerDown?.(e);
      }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        // The press scales down smoothly (it used to snap: only colours were transitioned).
        'relative inline-flex items-center justify-center rounded-[var(--radius-control)] font-semibold select-none',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--dur-press)] ease-out',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant], SIZES[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
