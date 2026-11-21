import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { History, PenLine, RotateCcw, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Select, Textarea } from '@/ui/Field';
import { Rich } from '@/ui/Rich';
import { MAX_GRADED_ANSWER, type GradeAnswer } from '@shared/grading';
import { MAX_SLIDES_CHARS } from '@shared/lectures';
import { lectureRepo, transcriptOf, type LectureSummary } from '@/features/lectures/repo';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { addAttempt, graderRepo, loadTasks, taskId, type Task } from './history';

const DRAFT_KEY = 'bw.grader.draft';
interface Draft { question: string; answer: string; rubric: string; lectureId: string }

const TONE = {
  correct: 'text-emerald-600 dark:text-emerald-400',
  partial: 'text-amber-600 dark:text-amber-400',
  incorrect: 'text-rose-600 dark:text-rose-400',
} as const;

/** Paste any answer or essay and get a score, criteria, feedback and an improved version. */
export default function GraderPage() {
  const { t, locale } = useI18n();
  const tg = t.grader;
  const toMessage = useAiError();
  const saved = useMemo(() => { try { return JSON.parse(storage.get(DRAFT_KEY) ?? 'null') as Draft | null; } catch { return null; } }, []);
  const [question, setQuestion] = useState(saved?.question ?? '');
  const [answer, setAnswer] = useState(saved?.answer ?? '');
  const [rubric, setRubric] = useState(saved?.rubric ?? '');
  const [lectureId, setLectureId] = useState(saved?.lectureId ?? '');
  const [lectures, setLectures] = useState<LectureSummary[]>([]);
  const [result, setResult] = useState<GradeAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showImproved, setShowImproved] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { lectureRepo.list().then((l) => setLectures(l.filter((x) => x.status === 'ready'))).catch(() => {}); }, []);
  // History from every device (this browser's copy shows first).
  useEffect(() => { graderRepo.list().then(setTasks).catch(() => {}); }, []);

  // Keep the draft on this device, so nothing is lost if the page closes.
  useEffect(() => {
    const id = setTimeout(() => storage.set(DRAFT_KEY, JSON.stringify({ question, answer, rubric, lectureId } satisfies Draft)), 400);
    return () => clearTimeout(id);
  }, [question, answer, rubric, lectureId]);

  const task = tasks.find((x) => x.id === taskId(question));

  const grade = async (e: FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 3 || !answer.trim()) return;
    setBusy(true);
    setError('');
    try {
      let context: string | undefined;
      if (lectureId) {
        const l = await lectureRepo.get(lectureId);
        if (l) context = [transcriptOf(l), l.slides_text?.slice(0, MAX_SLIDES_CHARS)].filter(Boolean).join('\n\n').slice(0, 20_000);
      }
      const g = await callAi<GradeAnswer>('gradeAnswer', {
        question: question.trim(), answer: answer.trim(), rubric: rubric.trim() || undefined, context, kind: 'essay',
      });
      setResult(g);
      setShowImproved(false);
      const next = addAttempt(tasks, question.trim(), rubric.trim(), { at: Date.now(), answer: answer.trim(), grade: g });
      setTasks(next);
      void graderRepo.save(next[0], next);
      requestAnimationFrame(() => document.getElementById('grade-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const reopen = (x: Task) => {
    const last = x.attempts.at(-1);
    setQuestion(x.question);
    setRubric(x.rubric);
    setAnswer(last?.answer ?? '');
    setResult(last?.grade ?? null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fresh = () => { setQuestion(''); setAnswer(''); setRubric(''); setLectureId(''); setResult(null); setError(''); };
  const date = (ms: number) => new Date(ms).toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{tg.title}</h1>
        <p className="text-muted">{tg.subtitle}</p>
      </header>

      <Card className="p-6">
        <form onSubmit={grade} className="space-y-4">
          <Field label={tg.question}>
            {(id) => <Textarea id={id} rows={3} maxLength={4000} value={question} placeholder={tg.questionPlaceholder} dir="auto" onChange={(e) => setQuestion(e.target.value)} />}
          </Field>
          <Field label={tg.answer} hint={tg.chars(answer.length, MAX_GRADED_ANSWER)}>
            {(id) => <Textarea ref={answerRef} id={id} rows={8} maxLength={MAX_GRADED_ANSWER} value={answer} placeholder={tg.answerPlaceholder} dir="auto" onChange={(e) => setAnswer(e.target.value)} />}
          </Field>
          <Field label={tg.rubric}>
            {(id) => <Textarea id={id} rows={2} maxLength={3000} value={rubric} placeholder={tg.rubricPlaceholder} dir="auto" onChange={(e) => setRubric(e.target.value)} />}
          </Field>
          {lectures.length > 0 && (
            <Field label={tg.lecture}>
              {(id) => (
                <Select id={id} value={lectureId} onChange={(e) => setLectureId(e.target.value)}>
                  <option value="">{tg.noLecture}</option>
                  {lectures.map((l) => <option key={l.id} value={l.id}>{lectureTitle(l, t.lectures.untitled, locale)}</option>)}
                </Select>
              )}
            </Field>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" loading={busy} icon={<Sparkles className="size-5" />} disabled={question.trim().length < 3 || !answer.trim()}>
              {busy ? tg.grading : tg.grade}
            </Button>
            {(question || answer) && <Button variant="ghost" onClick={fresh}>{tg.newTask}</Button>}
          </div>
          <p className="text-xs text-muted">{tg.draftSaved}</p>
        </form>
      </Card>

      {result && (
        <section id="grade-result" className="space-y-4 scroll-mt-20" aria-live="polite">
          <Card className="flex items-center gap-5 p-6">
            <p className={cn('text-5xl font-bold tabular-nums', TONE[result.verdict])}>{result.score}<span className="text-xl text-muted">/100</span></p>
            <div className="min-w-0">
              <p className={cn('text-lg font-semibold', TONE[result.verdict])}>{tg.verdicts[result.verdict]}</p>
              <p className="text-sm text-muted" dir="auto">{result.feedback}</p>
            </div>
          </Card>

          <ul className="grid gap-3 sm:grid-cols-2" aria-label={t.grader.feedback}>
            {result.criteria.map((c, i) => (
              <li key={i}>
                <Card className="h-full space-y-2 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium" dir="auto">{c.name}</p>
                    <p className="tabular-nums font-semibold">{c.score}/10</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <div className={cn('h-full rounded-full', c.score >= 7 ? 'bg-emerald-500' : c.score >= 4 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${c.score * 10}%` }} />
                  </div>
                  <p className="text-sm text-muted" dir="auto">{c.comment}</p>
                </Card>
              </li>
            ))}
          </ul>

          {(result.strengths.length > 0 || result.improvements.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.strengths.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-2 font-semibold">{tg.strengths}</h2>
                  <ul className="list-disc space-y-1 ps-5 text-sm">{result.strengths.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul>
                </Card>
              )}
              {result.improvements.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-2 font-semibold">{tg.improvements}</h2>
                  <ul className="list-disc space-y-1 ps-5 text-sm">{result.improvements.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul>
                </Card>
              )}
            </div>
          )}

          {result.improved && (
            <Card className="space-y-3 p-4">
              <Button variant="secondary" size="sm" aria-expanded={showImproved} onClick={() => setShowImproved((v) => !v)}>
                {showImproved ? tg.hideImproved : tg.showImproved}
              </Button>
              {showImproved && <div><h2 className="mb-2 font-semibold">{tg.improved}</h2><Rich text={result.improved} /></div>}
            </Card>
          )}

          <Button icon={<PenLine className="size-4" />} onClick={() => { answerRef.current?.focus(); answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
            {tg.tryAgain}
          </Button>
        </section>
      )}

      {task && task.attempts.length > 1 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><History className="size-4" aria-hidden="true" />{tg.attempts}</h2>
          <ol className="space-y-1 text-sm">
            {task.attempts.map((a, i) => {
              const delta = i > 0 ? a.grade.score - task.attempts[i - 1].grade.score : 0;
              return (
                <li key={a.at} className="flex items-center gap-3">
                  <span className="w-20 text-muted">{tg.attempt(i + 1)}</span>
                  <span className="font-semibold tabular-nums">{a.grade.score}</span>
                  {delta > 0 && <span className="text-xs font-medium text-emerald-600">{tg.better(delta)}</span>}
                  <span className="ms-auto text-xs text-muted">{date(a.at)}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {tasks.filter((x) => x.id !== task?.id).length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><RotateCcw className="size-4" aria-hidden="true" />{tg.pastTasks}</h2>
          <ul className="divide-y divide-line">
            {tasks.filter((x) => x.id !== task?.id).slice(0, 8).map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate" dir="auto">{x.question}</span>
                <span className="font-semibold tabular-nums">{x.attempts.at(-1)?.grade.score}</span>
                <Button size="sm" variant="ghost" onClick={() => reopen(x)}>{tg.reopen}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
