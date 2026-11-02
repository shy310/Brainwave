import { cn } from '@/lib/cn';

export const Spinner = ({ className, label }: { className?: string; label?: string }) => (
  <span role="status" aria-label={label} className={cn('inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
);

export const FullPageSpinner = ({ label }: { label: string }) => (
  <div className="flex min-h-dvh items-center justify-center text-brand-600">
    <Spinner className="size-8" label={label} />
  </div>
);
