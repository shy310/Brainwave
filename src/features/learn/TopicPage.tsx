import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { BookOpen, CheckCircle2, Clapperboard, Headphones, MessageCircle, RefreshCw, Sparkles, Target } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { callAi } from '@/lib/api';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Rich, RichInline } from '@/ui/Rich';
import { Spinner } from '@/ui/Spinner';
import { findTopic } from '@shared/curriculum';
import { LessonSchema, type Lesson } from '@shared/learn';
import { BackLink } from './CoursePage';
import { QuestionCard } from './QuestionCard';
import { SUBJECT_META } from './subjects';
import { useProgress } from './ProgressProvider';
import { topicStatus } from './progress';
import { StatusText } from './StatusBadge';
import { useAiTask } from './useAiTask';

const lessonKey = (topicId: string, locale: string, grade: string) => `bw.lesson.${topicId}.${locale}.${grade}`;

const readCached = (key: string): Lesson | null => {
  try {
    const parsed = LessonSchema.safeParse(JSON.parse(storage.get(key) ?? 'null'));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
};

export const linkButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors';

export default function TopicPage() {
  const { topicId = '' } = useParams();
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const { progress, markLesson, recordPractice } = useProgress();
  const lesson = useAiTask<Lesson>();
  const ref = findTopic(topicId);
  const key = lessonKey(topicId, locale, profile?.grade ?? '9');

  useEffect(() => {
    lesson.reset();
    const cached = readCached(key);
    if (cached) lesson.setData(cached);
  }, [key]);

  if (!ref) return <Alert tone="error">{t.learn.topicNotFound}</Alert>;
  const { topic, unit, course } = ref;
  const meta = SUBJECT_META[course.subject];
  const p = progress[topicId];
  const status = topicStatus(p);

  const generate = async () => {
    const result = await lesson.run((signal) => callAi<Lesson>('lesson', { topicId }, signal));
    if (result) storage.set(key, JSON.stringify(result));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink to={`/learn/course/${course.id}`} label={`${t.subjects[course.subject]} · ${t.bands[course.band]}`} />

      <header className="space-y-3">
        <p className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', meta.soft)}>
          <meta.icon className="size-3.5" aria-hidden="true" />{unit.title[locale]}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{topic.title[locale]}</h1>
        <p className="text-lg text-muted">{topic.description[locale]}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusText status={status} />
          {p?.quiz_attempts ? <span className="text-sm text-muted tabular-nums">{t.quiz.title}: {p.best_score}%</span> : null}
        </div>
        {topic.prerequisites.length > 0 && (
          <p className="text-sm text-muted">
            {t.learn.buildsOn}:{' '}
            {topic.prerequisites.map((id, i) => {
              const pre = findTopic(id);
              return pre ? (
                <span key={id}>{i > 0 && ', '}<Link to={`/learn/topic/${id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">{pre.topic.title[locale]}</Link></span>
              ) : null;
            })}
          </p>
        )}
      </header>

      <nav className="flex flex-wrap gap-2" aria-label={topic.title[locale]}>
        <Link to={`/learn/topic/${topicId}/quiz`} className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
          <Target className="size-4" aria-hidden="true" />{t.learn.takeQuiz}
        </Link>
        <Link to={`/tutor?topic=${topicId}`} className={cn(linkButton, 'border border-line bg-surface hover:bg-surface-2')}>
          <MessageCircle className="size-4" aria-hidden="true" />{t.learn.askTutor}
        </Link>
        <Link to={`/videos?topic=${topicId}`} className={cn(linkButton, 'border border-line bg-surface hover:bg-surface-2')}>
          <Clapperboard className="size-4" aria-hidden="true" />{t.videos.watchVideo}
        </Link>
        <Link to={`/podcasts?topic=${topicId}`} className={cn(linkButton, 'border border-line bg-surface hover:bg-surface-2')}>
          <Headphones className="size-4" aria-hidden="true" />{t.podcasts.listen}
        </Link>
      </nav>

      {!lesson.data && !lesson.loading && (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
            <BookOpen className="size-7" aria-hidden="true" />
          </span>
          {lesson.error && <Alert tone="error" className="w-full text-start">{lesson.error}</Alert>}
          <Button size="lg" icon={<Sparkles className="size-5" />} onClick={generate}>
            {lesson.error ? t.common.tryAgain : t.learn.startLesson}
          </Button>
        </Card>
      )}

      {lesson.loading && (
        <Card className="space-y-4 p-6" aria-busy="true">
          <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.learn.writingLesson}</p>
          {[80, 95, 70, 88].map((w, i) => <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />)}
        </Card>
      )}

      {lesson.data && !lesson.loading && (
        <article className="space-y-6 animate-fade-up">
          <Card className="space-y-6 p-6 sm:p-8">
            <p className="text-xl font-medium leading-relaxed text-brand-700 dark:text-brand-200"><RichInline text={lesson.data.hook} /></p>
            {lesson.data.sections.map((s, i) => (
              <section key={i} className="space-y-2">
                {s.heading && <h2 className="text-xl font-semibold">{s.heading}</h2>}
                <Rich text={s.body} />
              </section>
            ))}
          </Card>

          {lesson.data.example.problem && (
            <Card className="space-y-3 border-brand-200 p-6 dark:border-brand-800">
              <h2 className="text-lg font-semibold">{t.learn.example}</h2>
              <Rich text={lesson.data.example.problem} />
              <ol className="space-y-2">
                {lesson.data.example.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                    <Rich text={s} className="min-w-0 flex-1" />
                  </li>
                ))}
              </ol>
              {lesson.data.example.answer && (
                <p className="rounded-xl bg-surface-2 px-4 py-2 font-medium">{t.learn.answer}: <RichInline text={lesson.data.example.answer} /></p>
              )}
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-3 text-lg font-semibold">{t.learn.keyPoints}</h2>
            <ul className="space-y-2">
              {lesson.data.keyPoints.map((k, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                  <span><RichInline text={k} /></span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">{t.learn.checkpoint}</h2>
            <QuestionCard key={lesson.data.checkpoint.prompt} question={lesson.data.checkpoint} topicId={topicId}
              onAnswered={() => markLesson(topicId)} onPractice={() => recordPractice(topicId)} />
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            {p?.lesson_done ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden="true" />{t.learn.lessonDone}
              </span>
            ) : (
              <Button variant="secondary" onClick={() => markLesson(topicId)}>{t.learn.markDone}</Button>
            )}
            <Link to={`/learn/topic/${topicId}/quiz`} className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
              <Target className="size-4" aria-hidden="true" />{t.learn.takeQuiz}
            </Link>
            <Button variant="ghost" icon={<RefreshCw className="size-4" />} onClick={generate}>{t.learn.rewrite}</Button>
          </div>
        </article>
      )}
    </div>
  );
}
