import { Link, useParams } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Card } from '@/ui/Card';
import { Alert } from '@/ui/Alert';
import { findCourse } from '@shared/curriculum';
import { SUBJECT_META } from './subjects';
import { useProgress } from './ProgressProvider';
import { topicStatus } from './progress';
import { StatusIcon } from './StatusBadge';
import { SubjectArt } from './SubjectArt';
import { cn } from '@/lib/cn';

export const BackLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-muted hover:text-fg">
    <ChevronLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" /><span className="truncate" dir="auto">{label}</span>
  </Link>
);

export default function CoursePage() {
  const { courseId = '' } = useParams();
  const { t, locale } = useI18n();
  const { progress } = useProgress();
  const course = findCourse(courseId);
  if (!course) return (
    <div className="space-y-4">
      <BackLink to="/learn" label={t.learn.backToLearn} />
      <h1 className="sr-only">{t.learn.courseNotFound}</h1>
      <Alert tone="error">{t.learn.courseNotFound}</Alert>
    </div>
  );
  const meta = SUBJECT_META[course.subject];

  return (
    <div className="space-y-6">
      <BackLink to="/learn" label={t.learn.backToLearn} />
      {/* The subject's field: the same colour and scene as its card on Learn. */}
      <header className={cn('group relative flex items-end overflow-hidden rounded-[var(--radius-card)] p-5 text-white shadow-[var(--shadow-lift)] sm:min-h-44 sm:p-7', meta.field)}>
        <div className="relative z-10 min-w-0 flex-1">
          <h1 className="text-3xl font-bold sm:text-4xl">{t.subjects[course.subject]}</h1>
          <p className="mt-1 font-medium text-white">{t.bands[course.band]}</p>
        </div>
        <SubjectArt subject={course.subject} className="pointer-events-none -my-3 -me-3 h-24 w-40 shrink-0 sm:h-36 sm:w-60" />
      </header>

      {course.units.map((unit, ui) => (
        <section key={unit.id} aria-labelledby={unit.id} className="space-y-3">
          <h2 id={unit.id} className="flex items-center gap-2.5 text-lg font-semibold">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold', meta.soft)} aria-hidden="true">{ui + 1}</span>
            <span className="sr-only">{t.learn.unit(ui + 1)} · </span><span className="min-w-0">{unit.title[locale]}</span>
          </h2>
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
