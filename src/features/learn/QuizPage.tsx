import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { MessageCircle, RotateCcw, Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { findTopic } from '@shared/curriculum';
import { DIFFICULTIES, type Difficulty, type Quiz } from '@shared/learn';
import { BackLink } from './CoursePage';
import { QuestionCard } from './QuestionCard';
import { useProgress } from './ProgressProvider';
import { MASTERY_SCORE } from './progress';
import { linkButton } from './TopicPage';
import { useAiTask } from './useAiTask';

const COUNTS = ['3', '5', '8'] as const;

export default function QuizPage() {
  const { topicId = '' } = useParams();
  const { t, locale } = useI18n();
  const { recordQuiz, recordPractice } = useProgress();
  const quiz = useAiTask<Quiz>();
  const [count, setCount] = useState<(typeof COUNTS)[number]>('5');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const ref = findTopic(topicId);
  if (!ref) return <Alert tone="error">{t.learn.topicNotFound}</Alert>;

  const start = async () => {
    setIndex(0); setResults([]); setDone(false);
    await quiz.run((signal) => callAi<Quiz>('quiz', { topicId, count: Number(count), difficulty }, signal));
  };

  const questions = quiz.data?.questions ?? [];
  const answeredCurrent = results.length > index;

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      requestAnimationFrame(() => heading.current?.focus());
    } else {
      const score = Math.round((results.filter(Boolean).length / questions.length) * 100);
      recordQuiz(topicId, score);
      setDone(true);
    }
  };

  const correct = results.filter(Boolean).length;
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink to={`/learn/topic/${topicId}`} label={ref.topic.title[locale]} />
      <h1 className="text-2xl font-semibold tracking-tight">{t.quiz.title}: {ref.topic.title[locale]}</h1>

      {!quiz.data && !quiz.loading && (
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold">{t.quiz.setupTitle}</h2>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t.quiz.count}</p>
            <Segmented label={t.quiz.count} value={count} onChange={setCount} options={COUNTS.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t.quiz.difficulty}</p>
            <Segmented label={t.quiz.difficulty} value={difficulty} onChange={setDifficulty}
              options={DIFFICULTIES.map((d) => ({ value: d, label: t.quiz.levels[d] }))} />
          </div>
          {quiz.error && <Alert tone="error">{quiz.error}</Alert>}
          <Button size="lg" onClick={start}>{quiz.error ? t.common.tryAgain : t.quiz.start}</Button>
        </Card>
      )}

      {quiz.loading && (
        <Card className="flex items-center gap-3 p-6 text-muted" aria-busy="true"><Spinner className="size-5" />{t.quiz.writing}</Card>
      )}

      {quiz.data && !quiz.loading && !done && questions[index] && (
        <Card className="space-y-5 p-6">
          <div className="space-y-2">
            <h2 ref={heading} tabIndex={-1} className="text-sm font-medium text-muted outline-none">{t.quiz.progress(index + 1, questions.length)}</h2>
            <div className="flex gap-1" aria-hidden="true">
              {questions.map((_, i) => (
                <span key={i} className={cn('h-1.5 flex-1 rounded-full',
                  i < results.length ? (results[i] ? 'bg-emerald-500' : 'bg-rose-400') : i === index ? 'bg-brand-500' : 'bg-surface-2')} />
              ))}
            </div>
          </div>
          <QuestionCard
            key={index}
            question={questions[index]}
            topicId={topicId}
            onAnswered={(ok) => setResults((r) => (r.length > index ? r : [...r, ok]))}
            onPractice={() => recordPractice(topicId)}
            footer={answeredCurrent && (
              <Button size="lg" block onClick={next}>{index + 1 < questions.length ? t.quiz.next : t.quiz.finish}</Button>
            )}
          />
        </Card>
      )}

      {done && (
        <Card className="space-y-5 p-8 text-center animate-fade-up" aria-live="polite">
          <span className={cn('mx-auto flex size-16 items-center justify-center rounded-full',
            score >= MASTERY_SCORE ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40')}>
            <Trophy className="size-8" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold">{t.quiz.resultTitle}</h2>
            <p className="mt-1 text-4xl font-bold tabular-nums">{score}%</p>
            <p className="mt-1 text-muted">{t.quiz.score(correct, questions.length)}</p>
          </div>
          <p>{score >= MASTERY_SCORE ? t.quiz.masteredMsg : t.quiz.keepGoing}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<RotateCcw className="size-4" />} onClick={() => { quiz.reset(); setDone(false); }}>{t.quiz.retry}</Button>
            <Link to={`/tutor?topic=${topicId}`} className={cn(linkButton, 'border border-line bg-surface hover:bg-surface-2')}>
              <MessageCircle className="size-4" aria-hidden="true" />{t.learn.askTutor}
            </Link>
            <Link to={`/learn/topic/${topicId}`} className={cn(linkButton, 'hover:bg-surface-2')}>{t.quiz.backToTopic}</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
