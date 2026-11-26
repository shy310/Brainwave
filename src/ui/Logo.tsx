import { useId } from 'react';
import { cn } from '@/lib/cn';

/** The app mark: a note page whose sound-wave bars turn into lines of text (a lecture becoming notes), with a sun dot. */
export const LogoMark = ({ className }: { className?: string }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-8', className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#4a80fb" />
          <stop offset="1" stopColor="#1f43ad" />
        </linearGradient>
        <linearGradient id={`${id}hi`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}bg)`} />
      <rect width="64" height="64" rx="16" fill={`url(#${id}hi)`} />
      <g transform="rotate(-5 32 34)">
        <rect x="12" y="13" width="40" height="40" rx="8" fill="#ffffff" />
        <rect x="17.5" y="29" width="4.5" height="9" rx="2.25" fill="#3268f5" />
        <rect x="24" y="23" width="4.5" height="21" rx="2.25" fill="#3268f5" />
        <rect x="30.5" y="27" width="4.5" height="13" rx="2.25" fill="#3268f5" />
        <rect x="37" y="24" width="10" height="4.5" rx="2.25" fill="#3268f5" />
        <rect x="37" y="31.25" width="7.5" height="4.5" rx="2.25" fill="#3268f5" opacity=".7" />
        <rect x="37" y="38.5" width="10" height="4.5" rx="2.25" fill="#3268f5" opacity=".45" />
      </g>
      <circle cx="50.5" cy="13.5" r="7" fill="#ffd35a" />
    </svg>
  );
};

export const Logo = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center gap-2 font-display font-bold tracking-tight', className)}>
    <LogoMark />
    <span className="text-[1.2rem]" dir="ltr">BrainWave</span>
  </span>
);
