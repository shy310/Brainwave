import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { MessageCircle, RotateCcw } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Mascot } from '@/ui/Mascot';
import { WaveLoader } from '@/ui/Wave';
import { findTopic } from '@shared/curriculum';
import { DIFFICULTIES, type Difficulty, type Quiz } from '@shared/learn';
import { BackLink } from './CoursePage';
import { QuizRunner } from './QuizRunner';
import { useProgress } from './ProgressProvider';
import { linkButton } from './TopicPage';
import { useAiTask } from './useAiTask';
import { SUBJECT_META } from './subjects';
import { SubjectArt } from './SubjectArt';

const COUNTS = ['3', '5', '8'] as const;

export default function QuizPage() {
  const { topicId = '' } = useParams();
  const { t, locale } = useI18n();
  const { recordQuiz, recordPractice } = useProgress();
  const quiz = useAiTask<Quiz>();
  const [count, setCount] = useState<(typeof COUNTS)[number]>('5');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [round, setRound] = useState(0);

  const ref = findTopic(topicId);
  if (!ref) return (
    <div className="space-y-4">
      <BackLink to="/learn" label={t.learn.backToLearn} />
      <h1 className="sr-only">{t.learn.topicNotFound}</h1>
      <Alert tone="error">{t.learn.topicNotFound}</Alert>
    </div>
  );

  const meta = SUBJECT_META[ref.course.subject];
  const start = async () => {
    setRound((r) => r + 1);
    await quiz.run((signal) => callAi<Quiz>('quiz', { topicId, count: Number(count), difficulty }, signal));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink to={`/learn/topic/${topicId}`} label={ref.topic.title[locale]} />
      {/* The subject's field, as on its course page: this quiz belongs to that world. */}
      <header className={cn('relative flex items-end overflow-hidden rounded-[var(--radius-card)] p-5 text-white shadow-[var(--shadow-lift)] sm:min-h-36 sm:p-6', meta.field)}>
        <h1 className="relative z-10 min-w-0 flex-1 text-2xl font-bold leading-tight sm:text-3xl">{t.quiz.title}: {ref.topic.title[locale]}</h1>
        <SubjectArt subject={ref.course.subject} className="pointer-events-none -my-3 -me-3 h-20 w-32 shrink-0 sm:h-28 sm:w-48" />
      </header>

      {!quiz.data && !quiz.loading && (
        <Card className="space-y-6 p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold">{t.quiz.setupTitle}</h2>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t.quiz.count}</p>
            <div role="radiogroup" aria-label={t.quiz.count} className="flex gap-2">
              {COUNTS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={count === c} onClick={() => setCount(c)}
                  className={cn('flex size-14 items-center justify-center rounded-2xl border-2 font-display text-2xl font-bold tabular-nums transition-[border-color,background-color,color,transform] duration-200 active:scale-95',
                    count === c ? 'border-brand-500 bg-brand-600 text-white shadow-[0_3px_0_var(--color-brand-800)]' : 'border-line bg-surface text-fg hover:border-brand-200 dark:hover:border-brand-800')}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t.quiz.difficulty}</p>
            <div role="radiogroup" aria-label={t.quiz.difficulty} className="grid grid-cols-3 gap-2 sm:max-w-md">
              {DIFFICULTIES.map((d, i) => (
                <button key={d} type="button" role="radio" aria-checked={difficulty === d} onClick={() => setDifficulty(d)}
                  className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1.5 py-2 text-sm font-semibold min-[400px]:flex-row min-[400px]:gap-2 transition-[border-color,background-color,transform] duration-200 active:scale-[0.97]',
                    difficulty === d ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100' : 'border-line bg-surface hover:border-brand-200 dark:hover:border-brand-800')}>
                  {/* One, two or three bars: how hard, at a glance. */}
                  <span className="flex items-end gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map((b) => <span key={b} className={cn('w-1 rounded-full', ['h-2', 'h-3', 'h-4'][b], b <= i ? 'bg-current' : 'bg-line')} />)}
                  </span>
                  {t.quiz.levels[d]}
                </button>
              ))}
            </div>
          </div>
          {quiz.error && <Alert tone="error">{quiz.error}</Alert>}
          <Button size="lg" onClick={start}>{quiz.error ? t.common.tryAgain : t.quiz.start}</Button>
        </Card>
      )}

      {quiz.loading && (
        <Card className="flex items-center gap-4 p-5" aria-busy="true">
          <Mascot mood="thinking" size={64} className="shrink-0" />
          <span className="flex items-center gap-3 font-medium text-muted">{t.quiz.writing}<WaveLoader /></span>
        </Card>
      )}

      {quiz.data && !quiz.loading && (
        <QuizRunner
          key={round}
          questions={quiz.data.questions}
          topicId={topicId}
          onFinish={(score) => recordQuiz(topicId, score)}
          onPractice={() => recordPractice(topicId)}
          resultActions={<>
            <Button icon={<RotateCcw className="size-4" />} onClick={() => quiz.reset()}>{t.quiz.retry}</Button>
            <Link to={`/tutor?topic=${topicId}`} className={cn(linkButton, 'border border-line bg-surface hover:bg-surface-2')}>
              <MessageCircle className="size-4" aria-hidden="true" />{t.learn.askTutor}
            </Link>
            <Link to={`/learn/topic/${topicId}`} className={cn(linkButton, 'hover:bg-surface-2')}>{t.quiz.backToTopic}</Link>
          </>}
        />
      )}
    </div>
  );
}
