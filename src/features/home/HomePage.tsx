import { Link } from 'react-router';
import { ArrowRight, BookOpen, ClipboardCheck, Mic, Clapperboard, Headphones, MessageCircle, Users } from 'lucide-react';
import { useT } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { Card } from '@/ui/Card';
import { WeekCard } from '@/features/stats/WeekCard';
import { UpNextBanner } from '@/features/schedule/UpNext';

export default function HomePage() {
  const t = useT();
  const { profile } = useAuth();
  const pillars = [
    { to: '/learn', icon: BookOpen, title: t.home.learnTitle, body: t.home.learnBody, tint: 'from-brand-500 to-brand-700' },
    { to: '/lectures', icon: Mic, title: t.home.lecturesTitle, body: t.home.lecturesBody, tint: 'from-accent-400 to-accent-600' },
    { to: '/videos', icon: Clapperboard, title: t.home.videosTitle, body: t.home.videosBody, tint: 'from-sky-500 to-indigo-600' },
    { to: '/podcasts', icon: Headphones, title: t.home.podcastsTitle, body: t.home.podcastsBody, tint: 'from-emerald-500 to-teal-600' },
  ];
  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.home.greeting(profile?.display_name ?? '')}</h1>
        <p className="mt-2 text-lg text-muted">{t.home.subtitle}</p>
      </header>
      <UpNextBanner />
      <WeekCard />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { to: '/tutor', icon: MessageCircle, title: t.tutor.title, body: t.tutor.subtitle },
          { to: '/grader', icon: ClipboardCheck, title: t.grader.title, body: t.grader.subtitle },
          { to: '/groups', icon: Users, title: t.groups.title, body: t.groups.subtitle },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="group block min-w-0 rounded-[var(--radius-card)]">
            <Card className="flex h-full items-center gap-4 p-4 transition-shadow group-hover:shadow-[var(--shadow-lift)]">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
                <q.icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{q.title}</h2>
                <p className="truncate text-sm text-muted">{q.body}</p>
              </div>
              <ArrowRight className="size-5 text-muted rtl:rotate-180" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {pillars.map((p, i) => (
          <Link key={p.to} to={p.to} className="group rounded-[var(--radius-card)] focus-visible:outline-offset-4" style={{ animationDelay: `${i * 60}ms` }}>
            <Card className="flex h-full flex-col gap-4 p-6 transition-shadow group-hover:shadow-[var(--shadow-lift)] animate-fade-up">
              <span className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${p.tint}`}>
                <p.icon className="size-6" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{p.title}</h2>
                <p className="mt-1 text-muted">{p.body}</p>
              </div>
              <ArrowRight className="size-5 text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
