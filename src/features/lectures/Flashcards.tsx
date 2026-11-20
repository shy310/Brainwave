import { useEffect, useState } from 'react';
import { Check, RotateCcw, Shuffle } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Rich } from '@/ui/Rich';
import type { Flashcards } from '@shared/lectures';

const shuffled = (n: number) => {
  const a = [...Array(n).keys()];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Flip-card revision: cards you miss come back at the end. */
export const FlashcardDeck = ({ deck }: { deck: Flashcards }) => {
  const t = useT();
  const [queue, setQueue] = useState(() => deck.cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(0);

  useEffect(() => { setQueue(deck.cards.map((_, i) => i)); setFlipped(false); setSeen(0); }, [deck]);

  const current = queue[0];
  const answer = (knew: boolean) => {
    setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), q[0]]));
    setFlipped(false);
    if (knew) setSeen((s) => s + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (current === undefined) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-lg font-semibold">{t.lectures.cardsDone}</p>
        <Button icon={<RotateCcw className="size-4" />} onClick={() => { setQueue(deck.cards.map((_, i) => i)); setSeen(0); }}>{t.lectures.restart}</Button>
      </div>
    );
  }
  const card = deck.cards[current];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{t.lectures.cardOf(seen + 1, deck.cards.length)}</span>
        <Button variant="ghost" size="sm" icon={<Shuffle className="size-4" />} onClick={() => { setQueue(shuffled(deck.cards.length)); setSeen(0); setFlipped(false); }}>
          {t.lectures.shuffle}
        </Button>
      </div>
      <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}
        className={cn('flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border p-6 text-center transition-colors',
          flipped ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/30' : 'border-line bg-surface hover:bg-surface-2')}>
        <Rich text={flipped ? card.back : card.front} className={cn(flipped ? 'text-base' : 'text-xl font-medium')} />
        {!flipped && <span className="text-xs text-muted">{t.lectures.flip}</span>}
      </button>
      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => answer(false)}>{t.lectures.again}</Button>
          <Button icon={<Check className="size-4" />} onClick={() => answer(true)}>{t.lectures.knewIt}</Button>
        </div>
      )}
    </div>
  );
};
