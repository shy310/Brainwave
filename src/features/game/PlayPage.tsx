import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Heart, Pause, Play, RotateCcw, ShieldCheck, Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useHideTabBar } from '@/app/chrome';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RichInline } from '@/ui/Rich';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { rate, reviewRepo } from '@/features/lectures/reviews';
import { track } from '@/features/stats/activity';
import { LIVES, answer, crash, newRun, score, type Ask, type Run } from './game';
import { flap, recoverGlide, startGlide, stepGlide, PLANE_R, PLANE_X, W, H, type Glide } from './glide';
import { recoverRush, startRush, steer, stepRush, CAR_Y, type Rush } from './rush';
import { drawGlide, drawRush, drawShield, type Look } from './draw';
import { QuestionCard } from './QuestionCard';
import { useDeck } from './useDeck';

export type GameId = 'glide' | 'rush';
export const GAMES: GameId[] = ['glide', 'rush'];
export const bestKey = (g: GameId) => `bw.arcade.best.${g}`;

type Phase = 'ready' | 'playing' | 'question' | 'paused' | 'over';
type World = { kind: 'glide'; s: Glide } | { kind: 'rush'; s: Rush };

const fresh = (g: GameId): World => (g === 'glide' ? { kind: 'glide', s: startGlide() } : { kind: 'rush', s: startRush() });
const worldPoints = (w: World) => (w.kind === 'glide' ? w.s.passed * 10 : Math.floor(w.s.dist / 10));

/** One of the arcade games, with questions from the student's lectures at checkpoints and after crashes. */
export default function PlayPage() {
  const { game = '' } = useParams();
  const [params] = useSearchParams();
  const folder = params.get('folder') ?? 'all';
  const lectures = params.get('lectures')?.split(',').filter(Boolean);
  const query = params.toString();
  if (game !== 'glide' && game !== 'rush') return <Navigate to={`/play${query ? `?${query}` : ''}`} replace />;
  return <Game key={game} id={game} folder={folder} lectures={lectures} back={`/play${query ? `?${query}` : ''}`} />;
}

