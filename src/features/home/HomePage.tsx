import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Layers, Timer } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { Mascot } from '@/ui/Mascot';
import { Sticker } from '@/ui/Sticker';
import { TodayCard } from './TodayCard';
import { TodayPath } from './TodayPath';
import { ToolGrid } from './ToolGrid';
import { WeekCard } from '@/features/stats/WeekCard';
import { UpNextBanner } from '@/features/schedule/UpNext';
import { activityRepo } from '@/features/stats/activity';
import { lectureRepo, type LectureSummary } from '@/features/lectures/repo';
import { useDueCount } from '@/features/lectures/reviews';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { LectureThumb } from '@/features/lectures/LectureThumb';
import { dateLocale } from '@shared/locales';
import { DAILY_MINUTES, localDay, type DayActivity } from '@shared/activity';

/**
 * Home: hello and today's numbers, today's path (the real next steps, in order),
 * a launcher for everything else, and beside it on wide screens your streak,
 * your week and your latest lectures.
 */
export default function HomePage() {
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const due = useDueCount();
  const lateNight = new Date().getHours() < 5;
  const [recent, setRecent] = useState<LectureSummary[] | null>(null);
  const [days, setDays] = useState<DayActivity[] | null>(null);
  useEffect(() => { lectureRepo.list().then((l) => setRecent(l.slice(0, 6))).catch(() => setRecent([])); }, []);
  useEffect(() => { activityRepo.list().then(setDays).catch(() => setDays([])); }, []);
  const minutes = Math.min(DAILY_MINUTES, days?.find((d) => d.day === localDay())?.minutes ?? 0);

  return (
    <div className="stagger space-y-8">
      <header className="flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl" dir="auto">{t.home.greeting(profile?.display_name ?? '')}</h1>
            <p className="mt-1.5 text-lg text-muted">{t.home.subtitle}</p>
          </div>
          {/* Today's numbers, as stickers: minutes toward the goal, and cards waiting. */}
          <div className="flex flex-wrap gap-2">
            <Sticker icon={Timer} tone="plain" label={t.home.daily.minutesSoFar(minutes, DAILY_MINUTES)}>{minutes}/{DAILY_MINUTES}</Sticker>
            {due > 0 && <Sticker icon={Layers} tone="purple" label={t.home.daily.reviewDue(due)}>{due}</Sticker>}
          </div>
        </div>
        {/* Wave lives on the path beside the next step; after midnight it naps here instead, gently suggesting the same. */}
        {lateNight && <Mascot mood="sleeping" size={96} className="-my-3 shrink-0 max-sm:size-20" />}
      </header>
      <UpNextBanner />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <div className="min-w-0 space-y-10">
          {days && recent && <TodayPath days={days} due={due} latest={recent[0]} showWave={!lateNight} />}
          <ToolGrid />
        </div>

        {/* The side column: your streak and goals, your week, your latest lectures. */}
        <aside className="min-w-0 space-y-6">
          {days && <TodayCard days={days} due={due} />}
          <section aria-labelledby="recent-title" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="recent-title" className="font-display text-xl font-bold">{t.home.recent}</h2>
              {!!recent?.length && <Link to="/lectures" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">{t.home.seeAll}</Link>}
            </div>
            {recent && !recent.length && (
              <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 p-4">
                <Mascot mood="curious" size={56} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.home.noRecent}</p>
                  <p className="text-sm text-muted">{t.home.noRecentBody}</p>
                </div>
              </div>
            )}
            {!!recent?.length && (
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
                {recent.slice(0, 5).map((l) => (
                  <li key={l.id} className="border-b border-line last:border-0">
                    <Link to={`/lectures/${l.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                      <LectureThumb source={l.source} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold" dir="auto">{lectureTitle(l, t.lectures.untitled, locale)}</span>
                        <span className="block text-xs text-muted">
                          {new Date(l.created_at).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short' })}
                          {l.duration_sec > 0 && ` · ${t.lectures.minutes(Math.max(1, Math.round(l.duration_sec / 60)))}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <WeekCard bare />
        </aside>
      </div>
    </div>
  );
}
