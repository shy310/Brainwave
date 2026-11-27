import { Check, Flame } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { dailyGoals, lastWeek, localDay, streaks, type DayActivity } from '@shared/activity';
import { dateLocale } from '@shared/locales';

/** Today at a glance: the week so far, the streak, and how many of the three daily goals are done. */
export const TodayCard = ({ days, due }: { days: DayActivity[]; due: number }) => {
  const { t, locale } = useI18n();
  const today = localDay();
  const { current } = streaks(days, today);
  const { week } = lastWeek(days, today);
  const todays = days.find((d) => d.day === today);
  const { goals, done } = dailyGoals(todays, due);
  const letter = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(dateLocale(locale), { weekday: 'narrow' });
  };
  const weekdayName = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(dateLocale(locale), { weekday: 'long' });
  };
  const studied = (d: DayActivity) => d.minutes >= 5 || d.cards > 0 || d.quizzes > 0 || d.lectures > 0;


  return (
    <section aria-labelledby="today-title" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <h2 id="today-title" className="flex-1 font-display text-xl font-bold">{t.home.today}</h2>
          <span className="sticker inline-flex items-center gap-1 rounded-full bg-accent-400 px-3 py-1.5 text-sm font-bold text-brand-950">
            <Flame className="size-4" aria-hidden="true" />{current ? t.week.streak(current) : t.week.noStreak}
          </span>
        </div>
        {/* The last seven days: a filled circle for each day you studied. */}
        <ol className="grid grid-cols-7 gap-1.5" aria-label={t.week.title}>
          {week.map((d) => {
            const on = studied(d);
            const isToday = d.day === today;
            return (
              <li key={d.day} className="flex flex-col items-center gap-1">
                <span className={cn('text-xs', isToday ? 'font-semibold text-fg' : 'text-muted')} aria-hidden="true">{letter(d.day)}</span>
                <span className={cn('flex size-8 items-center justify-center rounded-full border-2 transition-colors',
                  on ? 'border-brand-600 bg-brand-600 text-white' : isToday ? 'border-brand-600' : 'border-line')}>
                  {on && <Check className="size-4 animate-tick" strokeWidth={3} aria-hidden="true" />}
                </span>
                <span className="sr-only">{`${weekdayName(d.day)}: ${on ? t.home.goalDone : t.home.goalTodo}`}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="border-t border-line">
        <p className="flex items-center justify-between px-4 pt-3.5 text-sm sm:px-5">
          <span className="font-medium">{t.home.dailyTitle}</span>
          <span className="font-semibold text-brand-700 tabular-nums dark:text-brand-300">{t.home.doneOf(done, goals.length)}</span>
        </p>
        {/* The goals themselves are on Today's path; here, how many are done as three segments. */}
        <div className="flex gap-1.5 px-4 pb-4 pt-2.5 sm:px-5" aria-hidden="true">
          {goals.map((g) => <span key={g.id} className={cn('h-2.5 flex-1 rounded-full transition-colors duration-500', g.done ? 'bg-emerald-400' : 'bg-surface-2')} />)}
        </div>
      </div>
    </section>
  );
};
