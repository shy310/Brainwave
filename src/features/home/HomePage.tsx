import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight, CalendarClock, Target, Search, ClipboardCheck, FileText, Layers, MessageCircle, Mic, Gamepad2, MoreHorizontal, NotebookText, Upload, Users,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { Menu } from '@/ui/Menu';
import { Mascot } from '@/ui/Mascot';
import { WaveLine } from '@/ui/Wave';
import { TodayCard } from './TodayCard';
import { ExamBanner } from '@/features/exams/ExamBanner';
import { WeakSpotsBanner } from '@/features/weak/WeakSpotsBanner';
import { WeekCard } from '@/features/stats/WeekCard';
import { UpNextBanner } from '@/features/schedule/UpNext';
import { activityRepo } from '@/features/stats/activity';
import { lectureRepo, type LectureSummary } from '@/features/lectures/repo';
import { useDueCount } from '@/features/lectures/reviews';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { dateLocale } from '@shared/locales';
import type { DayActivity } from '@shared/activity';

/** The single next best thing to do: review due cards, else continue the latest lecture, else record one. */
const NextUp = ({ due, latest }: { due: number; latest: LectureSummary | undefined }) => {
  const { t, locale } = useI18n();
  const th = t.home.hero;
  const card = due > 0
    ? { icon: Layers, title: th.review(due), body: th.reviewBody(Math.max(1, Math.ceil(due / 4))), cta: th.reviewCta, to: '/lectures/review' }
    : latest
      ? { icon: NotebookText, title: lectureTitle(latest, t.lectures.untitled, locale), body: th.continueTitle, cta: th.continueCta, to: `/lectures/${latest.id}` }
      : { icon: Mic, title: th.recordTitle, body: th.recordBody, cta: th.recordCta, to: '/lectures/new' };
  return (
    <section aria-labelledby="next-title" className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 p-5 text-white shadow-[var(--shadow-lift)] sm:p-6">
      {/* The brainwave runs across the field, behind the words. */}
      <div className="pointer-events-none absolute -end-10 top-3 w-64 text-accent-400 opacity-90" aria-hidden="true"><WaveLine width={256} waves={3} amp={10} stroke={5} draw /></div>
      <div className="pointer-events-none absolute -bottom-16 -start-10 size-48 rounded-full bg-brand-400/40 blur-2xl" aria-hidden="true" />
      <p className="relative text-sm font-semibold text-white" id="next-title">{t.home.nextUp}</p>
      <div className="relative mt-2 flex items-start gap-3">
        <card.icon className="mt-1 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-bold leading-tight" dir="auto">{card.title}</h3>
          <p className="mt-1 text-sm text-white">{card.body}</p>
        </div>
      </div>
      <Link to={card.to} className="btn-lip relative mt-5 inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-white px-5 font-semibold text-brand-800 [--lip:var(--color-brand-900)]">
        {card.cta}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </section>
  );
};

export default function HomePage() {
  const { t, locale } = useI18n();
  const tq = t.home.quick;
  const { profile } = useAuth();
  const navigate = useNavigate();
  const due = useDueCount();
  const hour = new Date().getHours();
  const lateNight = hour < 5;
  const [recent, setRecent] = useState<LectureSummary[] | null>(null);
  const [days, setDays] = useState<DayActivity[] | null>(null);
  useEffect(() => { lectureRepo.list().then((l) => setRecent(l.slice(0, 6))).catch(() => setRecent([])); }, []);
  useEffect(() => { activityRepo.list().then(setDays).catch(() => setDays([])); }, []);

  return (
    <div className="stagger space-y-6 sm:space-y-8">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold sm:text-4xl" dir="auto">{t.home.greeting(profile?.display_name ?? '')}</h1>
          <p className="mt-1 text-muted">{t.home.subtitle}</p>
        </div>
        {/* Wave says hello; after midnight it's asleep, gently suggesting the same. */}
        <Mascot mood={lateNight ? 'sleeping' : 'happy'} size={76} className="-my-2 shrink-0" />
      </header>
      <UpNextBanner />

      {recent && <NextUp due={due} latest={recent[0]} />}

      {/* Start something: one primary action, two common ones, the rest in a menu. */}
      <nav aria-label={tq.title} className="space-y-2">
        <Link to="/lectures/new" className="btn-lip relative flex h-13 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand-600 px-5 font-semibold text-white [--lip:var(--color-brand-800)] hover:bg-brand-700">
          <Mic className="size-5" aria-hidden="true" />{t.home.record}
        </Link>
        <div className="grid grid-cols-3 gap-2">
          {[
            { to: '/lectures/new?tab=upload', icon: Upload, label: tq.upload },
            { to: '/lectures/new?tab=pdf', icon: FileText, label: tq.pdf },
            { to: '/tutor', icon: MessageCircle, label: tq.tutor },
          ].map((a) => (
            <Link key={a.to} to={a.to} className="btn-lip relative flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-semibold [--lip:var(--line)] hover:bg-surface-2">
              <a.icon className="size-4 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" /><span className="truncate">{a.label}</span>
            </Link>
          ))}
        </div>
        <div className="flex justify-center">
          <Menu label={t.home.more} items={[
            { label: tq.search, icon: <Search />, onSelect: () => navigate('/search') },
            { label: tq.review, icon: <Layers />, onSelect: () => navigate('/lectures/review') },
            { label: tq.weak, icon: <Target />, onSelect: () => navigate('/practice') },
            { label: tq.exams, icon: <CalendarClock />, onSelect: () => navigate('/exams') },
            { label: tq.games, icon: <Gamepad2 />, onSelect: () => navigate('/play') },
            { label: tq.grade, icon: <ClipboardCheck />, onSelect: () => navigate('/grader') },
            { label: tq.groups, icon: <Users />, onSelect: () => navigate('/groups') },
          ]} trigger={({ ref, props }) => (
            <button ref={ref} type="button" {...props} className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
              <MoreHorizontal className="size-4" aria-hidden="true" />{t.home.more}
            </button>
          )} />
        </div>
      </nav>

      <ExamBanner />
      <WeakSpotsBanner />

      {days && <TodayCard days={days} due={due} />}

      <section aria-labelledby="recent-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recent-title" className="text-lg font-semibold">{t.home.recent}</h2>
          {!!recent?.length && <Link to="/lectures" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t.home.seeAll}</Link>}
        </div>
        {recent && !recent.length && (
          <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <Mascot mood="curious" size={56} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.home.noRecent}</p>
              <p className="text-sm text-muted">{t.home.noRecentBody}</p>
            </div>
          </div>
        )}
        {!!recent?.length && (
          // Recent lectures as cards you can swipe through.
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {recent.slice(0, 6).map((l) => (
              <li key={l.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
                <Link to={`/lectures/${l.id}`} className="pressable lift flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                    {l.source === 'record' ? <Mic className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
                  </span>
                  <span className="line-clamp-2 font-semibold" dir="auto">{lectureTitle(l, t.lectures.untitled, locale)}</span>
                  <span className="mt-auto text-xs text-muted">
                    {new Date(l.created_at).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short' })}
                    {l.duration_sec > 0 && ` · ${t.lectures.minutes(Math.max(1, Math.round(l.duration_sec / 60)))}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WeekCard bare />
    </div>
  );
}
