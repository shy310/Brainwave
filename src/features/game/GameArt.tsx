import type { GameId } from './PlayPage';
import { cn } from '@/lib/cn';

/**
 * Each game's cartridge art: Glide is a paper plane on a blue sky with its
 * dashed flight path; Lane Rush is a three-lane road with a car and coins.
 * They come alive when the card is hovered (fine pointers, motion allowed).
 * Decorative.
 */
export const GameArt = ({ game, className }: { game: GameId; className?: string }) => (
  <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" className={cn('game-art block', className)} aria-hidden="true">
    {game === 'glide' ? (
      <>
        <defs><linearGradient id="g-sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#518cff" /><stop offset="1" stopColor="#2552d8" /></linearGradient></defs>
        <rect width="320" height="120" fill="url(#g-sky)" />
        <g fill="#fff" fillOpacity={0.3}>
          <rect x="22" y="22" width="58" height="16" rx="8" /><rect x="36" y="14" width="30" height="16" rx="8" />
          <rect x="226" y="70" width="70" height="18" rx="9" /><rect x="244" y="60" width="34" height="18" rx="9" />
        </g>
        <path d="M30 96 C 90 96, 120 56, 190 58" fill="none" stroke="#ffd35a" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" className="game-trail" />
        <g className="game-plane" transform="translate(196 34)">
          <path d="M0 22 L52 0 L36 46 L26 30 Z" fill="#fff" />
          <path d="M26 30 L52 0 L18 26 Z" fill="#dceaff" />
        </g>
      </>
    ) : (
      <>
        <defs><linearGradient id="g-road" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff826f" /><stop offset="1" stopColor="#c2412d" /></linearGradient></defs>
        <rect width="320" height="120" fill="url(#g-road)" />
        <path d="M110 120 L140 0 H180 L210 120 Z" fill="#172344" fillOpacity={0.35} />
        <g className="game-lanes" stroke="#fff" strokeOpacity={0.8} strokeWidth="3" strokeDasharray="10 12">
          <path d="M150 120 L157 0" /><path d="M170 120 L163 0" />
        </g>
        <g className="game-car" transform="translate(146 66)">
          <rect width="28" height="40" rx="8" fill="#fff" />
          <rect x="5" y="6" width="18" height="10" rx="3" fill="#2552d8" fillOpacity={0.8} />
          <rect x="-2" y="26" width="5" height="10" rx="2" fill="#172344" /><rect x="25" y="26" width="5" height="10" rx="2" fill="#172344" />
        </g>
        <g fill="#ffd35a"><circle cx="60" cy="40" r="9" /><circle cx="262" cy="58" r="9" /><circle cx="236" cy="22" r="6" /></g>
      </>
    )}
  </svg>
);
