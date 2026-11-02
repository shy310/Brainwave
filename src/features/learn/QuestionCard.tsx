import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Lightbulb, ListOrdered, Repeat, TrendingDown, X } from 'lucide-react';
import { useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { Rich, RichInline } from '@/ui/Rich';
import { Spinner } from '@/ui/Spinner';
import { Alert } from '@/ui/Alert';
import type { GradeResult, Question, Steps } from '@shared/learn';
import { useAiTask } from './useAiTask';

interface Verdict { correct: boolean; feedback?: string }

interface Props {
  question: Question;
  topicId?: string;
  /** Called once, when the student checks their answer. */
  onAnswered?: (correct: boolean) => void;
  /** Rendered after answering (e.g. a Next button). */
  footer?: ReactNode;
  /** Offer worked steps and practice questions after answering. */
  extras?: boolean;
  onPractice?: () => void;
}

export const QuestionCard = ({ question, topicId, onAnswered, footer, extras = true, onPractice }: Props) => {
  const t = useT();
  const inputId = useId();
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const steps = useAiTask<Steps>();
  const practice = useAiTask<Question>();

  const answered = verdict !== null;

  const finish = (v: Verdict) => { setVerdict(v); onAnswered?.(v.correct); };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (answered || checking) return;
    if (question.kind === 'choice') {
      if (choice === null) return;
      finish({ correct: choice === question.correctIndex });
      return;
    }
    if (!typed.trim()) return;
    setChecking(true);
    try {
      const { checkAnswer } = await import('@shared/math/check');
      const local = checkAnswer(typed, question.answer, question.accepted);
      if (local.method !== 'unsure') { finish({ correct: local.correct }); return; }
      const graded = await callAi<GradeResult>('grade', {
        prompt: question.prompt, expected: question.answer, accepted: question.accepted, given: typed.trim(),
      });
      finish(graded);
    } catch {
      finish({ correct: false });
    } finally {
      setChecking(false);
    }
  };

  const loadSteps = () => steps.run((signal) =>
    callAi<Steps>('steps', { problem: question.prompt, answer: question.answer, topicId }, signal));

  const loadPractice = (mode: 'similar' | 'easier') => practice.run(async (signal) =>
    (await callAi<{ question: Question }>('practice', { question, mode, topicId }, signal)).question);

  return (
    <div className="space-y-4">
      <Rich text={question.prompt} className="text-lg" />

      <form onSubmit={submit} className="space-y-3">
        {question.kind === 'choice' ? (
          <div role="radiogroup" aria-label={t.quiz.yourAnswer} className="grid gap-2">
            {question.options.map((opt, i) => {
              const isAnswer = answered && i === question.correctIndex;
              const isWrongPick = answered && i === choice && !verdict.correct;
              return (
                <button key={i} type="button" role="radio" aria-checked={choice === i} disabled={answered}
                  onClick={() => setChoice(i)}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2.5 text-start transition-colors',
                    !answered && (choice === i ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-900/30' : 'border-line hover:bg-surface-2'),
                    isAnswer && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                    isWrongPick && 'border-rose-400 bg-rose-50 dark:bg-rose-950/40',
                    answered && !isAnswer && !isWrongPick && 'border-line opacity-60',
                  )}>
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                    choice === i ? 'border-brand-500 text-brand-600' : 'border-line text-muted')}>
                    {isAnswer ? <Check className="size-4 text-emerald-600" aria-hidden="true" />
                      : isWrongPick ? <X className="size-4 text-rose-600" aria-hidden="true" /> : String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1"><RichInline text={opt} /></span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="sr-only">{t.quiz.yourAnswer}</label>
            <Input id={inputId} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={answered || checking}
              placeholder={t.quiz.answerPlaceholder} autoComplete="off" dir="auto"
              className={cn(answered && (verdict.correct ? 'border-emerald-500' : 'border-rose-400'))} />
          </div>
        )}

        {!answered && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={checking}
              disabled={question.kind === 'choice' ? choice === null : !typed.trim()}>
              {checking ? t.quiz.checking : t.quiz.check}
            </Button>
            {question.hint && !showHint && (
              <Button variant="ghost" icon={<Lightbulb className="size-4" />} onClick={() => setShowHint(true)}>{t.quiz.hint}</Button>
            )}
          </div>
        )}
      </form>

      {showHint && !answered && <Alert><RichInline text={question.hint} /></Alert>}

      {answered && (
        <div className="space-y-4 animate-fade-up" aria-live="polite">
          <div className={cn('rounded-xl border p-4',
            verdict.correct ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40')}>
            <p className="flex items-center gap-2 font-semibold">
              {verdict.correct ? <Check className="size-5 text-emerald-600" aria-hidden="true" /> : <X className="size-5 text-rose-600" aria-hidden="true" />}
              {verdict.correct ? t.quiz.correct : t.quiz.incorrect}
            </p>
            {verdict.feedback && <p className="mt-1 text-sm">{verdict.feedback}</p>}
            {!verdict.correct && (
              <p className="mt-2 text-sm"><span className="font-medium">{t.quiz.answerWas}: </span><RichInline text={question.kind === 'choice' ? question.options[question.correctIndex] ?? question.answer : question.answer} /></p>
            )}
            <div className="mt-3 border-t border-black/5 pt-3 text-sm dark:border-white/10">
              <Rich text={question.explanation} />
            </div>
          </div>

          {extras && (
            <div className="flex flex-wrap gap-2">
              {!steps.data && (
                <Button variant="secondary" size="sm" icon={<ListOrdered className="size-4" />} loading={steps.loading} onClick={loadSteps}>
                  {t.quiz.showSteps}
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={<Repeat className="size-4" />} disabled={practice.loading} onClick={() => loadPractice('similar')}>
                {t.quiz.practiceSimilar}
              </Button>
              {!verdict.correct && (
                <Button variant="secondary" size="sm" icon={<TrendingDown className="size-4" />} disabled={practice.loading} onClick={() => loadPractice('easier')}>
                  {t.quiz.practiceEasier}
                </Button>
              )}
            </div>
          )}

          {steps.error && <Alert tone="error">{steps.error}</Alert>}
          {steps.data && (
            <section className="rounded-xl border border-line p-4" aria-label={t.quiz.steps}>
              <h3 className="mb-3 font-semibold">{t.quiz.steps}</h3>
              <ol className="space-y-3">
                {steps.data.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.title}</p>
                      <Rich text={s.body} className="text-sm text-muted" />
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 font-medium">{t.learn.answer}: <RichInline text={steps.data.answer} /></p>
            </section>
          )}

          {practice.loading && <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" />{t.quiz.makingPractice}</p>}
          {practice.error && <Alert tone="error">{practice.error}</Alert>}
          {practice.data && (
            <section className="rounded-xl border border-dashed border-brand-300 p-4 dark:border-brand-700" aria-label={t.quiz.practiceTitle}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">{t.quiz.practiceTitle}</p>
              <QuestionCard key={practice.data.prompt} question={practice.data} topicId={topicId} extras={false}
                onAnswered={() => onPractice?.()} />
            </section>
          )}

          {footer}
        </div>
      )}
    </div>
  );
};
