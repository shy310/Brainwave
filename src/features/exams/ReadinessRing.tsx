import { cn } from '@/lib/cn';

/** A ring that fills with how ready the student is (0–100). */
export const ReadinessRing = ({ value, size = 56, label, className }: { value: number; size?: number; label: string; className?: string }) => {
  const stroke = size >= 80 ? 8 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = value >= 75 ? 'text-emerald-500' : value >= 40 ? 'text-accent-500' : 'text-brand-500';
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}
      role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          className={cn(tone, 'transition-[stroke-dashoffset] duration-700 ease-[var(--ease-out)]')} />
      </svg>
      <span className={cn('absolute font-semibold tabular-nums', size >= 80 ? 'text-xl' : 'text-xs')} aria-hidden="true">{value}%</span>
    </span>
  );
};
