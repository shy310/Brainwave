import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { MessageCircle, RotateCcw } from 'lucide-react';
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
import { QuizRunner } from './QuizRunner';
import { useProgress } from './ProgressProvider';
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
  const [round, setRound] = useState(0);

  const ref = findTopic(topicId);
  if (!ref) return <Alert tone="error">{t.learn.topicNotFound}</Alert>;

  const start = async () => {
    setRound((r) => r + 1);
    await quiz.run((signal) => callAi<Quiz>('quiz', { topicId, count: Number(count), difficulty }, signal));
  };

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
