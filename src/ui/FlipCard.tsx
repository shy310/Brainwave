import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A flashcard on top of its deck. Tapping it turns it over: the new side turns
 * in from the edge (a quick rotate, a fade under reduced motion). Only the side
 * showing is rendered, so screen readers and tests read just that side.
 * The cards underneath peek out below, so it reads as a deck.
 */
export const FlipCard = ({ flipped, onFlip, children, hint, meta, className }: {
  flipped: boolean; onFlip: () => void; children: ReactNode;
  /** Small line under the content (e.g. "Tap to flip"). */
  hint?: ReactNode;
  /** Where the card is from. */
  meta?: ReactNode;
  className?: string;
}) => (
  <div className={cn('relative pb-3 [perspective:1400px]', className)}>
    {/* The rest of the deck, peeking out under the top card. */}
    <span aria-hidden="true" className="absolute inset-x-6 bottom-0 top-6 rounded-[var(--radius-card)] border border-line bg-surface-2 shadow-[var(--shadow-soft)]" />
    <span aria-hidden="true" className="absolute inset-x-3 bottom-1.5 top-3 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]" />
    <button type="button" onClick={onFlip} aria-pressed={flipped}
      className="group relative block w-full rounded-[var(--radius-card)] text-center focus-visible:outline-offset-4">
      <span key={flipped ? 'back' : 'front'}
        className={cn('flip-in flex min-h-60 w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 p-6 shadow-[var(--shadow-lift)] transition-colors sm:min-h-64 sm:p-8',
          flipped
            ? 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/30'
            : 'flashcard-face border-line bg-surface group-hover:border-violet-200 dark:group-hover:border-violet-800')}>
        {children}
        {hint && <span className="text-xs font-medium text-muted">{hint}</span>}
        {meta && <span className="max-w-full truncate text-xs text-muted" dir="auto">{meta}</span>}
      </span>
    </button>
  </div>
);
