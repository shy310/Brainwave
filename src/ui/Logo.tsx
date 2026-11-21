import { useId } from 'react';
import { cn } from '@/lib/cn';

/** The app mark: a sound wave (recorded lectures) with a spark (understanding). */
export const LogoMark = ({ className }: { className?: string }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-8', className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#21a18c" />
          <stop offset="1" stopColor="#0c4a42" />
        </linearGradient>
        <linearGradient id={`${id}hi`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".2" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}bg)`} />
      <rect width="64" height="64" rx="18" fill={`url(#${id}hi)`} />
      <g fill="#fdf8ef">
      <rect x="10.5" y="29" width="6" height="12" rx="3" />
      <rect x="19.5" y="22" width="6" height="26" rx="3" />
      <rect x="28.5" y="17" width="6" height="36" rx="3" />
      <rect x="37.5" y="23" width="6" height="24" rx="3" />
      <rect x="46.5" y="29" width="6" height="12" rx="3" />
      </g>
      <path d="M51 8c.55 2.9 2.1 4.45 5 5-2.9.55-4.45 2.1-5 5-.55-2.9-2.1-4.45-5-5 2.9-.55 4.45-2.1 5-5z" fill="#ff9a74" />
    </svg>
  );
};

export const Logo = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
    <LogoMark />
    <span className="text-lg" dir="ltr">BrainWave</span>
  </span>
);
