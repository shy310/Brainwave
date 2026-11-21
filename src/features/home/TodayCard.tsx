import { Link } from 'react-router';
import { Check, ChevronRight, Flame } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { DAILY_MINUTES, dailyGoals, lastWeek, localDay, streaks, type DayActivity, type GoalId } from '@shared/activity';
import { dateLocale } from '@shared/locales';

const GOAL_LINK: Record<GoalId, string> = { review: '/lectures/review', minutes: '/learn', lecture: '/lectures/new' };

/** Today at a glance: the week so far, the streak, and three small goals to tick off. */
export const TodayCard = ({ days, due }: { days: DayActivity[]; due: number }) => {
  const { t, locale } = useI18n();
  const td = t.home.daily;
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
  const text: Record<GoalId, { title: string; sub: string }> = {
    review: { title: td.review, sub: due ? td.reviewDue(due) : td.caughtUp },
    minutes: { title: td.minutes(DAILY_MINUTES), sub: td.minutesSoFar(Math.min(DAILY_MINUTES, todays?.minutes ?? 0), DAILY_MINUTES) },
    lecture: { title: td.lecture, sub: td.lectureHint },
  };

  return (
    <section aria-labelledby="today-title" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <h2 id="today-title" className="flex-1 text-lg font-semibold">{t.home.today}</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-1 text-sm font-semibold text-slate-950">
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
        <p className="flex items-center justify-between px-4 pt-3 text-sm sm:px-5">
          <span className="font-medium">{t.home.dailyTitle}</span>
          <span className="font-semibold text-brand-700 tabular-nums dark:text-brand-300">{t.home.doneOf(done, goals.length)}</span>
        </p>
        <ul className="divide-y divide-line">
          {goals.map((g) => (
            <li key={g.id}>
              <Link to={GOAL_LINK[g.id]} className="pressable flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface-2 sm:px-5">
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                  g.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-line')} aria-hidden="true">
                  {g.done && <Check className="size-3.5 animate-tick" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block font-medium', g.done && 'text-muted line-through')}>{text[g.id].title}</span>
                  <span className="block text-sm text-muted">{text[g.id].sub}</span>
                </span>
                <span className="sr-only">{g.done ? t.home.goalDone : t.home.goalTodo}</span>
                <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
