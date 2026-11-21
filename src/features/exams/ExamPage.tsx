import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BookOpen, ClipboardList, Layers, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/Spinner';
import { askConfirm } from '@/ui/Confirm';
import { BackLink } from '@/features/learn/CoursePage';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { localDay } from '@shared/activity';
import { dateLocale } from '@shared/locales';
import { examPlan, type Exam, type PlanTask } from '@shared/exam';
import type { Question } from '@shared/learn';
import { examRepo } from './examRepo';
import { ExamSheet } from './ExamSheet';
import { ReadinessRing } from './ReadinessRing';
import { practiceQuestions } from './practice';
import { useExamStatus } from './useExamData';

const SHOWN_DAYS = 7;

/** One exam: the countdown, how ready you are, today's tasks, the plan, and practice exams. */
export default function ExamPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const te = t.exams;
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [practice, setPractice] = useState<Question[] | null>(null);
  const [round, setRound] = useState(0);
  const [allDays, setAllDays] = useState(false);
  useEffect(() => { examRepo.get(id).then(setExam).catch(() => setExam(null)); }, [id]);
  const status = useExamStatus(exam);

  const today = localDay();
  const plan = useMemo(() => (exam && status ? examPlan(status.lectures.map((l) => l.id), today, exam.date) : []), [exam, status, today]);
  const byId = useMemo(() => new Map(status?.lectures.map((l) => [l.id, l]) ?? []), [status]);

  if (exam === undefined || (exam && !status)) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (!exam || !status) return <Alert tone="error">{t.lectures.notFound}</Alert>;

  const fmt = (d: string, long = false) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(locale),
    long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
  const startPractice = () => {
    setPractice(practiceQuestions(status.lectures, status.title, t.game.from));
    setRound((r) => r + 1);
  };
  const finished = async (score: number) => {
    const next = { bestScore: Math.max(score, exam.bestScore ?? 0), attempts: exam.attempts + 1 };
    setExam({ ...exam, ...next });
    await examRepo.update(exam.id, next).catch(() => {});
  };
  const remove = async () => {
    if (!(await askConfirm({ message: te.confirmDelete, action: 'delete' }))) return;
    await examRepo.remove(exam.id);
    navigate('/exams', { replace: true });
  };
  const canPractice = practiceQuestions(status.lectures, status.title, t.game.from).length > 0;

  const Task = ({ task }: { task: PlanTask }) => {
    const row = 'pressable flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-start hover:bg-surface-2';
    const icon = 'flex size-8 shrink-0 items-center justify-center rounded-[10px]';
    if (task.kind === 'learn') {
      return (
        <>{task.lectureIds.map((lid) => byId.get(lid) && (
          <Link key={lid} to={`/lectures/${lid}`} className={row}>
            <span className={cn(icon, 'bg-brand-500/10 text-brand-700 dark:text-brand-300')}><BookOpen className="size-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 text-sm font-medium" dir="auto">{te.learn(status.title(byId.get(lid)!))}</span>
          </Link>
        ))}</>
      );
    }
    if (task.kind === 'review') {
      return (
        <Link to="/lectures/review" className={row}>
          <span className={cn(icon, 'bg-sky-500/12 text-sky-700 dark:text-sky-300')}><Layers className="size-4" aria-hidden="true" /></span>
          <span className="flex-1 text-sm font-medium">{te.review}</span>
        </Link>
      );
    }
    return (
      <button type="button" onClick={startPractice} disabled={!canPractice} className={cn(row, 'w-full disabled:opacity-50')}>
        <span className={cn(icon, 'bg-accent-400/20 text-accent-600 dark:text-accent-300')}><ClipboardList className="size-4" aria-hidden="true" /></span>
        <span className="flex-1 text-sm font-medium">{te.practice}</span>
      </button>
    );
  };

  if (practice) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <button type="button" onClick={() => setPractice(null)} className="text-sm font-medium text-muted hover:text-fg">‹ {te.back}</button>
        <h1 className="text-2xl font-semibold tracking-tight">{te.practiceTitle} · <span dir="auto">{exam.title}</span></h1>
        <QuizRunner key={round} questions={practice} onFinish={(s) => void finished(s)}
          resultActions={<>
            <Button onClick={startPractice}>{te.again}</Button>
            <Button variant="secondary" onClick={() => setPractice(null)}>{te.back}</Button>
          </>} />
      </div>
    );
  }

  const shown = allDays ? plan : plan.slice(0, SHOWN_DAYS);
  return (
    <div className="stagger mx-auto max-w-2xl space-y-6">
      <BackLink to="/exams" label={te.title} />
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight" dir="auto">{exam.title}</h1>
          <p className="mt-1 text-muted">{fmt(exam.date, true)} · {te.lectures(status.lectures.length)}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>{te.edit}</Button>
        <Button variant="ghost" size="sm" aria-label={te.delete} onClick={() => void remove()}><Trash2 className="size-4" aria-hidden="true" /></Button>
      </header>

      <Card className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-start">
        <ReadinessRing value={status.ready} size={104} label={te.ready(status.ready)} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-3xl font-bold tracking-tight">{status.days < 0 ? te.done : te.inDays(status.days)}</p>
          <p className="text-sm text-muted"><span className="font-medium text-fg">{te.readiness}:</span> {te.readinessHint}</p>
          {exam.attempts > 0 && <p className="text-sm text-muted">{te.best(exam.bestScore ?? 0)} · {te.attempts(exam.attempts)}</p>}
        </div>
        {status.days >= 0 && <Button size="lg" onClick={startPractice} disabled={!canPractice}>{te.start}</Button>}
      </Card>

      {!canPractice && <Alert>{te.noQuestions}</Alert>}
      {status.days === 0 && <Alert tone="success">{te.goodLuck}</Alert>}
      {status.days < 0 && <Alert>{te.over}</Alert>}

      {plan.length > 0 && (
        <section aria-labelledby="exam-plan" className="space-y-3">
          <h2 id="exam-plan" className="px-1 text-sm font-semibold text-muted">{te.plan}</h2>
          <ol className="space-y-3">
            {shown.map((d, i) => (
              <li key={d.date} className={cn('rounded-[var(--radius-card)] border bg-surface p-2 shadow-[var(--shadow-soft)]',
                i === 0 ? 'border-brand-300 ring-2 ring-brand-500/15 dark:border-brand-700' : 'border-line')}>
                <p className={cn('px-3 pb-1 pt-2 text-sm font-semibold', i === 0 ? 'text-brand-700 dark:text-brand-300' : 'text-muted')}>
                  {i === 0 ? te.today : fmt(d.date)}
                </p>
                <div className="space-y-0.5">{d.tasks.map((task, k) => <Task key={k} task={task} />)}</div>
              </li>
            ))}
          </ol>
          {plan.length > SHOWN_DAYS && !allDays && (
            <Button variant="ghost" block onClick={() => setAllDays(true)}>{te.plan} · {plan.length}</Button>
          )}
        </section>
      )}

      <ExamSheet key={editing ? 'open' : 'closed'} open={editing} onClose={() => setEditing(false)} exam={exam} pool={status.pool} title={status.title}
        onSave={async (n) => { await examRepo.update(exam.id, n); setExam({ ...exam, ...n }); }} />
    </div>
  );
}
