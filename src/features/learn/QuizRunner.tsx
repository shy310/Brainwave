import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Mascot } from '@/ui/Mascot';
import type { Question } from '@shared/learn';
import { QuestionCard } from './QuestionCard';
import { MASTERY_SCORE } from './progress';
import { track } from '@/features/stats/activity';

interface Props {
  questions: Question[];
  topicId?: string;
  onFinish?: (score: number) => void;
  onPractice?: () => void;
  /** Buttons shown on the results card. */
  resultActions?: ReactNode;
  /** Course text written answers are graded against. */
  context?: string;
  /** Each answer as it's checked (e.g. to remember the misses). */
  onQuestion?: (question: Question, correct: boolean) => void;
}

/** Plays a list of questions one at a time and shows the score at the end. */
export const QuizRunner = ({ questions, topicId, onFinish, onPractice, resultActions, context, onQuestion }: Props) => {
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
      track({ quizzes: 1 });
      setDone(true);
    }
  };

  if (done) {
    return (
      <Card className="relative space-y-5 overflow-hidden p-8 text-center animate-fade-up" aria-live="polite">
        {/* One burst of confetti for a mastered quiz; a calm, encouraging Wave otherwise. */}
        {score >= MASTERY_SCORE && <Confetti />}
        <Mascot mood={score >= MASTERY_SCORE ? 'celebrating' : 'encouraging'} size={132} className="mx-auto" />
        <div>
          <h2 className="text-2xl font-bold">{t.quiz.resultTitle}</h2>
          <p className="mt-1 font-display text-5xl font-extrabold tabular-nums text-brand-700 dark:text-brand-200">{score}%</p>
          <p className="mt-1 text-muted">{t.quiz.score(correct, questions.length)}</p>
        </div>
        <div className="mx-auto flex max-w-xs justify-center gap-1" aria-hidden="true">
          {results.map((ok, i) => <span key={i} className={cn('h-2 flex-1 rounded-full', ok ? 'bg-emerald-400' : 'bg-coral-400')} />)}
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
            <span key={i} className={cn('h-2 flex-1 rounded-full transition-colors duration-300',
              i < results.length ? (results[i] ? 'bg-emerald-400' : 'bg-coral-400') : i === index ? 'bg-brand-500' : 'bg-surface-2')} />
          ))}
        </div>
      </div>
      <QuestionCard
        key={index}
        question={question}
        topicId={topicId}
        context={context}
        onAnswered={(ok) => {
          if (results.length <= index) onQuestion?.(question, ok);
          setResults((r) => (r.length > index ? r : [...r, ok]));
        }}
        onPractice={onPractice}
        footer={answeredCurrent && (
          <Button size="lg" block onClick={next}>{index + 1 < questions.length ? t.quiz.next : t.quiz.finish}</Button>
        )}
      />
    </Card>
  );
};

const CONFETTI = ['#3268f5', '#ffd35a', '#32cba0', '#ff826f', '#9560ec', '#518cff'];
/** A single, short confetti burst (CSS only; nothing under reduced motion). */
const Confetti = () => (
  <div className="confetti pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden="true">
    {Array.from({ length: 28 }, (_, i) => (
      <span key={i} style={{
        insetInlineStart: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length],
        '--dx': `${((i * 53) % 80) - 40}px`, '--r': `${(i * 97) % 540}deg`, animationDelay: `${(i % 7) * 40}ms`,
      } as CSSProperties} />
    ))}
  </div>
);
