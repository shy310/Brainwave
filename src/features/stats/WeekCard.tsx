import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { lastWeek, localDay, streaks, type DayActivity } from '@shared/activity';
import { activityRepo } from './activity';
import { dateLocale } from '@shared/locales';

/** Streak, minutes studied each day this week, and the week's totals. */
export const WeekCard = () => {
  const { t, locale } = useI18n();
  const tw = t.week;
  const [days, setDays] = useState<DayActivity[] | null>(null);

  useEffect(() => { activityRepo.list().then(setDays).catch(() => setDays([])); }, []);
  if (!days) return null;

  const today = localDay();
  const { current, best, studiedToday } = streaks(days, today);
  const { week, total } = lastWeek(days, today);
  const max = Math.max(30, ...week.map((d) => d.minutes));
  const weekday = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(dateLocale(locale), { weekday: 'short' });
  };

  // Nothing studied this week yet: a short nudge instead of an empty chart and four zeros.
  const empty = !current && !total.minutes && !total.cards && !total.quizzes && !total.lectures;

  if (empty) {
    return (
      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-400/15 text-accent-600">
          <Flame className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">{tw.noStreak}</h2>
          <p className="text-sm text-muted">{tw.keepGoing}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className={cn('flex size-12 items-center justify-center rounded-2xl', current ? 'bg-accent-400/15 text-accent-600' : 'bg-surface-2 text-muted')}>
          <Flame className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{current ? tw.streak(current) : tw.noStreak}</h2>
          <p className="text-sm text-muted">{studiedToday ? tw.doneToday : tw.keepGoing}{best > 1 ? ` · ${tw.best(best)}` : ''}</p>
        </div>
      </div>

      <figure className="space-y-2">
        <figcaption className="text-sm font-medium">{tw.chart}</figcaption>
        {/* Single series: one hue, thin bars rounded at the data end, value on hover/focus and for today. */}
        <div className="flex h-28 items-end gap-2 border-b border-line" aria-hidden="true">
          {week.map((d) => {
            const isToday = d.day === today;
            return (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                <span className={cn('pointer-events-none absolute -top-1 whitespace-nowrap rounded-md bg-fg px-1.5 py-0.5 text-[11px] font-medium text-bg opacity-0 transition-opacity group-hover:opacity-100', isToday && d.minutes > 0 && 'opacity-100 bg-transparent text-fg')}>
                  {tw.min(d.minutes)}
                </span>
                <div className={cn('w-full max-w-7 rounded-t-[4px]', d.minutes ? 'bg-brand-500 dark:bg-brand-400' : 'bg-transparent')}
                  style={{ height: d.minutes ? `${Math.max(4, (d.minutes / max) * 80)}%` : 0 }} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 text-center text-xs text-muted" aria-hidden="true">
          {week.map((d) => <span key={d.day} className={cn('flex-1', d.day === today && 'font-semibold text-fg')}>{weekday(d.day)}</span>)}
        </div>
        <table className="sr-only">
          <caption>{tw.chart}</caption>
          <thead><tr><th scope="col">{tw.day}</th><th scope="col">{tw.minutes}</th></tr></thead>
          <tbody>{week.map((d) => <tr key={d.day}><td>{weekday(d.day)}</td><td>{d.minutes}</td></tr>)}</tbody>
        </table>
      </figure>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['minutes', 'cards', 'quizzes', 'lectures'] as const).map((k) => (
          <div key={k} className="flex flex-col-reverse rounded-xl bg-surface-2 px-3 py-2">
            <dt className="text-xs text-muted">{tw.totals[k]}</dt>
            <dd className="text-xl font-semibold tabular-nums">{total[k]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};
