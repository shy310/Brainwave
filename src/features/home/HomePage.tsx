import { Link } from 'react-router';
import { ArrowRight, BookOpen, ClipboardCheck, Mic, Clapperboard, Headphones, MessageCircle, Users } from 'lucide-react';
import { useT } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { WeekCard } from '@/features/stats/WeekCard';
import { UpNextBanner } from '@/features/schedule/UpNext';
import { IconTile } from '@/ui/IconTile';

export default function HomePage() {
  const t = useT();
  const { profile } = useAuth();
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
      <WeekCard />
      {/* Tools that aren't in the main navigation: one group instead of three look-alike cards. */}
      <Card className="grid overflow-hidden p-0 sm:grid-cols-3">
        {[
          { to: '/tutor', icon: MessageCircle, title: t.tutor.title, body: t.home.short.tutor },
          { to: '/grader', icon: ClipboardCheck, title: t.grader.title, body: t.home.short.grader },
          { to: '/groups', icon: Users, title: t.groups.title, body: t.home.short.groups },
        ].map((q, i) => (
          <Link key={q.to} to={q.to}
            className={cn('group flex min-w-0 items-center gap-3.5 p-4 transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2',
              i > 0 && 'border-t border-line sm:border-t-0 sm:border-s')}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
              <q.icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{q.title}</h2>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted">{q.body}</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {pillars.map((p) => (
          <Link key={p.to} to={p.to} className="group rounded-[var(--radius-card)] focus-visible:outline-offset-4">
            <Card className="flex h-full items-center gap-4 p-4 transition-shadow group-hover:shadow-[var(--shadow-lift)] sm:p-5">
              <IconTile icon={p.icon} tint={p.tint} />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{p.title}</h2>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.body}</p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
