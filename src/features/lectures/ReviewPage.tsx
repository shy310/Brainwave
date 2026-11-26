import { useEffect, useState } from 'react';
import { ToolHero } from '@/ui/PageHeader';
import { Loading } from '@/ui/Wave';

import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FlipCard } from '@/ui/FlipCard';
import { Mascot } from '@/ui/Mascot';
import { Rich } from '@/ui/Rich';
import { buildQueue, preview, type CardState, type Rating } from '@shared/srs';
import { lectureTitle } from './LecturesPage';
import { lectureRepo } from './repo';
import { rate, reviewCards, reviewRepo, type ReviewCard } from './reviews';
import { dateLocale } from '@shared/locales';

const RATINGS: { rating: Rating; variant: 'secondary' | 'primary' }[] = [
  { rating: 'again', variant: 'secondary' }, { rating: 'good', variant: 'primary' }, { rating: 'easy', variant: 'secondary' },
];

/** Today's flashcard review across every lecture, scheduled by spaced repetition. */
export default function ReviewPage() {
  const { t, locale } = useI18n();
  const tr = t.lectures.review;
  const [states, setStates] = useState<Map<string, CardState> | null>(null);
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([lectureRepo.studyMaterial('all'), reviewRepo.list()]).then(([lectures, st]) => {
      const cards = reviewCards(lectures, (l) => lectureTitle(l, t.lectures.untitled, locale));
      const q = buildQueue(cards, st, Date.now());
      setTotal(cards.length);
      setStates(st);
      setQueue(q);
    }).catch(() => setError(true));
    // Built once per visit; ratings change the queue from here on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = queue?.[0];

  const answer = async (rating: Rating) => {
    if (!card || !states) return;
    const next = await rate(states, card, rating);
    setStates(new Map(states));
    setReviewed((n) => n + 1);
    setFlipped(false);
    // A missed card comes back at the end of this session.
    setQueue((q) => (q ? [...q.slice(1), ...(next.box === 0 ? [card] : [])] : q));
  };

  const label = (rating: Rating) => {
    const p = preview(states?.get(card?.key ?? ''), rating);
    return `${tr[rating]} · ${p.minutes ? tr.inMinutes(p.minutes) : tr.inDays(p.days!)}`;
  };

  const nextDue = () => {
    const soonest = Math.min(...[...(states?.values() ?? [])].map((s) => s.due));
    if (!Number.isFinite(soonest)) return '';
    return new Date(soonest).toLocaleString(dateLocale(locale), { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ToolHero tool="review" back={{ to: '/lectures', label: t.lectures.title }} title={tr.title} subtitle={tr.explain} />

      {error && <Alert tone="error">{t.auth.errors.generic}</Alert>}
      {!queue && !error && <Loading label={t.common.loading} />}

      {queue && !card && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center" aria-live="polite">
          <Mascot mood={reviewed ? 'celebrating' : total ? 'happy' : 'curious'} size={104} />
          <p className="font-display text-2xl font-bold">{reviewed ? tr.done : total ? tr.none : tr.noCards}</p>
          {reviewed > 0 && <p className="text-muted">{tr.doneBody(reviewed)}</p>}
          {total > 0 && nextDue() && <p className="text-sm text-muted">{tr.next(nextDue())}</p>}
        </Card>
      )}

      {card && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold tabular-nums text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">{tr.left(queue!.length)}</span>
            {!states?.has(card.key) && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{tr.isNew}</span>}
          </div>
          <FlipCard flipped={flipped} onFlip={() => setFlipped((f) => !f)} hint={!flipped && t.lectures.flip} meta={t.lectures.study.from(card.lectureTitle)}>
            <Rich text={flipped ? card.back : card.front} className={cn('max-w-full [overflow-wrap:anywhere]', flipped ? 'text-lg' : 'font-display text-2xl font-bold')} />
          </FlipCard>
          {flipped && (
            <div className="grid grid-cols-3 gap-2">
              {RATINGS.map(({ rating, variant }) => (
                <Button key={rating} variant={variant} className="h-auto min-h-11 whitespace-normal py-2 text-xs sm:text-sm" onClick={() => void answer(rating)}>{label(rating)}</Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
