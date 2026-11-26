import { useEffect, useState } from 'react';
import { Check, RotateCcw, Shuffle } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { FlipCard } from '@/ui/FlipCard';
import { Rich } from '@/ui/Rich';
import type { Flashcards } from '@shared/lectures';
import { MASTERY_LEVELS, type MasteryLevel } from '@shared/srs';

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
        <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold tabular-nums text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">{t.lectures.cardOf(seen + 1, round.length)}</span>
        <Button variant="ghost" size="sm" icon={<Shuffle className="size-4" />} onClick={() => start(shuffled(deck.cards.length))}>
          {t.lectures.shuffle}
        </Button>
      </div>
      <FlipCard flipped={flipped} onFlip={() => setFlipped((f) => !f)} hint={!flipped && t.lectures.flip}
        meta={labels?.[current] && t.lectures.study.from(labels[current])}>
        <Rich text={flipped ? card.back : card.front} className={cn('max-w-full [overflow-wrap:anywhere]', flipped ? 'text-lg' : 'font-display text-2xl font-bold')} />
      </FlipCard>
      {flipped && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => answer(false)}>{t.lectures.again}</Button>
          <Button icon={<Check className="size-4" />} onClick={() => answer(true)}>{t.lectures.knewIt}</Button>
        </div>
      )}
    </div>
  );
};

const MASTERY_STYLE: Record<MasteryLevel, { dot: string; bar: string }> = {
  new: { dot: 'bg-slate-400', bar: 'bg-slate-300 dark:bg-slate-600' },
  learning: { dot: 'bg-rose-500', bar: 'bg-rose-400' },
  almost: { dot: 'bg-amber-500', bar: 'bg-amber-400' },
  mastered: { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
};

/** How far a deck is: new, still learning, almost done and mastered cards, as a bar and counts. */
export const MasteryBar = ({ counts }: { counts: Record<MasteryLevel, number> }) => {
  const t = useT();
  const tm = t.lectures.mastery;
  const total = MASTERY_LEVELS.reduce((n, k) => n + counts[k], 0) || 1;
  return (
    <section aria-label={tm.title} className="space-y-2.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        {MASTERY_LEVELS.map((k) => counts[k] > 0 && <div key={k} className={MASTERY_STYLE[k].bar} style={{ width: `${(counts[k] / total) * 100}%` }} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        {MASTERY_LEVELS.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={cn('size-2.5 shrink-0 rounded-full', MASTERY_STYLE[k].dot)} aria-hidden="true" />
            <span className="text-muted">{tm[k]}</span>
            <span className="ms-auto font-semibold tabular-nums sm:ms-0">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
