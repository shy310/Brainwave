import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { Card } from '@/ui/Card';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { BANDS, bandForGrade, courseTopics, coursesForBand, findTopic, isBand, type Band } from '@shared/curriculum';
import { SUBJECT_META } from './subjects';
import { useProgress } from './ProgressProvider';
import { topicStatus } from './progress';
import { StatusIcon } from './StatusBadge';

const BAND_KEY = 'bw.learnBand';

export default function LearnPage() {
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const { progress } = useProgress();
  const [band, setBandState] = useState<Band>(() => {
    const saved = storage.get(BAND_KEY);
    return isBand(saved) ? saved : bandForGrade(profile?.grade ?? '9');
  });
  const setBand = (b: Band) => { setBandState(b); storage.set(BAND_KEY, b); };

  const recent = useMemo(() => Object.values(progress)
    .filter((p) => topicStatus(p) === 'learning' && findTopic(p.topic_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3), [progress]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t.learn.title}</h1>
        <p className="text-muted">{t.learn.subtitle}</p>
      </header>

      {recent.length > 0 && (
        <section aria-labelledby="continue" className="space-y-3">
          <h2 id="continue" className="text-lg font-semibold">{t.learn.continueTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {recent.map((p) => {
              const ref = findTopic(p.topic_id)!;
              return (
                <Link key={p.topic_id} to={`/learn/topic/${p.topic_id}`} className="rounded-[var(--radius-card)]">
                  <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
                    <StatusIcon status="learning" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ref.topic.title[locale]}</p>
                      <p className="truncate text-sm text-muted">{t.subjects[ref.course.subject]}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="subjects" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="subjects" className="text-lg font-semibold">{t.bands[band]}</h2>
          <div role="radiogroup" aria-label={t.learn.level} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {BANDS.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={band === b} onClick={() => setBand(b)}
                className={cn('h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                  band === b ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-muted hover:text-fg')}>
                {t.bands[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coursesForBand(band).map((course) => {
            const meta = SUBJECT_META[course.subject];
            const topics = courseTopics(course);
            const done = topics.filter((tp) => topicStatus(progress[tp.id]) === 'mastered').length;
            return (
              <Link key={course.id} to={`/learn/course/${course.id}`} className="group rounded-[var(--radius-card)]">
                <Card className="flex h-full flex-col gap-4 p-5 transition-shadow group-hover:shadow-[var(--shadow-lift)]">
                  <div className="flex items-center gap-3">
                    <span className={cn('flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white', meta.tint)}>
                      <meta.icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{t.subjects[course.subject]}</h3>
                      <p className="text-sm text-muted">{t.learn.topics(topics.length)}</p>
                    </div>
                    <ArrowRight className="size-5 text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
                  </div>
                  <ul className="flex-1 space-y-1 text-sm text-muted">
                    {course.units.map((u) => <li key={u.id} className="truncate">{u.title[locale]}</li>)}
                  </ul>
                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                      <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${(done / topics.length) * 100}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{t.learn.mastered(done, topics.length)}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
