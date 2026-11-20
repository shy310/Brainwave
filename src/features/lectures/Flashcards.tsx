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

interface DeckProps {
  deck: Flashcards;
  /** Where each card came from (e.g. its lecture), shown under the card. */
  labels?: string[];
  /** A round ended: how many cards were known the first time, out of how many. */
  onFinish?: (knewFirstTry: number, total: number) => void;
  /** Each answer, for spaced repetition (card index in `deck`). */
  onAnswer?: (card: number, knew: boolean) => void;
}

/** Flip-card revision: cards you miss come back at the end, and the end shows how it went. */
export const FlashcardDeck = ({ deck, labels, onFinish, onAnswer }: DeckProps) => {
  const t = useT();
  const all = () => deck.cards.map((_, i) => i);
  const [round, setRound] = useState<number[]>(all);
  const [queue, setQueue] = useState(all);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(0);
  const [missed, setMissed] = useState<Set<number>>(() => new Set());

  const start = (cards: number[]) => { setRound(cards); setQueue(cards); setSeen(0); setFlipped(false); setMissed(new Set()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => start(all()), [deck]);

  const current = queue[0];
  const answer = (knew: boolean) => {
    onAnswer?.(queue[0], knew);
    if (!knew) setMissed((m) => new Set(m).add(queue[0]));
    const next = knew ? queue.slice(1) : [...queue.slice(1), queue[0]];
    setQueue(next);
    setFlipped(false);
    if (knew) setSeen((s) => s + 1);
    // A round can only end on a card you knew, so `missed` is final here.
    if (!next.length) onFinish?.(round.length - missed.size, round.length);
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
    const toReview = round.filter((i) => missed.has(i));
    return (
      <div className="space-y-4 py-6 text-center" aria-live="polite">
        <p className="text-lg font-semibold">{t.lectures.cardsDone}</p>
        <p className="text-muted">{t.lectures.cardsResult(round.length - toReview.length, round.length)}</p>
        {toReview.length > 0 && (
          <div className="mx-auto max-w-md text-start">
            <p className="mb-1 text-sm font-medium">{t.lectures.cardsToReview}</p>
            <ul className="list-disc space-y-1 ps-5 text-sm">{toReview.map((i) => <li key={i}><Rich text={deck.cards[i].front} /></li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {toReview.length > 0 && <Button onClick={() => start(toReview)}>{t.lectures.reviewMissed}</Button>}
          <Button variant={toReview.length ? 'secondary' : 'primary'} icon={<RotateCcw className="size-4" />} onClick={() => start(all())}>{t.lectures.restart}</Button>
        </div>
      </div>
    );
  }
  const card = deck.cards[current];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{t.lectures.cardOf(seen + 1, round.length)}</span>
        <Button variant="ghost" size="sm" icon={<Shuffle className="size-4" />} onClick={() => start(shuffled(deck.cards.length))}>
          {t.lectures.shuffle}
        </Button>
      </div>
      <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}
        className={cn('flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border p-6 text-center transition-colors',
          flipped ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/30' : 'border-line bg-surface hover:bg-surface-2')}>
        <Rich text={flipped ? card.back : card.front} className={cn(flipped ? 'text-base' : 'text-xl font-medium')} />
        {!flipped && <span className="text-xs text-muted">{t.lectures.flip}</span>}
        {labels?.[current] && <span className="text-xs text-muted" dir="auto">{t.lectures.study.from(labels[current])}</span>}
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
