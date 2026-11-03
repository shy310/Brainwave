import { useRef, useState, type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import type { Question } from '@shared/learn';
import { QuestionCard } from './QuestionCard';
import { MASTERY_SCORE } from './progress';

interface Props {
  questions: Question[];
  topicId?: string;
  onFinish?: (score: number) => void;
  onPractice?: () => void;
  /** Buttons shown on the results card. */
  resultActions?: ReactNode;
}

/** Plays a list of questions one at a time and shows the score at the end. */
export const QuizRunner = ({ questions, topicId, onFinish, onPractice, resultActions }: Props) => {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const correct = results.filter(Boolean).length;
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      requestAnimationFrame(() => heading.current?.focus());
    } else {
      onFinish?.(score);
      setDone(true);
    }
  };

  if (done) {
    return (
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
        {resultActions && <div className="flex flex-wrap justify-center gap-2">{resultActions}</div>}
      </Card>
    );
  }

  const question = questions[index];
  if (!question) return null;
  const answeredCurrent = results.length > index;

  return (
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
        question={question}
        topicId={topicId}
        onAnswered={(ok) => setResults((r) => (r.length > index ? r : [...r, ok]))}
        onPractice={onPractice}
        footer={answeredCurrent && (
          <Button size="lg" block onClick={next}>{index + 1 < questions.length ? t.quiz.next : t.quiz.finish}</Button>
        )}
      />
    </Card>
  );
};