const Game = ({ id, folder, lectures, back }: { id: GameId; folder: string; lectures?: string[]; back: string }) => {
  const { t } = useI18n();
  const tg = t.game;
  const name = tg[id].name;
  const { loading, deck, next, reset } = useDeck(folder, lectures);
  // The game needs the whole screen on a phone.
  useHideTabBar();
  const [phase, setPhase] = useState<Phase>('ready');
  const [run, setRun] = useState<Run>(newRun);
  const [points, setPoints] = useState(0);
  const [ask, setAsk] = useState<{ kind: Ask; index: number; n: number } | null>(null);
  const [best, setBest] = useState(() => Number(storage.get(bestKey(id))) || 0);
  const [newBest, setNewBest] = useState(false);

  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World>(fresh(id));
  const runRef = useRef(run);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const reviews = useRef<ReturnType<typeof reviewRepo.list> | null>(null);
  const asked = useRef(0);

  const setRunBoth = (r: Run) => { runRef.current = r; setRun(r); };

  const openQuestion = useCallback((kind: Ask) => {
    if (!deck.length) return;
    asked.current += 1;
    setAsk({ kind, index: next(), n: asked.current });
    setPhase('question');
  }, [deck.length, next]);

  const recover = () => {
    const w = world.current;
    world.current = w.kind === 'glide' ? { kind: 'glide', s: recoverGlide(w.s) } : { kind: 'rush', s: recoverRush(w.s) };
  };

  // The game loop: step the world while playing, draw every frame.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    let raf = 0;
    let last = performance.now();
    const dark = () => document.documentElement.classList.contains('dark');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fit = () => {
      const ratio = Math.min(3, (window.devicePixelRatio || 1) * (el.clientWidth / W || 1));
      el.width = Math.round(W * ratio);
      el.height = Math.round(H * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phaseRef.current === 'playing') {
        const w = world.current;
        const r = w.kind === 'glide' ? stepGlide(w.s, dt, Math.random) : stepRush(w.s, dt, Math.random);
        world.current = { kind: w.kind, s: r.s } as World;
        const p = worldPoints(world.current);
        if (p !== runRef.current.points) { runRef.current = { ...runRef.current, points: p }; setPoints(p); }
        if (r.event === 'crash') {
          // A short buzz on phones that can, on the same frame as the crash.
          try { navigator.vibrate?.(40); } catch { /* not allowed */ }
          const c = crash(runRef.current);
          setRunBoth(c.run);
          if (c.ask) openQuestion(c.ask); else recover();
        } else if (r.event === 'checkpoint') openQuestion('checkpoint');
      }
      const look: Look = { dark: dark(), reduced };
      const w = world.current;
      if (w.kind === 'glide') drawGlide(ctx, w.s, look); else drawRush(ctx, w.s, look);
      if (runRef.current.shield) {
        if (w.kind === 'glide') drawShield(ctx, PLANE_X, w.s.y, PLANE_R + 9, now / 1000);
        else drawShield(ctx, w.s.x, CAR_Y, 50, now / 1000);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [openQuestion, loading]);

  const begin = () => {
    world.current = fresh(id);
    reset();
    asked.current = 0;
    setRunBoth(newRun());
    setPoints(0);
    setNewBest(false);
    setAsk(null);
    setPhase('playing');
    if (id === 'glide') world.current = { kind: 'glide', s: flap(startGlide()) };
  };

  const act = useCallback((dir: 0 | -1 | 1) => {
    const p = phaseRef.current;
    if (p === 'ready') { begin(); return; }
    if (p !== 'playing') return;
    const w = world.current;
    if (w.kind === 'glide') world.current = { kind: 'glide', s: flap(w.s) };
    else if (dir !== 0) world.current = { kind: 'rush', s: steer(w.s, dir) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (r: Run) => {
    setPhase('over');
    if (r.asked > 0) track({ quizzes: 1 });
    const total = score(r);
    if (total > best) { setBest(total); setNewBest(true); storage.set(bestKey(id), String(total)); }
  };

  const answered = (right: boolean) => {
    if (!ask) return;
    const q = deck[ask.index];
    // A missed flashcard comes back soon in Review.
    if (!right && q?.card) {
      reviews.current ??= reviewRepo.list();
      void reviews.current.then((st) => rate(st, q.card!, 'again'));
    }
    const r = answer(runRef.current, ask.kind, right, ask.index);
    setRunBoth(r);
    setAsk(null);
    if (r.over) { finish(r); return; }
    if (ask.kind === 'rescue') recover();
    setPhase('playing');
  };

  // Keys: Space / ↑ to fly, ← → to change lanes, P or Escape to pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      const p = phaseRef.current;
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (p === 'playing' || p === 'paused')) {
        e.preventDefault(); setPhase(p === 'playing' ? 'paused' : 'playing'); return;
      }
      if (p !== 'ready' && p !== 'playing') return;
      if (e.target instanceof HTMLButtonElement && p === 'ready') return; // the Start button handles itself
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); act(0); }
      else if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); act(-1); }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); act(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  // Leaving the tab pauses the game.
  useEffect(() => {
    const onHide = () => { if (document.hidden && phaseRef.current === 'playing') setPhase('paused'); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    act(id === 'glide' ? 0 : e.clientX - r.left < r.width / 2 ? -1 : 1);
  };

  if (loading) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (!deck.length) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <BackLink to={back} label={tg.title} />
        <Alert>{tg.notEnough}</Alert>
      </div>
    );
  }

  const total = points + run.bonus;
  const q = ask ? deck[ask.index] : null;
  const missed = run.missed.map((i) => deck[i]).filter(Boolean);

  return (
    <div className="mx-auto max-w-md space-y-3">
      <BackLink to={back} label={tg.title} />

      {/* Kept mounted after the game ends so the canvas and its loop carry on into the next game. */}
      <div className={cn('space-y-3', phase === 'over' && 'hidden')}>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
            <span className="ms-auto text-sm font-semibold tabular-nums" aria-live="off">{tg.score}: <span key={total} className={total ? 'animate-digit' : undefined}>{total}</span></span>
            {run.shield && <ShieldCheck className="size-5 text-accent-600 dark:text-accent-300" role="img" aria-label={tg.shield} />}
            <span className="flex items-center gap-0.5" role="img" aria-label={tg.lives(run.lives)}>
              {Array.from({ length: LIVES }, (_, i) => (
                <Heart key={i} className={cn('size-4', i < run.lives ? 'fill-rose-500 text-rose-500' : 'text-muted')} aria-hidden="true" />
              ))}
            </span>
            <button type="button" disabled={phase !== 'playing' && phase !== 'paused'} onClick={() => setPhase(phase === 'paused' ? 'playing' : 'paused')}
              aria-label={phase === 'paused' ? tg.resume : tg.pause}
              className="flex size-9 items-center justify-center rounded-full border border-line bg-surface hover:bg-surface-2 disabled:opacity-40">
              {phase === 'paused' ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
          </div>

          {/* As big as fits: full width, but never taller than the screen leaves room for (with the lane buttons under Lane Rush). */}
          <div className="relative mx-auto overflow-hidden rounded-[1.75rem] border border-line shadow-[var(--shadow-soft)]" dir="ltr"
            style={{ width: `min(100%, calc((100dvh - ${id === 'rush' ? 16.5 : 12.5}rem) * 2 / 3))` }}>
            <canvas ref={canvas} onPointerDown={tap} role="img" aria-label={`${tg.area(name)}. ${tg[id].controls}`}
              className="block aspect-[2/3] w-full touch-none select-none" />

            {phase === 'ready' && (
              <div className="absolute inset-0 flex items-end justify-center bg-slate-950/10 p-3" dir="auto">
                <div className="w-full space-y-2.5 rounded-3xl bg-surface/95 p-4 text-center shadow-[var(--shadow-lift)] backdrop-blur animate-pop-in">
                  <p className="font-semibold">{tg[id].body}</p>
                  <p className="text-sm text-muted">{tg[id].controls}</p>
                  {best > 0 && <p className="text-sm text-muted">{tg.best(best)}</p>}
                  <Button size="lg" block onClick={begin}>{tg.start}</Button>
                </div>
              </div>
            )}
            {phase === 'paused' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 p-4">
                <Button size="lg" icon={<Play className="size-5" />} onClick={() => setPhase('playing')}>{tg.resume}</Button>
              </div>
            )}
            {phase === 'question' && q && ask && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 p-3" dir="auto">
                <QuestionCard key={ask.n} q={q} ask={ask.kind} onDone={answered} />
              </div>
            )}
          </div>

          {id === 'rush' && (
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-2" dir="ltr">
              <Button variant="secondary" size="lg" disabled={phase !== 'playing'} onPointerDown={(e) => { e.preventDefault(); act(-1); }} aria-label={tg.left}>
                <ChevronLeft className="size-6" aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="lg" disabled={phase !== 'playing'} onPointerDown={(e) => { e.preventDefault(); act(1); }} aria-label={tg.right}>
                <ChevronRight className="size-6" aria-hidden="true" />
              </Button>
            </div>
          )}
      </div>

      {phase === 'over' && (
        <Card className="space-y-5 p-6 text-center animate-pop-in" aria-live="polite">
          <Trophy className="mx-auto size-12 text-accent-500" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold">{tg.over}</h1>
            <p className="mt-1 text-4xl font-bold tabular-nums">{total}</p>
            <p className="text-muted">{newBest ? <strong className="text-accent-600 dark:text-accent-300">{tg.newBest}</strong> : tg.best(best)}</p>
            {run.asked > 0 && <p className="mt-1 text-sm text-muted">{tg.answered(run.right, run.asked)}</p>}
          </div>
          {missed.length > 0 && (
            <div className="text-start">
              <h2 className="mb-2 font-semibold">{tg.missed}</h2>
              <ul className="space-y-2 text-sm">
                {missed.map((m, i) => (
                  <li key={i} className="rounded-xl border border-line p-3" dir="auto">
                    <RichInline text={m.prompt} /><br />
                    <span className="text-muted">{tg.answerWas} </span><RichInline text={m.options[m.correct]} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<RotateCcw className="size-4" />} onClick={() => { world.current = fresh(id); setPhase('ready'); }}>{tg.again}</Button>
            <Link to={back} className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">{tg.all}</Link>
            <Link to="/lectures/review" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">{tg.reviewCards}</Link>
          </div>
        </Card>
      )}
    </div>
  );
};
