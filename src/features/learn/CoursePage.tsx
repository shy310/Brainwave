import { useParams } from 'react-router';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { findCourse } from '@shared/curriculum';
import { SUBJECT_META } from './subjects';
import { useProgress } from './ProgressProvider';
import { topicStatus } from './progress';
import { SubjectArt } from './SubjectArt';
import { cn } from '@/lib/cn';
import { BackLink } from '@/ui/PageHeader';
import { StudyPath } from '@/ui/StudyPath';
import { BookOpenText } from '@/ui/icons';

// The back link lives in the shared UI now; re-exported for the pages that import it from here.
export { BackLink };

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
  // The one topic to do next: the first in the course that isn't mastered yet.
  const nowId = course.units.flatMap((u) => u.topics).find((tp) => topicStatus(progress[tp.id]) !== 'mastered')?.id;

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
          {/* The unit as a path: mastered topics are done, the first one left in the course is "now". */}
          <StudyPath label={unit.title[locale]} className="pt-2"
            steps={unit.topics.map((topic) => {
              const status = topicStatus(progress[topic.id]);
              const score = progress[topic.id]?.quiz_attempts ? ` · ${progress[topic.id].best_score}%` : '';
              const state = status === 'mastered' ? 'done' : topic.id === nowId ? 'now' : 'todo';
              return {
                key: topic.id, to: `/learn/topic/${topic.id}`, icon: status === 'learning' ? BookOpenText : meta.icon, tint: meta.tint,
                title: topic.title[locale], sub: `${topic.description[locale]}${score}`, state,
                status: t.learn.status[status],
              };
            })} />
        </section>
      ))}
    </div>
  );
}
