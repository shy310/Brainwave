import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, BookOpen, ChevronRight, ClipboardCheck, Clapperboard, FileText, Headphones, Layers, MessageCircle, Mic, Mountain, Upload, Users,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { IconTile } from '@/ui/IconTile';
import { WeekCard } from '@/features/stats/WeekCard';
import { UpNextBanner } from '@/features/schedule/UpNext';
import { lectureRepo, type LectureSummary } from '@/features/lectures/repo';
import { useDueCount } from '@/features/lectures/reviews';
import { lectureTitle } from '@/features/lectures/LecturesPage';

interface Action { to: string; icon: LucideIcon; label: string; tint: string; badge?: number }

export default function HomePage() {
  const { t, locale } = useI18n();
  const tq = t.home.quick;
  const { profile } = useAuth();
  const due = useDueCount();
  const [recent, setRecent] = useState<LectureSummary[] | null>(null);
  useEffect(() => { lectureRepo.list().then((l) => setRecent(l.slice(0, 3))).catch(() => setRecent([])); }, []);

  // The things students do most, one tap away (like an app launcher).
  const actions: Action[] = [
    { to: '/lectures/new', icon: Mic, label: tq.record, tint: 'bg-rose-500/12 text-rose-600 dark:text-rose-300' },
    { to: '/lectures/new?tab=upload', icon: Upload, label: tq.upload, tint: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
    { to: '/lectures/new?tab=pdf', icon: FileText, label: tq.pdf, tint: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
    { to: '/lectures/review', icon: Layers, label: tq.review, tint: 'bg-brand-500/12 text-brand-600 dark:text-brand-300', badge: due },
    { to: '/play', icon: Mountain, label: tq.summit, tint: 'bg-accent-400/15 text-accent-600 dark:text-accent-300' },
    { to: '/tutor', icon: MessageCircle, label: tq.tutor, tint: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
    { to: '/grader', icon: ClipboardCheck, label: tq.grade, tint: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
    { to: '/groups', icon: Users, label: tq.groups, tint: 'bg-teal-500/12 text-teal-700 dark:text-teal-300' },
  ];
  const pillars = [
    { to: '/learn', icon: BookOpen, title: t.home.learnTitle, body: t.home.short.learn, tint: 'from-brand-500 to-brand-700' },
    { to: '/lectures', icon: Mic, title: t.home.lecturesTitle, body: t.home.short.lectures, tint: 'from-accent-400 to-accent-600' },
    { to: '/videos', icon: Clapperboard, title: t.home.videosTitle, body: t.home.short.videos, tint: 'from-sky-500 to-indigo-600' },
    { to: '/podcasts', icon: Headphones, title: t.home.podcastsTitle, body: t.home.short.podcasts, tint: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="animate-fade-up">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.home.greeting(profile?.display_name ?? '')}</h1>
        <p className="mt-2 text-lg text-muted">{t.home.subtitle}</p>
      </header>
      <UpNextBanner />

      <nav aria-label={tq.title}>
        <Card className="grid grid-cols-4 gap-1 p-2 sm:grid-cols-8 sm:p-3">
          {actions.map((a) => (
            <Link key={a.to} to={a.to}
              className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2">
              <span className={cn('relative flex size-12 items-center justify-center rounded-2xl transition-transform group-active:scale-95', a.tint)}>
                <a.icon className="size-6" fill="currentColor" fillOpacity={0.12} aria-hidden="true" />
                {!!a.badge && (
                  <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-semibold text-white tabular-nums ring-2 ring-surface">
                    {a.badge > 99 ? '99+' : a.badge}
                  </span>
                )}
              </span>
              <span className="w-full text-xs font-medium leading-tight">{a.label}</span>
              {!!a.badge && <span className="sr-only">{t.lectures.review.due(a.badge)}</span>}
            </Link>
          ))}
        </Card>
      </nav>

      <WeekCard />

      {!!recent?.length && (
        <section aria-labelledby="recent-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="recent-title" className="text-lg font-semibold">{t.home.recent}</h2>
            <Link to="/lectures" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">{t.home.seeAll}</Link>
          </div>
          <Card className="divide-y divide-line overflow-hidden p-0">
            {recent.map((l) => (
              <Link key={l.id} to={`/lectures/${l.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  {l.source === 'record' ? <Mic className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" dir="auto">{lectureTitle(l, t.lectures.untitled, locale)}</span>
                  <span className="block text-xs text-muted">{new Date(l.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
              </Link>
            ))}
          </Card>
        </section>
      )}

      <section aria-labelledby="explore-title" className="space-y-3">
        <h2 id="explore-title" className="text-lg font-semibold">{t.home.explore}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {pillars.map((p) => (
            <Link key={p.to} to={p.to} className="group rounded-[var(--radius-card)] focus-visible:outline-offset-4">
              <Card className="flex h-full items-center gap-4 p-4 transition-shadow group-hover:shadow-[var(--shadow-lift)] sm:p-5">
                <IconTile icon={p.icon} tint={p.tint} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.body}</p>
                </div>
                <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
