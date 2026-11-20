import { Link, useParams } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Card } from '@/ui/Card';
import { Alert } from '@/ui/Alert';
import { cn } from '@/lib/cn';
import { findCourse } from '@shared/curriculum';
import { SUBJECT_META } from './subjects';
import { useProgress } from './ProgressProvider';
import { topicStatus } from './progress';
import { StatusIcon } from './StatusBadge';

export const BackLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
    <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />{label}
  </Link>
);

export default function CoursePage() {
  const { courseId = '' } = useParams();
  const { t, locale } = useI18n();
  const { progress } = useProgress();
  const course = findCourse(courseId);
  if (!course) return <Alert tone="error">{t.learn.courseNotFound}</Alert>;
  const meta = SUBJECT_META[course.subject];

  return (
    <div className="space-y-6">
      <BackLink to="/learn" label={t.learn.backToLearn} />
      <header className="flex items-center gap-4">
        <span className={cn('flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white', meta.tint)}>
          <meta.icon className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t.subjects[course.subject]}</h1>
          <p className="text-muted">{t.bands[course.band]}</p>
        </div>
      </header>

      {course.units.map((unit, ui) => (
        <section key={unit.id} aria-labelledby={unit.id} className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.learn.unit(ui + 1)}</p>
            <h2 id={unit.id} className="text-lg font-semibold">{unit.title[locale]}</h2>
          </div>
          <Card className="divide-y divide-line overflow-hidden">
            {unit.topics.map((topic) => {
              const status = topicStatus(progress[topic.id]);
              return (
                <Link key={topic.id} to={`/learn/topic/${topic.id}`}
                  className="flex items-start gap-3 p-4 transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px]">
                  <StatusIcon status={status} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{topic.title[locale]}</p>
                    <p className="mt-0.5 text-sm text-muted">{topic.description[locale]}</p>
                  </div>
                  {progress[topic.id]?.quiz_attempts ? (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
                      {progress[topic.id].best_score}%
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
