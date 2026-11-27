import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, RefreshCw, Sparkles, Timer } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Shimmer } from '@/ui/Feedback';
import { formatTime } from '@/features/lectures/audio';
import { lectureRepo, type StudyLecture } from '@/features/lectures/repo';
import { markedSegments } from '@shared/marks';
import {
  MAX_PREDICT_CHARS, MAX_PREDICT_LECTURES, cleanPrediction, mockMinutes, predictionText,
  type ExamPredictOutput, type Likelihood, type Prediction,
} from '@shared/examPredict';

const PILL: Record<Likelihood, string> = {
  high: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  medium: 'bg-amber-400/20 text-amber-800 dark:text-amber-300',
  low: 'bg-surface-2 text-muted',
};

/**
 * "Predict my exam": the AI reads the exam's lectures for what the lecturer
 * stressed and ranks the likely topics, each with the evidence, then writes a
 * mock exam that leans on them.
 */
export const ExamPredictor = ({ examTitle, prediction, lectures, title, onSave, onStart }: {
  examTitle: string;
  prediction: Prediction | null | undefined;
  lectures: StudyLecture[];
  title: (l: StudyLecture) => string;
  onSave: (p: Prediction) => void;
  onStart: (p: Prediction) => void;
}) => {
  const { t } = useI18n();
  const tp = t.exams.predict;
  const toMessage = useAiError();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const names = new Map(lectures.map((l) => [l.id, title(l)]));

  const predict = async () => {
    setBusy(true);
    setError('');
    try {
      const picked = lectures.slice(0, MAX_PREDICT_LECTURES);
      const full = (await Promise.all(picked.map((l) => lectureRepo.get(l.id)))).filter((l) => !!l);
      const budget = Math.floor(MAX_PREDICT_CHARS / Math.max(1, full.length)) - 300;
      const input = full.map((l, i) => ({
        n: i + 1, title: title(l).slice(0, 200),
        text: predictionText(l, markedSegments(l.segments, l.marks ?? []), budget),
      })).filter((l) => l.text.trim().length > 40);
      if (!input.length) { setError(tp.noText); return; }
      const used = full.filter((_, i) => input.some((x) => x.n === i + 1));
      const out = await callAi<ExamPredictOutput>('examPredict', { exam: examTitle.slice(0, 200), lectures: input.map((x, k) => ({ ...x, n: k + 1 })) });
      onSave({
        createdAt: new Date().toISOString(),
        topics: cleanPrediction(out, used.map((l) => l.id), used.map((l) => l.segments.at(-1)?.start ?? 0)),
        questions: out.questions,
      });
      setOpen(null);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="exam-predict" className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <h2 id="exam-predict" className="flex-1 text-sm font-semibold text-muted">{tp.title}</h2>
        {prediction && !busy && (
          <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => void predict()}>{tp.again}</Button>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      {!prediction || busy ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-700 dark:text-brand-300"><Sparkles className="size-6" aria-hidden="true" /></span>
          {busy ? <Shimmer text={tp.reading} /> : (
            <>
              <p className="max-w-sm text-sm text-muted">{tp.body}</p>
              <Button onClick={() => void predict()} disabled={!lectures.length}>{tp.make}</Button>
            </>
          )}
        </Card>
      ) : (
        <Card className="space-y-4 p-4 sm:p-5">
          <ol className="divide-y divide-line">
            {prediction.topics.map((topic, i) => (
              <li key={i} className="py-1">
                <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-surface-2">
                  <span className={cn('w-[5.75rem] shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold', PILL[topic.likelihood])}>{tp.likelihood[topic.likelihood]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium" dir="auto">{topic.title}</span>
                    <span className="block text-sm text-muted" dir="auto">{topic.why}</span>
                  </span>
                  {topic.evidence.length > 0 && <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform', open === i && 'rotate-180')} aria-hidden="true" />}
                </button>
                {open === i && topic.evidence.length > 0 && (
                  <ul className="mb-2 ms-2 space-y-2 border-s-2 border-line ps-3 animate-fade-up">
                    {topic.evidence.map((e, k) => (
                      <li key={k} className="text-sm">
                        <q className="italic" dir="auto">{e.quote}</q>
                        <Link to={`/lectures/${e.lectureId}${e.at !== undefined ? `?t=${e.at}` : ''}`}
                          className="ms-1 whitespace-nowrap font-medium text-brand-700 hover:underline dark:text-brand-300">
                          {names.get(e.lectureId) ?? ''}{e.at !== undefined ? ` · ${formatTime(e.at)}` : ''}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button icon={<Timer className="size-4" />} onClick={() => onStart(prediction)}>{tp.mock}</Button>
            <span className="text-sm text-muted">{tp.mockInfo(prediction.questions.length, mockMinutes(prediction.questions))}</span>
          </div>
          <p className="text-xs text-muted">{tp.disclaimer}</p>
        </Card>
      )}
    </section>
  );
};
