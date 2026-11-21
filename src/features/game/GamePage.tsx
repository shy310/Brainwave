import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Heart, Mountain, RotateCcw, Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RichInline } from '@/ui/Rich';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { lectureRepo } from '@/features/lectures/repo';
import { rate, reviewRepo } from '@/features/lectures/reviews';
import { track } from '@/features/stats/activity';
import { LIVES, SECONDS, answer, buildGame, start, type GameQuestion, type GameState, reachedSummit } from './game';

const BEST_KEY = 'bw.summit.best';
const FEEDBACK_MS = 1100;

type Phase = 'intro' | 'playing' | 'over';
interface Feedback { choice: number | null; right: boolean }

/** Summit: an original climbing quiz made from the student's own flashcards and quizzes. */
export default function GamePage() {
  const { t, locale } = useI18n();
  const tg = t.game;
  const [params] = useSearchParams();
  const folder = params.get('folder') ?? 'all';
  const [pool, setPool] = useState<Awaited<ReturnType<typeof lectureRepo.studyMaterial>> | null>(null);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [state, setState] = useState<GameState>(start);
  const [left, setLeft] = useState(SECONDS);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [best, setBest] = useState(() => Number(storage.get(BEST_KEY)) || 0);
  const [newBest, setNewBest] = useState(false);
  const reviews = useRef<ReturnType<typeof reviewRepo.list> | null>(null);

  useEffect(() => { lectureRepo.studyMaterial(folder).then(setPool).catch(() => setPool([])); }, [folder]);

  const title = useCallback((l: Parameters<typeof lectureTitle>[0]) => lectureTitle(l, t.lectures.untitled, locale), [t, locale]);
  const playable = useMemo(() => (pool ? buildGame(pool, title).length : 0), [pool, title]);
  const q = questions[state.index];

  const begin = () => {
    setQuestions(buildGame(pool ?? [], title));
    setState(start());
    setLeft(SECONDS);
    setFeedback(null);
    setNewBest(false);
    setPhase('playing');
  };

  const choose = useCallback((choice: number | null) => {
    if (phase !== 'playing' || feedback || !q) return;
    const right = choice === q.correct;
    setFeedback({ choice, right });
    // A missed flashcard comes back soon in Review.
    if (!right && q.card) {
      reviews.current ??= reviewRepo.list();
      void reviews.current.then((st) => rate(st, q.card!, 'again'));
    }
    const next = answer(state, q, choice, left, questions.length);
    setTimeout(() => {
      setFeedback(null);
      setState(next);
      setLeft(SECONDS);
      if (next.over) {
        setPhase('over');
        track({ quizzes: 1 });
        if (next.score > best) { setBest(next.score); setNewBest(true); storage.set(BEST_KEY, String(next.score)); }
      }
    }, FEEDBACK_MS);
  }, [phase, feedback, q, state, left, questions.length, best]);

  // The timer runs while a question is waiting for an answer. Time left comes
  // from the clock, so it stays right even when the browser delays ticks.
  useEffect(() => {
    if (phase !== 'playing' || feedback) return;
    const shownAt = Date.now();
    const id = setInterval(() => setLeft(Math.max(0, SECONDS - (Date.now() - shownAt) / 1000)), 100);
    return () => clearInterval(id);
  }, [phase, feedback, state.index]);

  useEffect(() => { if (phase === 'playing' && !feedback && left <= 0) choose(null); }, [phase, feedback, left, choose]);

  // Keys 1–4 answer.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= (q?.options.length ?? 0)) choose(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, choose]);

  if (!pool) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;

  const ledges = Math.max(questions.length, 1);
  const climb = (state.height / ledges) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />

      {phase === 'intro' && (
        <Card className="space-y-5 p-8 text-center">
          <span className="icon-tile relative mx-auto flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Mountain className="relative size-8" fill="currentColor" fillOpacity={0.2} aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{tg.name}</h1>
            <p className="text-muted">{tg.tagline}</p>
          </div>
          {playable === 0 ? <Alert>{tg.notEnough}</Alert> : (
            <>
              <ol className="mx-auto max-w-sm space-y-1 text-start text-sm">
                {tg.how.map((h, i) => <li key={i} className="flex gap-2"><span className="font-semibold text-brand-600 dark:text-brand-300">{i + 1}.</span>{h}</li>)}
              </ol>
              {best > 0 && <p className="text-sm text-muted">{tg.best(best)}</p>}
              <Button size="lg" onClick={begin}>{tg.start}</Button>
            </>
          )}
        </Card>
      )}

      {phase === 'playing' && q && (
        <div className="flex gap-4">
          {/* The mountain: ledges climbed so far. */}
          <div className="relative w-10 shrink-0 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-600 to-brand-400 transition-[height] duration-500 motion-reduce:transition-none" style={{ height: `${climb}%` }} />
            <span className="absolute start-1/2 flex size-7 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-accent-500 text-slate-950 shadow transition-[bottom] duration-500 motion-reduce:transition-none rtl:translate-x-1/2"
              style={{ bottom: `${climb}%` }}>
              <Mountain className="size-3.5" />
            </span>
          </div>

          <Card className="min-w-0 flex-1 space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold tabular-nums">{tg.score}: {state.score}</span>
              {state.combo > 1 && <span dir="ltr" className="rounded-full bg-accent-400/15 px-2 py-0.5 font-semibold text-accent-600">{tg.combo(state.combo)}</span>}
              <span className="ms-auto flex items-center gap-0.5" role="img" aria-label={tg.lives(state.lives)}>
                {Array.from({ length: LIVES }, (_, i) => (
                  <Heart key={i} className={cn('size-4', i < state.lives ? 'fill-rose-500 text-rose-500' : 'text-muted')} aria-hidden="true" />
                ))}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={tg.timeUp} aria-valuemin={0} aria-valuemax={SECONDS} aria-valuenow={Math.ceil(left)}>
              <div className={cn('h-full rounded-full transition-[width] duration-100 ease-linear motion-reduce:transition-none', left < 4 ? 'bg-rose-500' : 'bg-brand-500')}
                style={{ width: `${(left / SECONDS) * 100}%` }} />
            </div>
            <p className="text-xs text-muted">{tg.question(state.index + 1, questions.length)} · <span dir="auto">{tg.from(q.from)}</span></p>
            <h2 className="text-xl font-semibold" dir="auto"><RichInline text={q.prompt} /></h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const isRight = feedback && i === q.correct;
                const isWrongPick = feedback && !feedback.right && i === feedback.choice;
                return (
                  <button key={i} type="button" disabled={!!feedback} onClick={() => choose(i)}
                    className={cn('flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-start transition-colors',
                      !feedback && 'border-line hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30',
                      isRight && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                      isWrongPick && 'border-rose-400 bg-rose-50 dark:bg-rose-950/40',
                      feedback && !isRight && !isWrongPick && 'border-line opacity-50')}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold">{i + 1}</span>
                    <span className="min-w-0 flex-1" dir="auto"><RichInline text={o} /></span>
                  </button>
                );
              })}
            </div>
            <p className="min-h-5 text-sm font-semibold" aria-live="assertive">
              {feedback && (feedback.right ? <span className="text-emerald-600">{tg.right}</span>
                : <span className="text-rose-600">{feedback.choice === null ? tg.timeUp : tg.wrong}</span>)}
            </p>
            <p className="hidden text-xs text-muted sm:block">{tg.keys}</p>
          </Card>
        </div>
      )}

      {phase === 'over' && (
        <Card className="space-y-5 p-8 text-center" aria-live="polite">
          <Trophy className="mx-auto size-12 text-accent-500" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold">{reachedSummit(state) ? tg.summit : tg.over}</h1>
            <p className="mt-1 text-4xl font-bold tabular-nums">{state.score}</p>
            <p className="text-muted">{tg.climbed(state.height)} {newBest ? <strong className="text-accent-600">{tg.newBest}</strong> : tg.best(best)}</p>
          </div>
          {state.missed.length > 0 && (
            <div className="mx-auto max-w-lg text-start">
              <h2 className="mb-2 font-semibold">{tg.missed}</h2>
              <ul className="space-y-2 text-sm">
                {state.missed.map((i) => questions[i]).filter(Boolean).map((m, i) => (
                  <li key={i} className="rounded-xl border border-line p-3" dir="auto">
                    <RichInline text={m.prompt} /><br />
                    <span className="text-muted">{tg.answerWas} </span><RichInline text={m.options[m.correct]} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<RotateCcw className="size-4" />} onClick={begin}>{tg.again}</Button>
            <Link to="/lectures/review" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">{tg.reviewCards}</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
