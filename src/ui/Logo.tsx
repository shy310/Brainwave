import { cn } from '@/lib/cn';

export const LogoMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-8', className)}>
    <defs>
      <linearGradient id="bw-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6d55fb" />
        <stop offset="1" stopColor="#ff6b3d" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#bw-g)" />
    <path d="M12 36c5 0 6-12 11-12s6 18 11 18 6-22 11-22 6 16 7 16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
    <LogoMark />
    <span className="text-lg" dir="ltr">BrainWave</span>
  </span>
);
